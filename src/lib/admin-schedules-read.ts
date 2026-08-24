import type { SupabaseClient } from '@supabase/supabase-js'

import { getServiceRoleClient } from '@/lib/auth/admin'
import {
  buildAdminScheduleDayDetail,
  buildAdminScheduleMonthSummary,
  buildAdminScheduleSearchCandidateResult,
  deriveAdminScheduleSlotSessions,
  escapeAdminScheduleLikePattern,
  filterVisibleAdminScheduleSessions,
  getAdminScheduleAttendanceScopeIds,
  getAdminScheduleStudentRef,
  normalizeAdminScheduleSearch,
  type AdminScheduleGroupRow,
  type AdminScheduleLevelRow,
  type AdminScheduleSessionRow,
  type AdminScheduleStudentLevelRow,
  type AdminScheduleTeachingProgramRow,
  type AdminScheduleWalletCreditRow,
} from '@/lib/admin-schedules-model'
import type { AttendanceSessionRow } from '@/lib/session-attendance-status'
import type { Database } from '@/types/database'

const QUERY_CHUNK_SIZE = 100
const QUERY_PAGE_SIZE = 1000
const QUERY_CONCURRENCY = 4
const REFERENCE_CACHE_TTL_MS = 10 * 60 * 1000
export const ADMIN_SCHEDULE_SEARCH_LIMIT = 200
export const ADMIN_SCHEDULE_SEARCH_CANDIDATE_LIMIT = 500

type DatabaseClient = SupabaseClient<Database>

interface ReadMetrics {
  operation: 'summary' | 'day-detail' | 'search'
  startedAt: number
  externalCalls: number
  rows: Record<string, number>
  calls: Record<string, number>
  phasesMs: Record<string, number>
}

function createMetrics(operation: ReadMetrics['operation']): ReadMetrics {
  return { operation, startedAt: performance.now(), externalCalls: 0, rows: {}, calls: {}, phasesMs: {} }
}

function addRows(metrics: ReadMetrics, key: string, count: number) {
  metrics.rows[key] = (metrics.rows[key] || 0) + count
}

function addCall(metrics: ReadMetrics, key: string) {
  metrics.externalCalls += 1
  metrics.calls[key] = (metrics.calls[key] || 0) + 1
}

async function measurePhase<T>(metrics: ReadMetrics, key: string, operation: () => Promise<T>) {
  const startedAt = performance.now()
  try {
    return await operation()
  } finally {
    metrics.phasesMs[key] = Math.round((performance.now() - startedAt) * 10) / 10
  }
}

function finishMetrics(metrics: ReadMetrics) {
  const durationMs = Math.round((performance.now() - metrics.startedAt) * 10) / 10
  const result = {
    durationMs,
    externalCalls: metrics.externalCalls,
    rows: metrics.rows,
    calls: metrics.calls,
    phasesMs: metrics.phasesMs,
  }
  if (process.env.NODE_ENV !== 'production') {
    console.info('[admin-schedules-performance]', JSON.stringify({
      operation: metrics.operation,
      ...result,
    }))
  }
  return result
}

export function parseAdminScheduleMonth(yearValue: string | number | null, monthValue: string | number | null) {
  const now = new Date()
  const fallback = { year: now.getFullYear(), month: now.getMonth() + 1 }
  const year = Number(yearValue)
  const month = Number(monthValue)
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    return fallback
  }
  return { year, month }
}

export function getAdminScheduleMonthRange(year: number, month: number) {
  const lastDay = new Date(year, month, 0).getDate()
  return {
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  }
}

export function isAdminScheduleDateInMonth(date: string, year: number, month: number) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
    && date >= getAdminScheduleMonthRange(year, month).startDate
    && date <= getAdminScheduleMonthRange(year, month).endDate
}

function chunks<T>(items: T[]) {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += QUERY_CHUNK_SIZE) {
    result.push(items.slice(index, index + QUERY_CHUNK_SIZE))
  }
  return result
}

async function mapWithConcurrency<T, R>(items: T[], mapper: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(QUERY_CONCURRENCY, items.length) }, () => worker()))
  return results
}

