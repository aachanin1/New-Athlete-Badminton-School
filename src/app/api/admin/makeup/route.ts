import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import { notifyUser, notifyUserOnce } from '@/lib/notifications'
import { logActivity } from '@/lib/activity-log'
import type { AttendanceStatus, StudentType } from '@/types/database'

type NotificationSupabase = Parameters<typeof notifyUserOnce>[0]

interface OriginalSessionRow {
  id: string
  booking_id: string
  date: string
  end_time: string | null
  status: string
  child_id: string | null
  bookings?: { user_id: string | null } | null
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
}

interface AssignmentGroupInsertRow {
  id: string
}

interface AssignmentGroupRow {
  coach_id: string | null
  coach_assignment_group_students: { booking_session_id: string }[] | null
}

interface CoachAssignmentRow {
  coach_id: string
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
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

function isPastSession(date: string, endTime: string | null) {
  return new Date(`${date}T${endTime || '23:59'}`).getTime() < Date.now()
}

function normalizeReason(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 500) : ''
}

function normalizeAttendanceStatus(value: unknown): AttendanceStatus | null {
  return value === 'present' || value === 'late' || value === 'absent' ? value : null
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

  const { studentId, studentType } = getStudentContext(session)
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

  const { data: insertedGroup, error: groupError } = await supabaseAdmin
    .from('coach_assignment_groups')
    .insert({
      schedule_slot_id: session.schedule_slot_id,
      coach_id: coachId,
      name: 'บันทึกย้อนหลังโดย Admin',
      level_min: null,
      level_max: null,
      sort_order: 999,
      notes: 'Retroactive assignment created from Admin attendance gap resolution',
      created_by: actorId,
    })
    .select('id')
    .single() as unknown as { data: AssignmentGroupInsertRow | null; error: { message: string } | null }

  if (groupError || !insertedGroup) {
    throw new Error(groupError?.message || 'Cannot create retrospective assignment group')
  }

  const { error: studentError } = await supabaseAdmin
    .from('coach_assignment_group_students')
    .insert({
      group_id: insertedGroup.id,
      booking_session_id: session.id,
      student_id: studentId,
      student_type: studentType,
    })

  if (studentError) throw new Error(studentError.message)

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

  return insertedGroup.id
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
      .select('id, booking_id, date, end_time, status, child_id, bookings(user_id)')
      .eq('id', originalSessionId)
      .single<OriginalSessionRow>()

    if (originalError) {
      return NextResponse.json({ error: originalError.message }, { status: 500 })
    }

    if (!originalSession || (originalSession.status !== 'absent' && !(originalSession.status === 'scheduled' && isPastSession(originalSession.date, originalSession.end_time)))) {
      return NextResponse.json({ error: 'สร้างวันชดเชยได้เฉพาะรอบที่ขาดเรียนหรือเลยวันเรียนแล้วเท่านั้น' }, { status: 400 })
    }

    const bounds = getMonthBounds(originalSession.date)

    if (Date.now() >= bounds.followingStart.getTime()) {
      return NextResponse.json({ error: 'หมดเขตชดเชยแล้ว ต้องชดเชยภายในเดือนถัดไปเท่านั้น' }, { status: 400 })
    }

    if (!isInNextCalendarMonth(originalSession.date, makeupDate)) {
      return NextResponse.json({ error: 'วันชดเชยต้องอยู่ในเดือนถัดไปของเดือนเรียนเดิมเท่านั้น' }, { status: 400 })
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
      action?: 'confirm_absent' | 'mark_attendance' | 'request_coach_review' | 'close_review' | 'return_entitlement'
    }
    const reason = normalizeReason((body as { reason?: unknown }).reason)
    const attendanceStatus = normalizeAttendanceStatus((body as { attendance_status?: unknown }).attendance_status)
    const selectedCoachId = typeof (body as { coach_id?: unknown }).coach_id === 'string'
      ? ((body as { coach_id?: string }).coach_id || '').trim()
      : ''

    if (!sessionId || !action) {
      return NextResponse.json({ error: 'session_id and action are required' }, { status: 400 })
    }

    if ((action === 'mark_attendance' || action === 'request_coach_review' || action === 'close_review' || action === 'return_entitlement') && !reason) {
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

    if (session.status !== 'scheduled' || !isPastSession(session.date, session.end_time)) {
      return NextResponse.json({ error: 'ยืนยันขาดเรียนได้เฉพาะรอบปกติที่เลยเวลาเรียนแล้วเท่านั้น' }, { status: 400 })
    }

    const assignedCoachIds = await getAssignedCoachIds(supabaseAdmin, session)
    const hasAssignedCoach = assignedCoachIds.length > 0

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
      const { error: closeError } = await supabaseAdmin
        .from('booking_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId)

      if (closeError) {
        return NextResponse.json({ error: closeError.message }, { status: 500 })
      }

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

    const sessionStatus = finalAttendanceStatus === 'absent' ? 'absent' : 'completed'
    const { error: updateError } = await supabaseAdmin
      .from('booking_sessions')
      .update({ status: sessionStatus })
      .eq('id', sessionId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
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

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
