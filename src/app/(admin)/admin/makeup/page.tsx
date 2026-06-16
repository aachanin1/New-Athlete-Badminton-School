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

type SlotSessionRow = AdminAttendanceSlotSessionRow

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

type MakeupPageSearchParams = Record<string, string | string[] | undefined>

interface MakeupPageProps {
  searchParams?: Promise<MakeupPageSearchParams>
}

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
    bookings!inner(user_id, learner_type, status,
      profiles!bookings_user_id_fkey(full_name),
      branches(name),
      course_types(name)
    )
  `

  const [
    { data: sourceSessions, error: sourceSessionsError },
    { data: linkedMakeupSessions, error: linkedMakeupSessionsError },
    { data: branches },
    { data: scheduleTemplates },
    { data: coaches },
  ] = await Promise.all([
    supabase
      .from('booking_sessions')
      .select(makeupSessionSelect)
      .eq('bookings.status', 'verified')
      .in('status', ['absent', 'scheduled', 'completed'])
      .lte('date', todayInput)
      .gte('date', historyStartInput)
      .order('date', { ascending: false })
      .limit(2000) as unknown as PromiseLike<{ data: MakeupSessionRow[] | null; error: { message: string } | null }>,
    supabase
      .from('booking_sessions')
      .select(makeupSessionSelect)
      .eq('bookings.status', 'verified')
      .not('rescheduled_from_id', 'is', null)
      .gte('date', historyStartInput)
      .lte('date', nextMonthEndInput)
      .order('date', { ascending: false })
      .limit(1000) as unknown as PromiseLike<{ data: MakeupSessionRow[] | null; error: { message: string } | null }>,
    supabase
      .from('branches')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('name') as unknown as PromiseLike<{ data: BranchRow[] | null }>,
    supabase
      .from('schedule_templates')
      .select(`
        id, branch_id, course_type_id, day_of_week, start_time, end_time, is_active, notes,
        branches(slug),
        course_types(name)
      `)
      .eq('is_active', true) as unknown as PromiseLike<{ data: ScheduleTemplateRow[] | null }>,
    supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .in('role', ['coach', 'head_coach'])
      .order('full_name') as unknown as PromiseLike<{ data: CoachOptionRow[] | null }>,
  ])

  if (sourceSessionsError || linkedMakeupSessionsError) {
    console.error('Makeup attendance source query error:', sourceSessionsError || linkedMakeupSessionsError)
  }

  const sessionById = new Map<string, MakeupSessionRow>()
  ;(sourceSessions || []).forEach((session) => sessionById.set(session.id, session))
  ;(linkedMakeupSessions || []).forEach((session) => sessionById.set(session.id, session))
  const sessions = Array.from(sessionById.values())

  const visibleSessionIds = new Set(sessions.map((session) => session.id))
  const slotIds = Array.from(new Set(sessions.map((session) => session.schedule_slot_id).filter(Boolean) as string[]))
  const groupContextBySessionId: Record<string, { groupName: string | null; coachId: string | null; coachName: string | null }> = {}
  let groups: GroupRow[] = []
  let slotSessionsForScope: SlotSessionRow[] = []
  const checkinsBySlotCoachKey: Record<string, CoachCheckinRow> = {}

  if (slotIds.length > 0) {
    const { data: groupRows } = await supabase
      .from('coach_assignment_groups')
      .select(`
        id, schedule_slot_id, name, coach_id,
        profiles!coach_assignment_groups_coach_id_fkey(full_name, email),
        coach_assignment_group_students(booking_session_id)
      `)
      .in('schedule_slot_id', slotIds) as unknown as { data: GroupRow[] | null }

    groups = groupRows || []
    groups.forEach((group) => {
      const groupSessionIds = (group.coach_assignment_group_students || []).map((student) => student.booking_session_id)
      groupSessionIds.forEach((sessionId) => {
        if (visibleSessionIds.has(sessionId)) {
          groupContextBySessionId[sessionId] = {
            groupName: group.name,
            coachId: group.coach_id,
            coachName: group.profiles?.full_name || group.profiles?.email || null,
          }
        }
      })
    })

    const { data: checkins } = await supabase
      .from('coach_checkins')
      .select('schedule_slot_id, coach_id, checkin_time, photo_url, location_lat, location_lng')
      .in('schedule_slot_id', slotIds)
      .order('checkin_time', { ascending: false }) as unknown as { data: CoachCheckinRow[] | null }

    ;(checkins || []).forEach((checkin) => {
      const coachKey = `${checkin.schedule_slot_id}:${checkin.coach_id}`
      if (!checkinsBySlotCoachKey[coachKey]) checkinsBySlotCoachKey[coachKey] = checkin
    })

    const { data: slotSessions } = await supabase
      .from('booking_sessions')
      .select('id, schedule_slot_id, bookings!inner(status)')
      .in('schedule_slot_id', slotIds)
      .eq('bookings.status', 'verified')
      .neq('status', 'rescheduled')
      .neq('status', 'walleted')
      .limit(1000) as unknown as { data: SlotSessionRow[] | null }

    slotSessionsForScope = slotSessions || []
  }

  const attendanceScopeSessionIds = getAdminAttendanceScopeSessionIds(sessions, groups, slotSessionsForScope)
  let attendanceRows: AttendanceRow[] = []

  if (attendanceScopeSessionIds.length > 0) {
    const { data } = await adminSupabase
      .from('attendance')
      .select('booking_session_id, student_id, status, checked_at')
      .in('booking_session_id', attendanceScopeSessionIds) as unknown as { data: AttendanceRow[] | null }

    attendanceRows = data || []
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
      group_name: groupContext?.groupName || null,
      coach_name: groupContext?.coachName || null,
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
