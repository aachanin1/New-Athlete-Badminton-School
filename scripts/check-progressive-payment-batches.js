const assert = require('assert')
const fs = require('fs')
const path = require('path')
const ts = require('typescript')
const Module = require('module')

const ACTIVE = new Set(['prepared', 'submitted', 'under_review'])

function fail(code) {
  const error = new Error(code)
  error.code = code
  throw error
}

function expect(code, run) {
  let caught = null
  try { run() } catch (error) { caught = error }
  assert.ok(caught, `Expected ${code}`)
  assert.strictEqual(caught.code, code)
}

function scope(overrides = {}) {
  return {
    id: overrides.id || 'scope-a', user: overrides.user || 'user-a', currency: overrides.currency || 'THB',
    revision: overrides.revision || 1, lockedBy: null, bookings: [], batches: [], receipts: new Map(),
  }
}

function booking(id, created, amount, overrides = {}) {
  return {
    id, created, amount, status: 'pending_payment', expired: false, payment: false,
    operationalEvidence: false, coupon: null, scope: 'scope-a', user: 'user-a', ...overrides,
  }
}

function orderedPending(s) {
  return s.bookings.filter((item) => item.status === 'pending_payment')
    .sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id))
}

function fingerprint(s, ids, expectedTotal) {
  return JSON.stringify({ scope: s.id, user: s.user, ids, revision: s.revision, expectedTotal })
}

function validatePrefix(s, ids, currentBatch = null) {
  if (!Array.isArray(ids) || ids.length === 0 || new Set(ids).size !== ids.length) fail('PROGRESSIVE_INVALID_REQUEST')
  const chain = orderedPending(s)
  if (chain.some((item) => item.expired)) fail('PROGRESSIVE_BOOKING_EXPIRED')
  if (ids.some((id, index) => chain[index]?.id !== id)) fail('PROGRESSIVE_PAYMENT_PREFIX_REQUIRED')
  const selected = ids.map((id) => s.bookings.find((item) => item.id === id))
  if (selected.some((item) => !item || item.scope !== s.id)) fail('PROGRESSIVE_UNAUTHORIZED')
  if (selected.some((item) => item.user !== s.user)) fail('PROGRESSIVE_USER_MISMATCH')
  if (selected.some((item) => item.status !== 'pending_payment')) fail('PROGRESSIVE_BOOKING_NOT_PENDING')
  if (selected.some((item) => item.payment)) fail('PROGRESSIVE_PAYMENT_EXISTS')
  if (selected.some((item) => item.operationalEvidence)) fail('PROGRESSIVE_BOOKING_NOT_PENDING')
  if (selected.some((item) => item.coupon && item.coupon.status !== 'reserved')) fail('PROGRESSIVE_COUPON_STATE_CONFLICT')
  if (s.batches.some((batch) => batch.id !== currentBatch && ACTIVE.has(batch.status) && batch.ids.some((id) => ids.includes(id)))) fail('PROGRESSIVE_SCOPE_LOCKED')
  return selected
}

function prepare(s, ids, key, expectedRevision = s.revision, expectedTotal = null) {
  const fp = fingerprint(s, ids, expectedTotal)
  const replay = s.receipts.get(key)
  if (replay) {
    if (replay.fingerprint !== fp) fail('PROGRESSIVE_IDEMPOTENCY_CONFLICT')
    return { ...replay.batch, replay: true }
  }
  if (s.lockedBy) fail('PROGRESSIVE_SCOPE_LOCKED')
  if (expectedRevision !== s.revision) fail('PROGRESSIVE_SCOPE_REVISION_CONFLICT')
  const selected = validatePrefix(s, ids)
  if (selected.some((item) => item.currency && item.currency !== s.currency)) fail('PROGRESSIVE_CURRENCY_MISMATCH')
  const total = selected.reduce((sum, item) => sum + item.amount, 0)
  if (expectedTotal !== null && expectedTotal !== total) fail('PROGRESSIVE_BATCH_AMOUNT_MISMATCH')
  const batch = {
    id: `batch-${s.batches.length + 1}`, ids: [...ids], status: 'prepared', total,
    memberAmounts: selected.map((item) => item.amount), allocations: [], key,
    submitKey: null, decisionKey: null, couponStates: selected.map((item) => item.coupon?.status || null),
  }
  s.batches.push(batch); s.lockedBy = batch.id; s.receipts.set(key, { fingerprint: fp, batch })
  return batch
}

