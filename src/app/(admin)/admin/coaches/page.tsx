import { createClient } from '@/lib/supabase/server'
import { CoachesClient } from '@/components/admin/coaches-client'

interface CoachProfileRow {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  role: string | null
  coach_employment_type: string | null
  created_at: string
}

interface CoachBranchRow {
  coach_id: string
  branch_id: string
  is_head_coach: boolean
  branches?: { name: string | null } | null
}

interface BranchRow {
  id: string
  name: string
  slug: string | null
  address: string | null
  is_active: boolean
  created_at: string
  updated_at: string | null
}

export default async function CoachesPage() {
  const supabase = createClient()

  // Fetch all coaches (role = coach or head_coach)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role, coach_employment_type, created_at')
    .in('role', ['coach', 'head_coach'])
    .order('created_at', { ascending: false }) as unknown as { data: CoachProfileRow[] | null }

  // Fetch coach_branches with branch name
  const { data: coachBranches } = await supabase
    .from('coach_branches')
    .select('coach_id, branch_id, is_head_coach, branches(name)') as unknown as { data: CoachBranchRow[] | null }

  // Fetch all branches
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, slug, address, is_active, created_at, updated_at')
    .eq('is_active', true)
    .order('name') as unknown as { data: BranchRow[] | null }

  // Build coach data with branches
  const coaches = (profiles || []).map((p) => {
    const cbs = (coachBranches || []).filter((cb) => cb.coach_id === p.id)
    return {
      id: p.id,
      full_name: p.full_name || 'ไม่ทราบชื่อ',
      email: p.email || '',
      phone: p.phone,
      role: p.role || 'coach',
      employment_type: p.coach_employment_type,
      created_at: p.created_at,
      branches: cbs.map((cb) => ({
        branch_id: cb.branch_id,
        is_head_coach: cb.is_head_coach,
        branch_name: cb.branches?.name || 'ไม่ทราบ',
      })),
    }
  })

  return <CoachesClient coaches={coaches} branches={(branches || []).map((branch) => ({ ...branch, slug: branch.slug || '', updated_at: branch.updated_at || branch.created_at }))} />
}
