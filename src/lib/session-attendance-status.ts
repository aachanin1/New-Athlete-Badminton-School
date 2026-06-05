import type { AttendanceStatus } from '@/types/database'

export type DerivedSessionStatus =
  | 'present'
  | 'late'
  | 'absent'
  | 'completed'
  | 'in_progress'
  | 'upcoming'
  | 'walleted'
  | 'attendance_gap_review'

export interface DeriveSessionStatusInput {
  status: string
  date: string
  startTime: string
  endTime: string
  isMakeup?: boolean | null
  attendanceStatus?: AttendanceStatus | null
  scopeAttendanceCount?: number
  now?: Date
}

export interface AttendanceSessionRow {
  booking_session_id: string
  status: AttendanceStatus
  checked_at?: string | null
  student_id?: string | null
}

export type DisplaySessionStatus = Exclude<DerivedSessionStatus, 'present' | 'late'> | 'completed'

export function getSessionDateTime(date: string, time: string) {
  return new Date(`${date}T${time || '00:00:00'}+07:00`)
}

export function isPastSession(date: string, endTime: string, now = new Date()) {
  return now > getSessionDateTime(date, endTime)
}

export function isInProgressSession(date: string, startTime: string, endTime: string, now = new Date()) {
  return now >= getSessionDateTime(date, startTime) && now <= getSessionDateTime(date, endTime)
}

export function deriveSessionAttendanceStatus(input: DeriveSessionStatusInput): DerivedSessionStatus {
  if (input.attendanceStatus) return input.attendanceStatus
  if (input.status === 'absent') return 'absent'
  if (input.status === 'completed') return 'completed'
  if (input.status === 'rescheduled') return 'completed'
  if (input.status === 'walleted') return 'walleted'

  const now = input.now || new Date()
  if (isInProgressSession(input.date, input.startTime, input.endTime, now)) return 'in_progress'
  if (!isPastSession(input.date, input.endTime, now)) return 'upcoming'

  return 'attendance_gap_review'
}

export function toDisplaySessionStatus(status: DerivedSessionStatus): DisplaySessionStatus {
  return status === 'present' || status === 'late' ? 'completed' : status
}

export function deriveSessionDisplayStatus(input: DeriveSessionStatusInput): DisplaySessionStatus {
  return toDisplaySessionStatus(deriveSessionAttendanceStatus(input))
}

export function expectedBookingStatusFromAttendanceStatus(status: AttendanceStatus) {
  return status === 'absent' ? 'absent' : 'completed'
}

export function buildLatestAttendanceRowBySessionId<T extends AttendanceSessionRow>(
  rows: T[],
  scopedSessionIds?: Set<string>,
) {
  const latestBySessionId = new Map<string, T>()

  rows.forEach((row) => {
    if (scopedSessionIds && !scopedSessionIds.has(row.booking_session_id)) return

    const existing = latestBySessionId.get(row.booking_session_id)
    if (!existing) {
      latestBySessionId.set(row.booking_session_id, row)
      return
    }

    const existingTime = existing.checked_at ? new Date(existing.checked_at).getTime() : -1
    const rowTime = row.checked_at ? new Date(row.checked_at).getTime() : -1
    if (rowTime >= existingTime) latestBySessionId.set(row.booking_session_id, row)
  })

  return latestBySessionId
}

export function buildLatestAttendanceBySessionId<T extends AttendanceSessionRow>(
  rows: T[],
  scopedSessionIds?: Set<string>,
) {
  const latestRows = buildLatestAttendanceRowBySessionId(rows, scopedSessionIds)
  const statusBySessionId = new Map<string, AttendanceStatus>()

  latestRows.forEach((row, sessionId) => {
    statusBySessionId.set(sessionId, row.status)
  })

  return statusBySessionId
}

export function buildAttendanceCountBySessionId<T extends AttendanceSessionRow>(rows: T[]) {
  const countBySessionId = new Map<string, number>()

  rows.forEach((row) => {
    countBySessionId.set(row.booking_session_id, (countBySessionId.get(row.booking_session_id) || 0) + 1)
  })

  return countBySessionId
}

export function getAttendanceSessionStudentKey(sessionId: string, studentId: string) {
  return `${sessionId}:${studentId}`
}

export function buildLatestAttendanceRowBySessionStudentKey<T extends AttendanceSessionRow>(rows: T[]) {
  const latestBySessionStudent = new Map<string, T>()

  rows.forEach((row) => {
    if (!row.student_id) return

    const key = getAttendanceSessionStudentKey(row.booking_session_id, row.student_id)
    const existing = latestBySessionStudent.get(key)
    if (!existing) {
      latestBySessionStudent.set(key, row)
      return
    }

    const existingTime = existing.checked_at ? new Date(existing.checked_at).getTime() : -1
    const rowTime = row.checked_at ? new Date(row.checked_at).getTime() : -1
    if (rowTime >= existingTime) latestBySessionStudent.set(key, row)
  })

  return latestBySessionStudent
}

export function isMakeupEligibleMissedSession(input: DeriveSessionStatusInput) {
  if (input.isMakeup) return false
  const derivedStatus = deriveSessionAttendanceStatus(input)
  return derivedStatus === 'absent'
}

export function isAttendanceGapReviewSession(input: DeriveSessionStatusInput) {
  if (input.isMakeup) return false
  return deriveSessionAttendanceStatus(input) === 'attendance_gap_review'
}
