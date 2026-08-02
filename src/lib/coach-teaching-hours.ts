import type { CoachEmploymentType } from '@/types/database'
import { getGenuineLegacyOnlySlotIds, getLegacyEligibleSessions } from '@/lib/coach-assignment-resolution'

const BOOKING_PAYABLE_STATUSES = ['verified']
const SESSION_ATTENDANCE_STATUSES = ['scheduled', 'completed', 'absent']
const PAYROLL_IN_FILTER_CHUNK_SIZE = 150
const PAYROLL_PAGE_SIZE = 1000
const PAYROLL_QUERY_CONCURRENCY = 6
const MAX_SOURCE_RANGE_DAYS = 62

type SupabaseQuery = PromiseLike<unknown> & {
  eq: (column: string, value: unknown) => SupabaseQuery
  gte: (column: string, value: unknown) => SupabaseQuery
  lt: (column: string, value: unknown) => SupabaseQuery
  in: (column: string, values: readonly unknown[]) => SupabaseQuery
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQuery
  range: (from: number, to: number) => SupabaseQuery
}

type SupabaseTable = {
  select: (columns: string, options?: { count?: 'exact' }) => SupabaseQuery
}

type SupabaseLike = {
  from: (table: string) => SupabaseTable
}

interface SupabaseResult<T> {
  data: T | null
  error: { message: string } | null
  count?: number | null
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
  sort_order: number
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
  rescheduled_from_id: string | null
  is_makeup: boolean | null
}

interface BookingSessionIdRow {
  id: string
}

interface WalletRedemptionRow {
  id: string
  redeemed_session_id: string | null
}

interface AttendanceRow {
  id: string
  booking_session_id: string
  status: 'present' | 'late' | 'absent' | string | null
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

interface AttendanceStats {
  total: number
  present: number
  late: number
  absent: number
}

export type CoachTeachingHourClassification = 'counted' | 'review' | 'excluded'

export type CoachTeachingHourReason =
  | 'evidence_complete'
  | 'missing_checkin'
  | 'missing_photo'
  | 'missing_location'
  | 'missing_attendance'
  | 'no_eligible_learner'
  | 'duplicate_assignment_data'

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
  present_count: number
  late_count: number
  absent_count: number
  has_checkin: boolean
  has_photo: boolean
  has_location: boolean
  has_attendance: boolean
  is_verified: boolean
  classification: CoachTeachingHourClassification
  classification_reason: CoachTeachingHourReason
  evidence_reasons: CoachTeachingHourReason[]
}

export interface TeachingHoursRangeOptions {
  startDate: string
  endDateExclusive: string
  coachId?: string
  includeExcluded?: boolean
}

export interface CoachTeachingHourReadMetrics {
  operation: 'coach_teaching_hours_source'
  durationMs: number
  externalCalls: number
  rowsBySource: Record<string, number>
  callsBySource: Record<string, number>
  phasesMs: Record<string, number>
}

export interface CoachTeachingHourSourceRead {
  rows: CoachTeachingHourSourceRow[]
  metrics: CoachTeachingHourReadMetrics
}

interface MutableReadMetrics {
  startedAt: number
  externalCalls: number
  rowsBySource: Record<string, number>
  callsBySource: Record<string, number>
  phasesMs: Record<string, number>
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

function uniqueTruthyIds(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean)))
}

function createMetrics(): MutableReadMetrics {
  return {
    startedAt: performance.now(),
    externalCalls: 0,
    rowsBySource: {},
    callsBySource: {},
    phasesMs: {},
  }
}

function finishMetrics(metrics: MutableReadMetrics): CoachTeachingHourReadMetrics {
  return {
    operation: 'coach_teaching_hours_source',
    durationMs: Math.round((performance.now() - metrics.startedAt) * 10) / 10,
    externalCalls: metrics.externalCalls,
    rowsBySource: metrics.rowsBySource,
    callsBySource: metrics.callsBySource,
    phasesMs: metrics.phasesMs,
  }
}

