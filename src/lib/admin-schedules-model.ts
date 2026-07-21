import {
  buildAdminAttendanceState,
  getAdminAttendanceScopeSessionIds,
  type AdminAttendanceGroupRow,
  type AdminAttendanceSlotSessionRow,
} from '@/lib/admin-attendance-state'
import { hasExactValidCoachAssignment } from '@/lib/admin-schedule-assignment-state'
import type { AttendanceSessionRow } from '@/lib/session-attendance-status'
import type { LevelCategory, ProgramStatus, StudentType, UserRole } from '@/types/database'

export interface AdminScheduleSessionRow {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  is_makeup: boolean | null
  child_id: string | null
  schedule_slot_id: string | null
  branch_id: string
  branches?: { name: string | null } | null
  children?: { full_name: string | null; nickname: string | null } | null
  bookings?: {
    id?: string
    user_id: string
    learner_type?: string
    course_type_id: string
    status: string
    profiles?: { full_name: string | null } | null
    course_types?: { name: string | null } | null
  } | null
}

export interface AdminScheduleGroupRow extends AdminAttendanceGroupRow {
  id: string
  schedule_slot_id: string
  coach_id: string | null
  name: string
  level_min: number | null
  level_max: number | null
  sort_order: number
  profiles?: { id: string; full_name?: string | null; role: UserRole } | null
  coach_assignment_group_students: { booking_session_id: string }[] | null
}

export type AdminScheduleSlotSessionRow = AdminAttendanceSlotSessionRow

export interface AdminScheduleWalletCreditRow {
  original_session_id: string
  status: 'active' | 'redeemed' | 'expired'
}

export interface AdminScheduleStudentLevelRow {
  student_id: string
  student_type: StudentType
  level: number
  created_at: string
}

export interface AdminScheduleLevelRow {
  id: number
  name: string
  category: LevelCategory
}

export interface AdminScheduleTeachingProgramRow {
  id: string
  coach_id: string
  schedule_slot_id: string
  program_content: string
  status: ProgramStatus
  created_at: string
  updated_at: string
}

export interface AdminScheduleSummaryRound {
  key: string
  schedule_slot_id: string | null
  date: string
  start_time: string
  end_time: string
  branch_id: string
  branch_name: string
  course_type_id: string
  course_type: string
  session_count: number
  learner_count: number
  waiting_coach_count: number
  walleted_count: number
}

export interface AdminScheduleSummaryTotals {
  sessionCount: number
  learnerCount: number
  roundCount: number
  branchCount: number
  waitingCoachCount: number
  walletedCount: number
}

export interface AdminScheduleMonthSummary {
  rounds: AdminScheduleSummaryRound[]
  totalsByFilter: Record<string, AdminScheduleSummaryTotals>
}

export interface AdminScheduleSession {
  id: string
  round_key: string
  schedule_slot_id: string | null
  date: string
  start_time: string
  end_time: string
  status: string
  is_makeup: boolean
  child_id: string | null
  student_id: string | null
  student_type: StudentType | null
  level: number
  level_name: string | null
  level_category: LevelCategory | null
  learner_type: string
  has_missing_child_link: boolean
  branch_id: string
  branch_name: string
  course_type_id: string
  learner_name: string
  parent_name: string | null
  course_type: string
  booking_status: string
  coach_names: string[]
}

export interface AdminScheduleRoundGroup {
  id: string
  name: string
  coach_id: string | null
  coach_profile_id: string | null
  coach_name: string | null
  coach_role: UserRole | null
  level_min: number | null
  level_max: number | null
  sort_order: number
  teaching_program: {
    id: string
    status: ProgramStatus
    program_content: string
    updated_at: string
  } | null
  learners: AdminScheduleSession[]
}

export interface AdminScheduleRound {
  key: string
  schedule_slot_id: string | null
  date: string
  start_time: string
  end_time: string
  branch_id: string
  branch_name: string
  course_type_id: string
  course_type: string
  learner_count: number
  groups: AdminScheduleRoundGroup[]
  unassigned_learners: AdminScheduleSession[]
}