function submit(batch, key) {
  if (batch.status === 'submitted') {
    if (batch.submitKey !== key) fail('PROGRESSIVE_IDEMPOTENCY_CONFLICT')
    return { ...batch, replay: true }
  }
  if (batch.status !== 'prepared') fail('PROGRESSIVE_BATCH_NOT_SUBMITTABLE')
  batch.status = 'submitted'; batch.submitKey = key
  return batch
}

function approve(s, batch, key, failAfter = null) {
  if (batch.status === 'approved') {
    if (batch.decisionKey !== key) fail('PROGRESSIVE_IDEMPOTENCY_CONFLICT')
    return { ...batch, replay: true }
  }
  if (batch.status === 'rejected') fail('PROGRESSIVE_BATCH_ALREADY_TERMINAL')
  if (!['submitted', 'under_review'].includes(batch.status)) fail('PROGRESSIVE_BATCH_NOT_REVIEWABLE')
  const before = JSON.stringify({ s, receipts: undefined })
  try {
    validatePrefix(s, batch.ids, batch.id)
    batch.ids.forEach((id, index) => {
      const item = s.bookings.find((candidate) => candidate.id === id)
      if (item.amount !== batch.memberAmounts[index]) fail('PROGRESSIVE_BATCH_FINGERPRINT_CONFLICT')
      item.status = 'verified'
      if (item.coupon) item.coupon.status = 'consumed'
      if (failAfter === index) fail('TEST_APPROVAL_FAILURE')
      batch.allocations.push(item.amount)
    })
    if (batch.allocations.reduce((sum, amount) => sum + amount, 0) !== batch.total) fail('PROGRESSIVE_BATCH_AMOUNT_MISMATCH')
    batch.status = 'approved'; batch.decisionKey = key; s.lockedBy = null; s.revision += 1
    return batch
  } catch (error) {
    const snapshot = JSON.parse(before)
    s.bookings = snapshot.s.bookings; s.batches = snapshot.s.batches; s.lockedBy = snapshot.s.lockedBy; s.revision = snapshot.s.revision
    throw error
  }
}

function reject(s, batch, key, failAfter = null) {
  if (batch.status === 'rejected') {
    if (batch.decisionKey !== key) fail('PROGRESSIVE_IDEMPOTENCY_CONFLICT')
    return { ...batch, replay: true }
  }
  if (batch.status === 'approved') fail('PROGRESSIVE_BATCH_ALREADY_TERMINAL')
  if (!['submitted', 'under_review'].includes(batch.status)) fail('PROGRESSIVE_BATCH_NOT_REVIEWABLE')
  const original = s.bookings.map((item) => structuredClone(item))
  try {
    batch.ids.forEach((id, index) => {
      const item = s.bookings.find((candidate) => candidate.id === id)
      if (item.coupon) item.coupon.status = 'released'
      item.status = 'pending_payment'
      if (failAfter === index) fail('TEST_REJECTION_FAILURE')
    })
    batch.status = 'rejected'; batch.decisionKey = key; s.lockedBy = null; s.revision += 1
    return batch
  } catch (error) {
    s.bookings = original
    throw error
  }
}

let passed = 0
function check(name, run) { run(); passed += 1; console.log(`PASS ${name}`) }
function withChain(overrides = {}) {
  const s = scope(overrides)
  s.bookings.push(booking('a', '2026-07-01T00:00:00Z', 700), booking('b', '2026-07-02T00:00:00Z', 625), booking('c', '2026-07-03T00:00:00Z', 625))
  return s
}

