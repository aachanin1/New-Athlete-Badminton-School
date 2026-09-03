import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import { syncBookingSessionStatusFromAttendance } from '@/lib/attendance-write-through'
import { notifyUser, notifyUserOnce } from '@/lib/notifications'
import { logActivity } from '@/lib/activity-log'
import { ensureScheduleSlot } from '@/lib/schedule-slot-utils'
import { getBangkokDayOfWeek } from '@/lib/schedule-template-utils'
import {
  formatCoachAssignmentDatabaseError,
  formatLegacyCoachWarnings,
  getAdminRetrospectiveAssignmentConflict,
  type LegacyCoachAssignmentWarningRow,
} from '@/lib/coach-assignment-conflicts'
import {
  classifyCoachAssignmentSessionProvenance,
  loadWalletRedeemedSessionIds,
  requireCoachAssignmentQueryData,
  resolveAssignedCoachIds,
} from '@/lib/coach-assignment-resolution'
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
  rescheduled_from_id?: string | null
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

interface AssignmentGroupRow {
  coach_id: string | null
  coach_assignment_group_students: { booking_session_id: string }[] | null
}

interface CoachAssignmentRow {
  coach_id: string
}

interface CoachProfileRow {
  id: string
  role: string
}

type AdminRetrospectiveOperation =
  | 'assign_coach_to_round'
  | 'resolve_unassigned_round'
  | 'mark_attendance'
  | 'replace_coach_for_past_round'
  | 'move_learner_to_existing_coach_group'

interface AdminRetrospectiveTransitionResult {
  changed: boolean
  idempotentReplay: boolean
  operation: AdminRetrospectiveOperation
  scheduleSlotId: string
  groupId: string
  targetSessionIds: string[]
  warnings?: LegacyCoachAssignmentWarningRow[]
  before?: {
    groups?: Array<{ id: string; coach_id: string | null }>
    memberships?: Array<{ id: string; group_id: string; booking_session_id: string }>
  }
  after?: {
    sessionStatuses?: Array<{ id: string; status: 'scheduled' | 'completed' | 'absent' }>
  }
  audit?: { id: string; action: string } | null
}

interface AdminRetrospectiveSessionRow extends ReviewSessionRow {
  bookings?: {
    user_id: string | null
    course_type_id: string | null
    learner_type: string | null
  } | null
}

function getErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
  return formatCoachAssignmentDatabaseError(message) || message
}

