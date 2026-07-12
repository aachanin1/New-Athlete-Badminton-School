import { getServiceRoleClient } from '@/lib/auth/admin'
import { calculateProgressiveBookingPrice, type ProgressivePricingTier } from '@/lib/progressive-booking-pricing'
import { calculateProgressiveCouponDiscount, type ProgressiveCouponDiscountType } from '@/lib/progressive-coupon-lifecycle'

interface PreviewInput {
  userId: string
  courseTypeId: string
  month: number
  year: number
  entitlementSessions: number
  couponId?: string | null
  bookingId?: string | null
}

interface ScopeRow {
  id: string
  revision: number
  locked_by_payment_batch_id: string | null
  locked_at: string | null
}

interface BookingRow {
  id: string
  created_at: string
  status: 'pending_payment' | 'paid' | 'verified'
  entitlement_sessions: number | null
  total_sessions: number
  pricing_scope_id: string | null
  coupon_discount_snapshot: number | null
  expires_at: string | null
}

interface CouponRow {
  id: string
  discount_type: ProgressiveCouponDiscountType
  discount_value: number
  min_purchase: number | null
  max_uses: number | null
  current_uses: number
  valid_from: string
  valid_to: string | null
  is_active: boolean
}

export class ProgressiveBookingPreviewError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'ProgressiveBookingPreviewError'
  }
}

function fail(code: string, message: string): never {
  throw new ProgressiveBookingPreviewError(code, message)
}

function activePendingFilter(row: BookingRow, now: number) {
  return row.status !== 'pending_payment' || !row.expires_at || Date.parse(row.expires_at) > now
}