async function fetchSessions(
  supabase: DatabaseClient,
  startDate: string,
  endDate: string,
  detailed: boolean,
  metrics: ReadMetrics,
) {
  const rows: AdminScheduleSessionRow[] = []
  const selection = detailed
    ? `id, date, start_time, end_time, status, is_makeup, child_id, schedule_slot_id, branch_id,
       branches(name), children(full_name, nickname),
       bookings!inner(id, user_id, learner_type, child_id, course_type_id, status,
         profiles!bookings_user_id_fkey(full_name), course_types(name))`
    : `id, date, start_time, end_time, status, is_makeup, child_id, schedule_slot_id, branch_id,
       branches(name), bookings!inner(user_id, course_type_id, status, course_types(name))`

  for (let start = 0; ; start += QUERY_PAGE_SIZE) {
    addCall(metrics, 'sessionPages')
    const { data, error } = await supabase.from('booking_sessions').select(selection)
      .eq('bookings.status', 'verified').neq('status', 'rescheduled')
      .gte('date', startDate).lte('date', endDate)
      .order('date').order('start_time').order('id').range(start, start + QUERY_PAGE_SIZE - 1)
    if (error) throw new Error(`Admin schedule sessions query failed: ${error.message}`)
    const page = (data || []) as unknown as AdminScheduleSessionRow[]
    rows.push(...page)
    addRows(metrics, 'sessions', page.length)
    if (page.length < QUERY_PAGE_SIZE) break
  }
  return rows
}

async function fetchWalletCredits(
  supabase: DatabaseClient,
  sessionIds: string[],
  metrics: ReadMetrics,
) {
  const pages = await mapWithConcurrency(chunks(sessionIds), async (ids) => {
    addCall(metrics, 'walletChunks')
    const { data, error } = await supabase.from('lesson_wallet_credits')
      .select('original_session_id, status').in('original_session_id', ids)
    if (error) throw new Error(`Admin schedule wallet credits query failed: ${error.message}`)
    const rows = (data || []) as AdminScheduleWalletCreditRow[]
    addRows(metrics, 'walletCredits', rows.length)
    return rows
  })
  return pages.flat()
}

async function fetchGroupsForDateRange(
  supabase: DatabaseClient,
  startDate: string,
  endDate: string,
  detailed: boolean,
  metrics: ReadMetrics,
) {
  const rows: AdminScheduleGroupRow[] = []
  const profileSelection = detailed ? 'id, full_name, role' : 'id, role'

  for (let start = 0; ; start += QUERY_PAGE_SIZE) {
    addCall(metrics, 'groupPages')
    const { data, error } = await supabase.from('coach_assignment_groups').select(`
      id, schedule_slot_id, coach_id, name, level_min, level_max, sort_order,
      profiles!coach_assignment_groups_coach_id_fkey(${profileSelection}),
      coach_assignment_group_students(booking_session_id),
      schedule_slots!inner(date)
    `).gte('schedule_slots.date', startDate).lte('schedule_slots.date', endDate)
      .order('schedule_slot_id').order('sort_order').order('id')
      .range(start, start + QUERY_PAGE_SIZE - 1)
    if (error) throw new Error(`Admin schedule assignment groups query failed: ${error.message}`)
    const page = (data || []) as unknown as AdminScheduleGroupRow[]
    rows.push(...page)
    addRows(metrics, 'groups', page.length)
    if (page.length < QUERY_PAGE_SIZE) break
  }
  return rows
}

type SearchCandidateDimension = 'learner-name' | 'learner-nickname' | 'parent' | 'branch'

function getSearchCandidateSelection(dimension: SearchCandidateDimension, courseFiltered: boolean) {
  const childRelation = dimension === 'learner-name' || dimension === 'learner-nickname'
    ? 'children!inner(id)'
    : 'children(id)'
  const branchRelation = dimension === 'branch' ? 'branches!inner(id)' : 'branches(id)'
  const profileRelation = dimension === 'parent'
    ? 'profiles!bookings_user_id_fkey!inner(id)'
    : 'profiles!bookings_user_id_fkey(id)'
  const courseRelation = courseFiltered ? 'course_types!inner(id)' : 'course_types(id)'

  return `id, date, start_time, end_time, status, is_makeup, child_id, schedule_slot_id, branch_id,
    ${childRelation}, ${branchRelation},
    bookings!inner(user_id, course_type_id, status, ${profileRelation}, ${courseRelation})`
}