async function measurePhase<T>(metrics: MutableReadMetrics, phase: string, run: () => Promise<T>) {
  const startedAt = performance.now()
  try {
    return await run()
  } finally {
    metrics.phasesMs[phase] = Math.round((performance.now() - startedAt) * 10) / 10
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length)
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

async function runPayrollQuery<T>(
  query: SupabaseQuery,
  label: string,
  source: string,
  metrics: MutableReadMetrics,
) {
  const { data, error, count } = await query as unknown as SupabaseResult<T>
  metrics.externalCalls += 1
  metrics.callsBySource[source] = (metrics.callsBySource[source] || 0) + 1
  metrics.rowsBySource[source] = (metrics.rowsBySource[source] || 0) + (Array.isArray(data) ? data.length : data ? 1 : 0)

  if (error) {
    throw new Error(`Coach teaching hours ${label} query failed: ${error.message}`)
  }

  return { data, count }
}

async function runPayrollPagedQuery<T>(params: {
  label: string
  source: string
  metrics: MutableReadMetrics
  buildQuery: (from: number, to: number) => SupabaseQuery
  identity: (row: T) => string
}) {
  const rows: T[] = []
  const identities = new Set<string>()
  let expectedCount: number | null = null

  for (let from = 0; ; from += PAYROLL_PAGE_SIZE) {
    const pageNumber = Math.floor(from / PAYROLL_PAGE_SIZE) + 1
    const result = await runPayrollQuery<T[]>(
      params.buildQuery(from, from + PAYROLL_PAGE_SIZE - 1),
      `${params.label} page ${pageNumber}`,
      params.source,
      params.metrics,
    )
    const page = result.data || []

    if (result.count === null || result.count === undefined) {
      throw new Error(`Coach teaching hours ${params.label} pagination incomplete: exact count unavailable`)
    }
    if (expectedCount === null) expectedCount = result.count
    if (result.count !== expectedCount) {
      throw new Error(`Coach teaching hours ${params.label} pagination changed while reading`)
    }
    if (page.length > PAYROLL_PAGE_SIZE) {
      throw new Error(`Coach teaching hours ${params.label} pagination returned an oversized page`)
    }

    page.forEach((row) => {
      const identity = params.identity(row)
      if (identities.has(identity)) {
        throw new Error(`Coach teaching hours ${params.label} pagination returned duplicate row ${identity}`)
      }
      identities.add(identity)
      rows.push(row)
    })

    if (rows.length === expectedCount) break
    if (page.length === 0 || rows.length > expectedCount) {
      throw new Error(`Coach teaching hours ${params.label} pagination incomplete: fetched ${rows.length} of ${expectedCount}`)
    }
  }

  if (rows.length !== expectedCount) {
    throw new Error(`Coach teaching hours ${params.label} pagination incomplete: fetched ${rows.length} of ${expectedCount}`)
  }
  return rows
}

async function runPayrollPagedInChunks<T>(params: {
  ids: string[]
  label: string
  source: string
  metrics: MutableReadMetrics
  buildQuery: (chunkIds: string[], from: number, to: number) => SupabaseQuery
  identity: (row: T) => string
}) {
  const uniqueIds = uniqueTruthyIds(params.ids)
  if (uniqueIds.length === 0) return []

  const chunks = Array.from(
    { length: Math.ceil(uniqueIds.length / PAYROLL_IN_FILTER_CHUNK_SIZE) },
    (_, index) => uniqueIds.slice(
      index * PAYROLL_IN_FILTER_CHUNK_SIZE,
      (index + 1) * PAYROLL_IN_FILTER_CHUNK_SIZE,
    ),
  )
  const chunkRows = await mapWithConcurrency(chunks, PAYROLL_QUERY_CONCURRENCY, (chunkIds, index) => (
    runPayrollPagedQuery<T>({
      label: `${params.label} chunk ${index + 1}/${chunks.length}`,
      source: params.source,
      metrics: params.metrics,
      buildQuery: (from, to) => params.buildQuery(chunkIds, from, to),
      identity: params.identity,
    })
  ))
  return chunkRows.flat()
}

function parseInputDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date
}

function assertBoundedRange(options: TeachingHoursRangeOptions) {
  const start = parseInputDate(options.startDate)
  const end = parseInputDate(options.endDateExclusive)
  if (!start || !end || end <= start) {
    throw new Error('Coach teaching hours requires a valid bounded date range')
  }
  const days = (end.getTime() - start.getTime()) / 86_400_000
  if (days > MAX_SOURCE_RANGE_DAYS) {
    throw new Error(`Coach teaching hours range exceeds ${MAX_SOURCE_RANGE_DAYS} days`)
  }
}

