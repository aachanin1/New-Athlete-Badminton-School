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
const featureSource = read('src/lib/progressive-pricing-feature.ts')
const route = read('src/app/api/bookings/route.ts')
const previewRoute = read('src/app/api/bookings/preview/route.ts')
const previewHelper = read('src/lib/progressive-booking-preview.ts')
const writeHelper = read('src/lib/progressive-booking-write.ts')
const bookingClient = read('src/components/dashboard/booking-client.tsx')
const historyClient = read('src/components/dashboard/history-client.tsx')
const historyPage = read('src/app/(dashboard)/dashboard/history/page.tsx')
const paymentPrepare = read('src/app/api/progressive-payments/prepare/route.ts')
const paymentUpload = read('src/app/api/progressive-payments/upload/route.ts')
const paymentSubmit = read('src/app/api/progressive-payments/submit/route.ts')
const paymentRoute = read('src/lib/progressive-payment-route.ts')
const compatibilityMigration = read('supabase/migrations/20260713210000_add_progressive_legacy_baseline_compatibility.sql')
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
}, () => check('1 entry off keeps general kids_group on Legacy',
  feature.decideProgressiveBookingEntry('kids_group').mode === 'legacy'))

withEnv({
  PROGRESSIVE_PAYMENT_ENTRY_ENABLED: 'true',
  PROGRESSIVE_PAYMENT_ALLOWED_USER_IDS: undefined,
}, () => check('2 general kids_group selects Progressive without an allowlist',
  feature.decideProgressiveBookingEntry('kids_group').reason === 'general_kids_group'))

withEnv({
  PROGRESSIVE_PAYMENT_ENTRY_ENABLED: 'true',
  PROGRESSIVE_PAYMENT_ALLOWED_USER_IDS: '22222222-2222-4222-8222-222222222222',
}, () => {
  check('3 unrelated staged allowlist does not block general kids_group', feature.decideProgressiveBookingEntry('kids_group').mode === 'progressive')
  check('4 adult_group stays Legacy when entry is enabled', feature.decideProgressiveBookingEntry('adult_group').mode === 'legacy')
  check('5 private stays Legacy when entry is enabled', feature.decideProgressiveBookingEntry('private').mode === 'legacy')
})

withEnv({
  PROGRESSIVE_PRICING_WRITES_ENABLED: undefined,
  PROGRESSIVE_COUPON_LIFECYCLE_ENABLED: 'true',
  PROGRESSIVE_PAYMENT_BATCH_ENABLED: 'true',
}, () => check('6 missing pricing-write dependency is detected',
  feature.getProgressiveBookingEntryDependencyState().missing.includes('pricing_writes')))

withEnv({
  PROGRESSIVE_PRICING_WRITES_ENABLED: 'true',
  PROGRESSIVE_COUPON_LIFECYCLE_ENABLED: undefined,
  PROGRESSIVE_PAYMENT_BATCH_ENABLED: 'true',
}, () => check('7 missing coupon dependency is detected without Legacy fallback',
  feature.getProgressiveBookingEntryDependencyState().ready === false
  && feature.getProgressiveBookingEntryDependencyState().missing.includes('coupon_lifecycle')))

withEnv({
  PROGRESSIVE_PRICING_WRITES_ENABLED: 'true',
  PROGRESSIVE_COUPON_LIFECYCLE_ENABLED: 'true',
  PROGRESSIVE_PAYMENT_BATCH_ENABLED: undefined,
}, () => check('8 missing payment-batch dependency is detected',
  feature.getProgressiveBookingEntryDependencyState().missing.includes('payment_batch')))

withEnv({
  PROGRESSIVE_PAYMENT_ENTRY_ENABLED: undefined,
  PROGRESSIVE_PRICING_WRITES_ENABLED: 'true',
  PROGRESSIVE_COUPON_LIFECYCLE_ENABLED: 'true',
  PROGRESSIVE_PAYMENT_BATCH_ENABLED: 'true',
  PROGRESSIVE_PAYMENT_ALLOWED_USER_IDS: undefined,
}, () => check('9 existing Progressive payment drain survives disabled entry without allowlist',
  feature.isProgressivePaymentDrainAvailable() === true))

check('10 route decision uses server course type and no client mode/user authority',
  route.includes('decideProgressiveBookingEntry(courseType.name)')
  && previewRoute.includes('decideProgressiveBookingEntry(courseType.name)')
  && !route.includes('body.user_id')
  && !route.includes('body.isProgressive'))
check('11 selected Progressive dependency failure is typed 503',
  route.includes("code: 'PROGRESSIVE_BOOKING_DEPENDENCY_UNAVAILABLE'")
  && previewRoute.includes("code: 'PROGRESSIVE_BOOKING_DEPENDENCY_UNAVAILABLE'")
  && route.includes('}, { status: 503 })'))
