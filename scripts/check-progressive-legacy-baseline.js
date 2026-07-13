const assert = require('node:assert')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const Module = require('node:module')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

function loadTypeScriptModule(relativePath) {
  const filePath = path.join(root, relativePath)
  const { outputText } = ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, strict: true },
    fileName: filePath,
  })
  const loaded = new Module(filePath, module)
  loaded.filename = filePath
  loaded.paths = Module._nodeModulePaths(path.dirname(filePath))
  loaded._compile(outputText, filePath)
  return loaded.exports
}

const { calculateProgressiveBookingPrice } = loadTypeScriptModule('src/lib/progressive-booking-pricing.ts')
const migration = read('supabase/migrations/20260713210000_add_progressive_legacy_baseline_compatibility.sql')
const preview = read('src/lib/progressive-booking-preview.ts')
const write = read('src/lib/progressive-booking-write.ts')
const route = read('src/app/api/bookings/route.ts')
const client = read('src/components/dashboard/booking-client.tsx')
const paymentMigration = read('supabase/migrations/20260711120000_add_progressive_payment_batches.sql')

const tiers = [
  { id: 'tier-1', minSessions: 1, maxSessions: 1, ratePerSession: 700 },
  { id: 'tier-2', minSessions: 2, maxSessions: 6, ratePerSession: 625 },
  { id: 'tier-3', minSessions: 7, maxSessions: 10, ratePerSession: 500 },
  { id: 'tier-4', minSessions: 11, maxSessions: 14, ratePerSession: 433 },
  { id: 'tier-5', minSessions: 15, maxSessions: 18, ratePerSession: 406 },
  { id: 'tier-6', minSessions: 19, maxSessions: null, ratePerSession: 350 },
]

function price({ legacy = 0, progressive = 0, added, coupon = 0 }) {
  const result = calculateProgressiveBookingPrice({
    previousActiveSessions: legacy + progressive,
    newBookingEntitlementSessions: added,
    couponDiscount: coupon,
    pricingTiers: tiers,
  })
  assert.equal(result.ok, true)
  return result.value
}

function legacyFingerprint(rows) {
  const serialized = [...rows]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((row) => `${row.id}|${row.status}|${row.totalSessions}|${row.expiresAt ?? 'null'}`)
    .join('\n')
  return crypto.createHash('sha256').update(serialized).digest('hex')
}

function mutationFingerprint(input) {
  return crypto.createHash('md5').update([
    'create', input.userId, input.requestId, input.revision,
    input.legacyBaselineSessions, input.legacyBaselineFingerprint,
  ].join('|')).digest('hex')
}

function acquire(scope, currentBaseline, expectedRevision) {
  if (!scope) {
    if (expectedRevision !== 0) throw new Error('PROGRESSIVE_SCOPE_REVISION_CONFLICT')
    return { revision: 1, baseline: { ...currentBaseline }, initialized: true }
  }
  if (scope.revision !== expectedRevision) throw new Error('PROGRESSIVE_SCOPE_REVISION_CONFLICT')
  if (!scope.initialized) {
    if (currentBaseline.sessions !== 0 || currentBaseline.fingerprint !== legacyFingerprint([])) {
      throw new Error('PROGRESSIVE_LEGACY_BASELINE_DRIFT')
    }
    return { ...scope, revision: scope.revision + 1, baseline: { ...currentBaseline }, initialized: true }
  }
  if (scope.baseline.sessions !== currentBaseline.sessions
    || scope.baseline.fingerprint !== currentBaseline.fingerprint) {
    throw new Error('PROGRESSIVE_LEGACY_BASELINE_DRIFT')
  }
  return { ...scope, revision: scope.revision + 1 }
}

function expectCode(code, run) {
  assert.throws(run, (error) => error instanceof Error && error.message === code)
}

let passed = 0
function check(name, run) {
  run()
  passed += 1
  console.log(`PASS ${name}`)
}

