import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { logActivity } from '@/lib/activity-log'
import {
  notifyAdminsForAssignmentReview,
  notifyHeadCoachesForAssignmentReview,
} from '@/lib/coach-notifications'
import {
  buildRescheduleSuccessResponse,
  summarizeAssignmentReviewNotifications,
  type AssignmentReviewAudienceReport,
  type AssignmentReviewNotificationFailure,
  type RescheduleAssignmentNotificationSummary,
} from '@/lib/coach-notification-delivery'
import { ensureScheduleSlot } from '@/lib/schedule-slot-utils'
import type { CourseTypeName, Database } from '@/types/database'

interface ReschedulePayload {
  sessionId?: string
  targetDate?: string
  startTime?: string
  endTime?: string
  branchId?: string
  scheduleTemplateId?: string | null
}

interface DbError {
  message: string
  code?: string
}

interface BookingRelation {
  user_id: string
  course_type_id: string
  status: string
  course_types?: { name: CourseTypeName | null } | null
}

interface RescheduleSessionRow {
  id: string
  booking_id: string
  schedule_slot_id: string | null
  date: string
  start_time: string
  end_time: string
  branch_id: string
  child_id: string | null
  status: string
  is_makeup: boolean | null
  bookings: BookingRelation | null
}

interface TemplateRow {
  id: string
  start_time: string
  end_time: string
}

interface ProfileRow {
  full_name: string | null
}

interface BranchRow {
  name: string | null
}

interface ExistingSessionRow {
  id: string
  status: string
  bookings?: { user_id: string; course_type_id: string } | null
}

type AdminSupabase = ReturnType<typeof getServiceRoleClient>

const RESCHEDULE_CUTOFF_HOURS = 12
const BANGKOK_TIMEZONE_OFFSET = '+07:00'

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value
}

function shortTime(value: string) {
  return value.slice(0, 5)
}

function timeToMinutes(value: string) {
  const [hours, minutes] = shortTime(value).split(':').map(Number)
  return hours * 60 + minutes
}

function sessionStart(date: string, time: string) {
  return new Date(`${date}T${shortTime(time)}:00${BANGKOK_TIMEZONE_OFFSET}`)
}

function isAtLeastRescheduleCutoffAhead(date: string, time: string) {
  const diffMs = sessionStart(date, time).getTime() - Date.now()
  return diffMs >= RESCHEDULE_CUTOFF_HOURS * 60 * 60 * 1000
}

function isFutureSlot(date: string, time: string) {
  return sessionStart(date, time).getTime() > Date.now()
}

function isSameCalendarMonth(a: string, b: string) {
  const first = new Date(`${a}T00:00:00`)
  const second = new Date(`${b}T00:00:00`)
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth()
}

function dayOfWeek(date: string) {
  return new Date(`${date}T00:00:00`).getDay()
}

function templateCoversSlot(template: TemplateRow, startTime: string, endTime: string) {
  return timeToMinutes(template.start_time) <= timeToMinutes(startTime) && timeToMinutes(template.end_time) >= timeToMinutes(endTime)
}

function isSameSlotContext(
  session: RescheduleSessionRow,
  target: Required<Pick<ReschedulePayload, 'targetDate' | 'startTime' | 'endTime' | 'branchId'>>
) {
  return (
    session.date === target.targetDate &&
    normalizeTime(session.start_time) === normalizeTime(target.startTime) &&
    normalizeTime(session.end_time) === normalizeTime(target.endTime) &&
    session.branch_id === target.branchId
  )
}

async function findMatchingTemplate(
  adminSupabase: AdminSupabase,
  courseTypeId: string,
  payload: Required<Pick<ReschedulePayload, 'targetDate' | 'startTime' | 'endTime' | 'branchId'>> & Pick<ReschedulePayload, 'scheduleTemplateId'>
) {
  let query = adminSupabase
    .from('schedule_templates')
    .select('id, start_time, end_time')
    .eq('branch_id', payload.branchId)
    .eq('course_type_id', courseTypeId)
    .eq('day_of_week', dayOfWeek(payload.targetDate))
    .eq('is_active', true)

  if (payload.scheduleTemplateId) {
    query = query.eq('id', payload.scheduleTemplateId)
  }

  const { data, error } = await query as unknown as { data: TemplateRow[] | null; error: DbError | null }
  if (error) throw new Error(`โหลดรอบเรียนประจำไม่สำเร็จ: ${error.message}`)

  return (data || []).find((template) => templateCoversSlot(template, payload.startTime, payload.endTime)) || null
}

