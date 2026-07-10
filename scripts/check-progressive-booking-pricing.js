const assert = require('assert')
const fs = require('fs')
const path = require('path')
const ts = require('typescript')
const Module = require('module')

const helperPath = path.join(__dirname, '..', 'src', 'lib', 'progressive-booking-pricing.ts')
const source = fs.readFileSync(helperPath, 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
    strict: true,
  },
  fileName: helperPath,
})

const helperModule = new Module(helperPath, module)
helperModule.filename = helperPath
helperModule.paths = Module._nodeModulePaths(path.dirname(helperPath))
helperModule._compile(outputText, helperPath)

const {
  buildProgressivePricingSequence,
  calculateProgressiveBookingPrice,
  deriveSingleLessonPeriod,
  resolveCanonicalEntitlementSessions,
} = helperModule.exports

const tiers = [
  { id: 'tier-1', minSessions: 1, maxSessions: 1, ratePerSession: 700 },
  { id: 'tier-2-6', minSessions: 2, maxSessions: 6, ratePerSession: 625 },
  { id: 'tier-7-10', minSessions: 7, maxSessions: 10, ratePerSession: 500 },
  { id: 'tier-11-14', minSessions: 11, maxSessions: 14, ratePerSession: 433 },
  { id: 'tier-15-18', minSessions: 15, maxSessions: 18, ratePerSession: 406 },
  { id: 'tier-19-plus', minSessions: 19, maxSessions: null, ratePerSession: 350 },
]

function expectOk(outcome) {
  assert.strictEqual(outcome.ok, true, outcome.ok ? undefined : outcome.error.message)
  return outcome.value
}

function booking(id, createdAt, status, entitlementSessions, storedPrice, couponDiscount = 0) {
  return { id, createdAt, status, entitlementSessions, storedPrice, couponDiscount }
}

function sequence(bookings, pricingTiers = tiers) {
  return expectOk(buildProgressivePricingSequence({ bookings, pricingTiers }))
}

function check(name, run) {
  run()
  console.log(`PASS ${name}`)
}

check('one booking with 10 sessions is 5,000', () => {
  const result = expectOk(calculateProgressiveBookingPrice({
    previousActiveSessions: 0,
    newBookingEntitlementSessions: 10,
    pricingTiers: tiers,
  }))
  assert.strictEqual(result.finalBookingPrice, 5000)
})

check('two bookings 5 + 5 are 3,125 + 2,500', () => {
  const result = sequence([
    booking('a', '2026-07-01T00:00:00Z', 'pending_payment', 5, 3125),
    booking('b', '2026-07-02T00:00:00Z', 'pending_payment', 5, 2500),
  ])
  assert.deepStrictEqual(result.items.map((item) => item.finalBookingPrice), [3125, 2500])
})

check('ten one-session booking ids total 5,825', () => {
  const bookings = Array.from({ length: 10 }, (_, index) => (
    booking(`b-${index + 1}`, `2026-07-${String(index + 1).padStart(2, '0')}T00:00:00Z`, 'pending_payment', 1, 0)
  ))
  const result = sequence(bookings)
  assert.deepStrictEqual(result.items.map((item) => item.finalBookingPrice), [700, 625, 625, 625, 625, 625, 500, 500, 500, 500])
  assert.strictEqual(result.items.reduce((sum, item) => sum + item.finalBookingPrice, 0), 5825)
})

check('settled 8 + four pending singles are 500, 500, 433, 433', () => {
  const result = sequence([
    booking('settled', '2026-06-28T00:00:00Z', 'verified', 8, 4000),
    booking('p-1', '2026-07-01T00:00:00Z', 'pending_payment', 1, 500),
    booking('p-2', '2026-07-02T00:00:00Z', 'pending_payment', 1, 500),
    booking('p-3', '2026-07-03T00:00:00Z', 'pending_payment', 1, 500),
    booking('p-4', '2026-07-04T00:00:00Z', 'pending_payment', 1, 500),
  ])
  assert.deepStrictEqual(result.items.slice(1).map((item) => item.finalBookingPrice), [500, 500, 433, 433])
})

check('two siblings in one booking aggregate before tier selection', () => {
  const result = expectOk(calculateProgressiveBookingPrice({
    previousActiveSessions: 0,
    newBookingEntitlementSessions: 10,
    pricingTiers: tiers,
  }))
  assert.strictEqual(result.cumulativeSessionsAfter, 10)
  assert.strictEqual(result.ratePerSession, 500)
})