async function fetchSearchCandidateSessions(input: {
  supabase: DatabaseClient
  dimension: SearchCandidateDimension
  pattern: string
  startDate: string
  endDate: string
  branchId?: string
  courseType?: string
  metrics: ReadMetrics
}) {
  const courseFiltered = Boolean(input.courseType && input.courseType !== 'all')
  let request = input.supabase.from('booking_sessions')
    .select(getSearchCandidateSelection(input.dimension, courseFiltered))
    .eq('bookings.status', 'verified').neq('status', 'rescheduled')
    .gte('date', input.startDate).lte('date', input.endDate)

  if (input.branchId && input.branchId !== 'all') request = request.eq('branch_id', input.branchId)
  if (courseFiltered) request = request.eq('bookings.course_types.name', input.courseType as string)

  const columns: Record<SearchCandidateDimension, string> = {
    'learner-name': 'children.full_name',
    'learner-nickname': 'children.nickname',
    parent: 'bookings.profiles.full_name',
    branch: 'branches.name',
  }

  addCall(input.metrics, 'candidateCalls')
  const { data, error } = await request.ilike(columns[input.dimension], input.pattern)
    .order('date').order('start_time').order('id')
    .limit(ADMIN_SCHEDULE_SEARCH_CANDIDATE_LIMIT + 1)
  if (error) throw new Error(`Admin schedule search candidate query failed (${input.dimension})`)
  const rows = (data || []) as unknown as AdminScheduleSessionRow[]
  addRows(input.metrics, 'candidateSessions', rows.length)
  return {
    rows: rows.slice(0, ADMIN_SCHEDULE_SEARCH_CANDIDATE_LIMIT),
    truncated: rows.length > ADMIN_SCHEDULE_SEARCH_CANDIDATE_LIMIT,
  }
}

async function fetchSearchCourseTypes(metrics: ReadMetrics) {
  addCall(metrics, 'candidateCalls')
  const { data, error } = await getServiceRoleClient().from('course_types')
    .select('id, name').order('id')
  if (error) throw new Error('Admin schedule search course reference query failed')
  const rows = (data || []) as { id: string; name: string }[]
  addRows(metrics, 'courseTypes', rows.length)
  return rows
}

async function fetchSearchBookingCandidates(input: {
  supabase: DatabaseClient
  courseTypeIds?: string[]
  startDate: string
  endDate: string
  branchId?: string
  courseType?: string
  metrics: ReadMetrics
  metricKey: 'courseCandidateCalls' | 'statusCandidateCalls'
}) {
  const courseFiltered = Boolean(input.courseType && input.courseType !== 'all')
  const courseRelation = courseFiltered ? 'course_types!inner(id)' : 'course_types(id)'
  let request = input.supabase.from('booking_sessions').select(`
    id, date, start_time, end_time, status, is_makeup, child_id, schedule_slot_id, branch_id,
    bookings!inner(user_id, course_type_id, status, ${courseRelation})
  `).eq('bookings.status', 'verified').neq('status', 'rescheduled')
    .gte('date', input.startDate).lte('date', input.endDate)
  if (input.courseTypeIds) request = request.in('bookings.course_type_id', input.courseTypeIds)
  if (input.branchId && input.branchId !== 'all') request = request.eq('branch_id', input.branchId)
  if (courseFiltered) request = request.eq('bookings.course_types.name', input.courseType as string)

  addCall(input.metrics, input.metricKey)
  const { data, error } = await request.order('date').order('start_time').order('id')
    .limit(ADMIN_SCHEDULE_SEARCH_CANDIDATE_LIMIT + 1)
  if (error) throw new Error(`Admin schedule search candidate query failed (${input.metricKey})`)
  const rows = (data || []) as unknown as AdminScheduleSessionRow[]
  addRows(input.metrics, 'candidateSessions', rows.length)
  return {
    rows: rows.slice(0, ADMIN_SCHEDULE_SEARCH_CANDIDATE_LIMIT),
    truncated: rows.length > ADMIN_SCHEDULE_SEARCH_CANDIDATE_LIMIT,
  }
}

