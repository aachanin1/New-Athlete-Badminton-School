import { NextRequest, NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity-log'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { notifyAssignedCoachesForSlot } from '@/lib/coach-notifications'
import { createClient } from '@/lib/supabase/server'
import type { StudentType } from '@/types/database'

type AssignmentManagerRole = 'head_coach' | 'admin' | 'super_admin'

interface GroupPayload {
  name?: string
  coachId?: string | null
  levelMin?: number | null
  levelMax?: number | null
  sortOrder?: number
  studentSessionIds?: string[]
}

interface BookingSessionForGroup {
  id: string
  schedule_slot_id: string
  child_id: string | null
  bookings?: {
    user_id: string
    learner_type: 'self' | 'child'
  } | null
}

interface ScheduleSlotForNotification {
  id: string
  branch_id: string
  date: string
  start_time: string
  end_time: string
  branches?: { name: string | null } | null
  course_types?: { name: string | null } | null
}

async function requireAssignmentManager(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as unknown as { data: { role: string } | null }

  if (!profile || !['head_coach', 'admin', 'super_admin'].includes(profile.role)) {
    return null
  }

  return { user, role: profile.role as AssignmentManagerRole }
}

function cleanGroupName(name: string | undefined, fallback: string) {
  const value = (name || '').trim()
  return value || fallback
}

function normalizeLevel(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function getStudentFromSession(session: BookingSessionForGroup) {
  const isChild = Boolean(session.child_id)
  const studentId = isChild ? session.child_id : session.bookings?.user_id
  if (!studentId) return null

  return {
    student_id: studentId,
    student_type: isChild ? 'child' as StudentType : 'adult' as StudentType,
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const manager = await requireAssignmentManager(supabase)
  if (!manager) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json() as {
      scheduleSlotId?: string
      branchId?: string
      groups?: GroupPayload[]
    }

    const { scheduleSlotId, branchId } = body
    const groups = Array.isArray(body.groups) ? body.groups : []

    if (!scheduleSlotId || !branchId) {
      return NextResponse.json({ error: 'ข้อมูลรอบสอนไม่ครบ' }, { status: 400 })
    }

    if (groups.length === 0) {
      return NextResponse.json({ error: 'กรุณาสร้างอย่างน้อย 1 กลุ่ม' }, { status: 400 })
    }

    const adminSupabase = getServiceRoleClient()

    if (manager.role === 'head_coach') {
      const { data: ownBranch } = await adminSupabase
        .from('coach_branches')
        .select('branch_id')
        .eq('coach_id', manager.user.id)
        .eq('branch_id', branchId)
        .maybeSingle() as unknown as { data: { branch_id: string } | null }

      if (!ownBranch) {
        return NextResponse.json({ error: 'คุณไม่มีสิทธิ์จัดกลุ่มรอบสอนของสาขานี้' }, { status: 403 })
      }
    }

    const { data: slot } = await adminSupabase
      .from('schedule_slots')
      .select(`
        id,
        branch_id,
        date,
        start_time,
        end_time,
        branches(name),
        course_types(name)
      `)
      .eq('id', scheduleSlotId)
      .single() as unknown as { data: ScheduleSlotForNotification | null }

    if (!slot || slot.branch_id !== branchId) {
      return NextResponse.json({ error: 'ไม่พบรอบสอนที่ต้องการจัดกลุ่ม' }, { status: 404 })
    }

    const submittedSessionIds = Array.from(new Set(groups.flatMap((group) => group.studentSessionIds || [])))

    const { data: sessions } = submittedSessionIds.length > 0
      ? await adminSupabase
        .from('booking_sessions')
        .select('id, schedule_slot_id, child_id, bookings!inner(user_id, learner_type)')
        .in('id', submittedSessionIds) as unknown as { data: BookingSessionForGroup[] | null }
      : { data: [] as BookingSessionForGroup[] }

    const sessionMap = new Map((sessions || []).map((session) => [session.id, session]))
    const invalidSession = submittedSessionIds.find((id) => sessionMap.get(id)?.schedule_slot_id !== scheduleSlotId)
    if (invalidSession) {
      return NextResponse.json({ error: 'มีผู้เรียนที่ไม่ได้อยู่ในรอบสอนนี้' }, { status: 400 })
    }

    const submittedCoachIds = groups.map((group) => group.coachId).filter(Boolean) as string[]
    const coachIds = Array.from(new Set(submittedCoachIds))
    if (coachIds.length !== submittedCoachIds.length) {
      return NextResponse.json({ error: 'โค้ช 1 คนไม่สามารถรับผิดชอบหลายกลุ่มในรอบเวลาเดียวกันได้' }, { status: 400 })
    }

    if (coachIds.length > 0) {
      const { data: coachBranches } = await adminSupabase
        .from('coach_branches')
        .select('coach_id')
        .eq('branch_id', branchId)
        .in('coach_id', coachIds) as unknown as { data: { coach_id: string }[] | null }

      const allowedCoachIds = new Set((coachBranches || []).map((row) => row.coach_id))
      const invalidCoachId = coachIds.find((coachId) => !allowedCoachIds.has(coachId))
      if (invalidCoachId) {
        return NextResponse.json({ error: 'มีโค้ชที่ไม่ได้อยู่ในสาขานี้' }, { status: 400 })
      }
    }

    await adminSupabase
      .from('coach_assignment_groups')
      .delete()
      .eq('schedule_slot_id', scheduleSlotId)

    await adminSupabase
      .from('coach_assignments')
      .delete()
      .eq('schedule_slot_id', scheduleSlotId)

    const groupRows = groups.map((group, index) => ({
      schedule_slot_id: scheduleSlotId,
      coach_id: group.coachId || null,
      name: cleanGroupName(group.name, `กลุ่ม ${index + 1}`),
      level_min: normalizeLevel(group.levelMin),
      level_max: normalizeLevel(group.levelMax),
      sort_order: Number.isFinite(Number(group.sortOrder)) ? Number(group.sortOrder) : index,
      notes: null,
      created_by: manager.user.id,
    }))

    const { data: insertedGroups, error: groupError } = await adminSupabase
      .from('coach_assignment_groups')
      .insert(groupRows)
      .select('id, sort_order, coach_id') as unknown as {
        data: { id: string; sort_order: number; coach_id: string | null }[] | null
        error: { message: string } | null
      }

    if (groupError || !insertedGroups) {
      return NextResponse.json({ error: `บันทึกกลุ่มไม่สำเร็จ: ${groupError?.message || 'unknown error'}` }, { status: 500 })
    }

    const insertedByOrder = new Map(insertedGroups.map((group) => [group.sort_order, group]))
    const studentRows = groups.flatMap((group, index) => {
      const sortOrder = Number.isFinite(Number(group.sortOrder)) ? Number(group.sortOrder) : index
      const insertedGroup = insertedByOrder.get(sortOrder)
      if (!insertedGroup) return []

      return (group.studentSessionIds || []).flatMap((bookingSessionId) => {
        const session = sessionMap.get(bookingSessionId)
        const student = session ? getStudentFromSession(session) : null
        if (!student) return []

        return [{
          group_id: insertedGroup.id,
          booking_session_id: bookingSessionId,
          student_id: student.student_id,
          student_type: student.student_type,
        }]
      })
    })

    if (studentRows.length > 0) {
      const { error: studentError } = await adminSupabase
        .from('coach_assignment_group_students')
        .insert(studentRows) as unknown as { error: { message: string } | null }

      if (studentError) {
        await adminSupabase
          .from('coach_assignment_groups')
          .delete()
          .eq('schedule_slot_id', scheduleSlotId)
        return NextResponse.json({ error: `บันทึกผู้เรียนในกลุ่มไม่สำเร็จ: ${studentError.message}` }, { status: 500 })
      }
    }

    const assignedCoachIds = Array.from(new Set(insertedGroups
      .map((group) => group.coach_id)
      .filter((coachId): coachId is string => Boolean(coachId))))
    const assignmentRows = assignedCoachIds.map((coachId) => ({
      coach_id: coachId,
      schedule_slot_id: scheduleSlotId,
      assigned_by: manager.user.id,
    }))

    if (assignmentRows.length > 0) {
      const { error: assignmentError } = await adminSupabase
        .from('coach_assignments')
        .insert(assignmentRows) as unknown as { error: { message: string } | null }

      if (assignmentError) {
        return NextResponse.json({ error: `sync coach_assignments ไม่สำเร็จ: ${assignmentError.message}` }, { status: 500 })
      }
    }

    await Promise.all(assignedCoachIds.map((coachId) => {
      const coachGroups = groups.filter((group) => group.coachId === coachId)
      const coachStudentCount = coachGroups.reduce((sum, group) => sum + (group.studentSessionIds?.length || 0), 0)

      return notifyAssignedCoachesForSlot(adminSupabase, {
        coachIds: [coachId],
        slot,
        groupCount: coachGroups.length,
        studentCount: coachStudentCount,
      })
    }))

    await logActivity({
      userId: manager.user.id,
      action: 'save_coach_assignment_groups',
      entityType: 'coach_assignment_group',
      entityId: scheduleSlotId,
      details: {
        scheduleSlotId,
        branchId,
        groupCount: groups.length,
        studentCount: studentRows.length,
        coachIds,
      },
      ipAddress: request.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ success: true, scheduleSlotId })
  } catch (error: unknown) {
    console.error('Coach assignment groups error:', error)
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
