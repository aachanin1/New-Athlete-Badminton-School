'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ListPagination } from '@/components/admin/list-pagination'
import {
  formatThaiDateTimeWithWeekday,
  formatThaiDateWithWeekday,
  formatThaiMonthYear,
  formatThaiShortMonthYear,
} from '@/lib/date-format'
import { isAttendanceGapReviewSession, isMakeupEligibleMissedSession } from '@/lib/session-attendance-status'
import { getTemplateSlots, type ScheduleTemplateOption } from '@/lib/schedule-template-utils'
import type { AttendanceStatus } from '@/types/database'
import {
  AlertCircle,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Loader2,
  Search,
  User,
  Users,
  XCircle,
} from 'lucide-react'

type CourseKey = 'kids_group' | 'adult_group' | 'private'
type MakeupTab = 'review' | 'makeup'
type ReviewStatusFilter = 'all' | 'no_coach' | 'waiting_attendance' | 'coach_evidence' | 'coach_requested'
type MakeupStatusFilter = 'all' | 'actionable' | 'makeup' | 'expired'
type ReviewAction =
  | 'confirm_absent'
  | 'mark_attendance'
  | 'request_coach_review'
  | 'request_coach_evidence'
  | 'close_review'
  | 'return_entitlement'
type UnassignedRoundMode = 'taught' | 'return_entitlement' | 'close_review'
type AdminRetrospectiveOperation =
  | 'assign_coach_to_round'
  | 'resolve_unassigned_round'
  | 'mark_attendance'
  | 'replace_coach_for_past_round'
  | 'move_learner_to_existing_coach_group'

interface AdminRetrospectiveSnapshot {
  groups?: Array<{ id: string; coach_id: string | null; name?: string | null }>
  memberships?: Array<{ id: string; group_id: string; booking_session_id: string }>
  attendance?: Array<{ booking_session_id: string; status: AttendanceStatus }>
  sessionStatuses?: Array<{ id: string; status: string }>
}

interface AdminRetrospectiveTransition {
  changed?: boolean
  idempotentReplay?: boolean
  operation?: AdminRetrospectiveOperation
  groupId?: string
  targetSessionIds?: string[]
  after?: AdminRetrospectiveSnapshot
}

interface AdminRetrospectiveResponse {
  changed?: boolean
  idempotentReplay?: boolean
  operation?: AdminRetrospectiveOperation
  group_id?: string
  warnings?: unknown
  result?: AdminRetrospectiveTransition
}

interface RetrospectiveMutationOptions {
  operation: AdminRetrospectiveOperation
  targetIdentity: string
  targetSessionIds: string[]
  body: Record<string, unknown>
  failureMessage: string
  successMessage: string
  intendedCoachId?: string
}

