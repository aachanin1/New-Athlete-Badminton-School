import { createClient } from '@/lib/supabase/server'
import { BranchesClient } from '@/components/admin/branches-client'

export default async function BranchesPage() {
  const supabase = createClient()

  const [{ data: branches }, { data: coachBranches }, { data: bookings }] = await Promise.all([
    supabase.from('branches').select('id, name, slug, address, is_active, created_at').order('name') as any,
    supabase.from('coach_branches').select('branch_id') as any,
    supabase.from('bookings').select('branch_id').in('status', ['paid', 'verified']) as any,
  ])

  // Count coaches and bookings per branch
  const coachCountMap: Record<string, number> = {}
  ;(coachBranches || []).forEach((cb: any) => {
    coachCountMap[cb.branch_id] = (coachCountMap[cb.branch_id] || 0) + 1
  })

  const bookingCountMap: Record<string, number> = {}
  ;(bookings || []).forEach((b: any) => {
    bookingCountMap[b.branch_id] = (bookingCountMap[b.branch_id] || 0) + 1
  })

  const branchList = (branches || []).map((b: any) => ({
    ...b,
    coach_count: coachCountMap[b.id] || 0,
    booking_count: bookingCountMap[b.id] || 0,
  }))

  return <BranchesClient branches={branchList} />
}
