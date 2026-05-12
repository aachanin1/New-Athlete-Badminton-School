import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RescheduleClient } from '@/components/dashboard/reschedule-client'
import type { CourseTypeName } from '@/types/database'

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
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Fetch upcoming scheduled sessions (only future, status=scheduled, booking verified)
  const today = new Date().toISOString().split('T')[0]
  const { data: sessions } = await (supabase
    .from('booking_sessions') as any)
    .select('*, bookings!inner(user_id, course_type_id, status, course_types(name)), branches(name), children(full_name)')
    .eq('bookings.user_id', user.id)
    .eq('bookings.status', 'verified')
    .eq('status', 'scheduled')
    .gte('date', today)
    .order('date', { ascending: true })

  // Fetch branches for rescheduling target (include slug for schedule lookup)
  const [{ data: branches }, { data: scheduleTemplates }] = await Promise.all([
    supabase
      .from('branches')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('schedule_templates')
      .select(`
        id, branch_id, course_type_id, day_of_week, start_time, end_time, is_active, notes,
        branches(slug),
        course_types(name)
      `) as unknown as Promise<{ data: ScheduleTemplateRow[] | null }>,
  ])

  // Check if user is admin
  const { data: profile } = await (supabase
    .from('profiles') as any)
    .select('role')
    .eq('id', user.id)
    .single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">เปลี่ยนวัน/สาขา</h1>
        <p className="text-gray-500 text-sm mt-1">เปลี่ยนวันเรียนหรือสาขาได้ล่วงหน้า 24 ชั่วโมง</p>
      </div>
      <RescheduleClient
        sessions={sessions || []}
        branches={(branches as any) || []}
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
        isAdmin={isAdmin}
      />
    </div>
  )
}
