import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

import { AssignGroupsClient } from '@/components/coach/assign-groups-client'
import {
  CoachAssignmentDataUnavailableError,
  requireCoachAssignmentQueryData,
} from '@/lib/coach-assignment-resolution'
import type { CoachMemoryEntry } from '@/lib/coach-student-memory'
import { createClient } from '@/lib/supabase/server'
import { getBangkokDateString } from '@/lib/utils'
import type { LevelCategory, StudentType } from '@/types/database'

interface CoachBranchRow {
  branch_id: string
  branches?: { name: string | null } | null
}

interface BranchRow {
  id: string
  name: string
}

interface CoachOptionRow {
  coach_id: string
  branch_id: string
  profiles?: {
    full_name: string | null
    role: string | null
  } | null
}

interface SessionRow {
  id: string
  date: string
  start_time: string
  end_time: string
  branch_id: string
  child_id: string | null
  schedule_slot_id: string | null
  status: string
  children?: {
    full_name: string | null
    nickname: string | null
  } | null
  bookings?: {
    user_id: string
    course_type_id: string
    status: string
    profiles?: { full_name: string | null } | null
    course_types?: { name: string | null } | null
  } | null
}

interface LegacyAssignmentRow {
  schedule_slot_id: string
  coach_id: string
  profiles?: { full_name: string | null } | null
}

interface LevelRow {
  id: number
  name: string
  category: LevelCategory
  program_name: string | null
}

interface StudentLevelRow {
  student_id: string
  student_type: StudentType
  level: number
  created_at: string
}

interface ExistingGroupRow {
  id: string
  schedule_slot_id: string
  coach_id: string | null
  name: string
  level_min: number | null
  level_max: number | null
  sort_order: number
  profiles?: { full_name: string | null } | null
  coach_assignment_group_students?: { booking_session_id: string }[] | null
}

interface AssignmentStudentForClient {
  bookingSessionId: string
  studentId: string
  studentType: StudentType
  name: string
  parentName: string | null
  isChild: boolean
  level: number | null
  levelName: string | null
  levelCategory: LevelCategory | null
  levelProgramName: string | null
  coachMemory: CoachMemoryEntry[]
  suggestedCoachId: string | null
  suggestedCoachName: string | null
}

interface ExistingAssignmentGroupForClient {
  id: string
  name: string
  coachId: string | null
  coachName: string | null
  levelMin: number | null
  levelMax: number | null
  sortOrder: number
  studentSessionIds: string[]
}

interface AssignmentSlotForClient {
  key: string
  scheduleSlotId: string | null
  branchId: string
  branchName: string
  courseTypeId: string
  courseType: string
  date: string
  startTime: string
  endTime: string
  legacyAssignedCoachId: string | null
  legacyAssignedCoachName: string | null
  suggestedCoachId: string | null
  suggestedCoachName: string | null
  suggestedCoachReason: string | null
  assignmentLocked: boolean
  assignmentLockReason: string | null
  students: AssignmentStudentForClient[]
  assignmentGroups: ExistingAssignmentGroupForClient[]
}

interface AssignGroupsPageProps {
  searchParams?: Promise<{
    month?: string | string[]
    assignmentDiag?: string | string[]
  }>
}

const ASSIGNMENT_MONTH_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/
const ASSIGNMENT_SESSION_PAGE_SIZE = 1000
const ASSIGNMENT_SESSION_MAX_PAGES = 100
const ASSIGNMENT_SUPPORTING_IN_BATCH_SIZE = 100
const ASSIGNMENT_SUPPORTING_MAX_BATCHES = 100

interface BookingSessionPageResult<T> {
  data: T[] | null
  error: { message: string } | null
  count: number | null
}

interface SupportingBatchResult<T> {
  data: T[] | null
  error: { message: string } | null
  count: number | null
}

