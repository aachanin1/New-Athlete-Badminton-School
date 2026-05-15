import type { CoachEmploymentType } from '@/types/database'

const BOOKING_PAYABLE_STATUSES = ['paid', 'verified']
const SESSION_ATTENDANCE_STATUSES = ['scheduled', 'completed', 'absent']

type SupabaseQuery = PromiseLike<unknown> & {
  eq: (column: string, value: unknown) => SupabaseQuery
  gte: (column: string, value: unknown) => SupabaseQuery
  lt: (column: string, value: unknown) => SupabaseQuery
  in: (column: string, values: readonly unknown[]) => SupabaseQuery
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQuery
  limit: (count: number) => SupabaseQuery
}

type SupabaseTable = {
  select: (columns: string) => SupabaseQuery
}

type SupabaseLike = {
  from: (table: string) => SupabaseTable
}

interface SlotRow {
  id: string
  branch_id: string
  date: string
  start_time: string
  end_time: string
  branches?: { name: string | null } | null
  course_types?: { name: string | null } | null
}

interface GroupStudentRow {
  booking_session_id: string
}

interface AssignmentGroupRow {
  id: string
  coach_id: string | null
  schedule_slot_id: string
  schedule_slots?: SlotRow | null
  coach_assignment_group_students?: GroupStudentRow[] | null
  profiles?: {
    full_name: string | null
    coach_employment_type: string | null
  } | null
}

interface LegacyAssignmentRow {
  id: string
  coach_id: string
  schedule_slot_id: string
  schedule_slots?: SlotRow | null
  profiles?: {
    full_name: string | null
    coach_employment_type: string | null
  } | null
}

interface BookingSessionRow {
  id: string
  schedule_slot_id: string
}

interface AttendanceRow {
  booking_session_id: string
}

interface CheckinRow {
  id: string
  coach_id: string
  schedule_slot_id: string
  checkin_time: string
  photo_url: string | null
  location_lat: number | string | null
  location_lng: number | string | null
}

interface CoachProfileMeta {
  coachName: string
  employmentType: CoachEmploymentType | null
}

export interface CoachTeachingHourSourceRow {
  assignment_id: string
  assignment_source: 'group' | 'legacy'
  coach_id: string
  coach_name: string
  employment_type: CoachEmploymentType | null
  schedule_slot_id: string
  branch_name: string
  course_type: string
  date: string
  start_time: string
  end_time: string
  checkin_id: string | null
  checkin_time: string | null
  photo_url: string | null
  location_lat: number | null
  location_lng: number | null
  student_count: number
  attendance_count: number
  has_checkin: boolean
  has_photo: boolean
  has_location: boolean
  has_attendance: boolean
  is_verified: boolean
}

export interface TeachingHoursRangeOptions {
  startDate: string
  endDateExclusive: string
  coachId?: string
}

function normalizeEmploymentType(value: unknown): CoachEmploymentType | null {
  return value === 'full_time' || value === 'half_time' || value === 'part_time' ? value : null
}