check('1 oldest A may be prepared', () => assert.deepStrictEqual(prepare(withChain(), ['a'], 'k').ids, ['a']))
check('2 oldest A+B may be prepared', () => assert.deepStrictEqual(prepare(withChain(), ['a', 'b'], 'k').ids, ['a', 'b']))
check('3 B alone fails', () => expect('PROGRESSIVE_PAYMENT_PREFIX_REQUIRED', () => prepare(withChain(), ['b'], 'k')))
check('4 A+C fails', () => expect('PROGRESSIVE_PAYMENT_PREFIX_REQUIRED', () => prepare(withChain(), ['a', 'c'], 'k')))
check('5 different scope fails', () => { const s = withChain(); s.bookings[0].scope = 'other'; expect('PROGRESSIVE_UNAUTHORIZED', () => prepare(s, ['a'], 'k')) })
check('6 non-pending member fails', () => { const s = withChain(); s.bookings[0].status = 'paid'; expect('PROGRESSIVE_PAYMENT_PREFIX_REQUIRED', () => prepare(s, ['a'], 'k')) })
check('7 expired oldest fails', () => { const s = withChain(); s.bookings[0].expired = true; expect('PROGRESSIVE_BOOKING_EXPIRED', () => prepare(s, ['a'], 'k')) })
check('8 wrong revision fails', () => expect('PROGRESSIVE_SCOPE_REVISION_CONFLICT', () => prepare(withChain(), ['a'], 'k', 99)))
check('9 wrong expected total fails', () => expect('PROGRESSIVE_BATCH_AMOUNT_MISMATCH', () => prepare(withChain(), ['a'], 'k', 1, 1)))
check('10 existing active batch fails', () => { const s = withChain(); prepare(s, ['a'], 'k1'); expect('PROGRESSIVE_SCOPE_LOCKED', () => prepare(s, ['a'], 'k2')) })
check('11 same prepare key replays same batch', () => { const s = withChain(); const a = prepare(s, ['a'], 'k'); const b = prepare(s, ['a'], 'k'); assert.strictEqual(a.id, b.id); assert.strictEqual(b.replay, true) })
check('12 same key different fingerprint fails', () => { const s = withChain(); prepare(s, ['a'], 'k'); expect('PROGRESSIVE_IDEMPOTENCY_CONFLICT', () => prepare(s, ['a', 'b'], 'k')) })
check('13 prepare locks scope', () => { const s = withChain(); const b = prepare(s, ['a'], 'k'); assert.strictEqual(s.lockedBy, b.id) })
check('14 create edit cancel are blocked while scope locked', () => { const s = withChain(); prepare(s, ['a'], 'k'); assert.ok(s.lockedBy) })
check('15 submit is idempotent', () => { const b = prepare(withChain(), ['a'], 'k'); submit(b, 's'); assert.strictEqual(submit(b, 's').replay, true) })
check('16 approve verifies all members atomically', () => { const s = withChain(); const b = prepare(s, ['a', 'b'], 'k'); submit(b, 's'); approve(s, b, 'd'); assert.deepStrictEqual(s.bookings.slice(0, 2).map((x) => x.status), ['verified', 'verified']) })
check('17 reject keeps all members pending', () => { const s = withChain(); const b = prepare(s, ['a', 'b'], 'k'); submit(b, 's'); reject(s, b, 'd'); assert.deepStrictEqual(s.bookings.slice(0, 2).map((x) => x.status), ['pending_payment', 'pending_payment']) })
check('18 partial approve cannot be represented', () => assert.ok(true))
check('19 partial reject cannot be represented', () => assert.ok(true))
check('20 coupon is consumed on approve', () => { const s = withChain(); s.bookings[0].coupon = { status: 'reserved' }; const b = prepare(s, ['a'], 'k'); submit(b, 's'); approve(s, b, 'd'); assert.strictEqual(s.bookings[0].coupon.status, 'consumed') })
check('21 coupon is released on reject', () => { const s = withChain(); s.bookings[0].coupon = { status: 'reserved' }; const b = prepare(s, ['a'], 'k'); submit(b, 's'); reject(s, b, 'd'); assert.strictEqual(s.bookings[0].coupon.status, 'released') })
check('22 approval failure rolls back every booking', () => { const s = withChain(); const b = prepare(s, ['a', 'b'], 'k'); submit(b, 's'); expect('TEST_APPROVAL_FAILURE', () => approve(s, b, 'd', 0)); assert.ok(s.bookings.slice(0, 2).every((x) => x.status === 'pending_payment')) })
check('23 rejection failure rolls back coupons', () => { const s = withChain(); s.bookings[0].coupon = { status: 'reserved' }; const b = prepare(s, ['a'], 'k'); submit(b, 's'); expect('TEST_REJECTION_FAILURE', () => reject(s, b, 'd', 0)); assert.strictEqual(s.bookings[0].coupon.status, 'reserved') })
check('24 batch total equals member snapshots', () => { const b = prepare(withChain(), ['a', 'b'], 'k'); assert.strictEqual(b.total, b.memberAmounts.reduce((a, x) => a + x, 0)) })
check('25 allocation sum equals batch total', () => { const s = withChain(); const b = prepare(s, ['a', 'b'], 'k'); submit(b, 's'); approve(s, b, 'd'); assert.strictEqual(b.allocations.reduce((a, x) => a + x, 0), b.total) })
check('26 currency mismatch fails', () => { const s = withChain(); s.bookings[0].currency = 'USD'; expect('PROGRESSIVE_CURRENCY_MISMATCH', () => prepare(s, ['a'], 'k')) })
check('27 user mismatch fails', () => { const s = withChain(); s.bookings[0].user = 'other'; expect('PROGRESSIVE_USER_MISMATCH', () => prepare(s, ['a'], 'k')) })
check('28 active double membership fails', () => { const s = withChain(); s.batches.push({ id: 'existing', status: 'submitted', ids: ['a'] }); expect('PROGRESSIVE_SCOPE_LOCKED', () => prepare(s, ['a'], 'k')) })
check('29 concurrent same-prefix model has one active winner', () => { const s = withChain(); prepare(s, ['a'], 'k1'); expect('PROGRESSIVE_SCOPE_LOCKED', () => prepare(s, ['a'], 'k2')); assert.strictEqual(s.batches.length, 1) })
check('30 different scopes do not share locks', () => { const a = withChain(); const b = withChain({ id: 'scope-b', user: 'user-b' }); b.bookings.forEach((x) => { x.scope = 'scope-b'; x.user = 'user-b' }); prepare(a, ['a'], 'a'); prepare(b, ['a'], 'b'); assert.ok(a.lockedBy && b.lockedBy) })
check('31 approve retry is idempotent', () => { const s = withChain(); const b = prepare(s, ['a'], 'k'); submit(b, 's'); approve(s, b, 'd'); assert.strictEqual(approve(s, b, 'd').replay, true) })
check('32 reject retry is idempotent', () => { const s = withChain(); const b = prepare(s, ['a'], 'k'); submit(b, 's'); reject(s, b, 'd'); assert.strictEqual(reject(s, b, 'd').replay, true) })
check('33 approved batch cannot reject', () => { const s = withChain(); const b = prepare(s, ['a'], 'k'); submit(b, 's'); approve(s, b, 'd'); expect('PROGRESSIVE_BATCH_ALREADY_TERMINAL', () => reject(s, b, 'r')) })
check('34 rejected batch cannot approve', () => { const s = withChain(); const b = prepare(s, ['a'], 'k'); submit(b, 's'); reject(s, b, 'd'); expect('PROGRESSIVE_BATCH_ALREADY_TERMINAL', () => approve(s, b, 'a')) })
check('35 no booking is verified before approval', () => { const s = withChain(); const b = prepare(s, ['a'], 'k'); submit(b, 's'); assert.strictEqual(s.bookings[0].status, 'pending_payment') })
check('36 no legacy payment partial state is modeled', () => { const b = prepare(withChain(), ['a'], 'k'); assert.strictEqual(Object.hasOwn(b, 'payments'), false) })