async function collectCompleteBookingSessionPages<T extends { id: string }>(options: {
  context: string
  loadPage: (pageStart: number, pageEnd: number) => Promise<BookingSessionPageResult<T>>
}) {
  const rows: T[] = []
  const seenSessionIds = new Set<string>()
  let expectedTotal: number | null = null

  for (let pageIndex = 0; pageIndex < ASSIGNMENT_SESSION_MAX_PAGES; pageIndex += 1) {
    const pageStart = pageIndex * ASSIGNMENT_SESSION_PAGE_SIZE
    const pageEnd = pageStart + ASSIGNMENT_SESSION_PAGE_SIZE - 1
    const result = await options.loadPage(pageStart, pageEnd)

    if (result.error) {
      throw new CoachAssignmentDataUnavailableError(options.context, result.error.message)
    }
    if (!Array.isArray(result.data)) {
      throw new CoachAssignmentDataUnavailableError(options.context, 'query returned no row payload')
    }
    if (!Number.isInteger(result.count) || Number(result.count) < 0) {
      throw new CoachAssignmentDataUnavailableError(options.context, 'exact row count was unavailable')
    }
    if (expectedTotal === null) {
      expectedTotal = result.count
    } else if (expectedTotal !== result.count) {
      throw new CoachAssignmentDataUnavailableError(options.context, 'row count changed during pagination')
    }

    const pageRows = result.data
    for (const row of pageRows) {
      if (seenSessionIds.has(row.id)) {
        throw new CoachAssignmentDataUnavailableError(options.context, 'duplicate booking_session id during pagination')
      }
      seenSessionIds.add(row.id)
      rows.push(row)
    }

    if (pageRows.length < ASSIGNMENT_SESSION_PAGE_SIZE) {
      if (rows.length !== expectedTotal) {
        throw new CoachAssignmentDataUnavailableError(options.context, 'pagination ended before the exact row count')
      }
      return rows
    }
  }

  throw new CoachAssignmentDataUnavailableError(options.context, 'exceeded bounded pagination')
}

async function loadAssignmentSessionRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  branchIds: string[],
  queryStart: string,
  queryEnd: string,
) {
  return collectCompleteBookingSessionPages<SessionRow>({
    context: 'Head Coach assignment learner roster query failed',
    loadPage: async (pageStart, pageEnd) => supabase
      .from('booking_sessions')
      .select(`
        id, date, start_time, end_time, branch_id, child_id, schedule_slot_id, status,
        children(full_name, nickname),
        bookings!inner(user_id, course_type_id, status,
          profiles!bookings_user_id_fkey(full_name),
          course_types(name)
        )
      `, { count: 'exact' })
      .gte('date', queryStart)
      .lt('date', queryEnd)
      .in('branch_id', branchIds)
      .in('status', ['scheduled', 'completed', 'absent'])
      .eq('bookings.status', 'verified')
      .neq('status', 'rescheduled')
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
      .order('id', { ascending: true })
      .range(pageStart, pageEnd) as unknown as Promise<BookingSessionPageResult<SessionRow>>,
  })
}

async function loadCompleteSupportingBatches<T>(options: {
  values: readonly string[]
  context: string
  loadBatch: (values: string[]) => PromiseLike<SupportingBatchResult<T>>
}) {
  const uniqueValues = Array.from(new Set(options.values.filter(Boolean)))
  if (uniqueValues.length === 0) return [] as T[]

  const batchCount = Math.ceil(uniqueValues.length / ASSIGNMENT_SUPPORTING_IN_BATCH_SIZE)
  if (batchCount > ASSIGNMENT_SUPPORTING_MAX_BATCHES) {
    throw new CoachAssignmentDataUnavailableError(options.context, 'supporting query exceeded bounded IN batches')
  }

  const batches = Array.from({ length: batchCount }, (_, index) => uniqueValues.slice(
    index * ASSIGNMENT_SUPPORTING_IN_BATCH_SIZE,
    (index + 1) * ASSIGNMENT_SUPPORTING_IN_BATCH_SIZE,
  ))
  const results = await Promise.all(batches.map((batch) => options.loadBatch(batch)))

  return results.flatMap((result) => {
    if (result.error) {
      throw new CoachAssignmentDataUnavailableError(options.context, result.error.message)
    }
    if (!Array.isArray(result.data) || result.count !== result.data.length) {
      throw new CoachAssignmentDataUnavailableError(options.context, 'supporting query was incomplete')
    }
    return result.data
  })
}

