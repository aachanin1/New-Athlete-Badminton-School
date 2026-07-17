import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import { syncBookingSessionStatusFromAttendance } from '@/lib/attendance-write-through'
import { notifyUser, notifyUserOnce } from '@/lib/notifications'
import { logActivity } from '@/lib/activity-log'
import { ensureScheduleSlot } from '@/lib/schedule-slot-utils'
import {
  checkCoachAssignmentConflicts,
  formatCoachAssignmentDatabaseError,
  formatExactCoachConflict,
  formatLegacyCoachWarnings,
} from '@/lib/coach-assignment-conflicts'
import {
  formatAutoGroupNameError,
  resolveAssignmentGroupName,
} from '@/lib/coach-assignment-group-naming'
import { loadAssignmentGroupNamingStudents } from '@/lib/coach-assignment-group-naming-server'
import type { AttendanceStatus, StudentType } from '@/types/database'

type NotificationSupabase = Parameters<typeof notifyUserOnce>[0]

interface OriginalSessionRow {
  id: string
  booking_id: string
  date: string
  end_time: string | null
  status: string
  child_id: string | null
  bookings?: { user_id: string | null; course_type_id: string | null } | null
}

interface SourceSessionRow {
  id: string
  status: string
}

interface ReviewSessionRow {
  id: string
  booking_id: string
  branch_id: string
  schedule_slot_id: string | null
  date: string
  start_time: string | null
  end_time: string | null
  status: string
  is_makeup: boolean | null
  child_id: string | null
  bookings?: {
    user_id: string | null
    course_type_id: string | null
    learner_type: string | null
  } | null
}

interface ExistingAttendanceRow {
  id: string
  status?: AttendanceStatus | null
}

interface CoachCheckinEvidenceRow {
  coach_id: string | null
  photo_url: string | null
  location_lat: number | null
  location_lng: number | null
}

interface AssignmentGroupInsertRow {
  id: string
}

interface AssignmentGroupRow {
  coach_id: string | null
  coach_assignment_group_students: { booking_session_id: string }[] | null
}

interface AssignmentGroupDetailRow {
  id: string
  coach_id: string | null
  name: string | null
  coach_assignment_group_students: { booking_session_id: string }[] | null
}

interface PopulatedCoachGroupRow {
  id: string
  coach_id: string | null
  name: string | null
  coach_assignment_group_students: { booking_session_id: string }[] | null
}

interface MoveTargetGroupRow {
  id: string
  schedule_slot_id: string | null
  coach_id: string | null
  name: string | null
  coach_assignment_group_students: { booking_session_id: string }[] | null
}

interface ExistingGroupStudentRow {
  id: string
  group_id: string
  booking_session_id: string
  coach_assignment_groups?: {
    id: string
    schedule_slot_id: string | null
    coach_id: string | null
    name: string | null
  } | null
}

interface AttendanceLookupRow {
  booking_session_id: string
  student_id: string | null
  status: AttendanceStatus | null
}

interface CoachAssignmentRow {
  coach_id: string
}

interface CoachProfileRow {
  id: string
  role: string
}

interface GroupStudentInsertRow {
  group_id: string
  booking_session_id: string
  student_id: string
  student_type: StudentType
}

function getErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
  return formatCoachAssignmentDatabaseError(message) || message
}

async function validateExactCoachAssignment({
  supabaseAdmin,
  coachId,
  scheduleSlotId,
  excludeGroupIds = [],
}: {
  supabaseAdmin: ReturnType<typeof getServiceRoleClient>
  coachId: string
  scheduleSlotId: string
  excludeGroupIds?: string[]
}) {
  const result = await checkCoachAssignmentConflicts({
    supabase: supabaseAdmin,
    coachId,
    scheduleSlotId,
    excludeGroupIds,
  })

  return {
    error: result.exactConflicts[0] ? formatExactCoachConflict(result.exactConflicts[0]) : null,
    warning: formatLegacyCoachWarnings(result.legacyWarnings),
  }
}

function getMonthBounds(date: string) {
  const [yearText, monthText] = date.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1
  const start = new Date(year, monthIndex, 1)
  const nextStart = new Date(year, monthIndex + 1, 1)
  const followingStart = new Date(year, monthIndex + 2, 1)
  const toInput = (value: Date) => {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return {
    start: toInput(start),
    nextStart: toInput(nextStart),
    followingStartInput: toInput(followingStart),
    followingStart,
  }
}

function getMonthEndIso(date: string) {
  const [year, month] = date.split('-').map(Number)
  const nextMonthStart = month === 12
    ? new Date(`${year + 1}-01-01T00:00:00+07:00`)
    : new Date(`${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00+07:00`)
  return new Date(nextMonthStart.getTime() - 1).toISOString()
}

function isInNextCalendarMonth(originalDate: string, makeupDate: string) {
  const bounds = getMonthBounds(originalDate)
  return makeupDate >= bounds.nextStart && makeupDate < bounds.followingStartInput
}

function getBangkokSessionEnd(date: string, endTime: string | null) {
  const normalizedEndTime = (endTime || '23:59:59').trim()
  return new Date(`${date}T${normalizedEndTime}+07:00`)
}

function isPastSession(date: string, endTime: string | null) {
  return getBangkokSessionEnd(date, endTime).getTime() < Date.now()
}

function normalizeSlotTime(value: string) {
  return value.length === 5 ? `${value}:00` : value
}

function isFutureMakeupTarget(date: string, startTime: string) {
  return new Date(`${date}T${normalizeSlotTime(startTime)}+07:00`).getTime() > Date.now()
}

function getDayOfWeek(date: string) {
  return new Date(`${date}T00:00:00+07:00`).getDay()
}

function normalizeReason(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 500) : ''
}

function normalizeAttendanceStatus(value: unknown): AttendanceStatus | null {
  return value === 'present' || value === 'late' || value === 'absent' ? value : null
}

function normalizeSessionIds(value: unknown) {
  return Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim())
  ))
}

function getStudentContext(session: ReviewSessionRow) {
  const studentId = session.child_id || session.bookings?.user_id || null
  const studentType: StudentType = session.child_id ? 'child' : 'adult'
  return { studentId, studentType }
}

async function getAssignedCoachIds(supabaseAdmin: ReturnType<typeof getServiceRoleClient>, session: ReviewSessionRow) {
  if (!session.schedule_slot_id) return []

  const { data: groups } = await supabaseAdmin
    .from('coach_assignment_groups')
    .select('coach_id, coach_assignment_group_students(booking_session_id)')
    .eq('schedule_slot_id', session.schedule_slot_id) as unknown as { data: AssignmentGroupRow[] | null }

  const groupCoachIds = (groups || [])
    .filter((group) => (group.coach_assignment_group_students || []).some((student) => student.booking_session_id === session.id))
    .map((group) => group.coach_id)
    .filter((coachId): coachId is string => Boolean(coachId))

  if (groupCoachIds.length > 0) return Array.from(new Set(groupCoachIds))

  const { data: assignments } = await supabaseAdmin
    .from('coach_assignments')
    .select('coach_id')
    .eq('schedule_slot_id', session.schedule_slot_id) as unknown as { data: CoachAssignmentRow[] | null }

  return Array.from(new Set((assignments || []).map((assignment) => assignment.coach_id).filter(Boolean)))
}

async function getStrictGroupCoachIds(supabaseAdmin: ReturnType<typeof getServiceRoleClient>, session: ReviewSessionRow) {
  if (!session.schedule_slot_id) return []

  const { data: groups } = await supabaseAdmin
    .from('coach_assignment_groups')
    .select('coach_id, coach_assignment_group_students(booking_session_id)')
    .eq('schedule_slot_id', session.schedule_slot_id) as unknown as { data: AssignmentGroupRow[] | null }

  return Array.from(new Set((groups || [])
    .filter((group) => (group.coach_assignment_group_students || []).some((student) => student.booking_session_id === session.id))
    .map((group) => group.coach_id)
    .filter((coachId): coachId is string => Boolean(coachId))))
}

async function findPopulatedCoachGroupForCoachInRound(
  supabaseAdmin: ReturnType<typeof getServiceRoleClient>,
  firstSession: ReviewSessionRow,
  coachId: string,
) {
  if (!firstSession.schedule_slot_id) return null

  const firstCourseTypeId = firstSession.bookings?.course_type_id || null
  const { data: groups, error: groupsError } = await supabaseAdmin
    .from('coach_assignment_groups')
    .select('id, coach_id, name, coach_assignment_group_students(booking_session_id)')
    .eq('schedule_slot_id', firstSession.schedule_slot_id)
    .eq('coach_id', coachId) as unknown as {
      data: PopulatedCoachGroupRow[] | null
      error: { message: string } | null
    }

  if (groupsError) throw new Error(groupsError.message)

  const populatedGroups = (groups || []).filter((group) => (
    (group.coach_assignment_group_students || []).some((student) => Boolean(student.booking_session_id))
  ))

  if (populatedGroups.length === 0) return null

  const groupSessionIds = Array.from(new Set(populatedGroups.flatMap((group) => (
    group.coach_assignment_group_students || []
  ).map((student) => student.booking_session_id).filter(Boolean))))

  if (groupSessionIds.length === 0) return null

  const { data: groupSessions, error: groupSessionsError } = await supabaseAdmin
    .from('booking_sessions')
    .select(`
      id,
      booking_id,
      branch_id,
      schedule_slot_id,
      date,
      start_time,
      end_time,
      status,
      is_makeup,
      child_id,
      bookings(user_id, course_type_id, learner_type)
    `)
    .in('id', groupSessionIds) as unknown as {
      data: ReviewSessionRow[] | null
      error: { message: string } | null
    }

  if (groupSessionsError) throw new Error(groupSessionsError.message)

  const groupSessionById = new Map((groupSessions || []).map((session) => [session.id, session]))
  return populatedGroups.find((group) => {
    const sessionsInGroup = (group.coach_assignment_group_students || [])
      .map((student) => groupSessionById.get(student.booking_session_id))
      .filter((session): session is ReviewSessionRow => Boolean(session))

    return sessionsInGroup.length > 0 && sessionsInGroup.every((session) => (
      session.schedule_slot_id === firstSession.schedule_slot_id &&
      session.date === firstSession.date &&
      session.start_time === firstSession.start_time &&
      session.end_time === firstSession.end_time &&
      session.branch_id === firstSession.branch_id &&
      (session.bookings?.course_type_id || null) === firstCourseTypeId
    ))
  }) || null
}

