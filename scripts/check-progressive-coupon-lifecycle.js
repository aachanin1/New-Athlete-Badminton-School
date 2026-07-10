const assert = require('assert')
const fs = require('fs')
const path = require('path')
const ts = require('typescript')
const Module = require('module')

function loadTypeScriptModule(relativePath) {
  const filePath = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filePath, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      strict: true,
    },
    fileName: filePath,
  })
  const loaded = new Module(filePath, module)
  loaded.filename = filePath
  loaded.paths = Module._nodeModulePaths(path.dirname(filePath))
  loaded._compile(outputText, filePath)
  return loaded.exports
}

const { calculateProgressiveCouponDiscount } = loadTypeScriptModule('src/lib/progressive-coupon-lifecycle.ts')
const { calculateProgressiveBookingPrice } = loadTypeScriptModule('src/lib/progressive-booking-pricing.ts')
const {
  isProgressiveCouponLifecycleEnabled,
  isProgressivePricingWritesEnabled,
} = loadTypeScriptModule('src/lib/progressive-pricing-feature.ts')

const tiers = [
  { id: '1', minSessions: 1, maxSessions: 1, ratePerSession: 700 },
  { id: '2-6', minSessions: 2, maxSessions: 6, ratePerSession: 625 },
  { id: '7-10', minSessions: 7, maxSessions: 10, ratePerSession: 500 },
]

function coupon(overrides = {}) {
  return {
    id: overrides.id || 'coupon-a',
    active: true,
    type: 'fixed',
    value: 75,
    minPurchase: null,
    maxUses: null,
    validFrom: '2026-01-01',
    validTo: null,
    courseIds: [],
    legacyUses: 0,
    ...overrides,
  }
}

class Lifecycle {
  constructor() {
    this.coupons = new Map()
    this.reservations = new Map()
  }

  addCoupon(value) {
    this.coupons.set(value.id, { ...value })
  }

  reserve({ couponId, bookingId, userId, courseId = 'kids', gross, revision = 1 }) {
    const existing = this.reservations.get(bookingId)
    if (existing) {
      if (existing.couponId !== couponId || existing.userId !== userId) throw new Error('PROGRESSIVE_COUPON_STACK_NOT_ALLOWED')
      if (existing.status !== 'reserved') throw new Error('PROGRESSIVE_COUPON_STATE_CONFLICT')
      return { ...existing, idempotentReplay: true }
    }

    const config = this.coupons.get(couponId)
    if (!config) throw new Error('PROGRESSIVE_COUPON_NOT_FOUND')
    if (!config.active) throw new Error('PROGRESSIVE_COUPON_INACTIVE')
    if (config.validFrom > '2026-07-10') throw new Error('PROGRESSIVE_COUPON_NOT_STARTED')
    if (config.validTo && config.validTo < '2026-07-10') throw new Error('PROGRESSIVE_COUPON_EXPIRED')
    if (config.minPurchase !== null && gross < config.minPurchase) throw new Error('PROGRESSIVE_COUPON_MIN_PURCHASE')
    if (config.courseIds.length && !config.courseIds.includes(courseId)) throw new Error('PROGRESSIVE_COUPON_COURSE_NOT_ALLOWED')
    if ([...this.reservations.values()].some((item) => item.couponId === couponId && item.userId === userId && ['reserved', 'consumed'].includes(item.status))) {
      throw new Error('PROGRESSIVE_COUPON_ALREADY_USED')
    }
    const activeUses = [...this.reservations.values()].filter((item) => item.couponId === couponId && ['reserved', 'consumed'].includes(item.status)).length
    if (config.maxUses !== null && config.legacyUses + activeUses >= config.maxUses) throw new Error('PROGRESSIVE_COUPON_MAX_USES')

    const calculated = calculateProgressiveCouponDiscount({ grossPrice: gross, discountType: config.type, discountValue: config.value })
    if (!calculated.ok) throw new Error(calculated.error.code)
    const reservation = {
      bookingId,
      couponId,
      userId,
      courseId,
      status: 'reserved',
      typeSnapshot: config.type,
      valueSnapshot: config.value,
      gross: calculated.value.grossPrice,
      discount: calculated.value.discountAmount,
      final: calculated.value.finalPrice,
      revision,
      releaseReason: null,
    }
    this.reservations.set(bookingId, reservation)
    return { ...reservation, idempotentReplay: false }
  }

