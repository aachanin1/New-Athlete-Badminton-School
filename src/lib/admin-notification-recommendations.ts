export type RecommendationLevel = 'red' | 'yellow' | 'green'
export type RecommendationCourseName = 'kids_group' | 'adult_group' | 'private'

export interface RecommendationBookingInput {
  id: string
  userId: string
  ownerName: string
  learnerType: 'self' | 'child'
  childId: string | null
  learnerName: string
  branchId: string
  branchName: string
  courseTypeId: string
  courseName: RecommendationCourseName
  month: number
  year: number
  totalSessions: number
  entitlementSessions: number | null
  status: string
  expiresAt: string | null
  expiredAt: string | null
  createdAt: string
}

export interface RecommendationSessionInput {
  id: string
  bookingId: string
  scheduleSlotId: string | null
  date: string
  startTime: string
  endTime: string
  branchId: string
  branchName: string
  childId: string | null
  status: string
  rescheduledFromId: string | null
  isMakeup: boolean
  cancelledAt: string | null
}

export interface RecommendationAttendanceInput {
  bookingSessionId: string
  studentId: string
  status: string
}

export interface LowEnrollmentRecommendation {
  id: string
  scheduleSlotId: string | null
  branchName: string
  courseName: Exclude<RecommendationCourseName, 'private'>
  date: string
  startTime: string
  endTime: string
  learnerCount: number
  level: Extract<RecommendationLevel, 'red' | 'yellow'>
  href: string
}

export interface NearCourseRecommendation {
  id: string
  bookingIds: string[]
  recipientUserId: string
  recipientName: string
  learnerName: string | null
  courseName: RecommendationCourseName
  branchNames: string[]
  usedSessions: number
  totalSessions: number
  progressPercent: number
  level: RecommendationLevel
  notificationTitle: string
  notificationMessage: string
  linkUrl: string
}

export interface FollowUpRecommendationItem {
  id: string
  userId: string
  recipientName: string
  position: number
  status: 'pending' | 'sent' | 'excluded'
  isCurrentlyEligible: boolean
  verifiedAttemptCount: number
  latestVerifiedAt: string | null
  latestVerifiedRead: boolean | null
  ambiguousLegacyCount: number
  canBulk: boolean
}

export interface FollowUpWorkspaceSnapshot {
  state: 'not_started' | 'active' | 'batch_complete' | 'campaign_complete' | 'unavailable'
  totalRemaining: number
  currentCount: number
  waitingCount: number
  processedCount: number
  availableTotal: number
  canStart: boolean
  canLoadNext: boolean
  items: FollowUpRecommendationItem[]
  error: string | null
}

export interface RecommendationWorkspaceData {
  lowEnrollment: LowEnrollmentRecommendation[]
  nearCourse: NearCourseRecommendation[]
  followUp: FollowUpWorkspaceSnapshot
}

export interface FollowUpEligibilityResult {
  userId: string
  latestLessonKey: number
  latestBookingAt: string
}

const SETTLED_BOOKING_STATUSES = new Set(['paid', 'verified'])
const ACTIVE_BOOKING_STATUSES = new Set(['pending_payment', 'paid', 'verified'])
const TERMINAL_ATTENDANCE_STATUSES = new Set(['present', 'late', 'absent'])
const LOW_ENROLLMENT_SESSION_STATUSES = new Set(['scheduled', 'completed', 'absent'])

function lessonKey(year: number, month: number) {
  return year * 12 + month
}

function entitlementForBooking(booking: RecommendationBookingInput) {
  const entitlement = Number(booking.entitlementSessions)
  if (Number.isFinite(entitlement) && entitlement > 0) return Math.trunc(entitlement)
  return Math.max(0, Math.trunc(Number(booking.totalSessions) || 0))
}

