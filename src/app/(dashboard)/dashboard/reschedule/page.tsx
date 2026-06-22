import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RescheduleClient } from '@/components/dashboard/reschedule-client'
import type { CourseTypeName } from '@/types/database'

const RESCHEDULE_CUTOFF_HOURS = 12

interface RescheduleSessionRow {
  id: string
  booking_id: string
  date: string
  start_time: string
  end_time: string
  branch_id: string
  status: string
  is_makeup: boolean
  child_id: string | null
  schedule_slot_id: string | null
  children?: { full_name: string; nickname: string | null } | null
  bookings?: {
    user_id: string
    course_type_id: string
    status: string
    course_types?: { name: CourseTypeName | null } | null
  } | null
  branches?: { name: string } | null
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

export default async function ReschedulePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const today = new Date().toISOString().split('T')[0]
  const [{ data: sessions }, { data: branches }, { data: scheduleTemplates }] = await Promise.all([
    supabase
      .from('booking_sessions')
      .select('id, booking_id, date, start_time, end_time, branch_id, status, is_makeup, child_id, schedule_slot_id, bookings!inner(user_id, course_type_id, status, course_types(name)), branches(name), children(full_name, nickname)')
      .eq('bookings.user_id', user.id)
      .eq('bookings.status', 'verified')
      .eq('status', 'scheduled')
      .gte('date', today)
      .order('date', { ascending: true }) as unknown as PromiseLike<{ data: RescheduleSessionRow[] | null }>,
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
      `) as unknown as PromiseLike<{ data: ScheduleTemplateRow[] | null }>,
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">เปลี่ยนวัน/สาขา</h1>
        <p className="mt-1 text-sm text-gray-500">เปลี่ยนรอบเรียนจากรอบจริงในระบบ โดยต้องล่วงหน้าอย่างน้อย {RESCHEDULE_CUTOFF_HOURS} ชั่วโมง</p>
      </div>

      <RescheduleClient
        sessions={sessions || []}
        branches={branches || []}
        scheduleTemplates={(scheduleTemplates || []).map((template) => ({
          id: template.id,
          branch_id: template.branch_id,
          branch_slug: template.branches?.slug || '',
          course_type_id: template.course_type_id,
          course_type_name: template.course_types?.name || 'kids_group',
          day_of_week: template.day_of_week,
          start_time: template.start_time,
          end_time: template.end_time,
          is_active: template.is_active,
          notes: template.notes,
        }))}
      />
    </div>
  )
}