async function fetchCoachSearchCandidateSessionIds(input: {
  supabase: DatabaseClient
  pattern: string
  startDate: string
  endDate: string
  metrics: ReadMetrics
}) {
  addCall(input.metrics, 'candidateCalls')
  const { data, error } = await input.supabase.from('coach_assignment_groups').select(`
    id, schedule_slot_id,
    profiles!coach_assignment_groups_coach_id_fkey!inner(id),
    coach_assignment_group_students(booking_session_id),
    schedule_slots!inner(date)
  `).gte('schedule_slots.date', input.startDate).lte('schedule_slots.date', input.endDate)
    .in('profiles.role', ['coach', 'head_coach'])
    .ilike('profiles.full_name', input.pattern)
    .order('schedule_slot_id').order('sort_order').order('id')
    .limit(ADMIN_SCHEDULE_SEARCH_CANDIDATE_LIMIT + 1)
  if (error) throw new Error('Admin schedule search candidate query failed (coach)')
  const groups = (data || []) as unknown as {
    coach_assignment_group_students: { booking_session_id: string }[] | null
  }[]
  const sessionIds = Array.from(new Set(groups.flatMap((group) => (
    group.coach_assignment_group_students || []
  ).map((member) => member.booking_session_id))))
  addRows(input.metrics, 'candidateGroups', groups.length)
  return {
    sessionIds: sessionIds.slice(0, ADMIN_SCHEDULE_SEARCH_CANDIDATE_LIMIT),
    truncated: groups.length > ADMIN_SCHEDULE_SEARCH_CANDIDATE_LIMIT
      || sessionIds.length > ADMIN_SCHEDULE_SEARCH_CANDIDATE_LIMIT,
  }
}

async function fetchSearchSessionsByIds(input: {
  supabase: DatabaseClient
  sessionIds: string[]
  branchId?: string
  courseType?: string
  metrics: ReadMetrics
}) {
  const courseFiltered = Boolean(input.courseType && input.courseType !== 'all')
  const pages = await mapWithConcurrency(chunks(input.sessionIds), async (ids) => {
    addCall(input.metrics, 'detailCalls')
    const courseRelation = courseFiltered ? 'course_types!inner(id)' : 'course_types(id)'
    let request = input.supabase.from('booking_sessions').select(`
      id, date, start_time, end_time, status, is_makeup, child_id, schedule_slot_id, branch_id,
      bookings!inner(user_id, course_type_id, status, ${courseRelation})
    `).in('id', ids).eq('bookings.status', 'verified').neq('status', 'rescheduled')
    if (input.branchId && input.branchId !== 'all') request = request.eq('branch_id', input.branchId)
    if (courseFiltered) request = request.eq('bookings.course_types.name', input.courseType as string)
    const { data, error } = await request.order('date').order('start_time').order('id')
    if (error) throw new Error('Admin schedule search detail query failed')
    const rows = (data || []) as unknown as AdminScheduleSessionRow[]
    addRows(input.metrics, 'detailSessions', rows.length)
    return rows
  })
  return pages.flat()
}

async function fetchAttendance(sessionIds: string[], metrics: ReadMetrics) {
  const admin = getServiceRoleClient()
  const pages = await mapWithConcurrency(chunks(sessionIds), async (ids) => {
    addCall(metrics, 'attendanceChunks')
    const { data, error } = await admin.from('attendance')
      .select('booking_session_id, student_id, status, checked_at').in('booking_session_id', ids)
    if (error) throw new Error(`Admin schedule attendance query failed: ${error.message}`)
    const rows = (data || []) as AttendanceSessionRow[]
    addRows(metrics, 'attendance', rows.length)
    return rows
  })
  return pages.flat()
}

async function fetchStudentLevels(
  supabase: DatabaseClient,
  studentIds: string[],
  metrics: ReadMetrics,
) {
  const pages = await mapWithConcurrency(chunks(studentIds), async (ids) => {
    addCall(metrics, 'studentLevelChunks')
    const { data, error } = await supabase.from('student_levels')
      .select('student_id, student_type, level, created_at').in('student_id', ids)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`Admin schedule student levels query failed: ${error.message}`)
    const rows = (data || []) as AdminScheduleStudentLevelRow[]
    addRows(metrics, 'studentLevels', rows.length)
    return rows
  })
  return pages.flat()
}

async function fetchTeachingPrograms(
  supabase: DatabaseClient,
  slotIds: string[],
  metrics: ReadMetrics,
) {
  const pages = await mapWithConcurrency(chunks(slotIds), async (ids) => {
    addCall(metrics, 'teachingProgramChunks')
    const { data, error } = await supabase.from('teaching_programs')
      .select('id, coach_id, schedule_slot_id, program_content, status, created_at, updated_at')
      .in('schedule_slot_id', ids).order('updated_at', { ascending: false })
    if (error) throw new Error(`Admin schedule teaching programs query failed: ${error.message}`)
    const rows = (data || []) as AdminScheduleTeachingProgramRow[]
    addRows(metrics, 'teachingPrograms', rows.length)
    return rows
  })
  return pages.flat()
}

