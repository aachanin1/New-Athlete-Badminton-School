import { Baby, User, Users } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getLevelDisplay } from '@/constants/levels'

interface StudentRow {
  id: string
  name: string
  type: 'adult' | 'child'
  phone: string
  parentName: string | null
  branchName: string
  courseType: string
  totalHours: number
  level: number | null
}

const COURSE_LABELS: Record<string, string> = {
  kids_group: 'เด็กกลุ่ม',
  adult_group: 'ผู้ใหญ่กลุ่ม',
  private: 'Private',
}

export default async function StudentsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: coachBranches } = await (supabase
    .from('coach_branches')
    .select('branch_id, branches(name)')
    .eq('coach_id', user.id) as any)

  const branchIds = (coachBranches || []).map((coachBranch: any) => coachBranch.branch_id)
  const branchMap: Record<string, string> = {}
  ;(coachBranches || []).forEach((coachBranch: any) => {
    branchMap[coachBranch.branch_id] = coachBranch.branches?.name || ''
  })

  const { data: assignments } = await (supabase
    .from('coach_assignments')
    .select('schedule_slot_id')
    .eq('coach_id', user.id) as any)

  const assignedSlotIds = (assignments || []).map((assignment: any) => assignment.schedule_slot_id).filter(Boolean)

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

  const studentList: Omit<StudentRow, 'level'>[] = []

  if (visibleSessions.length > 0) {
    const adultMap = new Map<string, Omit<StudentRow, 'level'>>()
    visibleSessions.filter((session: any) => !session.child_id).forEach((session: any) => {
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
        if (current) current.totalHours += Number(booking.course_types?.duration_hours || 0)
      }
    })

    const childMap = new Map<string, Omit<StudentRow, 'level'>>()
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
          .filter((visibleSession: any) => visibleSession.child_id === child.id)
          .reduce((sum: number, visibleSession: any) => sum + Number(visibleSession.bookings?.course_types?.duration_hours || 0), 0),
      })
    })

    studentList.push(...Array.from(adultMap.values()), ...Array.from(childMap.values()))
  }

  const allIds = studentList.map((student) => student.id)
  const levelMap: Record<string, number> = {}
  if (allIds.length > 0) {
    const { data: levels } = await (supabase
      .from('student_levels')
      .select('student_id, level')
      .in('student_id', allIds)
      .order('created_at', { ascending: false }) as any)
    ;(levels || []).forEach((level: any) => {
      if (!levelMap[level.student_id]) levelMap[level.student_id] = level.level
    })
  }

  const students = studentList
    .map((student) => ({ ...student, level: levelMap[student.id] ?? 0, totalHours: student.totalHours || 0 }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th'))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">รายชื่อนักเรียน</h1>
        <p className="mt-1 text-sm text-gray-500">นักเรียนทั้งหมดในสาขาของคุณ ({students.length} คน)</p>
      </div>

      {students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <Users className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ยังไม่มีนักเรียนในสาขาของคุณ</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {students.map((student) => {
            const levelInfo = getLevelDisplay(student.level)

            return (
              <Card key={`${student.id}-${student.type}`}>
                <CardContent className="flex items-center gap-3 p-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${levelInfo.color}`}>
                    <span className="text-sm font-bold">{levelInfo.level}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {student.type === 'child' ? <Baby className="h-3.5 w-3.5 text-pink-500" /> : <User className="h-3.5 w-3.5 text-blue-500" />}
                      <span className="truncate text-sm font-medium">{student.name}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                      {student.parentName && <span>ผู้ปกครอง: {student.parentName}</span>}
                      {student.branchName && <span>• {student.branchName}</span>}
                      <span>• เรียนแล้ว {Number(student.totalHours || 0).toLocaleString('th-TH', { maximumFractionDigits: 1 })} ชม.</span>
                      {student.courseType && <Badge className="bg-blue-50 text-[10px] text-blue-600">{COURSE_LABELS[student.courseType] || student.courseType}</Badge>}
                      <Badge className={`${levelInfo.color} text-[10px]`}>{levelInfo.label}</Badge>
                    </div>
                  </div>
                  {student.phone && <span className="shrink-0 text-xs text-gray-400">{student.phone}</span>}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
