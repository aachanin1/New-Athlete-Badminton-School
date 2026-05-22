import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { logActivity } from '@/lib/activity-log'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { notifyRoles, notifyUser } from '@/lib/notifications'
import { ensureScheduleSlot } from '@/lib/schedule-slot-utils'
import { createClient } from '@/lib/supabase/server'
import { fmtTime } from '@/lib/utils'
import type { CourseTypeName, Database } from '@/types/database'

const STORE_CUTOFF_HOURS = 48

interface StorePayload {
  action?: 'store' | 'redeem' | 'expire_due'
  sessionId?: string
  creditId?: string
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

interface SessionRow {
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

interface WalletCreditRow {
  id: string
  user_id: string
  booking_id: string
  original_session_id: string
  child_id: string | null
  branch_id: string
  course_type_id: string
  original_date: string
  original_start_time: string
  original_end_time: string
  status: string
  expires_at: string
}

interface TemplateRow {
  id: string
  start_time: string
  end_time: string
}

interface SlotRow {
  id: string
  branch_id: string
  current_students: number
  max_students: number
  status: string
}

interface AttendanceRow {
  id: string
}

interface AssignmentStudentRow {
  id: string
  group_id: string
  coach_assignment_groups?: {
    coach_id: string | null
    name: string | null
  } | null
}

interface CoachBranchRow {
  coach_id: string
  profiles?: {
    role: string | null
  } | null
}

interface ExistingSessionRow {
  id: string
  status: string
  bookings?: { user_id: string; course_type_id: string } | null
}

type AdminSupabase = ReturnType<typeof getServiceRoleClient>

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value
}

function shortTime(value: string) {
  return value.slice(0, 5)
}

function sessionStart(date: string, time: string) {
  return new Date(`${date}T${shortTime(time)}:00+07:00`)
}

function monthKey(date: string) {
  return date.slice(0, 7)
}

function isSameMonth(a: string, b: string) {
  return monthKey(a) === monthKey(b)
}

function isAtLeastHoursAhead(date: string, time: string, hours: number) {
  return sessionStart(date, time).getTime() - Date.now() >= hours * 60 * 60 * 1000
}

function isFutureSlot(date: string, time: string) {
  return sessionStart(date, time).getTime() > Date.now()
}

function getMonthEndIso(date: string) {
  const [year, month] = date.split('-').map(Number)
  const nextMonthStart = month === 12
    ? new Date(`${year + 1}-01-01T00:00:00+07:00`)
    : new Date(`${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00+07:00`)
  return new Date(nextMonthStart.getTime() - 1).toISOString()
}

function dayOfWeek(date: string) {
  return new Date(`${date}T00:00:00+07:00`).getDay()
}

function timeToMinutes(value: string) {
  const [hours, minutes] = shortTime(value).split(':').map(Number)
  return hours * 60 + minutes
}

function templateCoversSlot(template: TemplateRow, startTime: string, endTime: string) {
  return timeToMinutes(template.start_time) <= timeToMinutes(startTime) && timeToMinutes(template.end_time) >= timeToMinutes(endTime)
}

function slotLabel(date: string, startTime: string, endTime: string) {
  const dateLabel = new Date(`${date}T00:00:00+07:00`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
  return `${dateLabel} ${fmtTime(startTime)}-${fmtTime(endTime)}`
}

async function getCurrentUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

async function fetchSession(adminSupabase: AdminSupabase, sessionId: string) {
  const { data, error } = await adminSupabase
    .from('booking_sessions')
    .select(`
      id, booking_id, schedule_slot_id, date, start_time, end_time, branch_id, child_id, status, is_makeup,
      bookings!inner(user_id, course_type_id, status, course_types(name))
    `)
    .eq('id', sessionId)
    .maybeSingle() as unknown as { data: SessionRow | null; error: DbError | null }

  if (error) throw new Error(`โหลดรอบเรียนไม่สำเร็จ: ${error.message}`)
  return data
}

async function ensureNoAttendance(adminSupabase: AdminSupabase, sessionId: string) {
  const { data, error } = await adminSupabase
    .from('attendance')
    .select('id')
    .eq('booking_session_id', sessionId)
    .limit(1) as unknown as { data: AttendanceRow[] | null; error: DbError | null }

  if (error) throw new Error(`ตรวจสอบ attendance ไม่สำเร็จ: ${error.message}`)
  if ((data || []).length > 0) throw new Error('รอบนี้มีการเช็คชื่อแล้ว ไม่สามารถเก็บเข้ากระเป๋าได้')
}

async function fetchAssignmentStudents(adminSupabase: AdminSupabase, sessionId: string) {
  const { data, error } = await adminSupabase
    .from('coach_assignment_group_students')
    .select(`
      id,
      group_id,
      coach_assignment_groups!inner(coach_id, name)
    `)
    .eq('booking_session_id', sessionId) as unknown as { data: AssignmentStudentRow[] | null; error: DbError | null }

  if (error) throw new Error(`โหลดข้อมูลกลุ่มโค้ชไม่สำเร็จ: ${error.message}`)
  return data || []
}

async function notifyHeadCoachesAndAssignedCoach(
  adminSupabase: AdminSupabase,
  branchId: string,
  assignedCoachIds: string[],
  payload: { title: string; message: string; link_url: string }
) {
  const { data } = await adminSupabase
    .from('coach_branches')
    .select('coach_id, profiles!coach_branches_coach_id_fkey(role)')
    .eq('branch_id', branchId) as unknown as { data: CoachBranchRow[] | null }

  const headCoachIds = (data || [])
    .filter((row) => row.profiles?.role === 'head_coach')
    .map((row) => row.coach_id)
  const userIds = Array.from(new Set([...headCoachIds, ...assignedCoachIds.filter(Boolean)]))
  const notificationClient = adminSupabase as unknown as SupabaseClient<Database>

  await Promise.all(userIds.map((userId) => notifyUser(notificationClient, {
    user_id: userId,
    title: payload.title,
    message: payload.message,
    type: 'schedule',
    link_url: payload.link_url,
  }))).catch(() => null)
}

async function adjustSlotCount(adminSupabase: AdminSupabase, slotId: string | null, delta: number) {
  if (!slotId) return

  const { data: slot, error } = await adminSupabase
    .from('schedule_slots')
    .select('id, current_students, max_students, status')
    .eq('id', slotId)
    .maybeSingle() as unknown as { data: SlotRow | null; error: DbError | null }

  if (error) throw new Error(`โหลดรอบเรียนไม่สำเร็จ: ${error.message}`)
  if (!slot) return

  const nextCount = Math.max(0, Number(slot.current_students || 0) + delta)
  const { error: updateError } = await adminSupabase
    .from('schedule_slots')
    .update({ current_students: nextCount })
    .eq('id', slotId) as unknown as { error: DbError | null }

  if (updateError) throw new Error(`อัปเดตจำนวนผู้เรียนในรอบไม่สำเร็จ: ${updateError.message}`)
}

async function findMatchingTemplate(
  adminSupabase: AdminSupabase,
  courseTypeId: string,
  payload: Required<Pick<StorePayload, 'targetDate' | 'startTime' | 'endTime' | 'branchId'>> & Pick<StorePayload, 'scheduleTemplateId'>
) {
  let query = adminSupabase
    .from('schedule_templates')
    .select('id, start_time, end_time')
    .eq('branch_id', payload.branchId)
    .eq('course_type_id', courseTypeId)
    .eq('day_of_week', dayOfWeek(payload.targetDate))
    .eq('is_active', true)

  if (payload.scheduleTemplateId) query = query.eq('id', payload.scheduleTemplateId)

  const { data, error } = await query as unknown as { data: TemplateRow[] | null; error: DbError | null }
  if (error) throw new Error(`โหลดรอบเรียนประจำไม่สำเร็จ: ${error.message}`)

  return (data || []).find((template) => templateCoversSlot(template, payload.startTime, payload.endTime)) || null
}

async function ensureNoDuplicateLearnerSlot(
  adminSupabase: AdminSupabase,
  credit: WalletCreditRow,
  target: {
    date: string
    startTime: string
    endTime: string
    branchId: string
  },
) {
  let query = adminSupabase
    .from('booking_sessions')
    .select('id, status, bookings!inner(user_id, course_type_id)')
    .eq('date', target.date)
    .eq('start_time', normalizeTime(target.startTime))
    .eq('end_time', normalizeTime(target.endTime))
    .eq('branch_id', target.branchId)
    .eq('bookings.course_type_id', credit.course_type_id)

  query = credit.child_id
    ? query.eq('child_id', credit.child_id)
    : query.is('child_id', null).eq('bookings.user_id', credit.user_id)

  const { data, error } = await query as unknown as { data: ExistingSessionRow[] | null; error: DbError | null }
  if (error) throw new Error(`ตรวจสอบรอบซ้ำไม่สำเร็จ: ${error.message}`)

  const duplicate = (data || []).some((session) => !['rescheduled', 'walleted'].includes(session.status))
  if (duplicate) throw new Error('ผู้เรียนคนนี้มีรอบเรียนในวันและเวลานี้แล้ว')
}

async function ensureSlotHasCapacity(adminSupabase: AdminSupabase, scheduleSlotId: string) {
  const { data: slot, error } = await adminSupabase
    .from('schedule_slots')
    .select('id, branch_id, current_students, max_students, status')
    .eq('id', scheduleSlotId)
    .maybeSingle() as unknown as { data: SlotRow | null; error: DbError | null }

  if (error || !slot) throw new Error(`โหลดรอบเรียนไม่สำเร็จ: ${error?.message || 'ไม่พบรอบเรียน'}`)
  if (slot.status !== 'open') throw new Error('รอบเรียนนี้ไม่เปิดรับจองแล้ว')
  if (Number(slot.current_students || 0) >= Number(slot.max_students || 0)) throw new Error('รอบเรียนนี้เต็มแล้ว')
}

async function expireDueCredits(adminSupabase: AdminSupabase, userId: string) {
  const nowIso = new Date().toISOString()
  const { data: credits } = await adminSupabase
    .from('lesson_wallet_credits')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .lt('expires_at', nowIso) as unknown as { data: { id: string }[] | null }

  const creditIds = (credits || []).map((credit) => credit.id)
  if (creditIds.length === 0) return 0

  const { error } = await adminSupabase
    .from('lesson_wallet_credits')
    .update({ status: 'expired', expired_at: nowIso })
    .in('id', creditIds) as unknown as { error: DbError | null }

  if (error) throw new Error(`อัปเดตสิทธิ์หมดอายุไม่สำเร็จ: ${error.message}`)
  return creditIds.length
}

async function storeInWallet(request: NextRequest, userId: string, payload: StorePayload) {
  if (!payload.sessionId) return NextResponse.json({ error: 'ไม่พบรอบเรียนที่ต้องการเก็บ' }, { status: 400 })

  const adminSupabase = getServiceRoleClient()
  const session = await fetchSession(adminSupabase, payload.sessionId)
  if (!session || session.bookings?.user_id !== userId) {
    return NextResponse.json({ error: 'ไม่พบรอบเรียนที่ต้องการเก็บ' }, { status: 404 })
  }

  if (session.bookings.status !== 'verified') {
    return NextResponse.json({ error: 'เก็บเข้ากระเป๋าได้เฉพาะคอร์สที่ชำระเงินและยืนยันแล้วเท่านั้น' }, { status: 400 })
  }
  if (session.status !== 'scheduled') {
    return NextResponse.json({ error: 'เก็บได้เฉพาะรอบเรียนที่ยังรอเรียนเท่านั้น' }, { status: 400 })
  }
  if (session.is_makeup) {
    return NextResponse.json({ error: 'รอบชดเชยไม่สามารถเก็บเข้ากระเป๋าได้' }, { status: 400 })
  }
  if (!isAtLeastHoursAhead(session.date, session.start_time, STORE_CUTOFF_HOURS)) {
    return NextResponse.json({ error: 'ต้องเก็บเข้ากระเป๋าล่วงหน้าอย่างน้อย 48 ชั่วโมงก่อนเวลาเรียน' }, { status: 400 })
  }

  await ensureNoAttendance(adminSupabase, session.id)
  const assignmentRows = await fetchAssignmentStudents(adminSupabase, session.id)
  const assignedCoachIds = Array.from(new Set(assignmentRows.map((row) => row.coach_assignment_groups?.coach_id).filter(Boolean))) as string[]
  const expiresAt = getMonthEndIso(session.date)

  const { data: credit, error: creditError } = await adminSupabase
    .from('lesson_wallet_credits')
    .insert({
      user_id: userId,
      booking_id: session.booking_id,
      original_session_id: session.id,
      child_id: session.child_id,
      branch_id: session.branch_id,
      course_type_id: session.bookings.course_type_id,
      original_schedule_slot_id: session.schedule_slot_id,
      original_date: session.date,
      original_start_time: session.start_time,
      original_end_time: session.end_time,
      status: 'active',
      expires_at: expiresAt,
      notes: 'Stored by user before 48-hour cutoff',
    })
    .select('id')
    .single() as unknown as { data: { id: string } | null; error: DbError | null }

  if (creditError || !credit) {
    return NextResponse.json({ error: `สร้างสิทธิ์กระเป๋าไม่สำเร็จ: ${creditError?.message || 'ไม่พบข้อมูลสิทธิ์'}` }, { status: 500 })
  }

  const rollback = async () => {
    await adminSupabase.from('lesson_wallet_credits').delete().eq('id', credit.id)
  }

  const { error: updateSessionError } = await adminSupabase
    .from('booking_sessions')
    .update({ status: 'walleted' })
    .eq('id', session.id) as unknown as { error: DbError | null }

  if (updateSessionError) {
    await rollback()
    return NextResponse.json({ error: `อัปเดตรอบเรียนไม่สำเร็จ: ${updateSessionError.message}` }, { status: 500 })
  }

  try {
    await adjustSlotCount(adminSupabase, session.schedule_slot_id, -1)
  } catch (error) {
    await adminSupabase.from('booking_sessions').update({ status: 'scheduled' }).eq('id', session.id)
    await rollback()
    const message = error instanceof Error ? error.message : 'อัปเดตจำนวนผู้เรียนในรอบไม่สำเร็จ'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  if (assignmentRows.length > 0) {
    const { error: deleteAssignmentError } = await adminSupabase
      .from('coach_assignment_group_students')
      .delete()
      .in('id', assignmentRows.map((row) => row.id)) as unknown as { error: DbError | null }

    if (deleteAssignmentError) {
      await adminSupabase.from('booking_sessions').update({ status: 'scheduled' }).eq('id', session.id)
      await adjustSlotCount(adminSupabase, session.schedule_slot_id, 1).catch(() => null)
      await rollback()
      return NextResponse.json({ error: `ถอดผู้เรียนจากกลุ่มโค้ชไม่สำเร็จ: ${deleteAssignmentError.message}` }, { status: 500 })
    }
  }

  const label = slotLabel(session.date, session.start_time, session.end_time)
  await Promise.all([
    notifyHeadCoachesAndAssignedCoach(adminSupabase, session.branch_id, assignedCoachIds, {
      title: 'ผู้เรียนเก็บรอบเรียนเข้ากระเป๋า',
      message: `ผู้เรียนเก็บรอบ ${label} เข้ากระเป๋าวันเรียนแล้ว กรุณาตรวจกลุ่มสอนหากรอบนี้เคยมอบหมายไว้`,
      link_url: `/coach/assign-groups?month=${monthKey(session.date)}`,
    }),
    notifyRoles(adminSupabase as unknown as SupabaseClient<Database>, {
      roles: ['admin', 'super_admin'],
      title: 'ผู้เรียนเก็บรอบเรียนเข้ากระเป๋า',
      message: `ผู้เรียนเก็บรอบ ${label} เข้ากระเป๋าวันเรียน`,
      type: 'schedule',
      link_url: '/admin/schedules',
    }),
    logActivity({
      userId,
      action: 'store_lesson_wallet_credit',
      entityType: 'lesson_wallet_credits',
      entityId: credit.id,
      details: {
        sessionId: session.id,
        scheduleSlotId: session.schedule_slot_id,
        date: session.date,
        startTime: session.start_time,
        cutoffHours: STORE_CUTOFF_HOURS,
        removedAssignmentStudentIds: assignmentRows.map((row) => row.id),
        notifiedCoachIds: assignedCoachIds,
      },
      ipAddress: request.headers.get('x-forwarded-for'),
    }),
  ]).catch(() => null)

  return NextResponse.json({ success: true, creditId: credit.id })
}

async function redeemWalletCredit(request: NextRequest, userId: string, payload: StorePayload) {
  const { creditId, targetDate, startTime, endTime, branchId, scheduleTemplateId } = payload
  if (!creditId || !targetDate || !startTime || !endTime || !branchId) {
    return NextResponse.json({ error: 'ข้อมูลการใช้วันเรียนจากกระเป๋าไม่ครบ' }, { status: 400 })
  }

  const adminSupabase = getServiceRoleClient()
  const expiredCount = await expireDueCredits(adminSupabase, userId)

  const { data: credit, error: creditError } = await adminSupabase
    .from('lesson_wallet_credits')
    .select('id, user_id, booking_id, original_session_id, child_id, branch_id, course_type_id, original_date, original_start_time, original_end_time, status, expires_at')
    .eq('id', creditId)
    .maybeSingle() as unknown as { data: WalletCreditRow | null; error: DbError | null }

  if (creditError || !credit || credit.user_id !== userId) {
    return NextResponse.json({ error: 'ไม่พบสิทธิ์วันเรียนในกระเป๋า' }, { status: 404 })
  }

  if (credit.status !== 'active') {
    return NextResponse.json({ error: 'สิทธิ์นี้ไม่พร้อมใช้งานแล้ว' }, { status: 400 })
  }
  if (new Date(credit.expires_at).getTime() < Date.now()) {
    await expireDueCredits(adminSupabase, userId).catch(() => null)
    return NextResponse.json({ error: 'สิทธิ์นี้หมดอายุแล้ว ใช้ได้เฉพาะภายในเดือนเดิม' }, { status: 400 })
  }
  if (!isSameMonth(credit.original_date, targetDate)) {
    return NextResponse.json({ error: 'ใช้วันเรียนจากกระเป๋าได้เฉพาะเดือนเดียวกับที่จองไว้' }, { status: 400 })
  }
  if (!isFutureSlot(targetDate, startTime)) {
    return NextResponse.json({ error: 'ต้องเลือกรอบเรียนที่ยังไม่เริ่มเท่านั้น' }, { status: 400 })
  }

  const template = await findMatchingTemplate(adminSupabase, credit.course_type_id, {
    targetDate,
    startTime,
    endTime,
    branchId,
    scheduleTemplateId: scheduleTemplateId || null,
  })

  if (!template) {
    return NextResponse.json({ error: 'รอบเรียนที่เลือกไม่ตรงกับรอบเรียนประจำในระบบ' }, { status: 400 })
  }

  const scheduleSlotId = await ensureScheduleSlot({
    supabase: adminSupabase,
    templateId: template.id,
    branchId,
    courseTypeId: credit.course_type_id,
    date: targetDate,
    startTime,
    endTime,
  })

  await ensureSlotHasCapacity(adminSupabase, scheduleSlotId)
  await ensureNoDuplicateLearnerSlot(adminSupabase, credit, {
    date: targetDate,
    startTime,
    endTime,
    branchId,
  })

  const { data: newSession, error: insertError } = await adminSupabase
    .from('booking_sessions')
    .insert({
      booking_id: credit.booking_id,
      schedule_slot_id: scheduleSlotId,
      date: targetDate,
      start_time: normalizeTime(startTime),
      end_time: normalizeTime(endTime),
      branch_id: branchId,
      child_id: credit.child_id,
      status: 'scheduled',
      rescheduled_from_id: credit.original_session_id,
      is_makeup: false,
    })
    .select('id')
    .single() as unknown as { data: { id: string } | null; error: DbError | null }

  if (insertError || !newSession) {
    return NextResponse.json({ error: `สร้างรอบเรียนใหม่ไม่สำเร็จ: ${insertError?.message || 'ไม่พบข้อมูลรอบเรียนใหม่'}` }, { status: 500 })
  }

  try {
    await adjustSlotCount(adminSupabase, scheduleSlotId, 1)
  } catch (error) {
    await adminSupabase.from('booking_sessions').delete().eq('id', newSession.id)
    const message = error instanceof Error ? error.message : 'อัปเดตจำนวนผู้เรียนในรอบไม่สำเร็จ'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const { error: updateCreditError } = await adminSupabase
    .from('lesson_wallet_credits')
    .update({
      status: 'redeemed',
      redeemed_session_id: newSession.id,
      redeemed_at: new Date().toISOString(),
    })
    .eq('id', credit.id)
    .eq('status', 'active') as unknown as { error: DbError | null }

  if (updateCreditError) {
    await adjustSlotCount(adminSupabase, scheduleSlotId, -1).catch(() => null)
    await adminSupabase.from('booking_sessions').delete().eq('id', newSession.id)
    return NextResponse.json({ error: `ใช้สิทธิ์ไม่สำเร็จ: ${updateCreditError.message}` }, { status: 500 })
  }

  const oldLabel = slotLabel(credit.original_date, credit.original_start_time, credit.original_end_time)
  const newLabel = slotLabel(targetDate, startTime, endTime)

  await Promise.all([
    notifyHeadCoachesAndAssignedCoach(adminSupabase, branchId, [], {
      title: 'ผู้เรียนใช้วันเรียนจากกระเป๋า',
      message: `ผู้เรียนใช้สิทธิ์จากรอบ ${oldLabel} มาลงรอบ ${newLabel} กรุณาจัดกลุ่ม/มอบหมายโค้ช`,
      link_url: `/coach/assign-groups?month=${monthKey(targetDate)}`,
    }),
    notifyRoles(adminSupabase as unknown as SupabaseClient<Database>, {
      roles: ['admin', 'super_admin'],
      title: 'ผู้เรียนใช้วันเรียนจากกระเป๋า',
      message: `ผู้เรียนใช้สิทธิ์จากกระเป๋ามาลงรอบ ${newLabel}`,
      type: 'schedule',
      link_url: '/admin/schedules',
    }),
    logActivity({
      userId,
      action: 'redeem_lesson_wallet_credit',
      entityType: 'lesson_wallet_credits',
      entityId: credit.id,
      details: {
        expiredBeforeRedeem: expiredCount,
        originalSessionId: credit.original_session_id,
        newSessionId: newSession.id,
        scheduleSlotId,
        targetDate,
        startTime,
        branchId,
      },
      ipAddress: request.headers.get('x-forwarded-for'),
    }),
  ]).catch(() => null)

  return NextResponse.json({ success: true, sessionId: newSession.id, scheduleSlotId })
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json() as StorePayload
    if (body.action === 'store') return storeInWallet(request, user.id, body)
    if (body.action === 'redeem') return redeemWalletCredit(request, user.id, body)
    if (body.action === 'expire_due') {
      const count = await expireDueCredits(getServiceRoleClient(), user.id)
      return NextResponse.json({ success: true, expiredCount: count })
    }

    return NextResponse.json({ error: 'ไม่พบ action ที่รองรับ' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
