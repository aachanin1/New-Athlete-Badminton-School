import { createClient } from '@/lib/supabase/server'
import { UsersClient } from '@/components/admin/users-client'

export default async function UsersPage() {
  const supabase = createClient()

  // Fetch all profiles
  const { data: profiles } = await (supabase
    .from('profiles')
    .select('id, full_name, email, phone, role, created_at')
    .order('created_at', { ascending: false }) as any)

  // Fetch all children
  const { data: children } = await (supabase
    .from('children')
    .select('id, parent_id, full_name, nickname') as any)

  // Fetch booking counts per user
  const { data: bookings } = await (supabase
    .from('bookings')
    .select('user_id') as any)

  const bookingCountMap: Record<string, number> = {}
  ;(bookings || []).forEach((b: any) => {
    bookingCountMap[b.user_id] = (bookingCountMap[b.user_id] || 0) + 1
  })

  // Build user data
  const users = (profiles || []).map((p: any) => ({
    ...p,
    children: (children || []).filter((c: any) => c.parent_id === p.id).map((c: any) => ({
      id: c.id,
      full_name: c.full_name,
      nickname: c.nickname,
    })),
    booking_count: bookingCountMap[p.id] || 0,
  }))

  return <UsersClient users={users} />
}
