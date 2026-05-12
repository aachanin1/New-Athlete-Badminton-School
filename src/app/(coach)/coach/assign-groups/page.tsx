import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AssignGroupsClient } from '@/components/coach/assign-groups-client'

export default async function AssignGroupsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Check head_coach or super_admin role
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as any
  if (!profile || !['head_coach', 'super_admin'].includes(profile.role)) {
    redirect('/coach')
  }

  // Get head coach's branches
  const { data: coachBranches } = await (supabase
    .from('coach_branches')
    .select('branch_id, branches(name)')
    .eq('coach_id', user.id) as any)

  const branchIds = (coachBranches || []).map((cb: any) => cb.branch_id)
  const branchMap: Record<string, string> = {}
  ;(coachBranches || []).forEach((cb: any) => { branchMap[cb.branch_id] = cb.branches?.name || '' })

  let coaches: any[] = []
  if (branchIds.length > 0) {
    const { data: allCoachBranches } = await (supabase
      .from('coach_branches')
      .select('coach_id, branch_id, profiles!coach_branches_coach_id_fkey(full_name, role)')
      .in('branch_id', branchIds) as any)

    const coachMap = new Map<string, any>()
    ;(allCoachBranches || []).forEach((cb: any) => {
      if (!coachMap.has(cb.coach_id)) {
        coachMap.set(cb.coach_id, {
          id: cb.coach_id,
          name: cb.profiles?.full_name || '',
          role: cb.profiles?.role || '',
          branches: [],
        })
      }
      coachMap.get(cb.coach_id)!.branches.push(branchMap[cb.branch_id] || '')
    })
    coaches = Array.from(coachMap.values())
  }

  const today = new Date().toISOString().split('T')[0]
  let sessionRows: any[] = []
  if (branchIds.length > 0) {
    const { data } = await (supabase
      .from('booking_sessions')
      .select(`
        id, date, start_time, end_time, branch_id, child_id, schedule_slot_id, status,
        children(full_name, nickname),
        bookings!inner(user_id, course_type_id, status,
          profiles!bookings_user_id_fkey(full_name),
          course_types(name)
        )
      `)
      .gte('date', today)
      .in('branch_id', branchIds)
      .in('status', ['scheduled', 'completed'])
      .in('bookings.status', ['pending_payment', 'paid', 'verified'])
      .neq('status', 'rescheduled')
      .order('date', { ascending: true })
      .order('start_time', { ascending: true }) as any)
    sessionRows = data || []
  }

  const slotIds = Array.from(new Set(sessionRows.map((row: any) => row.schedule_slot_id).filter(Boolean))) as string[]
  let assignments: any[] = []
  if (slotIds.length > 0) {
    const { data } = await (supabase
      .from('coach_assignments')
      .select('schedule_slot_id, coach_id, profiles!coach_assignments_coach_id_fkey(full_name)')
      .in('schedule_slot_id', slotIds) as any)
    assignments = data || []
  }

  const assignmentMap = assignments.reduce((map: Record<string, { coachId: string; coachName: string }>, item: any) => {
    if (!map[item.schedule_slot_id]) {
      map[item.schedule_slot_id] = {
        coachId: item.coach_id,
        coachName: item.profiles?.full_name || 'โค้ช',
      }
    }
    return map
  }, {})

  const groups = Object.values(sessionRows.reduce((map: Record<string, any>, session: any) => {
    const key = `${session.date}-${session.branch_id}-${session.start_time}-${session.end_time}-${session.bookings?.course_type_id}`
    if (!map[key]) {
      const assignment = session.schedule_slot_id ? assignmentMap[session.schedule_slot_id] : null
      map[key] = {
        key,
        scheduleSlotId: session.schedule_slot_id || null,
        branchId: session.branch_id,
        branchName: branchMap[session.branch_id] || 'ไม่ทราบ',
        courseTypeId: session.bookings?.course_type_id || '',
        courseType: session.bookings?.course_types?.name || '',
        date: session.date,
        startTime: session.start_time,
        endTime: session.end_time,
        assignedCoachId: assignment?.coachId || null,
        assignedCoachName: assignment?.coachName || null,
        students: [],
      }
    }

    map[key].students.push({
      id: session.id,
      name: session.child_id
        ? (session.children?.nickname || session.children?.full_name || 'เด็ก')
        : (session.bookings?.profiles?.full_name || 'ผู้เรียน'),
      parentName: session.child_id ? (session.bookings?.profiles?.full_name || null) : null,
      isChild: !!session.child_id,
    })

    return map
  }, {} as Record<string, any>)).sort((a: any, b: any) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))

  return <AssignGroupsClient coaches={coaches} groups={groups as any} currentUserId={user.id} />
}
