import { NextRequest, NextResponse } from 'next/server'

import { getServiceRoleClient } from '@/lib/auth/admin'
import { notifyAssignedCoachesForSlot } from '@/lib/coach-notifications'
import {
  checkCoachAssignmentConflicts,
  formatCoachAssignmentDatabaseError,
  formatExactCoachConflict,
  formatLegacyCoachWarnings,
  type LegacyCoachAssignmentWarningRow,
} from '@/lib/coach-assignment-conflicts'
import {
  formatAutoGroupNameError,
  resolveCoachAssignmentGroupName,
} from '@/lib/coach-assignment-group-naming'
import { loadAssignmentGroupNamingStudents } from '@/lib/coach-assignment-group-naming-server'
import { createClient } from '@/lib/supabase/server'

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
    status: string
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

async function requireAssignmentManager(supabase: Awaited<ReturnType<typeof createClient>>) {
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

function normalizeLevel(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function getBangkokSlotStart(date: string, startTime: string) {
  return new Date(`${date}T${startTime.slice(0, 8)}+07:00`)
}

function isAssignmentLocked(date: string, startTime: string, now = new Date()) {
  return now >= getBangkokSlotStart(date, startTime)
}

function getLifecycleConflict(errorMessage: string) {
  if (errorMessage.includes('COACH_ASSIGNMENT_DUPLICATE_MEMBERSHIP')) {
    return {
      code: 'COACH_ASSIGNMENT_DUPLICATE_MEMBERSHIP',
      error: 'พบผู้เรียนซ้ำข้ามกลุ่ม กรุณารีเฟรชและตรวจการแบ่งกลุ่มอีกครั้ง',
    }
  }
  if (errorMessage.includes('COACH_ASSIGNMENT_ROSTER_CONFLICT')) {
    return {
      code: 'COACH_ASSIGNMENT_ROSTER_CONFLICT',
      error: 'รายชื่อผู้เรียนในรอบเปลี่ยนแล้ว กรุณารีเฟรชและตรวจกลุ่มก่อนบันทึกอีกครั้ง',
    }
  }
  return null
}

function getCanonicalGroups(saveResult: unknown) {
  if (!saveResult || typeof saveResult !== 'object' || Array.isArray(saveResult)) return []
  const snapshot = (saveResult as { snapshot?: unknown }).snapshot
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return []
  const groups = (snapshot as { groups?: unknown }).groups
  return Array.isArray(groups) ? groups : []
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
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

    if (isAssignmentLocked(slot.date, slot.start_time)) {
      return NextResponse.json({ error: 'รอบเรียนนี้เริ่มหรือเลยเวลาเรียนแล้ว ไม่สามารถมอบหมาย/แก้ไขกลุ่มได้ กรุณาใช้ flow ตรวจสอบ attendance gap หรือข้อมูลย้อนหลังแทน' }, { status: 409 })
    }

    const submittedSessionIds = Array.from(new Set(groups.flatMap((group) => group.studentSessionIds || [])))

    const { data: sessions } = submittedSessionIds.length > 0
      ? await adminSupabase
        .from('booking_sessions')
        .select('id, schedule_slot_id, child_id, bookings!inner(user_id, learner_type, status)')
        .in('id', submittedSessionIds) as unknown as { data: BookingSessionForGroup[] | null }
      : { data: [] as BookingSessionForGroup[] }

    const sessionMap = new Map((sessions || []).map((session) => [session.id, session]))
    const invalidSession = submittedSessionIds.find((id) => sessionMap.get(id)?.schedule_slot_id !== scheduleSlotId)
    if (invalidSession) {
      return NextResponse.json({ error: 'มีผู้เรียนที่ไม่ได้อยู่ในรอบสอนนี้' }, { status: 400 })
    }

    const nonVerifiedSession = submittedSessionIds.find((id) => sessionMap.get(id)?.bookings?.status !== 'verified')
    if (nonVerifiedSession) {
      return NextResponse.json({ error: 'จองยังไม่สมบูรณ์ ต้องยืนยันการชำระเงินก่อนมอบหมายโค้ช' }, { status: 400 })
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

    const legacyWarnings: LegacyCoachAssignmentWarningRow[] = []
    for (const coachId of coachIds) {
      const conflictResult = await checkCoachAssignmentConflicts({
        supabase: adminSupabase,
        coachId,
        scheduleSlotId,
        replaceCurrentSlot: true,
      })
      if (conflictResult.exactConflicts[0]) {
        return NextResponse.json({
          error: formatExactCoachConflict(conflictResult.exactConflicts[0]),
        }, { status: 409 })
      }
      legacyWarnings.push(...conflictResult.legacyWarnings)
    }

    const namingStudentsBySessionId = await loadAssignmentGroupNamingStudents(adminSupabase, submittedSessionIds)
    const normalizedGroups = [] as Array<{
      name: string
      coachId: string | null
      levelMin: number | null
      levelMax: number | null
      sortOrder: number
      studentSessionIds: string[]
    }>

    for (const [index, group] of groups.entries()) {
      const studentSessionIds = group.studentSessionIds || []
      const namingStudents = studentSessionIds
        .map((sessionId) => namingStudentsBySessionId.get(sessionId))
        .filter((student): student is NonNullable<typeof student> => Boolean(student))
      const resolvedName = resolveCoachAssignmentGroupName({ currentName: group.name, students: namingStudents })

      if (!resolvedName.name && resolvedName.error) {
        return NextResponse.json({ error: formatAutoGroupNameError(resolvedName.error) }, { status: 400 })
      }

      normalizedGroups.push({
        name: resolvedName.name || (group.name || '').trim(),
        coachId: group.coachId || null,
        levelMin: resolvedName.levelMin ?? normalizeLevel(group.levelMin),
        levelMax: resolvedName.levelMax ?? normalizeLevel(group.levelMax),
        sortOrder: Number.isFinite(Number(group.sortOrder)) ? Number(group.sortOrder) : index,
        studentSessionIds,
      })
    }

    const { data: saveResult, error: saveError } = await adminSupabase.rpc('save_coach_assignment_groups_v2', {
      p_schedule_slot_id: scheduleSlotId,
      p_actor_id: manager.user.id,
      p_groups: normalizedGroups,
    })

    if (saveError) {
      const lifecycleConflict = getLifecycleConflict(saveError.message)
      if (lifecycleConflict) {
        return NextResponse.json(lifecycleConflict, { status: 409 })
      }
      const conflictMessage = formatCoachAssignmentDatabaseError(saveError.message)
      return NextResponse.json({
        error: conflictMessage || `บันทึกกลุ่มไม่สำเร็จ: ${saveError.message}`,
      }, { status: conflictMessage ? 409 : 500 })
    }

    const assignedCoachIds = coachIds
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

    return NextResponse.json({
      success: true,
      scheduleSlotId,
      warnings: formatLegacyCoachWarnings(legacyWarnings),
      canonicalGroups: getCanonicalGroups(saveResult),
      result: saveResult,
    })
  } catch (error: unknown) {
    console.error('Coach assignment groups error:', error)
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
