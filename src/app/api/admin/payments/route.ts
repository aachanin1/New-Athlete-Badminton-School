import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import { approveProgressivePaymentBatch, rejectProgressivePaymentBatch } from '@/lib/progressive-payment-batch'
import { expireProgressiveBatchIfNeeded, isSameOriginMutation } from '@/lib/progressive-payment-integration'
import { isProgressivePaymentReviewEnabled } from '@/lib/progressive-pricing-feature'
import { callTask10, Task10Error } from '@/lib/task10-policy'

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
    return NextResponse.json(await callTask10(adminSupabase, 'task10_review_legacy_payment_v1', {
      p_actor_id: admin.id, p_payment_id: paymentId, p_action: normalizedAction,
      p_notes: (notes || '').trim(), p_request_id: requestKey || randomUUID(),
    }))
  } catch (err) {
    if (err instanceof Task10Error) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status })
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Admin payment action error:', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${message}` }, { status: 500 })
  }
}
