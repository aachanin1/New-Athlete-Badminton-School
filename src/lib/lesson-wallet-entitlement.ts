import type { CourseCategory } from '@/lib/pricing'

export type LessonWalletPolicyType = 'same_month' | 'ten_month_package'

export interface LessonWalletPaymentEvidence {
  id: string
  status: string
  verified_at: string | null
}

export interface LessonWalletPricingTierEvidence {
  id: string
  course_type_name: CourseCategory | string | null
  min_sessions: number
  max_sessions: number | null
  price_per_session: number | string
  package_price: number | string
  valid_from: string | null
  valid_to: string | null
}

export interface LessonWalletEntitlement {
  policyType: LessonWalletPolicyType
  entitlementStartedAt: string
  expiresAt: string
  paymentId: string | null
  pricingTier: {
    id: string
    min: number
    max: number | null
    unit: 'session' | 'hour'
    pricePerUnit: number
    packagePrice: number
    validFrom: string | null
    validTo: string | null
  } | null
}

export interface ResolveLessonWalletEntitlementInput {
  courseType: CourseCategory
  purchasedQuantity: number
  originalSessionDate: string
  payments: LessonWalletPaymentEvidence[]
  pricingTiers: LessonWalletPricingTierEvidence[]
  inheritedEntitlement?: LessonWalletEntitlement | null
}

export type LessonWalletEntitlementErrorCode =
  | 'LESSON_WALLET_PAYMENT_EVIDENCE_MISSING'
  | 'LESSON_WALLET_PAYMENT_EVIDENCE_AMBIGUOUS'
  | 'LESSON_WALLET_TIER_EVIDENCE_MISSING'
  | 'LESSON_WALLET_TIER_EVIDENCE_AMBIGUOUS'
  | 'LESSON_WALLET_PURCHASE_QUANTITY_INVALID'
  | 'LESSON_WALLET_DATE_INVALID'

export class LessonWalletEntitlementError extends Error {
  readonly code: LessonWalletEntitlementErrorCode

  constructor(
    code: LessonWalletEntitlementErrorCode,
    message: string,
  ) {
    super(message)
    this.code = code
  }
}

function bangkokDateParts(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
    throw new LessonWalletEntitlementError('LESSON_WALLET_DATE_INVALID', 'Payment approval timestamp is invalid')
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const valueFor = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
  const year = valueFor('year')
  const month = valueFor('month')
  const day = valueFor('day')

  if (!year || !month || !day) {
    throw new LessonWalletEntitlementError('LESSON_WALLET_DATE_INVALID', 'Payment approval timestamp is invalid')
  }
  return { year, month, day }
}

function bangkokDateKey(value: string) {
  const { year, month, day } = bangkokDateParts(value)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function assertDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new LessonWalletEntitlementError('LESSON_WALLET_DATE_INVALID', 'Original session date is invalid')
  }
  const [year, month, day] = value.split('-').map(Number)
  const candidate = new Date(Date.UTC(year, month - 1, day))
  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) {
    throw new LessonWalletEntitlementError('LESSON_WALLET_DATE_INVALID', 'Original session date is invalid')
  }
  return { year, month }
}

function bangkokMonthEndIso(year: number, month: number, additionalMonths: number) {
  const nextMonthStartUtc = Date.UTC(year, month - 1 + additionalMonths + 1, 1) - (7 * 60 * 60 * 1000)
  return new Date(nextMonthStartUtc - 1).toISOString()
}

function inclusiveTierMatches(
  tier: LessonWalletPricingTierEvidence,
  courseType: CourseCategory,
  purchasedQuantity: number,
  approvalDate: string,
) {
  if (!effectiveTierMatches(tier, courseType, approvalDate)) return false
  if (Number(tier.min_sessions) > purchasedQuantity) return false
  if (tier.max_sessions !== null && purchasedQuantity > Number(tier.max_sessions)) return false
  return true
}

function effectiveTierMatches(
  tier: LessonWalletPricingTierEvidence,
  courseType: CourseCategory,
  approvalDate: string,
) {
  if (tier.course_type_name !== courseType) return false
  if (tier.valid_from && tier.valid_from > approvalDate) return false
  if (tier.valid_to && tier.valid_to < approvalDate) return false
  return true
}

