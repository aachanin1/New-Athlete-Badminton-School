import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Baby, User } from 'lucide-react'
import { LEVEL_RANGES } from '@/constants/levels'

const LEVEL_CATEGORIES = [
  { label: LEVEL_RANGES[0].label, min: LEVEL_RANGES[0].minLevel, max: LEVEL_RANGES[0].maxLevel, color: 'bg-gray-100 text-gray-700' },
  { label: `${LEVEL_RANGES[1].label} 1`, min: LEVEL_RANGES[1].minLevel, max: LEVEL_RANGES[1].maxLevel, color: 'bg-blue-100 text-blue-700' },
  { label: `${LEVEL_RANGES[2].label} 2`, min: LEVEL_RANGES[2].minLevel, max: LEVEL_RANGES[2].maxLevel, color: 'bg-purple-100 text-purple-700' },
  { label: `${LEVEL_RANGES[3].label} 3`, min: LEVEL_RANGES[3].minLevel, max: LEVEL_RANGES[3].maxLevel, color: 'bg-amber-100 text-amber-700' },
]

function getLevelCategory(level: number) {
  return LEVEL_CATEGORIES.find((c) => level >= c.min && level <= c.max) || LEVEL_CATEGORIES[0]
}

export default async function StudentsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Get coach's branches
  const { data: coachBranches } = await (supabase
    .from('coach_branches')
    .select('branch_id, branches(name)')
    .eq('coach_id', user.id) as any)

  const branchIds = (coachBranches || []).map((cb: any) => cb.branch_id)
  const branchMap: Record<string, string> = {}
  ;(coachBranches || []).forEach((cb: any) => { branchMap[cb.branch_id] = cb.branches?.name || '' })

  const { data: assignments } = await (supabase
    .from('coach_assignments')
    .select('schedule_slot_id')
    .eq('coach_id', user.id) as any)
  const assignedSlotIds = (assignments || []).map((assignment: any) => assignment.schedule_slot_id).filter(Boolean)

  let studentList: any[] = []
  let visibleSessions: any[] = []
  if (assignedSlotIds.length > 0) {
    const { data } = await (supabase
      .from('booking_sessions')
      .select('id, booking_id, child_id, branch_id, schedule_slot_id, bookings!inner(user_id, learner_type, status, profiles!bookings_user_id_fkey(id, full_name, phone), course_types(name, duration_hours)), children(id, full_name, nickname)')
      .in('schedule_slot_id', assignedSlotIds)
      .neq('status', 'rescheduled')
      .in('bookings.status', ['pending_payment', 'paid', 'verified']) as any)
    visibleSessions = data || []
  } else if (branchIds.length > 0) {
    const { data } = await (supabase
      .from('booking_sessions')
      .select('id, booking_id, child_id, branch_id, schedule_slot_id, bookings!inner(user_id, learner_type, status, profiles!bookings_user_id_fkey(id, full_name, phone), course_types(name, duration_hours)), children(id, full_name, nickname)')
      .in('branch_id', branchIds)
      .neq('status', 'rescheduled')
      .in('bookings.status', ['pending_payment', 'paid', 'verified']) as any)
    visibleSessions = data || []
  }

  if (visibleSessions.length > 0) {
    const adultBookings = visibleSessions.filter((session: any) => !session.child_id)

    const adultMap = new Map<string, any>()
    ;(adultBookings || []).forEach((session: any) => {
      const booking = session.bookings
      if (booking?.profiles && !adultMap.has(booking.user_id)) {
        adultMap.set(booking.user_id, {
          id: booking.user_id,
          name: booking.profiles.full_name,
          type: 'adult',
          phone: booking.profiles.phone,
          parentName: null,
          branchName: branchMap[session.branch_id] || '',
          courseType: booking.course_types?.name || '',
          totalHours: 0,
        })
      }

      if (adultMap.has(booking?.user_id)) {
        const current = adultMap.get(booking.user_id)
        current.totalHours += Number(booking.course_types?.duration_hours || 0)
      }
    })

    const childMap = new Map<string, any>()
    visibleSessions.filter((session: any) => session.child_id).forEach((session: any) => {
      const child = session.children
      const booking = session.bookings
      if (!child || childMap.has(child.id)) return
      childMap.set(child.id, {
          id: child.id,
          name: child.nickname ? `${child.full_name} (${child.nickname})` : child.full_name,
          type: 'child',
          phone: booking?.profiles?.phone || '',
          parentName: booking?.profiles?.full_name || null,
          branchName: branchMap[session.branch_id] || '',
          courseType: booking?.course_types?.name || '',
          totalHours: visibleSessions
            .filter((s: any) => s.child_id === child.id)
            .reduce((sum: number, s: any) => sum + Number(s.bookings?.course_types?.duration_hours || 0), 0),
        })
    })

    studentList = [...Array.from(adultMap.values()), ...Array.from(childMap.values())]
  }

  // Get latest levels
  const allIds = studentList.map((s) => s.id)
  let levelMap: Record<string, number> = {}
  if (allIds.length > 0) {
    const { data: levels } = await (supabase
      .from('student_levels')
      .select('student_id, level')
      .in('student_id', allIds)
      .order('created_at', { ascending: false }) as any)
    ;(levels || []).forEach((l: any) => {
      if (!levelMap[l.student_id]) levelMap[l.student_id] = l.level
    })
  }

  const students = studentList.map((s) => ({ ...s, level: levelMap[s.id] || null, totalHours: s.totalHours || 0 }))
  students.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th'))

  const COURSE_LABELS: Record<string, string> = { kids_group: 'เด็กกลุ่ม', adult_group: 'ผู้ใหญ่กลุ่ม', private: 'Private' }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">รายชื่อนักเรียน</h1>
        <p className="text-gray-500 text-sm mt-1">นักเรียนทั้งหมดในสาขาของคุณ ({students.length} คน)</p>
      </div>

      {students.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">ยังไม่มีนักเรียนในสาขาของคุณ</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {students.map((s: any) => {
            const cat = s.level ? getLevelCategory(s.level) : null
            return (
              <Card key={s.id + s.type}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${cat?.color || 'bg-gray-100'}`}>
                    {s.level ? <span className="font-bold text-sm">{s.level}</span> : <span className="text-xs text-gray-400">-</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {s.type === 'child' ? <Baby className="h-3.5 w-3.5 text-pink-500" /> : <User className="h-3.5 w-3.5 text-blue-500" />}
                      <span className="font-medium text-sm truncate">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 flex-wrap">
                      {s.parentName && <span>ผู้ปกครอง: {s.parentName}</span>}
                      {s.branchName && <span>• {s.branchName}</span>}
                      <span>• เรียนแล้ว {Number(s.totalHours || 0).toLocaleString('th-TH', { maximumFractionDigits: 1 })} ชม.</span>
                      {s.courseType && <Badge className="bg-blue-50 text-blue-600 text-[10px]">{COURSE_LABELS[s.courseType] || s.courseType}</Badge>}
                      {cat && <Badge className={`${cat.color} text-[10px]`}>{cat.label}</Badge>}
                    </div>
                  </div>
                  {s.phone && <span className="text-xs text-gray-400 shrink-0">{s.phone}</span>}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