async function getAssignmentGroups(
  supabase: SupabaseLike,
  options: TeachingHoursRangeOptions,
  metrics: MutableReadMetrics,
) {
  return runPayrollPagedQuery<AssignmentGroupRow>({
    label: 'assignment groups',
    source: 'coach_assignment_groups',
    metrics,
    identity: (row) => row.id,
    buildQuery: (from, to) => supabase
      .from('coach_assignment_groups')
      .select(`
        id, coach_id, schedule_slot_id, sort_order,
        profiles!coach_assignment_groups_coach_id_fkey(full_name, coach_employment_type),
        schedule_slots!inner(id, branch_id, date, start_time, end_time,
          branches(name),
          course_types(name)
        ),
        coach_assignment_group_students(booking_session_id)
      `, { count: 'exact' })
      .gte('schedule_slots.date', options.startDate)
      .lt('schedule_slots.date', options.endDateExclusive)
      .order('schedule_slots(date)')
      .order('schedule_slots(start_time)')
      .order('schedule_slot_id')
      .order('sort_order')
      .order('id')
      .range(from, to),
  })
}

async function getLegacyAssignments(
  supabase: SupabaseLike,
  options: TeachingHoursRangeOptions,
  metrics: MutableReadMetrics,
) {
  return runPayrollPagedQuery<LegacyAssignmentRow>({
    label: 'legacy assignments',
    source: 'coach_assignments',
    metrics,
    identity: (row) => row.id,
    buildQuery: (from, to) => {
      let query = supabase
        .from('coach_assignments')
        .select(`
          id, coach_id, schedule_slot_id,
          profiles!coach_assignments_coach_id_fkey(full_name, coach_employment_type),
          schedule_slots!inner(id, branch_id, date, start_time, end_time,
            branches(name),
            course_types(name)
          )
        `, { count: 'exact' })
        .gte('schedule_slots.date', options.startDate)
        .lt('schedule_slots.date', options.endDateExclusive)
        .order('schedule_slots(date)')
        .order('schedule_slots(start_time)')
        .order('schedule_slot_id')
        .order('id')
      if (options.coachId) query = query.eq('coach_id', options.coachId)
      return query.range(from, to)
    },
  })
}

async function getPayableSessionsBySlot(supabase: SupabaseLike, slotIds: string[], metrics: MutableReadMetrics) {
  const map = new Map<string, BookingSessionRow[]>()
  const data = await runPayrollPagedInChunks<BookingSessionRow>({
    ids: slotIds,
    label: 'payable sessions by slot',
    source: 'booking_sessions_by_slot',
    metrics,
    identity: (row) => row.id,
    buildQuery: (chunkSlotIds, from, to) => supabase
      .from('booking_sessions')
      .select('id, schedule_slot_id, rescheduled_from_id, is_makeup, bookings!inner(status)', { count: 'exact' })
      .in('schedule_slot_id', chunkSlotIds)
      .in('status', SESSION_ATTENDANCE_STATUSES)
      .in('bookings.status', BOOKING_PAYABLE_STATUSES)
      .order('id')
      .range(from, to),
  })
  data.forEach((session) => {
    const rows = map.get(session.schedule_slot_id) || []
    rows.push(session)
    map.set(session.schedule_slot_id, rows)
  })
  return map
}

async function getPayableSessionIds(supabase: SupabaseLike, sessionIds: string[], metrics: MutableReadMetrics) {
  const data = await runPayrollPagedInChunks<BookingSessionIdRow>({
    ids: sessionIds,
    label: 'payable grouped session ids',
    source: 'booking_sessions_by_id',
    metrics,
    identity: (row) => row.id,
    buildQuery: (chunkSessionIds, from, to) => supabase
      .from('booking_sessions')
      .select('id, bookings!inner(status)', { count: 'exact' })
      .in('id', chunkSessionIds)
      .in('status', SESSION_ATTENDANCE_STATUSES)
      .in('bookings.status', BOOKING_PAYABLE_STATUSES)
      .order('id')
      .range(from, to),
  })
  return new Set(data.map((session) => session.id))
}