export function getAdminScheduleRoundKey(session: AdminScheduleSessionRow) {
  if (session.schedule_slot_id) return `slot:${session.schedule_slot_id}`
  return [
    'fallback', session.date, session.start_time, session.end_time, session.branch_id,
    session.bookings?.course_type_id || 'unknown-course',
  ].join(':')
}

export function getAdminScheduleStudentRef(session: AdminScheduleSessionRow) {
  if (session.child_id) return { id: session.child_id, type: 'child' as const }
  if (session.bookings?.user_id) return { id: session.bookings.user_id, type: 'adult' as const }
  return null
}

export function filterVisibleAdminScheduleSessions(
  sessions: AdminScheduleSessionRow[],
  walletCredits: AdminScheduleWalletCreditRow[],
) {
  const creditBySessionId = new Map(walletCredits.map((credit) => [credit.original_session_id, credit]))
  return sessions.filter((session) => {
    if (session.status !== 'walleted') return true
    const credit = creditBySessionId.get(session.id)
    return !credit || credit.status === 'active'
  })
}

function summaryFilterKey(branchId: string, courseType: string) {
  return `${branchId}:${courseType}`
}

function buildSummaryTotals(sessions: AdminScheduleSessionRow[], rounds: AdminScheduleSummaryRound[]) {
  const learnerKeys = new Set<string>()
  const branchIds = new Set<string>()
  sessions.forEach((session) => {
    const student = getAdminScheduleStudentRef(session)
    if (student) learnerKeys.add(`${student.type}:${student.id}`)
    branchIds.add(session.branch_id)
  })
  return {
    sessionCount: sessions.length,
    learnerCount: learnerKeys.size,
    roundCount: rounds.length,
    branchCount: branchIds.size,
    waitingCoachCount: rounds.reduce((sum, round) => sum + round.waiting_coach_count, 0),
    walletedCount: rounds.reduce((sum, round) => sum + round.walleted_count, 0),
  }
}

export function buildAdminScheduleMonthSummary(input: {
  sessions: AdminScheduleSessionRow[]
  walletCredits: AdminScheduleWalletCreditRow[]
  groups: AdminScheduleGroupRow[]
}): AdminScheduleMonthSummary {
  const sessions = filterVisibleAdminScheduleSessions(input.sessions, input.walletCredits)
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const exactAssignedSessionIds = new Set<string>()

  input.groups.forEach((group) => {
    if (!hasExactValidCoachAssignment({
      name: group.name,
      coach_id: group.coach_id,
      coach_profile_id: group.profiles?.id || null,
      coach_name: group.profiles?.full_name || (group.profiles?.id ? '__resolved_without_monthly_name__' : null),
      coach_role: group.profiles?.role || null,
    })) return
    ;(group.coach_assignment_group_students || []).forEach((member) => {
      if (sessionById.has(member.booking_session_id)) exactAssignedSessionIds.add(member.booking_session_id)
    })
  })

  const roundMap = new Map<string, AdminScheduleSummaryRound>()
  sessions.forEach((session) => {
    const key = getAdminScheduleRoundKey(session)
    let round = roundMap.get(key)
    if (!round) {
      round = {
        key,
        schedule_slot_id: session.schedule_slot_id,
        date: session.date,
        start_time: session.start_time,
        end_time: session.end_time,
        branch_id: session.branch_id,
        branch_name: session.branches?.name || 'ไม่ทราบ',
        course_type_id: session.bookings?.course_type_id || '',
        course_type: session.bookings?.course_types?.name || '',
        session_count: 0,
        learner_count: 0,
        waiting_coach_count: 0,
        walleted_count: 0,
      }
      roundMap.set(key, round)
    }
    round.session_count += 1
    round.learner_count += 1
    if (session.status === 'walleted') round.walleted_count += 1
    else if (!exactAssignedSessionIds.has(session.id)) round.waiting_coach_count += 1
  })

  const rounds = Array.from(roundMap.values()).sort((a, b) => (
    `${a.date} ${a.start_time} ${a.branch_name} ${a.course_type}`
      .localeCompare(`${b.date} ${b.start_time} ${b.branch_name} ${b.course_type}`, 'th')
  ))
  const branchIds = Array.from(new Set(sessions.map((session) => session.branch_id)))
  const courseTypes = Array.from(new Set(sessions.map((session) => session.bookings?.course_types?.name || '')))
  const totalsByFilter: Record<string, AdminScheduleSummaryTotals> = {}

  for (const branchId of ['all', ...branchIds]) {
    for (const courseType of ['all', ...courseTypes]) {
      const filteredSessions = sessions.filter((session) => (
        (branchId === 'all' || session.branch_id === branchId)
        && (courseType === 'all' || session.bookings?.course_types?.name === courseType)
      ))
      const filteredRounds = rounds.filter((round) => (
        (branchId === 'all' || round.branch_id === branchId)
        && (courseType === 'all' || round.course_type === courseType)
      ))
      totalsByFilter[summaryFilterKey(branchId, courseType)] = buildSummaryTotals(filteredSessions, filteredRounds)
    }
  }

  return { rounds, totalsByFilter }
}

