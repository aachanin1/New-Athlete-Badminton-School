import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import { logActivity } from '@/lib/activity-log'
import { notifyUser } from '@/lib/notifications'
import { approveProgressivePaymentBatch, rejectProgressivePaymentBatch } from '@/lib/progressive-payment-batch'
import { expireProgressiveBatchIfNeeded, isSameOriginMutation } from '@/lib/progressive-payment-integration'
import { isProgressivePaymentReviewEnabled } from '@/lib/progressive-pricing-feature'

interface PaymentRow {
  id: string
  booking_id: string
  user_id: string
  status: string
  notes: string | null
}

type NotificationSupabase = Parameters<typeof notifyUser>[0]
type PaymentReviewAction = 'approve' | 'reject' | 'send_back' | 'cancel'

// PATCH: Admin payment review actions for SlipOK/manual verification cases.
export async function PATCH(request: NextRequest) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }
  const access = await requireAdminMenuAccess('payments')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })
  const admin = access.ctx.user

  try {
    const { paymentId, action, notes, sourceKind, requestKey } = await request.json() as {
      paymentId?: string
      action?: PaymentReviewAction
      notes?: string
      sourceKind?: 'legacy' | 'progressive'
      requestKey?: string
    }

    if (!paymentId || !action || !['approve', 'reject', 'send_back', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'paymentId and action are required' }, { status: 400 })
    }

    const normalizedAction: Exclude<PaymentReviewAction, 'reject'> = action === 'reject' ? 'send_back' : action

    if (sourceKind === 'progressive') {
      if (!isProgressivePaymentReviewEnabled()) {
        return NextResponse.json({ error: 'Progressive payment review is disabled' }, { status: 403 })
      }
      if (!requestKey || normalizedAction === 'cancel') {
        return NextResponse.json({ error: 'Progressive batches support approve or reject only' }, { status: 400 })
      }
      const batch = await expireProgressiveBatchIfNeeded(paymentId)
      if (normalizedAction === 'approve' && batch.status === 'approved') {
        return NextResponse.json({ success: true, status: 'approved' })
      }
      if (normalizedAction === 'send_back' && batch.status === 'rejected') {
        return NextResponse.json({ success: true, status: 'rejected' })
      }
      if (!['submitted', 'under_review'].includes(batch.status)) {
        return NextResponse.json({ error: 'รายการนี้ไม่อยู่ในสถานะที่ตรวจสอบได้' }, { status: 409 })
      }

      if (normalizedAction === 'approve') {
        await approveProgressivePaymentBatch({
          batchId: paymentId,
          actorId: admin.id,
          idempotencyKey: requestKey,
          hasCouponReservation: true,
        })
      } else {
        const rejectionReason = (notes || '').trim()
        if (!rejectionReason) return NextResponse.json({ error: 'กรุณาระบุเหตุผล' }, { status: 400 })
        await rejectProgressivePaymentBatch({
          batchId: paymentId,
          actorId: admin.id,
          rejectionReason,
          idempotencyKey: requestKey,
          hasCouponReservation: true,
        })
      }

      return NextResponse.json({
        success: true,
        status: normalizedAction === 'approve' ? 'approved' : 'rejected',
      })
    }

    const adminSupabase = getServiceRoleClient()

    const { data: payment, error: fetchErr } = await adminSupabase
      .from('payments')
      .select('id, booking_id, user_id, status, notes')
      .eq('id', paymentId)
      .single() as unknown as { data: PaymentRow | null; error: { message: string } | null }

    if (fetchErr || !payment) {
      return NextResponse.json({ error: 'ไม่พบรายการชำระเงิน' }, { status: 404 })
    }

    if (payment.status !== 'pending') {
      return NextResponse.json({ error: 'รายการนี้ถูกตรวจสอบไปแล้ว' }, { status: 400 })
    }

    const newPaymentStatus = normalizedAction === 'approve' ? 'approved' : 'rejected'
    const nextBookingStatus = normalizedAction === 'approve'
      ? 'verified'
      : normalizedAction === 'cancel'
        ? 'cancelled'
        : 'pending_payment'
    const now = new Date().toISOString()
    const adminNote = (notes || '').trim()
    const fallbackNote = normalizedAction === 'approve'
      ? 'Admin manual approval'
      : normalizedAction === 'cancel'
        ? 'Admin rejected and cancelled booking'
        : 'Admin returned payment for slip re-upload'
    const actionNote = `[Admin payment review: ${normalizedAction}] ${adminNote || fallbackNote}`
    const mergedNotes = [payment.notes, actionNote].filter(Boolean).join('\n')

    const { error: updateErr } = await adminSupabase
      .from('payments')
      .update({
        status: newPaymentStatus,
        verified_by: admin.id,
        verified_at: now,
        notes: mergedNotes,
      })
      .eq('id', paymentId)

    if (updateErr) {
      return NextResponse.json({ error: `อัปเดต payment ไม่สำเร็จ: ${updateErr.message}` }, { status: 500 })
    }

    const { error: bookingUpdateErr } = await adminSupabase
      .from('bookings')
      .update({ status: nextBookingStatus })
      .eq('id', payment.booking_id)

    if (bookingUpdateErr) {
      await adminSupabase
        .from('payments')
        .update({
          status: payment.status,
          verified_by: null,
          verified_at: null,
          notes: payment.notes,
        })
        .eq('id', paymentId)

      return NextResponse.json({ error: `อัปเดต booking ไม่สำเร็จ: ${bookingUpdateErr.message}` }, { status: 500 })
    }

    await notifyUser(adminSupabase as unknown as NotificationSupabase, {
      user_id: payment.user_id,
      title: normalizedAction === 'approve'
        ? 'ยืนยันการชำระเงินแล้ว'
        : normalizedAction === 'cancel'
          ? 'การจองถูกยกเลิก'
          : 'กรุณาแนบสลิปใหม่',
      message: normalizedAction === 'approve'
        ? 'ผู้ดูแลยืนยันการชำระเงินของคุณเรียบร้อยแล้ว'
        : normalizedAction === 'cancel'
          ? `ผู้ดูแลยกเลิกการจองนี้${adminNote ? `: ${adminNote}` : ''}`
          : `สลิปเดิมต้องแก้ไข/แนบใหม่${adminNote ? `: ${adminNote}` : ''}`,
      type: 'payment',
      link_url: '/dashboard/history',
    })

    await logActivity({
      userId: admin.id,
      action: `admin_payment_${normalizedAction}`,
      entityType: 'payment',
      entityId: payment.id,
      details: {
        bookingId: payment.booking_id,
        paymentStatus: newPaymentStatus,
        bookingStatus: nextBookingStatus,
        notes: adminNote || null,
      },
    })

    return NextResponse.json({
      success: true,
      status: newPaymentStatus,
      bookingStatus: nextBookingStatus,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Admin payment action error:', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${message}` }, { status: 500 })
  }
}
