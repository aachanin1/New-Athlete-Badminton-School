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
