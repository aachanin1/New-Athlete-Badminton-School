import { createClient } from '@/lib/supabase/server'
import { SchedulesClient } from '@/components/admin/schedules-client'
import { requireAdminPageAccess } from '@/lib/auth/admin'

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

export default async function SchedulesPage() {
  await requireAdminPageAccess()
  const supabase = createClient()
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

  let coachAssignments: CoachAssignmentRow[] = []
  if (slotIds.length > 0) {
    const { data } = await supabase
      .from('coach_assignments')
      .select('schedule_slot_id, profiles!coach_assignments_coach_id_fkey(full_name)')
      .in('schedule_slot_id', slotIds) as unknown as { data: CoachAssignmentRow[] | null }
    coachAssignments = data || []
  }

  const coachMap = coachAssignments.reduce((map: Record<string, string[]>, item) => {
    if (!map[item.schedule_slot_id]) map[item.schedule_slot_id] = []
    const coachName = item.profiles?.full_name
    if (coachName && !map[item.schedule_slot_id].includes(coachName)) {
      map[item.schedule_slot_id].push(coachName)
    }
    return map
  }, {})

  const scheduleSessions = (sessions || []).map((session) => ({
    id: session.id,
    date: session.date,
    start_time: session.start_time,
    end_time: session.end_time,
    status: session.status,
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
    coach_names: session.schedule_slot_id ? coachMap[session.schedule_slot_id] || [] : [],
  }))

  return (
    <SchedulesClient
      sessions={scheduleSessions}
      branches={branches || []}
    />
  )
}
