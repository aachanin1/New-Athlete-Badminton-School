import { Baby, History, User, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getLevelDisplay } from '@/constants/levels'
import { getCoachMemoryKey, getCoachStudentMemoryMap, type CoachMemoryEntry } from '@/lib/coach-student-memory'
import { getCoachVisibleStudents } from '@/lib/coach-student-access'
import { createClient } from '@/lib/supabase/server'

interface StudentLevelRow {
  student_id: string
  level: number
}

function formatShortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
}

function getMemoryText(memory: CoachMemoryEntry) {
  return `${memory.coachName} ${memory.totalSessions} ครั้ง ล่าสุด ${formatShortDate(memory.lastTaughtDate)}`
}

function getSourceText(source: string) {
  if (source === 'assignment_group') return 'จากกลุ่มที่รับผิดชอบ'
  if (source === 'head_coach_branch') return 'จากสาขาที่รับผิดชอบ'
  return 'จากรอบที่ได้รับมอบหมาย'
}

export default async function StudentsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const studentList = await getCoachVisibleStudents(supabase, user)
  const studentRefs = studentList.map((student) => ({ id: student.id, type: student.type }))
  const memoryMap = await getCoachStudentMemoryMap(supabase, studentRefs)

  const levelMap: Record<string, number> = {}
  if (studentList.length > 0) {
    const { data: levels } = await supabase
      .from('student_levels')
      .select('student_id, level')
      .in('student_id', studentList.map((student) => student.id))
      .order('created_at', { ascending: false }) as unknown as { data: StudentLevelRow[] | null }

    ;(levels || []).forEach((level) => {
      if (levelMap[level.student_id] === undefined) levelMap[level.student_id] = level.level
    })
  }

  const students = studentList
    .map((student) => ({
      ...student,
      level: levelMap[student.id] ?? 0,
      memory: memoryMap[getCoachMemoryKey({ id: student.id, type: student.type })]?.coaches || [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">รายชื่อนักเรียน</h1>
        <p className="mt-1 text-sm text-gray-500">
          ผู้เรียนที่เกี่ยวข้องกับกลุ่มหรือรอบสอนของคุณ พร้อมประวัติโค้ชที่เคยสอน ({students.length} คน)
        </p>
      </div>

      {students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <Users className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ยังไม่มีนักเรียนที่ถูกมอบหมายให้คุณ</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {students.map((student) => {
            const levelInfo = getLevelDisplay(student.level)

            return (
              <Card key={`${student.id}-${student.type}`}>
                <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${levelInfo.color}`}>
                    <span className="text-sm font-bold">{levelInfo.level}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {student.type === 'child' ? <Baby className="h-3.5 w-3.5 text-pink-500" /> : <User className="h-3.5 w-3.5 text-blue-500" />}
                      <span className="truncate text-sm font-medium">{student.name}</span>
                      <Badge className={`${levelInfo.color} text-[10px]`}>{levelInfo.label}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                      {student.parentName && <span>ผู้ปกครอง: {student.parentName}</span>}
                      {student.branchName && <span>- {student.branchName}</span>}
                      <span>- {getSourceText(student.source)}</span>
                      <span>- พบในระบบ {student.sessionCount.toLocaleString('th-TH')} รอบ</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <History className="h-3 w-3 text-gray-400" />
                      {student.memory.length > 0 ? (
                        student.memory.slice(0, 4).map((memory) => (
                          <Badge key={`${student.id}-${memory.coachId}`} variant="outline" className="bg-white text-[10px] text-gray-600">
                            {getMemoryText(memory)}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-[11px] text-gray-400">ยังไม่มีประวัติโค้ชจากรอบที่ผ่านมา</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
