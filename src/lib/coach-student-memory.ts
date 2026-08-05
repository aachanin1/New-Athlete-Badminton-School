import type { StudentType, UserRole } from '@/types/database'
import {
  CoachAssignmentDataUnavailableError,
  classifyCoachAssignmentSessionProvenance,
  getExactModelSlotIds,
  loadWalletRedeemedSessionIds,
  requireCoachAssignmentQueryData,
} from '@/lib/coach-assignment-resolution'

type SupabaseQuery = PromiseLike<unknown> & {
  eq: (column: string, value: unknown) => SupabaseQuery
  in: (column: string, values: readonly unknown[]) => SupabaseQuery
  lte: (column: string, value: unknown) => SupabaseQuery
  neq: (column: string, value: unknown) => SupabaseQuery
  is: (column: string, value: unknown) => SupabaseQuery
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQuery
}

type SupabaseTable = {
  select: (columns: string) => SupabaseQuery
}

type SupabaseLike = {
  from: (table: string) => SupabaseTable
}

export interface StudentRef {
  id: string
  type: StudentType
}

export interface CoachMemoryEntry {
  coachId: string
  coachName: string
  coachRole: UserRole | null
  totalSessions: number
  lastTaughtDate: string
  branchNames: string[]
  courseTypes: string[]
}

export interface StudentCoachMemory {
  studentId: string
  studentType: StudentType
  coaches: CoachMemoryEntry[]
  suggestedCoach: CoachMemoryEntry | null
}

export interface CoachMemoryReadMetrics {
  callsByTable: Record<string, number>
  rowsByTable: Record<string, number>
  requestDurationMsByTable: Record<string, number>
  bookingSessionPages: number
  supportingBatches: number
}

type CompleteQueryMethod = 'eq' | 'in' | 'is' | 'lte' | 'neq' | 'order'

interface CompleteQueryResult {
  data: Array<{ id?: string } & Record<string, unknown>> | null
  error: { message: string } | null
  count: number | null
}

interface CompleteQuery extends PromiseLike<CompleteQueryResult> {
  eq: (...args: unknown[]) => CompleteQuery
  in: (...args: unknown[]) => CompleteQuery
  is: (...args: unknown[]) => CompleteQuery
  lte: (...args: unknown[]) => CompleteQuery
  neq: (...args: unknown[]) => CompleteQuery
  order: (...args: unknown[]) => CompleteQuery
  range: (from: number, to: number) => CompleteQuery
}

interface CompleteSupabaseClient {
  from: (table: string) => {
    select: (columns: string, options?: { count: 'exact' }) => CompleteQuery
  }
}

const COACH_MEMORY_SESSION_PAGE_SIZE = 1000
const COACH_MEMORY_SESSION_MAX_PAGES = 100
const COACH_MEMORY_SUPPORTING_IN_BATCH_SIZE = 100
const COACH_MEMORY_SUPPORTING_MAX_BATCHES = 100

export function createCoachMemoryReadMetrics(): CoachMemoryReadMetrics {
  return {
    callsByTable: {},
    rowsByTable: {},
    requestDurationMsByTable: {},
    bookingSessionPages: 0,
    supportingBatches: 0,
  }
}

function recordCoachMemoryRead(
  metrics: CoachMemoryReadMetrics,
  table: string,
  rowCount: number,
  startedAt: number,
) {
  metrics.callsByTable[table] = (metrics.callsByTable[table] || 0) + 1
  metrics.rowsByTable[table] = (metrics.rowsByTable[table] || 0) + rowCount
  metrics.requestDurationMsByTable[table] = Number((
    (metrics.requestDurationMsByTable[table] || 0) + (performance.now() - startedAt)
  ).toFixed(1))
}

function applyCompleteQueryOperation(
  query: CompleteQuery,
  operation: { method: CompleteQueryMethod; args: unknown[] },
) {
  if (operation.method === 'eq') return query.eq(...operation.args)
  if (operation.method === 'in') return query.in(...operation.args)
  if (operation.method === 'is') return query.is(...operation.args)
  if (operation.method === 'lte') return query.lte(...operation.args)
  if (operation.method === 'neq') return query.neq(...operation.args)
  return query.order(...operation.args)
}

