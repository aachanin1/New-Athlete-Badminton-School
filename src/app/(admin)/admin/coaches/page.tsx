import { createClient } from '@/lib/supabase/server'
import { CoachesClient } from '@/components/admin/coaches-client'

export default async function CoachesPage() {
  const supabase = createClient()

  // Fetch all coaches (role = coach or head_coach)
  const { data: profiles } = await (supabase
    .from('profiles')
    .select('id, full_name, email, phone, role, created_at')
    .in('role', ['coach', 'head_coach'])
    .order('created_at', { ascending: false }) as any)

  // Fetch coach_branches with branch name
  const { data: coachBranches } = await (supabase
    .from('coach_branches')
    .select('coach_id, branch_id, is_head_coach, branches(name)') as any)

  // Fetch all branches
  const { data: branches } = await (supabase
    .from('branches')
    .select('id, name, slug, address, is_active, created_at, updated_at')
    .eq('is_active', true)
    .order('name') as any)

  // Build coach data with branches
  const coaches = (profiles || []).map((p: any) => {
    const cbs = (coachBranches || []).filter((cb: any) => cb.coach_id === p.id)
    return {
      ...p,
      branches: cbs.map((cb: any) => ({
        branch_id: cb.branch_id,
        is_head_coach: cb.is_head_coach,
        branch_name: cb.branches?.name || 'ไม่ทราบ',
      })),
    }
  })

  return <CoachesClient coaches={coaches} branches={branches || []} />
}
