import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminUser } from '@/lib/auth/admin'

// POST — create a free makeup session
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const supabaseAdmin = getServiceRoleClient()
    const body = await req.json()
    const { original_session_id, booking_id, makeup_date, branch_id, notes } = body

    if (!booking_id || !makeup_date) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 })
    }

    // Get original session info if provided
    let startTime = '09:00'
    let endTime = '11:00'
    let courseTypeId = null
    let targetBranchId = branch_id

    if (original_session_id) {
      const { data: origSession } = await supabaseAdmin
        .from('booking_sessions')
        .select('start_time, end_time, bookings(branch_id, course_type_id)')
        .eq('id', original_session_id)
        .single() as any

      if (origSession) {
        startTime = origSession.start_time || startTime
        endTime = origSession.end_time || endTime
        courseTypeId = origSession.bookings?.course_type_id
        if (!targetBranchId) targetBranchId = origSession.bookings?.branch_id
      }
    }

    // Create the makeup booking_session (is_makeup = true, no charge)
    const { data, error } = await supabaseAdmin
      .from('booking_sessions')
      .insert({
        booking_id,
        date: makeup_date,
        start_time: startTime,
        end_time: endTime,
        status: 'scheduled',
        is_makeup: true,
        notes: notes || 'วันชดเชย (ไม่คิดเงิน)',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
