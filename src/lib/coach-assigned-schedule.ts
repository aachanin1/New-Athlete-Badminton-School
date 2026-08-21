import type { AttendanceStatus, SessionStatus, StudentType } from '@/types/database'
import {
  createCoachCheckinSignedUrlMap,
  getResolvedCoachCheckinPhotoUrl,
} from '@/lib/coach-checkin-photos'
import {
  buildLatestAttendanceRowBySessionStudentKey,
  getAttendanceSessionStudentKey,
} from '@/lib/session-attendance-status'
import {
  getGenuineLegacyOnlySlotIds,
  getLegacyEligibleSessions,
  loadWalletRedeemedSessionIds,
  requireCoachAssignmentQueryData,
} from '@/lib/coach-assignment-resolution'

type SupabaseQuery = PromiseLike<unknown> & {
  eq: (column: string, value: unknown) => SupabaseQuery
  in: (column: string, values: readonly unknown[]) => SupabaseQuery
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQuery
}

type SupabaseTable = {
  select: (columns: string) => SupabaseQuery
}

type SupabaseLike = {
  from: (table: string) => SupabaseTable
}

const BOOKING_VISIBLE_STATUSES = ['verified']
const SESSION_VISIBLE_STATUSES: SessionStatus[] = ['scheduled', 'completed', 'absent']

interface SlotRow {
  id: string
  branch_id: string
  date: string
  start_time: string
  end_time: string
  branches?: { name: string | null } | null
  course_types?: { name: string | null } | null
}

interface AssignmentRow {
  schedule_slot_id: string
  schedule_slots?: SlotRow | null
}

interface AssignmentGroupStudentRow {
  booking_session_id: string
}

interface AssignmentGroupRow {
  id: string
  name: string
  schedule_slot_id: string
  coach_id: string | null
  schedule_slots?: SlotRow | null
  coach_assignment_group_students?: AssignmentGroupStudentRow[] | null
}

interface BookingSessionRow {
  id: string
  booking_id: string
  date: string
  start_time: string
  end_time: string
  branch_id: string
  child_id: string | null
  schedule_slot_id: string
  status: SessionStatus
  rescheduled_from_id: string | null
  is_makeup: boolean | null
  bookings?: {
    user_id: string
    learner_type: 'self' | 'child'
    status: string
    profiles?: {
      full_name: string | null
      phone?: string | null
    } | null
  } | null
  children?: {
    id: string
    full_name: string
    nickname: string | null
  } | null
}

interface CheckinRow {
  id: string
  schedule_slot_id: string
  branch_id: string
  checkin_time: string
  photo_url: string | null
}

interface AttendanceRow {
  booking_session_id: string
  student_id: string
  status: AttendanceStatus
  checked_at: string
}

interface SessionGroupMeta {
  groupId: string
  groupName: string
  coachId: string | null
}

export interface CoachAssignedStudentSession {
  bookingSessionId: string
  bookingId: string
  scheduleSlotId: string
  assignmentGroupId: string | null
  assignmentGroupName: string | null
  studentId: string
  studentType: StudentType
  studentName: string
  studentNickname: string | null
  parentName: string | null
  parentPhone: string | null
  isChild: boolean
  status: SessionStatus
  attendanceStatus: AttendanceStatus | null
}

export function formatCoachAssignedGroupLevelRange(levels: readonly number[]) {
  const assessedLevels = levels.filter((level) => Number.isInteger(level) && level > 0)
  const unassessedCount = levels.length - assessedLevels.length

  if (assessedLevels.length === 0) return 'เด็กในกลุ่ม: ยังไม่ประเมิน'

  const minimum = Math.min(...assessedLevels)
  const maximum = Math.max(...assessedLevels)
  const rangeLabel = minimum === maximum
    ? `เด็กในกลุ่ม LV ${minimum}`
    : `เด็กในกลุ่ม LV ${minimum}-${maximum}`

  return unassessedCount > 0
    ? `${rangeLabel} + ยังไม่ประเมิน ${unassessedCount} คน`
    : rangeLabel
}

export interface CoachAssignedSlot {
  id: string
  branchId: string
  branchName: string
  date: string
  startTime: string
  endTime: string
  courseType: string
  students: CoachAssignedStudentSession[]
  checkin: {
    id: string
    checkinTime: string
    photoUrl: string | null
  } | null
}

export interface CoachAssignedTeachingDay {
  date: string
  slots: CoachAssignedSlot[]
  totalStudents: number
  checkedSlotCount: number
}

function getDisplayChildName(child: BookingSessionRow['children']) {
  if (!child) return 'เด็ก'
  return child.nickname ? `${child.full_name} (${child.nickname})` : child.full_name
}

function getAdultName(session: BookingSessionRow) {
  return session.bookings?.profiles?.full_name || 'ผู้เรียนผู้ใหญ่'
}

function getStudentId(session: BookingSessionRow) {
  return session.child_id || session.bookings?.user_id || ''
}

function dedupeSlots(rows: (SlotRow | null | undefined)[]) {
  const map = new Map<string, SlotRow>()
  rows.forEach((slot) => {
    if (slot?.id) map.set(slot.id, slot)
  })
  return map
}

