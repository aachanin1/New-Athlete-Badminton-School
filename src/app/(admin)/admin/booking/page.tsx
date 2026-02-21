import { createClient } from '@/lib/supabase/server'
import { AdminBookingClient } from '@/components/admin/admin-booking-client'

export default async function AdminBookingPage() {
  const supabase = createClient()

  // Fetch all users (role = user primarily, but allow all)
  const { data: profiles } = await (supabase
    .from('profiles')
    .select('id, full_name, email, phone, role')
    .order('full_name') as any)

  // Fetch all children
  const { data: children } = await (supabase
    .from('children')
    .select('id, parent_id, full_name, nickname') as any)

  // Fetch branches
  const { data: branches } = await (supabase
    .from('branches')
    .select('id, name, slug, address, is_active, created_at, updated_at')
    .eq('is_active', true)
    .order('name') as any)

  // Fetch course types
  const { data: courseTypes } = await (supabase
    .from('course_types')
    .select('id, name') as any)

  // Fetch existing bookings for incremental pricing
  const { data: bookings } = await (supabase
    .from('bookings')
    .select('id, user_id, course_type_id, month, year, total_sessions, total_price')
    .in('status', ['paid', 'verified']) as any)

  // Build user list with children
  const users = (profiles || []).map((p: any) => ({
    ...p,
    children: (children || []).filter((c: any) => c.parent_id === p.id).map((c: any) => ({
      id: c.id,
      full_name: c.full_name,
      nickname: c.nickname,
    })),
  }))

  return (
    <AdminBookingClient
      users={users}
      branches={branches || []}
      courseTypes={courseTypes || []}
      existingBookings={bookings || []}
    />
  )
}