function parseAssignmentMonth(value: string | string[] | undefined, currentBangkokMonth: string) {
  return typeof value === 'string' && ASSIGNMENT_MONTH_PATTERN.test(value)
    ? value
    : currentBangkokMonth
}

function getAssignmentMonthRange(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1

  return {
    monthStart: `${monthKey}-01`,
    nextMonthStart: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
  }
}

function getStudentRef(session: SessionRow) {
  const id = session.child_id || session.bookings?.user_id
  if (!id) return null

  return {
    id,
    type: session.child_id ? 'child' as const : 'adult' as const,
  }
}

function getStudentName(session: SessionRow) {
  if (session.child_id) {
    return session.children?.nickname || session.children?.full_name || 'เด็ก'
  }

  return session.bookings?.profiles?.full_name || 'ผู้เรียน'
}

function getStudentKey(student: { id: string; type: StudentType }) {
  return `${student.type}:${student.id}`
}

function buildLevelMap(levelRows: StudentLevelRow[]) {
  const map = new Map<string, StudentLevelRow>()
  levelRows.forEach((row) => {
    const key = getStudentKey({ id: row.student_id, type: row.student_type })
    if (!map.has(key)) map.set(key, row)
  })
  return map
}

function getBangkokSlotStart(date: string, startTime: string) {
  return new Date(`${date}T${startTime.slice(0, 8)}+07:00`)
}

function getAssignmentLockReason(date: string, startTime: string, now = new Date()) {
  const start = getBangkokSlotStart(date, startTime)
  if (now < start) return null
  return 'รอบเรียนนี้เริ่มหรือเลยเวลาเรียนแล้ว การมอบหมายย้อนหลังต้องเข้าทาง flow ตรวจสอบ attendance gap'
}

