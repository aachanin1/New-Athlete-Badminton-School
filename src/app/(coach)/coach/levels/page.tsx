import { createClient } from '@/lib/supabase/server'
import { LevelsClient } from '@/components/coach/levels-client'

export default async function LevelsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Get coach's branches
  const { data: coachBranches } = await (supabase
    .from('coach_branches')
    .select('branch_id')
    .eq('coach_id', user.id) as any)

  const branchIds = (coachBranches || []).map((cb: any) => cb.branch_id)

  // Get students who have bookings at coach's branches (unique)
  let studentList: any[] = []
  if (branchIds.length > 0) {
    // Adult students
    const { data: adultBookings } = await (supabase
      .from('bookings')
      .select('user_id, profiles!bookings_user_id_fkey(id, full_name)')
      .eq('learner_type', 'self')
      .in('branch_id', branchIds)
      .in('status', ['paid', 'verified']) as any)

    const adultMap = new Map<string, any>()
    ;(adultBookings || []).forEach((b: any) => {
      if (b.profiles && !adultMap.has(b.user_id)) {
        adultMap.set(b.user_id, { id: b.user_id, name: b.profiles.full_name, type: 'adult', parentName: null })
      }
    })

    // Child students
    const { data: childBookings } = await (supabase
      .from('bookings')
      .select('child_id, user_id, profiles!bookings_user_id_fkey(full_name)')
      .eq('learner_type', 'child')
      .not('child_id', 'is', null)
      .in('branch_id', branchIds)
      .in('status', ['paid', 'verified']) as any)

    const childIds = Array.from(new Set((childBookings || []).map((b: any) => b.child_id).filter(Boolean)))
    let childMap = new Map<string, any>()
    if (childIds.length > 0) {
      const { data: children } = await (supabase
        .from('children')
        .select('id, full_name, nickname')
        .in('id', childIds) as any)
      ;(children || []).forEach((c: any) => {
        const parentBooking = (childBookings || []).find((b: any) => b.child_id === c.id)
        childMap.set(c.id, {
          id: c.id,
          name: c.nickname ? `${c.full_name} (${c.nickname})` : c.full_name,
          type: 'child',
          parentName: parentBooking?.profiles?.full_name || null,
        })
      })
    }

    studentList = [...Array.from(adultMap.values()), ...Array.from(childMap.values())]
  }

  // Get latest level for each student
  const allStudentIds = studentList.map((s) => s.id)
  let levelMap: Record<string, { level: number; created_at: string }> = {}
  if (allStudentIds.length > 0) {
    const { data: levels } = await (supabase
      .from('student_levels')
      .select('student_id, level, created_at')
      .in('student_id', allStudentIds)
      .order('created_at', { ascending: false }) as any)
    ;(levels || []).forEach((l: any) => {
      if (!levelMap[l.student_id]) {
        levelMap[l.student_id] = { level: l.level, created_at: l.created_at }
      }
    })
  }

  const students = studentList.map((s) => ({
    ...s,
    currentLevel: levelMap[s.id]?.level || null,
    lastUpdated: levelMap[s.id]?.created_at || null,
  }))

  // Sort: students without level first, then by level desc
  students.sort((a, b) => {
    if (!a.currentLevel && b.currentLevel) return -1
    if (a.currentLevel && !b.currentLevel) return 1
    return (b.currentLevel || 0) - (a.currentLevel || 0)
  })

  return <LevelsClient students={students} />
}