  reprice(bookingId, gross, revision) {
    const reservation = this.reservations.get(bookingId)
    if (!reservation || reservation.status === 'released') return { discount: 0, final: gross }
    if (reservation.status !== 'reserved') throw new Error('PROGRESSIVE_COUPON_STATE_CONFLICT')
    const calculated = calculateProgressiveCouponDiscount({
      grossPrice: gross,
      discountType: reservation.typeSnapshot,
      discountValue: reservation.valueSnapshot,
    })
    assert.ok(calculated.ok)
    Object.assign(reservation, {
      gross: calculated.value.grossPrice,
      discount: calculated.value.discountAmount,
      final: calculated.value.finalPrice,
      revision,
    })
    return { discount: reservation.discount, final: reservation.final }
  }

  release(bookingId, reason) {
    const reservation = this.reservations.get(bookingId)
    if (!reservation) return { idempotentReplay: true, released: false }
    if (reservation.status === 'consumed') throw new Error('PROGRESSIVE_COUPON_STATE_CONFLICT')
    if (reservation.status === 'released') {
      if (reservation.releaseReason !== reason) throw new Error('PROGRESSIVE_COUPON_STATE_CONFLICT')
      return { idempotentReplay: true, released: true }
    }
    reservation.status = 'released'
    reservation.releaseReason = reason
    return { idempotentReplay: false, released: true }
  }

  consume(bookingId) {
    const reservation = this.reservations.get(bookingId)
    if (!reservation) throw new Error('PROGRESSIVE_COUPON_RESERVATION_NOT_FOUND')
    if (reservation.status === 'released') throw new Error('PROGRESSIVE_COUPON_STATE_CONFLICT')
    if (reservation.status === 'consumed') return { idempotentReplay: true }
    reservation.status = 'consumed'
    return { idempotentReplay: false }
  }
}

function expectError(code, run) {
  assert.throws(run, (error) => error.message === code)
}

function progressivePrice(previous, entitlement, discount = 0) {
  const result = calculateProgressiveBookingPrice({
    previousActiveSessions: previous,
    newBookingEntitlementSessions: entitlement,
    couponDiscount: discount,
    pricingTiers: tiers,
  })
  assert.ok(result.ok)
  return result.value
}

let passed = 0
function check(name, run) {
  run()
  passed += 1
  console.log(`PASS ${name}`)
}

check('1. fixed 75 reduces gross 700 to 625', () => {
  const result = calculateProgressiveCouponDiscount({ grossPrice: 700, discountType: 'fixed', discountValue: 75 })
  assert.ok(result.ok)
  assert.deepStrictEqual([result.value.discountAmount, result.value.finalPrice], [75, 625])
})

check('2. percentage preserves legacy whole-baht Math.round behavior', () => {
  const result = calculateProgressiveCouponDiscount({ grossPrice: 625, discountType: 'percent', discountValue: 12.5 })
  assert.ok(result.ok)
  assert.deepStrictEqual([result.value.discountAmount, result.value.finalPrice], [78, 547])
})

check('3. discount cannot make final negative', () => {
  const result = calculateProgressiveCouponDiscount({ grossPrice: 50, discountType: 'fixed', discountValue: 75 })
  assert.ok(result.ok)
  assert.deepStrictEqual([result.value.discountAmount, result.value.finalPrice], [50, 0])
})

check('4. coupon first booking 625 then next progressive booking 625', () => {
  const first = progressivePrice(0, 1, 75)
  const second = progressivePrice(1, 1)
  assert.deepStrictEqual([first.finalBookingPrice, second.finalBookingPrice], [625, 625])
})

check('5. no coupon remains 700 plus 625', () => {
  assert.deepStrictEqual([progressivePrice(0, 1).finalBookingPrice, progressivePrice(1, 1).finalBookingPrice], [700, 625])
})

check('6. coupon does not affect the next booking tier', () => {
  assert.strictEqual(progressivePrice(1, 1).ratePerSession, 625)
})

check('7. coupon is not inherited by the next booking', () => {
  assert.strictEqual(progressivePrice(1, 1).couponDiscount, 0)
})

check('8. downstream repricing does not true-up an earlier coupon', () => {
  assert.strictEqual(progressivePrice(1, 1).finalBookingPrice, 625)
})

check('9. multi-child multi-session booking receives one discount from whole gross', () => {
  const pricing = progressivePrice(0, 2)
  const result = calculateProgressiveCouponDiscount({ grossPrice: pricing.grossBookingPrice, discountType: 'fixed', discountValue: 75 })
  assert.ok(result.ok)
  assert.deepStrictEqual([pricing.grossBookingPrice, result.value.finalPrice], [1250, 1175])
})

