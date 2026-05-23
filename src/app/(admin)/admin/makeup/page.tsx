import { createClient } from '@/lib/supabase/server'
import { MakeupClient } from '@/components/admin/makeup-client'
import type { AttendanceStatus, CourseTypeName } from '@/types/database'

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
  children?: { full_name: string | null; nickname: string | null } | null
  bookings?: {
    profiles?: { full_name: string | null } | null
    branches?: { name: string | null } | null
    course_types?: { name: string | null } | null
  } | null
}

interface GroupRow {
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

interface SlotSessionRow {
  id: string
  schedule_slot_id: string | null
}

interface AttendanceRow {
  booking_session_id: string
  status: AttendanceStatus
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

export default async function MakeupPage() {
  const supabase = await createClient()

  const [{ data: sessions }, { data: branches }, { data: scheduleTemplates }] = await Promise.all([
    supabase
      .from('booking_sessions')
      .select(`
        id, booking_id, date, start_time, end_time, status, is_makeup, child_id, branch_id, schedule_slot_id, rescheduled_from_id,
        children(full_name, nickname),
        bookings(user_id, learner_type,
          profiles!bookings_user_id_fkey(full_name),
          branches(name),
          course_types(name)
        )
      `)
      .in('status', ['absent', 'scheduled', 'completed'])
      .order('date', { ascending: false })
      .limit(300) as unknown as PromiseLike<{ data: MakeupSessionRow[] | null }>,
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
  ])

  const sessionIds = (sessions || []).map((session) => session.id)
  const slotIds = Array.from(new Set((sessions || []).map((session) => session.schedule_slot_id).filter(Boolean) as string[]))
  const groupSessionIdsBySessionId: Record<string, string[]> = {}
  const groupContextBySessionId: Record<string, { groupName: string | null; coachId: string | null; coachName: string | null }> = {}
  const slotSessionIdsBySlotId: Record<string, string[]> = {}
  const attendanceBySessionId: Record<string, AttendanceRow> = {}
  const attendanceCountBySessionId: Record<string, number> = {}
  const checkinsBySlotCoachKey: Record<string, CoachCheckinRow> = {}
  const checkinsBySlotId: Record<string, CoachCheckinRow> = {}

  if (slotIds.length > 0) {
    const { data: groups } = await supabase
      .from('coach_assignment_groups')
      .select(`
        id, schedule_slot_id, name, coach_id,
        profiles!coach_assignment_groups_coach_id_fkey(full_name, email),
        coach_assignment_group_students(booking_session_id)
      `)
      .in('schedule_slot_id', slotIds) as unknown as { data: GroupRow[] | null }

    ;(groups || []).forEach((group) => {
      const groupSessionIds = (group.coach_assignment_group_students || []).map((student) => student.booking_session_id)
      groupSessionIds.forEach((sessionId) => {
        if (sessionIds.includes(sessionId)) {
          groupSessionIdsBySessionId[sessionId] = groupSessionIds
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
      if (!checkinsBySlotId[checkin.schedule_slot_id]) checkinsBySlotId[checkin.schedule_slot_id] = checkin
    })

    const { data: slotSessions } = await supabase
      .from('booking_sessions')
      .select('id, schedule_slot_id')
      .in('schedule_slot_id', slotIds)
      .neq('status', 'rescheduled')
      .limit(1000) as unknown as { data: SlotSessionRow[] | null }

    ;(slotSessions || []).forEach((session) => {
      if (!session.schedule_slot_id) return
      const rows = slotSessionIdsBySlotId[session.schedule_slot_id] || []
      rows.push(session.id)
      slotSessionIdsBySlotId[session.schedule_slot_id] = rows
    })
  }

  const attendanceScopeSessionIds = Array.from(new Set([
    ...sessionIds,
    ...Object.values(groupSessionIdsBySessionId).flat(),
    ...Object.values(slotSessionIdsBySlotId).flat(),
  ]))

  if (attendanceScopeSessionIds.length > 0) {
    const { data: attendanceRows } = await supabase
      .from('attendance')
      .select('booking_session_id, status')
      .in('booking_session_id', attendanceScopeSessionIds) as unknown as { data: AttendanceRow[] | null }

    ;(attendanceRows || []).forEach((attendance) => {
      attendanceCountBySessionId[attendance.booking_session_id] = (attendanceCountBySessionId[attendance.booking_session_id] || 0) + 1
      if (sessionIds.includes(attendance.booking_session_id)) {
        attendanceBySessionId[attendance.booking_session_id] = attendance
      }
    })
  }

  const sessionList = (sessions || []).map((session) => {
    const learnerName = session.child_id
      ? (session.children?.nickname || session.children?.full_name || 'ไม่ทราบ')
      : (session.bookings?.profiles?.full_name || 'ไม่ทราบ')

    const groupContext = groupContextBySessionId[session.id] || null
    const checkin = groupContext?.coachId && session.schedule_slot_id
      ? checkinsBySlotCoachKey[`${session.schedule_slot_id}:${groupContext.coachId}`] || checkinsBySlotId[session.schedule_slot_id] || null
      : session.schedule_slot_id
        ? checkinsBySlotId[session.schedule_slot_id] || null
        : null

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
      attendance_status: attendanceBySessionId[session.id]?.status || null,
      attendance_scope_count: (groupSessionIdsBySessionId[session.id] || slotSessionIdsBySlotId[session.schedule_slot_id || ''] || [session.id])
        .reduce((sum, sessionId) => sum + (attendanceCountBySessionId[sessionId] || 0), 0),
      user_name: session.bookings?.profiles?.full_name || 'ไม่ทราบ',
      learner_name: learnerName,
      branch_name: session.bookings?.branches?.name || 'ไม่ทราบ',
      course_type: session.bookings?.course_types?.name || '',
      is_makeup: session.is_makeup || false,
      group_name: groupContext?.groupName || null,
      coach_name: groupContext?.coachName || null,
      coach_checkin_time: checkin?.checkin_time || null,
      coach_checkin_photo_url: checkin?.photo_url || null,
      coach_checkin_has_location: checkin?.location_lat != null && checkin?.location_lng != null,
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
    />
  )
}