async function getWalletRedeemedSessionIds(
  supabase: SupabaseLike,
  sessions: BookingSessionRow[],
  metrics: MutableReadMetrics,
) {
  const candidateIds = sessions
    .filter((session) => Boolean(session.rescheduled_from_id) && !session.is_makeup)
    .map((session) => session.id)
  const data = await runPayrollPagedInChunks<WalletRedemptionRow>({
    ids: candidateIds,
    label: 'wallet provenance',
    source: 'lesson_wallet_credits',
    metrics,
    identity: (row) => row.id,
    buildQuery: (chunkSessionIds, from, to) => supabase
      .from('lesson_wallet_credits')
      .select('id, redeemed_session_id', { count: 'exact' })
      .in('redeemed_session_id', chunkSessionIds)
      .order('id')
      .range(from, to),
  })
  return new Set(data.map((row) => row.redeemed_session_id).filter((id): id is string => Boolean(id)))
}

async function getAttendanceCounts(supabase: SupabaseLike, sessionIds: string[], metrics: MutableReadMetrics) {
  const map = new Map<string, AttendanceStats>()
  const data = await runPayrollPagedInChunks<AttendanceRow>({
    ids: sessionIds,
    label: 'attendance counts',
    source: 'attendance',
    metrics,
    identity: (row) => row.id,
    buildQuery: (chunkSessionIds, from, to) => supabase
      .from('attendance')
      .select('id, booking_session_id, status', { count: 'exact' })
      .in('booking_session_id', chunkSessionIds)
      .order('id')
      .range(from, to),
  })
  data.forEach((attendance) => {
    const stats = map.get(attendance.booking_session_id) || { total: 0, present: 0, late: 0, absent: 0 }
    stats.total += 1
    if (attendance.status === 'present') stats.present += 1
    if (attendance.status === 'late') stats.late += 1
    if (attendance.status === 'absent') stats.absent += 1
    map.set(attendance.booking_session_id, stats)
  })
  return map
}

async function getCheckins(
  supabase: SupabaseLike,
  assignmentKeys: Set<string>,
  slotIds: string[],
  metrics: MutableReadMetrics,
) {
  const map = new Map<string, CheckinRow>()
  const data = await runPayrollPagedInChunks<CheckinRow>({
    ids: slotIds,
    label: 'coach checkins',
    source: 'coach_checkins',
    metrics,
    identity: (row) => row.id,
    buildQuery: (chunkSlotIds, from, to) => supabase
      .from('coach_checkins')
      .select('id, coach_id, schedule_slot_id, checkin_time, photo_url, location_lat, location_lng', { count: 'exact' })
      .in('schedule_slot_id', chunkSlotIds)
      .order('schedule_slot_id')
      .order('coach_id')
      .order('checkin_time', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to),
  })
  data.forEach((checkin) => {
    const key = getSlotKey(checkin.coach_id, checkin.schedule_slot_id)
    if (assignmentKeys.has(key) && !map.has(key)) map.set(key, checkin)
  })
  return map
}

function getEvidenceReasons(params: {
  studentCount: number
  hasCheckin: boolean
  hasPhoto: boolean
  hasLocation: boolean
  hasAttendance: boolean
  duplicateAssignment: boolean
}) {
  const reasons: CoachTeachingHourReason[] = []
  if (params.studentCount === 0) {
    reasons.push('no_eligible_learner')
    if (params.duplicateAssignment) reasons.push('duplicate_assignment_data')
    return reasons
  }
  if (params.duplicateAssignment) reasons.push('duplicate_assignment_data')
  if (!params.hasCheckin) reasons.push('missing_checkin')
  if (params.hasCheckin && !params.hasPhoto) reasons.push('missing_photo')
  if (params.hasCheckin && params.hasPhoto && !params.hasLocation) reasons.push('missing_location')
  if (params.hasCheckin && params.hasPhoto && params.hasLocation && !params.hasAttendance) reasons.push('missing_attendance')
  if (reasons.length === 0) reasons.push('evidence_complete')
  return reasons
}

