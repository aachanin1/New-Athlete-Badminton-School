import type { AttendanceStatus } from '@/types/database'

export type DerivedSessionStatus =
  | 'present'
  | 'late'
  | 'absent'
  | 'completed'
  | 'in_progress'
  | 'upcoming'
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

  const now = input.now || new Date()
  if (isInProgressSession(input.date, input.startTime, input.endTime, now)) return 'in_progress'
  if (!isPastSession(input.date, input.endTime, now)) return 'upcoming'

  return (input.scopeAttendanceCount || 0) > 0 ? 'absent' : 'attendance_gap_review'
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