async function ensureLegacyCoachAssignment({
  supabaseAdmin,
  scheduleSlotId,
  coachId,
  actorId,
}: {
  supabaseAdmin: ReturnType<typeof getServiceRoleClient>
  scheduleSlotId: string
  coachId: string
  actorId: string
}) {
  const { data: existingLegacy } = await supabaseAdmin
    .from('coach_assignments')
    .select('id')
    .eq('schedule_slot_id', scheduleSlotId)
    .eq('coach_id', coachId)
    .maybeSingle() as unknown as { data: { id: string } | null }

  if (!existingLegacy) {
    const { error } = await supabaseAdmin
      .from('coach_assignments')
      .insert({
        coach_id: coachId,
        schedule_slot_id: scheduleSlotId,
        assigned_by: actorId,
      })

    if (error) throw new Error(error.message)
  }
}

async function ensureRetrospectiveAssignment({
  supabaseAdmin,
  session,
  coachId,
  actorId,
}: {
  supabaseAdmin: ReturnType<typeof getServiceRoleClient>
  session: ReviewSessionRow
  coachId: string
  actorId: string
}) {
  if (!session.schedule_slot_id) {
    throw new Error('Cannot create retrospective assignment without schedule slot')
  }

  const { studentId } = getStudentContext(session)
  if (!studentId) {
    throw new Error('Cannot resolve student for retrospective assignment')
  }

  const { data: existingStudents } = await supabaseAdmin
    .from('coach_assignment_group_students')
    .select(`
      id,
      group_id,
      coach_assignment_groups!inner(schedule_slot_id, coach_id)
    `)
    .eq('booking_session_id', session.id)
    .eq('coach_assignment_groups.schedule_slot_id', session.schedule_slot_id) as unknown as {
      data: {
        id: string
        group_id: string
        coach_assignment_groups?: { schedule_slot_id: string; coach_id: string | null } | null
      }[] | null
    }

  const existingForCoach = (existingStudents || []).find((row) => row.coach_assignment_groups?.coach_id === coachId)
  if (existingForCoach) return existingForCoach.group_id

  if ((existingStudents || []).length > 0) {
    const { error: deleteError } = await supabaseAdmin
      .from('coach_assignment_group_students')
      .delete()
      .in('id', (existingStudents || []).map((row) => row.id))

    if (deleteError) throw new Error(deleteError.message)
  }

  const { data: insertedGroupId, error: groupError } = await supabaseAdmin.rpc(
    'create_exact_coach_assignment_group_v1',
    {
      p_schedule_slot_id: session.schedule_slot_id,
      p_coach_id: coachId,
      p_name: 'บันทึกย้อนหลังโดย Admin',
      p_sort_order: 999,
      p_notes: 'Retroactive assignment created from Admin attendance gap resolution',
      p_actor_id: actorId,
      p_booking_session_ids: [session.id],
    },
  )

  if (groupError || !insertedGroupId) {
    throw new Error(groupError?.message || 'Cannot create retrospective assignment group')
  }

  const { data: existingLegacy } = await supabaseAdmin
    .from('coach_assignments')
    .select('id')
    .eq('schedule_slot_id', session.schedule_slot_id)
    .eq('coach_id', coachId)
    .maybeSingle() as unknown as { data: { id: string } | null }

  if (!existingLegacy) {
    await supabaseAdmin
      .from('coach_assignments')
      .insert({
        coach_id: coachId,
        schedule_slot_id: session.schedule_slot_id,
        assigned_by: actorId,
      })
  }

  return insertedGroupId as string
}

async function upsertRetrospectiveAttendance({
  supabaseAdmin,
  session,
  status,
  coachId,
}: {
  supabaseAdmin: ReturnType<typeof getServiceRoleClient>
  session: ReviewSessionRow
  status: AttendanceStatus
  coachId: string
}) {
  const { studentId, studentType } = getStudentContext(session)
  if (!studentId) {
    throw new Error('Cannot resolve student for retrospective attendance')
  }

  const attendanceTable = supabaseAdmin.from('attendance') as unknown as {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          order: (column: string, options: { ascending: boolean }) => {
            limit: (count: number) => {
              maybeSingle: () => Promise<{ data: ExistingAttendanceRow | null; error: { message: string } | null }>
            }
          }
        }
      }
    }
    update: (values: { coach_id: string; status: AttendanceStatus; checked_at: string }) => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>
    }
    insert: (values: {
      booking_session_id: string
      student_id: string
      student_type: StudentType
      coach_id: string
      status: AttendanceStatus
      checked_at: string
    }) => Promise<{ error: { message: string } | null }>
  }

  const checkedAt = new Date().toISOString()
  const { data: existingAttendance, error: existingAttendanceError } = await attendanceTable
    .select('id')
    .eq('booking_session_id', session.id)
    .eq('student_id', studentId)
    .order('checked_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingAttendanceError) {
    throw new Error(existingAttendanceError.message)
  }

  if (existingAttendance) {
    const { error } = await attendanceTable
      .update({
        coach_id: coachId,
        status,
        checked_at: checkedAt,
      })
      .eq('id', existingAttendance.id)

    if (error) throw new Error(error.message)
  } else {
    const { error } = await attendanceTable.insert({
      booking_session_id: session.id,
      student_id: studentId,
      student_type: studentType,
      coach_id: coachId,
      status,
      checked_at: checkedAt,
    })

    if (error) throw new Error(error.message)
  }
}