function createSourceRow(params: {
  assignmentId: string
  assignmentSource: 'group' | 'legacy'
  coachId: string
  profile: AssignmentGroupRow['profiles'] | LegacyAssignmentRow['profiles']
  slot: SlotRow
  checkin: CheckinRow | null
  studentCount: number
  attendanceStats: AttendanceStats
  duplicateAssignment: boolean
}): CoachTeachingHourSourceRow {
  const profile = getProfileMeta(params.profile)
  const lat = toNumberOrNull(params.checkin?.location_lat)
  const lng = toNumberOrNull(params.checkin?.location_lng)
  const hasCheckin = Boolean(params.checkin?.id)
  const hasPhoto = Boolean(params.checkin?.photo_url)
  const hasLocation = lat !== null && lng !== null
  const hasAttendance = params.attendanceStats.total > 0
  const evidenceReasons = getEvidenceReasons({
    studentCount: params.studentCount,
    hasCheckin,
    hasPhoto,
    hasLocation,
    hasAttendance,
    duplicateAssignment: params.duplicateAssignment,
  })
  const classification: CoachTeachingHourClassification = params.studentCount === 0
    ? 'excluded'
    : params.duplicateAssignment || evidenceReasons.length > 1 || evidenceReasons[0] !== 'evidence_complete'
      ? 'review'
      : 'counted'

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
    attendance_count: params.attendanceStats.total,
    present_count: params.attendanceStats.present,
    late_count: params.attendanceStats.late,
    absent_count: params.attendanceStats.absent,
    has_checkin: hasCheckin,
    has_photo: hasPhoto,
    has_location: hasLocation,
    has_attendance: hasAttendance,
    is_verified: classification === 'counted',
    classification,
    classification_reason: evidenceReasons[0],
    evidence_reasons: evidenceReasons,
  }
}

function sumAttendance(sessionIds: string[], attendanceCounts: Map<string, AttendanceStats>) {
  return sessionIds.reduce<AttendanceStats>((stats, sessionId) => {
    const sessionStats = attendanceCounts.get(sessionId)
    if (!sessionStats) return stats
    stats.total += sessionStats.total
    stats.present += sessionStats.present
    stats.late += sessionStats.late
    stats.absent += sessionStats.absent
    return stats
  }, { total: 0, present: 0, late: 0, absent: 0 })
}

