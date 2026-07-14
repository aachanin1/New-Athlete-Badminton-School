import assert from 'node:assert/strict'
import {
  decideProgressiveBookingEntry,
  getProgressiveBookingEntryDependencyState,
} from '../src/lib/progressive-pricing-feature.ts'

const original = {
  entry: process.env.PROGRESSIVE_PAYMENT_ENTRY_ENABLED,
  pricing: process.env.PROGRESSIVE_PRICING_WRITES_ENABLED,
  coupon: process.env.PROGRESSIVE_COUPON_LIFECYCLE_ENABLED,
  batch: process.env.PROGRESSIVE_PAYMENT_BATCH_ENABLED,
}

try {
  process.env.PROGRESSIVE_PAYMENT_ENTRY_ENABLED = 'false'
  assert.deepEqual(decideProgressiveBookingEntry('kids_group'), { mode: 'legacy', reason: 'entry_disabled' })

  process.env.PROGRESSIVE_PAYMENT_ENTRY_ENABLED = 'true'
  assert.deepEqual(decideProgressiveBookingEntry('kids_group'), { mode: 'progressive', reason: 'general_kids_group' })
  assert.deepEqual(decideProgressiveBookingEntry('adult_group'), { mode: 'legacy', reason: 'course_not_supported' })
  assert.deepEqual(decideProgressiveBookingEntry('private'), { mode: 'legacy', reason: 'course_not_supported' })

  process.env.PROGRESSIVE_PRICING_WRITES_ENABLED = 'true'
  process.env.PROGRESSIVE_COUPON_LIFECYCLE_ENABLED = 'true'
  process.env.PROGRESSIVE_PAYMENT_BATCH_ENABLED = 'true'
  assert.deepEqual(getProgressiveBookingEntryDependencyState(), { ready: true, missing: [] })

  console.log('PASS booking entry runtime: Entry-off Kids, Adult, and Private stay Legacy; Entry-on Kids is Progressive.')
} finally {
  const values = [
    ['PROGRESSIVE_PAYMENT_ENTRY_ENABLED', original.entry],
    ['PROGRESSIVE_PRICING_WRITES_ENABLED', original.pricing],
    ['PROGRESSIVE_COUPON_LIFECYCLE_ENABLED', original.coupon],
    ['PROGRESSIVE_PAYMENT_BATCH_ENABLED', original.batch],
  ]
  for (const [key, value] of values) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}