export function getAdminScheduleSummaryTotals(
  summary: AdminScheduleMonthSummary,
  branchId: string,
  courseType: string,
) {
  return summary.totalsByFilter[summaryFilterKey(branchId, courseType)] || {
    sessionCount: 0,
    learnerCount: 0,
    roundCount: 0,
    branchCount: 0,
    waitingCoachCount: 0,
    walletedCount: 0,
  }
}

function buildLatestLevelMap(rows: AdminScheduleStudentLevelRow[]) {
  const map = new Map<string, AdminScheduleStudentLevelRow>()
  rows.forEach((row) => {
    const key = `${row.student_type}:${row.student_id}`
    if (!map.has(key)) map.set(key, row)
  })
  return map
}

function getProgramKey(slotId: string, coachId: string) {
  return `${slotId}:${coachId}`
}

function buildLatestProgramMap(rows: AdminScheduleTeachingProgramRow[]) {
  const map = new Map<string, AdminScheduleTeachingProgramRow>()
  rows.forEach((row) => {
    const key = getProgramKey(row.schedule_slot_id, row.coach_id)
    const current = map.get(key)
    if (!current || row.updated_at.localeCompare(current.updated_at) > 0) map.set(key, row)
  })
  return map
}

export function buildAdminScheduleDayDetail(input: {
  sessions: AdminScheduleSessionRow[]
  walletCredits: AdminScheduleWalletCreditRow[]
  groups: AdminScheduleGroupRow[]
  slotSessions: AdminScheduleSlotSessionRow[]
  attendanceRows: AttendanceSessionRow[]
  studentLevels: AdminScheduleStudentLevelRow[]
  levels: AdminScheduleLevelRow[]
  teachingPrograms: AdminScheduleTeachingProgramRow[]
}) {
  const visibleSessions = filterVisibleAdminScheduleSessions(input.sessions, input.walletCredits)
  const attendanceState = buildAdminAttendanceState({
    sessions: visibleSessions,
    groups: input.groups,
    slotSessions: input.slotSessions,
    attendanceRows: input.attendanceRows,
  })
  const latestLevelMap = buildLatestLevelMap(input.studentLevels)
  const levelMap = new Map(input.levels.map((level) => [level.id, level]))
  const programMap = buildLatestProgramMap(input.teachingPrograms)

  const sessions: AdminScheduleSession[] = visibleSessions.map((session) => {
    const student = getAdminScheduleStudentRef(session)
    const learnerType = session.bookings?.learner_type || ''
    const missingChild = learnerType === 'child' && !session.child_id
    const latestLevel = student ? latestLevelMap.get(`${student.type}:${student.id}`) : null
    const level = latestLevel ? levelMap.get(latestLevel.level) : null
    return {
      id: session.id,
      round_key: getAdminScheduleRoundKey(session),
      schedule_slot_id: session.schedule_slot_id,
      date: session.date,
      start_time: session.start_time,
      end_time: session.end_time,
      status: attendanceState.getDisplayStatus(session),
      is_makeup: session.is_makeup || false,
      child_id: session.child_id,
      student_id: student?.id || null,
      student_type: student?.type || null,
      level: latestLevel?.level ?? 0,
      level_name: level?.name || (latestLevel ? null : 'ยังไม่ประเมิน'),
      level_category: level?.category || null,
      learner_type: learnerType,
      has_missing_child_link: missingChild,
      branch_id: session.branch_id,
      branch_name: session.branches?.name || 'ไม่ทราบ',
      course_type_id: session.bookings?.course_type_id || '',
      learner_name: missingChild
        ? 'ข้อมูลเด็กไม่ครบ'
        : session.child_id
          ? (session.children?.nickname || session.children?.full_name || 'ไม่ทราบ')
          : (session.bookings?.profiles?.full_name || 'ไม่ทราบ'),
      parent_name: session.child_id || missingChild ? (session.bookings?.profiles?.full_name || 'ไม่ทราบ') : null,
      course_type: session.bookings?.course_types?.name || '',
      booking_status: session.bookings?.status || '',
      coach_names: attendanceState.getCoachNames(session),
    }
  })

  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const roundMap = new Map<string, AdminScheduleRound>()
  sessions.forEach((session) => {
    if (!roundMap.has(session.round_key)) {
      roundMap.set(session.round_key, {
        key: session.round_key,
        schedule_slot_id: session.schedule_slot_id,
        date: session.date,
        start_time: session.start_time,
        end_time: session.end_time,
        branch_id: session.branch_id,
        branch_name: session.branch_name,
        course_type_id: session.course_type_id,
        course_type: session.course_type,
        learner_count: 0,
        groups: [],
        unassigned_learners: [],
      })
    }
    const round = roundMap.get(session.round_key)
    if (round) round.learner_count += 1
  })

  const assignedIds = new Set<string>()
  input.groups.slice().sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name, 'th'))
    .forEach((group) => {
      const round = roundMap.get(`slot:${group.schedule_slot_id}`)
      if (!round) return
      const learners = (group.coach_assignment_group_students || []).flatMap((member) => {
        const session = sessionById.get(member.booking_session_id)
        return session?.round_key === round.key ? [session] : []
      }).sort((a, b) => a.learner_name.localeCompare(b.learner_name, 'th'))
      if (learners.length === 0) return
      learners.forEach((learner) => assignedIds.add(learner.id))
      const program = group.coach_id ? programMap.get(getProgramKey(group.schedule_slot_id, group.coach_id)) : null
      round.groups.push({
        id: group.id,
        name: group.name,
        coach_id: group.coach_id,
        coach_profile_id: group.profiles?.id || null,
        coach_name: group.profiles?.full_name || null,
        coach_role: group.profiles?.role || null,
        level_min: group.level_min,
        level_max: group.level_max,
        sort_order: group.sort_order,
        teaching_program: program ? {
          id: program.id,
          status: program.status,
          program_content: program.program_content,
          updated_at: program.updated_at,
        } : null,
        learners,
      })
    })

  sessions.forEach((session) => {
    if (!assignedIds.has(session.id)) roundMap.get(session.round_key)?.unassigned_learners.push(session)
  })

  return {
    sessions,
    rounds: Array.from(roundMap.values()).map((round) => ({
      ...round,
      groups: round.groups.sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name, 'th')),
      unassigned_learners: round.unassigned_learners.sort((a, b) => a.learner_name.localeCompare(b.learner_name, 'th')),
    })).sort((a, b) => `${a.date} ${a.start_time} ${a.branch_name} ${a.course_type}`
      .localeCompare(`${b.date} ${b.start_time} ${b.branch_name} ${b.course_type}`, 'th')),
  }
}

