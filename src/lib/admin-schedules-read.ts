import type { SupabaseClient } from '@supabase/supabase-js'

import { getServiceRoleClient } from '@/lib/auth/admin'
import {
  buildAdminScheduleDayDetail,
  buildAdminScheduleMonthSummary,
  buildAdminScheduleSearchResult,
  filterVisibleAdminScheduleSessions,
  getAdminScheduleAttendanceScopeIds,
  getAdminScheduleStudentRef,
  type AdminScheduleGroupRow,
  type AdminScheduleLevelRow,
  type AdminScheduleSessionRow,
  type AdminScheduleSlotSessionRow,
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

type DatabaseClient = SupabaseClient<Database>

interface ReadMetrics {
  operation: 'summary' | 'day-detail' | 'search'
  startedAt: number
  externalCalls: number
  rows: Record<string, number>
}

function createMetrics(operation: ReadMetrics['operation']): ReadMetrics {
  return { operation, startedAt: performance.now(), externalCalls: 0, rows: {} }
}

function addRows(metrics: ReadMetrics, key: string, count: number) {
  metrics.rows[key] = (metrics.rows[key] || 0) + count
}

function finishMetrics(metrics: ReadMetrics) {
  const durationMs = Math.round((performance.now() - metrics.startedAt) * 10) / 10
  const result = { durationMs, externalCalls: metrics.externalCalls, rows: metrics.rows }
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
       bookings!inner(id, user_id, learner_type, course_type_id, status,
         profiles!bookings_user_id_fkey(full_name), course_types(name))`
    : `id, date, start_time, end_time, status, is_makeup, child_id, schedule_slot_id, branch_id,
       branches(name), bookings!inner(user_id, course_type_id, status, course_types(name))`

  for (let start = 0; ; start += QUERY_PAGE_SIZE) {
    metrics.externalCalls += 1
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
    metrics.externalCalls += 1
    const { data, error } = await supabase.from('lesson_wallet_credits')
      .select('original_session_id, status').in('original_session_id', ids)
    if (error) throw new Error(`Admin schedule wallet credits query failed: ${error.message}`)
    const rows = (data || []) as AdminScheduleWalletCreditRow[]
    addRows(metrics, 'walletCredits', rows.length)
    return rows
  })
  return pages.flat()
}

async function fetchGroups(
  supabase: DatabaseClient,
  slotIds: string[],
  detailed: boolean,
  metrics: ReadMetrics,
) {
  const pages = await mapWithConcurrency(chunks(slotIds), async (ids) => {
    metrics.externalCalls += 1
    const profileSelection = detailed ? 'id, full_name, role' : 'id, role'
    const { data, error } = await supabase.from('coach_assignment_groups').select(`
      id, schedule_slot_id, coach_id, name, level_min, level_max, sort_order,
      profiles!coach_assignment_groups_coach_id_fkey(${profileSelection}),
      coach_assignment_group_students(booking_session_id)
    `).in('schedule_slot_id', ids)
    if (error) throw new Error(`Admin schedule assignment groups query failed: ${error.message}`)
    const rows = (data || []) as unknown as AdminScheduleGroupRow[]
    addRows(metrics, 'groups', rows.length)
    return rows
  })
  return pages.flat()
}

async function fetchSlotSessions(
  supabase: DatabaseClient,
  slotIds: string[],
  date: string,
  metrics: ReadMetrics,
) {
  const pages = await mapWithConcurrency(chunks(slotIds), async (ids) => {
    metrics.externalCalls += 1
    const { data, error } = await supabase.from('booking_sessions')
      .select('id, schedule_slot_id, bookings!inner(status)')
      .in('schedule_slot_id', ids).neq('status', 'rescheduled').neq('status', 'walleted')
      .eq('bookings.status', 'verified').eq('date', date).order('id')
    if (error) throw new Error(`Admin schedule slot sessions query failed: ${error.message}`)
    const rows = (data || []) as unknown as AdminScheduleSlotSessionRow[]
    addRows(metrics, 'slotSessions', rows.length)
    return rows
  })
  return pages.flat()
}

async function fetchAttendance(sessionIds: string[], metrics: ReadMetrics) {
  const admin = getServiceRoleClient()
  const pages = await mapWithConcurrency(chunks(sessionIds), async (ids) => {
    metrics.externalCalls += 1
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
    metrics.externalCalls += 1
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
    metrics.externalCalls += 1
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
  metrics.externalCalls += 1
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
  metrics.externalCalls += 1
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
  const [sessions, branches] = await Promise.all([
    fetchSessions(supabase, startDate, endDate, false, metrics),
    getCachedActiveBranches(metrics),
  ])
  const walletSessionIds = sessions.filter((session) => session.status === 'walleted').map((session) => session.id)
  const slotIds = Array.from(new Set(sessions.flatMap((session) => session.schedule_slot_id ? [session.schedule_slot_id] : [])))
  const [walletCredits, groups] = await Promise.all([
    walletSessionIds.length ? fetchWalletCredits(supabase, walletSessionIds, metrics) : [],
    slotIds.length ? fetchGroups(supabase, slotIds, false, metrics) : [],
  ])
  const summary = buildAdminScheduleMonthSummary({ sessions, walletCredits, groups })
  return { summary, branches, metrics: finishMetrics(metrics) }
}

export async function loadAdminScheduleDayDetail(supabase: DatabaseClient, date: string) {
  const metrics = createMetrics('day-detail')
  const sessions = await fetchSessions(supabase, date, date, true, metrics)
  const walletSessionIds = sessions.filter((session) => session.status === 'walleted').map((session) => session.id)
  const slotIds = Array.from(new Set(sessions.flatMap((session) => session.schedule_slot_id ? [session.schedule_slot_id] : [])))
  const [walletCredits, groups, slotSessions, teachingPrograms, levels] = await Promise.all([
    walletSessionIds.length ? fetchWalletCredits(supabase, walletSessionIds, metrics) : [],
    slotIds.length ? fetchGroups(supabase, slotIds, true, metrics) : [],
    slotIds.length ? fetchSlotSessions(supabase, slotIds, date, metrics) : [],
    slotIds.length ? fetchTeachingPrograms(supabase, slotIds, metrics) : [],
    getCachedActiveLevels(metrics),
  ])
  const visibleSessions = filterVisibleAdminScheduleSessions(sessions, walletCredits)
  const studentIds = Array.from(new Set(visibleSessions.flatMap((session) => {
    const student = getAdminScheduleStudentRef(session)
    return student ? [student.id] : []
  })))
  const attendanceIds = getAdminScheduleAttendanceScopeIds({ sessions: visibleSessions, groups, slotSessions })
  const [studentLevels, attendanceRows] = await Promise.all([
    studentIds.length ? fetchStudentLevels(supabase, studentIds, metrics) : [],
    attendanceIds.length ? fetchAttendance(attendanceIds, metrics) : [],
  ])
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
  const sessions = await fetchSessions(input.supabase, startDate, endDate, true, metrics)
  const walletSessionIds = sessions.filter((session) => session.status === 'walleted').map((session) => session.id)
  const slotIds = Array.from(new Set(sessions.flatMap((session) => session.schedule_slot_id ? [session.schedule_slot_id] : [])))
  const [walletCredits, groups] = await Promise.all([
    walletSessionIds.length ? fetchWalletCredits(input.supabase, walletSessionIds, metrics) : [],
    slotIds.length ? fetchGroups(input.supabase, slotIds, true, metrics) : [],
  ])
  const visibleSessions = filterVisibleAdminScheduleSessions(sessions, walletCredits)
  const result = buildAdminScheduleSearchResult({
    sessions: visibleSessions,
    groups,
    query: input.query,
    startDate,
    endDate,
    branchId: input.branchId,
    courseType: input.courseType,
    limit: ADMIN_SCHEDULE_SEARCH_LIMIT,
  })
  return { result, metrics: finishMetrics(metrics) }
}