function createCompleteBookingSessionQuery(
  supabase: CompleteSupabaseClient,
  columns: string,
  metrics: CoachMemoryReadMetrics,
) {
  const operations: Array<{ method: CompleteQueryMethod; args: unknown[] }> = []

  const load = async () => {
    const rows: Array<{ id?: string } & Record<string, unknown>> = []
    const seenSessionIds = new Set<string>()
    let expectedTotal: number | null = null

    for (let pageIndex = 0; pageIndex < COACH_MEMORY_SESSION_MAX_PAGES; pageIndex += 1) {
      const pageStart = pageIndex * COACH_MEMORY_SESSION_PAGE_SIZE
      const pageEnd = pageStart + COACH_MEMORY_SESSION_PAGE_SIZE - 1
      let query = supabase.from('booking_sessions').select(columns, { count: 'exact' })
      for (const operation of operations) {
        query = applyCompleteQueryOperation(query, operation)
      }

      const startedAt = performance.now()
      const result = await query
        .order('id', { ascending: true })
        .range(pageStart, pageEnd)
      metrics.bookingSessionPages += 1
      recordCoachMemoryRead(metrics, 'booking_sessions', result.data?.length || 0, startedAt)

      if (result.error) {
        throw new CoachAssignmentDataUnavailableError('Coach memory booking-session query failed', result.error.message)
      }
      if (!Array.isArray(result.data)) {
        throw new CoachAssignmentDataUnavailableError('Coach memory booking-session query failed', 'query returned no row payload')
      }
      if (!Number.isInteger(result.count) || Number(result.count) < 0) {
        throw new CoachAssignmentDataUnavailableError('Coach memory booking-session query failed', 'exact row count was unavailable')
      }
      if (expectedTotal === null) {
        expectedTotal = result.count
      } else if (expectedTotal !== result.count) {
        throw new CoachAssignmentDataUnavailableError('Coach memory booking-session query failed', 'row count changed during pagination')
      }

      for (const row of result.data) {
        if (!row.id) {
          throw new CoachAssignmentDataUnavailableError('Coach memory booking-session query failed', 'booking_session id was unavailable')
        }
        if (seenSessionIds.has(row.id)) {
          throw new CoachAssignmentDataUnavailableError('Coach memory booking-session query failed', 'duplicate booking_session id during pagination')
        }
        seenSessionIds.add(row.id)
        rows.push(row)
      }

      if (result.data.length < COACH_MEMORY_SESSION_PAGE_SIZE) {
        if (rows.length !== expectedTotal) {
          throw new CoachAssignmentDataUnavailableError('Coach memory booking-session query failed', 'pagination ended before the exact row count')
        }
        return rows
      }
    }

    throw new CoachAssignmentDataUnavailableError('Coach memory booking-session query failed', 'exceeded bounded pagination')
  }

  const queryProxy = new Proxy({} as CompleteQuery, {
    get(_target, property) {
      if (property === 'then') {
        return (onFulfilled: ((value: CompleteQueryResult) => unknown) | undefined, onRejected: ((reason: unknown) => unknown) | undefined) => (
          load()
            .then((data) => ({ data, error: null, count: data.length }))
            .then(onFulfilled, onRejected)
        )
      }
      if (typeof property === 'string' && ['eq', 'in', 'is', 'lte', 'neq', 'order'].includes(property)) {
        return (...args: unknown[]) => {
          operations.push({ method: property as CompleteQueryMethod, args })
          return queryProxy
        }
      }
      return undefined
    },
  })

  return queryProxy
}

