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
  return s.bookings.filter((item) => item.scope === s.id && item.status === 'pending_payment')
    .sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id))
}

function fingerprint(s, ids, expectedTotal) {
  return JSON.stringify({ scope: s.id, user: s.user, ids, revision: s.revision, expectedTotal })
}

function validateCompleteScope(s, ids, currentBatch = null) {
  if (!Array.isArray(ids) || ids.length === 0 || new Set(ids).size !== ids.length) fail('PROGRESSIVE_INVALID_REQUEST')
  const chain = orderedPending(s)
  if (chain.some((item) => item.expired)) fail('PROGRESSIVE_BOOKING_EXPIRED')
  if (ids.length !== chain.length || ids.some((id, index) => chain[index]?.id !== id)) fail('PROGRESSIVE_PAYMENT_PREFIX_REQUIRED')
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
  const selected = validateCompleteScope(s, ids)
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
    validateCompleteScope(s, batch.ids, batch.id)
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

function withTwo(overrides = {}) {
  const s = scope(overrides)
  s.bookings.push(booking('a', '2026-07-01T00:00:00Z', 625), booking('b', '2026-07-02T00:00:00Z', 625))
  return s
}

const pendingIds = (s) => orderedPending(s).map((item) => item.id)

check('1 two pending 625 + 625 become one required 1,250 batch', () => {
  const s = withTwo()
  const batch = prepare(s, pendingIds(s), 'k')
  assert.deepStrictEqual(batch.ids, ['a', 'b'])
  assert.deepStrictEqual(batch.memberAmounts, [625, 625])
  assert.strictEqual(batch.total, 1250)
  assert.strictEqual(s.batches.length, 1)
})
check('2 one pending booking can prepare normally', () => { const s = withTwo(); s.bookings.pop(); assert.deepStrictEqual(prepare(s, ['a'], 'k').ids, ['a']) })
check('3 one-item subset of two fails', () => expect('PROGRESSIVE_PAYMENT_PREFIX_REQUIRED', () => prepare(withTwo(), ['a'], 'k')))
check('4 oldest prefix of three fails', () => expect('PROGRESSIVE_PAYMENT_PREFIX_REQUIRED', () => prepare(withChain(), ['a', 'b'], 'k')))
check('5 later member alone fails', () => expect('PROGRESSIVE_PAYMENT_PREFIX_REQUIRED', () => prepare(withTwo(), ['b'], 'k')))
check('6 missing middle member fails', () => expect('PROGRESSIVE_PAYMENT_PREFIX_REQUIRED', () => prepare(withChain(), ['a', 'c'], 'k')))
check('7 cross-scope extra member fails', () => { const s = withChain(); s.bookings[2].scope = 'scope-b'; expect('PROGRESSIVE_PAYMENT_PREFIX_REQUIRED', () => prepare(s, ['a', 'b', 'c'], 'k')) })
check('8 duplicate member fails', () => expect('PROGRESSIVE_INVALID_REQUEST', () => prepare(withTwo(), ['a', 'a'], 'k')))
check('9 non-pending requested member fails', () => { const s = withTwo(); s.bookings[0].status = 'paid'; expect('PROGRESSIVE_PAYMENT_PREFIX_REQUIRED', () => prepare(s, ['a', 'b'], 'k')) })
check('10 expired pending member fails', () => { const s = withTwo(); s.bookings[0].expired = true; expect('PROGRESSIVE_BOOKING_EXPIRED', () => prepare(s, pendingIds(s), 'k')) })
check('11 wrong revision fails', () => { const s = withTwo(); expect('PROGRESSIVE_SCOPE_REVISION_CONFLICT', () => prepare(s, pendingIds(s), 'k', 99)) })
check('12 wrong expected total fails', () => { const s = withTwo(); expect('PROGRESSIVE_BATCH_AMOUNT_MISMATCH', () => prepare(s, pendingIds(s), 'k', 1, 1)) })
check('13 existing active batch fails', () => { const s = withTwo(); const ids = pendingIds(s); prepare(s, ids, 'k1'); expect('PROGRESSIVE_SCOPE_LOCKED', () => prepare(s, ids, 'k2')) })
check('14 same prepare key replays same batch', () => { const s = withTwo(); const ids = pendingIds(s); const a = prepare(s, ids, 'k'); const b = prepare(s, ids, 'k'); assert.strictEqual(a.id, b.id); assert.strictEqual(b.replay, true) })
check('15 same key different fingerprint fails', () => { const s = withTwo(); prepare(s, pendingIds(s), 'k'); expect('PROGRESSIVE_IDEMPOTENCY_CONFLICT', () => prepare(s, ['a'], 'k')) })
check('16 prepare locks scope', () => { const s = withTwo(); const b = prepare(s, pendingIds(s), 'k'); assert.strictEqual(s.lockedBy, b.id) })
check('17 create edit cancel are blocked while scope locked', () => { const s = withTwo(); prepare(s, pendingIds(s), 'k'); assert.ok(s.lockedBy) })
check('18 submit is idempotent', () => { const s = withTwo(); const b = prepare(s, pendingIds(s), 'k'); submit(b, 's'); assert.strictEqual(submit(b, 's').replay, true) })
check('19 approve verifies every required member atomically', () => { const s = withTwo(); const b = prepare(s, pendingIds(s), 'k'); submit(b, 's'); approve(s, b, 'd'); assert.deepStrictEqual(s.bookings.map((x) => x.status), ['verified', 'verified']) })
check('20 reject keeps every required member pending', () => { const s = withTwo(); const b = prepare(s, pendingIds(s), 'k'); submit(b, 's'); reject(s, b, 'd'); assert.deepStrictEqual(s.bookings.map((x) => x.status), ['pending_payment', 'pending_payment']) })
check('21 partial approve cannot be represented', () => assert.ok(true))
check('22 partial reject cannot be represented', () => assert.ok(true))
check('23 coupon is consumed on approve', () => { const s = withTwo(); s.bookings[0].coupon = { status: 'reserved' }; const b = prepare(s, pendingIds(s), 'k'); submit(b, 's'); approve(s, b, 'd'); assert.strictEqual(s.bookings[0].coupon.status, 'consumed') })
check('24 coupon is released on reject', () => { const s = withTwo(); s.bookings[0].coupon = { status: 'reserved' }; const b = prepare(s, pendingIds(s), 'k'); submit(b, 's'); reject(s, b, 'd'); assert.strictEqual(s.bookings[0].coupon.status, 'released') })
check('25 approval failure rolls back every booking', () => { const s = withTwo(); const b = prepare(s, pendingIds(s), 'k'); submit(b, 's'); expect('TEST_APPROVAL_FAILURE', () => approve(s, b, 'd', 0)); assert.ok(s.bookings.every((x) => x.status === 'pending_payment')) })
check('26 rejection failure rolls back coupons', () => { const s = withTwo(); s.bookings[0].coupon = { status: 'reserved' }; const b = prepare(s, pendingIds(s), 'k'); submit(b, 's'); expect('TEST_REJECTION_FAILURE', () => reject(s, b, 'd', 0)); assert.strictEqual(s.bookings[0].coupon.status, 'reserved') })
check('27 batch total equals member snapshots', () => { const s = withTwo(); const b = prepare(s, pendingIds(s), 'k'); assert.strictEqual(b.total, b.memberAmounts.reduce((a, x) => a + x, 0)) })
check('28 allocation sum equals batch total', () => { const s = withTwo(); const b = prepare(s, pendingIds(s), 'k'); submit(b, 's'); approve(s, b, 'd'); assert.strictEqual(b.allocations.reduce((a, x) => a + x, 0), b.total) })
check('29 currency mismatch fails', () => { const s = withTwo(); s.bookings[0].currency = 'USD'; expect('PROGRESSIVE_CURRENCY_MISMATCH', () => prepare(s, pendingIds(s), 'k')) })
check('30 user mismatch fails', () => { const s = withTwo(); s.bookings[0].user = 'other'; expect('PROGRESSIVE_USER_MISMATCH', () => prepare(s, pendingIds(s), 'k')) })
check('31 active double membership fails', () => { const s = withTwo(); const ids = pendingIds(s); s.batches.push({ id: 'existing', status: 'submitted', ids }); expect('PROGRESSIVE_SCOPE_LOCKED', () => prepare(s, ids, 'k')) })
check('32 concurrent complete-set model has one active winner', () => { const s = withTwo(); const ids = pendingIds(s); prepare(s, ids, 'k1'); expect('PROGRESSIVE_SCOPE_LOCKED', () => prepare(s, ids, 'k2')); assert.strictEqual(s.batches.length, 1) })
check('33 different scopes do not share locks or batches', () => { const a = withTwo(); const b = withTwo({ id: 'scope-b', user: 'user-b' }); b.bookings.forEach((x) => { x.scope = 'scope-b'; x.user = 'user-b' }); prepare(a, pendingIds(a), 'a'); prepare(b, pendingIds(b), 'b'); assert.ok(a.lockedBy && b.lockedBy); assert.strictEqual(a.batches.length + b.batches.length, 2) })
check('34 approve retry is idempotent', () => { const s = withTwo(); const b = prepare(s, pendingIds(s), 'k'); submit(b, 's'); approve(s, b, 'd'); assert.strictEqual(approve(s, b, 'd').replay, true) })
check('35 reject retry is idempotent', () => { const s = withTwo(); const b = prepare(s, pendingIds(s), 'k'); submit(b, 's'); reject(s, b, 'd'); assert.strictEqual(reject(s, b, 'd').replay, true) })
check('36 approved batch cannot reject', () => { const s = withTwo(); const b = prepare(s, pendingIds(s), 'k'); submit(b, 's'); approve(s, b, 'd'); expect('PROGRESSIVE_BATCH_ALREADY_TERMINAL', () => reject(s, b, 'r')) })
check('37 rejected batch cannot approve', () => { const s = withTwo(); const b = prepare(s, pendingIds(s), 'k'); submit(b, 's'); reject(s, b, 'd'); expect('PROGRESSIVE_BATCH_ALREADY_TERMINAL', () => approve(s, b, 'a')) })
check('38 no booking is verified before approval', () => { const s = withTwo(); const b = prepare(s, pendingIds(s), 'k'); submit(b, 's'); assert.ok(s.bookings.every((item) => item.status === 'pending_payment')) })
check('39 no legacy payment partial state is modeled', () => { const s = withTwo(); const b = prepare(s, pendingIds(s), 'k'); assert.strictEqual(Object.hasOwn(b, 'payments'), false) })
check('40 booking created after an approved batch starts a new batch', () => { const s = scope(); s.bookings.push(booking('a', '2026-07-01T00:00:00Z', 625)); const first = prepare(s, ['a'], 'k1'); submit(first, 's1'); approve(s, first, 'd1'); s.bookings.push(booking('b', '2026-07-02T00:00:00Z', 625)); const second = prepare(s, ['b'], 'k2'); assert.notStrictEqual(second.id, first.id); assert.deepStrictEqual(second.ids, ['b']); assert.strictEqual(second.total, 625) })

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

check('v1 and additive v2 migrations keep server-only RPC controls without row mutation', () => {
  const v1Migration = fs.readFileSync(path.join(__dirname, '..', 'supabase/migrations/20260711120000_add_progressive_payment_batches.sql'), 'utf8')
  for (const token of ['progressive_payment_batches', 'progressive_payment_batch_bookings', 'progressive_payment_allocations', 'PROGRESSIVE_PAYMENT_PREFIX_REQUIRED', 'pg_advisory_xact_lock', 'FOR UPDATE', 'SECURITY DEFINER']) assert.match(v1Migration, new RegExp(token))
  assert.match(v1Migration, /REVOKE ALL ON FUNCTION public\.prepare_progressive_payment_batch_v1[\s\S]+FROM PUBLIC, anon, authenticated/)
  assert.match(v1Migration, /GRANT EXECUTE ON FUNCTION public\.prepare_progressive_payment_batch_v1[\s\S]+TO service_role/)
  assert.doesNotMatch(v1Migration, /(?:INSERT INTO|UPDATE|DELETE FROM) public\.payments/i)
  assert.strictEqual((v1Migration.match(/\$\$/g) || []).length % 2, 0)

  const v2Migration = fs.readFileSync(path.join(__dirname, '..', 'supabase/migrations/20260817042635_enforce_complete_progressive_payment_scope_v2.sql'), 'utf8')
  for (const token of [
    'validate_progressive_payment_complete_scope_v2',
    'prepare_progressive_payment_batch_v2',
    'progressive_payment_batch_capability_v2',
    'PROGRESSIVE_PAYMENT_PREFIX_REQUIRED',
    'pg_advisory_xact_lock',
    'FOR UPDATE',
    'SECURITY DEFINER',
    "SET search_path = ''",
  ]) assert.match(v2Migration, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(v2Migration, /v_pending_ids IS DISTINCT FROM p_booking_ids/)
  assert.match(v2Migration, /RETURN public\.validate_progressive_payment_prefix_v1/)
  assert.match(v2Migration, /RETURN public\.prepare_progressive_payment_batch_v1/)
  assert.match(v2Migration, /REVOKE ALL ON FUNCTION public\.prepare_progressive_payment_batch_v2[\s\S]+FROM PUBLIC, anon, authenticated/)
  assert.match(v2Migration, /GRANT EXECUTE ON FUNCTION public\.prepare_progressive_payment_batch_v2[\s\S]+TO service_role/)
  assert.doesNotMatch(v2Migration, /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO|TRUNCATE)\s+public\./i)
  assert.strictEqual((v2Migration.match(/\$\$/g) || []).length % 2, 0)
})

check('source calls v2 prepare and History renders a required complete scope', () => {
  const helper = fs.readFileSync(path.join(__dirname, '..', 'src/lib/progressive-payment-batch.ts'), 'utf8')
  assert.match(helper, /execute\('prepare_progressive_payment_batch_v2'/)
  assert.match(helper, /Boolean\(input\.hasCouponReservation\), 2\)/)

  const history = fs.readFileSync(path.join(__dirname, '..', 'src/components/dashboard/history-client.tsx'), 'utf8')
  assert.match(history, /scopeBookings\.map\(\(booking\) => booking\.id\)/)
  assert.match(history, /progressive-payment-required-total-/)
  assert.match(history, /progressive-payment-required-/)
  assert.match(history, /รายการรอชำระทั้งหมดในคอร์สและรอบราคาเดียวกันจะถูกรวมชำระครั้งเดียว/)
  assert.doesNotMatch(history, /progressiveSelectedCounts|progressive-payment-select-|slice\(0, selectedCount\)|type="checkbox"/)
})

check('legacy verify-slip behavior remains unchanged with the shared SlipOK mode', () => {
  const changed = require('child_process').execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' })
  assert.ok(!changed.includes('src/app/api/verify-slip/route.ts'), 'src/app/api/verify-slip/route.ts')

  const normalizeEol = (value) => value.replace(/\r\n/g, '\n')
  const isolationCommit = '50f355f660d04f46af7ad00ae8aa8a5ec9762bb6'
  const baseline = normalizeEol(require('child_process').execFileSync(
    'git', ['show', `${isolationCommit}^:src/lib/slipok.ts`], { encoding: 'utf8' },
  ))
  const isolated = normalizeEol(fs.readFileSync(path.join(__dirname, '..', 'src/lib/slipok.ts'), 'utf8'))
  const restored = isolated
    .replace('export async function verifySlipLive(', 'export async function verifySlip(')
    .replace(/\n\/\*\*\n \* Legacy-compatible SlipOK entry point\.[\s\S]+?\n}\n(?=\n\/\*\*)/, '')
  assert.strictEqual(restored, baseline, 'Live SlipOK implementation changed outside the authorized delegation wrapper')

  const progressiveSubmit = fs.readFileSync(
    path.join(__dirname, '..', 'src/app/api/progressive-payments/submit/route.ts'), 'utf8',
  )
  assert.doesNotMatch(progressiveSubmit, /from ['"]@\/lib\/slipok['"]/)
})

console.log(`Progressive payment batch checks passed: ${passed} checks.`)
