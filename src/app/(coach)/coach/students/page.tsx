import { StudentsClient, type CoachStudentListItem } from '@/components/coach/students-client'
import { getCoachMemoryKey, getCoachStudentMemoryMap } from '@/lib/coach-student-memory'
import { getCoachVisibleStudents } from '@/lib/coach-student-access'
import { createClient } from '@/lib/supabase/server'
import { createCompleteCoachStudentReadClient } from '@/lib/coach-student-reads'

interface StudentLevelRow {
  student_id: string
  student_type: 'adult' | 'child'
  level: number
}

export default async function StudentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const studentList = await getCoachVisibleStudents(supabase, user)
  const readClient = createCompleteCoachStudentReadClient(supabase)
  const studentRefs = studentList.map((student) => ({ id: student.id, type: student.type }))
  const memoryMap = await getCoachStudentMemoryMap(readClient, studentRefs)

  const levelMap: Record<string, number> = {}
  if (studentList.length > 0) {
    const { data: levels } = await readClient
      .from('student_levels')
      .select('student_id, student_type, level')
      .in('student_id', studentList.map((student) => student.id))
      .order('created_at', { ascending: false }) as unknown as { data: StudentLevelRow[] | null }

    ;(levels || []).forEach((level) => {
      const key = `${level.student_type}:${level.student_id}`
      if (levelMap[key] === undefined) levelMap[key] = level.level
    })
  }

  const students: CoachStudentListItem[] = studentList
    .map((student) => ({
      ...student,
      level: levelMap[`${student.type}:${student.id}`] ?? 0,
      memory: memoryMap[getCoachMemoryKey({ id: student.id, type: student.type })]?.coaches || [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'))

  return <StudentsClient students={students} />
}
