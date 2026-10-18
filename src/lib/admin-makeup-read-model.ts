import type { AttendanceStatus } from '@/types/database'
import { isAttendanceGapReviewSession, isMakeupEligibleMissedSession } from '@/lib/session-attendance-status'
export interface BookingSessionData {
  id: string
  booking_id: string
  child_id: string | null
  user_id: string | null
  branch_id: string
  schedule_slot_id?: string | null
  rescheduled_from_id: string | null
  date: string
  start_time: string
  end_time: string
  status: string
  attendance_status?: AttendanceStatus | null
  attendance_scope_count?: number
  user_name: string
  learner_name: string
  branch_name: string
  course_type: string
  is_makeup: boolean
  group_id?: string | null
  group_name?: string | null
  coach_id?: string | null
  coach_name?: string | null
  same_slot_coach_groups?: SameSlotCoachGroupOption[]
  coach_checkin_time?: string | null
  coach_checkin_photo_url?: string | null
  coach_checkin_has_location?: boolean
  review_closed_at?: string | null
  review_closed_reason?: string | null
  coach_review_requested_count?: number
  coach_review_requested_at?: string | null
  coach_evidence_requested_count?: number
  coach_evidence_requested_at?: string | null
}
export interface BranchOption {
  id: string
  name: string
  slug: string
}
export interface CoachOption {
  id: string
  name: string
  role: string
}
export interface ReviewSessionGroup {
  key: string
  date: string
  startTime: string
  endTime: string
  branchName: string
  courseType: string
  coachName: string | null
  coachCheckinTime: string | null
  coachCheckinHasLocation: boolean
  coachReviewRequestCount: number
  coachReviewRequestedAt: string | null
  coachEvidenceRequestCount: number
  coachEvidenceRequestedAt: string | null
  groupNames: string[]
  sessions: BookingSessionData[]
}
export interface SameSlotCoachGroupOption {
  groupId: string
  groupName: string
  coachId: string
  coachName: string
  sessionCount: number
}
export function getSessionEndDate(session: BookingSessionData) {
  return new Date(`${session.date}T${session.end_time}`)
}

export function isOverdueSession(session: BookingSessionData) {
  return session.status === 'scheduled' && !session.is_makeup && getSessionEndDate(session).getTime() < Date.now()
}

export function isMissedSession(session: BookingSessionData) {
  return isMakeupEligibleMissedSession({
    status: session.status,
    date: session.date,
    startTime: session.start_time,
    endTime: session.end_time,
    isMakeup: session.is_makeup,
    attendanceStatus: session.attendance_status || null,
    scopeAttendanceCount: session.attendance_scope_count || 0,
  })
}

export function isClosedReviewSession(session: BookingSessionData) {
  return Boolean(session.review_closed_at)
}

export function isAttendanceReviewSession(session: BookingSessionData) {
  if (isClosedReviewSession(session)) return false

  return isAttendanceGapReviewSession({
    status: session.status,
    date: session.date,
    startTime: session.start_time,
    endTime: session.end_time,
    isMakeup: session.is_makeup,
    attendanceStatus: session.attendance_status || null,
    scopeAttendanceCount: session.attendance_scope_count || 0,
  })
}

export function hasRecordedAttendance(session: BookingSessionData) {
  return session.attendance_status === 'present' || session.attendance_status === 'late' || session.attendance_status === 'absent'
}

export function hasCompleteCoachEvidence(session: BookingSessionData) {
  return Boolean(session.coach_checkin_time && session.coach_checkin_photo_url && session.coach_checkin_has_location)
}

export function isCoachEvidenceReviewSession(session: BookingSessionData) {
  if (isClosedReviewSession(session)) return false

  return Boolean(
    !session.is_makeup &&
    session.schedule_slot_id &&
    session.coach_name &&
    hasRecordedAttendance(session) &&
    !hasCompleteCoachEvidence(session)
  )
}

export function isReviewOrEvidenceSession(session: BookingSessionData) {
  return isAttendanceReviewSession(session) || isCoachEvidenceReviewSession(session)
}

export function isUnassignedAttendanceRound(group: ReviewSessionGroup) {
  return !group.coachName && group.sessions.some(isAttendanceReviewSession)
}

export function getReviewGroupKey(session: BookingSessionData) {
  return [session.date, session.start_time, session.end_time, session.branch_name,
    session.course_type || 'course', session.coach_name || 'no-coach'].join('|')
}


export type ReviewFilter = { search: string; branch: string; course: string; status: string; session?: string | null; date?: string | null }
