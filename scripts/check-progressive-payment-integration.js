const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const migration = read('supabase/migrations/20260711150500_add_progressive_payment_integration.sql')
const feature = read('src/lib/progressive-pricing-feature.ts')
const integration = read('src/lib/progressive-payment-integration.ts')
const prepareRoute = read('src/app/api/progressive-payments/prepare/route.ts')
const uploadRoute = read('src/app/api/progressive-payments/upload/route.ts')
const submitRoute = read('src/app/api/progressive-payments/submit/route.ts')
const statusRoute = read('src/app/api/progressive-payments/[batchId]/status/route.ts')
const adminRoute = read('src/app/api/admin/payments/route.ts')
const adminPage = read('src/app/(admin)/admin/payments/page.tsx')
const financePage = read('src/app/(admin)/admin/finance/page.tsx')
const financeClient = read('src/components/admin/finance-client.tsx')

let passed = 0
function check(name, condition) {
  if (!condition) throw new Error(`FAIL ${name}`)
  passed += 1
  console.log(`PASS ${name}`)
}

check('1 allowlist defaults to deny and accepts only validated UUIDs',
  feature.includes('if (!raw) return new Set<string>()')
  && feature.includes("values.some((value) => !UUID_PATTERN.test(value))"))
check('2 entry and review controls are separate server-only environment variables',
  feature.includes('PROGRESSIVE_PAYMENT_ENTRY_ENABLED')
  && feature.includes('PROGRESSIVE_PAYMENT_REVIEW_ENABLED')
  && !feature.includes('NEXT_PUBLIC_PROGRESSIVE'))
check('3 cross-user batch access is denied by route ownership checks',
  uploadRoute.includes('batch.userId !== access.user.id')
  && statusRoute.includes('batch.userId !== access.user.id'))
check('4 client amount is not accepted by progressive prepare',
  !prepareRoute.includes('expectedAmount') && prepareRoute.includes('userId: access.user.id'))
check('5 oldest contiguous prefix remains enforced by the Slice 4A RPC',
  read('supabase/migrations/20260711120000_add_progressive_payment_batches.sql').includes('PROGRESSIVE_PAYMENT_PREFIX_REQUIRED'))
check('6 prepared TTL is 30 minutes with lazy cancel and scope unlock',
  migration.includes("interval '30 minutes'")
  && migration.includes('expire_progressive_prepared_batch_v1')
  && migration.includes('locked_by_payment_batch_id = NULL'))
check('7 cancel preserves coupon reservations',
  migration.includes('cancel_progressive_prepared_batch_v1')
  && !migration.slice(migration.indexOf('cancel_progressive_prepared_batch_v1'), migration.indexOf('expire_progressive_prepared_batch_v1')).includes('release_progressive_coupon'))
check('8 progressive upload uses a private bucket and deterministic path',
  migration.includes("'progressive-payment-slips',\n  false")
  && uploadRoute.includes('`${access.user.id}/batches/${batchId}/${inspected.sha256}.${inspected.extension}`'))
check('9 upload validates magic bytes and five megabyte limit',
  integration.includes('PROGRESSIVE_PAYMENT_MAX_FILE_BYTES = 5 * 1024 * 1024')
  && integration.includes("buffer[0] === 0xff")
  && integration.includes("toString('ascii') === 'WEBP'"))
check('10 duplicate hash upload is idempotent',
  uploadRoute.includes('upsert: true') && migration.includes('v_batch.slip_sha256 = lower(p_sha256)'))
check('11 test mode resolver cannot call the network',
  integration.includes('resolveProgressiveSlipTestMode')
  && !integration.includes('verifySlip(')
  && !submitRoute.includes("@/lib/slipok"))
check('12 submit creates one durable verification attempt',
  migration.includes('progressive_payment_attempt_key_unique')
  && submitRoute.includes('recordProgressiveVerificationAttempt'))
check('13 resolved attempt retries reuse the stored result',
  submitRoute.includes("attempt.status === 'resolved' && attempt.decision")
  && submitRoute.includes("if (attempt.status !== 'resolved')"))
check('14 approve and reject remain whole-batch atomic decisions',
  adminRoute.includes('approveProgressivePaymentBatch')
  && adminRoute.includes('rejectProgressivePaymentBatch')
  && !adminRoute.includes('allocationId'))
check('15 under-review remains a locked non-terminal batch state',
  migration.includes('mark_progressive_batch_under_review_v1')
  && !migration.slice(migration.indexOf('mark_progressive_batch_under_review_v1'), migration.indexOf('record_progressive_verification_attempt_v1')).includes('locked_by_payment_batch_id = NULL'))
check('16 Standard Admin serialization omits amount fields',
  adminPage.includes("...(canViewFinancialAmounts ? { amount:")
  && adminPage.includes("...(canViewFinancialAmounts ? { total_price:")
  && !adminPage.includes('amount: canViewFinancialAmounts'))
check('17 finance uses approved allocations and distinct progressive batch transaction ids',
  financePage.includes(".from('payment_ledger_allocations_v1')")
  && financePage.includes("transaction_id: `progressive:${allocation.source_id}`")
  && financeClient.includes('new Set(approvedPayments.map((payment) => payment.transaction_id)).size'))
check('18 legacy and progressive coexist without summing batch headers',
  migration.includes("'legacy'::text AS source_kind")
  && migration.includes("'progressive'::text")
  && financePage.includes('[...paymentList, ...progressivePaymentList]')
  && !financePage.includes('total_amount + allocated_amount'))

console.log(`Progressive payment integration checks passed: ${passed} checks.`)