check('two siblings in separate bookings share one sequence', () => {
  const result = sequence([
    booking('child-a', '2026-07-01T00:00:00Z', 'pending_payment', 5, 3125),
    booking('child-b', '2026-07-02T00:00:00Z', 'pending_payment', 5, 2500),
  ])
  assert.strictEqual(result.items[1].previousActiveSessions, 5)
})

check('cross-branch bookings share one sequence because branch is not an input', () => {
  const result = sequence([
    booking('branch-a', '2026-07-01T00:00:00Z', 'pending_payment', 1, 700),
    booking('branch-b', '2026-07-02T00:00:00Z', 'pending_payment', 1, 625),
  ])
  assert.strictEqual(result.items[1].ratePerSession, 625)
})

check('cancelled and expired bookings are excluded', () => {
  const result = sequence([
    booking('cancelled', '2026-07-01T00:00:00Z', 'cancelled', 10, 5000),
    booking('expired', '2026-07-02T00:00:00Z', 'expired', 10, 5000),
    booking('active', '2026-07-03T00:00:00Z', 'pending_payment', 1, 700),
  ])
  assert.deepStrictEqual(result.orderedBookingIds, ['active'])
})

check('pending booking is included in sequence', () => {
  const result = sequence([booking('pending', '2026-07-01T00:00:00Z', 'pending_payment', 1, 700)])
  assert.strictEqual(result.totalActiveEntitlementSessions, 1)
})

check('paid and verified bookings are included in sequence', () => {
  const result = sequence([
    booking('paid', '2026-07-01T00:00:00Z', 'paid', 1, 700),
    booking('verified', '2026-07-02T00:00:00Z', 'verified', 1, 625),
  ])
  assert.strictEqual(result.totalActiveEntitlementSessions, 2)
})

check('coupon applies after progressive gross and next booking remains 625', () => {
  const result = sequence([
    booking('coupon', '2026-07-01T00:00:00Z', 'pending_payment', 1, 625, 75),
    booking('next', '2026-07-02T00:00:00Z', 'pending_payment', 1, 625),
  ])
  assert.deepStrictEqual(result.items.map((item) => [item.grossBookingPrice, item.finalBookingPrice]), [[700, 625], [625, 625]])
})

check('same two bookings without coupon total 1,325', () => {
  const result = sequence([
    booking('first', '2026-07-01T00:00:00Z', 'pending_payment', 1, 700),
    booking('next', '2026-07-02T00:00:00Z', 'pending_payment', 1, 625),
  ])
  assert.strictEqual(result.items.reduce((sum, item) => sum + item.finalBookingPrice, 0), 1325)
})

check('coupon discount cannot make final price negative', () => {
  const result = expectOk(calculateProgressiveBookingPrice({
    previousActiveSessions: 0,
    newBookingEntitlementSessions: 1,
    couponDiscount: 1000,
    pricingTiers: tiers,
  }))
  assert.strictEqual(result.finalBookingPrice, 0)
})

check('created_at then id ordering is deterministic', () => {
  const result = sequence([
    booking('b', '2026-07-01T00:00:00Z', 'pending_payment', 1, 625),
    booking('a', '2026-07-01T00:00:00Z', 'pending_payment', 1, 700),
  ])
  assert.deepStrictEqual(result.orderedBookingIds, ['a', 'b'])
})

check('missing tier returns typed failure', () => {
  const result = calculateProgressiveBookingPrice({
    previousActiveSessions: 1,
    newBookingEntitlementSessions: 1,
    pricingTiers: [tiers[0]],
  })
  assert.strictEqual(result.ok, false)
  assert.strictEqual(result.error.code, 'MISSING_TIER')
})

check('raw session drift does not replace canonical entitlement count', () => {
  const canonical = expectOk(resolveCanonicalEntitlementSessions(4, 7))
  const fallback = expectOk(resolveCanonicalEntitlementSessions(null, 4))
  assert.strictEqual(canonical, 4)
  assert.strictEqual(fallback, 4)
})

check('multi-month booking is rejected with typed failure', () => {
  const result = deriveSingleLessonPeriod(['2026-07-31', '2026-08-01'])
  assert.strictEqual(result.ok, false)
  assert.strictEqual(result.error.code, 'MULTI_MONTH_BOOKING')
})

console.log('Progressive booking pricing checks passed.')