let branchCache: { expiresAt: number; data: { id: string; name: string; slug: string }[] } | null = null
let levelCache: { expiresAt: number; data: AdminScheduleLevelRow[] } | null = null

async function getCachedActiveBranches(metrics: ReadMetrics) {
  if (branchCache && branchCache.expiresAt > Date.now()) return branchCache.data
  addCall(metrics, 'branchReference')
  const { data, error } = await getServiceRoleClient().from('branches')
    .select('id, name, slug').eq('is_active', true).order('name')
  if (error) throw new Error(`Admin schedule branches query failed: ${error.message}`)
  const rows = data || []
  branchCache = { expiresAt: Date.now() + REFERENCE_CACHE_TTL_MS, data: rows }
  addRows(metrics, 'branches', rows.length)
  return rows
}

async function getCachedActiveLevels(metrics: ReadMetrics) {
  if (levelCache && levelCache.expiresAt > Date.now()) return levelCache.data
  addCall(metrics, 'levelReference')
  const { data, error } = await getServiceRoleClient().from('levels')
    .select('id, name, category').eq('is_active', true)
  if (error) throw new Error(`Admin schedule levels query failed: ${error.message}`)
  const rows = (data || []) as AdminScheduleLevelRow[]
  levelCache = { expiresAt: Date.now() + REFERENCE_CACHE_TTL_MS, data: rows }
  addRows(metrics, 'levels', rows.length)
  return rows
}

export async function loadAdminScheduleMonthSummary(
  supabase: DatabaseClient,
  year: number,
  month: number,
) {
  const metrics = createMetrics('summary')
  const { startDate, endDate } = getAdminScheduleMonthRange(year, month)
  const [sessions, branches, groups] = await measurePhase(metrics, 'summaryBase', () => Promise.all([
    fetchSessions(supabase, startDate, endDate, false, metrics),
    getCachedActiveBranches(metrics),
    fetchGroupsForDateRange(supabase, startDate, endDate, false, metrics),
  ]))
  const walletSessionIds = sessions.filter((session) => session.status === 'walleted').map((session) => session.id)
  const walletCredits = await measurePhase(metrics, 'summaryWallet', () => (
    walletSessionIds.length ? fetchWalletCredits(supabase, walletSessionIds, metrics) : Promise.resolve([])
  ))
  const summary = buildAdminScheduleMonthSummary({ sessions, walletCredits, groups })
  return { summary, branches, metrics: finishMetrics(metrics) }
}

export async function loadAdminScheduleDayDetail(supabase: DatabaseClient, date: string) {
  const metrics = createMetrics('day-detail')
  const sessions = await measurePhase(metrics, 'daySessions', () => fetchSessions(supabase, date, date, true, metrics))
  const walletSessionIds = sessions.filter((session) => session.status === 'walleted').map((session) => session.id)
  const slotIds = Array.from(new Set(sessions.flatMap((session) => session.schedule_slot_id ? [session.schedule_slot_id] : [])))
  const slotSessions = deriveAdminScheduleSlotSessions(sessions)
  addRows(metrics, 'slotSessionsDerived', slotSessions.length)
  const [walletCredits, groups, teachingPrograms, levels] = await measurePhase(metrics, 'dayRelated', () => Promise.all([
    walletSessionIds.length ? fetchWalletCredits(supabase, walletSessionIds, metrics) : [],
    slotIds.length ? fetchGroupsForDateRange(supabase, date, date, true, metrics) : [],
    slotIds.length ? fetchTeachingPrograms(supabase, slotIds, metrics) : [],
    getCachedActiveLevels(metrics),
  ]))
  const visibleSessions = filterVisibleAdminScheduleSessions(sessions, walletCredits)
  const studentIds = Array.from(new Set(visibleSessions.flatMap((session) => {
    const student = getAdminScheduleStudentRef(session)
    return student ? [student.id] : []
  })))
  const attendanceIds = getAdminScheduleAttendanceScopeIds({ sessions: visibleSessions, groups, slotSessions })
  const [studentLevels, attendanceRows] = await measurePhase(metrics, 'dayLearnerState', () => Promise.all([
    studentIds.length ? fetchStudentLevels(supabase, studentIds, metrics) : [],
    attendanceIds.length ? fetchAttendance(attendanceIds, metrics) : [],
  ]))
  const detail = buildAdminScheduleDayDetail({
    sessions, walletCredits, groups, slotSessions, attendanceRows, studentLevels, levels, teachingPrograms,
  })
  return { detail, metrics: finishMetrics(metrics) }
}