function bookingHasActiveEntitlement(booking: RecommendationBookingInput, nowIso: string) {
  if (!ACTIVE_BOOKING_STATUSES.has(booking.status)) return false
  if (booking.status !== 'pending_payment') return true
  if (booking.expiredAt) return false
  return !booking.expiresAt || booking.expiresAt > nowIso
}

function learnerKey(booking: RecommendationBookingInput) {
  return booking.learnerType === 'child' && booking.childId
    ? `child:${booking.childId}`
    : `self:${booking.userId}`
}

function expectedStudentId(
  booking: RecommendationBookingInput,
  session: RecommendationSessionInput
) {
  return session.childId || (booking.learnerType === 'child' ? booking.childId : booking.userId)
}

function progressLevel(progressPercent: number): RecommendationLevel {
  if (progressPercent >= 85) return 'red'
  if (progressPercent >= 80) return 'yellow'
  return 'green'
}

function courseLabel(courseName: RecommendationCourseName) {
  if (courseName === 'kids_group') return 'เด็กกลุ่ม'
  if (courseName === 'adult_group') return 'ผู้ใหญ่กลุ่ม'
  return 'ส่วนตัว'
}

function uniqueSorted(values: Iterable<string>) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right, 'th-TH'))
}

export function buildLowEnrollmentRecommendations({
  bookings,
  sessions,
  today,
}: {
  bookings: RecommendationBookingInput[]
  sessions: RecommendationSessionInput[]
  today: string
}): LowEnrollmentRecommendation[] {
  const bookingById = new Map(bookings.map((booking) => [booking.id, booking]))
  const groups = new Map<string, {
    scheduleSlotId: string | null
    branchName: string
    courseName: Exclude<RecommendationCourseName, 'private'>
    date: string
    startTime: string
    endTime: string
    learnerIds: Set<string>
  }>()

  for (const session of sessions) {
    const booking = bookingById.get(session.bookingId)
    if (!booking || booking.status !== 'verified') continue
    if (booking.courseName === 'private') continue
    if (session.date < today || session.isMakeup || session.cancelledAt) continue
    if (!LOW_ENROLLMENT_SESSION_STATUSES.has(session.status)) continue

    const groupId = session.scheduleSlotId
      ? `slot:${session.scheduleSlotId}`
      : [
          'fallback',
          session.branchId,
          booking.courseTypeId,
          session.date,
          session.startTime,
          session.endTime,
        ].join(':')
    const current = groups.get(groupId) || {
      scheduleSlotId: session.scheduleSlotId,
      branchName: session.branchName,
      courseName: booking.courseName,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      learnerIds: new Set<string>(),
    }
    current.learnerIds.add(session.childId || booking.childId || booking.userId)
    groups.set(groupId, current)
  }

  return Array.from(groups.entries())
    .filter(([, group]) => group.learnerIds.size >= 1 && group.learnerIds.size <= 2)
    .map(([id, group]) => ({
      id,
      scheduleSlotId: group.scheduleSlotId,
      branchName: group.branchName,
      courseName: group.courseName,
      date: group.date,
      startTime: group.startTime,
      endTime: group.endTime,
      learnerCount: group.learnerIds.size,
      level: (group.learnerIds.size === 1 ? 'red' : 'yellow') as LowEnrollmentRecommendation['level'],
      href: `/admin/schedules?date=${encodeURIComponent(group.date)}${group.scheduleSlotId ? `&slot=${encodeURIComponent(group.scheduleSlotId)}` : ''}`,
    }))
    .sort((left, right) => (
      left.branchName.localeCompare(right.branchName, 'th-TH')
      || left.date.localeCompare(right.date)
      || left.startTime.localeCompare(right.startTime)
      || left.id.localeCompare(right.id)
    ))
}

