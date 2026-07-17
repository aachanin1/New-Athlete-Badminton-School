import { getServiceRoleClient } from '@/lib/auth/admin'
import type { AssignmentGroupNamingStudent } from '@/lib/coach-assignment-group-naming'
import type { LevelCategory, StudentType } from '@/types/database'

interface NamingSessionRow {
  id: string
  child_id: string | null
  bookings?: { user_id: string } | null
}

interface NamingStudentLevelRow {
  student_id: string
  student_type: StudentType
  level: number
  created_at: string
}

interface NamingLevelRow {
  id: number
  category: LevelCategory
  program_name: string | null
}

function getStudentKey(studentId: string, studentType: StudentType) {
  return `${studentType}:${studentId}`
}

export async function loadAssignmentGroupNamingStudents(
  supabase: ReturnType<typeof getServiceRoleClient>,
  bookingSessionIds: string[],
) {
  const uniqueSessionIds = Array.from(new Set(bookingSessionIds))
  if (uniqueSessionIds.length === 0) return new Map<string, AssignmentGroupNamingStudent>()

  const { data: sessions, error: sessionsError } = await supabase
    .from('booking_sessions')
    .select('id, child_id, bookings!inner(user_id)')
    .in('id', uniqueSessionIds) as unknown as {
      data: NamingSessionRow[] | null
      error: { message: string } | null
    }

  if (sessionsError) throw new Error(sessionsError.message)

  const studentRefs = (sessions || []).map((session) => ({
    sessionId: session.id,
    studentId: session.child_id || session.bookings?.user_id || '',
    studentType: (session.child_id ? 'child' : 'adult') as StudentType,
  })).filter((student) => Boolean(student.studentId))
  const studentIds = Array.from(new Set(studentRefs.map((student) => student.studentId)))

  const [{ data: studentLevels, error: levelsError }, { data: levelDefinitions, error: definitionsError }] = await Promise.all([
    studentIds.length > 0
      ? supabase
        .from('student_levels')
        .select('student_id, student_type, level, created_at')
        .in('student_id', studentIds)
        .order('created_at', { ascending: false }) as unknown as PromiseLike<{
          data: NamingStudentLevelRow[] | null
          error: { message: string } | null
        }>
      : Promise.resolve({ data: [] as NamingStudentLevelRow[], error: null }),
    supabase
      .from('levels')
      .select('id, category, program_name')
      .eq('is_active', true) as unknown as PromiseLike<{
        data: NamingLevelRow[] | null
        error: { message: string } | null
      }>,
  ])

  if (levelsError) throw new Error(levelsError.message)
  if (definitionsError) throw new Error(definitionsError.message)

  const latestLevelByStudent = new Map<string, NamingStudentLevelRow>()
  ;(studentLevels || []).forEach((row) => {
    const key = getStudentKey(row.student_id, row.student_type)
    if (!latestLevelByStudent.has(key)) latestLevelByStudent.set(key, row)
  })
  const definitionById = new Map((levelDefinitions || []).map((level) => [level.id, level]))

  return studentRefs.reduce((map, student) => {
    const latestLevel = latestLevelByStudent.get(getStudentKey(student.studentId, student.studentType))
    const level = latestLevel?.level ?? 0
    const definition = level > 0 ? definitionById.get(level) : null
    map.set(student.sessionId, {
      level,
      levelCategory: definition?.category || null,
      levelProgramName: level > 0 ? (definition?.program_name || null) : 'ยังไม่ประเมิน',
    })
    return map
  }, new Map<string, AssignmentGroupNamingStudent>())
}
