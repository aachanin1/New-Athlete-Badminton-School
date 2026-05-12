import { createClient } from '@/lib/supabase/server'
import { CoachCheckinsClient } from '@/components/admin/coach-checkins-client'

interface AssignmentRow {
  id: string
  coach_id: string
  schedule_slot_id: string
  profiles?: { full_name: string | null } | null
  schedule_slots?: {
    id: string
    branch_id: string
    date: string
    start_time: string
    end_time: string
    branches?: { name: string | null } | null
    course_types?: { name: string | null } | null
  } | null
}

interface CheckinRow {
  id: string
  coach_id: string
  schedule_slot_id: string
  branch_id: string
  checkin_time: string
  photo_url: string | null
  location_lat: number | null
  location_lng: number | null
  created_at: string
}

interface BranchRow {
  id: string
  name: string
}

function getMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const toInput = (value: Date) => {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return { start: toInput(start), end: toInput(end) }
}

export default async function CoachCheckinsPage() {
  const supabase = createClient()
  const range = getMonthRange()

  const [{ data: assignments }, { data: checkins }, { data: branches }] = await Promise.all([
    supabase
      .from('coach_assignments')
      .select(`
        id, coach_id, schedule_slot_id,
        profiles!coach_assignments_coach_id_fkey(full_name),
        schedule_slots!inner(id, branch_id, date, start_time, end_time,
          branches(name),
          course_types(name)
        )
      `)
      .gte('schedule_slots.date', range.start)
      .lt('schedule_slots.date', range.end)
      .limit(600) as unknown as PromiseLike<{ data: AssignmentRow[] | null }>,
    supabase
      .from('coach_checkins')
      .select('id, coach_id, schedule_slot_id, branch_id, checkin_time, photo_url, location_lat, location_lng, created_at')
      .gte('checkin_time', `${range.start}T00:00:00`)
      .lt('checkin_time', `${range.end}T00:00:00`)
      .order('checkin_time', { ascending: false })
      .limit(600) as unknown as PromiseLike<{ data: CheckinRow[] | null }>,
    supabase
      .from('branches')
      .select('id, name')
      .eq('is_active', true)
      .order('name') as unknown as PromiseLike<{ data: BranchRow[] | null }>,
  ])

  const checkinMap = new Map<string, CheckinRow>()
  ;(checkins || []).forEach((checkin) => {
    const key = `${checkin.coach_id}:${checkin.schedule_slot_id}`
    if (!checkinMap.has(key)) checkinMap.set(key, checkin)
  })

  const auditRows = (assignments || [])
    .filter((assignment) => assignment.schedule_slots)
    .map((assignment) => {
      const slot = assignment.schedule_slots
      const checkin = checkinMap.get(`${assignment.coach_id}:${assignment.schedule_slot_id}`)
      return {
        assignment_id: assignment.id,
        coach_id: assignment.coach_id,
        coach_name: assignment.profiles?.full_name || 'ไม่ทราบ',
        schedule_slot_id: assignment.schedule_slot_id,
        branch_id: slot?.branch_id || '',
        branch_name: slot?.branches?.name || 'ไม่ทราบ',
        course_type: slot?.course_types?.name || '',
        date: slot?.date || '',
        start_time: slot?.start_time || '',
        end_time: slot?.end_time || '',
        checkin_id: checkin?.id || null,
        checkin_time: checkin?.checkin_time || null,
        photo_url: checkin?.photo_url || null,
        location_lat: checkin?.location_lat || null,
        location_lng: checkin?.location_lng || null,
      }
    })
    .sort((a, b) => `${b.date} ${b.start_time}`.localeCompare(`${a.date} ${a.start_time}`))

  return <CoachCheckinsClient rows={auditRows} branches={branches || []} />
}