function buildUsedUnitCounts({
  bookings,
  sessions,
  attendance,
}: {
  bookings: RecommendationBookingInput[]
  sessions: RecommendationSessionInput[]
  attendance: RecommendationAttendanceInput[]
}) {
  const bookingById = new Map(bookings.map((booking) => [booking.id, booking]))
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const attendanceBySessionId = new Map<string, RecommendationAttendanceInput[]>()
  const rootMemo = new Map<string, RecommendationSessionInput | null>()

  for (const row of attendance) {
    if (!TERMINAL_ATTENDANCE_STATUSES.has(row.status)) continue
    const current = attendanceBySessionId.get(row.bookingSessionId) || []
    current.push(row)
    attendanceBySessionId.set(row.bookingSessionId, current)
  }

  function resolveRoot(session: RecommendationSessionInput) {
    if (rootMemo.has(session.id)) return rootMemo.get(session.id) || null
    if (session.isMakeup) {
      rootMemo.set(session.id, null)
      return null
    }

    const visited = new Set<string>()
    let current = session
    while (current.rescheduledFromId) {
      if (visited.has(current.id)) {
        rootMemo.set(session.id, null)
        return null
      }
      visited.add(current.id)
      const parent = sessionById.get(current.rescheduledFromId)
      if (!parent || parent.bookingId !== session.bookingId || parent.isMakeup) break
      current = parent
    }
    rootMemo.set(session.id, current)
    return current
  }

  const unitsByBookingId = new Map<string, Map<string, { used: boolean }>>()
  for (const session of sessions) {
    const booking = bookingById.get(session.bookingId)
    if (!booking || session.isMakeup) continue
    const root = resolveRoot(session)
    if (!root) continue
    const unitKey = booking.courseName === 'private'
      ? `${booking.id}:slot:${root.scheduleSlotId || root.id}`
      : `${booking.id}:root:${root.id}`
    const bookingUnits = unitsByBookingId.get(booking.id) || new Map<string, { used: boolean }>()
    const unit = bookingUnits.get(unitKey) || { used: false }
    const expectedId = expectedStudentId(booking, session)
    if (expectedId && (attendanceBySessionId.get(session.id) || []).some((row) => row.studentId === expectedId)) {
      unit.used = true
    }
    bookingUnits.set(unitKey, unit)
    unitsByBookingId.set(booking.id, bookingUnits)
  }

  return new Map(bookings.map((booking) => {
    const units = unitsByBookingId.get(booking.id) || new Map<string, { used: boolean }>()
    return [booking.id, {
      purchasedUnits: units.size,
      usedUnits: Array.from(units.values()).filter((unit) => unit.used).length,
    }]
  }))
}

