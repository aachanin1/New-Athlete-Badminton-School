import { redirect } from 'next/navigation'

import { AssignGroupsClient } from '@/components/coach/assign-groups-client'
import { getCoachMemoryKey, getCoachStudentMemoryMap, type CoachMemoryEntry } from '@/lib/coach-student-memory'
import { createClient } from '@/lib/supabase/server'
import type { LevelCategory, StudentType } from '@/types/database'

interface CoachBranchRow {
  branch_id: string
  branches?: { name: string | null } | null
}

interface BranchRow {
  id: string
  name: string
}

interface CoachOptionRow {
  coach_id: string
  branch_id: string
  profiles?: {
    full_name: string | null
    role: string | null
  } | null
}

interface SessionRow {
  id: string
  date: string
  start_time: string
  end_time: string
  branch_id: string
  child_id: string | null
  schedule_slot_id: string | null
  status: string
  children?: {
    full_name: string | null
    nickname: string | null
  } | null
  bookings?: {
    user_id: string
    course_type_id: string
    status: string
    profiles?: { full_name: string | null } | null
    course_types?: { name: string | null } | null
  } | null
}

interface LegacyAssignmentRow {
  schedule_slot_id: string
  coach_id: string
  profiles?: { full_name: string | null } | null
}

interface LevelRow {
  id: number
  name: string
  category: LevelCategory
}

interface StudentLevelRow {
  student_id: string
  student_type: StudentType
  level: number
  created_at: string
}

interface ExistingGroupRow {
  id: string
  schedule_slot_id: string
  coach_id: string | null
  name: string
  level_min: number | null
  level_max: number | null
  sort_order: number
  profiles?: { full_name: string | null } | null
  coach_assignment_group_students?: { booking_session_id: string }[] | null
}

interface AssignmentStudentForClient {
  bookingSessionId: string
  studentId: string
  studentType: StudentType
  name: string
  parentName: string | null
  isChild: boolean
  level: number | null
  levelName: string | null
  levelCategory: LevelCategory | null
  coachMemory: CoachMemoryEntry[]
  suggestedCoachId: string | null
  suggestedCoachName: string | null
}

interface ExistingAssignmentGroupForClient {
  id: string
  name: string
  coachId: string | null
  coachName: string | null
  levelMin: number | null
  levelMax: number | null
  sortOrder: number
  studentSessionIds: string[]
}

interface AssignmentSlotForClient {
  key: string
  scheduleSlotId: string | null
  branchId: string
  branchName: string
  courseTypeId: string
  courseType: string
  date: string
  startTime: string
  endTime: string
  legacyAssignedCoachId: string | null
  legacyAssignedCoachName: string | null
  suggestedCoachId: string | null
  suggestedCoachName: string | null
  suggestedCoachReason: string | null
  students: AssignmentStudentForClient[]
  assignmentGroups: ExistingAssignmentGroupForClient[]
}

function getStudentRef(session: SessionRow) {
  const id = session.child_id || session.bookings?.user_id
  if (!id) return null

  return {
    id,
    type: session.child_id ? 'child' as const : 'adult' as const,
  }
}

function getStudentName(session: SessionRow) {
  if (session.child_id) {
    return session.children?.nickname || session.children?.full_name || 'เด็ก'
  }

  return session.bookings?.profiles?.full_name || 'ผู้เรียน'
}

function getStudentKey(student: { id: string; type: StudentType }) {
  return `${student.type}:${student.id}`
}

function buildLevelMap(levelRows: StudentLevelRow[]) {
  const map = new Map<string, StudentLevelRow>()
  levelRows.forEach((row) => {
    const key = getStudentKey({ id: row.student_id, type: row.student_type })
    if (!map.has(key)) map.set(key, row)
  })
  return map
}

function rankCoachSuggestion(a: {
  studentCount: number
  totalSessions: number
  lastTaughtDate: string
}, b: {
  studentCount: number
  totalSessions: number
  lastTaughtDate: string
}) {
  if (b.studentCount !== a.studentCount) return b.studentCount - a.studentCount
  if (b.totalSessions !== a.totalSessions) return b.totalSessions - a.totalSessions
  return b.lastTaughtDate.localeCompare(a.lastTaughtDate)
}

