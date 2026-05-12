import { createClient } from '@/lib/supabase/server'
import { SchedulesClient } from '@/components/admin/schedules-client'
import { requireAdminPageAccess } from '@/lib/auth/admin'
import type { CourseTypeName } from '@/types/database'

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

interface CourseTypeRow {
  id: string
  name: CourseTypeName
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
  branches?: { slug: string | null; name: string | null } | null
  course_types?: { name: CourseTypeName | null } | null
}

export default async function SchedulesPage() {
  const { role } = await requireAdminPageAccess()
  const supabase = createClient()
  const [{ data: sessions }, { data: branches }, { data: courseTypes }, { data: templates }] = await Promise.all([
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
    supabase.from('course_types').select('id, name').order('name') as unknown as Promise<{ data: CourseTypeRow[] | null }>,
    supabase
      .from('schedule_templates')
      .select(`
        id, branch_id, course_type_id, day_of_week, start_time, end_time, is_active, notes,
        branches(name, slug),
        course_types(name)
      `)
      .order('day_of_week')
      .order('start_time') as unknown as Promise<{ data: ScheduleTemplateRow[] | null }>,
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

  const scheduleTemplates = (templates || []).map((template) => ({
    id: template.id,
    branch_id: template.branch_id,
    branch_slug: template.branches?.slug || '',
    branch_name: template.branches?.name || 'ไม่ทราบสาขา',
    course_type_id: template.course_type_id,
    course_type_name: template.course_types?.name || 'kids_group',
    day_of_week: template.day_of_week,
    start_time: template.start_time.slice(0, 5),
    end_time: template.end_time.slice(0, 5),
    is_active: template.is_active,
    notes: template.notes,
  }))

  return (
    <SchedulesClient
      sessions={scheduleSessions}
      branches={branches || []}
      courseTypes={courseTypes || []}
      templates={scheduleTemplates}
      canManageTemplates={role === 'super_admin'}
    />
  )
}