interface BookingSessionData {
  id: string
  booking_id: string
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

interface BranchOption {
  id: string
  name: string
  slug: string
}

interface CoachOption {
  id: string
  name: string
  role: string
}

interface MakeupClientProps {
  sessions: BookingSessionData[]
  branches: BranchOption[]
  scheduleTemplates: ScheduleTemplateOption[]
  coaches: CoachOption[]
  reviewTarget?: {
    sessionId?: string | null
    date?: string | null
  }
}

interface MonthGroup {
  key: string
  monthKey: string
  monthLabel: string
  nextMonthLabel: string
  deadlineLabel: string
  canCreate: boolean
  hasMakeup: boolean
  isExpired: boolean
  absentCount: number
  overdueCount: number
  sessions: BookingSessionData[]
  sourceSession: BookingSessionData
}

interface LearnerGroup {
  key: string
  learnerName: string
  userName: string
  branches: string[]
  months: MonthGroup[]
}

interface ReviewSessionGroup {
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

interface PickedSlot {
  date: string
  dayOfWeek: number
  start: string
  end: string
  branchId: string
  branchName: string
}

interface SameSlotCoachGroupOption {
  groupId: string
  groupName: string
  coachId: string
  coachName: string
  sessionCount: number
}

interface AvailableDay {
  date: Date
  dateInput: string
  dayOfWeek: number
  slotsByBranch: {
    branch: BranchOption
    slots: { start: string; end: string }[]
  }[]
}

function getSessionEndDate(session: BookingSessionData) {
  return new Date(`${session.date}T${session.end_time}`)
}

function isOverdueSession(session: BookingSessionData) {
  return session.status === 'scheduled' && !session.is_makeup && getSessionEndDate(session).getTime() < Date.now()
}

function isMissedSession(session: BookingSessionData) {
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

function isClosedReviewSession(session: BookingSessionData) {
  return Boolean(session.review_closed_at)
}

function isAttendanceReviewSession(session: BookingSessionData) {
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

function hasRecordedAttendance(session: BookingSessionData) {
  return session.attendance_status === 'present' || session.attendance_status === 'late' || session.attendance_status === 'absent'
}

function hasCompleteCoachEvidence(session: BookingSessionData) {
  return Boolean(session.coach_checkin_time && session.coach_checkin_photo_url && session.coach_checkin_has_location)
}

function isCoachEvidenceReviewSession(session: BookingSessionData) {
  if (isClosedReviewSession(session)) return false

  return Boolean(
    !session.is_makeup &&
    session.schedule_slot_id &&
    session.coach_name &&
    hasRecordedAttendance(session) &&
    !hasCompleteCoachEvidence(session)
  )
}

function isReviewOrEvidenceSession(session: BookingSessionData) {
  return isAttendanceReviewSession(session) || isCoachEvidenceReviewSession(session)
}

function isUnassignedAttendanceRound(group: ReviewSessionGroup) {
  return !group.coachName && group.sessions.some(isAttendanceReviewSession)
}

function getMonthKey(date: string) {
  return date.slice(0, 7)
}

function getMonthRange(date: string) {
  const [yearText, monthText] = date.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1
  const start = new Date(year, monthIndex, 1)
  const nextStart = new Date(year, monthIndex + 1, 1)
  const nextEnd = new Date(year, monthIndex + 2, 0)
  const followingStart = new Date(year, monthIndex + 2, 1)
  const toInput = (value: Date) => {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return {
    monthLabel: formatThaiShortMonthYear(toInput(start)),
    nextMonthLabel: formatThaiMonthYear(toInput(nextStart)),
    nextMonthStart: toInput(nextStart),
    nextMonthEnd: toInput(nextEnd),
    followingStart,
    deadlineLabel: formatThaiDateWithWeekday(toInput(nextEnd)),
  }
}

function formatDate(value: string) {
  return formatThaiDateWithWeekday(value)
}

function formatTime(start: string, end: string) {
  return `${start.slice(0, 5)}-${end.slice(0, 5)}`
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return null
  return formatThaiDateTimeWithWeekday(value)
}

function compareTextTh(a: string, b: string) {
  const byThaiLocale = a.localeCompare(b, 'th', { numeric: true, sensitivity: 'base' })
  if (byThaiLocale !== 0) return byThaiLocale
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function getReviewActionLabel(action: ReviewAction) {
  if (action === 'mark_attendance') return 'บันทึกเช็คชื่อย้อนหลัง'
  if (action === 'request_coach_review') return 'ส่งกลับให้โค้ชตรวจสอบ'
  if (action === 'request_coach_evidence') return 'ขอหลักฐานโค้ชย้อนหลัง'
  if (action === 'close_review') return 'ปิดเคสโดยไม่สร้างสิทธิ์ชดเชย'
  if (action === 'return_entitlement') return 'คืนสิทธิ์เข้ากระเป๋า'
  return 'ยืนยันขาดเรียน'
}

function getAttendanceStatusLabel(status: AttendanceStatus) {
  if (status === 'present') return 'มาเรียน'
  if (status === 'late') return 'มาสาย'
  return 'ขาดเรียน'
}

function normalizeCourseType(courseType: string): CourseKey {
  const value = courseType.toLowerCase()
  if (value.includes('private')) return 'private'
  if (value.includes('adult') || value.includes('ผู้ใหญ่')) return 'adult_group'
  return 'kids_group'
}

function getDaysInRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const days: Date[] = []
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    days.push(new Date(cursor))
  }
  return days
}

function toDateInput(value: Date) {
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function buildAvailableDays(month: MonthGroup | null, branches: BranchOption[], scheduleTemplates: ScheduleTemplateOption[]): AvailableDay[] {
  if (!month) return []
  const range = getMonthRange(month.sourceSession.date)
  const courseType = normalizeCourseType(month.sourceSession.course_type)

  return getDaysInRange(range.nextMonthStart, range.nextMonthEnd)
    .map((date) => {
      const dayOfWeek = date.getDay()
      const slotsByBranch = branches
        .map((branch) => ({
          branch,
          slots: getTemplateSlots(scheduleTemplates, branch.slug, courseType, dayOfWeek),
        }))
        .filter((item) => item.slots.length > 0)

      return {
        date,
        dateInput: toDateInput(date),
        dayOfWeek,
        slotsByBranch,
      }
    })
    .filter((day) => day.slotsByBranch.length > 0)
}

export function MakeupClient({ sessions, branches, scheduleTemplates, coaches, reviewTarget }: MakeupClientProps) {
  const router = useRouter()
  const [isRefreshPending, startRefreshTransition] = useTransition()
  const inFlightTargetKeysRef = useRef(new Set<string>())
  const inFlightSessionIdsRef = useRef(new Set<string>())
  const mutationSequenceRef = useRef(new Map<string, number>())
  const refreshTargetKeysRef = useRef(new Set<string>())
  const refreshSessionIdsRef = useRef(new Set<string>())
  const refreshObservedRef = useRef(false)
  const [sessionOverrides, setSessionOverrides] = useState<Record<string, Partial<BookingSessionData>>>({})
  const [pendingSessionIds, setPendingSessionIds] = useState<Set<string>>(() => new Set())
  const [reconcilingSessionIds, setReconcilingSessionIds] = useState<Set<string>>(() => new Set())
  const [completionMessage, setCompletionMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<MakeupTab>('review')
  const [reviewSearch, setReviewSearch] = useState('')
  const [reviewBranch, setReviewBranch] = useState('all')
  const [reviewCourse, setReviewCourse] = useState('all')
  const [reviewStatus, setReviewStatus] = useState<ReviewStatusFilter>('all')
  const [makeupSearch, setMakeupSearch] = useState('')
  const [makeupBranch, setMakeupBranch] = useState('all')
  const [makeupCourse, setMakeupCourse] = useState('all')
  const [makeupStatus, setMakeupStatus] = useState<MakeupStatusFilter>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reviewGroupLoadingKey, setReviewGroupLoadingKey] = useState<string | null>(null)
  const [reviewSession, setReviewSession] = useState<BookingSessionData | null>(null)
  const [reviewAction, setReviewAction] = useState<ReviewAction>('confirm_absent')
  const [reviewAttendanceStatus, setReviewAttendanceStatus] = useState<AttendanceStatus>('present')
  const [reviewReason, setReviewReason] = useState('')
  const [reviewCoachId, setReviewCoachId] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [unassignedGroup, setUnassignedGroup] = useState<ReviewSessionGroup | null>(null)
  const [unassignedMode, setUnassignedMode] = useState<UnassignedRoundMode>('taught')
  const [unassignedCoachId, setUnassignedCoachId] = useState('')
  const [unassignedReason, setUnassignedReason] = useState('')
  const [unassignedSubmitting, setUnassignedSubmitting] = useState(false)
  const [replacementGroup, setReplacementGroup] = useState<ReviewSessionGroup | null>(null)
  const [replacementCoachId, setReplacementCoachId] = useState('')
  const [replacementReason, setReplacementReason] = useState('')
  const [replacementSubmitting, setReplacementSubmitting] = useState(false)
  const [moveGroup, setMoveGroup] = useState<ReviewSessionGroup | null>(null)
  const [moveSessionId, setMoveSessionId] = useState('')
  const [moveTargetGroupId, setMoveTargetGroupId] = useState('')
  const [moveReason, setMoveReason] = useState('')
  const [moveSubmitting, setMoveSubmitting] = useState(false)
  const [roundAttendanceGroup, setRoundAttendanceGroup] = useState<ReviewSessionGroup | null>(null)
  const [roundAttendanceReason, setRoundAttendanceReason] = useState('')
  const [roundAttendance, setRoundAttendance] = useState<Record<string, AttendanceStatus | ''>>({})
  const [roundAttendanceSubmitting, setRoundAttendanceSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<MonthGroup | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [pickedSlot, setPickedSlot] = useState<PickedSlot | null>(null)
  const reviewTargetSessionId = reviewTarget?.sessionId || null
  const reviewTargetDate = reviewTarget?.date || null

  const projectedSessions = useMemo(
    () => sessions.map((session) => ({ ...session, ...(sessionOverrides[session.id] || {}) })),
    [sessionOverrides, sessions]
  )

  useEffect(() => {
    setSessionOverrides((current) => {
      let changed = false
      const next = { ...current }
      sessions.forEach((session) => {
        const override = current[session.id]
        if (!override) return
        const reconciled = (['group_id', 'group_name', 'coach_id', 'coach_name', 'status', 'attendance_status'] as const)
          .every((field) => override[field] === undefined || override[field] === session[field])
        if (!reconciled) return
        delete next[session.id]
        changed = true
      })
      return changed ? next : current
    })
  }, [sessions])

  const setSessionIdsPending = useCallback((targetSessionIds: string[], pending: boolean) => {
    setPendingSessionIds((current) => {
      const next = new Set(current)
      targetSessionIds.forEach((sessionId) => pending ? next.add(sessionId) : next.delete(sessionId))
      return next
    })
  }, [])

  const isTargetBusy = useCallback((targetSessionIds: string[]) => (
    targetSessionIds.some((sessionId) => pendingSessionIds.has(sessionId) || reconcilingSessionIds.has(sessionId))
  ), [pendingSessionIds, reconcilingSessionIds])

  useEffect(() => {
    if (isRefreshPending) {
      refreshObservedRef.current = true
      return
    }
    if (!refreshObservedRef.current || refreshTargetKeysRef.current.size === 0) return

    refreshObservedRef.current = false
    refreshTargetKeysRef.current.clear()
    refreshSessionIdsRef.current.clear()
    setReconcilingSessionIds(new Set())
  }, [isRefreshPending])

  const applyCanonicalProjection = useCallback((
    response: AdminRetrospectiveResponse,
    fallbackSessionIds: string[],
    intendedCoachId?: string
  ) => {
    const transition: AdminRetrospectiveTransition = response.result || {
      changed: response.changed,
      idempotentReplay: response.idempotentReplay,
      operation: response.operation,
      groupId: response.group_id,
    }
    const targetSessionIds = transition.targetSessionIds || fallbackSessionIds
    const after = transition.after
    const groups = after?.groups || []
    const memberships = after?.memberships || []
    const attendance = after?.attendance || []
    const sessionStatuses = after?.sessionStatuses || []
    const fallbackGroupId = transition.groupId || response.group_id || null
    const sameSlotCoachGroups = groups
      .filter((group) => Boolean(group.coach_id))
      .map((group) => {
        const coach = coaches.find((item) => item.id === group.coach_id)
        return {
          groupId: group.id,
          groupName: group.name || 'ไม่ระบุชื่อกลุ่ม',
          coachId: group.coach_id || '',
          coachName: coach?.name || 'ไม่ทราบโค้ช',
          sessionCount: memberships.filter((membership) => membership.group_id === group.id).length,
        }
      })
      .filter((group) => group.sessionCount > 0)

    setSessionOverrides((current) => {
      const next = { ...current }
      targetSessionIds.forEach((sessionId) => {
        const membership = memberships.find((item) => item.booking_session_id === sessionId)
        const groupId = membership?.group_id || fallbackGroupId
        const group = groups.find((item) => item.id === groupId)
        const coachId = group?.coach_id || intendedCoachId || null
        const coach = coaches.find((item) => item.id === coachId)
        const status = sessionStatuses.find((item) => item.id === sessionId)?.status
        const attendanceStatus = attendance.find((item) => item.booking_session_id === sessionId)?.status

        next[sessionId] = {
          ...next[sessionId],
          ...(groupId ? { group_id: groupId } : {}),
          ...(group?.name ? { group_name: group.name } : {}),
          coach_id: coachId,
          coach_name: coach?.name || (coachId ? 'ไม่ทราบโค้ช' : null),
          ...(status ? { status } : {}),
          ...(attendanceStatus ? { attendance_status: attendanceStatus, attendance_scope_count: 1 } : {}),
          same_slot_coach_groups: sameSlotCoachGroups.filter((item) => item.groupId !== groupId),
        }
      })
      return next
    })
  }, [coaches])

  const runRetrospectiveMutation = useCallback(async ({
    operation,
    targetIdentity,
    targetSessionIds,
    body,
    failureMessage,
    successMessage,
    intendedCoachId,
  }: RetrospectiveMutationOptions) => {
    if (
      inFlightTargetKeysRef.current.has(targetIdentity)
      || refreshTargetKeysRef.current.has(targetIdentity)
      || targetSessionIds.some((sessionId) => inFlightSessionIdsRef.current.has(sessionId) || refreshSessionIdsRef.current.has(sessionId))
    ) {
      return false
    }

    const nextSequence = (mutationSequenceRef.current.get(targetIdentity) || 0) + 1
    mutationSequenceRef.current.set(targetIdentity, nextSequence)
    inFlightTargetKeysRef.current.add(targetIdentity)
    targetSessionIds.forEach((sessionId) => inFlightSessionIdsRef.current.add(sessionId))
    setSessionIdsPending(targetSessionIds, true)
    setCompletionMessage(null)
    setError(null)

    try {
      const httpResponse = await fetch('/api/admin/makeup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, action: operation }),
      })
      const response = await httpResponse.json().catch(() => null) as AdminRetrospectiveResponse & { error?: string } | null

      if (!httpResponse.ok || !response) {
        setError(response?.error || failureMessage)
        return false
      }
      if (mutationSequenceRef.current.get(targetIdentity) !== nextSequence) return false

      applyCanonicalProjection(response, targetSessionIds, intendedCoachId)
      if (response.warnings) toast.warning(String(response.warnings))

      const idempotentReplay = response.idempotentReplay === true || response.result?.idempotentReplay === true
      const confirmation = idempotentReplay
        ? `${successMessage} (ข้อมูลเป็นปัจจุบันอยู่แล้ว)`
        : successMessage
      setCompletionMessage(confirmation)
      toast.success(confirmation)

      refreshTargetKeysRef.current.add(targetIdentity)
      targetSessionIds.forEach((sessionId) => refreshSessionIdsRef.current.add(sessionId))
      setReconcilingSessionIds((current) => new Set([...current, ...targetSessionIds]))
      startRefreshTransition(() => router.refresh())
      return true
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
      return false
    } finally {
      inFlightTargetKeysRef.current.delete(targetIdentity)
      targetSessionIds.forEach((sessionId) => inFlightSessionIdsRef.current.delete(sessionId))
      setSessionIdsPending(targetSessionIds, false)
    }
  }, [applyCanonicalProjection, router, setSessionIdsPending])

  const isReviewTargetSession = useCallback((session: BookingSessionData) => {
    if (reviewTargetSessionId) return session.id === reviewTargetSessionId
    if (reviewTargetDate) return session.date === reviewTargetDate
    return false
  }, [reviewTargetDate, reviewTargetSessionId])

  const getSameSlotCoachGroups = useCallback((sourceSession: BookingSessionData): SameSlotCoachGroupOption[] => {
    if (!sourceSession.schedule_slot_id) return []
    if (sourceSession.same_slot_coach_groups?.length) {
      return [...sourceSession.same_slot_coach_groups]
        .filter((group) => group.sessionCount > 0)
        .sort((a, b) => compareTextTh(a.coachName, b.coachName) || compareTextTh(a.groupName, b.groupName) || a.groupId.localeCompare(b.groupId))
    }

    const groupMap = new Map<string, SameSlotCoachGroupOption>()
    projectedSessions.forEach((session) => {
      if (!session.group_id || !session.coach_id) return
      if (session.group_id === sourceSession.group_id) return
      if (session.schedule_slot_id !== sourceSession.schedule_slot_id) return
      if (session.date !== sourceSession.date) return
      if (session.start_time !== sourceSession.start_time) return
      if (session.end_time !== sourceSession.end_time) return
      if (session.branch_id !== sourceSession.branch_id) return
      if ((session.course_type || '') !== (sourceSession.course_type || '')) return

      const existing = groupMap.get(session.group_id)
      if (existing) {
        existing.sessionCount += 1
        return
      }

      groupMap.set(session.group_id, {
        groupId: session.group_id,
        groupName: session.group_name || 'ไม่ระบุชื่อกลุ่ม',
        coachId: session.coach_id,
        coachName: session.coach_name || 'ไม่ทราบโค้ช',
        sessionCount: 1,
      })
    })

    return Array.from(groupMap.values())
      .filter((group) => group.sessionCount > 0)
      .sort((a, b) => compareTextTh(a.coachName, b.coachName) || compareTextTh(a.groupName, b.groupName) || a.groupId.localeCompare(b.groupId))
  }, [projectedSessions])

  const makeupSourceIds = useMemo(
    () => new Set(projectedSessions.map((session) => session.rescheduled_from_id).filter(Boolean) as string[]),
    [projectedSessions]
  )
  const courseOptions = useMemo(
    () => Array.from(new Set(projectedSessions.map((session) => session.course_type).filter(Boolean))).sort(compareTextTh),
    [projectedSessions]
  )

  const monthGroups = useMemo(() => {
    const groups = new Map<string, MonthGroup & { learnerName: string; userName: string; branches: string[] }>()

    projectedSessions.filter(isMissedSession).forEach((session) => {
      const learnerKey = `${session.user_name}::${session.learner_name}`
      const monthKey = getMonthKey(session.date)
      const key = `${learnerKey}::${monthKey}`
      const range = getMonthRange(session.date)
      const isExpired = Date.now() >= range.followingStart.getTime()

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          monthKey,
          monthLabel: range.monthLabel,
          nextMonthLabel: range.nextMonthLabel,
          deadlineLabel: range.deadlineLabel,
          canCreate: false,
          hasMakeup: false,
          isExpired,
          absentCount: 0,
          overdueCount: 0,
          sessions: [],
          sourceSession: session,
          learnerName: session.learner_name,
          userName: session.user_name,
          branches: [],
        })
      }

      const group = groups.get(key)
      if (!group) return
      group.sessions.push(session)
      group.absentCount += 1
      if (isOverdueSession(session)) group.overdueCount += 1
      if (!group.branches.includes(session.branch_name)) group.branches.push(session.branch_name)
      if (makeupSourceIds.has(session.id)) group.hasMakeup = true
      group.sourceSession = group.sessions[0]
    })

    return Array.from(groups.values()).map((group) => ({
      ...group,
      canCreate: !group.hasMakeup && !group.isExpired,
      sessions: group.sessions.sort((a, b) => a.date.localeCompare(b.date)),
    }))
  }, [makeupSourceIds, projectedSessions])

  const filteredMonthGroups = useMemo(() => {
    const q = makeupSearch.trim().toLowerCase()

    return monthGroups.filter((group) => {
      if (makeupStatus === 'actionable' && !group.canCreate) return false
      if (makeupStatus === 'expired' && (!group.isExpired || group.hasMakeup)) return false
      if (makeupStatus === 'makeup' && !group.hasMakeup) return false
      if (makeupBranch !== 'all' && !group.sessions.some((session) => session.branch_id === makeupBranch)) return false
      if (makeupCourse !== 'all' && !group.sessions.some((session) => session.course_type === makeupCourse)) return false
      if (!q) return true

      return [
        group.learnerName,
        group.userName,
        group.monthLabel,
        group.nextMonthLabel,
        ...group.branches,
        ...group.sessions.map((session) => session.course_type),
      ].some((value) => value.toLowerCase().includes(q))
    })
  }, [makeupBranch, makeupCourse, makeupSearch, makeupStatus, monthGroups])

  const learnerGroups = useMemo<LearnerGroup[]>(() => {
    const groups = new Map<string, LearnerGroup>()

    filteredMonthGroups.forEach((month) => {
      const learnerKey = `${month.userName}::${month.learnerName}`
      if (!groups.has(learnerKey)) {
        groups.set(learnerKey, {
          key: learnerKey,
          learnerName: month.learnerName,
          userName: month.userName,
          branches: [],
          months: [],
        })
      }

      const group = groups.get(learnerKey)
      if (!group) return
      month.branches.forEach((branch) => {
        if (!group.branches.includes(branch)) group.branches.push(branch)
      })
      group.months.push(month)
    })

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        months: group.months.sort((a, b) => b.monthKey.localeCompare(a.monthKey)),
      }))
      .sort((a, b) => b.months.length - a.months.length || compareTextTh(a.learnerName, b.learnerName) || a.key.localeCompare(b.key))
  }, [filteredMonthGroups])

  const reviewSessions = useMemo(() => {
    const q = reviewSearch.trim().toLowerCase()

    return projectedSessions
      .filter(isReviewOrEvidenceSession)
      .filter((session) => {
        if (reviewBranch !== 'all' && session.branch_id !== reviewBranch) return false
        if (reviewCourse !== 'all' && session.course_type !== reviewCourse) return false
        if (reviewStatus === 'no_coach' && session.coach_name) return false
        if (reviewStatus === 'waiting_attendance' && !isAttendanceReviewSession(session)) return false
        if (reviewStatus === 'coach_evidence' && !isCoachEvidenceReviewSession(session)) return false
        if (reviewStatus === 'coach_requested' && !(session.coach_review_requested_count && session.coach_review_requested_count > 0)) return false
        if (!q) return true

        return [
          session.learner_name,
          session.user_name,
          session.coach_name || '',
          session.branch_name,
          session.course_type,
          formatDate(session.date),
        ].some((value) => value.toLowerCase().includes(q))
      })
      .sort((a, b) => {
        const aTarget = isReviewTargetSession(a)
        const bTarget = isReviewTargetSession(b)
        if (aTarget !== bTarget) return aTarget ? -1 : 1
        return b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time)
      })
  }, [isReviewTargetSession, projectedSessions, reviewBranch, reviewCourse, reviewSearch, reviewStatus])

  const reviewSessionGroups = useMemo<ReviewSessionGroup[]>(() => {
    const groups = new Map<string, ReviewSessionGroup>()

    reviewSessions.forEach((session) => {
      const key = [
        session.date,
        session.start_time,
        session.end_time,
        session.branch_name,
        session.course_type || 'course',
        session.coach_name || 'no-coach',
      ].join('|')

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          date: session.date,
          startTime: session.start_time,
          endTime: session.end_time,
          branchName: session.branch_name,
          courseType: session.course_type || 'คอร์สเรียน',
          coachName: session.coach_name || null,
          coachCheckinTime: session.coach_checkin_time || null,
          coachCheckinHasLocation: Boolean(session.coach_checkin_has_location),
          coachReviewRequestCount: 0,
          coachReviewRequestedAt: null,
          coachEvidenceRequestCount: 0,
          coachEvidenceRequestedAt: null,
          groupNames: [],
          sessions: [],
        })
      }

      const group = groups.get(key)
      if (!group) return
      group.sessions.push(session)
      if (session.group_name && !group.groupNames.includes(session.group_name)) group.groupNames.push(session.group_name)
      if (!group.coachCheckinTime && session.coach_checkin_time) group.coachCheckinTime = session.coach_checkin_time
      if (session.coach_checkin_has_location) group.coachCheckinHasLocation = true
      group.coachReviewRequestCount = Math.max(group.coachReviewRequestCount, session.coach_review_requested_count || 0)
      group.coachEvidenceRequestCount = Math.max(group.coachEvidenceRequestCount, session.coach_evidence_requested_count || 0)
      if (session.coach_review_requested_at && (!group.coachReviewRequestedAt || session.coach_review_requested_at > group.coachReviewRequestedAt)) {
        group.coachReviewRequestedAt = session.coach_review_requested_at
      }
      if (session.coach_evidence_requested_at && (!group.coachEvidenceRequestedAt || session.coach_evidence_requested_at > group.coachEvidenceRequestedAt)) {
        group.coachEvidenceRequestedAt = session.coach_evidence_requested_at
      }
    })

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        sessions: group.sessions.sort((a, b) => compareTextTh(a.learner_name, b.learner_name) || a.id.localeCompare(b.id)),
      }))
      .sort((a, b) => {
        const aTarget = a.sessions.some(isReviewTargetSession)
        const bTarget = b.sessions.some(isReviewTargetSession)
        if (aTarget !== bTarget) return aTarget ? -1 : 1
        return b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime)
      })
  }, [isReviewTargetSession, reviewSessions])

  const stats = useMemo(() => {
    const reviewItems = projectedSessions.filter(isReviewOrEvidenceSession)

    return {
      total: monthGroups.length,
      actionable: monthGroups.filter((group) => group.canCreate).length,
      expired: monthGroups.filter((group) => group.isExpired && !group.hasMakeup).length,
      makeups: monthGroups.filter((group) => group.hasMakeup).length,
      learners: new Set(monthGroups.map((group) => `${group.userName}:${group.learnerName}`)).size,
      review: reviewItems.length,
      reviewNoCoach: reviewItems.filter((session) => !session.coach_name).length,
      reviewCoachEvidence: reviewItems.filter(isCoachEvidenceReviewSession).length,
    }
  }, [monthGroups, projectedSessions])

  const totalPages = Math.max(1, Math.ceil(learnerGroups.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedLearnerGroups = learnerGroups.slice((safePage - 1) * pageSize, safePage * pageSize)

  const availableDays = useMemo(() => buildAvailableDays(selectedMonth, branches, scheduleTemplates), [branches, scheduleTemplates, selectedMonth])
  const selectedDay = useMemo(
    () => availableDays.find((day) => day.dateInput === selectedDate) || null,
    [availableDays, selectedDate]
  )
  const calendarCells = useMemo(() => {
    if (!selectedMonth) return []
    const range = getMonthRange(selectedMonth.sourceSession.date)
    const start = new Date(`${range.nextMonthStart}T00:00:00`)
    const end = new Date(`${range.nextMonthEnd}T00:00:00`)
    const cells: ({ date: Date; dateInput: string; availableDay: AvailableDay | null } | null)[] = []
    for (let i = 0; i < start.getDay(); i++) cells.push(null)
    for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const date = new Date(cursor)
      const dateInput = toDateInput(date)
      cells.push({
        date,
        dateInput,
        availableDay: availableDays.find((day) => day.dateInput === dateInput) || null,
      })
    }
    return cells
  }, [availableDays, selectedMonth])

  const openMakeupDialog = (month: MonthGroup) => {
    const days = buildAvailableDays(month, branches, scheduleTemplates)
    setError(null)
    setSelectedMonth(month)
    setSelectedDate(days[0]?.dateInput || '')
    setPickedSlot(null)
    setDialogOpen(true)
  }

  const createMakeup = async () => {
    if (!selectedMonth || !pickedSlot) {
      setError('กรุณาเลือกวันและรอบเรียนสำหรับชดเชย')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/makeup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_session_id: selectedMonth.sourceSession.id,
          booking_id: selectedMonth.sourceSession.booking_id,
          makeup_date: pickedSlot.date,
          start_time: pickedSlot.start,
          end_time: pickedSlot.end,
          branch_id: pickedSlot.branchId,
        }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        setError(result?.error || 'สร้างวันชดเชยไม่สำเร็จ')
        return
      }

      setDialogOpen(false)
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  const sendReviewGroupToCoach = async (group: ReviewSessionGroup) => {
    const targetSessions = group.sessions.filter(isAttendanceReviewSession)
    if (targetSessions.length === 0) return

    if (!group.coachName) {
      setError('รอบนี้ยังไม่มีโค้ชที่รับผิดชอบ จึงส่งให้โค้ชตรวจสอบไม่ได้ กรุณาบันทึกย้อนหลังหรือปิดเคสเป็นรายคน')
      return
    }

    setReviewGroupLoadingKey(group.key)
    setError(null)

    try {
      for (const session of targetSessions) {
        const response = await fetch('/api/admin/makeup', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: session.id,
            action: 'request_coach_review',
            reason: `ส่งตรวจสอบย้อนหลังทั้งรอบ ${formatDate(group.date)} ${formatTime(group.startTime, group.endTime)} (${targetSessions.length} คน)`,
          }),
        })

        const result = await response.json().catch(() => null)
        if (!response.ok) {
          setError(result?.error || 'ส่งให้โค้ชตรวจสอบรอบนี้ไม่สำเร็จ')
          return
        }
      }

      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setReviewGroupLoadingKey(null)
    }
  }

  const requestCoachEvidenceForGroup = async (group: ReviewSessionGroup) => {
    const targetSessions = group.sessions.filter(isCoachEvidenceReviewSession)
    if (targetSessions.length === 0) return

    if (!group.coachName) {
      setError('รอบนี้ยังไม่มีโค้ชที่รับผิดชอบ จึงขอหลักฐานย้อนหลังไม่ได้')
      return
    }

    const loadingKey = `${group.key}:evidence`
    setReviewGroupLoadingKey(loadingKey)
    setError(null)

    try {
      for (const session of targetSessions) {
        const response = await fetch('/api/admin/makeup', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: session.id,
            action: 'request_coach_evidence',
            reason: `ขอหลักฐาน selfie/GPS ย้อนหลังสำหรับรอบ ${formatDate(group.date)} ${formatTime(group.startTime, group.endTime)} (${targetSessions.length} คน)`,
          }),
        })

        const result = await response.json().catch(() => null)
        if (!response.ok) {
          setError(result?.error || 'ขอหลักฐานโค้ชย้อนหลังไม่สำเร็จ')
          return
        }
      }

      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setReviewGroupLoadingKey(null)
    }
  }

  const closeReviewGroup = async (group: ReviewSessionGroup) => {
    const targetSessions = group.sessions.filter(isReviewOrEvidenceSession)
    if (targetSessions.length === 0) return

    const loadingKey = `${group.key}:close`
    setReviewGroupLoadingKey(loadingKey)
    setError(null)

    try {
      for (const session of targetSessions) {
        const response = await fetch('/api/admin/makeup', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: session.id,
            action: 'close_review',
            reason: `ปิดเคสทั้งรอบ ${formatDate(group.date)} ${formatTime(group.startTime, group.endTime)} โดยไม่สร้างสิทธิ์ชดเชย (${targetSessions.length} คน)`,
          }),
        })

        const result = await response.json().catch(() => null)
        if (!response.ok) {
          setError(result?.error || 'ปิดเคสทั้งรอบไม่สำเร็จ')
          return
        }
      }

      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setReviewGroupLoadingKey(null)
    }
  }

  const openReviewDialog = (session: BookingSessionData, action: ReviewAction) => {
    setReviewSession(session)
    setReviewAction(action)
    setReviewAttendanceStatus(action === 'confirm_absent' ? 'absent' : 'present')
    setReviewReason('')
    setReviewCoachId('')
    setError(null)
  }

  const submitReviewAction = async () => {
    if (!reviewSession) return
    const reason = reviewReason.trim()
    const needsRetroCoach = reviewAction === 'mark_attendance' && !reviewSession.coach_name

    if ((reviewAction === 'mark_attendance' || reviewAction === 'confirm_absent' || reviewAction === 'request_coach_review' || reviewAction === 'request_coach_evidence' || reviewAction === 'close_review' || reviewAction === 'return_entitlement') && !reason) {
      setError('กรุณาระบุเหตุผลก่อนบันทึกผลตรวจสอบ')
      return
    }

    if (needsRetroCoach && !reviewCoachId) {
      setError('กรุณาเลือกโค้ชจริงที่สอนรอบนี้ก่อนบันทึกย้อนหลัง')
      return
    }

    setReviewSubmitting(true)
    setError(null)

    try {
      if (needsRetroCoach) {
        const succeeded = await runRetrospectiveMutation({
          operation: 'mark_attendance',
          targetIdentity: `mark-attendance:${reviewSession.group_id || reviewSession.id}`,
          targetSessionIds: [reviewSession.id],
          body: {
            session_id: reviewSession.id,
            attendance_status: reviewAttendanceStatus,
            reason,
            coach_id: reviewCoachId,
          },
          intendedCoachId: reviewCoachId,
          failureMessage: 'บันทึกผลตรวจสอบไม่สำเร็จ',
          successMessage: 'บันทึกการเช็คชื่อและมอบหมายโค้ชย้อนหลังสำเร็จ',
        })
        if (succeeded) setReviewSession(null)
        return
      }

      const response = await fetch('/api/admin/makeup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: reviewSession.id,
          action: reviewAction,
          attendance_status: reviewAction === 'mark_attendance' ? reviewAttendanceStatus : undefined,
          reason,
          coach_id: needsRetroCoach ? reviewCoachId : undefined,
        }),
      })

      const result = await response.json().catch(() => null)
      if (!response.ok) {
        setError(result?.error || 'บันทึกผลตรวจสอบไม่สำเร็จ')
        return
      }

      if (result?.warnings) toast.warning(result.warnings)
      setReviewSession(null)
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setReviewSubmitting(false)
    }
  }

  const openUnassignedRoundDialog = (group: ReviewSessionGroup) => {
    setUnassignedGroup(group)
    setUnassignedMode('taught')
    setUnassignedCoachId('')
    setUnassignedReason('')
    setError(null)
  }

  const openCoachReplacementDialog = (group: ReviewSessionGroup) => {
    setReplacementGroup(group)
    setReplacementCoachId('')
    setReplacementReason('')
    setError(null)
  }

  const openMoveLearnerDialog = (group: ReviewSessionGroup) => {
    const targetSessions = group.sessions.filter(isReviewOrEvidenceSession)
    const firstMovableSession = targetSessions.find((session) => getSameSlotCoachGroups(session).length > 0)

    if (!firstMovableSession) {
      setError('ไม่พบกลุ่มโค้ชอื่นในรอบเดียวกันสำหรับย้ายผู้เรียน')
      return
    }

    setMoveGroup(group)
    setMoveSessionId(firstMovableSession.id)
    setMoveTargetGroupId('')
    setMoveReason('')
    setError(null)
  }

  const submitCoachReplacement = async () => {
    if (!replacementGroup) return

    const targetSessions = replacementGroup.sessions.filter(isReviewOrEvidenceSession)
    const reason = replacementReason.trim()

    if (targetSessions.length === 0) {
      setError('ไม่พบรายการผู้เรียนที่ต้องเปลี่ยนโค้ชในรอบนี้')
      return
    }

    if (!replacementCoachId) {
      setError('กรุณาเลือกโค้ชตัวจริงที่สอนรอบนี้')
      return
    }

    if (!reason) {
      setError('กรุณาระบุเหตุผลเพื่อเก็บ audit log ก่อนเปลี่ยนโค้ช')
      return
    }

    const sessionIds = targetSessions.map((session) => session.id)
    setReplacementSubmitting(true)
    const succeeded = await runRetrospectiveMutation({
      operation: 'replace_coach_for_past_round',
      targetIdentity: `replace:${replacementGroup.key}`,
      targetSessionIds: sessionIds,
      body: { session_ids: sessionIds, coach_id: replacementCoachId, reason },
      intendedCoachId: replacementCoachId,
      failureMessage: 'เปลี่ยนโค้ชย้อนหลังไม่สำเร็จ',
      successMessage: 'เปลี่ยนโค้ชย้อนหลังสำเร็จ',
    })
    setReplacementSubmitting(false)
    if (succeeded) setReplacementGroup(null)
  }

  const submitMoveLearner = async () => {
    if (!moveGroup) return

    const targetSession = moveGroup.sessions.find((session) => session.id === moveSessionId) || null
    const targetGroups = targetSession ? getSameSlotCoachGroups(targetSession) : []
    const targetGroup = targetGroups.find((group) => group.groupId === moveTargetGroupId) || null
    const reason = moveReason.trim()

    if (!targetSession) {
      setError('กรุณาเลือกผู้เรียนที่ต้องการย้าย')
      return
    }

    if (!targetGroup) {
      setError('กรุณาเลือกกลุ่มโค้ชปลายทางในรอบเดียวกัน')
      return
    }

    if (!reason) {
      setError('กรุณาระบุเหตุผลเพื่อเก็บ audit log ก่อนย้ายผู้เรียน')
      return
    }

    setMoveSubmitting(true)
    const succeeded = await runRetrospectiveMutation({
      operation: 'move_learner_to_existing_coach_group',
      targetIdentity: `move:${moveGroup.key}:${targetSession.id}`,
      targetSessionIds: [targetSession.id],
      body: {
        session_ids: [targetSession.id],
        target_group_id: targetGroup.groupId,
        coach_id: targetGroup.coachId,
        reason,
      },
      intendedCoachId: targetGroup.coachId,
      failureMessage: 'ย้ายผู้เรียนเข้ากลุ่มโค้ชไม่สำเร็จ',
      successMessage: 'ย้ายผู้เรียนเข้ากลุ่มโค้ชสำเร็จ',
    })
    setMoveSubmitting(false)
    if (succeeded) setMoveGroup(null)
  }

  const openRoundAttendanceDialog = (group: ReviewSessionGroup) => {
    if (isUnassignedAttendanceRound(group)) {
      setError('รอบนี้ยังไม่มีโค้ชในกลุ่ม กรุณาใช้ปุ่มจัดการเคสทั้งรอบเท่านั้น')
      return
    }

    const attendanceMap: Record<string, AttendanceStatus | ''> = {}
    group.sessions
      .filter(isAttendanceReviewSession)
      .forEach((session) => {
        attendanceMap[session.id] = ''
      })

    setRoundAttendanceGroup(group)
    setRoundAttendanceReason('')
    setRoundAttendance(attendanceMap)
    setError(null)
  }

  const submitRoundAttendance = async () => {
    if (!roundAttendanceGroup) return

    if (isUnassignedAttendanceRound(roundAttendanceGroup)) {
      setError('รอบนี้ยังไม่มีโค้ชในกลุ่ม กรุณาใช้ flow จัดการเคสทั้งรอบเดิม')
      return
    }

    const targetSessions = roundAttendanceGroup.sessions.filter(isAttendanceReviewSession)
    const reason = roundAttendanceReason.trim()

    if (targetSessions.length === 0) {
      setError('ไม่พบรายการผู้เรียนที่ต้องบันทึกย้อนหลังในรอบนี้')
      return
    }

    if (!reason) {
      setError('กรุณาระบุเหตุผลเพื่อเก็บ audit log ก่อนบันทึกทั้งรอบ')
      return
    }

    const missingSessions = targetSessions.filter((session) => !roundAttendance[session.id])
    if (missingSessions.length > 0) {
      setError('กรุณาเลือกสถานะเช็คชื่อให้ครบทุกคนในรอบนี้')
      return
    }

    setRoundAttendanceSubmitting(true)
    setError(null)

    try {
      for (const session of targetSessions) {
        const attendanceStatus = roundAttendance[session.id]
        if (!attendanceStatus) {
          setError('กรุณาเลือกสถานะเช็คชื่อให้ครบทุกคนในรอบนี้')
          return
        }

        const response = await fetch('/api/admin/makeup', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: session.id,
            action: 'mark_attendance',
            attendance_status: attendanceStatus,
            reason: `บันทึกย้อนหลังทั้งรอบ ${formatDate(roundAttendanceGroup.date)} ${formatTime(roundAttendanceGroup.startTime, roundAttendanceGroup.endTime)}: ${reason}`,
          }),
        })

        const result = await response.json().catch(() => null)
        if (!response.ok) {
          setError(result?.error || 'บันทึกย้อนหลังทั้งรอบไม่สำเร็จ')
          return
        }
      }

      setRoundAttendanceGroup(null)
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setRoundAttendanceSubmitting(false)
    }
  }

  const submitUnassignedRoundResolution = async () => {
    if (!unassignedGroup) return

    const targetSessions = unassignedGroup.sessions.filter(isAttendanceReviewSession)
    const reason = unassignedReason.trim()

    if (targetSessions.length === 0) {
      setError('ไม่พบรายการผู้เรียนที่ต้องตรวจสอบในรอบนี้')
      return
    }

    if (!reason) {
      setError('กรุณาระบุเหตุผลเพื่อเก็บ audit log ก่อนบันทึกทั้งรอบ')
      return
    }

    if (unassignedMode === 'taught' && !unassignedCoachId) {
      setError('กรุณาเลือกโค้ชที่จะรับผิดชอบรอบนี้ก่อนมอบหมาย')
      return
    }

    if (unassignedMode === 'taught') {
      const existingCoachGroup = targetSessions
        .flatMap((session) => getSameSlotCoachGroups(session))
        .find((group) => group.coachId === unassignedCoachId)

      if (existingCoachGroup) {
        setError('โค้ชคนนี้มีกลุ่มอยู่แล้วในรอบเดียวกัน กรุณาใช้ "ย้ายเข้ากลุ่มโค้ชในรอบเดียวกัน" แทน')
        return
      }
    }

    setUnassignedSubmitting(true)
    setError(null)

    try {
      if (unassignedMode === 'taught') {
        const sessionIds = targetSessions.map((session) => session.id)
        const succeeded = await runRetrospectiveMutation({
          operation: 'assign_coach_to_round',
          targetIdentity: `assign:${unassignedGroup.key}`,
          targetSessionIds: sessionIds,
          body: { session_ids: sessionIds, coach_id: unassignedCoachId, reason },
          intendedCoachId: unassignedCoachId,
          failureMessage: 'มอบหมายโค้ชให้รอบนี้ไม่สำเร็จ',
          successMessage: 'มอบหมายโค้ชให้รอบเรียนย้อนหลังสำเร็จ',
        })
        if (!succeeded) return
        setUnassignedGroup(null)
        return
      } else {
        const action = unassignedMode === 'return_entitlement' ? 'return_entitlement' : 'close_review'

        for (const session of targetSessions) {
          const response = await fetch('/api/admin/makeup', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: session.id,
              action,
              reason,
            }),
          })

          const result = await response.json().catch(() => null)
          if (!response.ok) {
            setError(result?.error || 'บันทึกผลทั้งรอบไม่สำเร็จ')
            return
          }
        }
      }

      setUnassignedGroup(null)
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setUnassignedSubmitting(false)
    }
  }

  const roundAttendanceTargetSessions = roundAttendanceGroup?.sessions.filter(isAttendanceReviewSession) || []
  const roundAttendanceComplete = roundAttendanceTargetSessions.length > 0 &&
    roundAttendanceTargetSessions.every((session) => Boolean(roundAttendance[session.id]))
  const unassignedTargetSessions = unassignedGroup?.sessions.filter(isAttendanceReviewSession) || []
  const unassignedSaveDisabled = unassignedSubmitting ||
    isTargetBusy(unassignedTargetSessions.map((session) => session.id)) ||
    !unassignedReason.trim() ||
    (unassignedMode === 'taught' && !unassignedCoachId)
  const replacementTargetSessions = replacementGroup?.sessions.filter(isReviewOrEvidenceSession) || []
  const replacementSaveDisabled = replacementSubmitting ||
    isTargetBusy(replacementTargetSessions.map((session) => session.id)) ||
    !replacementCoachId ||
    !replacementReason.trim() ||
    replacementTargetSessions.length === 0
  const moveCandidateSessions = moveGroup?.sessions.filter(isReviewOrEvidenceSession) || []
  const selectedMoveSession = moveCandidateSessions.find((session) => session.id === moveSessionId) || null
  const moveTargetGroups = selectedMoveSession ? getSameSlotCoachGroups(selectedMoveSession) : []
  const selectedMoveTargetGroup = moveTargetGroups.find((group) => group.groupId === moveTargetGroupId) || null
  const moveSaveDisabled = moveSubmitting ||
    (selectedMoveSession ? isTargetBusy([selectedMoveSession.id]) : false) ||
    !selectedMoveSession ||
    !selectedMoveTargetGroup ||
    !moveReason.trim()
  const reviewTargetBusy = reviewSession ? isTargetBusy([reviewSession.id]) : false

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#2748bf]">
            <CalendarPlus className="h-4 w-4" />
            Makeup Sessions
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">วันชดเชย</h1>
          <p className="mt-1 text-sm text-gray-500">สรุปสิทธิ์ชดเชยรายผู้เรียนและรายเดือน โดย 1 เดือนชดเชยได้สูงสุด 1 ครั้ง</p>
        </div>
        <Badge variant="outline" className="w-fit border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
          ขาดหลายครั้งในเดือนเดียวกัน ชดเชยได้ 1 ครั้ง
        </Badge>
      </div>

      {(pendingSessionIds.size > 0 || reconcilingSessionIds.size > 0) && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
        >
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <div>
            <p className="font-semibold">
              {pendingSessionIds.size > 0 ? 'กำลังบันทึกข้อมูล กรุณารอสักครู่' : 'บันทึกสำเร็จ กำลังยืนยันข้อมูลกับระบบ'}
            </p>
            <p className="mt-0.5 text-xs text-blue-700">ระบบปิดการทำรายการซ้ำสำหรับรอบนี้ไว้จนกว่าจะยืนยันข้อมูลเรียบร้อย</p>
          </div>
        </div>
      )}

      {completionMessage && (
        <div role="status" aria-live="polite" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {completionMessage}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-6">
        <Card className={stats.review > 0 ? 'border-orange-300 bg-orange-50/40' : 'border-gray-200'}>
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">ต้องตรวจสอบ</p>
              <p className="mt-1 text-xl font-bold text-orange-600 sm:text-2xl">{stats.review}</p>
            </div>
            <AlertCircle className="h-5 w-5 text-orange-500" />
          </CardContent>
        </Card>
        <Card className={stats.reviewNoCoach > 0 ? 'border-red-300 bg-red-50/40' : 'border-gray-200'}>
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">ไม่มีโค้ช</p>
              <p className="mt-1 text-xl font-bold text-red-600 sm:text-2xl">{stats.reviewNoCoach}</p>
            </div>
            <AlertCircle className="h-5 w-5 text-red-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">ขาดหลักฐานโค้ช</p>
              <p className="mt-1 text-xl font-bold text-amber-600 sm:text-2xl">{stats.reviewCoachEvidence}</p>
            </div>
            <Clock className="h-5 w-5 text-amber-500" />
          </CardContent>
        </Card>
        <Card className={stats.actionable > 0 ? 'border-red-300 bg-red-50/40' : 'border-gray-200'}>
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">ยังชดเชยได้</p>
              <p className="mt-1 text-xl font-bold text-red-600 sm:text-2xl">{stats.actionable}</p>
            </div>
            <Calendar className="h-5 w-5 text-red-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">ชดเชยแล้ว</p>
              <p className="mt-1 text-xl font-bold text-emerald-600 sm:text-2xl">{stats.makeups}</p>
            </div>
            <CalendarCheck className="h-5 w-5 text-emerald-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200 max-xl:col-span-2">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">ผู้เรียน</p>
              <p className="mt-1 text-xl font-bold text-orange-500 sm:text-2xl">{stats.learners}</p>
            </div>
            <Users className="h-5 w-5 text-orange-500" />
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MakeupTab)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:w-[520px]">
          <TabsTrigger value="review">ต้องตรวจสอบ ({stats.review})</TabsTrigger>
          <TabsTrigger value="makeup">เลือกวันชดเชย ({stats.total})</TabsTrigger>
        </TabsList>

        {error && !dialogOpen && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <TabsContent value="review" className="space-y-4">
          <Card className="border-gray-200">
            <CardContent className="grid gap-3 p-4 2xl:grid-cols-[minmax(260px,1fr)_220px_220px_220px_auto] 2xl:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  className="pl-10"
                  placeholder="ค้นหานักเรียน, ผู้ปกครอง, โค้ช, สาขา..."
                  value={reviewSearch}
                  onChange={(event) => setReviewSearch(event.target.value)}
                />
              </div>
              <Select value={reviewBranch} onValueChange={setReviewBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="ทุกสาขา" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสาขา</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={reviewCourse} onValueChange={setReviewCourse}>
                <SelectTrigger>
                  <SelectValue placeholder="ทุกคอร์ส" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกคอร์ส</SelectItem>
                  {courseOptions.map((course) => (
                    <SelectItem key={course} value={course}>{course}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={reviewStatus} onValueChange={(value) => setReviewStatus(value as ReviewStatusFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="สถานะเคส" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="no_coach">ไม่มีโค้ช</SelectItem>
                  <SelectItem value="waiting_attendance">รอเช็คชื่อ</SelectItem>
                  <SelectItem value="coach_evidence">ขาดหลักฐานโค้ช</SelectItem>
                  <SelectItem value="coach_requested">ส่งให้โค้ชแล้ว</SelectItem>
                </SelectContent>
              </Select>
              <p className="whitespace-nowrap text-sm text-gray-500">
                แสดง {reviewSessionGroups.length} รอบ / {reviewSessions.length} รายการ
              </p>
            </CardContent>
          </Card>

          {reviewSessions.length > 0 ? (
            <Card className="border-orange-200 bg-orange-50/30">
          <CardContent className="p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-orange-700">
                  <AlertCircle className="h-4 w-4" />
                  ต้องตรวจสอบการเช็คชื่อก่อนสรุปขาดเรียน
                </div>
                <p className="mt-1 text-sm text-orange-700/80">
                  รอบเหล่านี้เลยเวลาเรียนแล้ว อาจยังไม่มี attendance หรือบันทึก attendance แล้วแต่ยังขาดหลักฐาน selfie/GPS ของโค้ช จึงต้องตรวจสอบก่อนสรุปสิทธิ์ชดเชย
                </p>
              </div>
              <Badge variant="outline" className="w-fit border-orange-200 bg-white text-orange-700">
                {reviewSessionGroups.length} รอบ / {reviewSessions.length} รายการ
              </Badge>
            </div>
            <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
              {reviewSessionGroups.map((group) => {
                const isTargetGroup = group.sessions.some(isReviewTargetSession)
                const groupNeedsAttendanceReview = group.sessions.some(isAttendanceReviewSession)
                const groupNeedsCoachEvidence = group.sessions.some(isCoachEvidenceReviewSession)
                const canRequestCoachEvidenceOnly = groupNeedsCoachEvidence && !groupNeedsAttendanceReview
                const groupLoadingKey = canRequestCoachEvidenceOnly ? `${group.key}:evidence` : group.key
                const isUnassignedRound = isUnassignedAttendanceRound(group)
                const canMoveLearnerToExistingGroup = group.sessions
                  .filter(isReviewOrEvidenceSession)
                  .some((session) => getSameSlotCoachGroups(session).length > 0)
                const groupMutationBusy = isTargetBusy(group.sessions.map((session) => session.id))

                return (
                  <div
                    key={group.key}
                    className={`overflow-hidden rounded-xl border bg-white shadow-sm ${
                      isTargetGroup ? 'border-orange-300 ring-2 ring-orange-200' : 'border-orange-100'
                    }`}
                  >
                  <div className="flex flex-col gap-3 border-b border-orange-100 bg-orange-50/50 p-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-orange-200 bg-white text-orange-700">รอบสอน</Badge>
                        <span className="font-semibold text-[#153c85]">
                          {formatDate(group.date)} {formatTime(group.startTime, group.endTime)}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            canRequestCoachEvidenceOnly
                              ? 'bg-amber-50 text-amber-700'
                              : group.coachCheckinTime
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-red-50 text-red-700'
                          }
                        >
                          {canRequestCoachEvidenceOnly
                            ? 'บันทึก attendance แล้ว / ขาดหลักฐานโค้ช'
                            : group.coachCheckinTime
                              ? 'โค้ชเช็คอินแล้ว'
                              : 'ยังไม่มีเช็คอินโค้ช'}
                        </Badge>
                        {group.coachReviewRequestCount > 0 && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            ส่งให้โค้ชแล้ว {group.coachReviewRequestCount} ครั้ง
                          </Badge>
                        )}
                        {group.coachEvidenceRequestCount > 0 && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700">
                            ขอหลักฐานแล้ว {group.coachEvidenceRequestCount} ครั้ง
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{group.branchName}</span>
                        <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{group.courseType}</span>
                        <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" />{group.coachName || 'ยังไม่พบโค้ชในกลุ่ม'}</span>
                        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{group.sessions.length} คน</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        กลุ่ม: {group.groupNames.length ? group.groupNames.join(', ') : '-'}
                      </p>
                      <p className="text-xs text-gray-500">
                        เช็คอิน: {formatDateTime(group.coachCheckinTime) || '-'}
                        {group.coachCheckinTime ? ` · ${group.coachCheckinHasLocation ? 'มีรูปและ GPS' : 'มีรูปแต่ไม่มี GPS'}` : ''}
                      </p>
                      {isUnassignedRound && canMoveLearnerToExistingGroup && (
                        <p className="text-xs font-medium text-cyan-700">
                          รอบนี้มีกลุ่มโค้ชอยู่แล้ว เลือกย้ายเข้ากลุ่มเดิมเมื่อผู้เรียนหลุดจากกลุ่มเดิม หรือมอบหมายโค้ชใหม่เมื่อควรแยกอีกกลุ่ม
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      {isUnassignedRound ? (
                        <>
                          {canMoveLearnerToExistingGroup && (
                            <div className="max-w-64 space-y-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9 border-cyan-200 bg-white text-cyan-700 hover:bg-cyan-50"
                                disabled={moveSubmitting || groupMutationBusy}
                                onClick={() => openMoveLearnerDialog(group)}
                              >
                                ย้ายเข้ากลุ่มโค้ชในรอบเดียวกัน
                              </Button>
                              <p className="text-xs text-cyan-700">
                                ใช้เมื่อผู้เรียนควรอยู่ในกลุ่มโค้ชที่มีอยู่แล้ว
                              </p>
                            </div>
                          )}
                          <div className="max-w-64 space-y-1">
                            <Button
                              size="sm"
                              className="h-9 bg-[#2748bf] text-white hover:bg-[#153c85]"
                              disabled={groupMutationBusy}
                              onClick={() => openUnassignedRoundDialog(group)}
                            >
                              มอบหมายโค้ชใหม่
                            </Button>
                            {canMoveLearnerToExistingGroup && (
                              <>
                                <p className="text-xs text-gray-600">
                                  ใช้เมื่อผู้เรียนควรแยกไปอีกโค้ช
                                </p>
                                <p className="text-xs font-medium text-red-600">
                                  ห้ามเลือกโค้ชที่มีกลุ่มอยู่แล้วในรอบนี้
                                </p>
                              </>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 border-amber-200 bg-white text-amber-700 hover:bg-amber-50"
                            disabled={reviewGroupLoadingKey === groupLoadingKey || !group.coachName || groupMutationBusy}
                            onClick={() => void (canRequestCoachEvidenceOnly ? requestCoachEvidenceForGroup(group) : sendReviewGroupToCoach(group))}
                            title={!group.coachName ? 'ยังไม่มีโค้ชให้ส่งกลับตรวจสอบ' : undefined}
                          >
                            {reviewGroupLoadingKey === groupLoadingKey
                              ? 'กำลังส่ง...'
                              : canRequestCoachEvidenceOnly
                                ? `ขอหลักฐานโค้ชรอบนี้${group.coachEvidenceRequestCount ? ` (${group.coachEvidenceRequestCount})` : ''}`
                                : `ส่งให้โค้ชตรวจสอบรอบนี้${group.coachReviewRequestCount ? ` (${group.coachReviewRequestCount})` : ''}`}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 border-violet-200 bg-white text-violet-700 hover:bg-violet-50"
                            disabled={replacementSubmitting || groupMutationBusy}
                            onClick={() => openCoachReplacementDialog(group)}
                          >
                            เปลี่ยนโค้ชย้อนหลัง
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 border-cyan-200 bg-white text-cyan-700 hover:bg-cyan-50"
                            disabled={!canMoveLearnerToExistingGroup || moveSubmitting || groupMutationBusy}
                            onClick={() => openMoveLearnerDialog(group)}
                            title={!canMoveLearnerToExistingGroup ? 'ไม่พบกลุ่มโค้ชอื่นในรอบเดียวกัน' : undefined}
                          >
                            ย้ายเข้ากลุ่มโค้ชในรอบเดียวกัน
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
                            disabled={!groupNeedsAttendanceReview || groupMutationBusy}
                            onClick={() => openRoundAttendanceDialog(group)}
                            title={!groupNeedsAttendanceReview ? 'รอบนี้ไม่มีรายการที่ต้องบันทึก attendance ย้อนหลังแล้ว' : undefined}
                          >
                            บันทึกย้อนหลังทั้งรอบ
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                            disabled={reviewGroupLoadingKey === `${group.key}:close` || groupMutationBusy}
                            onClick={() => void closeReviewGroup(group)}
                          >
                            {reviewGroupLoadingKey === `${group.key}:close` ? 'กำลังปิดเคส...' : 'ปิดเคสทั้งรอบ'}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {group.sessions.map((session) => (
                      <div key={session.id} className="grid gap-3 p-3 text-sm xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-gray-950">{session.learner_name}</span>
                            {isCoachEvidenceReviewSession(session) ? (
                              <>
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700">บันทึก attendance แล้ว</Badge>
                                <Badge variant="outline" className="bg-amber-50 text-amber-700">ยังไม่มีหลักฐานโค้ช</Badge>
                              </>
                            ) : (
                              <Badge variant="outline" className="bg-orange-50 text-orange-700">รอตรวจสอบ</Badge>
                            )}
                            {session.group_name && (
                              <Badge variant="outline" className="bg-gray-50 text-gray-600">{session.group_name}</Badge>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                            <span>ผู้ปกครอง/ผู้ใช้: {session.user_name}</span>
                            <span>{session.branch_name}</span>
                            <span>{session.course_type || 'คอร์สเรียน'}</span>
                          </div>
                        </div>
                        {isUnassignedRound ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            รอบนี้ยังไม่มีโค้ชในกลุ่ม ให้จัดการจากปุ่มทั้งรอบด้านบนเท่านั้น เพื่อไม่ให้ผลรายคนหลุดจากรอบเดียวกัน
                          </div>
                        ) : (
                          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                            {isCoachEvidenceReviewSession(session)
                              ? 'บันทึก attendance แล้ว แต่ยังต้องติดตามหลักฐานโค้ชจากปุ่มระดับรอบด้านบน'
                              : 'ให้บันทึกหรือส่งตรวจสอบจากปุ่มระดับรอบด้านบนเท่านั้น เพื่อให้ผลทั้งรอบไปทางเดียวกัน'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  </div>
                )
              })}
            </div>
            <div className="hidden">
              {reviewSessions.slice(0, 30).map((session) => (
                <div key={session.id} className="grid gap-3 rounded-lg border border-orange-100 bg-white p-3 text-sm xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-950">{session.learner_name}</span>
                      <Badge variant="outline" className="bg-orange-50 text-orange-700">รอตรวจสอบ</Badge>
                      <Badge
                        variant="outline"
                        className={session.coach_checkin_time ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}
                      >
                        {session.coach_checkin_time ? 'โค้ชเช็คอินแล้ว' : 'ไม่พบเช็คอินโค้ช'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {session.user_name} · {session.branch_name} · {session.course_type || 'คอร์สเรียน'}
                    </p>
                    <div className="mt-2 grid gap-1 text-xs text-gray-500 sm:grid-cols-2">
                      <p>กลุ่ม: <span className="font-medium text-gray-700">{session.group_name || '-'}</span></p>
                      <p>โค้ช: <span className="font-medium text-gray-700">{session.coach_name || 'ยังไม่พบโค้ชในกลุ่ม'}</span></p>
                      <p>เช็คอิน: <span className="font-medium text-gray-700">{formatDateTime(session.coach_checkin_time) || '-'}</span></p>
                      <p>ตำแหน่ง/รูป: <span className="font-medium text-gray-700">{session.coach_checkin_time ? (session.coach_checkin_has_location ? 'มีหลักฐานครบ' : 'มีรูป แต่ไม่มีตำแหน่ง') : '-'}</span></p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 xl:items-end">
                    <div className="text-sm font-medium text-gray-800">
                      {formatDate(session.date)} {formatTime(session.start_time, session.end_time)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
                        disabled={reviewSubmitting && reviewSession?.id === session.id}
                        onClick={() => openReviewDialog(session, 'mark_attendance')}
                      >
                        บันทึกย้อนหลัง
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-orange-200 bg-white text-orange-700 hover:bg-orange-50"
                        disabled={reviewSubmitting && reviewSession?.id === session.id}
                        onClick={() => openReviewDialog(session, 'confirm_absent')}
                      >
                        {reviewSubmitting && reviewSession?.id === session.id ? 'กำลังยืนยัน...' : 'ยืนยันขาด'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-amber-200 bg-white text-amber-700 hover:bg-amber-50"
                        disabled={(reviewSubmitting && reviewSession?.id === session.id) || !session.coach_name}
                        onClick={() => openReviewDialog(session, 'request_coach_review')}
                        title={!session.coach_name ? 'ยังไม่มีโค้ชให้ส่งกลับตรวจสอบ' : undefined}
                      >
                        ส่งให้โค้ช
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        disabled={reviewSubmitting && reviewSession?.id === session.id}
                        onClick={() => openReviewDialog(session, 'close_review')}
                      >
                        ปิดเคส
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-violet-200 bg-white text-violet-700 hover:bg-violet-50"
                        disabled={reviewSubmitting && reviewSession?.id === session.id}
                        onClick={() => openReviewDialog(session, 'return_entitlement')}
                      >
                        คืนสิทธิ์
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-14 text-center text-gray-400">
                <AlertCircle className="mx-auto mb-3 h-12 w-12 opacity-40" />
                <p className="font-medium">ไม่พบเคสต้องตรวจสอบตามเงื่อนไขที่เลือก</p>
                <p className="mt-1 text-sm">ลองเปลี่ยนตัวกรองหรือคำค้นหา</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="makeup" className="space-y-4">
          <Card className="border-gray-200">
            <CardContent className="grid gap-3 p-4 2xl:grid-cols-[minmax(260px,1fr)_220px_220px_220px_auto] 2xl:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  className="pl-10"
                  placeholder="ค้นหานักเรียน, ผู้ปกครอง, สาขา, เดือน..."
                  value={makeupSearch}
                  onChange={(event) => {
                    setMakeupSearch(event.target.value)
                    setPage(1)
                  }}
                />
              </div>
              <Select
                value={makeupBranch}
                onValueChange={(value) => {
                  setMakeupBranch(value)
                  setPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="ทุกสาขา" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสาขา</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={makeupCourse}
                onValueChange={(value) => {
                  setMakeupCourse(value)
                  setPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="ทุกคอร์ส" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกคอร์ส</SelectItem>
                  {courseOptions.map((course) => (
                    <SelectItem key={course} value={course}>{course}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={makeupStatus}
                onValueChange={(value) => {
                  setMakeupStatus(value as MakeupStatusFilter)
                  setPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="สถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="actionable">ยังชดเชยได้</SelectItem>
                  <SelectItem value="makeup">ชดเชยแล้ว</SelectItem>
                  <SelectItem value="expired">หมดเขต</SelectItem>
                </SelectContent>
              </Select>
              <p className="whitespace-nowrap text-sm text-gray-500">
                แสดง {filteredMonthGroups.length} เดือน จาก {monthGroups.length} เดือน
              </p>
            </CardContent>
          </Card>

      {learnerGroups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center text-gray-400">
            <Calendar className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ไม่พบข้อมูลตามเงื่อนไขที่เลือก</p>
            <p className="mt-1 text-sm">ลองเปลี่ยนตัวกรองหรือคำค้นหา</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pagedLearnerGroups.map((group) => (
            <Card key={group.key} className="border-gray-200">
              <CardContent className="p-4">
                <div className="flex flex-col gap-2 border-b pb-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#153c85]">{group.learnerName}</p>
                      <Badge variant="outline" className="text-xs">{group.months.length} เดือน</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {group.userName}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {group.branches.join(', ')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                  {group.months.map((month) => (
                    <div key={month.key} className={`rounded-lg border p-3 ${month.canCreate ? 'border-orange-200 bg-orange-50/40' : month.hasMakeup ? 'border-emerald-200 bg-emerald-50/40' : 'border-gray-200 bg-gray-50/70'}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-gray-950">{month.monthLabel}</p>
                            {month.canCreate && <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">ยังชดเชยได้</Badge>}
                            {month.hasMakeup && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">ชดเชยแล้ว</Badge>}
                            {month.isExpired && !month.hasMakeup && <Badge variant="outline" className="border-gray-200 bg-white text-gray-500">หมดเขต</Badge>}
                          </div>
                          <p className="mt-2 text-sm text-gray-600">
                            ขาด/เลยวันเรียน {month.sessions.length} ครั้ง
                            {month.absentCount > 0 && ` • ขาด ${month.absentCount}`}
                            {month.overdueCount > 0 && ` • เลยวัน ${month.overdueCount}`}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {month.sessions.map((session) => (
                              <Badge key={session.id} variant="outline" className="bg-white text-xs">
                                {formatDate(session.date)} {formatTime(session.start_time, session.end_time)}
                              </Badge>
                            ))}
                          </div>
                          <p className="mt-2 text-xs text-gray-500">
                            ชดเชยได้ใน {month.nextMonthLabel} • หมดเขต {month.deadlineLabel}
                          </p>
                        </div>
                        <div className="sm:shrink-0">
                          {month.canCreate ? (
                            <Button size="sm" className="h-9 bg-[#f57e3b] text-white hover:bg-[#e06d2e]" onClick={() => openMakeupDialog(month)}>
                              <CalendarPlus className="mr-2 h-4 w-4" />
                              เลือกรอบชดเชย
                            </Button>
                          ) : month.hasMakeup ? (
                            <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
                              <CheckCircle2 className="h-4 w-4" />
                              ใช้สิทธิ์แล้ว
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2 text-sm font-medium text-gray-500">
                              <XCircle className="h-4 w-4" />
                              เลยกำหนด
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          <ListPagination
            page={safePage}
            pageSize={pageSize}
            total={learnerGroups.length}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(value)
              setPage(1)
            }}
          />
        </div>
      )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={Boolean(replacementGroup)}
        onOpenChange={(open) => {
          if (!open && !replacementSubmitting) setReplacementGroup(null)
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">เปลี่ยนโค้ชย้อนหลัง</DialogTitle>
            <DialogDescription>
              ใช้เมื่อรอบเรียนเกิดขึ้นแล้วแต่โค้ชที่สอนจริงไม่ตรงกับคนที่ถูกมอบหมาย ระบบจะเปลี่ยนผู้รับผิดชอบและขอหลักฐานจากโค้ชตัวจริง โดยยังไม่บันทึก attendance และไม่ลบหลักฐานเดิม
            </DialogDescription>
          </DialogHeader>
          {replacementGroup && (
            <div className="space-y-4">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
                <p className="font-semibold">
                  {formatDate(replacementGroup.date)} {formatTime(replacementGroup.startTime, replacementGroup.endTime)}
                </p>
                <p className="mt-1 text-xs">
                  {replacementGroup.branchName} · {replacementGroup.courseType || 'คอร์สเรียน'} · {replacementTargetSessions.length} คน · โค้ชเดิม: {replacementGroup.coachName || '-'}
                </p>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                การเปลี่ยนนี้จะย้ายผู้รับผิดชอบของ learner group ไปที่โค้ชตัวจริง และส่งให้โค้ชคนนั้นเช็กอินย้อนหลังด้วย selfie/GPS ก่อนนับหลักฐานครบหรือใช้ตรวจ payroll
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-900">โค้ชตัวจริงที่สอนรอบนี้</label>
                <Select value={replacementCoachId} onValueChange={setReplacementCoachId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="เลือกโค้ชตัวจริง" />
                  </SelectTrigger>
                  <SelectContent>
                    {coaches.map((coach) => (
                      <SelectItem key={coach.id} value={coach.id}>
                        {coach.name} {coach.role === 'head_coach' ? '(หัวหน้าโค้ช)' : '(โค้ช)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border border-gray-200">
                <div className="border-b border-gray-100 px-3 py-2 text-sm font-semibold text-gray-900">
                  รายชื่อผู้เรียนในรอบนี้
                </div>
                <div className="max-h-72 divide-y divide-gray-100 overflow-y-auto">
                  {replacementTargetSessions.map((session) => (
                    <div key={session.id} className="px-3 py-3">
                      <p className="font-semibold text-gray-950">{session.learner_name}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        ผู้ปกครอง/ผู้ใช้: {session.user_name} · กลุ่ม: {session.group_name || '-'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-900">เหตุผล / หลักฐานประกอบ</label>
                <Textarea
                  className="mt-2 min-h-24"
                  value={replacementReason}
                  onChange={(event) => setReplacementReason(event.target.value)}
                  placeholder="เช่น โค้ชที่ถูกมอบหมายลาป่วยกะทันหัน และโค้ชคนนี้เป็นผู้สอนจริงในรอบดังกล่าว"
                />
                <p className="mt-1 text-xs text-gray-500">จำเป็นสำหรับ audit log และใช้ตามรอยย้อนหลังเมื่อตรวจหลักฐานโค้ช/payroll</p>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={replacementSubmitting}
                  onClick={() => setReplacementGroup(null)}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  className="bg-[#2748bf] hover:bg-[#153c85]"
                  disabled={replacementSaveDisabled}
                  onClick={submitCoachReplacement}
                >
                  {replacementSubmitting ? 'กำลังบันทึก...' : 'เปลี่ยนโค้ชและขอหลักฐาน'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(moveGroup)}
        onOpenChange={(open) => {
          if (!open && !moveSubmitting) {
            setMoveGroup(null)
            setMoveSessionId('')
            setMoveTargetGroupId('')
            setMoveReason('')
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">ย้ายเข้ากลุ่มโค้ชในรอบเดียวกัน</DialogTitle>
            <DialogDescription>
              ใช้กับกรณีผู้เรียนตกหล่นหรือลงเรียนทีหลัง และต้องย้ายเข้า coach group เดิมของโค้ชที่สอนจริงใน schedule slot เดียวกันเท่านั้น
            </DialogDescription>
          </DialogHeader>
          {moveGroup && (
            <div className="space-y-4">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900">
                <p className="font-semibold">
                  {formatDate(moveGroup.date)} {formatTime(moveGroup.startTime, moveGroup.endTime)}
                </p>
                <p className="mt-1 text-xs">
                  {moveGroup.branchName} · {moveGroup.courseType || 'คอร์สเรียน'} · กลุ่มเดิม: {moveGroup.groupNames.length ? moveGroup.groupNames.join(', ') : '-'} · โค้ชเดิม: {moveGroup.coachName || '-'}
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-900">ผู้เรียนที่จะย้าย</label>
                <Select
                  value={moveSessionId}
                  onValueChange={(value) => {
                    setMoveSessionId(value)
                    setMoveTargetGroupId('')
                    setError(null)
                  }}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="เลือกผู้เรียน" />
                  </SelectTrigger>
                  <SelectContent>
                    {moveCandidateSessions.map((session) => {
                      const sameSlotGroupCount = getSameSlotCoachGroups(session).length
                      return (
                        <SelectItem key={session.id} value={session.id}>
                          {session.learner_name} · กลุ่มเดิม: {session.group_name || '-'} · target {sameSlotGroupCount} กลุ่ม
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {selectedMoveSession && (
                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                  <p className="font-semibold text-gray-950">{selectedMoveSession.learner_name}</p>
                  <p className="mt-1 text-xs">
                    กลุ่มเดิม: {selectedMoveSession.group_name || '-'} · โค้ชเดิม: {selectedMoveSession.coach_name || '-'} · session id: {selectedMoveSession.id}
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-semibold text-gray-900">กลุ่มโค้ชปลายทางในรอบเดียวกัน</label>
                <Select
                  value={moveTargetGroupId}
                  onValueChange={(value) => {
                    setMoveTargetGroupId(value)
                    setError(null)
                  }}
                  disabled={!selectedMoveSession || moveTargetGroups.length === 0}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder={moveTargetGroups.length ? 'เลือกกลุ่มโค้ชปลายทาง' : 'ไม่พบกลุ่มโค้ชอื่นในรอบเดียวกัน'} />
                  </SelectTrigger>
                  <SelectContent>
                    {moveTargetGroups.map((group) => (
                      <SelectItem key={group.groupId} value={group.groupId}>
                        {group.coachName} · {group.groupName} · {group.sessionCount} คน
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedMoveTargetGroup && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  ปลายทาง: {selectedMoveTargetGroup.groupName} · โค้ช {selectedMoveTargetGroup.coachName} · group id: {selectedMoveTargetGroup.groupId}
                </div>
              )}

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Action นี้ย้ายเฉพาะ membership ของผู้เรียนเข้า existing coach group ในรอบเดียวกัน ไม่บันทึก attendance, ไม่เปลี่ยนสถานะรอบเรียน, ไม่ลบหลักฐาน/check-in เดิม และไม่ลบกลุ่มเดิมแม้กลุ่มเดิมจะว่าง
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-900">เหตุผล / หลักฐานประกอบ</label>
                <Textarea
                  className="mt-2 min-h-24"
                  value={moveReason}
                  onChange={(event) => setMoveReason(event.target.value)}
                  placeholder="เช่น ผู้เรียนลงเรียนทีหลังและเรียนกับโค้ชปลายทางจริงในรอบนี้"
                />
                <p className="mt-1 text-xs text-gray-500">จำเป็นสำหรับ audit log และใช้ตามรอยย้อนหลังเมื่อดูหลักฐานโค้ช/payroll</p>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={moveSubmitting}
                  onClick={() => {
                    setMoveGroup(null)
                    setMoveSessionId('')
                    setMoveTargetGroupId('')
                    setMoveReason('')
                  }}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  className="bg-[#2748bf] hover:bg-[#153c85]"
                  disabled={moveSaveDisabled}
                  onClick={submitMoveLearner}
                >
                  {moveSubmitting ? 'กำลังย้าย...' : 'ย้ายผู้เรียนเข้ากลุ่ม'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(roundAttendanceGroup)}
        onOpenChange={(open) => {
          if (!open && !roundAttendanceSubmitting) setRoundAttendanceGroup(null)
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">บันทึกย้อนหลังทั้งรอบ</DialogTitle>
            <DialogDescription>
              เลือกสถานะผู้เรียนทุกคนในรอบนี้ให้ครบก่อนบันทึก ระบบจะเขียน attendance รายคน แต่ attendance ครบไม่ได้แปลว่าหลักฐานโค้ชครบจนกว่าจะมี selfie/GPS/check-in ครบตามเงื่อนไข
            </DialogDescription>
          </DialogHeader>
          {roundAttendanceGroup && (
            <div className="space-y-4">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <p className="font-semibold">
                  {formatDate(roundAttendanceGroup.date)} {formatTime(roundAttendanceGroup.startTime, roundAttendanceGroup.endTime)}
                </p>
                <p className="mt-1 text-xs">
                  {roundAttendanceGroup.branchName} · {roundAttendanceGroup.courseType || 'คอร์สเรียน'} · {roundAttendanceTargetSessions.length} คน · โค้ช: {roundAttendanceGroup.coachName || '-'}
                </p>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                การบันทึกนี้สรุปเฉพาะสถานะผู้เรียน เช่น มาเรียน / มาสาย / ขาดเรียน เท่านั้น หากหลักฐานโค้ชยังไม่ครบ ให้ใช้การติดตามหลักฐานโค้ชแยกต่างหาก
              </div>

              <div className="rounded-lg border border-gray-200">
                <div className="border-b border-gray-100 px-3 py-2 text-sm font-semibold text-gray-900">
                  ผลเช็คชื่อรายคน
                </div>
                <div className="max-h-72 divide-y divide-gray-100 overflow-y-auto">
                  {roundAttendanceTargetSessions.map((session) => (
                    <div key={session.id} className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-950">{session.learner_name}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          ผู้ปกครอง/ผู้ใช้: {session.user_name}
                        </p>
                      </div>
                      <Select
                        value={roundAttendance[session.id] || ''}
                        onValueChange={(value) => setRoundAttendance((current) => ({
                          ...current,
                          [session.id]: value as AttendanceStatus,
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกสถานะ" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">{getAttendanceStatusLabel('present')}</SelectItem>
                          <SelectItem value="late">{getAttendanceStatusLabel('late')}</SelectItem>
                          <SelectItem value="absent">{getAttendanceStatusLabel('absent')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-900">เหตุผล / หลักฐานประกอบ</label>
                <Textarea
                  className="mt-2 min-h-24"
                  value={roundAttendanceReason}
                  onChange={(event) => setRoundAttendanceReason(event.target.value)}
                  placeholder="เช่น โค้ชสอนจริงแต่ลืมบันทึก attendance / Admin ตรวจสอบย้อนหลังจากหลักฐานการสอน"
                />
                <p className="mt-1 text-xs text-gray-500">จำเป็นสำหรับ audit log ของทุกคนในรอบนี้</p>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={roundAttendanceSubmitting}
                  onClick={() => setRoundAttendanceGroup(null)}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  className="bg-[#2748bf] hover:bg-[#153c85]"
                  disabled={roundAttendanceSubmitting || !roundAttendanceReason.trim() || !roundAttendanceComplete}
                  onClick={submitRoundAttendance}
                >
                  {roundAttendanceSubmitting ? 'กำลังบันทึก...' : 'บันทึก attendance ทั้งรอบ'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(reviewSession)}
        onOpenChange={(open) => {
          if (!open && !reviewSubmitting && !reviewTargetBusy) setReviewSession(null)
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">ตรวจสอบการเช็คชื่อย้อนหลัง</DialogTitle>
            <DialogDescription>
              ใช้เมื่อรอบเรียนผ่านไปแล้วแต่ยังไม่มี attendance ของรอบนั้น เพื่อให้ Admin ปิดผลได้โดยไม่ทำให้สิทธิ์ชดเชยผิดพลาด
            </DialogDescription>
          </DialogHeader>
          {reviewSession && (
            <div className="space-y-4">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-gray-950">{reviewSession.learner_name}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatDate(reviewSession.date)} {formatTime(reviewSession.start_time, reviewSession.end_time)} · {reviewSession.branch_name} · {reviewSession.course_type || 'คอร์สเรียน'}
                    </p>
                  </div>
                  <Badge variant="outline" className="w-fit bg-white text-gray-700">
                    {getReviewActionLabel(reviewAction)}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-gray-500 sm:grid-cols-2">
                  <p>ผู้ปกครอง/ผู้ใช้: <span className="font-medium text-gray-700">{reviewSession.user_name}</span></p>
                  <p>กลุ่ม: <span className="font-medium text-gray-700">{reviewSession.group_name || '-'}</span></p>
                  <p>โค้ช: <span className="font-medium text-gray-700">{reviewSession.coach_name || 'ยังไม่พบโค้ชในกลุ่ม'}</span></p>
                  <p>เช็คอินโค้ช: <span className="font-medium text-gray-700">{formatDateTime(reviewSession.coach_checkin_time) || 'ไม่พบหลักฐาน'}</span></p>
                </div>
              </div>

              <div className="grid gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-900">ผลที่ต้องการบันทึก</label>
                  <Select value={reviewAction} onValueChange={(value) => setReviewAction(value as ReviewAction)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mark_attendance">บันทึกเช็คชื่อย้อนหลัง</SelectItem>
                      <SelectItem value="confirm_absent">ยืนยันขาดเรียน</SelectItem>
                      <SelectItem value="request_coach_review">ส่งกลับให้โค้ชตรวจสอบ</SelectItem>
                      <SelectItem value="close_review">ปิดเคสโดยไม่สร้างสิทธิ์ชดเชย</SelectItem>
                      <SelectItem value="return_entitlement">คืนสิทธิ์เข้ากระเป๋า</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {reviewAction === 'mark_attendance' && (
                  <div>
                    <label className="text-sm font-semibold text-gray-900">สถานะเช็คชื่อย้อนหลัง</label>
                    <Select value={reviewAttendanceStatus} onValueChange={(value) => setReviewAttendanceStatus(value as AttendanceStatus)}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="present">{getAttendanceStatusLabel('present')}</SelectItem>
                        <SelectItem value="late">{getAttendanceStatusLabel('late')}</SelectItem>
                        <SelectItem value="absent">{getAttendanceStatusLabel('absent')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {reviewAction === 'mark_attendance' && !reviewSession.coach_name && (
                  <div>
                    <label className="text-sm font-semibold text-gray-900">โค้ชที่สอนจริง</label>
                    <Select value={reviewCoachId} onValueChange={setReviewCoachId}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="เลือกโค้ชสำหรับบันทึกย้อนหลัง" />
                      </SelectTrigger>
                      <SelectContent>
                        {coaches.map((coach) => (
                          <SelectItem key={coach.id} value={coach.id}>
                            {coach.name} {coach.role === 'head_coach' ? '(หัวหน้าโค้ช)' : '(โค้ช)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-gray-500">ระบบจะสร้าง assignment ย้อนหลังแบบมี audit log เพื่อให้ตารางสอน/ชั่วโมงสอน/ประวัตินักเรียนตรงกัน</p>
                  </div>
                )}

                {(reviewAction !== 'confirm_absent' || !reviewSession.coach_name) && (
                  <div>
                    <label className="text-sm font-semibold text-gray-900">เหตุผล / หลักฐานประกอบ</label>
                    <Textarea
                      className="mt-2 min-h-24"
                      value={reviewReason}
                      onChange={(event) => setReviewReason(event.target.value)}
                      placeholder="เช่น ผู้เรียนมาเรียนจริงแต่โค้ชลืมเช็คชื่อ / ส่งกลับให้โค้ชแนบหลักฐานเพิ่ม / ปิดเคสเพราะเป็นรายการทดสอบ"
                    />
                    <p className="mt-1 text-xs text-gray-500">จำเป็นสำหรับ audit log และใช้ตามรอยย้อนหลัง</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={reviewSubmitting || reviewTargetBusy} onClick={() => setReviewSession(null)}>
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  className="bg-[#2748bf] hover:bg-[#153c85]"
                  disabled={reviewSubmitting || reviewTargetBusy}
                  onClick={submitReviewAction}
                >
                  {reviewSubmitting ? 'กำลังบันทึก...' : getReviewActionLabel(reviewAction)}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(unassignedGroup)}
        onOpenChange={(open) => {
          if (!open && !unassignedSubmitting) setUnassignedGroup(null)
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">จัดการรอบที่ยังไม่มีโค้ช</DialogTitle>
            <DialogDescription>
              ใช้เฉพาะรอบที่เลยเวลาเรียนแล้ว แต่ยังไม่มีโค้ชอยู่ในกลุ่ม หากสอนจริงให้มอบหมายโค้ชก่อน โดยยังไม่บันทึก attendance
            </DialogDescription>
          </DialogHeader>
          {unassignedGroup && (
            <div className="space-y-4">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">
                  {formatDate(unassignedGroup.date)} {formatTime(unassignedGroup.startTime, unassignedGroup.endTime)}
                </p>
                <p className="mt-1 text-xs">
                  {unassignedGroup.branchName} · {unassignedGroup.courseType || 'คอร์สเรียน'} · {unassignedGroup.sessions.length} คน
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-900">ผลที่ต้องการปิดรอบนี้</label>
                <Select value={unassignedMode} onValueChange={(value) => setUnassignedMode(value as UnassignedRoundMode)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="taught">สอนจริง แต่ลืมมอบหมาย/เช็คชื่อ</SelectItem>
                    <SelectItem value="return_entitlement">คืนสิทธิ์ทั้งรอบ</SelectItem>
                    <SelectItem value="close_review">ปิดเคสทั้งรอบ ไม่สร้างสิทธิ์ชดเชย</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {unassignedMode === 'taught' && (
                <>
                  <div>
                    <label className="text-sm font-semibold text-gray-900">โค้ชที่สอนจริง</label>
                    <Select value={unassignedCoachId} onValueChange={setUnassignedCoachId}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="เลือกโค้ชที่สอนจริงในรอบนี้" />
                      </SelectTrigger>
                      <SelectContent>
                        {coaches.map((coach) => (
                          <SelectItem key={coach.id} value={coach.id}>
                            {coach.name} {coach.role === 'head_coach' ? '(หัวหน้าโค้ช)' : '(โค้ช)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-gray-500">
                      ระบบจะสร้างกลุ่ม assignment ย้อนหลังให้ทั้งรอบนี้เท่านั้น ยังไม่เขียน attendance และยังไม่เปลี่ยนสถานะรอบเรียน
                    </p>
                  </div>

                  <div className="rounded-lg border border-gray-200">
                    <div className="border-b border-gray-100 px-3 py-2 text-sm font-semibold text-gray-900">
                      รายชื่อผู้เรียนในรอบนี้
                    </div>
                    <div className="max-h-72 divide-y divide-gray-100 overflow-y-auto">
                      {unassignedTargetSessions.map((session) => (
                        <div key={session.id} className="px-3 py-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-950">{session.learner_name}</p>
                            <p className="mt-1 text-xs text-gray-500">
                              ผู้ปกครอง/ผู้ใช้: {session.user_name}
                            </p>
                            <p className="mt-1 text-xs text-blue-700">
                              รอให้โค้ชตรวจสอบและบันทึก attendance หลังได้รับมอบหมายรอบนี้
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {unassignedMode === 'return_entitlement' && (
                <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-800">
                  ระบบจะคืนสิทธิ์เข้ากระเป๋าวันเรียนให้ผู้เรียนทุกคนในรอบนี้ และไม่สร้างชั่วโมงสอนให้โค้ช
                </div>
              )}

              {unassignedMode === 'close_review' && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  ระบบจะปิดเคสทั้งรอบโดยไม่สร้างสิทธิ์ชดเชย และไม่สร้างชั่วโมงสอนให้โค้ช
                </div>
              )}

              <div>
                <label className="text-sm font-semibold text-gray-900">เหตุผล / หลักฐานประกอบ</label>
                <Textarea
                  className="mt-2 min-h-24"
                  value={unassignedReason}
                  onChange={(event) => setUnassignedReason(event.target.value)}
                  placeholder="เช่น หัวหน้าโค้ชลืมมอบหมาย แต่มีการสอนจริง / คืนสิทธิ์ทั้งรอบเพราะไม่ได้เปิดสอน / ปิดเคสตามการตรวจสอบของ Admin"
                />
                <p className="mt-1 text-xs text-gray-500">จำเป็นสำหรับ audit log เพื่อให้ตรวจสอบย้อนหลังได้</p>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={unassignedSubmitting}
                  onClick={() => setUnassignedGroup(null)}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  className="bg-[#2748bf] hover:bg-[#153c85]"
                  disabled={unassignedSaveDisabled}
                  onClick={submitUnassignedRoundResolution}
                >
                  {unassignedSubmitting
                    ? 'กำลังบันทึก...'
                    : unassignedMode === 'taught'
                      ? 'มอบหมายโค้ชให้รอบนี้'
                      : 'บันทึกผลทั้งรอบ'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">เลือกวันและรอบเรียนชดเชย</DialogTitle>
            <DialogDescription className="sr-only">เลือกวัน สาขา และรอบเรียนจริงจากตารางสำหรับสร้างรอบชดเชยให้ผู้เรียน</DialogDescription>
          </DialogHeader>
          {selectedMonth && (
            <div className="flex min-h-0 flex-1 flex-col space-y-4 overflow-hidden">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                <p className="font-semibold text-gray-950">{selectedMonth.sourceSession.learner_name}</p>
                <p className="mt-1 text-xs text-gray-500">
                  ชดเชยแทน {selectedMonth.sessions.length} ครั้งในเดือน {selectedMonth.monthLabel} • เลือกได้เฉพาะ {selectedMonth.nextMonthLabel}
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {availableDays.length === 0 ? (
                  <div className="rounded-lg border border-dashed py-10 text-center text-sm text-gray-400">
                    ไม่มีรอบเรียนที่เปิดในเดือนนี้สำหรับคอร์สนี้
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,.95fr)]">
                    <div className="rounded-lg border border-gray-200 p-3">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-950">{selectedMonth.nextMonthLabel}</p>
                          <p className="text-xs text-gray-500">เลือกวันที่มีรอบเรียนเพื่อดูเวลา</p>
                        </div>
                        <Badge variant="outline" className="bg-white">{availableDays.length} วัน</Badge>
                      </div>
                      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-gray-400">
                        {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((day) => (
                          <span key={day}>{day}</span>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1 sm:gap-2">
                        {calendarCells.map((cell, index) => {
                          if (!cell) return <div key={`empty-${index}`} className="aspect-square" />
                          const isAvailable = Boolean(cell.availableDay)
                          const isSelected = selectedDate === cell.dateInput
                          const slotCount = cell.availableDay?.slotsByBranch.reduce((sum, item) => sum + item.slots.length, 0) || 0

                          return (
                            <button
                              key={cell.dateInput}
                              type="button"
                              disabled={!isAvailable}
                              className={`flex aspect-square min-h-11 flex-col items-center justify-center rounded-lg border text-xs transition sm:min-h-14 ${
                                isSelected
                                  ? 'border-[#2748bf] bg-[#2748bf] text-white shadow-sm'
                                  : isAvailable
                                    ? 'border-blue-100 bg-blue-50 text-[#153c85] hover:border-[#2748bf]'
                                    : 'border-gray-100 bg-gray-50 text-gray-300'
                              }`}
                              onClick={() => {
                                if (!cell.availableDay) return
                                setSelectedDate(cell.dateInput)
                                setPickedSlot(null)
                              }}
                            >
                              <span className="font-semibold">{cell.date.getDate()}</span>
                              {isAvailable && (
                                <span className={`mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] ${isSelected ? 'bg-white/20 text-white' : 'bg-white text-blue-600'}`}>
                                  {slotCount} รอบ
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 p-3">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
                        <Calendar className="h-4 w-4 text-[#2748bf]" />
                        {selectedDay ? formatDate(selectedDay.dateInput) : 'เลือกรอบเรียน'}
                      </div>
                      {!selectedDay ? (
                        <div className="rounded-lg border border-dashed py-10 text-center text-sm text-gray-400">
                          เลือกวันที่ในปฏิทินก่อน
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {selectedDay.slotsByBranch.map(({ branch, slots }) => (
                            <div key={branch.id}>
                              <p className="mb-2 flex items-center gap-1 text-xs text-gray-500">
                                <Building2 className="h-3.5 w-3.5" />
                                {branch.name}
                              </p>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {slots.map((slot) => {
                                  const isPicked = pickedSlot?.date === selectedDay.dateInput && pickedSlot.start === slot.start && pickedSlot.branchId === branch.id
                                  return (
                                    <Button
                                      key={`${branch.id}-${selectedDay.dateInput}-${slot.start}`}
                                      type="button"
                                      size="sm"
                                      variant={isPicked ? 'default' : 'outline'}
                                      className={`justify-start ${isPicked ? 'bg-[#2748bf] hover:bg-[#153c85]' : ''}`}
                                      onClick={() => setPickedSlot({
                                        date: selectedDay.dateInput,
                                        dayOfWeek: selectedDay.dayOfWeek,
                                        start: slot.start,
                                        end: slot.end,
                                        branchId: branch.id,
                                        branchName: branch.name,
                                      })}
                                    >
                                      <Clock className="mr-1 h-3.5 w-3.5" />
                                      {formatTime(slot.start, slot.end)}
                                    </Button>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {pickedSlot && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  เลือกแล้ว: {formatDate(pickedSlot.date)} • {formatTime(pickedSlot.start, pickedSlot.end)} • {pickedSlot.branchName}
                </div>
              )}

              <Button className="h-10 w-full bg-[#f57e3b] hover:bg-[#e06d2e]" onClick={createMakeup} disabled={loading || !pickedSlot}>
                {loading ? 'กำลังบันทึก...' : 'สร้างวันชดเชย'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