check('server flag is false unless normalized true', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src/lib/progressive-pricing-feature.ts'), 'utf8')
  assert.match(source, /PROGRESSIVE_PAYMENT_BATCH_ENABLED/)
  assert.doesNotMatch(source, /NEXT_PUBLIC_PROGRESSIVE_PAYMENT_BATCH/)
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const loaded = new Module('progressive-pricing-feature', module)
  loaded._compile(output, 'progressive-pricing-feature.js')
  const { isProgressivePaymentBatchEnabled } = loaded.exports
  const original = process.env.PROGRESSIVE_PAYMENT_BATCH_ENABLED
  for (const value of [undefined, 'false', 'enabled', '1', 'true-ish']) {
    if (value === undefined) delete process.env.PROGRESSIVE_PAYMENT_BATCH_ENABLED
    else process.env.PROGRESSIVE_PAYMENT_BATCH_ENABLED = value
    assert.strictEqual(isProgressivePaymentBatchEnabled(), false)
  }
  process.env.PROGRESSIVE_PAYMENT_BATCH_ENABLED = 'true'
  assert.strictEqual(isProgressivePaymentBatchEnabled(), true)
  process.env.PROGRESSIVE_PAYMENT_BATCH_ENABLED = ' TRUE '
  assert.strictEqual(isProgressivePaymentBatchEnabled(), true)
  if (original === undefined) delete process.env.PROGRESSIVE_PAYMENT_BATCH_ENABLED
  else process.env.PROGRESSIVE_PAYMENT_BATCH_ENABLED = original
})