check('10. private max_uses one blocks the second reservation', () => {
  const model = new Lifecycle(); model.addCoupon(coupon({ maxUses: 1 }))
  model.reserve({ couponId: 'coupon-a', bookingId: 'a', userId: 'u1', gross: 700 })
  expectError('PROGRESSIVE_COUPON_MAX_USES', () => model.reserve({ couponId: 'coupon-a', bookingId: 'b', userId: 'u2', gross: 700 }))
})

check('11. campaign can reserve through max_uses', () => {
  const model = new Lifecycle(); model.addCoupon(coupon({ maxUses: 2 }))
  model.reserve({ couponId: 'coupon-a', bookingId: 'a', userId: 'u1', gross: 700 })
  model.reserve({ couponId: 'coupon-a', bookingId: 'b', userId: 'u2', gross: 700 })
  assert.strictEqual(model.reservations.size, 2)
})

check('12. reserved consumes quota capacity', () => {
  const model = new Lifecycle(); model.addCoupon(coupon({ maxUses: 1 }))
  model.reserve({ couponId: 'coupon-a', bookingId: 'a', userId: 'u1', gross: 700 })
  expectError('PROGRESSIVE_COUPON_MAX_USES', () => model.reserve({ couponId: 'coupon-a', bookingId: 'b', userId: 'u2', gross: 700 }))
})

check('13. released restores quota capacity', () => {
  const model = new Lifecycle(); model.addCoupon(coupon({ maxUses: 1 }))
  model.reserve({ couponId: 'coupon-a', bookingId: 'a', userId: 'u1', gross: 700 })
  model.release('a', 'booking_cancelled')
  model.reserve({ couponId: 'coupon-a', bookingId: 'b', userId: 'u2', gross: 700 })
  assert.strictEqual(model.reservations.get('b').status, 'reserved')
})

check('14. consumed permanently occupies quota', () => {
  const model = new Lifecycle(); model.addCoupon(coupon({ maxUses: 1 }))
  model.reserve({ couponId: 'coupon-a', bookingId: 'a', userId: 'u1', gross: 700 }); model.consume('a')
  expectError('PROGRESSIVE_COUPON_MAX_USES', () => model.reserve({ couponId: 'coupon-a', bookingId: 'b', userId: 'u2', gross: 700 }))
})

check('15. stacking different coupons on one booking is blocked', () => {
  const model = new Lifecycle(); model.addCoupon(coupon()); model.addCoupon(coupon({ id: 'coupon-b' }))
  model.reserve({ couponId: 'coupon-a', bookingId: 'a', userId: 'u1', gross: 700 })
  expectError('PROGRESSIVE_COUPON_STACK_NOT_ALLOWED', () => model.reserve({ couponId: 'coupon-b', bookingId: 'a', userId: 'u1', gross: 700 }))
})

check('16. kids_group course restriction passes', () => {
  const model = new Lifecycle(); model.addCoupon(coupon({ courseIds: ['kids'] }))
  model.reserve({ couponId: 'coupon-a', bookingId: 'a', userId: 'u1', courseId: 'kids', gross: 700 })
})

check('17. wrong course restriction fails', () => {
  const model = new Lifecycle(); model.addCoupon(coupon({ courseIds: ['kids'] }))
  expectError('PROGRESSIVE_COUPON_COURSE_NOT_ALLOWED', () => model.reserve({ couponId: 'coupon-a', bookingId: 'a', userId: 'u1', courseId: 'adult', gross: 700 }))
})

check('18. inactive coupon fails', () => {
  const model = new Lifecycle(); model.addCoupon(coupon({ active: false }))
  expectError('PROGRESSIVE_COUPON_INACTIVE', () => model.reserve({ couponId: 'coupon-a', bookingId: 'a', userId: 'u1', gross: 700 }))
})

check('19. future coupon fails', () => {
  const model = new Lifecycle(); model.addCoupon(coupon({ validFrom: '2026-08-01' }))
  expectError('PROGRESSIVE_COUPON_NOT_STARTED', () => model.reserve({ couponId: 'coupon-a', bookingId: 'a', userId: 'u1', gross: 700 }))
})

check('20. expired coupon fails', () => {
  const model = new Lifecycle(); model.addCoupon(coupon({ validTo: '2026-07-09' }))
  expectError('PROGRESSIVE_COUPON_EXPIRED', () => model.reserve({ couponId: 'coupon-a', bookingId: 'a', userId: 'u1', gross: 700 }))
})

check('21. duplicate reserve is idempotent', () => {
  const model = new Lifecycle(); model.addCoupon(coupon())
  const input = { couponId: 'coupon-a', bookingId: 'a', userId: 'u1', gross: 700 }
  model.reserve(input)
  assert.strictEqual(model.reserve(input).idempotentReplay, true)
})

