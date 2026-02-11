import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ScheduleCalendarClient } from '@/components/dashboard/schedule-calendar-client'

export default async function SchedulePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Fetch all booking sessions for this user — only from verified bookings
  // child_id is on session level (supports multi-child bookings)
  // Exclude rescheduled (old) sessions — only show scheduled/completed/absent
  const { data: allSessions } = await (supabase
    .from('booking_sessions') as any)
    .select('*, bookings!inner(user_id, course_type_id, status, course_types(name)), branches(name), children(full_name, nickname)')
    .eq('bookings.user_id', user.id)
    .eq('bookings.status', 'verified')
    .neq('status', 'rescheduled')
    .order('date', { ascending: true })

  // For sessions that were rescheduled FROM another, fetch the original session info
  const sessionsArr = (allSessions || []) as any[]
  const fromIds = sessionsArr.filter((s) => s.rescheduled_from_id).map((s) => s.rescheduled_from_id)
  let fromMap: Record<string, any> = {}
  if (fromIds.length > 0) {
    const { data: fromSessions } = await (supabase
      .from('booking_sessions') as any)
      .select('id, date, start_time, end_time')
      .in('id', fromIds)
    ;(fromSessions || []).forEach((s: any) => { fromMap[s.id] = s })
  }
  const sessions = sessionsArr.map((s) => ({
    ...s,
    rescheduled_from: s.rescheduled_from_id ? fromMap[s.rescheduled_from_id] || null : null,
  }))

  // Fetch children for legend
  const { data: children } = await supabase
    .from('children')
    .select('id, full_name, nickname')
    .eq('parent_id', user.id)

  // Fetch user profile
  const { data: profile } = await (supabase
    .from('profiles') as any)
    .select('full_name')
    .eq('id', user.id)
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">ตารางเรียน</h1>
        <p className="text-gray-500 text-sm mt-1">ดูตารางเรียนรายเดือน</p>
      </div>
      <ScheduleCalendarClient
        sessions={(sessions as any) || []}
        children={(children as any) || []}
        userName={(profile as any)?.full_name || ''}
      />
    </div>
  )
}