function matchingHistoricalTiers(
  pricingTiers: LessonWalletPricingTierEvidence[],
  courseType: CourseCategory,
  purchasedQuantity: number,
  approvalDate: string,
) {
  if (courseType !== 'private') {
    return pricingTiers.filter((tier) => inclusiveTierMatches(
      tier,
      courseType,
      purchasedQuantity,
      approvalDate,
    ))
  }

  const eligiblePrivateTiers = pricingTiers.filter((tier) => (
    effectiveTierMatches(tier, courseType, approvalDate)
    && Number(tier.min_sessions) <= purchasedQuantity
  ))
  if (eligiblePrivateTiers.length === 0) return []

  const selectedThreshold = Math.max(...eligiblePrivateTiers.map((tier) => Number(tier.min_sessions)))
  return eligiblePrivateTiers.filter((tier) => Number(tier.min_sessions) === selectedThreshold)
}

export function resolveLessonWalletErrorCode(error: { code?: unknown; message?: unknown }) {
  if (typeof error.code === 'string' && error.code.startsWith('LESSON_WALLET_')) return error.code
  if (typeof error.message === 'string') {
    const messageCode = error.message.match(/LESSON_WALLET_[A-Z_]+/)?.[0]
    if (messageCode) return messageCode
  }
  return 'LESSON_WALLET_MUTATION_FAILED'
}

export function resolveLessonWalletEntitlement({
  courseType,
  purchasedQuantity,
  originalSessionDate,
  payments,
  pricingTiers,
  inheritedEntitlement,
}: ResolveLessonWalletEntitlementInput): LessonWalletEntitlement {
  if (inheritedEntitlement) return inheritedEntitlement

  if (!Number.isSafeInteger(purchasedQuantity) || purchasedQuantity < 1) {
    throw new LessonWalletEntitlementError(
      'LESSON_WALLET_PURCHASE_QUANTITY_INVALID',
      'Purchased quantity is invalid',
    )
  }

  const originalMonth = assertDateKey(originalSessionDate)
  if (courseType === 'kids_group') {
    return {
      policyType: 'same_month',
      entitlementStartedAt: new Date(`${originalSessionDate}T00:00:00+07:00`).toISOString(),
      expiresAt: bangkokMonthEndIso(originalMonth.year, originalMonth.month, 0),
      paymentId: null,
      pricingTier: null,
    }
  }

  const approvedPayments = payments.filter((payment) => payment.status === 'approved' && payment.verified_at)
  if (approvedPayments.length === 0) {
    throw new LessonWalletEntitlementError(
      'LESSON_WALLET_PAYMENT_EVIDENCE_MISSING',
      'Approved Payment evidence is missing',
    )
  }
  if (approvedPayments.length !== 1) {
    throw new LessonWalletEntitlementError(
      'LESSON_WALLET_PAYMENT_EVIDENCE_AMBIGUOUS',
      'Approved Payment evidence is ambiguous',
    )
  }

  const payment = approvedPayments[0]
  const approvalTimestamp = payment.verified_at as string
  const approvalDate = bangkokDateKey(approvalTimestamp)
  const matchingTiers = matchingHistoricalTiers(
    pricingTiers,
    courseType,
    purchasedQuantity,
    approvalDate,
  )

  if (matchingTiers.length === 0) {
    throw new LessonWalletEntitlementError(
      'LESSON_WALLET_TIER_EVIDENCE_MISSING',
      'Exact historical pricing tier evidence is missing',
    )
  }
  if (matchingTiers.length !== 1) {
    throw new LessonWalletEntitlementError(
      'LESSON_WALLET_TIER_EVIDENCE_AMBIGUOUS',
      'Exact historical pricing tier evidence is ambiguous',
    )
  }

  const pricingTier = matchingTiers[0]
  const isTenMonthPackage = (courseType === 'adult_group' || courseType === 'private')
    && purchasedQuantity > 1
  const policyType: LessonWalletPolicyType = isTenMonthPackage ? 'ten_month_package' : 'same_month'
  const approvedMonth = bangkokDateParts(approvalTimestamp)
  const expiryMonth = isTenMonthPackage ? approvedMonth : originalMonth

  return {
    policyType,
    entitlementStartedAt: new Date(approvalTimestamp).toISOString(),
    expiresAt: bangkokMonthEndIso(expiryMonth.year, expiryMonth.month, isTenMonthPackage ? 9 : 0),
    paymentId: payment.id,
    pricingTier: {
      id: pricingTier.id,
      min: Number(pricingTier.min_sessions),
      max: pricingTier.max_sessions === null ? null : Number(pricingTier.max_sessions),
      unit: courseType === 'private' ? 'hour' : 'session',
      pricePerUnit: Number(pricingTier.price_per_session),
      packagePrice: Number(pricingTier.package_price),
      validFrom: pricingTier.valid_from,
      validTo: pricingTier.valid_to,
    },
  }
}
