import type { StudentType, UserRole } from '@/types/database'

type SupabaseQuery = PromiseLike<unknown> & {
  eq: (column: string, value: unknown) => SupabaseQuery
  in: (column: string, values: readonly unknown[]) => SupabaseQuery
  lte: (column: string, value: unknown) => SupabaseQuery
  neq: (column: string, value: unknown) => SupabaseQuery
  is: (column: string, value: unknown) => SupabaseQuery
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQuery
}

type SupabaseTable = {
  select: (columns: string) => SupabaseQuery
}

type SupabaseLike = {
  from: (table: string) => SupabaseTable
}

export interface StudentRef {
  id: string
  type: StudentType
}

export interface CoachMemoryEntry {
  coachId: string
  coachName: string
  coachRole: UserRole | null
  totalSessions: number
  lastTaughtDate: string
  branchNames: string[]
  courseTypes: string[]
}

export interface StudentCoachMemory {
  studentId: string
  studentType: StudentType
  coaches: CoachMemoryEntry[]
  suggestedCoach: CoachMemoryEntry | null
}

interface BookingSessionMemoryRow {
  id: string
  schedule_slot_id: string | null
  child_id: string | null
  date: string
  status: string
  branches?: { name: string | null } | null
  bookings?: {
    user_id: string
    learner_type: 'self' | 'child'
    status: string
    course_types?: { name: string | null } | null
  } | null
}

interface CoachAssignmentMemoryRow {
  schedule_slot_id: string
  coach_id: string
  profiles?: {
    full_name: string | null
    role: UserRole | null
  } | null
}

const LEARNED_BOOKING_STATUSES = ['paid', 'verified']
const LEARNED_SESSION_STATUSES = ['completed', 'absent', 'scheduled']

function getStudentKey(type: StudentType, id: string) {
  return `${type}:${id}`
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function isKnownStudent(refs: Set<string>, type: StudentType, id: string) {
  return refs.has(getStudentKey(type, id))
}

function rankCoach(a: CoachMemoryEntry, b: CoachMemoryEntry) {
  if (b.totalSessions !== a.totalSessions) return b.totalSessions - a.totalSessions
  return b.lastTaughtDate.localeCompare(a.lastTaughtDate)
}

export async function getCoachStudentMemoryMap(
  supabaseClient: unknown,
  students: StudentRef[],
): Promise<Record<string, StudentCoachMemory>> {
  const supabase = supabaseClient as SupabaseLike
  const uniqueStudents = Array.from(new Map(students.map((student) => [getStudentKey(student.type, student.id), student])).values())
  const childIds = uniqueStudents.filter((student) => student.type === 'child').map((student) => student.id)
  const adultIds = uniqueStudents.filter((student) => student.type === 'adult').map((student) => student.id)

  const emptyMap = uniqueStudents.reduce((map, student) => {
    const key = getStudentKey(student.type, student.id)
    map[key] = {
      studentId: student.id,
      studentType: student.type,
      coaches: [],
      suggestedCoach: null,
    }
    return map
  }, {} as Record<string, StudentCoachMemory>)

  if (uniqueStudents.length === 0) return emptyMap

  const today = new Date().toISOString().split('T')[0]
  const sessionQueries: PromiseLike<{ data: BookingSessionMemoryRow[] | null }>[] = []

  if (childIds.length > 0) {
    sessionQueries.push(supabase
      .from('booking_sessions')
      .select(`
        id, schedule_slot_id, child_id, date, status,
        branches(name),
        bookings!inner(user_id, learner_type, status, course_types(name))
      `)
      .in('child_id', childIds)
      .in('status', LEARNED_SESSION_STATUSES)
      .in('bookings.status', LEARNED_BOOKING_STATUSES)
      .neq('status', 'rescheduled')
      .lte('date', today)
      .order('date', { ascending: false }) as PromiseLike<{ data: BookingSessionMemoryRow[] | null }>)
  }

  if (adultIds.length > 0) {
    sessionQueries.push(supabase
      .from('booking_sessions')
      .select(`
        id, schedule_slot_id, child_id, date, status,
        branches(name),
        bookings!inner(user_id, learner_type, status, course_types(name))
      `)
      .is('child_id', null)
      .in('bookings.user_id', adultIds)
      .eq('bookings.learner_type', 'self')
      .in('status', LEARNED_SESSION_STATUSES)
      .in('bookings.status', LEARNED_BOOKING_STATUSES)
      .neq('status', 'rescheduled')
      .lte('date', today)
      .order('date', { ascending: false }) as PromiseLike<{ data: BookingSessionMemoryRow[] | null }>)
  }

  const sessionResults = await Promise.all(sessionQueries)
  const sessions = sessionResults.flatMap((result) => result.data || [])
  const slotIds = unique(sessions.map((session) => session.schedule_slot_id || ''))

  if (slotIds.length === 0) return emptyMap

  const { data: assignments } = await supabase
    .from('coach_assignments')
    .select('schedule_slot_id, coach_id, profiles!coach_assignments_coach_id_fkey(full_name, role)')
    .in('schedule_slot_id', slotIds) as { data: CoachAssignmentMemoryRow[] | null }

  const assignmentMap = new Map<string, CoachAssignmentMemoryRow[]>()
  ;(assignments || []).forEach((assignment) => {
    if (!assignment.schedule_slot_id) return
    if (!assignmentMap.has(assignment.schedule_slot_id)) assignmentMap.set(assignment.schedule_slot_id, [])
    assignmentMap.get(assignment.schedule_slot_id)?.push(assignment)
  })

  const knownRefs = new Set(uniqueStudents.map((student) => getStudentKey(student.type, student.id)))
  const memory = { ...emptyMap }

  for (const session of sessions) {
    const booking = session.bookings
    const studentType: StudentType = session.child_id ? 'child' : 'adult'
    const studentId = session.child_id || booking?.user_id
    if (!studentId || !isKnownStudent(knownRefs, studentType, studentId)) continue
    if (!session.schedule_slot_id) continue

    const key = getStudentKey(studentType, studentId)
    const relatedAssignments = assignmentMap.get(session.schedule_slot_id) || []
    for (const assignment of relatedAssignments) {
      const existing = memory[key].coaches.find((coach) => coach.coachId === assignment.coach_id)
      const branchName = session.branches?.name || ''
      const courseType = booking?.course_types?.name || ''

      if (existing) {
        existing.totalSessions += 1
        if (session.date > existing.lastTaughtDate) existing.lastTaughtDate = session.date
        existing.branchNames = unique([...existing.branchNames, branchName])
        existing.courseTypes = unique([...existing.courseTypes, courseType])
      } else {
        memory[key].coaches.push({
          coachId: assignment.coach_id,
          coachName: assignment.profiles?.full_name || 'Coach',
          coachRole: assignment.profiles?.role || null,
          totalSessions: 1,
          lastTaughtDate: session.date,
          branchNames: unique([branchName]),
          courseTypes: unique([courseType]),
        })
      }
    }
  }

  Object.values(memory).forEach((item) => {
    item.coaches.sort(rankCoach)
    item.suggestedCoach = item.coaches[0] || null
  })

  return memory
}

export function getCoachMemoryKey(student: StudentRef) {
  return getStudentKey(student.type, student.id)
}