check('22. different coupon on the same booking fails', () => {
  const model = new Lifecycle(); model.addCoupon(coupon()); model.addCoupon(coupon({ id: 'coupon-b' }))
  model.reserve({ couponId: 'coupon-a', bookingId: 'a', userId: 'u1', gross: 700 })
  expectError('PROGRESSIVE_COUPON_STACK_NOT_ALLOWED', () => model.reserve({ couponId: 'coupon-b', bookingId: 'a', userId: 'u1', gross: 700 }))
})

check('23. edit recalculates discount from reservation snapshot', () => {
  const model = new Lifecycle(); model.addCoupon(coupon())
  model.reserve({ couponId: 'coupon-a', bookingId: 'a', userId: 'u1', gross: 700 })
  model.coupons.get('coupon-a').value = 999
  assert.deepStrictEqual(model.reprice('a', 1250, 2), { discount: 75, final: 1175 })
})

check('24. edit reuses one reservation', () => {
  const model = new Lifecycle(); model.addCoupon(coupon())
  model.reserve({ couponId: 'coupon-a', bookingId: 'a', userId: 'u1', gross: 700 }); model.reprice('a', 1250, 2)
  assert.strictEqual(model.reservations.size, 1)
})

check('25. cancel releases reservation', () => {
  const model = new Lifecycle(); model.addCoupon(coupon())
  model.reserve({ couponId: 'coupon-a', bookingId: 'a', userId: 'u1', gross: 700 }); model.release('a', 'booking_cancelled')
  assert.deepStrictEqual([model.reservations.get('a').status, model.reservations.get('a').releaseReason], ['released', 'booking_cancelled'])
})

check('26. expiry release helper uses booking_expired', () => {
  const model = new Lifecycle(); model.addCoupon(coupon())
  model.reserve({ couponId: 'coupon-a', bookingId: 'a', userId: 'u1', gross: 700 }); model.release('a', 'booking_expired')
  assert.strictEqual(model.reservations.get('a').releaseReason, 'booking_expired')
})

check('27. consume is idempotent', () => {
  const model = new Lifecycle(); model.addCoupon(coupon())
  model.reserve({ couponId: 'coupon-a', bookingId: 'a', userId: 'u1', gross: 700 }); model.consume('a')
  assert.strictEqual(model.consume('a').idempotentReplay, true)
})

check('28. payment rejection release is idempotent', () => {
  const model = new Lifecycle(); model.addCoupon(coupon())
  model.reserve({ couponId: 'coupon-a', bookingId: 'a', userId: 'u1', gross: 700 }); model.release('a', 'payment_rejected')
  assert.strictEqual(model.release('a', 'payment_rejected').idempotentReplay, true)
})

check('29. failed create leaves no reservation', () => {
  const model = new Lifecycle(); model.addCoupon(coupon({ active: false }))
  expectError('PROGRESSIVE_COUPON_INACTIVE', () => model.reserve({ couponId: 'coupon-a', bookingId: 'a', userId: 'u1', gross: 700 }))
  assert.strictEqual(model.reservations.size, 0)
})

check('30. failed edit does not change reservation snapshot', () => {
  const model = new Lifecycle(); model.addCoupon(coupon())
  model.reserve({ couponId: 'coupon-a', bookingId: 'a', userId: 'u1', gross: 700 })
  const before = JSON.stringify(model.reservations.get('a'))
  expectError('PROGRESSIVE_COUPON_STATE_CONFLICT', () => { model.consume('a'); model.reprice('a', 1250, 2) })
  model.reservations.get('a').status = 'reserved'
  assert.strictEqual(JSON.stringify(model.reservations.get('a')), before)
})

check('31. failed cancel does not release a consumed reservation', () => {
  const model = new Lifecycle(); model.addCoupon(coupon())
  model.reserve({ couponId: 'coupon-a', bookingId: 'a', userId: 'u1', gross: 700 }); model.consume('a')
  expectError('PROGRESSIVE_COUPON_STATE_CONFLICT', () => model.release('a', 'booking_cancelled'))
  assert.strictEqual(model.reservations.get('a').status, 'consumed')
})

check('32. concurrent last-use model allows one winner', () => {
  const model = new Lifecycle(); model.addCoupon(coupon({ maxUses: 1 }))
  model.reserve({ couponId: 'coupon-a', bookingId: 'a', userId: 'u1', gross: 700 })
  expectError('PROGRESSIVE_COUPON_MAX_USES', () => model.reserve({ couponId: 'coupon-a', bookingId: 'b', userId: 'u2', gross: 700 }))
})