function createCompleteSupportingQuery(
  supabase: CompleteSupabaseClient,
  table: string,
  columns: string,
  metrics: CoachMemoryReadMetrics,
) {
  const operations: Array<{ method: CompleteQueryMethod; args: unknown[] }> = []

  const load = async (): Promise<CompleteQueryResult> => {
    const oversizedInOperations = operations
      .map((operation, index) => ({ operation, index }))
      .filter(({ operation }) => (
        operation.method === 'in'
        && Array.isArray(operation.args[1])
        && operation.args[1].length > COACH_MEMORY_SUPPORTING_IN_BATCH_SIZE
      ))
    if (oversizedInOperations.length > 1) {
      throw new CoachAssignmentDataUnavailableError(`Coach memory ${table} query failed`, 'supporting query exceeded bounded IN dimensions')
    }

    const oversizedInOperation = oversizedInOperations[0]
    const inValues = oversizedInOperation
      ? Array.from(new Set(oversizedInOperation.operation.args[1] as unknown[]))
      : null
    const batchCount = inValues
      ? Math.ceil(inValues.length / COACH_MEMORY_SUPPORTING_IN_BATCH_SIZE)
      : 1
    if (batchCount > COACH_MEMORY_SUPPORTING_MAX_BATCHES) {
      throw new CoachAssignmentDataUnavailableError(`Coach memory ${table} query failed`, 'supporting query exceeded bounded IN batches')
    }

    const batches = inValues
      ? Array.from({ length: batchCount }, (_, index) => inValues.slice(
          index * COACH_MEMORY_SUPPORTING_IN_BATCH_SIZE,
          (index + 1) * COACH_MEMORY_SUPPORTING_IN_BATCH_SIZE,
        ))
      : [null]
    metrics.supportingBatches += batches.length

    const pages = await Promise.all(batches.map(async (batchValues) => {
      let query = supabase.from(table).select(columns, { count: 'exact' })
      operations.forEach((operation, index) => {
        query = applyCompleteQueryOperation(query, batchValues && index === oversizedInOperation?.index
          ? { ...operation, args: [operation.args[0], batchValues] }
          : operation)
      })

      const startedAt = performance.now()
      const result = await query
      recordCoachMemoryRead(metrics, table, result.data?.length || 0, startedAt)
      if (result.error) {
        throw new CoachAssignmentDataUnavailableError(`Coach memory ${table} query failed`, result.error.message)
      }
      if (!Array.isArray(result.data) || result.count !== result.data.length) {
        throw new CoachAssignmentDataUnavailableError(`Coach memory ${table} query failed`, 'supporting query was incomplete')
      }
      return result.data
    }))

    const data = pages.flat()
    return { data, error: null, count: data.length }
  }

  const queryProxy = new Proxy({} as CompleteQuery, {
    get(_target, property) {
      if (property === 'then') {
        return (onFulfilled: ((value: CompleteQueryResult) => unknown) | undefined, onRejected: ((reason: unknown) => unknown) | undefined) => (
          load().then(onFulfilled, onRejected)
        )
      }
      if (typeof property === 'string' && ['eq', 'in', 'is', 'lte', 'neq', 'order'].includes(property)) {
        return (...args: unknown[]) => {
          operations.push({ method: property as CompleteQueryMethod, args })
          return queryProxy
        }
      }
      return undefined
    },
  })

  return queryProxy
}

export function createCompleteCoachMemoryReadClient(
  supabaseClient: unknown,
  metrics = createCoachMemoryReadMetrics(),
) {
  const supabase = supabaseClient as CompleteSupabaseClient
  return {
    from(table: string) {
      return {
        select(columns: string) {
          return table === 'booking_sessions'
            ? createCompleteBookingSessionQuery(supabase, columns, metrics)
            : createCompleteSupportingQuery(supabase, table, columns, metrics)
        },
      }
    },
  }
}

interface BookingSessionMemoryRow {
  id: string
  schedule_slot_id: string | null
  child_id: string | null
  date: string
  status: string
  rescheduled_from_id: string | null
  is_makeup: boolean | null
  branches?: { name: string | null } | null
  bookings?: {
    user_id: string
    learner_type: 'self' | 'child'
    status: string
    course_types?: { name: string | null } | null
  } | null
}

interface CoachAssignmentMemoryRow {
  schedule_slot_id: string
  coach_id: string
  profiles?: {
    full_name: string | null
    role: UserRole | null
  } | null
}

interface AssignmentGroupStudentMemoryRow {
  booking_session_id: string
  coach_assignment_groups?: {
    coach_id: string | null
    profiles?: {
      full_name: string | null
      role: UserRole | null
    } | null
  } | null
}

interface AssignmentGroupSlotRow {
  schedule_slot_id: string
}

interface MemoryCoachAssignment {
  coach_id: string
  profiles?: {
    full_name: string | null
    role: UserRole | null
  } | null
}

const LEARNED_BOOKING_STATUSES = ['verified']
const LEARNED_SESSION_STATUSES = ['completed', 'absent', 'scheduled']
const COACH_STUDENT_HISTORY_EXACT_MEMBERSHIP_BATCH_SIZE = 100

