import {
  buildAttendanceCountBySessionId,
  buildLatestAttendanceRowBySessionId,
  buildLatestAttendanceRowBySessionStudentKey,
  buildLatestAttendanceBySessionId,
  deriveSessionDisplayStatus,
  getAttendanceSessionStudentKey,
  type AttendanceSessionRow,
  type DisplaySessionStatus,
} from '@/lib/session-attendance-status'

export interface AdminAttendanceSessionBase {
  id: string
  date: string
  start_time: string
  end_time: string
  status: string
  is_makeup?: boolean | null
  child_id?: string | null
  schedule_slot_id?: string | null
  bookings?: { user_id?: string | null } | null
}

export interface AdminAttendanceGroupRow {
  schedule_slot_id: string
  profiles?: { full_name?: string | null; email?: string | null } | null
  coach_assignment_group_students?: { booking_session_id: string | null }[] | null
}

export interface AdminAttendanceSlotSessionRow {
  id: string
  schedule_slot_id?: string | null
}

interface BuildAdminAttendanceStateInput<TSession extends AdminAttendanceSessionBase> {
  sessions: TSession[]
  groups?: AdminAttendanceGroupRow[]
  slotSessions?: AdminAttendanceSlotSessionRow[]
  attendanceRows?: AttendanceSessionRow[]
}

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function getExpectedStudentId(session: AdminAttendanceSessionBase) {
  return session.child_id || session.bookings?.user_id || null
}

export function getAdminAttendanceScopeSessionIds<TSession extends AdminAttendanceSessionBase>(
  sessions: TSession[],
  groups: AdminAttendanceGroupRow[] = [],
  slotSessions: AdminAttendanceSlotSessionRow[] = [],
) {
  return uniq([
    ...sessions.map((session) => session.id),
    ...groups.flatMap((group) => (group.coach_assignment_group_students || [])
      .map((student) => student.booking_session_id || '')),
    ...slotSessions.map((session) => session.id),
  ])
}

export function buildAdminAttendanceState<TSession extends AdminAttendanceSessionBase>({
  sessions,
  groups = [],
  slotSessions = [],
  attendanceRows = [],
}: BuildAdminAttendanceStateInput<TSession>) {
  const visibleSessionIds = new Set(sessions.map((session) => session.id))
  const groupScopeBySessionId = new Map<string, string[]>()
  const groupCoachNamesBySessionId = new Map<string, string[]>()
  const slotScopeBySlotId = new Map<string, string[]>()
  const expectedStudentIdBySessionId = new Map<string, string | null>()

  groups.forEach((group) => {
    const groupSessionIds = uniq((group.coach_assignment_group_students || [])
      .map((student) => student.booking_session_id || ''))

    groupSessionIds.forEach((sessionId) => {
      groupScopeBySessionId.set(sessionId, groupSessionIds)

      const coachName = group.profiles?.full_name || group.profiles?.email
      if (!coachName) return

      const names = groupCoachNamesBySessionId.get(sessionId) || []
      if (!names.includes(coachName)) names.push(coachName)
      groupCoachNamesBySessionId.set(sessionId, names)
    })
  })

  slotSessions.forEach((session) => {
    if (!session.schedule_slot_id) return
    const rows = slotScopeBySlotId.get(session.schedule_slot_id) || []
    rows.push(session.id)
    slotScopeBySlotId.set(session.schedule_slot_id, rows)
  })

  sessions.forEach((session) => {
    expectedStudentIdBySessionId.set(session.id, getExpectedStudentId(session))
  })

  const latestAttendanceRowBySessionId = buildLatestAttendanceRowBySessionId(attendanceRows, visibleSessionIds)
  const latestAttendanceRowBySessionStudent = buildLatestAttendanceRowBySessionStudentKey(attendanceRows)
  const latestAttendanceBySessionId = buildLatestAttendanceBySessionId(attendanceRows, visibleSessionIds)
  const exactAttendanceBySessionId = new Map(latestAttendanceBySessionId)

  sessions.forEach((session) => {
    const expectedStudentId = expectedStudentIdBySessionId.get(session.id) || null
    const exactRow = expectedStudentId
      ? latestAttendanceRowBySessionStudent.get(getAttendanceSessionStudentKey(session.id, expectedStudentId))
      : null

    if (exactRow) {
      exactAttendanceBySessionId.set(session.id, exactRow.status)
      return
    }

    const legacyRow = latestAttendanceRowBySessionId.get(session.id)
    if (legacyRow && (!legacyRow.student_id || !expectedStudentId)) {
      exactAttendanceBySessionId.set(session.id, legacyRow.status)
      return
    }

    exactAttendanceBySessionId.delete(session.id)
  })

  const attendanceCountBySessionId = buildAttendanceCountBySessionId(attendanceRows)

  function getScopeSessionIds(session: AdminAttendanceSessionBase) {
    return groupScopeBySessionId.get(session.id)
      || (session.schedule_slot_id ? slotScopeBySlotId.get(session.schedule_slot_id) : null)
      || [session.id]
  }

  function getAttendanceScopeCount(session: AdminAttendanceSessionBase) {
    return getScopeSessionIds(session).reduce(
      (sum, sessionId) => sum + (attendanceCountBySessionId.get(sessionId) || 0),
      0,
    )
  }

  function getDisplayStatus(session: AdminAttendanceSessionBase): DisplaySessionStatus {
    return deriveSessionDisplayStatus({
      status: session.status,
      date: session.date,
      startTime: session.start_time,
      endTime: session.end_time,
      isMakeup: session.is_makeup || false,
      attendanceStatus: exactAttendanceBySessionId.get(session.id) || null,
      scopeAttendanceCount: getAttendanceScopeCount(session),
    })
  }

  function getCoachNames(session: AdminAttendanceSessionBase) {
    return groupCoachNamesBySessionId.get(session.id) || []
  }

  return {
    getAttendanceScopeCount,
    getCoachNames,
    getDisplayStatus,
    getScopeSessionIds,
    latestAttendanceBySessionId: exactAttendanceBySessionId,
  }
}
