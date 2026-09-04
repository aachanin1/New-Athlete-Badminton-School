import { createClient } from '@/lib/supabase/server'
import { MakeupClient } from '@/components/admin/makeup-client'
import { getServiceRoleClient } from '@/lib/auth/admin'
import {
  buildAdminAttendanceState,
  getAdminAttendanceScopeSessionIds,
  type AdminAttendanceGroupRow,
  type AdminAttendanceSlotSessionRow,
} from '@/lib/admin-attendance-state'
import {
  type AttendanceSessionRow,
} from '@/lib/session-attendance-status'
import type { CourseTypeName } from '@/types/database'

interface MakeupSessionRow {
  id: string
  booking_id: string
  branch_id: string
  schedule_slot_id: string | null
  rescheduled_from_id: string | null
  date: string
  start_time: string
  end_time: string
  status: string
  is_makeup: boolean | null
  child_id: string | null
  branches?: { name: string | null } | null
  children?: { full_name: string | null; nickname: string | null } | null
  bookings?: {
    user_id: string
    course_type_id: string | null
    status: string
    profiles?: { full_name: string | null } | null
    branches?: { name: string | null } | null
    course_types?: { name: string | null } | null
  } | null
}

interface GroupRow extends AdminAttendanceGroupRow {
  id: string
  schedule_slot_id: string
  name: string | null
  coach_id: string | null
  profiles?: { full_name: string | null; email: string | null } | null
  coach_assignment_group_students: { booking_session_id: string }[] | null
}

interface CoachCheckinRow {
  schedule_slot_id: string
  coach_id: string
  checkin_time: string
  photo_url: string | null
  location_lat: number | null
  location_lng: number | null
}

interface SlotSessionRow extends AdminAttendanceSlotSessionRow {
  branch_id?: string | null
  date?: string | null
  start_time?: string | null
  end_time?: string | null
  bookings?: { status?: string | null; course_type_id?: string | null } | null
}

interface SameSlotCoachGroupPayload {
  groupId: string
  groupName: string
  coachId: string
  coachName: string
  sessionCount: number
}

type AttendanceRow = AttendanceSessionRow

interface ActivityLogRow {
  action: string
  entity_id: string | null
  created_at: string
  details: Record<string, unknown> | null
}

interface ReviewMeta {
  coachReviewRequestedCount: number
  coachReviewRequestedAt: string | null
  coachEvidenceRequestedCount: number
  coachEvidenceRequestedAt: string | null
  reviewClosedAt: string | null
  reviewClosedReason: string | null
}

interface BranchRow {
  id: string
  name: string
  slug: string
}

interface ScheduleTemplateRow {
  id: string
  branch_id: string
  course_type_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
  notes: string | null
  branches?: { slug: string | null } | null
  course_types?: { name: CourseTypeName | null } | null
}

interface CoachOptionRow {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
}

interface QueryError {
  message: string
}

interface QueryRowsResult<T> {
  data: T[] | null
  error: QueryError | null
}

type MakeupPageSearchParams = Record<string, string | string[] | undefined>

interface MakeupPageProps {
  searchParams?: Promise<MakeupPageSearchParams>
}

const RANGE_READ_PAGE_SIZE = 1000
const IN_FILTER_CHUNK_SIZE = 100

async function resolveSearchParams(searchParams?: MakeupPageProps['searchParams']) {
  return searchParams ? await searchParams : {}
}

function getSingleSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function toDateInput(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getBangkokTodayInput() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${partMap.year}-${partMap.month}-${partMap.day}`
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }
  return chunks
}

function dedupeRowsById<T extends { id: string }>(rows: T[]) {
  const rowById = new Map<string, T>()
  rows.forEach((row) => {
    if (!rowById.has(row.id)) rowById.set(row.id, row)
  })
  return Array.from(rowById.values())
}

async function readAllRangePages<T>(
  label: string,
  buildPage: (start: number, end: number) => PromiseLike<QueryRowsResult<T>>,
) {
  const rows: T[] = []

  for (let start = 0; ; start += RANGE_READ_PAGE_SIZE) {
    const end = start + RANGE_READ_PAGE_SIZE - 1
    const { data, error } = await buildPage(start, end)

    if (error) {
      throw new Error(`Admin makeup ${label} query failed: ${error.message}`)
    }

    const pageRows = data || []
    rows.push(...pageRows)

    if (pageRows.length < RANGE_READ_PAGE_SIZE) break
  }

  return rows
}

async function readChunkedRangePages<T>(
  label: string,
  values: string[],
  buildPage: (chunk: string[], start: number, end: number) => PromiseLike<QueryRowsResult<T>>,
) {
  const rows: T[] = []
  const chunks = chunkArray(Array.from(new Set(values.filter(Boolean))), IN_FILTER_CHUNK_SIZE)

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index]
    const chunkRows = await readAllRangePages<T>(
      `${label} chunk ${index + 1}/${chunks.length}`,
      (start, end) => buildPage(chunk, start, end),
    )
    rows.push(...chunkRows)
  }

  return rows
}

export default async function MakeupPage({ searchParams }: MakeupPageProps) {
  const supabase = await createClient()
  const adminSupabase = getServiceRoleClient()
  const resolvedSearchParams = await resolveSearchParams(searchParams)
  const reviewTarget = {
    sessionId: getSingleSearchParam(resolvedSearchParams.session),
    date: getSingleSearchParam(resolvedSearchParams.date),
  }
  const todayInput = getBangkokTodayInput()
  const [todayYear, todayMonth, todayDay] = todayInput.split('-').map(Number)
  const historyStartInput = toDateInput(new Date(todayYear, todayMonth - 1 - 6, todayDay))
  const nextMonthEndInput = toDateInput(new Date(todayYear, todayMonth + 1, 0))
  const makeupSessionSelect = `
    id, booking_id, date, start_time, end_time, status, is_makeup, child_id, branch_id, schedule_slot_id, rescheduled_from_id,
    branches(name),
    children(full_name, nickname),
    bookings!inner(user_id, learner_type, course_type_id, status,
      profiles!bookings_user_id_fkey(full_name),
      branches(name),
      course_types(name)
    )
  `

  const [
    sourceSessions,
    linkedMakeupSessions,
    { data: branches, error: branchesError },
    { data: scheduleTemplates, error: scheduleTemplatesError },
    { data: coaches, error: coachesError },
  ] = await Promise.all([
    // These queues can exceed PostgREST's default 1000-row window, so read every range explicitly.
    readAllRangePages<MakeupSessionRow>('source sessions', (start, end) =>
      supabase
        .from('booking_sessions')
        .select(makeupSessionSelect)
        .eq('bookings.status', 'verified')
        .in('status', ['absent', 'scheduled', 'completed'])
        .lte('date', todayInput)
        .gte('date', historyStartInput)
        .order('date', { ascending: false })
        .order('id', { ascending: true })
        .range(start, end) as unknown as PromiseLike<QueryRowsResult<MakeupSessionRow>>),
    readAllRangePages<MakeupSessionRow>('linked makeup sessions', (start, end) =>
      supabase
        .from('booking_sessions')
        .select(makeupSessionSelect)
        .eq('bookings.status', 'verified')
        .not('rescheduled_from_id', 'is', null)
        .gte('date', historyStartInput)
        .lte('date', nextMonthEndInput)
        .order('date', { ascending: false })
        .order('id', { ascending: true })
        .range(start, end) as unknown as PromiseLike<QueryRowsResult<MakeupSessionRow>>),
    supabase
      .from('branches')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('name') as unknown as PromiseLike<QueryRowsResult<BranchRow>>,
    supabase
      .from('schedule_templates')
      .select(`
        id, branch_id, course_type_id, day_of_week, start_time, end_time, is_active, notes,
        branches(slug),
        course_types(name)
      `)
      .eq('is_active', true) as unknown as PromiseLike<QueryRowsResult<ScheduleTemplateRow>>,
    supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .in('role', ['coach', 'head_coach'])
      .order('full_name') as unknown as PromiseLike<QueryRowsResult<CoachOptionRow>>,
  ])

  if (branchesError || scheduleTemplatesError || coachesError) {
    throw new Error(
      `Admin makeup reference query failed: ${(branchesError || scheduleTemplatesError || coachesError)?.message || 'Unknown error'}`
    )
  }

  const sessionById = new Map<string, MakeupSessionRow>()
  sourceSessions.forEach((session) => sessionById.set(session.id, session))
  linkedMakeupSessions.forEach((session) => sessionById.set(session.id, session))
  const sessions = Array.from(sessionById.values())

  const visibleSessionIds = new Set(sessions.map((session) => session.id))
  const slotIds = Array.from(new Set(sessions.map((session) => session.schedule_slot_id).filter(Boolean) as string[]))
  const groupContextBySessionId: Record<string, { groupId: string; groupName: string | null; coachId: string | null; coachName: string | null }> = {}
  let groups: GroupRow[] = []
  let slotSessionsForScope: SlotSessionRow[] = []
  const slotSessionById = new Map<string, SlotSessionRow>()
  const checkinsBySlotCoachKey: Record<string, CoachCheckinRow> = {}

  if (slotIds.length > 0) {
    // Large slot sets can exceed URL/request limits, so related reads are chunked by slot id.
    groups = dedupeRowsById(await readChunkedRangePages<GroupRow>(
      'assignment groups by slot',
      slotIds,
      (chunk, start, end) =>
        supabase
          .from('coach_assignment_groups')
          .select(`
            id, schedule_slot_id, name, coach_id,
            profiles!coach_assignment_groups_coach_id_fkey(full_name, email),
            coach_assignment_group_students(booking_session_id)
          `)
          .in('schedule_slot_id', chunk)
          .order('id', { ascending: true })
          .range(start, end) as unknown as PromiseLike<QueryRowsResult<GroupRow>>,
    ))
    groups.forEach((group) => {
      const groupSessionIds = (group.coach_assignment_group_students || []).map((student) => student.booking_session_id)
      groupSessionIds.forEach((sessionId) => {
        if (visibleSessionIds.has(sessionId)) {
          groupContextBySessionId[sessionId] = {
            groupId: group.id,
            groupName: group.name,
            coachId: group.coach_id,
            coachName: group.profiles?.full_name || group.profiles?.email || null,
          }
        }
      })
    })

    const checkins = await readChunkedRangePages<CoachCheckinRow>(
      'coach checkins by slot',
      slotIds,
      (chunk, start, end) =>
        supabase
          .from('coach_checkins')
          .select('schedule_slot_id, coach_id, checkin_time, photo_url, location_lat, location_lng')
          .in('schedule_slot_id', chunk)
          .order('checkin_time', { ascending: false })
          .range(start, end) as unknown as PromiseLike<QueryRowsResult<CoachCheckinRow>>,
    )

    checkins.forEach((checkin) => {
      const coachKey = `${checkin.schedule_slot_id}:${checkin.coach_id}`
      if (!checkinsBySlotCoachKey[coachKey]) checkinsBySlotCoachKey[coachKey] = checkin
    })

    slotSessionsForScope = dedupeRowsById(await readChunkedRangePages<SlotSessionRow>(
      'slot sessions for attendance scope',
      slotIds,
      (chunk, start, end) =>
        supabase
          .from('booking_sessions')
          .select('id, schedule_slot_id, branch_id, date, start_time, end_time, bookings!inner(status, course_type_id)')
          .in('schedule_slot_id', chunk)
          .eq('bookings.status', 'verified')
          .neq('status', 'rescheduled')
          .neq('status', 'walleted')
          .order('id', { ascending: true })
          .range(start, end) as unknown as PromiseLike<QueryRowsResult<SlotSessionRow>>,
    ))
    slotSessionsForScope.forEach((slotSession) => {
      slotSessionById.set(slotSession.id, slotSession)
    })
  }

  const attendanceScopeSessionIds = getAdminAttendanceScopeSessionIds(sessions, groups, slotSessionsForScope)
  let attendanceRows: AttendanceRow[] = []

  if (attendanceScopeSessionIds.length > 0) {
    attendanceRows = await readChunkedRangePages<AttendanceRow>(
      'attendance by scoped session',
      attendanceScopeSessionIds,
      (chunk, start, end) =>
        adminSupabase
          .from('attendance')
          .select('booking_session_id, student_id, status, checked_at')
          .in('booking_session_id', chunk)
          .order('booking_session_id', { ascending: true })
          .range(start, end) as unknown as PromiseLike<QueryRowsResult<AttendanceRow>>,
    )
  }

  const adminAttendanceState = buildAdminAttendanceState({
    sessions,
    groups,
    slotSessions: slotSessionsForScope,
    attendanceRows,
  })

  const reviewMetaBySessionId = new Map<string, ReviewMeta>()
  const sessionIds = sessions.map((session) => session.id)

  if (sessionIds.length > 0) {
    const reviewLogs: ActivityLogRow[] = []
    const logActions = [
      'attendance_gap_request_coach_review',
      'attendance_gap_request_coach_evidence',
      'attendance_gap_closed_no_action',
    ]

    for (let i = 0; i < sessionIds.length; i += 200) {
      const sessionIdChunk = sessionIds.slice(i, i + 200)
      const { data } = await adminSupabase
        .from('activity_logs')
        .select('action, entity_id, created_at, details')
        .eq('entity_type', 'booking_sessions')
        .in('entity_id', sessionIdChunk)
        .in('action', logActions)
        .order('created_at', { ascending: false }) as unknown as { data: ActivityLogRow[] | null }

      if (data) reviewLogs.push(...data)
    }

    reviewLogs.forEach((log) => {
      if (!log.entity_id) return
      const meta = reviewMetaBySessionId.get(log.entity_id) || {
        coachReviewRequestedCount: 0,
        coachReviewRequestedAt: null,
        coachEvidenceRequestedCount: 0,
        coachEvidenceRequestedAt: null,
        reviewClosedAt: null,
        reviewClosedReason: null,
      }

      if (log.action === 'attendance_gap_request_coach_review') {
        meta.coachReviewRequestedCount += 1
        if (!meta.coachReviewRequestedAt || log.created_at > meta.coachReviewRequestedAt) {
          meta.coachReviewRequestedAt = log.created_at
        }
      }

      if (log.action === 'attendance_gap_request_coach_evidence') {
        meta.coachEvidenceRequestedCount += 1
        if (!meta.coachEvidenceRequestedAt || log.created_at > meta.coachEvidenceRequestedAt) {
          meta.coachEvidenceRequestedAt = log.created_at
        }
      }

      if (log.action === 'attendance_gap_closed_no_action') {
        if (!meta.reviewClosedAt || log.created_at > meta.reviewClosedAt) {
          meta.reviewClosedAt = log.created_at
          meta.reviewClosedReason = typeof log.details?.reason === 'string' ? log.details.reason : null
        }
      }

      reviewMetaBySessionId.set(log.entity_id, meta)
    })
  }

  const getSameSlotCoachGroupOptions = (
    session: MakeupSessionRow,
    currentGroupId: string | null,
  ): SameSlotCoachGroupPayload[] => {
    if (!session.schedule_slot_id) return []

    const courseTypeId = session.bookings?.course_type_id || null

    return groups
      .filter((group) => group.schedule_slot_id === session.schedule_slot_id)
      .filter((group) => group.id !== currentGroupId)
      .filter((group) => Boolean(group.coach_id))
      .filter((group) => {
        const groupSessionIds = (group.coach_assignment_group_students || [])
          .map((student) => student.booking_session_id)
          .filter(Boolean)
        if (groupSessionIds.length === 0) return false

        const groupSessions = groupSessionIds
          .map((sessionId) => slotSessionById.get(sessionId))
          .filter((row): row is SlotSessionRow => Boolean(row))

        if (groupSessions.length === 0) return false

        return groupSessions.every((groupSession) => (
          groupSession.schedule_slot_id === session.schedule_slot_id &&
          groupSession.date === session.date &&
          groupSession.start_time === session.start_time &&
          groupSession.end_time === session.end_time &&
          groupSession.branch_id === session.branch_id &&
          (groupSession.bookings?.course_type_id || null) === courseTypeId
        ))
      })
      .map((group) => ({
        groupId: group.id,
        groupName: group.name || 'ไม่ระบุชื่อกลุ่ม',
        coachId: group.coach_id as string,
        coachName: group.profiles?.full_name || group.profiles?.email || 'ไม่ทราบโค้ช',
        sessionCount: (group.coach_assignment_group_students || []).length,
      }))
      .sort((a, b) => a.coachName.localeCompare(b.coachName, 'th') || a.groupName.localeCompare(b.groupName, 'th') || a.groupId.localeCompare(b.groupId))
  }

  const sessionList = sessions.map((session) => {
    const learnerName = session.child_id
      ? (session.children?.nickname || session.children?.full_name || 'ไม่ทราบ')
      : (session.bookings?.profiles?.full_name || 'ไม่ทราบ')

    const groupContext = groupContextBySessionId[session.id] || null
    const checkin = groupContext?.coachId && session.schedule_slot_id
      ? checkinsBySlotCoachKey[`${session.schedule_slot_id}:${groupContext.coachId}`] || null
      : null
    const reviewMeta = reviewMetaBySessionId.get(session.id)

    return {
      id: session.id,
      booking_id: session.booking_id,
      child_id: session.child_id,
      user_id: session.bookings?.user_id || null,
      branch_id: session.branch_id,
      schedule_slot_id: session.schedule_slot_id,
      rescheduled_from_id: session.rescheduled_from_id,
      date: session.date,
      start_time: session.start_time,
      end_time: session.end_time,
      status: session.status,
      attendance_status: adminAttendanceState.latestAttendanceBySessionId.get(session.id) || null,
      attendance_scope_count: adminAttendanceState.getAttendanceScopeCount(session),
      user_name: session.bookings?.profiles?.full_name || 'ไม่ทราบ',
      learner_name: learnerName,
      branch_name: session.branches?.name || 'ไม่ทราบ',
      course_type: session.bookings?.course_types?.name || '',
      is_makeup: session.is_makeup || false,
      group_id: groupContext?.groupId || null,
      group_name: groupContext?.groupName || null,
      coach_id: groupContext?.coachId || null,
      coach_name: groupContext?.coachName || null,
      same_slot_coach_groups: getSameSlotCoachGroupOptions(session, groupContext?.groupId || null),
      coach_checkin_time: checkin?.checkin_time || null,
      coach_checkin_photo_url: checkin?.photo_url || null,
      coach_checkin_has_location: checkin?.location_lat != null && checkin?.location_lng != null,
      review_closed_at: reviewMeta?.reviewClosedAt || null,
      review_closed_reason: reviewMeta?.reviewClosedReason || null,
      coach_review_requested_count: reviewMeta?.coachReviewRequestedCount || 0,
      coach_review_requested_at: reviewMeta?.coachReviewRequestedAt || null,
      coach_evidence_requested_count: reviewMeta?.coachEvidenceRequestedCount || 0,
      coach_evidence_requested_at: reviewMeta?.coachEvidenceRequestedAt || null,
    }
  })

  return (
    <MakeupClient
      sessions={sessionList}
      branches={branches || []}
      scheduleTemplates={(scheduleTemplates || []).map((template) => ({
        id: template.id,
        branch_id: template.branch_id,
        branch_slug: template.branches?.slug || '',
        course_type_id: template.course_type_id,
        course_type_name: template.course_types?.name || 'kids_group',
        day_of_week: template.day_of_week,
        start_time: template.start_time.slice(0, 5),
        end_time: template.end_time.slice(0, 5),
        is_active: template.is_active,
        notes: template.notes,
      }))}
      coaches={(coaches || []).map((coach) => ({
        id: coach.id,
        name: coach.full_name || coach.email || 'ไม่ทราบชื่อโค้ช',
        role: coach.role || 'coach',
      }))}
      reviewTarget={reviewTarget}
    />
  )
}