function getStudentKey(type: StudentType, id: string) {
  return `${type}:${id}`
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function isKnownStudent(refs: Set<string>, type: StudentType, id: string) {
  return refs.has(getStudentKey(type, id))
}

function rankCoach(a: CoachMemoryEntry, b: CoachMemoryEntry) {
  if (b.totalSessions !== a.totalSessions) return b.totalSessions - a.totalSessions
  return b.lastTaughtDate.localeCompare(a.lastTaughtDate)
}

export async function loadCoachStudentHistoryExactMembershipRows(
  supabaseClient: unknown,
  sessionIds: readonly string[],
) {
  const supabase = supabaseClient as SupabaseLike
  const uniqueSessionIds = Array.from(new Set(sessionIds.filter(Boolean)))
  if (uniqueSessionIds.length === 0) return [] as AssignmentGroupStudentMemoryRow[]

  const results = await Promise.all(
    Array.from(
      {
        length: Math.ceil(
          uniqueSessionIds.length / COACH_STUDENT_HISTORY_EXACT_MEMBERSHIP_BATCH_SIZE,
        ),
      },
      (_, index) => uniqueSessionIds.slice(
        index * COACH_STUDENT_HISTORY_EXACT_MEMBERSHIP_BATCH_SIZE,
        (index + 1) * COACH_STUDENT_HISTORY_EXACT_MEMBERSHIP_BATCH_SIZE,
      ),
    ).map((batchIds) => supabase
      .from('coach_assignment_group_students')
      .select(`
        booking_session_id,
        coach_assignment_groups!inner(
          coach_id,
          profiles!coach_assignment_groups_coach_id_fkey(full_name, role)
        )
      `)
      .in('booking_session_id', batchIds) as PromiseLike<{
        data: AssignmentGroupStudentMemoryRow[] | null
        error?: { message: string } | null
      }>),
  )

  return results.flatMap((result, index) => (
    requireCoachAssignmentQueryData(
      result,
      `Coach student history exact membership query batch ${index + 1} failed`,
    ) || []
  ))
}

export async function getCoachStudentMemoryMap(
  supabaseClient: unknown,
  students: StudentRef[],
): Promise<Record<string, StudentCoachMemory>> {
  const supabase = supabaseClient as SupabaseLike
  const uniqueStudents = Array.from(new Map(students.map((student) => [getStudentKey(student.type, student.id), student])).values())
  const childIds = uniqueStudents.filter((student) => student.type === 'child').map((student) => student.id)
  const adultIds = uniqueStudents.filter((student) => student.type === 'adult').map((student) => student.id)

  const emptyMap = uniqueStudents.reduce((map, student) => {
    const key = getStudentKey(student.type, student.id)
    map[key] = {
      studentId: student.id,
      studentType: student.type,
      coaches: [],
      suggestedCoach: null,
    }
    return map
  }, {} as Record<string, StudentCoachMemory>)

  if (uniqueStudents.length === 0) return emptyMap

  const today = new Date().toISOString().split('T')[0]
  const sessionQueries: PromiseLike<{
    data: BookingSessionMemoryRow[] | null
    error?: { message: string } | null
  }>[] = []

  if (childIds.length > 0) {
    sessionQueries.push(supabase
      .from('booking_sessions')
      .select(`
        id, schedule_slot_id, child_id, date, status, rescheduled_from_id, is_makeup,
        branches(name),
        bookings!inner(user_id, learner_type, status, course_types(name))
      `)
      .in('child_id', childIds)
      .in('status', LEARNED_SESSION_STATUSES)
      .in('bookings.status', LEARNED_BOOKING_STATUSES)
      .neq('status', 'rescheduled')
      .lte('date', today)
      .order('date', { ascending: false }) as PromiseLike<{
        data: BookingSessionMemoryRow[] | null
        error?: { message: string } | null
      }>)
  }

  if (adultIds.length > 0) {
    sessionQueries.push(supabase
      .from('booking_sessions')
      .select(`
        id, schedule_slot_id, child_id, date, status, rescheduled_from_id, is_makeup,
        branches(name),
        bookings!inner(user_id, learner_type, status, course_types(name))
      `)
      .is('child_id', null)
      .in('bookings.user_id', adultIds)
      .eq('bookings.learner_type', 'self')
      .in('status', LEARNED_SESSION_STATUSES)
      .in('bookings.status', LEARNED_BOOKING_STATUSES)
      .neq('status', 'rescheduled')
      .lte('date', today)
      .order('date', { ascending: false }) as PromiseLike<{
        data: BookingSessionMemoryRow[] | null
        error?: { message: string } | null
      }>)
  }

  const sessionResults = await Promise.all(sessionQueries)
  const sessions = sessionResults.flatMap((result, index) => (
    requireCoachAssignmentQueryData(
      result,
      `Coach student history session query ${index + 1} failed`,
    ) || []
  ))
  const slotIds = unique(sessions.map((session) => session.schedule_slot_id || ''))

  if (slotIds.length === 0) return emptyMap

  const sessionIds = unique(sessions.map((session) => session.id))
  const groupStudents = await loadCoachStudentHistoryExactMembershipRows(
    supabase,
    sessionIds,
  )

  const groupStudentMap = new Map<string, MemoryCoachAssignment[]>()
  ;(groupStudents || []).forEach((row) => {
    const group = row.coach_assignment_groups
    if (!group?.coach_id) return
    if (!groupStudentMap.has(row.booking_session_id)) groupStudentMap.set(row.booking_session_id, [])
    groupStudentMap.get(row.booking_session_id)?.push({
      coach_id: group.coach_id,
      profiles: group.profiles || null,
    })
  })

  const [assignmentResult, exactGroupResult] = await Promise.all([
    supabase
      .from('coach_assignments')
      .select('schedule_slot_id, coach_id, profiles!coach_assignments_coach_id_fkey(full_name, role)')
      .in('schedule_slot_id', slotIds) as unknown as PromiseLike<{
        data: CoachAssignmentMemoryRow[] | null
        error?: { message: string } | null
      }>,
    supabase
      .from('coach_assignment_groups')
      .select('schedule_slot_id')
      .in('schedule_slot_id', slotIds) as unknown as PromiseLike<{
        data: AssignmentGroupSlotRow[] | null
        error?: { message: string } | null
      }>,
  ])
  const assignments = requireCoachAssignmentQueryData(
    assignmentResult,
    'Coach student history Legacy assignment query failed',
  ) || []
  const exactGroupSlots = requireCoachAssignmentQueryData(
    exactGroupResult,
    'Coach student history exact-model boundary query failed',
  ) || []
  const exactModelSlotIds = getExactModelSlotIds(exactGroupSlots)
  const walletRedeemedSessionIds = await loadWalletRedeemedSessionIds(
    supabase,
    sessions,
    'Coach student history',
  )

  const assignmentMap = new Map<string, CoachAssignmentMemoryRow[]>()
  ;assignments.forEach((assignment) => {
    if (!assignment.schedule_slot_id) return
    if (!assignmentMap.has(assignment.schedule_slot_id)) assignmentMap.set(assignment.schedule_slot_id, [])
    assignmentMap.get(assignment.schedule_slot_id)?.push(assignment)
  })

  const knownRefs = new Set(uniqueStudents.map((student) => getStudentKey(student.type, student.id)))
  const memory = { ...emptyMap }

  const addCoachMemory = (
    key: string,
    assignment: MemoryCoachAssignment,
    session: BookingSessionMemoryRow,
  ) => {
    const booking = session.bookings
    const existing = memory[key].coaches.find((coach) => coach.coachId === assignment.coach_id)
    const branchName = session.branches?.name || ''
    const courseType = booking?.course_types?.name || ''

    if (existing) {
      existing.totalSessions += 1
      if (session.date > existing.lastTaughtDate) existing.lastTaughtDate = session.date
      existing.branchNames = unique([...existing.branchNames, branchName])
      existing.courseTypes = unique([...existing.courseTypes, courseType])
      return
    }

    memory[key].coaches.push({
      coachId: assignment.coach_id,
      coachName: assignment.profiles?.full_name || 'Coach',
      coachRole: assignment.profiles?.role || null,
      totalSessions: 1,
      lastTaughtDate: session.date,
      branchNames: unique([branchName]),
      courseTypes: unique([courseType]),
    })
  }

  for (const session of sessions) {
    const booking = session.bookings
    const studentType: StudentType = session.child_id ? 'child' : 'adult'
    const studentId = session.child_id || booking?.user_id
    if (!studentId || !isKnownStudent(knownRefs, studentType, studentId)) continue
    if (!session.schedule_slot_id) continue

    const key = getStudentKey(studentType, studentId)
    const groupAssignments = groupStudentMap.get(session.id) || []
    const legacyAllowed = classifyCoachAssignmentSessionProvenance(
      session,
      walletRedeemedSessionIds,
    ) !== 'user_reschedule'
    const relatedAssignments = groupAssignments.length > 0
      ? groupAssignments
      : exactModelSlotIds.has(session.schedule_slot_id)
        ? []
        : legacyAllowed
          ? assignmentMap.get(session.schedule_slot_id) || []
          : []

    for (const assignment of relatedAssignments) {
      addCoachMemory(key, assignment, session)
    }
  }

  Object.values(memory).forEach((item) => {
    item.coaches.sort(rankCoach)
    item.suggestedCoach = item.coaches[0] || null
  })

  return memory
}

export function getCoachMemoryKey(student: StudentRef) {
  return getStudentKey(student.type, student.id)
}
