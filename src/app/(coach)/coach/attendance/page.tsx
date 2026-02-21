import { createClient } from '@/lib/supabase/server'
import { AttendanceClient } from '@/components/coach/attendance-client'

export default async function AttendancePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = new Date().toISOString().split('T')[0]

  // Get coach's branches
  const { data: coachBranches } = await (supabase
    .from('coach_branches')
    .select('branch_id, branches(name)')
    .eq('coach_id', user.id) as any)

  const branchIds = (coachBranches || []).map((cb: any) => cb.branch_id)
  const branchMap: Record<string, string> = {}
  ;(coachBranches || []).forEach((cb: any) => { branchMap[cb.branch_id] = cb.branches?.name || '' })

  // Get today's sessions at coach's branches
  let sessions: any[] = []
  if (branchIds.length > 0) {
    const { data } = await (supabase
      .from('booking_sessions')
      .select('id, booking_id, date, start_time, end_time, branch_id, child_id, status, bookings(user_id, learner_type, course_type_id, profiles!bookings_user_id_fkey(full_name), course_types(name))')
      .eq('date', today)
      .in('status', ['scheduled', 'completed'])
      .in('branch_id', branchIds)
      .order('start_time') as any)
    sessions = data || []
  }

  // Get children names
  const childIds = sessions.filter((s: any) => s.child_id).map((s: any) => s.child_id)
  let childMap: Record<string, string> = {}
  if (childIds.length > 0) {
    const { data: children } = await (supabase
      .from('children')
      .select('id, full_name, nickname')
      .in('id', childIds) as any)
    ;(children || []).forEach((c: any) => { childMap[c.id] = c.nickname ? `${c.full_name} (${c.nickname})` : c.full_name })
  }

  // Get existing attendance records for today
  const sessionIds = sessions.map((s: any) => s.id)
  let attendanceMap: Record<string, string> = {}
  if (sessionIds.length > 0) {
    const { data: attendance } = await (supabase
      .from('attendance')
      .select('booking_session_id, student_id, status')
      .in('booking_session_id', sessionIds) as any)
    ;(attendance || []).forEach((a: any) => {
      attendanceMap[a.booking_session_id + '-' + a.student_id] = a.status
    })
  }

  // Group into slots
  const grouped: Record<string, any[]> = {}
  sessions.forEach((s: any) => {
    const key = `${s.branch_id}-${s.start_time}-${s.end_time}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(s)
  })

  const slots = Object.entries(grouped).map(([key, slotSessions]) => {
    const first = slotSessions[0]
    return {
      key,
      branchName: branchMap[first.branch_id] || '',
      startTime: first.start_time,
      endTime: first.end_time,
      courseType: first.bookings?.course_types?.name || '',
      students: slotSessions.map((s: any) => {
        const isChild = !!s.child_id
        const studentId = isChild ? s.child_id : s.bookings?.user_id
        const attKey = s.id + '-' + studentId
        return {
          bookingSessionId: s.id,
          studentId,
          studentType: isChild ? 'child' as const : 'adult' as const,
          studentName: isChild ? (childMap[s.child_id] || 'เด็ก') : (s.bookings?.profiles?.full_name || 'ผู้เรียน'),
          parentName: isChild ? (s.bookings?.profiles?.full_name || null) : null,
          isChild,
          branchName: branchMap[s.branch_id] || '',
          startTime: s.start_time,
          endTime: s.end_time,
          courseType: s.bookings?.course_types?.name || '',
          attendanceStatus: (attendanceMap[attKey] as any) || null,
        }
      }),
    }
  })

  return <AttendanceClient slots={slots} />
}
