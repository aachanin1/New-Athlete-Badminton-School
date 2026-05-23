import { createClient } from '@/lib/supabase/server'
import { SchedulesClient } from '@/components/admin/schedules-client'
import { requireAdminPageAccess } from '@/lib/auth/admin'
import { deriveSessionAttendanceStatus } from '@/lib/session-attendance-status'
import type { AttendanceStatus } from '@/types/database'

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

interface GroupRow {
  schedule_slot_id: string
  coach_id: string | null
  profiles?: { full_name: string | null } | null
  coach_assignment_group_students: { booking_session_id: string }[] | null
}

interface SlotSessionRow {
  id: string
  schedule_slot_id: string | null
}

interface AttendanceRow {
  booking_session_id: string
  status: AttendanceStatus
}

export default async function SchedulesPage() {
  await requireAdminPageAccess()
  const supabase = await createClient()
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
      .in('bookings.status', ['pending_payment', 'paid', 'verified'])
      .neq('status', 'rescheduled')
      .order('date', { ascending: true }) as unknown as Promise<{ data: ScheduleSessionRow[] | null }>,
    supabase.from('branches').select('id, name, slug').eq('is_active', true).order('name') as unknown as Promise<{ data: BranchRow[] | null }>,
  ])

  const slotIds = Array.from(new Set((sessions || []).map((session) => session.schedule_slot_id).filter(Boolean))) as string[]
  const sessionIds = (sessions || []).map((session) => session.id)

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
        .select('id, schedule_slot_id')
        .in('schedule_slot_id', slotIds)
        .neq('status', 'rescheduled') as unknown as PromiseLike<{ data: SlotSessionRow[] | null }>,
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

  const groupCoachMap = new Map<string, string[]>()
  const groupScopeMap = new Map<string, string[]>()
  groups.forEach((group) => {
    const groupSessionIds = (group.coach_assignment_group_students || []).map((student) => student.booking_session_id)
    groupSessionIds.forEach((sessionId) => {
      groupScopeMap.set(sessionId, groupSessionIds)
      const coachName = group.profiles?.full_name
      if (!coachName) return
      const names = groupCoachMap.get(sessionId) || []
      if (!names.includes(coachName)) names.push(coachName)
      groupCoachMap.set(sessionId, names)
    })
  })

  const slotScopeMap = new Map<string, string[]>()
  slotSessions.forEach((session) => {
    if (!session.schedule_slot_id) return
    const rows = slotScopeMap.get(session.schedule_slot_id) || []
    rows.push(session.id)
    slotScopeMap.set(session.schedule_slot_id, rows)
  })

  const attendanceScopeSessionIds = Array.from(new Set([
    ...sessionIds,
    ...Array.from(groupScopeMap.values()).flat(),
    ...Array.from(slotScopeMap.values()).flat(),
  ]))
  let attendanceRows: AttendanceRow[] = []
  if (attendanceScopeSessionIds.length > 0) {
    const { data } = await supabase
      .from('attendance')
      .select('booking_session_id, status')
      .in('booking_session_id', attendanceScopeSessionIds) as unknown as { data: AttendanceRow[] | null }
    attendanceRows = data || []
  }

  const attendanceBySessionId = new Map<string, AttendanceStatus>()
  const attendanceCountBySessionId = new Map<string, number>()
  attendanceRows.forEach((attendance) => {
    attendanceCountBySessionId.set(attendance.booking_session_id, (attendanceCountBySessionId.get(attendance.booking_session_id) || 0) + 1)
    if (sessionIds.includes(attendance.booking_session_id)) {
      attendanceBySessionId.set(attendance.booking_session_id, attendance.status)
    }
  })

  const scheduleSessions = (sessions || []).map((session) => {
    const scopedSessionIds = groupScopeMap.get(session.id)
      || (session.schedule_slot_id ? slotScopeMap.get(session.schedule_slot_id) : null)
      || [session.id]
    const derivedStatus = deriveSessionAttendanceStatus({
      status: session.status,
      date: session.date,
      startTime: session.start_time,
      endTime: session.end_time,
      isMakeup: session.is_makeup || false,
      attendanceStatus: attendanceBySessionId.get(session.id) || null,
      scopeAttendanceCount: scopedSessionIds.reduce((sum, sessionId) => sum + (attendanceCountBySessionId.get(sessionId) || 0), 0),
    })

    return {
      id: session.id,
      date: session.date,
      start_time: session.start_time,
      end_time: session.end_time,
      status: derivedStatus === 'present' || derivedStatus === 'late' ? 'completed' : derivedStatus,
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
      coach_names: groupCoachMap.get(session.id) || (session.schedule_slot_id ? coachMap[session.schedule_slot_id] || [] : []),
    }
  })

  return (
    <SchedulesClient
      sessions={scheduleSessions}
      branches={branches || []}
    />
  )
}
