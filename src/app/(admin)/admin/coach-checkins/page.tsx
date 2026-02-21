import { createClient } from '@/lib/supabase/server'
import { CoachCheckinsClient } from '@/components/admin/coach-checkins-client'

export default async function CoachCheckinsPage() {
  const supabase = createClient()

  const [{ data: checkins }, { data: branches }] = await Promise.all([
    supabase
      .from('coach_checkins')
      .select('id, coach_id, branch_id, checkin_time, photo_url, location_lat, location_lng, created_at, profiles!coach_checkins_coach_id_fkey(full_name), branches(name)')
      .order('checkin_time', { ascending: false })
      .limit(200) as any,
    supabase
      .from('branches')
      .select('id, name')
      .eq('is_active', true)
      .order('name') as any,
  ])

  const checkinList = (checkins || []).map((c: any) => ({
    id: c.id,
    coach_id: c.coach_id,
    branch_id: c.branch_id,
    checkin_time: c.checkin_time,
    photo_url: c.photo_url,
    location_lat: c.location_lat,
    location_lng: c.location_lng,
    created_at: c.created_at,
    coach_name: c.profiles?.full_name || 'ไม่ทราบ',
    branch_name: c.branches?.name || 'ไม่ทราบ',
  }))

  return <CoachCheckinsClient checkins={checkinList} branches={branches || []} />
}
