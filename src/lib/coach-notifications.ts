import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, NotificationType } from '@/types/database'
import { fmtTime, getBangkokDateString } from '@/lib/utils'

interface CoachNotificationInput {
  userId: string
  title: string
  message: string
  type?: NotificationType
  linkUrl?: string | null
}

interface CoachSlotInfo {
  id: string
  date: string
  start_time: string
  end_time: string
  branches?: { name: string | null } | null
  course_types?: { name: string | null } | null
}

interface AssignedCoachNotificationInput {
  coachIds: string[]
  slot: CoachSlotInfo
  groupCount: number
  studentCount: number
}

interface AssignmentGroupStudentRow {
  booking_session_id: string
  student_id: string
}

interface AssignmentGroupForGapRow {
  id: string
  schedule_slot_id: string
  schedule_slots?: CoachSlotInfo | null
  coach_assignment_group_students?: AssignmentGroupStudentRow[] | null
}

interface CoachCheckinRow {
  schedule_slot_id: string
}

interface AttendanceRow {
  booking_session_id: string
  student_id: string
}

interface NotificationInsertRow {
  user_id: string
  title: string
  message: string
  type: NotificationType
  link_url: string | null
}

interface NotificationInsertTable {
  insert: (values: NotificationInsertRow) => Promise<{ error: { message: string } | null }>
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function formatThaiSlotDate(slot: CoachSlotInfo) {
  const date = new Date(`${slot.date}T00:00:00+07:00`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })

  return `${date} ${fmtTime(slot.start_time)}-${fmtTime(slot.end_time)}`
}

function getSlotLabel(slot: CoachSlotInfo) {
  const branchName = slot.branches?.name || 'ไม่ระบุสาขา'
  const courseName = slot.course_types?.name || 'ไม่ระบุประเภท'
  return `${formatThaiSlotDate(slot)} · ${branchName} · ${courseName}`
}

async function notificationExists(
  supabase: SupabaseClient<Database>,
  notification: CoachNotificationInput,
) {
  let query = supabase
    .from('notifications')
    .select('id')
    .eq('user_id', notification.userId)
    .eq('title', notification.title)
    .eq('message', notification.message)
    .limit(1)

  query = notification.linkUrl
    ? query.eq('link_url', notification.linkUrl)
    : query.is('link_url', null)

  const { data, error } = await query
  if (error) return false
  return Boolean(data?.length)
}

export async function notifyCoachOnce(
  supabase: SupabaseClient<Database>,
  notification: CoachNotificationInput,
) {
  const exists = await notificationExists(supabase, notification)
  if (exists) return { error: null, skipped: true }

  const notificationTable = supabase.from('notifications') as unknown as NotificationInsertTable
  const { error } = await notificationTable.insert({
    user_id: notification.userId,
    title: notification.title,
    message: notification.message,
    type: notification.type || 'system',
    link_url: notification.linkUrl || null,
  })

  return { error, skipped: false }
}

export async function notifyAssignedCoachesForSlot(
  supabase: SupabaseClient<Database>,
  input: AssignedCoachNotificationInput,
) {
  const coachIds = Array.from(new Set(input.coachIds.filter(Boolean)))
  const linkUrl = `/coach/today?date=${input.slot.date}`
  const slotLabel = getSlotLabel(input.slot)

  await Promise.all(coachIds.map((coachId) => notifyCoachOnce(supabase, {
    userId: coachId,
    title: 'ได้รับมอบหมายรอบสอน',
    message: `คุณได้รับมอบหมายให้สอน ${slotLabel} จำนวน ${input.groupCount} กลุ่ม ผู้เรียน ${input.studentCount} คน กรุณาเช็คอินก่อนสอนและเช็คชื่อให้ครบ`,
    type: 'schedule',
    linkUrl,
  })))
}

export async function notifyCoachCheckinAttendanceReminder(
  supabase: SupabaseClient<Database>,
  coachId: string,
  slot: CoachSlotInfo,
) {
  const slotLabel = getSlotLabel(slot)

  return notifyCoachOnce(supabase, {
    userId: coachId,
    title: 'เช็คอินสำเร็จ อย่าลืมเช็คชื่อ',
    message: `รอบ ${slotLabel} เช็คอินเรียบร้อยแล้ว หลังสอนกรุณาเช็คชื่อนักเรียนให้ครบเพื่อใช้เป็นหลักฐานสรุปชั่วโมงสอน`,
    type: 'reminder',
    linkUrl: `/coach/attendance?date=${slot.date}&slot=${slot.id}`,
  })
}

function isSlotEnded(slot: CoachSlotInfo, now: Date) {
  const end = new Date(`${slot.date}T${slot.end_time.slice(0, 8)}+07:00`)
  return end.getTime() < now.getTime()
}

function isWithinCheckinWindow(slot: CoachSlotInfo, now: Date) {
  const start = new Date(`${slot.date}T${slot.start_time.slice(0, 8)}+07:00`)
  const earliest = new Date(start.getTime() - 30 * 60 * 1000)
  const latest = new Date(start.getTime() + 30 * 60 * 1000)
  return now >= earliest && now <= latest
}

function getAttendanceKey(row: { booking_session_id: string; student_id: string }) {
  return `${row.booking_session_id}:${row.student_id}`
}

