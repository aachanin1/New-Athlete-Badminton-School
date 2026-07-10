export const PROGRESSIVE_ACTIVE_BOOKING_STATUSES = ['pending_payment', 'paid', 'verified'] as const

export type ProgressiveActiveBookingStatus = typeof PROGRESSIVE_ACTIVE_BOOKING_STATUSES[number]
export type ProgressiveBookingStatus = ProgressiveActiveBookingStatus | 'cancelled' | 'expired'

export type ProgressivePricingErrorCode =
  | 'DUPLICATE_BOOKING_ID'
  | 'INVALID_COUPON_DISCOUNT'
  | 'INVALID_CREATED_AT'
  | 'INVALID_ENTITLEMENT'
  | 'INVALID_PREVIOUS_ACTIVE_SESSIONS'
  | 'INVALID_STORED_PRICE'
  | 'INVALID_TIER'
  | 'MISSING_TIER'
  | 'MULTI_MONTH_BOOKING'
  | 'NO_LESSON_DATES'

export interface ProgressivePricingError {
  code: ProgressivePricingErrorCode
  message: string
  bookingId?: string
  details?: Record<string, unknown>
}

export type ProgressivePricingOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: ProgressivePricingError }

export interface ProgressivePricingTier {
  id: string | null
  minSessions: number
  maxSessions: number | null
  ratePerSession: number
}

export interface ProgressiveBookingInput {
  id: string
  createdAt: string
  status: ProgressiveBookingStatus
  entitlementSessions: number
  storedPrice: number
  couponDiscount?: number
}

export interface ProgressiveBookingPrice {
  previousActiveSessions: number
  newBookingEntitlementSessions: number
  cumulativeSessionsAfter: number
  selectedTier: {
    id: string | null
    minSessions: number
    maxSessions: number | null
  }
  ratePerSession: number
  grossBookingPrice: number
  couponDiscount: number
  finalBookingPrice: number
}

export interface ProgressiveSequenceItem extends ProgressiveBookingPrice {
  bookingId: string
  createdAt: string
  status: ProgressiveActiveBookingStatus
  sequence: number
  pricingOrderKey: string
  storedPrice: number
  storedPriceDifference: number
  priceClassification: 'MATCH' | 'OVERPRICED' | 'UNDERPRICED'
  shouldReprice: boolean
  pendingDependencyBookingIds: string[]
}

export interface ProgressivePricingSequence {
  orderedBookingIds: string[]
  totalActiveEntitlementSessions: number
  items: ProgressiveSequenceItem[]
}

export interface LessonPeriod {
  year: number
  month: number
  key: string
}

