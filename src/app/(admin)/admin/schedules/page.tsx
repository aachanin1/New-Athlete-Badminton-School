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
  schedule_slot_id: string
  coach_id: string | null
  profiles?: { full_name: string | null } | null
  coach_assignment_group_students: { booking_session_id: string }[] | null
}

type SlotSessionRow = AdminAttendanceSlotSessionRow

type AttendanceRow = AttendanceSessionRow

interface WalletCreditRow {
  original_session_id: string
  status: 'active' | 'redeemed' | 'expired'
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
          id, user_id, learner_type, status,
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
        schedule_slot_id,
        coach_id,
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
  if (slotIds.length > 0) {
    const [groupRows, slotSessionRows] = await Promise.all([
      fetchGroupsBySlotIds(supabase, slotIds),
      fetchSlotSessionsBySlotIds(supabase, slotIds, startDate, endDate),
    ])
    groups = groupRows
    slotSessions = slotSessionRows
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

  const scheduleSessions = visibleSessions.map((session) => {
    const derivedStatus = adminAttendanceState.getDisplayStatus(session)
    const learnerType = session.bookings?.learner_type || ''
    const hasMissingChildLink = learnerType === 'child' && !session.child_id

    return {
      id: session.id,
      date: session.date,
      start_time: session.start_time,
      end_time: session.end_time,
      status: derivedStatus,
      is_makeup: session.is_makeup || false,
      child_id: session.child_id,
      learner_type: learnerType,
      has_missing_child_link: hasMissingChildLink,
      branch_id: session.branch_id,
      branch_name: session.branches?.name || 'ไม่ทราบ',
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

  return (
    <SchedulesClient
      key={`${year}-${month}`}
      sessions={scheduleSessions}
      branches={branchesResult.data || []}
      initialYear={year}
      initialMonth={month}
    />
  )
}
