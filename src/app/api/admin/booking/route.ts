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

// POST: Create booking on behalf of a user
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const {
      targetUserId,
      learnerType,
      childId,
      branchId,
      courseTypeId,
      month,
      year,
      totalSessions,
      totalPrice,
      sessions,
      autoVerify,
    } = body

    if (!targetUserId || !branchId || !courseTypeId || !month || !year || !sessions || sessions.length === 0) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ กรุณากรอกให้ครบถ้วน' }, { status: 400 })
    }

    const adminSupabase = getAdminSupabase()

    // Create booking
    const bookingStatus = autoVerify ? 'verified' : 'pending_payment'
    const { data: bookingData, error: insertErr } = await adminSupabase
      .from('bookings')
      .insert({
        user_id: targetUserId,
        learner_type: learnerType || 'self',
        child_id: childId || null,
        branch_id: branchId,
        course_type_id: courseTypeId,
        month,
        year,
        total_sessions: totalSessions,
        total_price: totalPrice,
        status: bookingStatus,
      })
      .select('id')
      .single() as any

    if (insertErr) {
      return NextResponse.json({ error: `สร้างการจองไม่สำเร็จ: ${insertErr.message}` }, { status: 500 })
    }

    // Insert booking sessions
    const sessionRows = sessions.map((s: any) => ({
      booking_id: bookingData.id,
      schedule_slot_id: s.scheduleSlotId || bookingData.id, // fallback
      date: s.date,
      start_time: s.startTime,
      end_time: s.endTime,
      branch_id: s.branchId || branchId,
      child_id: s.childId || null,
      status: 'scheduled',
      is_makeup: false,
    }))

    const { error: sessErr } = await adminSupabase.from('booking_sessions').insert(sessionRows)
    if (sessErr) {
      // Cleanup booking if sessions fail
      await adminSupabase.from('bookings').delete().eq('id', bookingData.id)
      return NextResponse.json({ error: `สร้างรอบเรียนไม่สำเร็จ: ${sessErr.message}` }, { status: 500 })
    }

    // If auto-verify, create a payment record too
    if (autoVerify) {
      await adminSupabase.from('payments').insert({
        booking_id: bookingData.id,
        user_id: targetUserId,
        amount: totalPrice,
        method: 'admin_bypass',
        status: 'approved',
        verified_by: admin.id,
        verified_at: new Date().toISOString(),
        notes: `Admin จองแทนและอนุมัติ โดย ${admin.id}`,
      })
    }

    return NextResponse.json({ success: true, bookingId: bookingData.id })
  } catch (err: any) {
    console.error('Admin create booking error:', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${err.message}` }, { status: 500 })
  }
}
