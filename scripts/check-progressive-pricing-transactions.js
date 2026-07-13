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

const {
  calculateProgressiveBookingPrice,
  compareProgressiveBookingOrder,
  deriveSingleLessonPeriod,
} = loadTypeScriptModule('src/lib/progressive-booking-pricing.ts')
const { isProgressivePricingWritesEnabled } = loadTypeScriptModule('src/lib/progressive-pricing-feature.ts')

const tiers = [
  { id: 'tier-1', minSessions: 1, maxSessions: 1, ratePerSession: 700 },
  { id: 'tier-2-6', minSessions: 2, maxSessions: 6, ratePerSession: 625 },
  { id: 'tier-7-10', minSessions: 7, maxSessions: 10, ratePerSession: 500 },
  { id: 'tier-11-14', minSessions: 11, maxSessions: 14, ratePerSession: 433 },
  { id: 'tier-15-18', minSessions: 15, maxSessions: 18, ratePerSession: 406 },
  { id: 'tier-19-plus', minSessions: 19, maxSessions: null, ratePerSession: 350 },
]

const NOW = new Date('2026-07-10T03:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

function typedError(code) {
  const error = new Error(code)
  error.code = code
  return error
}

function expectError(code, run) {
  assert.throws(run, (error) => error && error.code === code)
}

function scopeKey({ userId = 'parent', courseTypeId = 'kids', year = 2026, month = 7, currency = 'THB' } = {}) {
  return [userId, courseTypeId, year, month, currency].join('|')
}

function session(date = '2026-07-20', overrides = {}) {
  return {
    date,
    branchId: 'branch-a',
    childId: 'child-a',
    startTime: '10:00',
    endTime: '12:00',
    ...overrides,
  }
}

function sessionsFor(count, startDay = 20) {
  return Array.from({ length: count }, (_, index) => session(`2026-07-${String(startDay + index).padStart(2, '0')}`))
}

function createScope(overrides = {}) {
  return {
    key: scopeKey(overrides),
    revision: 0,
    locked: false,
    bookings: [],
    receipts: new Map(),
    ...overrides,
  }
}

function pricing(bookings, startBookingId = null, pricingTiers = tiers) {
  const ordered = bookings
    .filter((booking) => ['pending_payment', 'paid', 'verified'].includes(booking.status) && !booking.expired)
    .sort(compareProgressiveBookingOrder)
  const startIndex = startBookingId === null ? 0 : ordered.findIndex((booking) => booking.id === startBookingId)
  let cumulative = 0
  const changed = []

  ordered.forEach((booking, index) => {
    const result = calculateProgressiveBookingPrice({
      previousActiveSessions: cumulative,
      newBookingEntitlementSessions: booking.entitlementSessions,
      couponDiscount: booking.couponDiscount || 0,
      pricingTiers,
    })
    if (!result.ok) throw typedError('PROGRESSIVE_MISSING_TIER')

    if (booking.status === 'pending_payment' && index >= Math.max(0, startIndex)) {
      const oldPrice = booking.storedPrice
      booking.storedPrice = result.value.finalBookingPrice
      booking.sequence = index + 1
      booking.cumulativeBefore = result.value.previousActiveSessions
      booking.cumulativeAfter = result.value.cumulativeSessionsAfter
      if (oldPrice !== booking.storedPrice) changed.push({ bookingId: booking.id, oldPrice, newPrice: booking.storedPrice })
    }
    cumulative = result.value.cumulativeSessionsAfter
  })

  return changed
}

function validateSessions(sessions) {
  const period = deriveSingleLessonPeriod(sessions.map((item) => item.date))
  if (!period.ok) throw typedError('PROGRESSIVE_MULTI_MONTH_BOOKING')
  return period.value
}

function createBooking(scope, input, pricingTiers = tiers) {
  const receipt = scope.receipts.get(input.clientRequestId)
  if (receipt) return { ...receipt, idempotentReplay: true }
  if (scope.locked) throw typedError('PROGRESSIVE_SCOPE_LOCKED')
  if (input.expectedRevision !== scope.revision) throw typedError('PROGRESSIVE_SCOPE_REVISION_CONFLICT')
  if (input.couponId) throw typedError('PROGRESSIVE_COUPON_NOT_READY')
  validateSessions(input.sessions)

  scope.revision += 1
  const booking = {
    id: input.id,
    createdAt: input.createdAt,
    status: 'pending_payment',
    entitlementSessions: input.entitlementSessions,
    storedPrice: 0,
    couponDiscount: 0,
    branchId: input.branchId || 'branch-a',
    childId: input.childId || 'child-a',
    expiresAt: new Date(NOW.getTime() + 14 * DAY).toISOString(),
    sessionRows: input.sessions.map((item) => ({ ...item, cancelledAt: null })),
    couponUsage: false,
    expired: false,
  }
  scope.bookings.push(booking)
  let changedBookings
  try {
    changedBookings = pricing(scope.bookings, booking.id, pricingTiers)
  } catch (error) {
    scope.bookings.pop()
    scope.revision -= 1
    throw error
  }
  const result = { bookingId: booking.id, scopeRevision: scope.revision, changedBookings, idempotentReplay: false }
  scope.receipts.set(input.clientRequestId, result)
  return result
}

function updateBooking(scope, input, pricingTiers = tiers) {
  const receipt = scope.receipts.get(input.clientRequestId)
  if (receipt) return { ...receipt, idempotentReplay: true }
  if (scope.locked) throw typedError('PROGRESSIVE_SCOPE_LOCKED')
  if (input.expectedRevision !== scope.revision) throw typedError('PROGRESSIVE_SCOPE_REVISION_CONFLICT')
  const booking = scope.bookings.find((item) => item.id === input.bookingId)
  if (!booking || booking.status !== 'pending_payment') throw typedError('PROGRESSIVE_BOOKING_NOT_PENDING')
  if (new Date(booking.expiresAt) <= NOW) throw typedError('PROGRESSIVE_BOOKING_EXPIRED')
  validateSessions(input.sessions)

  const originalExpiresAt = booking.expiresAt
  booking.entitlementSessions = input.entitlementSessions
  booking.sessionRows = input.sessions.map((item) => ({ ...item, cancelledAt: null }))
  scope.revision += 1
  const changedBookings = pricing(scope.bookings, booking.id, pricingTiers)
  assert.strictEqual(booking.expiresAt, originalExpiresAt)
  const result = { bookingId: booking.id, scopeRevision: scope.revision, changedBookings, idempotentReplay: false }
  scope.receipts.set(input.clientRequestId, result)
  return result
}

function cancelBooking(scope, input, pricingTiers = tiers) {
  const receipt = scope.receipts.get(input.clientRequestId)
  if (receipt) return { ...receipt, idempotentReplay: true }
  if (scope.locked) throw typedError('PROGRESSIVE_SCOPE_LOCKED')
  if (input.expectedRevision !== scope.revision) throw typedError('PROGRESSIVE_SCOPE_REVISION_CONFLICT')
  const booking = scope.bookings.find((item) => item.id === input.bookingId)
  if (!booking || booking.status !== 'pending_payment') throw typedError('PROGRESSIVE_BOOKING_NOT_PENDING')
  if (booking.couponUsage) throw typedError('PROGRESSIVE_COUPON_NOT_READY')

  booking.status = 'cancelled'
  booking.sessionRows.forEach((row) => { row.cancelledAt = NOW.toISOString() })
  scope.revision += 1
  const firstLater = scope.bookings
    .filter((item) => ['pending_payment', 'paid', 'verified'].includes(item.status))
    .sort(compareProgressiveBookingOrder)
    .find((item) => compareProgressiveBookingOrder(item, booking) > 0)
  const changedBookings = firstLater ? pricing(scope.bookings, firstLater.id, pricingTiers) : []
  const result = { bookingId: booking.id, scopeRevision: scope.revision, changedBookings, idempotentReplay: false }
  scope.receipts.set(input.clientRequestId, result)
  return result
}

function addBooking(scope, id, createdAt, status, entitlementSessions, storedPrice, overrides = {}) {
  scope.bookings.push({
    id,
    createdAt,
    status,
    entitlementSessions,
    storedPrice,
    couponDiscount: 0,
    expiresAt: new Date(NOW.getTime() + 14 * DAY).toISOString(),
    sessionRows: [session()],
    couponUsage: false,
    expired: false,
    ...overrides,
  })
}

function request(id, entitlementSessions, expectedRevision, overrides = {}) {
  return {
    id,
    clientRequestId: `request-${id}`,
    createdAt: `2026-07-${String(expectedRevision + 1).padStart(2, '0')}T00:00:00.000Z`,
    entitlementSessions,
    expectedRevision,
    sessions: sessionsFor(entitlementSessions),
    ...overrides,
  }
}

let passed = 0
function check(name, run) {
  run()
  passed += 1
  console.log(`PASS ${name}`)
}

check('1. create one booking with 10 sessions is 5,000', () => {
  const scope = createScope()
  createBooking(scope, request('ten', 10, 0))
  assert.strictEqual(scope.bookings[0].storedPrice, 5000)
})

check('2. create 5 then 5 is 3,125 then 2,500', () => {
  const scope = createScope()
  createBooking(scope, request('five-a', 5, 0))
  createBooking(scope, request('five-b', 5, 1))
  assert.deepStrictEqual(scope.bookings.map((item) => item.storedPrice), [3125, 2500])
})

check('3. ten one-session bookings total 5,825', () => {
  const scope = createScope()
  for (let index = 0; index < 10; index += 1) createBooking(scope, request(`single-${index}`, 1, index))
  assert.strictEqual(scope.bookings.reduce((sum, item) => sum + item.storedPrice, 0), 5825)
})

check('4. settled 8 plus four pending are 500, 500, 433, 433', () => {
  const scope = createScope({ revision: 1 })
  addBooking(scope, 'settled', '2026-07-01T00:00:00.000Z', 'verified', 8, 4000)
  for (let index = 0; index < 4; index += 1) addBooking(scope, `pending-${index}`, `2026-07-0${index + 2}T00:00:00.000Z`, 'pending_payment', 1, 0)
  pricing(scope.bookings)
  assert.deepStrictEqual(scope.bookings.slice(1).map((item) => item.storedPrice), [500, 500, 433, 433])
})

check('second_single_booking_uses_progressive_rate_not_true_up', () => {
  const scope = createScope({ revision: 1 })
  addBooking(scope, 'verified-first', '2026-07-01T00:00:00.000Z', 'verified', 1, 700)
  createBooking(scope, request('second-single', 1, 1))

  const [firstBooking, secondBooking] = scope.bookings
  assert.strictEqual(firstBooking.storedPrice, 700)
  assert.strictEqual(secondBooking.cumulativeBefore, 1)
  assert.strictEqual(secondBooking.cumulativeAfter, 2)
  assert.strictEqual(secondBooking.storedPrice, 625)
  assert.notStrictEqual(secondBooking.storedPrice, 550)

  const alteredHistory = createScope({ revision: 1 })
  addBooking(alteredHistory, 'verified-first', '2026-07-01T00:00:00.000Z', 'verified', 1, 999)
  createBooking(alteredHistory, request('second-single', 1, 1))
  assert.strictEqual(alteredHistory.bookings[1].storedPrice, 625)
})

check('couponed_first_booking_does_not_change_next_booking_price', () => {
  const scope = createScope({ revision: 1 })
  addBooking(scope, 'couponed-first', '2026-07-01T00:00:00.000Z', 'verified', 1, 625, {
    couponDiscount: 75,
  })
  createBooking(scope, request('after-coupon', 1, 1))

  assert.strictEqual(scope.bookings[0].storedPrice, 625)
  assert.strictEqual(scope.bookings[0].couponDiscount, 75)
  assert.strictEqual(scope.bookings[1].couponDiscount, 0)
  assert.strictEqual(scope.bookings[1].storedPrice, 625)
  assert.strictEqual(scope.bookings.reduce((sum, item) => sum + item.storedPrice, 0), 1250)
})

check('separate_bookings_can_cost_more_than_combined_booking', () => {
  const combined = createScope()
  createBooking(combined, request('combined-two', 2, 0))

  const split = createScope()
  createBooking(split, request('split-first', 1, 0))
  createBooking(split, request('split-second', 1, 1))

  const combinedTotal = combined.bookings[0].storedPrice
  const splitPrices = split.bookings.map((item) => item.storedPrice)
  const splitTotal = splitPrices.reduce((sum, price) => sum + price, 0)
  assert.strictEqual(combinedTotal, 1250)
  assert.deepStrictEqual(splitPrices, [700, 625])
  assert.strictEqual(splitTotal, 1325)
  assert.notStrictEqual(splitTotal, combinedTotal)
  assert.strictEqual(split.bookings[0].storedPrice, 700)
})

check('5. concurrent creates serialize; stale request retries at the new revision', () => {
  const scope = createScope()
  createBooking(scope, request('tab-a', 1, 0))
  expectError('PROGRESSIVE_SCOPE_REVISION_CONFLICT', () => createBooking(scope, request('tab-b', 1, 0)))
  createBooking(scope, request('tab-b', 1, 1))
  assert.deepStrictEqual(scope.bookings.map((item) => item.storedPrice), [700, 625])
})

check('6. retry same create key returns one booking', () => {
  const scope = createScope()
  const input = request('retry', 1, 0)
  createBooking(scope, input)
  const retry = createBooking(scope, input)
  assert.strictEqual(scope.bookings.length, 1)
  assert.strictEqual(retry.idempotentReplay, true)
})

check('7. stale expected revision is a typed conflict', () => {
  const scope = createScope({ revision: 2 })
  expectError('PROGRESSIVE_SCOPE_REVISION_CONFLICT', () => createBooking(scope, request('stale', 1, 1)))
})

check('8. edit first pending reprices every later pending', () => {
  const scope = createScope({ revision: 1 })
  addBooking(scope, 'a', '2026-07-01T00:00:00.000Z', 'pending_payment', 1, 700)
  addBooking(scope, 'b', '2026-07-02T00:00:00.000Z', 'pending_payment', 1, 625)
  addBooking(scope, 'c', '2026-07-03T00:00:00.000Z', 'pending_payment', 1, 625)
  updateBooking(scope, { bookingId: 'a', clientRequestId: 'edit-a', expectedRevision: 1, entitlementSessions: 6, sessions: sessionsFor(6) })
  assert.deepStrictEqual(scope.bookings.map((item) => item.storedPrice), [3750, 500, 500])
})

check('9. edit middle pending leaves earlier price and reprices later chain', () => {
  const scope = createScope({ revision: 1 })
  addBooking(scope, 'a', '2026-07-01T00:00:00.000Z', 'pending_payment', 1, 700)
  addBooking(scope, 'b', '2026-07-02T00:00:00.000Z', 'pending_payment', 1, 625)
  addBooking(scope, 'c', '2026-07-03T00:00:00.000Z', 'pending_payment', 1, 625)
  updateBooking(scope, { bookingId: 'b', clientRequestId: 'edit-b', expectedRevision: 1, entitlementSessions: 6, sessions: sessionsFor(6) })
  assert.deepStrictEqual(scope.bookings.map((item) => item.storedPrice), [700, 3000, 500])
})

check('10. cancel first pending reprices all later pending', () => {
  const scope = createScope({ revision: 1 })
  addBooking(scope, 'a', '2026-07-01T00:00:00.000Z', 'pending_payment', 1, 700)
  addBooking(scope, 'b', '2026-07-02T00:00:00.000Z', 'pending_payment', 1, 625)
  addBooking(scope, 'c', '2026-07-03T00:00:00.000Z', 'pending_payment', 1, 625)
  cancelBooking(scope, { bookingId: 'a', clientRequestId: 'cancel-a', expectedRevision: 1 })
  assert.deepStrictEqual(scope.bookings.slice(1).map((item) => item.storedPrice), [700, 625])
})

check('11. cancel middle pending reprices only later pending', () => {
  const scope = createScope({ revision: 1 })
  addBooking(scope, 'a', '2026-07-01T00:00:00.000Z', 'pending_payment', 1, 700)
  addBooking(scope, 'b', '2026-07-02T00:00:00.000Z', 'pending_payment', 1, 625)
  addBooking(scope, 'c', '2026-07-03T00:00:00.000Z', 'pending_payment', 1, 625)
  cancelBooking(scope, { bookingId: 'b', clientRequestId: 'cancel-b', expectedRevision: 1 })
  assert.strictEqual(scope.bookings[0].storedPrice, 700)
  assert.strictEqual(scope.bookings[2].storedPrice, 625)
})

check('12. paid historical booking price remains unchanged', () => {
  const bookings = []
  addBooking({ bookings }, 'paid', '2026-07-01T00:00:00.000Z', 'paid', 1, 777)
  addBooking({ bookings }, 'pending', '2026-07-02T00:00:00.000Z', 'pending_payment', 1, 0)
  pricing(bookings)
  assert.strictEqual(bookings[0].storedPrice, 777)
})

check('13. verified historical booking price remains unchanged', () => {
  const bookings = []
  addBooking({ bookings }, 'verified', '2026-07-01T00:00:00.000Z', 'verified', 1, 777)
  addBooking({ bookings }, 'pending', '2026-07-02T00:00:00.000Z', 'pending_payment', 1, 0)
  pricing(bookings)
  assert.strictEqual(bookings[0].storedPrice, 777)
})

check('14. locked scope rejects create edit and cancel', () => {
  const scope = createScope({ locked: true })
  addBooking(scope, 'pending', '2026-07-01T00:00:00.000Z', 'pending_payment', 1, 700)
  expectError('PROGRESSIVE_SCOPE_LOCKED', () => createBooking(scope, request('locked', 1, 0)))
  expectError('PROGRESSIVE_SCOPE_LOCKED', () => updateBooking(scope, { bookingId: 'pending', clientRequestId: 'edit', expectedRevision: 0, entitlementSessions: 1, sessions: [session()] }))
  expectError('PROGRESSIVE_SCOPE_LOCKED', () => cancelBooking(scope, { bookingId: 'pending', clientRequestId: 'cancel', expectedRevision: 0 }))
})

check('15. multi-month session payload is rejected', () => {
  const scope = createScope()
  expectError('PROGRESSIVE_MULTI_MONTH_BOOKING', () => createBooking(scope, request('months', 2, 0, { sessions: [session('2026-07-31'), session('2026-08-01')] })))
})

check('16. missing tier rejects the entire mutation', () => {
  const scope = createScope()
  expectError('PROGRESSIVE_MISSING_TIER', () => createBooking(scope, request('missing-tier', 2, 0), [tiers[0]]))
  assert.strictEqual(scope.bookings.length, 0)
  assert.strictEqual(scope.revision, 0)
})

check('17. supplied coupon is rejected with typed result', () => {
  const scope = createScope()
  expectError('PROGRESSIVE_COUPON_NOT_READY', () => createBooking(scope, request('coupon', 1, 0, { couponId: 'coupon-id' })))
})

check('18. cancellation with existing coupon usage is blocked', () => {
  const scope = createScope({ revision: 1 })
  addBooking(scope, 'coupon-booking', '2026-07-01T00:00:00.000Z', 'pending_payment', 1, 625, { couponUsage: true })
  expectError('PROGRESSIVE_COUPON_NOT_READY', () => cancelBooking(scope, { bookingId: 'coupon-booking', clientRequestId: 'cancel-coupon', expectedRevision: 1 }))
})

check('19. edit preserves the original expires_at', () => {
  const scope = createScope({ revision: 1 })
  addBooking(scope, 'edit-expiry', '2026-07-01T00:00:00.000Z', 'pending_payment', 1, 700)
  const before = scope.bookings[0].expiresAt
  updateBooking(scope, { bookingId: 'edit-expiry', clientRequestId: 'edit-expiry', expectedRevision: 1, entitlementSessions: 2, sessions: [session(), session('2026-07-21')] })
  assert.strictEqual(scope.bookings[0].expiresAt, before)
})

check('20. create expires exactly 14 days after transaction time', () => {
  const scope = createScope()
  createBooking(scope, request('expiry', 1, 0))
  assert.strictEqual(new Date(scope.bookings[0].expiresAt).getTime() - NOW.getTime(), 14 * DAY)
})

check('21. cancellation is soft and session rows remain for audit', () => {
  const scope = createScope({ revision: 1 })
  addBooking(scope, 'soft', '2026-07-01T00:00:00.000Z', 'pending_payment', 1, 700)
  const rows = scope.bookings[0].sessionRows
  cancelBooking(scope, { bookingId: 'soft', clientRequestId: 'soft-cancel', expectedRevision: 1 })
  assert.strictEqual(scope.bookings[0].sessionRows, rows)
  assert.ok(rows.every((row) => row.cancelledAt === NOW.toISOString()))
})

check('22. siblings combine because child id is not in the scope key', () => {
  assert.strictEqual(scopeKey({ childId: 'a' }), scopeKey({ childId: 'b' }))
})

check('23. branches combine because branch id is not in the scope key', () => {
  assert.strictEqual(scopeKey({ branchId: 'a' }), scopeKey({ branchId: 'b' }))
})

check('24. different lesson months create different scopes', () => {
  assert.notStrictEqual(scopeKey({ month: 7 }), scopeKey({ month: 8 }))
})

check('25. different courses create different scopes', () => {
  assert.notStrictEqual(scopeKey({ courseTypeId: 'kids-a' }), scopeKey({ courseTypeId: 'kids-b' }))
})

check('26. pending booking counts in cumulative pricing', () => {
  const scope = createScope()
  createBooking(scope, request('pending-a', 1, 0))
  createBooking(scope, request('pending-b', 1, 1))
  assert.strictEqual(scope.bookings[1].storedPrice, 625)
})

check('27. cancelled and expired bookings are excluded', () => {
  const bookings = []
  addBooking({ bookings }, 'cancelled', '2026-07-01T00:00:00.000Z', 'cancelled', 10, 5000)
  addBooking({ bookings }, 'expired', '2026-07-02T00:00:00.000Z', 'pending_payment', 10, 5000, { expired: true })
  addBooking({ bookings }, 'active', '2026-07-03T00:00:00.000Z', 'pending_payment', 1, 0)
  pricing(bookings)
  assert.strictEqual(bookings[2].storedPrice, 700)
})

check('28. disabled or failed progressive path has no Legacy pricing fallback', () => {
  const adapter = fs.readFileSync(path.join(__dirname, '..', 'src/lib/progressive-booking-write.ts'), 'utf8')
  assert.match(adapter, /PROGRESSIVE_WRITES_DISABLED/)
  assert.match(adapter, /PROGRESSIVE_RPC_UNAVAILABLE/)
  assert.doesNotMatch(adapter, /calculateBookingBasePrice|ensureScheduleSlot|createLegacy|fallbackToLegacy/)
})

check('feature flag is false when unset, false, or malformed and true only after normalization', () => {
  const original = process.env.PROGRESSIVE_PRICING_WRITES_ENABLED
  delete process.env.PROGRESSIVE_PRICING_WRITES_ENABLED
  assert.strictEqual(isProgressivePricingWritesEnabled(), false)
  process.env.PROGRESSIVE_PRICING_WRITES_ENABLED = 'false'
  assert.strictEqual(isProgressivePricingWritesEnabled(), false)
  process.env.PROGRESSIVE_PRICING_WRITES_ENABLED = 'enabled'
  assert.strictEqual(isProgressivePricingWritesEnabled(), false)
  process.env.PROGRESSIVE_PRICING_WRITES_ENABLED = 'true'
  assert.strictEqual(isProgressivePricingWritesEnabled(), true)
  process.env.PROGRESSIVE_PRICING_WRITES_ENABLED = ' TRUE '
  assert.strictEqual(isProgressivePricingWritesEnabled(), true)
  if (original === undefined) delete process.env.PROGRESSIVE_PRICING_WRITES_ENABLED
  else process.env.PROGRESSIVE_PRICING_WRITES_ENABLED = original
})

check('migration statically contains transaction locks, service-role RPC grants, and no payment/coupon writes', () => {
  const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase/migrations/20260710170000_add_progressive_pricing_transactions.sql'), 'utf8')
  assert.match(migration, /pg_advisory_xact_lock/)
  assert.match(migration, /FOR UPDATE/)
  assert.match(migration, /client_request_id/)
  assert.match(migration, /progressive_booking_mutation_receipts/)
  assert.match(migration, /PROGRESSIVE_LEGACY_SCOPE_NOT_READY/)
  assert.match(migration, /transaction_timestamp\(\) \+ interval '14 days'/)
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.create_progressive_booking_v1[\s\S]+FROM PUBLIC, anon, authenticated/)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.create_progressive_booking_v1[\s\S]+TO service_role/)
  assert.doesNotMatch(migration, /(?:INSERT INTO|UPDATE|DELETE FROM) public\.(?:payments|coupons|coupon_usages)/i)
  assert.strictEqual((migration.match(/\$\$/g) || []).length % 2, 0)
})

console.log(`Progressive pricing transaction checks passed: ${passed} checks.`)