function failure(code: ProgressivePricingErrorCode, message: string, details?: Record<string, unknown>): ProgressivePricingOutcome<never> {
  return { ok: false, error: { code, message, details } }
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function isActiveStatus(status: ProgressiveBookingStatus): status is ProgressiveActiveBookingStatus {
  return PROGRESSIVE_ACTIVE_BOOKING_STATUSES.includes(status as ProgressiveActiveBookingStatus)
}

function validateTier(tier: ProgressivePricingTier) {
  return Number.isInteger(tier.minSessions)
    && tier.minSessions > 0
    && (tier.maxSessions === null || (Number.isInteger(tier.maxSessions) && tier.maxSessions >= tier.minSessions))
    && Number.isFinite(tier.ratePerSession)
    && tier.ratePerSession >= 0
}

export function compareProgressiveBookingOrder(
  left: Pick<ProgressiveBookingInput, 'id' | 'createdAt'>,
  right: Pick<ProgressiveBookingInput, 'id' | 'createdAt'>,
) {
  const leftTime = Date.parse(left.createdAt)
  const rightTime = Date.parse(right.createdAt)
  if (leftTime !== rightTime) return leftTime - rightTime
  if (left.id === right.id) return 0
  return left.id < right.id ? -1 : 1
}

export function resolveCanonicalEntitlementSessions(
  entitlementSessions: number | null | undefined,
  legacyTotalSessions: number,
): ProgressivePricingOutcome<number> {
  const canonical = entitlementSessions ?? legacyTotalSessions
  if (!Number.isInteger(canonical) || canonical <= 0) {
    return failure('INVALID_ENTITLEMENT', 'Entitlement sessions must be a positive integer.', {
      entitlementSessions,
      legacyTotalSessions,
    })
  }
  return { ok: true, value: canonical }
}

export function deriveSingleLessonPeriod(sessionDates: string[]): ProgressivePricingOutcome<LessonPeriod> {
  if (sessionDates.length === 0) {
    return failure('NO_LESSON_DATES', 'At least one purchased lesson date is required.')
  }

  const periods = new Map<string, LessonPeriod>()
  for (const date of sessionDates) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
    if (!match) {
      return failure('MULTI_MONTH_BOOKING', 'Lesson dates must use YYYY-MM-DD format.', { date })
    }

    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    const parsed = new Date(Date.UTC(year, month - 1, day))
    if (
      parsed.getUTCFullYear() !== year
      || parsed.getUTCMonth() + 1 !== month
      || parsed.getUTCDate() !== day
    ) {
      return failure('MULTI_MONTH_BOOKING', 'Lesson date is invalid.', { date })
    }

    const key = `${match[1]}-${match[2]}`
    periods.set(key, { year, month, key })
  }

  if (periods.size !== 1) {
    return failure('MULTI_MONTH_BOOKING', 'One booking cannot contain purchased lessons from multiple months.', {
      periods: Array.from(periods.keys()).sort(),
    })
  }

  return { ok: true, value: Array.from(periods.values())[0] }
}

export function calculateProgressiveBookingPrice({
  previousActiveSessions,
  newBookingEntitlementSessions,
  couponDiscount = 0,
  pricingTiers,
}: {
  previousActiveSessions: number
  newBookingEntitlementSessions: number
  couponDiscount?: number
  pricingTiers: ProgressivePricingTier[]
}): ProgressivePricingOutcome<ProgressiveBookingPrice> {
  if (!Number.isInteger(previousActiveSessions) || previousActiveSessions < 0) {
    return failure('INVALID_PREVIOUS_ACTIVE_SESSIONS', 'Previous active sessions must be a non-negative integer.', {
      previousActiveSessions,
    })
  }
  if (!Number.isInteger(newBookingEntitlementSessions) || newBookingEntitlementSessions <= 0) {
    return failure('INVALID_ENTITLEMENT', 'New booking entitlement sessions must be a positive integer.', {
      newBookingEntitlementSessions,
    })
  }
  if (!Number.isFinite(couponDiscount) || couponDiscount < 0) {
    return failure('INVALID_COUPON_DISCOUNT', 'Coupon discount must be a non-negative finite number.', {
      couponDiscount,
    })
  }

  const invalidTier = pricingTiers.find((tier) => !validateTier(tier))
  if (invalidTier) {
    return failure('INVALID_TIER', 'Pricing tier contains an invalid range or rate.', { tier: invalidTier })
  }

  const cumulativeSessionsAfter = previousActiveSessions + newBookingEntitlementSessions
  const selectedTier = [...pricingTiers]
    .sort((left, right) => left.minSessions - right.minSessions)
    .find((tier) => (
      cumulativeSessionsAfter >= tier.minSessions
      && (tier.maxSessions === null || cumulativeSessionsAfter <= tier.maxSessions)
    ))

  if (!selectedTier) {
    return failure('MISSING_TIER', 'No pricing tier covers the cumulative entitlement count.', {
      cumulativeSessionsAfter,
    })
  }

  const grossBookingPrice = roundCurrency(newBookingEntitlementSessions * selectedTier.ratePerSession)
  const normalizedDiscount = roundCurrency(couponDiscount)

  return {
    ok: true,
    value: {
      previousActiveSessions,
      newBookingEntitlementSessions,
      cumulativeSessionsAfter,
      selectedTier: {
        id: selectedTier.id,
        minSessions: selectedTier.minSessions,
        maxSessions: selectedTier.maxSessions,
      },
      ratePerSession: selectedTier.ratePerSession,
      grossBookingPrice,
      couponDiscount: normalizedDiscount,
      finalBookingPrice: roundCurrency(Math.max(0, grossBookingPrice - normalizedDiscount)),
    },
  }
}

