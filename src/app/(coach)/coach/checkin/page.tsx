import { createClient } from '@/lib/supabase/server'
import { CheckinClient } from '@/components/coach/checkin-client'

export default async function CheckinPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = new Date().toISOString().split('T')[0]

  const { data: assignments } = await (supabase
    .from('coach_assignments')
    .select(`
      schedule_slot_id,
      schedule_slots!inner(id, branch_id, date, start_time, end_time,
        branches(name),
        course_types(name)
      )
    `)
    .eq('coach_id', user.id)
    .eq('schedule_slots.date', today)
    .order('schedule_slot_id') as any)

  const slots = (assignments || []).map((assignment: any) => ({
    id: assignment.schedule_slots?.id || assignment.schedule_slot_id,
    branchId: assignment.schedule_slots?.branch_id || '',
    branchName: assignment.schedule_slots?.branches?.name || '',
    courseType: assignment.schedule_slots?.course_types?.name || '',
    startTime: assignment.schedule_slots?.start_time || '',
    endTime: assignment.schedule_slots?.end_time || '',
  }))

  const slotIds = slots.map((slot: any) => slot.id).filter(Boolean)

  const { data: checkins } = slotIds.length > 0
    ? await (supabase
      .from('coach_checkins')
      .select('id, schedule_slot_id, branch_id, checkin_time, photo_url, schedule_slots(start_time, end_time, branches(name), course_types(name))')
      .eq('coach_id', user.id)
      .in('schedule_slot_id', slotIds)
      .order('checkin_time', { ascending: false }) as any)
    : { data: [] }

  const todayCheckins = (checkins || []).map((ci: any) => ({
    id: ci.id,
    scheduleSlotId: ci.schedule_slot_id,
    branchName: ci.schedule_slots?.branches?.name || '',
    courseType: ci.schedule_slots?.course_types?.name || '',
    startTime: ci.schedule_slots?.start_time || '',
    endTime: ci.schedule_slots?.end_time || '',
    checkinTime: ci.checkin_time,
    photoUrl: ci.photo_url,
  }))

  return <CheckinClient slots={slots} todayCheckins={todayCheckins} />
}