async function applyAdminRetrospectiveTransition({
  supabaseAdmin,
  actorId,
  operation,
  selectedCoachId,
  targetGroupId,
  sessionId,
  rawSessionIds,
  reason,
  attendanceStatus,
  attendanceBySessionId,
}: {
  supabaseAdmin: ReturnType<typeof getServiceRoleClient>
  actorId: string
  operation: AdminRetrospectiveOperation
  selectedCoachId: string
  targetGroupId: string
  sessionId?: string
  rawSessionIds: unknown
  reason: string
  attendanceStatus: AttendanceStatus | null
  attendanceBySessionId: unknown
}) {
  const sessionIds = operation === 'mark_attendance'
    ? normalizeSessionIds(sessionId ? [sessionId] : [])
    : normalizeSessionIds(rawSessionIds)

  if (sessionIds.length === 0) {
    return NextResponse.json({ error: operation === 'mark_attendance' ? 'session_id is required' : 'session_ids are required' }, { status: 400 })
  }
  if (!selectedCoachId) {
    return NextResponse.json({ error: 'กรุณาเลือกโค้ชจริงที่รับผิดชอบรอบนี้' }, { status: 400 })
  }
  if (!reason) {
    return NextResponse.json({ error: 'กรุณาระบุเหตุผลเพื่อเก็บ audit log' }, { status: 400 })
  }
  if (operation === 'move_learner_to_existing_coach_group' && !targetGroupId) {
    return NextResponse.json({ error: 'กรุณาเลือกกลุ่มโค้ชปลายทางในรอบเดียวกัน' }, { status: 400 })
  }

  const { data: coachProfile, error: coachError } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', selectedCoachId)
    .in('role', ['coach', 'head_coach'])
    .maybeSingle() as unknown as { data: CoachProfileRow | null; error: { message: string } | null }
  if (coachError) return NextResponse.json({ error: coachError.message }, { status: 500 })
  if (!coachProfile) return NextResponse.json({ error: 'พบโค้ชที่เลือกไม่ถูกต้อง' }, { status: 400 })

  const { data: sessions, error: sessionsError } = await supabaseAdmin
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
    .in('id', sessionIds) as unknown as {
      data: AdminRetrospectiveSessionRow[] | null
      error: { message: string } | null
    }
  if (sessionsError) return NextResponse.json({ error: sessionsError.message }, { status: 500 })
  if (!sessions || sessions.length !== sessionIds.length) {
    return NextResponse.json({ error: 'ไม่พบรายการผู้เรียนครบตามรอบที่เลือก' }, { status: 404 })
  }

  const firstSession = sessions[0]
  if (!firstSession.schedule_slot_id) {
    return NextResponse.json({ error: 'รอบนี้ไม่มี schedule slot จึงดำเนินการย้อนหลังไม่ได้' }, { status: 400 })
  }

  let normalizedAttendance: Record<string, AttendanceStatus> = {}
  if (operation === 'mark_attendance') {
    if (!attendanceStatus) {
      return NextResponse.json({ error: 'กรุณาเลือกสถานะ มาเรียน/สาย/ขาดเรียน' }, { status: 400 })
    }
    normalizedAttendance = { [firstSession.id]: attendanceStatus }
  } else if (operation === 'resolve_unassigned_round') {
    if (!attendanceBySessionId || typeof attendanceBySessionId !== 'object' || Array.isArray(attendanceBySessionId)) {
      return NextResponse.json({ error: 'กรุณาเลือกสถานะเช็คชื่อให้ครบทุกคนในรอบนี้' }, { status: 400 })
    }
    for (const targetId of sessionIds) {
      const status = normalizeAttendanceStatus((attendanceBySessionId as Record<string, unknown>)[targetId])
      if (!status) return NextResponse.json({ error: 'กรุณาเลือกสถานะเช็คชื่อให้ครบทุกคนในรอบนี้' }, { status: 400 })
      normalizedAttendance[targetId] = status
    }
  }

  const { data, error } = await supabaseAdmin.rpc(
    'admin_apply_retrospective_assignment_transition_v1',
    {
      p_operation: operation,
      p_schedule_slot_id: firstSession.schedule_slot_id,
      p_actor_id: actorId,
      p_coach_id: selectedCoachId,
      p_booking_session_ids: sessionIds,
      p_target_group_id: operation === 'move_learner_to_existing_coach_group' ? targetGroupId : null,
      p_reason: reason,
      p_attendance_by_session_id: normalizedAttendance,
      p_test_fail_stage: null,
    },
  )

  if (error) {
    const conflict = getAdminRetrospectiveAssignmentConflict(error.message)
    if (conflict) return NextResponse.json(conflict, { status: 409 })
    return NextResponse.json({ error: getErrorMessage(new Error(error.message)) }, { status: 500 })
  }

  const result = data as unknown as AdminRetrospectiveTransitionResult
  const warning = formatLegacyCoachWarnings(Array.isArray(result.warnings) ? result.warnings : [])

  if (result.changed) {
    if (operation === 'resolve_unassigned_round' || operation === 'mark_attendance') {
      for (const session of sessions) {
        if (!session.bookings?.user_id) continue
        const status = normalizedAttendance[session.id]
        const statusLabel = status === 'absent' ? 'ขาดเรียน' : status === 'late' ? 'มาสาย' : 'มาเรียน'
        await notifyUser(supabaseAdmin as unknown as NotificationSupabase, {
          user_id: session.bookings.user_id,
          title: 'อัปเดตสถานะการเข้าเรียนย้อนหลัง',
          message: `Admin บันทึกสถานะ ${statusLabel} สำหรับรอบ ${session.date} ${session.start_time || ''}-${session.end_time || ''} เหตุผล: ${reason}`,
          type: 'schedule',
          link_url: '/dashboard/schedule',
        }).catch(() => null)
      }
    } else {
      const notification = operation === 'move_learner_to_existing_coach_group'
        ? {
            title: 'มีผู้เรียนถูกย้ายเข้ากลุ่มรอบเรียนของคุณ',
            message: `Admin ย้ายผู้เรียนเข้ากลุ่มโค้ชของคุณในรอบ ${firstSession.date} ${firstSession.start_time || ''}-${firstSession.end_time || ''} โดยไม่บันทึก attendance และไม่เปลี่ยนสถานะรอบเรียน: ${reason}`,
            link_url: `/coach/attendance?date=${firstSession.date}&slot=${firstSession.schedule_slot_id}`,
          }
        : operation === 'replace_coach_for_past_round'
          ? {
              title: 'ได้รับมอบหมายเป็นโค้ชตัวจริงย้อนหลัง',
              message: `Admin เปลี่ยนผู้รับผิดชอบรอบ ${firstSession.date} ${firstSession.start_time || ''}-${firstSession.end_time || ''} ให้คุณ กรุณาเช็กอินย้อนหลังด้วย selfie/GPS ก่อนสรุปหลักฐาน: ${reason}`,
              link_url: `/coach/checkin?date=${firstSession.date}&slot=${firstSession.schedule_slot_id}`,
            }
          : {
              title: 'ได้รับมอบหมายรอบเรียนย้อนหลัง',
              message: `Admin มอบหมายรอบ ${firstSession.date} ${firstSession.start_time || ''}-${firstSession.end_time || ''} ให้ตรวจสอบและบันทึก attendance: ${reason}`,
              link_url: `/coach/attendance?date=${firstSession.date}&slot=${firstSession.schedule_slot_id}`,
            }
      await notifyUser(supabaseAdmin as unknown as NotificationSupabase, {
        user_id: selectedCoachId,
        ...notification,
        type: 'schedule',
      }).catch(() => null)
    }
  }

  const beforeMemberships = result.before?.memberships || []
  const targetBeforeGroupIds = new Set(beforeMemberships
    .filter((membership) => sessionIds.includes(membership.booking_session_id))
    .map((membership) => membership.group_id))
  const previousCoachIds = Array.from(new Set((result.before?.groups || [])
    .filter((group) => targetBeforeGroupIds.has(group.id) && group.coach_id)
    .map((group) => group.coach_id as string)))
  const afterStatuses = new Map((result.after?.sessionStatuses || []).map((row) => [row.id, row.status]))

  return NextResponse.json({
    success: true,
    changed: result.changed,
    idempotentReplay: result.idempotentReplay,
    operation: result.operation,
    result,
    warnings: warning,
    group_id: result.groupId,
    group_ids: [result.groupId],
    target_group_id: operation === 'move_learner_to_existing_coach_group' ? result.groupId : undefined,
    target_coach_id: selectedCoachId,
    new_coach_id: operation === 'replace_coach_for_past_round' ? selectedCoachId : undefined,
    previous_coach_ids: previousCoachIds,
    assigned_session_ids: operation === 'assign_coach_to_round' ? sessionIds : undefined,
    replaced_session_ids: operation === 'replace_coach_for_past_round' ? sessionIds : undefined,
    moved_session_ids: operation === 'move_learner_to_existing_coach_group' ? sessionIds : undefined,
    results: operation === 'resolve_unassigned_round'
      ? sessionIds.map((id) => ({
          sessionId: id,
          attendanceStatus: normalizedAttendance[id],
          sessionStatus: afterStatuses.get(id),
        }))
      : undefined,
  })
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

  const groupResult = await supabaseAdmin
    .from('coach_assignment_groups')
    .select('coach_id, coach_assignment_group_students(booking_session_id)')
    .eq('schedule_slot_id', session.schedule_slot_id) as unknown as {
      data: AssignmentGroupRow[] | null
      error: { message: string } | null
    }
  const groups = requireCoachAssignmentQueryData(
    groupResult,
    'Admin Attendance Gap exact assignment query failed',
  ) || []
  const walletRedeemedSessionIds = await loadWalletRedeemedSessionIds(
    supabaseAdmin,
    [session],
    'Admin Attendance Gap',
  )
  const sessionProvenance = classifyCoachAssignmentSessionProvenance(
    session,
    walletRedeemedSessionIds,
  )

  if (groups.length > 0) return resolveAssignedCoachIds({
    exactGroups: groups,
    bookingSessionId: session.id,
    legacyCoachIds: [],
    sessionProvenance,
  })

  const assignmentResult = await supabaseAdmin
    .from('coach_assignments')
    .select('coach_id')
    .eq('schedule_slot_id', session.schedule_slot_id) as unknown as {
      data: CoachAssignmentRow[] | null
      error: { message: string } | null
    }
  const assignments = requireCoachAssignmentQueryData(
    assignmentResult,
    'Admin Attendance Gap Legacy assignment query failed',
  ) || []

  return resolveAssignedCoachIds({
    exactGroups: groups,
    bookingSessionId: session.id,
    legacyCoachIds: assignments.map((assignment) => assignment.coach_id),
    sessionProvenance,
  })
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

    const makeupDayOfWeek = getBangkokDayOfWeek(makeupDate)
    if (makeupDayOfWeek === null) {
      return NextResponse.json({ code: 'INVALID_MAKEUP_DATE', error: 'วันที่ชดเชยไม่ถูกต้อง' }, { status: 400 })
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
      .eq('day_of_week', makeupDayOfWeek)
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

    if (
      action === 'assign_coach_to_round'
      || action === 'resolve_unassigned_round'
      || (action === 'mark_attendance' && Boolean(selectedCoachId))
      || action === 'replace_coach_for_past_round'
      || action === 'move_learner_to_existing_coach_group'
    ) {
      return applyAdminRetrospectiveTransition({
        supabaseAdmin,
        actorId: access.ctx.user.id,
        operation: action,
        selectedCoachId,
        targetGroupId,
        sessionId,
        rawSessionIds: (body as { session_ids?: unknown }).session_ids,
        reason,
        attendanceStatus,
        attendanceBySessionId: (body as { attendance_by_session_id?: unknown }).attendance_by_session_id,
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
      .select('id, booking_id, branch_id, schedule_slot_id, date, start_time, end_time, status, is_makeup, rescheduled_from_id, child_id, bookings(user_id, course_type_id, learner_type)')
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

    if (!hasAssignedCoach && action === 'mark_attendance') {
      return NextResponse.json({ error: 'กรุณาเลือกโค้ชจริงก่อนบันทึกย้อนหลัง' }, { status: 400 })
    }

    let attendanceCoachId = assignedCoachIds[0] || selectedCoachId
    const retrospectiveGroupId: string | null = null
    const assignmentWarning: string | null = null

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