export async function POST(req: NextRequest) {
  const access = await requireAdminMenuAccess('makeup')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })

  try {
    const supabaseAdmin = getServiceRoleClient()
    const body = await req.json()
    const {
      original_session_id: originalSessionId,
      booking_id: bookingId,
      makeup_date: makeupDate,
      start_time: startTime,
      end_time: endTime,
      branch_id: branchId,
    } = body as {
      original_session_id?: string
      booking_id?: string
      makeup_date?: string
      start_time?: string
      end_time?: string
      branch_id?: string
    }

    if (!originalSessionId || !bookingId || !makeupDate || !startTime || !endTime || !branchId) {
      return NextResponse.json({ error: 'กรุณาเลือกวัน รอบเรียน และสาขาให้ครบ' }, { status: 400 })
    }

    const { data: originalSession, error: originalError } = await supabaseAdmin
      .from('booking_sessions')
      .select('id, booking_id, date, end_time, status, child_id, bookings(user_id, course_type_id)')
      .eq('id', originalSessionId)
      .single<OriginalSessionRow>()

    if (originalError) {
      return NextResponse.json({ error: originalError.message }, { status: 500 })
    }

    if (!originalSession || (originalSession.status !== 'absent' && !(originalSession.status === 'scheduled' && isPastSession(originalSession.date, originalSession.end_time)))) {
      return NextResponse.json({ error: 'สร้างวันชดเชยได้เฉพาะรอบที่ขาดเรียนหรือเลยวันเรียนแล้วเท่านั้น' }, { status: 400 })
    }

    if (originalSession.booking_id !== bookingId || !originalSession.bookings?.course_type_id) {
      return NextResponse.json({ error: 'ข้อมูลการจองต้นทางไม่ตรงกับรอบเรียน' }, { status: 400 })
    }

    const bounds = getMonthBounds(originalSession.date)

    if (Date.now() >= bounds.followingStart.getTime()) {
      return NextResponse.json({ error: 'หมดเขตชดเชยแล้ว ต้องชดเชยภายในเดือนถัดไปเท่านั้น' }, { status: 400 })
    }

    if (!isInNextCalendarMonth(originalSession.date, makeupDate)) {
      return NextResponse.json({ error: 'วันชดเชยต้องอยู่ในเดือนถัดไปของเดือนเรียนเดิมเท่านั้น' }, { status: 400 })
    }

    if (!isFutureMakeupTarget(makeupDate, startTime)) {
      return NextResponse.json({ error: 'วันและเวลาชดเชยต้องเป็นรอบที่ยังไม่เริ่ม' }, { status: 400 })
    }

    const { data: targetTemplates, error: templateError } = await supabaseAdmin
      .from('schedule_templates')
      .select('id, start_time, end_time')
      .eq('branch_id', branchId)
      .eq('course_type_id', originalSession.bookings.course_type_id)
      .eq('day_of_week', getDayOfWeek(makeupDate))
      .eq('is_active', true)

    if (templateError) return NextResponse.json({ error: templateError.message }, { status: 500 })
    const normalizedStart = normalizeSlotTime(startTime)
    const normalizedEnd = normalizeSlotTime(endTime)
    const targetTemplate = (targetTemplates || []).find((template) => (
      normalizeSlotTime(template.start_time) <= normalizedStart
      && normalizeSlotTime(template.end_time) >= normalizedEnd
    ))
    if (!targetTemplate) {
      return NextResponse.json({ error: 'รอบชดเชยไม่ตรงกับรอบเรียนประจำที่เปิดใช้งาน' }, { status: 400 })
    }

    const scheduleSlotId = await ensureScheduleSlot({
      supabase: supabaseAdmin,
      templateId: targetTemplate.id,
      branchId,
      courseTypeId: originalSession.bookings.course_type_id,
      date: makeupDate,
      startTime,
      endTime,
    })

    let conflictQuery = supabaseAdmin
      .from('booking_sessions')
      .select('id, status, bookings!inner(user_id)')
      .eq('date', makeupDate)
      .lt('start_time', normalizedEnd)
      .gt('end_time', normalizedStart)
      .eq('bookings.user_id', originalSession.bookings.user_id || '')
      .neq('status', 'rescheduled')
      .neq('status', 'walleted')
    conflictQuery = originalSession.child_id
      ? conflictQuery.eq('child_id', originalSession.child_id)
      : conflictQuery.is('child_id', null)
    const { data: conflicts, error: conflictError } = await conflictQuery
    if (conflictError) return NextResponse.json({ error: conflictError.message }, { status: 500 })
    if ((conflicts || []).length > 0) {
      return NextResponse.json({ error: 'ผู้เรียนคนนี้มีรอบเรียนในเวลาที่ซ้ำหรือซ้อนกันแล้ว' }, { status: 409 })
    }

    let sourceQuery = supabaseAdmin
      .from('booking_sessions')
      .select('id, status, bookings!inner(user_id)')
      .gte('date', bounds.start)
      .lt('date', bounds.nextStart)

    if (originalSession.child_id) {
      sourceQuery = sourceQuery.eq('child_id', originalSession.child_id)
    } else {
      sourceQuery = sourceQuery.is('child_id', null).eq('bookings.user_id', originalSession.bookings?.user_id || '')
    }

    const { data: sourceSessions, error: sourceError } = await sourceQuery as unknown as {
      data: SourceSessionRow[] | null
      error: { message: string } | null
    }

    if (sourceError) {
      return NextResponse.json({ error: sourceError.message }, { status: 500 })
    }

    const sourceIds = (sourceSessions || []).map((session) => session.id)
    if (sourceIds.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายการเรียนในเดือนเดิมสำหรับผู้เรียนนี้' }, { status: 400 })
    }

    const { data: existingMakeup, error: existingError } = await supabaseAdmin
      .from('booking_sessions')
      .select('id')
      .in('rescheduled_from_id', sourceIds)
      .eq('is_makeup', true)
      .limit(1)

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    if (existingMakeup && existingMakeup.length > 0) {
      return NextResponse.json({ error: 'ผู้เรียนนี้ใช้สิทธิ์ชดเชยของเดือนนี้แล้ว' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('booking_sessions')
      .insert({
        booking_id: bookingId,
        schedule_slot_id: scheduleSlotId,
        date: makeupDate,
        start_time: startTime,
        end_time: endTime,
        branch_id: branchId,
        child_id: originalSession.child_id,
        status: 'scheduled',
        is_makeup: true,
        rescheduled_from_id: originalSessionId,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (originalSession.bookings?.user_id) {
      await notifyUserOnce(supabaseAdmin as unknown as NotificationSupabase, {
        user_id: originalSession.bookings.user_id,
        title: 'ได้รับวันชดเชยแล้ว',
        message: `Admin จัดวันชดเชยให้วันที่ ${makeupDate} เวลา ${startTime}-${endTime} เรียบร้อยแล้ว`,
        type: 'schedule',
        link_url: '/dashboard/schedule',
      }).catch(() => null)
    }

    await supabaseAdmin
      .from('booking_sessions')
      .update({ status: 'absent' })
      .in('id', sourceIds)
      .eq('status', 'scheduled')

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const access = await requireAdminMenuAccess('makeup')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })

  try {
    const supabaseAdmin = getServiceRoleClient()
    const body = await req.json()
    const { session_id: sessionId, action } = body as {
      session_id?: string
      action?: 'confirm_absent' | 'mark_attendance' | 'request_coach_review' | 'request_coach_evidence' | 'close_review' | 'return_entitlement' | 'resolve_unassigned_round' | 'assign_coach_to_round' | 'replace_coach_for_past_round' | 'move_learner_to_existing_coach_group'
    }
    const reason = normalizeReason((body as { reason?: unknown }).reason)
    const attendanceStatus = normalizeAttendanceStatus((body as { attendance_status?: unknown }).attendance_status)
    const selectedCoachId = typeof (body as { coach_id?: unknown }).coach_id === 'string'
      ? ((body as { coach_id?: string }).coach_id || '').trim()
      : ''
    const targetGroupId = typeof (body as { target_group_id?: unknown }).target_group_id === 'string'
      ? ((body as { target_group_id?: string }).target_group_id || '').trim()
      : ''

    if (action === 'move_learner_to_existing_coach_group') {
      const sessionIds = normalizeSessionIds((body as { session_ids?: unknown }).session_ids)

      if (sessionIds.length === 0) {
        return NextResponse.json({ error: 'session_ids are required' }, { status: 400 })
      }

      if (!targetGroupId) {
        return NextResponse.json({ error: 'กรุณาเลือกกลุ่มโค้ชปลายทางในรอบเดียวกัน' }, { status: 400 })
      }

      if (!selectedCoachId) {
        return NextResponse.json({ error: 'กรุณาเลือกโค้ชของกลุ่มปลายทาง' }, { status: 400 })
      }

      if (!reason) {
        return NextResponse.json({ error: 'กรุณาระบุเหตุผลเพื่อเก็บ audit log' }, { status: 400 })
      }

      const { data: coachProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('id', selectedCoachId)
        .in('role', ['coach', 'head_coach'])
        .maybeSingle() as unknown as { data: CoachProfileRow | null }

      if (!coachProfile) {
        return NextResponse.json({ error: 'พบโค้ชที่เลือกไม่ถูกต้อง' }, { status: 400 })
      }

      const { data: targetSessions, error: targetError } = await supabaseAdmin
        .from('booking_sessions')
        .select(`
          id,
          booking_id,
          branch_id,
          schedule_slot_id,
          date,
          start_time,
          end_time,
          status,
          is_makeup,
          child_id,
          bookings(user_id, course_type_id, learner_type)
        `)
        .in('id', sessionIds) as unknown as { data: ReviewSessionRow[] | null; error: { message: string } | null }

      if (targetError) {
        return NextResponse.json({ error: targetError.message }, { status: 500 })
      }

      if (!targetSessions || targetSessions.length !== sessionIds.length) {
        return NextResponse.json({ error: 'ไม่พบรายการผู้เรียนครบตามรอบที่เลือก' }, { status: 404 })
      }

      const firstSession = targetSessions[0]
      if (!firstSession?.schedule_slot_id) {
        return NextResponse.json({ error: 'รอบนี้ไม่มี schedule slot จึงย้ายเข้ากลุ่มโค้ชเดิมไม่ได้' }, { status: 400 })
      }

      const firstCourseTypeId = firstSession.bookings?.course_type_id || null
      const isSameRound = targetSessions.every((session) => (
        session.schedule_slot_id === firstSession.schedule_slot_id &&
        session.date === firstSession.date &&
        session.start_time === firstSession.start_time &&
        session.end_time === firstSession.end_time &&
        session.branch_id === firstSession.branch_id &&
        (session.bookings?.course_type_id || null) === firstCourseTypeId
      ))

      if (!isSameRound) {
        return NextResponse.json({ error: 'ย้ายเข้ากลุ่มโค้ชได้เฉพาะรายการที่อยู่รอบเรียนเดียวกัน สาขาเดียวกัน เวลาเดียวกัน และคอร์สเดียวกันเท่านั้น' }, { status: 400 })
      }

      const invalidSession = targetSessions.find((session) => (
        session.is_makeup ||
        !['scheduled', 'completed', 'absent'].includes(session.status)
      ))

      if (invalidSession) {
        return NextResponse.json({ error: 'ย้ายเข้ากลุ่มโค้ชได้เฉพาะรอบปกติที่ไม่ถูกยกเลิก เลื่อนรอบ หรือเก็บเข้ากระเป๋าเท่านั้น' }, { status: 400 })
      }

      const expectedStudentBySessionId = new Map<string, string>()
      const targetStudentRows: GroupStudentInsertRow[] = []
      for (const session of targetSessions) {
        const { studentId, studentType } = getStudentContext(session)
        if (!studentId) {
          return NextResponse.json({ error: 'ไม่สามารถระบุผู้เรียนของบางรายการในรอบนี้ได้' }, { status: 400 })
        }
        expectedStudentBySessionId.set(session.id, studentId)
        targetStudentRows.push({
          group_id: targetGroupId,
          booking_session_id: session.id,
          student_id: studentId,
          student_type: studentType,
        })
      }

      const { data: existingAttendanceRows, error: attendanceError } = await supabaseAdmin
        .from('attendance')
        .select('booking_session_id, student_id, status')
        .in('booking_session_id', sessionIds) as unknown as { data: AttendanceLookupRow[] | null; error: { message: string } | null }

      if (attendanceError) {
        return NextResponse.json({ error: attendanceError.message }, { status: 500 })
      }

      const blockingAttendance = (existingAttendanceRows || []).filter((row) => (
        row.booking_session_id &&
        row.student_id &&
        expectedStudentBySessionId.get(row.booking_session_id) === row.student_id
      ))

      if (blockingAttendance.length > 0) {
        return NextResponse.json({ error: 'พบ attendance ของผู้เรียนในรอบนี้แล้ว กรุณาตรวจสอบก่อนย้ายกลุ่มเพื่อไม่ให้ audit/หลักฐานโค้ชคลาดเคลื่อน' }, { status: 400 })
      }

      const { data: targetGroup, error: targetGroupError } = await supabaseAdmin
        .from('coach_assignment_groups')
        .select('id, schedule_slot_id, coach_id, name, coach_assignment_group_students(booking_session_id)')
        .eq('id', targetGroupId)
        .maybeSingle() as unknown as { data: MoveTargetGroupRow | null; error: { message: string } | null }

      if (targetGroupError) {
        return NextResponse.json({ error: targetGroupError.message }, { status: 500 })
      }

      if (!targetGroup) {
        return NextResponse.json({ error: 'ไม่พบกลุ่มโค้ชปลายทาง' }, { status: 404 })
      }

      if (targetGroup.schedule_slot_id !== firstSession.schedule_slot_id) {
        return NextResponse.json({ error: 'กลุ่มโค้ชปลายทางไม่ได้อยู่ใน schedule slot เดียวกัน' }, { status: 400 })
      }

      if (targetGroup.coach_id !== selectedCoachId) {
        return NextResponse.json({ error: 'โค้ชที่เลือกไม่ตรงกับโค้ชของกลุ่มปลายทาง' }, { status: 400 })
      }

      const targetGroupSessionIds = Array.from(new Set((targetGroup.coach_assignment_group_students || [])
        .map((student) => student.booking_session_id)
        .filter(Boolean)))

      if (targetGroupSessionIds.length > 0) {
        const { data: targetGroupSessions, error: targetGroupSessionsError } = await supabaseAdmin
          .from('booking_sessions')
          .select(`
            id,
            booking_id,
            branch_id,
            schedule_slot_id,
            date,
            start_time,
            end_time,
            status,
            is_makeup,
            child_id,
            bookings(user_id, course_type_id, learner_type)
          `)
          .in('id', targetGroupSessionIds) as unknown as { data: ReviewSessionRow[] | null; error: { message: string } | null }

        if (targetGroupSessionsError) {
          return NextResponse.json({ error: targetGroupSessionsError.message }, { status: 500 })
        }

        const mismatchedGroupSession = (targetGroupSessions || []).find((session) => (
          session.schedule_slot_id !== firstSession.schedule_slot_id ||
          session.date !== firstSession.date ||
          session.start_time !== firstSession.start_time ||
          session.end_time !== firstSession.end_time ||
          session.branch_id !== firstSession.branch_id ||
          (session.bookings?.course_type_id || null) !== firstCourseTypeId
        ))

        if (mismatchedGroupSession) {
          return NextResponse.json({ error: 'กลุ่มโค้ชปลายทางมีผู้เรียนที่ไม่ได้อยู่รอบ/สาขา/เวลา/คอร์สเดียวกัน กรุณาตรวจข้อมูลก่อนย้าย' }, { status: 400 })
        }
      }

      const { data: existingMemberships, error: existingMembershipError } = await supabaseAdmin
        .from('coach_assignment_group_students')
        .select(`
          id,
          group_id,
          booking_session_id,
          coach_assignment_groups(id, schedule_slot_id, coach_id, name)
        `)
        .in('booking_session_id', sessionIds) as unknown as {
          data: ExistingGroupStudentRow[] | null
          error: { message: string } | null
        }

      if (existingMembershipError) {
        return NextResponse.json({ error: existingMembershipError.message }, { status: 500 })
      }

      const mismatchedExistingMembership = (existingMemberships || []).find((membership) => (
        membership.coach_assignment_groups?.schedule_slot_id !== firstSession.schedule_slot_id
      ))

      if (mismatchedExistingMembership) {
        return NextResponse.json({ error: 'พบผู้เรียนอยู่ใน coach group คนละ schedule slot กรุณาตรวจข้อมูลก่อนย้ายกลุ่ม' }, { status: 400 })
      }

      const membershipBySessionId = new Map<string, ExistingGroupStudentRow>()
      ;(existingMemberships || []).forEach((membership) => {
        if (!membershipBySessionId.has(membership.booking_session_id)) {
          membershipBySessionId.set(membership.booking_session_id, membership)
        }
      })

      const updateMembershipIds: string[] = []
      const insertMemberships: GroupStudentInsertRow[] = []
      const movedSessionIds: string[] = []
      const attachedSessionIds: string[] = []
      const alreadyAttachedSessionIds: string[] = []
      const previousGroupIds = new Set<string>()

      targetStudentRows.forEach((studentRow) => {
        const existing = membershipBySessionId.get(studentRow.booking_session_id)
        if (!existing) {
          insertMemberships.push(studentRow)
          attachedSessionIds.push(studentRow.booking_session_id)
          return
        }

        if (existing.group_id === targetGroupId) {
          alreadyAttachedSessionIds.push(studentRow.booking_session_id)
          return
        }

        updateMembershipIds.push(existing.id)
        movedSessionIds.push(studentRow.booking_session_id)
        previousGroupIds.add(existing.group_id)
      })

      if (updateMembershipIds.length === 0 && insertMemberships.length === 0) {
        return NextResponse.json({
          success: true,
          already_attached: true,
          target_group_id: targetGroupId,
          target_coach_id: selectedCoachId,
          already_attached_session_ids: alreadyAttachedSessionIds,
        })
      }

      const assignmentValidation = await validateExactCoachAssignment({
        supabaseAdmin,
        coachId: selectedCoachId,
        scheduleSlotId: firstSession.schedule_slot_id,
        excludeGroupIds: [targetGroupId],
      })
      if (assignmentValidation.error) {
        return NextResponse.json({ error: assignmentValidation.error }, { status: 409 })
      }

      if (updateMembershipIds.length > 0) {
        const { error: updateMembershipError } = await supabaseAdmin
          .from('coach_assignment_group_students')
          .update({ group_id: targetGroupId })
          .in('id', updateMembershipIds)

        if (updateMembershipError) {
          const message = formatCoachAssignmentDatabaseError(updateMembershipError.message)
          return NextResponse.json({ error: message || updateMembershipError.message }, { status: message ? 409 : 500 })
        }
      }

      if (insertMemberships.length > 0) {
        const { error: insertMembershipError } = await supabaseAdmin
          .from('coach_assignment_group_students')
          .insert(insertMemberships)

        if (insertMembershipError) {
          const message = formatCoachAssignmentDatabaseError(insertMembershipError.message)
          return NextResponse.json({ error: message || insertMembershipError.message }, { status: message ? 409 : 500 })
        }
      }

      try {
        await ensureLegacyCoachAssignment({
          supabaseAdmin,
          scheduleSlotId: firstSession.schedule_slot_id,
          coachId: selectedCoachId,
          actorId: access.ctx.user.id,
        })
      } catch (error) {
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
      }

      for (const session of targetSessions) {
        await logActivity({
          userId: access.ctx.user.id,
          action: 'attendance_gap_move_learner_to_existing_group',
          entityType: 'booking_sessions',
          entityId: session.id,
          details: {
            reason,
            scheduleSlotId: session.schedule_slot_id,
            targetGroupId,
            targetCoachId: selectedCoachId,
            previousGroupIds: Array.from(previousGroupIds),
            movedSessionIds,
            attachedSessionIds,
            alreadyAttachedSessionIds,
            attendanceWritten: false,
            bookingSessionStatusChanged: false,
            coachEvidenceDeleted: false,
          },
          ipAddress: req.headers.get('x-forwarded-for'),
        })
      }

      await notifyUser(supabaseAdmin as unknown as NotificationSupabase, {
        user_id: selectedCoachId,
        title: 'มีผู้เรียนถูกย้ายเข้ากลุ่มรอบเรียนของคุณ',
        message: `Admin ย้ายผู้เรียนเข้ากลุ่มโค้ชของคุณในรอบ ${firstSession.date} ${firstSession.start_time || ''}-${firstSession.end_time || ''} โดยไม่บันทึก attendance และไม่เปลี่ยนสถานะรอบเรียน: ${reason}`,
        type: 'schedule',
        link_url: `/coach/attendance?date=${firstSession.date}&slot=${firstSession.schedule_slot_id}`,
      }).catch(() => null)

      return NextResponse.json({
        success: true,
        target_group_id: targetGroupId,
        target_coach_id: selectedCoachId,
        moved_session_ids: movedSessionIds,
        attached_session_ids: attachedSessionIds,
        already_attached_session_ids: alreadyAttachedSessionIds,
        previous_group_ids: Array.from(previousGroupIds),
        warnings: assignmentValidation.warning,
      })
    }

    if (action === 'replace_coach_for_past_round') {
      const sessionIds = normalizeSessionIds((body as { session_ids?: unknown }).session_ids)

      if (sessionIds.length === 0) {
        return NextResponse.json({ error: 'session_ids are required' }, { status: 400 })
      }

      if (!selectedCoachId) {
        return NextResponse.json({ error: 'กรุณาเลือกโค้ชตัวจริงที่ต้องรับผิดชอบรอบนี้' }, { status: 400 })
      }

      if (!reason) {
        return NextResponse.json({ error: 'กรุณาระบุเหตุผลเพื่อเก็บ audit log' }, { status: 400 })
      }

      const { data: coachProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('id', selectedCoachId)
        .in('role', ['coach', 'head_coach'])
        .maybeSingle() as unknown as { data: CoachProfileRow | null }

      if (!coachProfile) {
        return NextResponse.json({ error: 'พบโค้ชที่เลือกไม่ถูกต้อง' }, { status: 400 })
      }

      const { data: targetSessions, error: targetError } = await supabaseAdmin
        .from('booking_sessions')
        .select(`
          id,
          booking_id,
          branch_id,
          schedule_slot_id,
          date,
          start_time,
          end_time,
          status,
          is_makeup,
          child_id,
          bookings(user_id, course_type_id, learner_type)
        `)
        .in('id', sessionIds) as unknown as { data: ReviewSessionRow[] | null; error: { message: string } | null }

      if (targetError) {
        return NextResponse.json({ error: targetError.message }, { status: 500 })
      }

      if (!targetSessions || targetSessions.length !== sessionIds.length) {
        return NextResponse.json({ error: 'ไม่พบรายการผู้เรียนครบตามรอบที่เลือก' }, { status: 404 })
      }

      const firstSession = targetSessions[0]
      if (!firstSession?.schedule_slot_id) {
        return NextResponse.json({ error: 'รอบนี้ไม่มี schedule slot จึงเปลี่ยนโค้ชย้อนหลังไม่ได้' }, { status: 400 })
      }

      const isSameRound = targetSessions.every((session) => (
        session.schedule_slot_id === firstSession.schedule_slot_id &&
        session.date === firstSession.date &&
        session.start_time === firstSession.start_time &&
        session.end_time === firstSession.end_time &&
        session.branch_id === firstSession.branch_id
      ))

      if (!isSameRound) {
        return NextResponse.json({ error: 'เปลี่ยนโค้ชย้อนหลังได้เฉพาะรายการที่อยู่รอบเรียนเดียวกันเท่านั้น' }, { status: 400 })
      }

      const invalidSession = targetSessions.find((session) => (
        session.is_makeup ||
        !['scheduled', 'completed', 'absent'].includes(session.status) ||
        !isPastSession(session.date, session.end_time)
      ))

      if (invalidSession) {
        return NextResponse.json({ error: 'เปลี่ยนโค้ชย้อนหลังได้เฉพาะรอบปกติที่เลยเวลาเรียนแล้ว และยังไม่ถูกเก็บเข้ากระเป๋าหรือยกเลิกเท่านั้น' }, { status: 400 })
      }

      for (const session of targetSessions) {
        const { studentId } = getStudentContext(session)
        if (!studentId) {
          return NextResponse.json({ error: 'ไม่สามารถระบุผู้เรียนของบางรายการในรอบนี้ได้' }, { status: 400 })
        }
      }

      const { data: slotGroups, error: slotGroupsError } = await supabaseAdmin
        .from('coach_assignment_groups')
        .select('id, coach_id, name, coach_assignment_group_students(booking_session_id)')
        .eq('schedule_slot_id', firstSession.schedule_slot_id) as unknown as {
          data: AssignmentGroupDetailRow[] | null
          error: { message: string } | null
        }

      if (slotGroupsError) {
        return NextResponse.json({ error: slotGroupsError.message }, { status: 500 })
      }

      const targetSessionIdSet = new Set(sessionIds)
      const targetGroupRows = (slotGroups || []).filter((group) => (
        (group.coach_assignment_group_students || []).some((student) => targetSessionIdSet.has(student.booking_session_id))
      ))
      const targetGroupIds = new Set(targetGroupRows.map((group) => group.id))
      const previousCoachIds = Array.from(new Set(targetGroupRows.map((group) => group.coach_id).filter((coachId): coachId is string => Boolean(coachId))))

      if (previousCoachIds.length === 1 && previousCoachIds[0] === selectedCoachId) {
        return NextResponse.json({ error: 'โค้ชที่เลือกเป็นผู้รับผิดชอบรอบนี้อยู่แล้ว' }, { status: 400 })
      }

      const selectedCoachAlreadyOwnsOtherGroup = (slotGroups || []).some((group) => (
        group.coach_id === selectedCoachId &&
        !targetGroupIds.has(group.id) &&
        (group.coach_assignment_group_students || []).length > 0
      ))

      if (selectedCoachAlreadyOwnsOtherGroup) {
        return NextResponse.json({ error: 'โค้ชที่เลือกถูกมอบหมายอยู่แล้วในอีกกลุ่มของรอบเวลาเดียวกัน' }, { status: 400 })
      }

      if (targetGroupIds.size > 1) {
        return NextResponse.json({ error: 'บันทึกไม่ได้: โค้ชหนึ่งคนรับผิดชอบได้เพียงหนึ่งกลุ่มในช่วงเวลาเดียวกัน กรุณาเลือกแก้ทีละกลุ่ม' }, { status: 409 })
      }

      const assignmentValidation = await validateExactCoachAssignment({
        supabaseAdmin,
        coachId: selectedCoachId,
        scheduleSlotId: firstSession.schedule_slot_id,
        excludeGroupIds: Array.from(targetGroupIds),
      })
      if (assignmentValidation.error) {
        return NextResponse.json({ error: assignmentValidation.error }, { status: 409 })
      }

      const linkedSessionIds = new Set(targetGroupRows.flatMap((group) => (
        group.coach_assignment_group_students || []
      ).map((student) => student.booking_session_id)))
      const sessionsWithoutGroup = targetSessions.filter((session) => !linkedSessionIds.has(session.id))

      if (targetGroupIds.size > 0) {
        const targetGroup = targetGroupRows[0]
        const futureMemberSessionIds = Array.from(new Set([
          ...(targetGroup.coach_assignment_group_students || []).map((student) => student.booking_session_id),
          ...sessionsWithoutGroup.map((session) => session.id),
        ]))
        const namingStudentsBySessionId = await loadAssignmentGroupNamingStudents(supabaseAdmin, futureMemberSessionIds)
        const resolvedName = resolveAssignmentGroupName({
          currentName: targetGroup.name,
          students: futureMemberSessionIds
            .map((sessionId) => namingStudentsBySessionId.get(sessionId))
            .filter((student): student is NonNullable<typeof student> => Boolean(student)),
        })
        if (!resolvedName.name && resolvedName.error) {
          return NextResponse.json({ error: formatAutoGroupNameError(resolvedName.error) }, { status: 400 })
        }

        const { error: updateGroupError } = await supabaseAdmin
          .from('coach_assignment_groups')
          .update({ coach_id: selectedCoachId, name: resolvedName.name || targetGroup.name })
          .in('id', Array.from(targetGroupIds))

        if (updateGroupError) {
          const message = formatCoachAssignmentDatabaseError(updateGroupError.message)
          return NextResponse.json({ error: message || updateGroupError.message }, { status: message ? 409 : 500 })
        }
      }

      let insertedGroup: AssignmentGroupInsertRow | null = null
      if (sessionsWithoutGroup.length > 0) {
        const existingTargetGroupId = Array.from(targetGroupIds)[0]
        if (existingTargetGroupId) {
          const groupStudents: GroupStudentInsertRow[] = sessionsWithoutGroup.map((session) => {
            const { studentId, studentType } = getStudentContext(session)
            if (!studentId) throw new Error('Cannot resolve student for replacement assignment')
            return {
              group_id: existingTargetGroupId,
              booking_session_id: session.id,
              student_id: studentId,
              student_type: studentType,
            }
          })
          const { error: groupStudentError } = await supabaseAdmin
            .from('coach_assignment_group_students')
            .insert(groupStudents)
          if (groupStudentError) {
            const message = formatCoachAssignmentDatabaseError(groupStudentError.message)
            return NextResponse.json({ error: message || groupStudentError.message }, { status: message ? 409 : 500 })
          }
        } else {
          const { data: insertedGroupId, error: groupError } = await supabaseAdmin.rpc(
            'create_exact_coach_assignment_group_v1',
            {
              p_schedule_slot_id: firstSession.schedule_slot_id,
              p_coach_id: selectedCoachId,
              p_name: 'เปลี่ยนโค้ชย้อนหลังโดย Admin',
              p_sort_order: 999,
              p_notes: `Coach replaced retrospectively from Admin review without attendance write: ${reason}`,
              p_actor_id: access.ctx.user.id,
              p_booking_session_ids: sessionsWithoutGroup.map((session) => session.id),
            },
          )
          if (groupError || !insertedGroupId) {
            const message = formatCoachAssignmentDatabaseError(groupError?.message || '')
            return NextResponse.json({ error: message || groupError?.message || 'สร้างกลุ่มมอบหมายโค้ชย้อนหลังไม่สำเร็จ' }, { status: message ? 409 : 500 })
          }
          insertedGroup = { id: insertedGroupId as string }
        }
      }

      try {
        await ensureLegacyCoachAssignment({
          supabaseAdmin,
          scheduleSlotId: firstSession.schedule_slot_id,
          coachId: selectedCoachId,
          actorId: access.ctx.user.id,
        })
      } catch (error) {
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
      }

      const changedGroupIds = Array.from(targetGroupIds)
      if (insertedGroup) changedGroupIds.push(insertedGroup.id)

      for (const session of targetSessions) {
        await logActivity({
          userId: access.ctx.user.id,
          action: 'attendance_gap_replace_coach_round',
          entityType: 'booking_sessions',
          entityId: session.id,
          details: {
            reason,
            scheduleSlotId: session.schedule_slot_id,
            previousCoachIds,
            newCoachId: selectedCoachId,
            changedGroupIds,
            replacedSessionIds: sessionIds,
            attendanceWritten: false,
            bookingSessionStatusChanged: false,
          },
          ipAddress: req.headers.get('x-forwarded-for'),
        })
      }

      await notifyUser(supabaseAdmin as unknown as NotificationSupabase, {
        user_id: selectedCoachId,
        title: 'ได้รับมอบหมายเป็นโค้ชตัวจริงย้อนหลัง',
        message: `Admin เปลี่ยนผู้รับผิดชอบรอบ ${firstSession.date} ${firstSession.start_time || ''}-${firstSession.end_time || ''} ให้คุณ กรุณาเช็กอินย้อนหลังด้วย selfie/GPS ก่อนสรุปหลักฐาน: ${reason}`,
        type: 'schedule',
        link_url: `/coach/checkin?date=${firstSession.date}&slot=${firstSession.schedule_slot_id}`,
      }).catch(() => null)

      return NextResponse.json({
        success: true,
        group_ids: changedGroupIds,
        replaced_session_ids: sessionIds,
        previous_coach_ids: previousCoachIds,
        new_coach_id: selectedCoachId,
        warnings: assignmentValidation.warning,
      })
    }

    if (action === 'assign_coach_to_round') {
      const sessionIds = normalizeSessionIds((body as { session_ids?: unknown }).session_ids)

      if (sessionIds.length === 0) {
        return NextResponse.json({ error: 'session_ids are required' }, { status: 400 })
      }

      if (!selectedCoachId) {
        return NextResponse.json({ error: 'กรุณาเลือกโค้ชที่จะรับผิดชอบรอบนี้' }, { status: 400 })
      }

      if (!reason) {
        return NextResponse.json({ error: 'กรุณาระบุเหตุผลเพื่อเก็บ audit log' }, { status: 400 })
      }

      const { data: coachProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('id', selectedCoachId)
        .in('role', ['coach', 'head_coach'])
        .maybeSingle() as unknown as { data: CoachProfileRow | null }

      if (!coachProfile) {
        return NextResponse.json({ error: 'พบโค้ชที่เลือกไม่ถูกต้อง' }, { status: 400 })
      }

      const { data: targetSessions, error: targetError } = await supabaseAdmin
        .from('booking_sessions')
        .select(`
          id,
          booking_id,
          branch_id,
          schedule_slot_id,
          date,
          start_time,
          end_time,
          status,
          is_makeup,
          child_id,
          bookings(user_id, course_type_id, learner_type)
        `)
        .in('id', sessionIds) as unknown as { data: ReviewSessionRow[] | null; error: { message: string } | null }

      if (targetError) {
        return NextResponse.json({ error: targetError.message }, { status: 500 })
      }

      if (!targetSessions || targetSessions.length !== sessionIds.length) {
        return NextResponse.json({ error: 'ไม่พบรายการผู้เรียนครบตามรอบที่เลือก' }, { status: 404 })
      }

      const firstSession = targetSessions[0]
      if (!firstSession?.schedule_slot_id) {
        return NextResponse.json({ error: 'รอบนี้ไม่มี schedule slot จึงมอบหมายโค้ชทั้งรอบไม่ได้' }, { status: 400 })
      }

      const isSameRound = targetSessions.every((session) => (
        session.schedule_slot_id === firstSession.schedule_slot_id &&
        session.date === firstSession.date &&
        session.start_time === firstSession.start_time &&
        session.end_time === firstSession.end_time &&
        session.branch_id === firstSession.branch_id
      ))

      if (!isSameRound) {
        return NextResponse.json({ error: 'มอบหมายโค้ชทั้งรอบได้เฉพาะรายการที่อยู่รอบเรียนเดียวกันเท่านั้น' }, { status: 400 })
      }

      const invalidSession = targetSessions.find((session) => (
        session.is_makeup ||
        session.status !== 'scheduled' ||
        !isPastSession(session.date, session.end_time)
      ))

      if (invalidSession) {
        return NextResponse.json({ error: 'มอบหมายโค้ชทั้งรอบได้เฉพาะรอบปกติที่เลยเวลาและยังรอตรวจสอบเท่านั้น' }, { status: 400 })
      }

      try {
        const existingCoachGroup = await findPopulatedCoachGroupForCoachInRound(
          supabaseAdmin,
          firstSession,
          selectedCoachId,
        )

        if (existingCoachGroup) {
          return NextResponse.json({
            error: 'โค้ชคนนี้มีกลุ่มอยู่แล้วในรอบเดียวกัน กรุณาใช้ "ย้ายเข้ากลุ่มโค้ชในรอบเดียวกัน" แทน',
          }, { status: 400 })
        }
      } catch (error) {
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
      }

      for (const session of targetSessions) {
        const strictCoachIds = await getStrictGroupCoachIds(supabaseAdmin, session)
        if (strictCoachIds.length > 0) {
          return NextResponse.json({ error: 'พบรอบที่มีโค้ชในกลุ่มแล้ว กรุณา refresh แล้วใช้ flow ของรอบที่มีโค้ช' }, { status: 400 })
        }

        const { studentId } = getStudentContext(session)
        if (!studentId) {
          return NextResponse.json({ error: 'ไม่สามารถระบุผู้เรียนของบางรายการในรอบนี้ได้' }, { status: 400 })
        }
      }

      const assignmentValidation = await validateExactCoachAssignment({
        supabaseAdmin,
        coachId: selectedCoachId,
        scheduleSlotId: firstSession.schedule_slot_id,
      })
      if (assignmentValidation.error) {
        return NextResponse.json({ error: assignmentValidation.error }, { status: 409 })
      }

      const { data: insertedGroupId, error: groupError } = await supabaseAdmin.rpc(
        'create_exact_coach_assignment_group_v1',
        {
          p_schedule_slot_id: firstSession.schedule_slot_id,
          p_coach_id: selectedCoachId,
          p_name: 'มอบหมายโค้ชย้อนหลังทั้งรอบโดย Admin',
          p_sort_order: 999,
          p_notes: `Coach assigned from Admin no-coach round review without attendance write: ${reason}`,
          p_actor_id: access.ctx.user.id,
          p_booking_session_ids: sessionIds,
        },
      )

      if (groupError || !insertedGroupId) {
        const message = formatCoachAssignmentDatabaseError(groupError?.message || '')
        return NextResponse.json({ error: message || groupError?.message || 'สร้างกลุ่มมอบหมายโค้ชไม่สำเร็จ' }, { status: message ? 409 : 500 })
      }
      const insertedGroup = { id: insertedGroupId as string }

      try {
        await ensureLegacyCoachAssignment({
          supabaseAdmin,
          scheduleSlotId: firstSession.schedule_slot_id,
          coachId: selectedCoachId,
          actorId: access.ctx.user.id,
        })
      } catch (error) {
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
      }

      for (const session of targetSessions) {
        await logActivity({
          userId: access.ctx.user.id,
          action: 'attendance_gap_assign_coach_round',
          entityType: 'booking_sessions',
          entityId: session.id,
          details: {
            reason,
            scheduleSlotId: session.schedule_slot_id,
            coachId: selectedCoachId,
            retrospectiveGroupId: insertedGroup.id,
            assignedSessionIds: sessionIds,
            attendanceWritten: false,
            bookingSessionStatusChanged: false,
          },
          ipAddress: req.headers.get('x-forwarded-for'),
        })
      }

      await notifyUser(supabaseAdmin as unknown as NotificationSupabase, {
        user_id: selectedCoachId,
        title: 'ได้รับมอบหมายรอบเรียนย้อนหลัง',
        message: `Admin มอบหมายรอบ ${firstSession.date} ${firstSession.start_time || ''}-${firstSession.end_time || ''} ให้ตรวจสอบและบันทึก attendance: ${reason}`,
        type: 'schedule',
        link_url: `/coach/attendance?date=${firstSession.date}&slot=${firstSession.schedule_slot_id}`,
      }).catch(() => null)

      return NextResponse.json({
        success: true,
        group_id: insertedGroup.id,
        assigned_session_ids: sessionIds,
        warnings: assignmentValidation.warning,
      })
    }

    if (action === 'resolve_unassigned_round') {
      const sessionIds = Array.from(new Set(
        (Array.isArray((body as { session_ids?: unknown }).session_ids)
          ? (body as { session_ids: unknown[] }).session_ids
          : [])
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .map((value) => value.trim())
      ))
      const resolutionMode = (body as { resolution_mode?: unknown }).resolution_mode
      const attendanceBySessionIdRaw = (body as { attendance_by_session_id?: unknown }).attendance_by_session_id
      const attendanceBySessionId = attendanceBySessionIdRaw && typeof attendanceBySessionIdRaw === 'object'
        ? attendanceBySessionIdRaw as Record<string, unknown>
        : {}

      if (resolutionMode !== 'taught') {
        return NextResponse.json({ error: 'resolve_unassigned_round รองรับเฉพาะกรณีสอนจริงแต่ลืมมอบหมาย' }, { status: 400 })
      }

      if (sessionIds.length === 0) {
        return NextResponse.json({ error: 'session_ids are required' }, { status: 400 })
      }

      if (!selectedCoachId) {
        return NextResponse.json({ error: 'กรุณาเลือกโค้ชจริงที่สอนรอบนี้' }, { status: 400 })
      }

      if (!reason) {
        return NextResponse.json({ error: 'กรุณาระบุเหตุผลเพื่อเก็บ audit log' }, { status: 400 })
      }

      const { data: coachProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('id', selectedCoachId)
        .in('role', ['coach', 'head_coach'])
        .maybeSingle() as unknown as { data: CoachProfileRow | null }

      if (!coachProfile) {
        return NextResponse.json({ error: 'พบโค้ชที่เลือกไม่ถูกต้อง' }, { status: 400 })
      }

      const { data: targetSessions, error: targetError } = await supabaseAdmin
        .from('booking_sessions')
        .select(`
          id,
          booking_id,
          branch_id,
          schedule_slot_id,
          date,
          start_time,
          end_time,
          status,
          is_makeup,
          child_id,
          bookings(user_id, course_type_id, learner_type)
        `)
        .in('id', sessionIds) as unknown as { data: ReviewSessionRow[] | null; error: { message: string } | null }

      if (targetError) {
        return NextResponse.json({ error: targetError.message }, { status: 500 })
      }

      if (!targetSessions || targetSessions.length !== sessionIds.length) {
        return NextResponse.json({ error: 'ไม่พบรายการผู้เรียนครบตามรอบที่เลือก' }, { status: 404 })
      }

      const firstSession = targetSessions[0]
      if (!firstSession?.schedule_slot_id) {
        return NextResponse.json({ error: 'รอบนี้ไม่มี schedule slot จึงบันทึกย้อนหลังทั้งรอบไม่ได้' }, { status: 400 })
      }

      const isSameRound = targetSessions.every((session) => (
        session.schedule_slot_id === firstSession.schedule_slot_id &&
        session.date === firstSession.date &&
        session.start_time === firstSession.start_time &&
        session.end_time === firstSession.end_time &&
        session.branch_id === firstSession.branch_id
      ))

      if (!isSameRound) {
        return NextResponse.json({ error: 'บันทึกย้อนหลังทั้งรอบได้เฉพาะรายการที่อยู่รอบเรียนเดียวกันเท่านั้น' }, { status: 400 })
      }

      const invalidSession = targetSessions.find((session) => (
        session.is_makeup ||
        session.status !== 'scheduled' ||
        !isPastSession(session.date, session.end_time)
      ))

      if (invalidSession) {
        return NextResponse.json({ error: 'บันทึกย้อนหลังทั้งรอบได้เฉพาะรอบปกติที่เลยเวลาและยังรอตรวจสอบเท่านั้น' }, { status: 400 })
      }

      for (const session of targetSessions) {
        const strictCoachIds = await getStrictGroupCoachIds(supabaseAdmin, session)
        if (strictCoachIds.length > 0) {
          return NextResponse.json({ error: 'พบรอบที่มีโค้ชในกลุ่มแล้ว กรุณาใช้ flow ตรวจสอบเดิมของรอบที่มีโค้ช' }, { status: 400 })
        }

        const { studentId } = getStudentContext(session)
        if (!studentId) {
          return NextResponse.json({ error: 'ไม่สามารถระบุผู้เรียนของบางรายการในรอบนี้ได้' }, { status: 400 })
        }

        if (!normalizeAttendanceStatus(attendanceBySessionId[session.id])) {
          return NextResponse.json({ error: 'กรุณาเลือกสถานะเช็คชื่อให้ครบทุกคนในรอบนี้' }, { status: 400 })
        }
      }

      const assignmentValidation = await validateExactCoachAssignment({
        supabaseAdmin,
        coachId: selectedCoachId,
        scheduleSlotId: firstSession.schedule_slot_id,
      })
      if (assignmentValidation.error) {
        return NextResponse.json({ error: assignmentValidation.error }, { status: 409 })
      }

      const { data: insertedGroupId, error: groupError } = await supabaseAdmin.rpc(
        'create_exact_coach_assignment_group_v1',
        {
          p_schedule_slot_id: firstSession.schedule_slot_id,
          p_coach_id: selectedCoachId,
          p_name: 'บันทึกย้อนหลังทั้งรอบโดย Admin',
          p_sort_order: 999,
          p_notes: `Retroactive round assignment created from Admin unassigned-round resolution: ${reason}`,
          p_actor_id: access.ctx.user.id,
          p_booking_session_ids: sessionIds,
        },
      )

      if (groupError || !insertedGroupId) {
        const message = formatCoachAssignmentDatabaseError(groupError?.message || '')
        return NextResponse.json({ error: message || groupError?.message || 'สร้างกลุ่มมอบหมายย้อนหลังไม่สำเร็จ' }, { status: message ? 409 : 500 })
      }
      const insertedGroup = { id: insertedGroupId as string }

      try {
        await ensureLegacyCoachAssignment({
          supabaseAdmin,
          scheduleSlotId: firstSession.schedule_slot_id,
          coachId: selectedCoachId,
          actorId: access.ctx.user.id,
        })
      } catch (error) {
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
      }

      const results: { sessionId: string; attendanceStatus: AttendanceStatus; sessionStatus: 'absent' | 'completed' }[] = []

      for (const session of targetSessions) {
        const finalAttendanceStatus = normalizeAttendanceStatus(attendanceBySessionId[session.id])
        if (!finalAttendanceStatus) {
          return NextResponse.json({ error: 'กรุณาเลือกสถานะเช็คชื่อให้ครบทุกคนในรอบนี้' }, { status: 400 })
        }

        await upsertRetrospectiveAttendance({
          supabaseAdmin,
          session,
          status: finalAttendanceStatus,
          coachId: selectedCoachId,
        })

        const syncResult = await syncBookingSessionStatusFromAttendance({
          supabase: supabaseAdmin,
          bookingSessionId: session.id,
          attendanceStatus: finalAttendanceStatus,
        })

        results.push({
          sessionId: session.id,
          attendanceStatus: finalAttendanceStatus,
          sessionStatus: syncResult.sessionStatus,
        })

        await logActivity({
          userId: access.ctx.user.id,
          action: 'attendance_gap_resolve_unassigned_round',
          entityType: 'booking_sessions',
          entityId: session.id,
          details: {
            reason,
            attendanceStatus: finalAttendanceStatus,
            sessionStatus: syncResult.sessionStatus,
            scheduleSlotId: session.schedule_slot_id,
            coachId: selectedCoachId,
            retrospectiveGroupId: insertedGroup.id,
            resolvedSessionIds: sessionIds,
          },
          ipAddress: req.headers.get('x-forwarded-for'),
        })

        if (session.bookings?.user_id) {
          const statusLabel = finalAttendanceStatus === 'absent'
            ? 'ขาดเรียน'
            : finalAttendanceStatus === 'late'
              ? 'มาสาย'
              : 'มาเรียน'

          await notifyUser(supabaseAdmin as unknown as NotificationSupabase, {
            user_id: session.bookings.user_id,
            title: 'อัปเดตสถานะการเข้าเรียนย้อนหลัง',
            message: `Admin บันทึกย้อนหลังทั้งรอบเป็น ${statusLabel} สำหรับรอบ ${session.date} ${session.start_time || ''}-${session.end_time || ''}${reason ? ` เหตุผล: ${reason}` : ''}`,
            type: 'schedule',
            link_url: '/dashboard/schedule',
          }).catch(() => null)
        }
      }

      return NextResponse.json({
        success: true,
        group_id: insertedGroup.id,
        results,
        warnings: assignmentValidation.warning,
      })
    }

    if (!sessionId || !action) {
      return NextResponse.json({ error: 'session_id and action are required' }, { status: 400 })
    }

    if ((action === 'mark_attendance' || action === 'confirm_absent' || action === 'request_coach_review' || action === 'request_coach_evidence' || action === 'close_review' || action === 'return_entitlement') && !reason) {
      return NextResponse.json({ error: 'กรุณาระบุเหตุผลเพื่อเก็บ audit log' }, { status: 400 })
    }

    if (action === 'mark_attendance' && !attendanceStatus) {
      return NextResponse.json({ error: 'กรุณาเลือกสถานะ มาเรียน/สาย/ขาดเรียน' }, { status: 400 })
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('booking_sessions')
      .select('id, booking_id, branch_id, schedule_slot_id, date, start_time, end_time, status, is_makeup, child_id, bookings(user_id, course_type_id, learner_type)')
      .eq('id', sessionId)
      .single<ReviewSessionRow>()

    if (sessionError || !session) {
      return NextResponse.json({ error: sessionError?.message || 'ไม่พบรอบเรียนนี้' }, { status: 404 })
    }

    if (session.is_makeup) {
      return NextResponse.json({ error: 'รอบชดเชยไม่สามารถยืนยันเป็นขาดเรียนเพื่อสร้างสิทธิ์ชดเชยซ้ำได้' }, { status: 400 })
    }

    if (session.status === 'absent' && action === 'confirm_absent') {
      return NextResponse.json({ success: true })
    }

    const hasEndedInBangkok = isPastSession(session.date, session.end_time)
    if (!hasEndedInBangkok) {
      const actionLabel = action === 'mark_attendance'
        ? 'บันทึกเช็คชื่อย้อนหลัง'
        : action === 'close_review'
          ? 'ปิดเคส'
          : action === 'return_entitlement'
            ? 'คืนสิทธิ์'
            : action === 'request_coach_review'
              ? 'ส่งให้โค้ชตรวจสอบ'
              : action === 'request_coach_evidence'
                ? 'ขอหลักฐานโค้ชย้อนหลัง'
                : 'ยืนยันขาดเรียน'
      return NextResponse.json({ error: `${actionLabel}ได้เฉพาะรอบปกติที่เลยเวลาเรียนแล้วตามเวลาไทยเท่านั้น` }, { status: 400 })
    }

    if (action === 'confirm_absent' && session.status !== 'scheduled') {
      return NextResponse.json({ error: 'ยืนยันขาดเรียนได้เฉพาะรอบปกติที่ยังไม่มีผลเช็คชื่อแล้วเท่านั้น' }, { status: 400 })
    }

    const assignedCoachIds = await getAssignedCoachIds(supabaseAdmin, session)
    const hasAssignedCoach = assignedCoachIds.length > 0

    if (action === 'request_coach_evidence') {
      if (!session.schedule_slot_id) {
        return NextResponse.json({ error: 'รอบนี้ไม่มี schedule slot สำหรับขอหลักฐานโค้ช' }, { status: 400 })
      }

      if (!hasAssignedCoach) {
        return NextResponse.json({ error: 'ยังไม่พบโค้ชที่รับผิดชอบรอบนี้ จึงขอหลักฐานย้อนหลังไม่ได้' }, { status: 400 })
      }

      const { studentId } = getStudentContext(session)
      if (!studentId) {
        return NextResponse.json({ error: 'ไม่สามารถระบุผู้เรียนของรอบนี้ได้' }, { status: 400 })
      }

      const { data: attendanceRows, error: attendanceError } = await supabaseAdmin
        .from('attendance')
        .select('id, status')
        .eq('booking_session_id', session.id)
        .eq('student_id', studentId)
        .order('checked_at', { ascending: false })
        .limit(1) as unknown as { data: ExistingAttendanceRow[] | null; error: { message: string } | null }

      if (attendanceError) {
        return NextResponse.json({ error: attendanceError.message }, { status: 500 })
      }

      if (!attendanceRows?.[0]) {
        return NextResponse.json({ error: 'ต้องบันทึก attendance ของผู้เรียนก่อน จึงจะขอหลักฐานโค้ชย้อนหลังได้' }, { status: 400 })
      }

      const { data: checkins, error: checkinError } = await supabaseAdmin
        .from('coach_checkins')
        .select('coach_id, photo_url, location_lat, location_lng')
        .eq('schedule_slot_id', session.schedule_slot_id)
        .in('coach_id', assignedCoachIds)
        .limit(20) as unknown as { data: CoachCheckinEvidenceRow[] | null; error: { message: string } | null }

      if (checkinError) {
        return NextResponse.json({ error: checkinError.message }, { status: 500 })
      }

      const hasCompleteEvidence = (checkins || []).some((checkin) => (
        Boolean(checkin.photo_url) &&
        checkin.location_lat !== null &&
        checkin.location_lng !== null
      ))

      if (hasCompleteEvidence) {
        return NextResponse.json({ success: true, alreadyHasEvidence: true })
      }

      await Promise.all(assignedCoachIds.map((coachId) => notifyUser(supabaseAdmin as unknown as NotificationSupabase, {
        user_id: coachId,
        title: 'ขอหลักฐานเช็คอินย้อนหลัง',
        message: `Admin บันทึก attendance ย้อนหลังแล้ว แต่ยังไม่มี selfie/GPS ของรอบ ${session.date} ${session.start_time || ''}-${session.end_time || ''}: ${reason}`,
        type: 'schedule',
        link_url: `/coach/checkin?date=${session.date}&slot=${session.schedule_slot_id}`,
      }).catch(() => null)))

      await logActivity({
        userId: access.ctx.user.id,
        action: 'attendance_gap_request_coach_evidence',
        entityType: 'booking_sessions',
        entityId: session.id,
        details: {
          reason,
          scheduleSlotId: session.schedule_slot_id,
          notifiedCoachIds: assignedCoachIds,
          attendanceAlreadyRecorded: true,
          attendanceStatus: attendanceRows[0].status || null,
        },
        ipAddress: req.headers.get('x-forwarded-for'),
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'request_coach_review') {
      if (!hasAssignedCoach) {
        return NextResponse.json({ error: 'ยังไม่พบโค้ชที่รับผิดชอบรอบนี้ กรุณาบันทึกผลย้อนหลังหรือปิดเคสด้วยเหตุผลแทน' }, { status: 400 })
      }

      await Promise.all(assignedCoachIds.map((coachId) => notifyUser(supabaseAdmin as unknown as NotificationSupabase, {
        user_id: coachId,
        title: 'ตรวจสอบการเช็คชื่อย้อนหลัง',
        message: `Admin ส่งรอบ ${session.date} ${session.start_time || ''}-${session.end_time || ''} กลับให้ตรวจสอบ: ${reason}`,
        type: 'schedule',
        link_url: `/coach/attendance?date=${session.date}&slot=${session.schedule_slot_id || ''}`,
      }).catch(() => null)))

      await logActivity({
        userId: access.ctx.user.id,
        action: 'attendance_gap_request_coach_review',
        entityType: 'booking_sessions',
        entityId: session.id,
        details: {
          reason,
          scheduleSlotId: session.schedule_slot_id,
          notifiedCoachIds: assignedCoachIds,
        },
        ipAddress: req.headers.get('x-forwarded-for'),
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'close_review') {
      await logActivity({
        userId: access.ctx.user.id,
        action: 'attendance_gap_closed_no_action',
        entityType: 'booking_sessions',
        entityId: session.id,
        details: {
          reason,
          scheduleSlotId: session.schedule_slot_id,
        },
        ipAddress: req.headers.get('x-forwarded-for'),
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'return_entitlement') {
      if (!session.bookings?.user_id || !session.bookings?.course_type_id || !session.branch_id) {
        return NextResponse.json({ error: 'ข้อมูล booking ไม่ครบสำหรับคืนสิทธิ์เข้ากระเป๋า' }, { status: 400 })
      }

      const { data: existingCredits, error: existingCreditError } = await supabaseAdmin
        .from('lesson_wallet_credits')
        .select('id, status')
        .eq('original_session_id', session.id)
        .neq('status', 'expired')
        .limit(1) as unknown as { data: { id: string; status: string }[] | null; error: { message: string } | null }

      if (existingCreditError) {
        return NextResponse.json({ error: existingCreditError.message }, { status: 500 })
      }

      if ((existingCredits || []).length === 0) {
        const { error: creditError } = await supabaseAdmin
          .from('lesson_wallet_credits')
          .insert({
            user_id: session.bookings.user_id,
            booking_id: session.booking_id,
            original_session_id: session.id,
            child_id: session.child_id,
            branch_id: session.branch_id,
            course_type_id: session.bookings.course_type_id,
            original_schedule_slot_id: session.schedule_slot_id,
            original_date: session.date,
            original_start_time: session.start_time || '00:00:00',
            original_end_time: session.end_time || '00:00:00',
            status: 'active',
            expires_at: getMonthEndIso(session.date),
            notes: `Returned by Admin attendance-gap review: ${reason}`,
          })

        if (creditError) {
          return NextResponse.json({ error: creditError.message }, { status: 500 })
        }
      }

      const { error: walletError } = await supabaseAdmin
        .from('booking_sessions')
        .update({ status: 'walleted' })
        .eq('id', sessionId)

      if (walletError) {
        return NextResponse.json({ error: walletError.message }, { status: 500 })
      }

      await logActivity({
        userId: access.ctx.user.id,
        action: 'attendance_gap_return_entitlement',
        entityType: 'booking_sessions',
        entityId: session.id,
        details: {
          reason,
          scheduleSlotId: session.schedule_slot_id,
          hadAssignedCoach: hasAssignedCoach,
          existingCreditId: existingCredits?.[0]?.id || null,
        },
        ipAddress: req.headers.get('x-forwarded-for'),
      })

      await notifyUser(supabaseAdmin as unknown as NotificationSupabase, {
        user_id: session.bookings.user_id,
        title: 'คืนสิทธิ์วันเรียนเข้ากระเป๋าแล้ว',
        message: `Admin คืนสิทธิ์รอบ ${session.date} ${session.start_time || ''}-${session.end_time || ''} เข้ากระเป๋าวันเรียนแล้ว เหตุผล: ${reason}`,
        type: 'schedule',
        link_url: '/dashboard/lesson-wallet',
      }).catch(() => null)

      return NextResponse.json({ success: true })
    }

    const finalAttendanceStatus = action === 'confirm_absent' ? 'absent' : attendanceStatus
    if (!finalAttendanceStatus) {
      return NextResponse.json({ error: 'กรุณาเลือกสถานะเช็คชื่อ' }, { status: 400 })
    }

    if (!hasAssignedCoach && action === 'confirm_absent' && !reason) {
      return NextResponse.json({ error: 'กรุณาระบุเหตุผลก่อนยืนยันขาด เพราะรอบนี้ไม่มีโค้ชที่ถูกมอบหมาย' }, { status: 400 })
    }

    let attendanceCoachId = assignedCoachIds[0] || selectedCoachId
    let retrospectiveGroupId: string | null = null
    let assignmentWarning: string | null = null

    if (!hasAssignedCoach && action === 'mark_attendance') {
      if (!selectedCoachId) {
        return NextResponse.json({ error: 'กรุณาเลือกโค้ชจริงก่อนบันทึกย้อนหลัง' }, { status: 400 })
      }

      const { data: coachProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('id', selectedCoachId)
        .in('role', ['coach', 'head_coach'])
        .maybeSingle() as unknown as { data: { id: string; role: string } | null }

      if (!coachProfile) {
        return NextResponse.json({ error: 'พบโค้ชที่เลือกไม่ถูกต้อง' }, { status: 400 })
      }

      if (!session.schedule_slot_id) {
        return NextResponse.json({ error: 'รอบนี้ไม่มี schedule slot จึงมอบหมายโค้ชย้อนหลังไม่ได้' }, { status: 400 })
      }
      const assignmentValidation = await validateExactCoachAssignment({
        supabaseAdmin,
        coachId: selectedCoachId,
        scheduleSlotId: session.schedule_slot_id,
      })
      if (assignmentValidation.error) {
        return NextResponse.json({ error: assignmentValidation.error }, { status: 409 })
      }
      assignmentWarning = assignmentValidation.warning

      retrospectiveGroupId = await ensureRetrospectiveAssignment({
        supabaseAdmin,
        session,
        coachId: selectedCoachId,
        actorId: access.ctx.user.id,
      })
      attendanceCoachId = selectedCoachId
    }

    if (!attendanceCoachId) {
      attendanceCoachId = access.ctx.user.id
    }

    await upsertRetrospectiveAttendance({
      supabaseAdmin,
      session,
      status: finalAttendanceStatus,
      coachId: attendanceCoachId,
    })

    let sessionStatus: 'absent' | 'completed'
    try {
      const syncResult = await syncBookingSessionStatusFromAttendance({
        supabase: supabaseAdmin,
        bookingSessionId: sessionId,
        attendanceStatus: finalAttendanceStatus,
      })
      sessionStatus = syncResult.sessionStatus
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Sync booking session status failed' }, { status: 500 })
    }

    await logActivity({
      userId: access.ctx.user.id,
      action: action === 'confirm_absent' ? 'attendance_gap_confirm_absent' : 'attendance_gap_mark_retrospective',
      entityType: 'booking_sessions',
      entityId: session.id,
      details: {
        reason,
        attendanceStatus: finalAttendanceStatus,
        sessionStatus,
        scheduleSlotId: session.schedule_slot_id,
        attendanceCoachId,
        retrospectiveGroupId,
        hadAssignedCoach: hasAssignedCoach,
      },
      ipAddress: req.headers.get('x-forwarded-for'),
    })

    if (session.bookings?.user_id) {
      const statusLabel = finalAttendanceStatus === 'absent'
        ? 'ขาดเรียน'
        : finalAttendanceStatus === 'late'
          ? 'มาสาย'
          : 'มาเรียน'

      await notifyUser(supabaseAdmin as unknown as NotificationSupabase, {
        user_id: session.bookings.user_id,
        title: 'อัปเดตสถานะการเข้าเรียนย้อนหลัง',
        message: `Admin บันทึกสถานะ ${statusLabel} สำหรับรอบ ${session.date} ${session.start_time || ''}-${session.end_time || ''}${reason ? ` เหตุผล: ${reason}` : ''}`,
        type: 'schedule',
        link_url: '/dashboard/schedule',
      }).catch(() => null)
    }

    return NextResponse.json({ success: true, warnings: assignmentWarning })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
