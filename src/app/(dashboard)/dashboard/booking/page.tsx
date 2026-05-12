import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BookingClient } from '@/components/dashboard/booking-client'
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

export default async function BookingPage({ searchParams }: { searchParams: { editBookingId?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Fetch children for this parent
  const { data: children } = await supabase
    .from('children')
    .select('*')
    .eq('parent_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch branches
  const { data: branches } = await supabase
    .from('branches')
    .select('*')
    .eq('is_active', true)
    .order('name')

  // Fetch course types to get UUIDs
  const { data: courseTypes } = await supabase
    .from('course_types')
    .select('id, name')

  const { data: scheduleTemplates } = await supabase
    .from('schedule_templates')
    .select(`
      id, branch_id, course_type_id, day_of_week, start_time, end_time, is_active, notes,
      branches(slug),
      course_types(name)
    `)
    .eq('is_active', true) as unknown as { data: ScheduleTemplateRow[] | null }

  // Fetch user profile
  const { data: profile } = await (supabase
    .from('profiles') as any)
    .select('full_name, phone')
    .eq('id', user.id)
    .single()

  // Fetch existing bookings for sibling pricing calculation (include total_price for incremental pricing)
  const { data: existingBookings } = await (supabase
    .from('bookings') as any)
    .select('id, child_id, course_type_id, month, year, total_sessions, total_price, status')
    .eq('user_id', user.id)
    .in('status', ['pending_payment', 'paid', 'verified'])

  // Fetch existing booking sessions for calendar display (prevent double-booking)
  const existingBookingIds = (existingBookings || []).map((b: any) => b.id)
  let existingSessionsData: any[] = []
  if (existingBookingIds.length > 0) {
    const { data: sessions } = await (supabase.from('booking_sessions') as any)
      .select('id, booking_id, date, start_time, end_time, branch_id, child_id, status')
      .in('booking_id', existingBookingIds)
      .neq('status', 'rescheduled')
    existingSessionsData = sessions || []
  }

  // If editing an existing booking, fetch its data + sessions
  let editBookingData: any = null
  if (searchParams.editBookingId) {
    const { data: booking } = await (supabase.from('bookings') as any)
      .select('id, user_id, learner_type, child_id, branch_id, course_type_id, month, year, total_sessions, total_price, status, course_types(name)')
      .eq('id', searchParams.editBookingId)
      .eq('user_id', user.id)
      .single()

    if (booking && booking.status === 'pending_payment') {
      const { data: sessions } = await (supabase.from('booking_sessions') as any)
        .select('id, date, start_time, end_time, branch_id, child_id')
        .eq('booking_id', booking.id)
        .order('date', { ascending: true })

      // Get all child_ids from sessions for multi-child bookings
      const childIds = Array.from(new Set((sessions || []).map((s: any) => s.child_id).filter(Boolean))) as string[]

      editBookingData = { ...booking, sessions: sessions || [], childIds }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">
          {editBookingData ? 'แก้ไขวันจองเรียน' : 'จองคอร์สเรียน'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {editBookingData ? 'เลือกวันเรียนใหม่จากปฏิทิน' : 'เลือกประเภท สาขา วัน/เวลา และจองคอร์สเรียน'}
        </p>
      </div>
      <BookingClient
        userId={user.id}
        userName={(profile as any)?.full_name || ''}
        children={children || []}
        branches={branches || []}
        courseTypes={(courseTypes as any) || []}
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
        existingBookings={(existingBookings as any) || []}
        existingBookingSessions={existingSessionsData}
        editBooking={editBookingData}
      />
    </div>
  )
}