export async function createCoachCheckinWindowNotifications(
  supabase: SupabaseClient<Database>,
  coachId: string,
) {
  const now = new Date()
  const today = getBangkokDateString(now)

  const { data: groups } = await supabase
    .from('coach_assignment_groups')
    .select(`
      id,
      schedule_slot_id,
      schedule_slots!inner(
        id,
        date,
        start_time,
        end_time,
        branches(name),
        course_types(name)
      ),
      coach_assignment_group_students(booking_session_id, student_id)
    `)
    .eq('coach_id', coachId)
    .eq('schedule_slots.date', today) as unknown as { data: AssignmentGroupForGapRow[] | null }

  const groupRows = groups || []
  const slotIds = Array.from(new Set(groupRows.map((group) => group.schedule_slot_id)))
  if (slotIds.length === 0) return

  const { data: checkins } = await supabase
    .from('coach_checkins')
    .select('schedule_slot_id')
    .eq('coach_id', coachId)
    .in('schedule_slot_id', slotIds) as unknown as { data: CoachCheckinRow[] | null }

  const checkedInSlotIds = new Set((checkins || []).map((checkin) => checkin.schedule_slot_id))
  const groupsBySlot = new Map<string, AssignmentGroupForGapRow[]>()

  groupRows.forEach((group) => {
    const rows = groupsBySlot.get(group.schedule_slot_id) || []
    rows.push(group)
    groupsBySlot.set(group.schedule_slot_id, rows)
  })

  await Promise.all(Array.from(groupsBySlot.entries()).map(async ([slotId, slotGroups]) => {
    const slot = slotGroups[0]?.schedule_slots
    const studentCount = slotGroups.reduce((sum, group) => sum + (group.coach_assignment_group_students?.length || 0), 0)
    if (!slot || checkedInSlotIds.has(slotId) || studentCount === 0 || !isWithinCheckinWindow(slot, now)) return

    await notifyCoachOnce(supabase, {
      userId: coachId,
      title: 'ถึงเวลาเช็คอินรอบสอน',
      message: `รอบ ${getSlotLabel(slot)} อยู่ในช่วงเช็คอินแล้ว กรุณาเช็คอินด้วยเซลฟี่และตำแหน่งที่ตั้งก่อนเช็คชื่อนักเรียน`,
      type: 'reminder',
      linkUrl: '/coach/checkin',
    })
  }))
}

export async function createCoachAttendanceGapNotifications(
  supabase: SupabaseClient<Database>,
  coachId: string,
  options: { lookbackDays?: number } = {},
) {
  const lookbackDays = options.lookbackDays ?? 14
  const now = new Date()
  const today = getBangkokDateString(now)
  const startDate = toDateKey(addDays(new Date(`${today}T00:00:00+07:00`), -lookbackDays))

  const { data: groups } = await supabase
    .from('coach_assignment_groups')
    .select(`
      id,
      schedule_slot_id,
      schedule_slots!inner(
        id,
        date,
        start_time,
        end_time,
        branches(name),
        course_types(name)
      ),
      coach_assignment_group_students(booking_session_id, student_id)
    `)
    .eq('coach_id', coachId)
    .gte('schedule_slots.date', startDate)
    .lte('schedule_slots.date', today) as unknown as { data: AssignmentGroupForGapRow[] | null }

  const groupRows = groups || []
  const slotIds = Array.from(new Set(groupRows.map((group) => group.schedule_slot_id)))
  const studentRows = groupRows.flatMap((group) => group.coach_assignment_group_students || [])
  const sessionIds = Array.from(new Set(studentRows.map((student) => student.booking_session_id)))

  if (slotIds.length === 0 || sessionIds.length === 0) return

  const [{ data: checkins }, { data: attendanceRows }] = await Promise.all([
    supabase
      .from('coach_checkins')
      .select('schedule_slot_id')
      .eq('coach_id', coachId)
      .in('schedule_slot_id', slotIds) as unknown as Promise<{ data: CoachCheckinRow[] | null }>,
    supabase
      .from('attendance')
      .select('booking_session_id, student_id')
      .in('booking_session_id', sessionIds) as unknown as Promise<{ data: AttendanceRow[] | null }>,
  ])

  const checkedInSlotIds = new Set((checkins || []).map((checkin) => checkin.schedule_slot_id))
  const attendanceKeys = new Set((attendanceRows || []).map(getAttendanceKey))
  const groupsBySlot = new Map<string, AssignmentGroupForGapRow[]>()

  groupRows.forEach((group) => {
    const rows = groupsBySlot.get(group.schedule_slot_id) || []
    rows.push(group)
    groupsBySlot.set(group.schedule_slot_id, rows)
  })

  await Promise.all(Array.from(groupsBySlot.entries()).map(async ([slotId, slotGroups]) => {
    const slot = slotGroups[0]?.schedule_slots
    if (!slot || !checkedInSlotIds.has(slotId) || !isSlotEnded(slot, now)) return

    const slotStudents = slotGroups.flatMap((group) => group.coach_assignment_group_students || [])
    const missingCount = slotStudents.filter((student) => !attendanceKeys.has(getAttendanceKey(student))).length
    if (missingCount === 0) return

    await notifyCoachOnce(supabase, {
      userId: coachId,
      title: 'ยังเช็คชื่อนักเรียนไม่ครบ',
      message: `รอบ ${getSlotLabel(slot)} ยังขาดการเช็คชื่อ ${missingCount} คน กรุณาเช็คชื่อให้ครบเพื่อไม่ให้หลักฐานชั่วโมงสอนตกหล่น`,
      type: 'reminder',
      linkUrl: `/coach/attendance?date=${slot.date}&slot=${slot.id}`,
    })
  }))
}
