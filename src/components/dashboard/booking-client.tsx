'use client'
import { BookingFlowSteps, BookingCalendarHeading, BookingLearnerTabs, BookingReviewCard } from './booking-flow-ui'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { checkoutRequest, type BookingPackage } from '@/lib/booking-checkout'
import { isPerSessionPurchase, isBillSinglePurchase, recommendBookingPackage } from '@/lib/booking-purchase'
import { bangkokMonthKey, packageExpiryAt, packageRoundWithinExpiry, packageValidityDescription, PACKAGE_DATE_ERROR, PACKAGE_DURATION_RULE } from '@/lib/booking-package-validity'
import { BookingCalendar } from '@/components/dashboard/booking-calendar'
import { BookingPackageRecommendation } from './booking-package-recommendation'
import type { PreviousBooking } from '@/lib/booking-previous'
import { BookingChoice } from '@/components/dashboard/booking-choice'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Child, Branch, CourseTypeName } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Users,
  User,
  Star,
  CheckCircle2,
  Loader2,
  AlertCircle,
  X,
  CalendarDays,
  Clock,
} from 'lucide-react'
import { formatThaiCompactDateWithWeekday, formatThaiDateWithWeekday, formatThaiMonthYear } from '@/lib/date-format'
import { getTemplateSlots, hasTemplateSlots, type ScheduleTemplateOption, type TimeSlot } from '@/lib/schedule-template-utils'
import { getKidsGroupIncremental, getAdultGroupTotal, getPrivateTotal, getSessionStatusLabel, getKidsGroupTiers, getAdultGroupTiers, getPrivateTiers, formatPricingTierRange, type CourseCategory, type PricingTierInput, type SelectedPricingTierEvidence } from '@/lib/pricing'
import { type BookingPricingPolicyQuote } from '@/lib/booking-pricing-policy'
import { task10RpcError } from '@/lib/task10-policy'
import { formatLearnerDisplayName, joinLearnerDisplayNames } from '@/lib/learner-display-name'
import { fmtTime } from '@/lib/utils'
import {
  getBookingAvailabilitySlotKey,
  type BookingAvailabilitySlotInput,
  type BookingSlotAvailability,
} from '@/lib/booking-slot-availability'

interface CourseTypeRow {
  id: string
  name: string
}

interface ExistingBooking {
  id: string
  child_id: string | null
  course_type_id: string
  month: number
  year: number
  total_sessions: number
  total_price: number
  status: string
}

interface ExistingBookingSession {
  id: string
  booking_id: string
  date: string
  start_time: string
  end_time: string
  branch_id: string
  child_id: string | null
  schedule_slot_id?: string | null
  status: string
}

interface PricingTierData {
  id: string
  course_type_id: string
  course_type_name: CourseCategory
  min_sessions: number
  max_sessions: number | null
  price_per_session: number
  package_price: number
  valid_from: string
  valid_to: string | null
  created_at: string | null
}

interface SelectedSession {
  date: string       // "2026-02-15"
  dayOfWeek: number  // 0-6
  start: string      // "17:00"
  end: string        // "19:00"
  branchId: string
  scheduleTemplateId?: string | null
  scheduleSlotId?: string | null
}

interface EditBookingSession {
  id: string
  date: string
  start_time: string
  end_time: string
  branch_id: string
  child_id: string | null
  schedule_slot_id?: string | null
}

interface EditBookingData {
  checkout_deadline?: string | null
  package_snapshot?: BookingPackage | null
  package_participants?: Array<string | null> | null
  id: string
  learner_type: string
  child_id: string | null
  branch_id: string
  course_type_id: string
  month: number
  year: number
  total_sessions: number
  total_price: number
  status: string
  course_types: { name: string } | null
  sessions: EditBookingSession[]
  childIds: string[]
  pricing_scope_id: string | null
  pricing_revision: number | null
}

interface BookingClientProps {
  todayBangkok: string
  serverNow?: string
  packages: BookingPackage[]
  previousBookings?: PreviousBooking[]
  userId: string
  userName: string
  learnerChildren: Child[]
  branches: Branch[]
  courseTypes: CourseTypeRow[]
  scheduleTemplates: ScheduleTemplateOption[]
  existingBookings: ExistingBooking[]
  existingBookingSessions?: ExistingBookingSession[]
  editBooking?: EditBookingData | null
  pricingTiers?: PricingTierData[]
  initialKidsPricingPolicy?: BookingPricingPolicyQuote | null
  initialKidsPricingError?: string | null
  initialKidsPricingErrorCode?: string | null
  initialKidsPricingMonth?: string
}

type Step = 'type' | 'learner' | 'branch' | 'calendar' | 'summary'

interface BookingDraft {
  packageId?: string
  version: 3
  step: Step
  courseType: CourseTypeName | null
  learnerType: 'self' | 'child' | null
  selectedChildIds: string[]
  privateSelfAttend: boolean
  selectedBranchIds: string[]
  calMonth: number
  calYear: number
  sessionsMap: Record<string, SelectedSession[]>
  activeChildTab: string
  clientRequestId: string
  updatedAt: number
}

interface LegacyBookingPreview {
  policy?: BookingPricingPolicyQuote
  mode: 'legacy'
  totalPrice: number
  grossPrice: number
  discountAmount: number
  selectedTier: SelectedPricingTierEvidence
  existingSessions: number
  existingPaid: number
  totalSessionsAfter: number
  expectedScopeRevision?: undefined
  legacyBaselineSessions?: undefined
  legacyBaselineFingerprint?: undefined
}

interface ProgressiveBookingPreview {
  policy?: BookingPricingPolicyQuote
  mode: 'progressive'
  totalPrice: number
  grossPrice: number
  discountAmount: number
  expectedScopeRevision: number
  legacyBaselineSessions: number
  legacyBaselineFingerprint: string
  previousProgressiveActiveSessions: number
  newBookingSessions: number
  cumulativeAfterSessions: number
  ratePerSession: number
  sourceKind: 'progressive_kids_group_v1'
  selectedTier: SelectedPricingTierEvidence
}

type AuthoritativeBookingPreview = LegacyBookingPreview | ProgressiveBookingPreview

interface BookingAvailabilitySnapshot {
  mode: 'legacy' | 'progressive'
  checkedAt: string
  slots: BookingSlotAvailability[]
}

interface FingerprintedPreview {
  fingerprint: string
  preview: AuthoritativeBookingPreview
}

interface FingerprintedAvailability {
  fingerprint: string
  availability: BookingAvailabilitySnapshot
}

const BOOKING_DRAFT_VERSION = 3
const STEP_ORDER: Step[] = ['type', 'learner', 'branch', 'calendar', 'summary']

const STEPS: { key: Step; label: string }[] = [
  { key: 'type', label: 'เลือกคอร์ส' },
  { key: 'calendar', label: 'ผู้เรียนและวันเรียน' },
  { key: 'summary', label: 'สรุปและชำระเงิน' },
]

const SETTLED_BOOKING_STATUSES = ['paid', 'verified']

const COURSE_TYPES: { value: CourseTypeName; label: string; desc: string; icon: typeof Users }[] = [
  { value: 'kids_group', label: 'เด็ก (กลุ่ม)', desc: 'เรียนแบบกลุ่ม • 2 ชม.', icon: Users },
  { value: 'adult_group', label: 'ผู้ใหญ่ (กลุ่ม)', desc: 'เรียนแบบกลุ่ม • 2 ชม.', icon: User },
  { value: 'private', label: 'Private', desc: 'เด็ก & ผู้ใหญ่ • 1 ชม.', icon: Star },
]