export async function previewProgressiveKidsGroupBooking(input: PreviewInput) {
  if (!Number.isInteger(input.entitlementSessions) || input.entitlementSessions <= 0) {
    fail('PROGRESSIVE_INVALID_REQUEST', 'จำนวนครั้งเรียนไม่ถูกต้อง')
  }

  const client = getServiceRoleClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data: scopeData, error: scopeError } = await client
    .from('booking_pricing_scopes')
    .select('id, revision, locked_by_payment_batch_id, locked_at')
    .eq('user_id', input.userId)
    .eq('course_type_id', input.courseTypeId)
    .eq('lesson_year', input.year)
    .eq('lesson_month', input.month)
    .eq('currency', 'THB')
    .maybeSingle()
  if (scopeError) fail('PROGRESSIVE_RPC_UNAVAILABLE', scopeError.message)
  const scope = scopeData as ScopeRow | null
  if (scope?.locked_by_payment_batch_id || scope?.locked_at) {
    fail('PROGRESSIVE_SCOPE_LOCKED', 'รายการของเดือนนี้กำลังอยู่ในขั้นตอนชำระเงิน')
  }

  const { data: periodBookings, error: bookingError } = await client
    .from('bookings')
    .select('id, created_at, status, entitlement_sessions, total_sessions, pricing_scope_id, coupon_discount_snapshot, expires_at')
    .eq('user_id', input.userId)
    .eq('course_type_id', input.courseTypeId)
    .eq('year', input.year)
    .eq('month', input.month)
    .in('status', ['pending_payment', 'paid', 'verified'])
  if (bookingError) fail('PROGRESSIVE_RPC_UNAVAILABLE', bookingError.message)

  const activeBookings = ((periodBookings || []) as BookingRow[])
    .filter((booking) => activePendingFilter(booking, Date.now()))
  if (activeBookings.some((booking) => booking.pricing_scope_id !== scope?.id)) {
    fail('PROGRESSIVE_LEGACY_SCOPE_NOT_READY', 'เดือนนี้มีรายการจองเดิมที่ยังไม่สามารถรวมกับ Progressive Pricing ได้')
  }

  const editedBooking = input.bookingId
    ? activeBookings.find((booking) => booking.id === input.bookingId)
    : null
  if (input.bookingId && !editedBooking) {
    fail('PROGRESSIVE_BOOKING_CONFLICT', 'ไม่พบรายการ Progressive ที่แก้ไขได้')
  }

  const priorBookings = editedBooking
    ? activeBookings.filter((booking) => (
        booking.id !== editedBooking.id
        && (booking.created_at < editedBooking.created_at
          || (booking.created_at === editedBooking.created_at && booking.id < editedBooking.id))
      ))
    : activeBookings
  const previousActiveSessions = priorBookings.reduce(
    (sum, booking) => sum + Number(booking.entitlement_sessions ?? booking.total_sessions),
    0,
  )

  const { data: tierData, error: tierError } = await client
    .from('pricing_tiers')
    .select('id, min_sessions, max_sessions, price_per_session, valid_from, valid_to')
    .eq('course_type_id', input.courseTypeId)
    .lte('valid_from', today)
    .or(`valid_to.is.null,valid_to.gte.${today}`)
    .order('valid_from', { ascending: false })
    .order('min_sessions', { ascending: false })
    .order('id', { ascending: true })
  if (tierError) fail('PROGRESSIVE_RPC_UNAVAILABLE', tierError.message)

  const uniqueRanges = new Map<string, ProgressivePricingTier>()
  for (const row of tierData || []) {
    const key = `${row.min_sessions}:${row.max_sessions ?? 'null'}`
    if (!uniqueRanges.has(key)) {
      uniqueRanges.set(key, {
        id: row.id,
        minSessions: Number(row.min_sessions),
        maxSessions: row.max_sessions === null ? null : Number(row.max_sessions),
        ratePerSession: Number(row.price_per_session),
      })
    }
  }

  const price = calculateProgressiveBookingPrice({
    previousActiveSessions,
    newBookingEntitlementSessions: input.entitlementSessions,
    pricingTiers: Array.from(uniqueRanges.values()),
  })
  if (!price.ok) fail(`PROGRESSIVE_${price.error.code}`, price.error.message)

  let discountAmount = 0
  let finalPrice = price.value.grossBookingPrice
  if (editedBooking && !input.couponId) {
    const { data: reservation, error: reservationError } = await client
      .from('progressive_coupon_reservations')
      .select('discount_type_snapshot, discount_value_snapshot')
      .eq('booking_id', editedBooking.id)
      .eq('status', 'reserved')
      .maybeSingle()
    if (reservationError) fail('PROGRESSIVE_RPC_UNAVAILABLE', reservationError.message)
    if (reservation) {
      const couponPrice = calculateProgressiveCouponDiscount({
        grossPrice: price.value.grossBookingPrice,
        discountType: reservation.discount_type_snapshot as ProgressiveCouponDiscountType,
        discountValue: Number(reservation.discount_value_snapshot),
      })
      if (!couponPrice.ok) fail('PROGRESSIVE_INVALID_REQUEST', couponPrice.error.message)
      discountAmount = couponPrice.value.discountAmount
      finalPrice = couponPrice.value.finalPrice
    }
  } else if (input.couponId) {
    const { data: couponData, error: couponError } = await client
      .from('coupons')
      .select('id, discount_type, discount_value, min_purchase, max_uses, current_uses, valid_from, valid_to, is_active')
      .eq('id', input.couponId)
      .maybeSingle()
    if (couponError) fail('PROGRESSIVE_RPC_UNAVAILABLE', couponError.message)
    const coupon = couponData as CouponRow | null
    if (!coupon) fail('PROGRESSIVE_COUPON_NOT_FOUND', 'ไม่พบคูปองนี้')
    if (!coupon.is_active) fail('PROGRESSIVE_COUPON_INACTIVE', 'คูปองไม่สามารถใช้งานได้')
    if (coupon.valid_from > today) fail('PROGRESSIVE_COUPON_NOT_STARTED', 'คูปองยังไม่เริ่มใช้งาน')
    if (coupon.valid_to && coupon.valid_to < today) fail('PROGRESSIVE_COUPON_EXPIRED', 'คูปองหมดอายุแล้ว')
    if (coupon.min_purchase !== null && price.value.grossBookingPrice < Number(coupon.min_purchase)) {
      fail('PROGRESSIVE_COUPON_MIN_PURCHASE', `ยอดขั้นต่ำสำหรับคูปองนี้คือ ฿${Number(coupon.min_purchase).toLocaleString('th-TH')}`)
    }

    const [{ count: legacyUses }, { count: progressiveUses }, { count: userLegacyUses }, { count: userProgressiveUses }, { count: courseRestrictionCount }, { count: allowedCourseCount }] = await Promise.all([
      client.from('coupon_usages').select('id', { count: 'exact', head: true }).eq('coupon_id', coupon.id),
      client.from('progressive_coupon_reservations').select('id', { count: 'exact', head: true }).eq('coupon_id', coupon.id).in('status', ['reserved', 'consumed']),
      client.from('coupon_usages').select('id', { count: 'exact', head: true }).eq('coupon_id', coupon.id).eq('user_id', input.userId),
      client.from('progressive_coupon_reservations').select('id', { count: 'exact', head: true }).eq('coupon_id', coupon.id).eq('user_id', input.userId).in('status', ['reserved', 'consumed']),
      client.from('coupon_course_types').select('coupon_id', { count: 'exact', head: true }).eq('coupon_id', coupon.id),
      client.from('coupon_course_types').select('coupon_id', { count: 'exact', head: true }).eq('coupon_id', coupon.id).eq('course_type_id', input.courseTypeId),
    ])
    if ((courseRestrictionCount || 0) > 0 && (allowedCourseCount || 0) === 0) fail('PROGRESSIVE_COUPON_COURSE_NOT_ALLOWED', 'คูปองนี้ใช้กับคอร์สที่เลือกไม่ได้')
    if ((userLegacyUses || 0) > 0 || (userProgressiveUses || 0) > (editedBooking ? 1 : 0)) fail('PROGRESSIVE_COUPON_ALREADY_USED', 'คุณใช้คูปองนี้ไปแล้ว')
    if (coupon.max_uses !== null && Math.max(Number(coupon.current_uses), legacyUses || 0) + (progressiveUses || 0) >= Number(coupon.max_uses)) {
      fail('PROGRESSIVE_COUPON_MAX_USES', 'คูปองถูกใช้งานครบจำนวนแล้ว')
    }

    const couponPrice = calculateProgressiveCouponDiscount({
      grossPrice: price.value.grossBookingPrice,
      discountType: coupon.discount_type,
      discountValue: Number(coupon.discount_value),
    })
    if (!couponPrice.ok) fail('PROGRESSIVE_INVALID_REQUEST', couponPrice.error.message)
    discountAmount = couponPrice.value.discountAmount
    finalPrice = couponPrice.value.finalPrice
  }

  return {
    mode: 'progressive' as const,
    totalPrice: finalPrice,
    grossPrice: price.value.grossBookingPrice,
    discountAmount,
    expectedScopeRevision: scope?.revision || 0,
    scopeId: scope?.id || null,
    sourceKind: 'progressive_kids_group_v1' as const,
    pricing: price.value,
  }
}
