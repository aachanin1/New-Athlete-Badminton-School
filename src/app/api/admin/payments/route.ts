import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import { notifyUser } from '@/lib/notifications'

interface PaymentRow {
  id: string
  booking_id: string
  user_id: string
  status: string
}

type NotificationSupabase = Parameters<typeof notifyUser>[0]

// PATCH: Approve or Reject a payment
export async function PATCH(request: NextRequest) {
  const access = await requireAdminMenuAccess('payments')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })
  const admin = access.ctx.user

  try {
    const { paymentId, action, notes } = await request.json()

    if (!paymentId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'paymentId and action (approve/reject) are required' }, { status: 400 })
    }

    const adminSupabase = getServiceRoleClient()

    // Get payment to find booking_id
    const { data: payment, error: fetchErr } = await adminSupabase
      .from('payments')
      .select('id, booking_id, user_id, status')
      .eq('id', paymentId)
      .single() as unknown as { data: PaymentRow | null; error: { message: string } | null }

    if (fetchErr || !payment) {
      return NextResponse.json({ error: 'ไม่พบรายการชำระเงิน' }, { status: 404 })
    }

    if (payment.status !== 'pending') {
      return NextResponse.json({ error: `รายการนี้ถูก${payment.status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}ไปแล้ว` }, { status: 400 })
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    const now = new Date().toISOString()

    // Update payment
    const { error: updateErr } = await adminSupabase
      .from('payments')
      .update({
        status: newStatus,
        verified_by: admin.id,
        verified_at: now,
        notes: notes || (action === 'approve' ? 'Admin อนุมัติ' : 'Admin ปฏิเสธ'),
      })
      .eq('id', paymentId)

    if (updateErr) {
      return NextResponse.json({ error: `อัปเดตไม่สำเร็จ: ${updateErr.message}` }, { status: 500 })
    }

    // Update booking status
    if (action === 'approve') {
      await adminSupabase
        .from('bookings')
        .update({ status: 'verified' })
        .eq('id', payment.booking_id)
    } else {
      // Rejected: revert booking to pending_payment so user can re-upload
      await adminSupabase
        .from('bookings')
        .update({ status: 'pending_payment' })
        .eq('id', payment.booking_id)
    }

    await notifyUser(adminSupabase as unknown as NotificationSupabase, {
      user_id: payment.user_id,
      title: action === 'approve' ? 'ยืนยันการชำระเงินแล้ว' : 'การชำระเงินต้องตรวจสอบใหม่',
      message: action === 'approve'
        ? 'ผู้ดูแลได้ยืนยันการชำระเงินของคุณแล้ว'
        : 'ผู้ดูแลปฏิเสธการชำระเงินครั้งนี้ กรุณาตรวจสอบและแนบสลิปใหม่',
      type: 'payment',
      link_url: '/dashboard/history',
    })

    return NextResponse.json({ success: true, status: newStatus })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error('Admin payment action error:', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${err.message}` }, { status: 500 })
  }
}
