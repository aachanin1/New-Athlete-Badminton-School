import { createClient } from '@/lib/supabase/server'
import { UsersClient } from '@/components/admin/users-client'
import { requireAdminPageAccess } from '@/lib/auth/admin'

type AdminUserRole = 'user' | 'coach' | 'head_coach' | 'admin' | 'super_admin'

interface ProfileRow {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  role: AdminUserRole | null
  created_at: string
}

interface ChildRow {
  id: string
  parent_id: string
  full_name: string
  nickname: string | null
}

interface BookingUserRow {
  user_id: string
}

export default async function UsersPage() {
  const { role } = await requireAdminPageAccess()
  const supabase = createClient()

  // Fetch all profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role, created_at')
    .order('created_at', { ascending: false }) as unknown as { data: ProfileRow[] | null }

  // Fetch all children
  const { data: children } = await supabase
    .from('children')
    .select('id, parent_id, full_name, nickname') as unknown as { data: ChildRow[] | null }

  // Fetch booking counts per user
  const { data: bookings } = await supabase
    .from('bookings')
    .select('user_id') as unknown as { data: BookingUserRow[] | null }

  const bookingCountMap: Record<string, number> = {}
  ;(bookings || []).forEach((b) => {
    bookingCountMap[b.user_id] = (bookingCountMap[b.user_id] || 0) + 1
  })

  // Build user data
  const users = (profiles || []).map((p) => ({
    id: p.id,
    full_name: p.full_name || 'ไม่ทราบชื่อ',
    email: p.email || '',
    phone: p.phone,
    role: p.role || 'user',
    created_at: p.created_at,
    children: (children || []).filter((c) => c.parent_id === p.id).map((c) => ({
      id: c.id,
      full_name: c.full_name,
      nickname: c.nickname,
    })),
    booking_count: bookingCountMap[p.id] || 0,
  }))

  return <UsersClient users={users} currentAdminRole={role || 'admin'} />
}