check('1 no prior plus new 4 is 2,500', () => {
  const result = price({ added: 4 })
  assert.deepEqual([result.cumulativeSessionsAfter, result.ratePerSession, result.grossBookingPrice], [4, 625, 2500])
})
check('2 Legacy 4 plus new 4 is 2,000', () => {
  const result = price({ legacy: 4, added: 4 })
  assert.deepEqual([result.cumulativeSessionsAfter, result.ratePerSession, result.grossBookingPrice], [8, 500, 2000])
})
check('3 Legacy 5 plus new 5 is 2,500', () => assert.equal(price({ legacy: 5, added: 5 }).grossBookingPrice, 2500))
check('4 Legacy 8 plus new 8 is 3,248', () => assert.equal(price({ legacy: 8, added: 8 }).grossBookingPrice, 3248))
check('5 non-expired pending Legacy 4 plus new 4 is 2,000', () => assert.equal(price({ legacy: 4, added: 4 }).grossBookingPrice, 2000))
check('6 Legacy 4 plus pending Progressive 4 plus new 4 is 1,732', () => assert.equal(price({ legacy: 4, progressive: 4, added: 4 }).grossBookingPrice, 1732))
check('7 cancelled Legacy is excluded', () => assert.equal(price({ legacy: 0, added: 4 }).grossBookingPrice, 2500))
check('8 expired pending Legacy is excluded', () => assert.equal(price({ legacy: 0, added: 4 }).grossBookingPrice, 2500))
check('9 sibling Legacy 2+2 contributes four sessions once', () => assert.equal(price({ legacy: 2 + 2, added: 4 }).grossBookingPrice, 2000))
check('10 wallet and reschedule rows do not change booking entitlement', () => assert.equal(price({ legacy: 4, added: 4 }).grossBookingPrice, 2000))
check('11 coupon applies after Progressive gross', () => {
  const result = price({ legacy: 4, added: 4, coupon: 300 })
  assert.deepEqual([result.grossBookingPrice, result.couponDiscount, result.finalBookingPrice], [2000, 300, 1700])
})
check('12 Legacy monetary evidence is never deducted', () => {
  assert.equal(price({ legacy: 4, added: 4 }).grossBookingPrice, 2000)
  assert.equal(price({ legacy: 4, added: 4 }).grossBookingPrice, 2000)
})

const baseRows = [
  { id: 'legacy-b', status: 'verified', totalSessions: 2, expiresAt: null },
  { id: 'legacy-a', status: 'pending_payment', totalSessions: 2, expiresAt: '2026-08-01T00:00:00.000000' },
]
check('13 fingerprint is insensitive to query row order', () => assert.equal(legacyFingerprint(baseRows), legacyFingerprint([...baseRows].reverse())))
check('14 fingerprint detects booking add/remove', () => assert.notEqual(legacyFingerprint(baseRows), legacyFingerprint(baseRows.slice(0, 1))))
check('15 fingerprint detects status eligibility changes', () => assert.notEqual(legacyFingerprint(baseRows), legacyFingerprint([{ ...baseRows[0], status: 'paid' }, baseRows[1]])))
check('16 fingerprint detects expiry changes', () => assert.notEqual(legacyFingerprint(baseRows), legacyFingerprint([baseRows[0], { ...baseRows[1], expiresAt: '2026-08-02T00:00:00.000000' }])))
check('17 fingerprint detects entitlement changes', () => assert.notEqual(legacyFingerprint(baseRows), legacyFingerprint([{ ...baseRows[0], totalSessions: 3 }, baseRows[1]])))

check('18 first scope stores the Legacy baseline once', () => {
  const current = { sessions: 4, fingerprint: legacyFingerprint(baseRows) }
  const scope = acquire(null, current, 0)
  assert.deepEqual(scope.baseline, current)
  assert.equal(scope.revision, 1)
})
check('19 concurrent first request is stale after authoritative initialization', () => {
  const current = { sessions: 4, fingerprint: legacyFingerprint(baseRows) }
  const scope = acquire(null, current, 0)
  expectCode('PROGRESSIVE_SCOPE_REVISION_CONFLICT', () => acquire(scope, current, 0))
})
check('20 initialized baseline drift fails closed', () => {
  const current = { sessions: 4, fingerprint: legacyFingerprint(baseRows) }
  const scope = acquire(null, current, 0)
  const changed = { sessions: 5, fingerprint: legacyFingerprint([...baseRows, { id: 'legacy-c', status: 'paid', totalSessions: 1, expiresAt: null }]) }
  expectCode('PROGRESSIVE_LEGACY_BASELINE_DRIFT', () => acquire(scope, changed, 1))
})
check('21 pre-compatibility scope lazily initializes only an empty baseline', () => {
  const empty = { sessions: 0, fingerprint: legacyFingerprint([]) }
  assert.equal(acquire({ revision: 3, initialized: false }, empty, 3).initialized, true)
  expectCode('PROGRESSIVE_LEGACY_BASELINE_DRIFT', () => acquire(
    { revision: 3, initialized: false },
    { sessions: 4, fingerprint: legacyFingerprint(baseRows) },
    3,
  ))
})
check('22 mutation key replay contract includes the expected baseline', () => {
  const input = { userId: 'user', requestId: 'request', revision: 0, legacyBaselineSessions: 4, legacyBaselineFingerprint: legacyFingerprint(baseRows) }
  assert.equal(mutationFingerprint(input), mutationFingerprint({ ...input }))
  assert.notEqual(mutationFingerprint(input), mutationFingerprint({ ...input, legacyBaselineSessions: 5 }))
})
check('23 later Progressive ordering continues after the baseline', () => {
  assert.equal(price({ legacy: 4, progressive: 4, added: 4 }).previousActiveSessions, 8)
})
check('24 edit and cancel repricing start from the stored baseline', () => {
  assert.equal(price({ legacy: 4, progressive: 0, added: 6 }).grossBookingPrice, 3000)
  assert.equal(price({ legacy: 4, progressive: 0, added: 1 }).grossBookingPrice, 625)
})