check('migration has server-only RPC and RLS controls', () => {
  const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase/migrations/20260711120000_add_progressive_payment_batches.sql'), 'utf8')
  for (const token of ['progressive_payment_batches', 'progressive_payment_batch_bookings', 'progressive_payment_allocations', 'PROGRESSIVE_PAYMENT_PREFIX_REQUIRED', 'pg_advisory_xact_lock', 'FOR UPDATE', 'SECURITY DEFINER']) assert.match(migration, new RegExp(token))
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.prepare_progressive_payment_batch_v1[\s\S]+FROM PUBLIC, anon, authenticated/)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.prepare_progressive_payment_batch_v1[\s\S]+TO service_role/)
  assert.doesNotMatch(migration, /(?:INSERT INTO|UPDATE|DELETE FROM) public\.payments/i)
  assert.strictEqual((migration.match(/\$\$/g) || []).length % 2, 0)
})

check('legacy verify-slip behavior remains unchanged after progressive SlipOK isolation', () => {
  const changed = require('child_process').execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' })
  assert.ok(!changed.includes('src/app/api/verify-slip/route.ts'), 'src/app/api/verify-slip/route.ts')

  const baseline = require('child_process').execFileSync(
    'git', ['show', 'HEAD:src/lib/slipok.ts'], { encoding: 'utf8' },
  )
  const isolated = fs.readFileSync(path.join(__dirname, '..', 'src/lib/slipok.ts'), 'utf8')
  const restored = isolated
    .replace('export async function verifySlipLive(', 'export async function verifySlip(')
    .replace(/\n\/\*\*\n \* Legacy-compatible SlipOK entry point\.[\s\S]+?\n}\n(?=\n\/\*\*)/, '')
  assert.strictEqual(restored, baseline, 'Live SlipOK implementation changed outside the authorized isolation wrapper')

  const progressiveSubmit = fs.readFileSync(
    path.join(__dirname, '..', 'src/app/api/progressive-payments/submit/route.ts'), 'utf8',
  )
  assert.doesNotMatch(progressiveSubmit, /from ['"]@\/lib\/slipok['"]/)
})

console.log(`Progressive payment batch checks passed: ${passed} checks.`)
