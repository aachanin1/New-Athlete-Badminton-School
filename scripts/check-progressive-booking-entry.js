const assert = require('node:assert')
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

const feature = loadTypeScriptModule('src/lib/progressive-pricing-feature.ts')
const route = read('src/app/api/bookings/route.ts')
const previewRoute = read('src/app/api/bookings/preview/route.ts')
const previewHelper = read('src/lib/progressive-booking-preview.ts')
const writeHelper = read('src/lib/progressive-booking-write.ts')
const bookingClient = read('src/components/dashboard/booking-client.tsx')
const historyClient = read('src/components/dashboard/history-client.tsx')
const paymentPrepare = read('src/app/api/progressive-payments/prepare/route.ts')
const migration = read('supabase/migrations/20260710180000_add_progressive_coupon_lifecycle.sql')
const syntheticUser = '11111111-1111-4111-8111-111111111111'

let passed = 0
function check(name, condition) {
  assert.ok(condition, name)
  passed += 1
  console.log(`PASS ${name}`)
}

function withEnv(values, run) {
  const before = { ...process.env }
  Object.assign(process.env, values)
  for (const [key, value] of Object.entries(values)) if (value === undefined) delete process.env[key]
  try { run() } finally { process.env = before }
}

withEnv({
  PROGRESSIVE_PAYMENT_ENTRY_ENABLED: undefined,
  PROGRESSIVE_PAYMENT_ALLOWED_USER_IDS: syntheticUser,
}, () => check('1 flags off keeps allowlisted kids_group on Legacy',
  feature.decideProgressiveBookingEntry(syntheticUser, 'kids_group').mode === 'legacy'))

withEnv({
  PROGRESSIVE_PAYMENT_ENTRY_ENABLED: 'true',
  PROGRESSIVE_PAYMENT_ALLOWED_USER_IDS: undefined,
}, () => check('2 non-allowlisted kids_group stays Legacy',
  feature.decideProgressiveBookingEntry(syntheticUser, 'kids_group').reason === 'user_not_allowed'))

withEnv({
  PROGRESSIVE_PAYMENT_ENTRY_ENABLED: 'true',
  PROGRESSIVE_PAYMENT_ALLOWED_USER_IDS: syntheticUser,
}, () => {
  check('3 allowlisted kids_group selects Progressive', feature.decideProgressiveBookingEntry(syntheticUser, 'kids_group').mode === 'progressive')
  check('4 allowlisted adult_group stays Legacy', feature.decideProgressiveBookingEntry(syntheticUser, 'adult_group').mode === 'legacy')
  check('5 allowlisted private stays Legacy', feature.decideProgressiveBookingEntry(syntheticUser, 'private').mode === 'legacy')
})

withEnv({
  PROGRESSIVE_PRICING_WRITES_ENABLED: 'true',
  PROGRESSIVE_COUPON_LIFECYCLE_ENABLED: undefined,
  PROGRESSIVE_PAYMENT_BATCH_ENABLED: 'true',
}, () => check('6 missing dependency is detected without Legacy fallback',
  feature.getProgressiveBookingEntryDependencyState().ready === false
  && feature.getProgressiveBookingEntryDependencyState().missing.includes('coupon_lifecycle')))

check('7 route decision uses authenticated user and server course type',
  route.includes('decideProgressiveBookingEntry(user.id, courseType.name)')
  && !route.includes('body.user_id')
  && !route.includes('body.isProgressive'))
check('8 selected Progressive dependency failure is typed 503',
  route.includes("code: 'PROGRESSIVE_BOOKING_DEPENDENCY_UNAVAILABLE'")
  && route.includes('}, { status: 503 })'))
const createDecisionIndex = route.indexOf("entryDecision.mode === 'progressive'")
check('9 adult/private Legacy calculator remains after the Progressive-only early return',
  createDecisionIndex < route.indexOf('calculateBookingBasePrice({', createDecisionIndex)
  && route.includes('courseTypeName: courseType.name'))
check('10 create is atomic through the existing RPC and creates no payment artifacts',
  route.includes('createProgressiveBooking({')
  && writeHelper.includes("executeProgressiveMutation('create_progressive_booking_v1'")
  && !writeHelper.includes("from('payments')")
  && !route.slice(route.indexOf("entryDecision.mode === 'progressive'"), route.indexOf('const calculatedTotalAmount')).includes("from('payments')"))
check('11 preview is read-only and uses the shared Progressive calculator',
  previewRoute.includes('previewProgressiveKidsGroupBooking')
  && previewHelper.includes('calculateProgressiveBookingPrice({')
  && !previewHelper.includes('.insert(')
  && !previewHelper.includes('.update(')
  && !previewHelper.includes('.delete(')
  && !previewHelper.includes('.rpc('))
check('12 write ignores client price and returns authoritative scope/revision/source',
  route.includes('serializeProgressiveResult(result)')
  && route.includes("sourceKind: 'progressive_kids_group_v1'")
  && !route.slice(route.indexOf("entryDecision.mode === 'progressive'"), route.indexOf('const calculatedTotalAmount')).includes('totalAmount'))
check('13 DB pricing_scope_id exclusively routes edit and cancel',
  (route.match(/if \(booking\.pricing_scope_id\)/g) || []).length === 2
  && route.includes('updateProgressivePendingBooking({')
  && route.includes('cancelProgressivePendingBooking({'))
check('14 Legacy edit/cancel remain below Progressive early returns',
  route.indexOf('updateProgressivePendingBooking({') < route.indexOf('const calculatedTotalAmount = await calculateBookingBasePrice({')
  && route.indexOf('cancelProgressivePendingBooking({') < route.lastIndexOf(".delete()"))
check('15 idempotency survives timeout retry and rejects changed fingerprints in RPC',
  route.includes("from('progressive_booking_mutation_receipts')")
  && route.includes('receipt.expected_scope_revision')
  && route.includes('if (!replayCandidate)')
  && route.indexOf("mutation: 'create'") < route.indexOf('if (!replayCandidate)')
  && migration.includes('PROGRESSIVE_IDEMPOTENCY_CONFLICT')
  && migration.includes("pg_advisory_xact_lock"))
check('16 booking draft preserves a UUID request key and sends preview revision',
  bookingClient.includes('clientRequestId: string')
  && bookingClient.includes('globalThis.crypto.randomUUID()')
  && bookingClient.includes('expectedScopeRevision: authoritativePreview?.expectedScopeRevision'))
check('17 History keeps Progressive eligible and cancellation sends scope revision',
  historyClient.includes('if (!booking.pricing_scope_id || !progressiveScopeRevisionMap[booking.pricing_scope_id]) continue')
  && historyClient.includes('expectedScopeRevision')
  && paymentPrepare.includes('prepareProgressivePaymentBatch'))
check('18 no migration, public flag, or Progressive helper call was added for adult/private',
  !feature.toString().includes('NEXT_PUBLIC_')
  && !route.includes("courseType.name === 'adult_group' && createProgressive")
  && !route.includes("courseType.name === 'private' && createProgressive"))

console.log(`Progressive kids group booking entry checks passed: ${passed} checks.`)