export default async function AssignGroupsPage({ searchParams }: AssignGroupsPageProps) {
  const requestHeaders = await headers()
  const assignmentDiagnosticSample = requestHeaders.get('x-assignment-diagnostic-sample')
  const pageStartedAt = new Date().toISOString()
  const pageStartedMs = performance.now()
  const logDiagnosticPhase = (
    phase: string,
    startedAt: string,
    startedMs: number,
    success: boolean,
    metrics: Record<string, number> = {},
  ) => {
    if (!assignmentDiagnosticSample) return
    console.info('[assignment-diagnostic]', {
      sampleId: assignmentDiagnosticSample,
      phase,
      startedAt,
      endedAt: new Date().toISOString(),
      durationMs: Number((performance.now() - startedMs).toFixed(1)),
      success,
      ...metrics,
    })
  }
  const now = new Date()
  const bangkokToday = getBangkokDateString(now)
  const currentBangkokMonth = bangkokToday.slice(0, 7)
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const selectedMonth = parseAssignmentMonth(resolvedSearchParams.month, currentBangkokMonth)
  const { monthStart, nextMonthStart } = getAssignmentMonthRange(selectedMonth)
  const queryStart = selectedMonth === currentBangkokMonth
    ? bangkokToday
    : monthStart
  const supabase = await createClient()
  const authStartedAt = new Date().toISOString()
  const authStartedMs = performance.now()
  const { data: { user } } = await supabase.auth.getUser()
  logDiagnosticPhase('assignment_authentication', authStartedAt, authStartedMs, Boolean(user), { callCount: 1 })
  if (!user) return null

  const profileStartedAt = new Date().toISOString()
  const profileStartedMs = performance.now()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as unknown as { data: { role: string } | null }
  logDiagnosticPhase('assignment_profile', profileStartedAt, profileStartedMs, Boolean(profile), {
    callCount: 1,
    rowCount: profile ? 1 : 0,
  })

  if (!profile || !['head_coach', 'super_admin'].includes(profile.role)) {
    redirect('/coach')
  }

  let branchIds: string[] = []
  let branchMap: Record<string, string> = {}
  const branchStartedAt = new Date().toISOString()
  const branchStartedMs = performance.now()

  if (profile.role === 'super_admin') {
    const { data: branches } = await supabase
      .from('branches')
      .select('id, name')
      .eq('is_active', true) as unknown as { data: BranchRow[] | null }

    branchIds = (branches || []).map((branch) => branch.id)
    branchMap = (branches || []).reduce((map, branch) => {
      map[branch.id] = branch.name
      return map
    }, {} as Record<string, string>)
  } else {
    const { data: coachBranches } = await supabase
      .from('coach_branches')
      .select('branch_id, branches(name)')
      .eq('coach_id', user.id) as unknown as { data: CoachBranchRow[] | null }

    branchIds = (coachBranches || []).map((branch) => branch.branch_id)
    branchMap = (coachBranches || []).reduce((map, branch) => {
      map[branch.branch_id] = branch.branches?.name || ''
      return map
    }, {} as Record<string, string>)
  }
  logDiagnosticPhase('assignment_branch_access', branchStartedAt, branchStartedMs, true, {
    callCount: 1,
    rowCount: branchIds.length,
  })

  const rosterStartedAt = new Date().toISOString()
  const rosterStartedMs = performance.now()
  const [coachBranchResult, sessionRows] = branchIds.length > 0
    ? await Promise.all([
        supabase
          .from('coach_branches')
          .select('coach_id, branch_id, profiles!coach_branches_coach_id_fkey(full_name, role)')
          .in('branch_id', branchIds) as unknown as PromiseLike<{
            data: CoachOptionRow[] | null
            error: { message: string } | null
          }>,
        loadAssignmentSessionRows(supabase, branchIds, queryStart, nextMonthStart),
      ])
    : [{ data: [] as CoachOptionRow[], error: null }, [] as SessionRow[]]
  logDiagnosticPhase('assignment_primary_roster_and_coaches', rosterStartedAt, rosterStartedMs, true, {
    callCount: branchIds.length > 0 ? 2 : 0,
    rosterRows: sessionRows.length,
    coachBranchRows: coachBranchResult.data?.length || 0,
    rosterPages: sessionRows.length === 0 ? 0 : Math.ceil(sessionRows.length / ASSIGNMENT_SESSION_PAGE_SIZE),
  })
  const allCoachBranches = requireCoachAssignmentQueryData(
    coachBranchResult,
    'Head Coach assignment coach option query failed',
  ) || []
  const coachMap = new Map<string, { id: string; name: string; role: string; branches: string[] }>()
  allCoachBranches.forEach((branch) => {
    if (!coachMap.has(branch.coach_id)) {
      coachMap.set(branch.coach_id, {
        id: branch.coach_id,
        name: branch.profiles?.full_name || 'Coach',
        role: branch.profiles?.role || 'coach',
        branches: [],
      })
    }
    coachMap.get(branch.coach_id)?.branches.push(branchMap[branch.branch_id] || '')
  })
  const coaches = Array.from(coachMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'th'))

  const slotIds = Array.from(new Set(sessionRows.map((row) => row.schedule_slot_id).filter(Boolean))) as string[]
  const studentRefs = sessionRows
    .map(getStudentRef)
    .filter((student): student is { id: string; type: StudentType } => Boolean(student))
  const studentIds = Array.from(new Set(studentRefs.map((student) => student.id)))

  const supportingStartedAt = new Date().toISOString()
  const supportingStartedMs = performance.now()
  const [legacyAssignments, assignmentGroups, levelRows, levelDefinitionResult] = await Promise.all([
    loadCompleteSupportingBatches<LegacyAssignmentRow>({
      values: slotIds,
      context: 'Head Coach assignment Legacy suggestion query failed',
      loadBatch: (batchSlotIds) => supabase
        .from('coach_assignments')
        .select('schedule_slot_id, coach_id, profiles!coach_assignments_coach_id_fkey(full_name)', { count: 'exact' })
        .in('schedule_slot_id', batchSlotIds) as unknown as PromiseLike<SupportingBatchResult<LegacyAssignmentRow>>,
    }),
    loadCompleteSupportingBatches<ExistingGroupRow>({
      values: slotIds,
      context: 'Head Coach assignment exact membership query failed',
      loadBatch: (batchSlotIds) => supabase
        .from('coach_assignment_groups')
        .select(`
          id, schedule_slot_id, coach_id, name, level_min, level_max, sort_order,
          profiles!coach_assignment_groups_coach_id_fkey(full_name),
          coach_assignment_group_students(booking_session_id)
        `, { count: 'exact' })
        .in('schedule_slot_id', batchSlotIds)
        .order('sort_order') as unknown as PromiseLike<SupportingBatchResult<ExistingGroupRow>>,
    }),
    loadCompleteSupportingBatches<StudentLevelRow>({
      values: studentIds,
      context: 'Head Coach assignment learner level query failed',
      loadBatch: (batchStudentIds) => supabase
        .from('student_levels')
        .select('student_id, student_type, level, created_at', { count: 'exact' })
        .in('student_id', batchStudentIds)
        .order('created_at', { ascending: false }) as unknown as PromiseLike<SupportingBatchResult<StudentLevelRow>>,
    }),
    supabase
      .from('levels')
      .select('id, name, category, program_name')
      .eq('is_active', true) as unknown as PromiseLike<{
        data: LevelRow[] | null
        error: { message: string } | null
      }>,
  ])
  const supportingBatchCount = Math.ceil(slotIds.length / ASSIGNMENT_SUPPORTING_IN_BATCH_SIZE)
    + Math.ceil(slotIds.length / ASSIGNMENT_SUPPORTING_IN_BATCH_SIZE)
    + Math.ceil(studentIds.length / ASSIGNMENT_SUPPORTING_IN_BATCH_SIZE)
  logDiagnosticPhase('assignment_supporting_reads', supportingStartedAt, supportingStartedMs, true, {
    callCount: supportingBatchCount + 1,
    supportingBatches: supportingBatchCount,
    legacyRows: legacyAssignments.length,
    groupRows: assignmentGroups.length,
    levelRows: levelRows.length,
    levelDefinitionRows: levelDefinitionResult.data?.length || 0,
  })
  const levelDefinitions = requireCoachAssignmentQueryData(
    levelDefinitionResult,
    'Head Coach assignment level definition query failed',
  ) || []

  const legacyAssignmentMap = (legacyAssignments || []).reduce((map, item) => {
    if (!map[item.schedule_slot_id]) {
      map[item.schedule_slot_id] = {
        coachId: item.coach_id,
        coachName: item.profiles?.full_name || 'Coach',
      }
    }
    return map
  }, {} as Record<string, { coachId: string; coachName: string }>)

  const activeSessionIdsBySlot = sessionRows.reduce((map, session) => {
    if (!session.schedule_slot_id) return map
    if (!map[session.schedule_slot_id]) map[session.schedule_slot_id] = new Set<string>()
    map[session.schedule_slot_id].add(session.id)
    return map
  }, {} as Record<string, Set<string>>)

  const assignmentGroupsBySlot = (assignmentGroups || []).reduce((map, group) => {
    const activeSessionIds = activeSessionIdsBySlot[group.schedule_slot_id] || new Set<string>()
    const studentSessionIds = (group.coach_assignment_group_students || [])
      .map((student) => student.booking_session_id)
      .filter((sessionId) => activeSessionIds.has(sessionId))
    if (studentSessionIds.length === 0) return map

    if (!map[group.schedule_slot_id]) map[group.schedule_slot_id] = []
    map[group.schedule_slot_id].push({
      id: group.id,
      name: group.name,
      coachId: group.coach_id,
      coachName: group.profiles?.full_name || null,
      levelMin: group.level_min,
      levelMax: group.level_max,
      sortOrder: group.sort_order,
      studentSessionIds,
    })
    return map
  }, {} as Record<string, ExistingAssignmentGroupForClient[]>)

  const latestLevelMap = buildLevelMap(levelRows || [])
  const levelDefinitionMap = new Map((levelDefinitions || []).map((level) => [level.id, level]))

  const slots = Object.values(sessionRows.reduce((map, session) => {
    const key = session.schedule_slot_id || `${session.date}-${session.branch_id}-${session.start_time}-${session.end_time}-${session.bookings?.course_type_id}`
    if (!map[key]) {
      const legacyAssignment = session.schedule_slot_id ? legacyAssignmentMap[session.schedule_slot_id] : null
      map[key] = {
        key,
        scheduleSlotId: session.schedule_slot_id || null,
        branchId: session.branch_id,
        branchName: branchMap[session.branch_id] || 'ไม่ทราบสาขา',
        courseTypeId: session.bookings?.course_type_id || '',
        courseType: session.bookings?.course_types?.name || '',
        date: session.date,
        startTime: session.start_time,
        endTime: session.end_time,
        legacyAssignedCoachId: legacyAssignment?.coachId || null,
        legacyAssignedCoachName: legacyAssignment?.coachName || null,
        suggestedCoachId: null,
        suggestedCoachName: null,
        suggestedCoachReason: null,
        assignmentLocked: Boolean(getAssignmentLockReason(session.date, session.start_time, now)),
        assignmentLockReason: getAssignmentLockReason(session.date, session.start_time, now),
        students: [],
        assignmentGroups: session.schedule_slot_id ? assignmentGroupsBySlot[session.schedule_slot_id] || [] : [],
      }
    }

    const studentRef = getStudentRef(session)
    const latestLevel = studentRef ? latestLevelMap.get(getStudentKey(studentRef)) : null
    const levelDefinition = latestLevel ? levelDefinitionMap.get(latestLevel.level) : null

    map[key].students.push({
      bookingSessionId: session.id,
      studentId: studentRef?.id || '',
      studentType: studentRef?.type || 'adult',
      name: getStudentName(session),
      parentName: session.child_id ? (session.bookings?.profiles?.full_name || null) : null,
      isChild: Boolean(session.child_id),
      level: latestLevel?.level ?? 0,
      levelName: levelDefinition?.name || 'Level 0',
      levelCategory: levelDefinition?.category || null,
      levelProgramName: levelDefinition?.program_name || null,
      coachMemory: [],
      suggestedCoachId: null,
      suggestedCoachName: null,
    })

    return map
  }, {} as Record<string, AssignmentSlotForClient>)).sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))

  logDiagnosticPhase('assignment_response_assembly', supportingStartedAt, supportingStartedMs, true, {
    slotCount: slots.length,
    rosterRows: sessionRows.length,
  })
  logDiagnosticPhase('assignment_server_render_complete', pageStartedAt, pageStartedMs, true, {
    slotCount: slots.length,
    rosterRows: sessionRows.length,
  })

  return (
    <AssignGroupsClient
      coaches={coaches}
      slots={slots}
      currentUserId={user.id}
      selectedMonth={selectedMonth}
      coachMemoryEnabled={selectedMonth === currentBangkokMonth}
    />
  )
}