async function ensureLearnerHasNoDuplicateSlot(
  adminSupabase: AdminSupabase,
  session: RescheduleSessionRow,
  target: Required<Pick<ReschedulePayload, 'targetDate' | 'startTime' | 'endTime' | 'branchId'>>,
  userId: string
) {
  let query = adminSupabase
    .from('booking_sessions')
    .select('id, status, bookings!inner(user_id, course_type_id)')
    .eq('date', target.targetDate)
    .lt('start_time', normalizeTime(target.endTime))
    .gt('end_time', normalizeTime(target.startTime))
    .eq('bookings.user_id', userId)
    .neq('status', 'rescheduled')
    .neq('status', 'walleted')
    .neq('id', session.id)

  query = session.child_id
    ? query.eq('child_id', session.child_id)
    : query.is('child_id', null).eq('bookings.user_id', userId)

  const { data, error } = await query as unknown as { data: ExistingSessionRow[] | null; error: DbError | null }
  if (error) throw new Error(`ตรวจสอบรอบซ้ำไม่สำเร็จ: ${error.message}`)

  const duplicate = (data || []).some((row) => !['rescheduled', 'walleted'].includes(row.status))
  if (duplicate) {
    throw new Error('ผู้เรียนคนนี้มีรอบเรียนในเวลาที่ซ้ำหรือซ้อนกันแล้ว')
  }
}

