import { createClient } from '@/lib/supabase/server'
import { MakeupClient } from '@/components/admin/makeup-client'
import type { CourseTypeName } from '@/types/database'

interface MakeupSessionRow {
  id: string
  booking_id: string
  branch_id: string
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
  const supabase = createClient()

  const [{ data: sessions }, { data: branches }, { data: scheduleTemplates }] = await Promise.all([
    supabase
      .from('booking_sessions')
      .select(`
        id, booking_id, date, start_time, end_time, status, is_makeup, child_id, branch_id, rescheduled_from_id,
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

  const sessionList = (sessions || []).map((session) => {
    const learnerName = session.child_id
      ? (session.children?.nickname || session.children?.full_name || 'ไม่ทราบ')
      : (session.bookings?.profiles?.full_name || 'ไม่ทราบ')

    return {
      id: session.id,
      booking_id: session.booking_id,
      branch_id: session.branch_id,
      rescheduled_from_id: session.rescheduled_from_id,
      date: session.date,
      start_time: session.start_time,
      end_time: session.end_time,
      status: session.status,
      user_name: session.bookings?.profiles?.full_name || 'ไม่ทราบ',
      learner_name: learnerName,
      branch_name: session.bookings?.branches?.name || 'ไม่ทราบ',
      course_type: session.bookings?.course_types?.name || '',
      is_makeup: session.is_makeup || false,
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
