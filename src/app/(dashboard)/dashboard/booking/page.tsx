import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BookingClient } from '@/components/dashboard/booking-client'

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

  // Fetch user profile
  const { data: profile } = await (supabase
    .from('profiles') as any)
    .select('full_name, phone')
    .eq('id', user.id)
    .single()

  // Fetch existing bookings for sibling pricing calculation
  const { data: existingBookings } = await (supabase
    .from('bookings') as any)
    .select('id, child_id, course_type_id, month, year, total_sessions, status')
    .eq('user_id', user.id)
    .in('status', ['pending_payment', 'paid', 'verified'])

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
        existingBookings={(existingBookings as any) || []}
        editBooking={editBookingData}
      />
    </div>
  )
}