export function buildNearCourseRecommendations({
  bookings,
  sessions,
  attendance,
  currentYear,
  currentMonth,
  nextYear,
  nextMonth,
  nowIso,
}: {
  bookings: RecommendationBookingInput[]
  sessions: RecommendationSessionInput[]
  attendance: RecommendationAttendanceInput[]
  currentYear: number
  currentMonth: number
  nextYear: number
  nextMonth: number
  nowIso: string
}): NearCourseRecommendation[] {
  const currentBookings = bookings.filter((booking) => (
    booking.year === currentYear
    && booking.month === currentMonth
    && SETTLED_BOOKING_STATUSES.has(booking.status)
  ))
  const usedByBookingId = buildUsedUnitCounts({ bookings: currentBookings, sessions, attendance })
  const nextMonthKeys = new Set(
    bookings
      .filter((booking) => (
        booking.year === nextYear
        && booking.month === nextMonth
        && bookingHasActiveEntitlement(booking, nowIso)
      ))
      .map((booking) => booking.courseName === 'private'
        ? `private:${booking.userId}:${booking.courseTypeId}`
        : `group:${learnerKey(booking)}:${booking.courseTypeId}`)
  )

  const groupScopes = new Map<string, RecommendationBookingInput[]>()
  const privateBookings: RecommendationBookingInput[] = []
  for (const booking of currentBookings) {
    if (booking.courseName === 'private') {
      privateBookings.push(booking)
      continue
    }
    const key = `group:${learnerKey(booking)}:${booking.courseTypeId}`
    const current = groupScopes.get(key) || []
    current.push(booking)
    groupScopes.set(key, current)
  }

  const recommendations: NearCourseRecommendation[] = []

  for (const [scopeKey, scopeBookings] of groupScopes) {
    if (nextMonthKeys.has(scopeKey)) continue
    const denominator = scopeBookings.reduce((sum, booking) => sum + entitlementForBooking(booking), 0)
    if (denominator <= 0) continue
    const used = Math.min(denominator, scopeBookings.reduce(
      (sum, booking) => sum + (usedByBookingId.get(booking.id)?.usedUnits || 0),
      0
    ))
    const ratio = used / denominator
    if (ratio < 0.7) continue
    const progressPercent = Math.min(100, Math.round(ratio * 100))
    const first = scopeBookings[0]
    const label = courseLabel(first.courseName)
    recommendations.push({
      id: scopeKey,
      bookingIds: scopeBookings.map((booking) => booking.id).sort(),
      recipientUserId: first.userId,
      recipientName: first.ownerName,
      learnerName: first.learnerName,
      courseName: first.courseName,
      branchNames: uniqueSorted(scopeBookings.map((booking) => booking.branchName)),
      usedSessions: used,
      totalSessions: denominator,
      progressPercent,
      level: progressLevel(progressPercent),
      notificationTitle: 'ถึงเวลาวางแผนคอร์สเดือนถัดไปแล้ว',
      notificationMessage: `${first.learnerName} ใช้คอร์ส${label}ไปแล้ว ${used}/${denominator} รอบ หากต้องการเรียนต่อสามารถเข้ามาจองเดือนถัดไปได้เลย`,
      linkUrl: '/dashboard/booking',
    })
  }

  for (const booking of privateBookings) {
    const renewalKey = `private:${booking.userId}:${booking.courseTypeId}`
    if (nextMonthKeys.has(renewalKey)) continue
    const denominator = entitlementForBooking(booking)
    if (denominator <= 0) continue
    const used = Math.min(denominator, usedByBookingId.get(booking.id)?.usedUnits || 0)
    const ratio = used / denominator
    if (ratio < 0.7) continue
    const progressPercent = Math.min(100, Math.round(ratio * 100))
    recommendations.push({
      id: `private:${booking.id}`,
      bookingIds: [booking.id],
      recipientUserId: booking.userId,
      recipientName: booking.ownerName,
      learnerName: null,
      courseName: 'private',
      branchNames: [booking.branchName],
      usedSessions: used,
      totalSessions: denominator,
      progressPercent,
      level: progressLevel(progressPercent),
      notificationTitle: 'ถึงเวลาวางแผนคอร์สส่วนตัวแพ็กเกจถัดไปแล้ว',
      notificationMessage: `คุณใช้คอร์สส่วนตัวไปแล้ว ${used}/${denominator} รอบ หากต้องการเรียนต่อสามารถเข้ามาจองแพ็กเกจถัดไปได้เลย`,
      linkUrl: '/dashboard/booking',
    })
  }

  return recommendations.sort((left, right) => (
    right.progressPercent - left.progressPercent
    || left.recipientName.localeCompare(right.recipientName, 'th-TH')
    || left.id.localeCompare(right.id)
  ))
}

