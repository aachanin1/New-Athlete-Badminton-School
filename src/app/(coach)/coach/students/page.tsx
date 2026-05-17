import { StudentsClient, type CoachStudentListItem } from '@/components/coach/students-client'
import { getCoachMemoryKey, getCoachStudentMemoryMap } from '@/lib/coach-student-memory'
import { getCoachVisibleStudents } from '@/lib/coach-student-access'
import { createClient } from '@/lib/supabase/server'

interface StudentLevelRow {
  student_id: string
  level: number
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

  const students: CoachStudentListItem[] = studentList
    .map((student) => ({
      ...student,
      level: levelMap[student.id] ?? 0,
      memory: memoryMap[getCoachMemoryKey({ id: student.id, type: student.type })]?.coaches || [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'))

  return <StudentsClient students={students} />
}