async function getCoachGroupsForDate(supabase: SupabaseLike, coachId: string, date: string) {
  const result = await supabase
    .from('coach_assignment_groups')
    .select(`
      id, name, schedule_slot_id, coach_id,
      schedule_slots!inner(id, branch_id, date, start_time, end_time,
        branches(name),
        course_types(name)
      ),
      coach_assignment_group_students(booking_session_id)
    `)
    .eq('coach_id', coachId)
    .eq('schedule_slots.date', date) as { data: AssignmentGroupRow[] | null; error?: { message: string } | null }

  return (requireCoachAssignmentQueryData(result, 'Coach schedule exact assignment query failed') || [])
    .filter((group) => (group.coach_assignment_group_students || []).length > 0)
}

async function getLegacyAssignedSlotsForDate(supabase: SupabaseLike, coachId: string, date: string) {
  const result = await supabase
    .from('coach_assignments')
    .select(`
      schedule_slot_id,
      schedule_slots!inner(id, branch_id, date, start_time, end_time,
        branches(name),
        course_types(name)
      )
    `)
    .eq('coach_id', coachId)
    .eq('schedule_slots.date', date) as { data: AssignmentRow[] | null; error?: { message: string } | null }

  return requireCoachAssignmentQueryData(result, 'Coach schedule Legacy assignment query failed') || []
}

async function getExactGroupsForSlots(supabase: SupabaseLike, slotIds: string[]) {
  if (slotIds.length === 0) return []

  const result = await supabase
    .from('coach_assignment_groups')
    .select('schedule_slot_id')
    .in('schedule_slot_id', slotIds) as { data: { schedule_slot_id: string }[] | null; error?: { message: string } | null }

  return requireCoachAssignmentQueryData(result, 'Coach schedule exact-model boundary query failed') || []
}

async function getSessionsForCoachDay(
  supabase: SupabaseLike,
  date: string,
  groupSessionIds: string[],
  fallbackSlotIds: string[],
) {
  const rows: BookingSessionRow[] = []

  if (groupSessionIds.length > 0) {
    const result = await supabase
      .from('booking_sessions')
      .select(`
        id, booking_id, date, start_time, end_time, branch_id, child_id, schedule_slot_id, status,
        rescheduled_from_id, is_makeup,
        bookings!inner(user_id, learner_type, status, profiles!bookings_user_id_fkey(full_name, phone)),
        children(id, full_name, nickname)
      `)
      .eq('date', date)
      .in('id', groupSessionIds)
      .in('status', SESSION_VISIBLE_STATUSES)
      .in('bookings.status', BOOKING_VISIBLE_STATUSES)
      .order('start_time') as { data: BookingSessionRow[] | null; error?: { message: string } | null }

    rows.push(...(requireCoachAssignmentQueryData(result, 'Coach schedule exact learner query failed') || []))
  }

  if (fallbackSlotIds.length > 0) {
    const result = await supabase
      .from('booking_sessions')
      .select(`
        id, booking_id, date, start_time, end_time, branch_id, child_id, schedule_slot_id, status,
        rescheduled_from_id, is_makeup,
        bookings!inner(user_id, learner_type, status, profiles!bookings_user_id_fkey(full_name, phone)),
        children(id, full_name, nickname)
      `)
      .eq('date', date)
      .in('schedule_slot_id', fallbackSlotIds)
      .in('status', SESSION_VISIBLE_STATUSES)
      .in('bookings.status', BOOKING_VISIBLE_STATUSES)
      .order('start_time') as { data: BookingSessionRow[] | null; error?: { message: string } | null }

    rows.push(...(requireCoachAssignmentQueryData(result, 'Coach schedule Legacy learner query failed') || []))
  }

  return Array.from(new Map(rows.map((row) => [row.id, row])).values())
}