async function notifyReschedule(
  adminSupabase: AdminSupabase,
  userId: string,
  oldBranchId: string,
  newBranchId: string,
  oldDate: string,
  oldStartTime: string,
  oldEndTime: string,
  targetDate: string,
  startTime: string,
  endTime: string,
  removedExactMembershipCount: number,
): Promise<RescheduleAssignmentNotificationSummary> {
  const [profileResult, oldBranchResult, newBranchResult] = await Promise.all([
    adminSupabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle() as unknown as Promise<{ data: ProfileRow | null; error: DbError | null }>,
    adminSupabase
      .from('branches')
      .select('name')
      .eq('id', oldBranchId)
      .maybeSingle() as unknown as Promise<{ data: BranchRow | null; error: DbError | null }>,
    adminSupabase
      .from('branches')
      .select('name')
      .eq('id', newBranchId)
      .maybeSingle() as unknown as Promise<{ data: BranchRow | null; error: DbError | null }>,
  ])

  const contextFailures: AssignmentReviewNotificationFailure[] = []
  ;[
    { stage: 'profile', error: profileResult.error },
    { stage: 'old_branch', error: oldBranchResult.error },
    { stage: 'new_branch', error: newBranchResult.error },
  ].forEach(({ stage, error }) => {
    if (error) contextFailures.push({
      audience: 'context',
      stage: 'context_lookup',
      message: `${stage}: ${error.message}`,
    })
  })

  const userName = profileResult.data?.full_name || 'ผู้ใช้'
  const oldBranchName = oldBranchResult.data?.name || 'สาขาเดิม'
  const newBranchName = newBranchResult.data?.name || 'สาขาใหม่'
  const oldSlotLabel = `${oldDate} ${shortTime(oldStartTime)}-${shortTime(oldEndTime)} ที่ ${oldBranchName}`
  const newSlotLabel = `${targetDate} ${shortTime(startTime)}-${shortTime(endTime)} ที่ ${newBranchName}`
  const message = `${userName} เปลี่ยนรอบเรียนจาก ${oldSlotLabel} เป็น ${newSlotLabel} นักเรียนในรอบใหม่ยังไม่ได้มอบหมายโค้ชอัตโนมัติ ต้องให้ Head Coach ตรวจและบันทึก/ยืนยันการมอบหมายก่อนเริ่มรอบ`
  const notificationClient = adminSupabase as unknown as SupabaseClient<Database>

  const audienceReports: AssignmentReviewAudienceReport[] = []
  audienceReports.push({
    audience: 'admin',
    report: await notifyAdminsForAssignmentReview(notificationClient, {
      title: 'Reschedule เปลี่ยนรายชื่อรอบสอน ต้องตรวจการมอบหมาย',
      message,
      linkUrl: '/admin/schedules',
    }),
  })

  const newBranchReport = await notifyHeadCoachesForAssignmentReview(notificationClient, {
    branchId: newBranchId,
    title: 'มีนักเรียนย้ายเข้ารอบ ต้องตรวจและบันทึกการมอบหมาย',
    message: `${userName} ย้ายเข้ารอบ ${newSlotLabel} โดยยังไม่ได้มอบหมายโค้ชอัตโนมัติ กรุณาตรวจกลุ่มและกดบันทึก/ยืนยันการมอบหมายก่อนเริ่มรอบ`,
    linkUrl: `/coach/assign-groups?month=${targetDate.slice(0, 7)}`,
  })
  audienceReports.push({ audience: 'new_branch_head_coach', report: newBranchReport })

  if (removedExactMembershipCount > 0) {
    const oldBranchReport = await notifyHeadCoachesForAssignmentReview(notificationClient, {
      branchId: oldBranchId,
      title: 'รายชื่อรอบเดิมเปลี่ยน ต้องตรวจและบันทึกการมอบหมายใหม่',
      message: `${userName} ย้ายออกจากรอบ ${oldSlotLabel} ระบบถอดเฉพาะสมาชิกเดิมออกแล้ว กรุณาตรวจรายชื่อและกดบันทึก/ยืนยันการมอบหมายใหม่ โดยระบบไม่ได้มอบหมายหรือบันทึก attendance อัตโนมัติ`,
      linkUrl: `/coach/assign-groups?month=${oldDate.slice(0, 7)}`,
    })
    audienceReports.push({ audience: 'old_branch_head_coach', report: oldBranchReport })
  }

  return summarizeAssignmentReviewNotifications(audienceReports, contextFailures)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json() as ReschedulePayload
    const { sessionId, targetDate, startTime, endTime, branchId, scheduleTemplateId } = body

    if (!sessionId || !targetDate || !startTime || !endTime || !branchId) {
      return NextResponse.json({ error: 'ข้อมูลการเปลี่ยนวันเรียนไม่ครบ กรุณาตรวจสอบอีกครั้ง' }, { status: 400 })
    }

    if (!isFutureSlot(targetDate, startTime)) {
      return NextResponse.json({ error: 'รอบเรียนใหม่ต้องเป็นรอบที่ยังไม่เริ่มเท่านั้น' }, { status: 400 })
    }

    const adminSupabase = getServiceRoleClient()
    const { data: session, error: sessionError } = await adminSupabase
      .from('booking_sessions')
      .select(`
        id, booking_id, schedule_slot_id, date, start_time, end_time, branch_id, child_id, status, is_makeup,
        bookings!inner(user_id, course_type_id, status, course_types(name))
      `)
      .eq('id', sessionId)
      .maybeSingle() as unknown as { data: RescheduleSessionRow | null; error: DbError | null }

    if (sessionError || !session || session.bookings?.user_id !== user.id) {
      return NextResponse.json({ error: 'ไม่พบรอบเรียนที่ต้องการเปลี่ยน' }, { status: 404 })
    }

    if (session.bookings.status !== 'verified') {
      return NextResponse.json({ error: 'เปลี่ยนวันได้เฉพาะคอร์สที่ชำระเงินและยืนยันแล้วเท่านั้น' }, { status: 400 })
    }

    if (session.status !== 'scheduled') {
      return NextResponse.json({ error: 'เปลี่ยนได้เฉพาะรอบเรียนที่ยังรอสอนเท่านั้น' }, { status: 400 })
    }

    if (session.is_makeup) {
      return NextResponse.json({ error: 'รอบชดเชยต้องให้ Admin เป็นผู้จัดการเท่านั้น' }, { status: 400 })
    }

    if (!isAtLeastRescheduleCutoffAhead(session.date, session.start_time)) {
      return NextResponse.json({ error: `ต้องเปลี่ยนล่วงหน้าอย่างน้อย ${RESCHEDULE_CUTOFF_HOURS} ชั่วโมงก่อนเวลาเรียนเดิม` }, { status: 400 })
    }

    if (!isSameCalendarMonth(session.date, targetDate)) {
      return NextResponse.json({ error: 'ผู้เรียนสามารถเปลี่ยนได้เฉพาะภายในเดือนที่จองเท่านั้น' }, { status: 400 })
    }

    const target = { targetDate, startTime, endTime, branchId }
    if (isSameSlotContext(session, target)) {
      return NextResponse.json({ error: 'กรุณาเลือกรอบเรียนใหม่ที่ไม่ใช่รอบเดิม' }, { status: 400 })
    }

    const courseTypeId = session.bookings.course_type_id
    const template = await findMatchingTemplate(adminSupabase, courseTypeId, {
      targetDate,
      startTime,
      endTime,
      branchId,
      scheduleTemplateId,
    })

    if (!template) {
      return NextResponse.json({ error: 'รอบเรียนใหม่ไม่ตรงกับรอบเรียนประจำในระบบ' }, { status: 400 })
    }

    const scheduleSlotId = await ensureScheduleSlot({
      supabase: adminSupabase,
      templateId: template.id,
      branchId,
      courseTypeId,
      date: targetDate,
      startTime,
      endTime,
    })

    if (session.schedule_slot_id === scheduleSlotId) {
      return NextResponse.json({ error: 'กรุณาเลือกรอบเรียนใหม่ที่ไม่ใช่รอบเดิม' }, { status: 400 })
    }

    await ensureLearnerHasNoDuplicateSlot(adminSupabase, session, target, user.id)

    const { error: updateError } = await adminSupabase
      .from('booking_sessions')
      .update({ status: 'rescheduled' })
      .eq('id', session.id) as unknown as { error: DbError | null }

    if (updateError) {
      return NextResponse.json({ error: `อัปเดตรอบเดิมไม่สำเร็จ: ${updateError.message}` }, { status: 500 })
    }

    const { data: newSession, error: insertError } = await adminSupabase
      .from('booking_sessions')
      .insert({
        booking_id: session.booking_id,
        schedule_slot_id: scheduleSlotId,
        date: targetDate,
        start_time: normalizeTime(startTime),
        end_time: normalizeTime(endTime),
        branch_id: branchId,
        child_id: session.child_id,
        status: 'scheduled',
        rescheduled_from_id: session.id,
        is_makeup: false,
      })
      .select('id')
      .single() as unknown as { data: { id: string } | null; error: DbError | null }

    if (insertError || !newSession) {
      await adminSupabase.from('booking_sessions').update({ status: 'scheduled' }).eq('id', session.id)
      return NextResponse.json({ error: `สร้างรอบเรียนใหม่ไม่สำเร็จ: ${insertError?.message || 'ไม่พบข้อมูลรอบเรียนใหม่'}` }, { status: 500 })
    }

    const { data: removedAssignmentMemberships, error: assignmentCleanupError } = await adminSupabase
      .from('coach_assignment_group_students')
      .delete()
      .eq('booking_session_id', session.id)
      .select('id') as unknown as { data: { id: string }[] | null; error: DbError | null }

    if (assignmentCleanupError) {
      await adminSupabase.from('booking_sessions').delete().eq('id', newSession.id)
      await adminSupabase.from('booking_sessions').update({ status: 'scheduled' }).eq('id', session.id)
      return NextResponse.json({ error: `Clean up old coach assignment group failed: ${assignmentCleanupError.message}` }, { status: 500 })
    }

    const removedExactMembershipCount = (removedAssignmentMemberships || []).length
    let notificationReport: RescheduleAssignmentNotificationSummary
    try {
      notificationReport = await notifyReschedule(
        adminSupabase,
        user.id,
        session.branch_id,
        branchId,
        session.date,
        session.start_time,
        session.end_time,
        targetDate,
        startTime,
        endTime,
        removedExactMembershipCount,
      )
    } catch (error) {
      notificationReport = summarizeAssignmentReviewNotifications(
        [],
        [{
          audience: 'unexpected',
          stage: 'unexpected',
          message: error instanceof Error ? error.message : 'Unknown assignment-review notification failure',
        }],
        removedExactMembershipCount > 0 ? 3 : 2,
      )
    }
    if (!notificationReport.success) {
      console.error('Reschedule assignment-review notification warning:', notificationReport.failures)
    }

    await logActivity({
      userId: user.id,
      action: 'reschedule_booking_session',
      entityType: 'booking_session',
      entityId: session.id,
      details: {
        newSessionId: newSession.id,
        oldDate: session.date,
        oldStartTime: session.start_time,
        newDate: targetDate,
        newStartTime: startTime,
        branchId,
        scheduleSlotId,
        removedExactMembershipCount,
        assignmentReviewRequired: true,
        autoAssigned: false,
        notificationDeliverySucceeded: notificationReport.success,
        notificationRequiredAudienceCount: notificationReport.requiredAudienceCount,
        notificationRecipientCount: notificationReport.recipientCount,
        notificationAttemptCount: notificationReport.attemptCount,
        notificationSuccessfulRecipientCount: notificationReport.successfulRecipientCount,
        notificationSkippedCount: notificationReport.skippedCount,
        notificationFailedRecipientCount: notificationReport.failedRecipientCount,
        notificationAudienceFailureCount: notificationReport.audienceFailureCount,
        notificationFailureCount: notificationReport.failureCount,
        notificationFailures: notificationReport.failures,
      },
    })

    return NextResponse.json(buildRescheduleSuccessResponse(
      newSession.id,
      scheduleSlotId,
      notificationReport,
    ))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