export function buildFollowUpEligibility({
  bookings,
  currentYear,
  currentMonth,
  nowIso,
}: {
  bookings: RecommendationBookingInput[]
  currentYear: number
  currentMonth: number
  nowIso: string
}): FollowUpEligibilityResult[] {
  const currentKey = lessonKey(currentYear, currentMonth)
  const activeUserIds = new Set(
    bookings
      .filter((booking) => (
        lessonKey(booking.year, booking.month) === currentKey
        && bookingHasActiveEntitlement(booking, nowIso)
      ))
      .map((booking) => booking.userId)
  )
  const historyByUserId = new Map<string, FollowUpEligibilityResult>()

  for (const booking of bookings) {
    const bookingLessonKey = lessonKey(booking.year, booking.month)
    if (bookingLessonKey >= currentKey || !SETTLED_BOOKING_STATUSES.has(booking.status)) continue
    const existing = historyByUserId.get(booking.userId)
    if (
      !existing
      || bookingLessonKey > existing.latestLessonKey
      || (bookingLessonKey === existing.latestLessonKey && booking.createdAt > existing.latestBookingAt)
    ) {
      historyByUserId.set(booking.userId, {
        userId: booking.userId,
        latestLessonKey: bookingLessonKey,
        latestBookingAt: booking.createdAt,
      })
    }
  }

  return Array.from(historyByUserId.values())
    .filter((candidate) => !activeUserIds.has(candidate.userId))
    .sort((left, right) => (
      right.latestLessonKey - left.latestLessonKey
      || right.latestBookingAt.localeCompare(left.latestBookingAt)
      || left.userId.localeCompare(right.userId)
    ))
}

export function createEmptyFollowUpWorkspace(
  overrides: Partial<FollowUpWorkspaceSnapshot> = {}
): FollowUpWorkspaceSnapshot {
  return {
    state: 'not_started',
    totalRemaining: 0,
    currentCount: 0,
    waitingCount: 0,
    processedCount: 0,
    availableTotal: 0,
    canStart: false,
    canLoadNext: false,
    items: [],
    error: null,
    ...overrides,
  }
}

function finiteCount(value: unknown) {
  const count = Number(value)
  return Number.isFinite(count) && count >= 0 ? Math.trunc(count) : 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeFollowUpWorkspaceSnapshot(value: unknown): FollowUpWorkspaceSnapshot {
  if (!isRecord(value)) {
    return createEmptyFollowUpWorkspace({ state: 'unavailable', error: 'โหลดคิวติดตามลูกค้าไม่สำเร็จ' })
  }

  const validStates = new Set<FollowUpWorkspaceSnapshot['state']>([
    'not_started',
    'active',
    'batch_complete',
    'campaign_complete',
    'unavailable',
  ])
  const rawItems = Array.isArray(value.items) ? value.items : []
  const items = rawItems.flatMap((raw): FollowUpRecommendationItem[] => {
    if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.user_id !== 'string') return []
    const status = raw.status === 'sent' || raw.status === 'excluded' ? raw.status : 'pending'
    const latestRead = typeof raw.latest_verified_read === 'boolean' ? raw.latest_verified_read : null
    return [{
      id: raw.id,
      userId: raw.user_id,
      recipientName: typeof raw.recipient_name === 'string' && raw.recipient_name.trim()
        ? raw.recipient_name
        : 'ไม่ทราบชื่อ',
      position: finiteCount(raw.position),
      status,
      isCurrentlyEligible: raw.is_currently_eligible !== false,
      verifiedAttemptCount: finiteCount(raw.verified_attempt_count),
      latestVerifiedAt: typeof raw.latest_verified_at === 'string' ? raw.latest_verified_at : null,
      latestVerifiedRead: latestRead,
      ambiguousLegacyCount: finiteCount(raw.ambiguous_legacy_count),
      canBulk: raw.can_bulk === true,
    }]
  })

  const state = validStates.has(value.state as FollowUpWorkspaceSnapshot['state'])
    ? value.state as FollowUpWorkspaceSnapshot['state']
    : 'unavailable'

  return createEmptyFollowUpWorkspace({
    state,
    totalRemaining: finiteCount(value.total_remaining),
    currentCount: finiteCount(value.current_count),
    waitingCount: finiteCount(value.waiting_count),
    processedCount: finiteCount(value.processed_count),
    availableTotal: finiteCount(value.available_total),
    canStart: value.can_start === true,
    canLoadNext: value.can_load_next === true,
    items: items.sort((left, right) => left.position - right.position || left.id.localeCompare(right.id)),
    error: typeof value.error === 'string' ? value.error : null,
  })
}
