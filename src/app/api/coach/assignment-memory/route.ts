import { NextRequest, NextResponse } from 'next/server'

import { CoachAssignmentDataUnavailableError } from '@/lib/coach-assignment-resolution'
import {
  createCoachMemoryReadMetrics,
  createCompleteCoachMemoryReadClient,
  getCoachMemoryKey,
  getCoachStudentMemoryMap,
  type CoachMemoryEntry,
} from '@/lib/coach-student-memory'
import { createClient } from '@/lib/supabase/server'
import { getBangkokDateString } from '@/lib/utils'
import type { StudentType } from '@/types/database'

type AssignmentMemoryRole = 'head_coach' | 'super_admin'

interface AssignmentMemorySlotRow {
  id: string
  branch_id: string
  date: string
  start_time: string
}

interface AssignmentMemorySessionRow {
  id: string
  schedule_slot_id: string | null
  branch_id: string
  child_id: string | null
  bookings?: {
    user_id: string
    learner_type: 'self' | 'child'
    status: string
  } | null
}

interface AssignmentMemoryGroupRow {
  coach_id: string | null
  coach_assignment_group_students?: { booking_session_id: string }[] | null
}

interface AssignmentMemorySessionResult {
  data: AssignmentMemorySessionRow[] | null
  error: { message: string } | null
  count: number | null
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function typedError(code: string, error: string, status: number) {
  return NextResponse.json({ code, error }, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

function getBangkokSlotStart(date: string, startTime: string) {
  return new Date(`${date}T${startTime.slice(0, 8)}+07:00`)
}

function rankSlotSuggestion(a: CoachMemoryEntry, b: CoachMemoryEntry) {
  if (b.totalSessions !== a.totalSessions) return b.totalSessions - a.totalSessions
  return b.lastTaughtDate.localeCompare(a.lastTaughtDate)
}

function getSlotSuggestion(memoryEntries: CoachMemoryEntry[][]) {
  const scores = new Map<string, CoachMemoryEntry & { studentCount: number }>()
  memoryEntries.forEach((entries) => {
    const suggested = entries[0]
    if (!suggested) return
    const current = scores.get(suggested.coachId) || { ...suggested, totalSessions: 0, studentCount: 0 }
    current.totalSessions += suggested.totalSessions
    current.studentCount += 1
    if (suggested.lastTaughtDate > current.lastTaughtDate) current.lastTaughtDate = suggested.lastTaughtDate
    scores.set(suggested.coachId, current)
  })

  return Array.from(scores.values()).sort((a, b) => {
    if (b.studentCount !== a.studentCount) return b.studentCount - a.studentCount
    return rankSlotSuggestion(a, b)
  })[0] || null
}

export async function GET(request: NextRequest) {
  const startedAt = performance.now()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return typedError('MEMORY_UNAUTHORIZED', 'Unauthorized', 401)

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as unknown as { data: { role: string } | null; error: { message: string } | null }
  if (profileError || !profile || !['head_coach', 'super_admin'].includes(profile.role)) {
    return typedError('MEMORY_FORBIDDEN', 'Forbidden', 403)
  }
  const role = profile.role as AssignmentMemoryRole

  const scheduleSlotId = request.nextUrl.searchParams.get('scheduleSlotId') || ''
  if (!UUID_PATTERN.test(scheduleSlotId)) {
    return typedError('MEMORY_INVALID_SLOT', 'ข้อมูลรอบสอนไม่ถูกต้อง', 400)
  }

  try {
    const { data: slot, error: slotError } = await supabase
      .from('schedule_slots')
      .select('id, branch_id, date, start_time')
      .eq('id', scheduleSlotId)
      .maybeSingle() as unknown as {
        data: AssignmentMemorySlotRow | null
        error: { message: string } | null
      }
    if (slotError) throw new CoachAssignmentDataUnavailableError('Coach Memory slot query failed', slotError.message)
    if (!slot) return typedError('MEMORY_SLOT_NOT_FOUND', 'ไม่พบรอบสอน', 404)

    if (role === 'head_coach') {
      const { data: ownBranch, error: branchError } = await supabase
        .from('coach_branches')
        .select('branch_id')
        .eq('coach_id', user.id)
        .eq('branch_id', slot.branch_id)
        .maybeSingle() as unknown as {
          data: { branch_id: string } | null
          error: { message: string } | null
        }
      if (branchError) throw new CoachAssignmentDataUnavailableError('Coach Memory branch access query failed', branchError.message)
      if (!ownBranch) return typedError('MEMORY_BRANCH_FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึงรอบสอนของสาขานี้', 403)
    } else {
      const { data: activeBranch, error: branchError } = await supabase
        .from('branches')
        .select('id')
        .eq('id', slot.branch_id)
        .eq('is_active', true)
        .maybeSingle() as unknown as {
          data: { id: string } | null
          error: { message: string } | null
        }
      if (branchError) throw new CoachAssignmentDataUnavailableError('Coach Memory active branch query failed', branchError.message)
      if (!activeBranch) return typedError('MEMORY_BRANCH_FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึงรอบสอนของสาขานี้', 403)
    }

    const now = new Date()
    const currentBangkokMonth = getBangkokDateString(now).slice(0, 7)
    if (slot.date.slice(0, 7) !== currentBangkokMonth || now >= getBangkokSlotStart(slot.date, slot.start_time)) {
      return typedError(
        'MEMORY_SLOT_HISTORICAL_OR_STARTED',
        'ประวัติโค้ชโหลดได้เฉพาะรอบปัจจุบันที่ยังไม่เริ่ม',
        409,
      )
    }

    const { data: existingGroups, error: groupError, count: groupCount } = await supabase
      .from('coach_assignment_groups')
      .select('coach_id, coach_assignment_group_students(booking_session_id)', { count: 'exact' })
      .eq('schedule_slot_id', slot.id) as unknown as {
        data: AssignmentMemoryGroupRow[] | null
        error: { message: string } | null
        count: number | null
      }
    if (groupError) throw new CoachAssignmentDataUnavailableError('Coach Memory assignment-state query failed', groupError.message)
    if (!Array.isArray(existingGroups) || groupCount !== existingGroups.length) {
      throw new CoachAssignmentDataUnavailableError('Coach Memory assignment-state query failed', 'supporting query was incomplete')
    }
    const isAssigned = existingGroups.some((group) => (
      Boolean(group.coach_id) || (group.coach_assignment_group_students || []).length > 0
    ))
    if (isAssigned) {
      return typedError('MEMORY_SLOT_ALREADY_ASSIGNED', 'รอบสอนนี้มีการมอบหมายแล้ว', 409)
    }

    const metrics = createCoachMemoryReadMetrics()
    const memoryClient = createCompleteCoachMemoryReadClient(supabase, metrics)
    const sessionResult = await memoryClient
      .from('booking_sessions')
      .select('id, schedule_slot_id, branch_id, child_id, bookings!inner(user_id, learner_type, status)')
      .eq('schedule_slot_id', slot.id)
      .eq('branch_id', slot.branch_id)
      .in('status', ['scheduled', 'completed', 'absent'])
      .eq('bookings.status', 'verified')
      .neq('status', 'rescheduled') as unknown as AssignmentMemorySessionResult
    if (sessionResult.error || !Array.isArray(sessionResult.data) || sessionResult.count !== sessionResult.data.length) {
      throw new CoachAssignmentDataUnavailableError(
        'Coach Memory authoritative roster query failed',
        sessionResult.error?.message || 'roster query was incomplete',
      )
    }
    if (sessionResult.data.length === 0) {
      return typedError('MEMORY_SLOT_ROSTER_EMPTY', 'รอบสอนนี้ไม่มีรายชื่อผู้เรียนที่ใช้งานได้', 409)
    }

    const studentRefs = Array.from(new Map(sessionResult.data.map((session) => {
      const id = session.child_id || session.bookings?.user_id || ''
      const type: StudentType = session.child_id ? 'child' : 'adult'
      return [`${type}:${id}`, { id, type }]
    })).values()).filter((student) => Boolean(student.id))
    const memoryMap = await getCoachStudentMemoryMap(memoryClient, studentRefs)
    const students = sessionResult.data.map((session) => {
      const id = session.child_id || session.bookings?.user_id || ''
      const type: StudentType = session.child_id ? 'child' : 'adult'
      const memory = memoryMap[getCoachMemoryKey({ id, type })]
      return {
        bookingSessionId: session.id,
        coachMemory: memory?.coaches || [],
        suggestedCoachId: memory?.suggestedCoach?.coachId || null,
        suggestedCoachName: memory?.suggestedCoach?.coachName || null,
      }
    })
    const slotSuggestion = getSlotSuggestion(students.map((student) => student.coachMemory))
    const totalMs = Number((performance.now() - startedAt).toFixed(1))
    const memoryReadCallCount = Object.values(metrics.callsByTable).reduce((sum, count) => sum + count, 0)
    const authCallCount = 1
    const authorizationSelectCallCount = 4
    const callCount = authCallCount + authorizationSelectCallCount + memoryReadCallCount

    console.info('[coach-assignment-memory] complete', {
      role,
      rosterRows: sessionResult.data.length,
      studentCount: studentRefs.length,
      callCount,
      bookingSessionPages: metrics.bookingSessionPages,
      supportingBatches: metrics.supportingBatches,
      totalMs,
    })

    return NextResponse.json({
      students,
      suggestedCoachId: slotSuggestion?.coachId || null,
      suggestedCoachName: slotSuggestion?.coachName || null,
      suggestedCoachReason: slotSuggestion
        ? `เคยสอนผู้เรียนในรอบนี้ ${slotSuggestion.studentCount} คน รวม ${slotSuggestion.totalSessions} ครั้ง`
        : null,
      metrics: {
        callCount,
        authCallCount,
        authorizationSelectCallCount,
        memoryReadCallCount,
        bookingSessionPages: metrics.bookingSessionPages,
        supportingBatches: metrics.supportingBatches,
        rowsByTable: metrics.rowsByTable,
        requestDurationMsByTable: metrics.requestDurationMsByTable,
        rosterRows: sessionResult.data.length,
        studentCount: studentRefs.length,
        totalMs,
      },
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof CoachAssignmentDataUnavailableError) {
      console.error('[coach-assignment-memory] data unavailable', { code: error.code })
      return typedError('MEMORY_DATA_UNAVAILABLE', 'โหลดประวัติโค้ชไม่ครบ กรุณาลองใหม่', 503)
    }
    console.error('[coach-assignment-memory] unexpected failure')
    return typedError('MEMORY_INTERNAL_ERROR', 'โหลดประวัติโค้ชไม่สำเร็จ', 500)
  }
}