export default async function AssignGroupsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as unknown as { data: { role: string } | null }

  if (!profile || !['head_coach', 'super_admin'].includes(profile.role)) {
    redirect('/coach')
  }

  let branchIds: string[] = []
  let branchMap: Record<string, string> = {}

  if (profile.role === 'super_admin') {
    const { data: branches } = await supabase
      .from('branches')
      .select('id, name')
      .eq('is_active', true) as unknown as { data: BranchRow[] | null }

    branchIds = (branches || []).map((branch) => branch.id)
    branchMap = (branches || []).reduce((map, branch) => {
      map[branch.id] = branch.name
      return map
    }, {} as Record<string, string>)
  } else {
    const { data: coachBranches } = await supabase
      .from('coach_branches')
      .select('branch_id, branches(name)')
      .eq('coach_id', user.id) as unknown as { data: CoachBranchRow[] | null }

    branchIds = (coachBranches || []).map((branch) => branch.branch_id)
    branchMap = (coachBranches || []).reduce((map, branch) => {
      map[branch.branch_id] = branch.branches?.name || ''
      return map
    }, {} as Record<string, string>)
  }

  let coaches: {
    id: string
    name: string
    role: string
    branches: string[]
  }[] = []

  if (branchIds.length > 0) {
    const { data: allCoachBranches } = await supabase
      .from('coach_branches')
      .select('coach_id, branch_id, profiles!coach_branches_coach_id_fkey(full_name, role)')
      .in('branch_id', branchIds) as unknown as { data: CoachOptionRow[] | null }

    const coachMap = new Map<string, { id: string; name: string; role: string; branches: string[] }>()
    ;(allCoachBranches || []).forEach((branch) => {
      if (!coachMap.has(branch.coach_id)) {
        coachMap.set(branch.coach_id, {
          id: branch.coach_id,
          name: branch.profiles?.full_name || 'Coach',
          role: branch.profiles?.role || 'coach',
          branches: [],
        })
      }
      coachMap.get(branch.coach_id)?.branches.push(branchMap[branch.branch_id] || '')
    })
    coaches = Array.from(coachMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'th'))
  }

  const today = new Date().toISOString().split('T')[0]
  let sessionRows: SessionRow[] = []

  if (branchIds.length > 0) {
    const { data } = await supabase
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
      .order('start_time', { ascending: true }) as unknown as { data: SessionRow[] | null }

    sessionRows = data || []
  }

  const slotIds = Array.from(new Set(sessionRows.map((row) => row.schedule_slot_id).filter(Boolean))) as string[]
  const studentRefs = sessionRows
    .map(getStudentRef)
    .filter((student): student is { id: string; type: StudentType } => Boolean(student))
  const studentIds = Array.from(new Set(studentRefs.map((student) => student.id)))

  const [
    { data: legacyAssignments },
    { data: assignmentGroups },
    { data: levelRows },
    { data: levelDefinitions },
  ] = await Promise.all([
    slotIds.length > 0
      ? supabase
        .from('coach_assignments')
        .select('schedule_slot_id, coach_id, profiles!coach_assignments_coach_id_fkey(full_name)')
        .in('schedule_slot_id', slotIds) as unknown as PromiseLike<{ data: LegacyAssignmentRow[] | null }>
      : Promise.resolve({ data: [] }),
    slotIds.length > 0
      ? supabase
        .from('coach_assignment_groups')
        .select(`
          id, schedule_slot_id, coach_id, name, level_min, level_max, sort_order,
          profiles!coach_assignment_groups_coach_id_fkey(full_name),
          coach_assignment_group_students(booking_session_id)
        `)
        .in('schedule_slot_id', slotIds)
        .order('sort_order') as unknown as PromiseLike<{ data: ExistingGroupRow[] | null }>
      : Promise.resolve({ data: [] }),
    studentIds.length > 0
      ? supabase
        .from('student_levels')
        .select('student_id, student_type, level, created_at')
        .in('student_id', studentIds)
        .order('created_at', { ascending: false }) as unknown as PromiseLike<{ data: StudentLevelRow[] | null }>
      : Promise.resolve({ data: [] }),
    supabase
      .from('levels')
      .select('id, name, category') as unknown as PromiseLike<{ data: LevelRow[] | null }>,
  ])

  const legacyAssignmentMap = (legacyAssignments || []).reduce((map, item) => {
    if (!map[item.schedule_slot_id]) {
      map[item.schedule_slot_id] = {
        coachId: item.coach_id,
        coachName: item.profiles?.full_name || 'Coach',
      }
    }
    return map
  }, {} as Record<string, { coachId: string; coachName: string }>)

  const assignmentGroupsBySlot = (assignmentGroups || []).reduce((map, group) => {
    if (!map[group.schedule_slot_id]) map[group.schedule_slot_id] = []
    map[group.schedule_slot_id].push({
      id: group.id,
      name: group.name,
      coachId: group.coach_id,
      coachName: group.profiles?.full_name || null,
      levelMin: group.level_min,
      levelMax: group.level_max,
      sortOrder: group.sort_order,
      studentSessionIds: (group.coach_assignment_group_students || []).map((student) => student.booking_session_id),
    })
    return map
  }, {} as Record<string, ExistingAssignmentGroupForClient[]>)

  const latestLevelMap = buildLevelMap(levelRows || [])
  const levelDefinitionMap = new Map((levelDefinitions || []).map((level) => [level.id, level]))
  const memoryMap = await getCoachStudentMemoryMap(supabase, studentRefs)

  const slots = Object.values(sessionRows.reduce((map, session) => {
    const key = session.schedule_slot_id || `${session.date}-${session.branch_id}-${session.start_time}-${session.end_time}-${session.bookings?.course_type_id}`
    if (!map[key]) {
      const legacyAssignment = session.schedule_slot_id ? legacyAssignmentMap[session.schedule_slot_id] : null
      map[key] = {
        key,
        scheduleSlotId: session.schedule_slot_id || null,
        branchId: session.branch_id,
        branchName: branchMap[session.branch_id] || 'ไม่ทราบสาขา',
        courseTypeId: session.bookings?.course_type_id || '',
        courseType: session.bookings?.course_types?.name || '',
        date: session.date,
        startTime: session.start_time,
        endTime: session.end_time,
        legacyAssignedCoachId: legacyAssignment?.coachId || null,
        legacyAssignedCoachName: legacyAssignment?.coachName || null,
        suggestedCoachId: null,
        suggestedCoachName: null,
        suggestedCoachReason: null,
        students: [],
        assignmentGroups: session.schedule_slot_id ? assignmentGroupsBySlot[session.schedule_slot_id] || [] : [],
      }
    }

    const studentRef = getStudentRef(session)
    const memory = studentRef ? memoryMap[getCoachMemoryKey(studentRef)] : null
    const latestLevel = studentRef ? latestLevelMap.get(getStudentKey(studentRef)) : null
    const levelDefinition = latestLevel ? levelDefinitionMap.get(latestLevel.level) : null

    map[key].students.push({
      bookingSessionId: session.id,
      studentId: studentRef?.id || '',
      studentType: studentRef?.type || 'adult',
      name: getStudentName(session),
      parentName: session.child_id ? (session.bookings?.profiles?.full_name || null) : null,
      isChild: Boolean(session.child_id),
      level: latestLevel?.level ?? 0,
      levelName: levelDefinition?.name || 'Level 0',
      levelCategory: levelDefinition?.category || null,
      coachMemory: memory?.coaches || [],
      suggestedCoachId: memory?.suggestedCoach?.coachId || null,
      suggestedCoachName: memory?.suggestedCoach?.coachName || null,
    })

    return map
  }, {} as Record<string, AssignmentSlotForClient>)).sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))

  slots.forEach((slot) => {
    const score = new Map<string, { coachId: string; coachName: string; totalSessions: number; studentCount: number; lastTaughtDate: string }>()

    slot.students.forEach((student) => {
      const suggested = student.coachMemory?.[0]
      if (!suggested) return

      const current = score.get(suggested.coachId) || {
        coachId: suggested.coachId,
        coachName: suggested.coachName,
        totalSessions: 0,
        studentCount: 0,
        lastTaughtDate: '',
      }
      current.totalSessions += Number(suggested.totalSessions || 0)
      current.studentCount += 1
      if (suggested.lastTaughtDate > current.lastTaughtDate) current.lastTaughtDate = suggested.lastTaughtDate
      score.set(suggested.coachId, current)
    })

    const suggested = Array.from(score.values()).sort(rankCoachSuggestion)[0]

    slot.suggestedCoachId = suggested?.coachId || null
    slot.suggestedCoachName = suggested?.coachName || null
    slot.suggestedCoachReason = suggested
      ? `เคยสอนผู้เรียนในรอบนี้ ${suggested.studentCount} คน รวม ${suggested.totalSessions} ครั้ง`
      : null
  })

  return <AssignGroupsClient coaches={coaches} slots={slots} currentUserId={user.id} />
}