function getMonthDisplayDateKey(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`
}

function getBookingDraftStorageKey(userId: string, editBookingId?: string | null) {
  return editBookingId
    ? `nabs:booking-draft:v${BOOKING_DRAFT_VERSION}:${userId}:edit:${editBookingId}`
    : `nabs:booking-draft:v${BOOKING_DRAFT_VERSION}:${userId}:new`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStep(value: unknown): value is Step {
  return typeof value === 'string' && STEP_ORDER.includes(value as Step)
}

function isLearnerType(value: unknown): value is 'self' | 'child' | null {
  return value === null || value === 'self' || value === 'child'
}

function isCourseTypeValue(value: unknown, validCourseTypes: Set<string>): value is CourseTypeName | null {
  return value === null || (typeof value === 'string' && validCourseTypes.has(value))
}

function isValidStringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function createClientRequestId() {
  return globalThis.crypto.randomUUID()
}

function isValidSelectedSession(value: unknown, validBranchIds: Set<string>): value is SelectedSession {
  if (!isRecord(value)) return false
  if (typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return false
  if (typeof value.dayOfWeek !== 'number' || value.dayOfWeek < 0 || value.dayOfWeek > 6) return false
  if (typeof value.start !== 'string' || typeof value.end !== 'string') return false
  if (typeof value.branchId !== 'string' || !validBranchIds.has(value.branchId)) return false
  if (value.scheduleTemplateId !== undefined && value.scheduleTemplateId !== null && typeof value.scheduleTemplateId !== 'string') return false
  if (value.scheduleSlotId !== undefined && value.scheduleSlotId !== null && typeof value.scheduleSlotId !== 'string') return false
  return true
}

function getEditSelectedBranchIds(editBooking: EditBookingData | null | undefined, branches: Branch[]) {
  if (!editBooking) return []
  const validBranchIds = new Set(branches.map((branch) => branch.id))
  return Array.from(new Set([
    editBooking.branch_id,
    ...editBooking.sessions.map((session) => session.branch_id),
  ].filter((branchId) => validBranchIds.has(branchId))))
}

function isMeaningfulDraft({
  courseType,
  learnerType,
  selectedChildIds,
  privateSelfAttend,
  selectedBranchIds,
  sessionsMap,
  step,
  isEditMode,
}: {
  courseType: CourseTypeName | null
  learnerType: 'self' | 'child' | null
  selectedChildIds: string[]
  privateSelfAttend: boolean
  selectedBranchIds: string[]
  sessionsMap: Record<string, SelectedSession[]>
  step: Step
  isEditMode: boolean
}) {
  const sessionCount = Object.values(sessionsMap).reduce((sum, sessions) => sum + sessions.length, 0)
  return Boolean(
    isEditMode ||
    courseType ||
    learnerType ||
    selectedChildIds.length > 0 ||
    privateSelfAttend ||
    selectedBranchIds.length > 0 ||
    sessionCount > 0 ||
    step !== 'type'
  )
}

function buildAvailabilityCandidates({
  calMonth,
  calYear,
  selectedBranches,
  courseType,
  scheduleTemplates,
  nowMs,
}: {
  calMonth: number
  calYear: number
  selectedBranches: Branch[]
  courseType: CourseTypeName | null
  scheduleTemplates: ScheduleTemplateOption[]
  nowMs: number
}) {
  if (!courseType || selectedBranches.length === 0) return []
  const candidates: BookingAvailabilitySlotInput[] = []
  const seen = new Set<string>()
  const totalDays = new Date(calYear, calMonth + 1, 0).getDate()

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(calYear, calMonth, day)
    const dateString = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    for (const branch of selectedBranches) {
      for (const slot of getTemplateSlots(scheduleTemplates, branch.slug, courseType, date.getDay(), date)) {
        const [hour, minute] = slot.start.split(':').map(Number)
        if (new Date(calYear, calMonth, day, hour || 0, minute || 0).getTime() <= nowMs) continue
        const candidate = {
          date: dateString,
          startTime: slot.start,
          endTime: slot.end,
          branchId: branch.id,
          scheduleTemplateId: slot.templateId || null,
        }
        const key = getBookingAvailabilitySlotKey(candidate)
        if (seen.has(key)) continue
        seen.add(key)
        candidates.push(candidate)
      }
    }
  }

  return candidates
}

function isSameVisiblePreview(left: AuthoritativeBookingPreview | null, right: AuthoritativeBookingPreview) {
  return Boolean(
    left
    && left.mode === right.mode
    && left.grossPrice === right.grossPrice
    && left.discountAmount === right.discountAmount
    && left.totalPrice === right.totalPrice
    && left.policy?.fingerprint === right.policy?.fingerprint
    && left.selectedTier.id === right.selectedTier.id,
  )
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function getSafeStep(step: Step, draft: Omit<BookingDraft, 'version' | 'updatedAt'>) {
  const targetIndex = STEP_ORDER.indexOf(step)
  if (!draft.courseType) return 'type'
  if (targetIndex <= STEP_ORDER.indexOf('learner')) return step

  const hasLearner =
    draft.courseType === 'kids_group'
      ? draft.selectedChildIds.length > 0
      : draft.courseType === 'private'
        ? draft.privateSelfAttend || draft.selectedChildIds.length > 0
        : Boolean(draft.learnerType)

  if (!hasLearner) return 'learner'
  if (targetIndex <= STEP_ORDER.indexOf('branch')) return step
  if (draft.selectedBranchIds.length === 0) return 'branch'
  if (targetIndex <= STEP_ORDER.indexOf('calendar')) return step

  const selectedSessionCount = Object.values(draft.sessionsMap).reduce((sum, sessions) => sum + sessions.length, 0)
  return selectedSessionCount > 0 || draft.packageId ? step : 'calendar'
}

function sanitizeBookingDraft(
  value: unknown,
  validCourseTypes: Set<string>,
  validChildIds: Set<string>,
  validBranchIds: Set<string>,
  requiredBranchIds: readonly string[] = [],
): Omit<BookingDraft, 'version' | 'updatedAt'> | null {
  if (!isRecord(value)) return null
  if (value.version !== BOOKING_DRAFT_VERSION) return null
  if (!isStep(value.step)) return null
  if (!isCourseTypeValue(value.courseType, validCourseTypes)) return null
  if (!isLearnerType(value.learnerType)) return null
  if (!isValidStringArray(value.selectedChildIds)) return null
  if (!isValidStringArray(value.selectedBranchIds)) return null
  if (typeof value.privateSelfAttend !== 'boolean') return null
  if (typeof value.calMonth !== 'number' || !Number.isInteger(value.calMonth) || value.calMonth < 0 || value.calMonth > 11) return null
  if (typeof value.calYear !== 'number' || !Number.isInteger(value.calYear) || value.calYear < 2020 || value.calYear > 2100) return null
  const calMonth = value.calMonth
  const calYear = value.calYear
  if (!isRecord(value.sessionsMap)) return null

  const selectedChildIds = value.selectedChildIds.filter((childId) => validChildIds.has(childId))
  const selectedBranchIds = Array.from(new Set([
    ...requiredBranchIds,
    ...value.selectedBranchIds,
  ].filter((branchId) => validBranchIds.has(branchId))))
  const selectedChildIdSet = new Set(selectedChildIds)
  const selectedBranchIdSet = new Set(selectedBranchIds)
  const courseType = value.courseType
  const sessionsMap: Record<string, SelectedSession[]> = {}

  for (const [learnerKey, sessions] of Object.entries(value.sessionsMap)) {
    const learnerKeyAllowed = courseType === 'kids_group'
      ? selectedChildIdSet.has(learnerKey)
      : learnerKey === 'self'

    if (!learnerKeyAllowed || !Array.isArray(sessions)) continue

    const safeSessions = sessions.filter((session) => isValidSelectedSession(session, selectedBranchIdSet))
    if (safeSessions.length > 0) sessionsMap[learnerKey] = safeSessions
  }

  const activeChildTab = typeof value.activeChildTab === 'string' ? value.activeChildTab : 'self'
  const safeActiveChildTab = courseType === 'kids_group'
    ? (selectedChildIdSet.has(activeChildTab) ? activeChildTab : selectedChildIds[0] || 'self')
    : 'self'

  const draft = {
    packageId: typeof value.packageId === 'string' ? value.packageId : '',
    step: value.step,
    courseType,
    learnerType: value.learnerType,
    selectedChildIds,
    privateSelfAttend: value.privateSelfAttend,
    selectedBranchIds,
    calMonth,
    calYear,
    sessionsMap,
    activeChildTab: safeActiveChildTab,
    clientRequestId: typeof value.clientRequestId === 'string' ? value.clientRequestId : createClientRequestId(),
  }

  return { ...draft, step: getSafeStep(value.step, draft) }
}

export function BookingClient({ todayBangkok, serverNow, userId, userName, learnerChildren: initialLearnerChildren, packages: initialPackages, previousBookings = [], branches, courseTypes, scheduleTemplates, existingBookings, existingBookingSessions = [], editBooking, pricingTiers = [], initialKidsPricingPolicy, initialKidsPricingError, initialKidsPricingErrorCode, initialKidsPricingMonth }: BookingClientProps) {
  const router = useRouter()
  const [packages, setPackages] = useState(initialPackages)
  useEffect(() => { setPackages(initialPackages) }, [initialPackages])
  const [comparison, setComparison] = useState<{ fingerprint: string; pack: BookingPackage } | null>(null)
  const [learnerChildren, setLearnerChildren] = useState(initialLearnerChildren)
  const [packageId, setPackageId] = useState(editBooking ? packages.find(p => p.quantity === editBooking.total_sessions && p.course === editBooking.course_types?.name)?.id || '' : '')
  const [childName, setChildName] = useState('')
  const [childNickname, setChildNickname] = useState('')
  const [addingChild, setAddingChild] = useState(false)
  const [showChildForm, setShowChildForm] = useState(false)
  const childRequest = useRef('')
  const [childUnknown,setChildUnknown]=useState(false)
  const restoredChildRequest=useRef(false)
  const [uncertainCreate, setUncertainCreate] = useState(false)
  const uncertainRequest = useRef('')
  const restoredUncertain = useRef('')
  const draftSaveTimer = useRef<number | null>(null)
  const [policyRefreshing, refreshPolicy] = useTransition()
  const [previewFailure, setPreviewFailure] = useState<{ fingerprint: string; code: string; message: string } | null>(null)
  const isEditMode = !!editBooking
  const uncertainStorageKey='nabs:booking-uncertain:'+userId+(editBooking?':edit:'+editBooking.id:'')
  const editSelectedBranchIds = useMemo(
    () => getEditSelectedBranchIds(editBooking, branches),
    [branches, editBooking],
  )

  // Pre-fill from editBooking if in edit mode
  const editCourseTypeName = editBooking?.course_types?.name as CourseTypeName | undefined

  const [step, setStep] = useState<Step>(isEditMode ? 'calendar' : 'type')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Coupon state
  const [couponCode, setCouponCode] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: string; code: string; discount_type: string; discount_value: number; discountAmount: number
  } | null>(null)

  // Booking state
  const [courseType, setCourseType] = useState<CourseTypeName | null>(editCourseTypeName || null)
  const selectedPackage = editBooking?.package_snapshot || packages.find(p => p.id === packageId && p.course === courseType)
  const singleSelection = isPerSessionPurchase(selectedPackage)
  const multiSingleSelection = singleSelection && (!isEditMode || isBillSinglePurchase(editBooking?.package_snapshot))
  const serverClockOffset = useRef(Date.parse(serverNow || todayBangkok + 'T12:00:00+07:00') - Date.now())
  const [packageMonth, setPackageMonth] = useState(todayBangkok.slice(0, 7))
  useEffect(() => {
    const refreshMonth = () => setPackageMonth(bangkokMonthKey(Date.now() + serverClockOffset.current))
    const timer = setInterval(refreshMonth, 60000)
    document.addEventListener('visibilitychange', refreshMonth)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refreshMonth) }
  }, [])
  const packageReference = packageMonth + '-01T12:00:00+07:00'
  const packageExpiry = courseType !== 'kids_group' ? packageExpiryAt(selectedPackage, packageReference) : null
  const packageEndMonth = packageExpiry ? bangkokMonthKey(packageExpiry) : null
  const [learnerType, setLearnerType] = useState<'self' | 'child' | null>(
    isEditMode ? (editBooking.learner_type === 'child' ? 'child' : 'self') : null
  )
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>(editBooking?.childIds || [])
  const [privateSelfAttend, setPrivateSelfAttend] = useState(Boolean(editBooking?.package_participants?.includes(null) || editBooking?.sessions.some(s => !s.child_id)))
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(editSelectedBranchIds)

  // Calendar state — per-child sessions map
  const now = new Date(todayBangkok+'T12:00:00+07:00')
  const [calMonth, setCalMonth] = useState(isEditMode ? (editBooking.month - 1) : initialKidsPricingMonth ? Number(initialKidsPricingMonth.slice(5, 7)) - 1 : now.getMonth())
  const [calYear, setCalYear] = useState(isEditMode ? editBooking.year : initialKidsPricingMonth ? Number(initialKidsPricingMonth.slice(0, 4)) : now.getFullYear())
  const calendarMonthDisplay = formatThaiMonthYear(getMonthDisplayDateKey(calYear, calMonth))

  // Build initial sessionsMap from editBooking sessions
  const buildEditSessionsMap = (): Record<string, SelectedSession[]> => {
    if (!editBooking) return {}
    const map: Record<string, SelectedSession[]> = {}
    for (const s of editBooking.sessions) {
      const key = editCourseTypeName === 'private' ? 'self' : s.child_id || 'self'
      const d = new Date(s.date + 'T00:00:00')
      if (!map[key]) map[key] = []
      if (map[key].some(slot => slot.date === s.date && slot.start === s.start_time.slice(0, 5) && slot.end === s.end_time.slice(0, 5) && slot.branchId === s.branch_id)) continue
      map[key].push({
        date: s.date,
        dayOfWeek: d.getDay(),
        start: s.start_time.slice(0, 5),
        end: s.end_time.slice(0, 5),
        branchId: s.branch_id,
        scheduleSlotId: s.schedule_slot_id || null,
      })
    }
    return map
  }

  const [sessionsMap, setSessionsMap] = useState<Record<string, SelectedSession[]>>(buildEditSessionsMap)
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [activeChildTab, setActiveChildTab] = useState<string>(
    isEditMode && editCourseTypeName === 'kids_group' && editBooking.childIds.length > 0 ? editBooking.childIds[0] : 'self'
  )
  const [draftReady, setDraftReady] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)
  const [clientRequestId, setClientRequestId] = useState('')
  const [previewRecord, setPreviewRecord] = useState<FingerprintedPreview | null>(null)
  const [previewLoadingFingerprint, setPreviewLoadingFingerprint] = useState<string | null>(null)
  const [availabilityRecord, setAvailabilityRecord] = useState<FingerprintedAvailability | null>(null)
  const [availabilityLoadingFingerprint, setAvailabilityLoadingFingerprint] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const previewAbortRef = useRef<AbortController | null>(null)
  const availabilityAbortRef = useRef<AbortController | null>(null)

  const draftStorageKey = useMemo(
    () => getBookingDraftStorageKey(userId, editBooking?.id || null),
    [userId, editBooking?.id]
  )
  const previousDraftStorageKeyRef = useRef(draftStorageKey)
  const validCourseTypes = useMemo(() => new Set(courseTypes.map((ct) => ct.name)), [courseTypes])
  const validChildIds = useMemo(() => new Set(learnerChildren.map((child) => child.id)), [learnerChildren])
  const validBranchIds = useMemo(() => new Set(branches.map((branch) => branch.id)), [branches])
  const restoredDraftIdentityRef = useRef<string | null>(null)

  useEffect(() => {
    const previousDraftStorageKey = previousDraftStorageKeyRef.current
    if (previousDraftStorageKey === draftStorageKey) return

    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(previousDraftStorageKey)
      } catch {
        // Ignore storage errors; the active draft key will still be restored/saved normally.
      }
    }
    previousDraftStorageKeyRef.current = draftStorageKey
  }, [draftStorageKey])

  useEffect(() => {
    const identity = JSON.stringify({
      key: draftStorageKey,
      isEditMode,
      editBranches: [...editSelectedBranchIds].sort(),
      courses: [...validCourseTypes].sort(),
      branches: [...validBranchIds].sort(),
    })
    // Adding a child inline must preserve the just-selected child and live form.
    // A restored draft is sanitized against the current children on first entry.
    if (restoredDraftIdentityRef.current === identity) return
    restoredDraftIdentityRef.current = identity
    setDraftReady(false)
    setDraftRestored(false)

    if (typeof window === 'undefined') {
      setDraftReady(true)
      return
    }

    try {
      const rawDraft = window.sessionStorage.getItem(draftStorageKey)
      if (!rawDraft) {
        setDraftReady(true)
        return
      }

      const restoredDraft = sanitizeBookingDraft(
        JSON.parse(rawDraft),
        validCourseTypes,
        validChildIds,
        validBranchIds,
        isEditMode ? editSelectedBranchIds : [],
      )

      if (!restoredDraft) {
        window.sessionStorage.removeItem(draftStorageKey)
        setDraftReady(true)
        return
      }

      setStep(['learner', 'branch'].includes(restoredDraft.step) || (!isEditMode && restoredDraft.step === 'summary') ? 'calendar' : restoredDraft.step)
      if (restoredDraft.packageId && packages.some(p => p.id === restoredDraft.packageId)) setPackageId(restoredDraft.packageId)
      setCourseType(restoredDraft.courseType)
      setLearnerType(restoredDraft.learnerType)
      setSelectedChildIds(restoredDraft.selectedChildIds)
      setPrivateSelfAttend(restoredDraft.privateSelfAttend)
      setSelectedBranchIds(restoredDraft.selectedBranchIds)
      setCalMonth(restoredDraft.calMonth)
      setCalYear(restoredDraft.calYear)
      setSessionsMap(restoredDraft.sessionsMap)
      setActiveChildTab(restoredDraft.activeChildTab)
      setClientRequestId(restoredDraft.clientRequestId)
      setExpandedDate(null)
      setDraftRestored(true)
      setDraftReady(true)
    } catch {
      window.sessionStorage.removeItem(draftStorageKey)
      setDraftReady(true)
    }
  }, [draftStorageKey, editSelectedBranchIds, isEditMode, packages, validBranchIds, validChildIds, validCourseTypes])

  useEffect(() => {
    if (draftReady && !clientRequestId) setClientRequestId(createClientRequestId())
  }, [clientRequestId, draftReady])
  useEffect(() => {
    if (!draftReady || restoredUncertain.current===uncertainStorageKey) return
    restoredUncertain.current = uncertainStorageKey
    uncertainRequest.current='';setUncertainCreate(false)
    try {
      const saved = sessionStorage.getItem(uncertainStorageKey)
      if (saved) { uncertainRequest.current = saved; setClientRequestId(saved); setUncertainCreate(true) }
    } catch {}
  }, [draftReady, uncertainStorageKey])
  useEffect(()=>{
    if(!draftReady||restoredChildRequest.current)return
    restoredChildRequest.current=true
    try{const saved=JSON.parse(sessionStorage.getItem('nabs:child-pending:'+userId)||'null');if(saved){childRequest.current=saved.request;setChildName('');setChildNickname('');setChildUnknown(true);setShowChildForm(true)}}catch{}
  },[draftReady,userId])

  useEffect(() => {
    if (!draftReady || typeof window === 'undefined') return

    const timeoutId = window.setTimeout(() => {
      try {
        const shouldSaveDraft = isMeaningfulDraft({
          courseType,
          learnerType,
          selectedChildIds,
          privateSelfAttend,
          selectedBranchIds,
          sessionsMap,
          step,
          isEditMode,
        })

        if (!shouldSaveDraft) {
          window.sessionStorage.removeItem(draftStorageKey)
          return
        }

        const draft: BookingDraft = {
          packageId,
          version: BOOKING_DRAFT_VERSION,
          step,
          courseType,
          learnerType,
          selectedChildIds,
          privateSelfAttend,
          selectedBranchIds,
          calMonth,
          calYear,
          sessionsMap,
          activeChildTab,
          clientRequestId,
          updatedAt: Date.now(),
        }
        window.sessionStorage.setItem(draftStorageKey, JSON.stringify(draft))
      } catch {
        // sessionStorage can be unavailable in restricted browser modes.
      }
    }, 250)
    draftSaveTimer.current = timeoutId

    return () => window.clearTimeout(timeoutId)
  }, [
    activeChildTab,
    clientRequestId,
    calMonth,
    calYear,
    courseType,
    draftReady,
    draftStorageKey,
    isEditMode,
    learnerType,
    privateSelfAttend,
    packageId,
    selectedBranchIds,
    selectedChildIds,
    sessionsMap,
    step,
  ])

  const clearStoredDraft = () => {
    if (draftSaveTimer.current !== null) clearTimeout(draftSaveTimer.current)
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(draftStorageKey)
      } catch {
        // Ignore storage errors; the current in-memory booking state is still usable.
      }
    }
    setDraftRestored(false)
  }

  const currentStepIndex = STEPS.findIndex((s) => s.key === step)
  const selectedBranches = useMemo(
    () => branches.filter((branch) => selectedBranchIds.includes(branch.id)),
    [branches, selectedBranchIds],
  )
  const branchNameMap = useMemo(() => {
    const m: Record<string, string> = {}
    branches.forEach((b) => { m[b.id] = b.name })
    return m
  }, [branches])

  // For non-kids bookings, use 'self' as key in sessionsMap
  const activeSessions = sessionsMap[activeChildTab] || []
  const hasCalendarLearner = courseType === 'adult_group' || courseType === 'private' && privateSelfAttend || selectedChildIds.length > 0

  // Total sessions across all selected learnerChildren (for this booking batch)
  const allSelectedSessions = useMemo(() => {
    return Object.entries(sessionsMap).flatMap(([childId, sessions]) => {
      if (courseType === 'kids_group' && !selectedChildIds.includes(childId)) return []
      return sessions
    })
  }, [sessionsMap, courseType, selectedChildIds])

  // Count only settled bookings for monthly true-up. Pending bookings are not paid yet.
  const existingMonthData = useMemo(() => {
    if (courseType !== 'kids_group') return { sessions: 0, paid: 0 }
    const courseTypeRow = courseTypes.find((ct) => ct.name === courseType)
    if (!courseTypeRow) return { sessions: 0, paid: 0 }
    const editId = editBooking?.id
    const monthBookings = existingBookings.filter(
      (b) =>
        b.month === calMonth + 1 &&
        b.year === calYear &&
        b.course_type_id === courseTypeRow.id &&
        b.id !== editId &&
        SETTLED_BOOKING_STATUSES.includes(b.status)
    )
    return {
      sessions: monthBookings.reduce((sum, b) => sum + b.total_sessions, 0),
      paid: monthBookings.reduce((sum, b) => sum + (b.total_price || 0), 0),
    }
  }, [courseType, calMonth, calYear, existingBookings, courseTypes, editBooking])

  // Incremental pricing for kids_group
  const kidsIncremental = useMemo(() => {
    if (courseType !== 'kids_group' || allSelectedSessions.length === 0) return null
    const perBill = (previewRecord?.preview.policy || initialKidsPricingPolicy)?.pricingMode === 'per_bill_v1'
    return getKidsGroupIncremental(perBill ? 0 : existingMonthData.sessions, perBill ? 0 : existingMonthData.paid, allSelectedSessions.length, pricingTiers as PricingTierInput[])
  }, [courseType, allSelectedSessions.length, existingMonthData, pricingTiers, previewRecord?.preview.policy, initialKidsPricingPolicy])

  const pricing = useMemo(() => {
    if (!courseType || allSelectedSessions.length === 0) return null
    if (courseType === 'kids_group' && kidsIncremental) {
      return { total: kidsIncremental.incrementalPrice, perSession: kidsIncremental.perSession, tierLabel: kidsIncremental.tierLabel }
    }
    if (multiSingleSelection && selectedPackage) return { total: allSelectedSessions.length * (selectedPackage.unitRate ?? selectedPackage.price), perSession: selectedPackage.unitRate ?? selectedPackage.price, tierLabel: courseType === 'private' ? 'รายชั่วโมง' : 'รายครั้ง' }
    if (courseType === 'adult_group') return getAdultGroupTotal(allSelectedSessions.length, pricingTiers as PricingTierInput[])
    return getPrivateTotal(allSelectedSessions.length, pricingTiers as PricingTierInput[])
  }, [courseType, allSelectedSessions.length, kidsIncremental, pricingTiers, multiSingleSelection, selectedPackage])

  // Total price for entire batch (incremental for kids, normal for others)
  const totalBatchPrice = useMemo(() => {
    if (!pricing) return 0
    if (courseType === 'kids_group' && kidsIncremental) return kidsIncremental.incrementalPrice
    return pricing.total
  }, [pricing, courseType, kidsIncremental])

  const bookingSessionCount = multiSingleSelection ? (sessionsMap.self || []).length : isEditMode && !editBooking?.package_snapshot ? (courseType === 'private' ? (sessionsMap.self || []).length : allSelectedSessions.length) : courseType !== 'kids_group' && selectedPackage ? selectedPackage.quantity : allSelectedSessions.length
  const recommendedPackage = singleSelection && !isEditMode && courseType ? recommendBookingPackage(packages, courseType, bookingSessionCount) : null
  const selectedCourseType = useMemo(
    () => courseTypes.find((courseTypeRow) => courseTypeRow.name === courseType) || null,
    [courseType, courseTypes],
  )
  const requestedAvailabilitySlots = useMemo<BookingAvailabilitySlotInput[]>(
    () => allSelectedSessions.map((session) => ({
      date: session.date,
      startTime: session.start,
      endTime: session.end,
      branchId: session.branchId,
      scheduleTemplateId: session.scheduleTemplateId || null,
    })),
    [allSelectedSessions],
  )
  const availabilityCandidates = useMemo(
    () => buildAvailabilityCandidates({
      calMonth,
      calYear,
      selectedBranches,
      courseType,
      scheduleTemplates,
      nowMs: Date.now(),
    }),
    [calMonth, calYear, courseType, scheduleTemplates, selectedBranches],
  )
  const previewFingerprint = useMemo(() => JSON.stringify({
    bookingId: editBooking?.id || null,
    policyRead: courseType === 'kids_group' ? [initialKidsPricingPolicy?.fingerprint, initialKidsPricingErrorCode, initialKidsPricingMonth] : null,
    courseType,
    learnerType,
    selectedChildIds: [...selectedChildIds].sort(),
    privateSelfAttend,
    selectedBranchIds: [...selectedBranchIds].sort(),
    month: calMonth + 1,
    year: calYear,
    sessions: Object.entries(sessionsMap)
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([learnerKey, sessions]) => sessions.map((session) => ({
        learnerKey,
        date: session.date,
        start: session.start,
        end: session.end,
        branchId: session.branchId,
        scheduleTemplateId: session.scheduleTemplateId || null,
      })))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    packageId,
    packageRevision: selectedPackage?.revision,
    couponId: appliedCoupon?.id || null,
  }), [
    appliedCoupon?.id,
    packageId,
    selectedPackage?.revision,
    calMonth,
    calYear,
    courseType,
    editBooking?.id,
    initialKidsPricingPolicy?.fingerprint,
    initialKidsPricingErrorCode,
    initialKidsPricingMonth,
    learnerType,
    privateSelfAttend,
    selectedBranchIds,
    selectedChildIds,
    sessionsMap,
  ])
  const authoritativePreviewForComparison = previewRecord?.fingerprint === previewFingerprint ? previewRecord.preview.grossPrice : null
  const recommendedPackageId = recommendedPackage?.id
  const comparisonFingerprint = JSON.stringify([previewFingerprint, authoritativePreviewForComparison])
  useEffect(() => {
    if (!recommendedPackageId || authoritativePreviewForComparison === null) return
    const controller = new AbortController()
    const fingerprint = comparisonFingerprint
    void checkoutRequest<{ packages: BookingPackage[] }>('/api/booking-checkout?catalog=1', { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return
      const pack = result.packages.find(p => p.id === recommendedPackageId && p.quantity >= bookingSessionCount && p.quantity - bookingSessionCount <= 2)
      setPackages(result.packages)
      setComparison(pack ? { fingerprint, pack } : null)
    }).catch(() => { if (!controller.signal.aborted) setComparison(null) })
    return () => controller.abort()
  }, [recommendedPackageId, comparisonFingerprint, authoritativePreviewForComparison, bookingSessionCount])

  const availabilityFingerprint = useMemo(() => JSON.stringify({
    bookingId: editBooking?.id || null,
    courseTypeId: selectedCourseType?.id || null,
    candidates: availabilityCandidates.map(getBookingAvailabilitySlotKey).sort(),
  }), [availabilityCandidates, editBooking?.id, selectedCourseType?.id])
  const previewFingerprintRef = useRef(previewFingerprint)
  const availabilityFingerprintRef = useRef(availabilityFingerprint)

  useEffect(() => {
    previewFingerprintRef.current = previewFingerprint
  }, [previewFingerprint])

  useEffect(() => {
    availabilityFingerprintRef.current = availabilityFingerprint
  }, [availabilityFingerprint])

  const authoritativePreview = previewRecord?.fingerprint === previewFingerprint
    ? previewRecord.preview
    : null
  const authoritativeAvailability = availabilityRecord?.fingerprint === availabilityFingerprint
    ? availabilityRecord.availability
    : null
  const previewLoading = previewLoadingFingerprint === previewFingerprint
  const availabilityLoading = availabilityLoadingFingerprint === availabilityFingerprint

  const fetchAuthoritativePreview = useCallback(async (
    fingerprint: string,
    couponOverride: { id: string; discountAmount: number } | null,
  ) => {
    if (!selectedCourseType || bookingSessionCount <= 0) throw new Error('ข้อมูลคำนวณราคาไม่ครบ')
    previewAbortRef.current?.abort()
    const controller = new AbortController()
    previewAbortRef.current = controller
    setPreviewLoadingFingerprint(fingerprint)

    try {
      const response = await fetch('/api/bookings/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          bookingId: editBooking?.id || null,
          packageId: selectedPackage?.id, packageRevision: selectedPackage?.revision,
          courseTypeId: selectedCourseType.id,
          month: calMonth + 1,
          year: calYear,
          totalSessions: bookingSessionCount,
          couponId: couponOverride?.id || null,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        if (selectedCourseType.name === 'kids_group') throw task10RpcError(result.code || 'TASK10_UNAVAILABLE')
        throw new Error(result.error || 'คำนวณราคาไม่สำเร็จ')
      }
      const preview = result as AuthoritativeBookingPreview
      if (controller.signal.aborted || previewFingerprintRef.current !== fingerprint) {
        throw new DOMException('Stale preview response', 'AbortError')
      }
      setPreviewRecord({ fingerprint, preview })
      setPreviewFailure(null)
      return preview
    } catch (cause) {
      if (selectedCourseType.name === 'kids_group' && !controller.signal.aborted && previewFingerprintRef.current === fingerprint) {
        setPreviewRecord(null)
        const failure = task10RpcError(cause instanceof Error && 'code' in cause ? String(cause.code) : 'TASK10_UNAVAILABLE')
        setPreviewFailure({ fingerprint, code: failure.code, message: failure.message })
        throw new Error(failure.message)
      }
      if (!controller.signal.aborted && previewFingerprintRef.current === fingerprint) {
        setPreviewRecord(null)
        setPreviewFailure({ fingerprint, code: 'PRICE_PREVIEW_FAILED', message: cause instanceof Error ? cause.message : 'คำนวณราคาไม่สำเร็จ' })
      }
      throw cause
    } finally {
      if (previewAbortRef.current === controller) {
        previewAbortRef.current = null
        setPreviewLoadingFingerprint(null)
      }
    }
  }, [bookingSessionCount, calMonth, calYear, editBooking?.id, selectedCourseType, selectedPackage?.id, selectedPackage?.revision])

  const fetchAuthoritativeAvailability = useCallback(async (fingerprint: string) => {
    if (!selectedCourseType || availabilityCandidates.length === 0) {
      throw new Error('ข้อมูลรอบเรียนไม่ครบ')
    }
    availabilityAbortRef.current?.abort()
    const controller = new AbortController()
    availabilityAbortRef.current = controller
    setAvailabilityLoadingFingerprint(fingerprint)

    try {
      const response = await fetch('/api/bookings/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          bookingId: editBooking?.id || null,
          courseTypeId: selectedCourseType.id,
          slots: availabilityCandidates,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'ตรวจสอบที่ว่างไม่สำเร็จ')
      const availability = result as BookingAvailabilitySnapshot
      if (controller.signal.aborted || availabilityFingerprintRef.current !== fingerprint) {
        throw new DOMException('Stale availability response', 'AbortError')
      }
      setAvailabilityRecord({ fingerprint, availability })
      return availability
    } finally {
      if (availabilityAbortRef.current === controller) {
        availabilityAbortRef.current = null
        setAvailabilityLoadingFingerprint(null)
      }
    }
  }, [availabilityCandidates, editBooking?.id, selectedCourseType])

  useEffect(() => () => {
    previewAbortRef.current?.abort()
    availabilityAbortRef.current?.abort()
  }, [])

  useEffect(() => {
    if (!draftReady || !courseType || bookingSessionCount <= 0
      || (step !== 'calendar' && step !== 'summary')
      || previewRecord?.fingerprint === previewFingerprint
      || previewFailure?.fingerprint === previewFingerprint
      || previewLoadingFingerprint === previewFingerprint) return

    void fetchAuthoritativePreview(previewFingerprint, appliedCoupon).catch((previewError) => {
      if (!isAbortError(previewError)) {
        setError(previewError instanceof Error ? previewError.message : 'คำนวณราคาไม่สำเร็จ')
      }
    })
  }, [
    appliedCoupon,
    bookingSessionCount,
    courseType,
    draftReady,
    fetchAuthoritativePreview,
    previewFingerprint,
    previewFailure?.fingerprint,
    previewLoadingFingerprint,
    previewRecord?.fingerprint,
    step,
  ])

  useEffect(() => {
    if (!draftReady || courseType !== 'kids_group' || availabilityCandidates.length === 0
      || (step !== 'calendar' && step !== 'summary')
      || availabilityRecord?.fingerprint === availabilityFingerprint
      || availabilityLoadingFingerprint === availabilityFingerprint) return

    void fetchAuthoritativeAvailability(availabilityFingerprint).catch((availabilityError) => {
      if (!isAbortError(availabilityError)) {
        setError(availabilityError instanceof Error ? availabilityError.message : 'ตรวจสอบที่ว่างไม่สำเร็จ')
      }
    })
  }, [
    availabilityCandidates.length,
    availabilityFingerprint,
    availabilityLoadingFingerprint,
    availabilityRecord?.fingerprint,
    courseType,
    draftReady,
    fetchAuthoritativeAvailability,
    step,
  ])

  // Per-child price breakdown (proportional based on session count)
  const childPriceBreakdown = useMemo(() => {
    if (!pricing || courseType !== 'kids_group') return {}
    const map: Record<string, number> = {}
    const totalNew = allSelectedSessions.length
    const breakdownTotal = authoritativePreview?.grossPrice ?? totalBatchPrice
    selectedChildIds.forEach((cid) => {
      const count = (sessionsMap[cid] || []).length
      map[cid] = totalNew > 0 ? Math.round(breakdownTotal * count / totalNew) : 0
    })
    return map
  }, [pricing, courseType, selectedChildIds, sessionsMap, totalBatchPrice, allSelectedSessions.length, authoritativePreview])

  // Existing booked sessions for calendar display (filter by current month)
  const existingSessionsForCalendar = useMemo(() => {
    if (!editBooking) {
      return existingBookingSessions.filter((s) => {
        const d = new Date(s.date + 'T00:00:00')
        return d.getMonth() === calMonth && d.getFullYear() === calYear
      })
    }
    // In edit mode, exclude sessions from the booking being edited
    return existingBookingSessions.filter((s) => {
      if (s.booking_id === editBooking.id) return false
      const d = new Date(s.date + 'T00:00:00')
      return d.getMonth() === calMonth && d.getFullYear() === calYear
    })
  }, [existingBookingSessions, calMonth, calYear, editBooking])

  const getExistingSessionsForDate = (day: number) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return existingSessionsForCalendar.filter((s) => s.date === dateStr)
  }

  const sessionStatus = allSelectedSessions.length > 0 ? getSessionStatusLabel(allSelectedSessions.length) : null

  // Final price after coupon discount
  const displayedBasePrice = authoritativePreview?.grossPrice ?? totalBatchPrice
  const finalPrice = authoritativePreview
    ? authoritativePreview.totalPrice
    : appliedCoupon ? Math.max(0, totalBatchPrice - appliedCoupon.discountAmount) : totalBatchPrice
  const displayedDiscountAmount = authoritativePreview?.discountAmount ?? appliedCoupon?.discountAmount ?? 0
  const progressiveKidsPreview = courseType === 'kids_group' && authoritativePreview?.mode === 'progressive'
    ? authoritativePreview
    : null
  const selectedTier = authoritativePreview?.selectedTier || null
  const selectedPricingMonth = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`
  const policyMonthPending = initialKidsPricingMonth !== selectedPricingMonth
  const currentPreviewFailure = previewFailure?.fingerprint === previewFingerprint ? previewFailure : null
  const kidsPolicy = policyMonthPending || policyRefreshing || currentPreviewFailure
    ? null : authoritativePreview?.policy || initialKidsPricingPolicy
  const kidsPolicyBlocked = courseType === 'kids_group' && !kidsPolicy
  const kidsPolicyError = currentPreviewFailure?.message || initialKidsPricingError || task10RpcError('TASK10_UNAVAILABLE').message
  const kidsPolicyErrorCode = currentPreviewFailure?.code || initialKidsPricingErrorCode || 'TASK10_UNAVAILABLE'
  const pricingPreviewPending = Boolean(courseType && allSelectedSessions.length > 0 && (!selectedTier || kidsPolicyBlocked))
  const pricingWaitMessage = currentPreviewFailure || (kidsPolicyBlocked && !policyRefreshing && !policyMonthPending)
    ? 'ยังยืนยันราคาไม่ได้ กรุณาอ่านสถานะและราคาใหม่'
    : 'กำลังคำนวณราคา...'
  const isZeroCharge = Boolean(authoritativePreview && finalPrice === 0)

  useEffect(() => {
    if (!draftReady || courseType !== 'kids_group' || !policyMonthPending) return
    const url = new URL(window.location.href)
    url.searchParams.set('month', selectedPricingMonth)
    refreshPolicy(() => router.replace(url.pathname + url.search, { scroll: false }))
  }, [courseType, draftReady, policyMonthPending, router, selectedPricingMonth])

  useEffect(() => {
    setPreviewRecord(null)
    setPreviewFailure(null)
  }, [initialKidsPricingPolicy, initialKidsPricingError, initialKidsPricingMonth])

  const retryKidsPolicy = () => {
    setError(null)
    setPreviewRecord(null)
    setPreviewFailure(null)
    refreshPolicy(() => router.refresh())
  }

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    setCouponError(null)
    try {
      const res = await fetch('/api/validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim(), totalAmount: displayedBasePrice, courseTypeId: selectedCourseType?.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        setCouponError(json.error || 'คูปองไม่ถูกต้อง')
        setAppliedCoupon(null)
      } else {
        const nextCoupon = {
          id: json.coupon.id,
          code: json.coupon.code,
          discount_type: json.coupon.discount_type,
          discount_value: json.coupon.discount_value,
          discountAmount: json.discountAmount,
        }
        setAppliedCoupon(nextCoupon)
        setCouponError(null)
      }
    } catch {
      setCouponError('เกิดข้อผิดพลาด')
    }
    setCouponLoading(false)
  }

  const removeCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode('')
    setCouponError(null)
  }

  useEffect(() => {
    const couponBasePrice = authoritativePreview?.grossPrice
      ?? (courseType === 'kids_group' ? undefined : multiSingleSelection ? totalBatchPrice : selectedPackage?.price ?? totalBatchPrice)
    if (couponBasePrice === 0 && appliedCoupon) {
      setAppliedCoupon(null)
      setCouponCode('')
      setCouponError(null)
    }
  }, [appliedCoupon, authoritativePreview?.grossPrice, courseType, selectedPackage?.price, totalBatchPrice, multiSingleSelection])

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1)
    const lastDay = new Date(calYear, calMonth + 1, 0)
    const startDow = firstDay.getDay()
    const totalDays = lastDay.getDate()
    const days: (number | null)[] = []
    for (let i = 0; i < startDow; i++) days.push(null)
    for (let d = 1; d <= totalDays; d++) days.push(d)
    return days
  }, [calMonth, calYear])

  const getDateString = (day: number) => {
    return `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const getExistingConflictForSlot = (day: number, slot: TimeSlot, learnerKey = activeChildTab) => {
    const dateStr = getDateString(day)
    const start = slot.start.slice(0, 5)
    const end = slot.end.slice(0, 5)
    return existingSessionsForCalendar.find((session) => {
      const sessionLearnerKey = session.child_id || 'self'
      return (
        sessionLearnerKey === learnerKey &&
        session.date === dateStr &&
        session.start_time.slice(0, 5) === start &&
        session.end_time.slice(0, 5) === end
      )
    })
  }

  const getTodayStart = () => {
    const today = new Date(todayBangkok+'T00:00:00')
    today.setHours(0, 0, 0, 0)
    return today
  }

  const getSlotStart = (day: number, startTime: string) => {
    return new Date(`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}T${startTime.slice(0,5)}:00+07:00`)
  }

  const isSlotBookable = (day: number, slot: TimeSlot) => {
    const date = new Date(calYear, calMonth, day)
    const today = getTodayStart()
    if (date < today) return false
    if (!packageRoundWithinExpiry(packageExpiry, getDateString(day), slot.end)) return false
    return getSlotStart(day, slot.start).getTime() > (editBooking?.checkout_deadline ? Date.parse(editBooking.checkout_deadline) : Date.now() + 30 * 60000)
  }

  const getBookableSlots = (branchSlug: string, day: number) => {
    if (!courseType) return []
    const date = new Date(calYear, calMonth, day)
    const slots = getTemplateSlots(scheduleTemplates, branchSlug, courseType, date.getDay(), date)
    return slots.filter((slot) => isSlotBookable(day, slot))
  }

  const isSelectedSessionStillBookable = (session: { date: string; start: string }) => {
    const [year, month, day] = session.date.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    const today = getTodayStart()
    if (date < today) return false

    const slotStart = new Date(session.date+'T'+session.start.slice(0,5)+':00+07:00')
    return slotStart.getTime() > (editBooking?.checkout_deadline ? Date.parse(editBooking.checkout_deadline) : Date.now() + 30 * 60000)
  }

  const isDateSelectable = (day: number) => {
    if (selectedBranchIds.length === 0 || !courseType) return false
    const date = new Date(calYear, calMonth, day)
    const today = getTodayStart()
    if (date < today) return false
    return selectedBranches.some((b) => hasTemplateSlots(scheduleTemplates, b.slug, courseType, date) && getBookableSlots(b.slug, day).length > 0)
  }

  const isDateSelected = (day: number) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return activeSessions.some((s) => s.date === dateStr)
  }

  const getDateSessions = (day: number) => {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return activeSessions.filter((s) => s.date === dateStr)
  }

  const availabilityBySlotKey = useMemo(() => new Map(
    (authoritativeAvailability?.slots || []).map((slot) => [slot.key, slot]),
  ), [authoritativeAvailability])
  const requestedAvailabilitySlotKeys = useMemo(
    () => new Set(requestedAvailabilitySlots.map(getBookingAvailabilitySlotKey)),
    [requestedAvailabilitySlots],
  )
  const selectedAvailabilityIssues = useMemo(() => (
    authoritativeAvailability?.mode === 'progressive'
      ? authoritativeAvailability.slots.filter((slot) => (
          requestedAvailabilitySlotKeys.has(slot.key) && !slot.valid
        ))
      : []
  ), [authoritativeAvailability, requestedAvailabilitySlotKeys])

  const getAvailabilityForSlot = (day: number, slot: TimeSlot, branchId: string) => (
    availabilityBySlotKey.get(getBookingAvailabilitySlotKey({
      date: getDateString(day),
      startTime: slot.start,
      endTime: slot.end,
      branchId,
      scheduleTemplateId: slot.templateId || null,
    })) || null
  )

  const formatAvailabilityIssue = (slot: BookingSlotAvailability) => {
    const dateTime = `${formatThaiDateWithWeekday(slot.date)} ${fmtTime(slot.startTime)}–${fmtTime(slot.endTime)}`
    return `รอบ${dateTime} ไม่พร้อมให้จองแล้ว กรุณาเลือกรอบเรียนใหม่`
  }

  const handleDayClick = (day: number) => {
    if (!isDateSelectable(day)) return
    const dateStr = getDateString(day)
    setExpandedDate(expandedDate === dateStr ? null : dateStr)
  }

  const handleSlotSelect = (day: number, slot: TimeSlot, slotBranchId: string) => {
    if (!isSlotBookable(day, slot)) return
    if (getExistingConflictForSlot(day, slot)) {
      setError('ผู้เรียนคนนี้มีรอบเรียนเวลาเดียวกันอยู่แล้ว กรุณาเลือกรอบอื่น')
      return
    }
    const dateStr = getDateString(day)
    const date = new Date(calYear, calMonth, day)
    const key = activeChildTab
    const current = sessionsMap[key] || []
    const existing = current.find((s) => s.date === dateStr && s.start === slot.start && s.branchId === slotBranchId)
    if (existing) {
      setSessionsMap((prev) => ({ ...prev, [key]: current.filter((s) => !(s.date === dateStr && s.start === slot.start && s.branchId === slotBranchId)) }))
    } else {
      if (courseType !== 'kids_group' && selectedPackage && !multiSingleSelection && current.length >= selectedPackage.quantity) {
        setError(`แพ็กเกจนี้เลือกได้ ${selectedPackage.quantity} รอบ กรุณานำรอบเดิมออกก่อนเลือกวันใหม่`)
        return
      }
      if (courseType === 'kids_group' && !authoritativeAvailability) {
        setError('กำลังตรวจสอบที่ว่าง กรุณารอสักครู่')
        return
      }
      const slotAvailability = getAvailabilityForSlot(day, slot, slotBranchId)
      if (authoritativeAvailability?.mode === 'progressive' && !slotAvailability) {
        setError('ยังยืนยันที่ว่างของรอบนี้ไม่ได้ กรุณาลองใหม่อีกครั้ง')
        return
      }
      if (authoritativeAvailability?.mode === 'progressive' && slotAvailability) {
        if (!slotAvailability.valid) {
          setError(formatAvailabilityIssue(slotAvailability))
          return
        }
      }
      setSessionsMap((prev) => ({
        ...prev,
        [key]: [
          ...current,
          {
            date: dateStr,
            dayOfWeek: date.getDay(),
            start: slot.start,
            end: slot.end,
            branchId: slotBranchId,
            scheduleTemplateId: slot.templateId || null,
          },
        ],
      }))
    }
  }

  const removeSession = (key: string, index: number) => {
    const current = sessionsMap[key] || []
    setSessionsMap((prev) => ({ ...prev, [key]: current.filter((_, i) => i !== index) }))
  }

  const goNext = async () => {
    if (kidsPolicyBlocked) return
    if (packageExpiry && allSelectedSessions.some(s => !packageRoundWithinExpiry(packageExpiry, s.date, s.end))) { setError(PACKAGE_DATE_ERROR); return }
    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      if (step === 'calendar' && STEPS[nextIndex].key === 'summary') {
        setError(null)
        try {
          const previousPreview = authoritativePreview
          const refreshedPreviewPromise = fetchAuthoritativePreview(previewFingerprint, appliedCoupon)
          const refreshedAvailabilityPromise = courseType === 'kids_group'
            ? fetchAuthoritativeAvailability(availabilityFingerprint)
            : Promise.resolve<BookingAvailabilitySnapshot | null>(null)
          const [refreshedPreview, refreshedAvailability] = await Promise.all([
            refreshedPreviewPromise,
            refreshedAvailabilityPromise,
          ])
          const availabilityIssues = refreshedAvailability?.mode === 'progressive'
            ? refreshedAvailability.slots.filter((slot) => (
                requestedAvailabilitySlotKeys.has(slot.key) && !slot.valid
              ))
            : []
          if (availabilityIssues.length > 0) {
            setError(formatAvailabilityIssue(availabilityIssues[0]))
            return
          }
          if (previousPreview && !isSameVisiblePreview(previousPreview, refreshedPreview)) {
            setNotice('ราคาปัจจุบันได้รับการอัปเดตจากระบบแล้ว กรุณาตรวจสอบยอดล่าสุดก่อนยืนยัน')
          }
        } catch (previewError) {
          if (isAbortError(previewError)) return
          setError(previewError instanceof Error ? previewError.message : 'คำนวณราคาไม่สำเร็จ')
          return
        }
      }
      // When entering calendar, set activeChildTab
      if (STEPS[nextIndex].key === 'calendar') {
        if (selectedBranchIds.length === 0 && branches.length === 1) setSelectedBranchIds([branches[0].id])
        if (courseType === 'kids_group' && selectedChildIds.length > 0) {
          setActiveChildTab(selectedChildIds[0])
        } else {
          setActiveChildTab('self')
        }
      }
      setStep(STEPS[nextIndex].key)
    }
  }
  const goBack = () => {
    if (isEditMode && step === 'calendar') return // Can't go back before calendar in edit mode
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) setStep(STEPS[prevIndex].key)
  }
  const canGoNext = () => {
    if (kidsPolicyBlocked) return false
    switch (step) {
      case 'type': return !!courseType && (courseType === 'kids_group' || !!selectedPackage)
      case 'learner':
        if (courseType === 'kids_group') return selectedChildIds.length > 0
        if (courseType === 'private') return privateSelfAttend || selectedChildIds.length > 0
        return !!learnerType
      case 'branch': return selectedBranchIds.length > 0
      case 'calendar': return selectedBranchIds.length > 0 && (courseType === 'kids_group' ? selectedChildIds.length > 0 && allSelectedSessions.length > 0 : (isEditMode && !editBooking?.package_snapshot ? allSelectedSessions.length > 0 : !!selectedPackage && (selectedPackage.quantity > 1 || allSelectedSessions.length > 0) && (multiSingleSelection || allSelectedSessions.length <= selectedPackage.quantity)) && (courseType !== 'private' || privateSelfAttend || selectedChildIds.length > 0))
      default: return false
    }
  }

  const submissionBusy = useRef(false)
  const handleSubmitBooking = async () => {
    if (submissionBusy.current || uncertainCreate || kidsPolicyBlocked || (!isEditMode && !canGoNext())) return
    submissionBusy.current = true
    setLoading(true)
    setError(null)

    const courseTypeRow = courseTypes.find((ct) => ct.name === courseType)
    if (!courseTypeRow) {
      setError('ไม่พบประเภทคอร์สในระบบ')
      setLoading(false)
      submissionBusy.current = false
      return
    }

    try {
      const primaryBranchId = selectedBranchIds[0] || null

      // Always create 1 booking = 1 bill regardless of number of learnerChildren
      const isKids = courseType === 'kids_group'
      const singleChildId = isKids && selectedChildIds.length === 1 ? selectedChildIds[0] : null

      // Gather all sessions with child_id
      const allSessions: (SelectedSession & { childId: string | null })[] = []
      if (isKids) {
        for (const childId of selectedChildIds) {
          const childSessions = sessionsMap[childId] || []
          childSessions.forEach((s) => allSessions.push({ ...s, childId }))
        }
      } else if (courseType === 'private') {
        // Private: create one session per attendee per time slot
        const slots = sessionsMap['self'] || []
        for (const s of slots) {
          if (privateSelfAttend) {
            allSessions.push({ ...s, childId: null })
          }
          for (const childId of selectedChildIds) {
            allSessions.push({ ...s, childId })
          }
        }
      } else {
        const selfSessions = sessionsMap['self'] || []
        selfSessions.forEach((s) => allSessions.push({ ...s, childId: null }))
      }

      if (allSessions.length === 0 && !(selectedPackage && selectedPackage.quantity > 1 && (!isEditMode || editBooking?.package_snapshot))) {
        setError('กรุณาเลือกวันเรียนอย่างน้อย 1 วัน')
        setLoading(false)
        return
      }

      const liveExpiry = courseType !== 'kids_group' ? packageExpiryAt(selectedPackage, Date.now() + serverClockOffset.current) : null
      if (allSessions.some(s => !packageRoundWithinExpiry(liveExpiry, s.date, s.end))) {
        setError(PACKAGE_DATE_ERROR); setStep('calendar'); setLoading(false); return
      }
      const expiredSession = allSessions.find((session) => !isSelectedSessionStillBookable(session))
      if (expiredSession) {
        setError(`รอบ ${fmtTime(expiredSession.start)}-${fmtTime(expiredSession.end)} วันที่ ${formatThaiDateWithWeekday(expiredSession.date)} เริ่มไปแล้ว กรุณาเลือกรอบเรียนใหม่`)
        setLoading(false)
        return
      }

      // For private: total_sessions = unique time slots (not per-attendee records)
      const bookingTotalSessions = multiSingleSelection ? (sessionsMap.self || []).length : courseType === 'kids_group' || isEditMode && !editBooking?.package_snapshot ? allSessions.length : selectedPackage?.quantity || allSessions.length

      const previousPreview = authoritativePreview
      const refreshedPreviewPromise = fetchAuthoritativePreview(previewFingerprint, appliedCoupon)
      const refreshedAvailabilityPromise = isKids
        ? fetchAuthoritativeAvailability(availabilityFingerprint)
        : Promise.resolve<BookingAvailabilitySnapshot | null>(null)
      const [submissionPreview, submissionAvailability] = await Promise.all([
        refreshedPreviewPromise,
        refreshedAvailabilityPromise,
      ])
      const availabilityIssues = submissionAvailability?.mode === 'progressive'
        ? submissionAvailability.slots.filter((slot) => (
             requestedAvailabilitySlotKeys.has(slot.key) && !slot.valid
          ))
        : []
      if (availabilityIssues.length > 0) {
        setStep('calendar')
        setError(formatAvailabilityIssue(availabilityIssues[0]))
        setLoading(false)
        return
      }
      if (previousPreview && !isSameVisiblePreview(previousPreview, submissionPreview)) {
        setNotice('ราคาได้รับการอัปเดตจากระบบแล้ว กรุณาตรวจสอบยอดล่าสุดและกดยืนยันอีกครั้ง')
        setLoading(false)
        return
      }

      const submissionGrossPrice = submissionPreview.grossPrice
      const submissionFinalPrice = submissionPreview.totalPrice

      if (isEditMode && editBooking) {
        try { sessionStorage.setItem(uncertainStorageKey,clientRequestId) } catch {}
        uncertainRequest.current=clientRequestId
        const response = await fetch('/api/bookings', {
          signal: AbortSignal.timeout(15000),
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participants: courseType === 'adult_group' ? [null] : [...(privateSelfAttend ? [null] : []), ...selectedChildIds],
            bookingId: editBooking.id,
            branchId: primaryBranchId,
            courseTypeId: courseTypeRow.id,
            month: calMonth + 1,
            year: calYear,
            totalSessions: bookingTotalSessions,
            totalAmount: submissionFinalPrice,
            expectedTotalPrice: submissionFinalPrice,
            sessions: allSessions.map((s) => ({
              date: s.date,
              startTime: s.start,
              endTime: s.end,
              branchId: s.branchId,
              childId: s.childId,
              scheduleTemplateId: s.scheduleTemplateId,
            })),
            clientRequestId,
            expectedScopeRevision: submissionPreview.expectedScopeRevision,
            expectedPolicyFingerprint: submissionPreview.policy?.fingerprint || null,
          }),
        })

        const result = await response.json()
        if (!response.ok) {
          if(response.status>=500||result.definitive===false||result.requiresReadback){setUncertainCreate(true);setError('ยังยืนยันผลการแก้รายการไม่ได้ กรุณาตรวจผลคำขอเดิมก่อน');setLoading(false);return}
          try {sessionStorage.removeItem(uncertainStorageKey)}catch{}
          setError(result.error || 'Update booking failed. Please try again.')
          setLoading(false)
          return
        }

        clearStoredDraft()
        try {sessionStorage.removeItem(uncertainStorageKey)}catch{}
        router.push('/dashboard/booking?payment=' + encodeURIComponent(editBooking.id))
        router.refresh()
      } else {
        // New booking mode
        try { sessionStorage.setItem(uncertainStorageKey, clientRequestId) } catch {}
        uncertainRequest.current = clientRequestId
        const response = await fetch('/api/booking-checkout', {
          signal: AbortSignal.timeout(15000),
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', requestId: clientRequestId, input: {
            purchasePolicyVersion: 2,
            packageId: selectedPackage?.id, packageRevision: selectedPackage?.revision,
            participants: courseType === 'adult_group' ? [null] : [...(privateSelfAttend ? [null] : []), ...selectedChildIds],
            learnerType: isKids ? 'child' : (learnerType || 'self'),
            childId: singleChildId,
            branchId: primaryBranchId,
            courseTypeId: courseTypeRow.id,
            month: calMonth + 1,
            year: calYear,
            totalSessions: bookingTotalSessions,
            totalAmount: submissionGrossPrice,
            expectedTotalPrice: submissionFinalPrice,
            sessions: allSessions.map((s) => ({
              date: s.date,
              startTime: s.start,
              endTime: s.end,
              branchId: s.branchId,
              childId: s.childId,
              scheduleTemplateId: s.scheduleTemplateId,
            })),
            coupon: appliedCoupon && submissionGrossPrice > 0 ? {
              id: appliedCoupon.id,
              code: appliedCoupon.code,
            } : null,
            clientRequestId,
            expectedScopeRevision: submissionPreview.expectedScopeRevision,
            expectedLegacyBaselineSessions: submissionPreview.legacyBaselineSessions,
            expectedLegacyBaselineFingerprint: submissionPreview.legacyBaselineFingerprint,
            expectedPolicyFingerprint: submissionPreview.policy?.fingerprint || null,
          } }),
        })

        const result = await response.json()
        if (!response.ok) {
          if(response.status>=500||result.definitive===false||result.requiresReadback){setUncertainCreate(true);setError('ยังยืนยันผลการจองไม่ได้ กรุณาตรวจผลคำขอเดิมก่อน');setLoading(false);return}
          try { sessionStorage.removeItem(uncertainStorageKey) } catch {}
          setError(result.error || 'สร้างการจองไม่สำเร็จ กรุณาลองใหม่')
          setLoading(false)
          return
        }

        clearStoredDraft()
        try { sessionStorage.removeItem(uncertainStorageKey) } catch {}
        router.push('/dashboard/booking?payment=' + encodeURIComponent(result.bookingId))
        router.refresh()
      }
    } catch (submitError) {
      setUncertainCreate(true)
      setError(isAbortError(submitError)
        ? 'การเชื่อมต่อขาดระหว่างยืนยัน กรุณาตรวจผลคำขอเดิมก่อน'
        : 'ยังยืนยันผลการจองไม่ได้ กรุณาตรวจผลคำขอเดิมก่อน')
      setLoading(false)
    } finally {
      submissionBusy.current = false
    }
  }

  const acceptInlineChild=(child:Child)=>{
    setLearnerChildren(old=>old.some(c=>c.id===child.id)?old:[...old,child])
    setSelectedChildIds(old=>[...new Set([...old,child.id])]);setActiveChildTab(courseType==='kids_group'?child.id:'self')
    childRequest.current='';setChildName('');setChildNickname('');setChildUnknown(false);setShowChildForm(false)
    try{sessionStorage.removeItem('nabs:child-pending:'+userId)}catch{}
  }

  return (
    <div>
      {/* Progress Steps */}
      <BookingFlowSteps step={currentStepIndex} />

      <div className="mb-4 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
        กลับมาจองต่อในเครื่องนี้ได้ ข้อมูลที่เลือกจะเก็บไว้ชั่วคราว
      </div>

      {draftRestored && (
        <div className="mb-4 flex flex-col gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>กู้คืนแบบร่างการจองล่าสุดแล้ว</span>
          </div>
          <Button size="sm" variant="outline" disabled={loading || uncertainCreate} onClick={clearStoredDraft} className="border-green-300 text-green-700 hover:bg-green-100">
            ล้างแบบร่าง
          </Button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md border border-red-200 mb-4 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {notice && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          <AlertCircle className="h-4 w-4 shrink-0" />{notice}
        </div>
      )}

      {kidsPolicyBlocked && (
        <div data-testid="kids-pricing-status" data-policy-code={policyMonthPending || policyRefreshing ? 'LOADING' : kidsPolicyErrorCode} role="alert" className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>{policyMonthPending || policyRefreshing ? 'กำลังอ่านสถานะและชุดราคาคอร์สเด็ก...' : kidsPolicyError}</p>
          <Button className="mt-2" variant="outline" onClick={retryKidsPolicy} disabled={policyRefreshing || policyMonthPending}>อ่านสถานะและราคาใหม่</Button>
        </div>
      )}

      {/* Step 1: Course Type */}
      {step === 'type' && (
        <div className="space-y-6">
          <div className={"grid grid-cols-1 gap-4 rounded-xl md:grid-cols-3 " + (!courseType ? "border border-red-500 p-2" : "")}>
            {COURSE_TYPES.map((ct) => (
              <Card key={ct.value} role="button" tabIndex={draftReady ? 0 : -1} aria-disabled={!draftReady} aria-pressed={courseType === ct.value} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} className={`cursor-pointer transition-all hover:shadow-md ${courseType === ct.value ? 'border-2 border-[#2748bf] shadow-md' : 'border hover:border-[#2748bf]/30'}`}
                onClick={() => {
                  if (!draftReady || courseType === ct.value) return
                  const previous=previousBookings.find(p=>p.course===ct.value)
                  const childIds=previous ? previous.participants.filter((id):id is string=>Boolean(id)&&learnerChildren.some(c=>c.id===id)) : ct.value==='kids_group'&&learnerChildren.length===1?[learnerChildren[0].id]:[]
                  const branchIds=previous ? previous.branchIds.filter(id=>branches.some(b=>b.id===id)) : branches.length===1?[branches[0].id]:[]
                  const pack=previous&&packages.find(p=>p.course===ct.value&&p.id===previous.packageId)
                  setCourseType(ct.value);setPackageId(pack?.id||'');setLearnerType(ct.value==='kids_group'?'child':'self');setSelectedChildIds(childIds)
                  setActiveChildTab(ct.value==='kids_group'?childIds[0]||'self':'self');setPrivateSelfAttend(ct.value==='private'&&Boolean(previous?.participants.includes(null)));setSelectedBranchIds(branchIds);setSessionsMap({});setExpandedDate(null)
                  setNotice(previous ? 'ใช้ข้อมูลครั้งก่อนให้แล้ว เลือกวันเรียนใหม่ได้เลย · ครั้งก่อน '+previous.quantity+' '+(ct.value==='private'?'ชั่วโมง':'ครั้ง')+(branchIds.length<previous.branchIds.length||childIds.length<previous.participants.filter(Boolean).length?' · ข้อมูลบางส่วนใช้ต่อไม่ได้ กรุณาเลือกส่วนที่ยังว่างใหม่':'') : '')
                }}>
                <CardContent className="p-6 text-center">
                  <div className="w-14 h-14 bg-[#2748bf]/10 rounded-xl flex items-center justify-center mx-auto mb-3"><ct.icon className="h-7 w-7 text-[#2748bf]" /></div>
                  <h3 className="font-bold text-lg mb-1">{ct.label}</h3>
                  <p className="text-sm text-gray-500">{ct.desc}</p>
                  {courseType === ct.value && <Badge className="mt-3 bg-[#2748bf]">เลือกแล้ว</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>

          {!courseType && <p className="text-sm text-red-700">กรุณาเลือกประเภทคอร์ส</p>}
          {courseType && courseType !== 'kids_group' && <section className={'grid gap-3 rounded-xl sm:grid-cols-3 '+(!packageId?'border border-red-500 p-2':'')} aria-label="เลือกแพ็กเกจ">
            {packages.filter(p => p.course === courseType).map(p => <button type="button" key={p.id} data-testid={'package-' + p.id} aria-pressed={packageId === p.id}
              className={'rounded-xl border-2 p-5 text-left ' + (packageId === p.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white')}
              onClick={() => { setPackageId(p.id); setSessionsMap({}) }}>
              <p className="font-semibold">{p.quantity === 1 ? (p.course === 'private' ? 'รายชั่วโมง · เลือกได้หลายชั่วโมง' : 'รายครั้ง · เลือกได้หลายครั้ง') : p.quantity + (p.course === 'private' ? ' ชั่วโมง' : ' ครั้ง')}</p>
              <p className="my-2 text-2xl font-bold text-[#153c85]">฿{p.price.toLocaleString()}</p>
              <p className="text-sm text-gray-600">{packageValidityDescription(p, packageReference)}</p>
            </button>)}
          </section>}
          {courseType && courseType!=='kids_group' && !packageId && <p className="text-sm text-red-700">กรุณาเลือกแพ็กเกจ</p>}
          {/* Pricing Table */}
          {courseType && (
            <Card className={courseType === 'kids_group' ? '' : 'hidden'}>
              <CardContent className="p-4">
                <h4 className="font-bold text-[#153c85] mb-3">ตารางราคา — {COURSE_TYPES.find((c) => c.value === courseType)?.label}</h4>
                {courseType === 'kids_group' && kidsPolicy && (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-gray-500">
                            <th className="pb-2 pr-4">{kidsPolicy.pricingMode === 'per_bill_v1' ? 'จำนวนครั้งในบิล' : 'จำนวนครั้ง/เดือน'}</th>
                            <th className="pb-2 pr-4 text-right">ราคา/ครั้ง</th>
                            <th className="pb-2 text-right">ตัวอย่าง (7 ครั้ง)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getKidsGroupTiers(pricingTiers as PricingTierInput[]).map((t) => (
                            <tr key={t.min} className="border-b last:border-0">
                              <td className="py-2 pr-4 font-medium">{kidsPolicy.pricingMode === 'per_bill_v1' ? t.label.replace('/เดือน', '/บิล') : t.label}</td>
                              <td className="py-2 pr-4 text-right text-[#2748bf] font-medium">{t.per_session} บาท</td>
                              <td className="py-2 text-right text-gray-500">
                                {t.min <= 7 && (t.max === null || t.max >= 7) ? `${(t.per_session * 7).toLocaleString()} บาท` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">* ผู้เรียนพี่น้องนับจำนวนครั้งรวมกันเพื่อเลือกช่วงราคา</p>
                    {kidsPolicy.catalog ? <p className="text-xs text-gray-500 mt-2">
                      {kidsPolicy.catalog.regime === 'early' ? 'ชุดราคาปกติ' : 'ชุดราคาครึ่งเดือน'}
                      {editBooking ? ' · ใช้ชุดราคาที่บันทึกไว้ของบิลเดิม' : kidsPolicy.selectionRuleVersion === 'kids_same_month_v2'
                        ? ' · ราคาครึ่งเดือนใช้เมื่อจองวันที่ 16–สิ้นเดือนเพื่อเรียนในเดือนและปีเดียวกัน จองล่วงหน้าเดือนอื่นใช้ราคาปกติ'
                        : ' · ชุดราคาตามวันที่จองที่ระบบยืนยัน'}
                      {' · ระบบตรวจราคาก่อนยืนยันการจอง'}
                    </p> : null}
                  </>
                )}
                {courseType === 'adult_group' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-500">
                          <th className="pb-2 pr-4">แพ็กเกจ</th>
                          <th className="pb-2 pr-4 text-right">ราคา</th>
                          <th className="pb-2 text-right">เฉลี่ย/ครั้ง</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getAdultGroupTiers(pricingTiers as PricingTierInput[]).map((t) => (
                          <tr key={t.min} className="border-b last:border-0">
                            <td className="py-2 pr-4 font-medium">{t.label}{t.expiry_months ? ` (หมดอายุ ${t.expiry_months} เดือน)` : ''}</td>
                            <td className="py-2 pr-4 text-right text-[#2748bf] font-medium">{t.package_price.toLocaleString()} บาท</td>
                            <td className="py-2 text-right text-gray-500">{t.per_session} บาท</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {courseType === 'private' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-500">
                          <th className="pb-2 pr-4">แพ็กเกจ</th>
                          <th className="pb-2 pr-4 text-right">ราคา</th>
                          <th className="pb-2 text-right">เฉลี่ย/ชม.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getPrivateTiers(pricingTiers as PricingTierInput[]).map((t) => (
                          <tr key={t.min} className="border-b last:border-0">
                            <td className="py-2 pr-4 font-medium">{t.label}{t.expiry_months ? ` (หมดอายุ ${t.expiry_months} เดือน)` : ''}</td>
                            <td className="py-2 pr-4 text-right text-[#2748bf] font-medium">{t.package_price.toLocaleString()} บาท</td>
                            <td className="py-2 text-right text-gray-500">{t.per_hour} บาท</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {uncertainCreate && <div role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
        <p>ยังตรวจผลการจองไม่ได้ กรุณาตรวจคำขอเดิมก่อนสร้างรายการใหม่</p>
        <Button className="mt-3" disabled={loading} onClick={async () => {
          setLoading(true)
          try {
            const result = await checkoutRequest<{found:boolean;result?:{bookingId:string}}>('/api/booking-checkout?requestId=' + (uncertainRequest.current || clientRequestId) + '&operation=' + (isEditMode ? 'update&bookingId=' + editBooking.id : 'create'))
            if (result.found && result.result) { clearStoredDraft(); sessionStorage.removeItem(uncertainStorageKey); router.push('/dashboard/booking?payment=' + result.result.bookingId) }
            else { setUncertainCreate(false); setNotice('ยังไม่พบรายการจากคำขอเดิม สามารถยืนยันรายการเดิมได้อีกครั้ง') }
          } catch { setError('ยังตรวจผลไม่ได้ กรุณาลองตรวจผลเดิมอีกครั้งเมื่อเชื่อมต่อได้') }
          finally { setLoading(false) }
        }}>ตรวจสอบผลเดิม</Button>
      </div>}
      <fieldset disabled={loading || uncertainCreate} className="min-w-0 border-0 p-0">
      {step === 'calendar' && (courseType === 'kids_group' && learnerChildren.length === 0 || showChildForm) && <form
        className={"mb-6 space-y-3 rounded-xl border p-5 " + (courseType==='kids_group'&&!learnerChildren.length?'border-red-500 bg-red-50':'border-orange-200 bg-orange-50')}
        onSubmit={async event => {
          event.preventDefault(); setAddingChild(true); setError(null); childRequest.current ||= crypto.randomUUID()
          try{sessionStorage.setItem('nabs:child-pending:'+userId,JSON.stringify({request:childRequest.current}))}catch{}
          try {
            const result = await checkoutRequest<{child:Child}>('/api/booking-children', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:childRequest.current,fullName:childName,nickname:childNickname})})
            acceptInlineChild(result.child)
          } catch(e) { setChildUnknown(true);setError(e instanceof Error ? e.message : 'ยังบันทึกข้อมูลลูกไม่ได้') }
          finally { setAddingChild(false) }
        }}>
        <h3 className="font-bold text-[#153c85]">ใครจะมาเรียน?</h3><p className="text-sm">เพิ่มข้อมูลผู้เรียนที่นี่ แล้วเลือกสาขาและวันเรียนต่อได้เลย</p>
        <Label htmlFor="booking-child-name">ชื่อ–นามสกุลผู้เรียน</Label>
        <Input id="booking-child-name" aria-invalid={!childName.trim() || undefined} className={!childName.trim()?'border-red-500':''} required maxLength={200} value={childName} onChange={e => setChildName(e.target.value)} disabled={addingChild||childUnknown}/>
        <Label htmlFor="booking-child-nickname">ชื่อเล่น (ถ้ามี)</Label>
        <Input id="booking-child-nickname" maxLength={100} value={childNickname} onChange={e => setChildNickname(e.target.value)} disabled={addingChild||childUnknown}/>
        <Button type="submit" disabled={addingChild || childUnknown || !childName.trim()}>{addingChild ? 'กำลังบันทึก...' : 'บันทึกและเลือกวันเรียนต่อ'}</Button>
        {childUnknown&&<div className="text-sm"><p>ยังยืนยันผลเพิ่มผู้เรียนไม่ได้ กรุณาตรวจคำขอเดิมก่อน</p><Button type="button" className="mt-2" variant="outline" disabled={addingChild} onClick={async()=>{setAddingChild(true);try{const r=await checkoutRequest<{found:boolean;result?:Child}>('/api/booking-checkout?operation=child&requestId='+childRequest.current);if(r.found&&r.result){acceptInlineChild(r.result);setError(null)}else{setChildUnknown(false);setError('ยังไม่พบข้อมูลจากคำขอเดิม สามารถบันทึกชื่อเดิมอีกครั้งได้')}}catch{setError('ยังตรวจผลไม่ได้ กรุณาลองตรวจคำขอเดิมเมื่อเชื่อมต่อได้')}finally{setAddingChild(false)}}}>ตรวจสอบการเพิ่มผู้เรียนเดิม</Button></div>}
      </form>}
      {step === 'calendar' && courseType !== 'adult_group' && (courseType === 'private' || learnerChildren.length > 0) && <Button variant="outline" className="mb-4" onClick={() => setShowChildForm(v => !v)}>{showChildForm ? 'ซ่อนแบบฟอร์มเพิ่มผู้เรียน' : 'เพิ่มผู้เรียนอีกคน'}</Button>}
      {step === 'calendar' && (courseType !== 'kids_group' || learnerChildren.length > 0) && <div className="grid gap-3 md:grid-cols-2">
        {courseType === 'adult_group' ? <div className="rounded-xl border bg-white p-3"><p className="text-xs text-gray-500">ผู้เรียน</p><p className="font-semibold text-[#153c85]">{userName} · ตัวเอง</p></div> : <BookingChoice title="ผู้เรียน" options={[...(courseType === 'private' ? [{id:'self',label:userName,description:'ตัวเอง · Private เรียนรอบเดียวกันทุกคน'}] : []),...learnerChildren.map(c=>({id:c.id,label:formatLearnerDisplayName({fullName:c.full_name,nickname:c.nickname})}))]} selected={[...(courseType === 'private' && privateSelfAttend ? ['self'] : []),...selectedChildIds]} removalCount={ids=>courseType === 'kids_group' ? selectedChildIds.filter(id=>!ids.includes(id)).reduce((n,id)=>n+(sessionsMap[id]||[]).length,0) : 0} onApply={ids=>{const childIds=ids.filter(id=>id!=='self');setSelectedChildIds(childIds);if(courseType==='private')setPrivateSelfAttend(ids.includes('self'));if(courseType==='kids_group'){setSessionsMap(prev=>Object.fromEntries(Object.entries(prev).filter(([id])=>childIds.includes(id))));setActiveChildTab(childIds.includes(activeChildTab)?activeChildTab:childIds[0]||'self')}setExpandedDate(null)}} />}
        {(courseType === 'adult_group' || selectedChildIds.length > 0 || privateSelfAttend) && <BookingChoice title="สาขา" options={branches.map(b=>({id:b.id,label:b.name,description:b.address||undefined}))} selected={selectedBranchIds} removalCount={ids=>Object.values(sessionsMap).flat().filter(s=>!ids.includes(s.branchId)).length} onApply={ids=>{setSelectedBranchIds(ids);setSessionsMap(prev=>Object.fromEntries(Object.entries(prev).map(([id,rounds])=>[id,rounds.filter(s=>ids.includes(s.branchId))])));setExpandedDate(null)}} />}
      </div>}

      {/* Step 4: Calendar — เลือกวันเรียน */}
      {step === 'calendar' && hasCalendarLearner && selectedPackage && (!isEditMode || editBooking?.package_snapshot) && <section className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
        <p className="font-semibold">{singleSelection ? 'รายครั้ง · เลือกแล้ว ' + (sessionsMap.self || []).length + (courseType === 'private' ? ' ชั่วโมง' : ' ครั้ง') : 'ซื้อ ' + selectedPackage.quantity + (courseType === 'private' ? ' ชั่วโมง' : ' ครั้ง') + ' · เลือกแล้ว ' + (sessionsMap.self || []).length + ' · คงเหลือ ' + (selectedPackage.quantity - (sessionsMap.self || []).length)}</p>
        <p className="mt-2" data-testid="booking-package-expiry">{packageValidityDescription(selectedPackage, packageReference)}</p>
        {selectedPackage.quantity > 1 && <p className="mt-1 text-xs">{PACKAGE_DURATION_RULE}</p>}
        {recommendedPackage && comparison?.fingerprint === comparisonFingerprint && authoritativePreview && <BookingPackageRecommendation pack={comparison.pack} selectedQuantity={bookingSessionCount} singleRate={authoritativePreview.selectedTier.pricePerSession} reference={packageReference} onSelect={() => { setPackageId(comparison.pack.id); setPreviewRecord(null); setNotice('เปลี่ยนเป็นคอร์สแล้ว วันเรียนที่เลือกยังอยู่ กรุณาตรวจยอดและคูปองล่าสุดก่อนยืนยัน') }} />}
        {selectedPackage.quantity > 1 && <Button className="mt-3" variant="outline" disabled={loading || uncertainCreate || !selectedBranchIds.length || courseType !== 'adult_group' && !privateSelfAttend && !selectedChildIds.length} onClick={() => { setSessionsMap({}); setNotice('ซื้อแพ็กเกจเต็มจำนวน และเก็บสิทธิไว้เลือกวันหลังยืนยันชำระแล้ว');if(isEditMode)setStep('summary') }}>ซื้อแพ็กเกจแล้วเลือกวันภายหลัง</Button>}
      </section>}
      {step === 'calendar' && hasCalendarLearner && selectedBranches.length > 0 && courseType && (
        <div className="space-y-4">
          <BookingCalendarHeading title={selectedBranches.map(b => b.name).join(', ')} month={calendarMonthDisplay}
            previousDisabled={isEditMode && singleSelection || calMonth === now.getMonth() && calYear === now.getFullYear()}
            nextDisabled={isEditMode && singleSelection || Boolean(packageEndMonth && getDateString(1).slice(0, 7) >= packageEndMonth)}
            onPrevious={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1) } else setCalMonth(calMonth - 1); setSessionsMap({}); setExpandedDate(null) }}
            onNext={() => { if (packageEndMonth && getDateString(1).slice(0, 7) >= packageEndMonth) return; if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1) } else setCalMonth(calMonth + 1); setSessionsMap({}); setExpandedDate(null) }} />
          {courseType === 'kids_group' && <BookingLearnerTabs activeId={activeChildTab} onChange={id => { setActiveChildTab(id); setExpandedDate(null) }}
            learners={selectedChildIds.map(id => { const child = learnerChildren.find(c => c.id === id); return { id, name: child ? formatLearnerDisplayName({fullName:child.full_name,nickname:child.nickname}) : 'ไม่ระบุชื่อผู้เรียน', count:(sessionsMap[id] || []).length } })} />}

          <BookingCalendar invalid={allSelectedSessions.length === 0 && (courseType === 'kids_group' || selectedPackage?.quantity === 1)}
            onDay={date => handleDayClick(Number(date.slice(8)))}
            days={calendarDays.filter((day): day is number => day !== null).map(day => {
              const date = getDateString(day)
              return {date, selectable:isDateSelectable(day), selected:isDateSelected(day), expanded:expandedDate===date,
                selectedCount:getDateSessions(day).length, existing:getExistingSessionsForDate(day).map(es => {
                  const child=learnerChildren.find(c=>c.id===es.child_id), index=learnerChildren.findIndex(c=>c.id===es.child_id)
                  return {label:child ? formatLearnerDisplayName({fullName:child.full_name,nickname:child.nickname}) : 'ตัวเอง', color:index<0?'bg-gray-500':['bg-emerald-500','bg-purple-500','bg-pink-500','bg-teal-500','bg-orange-500'][index%5]}
                })}
            })}>
              {/* Existing bookings legend */}
              {existingSessionsForCalendar.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 items-center text-xs text-gray-500">
                  <span>จองแล้ว:</span>
                  {(() => {
                    const dotColors = ['bg-emerald-500', 'bg-purple-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500']
                    const seen = new Set<string>()
                    return existingSessionsForCalendar.map((es) => {
                      const key = es.child_id || 'self'
                      if (seen.has(key)) return null
                      seen.add(key)
                      const child = es.child_id ? learnerChildren.find(c => c.id === es.child_id) : null
                      const name = child ? formatLearnerDisplayName({ fullName: child.full_name, nickname: child.nickname }) : 'ตัวเอง'
                      const idx = child ? learnerChildren.findIndex(c => c.id === es.child_id) : -1
                      const dotColor = idx >= 0 ? dotColors[idx % dotColors.length] : 'bg-gray-500'
                      return (
                        <span key={key} className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                          {name}
                        </span>
                      )
                    })
                  })()}
                </div>
              )}

              {/* Expanded slot picker — grouped by branch */}
              {expandedDate && (() => {
                const day = parseInt(expandedDate.split('-')[2])
                const existingHere = getExistingSessionsForDate(day)
                const hasAnyBookableSlot = selectedBranches.some((branch) => getBookableSlots(branch.slug, day).length > 0)
                return (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg border space-y-3">
                    <p className="text-sm font-medium">
                      <CalendarDays className="inline h-4 w-4 mr-1" />
                      {formatThaiDateWithWeekday(expandedDate)} — เลือกรอบเรียน:
                    </p>
                    {courseType === 'kids_group' && (!authoritativeAvailability || availabilityLoading) && (
                      <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-700">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />กำลังตรวจสอบที่ว่าง...
                      </div>
                    )}
                    {existingHere.length > 0 && (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 space-y-1">
                        <p className="font-medium">จองแล้วในวันนี้:</p>
                        {existingHere.map((es, ei) => {
                          const child = es.child_id ? learnerChildren.find(c => c.id === es.child_id) : null
                          const name = child ? formatLearnerDisplayName({ fullName: child.full_name, nickname: child.nickname }) : 'ตัวเอง'
                          const branch = branches.find(b => b.id === es.branch_id)
                          return (
                            <p key={ei}>• {name} — {fmtTime(es.start_time)}-{fmtTime(es.end_time)} @{branch?.name || '-'}</p>
                          )
                        })}
                      </div>
                    )}
                    {selectedBranches.map((branch) => {
                      const slots = getBookableSlots(branch.slug, day)
                      if (slots.length === 0) return null
                      return (
                        <div key={branch.id}>
                          {selectedBranches.length > 1 && (
                            <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><MapPin className="h-3 w-3" />{branch.name}</p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {slots.map((slot) => {
                              const isSlotSelected = activeSessions.some((s) => s.date === expandedDate && s.start === slot.start && s.branchId === branch.id)
                              const existingConflict = getExistingConflictForSlot(day, slot)
                              const slotAvailability = getAvailabilityForSlot(day, slot, branch.id)
                              const availabilityPending = courseType === 'kids_group'
                                && (!authoritativeAvailability || availabilityLoading)
                              const unavailableProgressiveSlot = authoritativeAvailability?.mode === 'progressive'
                                && (!slotAvailability || !slotAvailability.valid)
                              const disabled = Boolean(existingConflict || availabilityPending || unavailableProgressiveSlot)
                              return (
                                <Button key={`${branch.id}-${slot.start}-${slot.end}`} size="sm"
                                  data-testid={`booking-slot-${expandedDate}-${branch.id}-${slot.start.slice(0, 5)}`}
                                  variant={isSlotSelected ? 'default' : 'outline'}
                                  disabled={disabled}
                                  className={disabled ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400' : isSlotSelected ? 'bg-[#2748bf]' : ''}
                                  onClick={() => handleSlotSelect(day, slot, branch.id)}>
                                  <Clock className="h-3 w-3 mr-1" />{fmtTime(slot.start)} - {fmtTime(slot.end)}
                                  {existingConflict && <span className="ml-1 text-[10px]">จองแล้ว</span>}
                                </Button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                    {!hasAnyBookableSlot && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                        รอบเรียนของวันนี้เริ่มไปแล้ว กรุณาเลือกรอบถัดไปหรือวันอื่น
                      </div>
                    )}
                  </div>
                )
              })()}
          </BookingCalendar>

          {/* Selected sessions list per child + combined pricing */}
          {allSelectedSessions.length > 0 && (
            <Card className="bg-[#2748bf]/5 border-[#2748bf]/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-[#153c85]">รวมทั้งหมด {allSelectedSessions.length} ครั้ง</p>
                  {sessionStatus && (
                    <Badge className={sessionStatus.warning ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}>
                      {sessionStatus.emoji} {sessionStatus.label}
                    </Badge>
                  )}
                </div>

                {sessionStatus?.warning && (
                  <p className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded">{sessionStatus.warning}</p>
                )}

                {selectedAvailabilityIssues.length > 0 && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                    {formatAvailabilityIssue(selectedAvailabilityIssues[0])} รอบอื่นที่เลือกไว้ยังคงอยู่ กรุณานำรอบนี้ออกแล้วเลือกรอบทดแทน
                  </div>
                )}

                {/* Per-child session badges */}
                {courseType === 'kids_group' ? selectedChildIds.map((cid) => {
                  const child = learnerChildren.find((c) => c.id === cid)
                  const childSess = (sessionsMap[cid] || []).sort((a: SelectedSession, b: SelectedSession) => a.date.localeCompare(b.date))
                  if (childSess.length === 0) return null
                  return (
                    <div key={cid}>
                      <p className="text-xs font-medium text-gray-600 mb-1">{child ? formatLearnerDisplayName({ fullName: child.full_name, nickname: child.nickname }) : 'ไม่ระบุชื่อผู้เรียน'} ({childSess.length} ครั้ง)</p>
                      <div className="flex flex-wrap gap-1">
                        {childSess.map((s: SelectedSession, si: number) => {
                          const slotAvailability = availabilityBySlotKey.get(getBookingAvailabilitySlotKey({
                            date: s.date,
                            startTime: s.start,
                            endTime: s.end,
                            branchId: s.branchId,
                            scheduleTemplateId: s.scheduleTemplateId || null,
                          }))
                          const invalid = Boolean(slotAvailability && !slotAvailability.valid)
                          return (
                            <Badge key={si} variant="outline" className={`text-xs py-0.5 px-1.5 gap-1 ${invalid ? 'border-red-300 bg-red-50 text-red-700' : ''}`}>
                              {formatThaiCompactDateWithWeekday(s.date)} {fmtTime(s.start)}-{fmtTime(s.end)}{selectedBranchIds.length > 1 && ` @${branchNameMap[s.branchId] || ''}`}
                              {invalid && <span className="font-medium">ไม่พร้อม</span>}
                              <button type="button" aria-label={`นำรอบ ${formatThaiCompactDateWithWeekday(s.date)} ${fmtTime(s.start)} ออก`} data-testid={`remove-session-${cid}-${s.date}-${s.start.slice(0, 5)}`} onClick={() => removeSession(cid, si)} className="ml-0.5 hover:text-red-500"><X className="h-3 w-3" /></button>
                            </Badge>
                          )
                        })}
                      </div>
                    </div>
                  )
                }) : (
                  <div className="flex flex-wrap gap-2">
                    {activeSessions.sort((a, b) => a.date.localeCompare(b.date)).map((s, i) => (
                      <Badge key={i} variant="outline" className="text-xs py-1 px-2 gap-1">
                        {formatThaiCompactDateWithWeekday(s.date)} {fmtTime(s.start)}-{fmtTime(s.end)}{selectedBranchIds.length > 1 && ` @${branchNameMap[s.branchId] || ''}`}
                        <button type="button" aria-label={`นำรอบ ${formatThaiCompactDateWithWeekday(s.date)} ${fmtTime(s.start)} ออก`} data-testid={`remove-session-self-${s.date}-${s.start.slice(0, 5)}`} onClick={() => removeSession('self', i)} className="ml-1 hover:text-red-500"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Pricing */}
                {pricingPreviewPending && (
                  <div className="flex items-center justify-end gap-2 border-t pt-3 text-sm font-medium text-blue-700">
                    {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{pricingWaitMessage}
                  </div>
                )}
                {pricing && selectedTier && !pricingPreviewPending && (
                  <div className="border-t pt-3 flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-600">
                        ช่วงราคา {singleSelection ? 'รายครั้ง' : formatPricingTierRange(selectedTier)} • {selectedTier.pricePerSession.toLocaleString()} บาท/{selectedTier.unit === 'hour' ? 'ชั่วโมง' : 'ครั้ง'}
                      </p>
                      {(courseType === 'adult_group' || courseType === 'private') && selectedTier.minSessions > 1 && (
                        <p className="text-xs font-medium text-violet-700">{selectedPackage && packageValidityDescription(selectedPackage, packageReference)}</p>
                      )}
                      {courseType === 'kids_group' && kidsPolicy?.pricingMode === 'per_bill_v1' && <p className="text-xs font-medium text-green-700" data-testid="kids-bill-pricing-note">คิดราคาจาก {allSelectedSessions.length} ครั้งในบิลนี้ · เริ่มนับใหม่ทุกบิล</p>}
                      {authoritativePreview?.mode === 'legacy' && courseType === 'kids_group' && authoritativePreview.existingSessions > 0 && (
                        <p className="text-xs text-green-600 font-medium">รวมทั้งเดือน {authoritativePreview.totalSessionsAfter} ครั้ง → {selectedTier.pricePerSession.toLocaleString()} บาท/ครั้ง</p>
                      )}
                      {authoritativePreview?.mode === 'legacy' && selectedChildIds.length > 1 && !existingMonthData.sessions && (
                        <p className="text-xs text-green-600 font-medium">รวมผู้เรียน {allSelectedSessions.length} ครั้งในรายการเดียว</p>
                      )}
                      {progressiveKidsPreview && appliedCoupon && (
                        <p className="text-xs text-green-600 font-medium">
                          ราคา {progressiveKidsPreview.grossPrice.toLocaleString()} − ส่วนลด {progressiveKidsPreview.discountAmount.toLocaleString()} บาท
                        </p>
                      )}
                    </div>
                    {isEditMode && <p data-testid="booking-step4-total" className="text-2xl font-bold text-[#2748bf]">฿{finalPrice.toLocaleString()}</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!isEditMode && step === 'calendar' && hasCalendarLearner && selectedBranchIds.length > 0 && bookingSessionCount > 0 && (
        <section className="mt-4 space-y-4 rounded-xl border bg-white p-4" data-testid="booking-checkout-total">
          {displayedBasePrice > 0 && <div>
            <label htmlFor="booking-coupon" className="mb-2 block text-sm font-medium">รหัสส่วนลด</label>
            {appliedCoupon ? <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="min-w-0 break-words text-sm font-medium text-green-800">{appliedCoupon.code}{authoritativePreview ? ` · ลด ฿${displayedDiscountAmount.toLocaleString()}` : ' · กำลังตรวจส่วนลด'}</p>
              <Button type="button" size="sm" variant="outline" aria-label="นำคูปองออก" disabled={loading || uncertainCreate} onClick={removeCoupon}>ไม่ใช้คูปอง</Button>
            </div> : <div className="flex min-w-0 gap-2">
              <input id="booking-coupon" value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} placeholder="กรอกรหัสคูปอง" disabled={loading || uncertainCreate || couponLoading} className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2748bf]/30" />
              <Button type="button" variant="outline" disabled={loading || uncertainCreate || couponLoading || previewLoading || !authoritativePreview || !couponCode.trim()} onClick={handleApplyCoupon}>{couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'ใช้โค้ด'}</Button>
            </div>}
            {couponError && <p role="alert" className="mt-2 text-sm text-red-700">{couponError}</p>}
          </div>}
          {authoritativePreview ? <div className="space-y-2 border-t pt-3">
            {appliedCoupon && <><p className="flex justify-between gap-2 text-sm text-gray-600"><span>ราคาก่อนส่วนลด</span><span>฿{displayedBasePrice.toLocaleString()}</span></p><p className="flex justify-between gap-2 text-sm text-green-700"><span>ส่วนลด {appliedCoupon.code}</span><span>−฿{displayedDiscountAmount.toLocaleString()}</span></p></>}
            <p className="flex flex-wrap items-center justify-between gap-2 font-bold"><span>ยอดสุทธิ</span><span data-testid="booking-step4-total" className="text-3xl text-[#2748bf]">฿{finalPrice.toLocaleString()}</span></p>
          </div> : <p role="status" className="text-sm text-blue-700">{pricingWaitMessage}</p>}
          <p className="text-xs text-gray-600">{isZeroCharge ? 'ยืนยันการจองโดยไม่ต้องโอนเงินหรือแนบสลิป' : 'หลังยืนยัน กรุณาชำระและส่งสลิปภายใน 30 นาที'}</p>
        </section>
      )}

      {/* Existing single-booking edit review; new bookings confirm from stage 2. */}
      {isEditMode && step === 'summary' && (
        <div>
          {selectedPackage && (!isEditMode || editBooking?.package_snapshot) && <div className="mb-4 rounded-xl bg-blue-50 p-4 text-sm">
            {singleSelection ? 'รายครั้ง ' + bookingSessionCount + (courseType === 'private' ? ' ชั่วโมง' : ' ครั้ง') : 'ซื้อ ' + selectedPackage.quantity + (courseType === 'private' ? ' ชั่วโมง' : 'ครั้ง') + ' · เลือกวันแล้ว ' + (sessionsMap.self || []).length + ' · คงเหลือ ' + (selectedPackage.quantity - (sessionsMap.self || []).length)}
            <p>{packageValidityDescription(selectedPackage, packageReference)}</p>
          </div>}
          <BookingReviewCard>
              {pricingPreviewPending && (
                <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm font-medium text-blue-700">
                  {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{pricingWaitMessage}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-gray-500">ประเภทคอร์ส</p><p className="font-medium">{COURSE_TYPES.find((c) => c.value === courseType)?.label}</p></div>
                <div><p className="text-gray-500">สาขา</p><p className="font-medium">{selectedBranches.map((b) => b.name).join(', ')}</p></div>
                <div><p className="text-gray-500">ผู้เรียน</p><p className="font-medium">
                  {courseType === 'kids_group' || courseType === 'private'
                    ? joinLearnerDisplayNames([
                      ...(courseType === 'private' && privateSelfAttend ? [{ fullName: userName }] : []),
                      ...selectedChildIds.map((id) => {
                        const child = learnerChildren.find((candidate) => candidate.id === id)
                        return { fullName: child?.full_name, nickname: child?.nickname }
                      }),
                    ])
                    : userName}
                </p></div>
                <div><p className="text-gray-500">เดือน</p><p className="font-medium">{calendarMonthDisplay}</p></div>
                <div><p className="text-gray-500">จำนวนซื้อ</p><p className="font-medium">{bookingSessionCount} {courseType === 'private' ? 'ชั่วโมง' : 'ครั้ง'}</p></div>
                {pricing && (
                  <div>
                    <p className="text-gray-500">ช่วงราคา</p>
                    {pricingPreviewPending ? (
                      <p className="font-medium text-blue-700">{pricingWaitMessage}</p>
                    ) : selectedTier && (
                      <div>
                        <p className="font-medium">{singleSelection ? 'รายครั้ง' : formatPricingTierRange(selectedTier)} • {selectedTier.pricePerSession.toLocaleString()} บาท/{selectedTier.unit === 'hour' ? 'ชั่วโมง' : 'ครั้ง'}</p>
                        {(courseType === 'adult_group' || courseType === 'private') && selectedTier.minSessions > 1 && (
                          <p className="text-xs font-medium text-violet-700">{selectedPackage && packageValidityDescription(selectedPackage, packageReference)}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Per-child breakdown */}
              {courseType === 'kids_group' && selectedChildIds.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  {selectedChildIds.map((cid) => {
                    const child = learnerChildren.find((c) => c.id === cid)
                    const childSess = (sessionsMap[cid] || []).sort((a: SelectedSession, b: SelectedSession) => a.date.localeCompare(b.date))
                    const childPrice = childPriceBreakdown[cid] || 0
                    return (
                      <div key={cid} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-sm font-medium">{child ? formatLearnerDisplayName({ fullName: child.full_name, nickname: child.nickname }) : 'ไม่ระบุชื่อผู้เรียน'} — {childSess.length} ครั้ง</p>
                          {pricingPreviewPending ? (
                            <span className="text-xs font-medium text-blue-700">{pricingWaitMessage}</span>
                          ) : (
                            <p className="text-sm font-bold text-[#2748bf]">฿{childPrice.toLocaleString()}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {childSess.map((s: SelectedSession, si: number) => (
                            <Badge key={si} variant="outline" className="text-xs">{formatThaiCompactDateWithWeekday(s.date)} {fmtTime(s.start)}-{fmtTime(s.end)}{selectedBranchIds.length > 1 && ` @${branchNameMap[s.branchId] || ''}`}</Badge>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Non-kids session list */}
              {courseType !== 'kids_group' && (
                <div className="border-t pt-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">วันเรียนที่เลือก:</p>
                  <div className="flex flex-wrap gap-1">
                    {(sessionsMap['self'] || []).sort((a: SelectedSession, b: SelectedSession) => a.date.localeCompare(b.date)).map((s: SelectedSession, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">{formatThaiCompactDateWithWeekday(s.date)} {fmtTime(s.start)}-{fmtTime(s.end)}{selectedBranchIds.length > 1 && ` @${branchNameMap[s.branchId] || ''}`}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Coupon input */}
              {!isEditMode && !pricingPreviewPending && displayedBasePrice > 0 && (
                <div className="border-t pt-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">คูปองส่วนลด</p>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 text-green-700 text-sm">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="font-medium">{appliedCoupon.code}</span>
                        <span>
                          — ลด {appliedCoupon.discount_type === 'percent' ? `${appliedCoupon.discount_value}%` : `฿${appliedCoupon.discount_value.toLocaleString()}`}
                          {' '}(฿{displayedDiscountAmount.toLocaleString()})
                        </span>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 text-red-500 hover:text-red-700" onClick={removeCoupon}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="กรอกรหัสคูปอง"
                        className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2748bf]/30"
                      />
                      <Button size="sm" variant="outline" onClick={handleApplyCoupon} disabled={couponLoading || !couponCode.trim()}>
                        {couponLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'ใช้คูปอง'}
                      </Button>
                    </div>
                  )}
                  {couponError && <p className="text-xs text-red-500 mt-1">{couponError}</p>}
                </div>
              )}

              <div className="border-t pt-4 space-y-2">
                {appliedCoupon && !pricingPreviewPending && (
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>ราคาก่อนใช้คูปอง: {displayedBasePrice.toLocaleString()} บาท</span>
                    <span>฿{displayedBasePrice.toLocaleString()}</span>
                  </div>
                )}
                {appliedCoupon && !pricingPreviewPending && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>ส่วนลดคูปอง {appliedCoupon.code}: {displayedDiscountAmount.toLocaleString()} บาท</span>
                    <span>-฿{displayedDiscountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <p className="text-lg font-medium">{appliedCoupon ? 'ยอดชำระหลังหักส่วนลด' : 'ยอดชำระครั้งนี้'}</p>
                  {pricingPreviewPending ? (
                    <span className="flex items-center gap-2 text-sm font-medium text-blue-700">
                      {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{pricingWaitMessage}
                    </span>
                  ) : (
                    <p data-testid="booking-step5-total" className="text-3xl font-bold text-[#2748bf]">฿{finalPrice.toLocaleString()}</p>
                  )}
                </div>
              </div>

              {isZeroCharge ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                  <p className="font-medium">ยอดชำระครั้งนี้: 0 บาท</p>
                  <p>ไม่ต้องแนบสลิปสำหรับรายการนี้</p>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
                  <p className="font-medium">หลังจากกดยืนยัน:</p>
                  <p>• ระบบจะสร้างรายการจอง สถานะ &quot;รอชำระเงิน&quot;</p>
                  <p>• หน้านี้จะแสดงบัญชีรับโอนและช่องแนบสลิป กรุณาชำระภายใน 30 นาทีหลังเริ่มชำระเงิน</p>
                </div>
              )}
          </BookingReviewCard>
        </div>
      )}

      {step === 'calendar' && !canGoNext() && hasCalendarLearner && selectedBranchIds.length > 0 && !(allSelectedSessions.length === 0 && (courseType === 'kids_group' || selectedPackage?.quantity === 1)) && <p role="status" className="mt-5 text-sm font-medium text-red-700">{!hasCalendarLearner?'กรุณาเลือกผู้เรียน':!selectedBranchIds.length?'กรุณาเลือกสาขา':!allSelectedSessions.length&&(courseType==='kids_group'||selectedPackage?.quantity===1)?'กรุณาเลือกวันและรอบเรียน':'กรุณาตรวจข้อมูลวันเรียนที่เลือกก่อนดำเนินการต่อ'}</p>}
      </fieldset>
      {/* Navigation */}
      <div className="flex justify-between mt-8">
        {isEditMode && step === 'calendar' ? (
          <Button variant="outline" disabled={loading || uncertainCreate} onClick={() => router.push('/dashboard/booking?payment=' + editBooking!.id)}>
            <ArrowLeft className="h-4 w-4 mr-2" />กลับไปชำระเงิน
          </Button>
        ) : (
          <Button variant="outline" onClick={goBack} disabled={loading || uncertainCreate || (isEditMode ? step === 'calendar' : currentStepIndex === 0)}>
            <ArrowLeft className="h-4 w-4 mr-2" />ย้อนกลับ
          </Button>
        )}
        {step === 'summary' || (!isEditMode && step === 'calendar') ? (
          <Button data-testid="booking-confirm" className="h-auto min-h-11 max-w-[72%] whitespace-normal bg-[#f57e3b] px-4 py-3 text-white hover:bg-[#e06a2a]" onClick={handleSubmitBooking} disabled={uncertainCreate || loading || couponLoading || previewLoading || availabilityLoading || pricingPreviewPending || selectedAvailabilityIssues.length > 0 || (!isEditMode && (!canGoNext() || !authoritativePreview))}>
            {loading || previewLoading || availabilityLoading ? <><Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />{isEditMode ? 'กำลังบันทึก...' : 'กำลังตรวจสอบ...'}</> : <><CheckCircle2 className="mr-2 h-4 w-4 shrink-0" />{isEditMode ? 'บันทึกการแก้ไข' : isZeroCharge ? 'ยืนยันการจอง 0 บาท' : 'ยืนยันยอดและเริ่มชำระเงิน'}</>}
          </Button>
        ) : (
          <Button data-testid="booking-next" className="bg-[#2748bf] hover:bg-[#153c85]" onClick={goNext} disabled={!canGoNext() || previewLoading || (step === 'calendar' && (pricingPreviewPending || (courseType === 'kids_group' && (availabilityLoading || !authoritativeAvailability || selectedAvailabilityIssues.length > 0))))}>
            {previewLoading || (courseType === 'kids_group' && availabilityLoading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}ถัดไป<ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