export async function searchAdminSchedulesMonth(input: {
  supabase: DatabaseClient
  year: number
  month: number
  query: string
  branchId?: string
  courseType?: string
}) {
  const metrics = createMetrics('search')
  const { startDate, endDate } = getAdminScheduleMonthRange(input.year, input.month)
  const normalizedQuery = normalizeAdminScheduleSearch(input.query)
  const pattern = escapeAdminScheduleLikePattern(normalizedQuery)
  const dimensions: SearchCandidateDimension[] = [
    'learner-name', 'learner-nickname', 'parent', 'branch',
  ]
  const [candidateSets, coachCandidates, courseTypes, statusCandidates] = await measurePhase(
    metrics,
    'searchCandidates',
    async () => {
      const [sets, coach, courses, status] = await Promise.all([
      Promise.all(dimensions.map((dimension) => fetchSearchCandidateSessions({
        supabase: input.supabase,
        dimension,
        pattern,
        startDate,
        endDate,
        branchId: input.branchId,
        courseType: input.courseType,
        metrics,
      }))),
      fetchCoachSearchCandidateSessionIds({
        supabase: input.supabase,
        pattern,
        startDate,
        endDate,
        metrics,
      }),
      fetchSearchCourseTypes(metrics),
      normalizeAdminScheduleSearch('verified').includes(normalizedQuery)
        ? fetchSearchBookingCandidates({
            supabase: input.supabase,
            startDate,
            endDate,
            branchId: input.branchId,
            courseType: input.courseType,
            metrics,
            metricKey: 'statusCandidateCalls',
          })
        : Promise.resolve({ rows: [], truncated: false }),
    ])
      return [sets, coach, courses, status] as const
    },
  )
  const matchingCourseTypeIds = courseTypes
    .filter((course) => normalizeAdminScheduleSearch(course.name).includes(normalizedQuery))
    .map((course) => course.id)
  const courseCandidates = matchingCourseTypeIds.length
    ? await measurePhase(metrics, 'searchCourseCandidates', () => fetchSearchBookingCandidates({
        supabase: input.supabase,
        courseTypeIds: matchingCourseTypeIds,
        startDate,
        endDate,
        branchId: input.branchId,
        courseType: input.courseType,
        metrics,
        metricKey: 'courseCandidateCalls',
      }))
    : { rows: [], truncated: false }
  const allCandidateSets = [...candidateSets, statusCandidates, courseCandidates]
  const directSessions = allCandidateSets.flatMap((set) => set.rows)
  const directIds = new Set(directSessions.map((session) => session.id))
  const coachIds = coachCandidates.sessionIds.filter((id) => !directIds.has(id))
  const coachSessions = coachIds.length
    ? await measurePhase(metrics, 'searchDetails', () => fetchSearchSessionsByIds({
        supabase: input.supabase,
        sessionIds: coachIds,
        branchId: input.branchId,
        courseType: input.courseType,
        metrics,
      }))
    : []
  const sessionsById = new Map<string, AdminScheduleSessionRow>()
  ;[...directSessions, ...coachSessions].forEach((session) => sessionsById.set(session.id, session))
  const candidateSessions = Array.from(sessionsById.values())
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time) || a.id.localeCompare(b.id))
  const candidateOverflow = candidateSessions.length > ADMIN_SCHEDULE_SEARCH_CANDIDATE_LIMIT
  const sessions = candidateSessions.slice(0, ADMIN_SCHEDULE_SEARCH_CANDIDATE_LIMIT)
  const walletSessionIds = sessions.filter((session) => session.status === 'walleted').map((session) => session.id)
  const walletCredits = walletSessionIds.length
    ? await measurePhase(metrics, 'searchWallet', () => fetchWalletCredits(input.supabase, walletSessionIds, metrics))
    : []
  const result = buildAdminScheduleSearchCandidateResult({
    sessions,
    walletCredits,
    startDate,
    endDate,
    limit: ADMIN_SCHEDULE_SEARCH_LIMIT,
    sourceTruncated: candidateOverflow
      || coachCandidates.truncated
      || allCandidateSets.some((set) => set.truncated),
  })
  return { result, metrics: finishMetrics(metrics) }
}