check('25 migration helper uses Legacy total_sessions only and no money', () => {
  const helper = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.progressive_legacy_baseline_v1'), migration.indexOf('CREATE OR REPLACE FUNCTION public.progressive_acquire_scope_v1'))
  assert.match(helper, /booking\.pricing_scope_id IS NULL/)
  assert.match(helper, /booking\.total_sessions/)
  assert.match(helper, /ORDER BY eligible\.id/)
  assert.doesNotMatch(helper, /total_price|paid_amount|payment_id|ledger|coupon|wallet/i)
})
check('26 migration preserves locks, immutable drift guard, and baseline-aware repricing', () => {
  assert.match(migration, /pg_advisory_xact_lock/)
  assert.match(migration, /prevent_progressive_legacy_baseline_change_v1/)
  assert.match(migration, /PROGRESSIVE_LEGACY_BASELINE_DRIFT/)
  assert.match(migration, /v_cumulative := v_scope\.legacy_baseline_sessions/)
  assert.match(migration, /ORDER BY booking\.created_at ASC, booking\.id ASC/)
})
check('27 create validates baseline under the atomic RPC and fingerprints it', () => {
  assert.match(migration, /p_expected_legacy_baseline_sessions integer/)
  assert.match(migration, /p_expected_legacy_baseline_fingerprint text/)
  assert.match(migration, /PROGRESSIVE_LEGACY_BASELINE_CONFLICT/)
  assert.match(migration, /p_expected_legacy_baseline_sessions::text[\s\S]+p_expected_legacy_baseline_fingerprint/)
  assert.match(migration, /reserve_progressive_coupon_v1/)
  assert.doesNotMatch(migration, /(?:INSERT INTO|UPDATE|DELETE FROM) public\.payments/i)
})
check('28 capability and grants require the new RPC signature at version 2', () => {
  assert.match(migration, /'version', 2/)
  assert.match(migration, /immutable_scope_v1/)
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.create_progressive_booking_v1[\s\S]+FROM PUBLIC, anon, authenticated/)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.create_progressive_booking_v1[\s\S]+TO service_role/)
  assert.match(write, /capability\.version !== 2/)
})
check('29 preview separates Legacy, Progressive, and new entitlement without Legacy money', () => {
  assert.match(preview, /legacyBaselineSessions/)
  assert.match(preview, /previousProgressiveActiveSessions/)
  assert.match(preview, /newBookingSessions/)
  assert.match(preview, /progressive_legacy_baseline_v1/)
  assert.doesNotMatch(preview, /total_price|paid_amount|payment_id|ledger/i)
})
check('30 create payload is opaque and server-authoritative', () => {
  assert.match(client, /expectedLegacyBaselineSessions: authoritativePreview\?\.legacyBaselineSessions/)
  assert.match(client, /expectedLegacyBaselineFingerprint: authoritativePreview\?\.legacyBaselineFingerprint/)
  assert.match(route, /isSha256Fingerprint/)
  assert.match(write, /p_expected_legacy_baseline_fingerprint/)
  assert.doesNotMatch(route, /body\.legacyBookingIds|body\.legacyTotalPrice|body\.legacyPayment/)
})
check('31 payment drain keeps the shared baseline-aware repricer', () => {
  assert.match(paymentMigration, /progressive_reprice_scope_v1\(v_batch\.pricing_scope_id, v_new_revision/)
  assert.match(migration, /recalculate_progressive_coupon_discount_v1/)
})
check('32 migration defines functions only and does not rewrite existing scope/payment data', () => {
  const beforeFunctions = migration.slice(0, migration.indexOf('CREATE OR REPLACE FUNCTION public.prevent_progressive_legacy_baseline_change_v1'))
  assert.doesNotMatch(beforeFunctions, /^\s*(?:UPDATE|INSERT INTO|DELETE FROM)\s+/im)
  assert.doesNotMatch(migration, /UPDATE public\.booking_pricing_scopes[\s\S]+WHERE legacy_baseline_initialized_at IS NULL/i)
})

console.log(`Progressive Legacy baseline compatibility checks passed: ${passed} checks.`)
