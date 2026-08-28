import { NextRequest, NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity-log'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { createClient } from '@/lib/supabase/server'
import {
  ensureScheduleSlot,
  resolveCanonicalScheduleTemplate,
  ScheduleSlotIntegrityError,
} from '@/lib/schedule-slot-utils'
import type { UserRole } from '@/types/database'

interface ProfileRoleRow {
  role: UserRole
}

interface AssignmentPayload {
  scheduleSlotId?: string | null
  branchId?: string
  courseTypeId?: string
  date?: string
  startTime?: string
  endTime?: string
  coachId?: string | null
}

interface BranchAccessRow {
  branch_id: string
}

interface TargetCoachBranchRow {
  coach_id: string
}

interface MatchingSessionRow {
  id: string
  schedule_slot_id: string | null
  bookings?: { course_type_id: string | null } | null
}

interface DbError {
  message: string
  code?: string
}

async function requireAssignmentManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as unknown as { data: ProfileRoleRow | null }

  if (!profile || !['head_coach', 'admin', 'super_admin'].includes(profile.role)) {
    return null
  }

  return { user, role: profile.role }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const manager = await requireAssignmentManager(supabase)
  if (!manager) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const payload = await request.json() as AssignmentPayload
    const { scheduleSlotId, branchId, courseTypeId, date, startTime, endTime, coachId } = payload

    if (!branchId || !courseTypeId || !date || !startTime || !endTime) {
      return NextResponse.json({ error: 'ข้อมูลรอบสอนไม่ครบ' }, { status: 400 })
    }

    const adminSupabase = getServiceRoleClient()

    if (manager.role === 'head_coach') {
      const { data: ownBranch } = await adminSupabase
        .from('coach_branches')
        .select('branch_id')
        .eq('coach_id', manager.user.id)
        .eq('branch_id', branchId)
        .maybeSingle() as unknown as { data: BranchAccessRow | null }

      if (!ownBranch) {
        return NextResponse.json({ error: 'คุณไม่มีสิทธิ์จัดการรอบสอนของสาขานี้' }, { status: 403 })
      }
    }

    const { data: matchingSessions, error: matchingSessionsError } = await adminSupabase
      .from('booking_sessions')
      .select('id, schedule_slot_id, bookings!inner(course_type_id)')
      .eq('date', date)
      .eq('branch_id', branchId)
      .eq('start_time', startTime)
      .eq('end_time', endTime)
      .neq('status', 'rescheduled')
      .neq('status', 'walleted') as unknown as {
        data: MatchingSessionRow[] | null
        error: DbError | null
      }

    if (matchingSessionsError) throw matchingSessionsError

    const matchingCourseSessions = (matchingSessions || [])
      .filter((session) => session.bookings?.course_type_id === courseTypeId)
    const existingSessionSlotIds = Array.from(new Set(
      matchingCourseSessions
        .map((session) => session.schedule_slot_id)
        .filter((slotId): slotId is string => Boolean(slotId)),
    ))
    if (!scheduleSlotId && existingSessionSlotIds.length > 1) {
      return NextResponse.json({
        code: 'SCHEDULE_SLOT_SESSION_SLOT_CONFLICT',
        error: 'พบ schedule slot มากกว่าหนึ่งรายการสำหรับรอบสอนเดียวกัน กรุณาให้ผู้ดูแลตรวจสอบ',
      }, { status: 409 })
    }

    const canonicalTemplate = await resolveCanonicalScheduleTemplate({
      supabase: adminSupabase,
      branchId,
      courseTypeId,
      date,
      startTime,
      endTime,
    })
    const resolvedSlotId = await ensureScheduleSlot({
      supabase: adminSupabase,
      scheduleSlotId: scheduleSlotId || existingSessionSlotIds[0] || null,
      templateId: canonicalTemplate.id,
      branchId,
      courseTypeId,
      date,
      startTime,
      endTime,
    })

    const sessionIdsToBackfill = matchingCourseSessions
      .filter((session) => session.schedule_slot_id !== resolvedSlotId)
      .map((session) => session.id)

    if (sessionIdsToBackfill.length > 0) {
      const { error: backfillError } = await adminSupabase
        .from('booking_sessions')
        .update({ schedule_slot_id: resolvedSlotId })
        .in('id', sessionIdsToBackfill) as unknown as { error: DbError | null }

      if (backfillError) {
        return NextResponse.json({ error: `อัปเดตข้อมูลรอบเรียนไม่สำเร็จ: ${backfillError.message}` }, { status: 500 })
      }
    }

    if (coachId) {
      const { data: targetCoachBranch } = await adminSupabase
        .from('coach_branches')
        .select('coach_id')
        .eq('coach_id', coachId)
        .eq('branch_id', branchId)
        .maybeSingle() as unknown as { data: TargetCoachBranchRow | null }

      if (!targetCoachBranch) {
        return NextResponse.json({ error: 'โค้ชคนนี้ไม่ได้อยู่ในสาขานี้' }, { status: 400 })
      }
    }

    await adminSupabase
      .from('coach_assignments')
      .delete()
      .eq('schedule_slot_id', resolvedSlotId)

    if (coachId) {
      const { error: insertError } = await adminSupabase
        .from('coach_assignments')
        .insert({
          coach_id: coachId,
          schedule_slot_id: resolvedSlotId,
          assigned_by: manager.user.id,
        }) as unknown as { error: DbError | null }

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
  } catch (error) {
    console.error('Coach assignment error:', error)
    if (error instanceof ScheduleSlotIntegrityError) {
      return NextResponse.json({ code: error.code, error: error.message }, { status: 409 })
    }
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
