import { createClient } from '@/lib/supabase/server'
import { SchedulesClient } from '@/components/admin/schedules-client'
import { getServiceRoleClient, requireAdminPageAccess } from '@/lib/auth/admin'
import {
  buildAdminAttendanceState,
  getAdminAttendanceScopeSessionIds,
  type AdminAttendanceGroupRow,
  type AdminAttendanceSlotSessionRow,
} from '@/lib/admin-attendance-state'
import {
  type AttendanceSessionRow,
} from '@/lib/session-attendance-status'
import type { LevelCategory, ProgramStatus, StudentType } from '@/types/database'

interface ScheduleSessionRow {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  is_makeup: boolean | null
  child_id: string | null
  schedule_slot_id: string | null
  branch_id: string
  branches?: { name: string | null } | null
  children?: { full_name: string | null; nickname: string | null } | null
  bookings?: {
    id: string
    user_id: string
    learner_type: string
    course_type_id: string
    status: string
    profiles?: { full_name: string | null } | null
    course_types?: { name: string | null } | null
  } | null
}

interface BranchRow {
  id: string
  name: string
  slug: string
}

interface GroupRow extends AdminAttendanceGroupRow {
  id: string
  schedule_slot_id: string
  coach_id: string | null
  name: string
  level_min: number | null
  level_max: number | null
  sort_order: number
  profiles?: { full_name: string | null } | null
  coach_assignment_group_students: { booking_session_id: string }[] | null
}

type SlotSessionRow = AdminAttendanceSlotSessionRow

type AttendanceRow = AttendanceSessionRow

interface WalletCreditRow {
  original_session_id: string
  status: 'active' | 'redeemed' | 'expired'
}

interface StudentRef {
  id: string
  type: StudentType
}

interface StudentLevelRow {
  student_id: string
  student_type: StudentType
  level: number
  created_at: string
}

interface LevelRow {
  id: number
  name: string
  category: LevelCategory
}

interface TeachingProgramRow {
  id: string
  coach_id: string
  schedule_slot_id: string
  program_content: string
  status: ProgramStatus
  created_at: string
  updated_at: string
}

interface AttendanceQueryResult {
  data: AttendanceRow[] | null
  error: { message: string } | null
}

interface ScheduleSessionQueryResult {
  data: ScheduleSessionRow[] | null
  error: { message: string } | null
}

interface BranchQueryResult {
  data: BranchRow[] | null
  error: { message: string } | null
}

interface WalletCreditQueryResult {
  data: WalletCreditRow[] | null
  error: { message: string } | null
}

interface GroupQueryResult {
  data: GroupRow[] | null
  error: { message: string } | null
}

interface SlotSessionQueryResult {
  data: SlotSessionRow[] | null
  error: { message: string } | null
}

interface StudentLevelQueryResult {
  data: StudentLevelRow[] | null
  error: { message: string } | null
}

interface LevelQueryResult {
  data: LevelRow[] | null
  error: { message: string } | null
}

interface TeachingProgramQueryResult {
  data: TeachingProgramRow[] | null
  error: { message: string } | null
}

interface SchedulesPageProps {
  searchParams?: Promise<{
    year?: string
    month?: string
  }>
}

const ATTENDANCE_QUERY_CHUNK_SIZE = 100
const RELATED_QUERY_CHUNK_SIZE = 100
const SCHEDULE_SESSION_PAGE_SIZE = 1000

function getCurrentMonthParams() {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  }
}

function parseMonthParams(searchParams: { year?: string; month?: string }) {
  const current = getCurrentMonthParams()
  const year = Number(searchParams.year)
  const month = Number(searchParams.month)

  if (
    !Number.isInteger(year)
    || !Number.isInteger(month)
    || year < 2000
    || year > 2100
    || month < 1
    || month > 12
  ) {
    return current
  }

  return { year, month }
}

function getMonthDateRange(year: number, month: number) {
  const lastDay = new Date(year, month, 0).getDate()
  return {
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  }
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }

  return chunks
}

function getStudentRef(session: ScheduleSessionRow): StudentRef | null {
  if (session.child_id) return { id: session.child_id, type: 'child' }
  if (session.bookings?.user_id) return { id: session.bookings.user_id, type: 'adult' }
  return null
}