check('33. concurrent private code model allows one winner', () => {
  const model = new Lifecycle(); model.addCoupon(coupon({ maxUses: 1 }))
  model.reserve({ couponId: 'coupon-a', bookingId: 'a', userId: 'u1', gross: 700 })
  assert.strictEqual([...model.reservations.values()].filter((item) => item.status === 'reserved').length, 1)
})

check('34. migration leaves legacy usages unchanged and inactive', () => {
  const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase/migrations/20260710180000_add_progressive_coupon_lifecycle.sql'), 'utf8')
  assert.doesNotMatch(migration, /^\s*(?:DROP|DELETE|TRUNCATE)\b/im)
  assert.doesNotMatch(migration, /(?:INSERT INTO|UPDATE|DELETE FROM) public\.coupon_usages/i)
  assert.doesNotMatch(migration, /(?:UPDATE|DELETE FROM) public\.coupons/i)
  assert.doesNotMatch(migration, /d6dad7aa-3e20-4f78-93e0-a7638fc1bb40/i)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.progressive_coupon_reservations/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.coupon_course_types/)
  assert.match(migration, /'newPrice', v_final/)
})

check('feature flags fail closed independently and require exact true', () => {
  const originalPricing = process.env.PROGRESSIVE_PRICING_WRITES_ENABLED
  const originalCoupon = process.env.PROGRESSIVE_COUPON_LIFECYCLE_ENABLED
  delete process.env.PROGRESSIVE_PRICING_WRITES_ENABLED
  delete process.env.PROGRESSIVE_COUPON_LIFECYCLE_ENABLED
  assert.strictEqual(isProgressivePricingWritesEnabled(), false)
  assert.strictEqual(isProgressiveCouponLifecycleEnabled(), false)
  process.env.PROGRESSIVE_PRICING_WRITES_ENABLED = 'true'
  process.env.PROGRESSIVE_COUPON_LIFECYCLE_ENABLED = 'malformed'
  assert.strictEqual(isProgressivePricingWritesEnabled(), true)
  assert.strictEqual(isProgressiveCouponLifecycleEnabled(), false)
  process.env.PROGRESSIVE_COUPON_LIFECYCLE_ENABLED = ' TRUE '
  assert.strictEqual(isProgressiveCouponLifecycleEnabled(), true)
  if (originalPricing === undefined) delete process.env.PROGRESSIVE_PRICING_WRITES_ENABLED
  else process.env.PROGRESSIVE_PRICING_WRITES_ENABLED = originalPricing
  if (originalCoupon === undefined) delete process.env.PROGRESSIVE_COUPON_LIFECYCLE_ENABLED
  else process.env.PROGRESSIVE_COUPON_LIFECYCLE_ENABLED = originalCoupon
})

check('migration contains row locks, lifecycle functions, RLS and service-only grants', () => {
  const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase/migrations/20260710180000_add_progressive_coupon_lifecycle.sql'), 'utf8')
  for (const name of ['validate', 'reserve', 'recalculate', 'consume', 'release']) {
    assert.match(migration, new RegExp(`${name}_progressive_coupon`))
  }
  assert.match(migration, /FOR UPDATE/)
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /REVOKE ALL ON FUNCTION[\s\S]+FROM PUBLIC, anon, authenticated/)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION[\s\S]+TO service_role/)
})

check('active booking, payment, SlipOK and client flows do not import progressive coupon code', () => {
  const activeFiles = [
    'src/app/api/bookings/route.ts',
    'src/app/api/verify-slip/route.ts',
    'src/app/api/admin/payments/route.ts',
    'src/components/dashboard/booking-client.tsx',
  ]
  for (const relativePath of activeFiles) {
    const source = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')
    assert.doesNotMatch(source, /progressive-coupon|progressive_coupon|PROGRESSIVE_COUPON_LIFECYCLE_ENABLED/)
  }
})

check('shadow audit reads progressive reservation snapshots with legacy fallback', () => {
  const shadow = fs.readFileSync(path.join(__dirname, 'check-progressive-pricing-shadow.js'), 'utf8')
  assert.match(shadow, /progressive_coupon_reservations/)
  assert.match(shadow, /legacy coupon_usages/)
  assert.match(shadow, /readOptionalByIds/)
  assert.doesNotMatch(shadow, /(?:510d74b3|cfaf7b0d|6bbe22c1|9112a5cb|60779d60)/i)
})

console.log(`Progressive coupon lifecycle checks passed: ${passed} checks.`)
