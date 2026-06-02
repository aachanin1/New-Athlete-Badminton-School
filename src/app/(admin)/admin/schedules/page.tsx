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

interface CoachAssignmentRow {
  schedule_slot_id: string
  profiles?: { full_name: string | null } | null
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

const ATTENDANCE_QUERY_CHUNK_SIZE = 100

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

export default async function SchedulesPage() {
  await requireAdminPageAccess()
  const supabase = await createClient()
  const adminSupabase = getServiceRoleClient()
  const [{ data: sessions }, { data: branches }] = await Promise.all([
    supabase
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
      .order('date', { ascending: true }) as unknown as Promise<{ data: ScheduleSessionRow[] | null }>,
    supabase.from('branches').select('id, name, slug').eq('is_active', true).order('name') as unknown as Promise<{ data: BranchRow[] | null }>,
  ])

  const rawSessions = sessions || []
  const rawSessionIds = rawSessions.map((session) => session.id)
  const walletCreditByOriginalSessionId = new Map<string, WalletCreditRow>()

  if (rawSessionIds.length > 0) {
    const { data: walletCredits } = await supabase
      .from('lesson_wallet_credits')
      .select('original_session_id, status')
      .in('original_session_id', rawSessionIds) as unknown as { data: WalletCreditRow[] | null }

    ;(walletCredits || []).forEach((credit) => {
      walletCreditByOriginalSessionId.set(credit.original_session_id, credit)
    })
  }

  const visibleSessions = rawSessions.filter((session) => {
    if (session.status !== 'walleted') return true
    const walletCredit = walletCreditByOriginalSessionId.get(session.id)
    return !walletCredit || walletCredit.status === 'active'
  })

  const slotIds = Array.from(new Set(visibleSessions.map((session) => session.schedule_slot_id).filter(Boolean))) as string[]

  let coachAssignments: CoachAssignmentRow[] = []
  let groups: GroupRow[] = []
  let slotSessions: SlotSessionRow[] = []
  if (slotIds.length > 0) {
    const [{ data: legacyAssignments }, { data: groupRows }, { data: slotSessionRows }] = await Promise.all([
      supabase
        .from('coach_assignments')
        .select('schedule_slot_id, profiles!coach_assignments_coach_id_fkey(full_name)')
        .in('schedule_slot_id', slotIds) as unknown as PromiseLike<{ data: CoachAssignmentRow[] | null }>,
      supabase
        .from('coach_assignment_groups')
        .select(`
          schedule_slot_id,
          coach_id,
          profiles!coach_assignment_groups_coach_id_fkey(full_name),
          coach_assignment_group_students(booking_session_id)
        `)
        .in('schedule_slot_id', slotIds) as unknown as PromiseLike<{ data: GroupRow[] | null }>,
      supabase
        .from('booking_sessions')
        .select('id, schedule_slot_id, bookings!inner(status)')
        .in('schedule_slot_id', slotIds)
        .neq('status', 'rescheduled')
        .neq('status', 'walleted')
        .eq('bookings.status', 'verified') as unknown as PromiseLike<{ data: SlotSessionRow[] | null }>,
    ])
    coachAssignments = legacyAssignments || []
    groups = groupRows || []
    slotSessions = slotSessionRows || []
  }

  const coachMap = coachAssignments.reduce((map: Record<string, string[]>, item) => {
    if (!map[item.schedule_slot_id]) map[item.schedule_slot_id] = []
    const coachName = item.profiles?.full_name
    if (coachName && !map[item.schedule_slot_id].includes(coachName)) {
      map[item.schedule_slot_id].push(coachName)
    }
    return map
  }, {})

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

    return {
      id: session.id,
      date: session.date,
      start_time: session.start_time,
      end_time: session.end_time,
      status: derivedStatus,
      is_makeup: session.is_makeup || false,
      child_id: session.child_id,
      branch_id: session.branch_id,
      branch_name: session.branches?.name || 'ไม่ทราบ',
      learner_name: session.child_id
        ? (session.children?.nickname || session.children?.full_name || 'ไม่ทราบ')
        : (session.bookings?.profiles?.full_name || 'ไม่ทราบ'),
      parent_name: session.child_id ? (session.bookings?.profiles?.full_name || 'ไม่ทราบ') : null,
      course_type: session.bookings?.course_types?.name || '',
      booking_status: session.bookings?.status || '',
      coach_names: adminAttendanceState.getCoachNames(
        session,
        session.schedule_slot_id ? coachMap[session.schedule_slot_id] || [] : [],
      ),
    }
  })

  return (
    <SchedulesClient
      sessions={scheduleSessions}
      branches={branches || []}
    />
  )
}
