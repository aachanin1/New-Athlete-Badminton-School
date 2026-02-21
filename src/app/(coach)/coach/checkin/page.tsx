import { createClient } from '@/lib/supabase/server'
import { CheckinClient } from '@/components/coach/checkin-client'

export default async function CheckinPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = new Date().toISOString().split('T')[0]

  // Get coach's branches
  const { data: coachBranches } = await (supabase
    .from('coach_branches')
    .select('branch_id, branches(id, name)')
    .eq('coach_id', user.id) as any)

  const branches = (coachBranches || []).map((cb: any) => ({
    id: cb.branch_id,
    name: cb.branches?.name || '',
  }))

  // Get today's checkins
  const { data: checkins } = await (supabase
    .from('coach_checkins')
    .select('id, branch_id, checkin_time, photo_url, branches(name)')
    .eq('coach_id', user.id)
    .gte('created_at', today + 'T00:00:00')
    .order('checkin_time', { ascending: false }) as any)

  const todayCheckins = (checkins || []).map((ci: any) => ({
    id: ci.id,
    branchName: ci.branches?.name || '',
    checkinTime: ci.checkin_time,
    photoUrl: ci.photo_url,
  }))

  return <CheckinClient branches={branches} todayCheckins={todayCheckins} />
}