function getStudentKey(student: StudentRef) {
  return `${student.type}:${student.id}`
}

function getRoundKey(session: ScheduleSessionRow) {
  if (session.schedule_slot_id) return `slot:${session.schedule_slot_id}`
  return [
    'fallback',
    session.date,
    session.start_time,
    session.end_time,
    session.branch_id,
    session.bookings?.course_type_id || 'unknown-course',
  ].join(':')
}

function buildLatestLevelMap(levelRows: StudentLevelRow[]) {
  const map = new Map<string, StudentLevelRow>()

  levelRows.forEach((row) => {
    const key = getStudentKey({ id: row.student_id, type: row.student_type })
    if (!map.has(key)) map.set(key, row)
  })

  return map
}

function getProgramKey(scheduleSlotId: string, coachId: string) {
  return `${scheduleSlotId}:${coachId}`
}

function buildLatestTeachingProgramMap(programRows: TeachingProgramRow[]) {
  const map = new Map<string, TeachingProgramRow>()

  programRows.forEach((program) => {
    const key = getProgramKey(program.schedule_slot_id, program.coach_id)
    const current = map.get(key)
    if (!current || program.updated_at.localeCompare(current.updated_at) > 0) {
      map.set(key, program)
    }
  })

  return map
}

async function fetchScheduleSessionsForMonth(
  supabase: Awaited<ReturnType<typeof createClient>>,
  startDate: string,
  endDate: string,
) {
  const sessions: ScheduleSessionRow[] = []

  for (let start = 0; ; start += SCHEDULE_SESSION_PAGE_SIZE) {
    const end = start + SCHEDULE_SESSION_PAGE_SIZE - 1
    const { data, error } = await (supabase
      .from('booking_sessions')
      .select(`
        id, date, start_time, end_time, status, is_makeup, child_id, schedule_slot_id, branch_id,
        branches(name),
        children(full_name, nickname),
        bookings!inner(
          id, user_id, learner_type, course_type_id, status,
          profiles!bookings_user_id_fkey(full_name),
          course_types(name)
        )
      `)
      .eq('bookings.status', 'verified')
      .neq('status', 'rescheduled')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
      .order('id', { ascending: true })
      .range(start, end) as unknown as Promise<ScheduleSessionQueryResult>)

    if (error) {
      throw new Error(`Admin schedule sessions query failed: ${error.message}`)
    }

    const rows = data || []
    sessions.push(...rows)

    if (rows.length < SCHEDULE_SESSION_PAGE_SIZE) break
  }

  return sessions
}

async function fetchWalletCreditsByOriginalSessionIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionIds: string[],
) {
  const walletCredits: WalletCreditRow[] = []

  for (const chunk of chunkArray(sessionIds, RELATED_QUERY_CHUNK_SIZE)) {
    const { data, error } = await (supabase
      .from('lesson_wallet_credits')
      .select('original_session_id, status')
      .in('original_session_id', chunk) as unknown as Promise<WalletCreditQueryResult>)

    if (error) {
      throw new Error(`Admin schedule wallet credits query failed: ${error.message}`)
    }

    walletCredits.push(...(data || []))
  }

  return walletCredits
}

async function fetchGroupsBySlotIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slotIds: string[],
) {
  const groups: GroupRow[] = []

  for (const chunk of chunkArray(slotIds, RELATED_QUERY_CHUNK_SIZE)) {
    const { data, error } = await (supabase
      .from('coach_assignment_groups')
      .select(`
        id,
        schedule_slot_id,
        coach_id,
        name,
        level_min,
        level_max,
        sort_order,
        profiles!coach_assignment_groups_coach_id_fkey(full_name),
        coach_assignment_group_students(booking_session_id)
      `)
      .in('schedule_slot_id', chunk) as unknown as Promise<GroupQueryResult>)

    if (error) {
      throw new Error(`Admin schedule assignment groups query failed: ${error.message}`)
    }

    groups.push(...(data || []))
  }

  return groups
}

async function fetchSlotSessionsBySlotIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slotIds: string[],
  startDate: string,
  endDate: string,
) {
  const slotSessions: SlotSessionRow[] = []

  for (const chunk of chunkArray(slotIds, RELATED_QUERY_CHUNK_SIZE)) {
    for (let start = 0; ; start += SCHEDULE_SESSION_PAGE_SIZE) {
      const end = start + SCHEDULE_SESSION_PAGE_SIZE - 1
      const { data, error } = await (supabase
        .from('booking_sessions')
        .select('id, schedule_slot_id, bookings!inner(status)')
        .in('schedule_slot_id', chunk)
        .neq('status', 'rescheduled')
        .neq('status', 'walleted')
        .eq('bookings.status', 'verified')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
        .order('id', { ascending: true })
        .range(start, end) as unknown as Promise<SlotSessionQueryResult>)

      if (error) {
        throw new Error(`Admin schedule slot sessions query failed: ${error.message}`)
      }

      const rows = data || []
      slotSessions.push(...rows)

      if (rows.length < SCHEDULE_SESSION_PAGE_SIZE) break
    }
  }

  return slotSessions
}

async function fetchAttendanceRowsBySessionIds(
  adminSupabase: ReturnType<typeof getServiceRoleClient>,
  sessionIds: string[],
) {
  const attendanceRows: AttendanceRow[] = []

  for (let index = 0; index < sessionIds.length; index += ATTENDANCE_QUERY_CHUNK_SIZE) {
    const chunk = sessionIds.slice(index, index + ATTENDANCE_QUERY_CHUNK_SIZE)
    const { data, error } = await (adminSupabase
      .from('attendance')
      .select('booking_session_id, student_id, status, checked_at')
      .in('booking_session_id', chunk) as unknown as Promise<AttendanceQueryResult>)

    if (error) {
      throw new Error(`Admin schedule attendance query failed: ${error.message}`)
    }

    attendanceRows.push(...(data || []))
  }

  return attendanceRows
}

async function fetchStudentLevelsByStudentRefs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentRefs: StudentRef[],
) {
  const levelRows: StudentLevelRow[] = []
  const studentIds = Array.from(new Set(studentRefs.map((student) => student.id)))

  for (const chunk of chunkArray(studentIds, RELATED_QUERY_CHUNK_SIZE)) {
    const { data, error } = await (supabase
      .from('student_levels')
      .select('student_id, student_type, level, created_at')
      .in('student_id', chunk)
      .order('created_at', { ascending: false }) as unknown as Promise<StudentLevelQueryResult>)

    if (error) {
      throw new Error(`Admin schedule student levels query failed: ${error.message}`)
    }

    levelRows.push(...(data || []))
  }

  return levelRows
}

async function fetchLevelDefinitions(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await (supabase
    .from('levels')
    .select('id, name, category')
    .eq('is_active', true) as unknown as Promise<LevelQueryResult>)

  if (error) {
    throw new Error(`Admin schedule levels query failed: ${error.message}`)
  }

  return data || []
}

async function fetchTeachingProgramsBySlotIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slotIds: string[],
) {
  const programs: TeachingProgramRow[] = []

  for (const chunk of chunkArray(slotIds, RELATED_QUERY_CHUNK_SIZE)) {
    const { data, error } = await (supabase
      .from('teaching_programs')
      .select('id, coach_id, schedule_slot_id, program_content, status, created_at, updated_at')
      .in('schedule_slot_id', chunk)
      .order('updated_at', { ascending: false }) as unknown as Promise<TeachingProgramQueryResult>)

    if (error) {
      throw new Error(`Admin schedule teaching programs query failed: ${error.message}`)
    }

    programs.push(...(data || []))
  }

  return programs
}