export function buildProgressivePricingSequence({
  bookings,
  pricingTiers,
}: {
  bookings: ProgressiveBookingInput[]
  pricingTiers: ProgressivePricingTier[]
}): ProgressivePricingOutcome<ProgressivePricingSequence> {
  const activeBookings = bookings.filter((booking) => isActiveStatus(booking.status))
  const seenIds = new Set<string>()

  for (const booking of activeBookings) {
    if (seenIds.has(booking.id)) {
      return {
        ok: false,
        error: {
          code: 'DUPLICATE_BOOKING_ID',
          message: 'Active booking ids must be unique.',
          bookingId: booking.id,
        },
      }
    }
    seenIds.add(booking.id)

    if (!Number.isFinite(Date.parse(booking.createdAt))) {
      return {
        ok: false,
        error: {
          code: 'INVALID_CREATED_AT',
          message: 'Booking createdAt must be a valid timestamp.',
          bookingId: booking.id,
        },
      }
    }
    if (!Number.isInteger(booking.entitlementSessions) || booking.entitlementSessions <= 0) {
      return {
        ok: false,
        error: {
          code: 'INVALID_ENTITLEMENT',
          message: 'Booking entitlement sessions must be a positive integer.',
          bookingId: booking.id,
        },
      }
    }
    if (!Number.isFinite(booking.storedPrice) || booking.storedPrice < 0) {
      return {
        ok: false,
        error: {
          code: 'INVALID_STORED_PRICE',
          message: 'Stored booking price must be a non-negative finite number.',
          bookingId: booking.id,
        },
      }
    }
  }

  const ordered = [...activeBookings].sort(compareProgressiveBookingOrder)
  const items: ProgressiveSequenceItem[] = []
  const earlierPendingBookingIds: string[] = []
  let previousActiveSessions = 0

  for (const [index, booking] of ordered.entries()) {
    const pricing = calculateProgressiveBookingPrice({
      previousActiveSessions,
      newBookingEntitlementSessions: booking.entitlementSessions,
      couponDiscount: booking.couponDiscount ?? 0,
      pricingTiers,
    })
    if (!pricing.ok) {
      return {
        ok: false,
        error: { ...pricing.error, bookingId: booking.id },
      }
    }

    const storedPrice = roundCurrency(booking.storedPrice)
    const storedPriceDifference = roundCurrency(storedPrice - pricing.value.finalBookingPrice)
    const priceClassification = storedPriceDifference === 0
      ? 'MATCH'
      : storedPriceDifference > 0
        ? 'OVERPRICED'
        : 'UNDERPRICED'

    items.push({
      ...pricing.value,
      bookingId: booking.id,
      createdAt: booking.createdAt,
      status: booking.status as ProgressiveActiveBookingStatus,
      sequence: index + 1,
      pricingOrderKey: `${booking.createdAt}|${booking.id}`,
      storedPrice,
      storedPriceDifference,
      priceClassification,
      shouldReprice: booking.status === 'pending_payment',
      pendingDependencyBookingIds: [...earlierPendingBookingIds],
    })

    previousActiveSessions = pricing.value.cumulativeSessionsAfter
    if (booking.status === 'pending_payment') earlierPendingBookingIds.push(booking.id)
  }

  return {
    ok: true,
    value: {
      orderedBookingIds: ordered.map((booking) => booking.id),
      totalActiveEntitlementSessions: previousActiveSessions,
      items,
    },
  }
}