export function getAdminScheduleAttendanceScopeIds(input: {
  sessions: AdminScheduleSessionRow[]
  groups: AdminScheduleGroupRow[]
  slotSessions: AdminScheduleSlotSessionRow[]
}) {
  return getAdminAttendanceScopeSessionIds(input.sessions, input.groups, input.slotSessions)
}

export function deriveAdminScheduleSlotSessions(
  sessions: AdminScheduleSessionRow[],
): AdminScheduleSlotSessionRow[] {
  return sessions.flatMap((session) => (
    session.schedule_slot_id
    && session.status !== 'rescheduled'
    && session.status !== 'walleted'
      ? [{ id: session.id, schedule_slot_id: session.schedule_slot_id }]
      : []
  ))
}

export function normalizeAdminScheduleSearch(value: string) {
  return value.normalize('NFC').trim().toLocaleLowerCase('th-TH')
}

export function escapeAdminScheduleLikePattern(value: string) {
  return `%${value.replace(/([\\%_])/g, '\\$1')}%`
}

export function buildAdminScheduleSearchCandidateResult(input: {
  sessions: AdminScheduleSessionRow[]
  walletCredits: AdminScheduleWalletCreditRow[]
  startDate: string
  endDate: string
  limit: number
  sourceTruncated: boolean
}) {
  const sessions = filterVisibleAdminScheduleSessions(input.sessions, input.walletCredits)
    .filter((session) => session.date >= input.startDate && session.date <= input.endDate)
    .slice()
    .sort((a, b) => (
      a.date.localeCompare(b.date)
      || a.start_time.localeCompare(b.start_time)
      || a.id.localeCompare(b.id)
    ))
  const roundKeys = Array.from(new Set(sessions.map(getAdminScheduleRoundKey)))
  const boundedRoundKeys = roundKeys.slice(0, input.limit)
  const boundedSet = new Set(boundedRoundKeys)
  const boundedSessions = sessions.filter((session) => boundedSet.has(getAdminScheduleRoundKey(session)))
  const learnerKeys = new Set(sessions.flatMap((session) => {
    const student = getAdminScheduleStudentRef(session)
    return student ? [`${student.type}:${student.id}`] : []
  }))

  return {
    roundKeys: boundedRoundKeys,
    dates: Array.from(new Set(boundedSessions.map((session) => session.date))),
    matchCount: sessions.length,
    learnerCount: learnerKeys.size,
    truncated: input.sourceTruncated || roundKeys.length > input.limit,
    limit: input.limit,
  }
}