function toNumberOrNull(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function getProfileMeta(profile: AssignmentGroupRow['profiles'] | LegacyAssignmentRow['profiles']): CoachProfileMeta {
  return {
    coachName: profile?.full_name || 'ไม่ทราบชื่อ',
    employmentType: normalizeEmploymentType(profile?.coach_employment_type),
  }
}

function getSlotKey(coachId: string, slotId: string) {
  return `${coachId}:${slotId}`
}

async function getAssignmentGroups(supabase: SupabaseLike, options: TeachingHoursRangeOptions) {
  let query = supabase
    .from('coach_assignment_groups')
    .select(`
      id, coach_id, schedule_slot_id,
      profiles!coach_assignment_groups_coach_id_fkey(full_name, coach_employment_type),
      schedule_slots!inner(id, branch_id, date, start_time, end_time,
        branches(name),
        course_types(name)
      ),
      coach_assignment_group_students(booking_session_id)
    `)
    .gte('schedule_slots.date', options.startDate)
    .lt('schedule_slots.date', options.endDateExclusive)
    .order('schedule_slot_id')
    .limit(5000)

  if (options.coachId) query = query.eq('coach_id', options.coachId)

  const { data } = await query as unknown as { data: AssignmentGroupRow[] | null }
  return (data || []).filter((group) => group.coach_id && group.schedule_slots)
}

async function getLegacyAssignments(supabase: SupabaseLike, options: TeachingHoursRangeOptions) {
  let query = supabase
    .from('coach_assignments')
    .select(`
      id, coach_id, schedule_slot_id,
      profiles!coach_assignments_coach_id_fkey(full_name, coach_employment_type),
      schedule_slots!inner(id, branch_id, date, start_time, end_time,
        branches(name),
        course_types(name)
      )
    `)
    .gte('schedule_slots.date', options.startDate)
    .lt('schedule_slots.date', options.endDateExclusive)
    .order('schedule_slot_id')
    .limit(5000)

  if (options.coachId) query = query.eq('coach_id', options.coachId)

  const { data } = await query as unknown as { data: LegacyAssignmentRow[] | null }
  return (data || []).filter((assignment) => assignment.schedule_slots)
}

async function getPayableSessionsBySlot(supabase: SupabaseLike, slotIds: string[]) {
  const map = new Map<string, BookingSessionRow[]>()
  if (slotIds.length === 0) return map

  const { data } = await supabase
    .from('booking_sessions')
    .select('id, schedule_slot_id, bookings!inner(status)')
    .in('schedule_slot_id', slotIds)
    .in('status', SESSION_ATTENDANCE_STATUSES)
    .in('bookings.status', BOOKING_PAYABLE_STATUSES)
    .limit(10000) as unknown as { data: BookingSessionRow[] | null }

  ;(data || []).forEach((session) => {
    const rows = map.get(session.schedule_slot_id) || []
    rows.push(session)
    map.set(session.schedule_slot_id, rows)
  })

  return map
}

async function getAttendanceCounts(supabase: SupabaseLike, sessionIds: string[]) {
  const map = new Map<string, number>()
  if (sessionIds.length === 0) return map

  const { data } = await supabase
    .from('attendance')
    .select('booking_session_id')
    .in('booking_session_id', sessionIds)
    .limit(10000) as unknown as { data: AttendanceRow[] | null }

  ;(data || []).forEach((attendance) => {
    map.set(attendance.booking_session_id, (map.get(attendance.booking_session_id) || 0) + 1)
  })

  return map
}

async function getCheckins(supabase: SupabaseLike, coachIds: string[], slotIds: string[]) {
  const map = new Map<string, CheckinRow>()
  if (coachIds.length === 0 || slotIds.length === 0) return map

  const { data } = await supabase
    .from('coach_checkins')
    .select('id, coach_id, schedule_slot_id, checkin_time, photo_url, location_lat, location_lng')
    .in('coach_id', coachIds)
    .in('schedule_slot_id', slotIds)
    .order('checkin_time', { ascending: false })
    .limit(10000) as unknown as { data: CheckinRow[] | null }

  ;(data || []).forEach((checkin) => {
    const key = getSlotKey(checkin.coach_id, checkin.schedule_slot_id)
    if (!map.has(key)) map.set(key, checkin)
  })

  return map
}

function createSourceRow(params: {
  assignmentId: string
  assignmentSource: 'group' | 'legacy'
  coachId: string
  profile: AssignmentGroupRow['profiles'] | LegacyAssignmentRow['profiles']
  slot: SlotRow
  checkin: CheckinRow | null
  studentCount: number
  attendanceCount: number
}): CoachTeachingHourSourceRow {
  const profile = getProfileMeta(params.profile)
  const lat = toNumberOrNull(params.checkin?.location_lat)
  const lng = toNumberOrNull(params.checkin?.location_lng)
  const hasStudents = params.studentCount > 0
  const hasCheckin = Boolean(params.checkin?.id)
  const hasPhoto = Boolean(params.checkin?.photo_url)
  const hasLocation = lat !== null && lng !== null
  const hasAttendance = params.attendanceCount > 0

  return {
    assignment_id: params.assignmentId,
    assignment_source: params.assignmentSource,
    coach_id: params.coachId,
    coach_name: profile.coachName,
    employment_type: profile.employmentType,
    schedule_slot_id: params.slot.id,
    branch_name: params.slot.branches?.name || 'ไม่ทราบสาขา',
    course_type: params.slot.course_types?.name || '',
    date: params.slot.date,
    start_time: params.slot.start_time,
    end_time: params.slot.end_time,
    checkin_id: params.checkin?.id || null,
    checkin_time: params.checkin?.checkin_time || null,
    photo_url: params.checkin?.photo_url || null,
    location_lat: lat,
    location_lng: lng,
    student_count: params.studentCount,
    attendance_count: params.attendanceCount,
    has_checkin: hasCheckin,
    has_photo: hasPhoto,
    has_location: hasLocation,
    has_attendance: hasAttendance,
    is_verified: hasStudents && hasCheckin && hasPhoto && hasLocation && hasAttendance,
  }
}

export async function getCoachTeachingHourSourceRows(
  supabaseClient: unknown,
  options: TeachingHoursRangeOptions,
): Promise<CoachTeachingHourSourceRow[]> {
  const supabase = supabaseClient as SupabaseLike
  const [groups, legacyAssignments] = await Promise.all([
    getAssignmentGroups(supabase, options),
    getLegacyAssignments(supabase, options),
  ])

  const groupedSlotIds = new Set(groups.map((group) => group.schedule_slot_id))
  const legacyRows = legacyAssignments.filter((assignment) => !groupedSlotIds.has(assignment.schedule_slot_id))
  const slotIds = Array.from(new Set([
    ...groups.map((group) => group.schedule_slot_id),
    ...legacyRows.map((assignment) => assignment.schedule_slot_id),
  ]))
  const coachIds = Array.from(new Set([
    ...groups.map((group) => group.coach_id).filter((coachId): coachId is string => Boolean(coachId)),
    ...legacyRows.map((assignment) => assignment.coach_id),
  ]))

  const [sessionsBySlot, checkinMap] = await Promise.all([
    getPayableSessionsBySlot(supabase, slotIds),
    getCheckins(supabase, coachIds, slotIds),
  ])

  const groupedSessionIds = groups.flatMap((group) => (group.coach_assignment_group_students || []).map((student) => student.booking_session_id))
  const legacySessionIds = slotIds.flatMap((slotId) => (sessionsBySlot.get(slotId) || []).map((session) => session.id))
  const attendanceCounts = await getAttendanceCounts(supabase, Array.from(new Set([...groupedSessionIds, ...legacySessionIds])))

  const rows: CoachTeachingHourSourceRow[] = []
  const emitted = new Set<string>()

  groups.forEach((group) => {
    if (!group.coach_id || !group.schedule_slots) return
    const groupSessionIds = (group.coach_assignment_group_students || []).map((student) => student.booking_session_id)
    const attendanceCount = groupSessionIds.reduce((sum, sessionId) => sum + (attendanceCounts.get(sessionId) || 0), 0)
    const key = getSlotKey(group.coach_id, group.schedule_slot_id)
    if (emitted.has(key)) return
    emitted.add(key)

    rows.push(createSourceRow({
      assignmentId: group.id,
      assignmentSource: 'group',
      coachId: group.coach_id,
      profile: group.profiles,
      slot: group.schedule_slots,
      checkin: checkinMap.get(key) || null,
      studentCount: groupSessionIds.length,
      attendanceCount,
    }))
  })

  legacyRows.forEach((assignment) => {
    if (!assignment.schedule_slots) return
    const sessions = sessionsBySlot.get(assignment.schedule_slot_id) || []
    const attendanceCount = sessions.reduce((sum, session) => sum + (attendanceCounts.get(session.id) || 0), 0)
    const key = getSlotKey(assignment.coach_id, assignment.schedule_slot_id)
    if (emitted.has(key)) return
    emitted.add(key)

    rows.push(createSourceRow({
      assignmentId: assignment.id,
      assignmentSource: 'legacy',
      coachId: assignment.coach_id,
      profile: assignment.profiles,
      slot: assignment.schedule_slots,
      checkin: checkinMap.get(key) || null,
      studentCount: sessions.length,
      attendanceCount,
    }))
  })

  return rows.sort((a, b) => `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`))
}