export async function getCoachAssignedTeachingDay(
  supabaseClient: unknown,
  coachId: string,
  date: string,
): Promise<CoachAssignedTeachingDay> {
  const supabase = supabaseClient as SupabaseLike

  const [coachGroups, legacyAssignments] = await Promise.all([
    getCoachGroupsForDate(supabase, coachId, date),
    getLegacyAssignedSlotsForDate(supabase, coachId, date),
  ])

  const groupSlotMap = dedupeSlots(coachGroups.map((group) => group.schedule_slots))
  const groupSessionMeta = new Map<string, SessionGroupMeta>()
  coachGroups.forEach((group) => {
    ;(group.coach_assignment_group_students || []).forEach((student) => {
      groupSessionMeta.set(student.booking_session_id, {
        groupId: group.id,
        groupName: group.name,
        coachId: group.coach_id,
      })
    })
  })

  const legacySlotMap = dedupeSlots(legacyAssignments.map((assignment) => assignment.schedule_slots))
  const legacySlotIds = Array.from(legacySlotMap.keys())
  const exactGroupsForLegacySlots = await getExactGroupsForSlots(supabase, legacySlotIds)
  const fallbackSlotIds = getGenuineLegacyOnlySlotIds(legacySlotIds, exactGroupsForLegacySlots)

  const uniqueSlots = new Map<string, SlotRow>()
  groupSlotMap.forEach((slot, slotId) => uniqueSlots.set(slotId, slot))
  fallbackSlotIds.forEach((slotId) => {
    const slot = legacySlotMap.get(slotId)
    if (slot) uniqueSlots.set(slotId, slot)
  })

  const slotIds = Array.from(uniqueSlots.keys())
  const groupSessionIds = Array.from(groupSessionMeta.keys())
  const loadedSessions = await getSessionsForCoachDay(supabase, date, groupSessionIds, fallbackSlotIds)
  const legacyCandidateSessions = loadedSessions.filter((session) => !groupSessionMeta.has(session.id))
  const walletRedeemedSessionIds = await loadWalletRedeemedSessionIds(
    supabase,
    legacyCandidateSessions,
    'Coach schedule',
  )
  const eligibleLegacySessionIds = new Set(
    getLegacyEligibleSessions(legacyCandidateSessions, walletRedeemedSessionIds)
      .map((session) => session.id),
  )
  const sessions = loadedSessions.filter((session) => (
    groupSessionMeta.has(session.id) || eligibleLegacySessionIds.has(session.id)
  ))

  const sessionIds = sessions.map((session) => session.id)
  let attendanceRows: AttendanceRow[] = []
  if (sessionIds.length > 0) {
    const result = await supabase
      .from('attendance')
      .select('booking_session_id, student_id, status, checked_at')
      .in('booking_session_id', sessionIds)
      .order('checked_at', { ascending: true }) as { data: AttendanceRow[] | null; error?: { message: string } | null }

    attendanceRows = requireCoachAssignmentQueryData(result, 'Coach schedule attendance query failed') || []
  }

  let checkins: CheckinRow[] = []
  if (slotIds.length > 0) {
    const result = await supabase
      .from('coach_checkins')
      .select('id, schedule_slot_id, branch_id, checkin_time, photo_url')
      .eq('coach_id', coachId)
      .in('schedule_slot_id', slotIds)
      .order('checkin_time', { ascending: false }) as { data: CheckinRow[] | null; error?: { message: string } | null }

    checkins = requireCoachAssignmentQueryData(result, 'Coach schedule check-in query failed') || []
  }

  const sessionsBySlot = new Map<string, BookingSessionRow[]>()
  sessions.forEach((session) => {
    const rows = sessionsBySlot.get(session.schedule_slot_id) || []
    rows.push(session)
    sessionsBySlot.set(session.schedule_slot_id, rows)
  })

  const attendanceMap = buildLatestAttendanceRowBySessionStudentKey(attendanceRows)

  const checkinMap = new Map<string, CheckinRow>()
  const signedPhotoUrlMap = await createCoachCheckinSignedUrlMap(checkins.map((checkin) => checkin.photo_url))
  checkins.forEach((checkin) => {
    if (!checkinMap.has(checkin.schedule_slot_id)) checkinMap.set(checkin.schedule_slot_id, checkin)
  })

  const slots = Array.from(uniqueSlots.values())
    .sort((a, b) => `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`))
    .map((slot): CoachAssignedSlot => {
      const slotSessions = sessionsBySlot.get(slot.id) || []
      const checkin = checkinMap.get(slot.id) || null

      return {
        id: slot.id,
        branchId: slot.branch_id,
        branchName: slot.branches?.name || '',
        date: slot.date,
        startTime: slot.start_time,
        endTime: slot.end_time,
        courseType: slot.course_types?.name || '',
        students: slotSessions.map((session) => {
          const isChild = Boolean(session.child_id)
          const studentId = getStudentId(session)
          const groupMeta = groupSessionMeta.get(session.id) || null

          return {
            bookingSessionId: session.id,
            bookingId: session.booking_id,
            scheduleSlotId: session.schedule_slot_id,
            assignmentGroupId: groupMeta?.groupId || null,
            assignmentGroupName: groupMeta?.groupName || null,
            studentId,
            studentType: isChild ? 'child' : 'adult',
            studentName: isChild ? getDisplayChildName(session.children) : getAdultName(session),
            studentNickname: isChild ? session.children?.nickname?.trim() || null : null,
            parentName: isChild ? session.bookings?.profiles?.full_name || null : null,
            parentPhone: session.bookings?.profiles?.phone || null,
            isChild,
            status: session.status,
            attendanceStatus: studentId
              ? attendanceMap.get(getAttendanceSessionStudentKey(session.id, studentId))?.status || null
              : null,
          }
        }),
        checkin: checkin
          ? {
              id: checkin.id,
              checkinTime: checkin.checkin_time,
              photoUrl: getResolvedCoachCheckinPhotoUrl(checkin.photo_url, signedPhotoUrlMap),
            }
          : null,
      }
    })
    .filter((slot) => slot.students.length > 0)

  return {
    date,
    slots,
    totalStudents: slots.reduce((sum, slot) => sum + slot.students.length, 0),
    checkedSlotCount: slots.filter((slot) => slot.checkin).length,
  }
}