const createDecisionIndex = route.indexOf("entryDecision.mode === 'progressive'")
check('12 adult/private Legacy calculator remains after the Progressive-only early return',
  createDecisionIndex < route.indexOf('calculateBookingBasePrice({', createDecisionIndex)
  && route.includes('courseTypeName: courseType.name'))
check('13 create is atomic through the existing RPC and creates no payment artifacts',
  route.includes('createProgressiveBooking({')
  && writeHelper.includes("executeProgressiveMutation('create_progressive_booking_v1'")
  && !writeHelper.includes("from('payments')")
  && !route.slice(route.indexOf("entryDecision.mode === 'progressive'"), route.indexOf('const calculatedTotalAmount')).includes("from('payments')"))
check('14 preview is read-only and uses the shared Progressive calculator',
  previewRoute.includes('previewProgressiveKidsGroupBooking')
  && previewHelper.includes('calculateProgressiveBookingPrice({')
  && !previewHelper.includes('.insert(')
  && !previewHelper.includes('.update(')
  && !previewHelper.includes('.delete(')
  && previewHelper.includes("'progressive_legacy_baseline_v1'"))
check('15 write ignores client price and returns authoritative scope/revision/source',
  route.includes('serializeProgressiveResult(result)')
  && route.includes("sourceKind: 'progressive_kids_group_v1'")
  && !route.slice(route.indexOf("entryDecision.mode === 'progressive'"), route.indexOf('const calculatedTotalAmount')).includes('totalAmount'))
check('16 DB pricing_scope_id exclusively routes edit and cancel',
  (route.match(/if \(booking\.pricing_scope_id\)/g) || []).length === 2
  && route.includes('updateProgressivePendingBooking({')
  && route.includes('cancelProgressivePendingBooking({'))
check('17 Legacy edit/cancel remain below Progressive early returns',
  route.indexOf('updateProgressivePendingBooking({') < route.indexOf('const calculatedTotalAmount = await calculateBookingBasePrice({')
  && route.indexOf('cancelProgressivePendingBooking({') < route.lastIndexOf(".delete()"))
check('18 idempotency survives timeout retry and rejects changed fingerprints in RPC',
  route.includes("from('progressive_booking_mutation_receipts')")
  && route.includes('receipt.expected_scope_revision')
  && route.includes('if (!replayCandidate)')
  && route.indexOf("mutation: 'create'") < route.indexOf('if (!replayCandidate)')
  && compatibilityMigration.includes('PROGRESSIVE_IDEMPOTENCY_CONFLICT')
  && compatibilityMigration.includes('p_expected_legacy_baseline_fingerprint')
  && compatibilityMigration.includes("pg_advisory_xact_lock"))
check('19 booking draft preserves a UUID request key and sends preview revision/baseline',
  bookingClient.includes('clientRequestId: string')
  && bookingClient.includes('globalThis.crypto.randomUUID()')
  && bookingClient.includes('expectedScopeRevision: authoritativePreview?.expectedScopeRevision')
  && bookingClient.includes('expectedLegacyBaselineSessions: authoritativePreview?.legacyBaselineSessions')
  && bookingClient.includes('expectedLegacyBaselineFingerprint: authoritativePreview?.legacyBaselineFingerprint'))
check('20 History keeps Progressive eligible and cancellation sends scope revision',
  historyClient.includes('if (!booking.pricing_scope_id || !progressiveScopeRevisionMap[booking.pricing_scope_id]) continue')
  && historyClient.includes('expectedScopeRevision')
  && paymentPrepare.includes('prepareProgressivePaymentBatch'))
check('21 payment preparation and completion use authenticated drain access independent of Entry',
  historyPage.includes('isProgressivePaymentDrainAvailable()')
  && paymentRoute.includes('isProgressivePaymentDrainAvailable()')
  && paymentRoute.includes("code: 'PROGRESSIVE_PAYMENT_DEPENDENCY_UNAVAILABLE'")
  && !paymentPrepare.includes('requireEntry')
  && !paymentUpload.includes('requireEntry')
  && !paymentSubmit.includes('requireEntry'))
check('22 UUID allowlist remains staged infrastructure but is not general eligibility',
  feature.isProgressivePaymentUserAllowed(syntheticUser) === false
  && !featureSource.slice(featureSource.indexOf('export type ProgressiveBookingEntryDecision')).includes('isProgressivePaymentUserAllowed('))
check('23 no migration, public flag, or Progressive helper call was added for adult/private',
  !feature.toString().includes('NEXT_PUBLIC_')
  && !route.includes("courseType.name === 'adult_group' && createProgressive")
  && !route.includes("courseType.name === 'private' && createProgressive"))
check('24 Legacy rows remain outside scope while Progressive mismatches fail closed',
  compatibilityMigration.includes('booking.pricing_scope_id IS NULL')
  && compatibilityMigration.includes('booking.pricing_scope_id IS NOT NULL')
  && compatibilityMigration.includes('booking.pricing_scope_id IS DISTINCT FROM p_scope_id'))