export default async function SchedulesPage({ searchParams }: SchedulesPageProps) {
  await requireAdminPageAccess()
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const { year, month } = parseMonthParams(resolvedSearchParams)
  const { startDate, endDate } = getMonthDateRange(year, month)
  const supabase = await createClient()
  const adminSupabase = getServiceRoleClient()

  const [sessions, branchesResult] = await Promise.all([
    fetchScheduleSessionsForMonth(supabase, startDate, endDate),
    supabase
      .from('branches')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('name') as unknown as Promise<BranchQueryResult>,
  ])

  if (branchesResult.error) {
    throw new Error(`Admin schedule branches query failed: ${branchesResult.error.message}`)
  }

  const rawSessions = sessions
  const rawSessionIds = rawSessions.map((session) => session.id)
  const walletCreditByOriginalSessionId = new Map<string, WalletCreditRow>()

  if (rawSessionIds.length > 0) {
    const walletCredits = await fetchWalletCreditsByOriginalSessionIds(supabase, rawSessionIds)

    walletCredits.forEach((credit) => {
      walletCreditByOriginalSessionId.set(credit.original_session_id, credit)
    })
  }

  const visibleSessions = rawSessions.filter((session) => {
    if (session.status !== 'walleted') return true
    const walletCredit = walletCreditByOriginalSessionId.get(session.id)
    return !walletCredit || walletCredit.status === 'active'
  })

  const slotIds = Array.from(new Set(visibleSessions.map((session) => session.schedule_slot_id).filter(Boolean))) as string[]

  let groups: GroupRow[] = []
  let slotSessions: SlotSessionRow[] = []
  let teachingProgramRows: TeachingProgramRow[] = []
  if (slotIds.length > 0) {
    const [groupRows, slotSessionRows, programRows] = await Promise.all([
      fetchGroupsBySlotIds(supabase, slotIds),
      fetchSlotSessionsBySlotIds(supabase, slotIds, startDate, endDate),
      fetchTeachingProgramsBySlotIds(supabase, slotIds),
    ])
    groups = groupRows
    slotSessions = slotSessionRows
    teachingProgramRows = programRows
  }

  const studentRefs = visibleSessions
    .map(getStudentRef)
    .filter((student): student is StudentRef => Boolean(student))
  let studentLevelRows: StudentLevelRow[] = []
  let levelDefinitions: LevelRow[] = []
  if (studentRefs.length > 0) {
    const [levelRows, levels] = await Promise.all([
      fetchStudentLevelsByStudentRefs(supabase, studentRefs),
      fetchLevelDefinitions(supabase),
    ])
    studentLevelRows = levelRows
    levelDefinitions = levels
  }

  const attendanceScopeSessionIds = getAdminAttendanceScopeSessionIds(visibleSessions, groups, slotSessions)
  let attendanceRows: AttendanceRow[] = []
  if (attendanceScopeSessionIds.length > 0) {
    attendanceRows = await fetchAttendanceRowsBySessionIds(adminSupabase, attendanceScopeSessionIds)
  }

  const adminAttendanceState = buildAdminAttendanceState({
    sessions: visibleSessions,
    groups,
    slotSessions,
    attendanceRows,
  })

  const latestLevelMap = buildLatestLevelMap(studentLevelRows)
  const levelDefinitionMap = new Map(levelDefinitions.map((level) => [level.id, level]))
  const teachingProgramMap = buildLatestTeachingProgramMap(teachingProgramRows)

  const scheduleSessions = visibleSessions.map((session) => {
    const derivedStatus = adminAttendanceState.getDisplayStatus(session)
    const learnerType = session.bookings?.learner_type || ''
    const hasMissingChildLink = learnerType === 'child' && !session.child_id
    const studentRef = getStudentRef(session)
    const latestLevel = studentRef ? latestLevelMap.get(getStudentKey(studentRef)) : null
    const levelDefinition = latestLevel ? levelDefinitionMap.get(latestLevel.level) : null

    return {
      id: session.id,
      round_key: getRoundKey(session),
      schedule_slot_id: session.schedule_slot_id,
      date: session.date,
      start_time: session.start_time,
      end_time: session.end_time,
      status: derivedStatus,
      is_makeup: session.is_makeup || false,
      child_id: session.child_id,
      student_id: studentRef?.id || null,
      student_type: studentRef?.type || null,
      level: latestLevel?.level ?? 0,
      level_name: levelDefinition?.name || (latestLevel ? null : 'ยังไม่ประเมิน'),
      level_category: levelDefinition?.category || null,
      learner_type: learnerType,
      has_missing_child_link: hasMissingChildLink,
      branch_id: session.branch_id,
      branch_name: session.branches?.name || 'ไม่ทราบ',
      course_type_id: session.bookings?.course_type_id || '',
      learner_name: hasMissingChildLink
        ? 'ข้อมูลเด็กไม่ครบ'
        : session.child_id
          ? (session.children?.nickname || session.children?.full_name || 'ไม่ทราบ')
          : (session.bookings?.profiles?.full_name || 'ไม่ทราบ'),
      parent_name: session.child_id || hasMissingChildLink
        ? (session.bookings?.profiles?.full_name || 'ไม่ทราบ')
        : null,
      course_type: session.bookings?.course_types?.name || '',
      booking_status: session.bookings?.status || '',
      coach_names: adminAttendanceState.getCoachNames(session),
    }
  })

  const sessionById = new Map(scheduleSessions.map((session) => [session.id, session]))
  const roundMap = new Map<string, {
    key: string
    schedule_slot_id: string | null
    date: string
    start_time: string
    end_time: string
    branch_id: string
    branch_name: string
    course_type_id: string
    course_type: string
    learner_count: number
    groups: {
      id: string
      name: string
      coach_id: string | null
      coach_name: string | null
      level_min: number | null
      level_max: number | null
      sort_order: number
      teaching_program: {
        id: string
        status: ProgramStatus
        program_content: string
        updated_at: string
      } | null
      learners: typeof scheduleSessions
    }[]
    unassigned_learners: typeof scheduleSessions
  }>()

  scheduleSessions.forEach((session) => {
    if (!roundMap.has(session.round_key)) {
      roundMap.set(session.round_key, {
        key: session.round_key,
        schedule_slot_id: session.schedule_slot_id,
        date: session.date,
        start_time: session.start_time,
        end_time: session.end_time,
        branch_id: session.branch_id,
        branch_name: session.branch_name,
        course_type_id: session.course_type_id,
        course_type: session.course_type,
        learner_count: 0,
        groups: [],
        unassigned_learners: [],
      })
    }
    const round = roundMap.get(session.round_key)
    if (round) round.learner_count += 1
  })

  const assignedSessionIds = new Set<string>()
  groups
    .slice()
    .sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name, 'th'))
    .forEach((group) => {
      const round = roundMap.get(`slot:${group.schedule_slot_id}`)
      if (!round) return

      const learners = (group.coach_assignment_group_students || [])
        .reduce<typeof scheduleSessions>((items, student) => {
          const matchedSession = sessionById.get(student.booking_session_id)
          if (matchedSession && matchedSession.round_key === round.key) items.push(matchedSession)
          return items
        }, [])
        .sort((a, b) => a.learner_name.localeCompare(b.learner_name, 'th'))

      if (learners.length === 0) return

      learners.forEach((learner) => assignedSessionIds.add(learner.id))
      const teachingProgram = group.coach_id
        ? teachingProgramMap.get(getProgramKey(group.schedule_slot_id, group.coach_id)) || null
        : null

      round.groups.push({
        id: group.id,
        name: group.name,
        coach_id: group.coach_id,
        coach_name: group.profiles?.full_name || null,
        level_min: group.level_min,
        level_max: group.level_max,
        sort_order: group.sort_order,
        teaching_program: teachingProgram
          ? {
            id: teachingProgram.id,
            status: teachingProgram.status,
            program_content: teachingProgram.program_content,
            updated_at: teachingProgram.updated_at,
          }
          : null,
        learners,
      })
    })

  scheduleSessions.forEach((session) => {
    if (assignedSessionIds.has(session.id)) return
    const round = roundMap.get(session.round_key)
    if (!round) return
    round.unassigned_learners.push(session)
  })

  const scheduleRounds = Array.from(roundMap.values())
    .map((round) => ({
      ...round,
      groups: round.groups.sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name, 'th')),
      unassigned_learners: round.unassigned_learners.sort((a, b) => a.learner_name.localeCompare(b.learner_name, 'th')),
    }))
    .sort((a, b) => `${a.date} ${a.start_time} ${a.branch_name} ${a.course_type}`.localeCompare(`${b.date} ${b.start_time} ${b.branch_name} ${b.course_type}`, 'th'))

  return (
    <SchedulesClient
      key={`${year}-${month}`}
      sessions={scheduleSessions}
      rounds={scheduleRounds}
      branches={branchesResult.data || []}
      initialYear={year}
      initialMonth={month}
    />
  )
}