export async function getCoachTeachingHourSourceRead(
  supabaseClient: unknown,
  options: TeachingHoursRangeOptions,
): Promise<CoachTeachingHourSourceRead> {
  assertBoundedRange(options)
  const supabase = supabaseClient as SupabaseLike
  const metrics = createMetrics()

  const [allGroups, allLegacyAssignments] = await measurePhase(metrics, 'assignments', () => Promise.all([
    getAssignmentGroups(supabase, options, metrics),
    getLegacyAssignments(supabase, options, metrics),
  ]))
  const groups = allGroups.filter((group) => (
    group.coach_id
    && group.schedule_slots
    && (!options.coachId || group.coach_id === options.coachId)
  ))
  const legacyAssignments = allLegacyAssignments.filter((assignment) => assignment.schedule_slots)
  const genuineLegacyOnlySlotIds = new Set(getGenuineLegacyOnlySlotIds(
    legacyAssignments.map((assignment) => assignment.schedule_slot_id),
    allGroups,
  ))
  const legacyRows = legacyAssignments.filter((assignment) => genuineLegacyOnlySlotIds.has(assignment.schedule_slot_id))
  const slotIds = uniqueTruthyIds([
    ...groups.map((group) => group.schedule_slot_id),
    ...legacyRows.map((assignment) => assignment.schedule_slot_id),
  ])

  const groupAggregates = new Map<string, AssignmentGroupRow[]>()
  groups.forEach((group) => {
    if (!group.coach_id) return
    const key = getSlotKey(group.coach_id, group.schedule_slot_id)
    const aggregate = groupAggregates.get(key) || []
    aggregate.push(group)
    groupAggregates.set(key, aggregate)
  })
  const legacyAggregates = new Map<string, LegacyAssignmentRow[]>()
  legacyRows.forEach((assignment) => {
    const key = getSlotKey(assignment.coach_id, assignment.schedule_slot_id)
    const aggregate = legacyAggregates.get(key) || []
    aggregate.push(assignment)
    legacyAggregates.set(key, aggregate)
  })
  const assignmentKeys = new Set([...groupAggregates.keys(), ...legacyAggregates.keys()])
  const rawGroupedSessionIds = groups.flatMap((group) => (
    group.coach_assignment_group_students || []
  ).map((student) => student.booking_session_id))

  const [sessionsBySlot, checkinMap, payableGroupedSessionIds] = await measurePhase(metrics, 'related', () => Promise.all([
    getPayableSessionsBySlot(supabase, slotIds, metrics),
    getCheckins(supabase, assignmentKeys, slotIds, metrics),
    getPayableSessionIds(supabase, rawGroupedSessionIds, metrics),
  ]))
  const loadedLegacySessions = legacyRows.flatMap((assignment) => sessionsBySlot.get(assignment.schedule_slot_id) || [])
  const walletRedeemedSessionIds = await measurePhase(
    metrics,
    'walletProvenance',
    () => getWalletRedeemedSessionIds(supabase, loadedLegacySessions, metrics),
  )
  const eligibleLegacySessionIds = new Set(
    getLegacyEligibleSessions(loadedLegacySessions, walletRedeemedSessionIds).map((session) => session.id),
  )
  const groupedSessionIds = rawGroupedSessionIds.filter((sessionId) => payableGroupedSessionIds.has(sessionId))
  const legacySessionIds = loadedLegacySessions
    .filter((session) => eligibleLegacySessionIds.has(session.id))
    .map((session) => session.id)
  const attendanceCounts = await measurePhase(
    metrics,
    'attendance',
    () => getAttendanceCounts(supabase, uniqueTruthyIds([...groupedSessionIds, ...legacySessionIds]), metrics),
  )

  const groupSessionMembershipCounts = new Map<string, number>()
  groups.forEach((group) => {
    uniqueTruthyIds((group.coach_assignment_group_students || []).map((member) => member.booking_session_id))
      .forEach((sessionId) => {
        const key = `${group.schedule_slot_id}:${sessionId}`
        groupSessionMembershipCounts.set(key, (groupSessionMembershipCounts.get(key) || 0) + 1)
      })
  })

  const rows: CoachTeachingHourSourceRow[] = []
  groupAggregates.forEach((aggregateGroups, key) => {
    const orderedGroups = [...aggregateGroups].sort((a, b) => (
      a.sort_order - b.sort_order || a.id.localeCompare(b.id)
    ))
    const first = orderedGroups[0]
    if (!first.coach_id || !first.schedule_slots) return
    const rawSessionIds = uniqueTruthyIds(orderedGroups.flatMap((group) => (
      group.coach_assignment_group_students || []
    ).map((student) => student.booking_session_id)))
    const sessionIds = rawSessionIds.filter((sessionId) => payableGroupedSessionIds.has(sessionId))
    const duplicateAssignment = rawSessionIds.some((sessionId) => (
      (groupSessionMembershipCounts.get(`${first.schedule_slot_id}:${sessionId}`) || 0) > 1
    ))
    if (sessionIds.length === 0 && !options.includeExcluded) return
    rows.push(createSourceRow({
      assignmentId: first.id,
      assignmentSource: 'group',
      coachId: first.coach_id,
      profile: first.profiles,
      slot: first.schedule_slots,
      checkin: checkinMap.get(key) || null,
      studentCount: sessionIds.length,
      attendanceStats: sumAttendance(sessionIds, attendanceCounts),
      duplicateAssignment,
    }))
  })

  legacyAggregates.forEach((aggregateAssignments, key) => {
    const orderedAssignments = [...aggregateAssignments].sort((a, b) => a.id.localeCompare(b.id))
    const first = orderedAssignments[0]
    if (!first.schedule_slots) return
    const sessions = uniqueTruthyIds((sessionsBySlot.get(first.schedule_slot_id) || [])
      .filter((session) => eligibleLegacySessionIds.has(session.id))
      .map((session) => session.id))
    if (sessions.length === 0 && !options.includeExcluded) return
    rows.push(createSourceRow({
      assignmentId: first.id,
      assignmentSource: 'legacy',
      coachId: first.coach_id,
      profile: first.profiles,
      slot: first.schedule_slots,
      checkin: checkinMap.get(key) || null,
      studentCount: sessions.length,
      attendanceStats: sumAttendance(sessions, attendanceCounts),
      duplicateAssignment: orderedAssignments.length > 1,
    }))
  })

  return {
    rows: rows.sort((a, b) => (
      `${a.date} ${a.start_time} ${a.schedule_slot_id} ${a.coach_id}`
        .localeCompare(`${b.date} ${b.start_time} ${b.schedule_slot_id} ${b.coach_id}`)
    )),
    metrics: finishMetrics(metrics),
  }
}

export async function getCoachTeachingHourSourceRows(
  supabaseClient: unknown,
  options: TeachingHoursRangeOptions,
): Promise<CoachTeachingHourSourceRow[]> {
  const read = await getCoachTeachingHourSourceRead(supabaseClient, options)
  return read.rows
}