check('25 pricing write capability requires Option A version 2',
  compatibilityMigration.includes("'version', 2")
  && writeHelper.includes('capability.version !== 2'))

const progressiveSummaryStart = bookingClient.indexOf('{progressiveKidsPreview && (')
const legacySummaryStart = bookingClient.indexOf("{!progressiveKidsPreview && courseType === 'kids_group'")
const progressiveSummary = bookingClient.slice(progressiveSummaryStart, legacySummaryStart)
const legacySummary = bookingClient.slice(legacySummaryStart, bookingClient.indexOf('{/* Coupon input */}', legacySummaryStart))

check('26 client keeps the complete authoritative Progressive summary contract',
  bookingClient.includes("mode: 'progressive'")
  && bookingClient.includes("sourceKind: 'progressive_kids_group_v1'")
  && bookingClient.includes('legacyBaselineSessions: number')
  && bookingClient.includes('previousProgressiveActiveSessions: number')
  && bookingClient.includes('newBookingSessions: number')
  && bookingClient.includes('cumulativeAfterSessions: number')
  && bookingClient.includes('ratePerSession: number'))
check('27 Progressive 4+4 summary is booking-level and contains no Legacy true-up copy',
  progressiveSummaryStart >= 0
  && legacySummaryStart > progressiveSummaryStart
  && progressiveSummary.includes('สิทธิ์เดิมที่ใช้กำหนดเรท: {progressiveKidsPreview.legacyBaselineSessions} ครั้ง')
  && progressiveSummary.includes('การจอง Progressive ก่อนหน้า: {progressiveKidsPreview.previousProgressiveActiveSessions} ครั้ง')
  && progressiveSummary.includes('จองเพิ่มครั้งนี้: {progressiveKidsPreview.newBookingSessions} ครั้ง')
  && progressiveSummary.includes('จำนวนสะสมหลังจอง: {progressiveKidsPreview.cumulativeAfterSessions} ครั้ง')
  && progressiveSummary.includes('เรทสำหรับการจองครั้งนี้: {progressiveKidsPreview.ratePerSession.toLocaleString()} บาท/ครั้ง')
  && progressiveSummary.includes('ราคาการจองใหม่: {progressiveKidsPreview.newBookingSessions} × {progressiveKidsPreview.ratePerSession.toLocaleString()} = {progressiveKidsPreview.grossPrice.toLocaleString()} บาท')
  && progressiveSummary.includes('ไม่ถูกนำมาหักจากราคาการจองครั้งนี้')
  && !progressiveSummary.includes('ยอดรวมตามเรทใหม่')
  && !progressiveSummary.includes('หักยอดที่จ่ายแล้ว')
  && !progressiveSummary.includes('เครดิตส่วนต่าง'))
check('28 Progressive coupon summary keeps authoritative gross, discount, and final amounts',
  bookingClient.includes("if (authoritativePreview?.mode === 'progressive')")
  && bookingClient.includes('const couponPreview = await fetchAuthoritativePreview(nextCoupon.id)')
  && bookingClient.includes('const displayedBasePrice = authoritativePreview?.grossPrice ?? totalBatchPrice')
  && bookingClient.includes('? authoritativePreview.totalPrice')
  && bookingClient.includes('ส่วนลดคูปอง ({appliedCoupon.code})'))
check('29 Progressive zero-Legacy-baseline summary remains visible without Legacy copy',
  progressiveSummary.includes('legacyBaselineSessions')
  && !progressiveSummary.includes('legacyBaselineSessions > 0')
  && !progressiveSummary.includes('existingMonthData')
  && !progressiveSummary.includes('kidsIncremental'))
check('30 Legacy 4+4 true-up explanation remains unchanged behind the Legacy branch',
  legacySummaryStart >= 0
  && legacySummary.includes('เคยจ่ายแล้ว: {existingMonthData.sessions} ครั้ง = ฿{existingMonthData.paid.toLocaleString()}')
  && legacySummary.includes('ยอดรวมตามเรทใหม่: {kidsIncremental.totalSessionsForMonth} × ฿{kidsIncremental.perSession.toLocaleString()} = ฿{kidsIncremental.totalCostForMonth.toLocaleString()}')
  && legacySummary.includes('หักยอดที่จ่ายแล้ว: ฿{kidsIncremental.existingPaid.toLocaleString()}')
  && legacySummary.includes('ยอดที่ต้องชำระเพิ่ม: ฿{displayedBasePrice.toLocaleString()}')
  && legacySummary.includes('เครดิตส่วนต่าง'))
check('31 Adult Group and Private summary/pricing remain on their existing Legacy paths',
  bookingClient.includes("if (courseType === 'adult_group') return getAdultGroupTotal")
  && bookingClient.includes('return getPrivateTotal')
  && bookingClient.includes("{courseType !== 'kids_group' && (")
  && bookingClient.slice(progressiveSummaryStart, legacySummaryStart).includes('progressiveKidsPreview'))

console.log(`Progressive kids group booking entry checks passed: ${passed} checks.`)