export function buildAdminScheduleSearchResult(input: {
  sessions: AdminScheduleSessionRow[]
  groups: AdminScheduleGroupRow[]
  query: string
  startDate: string
  endDate: string
  branchId?: string
  courseType?: string
  limit: number
}) {
  const groupTermsBySessionId = new Map<string, string[]>()
  input.groups.forEach((group) => {
    const values = [group.name, group.profiles?.full_name || '']
    ;(group.coach_assignment_group_students || []).forEach((member) => {
      groupTermsBySessionId.set(member.booking_session_id, [
        ...(groupTermsBySessionId.get(member.booking_session_id) || []), ...values,
      ])
    })
  })
  const query = normalizeAdminScheduleSearch(input.query)
  const matchingSessions = input.sessions.filter((session) => {
    if (session.date < input.startDate || session.date > input.endDate) return false
    if (input.branchId && input.branchId !== 'all' && session.branch_id !== input.branchId) return false
    const courseType = session.bookings?.course_types?.name || ''
    if (input.courseType && input.courseType !== 'all' && courseType !== input.courseType) return false
    return [
      session.children?.nickname || '', session.children?.full_name || '',
      session.bookings?.profiles?.full_name || '', session.branches?.name || '',
      courseType, session.bookings?.status || '', ...(groupTermsBySessionId.get(session.id) || []),
    ].some((value) => normalizeAdminScheduleSearch(value).includes(query))
  })
  const roundKeys = Array.from(new Set(matchingSessions.map(getAdminScheduleRoundKey)))
  const boundedRoundKeys = roundKeys.slice(0, input.limit)
  const boundedSet = new Set(boundedRoundKeys)
  const learnerKeys = new Set(matchingSessions.flatMap((session) => {
    const student = getAdminScheduleStudentRef(session)
    return student ? [`${student.type}:${student.id}`] : []
  }))
  return {
    roundKeys: boundedRoundKeys,
    dates: Array.from(new Set(matchingSessions
      .filter((session) => boundedSet.has(getAdminScheduleRoundKey(session)))
      .map((session) => session.date))),
    matchCount: matchingSessions.length,
    learnerCount: learnerKeys.size,
    truncated: roundKeys.length > input.limit,
    limit: input.limit,
  }
}
