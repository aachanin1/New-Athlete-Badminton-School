const ENABLED_VALUE = 'true'

function isEnabled(value: string | undefined) {
  return typeof value === 'string'
    && value.trim().toLowerCase() === ENABLED_VALUE
}

export function isProgressivePricingWritesEnabled() {
  return isEnabled(process.env.PROGRESSIVE_PRICING_WRITES_ENABLED)
}

export function isProgressiveCouponLifecycleEnabled() {
  return isEnabled(process.env.PROGRESSIVE_COUPON_LIFECYCLE_ENABLED)
}

export function isProgressivePaymentBatchEnabled() {
  return isEnabled(process.env.PROGRESSIVE_PAYMENT_BATCH_ENABLED)
}

export function isProgressivePaymentEntryEnabled() {
  return isEnabled(process.env.PROGRESSIVE_PAYMENT_ENTRY_ENABLED)
}

export function isProgressivePaymentReviewEnabled() {
  return isEnabled(process.env.PROGRESSIVE_PAYMENT_REVIEW_ENABLED)
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function getProgressivePaymentAllowedUserIds() {
  const raw = process.env.PROGRESSIVE_PAYMENT_ALLOWED_USER_IDS?.trim()
  if (!raw) return new Set<string>()

  const values = raw.split(',').map((value) => value.trim()).filter(Boolean)
  if (values.length === 0 || values.some((value) => !UUID_PATTERN.test(value))) {
    return new Set<string>()
  }

  return new Set(values.map((value) => value.toLowerCase()))
}

export function isProgressivePaymentUserAllowed(userId: string) {
  return getProgressivePaymentAllowedUserIds().has(userId.toLowerCase())
}

export function isProgressivePaymentEntryAvailableForUser(userId: string) {
  return isProgressivePaymentDrainAvailableForUser(userId)
    && isProgressivePaymentEntryEnabled()
}

export function isProgressivePaymentDrainAvailableForUser(userId: string) {
  return isProgressivePricingWritesEnabled()
    && isProgressiveCouponLifecycleEnabled()
    && isProgressivePaymentBatchEnabled()
    && isProgressivePaymentUserAllowed(userId)
}
