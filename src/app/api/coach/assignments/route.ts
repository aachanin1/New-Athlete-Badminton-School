import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { logActivity } from '@/lib/activity-log'
import { ensureScheduleSlot } from '@/lib/schedule-slot-utils'

async function requireAssignmentManager(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await (supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as any)

  if (!profile || !['head_coach', 'admin', 'super_admin'].includes(profile.role)) {
    return null
  }

  return { user, role: profile.role as string }
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const manager = await requireAssignmentManager(supabase)
  if (!manager) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { scheduleSlotId, branchId, courseTypeId, date, startTime, endTime, coachId } = await request.json()

    if (!branchId || !courseTypeId || !date || !startTime || !endTime) {
      return NextResponse.json({ error: 'ข้อมูลรอบสอนไม่ครบ' }, { status: 400 })
    }

    const adminSupabase = getServiceRoleClient()

    if (manager.role === 'head_coach') {
      const { data: ownBranch } = await (adminSupabase
        .from('coach_branches')
        .select('branch_id')
        .eq('coach_id', manager.user.id)
        .eq('branch_id', branchId)
        .maybeSingle() as any)

      if (!ownBranch) {
        return NextResponse.json({ error: 'คุณไม่มีสิทธิ์จัดการรอบสอนของสาขานี้' }, { status: 403 })
      }
    }

    let resolvedSlotId = scheduleSlotId as string | null
    if (!resolvedSlotId) {
      resolvedSlotId = await ensureScheduleSlot({
        branchId,
        courseTypeId,
        date,
        startTime,
        endTime,
      })
    }

    const { data: matchingSessions } = await (adminSupabase
      .from('booking_sessions')
      .select('id, schedule_slot_id, bookings!inner(course_type_id)')
      .eq('date', date)
      .eq('branch_id', branchId)
      .eq('start_time', startTime)
      .eq('end_time', endTime)
      .neq('status', 'rescheduled') as any)

    const sessionIdsToBackfill = (matchingSessions || [])
      .filter((session: any) => session.bookings?.course_type_id === courseTypeId && session.schedule_slot_id !== resolvedSlotId)
      .map((session: any) => session.id)

    if (sessionIdsToBackfill.length > 0) {
      const { error: backfillError } = await (adminSupabase
        .from('booking_sessions')
        .update({ schedule_slot_id: resolvedSlotId })
        .in('id', sessionIdsToBackfill) as any)

      if (backfillError) {
        return NextResponse.json({ error: `อัปเดตข้อมูลรอบเรียนไม่สำเร็จ: ${backfillError.message}` }, { status: 500 })
      }
    }

    if (coachId) {
      const { data: targetCoachBranch } = await (adminSupabase
        .from('coach_branches')
        .select('coach_id')
        .eq('coach_id', coachId)
        .eq('branch_id', branchId)
        .maybeSingle() as any)

      if (!targetCoachBranch) {
        return NextResponse.json({ error: 'โค้ชคนนี้ไม่ได้อยู่ในสาขานี้' }, { status: 400 })
      }
    }

    await (adminSupabase.from('coach_assignments') as any)
      .delete()
      .eq('schedule_slot_id', resolvedSlotId)

    if (coachId) {
      const { error: insertError } = await (adminSupabase.from('coach_assignments') as any).insert({
        coach_id: coachId,
        schedule_slot_id: resolvedSlotId,
        assigned_by: manager.user.id,
      })

      if (insertError) {
        return NextResponse.json({ error: `บันทึกการมอบหมายไม่สำเร็จ: ${insertError.message}` }, { status: 500 })
      }
    }

    await logActivity({
      userId: manager.user.id,
      action: coachId ? 'assign_coach_to_slot' : 'clear_coach_assignment',
      entityType: 'coach_assignment',
      entityId: resolvedSlotId,
      details: {
        coachId: coachId || null,
        branchId,
        courseTypeId,
        date,
        startTime,
        endTime,
      },
      ipAddress: request.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ success: true, scheduleSlotId: resolvedSlotId })
  } catch (error: any) {
    console.error('Coach assignment error:', error)
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
