import { createClient } from '@/lib/supabase/server'
import { BranchesClient } from '@/components/admin/branches-client'

interface BranchRow {
  id: string
  name: string
  slug: string | null
  address: string | null
  is_active: boolean
  created_at: string
}

interface BranchIdRow {
  branch_id: string | null
}

export default async function BranchesPage() {
  const supabase = createClient()

  const [{ data: branches }, { data: coachBranches }, { data: bookings }] = await Promise.all([
    supabase.from('branches').select('id, name, slug, address, is_active, created_at').order('name') as unknown as Promise<{ data: BranchRow[] | null }>,
    supabase.from('coach_branches').select('branch_id') as unknown as Promise<{ data: BranchIdRow[] | null }>,
    supabase.from('bookings').select('branch_id').in('status', ['paid', 'verified']) as unknown as Promise<{ data: BranchIdRow[] | null }>,
  ])

  // Count coaches and bookings per branch
  const coachCountMap: Record<string, number> = {}
  ;(coachBranches || []).forEach((cb) => {
    if (!cb.branch_id) return
    coachCountMap[cb.branch_id] = (coachCountMap[cb.branch_id] || 0) + 1
  })

  const bookingCountMap: Record<string, number> = {}
  ;(bookings || []).forEach((b) => {
    if (!b.branch_id) return
    bookingCountMap[b.branch_id] = (bookingCountMap[b.branch_id] || 0) + 1
  })

  const branchList = (branches || []).map((b) => ({
    ...b,
    slug: b.slug || '',
    coach_count: coachCountMap[b.id] || 0,
    booking_count: bookingCountMap[b.id] || 0,
  }))

  return <BranchesClient branches={branchList} />
}
