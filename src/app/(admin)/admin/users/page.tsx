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

interface QueryError {
  message?: string
}

interface QueryRowsResult<T> {
  data: T[] | null
  error: QueryError | null
}

const RANGE_READ_PAGE_SIZE = 1000

function getQueryErrorMessage(error: QueryError | null | undefined) {
  return error?.message || 'Unknown query error'
}

async function readAllRangePages<T>(
  label: string,
  buildQuery: (start: number, end: number) => Promise<QueryRowsResult<T>>,
) {
  const rows: T[] = []

  for (let start = 0; ; start += RANGE_READ_PAGE_SIZE) {
    const end = start + RANGE_READ_PAGE_SIZE - 1
    const { data, error } = await buildQuery(start, end)

    if (error) {
      throw new Error(`[admin/users] ${label} read failed: ${getQueryErrorMessage(error)}`)
    }

    const pageRows = data || []
    rows.push(...pageRows)

    if (pageRows.length < RANGE_READ_PAGE_SIZE) break
  }

  return rows
}

export default async function UsersPage() {
  const { role } = await requireAdminPageAccess()
  const supabase = await createClient()

  const profiles = await readAllRangePages<ProfileRow>(
    'profiles',
    (start, end) => supabase
      .from('profiles')
      .select('id, full_name, email, phone, role, created_at')
      .order('created_at', { ascending: false })
      .range(start, end) as unknown as Promise<QueryRowsResult<ProfileRow>>,
  )

  const children = await readAllRangePages<ChildRow>(
    'children',
    (start, end) => supabase
      .from('children')
      .select('id, parent_id, full_name, nickname')
      .order('id', { ascending: true })
      .range(start, end) as unknown as Promise<QueryRowsResult<ChildRow>>,
  )

  const bookings = await readAllRangePages<BookingUserRow>(
    'bookings',
    (start, end) => supabase
      .from('bookings')
      .select('user_id')
      .order('id', { ascending: true })
      .range(start, end) as unknown as Promise<QueryRowsResult<BookingUserRow>>,
  )

  const bookingCountMap: Record<string, number> = {}
  bookings.forEach((b) => {
    bookingCountMap[b.user_id] = (bookingCountMap[b.user_id] || 0) + 1
  })

  const childrenByParentId = new Map<string, ChildRow[]>()
  children.forEach((child) => {
    const parentChildren = childrenByParentId.get(child.parent_id) || []
    parentChildren.push(child)
    childrenByParentId.set(child.parent_id, parentChildren)
  })

  // Build user data
  const users = profiles.map((p) => ({
    id: p.id,
    full_name: p.full_name || 'ไม่ทราบชื่อ',
    email: p.email || '',
    phone: p.phone,
    role: p.role || 'user',
    created_at: p.created_at,
    children: (childrenByParentId.get(p.id) || []).map((c) => ({
      id: c.id,
      full_name: c.full_name,
      nickname: c.nickname,
    })),
    booking_count: bookingCountMap[p.id] || 0,
  }))

  return <UsersClient users={users} currentAdminRole={role || 'admin'} />
}
