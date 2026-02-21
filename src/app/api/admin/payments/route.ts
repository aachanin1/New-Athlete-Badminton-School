import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createAdminClient(url, serviceKey)
}

async function requireAdmin(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as any
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) return null
  return user
}

// PATCH: Approve or Reject a payment
export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { paymentId, action, notes } = await request.json()

    if (!paymentId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'paymentId and action (approve/reject) are required' }, { status: 400 })
    }

    const adminSupabase = getAdminSupabase()

    // Get payment to find booking_id
    const { data: payment, error: fetchErr } = await adminSupabase
      .from('payments')
      .select('id, booking_id, status')
      .eq('id', paymentId)
      .single() as any

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

    return NextResponse.json({ success: true, status: newStatus })
  } catch (err: any) {
    console.error('Admin payment action error:', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${err.message}` }, { status: 500 })
  }
}
