const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const migration = read('supabase/migrations/20260711150500_add_progressive_payment_integration.sql')
const feature = read('src/lib/progressive-pricing-feature.ts')
const integration = read('src/lib/progressive-payment-integration.ts')
const progressiveSlipok = read('src/lib/progressive-slipok.ts')
const prepareRoute = read('src/app/api/progressive-payments/prepare/route.ts')
const uploadRoute = read('src/app/api/progressive-payments/upload/route.ts')
const legacyUploadRoute = read('src/app/api/verify-slip/route.ts')
const submitRoute = read('src/app/api/progressive-payments/submit/route.ts')
const statusRoute = read('src/app/api/progressive-payments/[batchId]/status/route.ts')
const historyClient = read('src/components/dashboard/history-client.tsx')
const adminRoute = read('src/app/api/admin/payments/route.ts')
const adminPage = read('src/app/(admin)/admin/payments/page.tsx')
const financePage = read('src/app/(admin)/admin/finance/page.tsx')
const financeClient = read('src/components/admin/finance-client.tsx')
const progressiveOnlySlipokFlag = ['PROGRESSIVE', 'SLIPOK', 'TEST', 'MODE'].join('_')

let passed = 0
function check(name, condition) {
  if (!condition) throw new Error(`FAIL ${name}`)
  passed += 1
  console.log(`PASS ${name}`)
}

check('1 staged allowlist helper defaults to deny but is not general eligibility',
  feature.includes('if (!raw) return new Set<string>()')
  && feature.includes("values.some((value) => !UUID_PATTERN.test(value))")
  && !feature.slice(feature.indexOf('export type ProgressiveBookingEntryDecision')).includes('isProgressivePaymentUserAllowed('))
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
check('9 upload validates magic bytes and four mebibyte limit',
  integration.includes('PROGRESSIVE_PAYMENT_MAX_FILE_BYTES = 4 * 1024 * 1024')
  && integration.includes("buffer[0] === 0xff")
  && integration.includes("toString('ascii') === 'WEBP'"))
check('10 declared MIME is logged but never used as file-type authority',
  uploadRoute.includes('declaredMimeType: context.declaredMimeType')
  && !uploadRoute.includes("['image/jpeg', 'image/png', 'image/webp'].includes(file.type)")
  && !uploadRoute.includes('file.type !== inspected.mimeType'))
check('11 storage MIME and extension come only from inspected bytes',
  uploadRoute.includes('${inspected.sha256}.${inspected.extension}')
  && uploadRoute.includes('contentType: inspected.mimeType')
  && uploadRoute.includes('mimeType: inspected.mimeType'))
check('12 upload exposes stable safe errors for every required failure class',
  [
    'PROGRESSIVE_UPLOAD_INVALID_PAYLOAD',
    'PROGRESSIVE_UPLOAD_FILE_TOO_LARGE',
    'PROGRESSIVE_UPLOAD_UNSUPPORTED_FILE',
    'PROGRESSIVE_UPLOAD_BATCH_NOT_READY',
    'PROGRESSIVE_UPLOAD_STORAGE_FAILED',
    'PROGRESSIVE_UPLOAD_INTERNAL_ERROR',
  ].every((code) => uploadRoute.includes(code))
  && uploadRoute.includes("error: 'ไฟล์สลิปต้องมีขนาดไม่เกิน 4 MB'"))
check('13 upload logging excludes filenames, bytes, users, batches, and secrets',
  uploadRoute.includes("console.warn('[progressive-payment-upload]', {")
  && uploadRoute.includes('requestId,')
  && uploadRoute.includes('detectedMimeType: context.detectedMimeType')
  && !uploadRoute.includes('filename:')
  && !uploadRoute.includes('userId: context')
  && !uploadRoute.includes('batchId: context')
  && !uploadRoute.includes('buffer: context'))
check('14 client uses the matching four MB limit without trusting declared MIME',
  historyClient.includes('PAYMENT_SLIP_MAX_FILE_BYTES = 4 * 1024 * 1024')
  && historyClient.includes('ขนาดไม่เกิน 4 MB')
  && !historyClient.includes("if (!file.type.startsWith('image/'))"))
check('15 client parses JSON fail-safe and returns HTTP errors without throwing into the network catch',
  historyClient.includes('async function readJsonResponse')
  && historyClient.includes('const uploadResult = await readJsonResponse')
  && historyClient.includes('if (!uploadResponse.ok) {')
  && !historyClient.includes("throw new Error(uploadResult.error || 'อัปโหลดสลิปไม่สำเร็จ')")
  && historyClient.includes('caught instanceof ProgressivePaymentTransportError'))
check('16 duplicate hash upload is idempotent',
  uploadRoute.includes('upsert: true') && migration.includes('v_batch.slip_sha256 = lower(p_sha256)'))
check('17 test mode resolver cannot call the network',
  progressiveSlipok.includes('process.env.SLIPOK_TEST_MODE')
  && !progressiveSlipok.includes(progressiveOnlySlipokFlag)
  && progressiveSlipok.includes("input.providerMode === 'test'")
  && progressiveSlipok.indexOf("input.providerMode === 'test'") < progressiveSlipok.indexOf('input.loadSlip()')
  && !submitRoute.includes("@/lib/slipok"))
check('18 submit creates one durable verification attempt',
  migration.includes('progressive_payment_attempt_key_unique')
  && submitRoute.includes('recordProgressiveVerificationAttempt'))
check('19 resolved attempt retries reuse the stored result',
  submitRoute.includes("attempt.status === 'resolved' && attempt.decision")
  && submitRoute.includes("if (attempt.status !== 'resolved')"))
check('20 approve and reject remain whole-batch atomic decisions',
  adminRoute.includes('approveProgressivePaymentBatch')
  && adminRoute.includes('rejectProgressivePaymentBatch')
  && !adminRoute.includes('allocationId'))
check('21 under-review remains a locked non-terminal batch state',
  migration.includes('mark_progressive_batch_under_review_v1')
  && !migration.slice(migration.indexOf('mark_progressive_batch_under_review_v1'), migration.indexOf('record_progressive_verification_attempt_v1')).includes('locked_by_payment_batch_id = NULL'))
check('22 Standard Admin serialization omits amount fields',
  adminPage.includes("...(canViewFinancialAmounts ? { amount:")
  && adminPage.includes("...(canViewFinancialAmounts ? { total_price:")
  && !adminPage.includes('amount: canViewFinancialAmounts'))
check('23 finance uses approved allocations and distinct progressive batch transaction ids',
  financePage.includes(".from('payment_ledger_allocations_v1')")
  && financePage.includes("transaction_id: `progressive:${allocation.source_id}`")
  && financeClient.includes('new Set(approvedPayments.map((payment) => payment.transaction_id)).size'))
check('24 legacy and progressive coexist without summing batch headers',
  migration.includes("'legacy'::text AS source_kind")
  && migration.includes("'progressive'::text")
  && financePage.includes('[...paymentList, ...progressivePaymentList]')
  && !financePage.includes('total_amount + allocated_amount'))
check('25 Legacy upload reuses the four mebibyte magic-byte contract',
  legacyUploadRoute.includes('PROGRESSIVE_PAYMENT_MAX_FILE_BYTES')
  && legacyUploadRoute.includes('inspectProgressiveSlip(fileBuffer)')
  && !legacyUploadRoute.includes("file.type.startsWith('image/')"))
check('26 Legacy file rejection happens before Storage and payment writes',
  legacyUploadRoute.indexOf('file.size > PROGRESSIVE_PAYMENT_MAX_FILE_BYTES') < legacyUploadRoute.indexOf(".from('payment-slips')")
  && legacyUploadRoute.indexOf('inspectProgressiveSlip(fileBuffer)') < legacyUploadRoute.indexOf(".from('payment-slips')")
  && legacyUploadRoute.indexOf('inspectProgressiveSlip(fileBuffer)') < legacyUploadRoute.indexOf(".from('payments')"))
check('27 Legacy exposes stable Thai upload errors for payload, size, and content',
  legacyUploadRoute.includes('INVALID_SLIP_UPLOAD_PAYLOAD')
  && legacyUploadRoute.includes('SLIP_FILE_TOO_LARGE')
  && legacyUploadRoute.includes('INVALID_SLIP_FILE_TYPE')
  && legacyUploadRoute.includes("'ไฟล์สลิปต้องมีขนาดไม่เกิน 4 MB'")
  && legacyUploadRoute.includes("'เนื้อไฟล์ไม่ใช่ JPEG, PNG หรือ WebP ที่ระบบรองรับ'"))
check('28 Legacy Storage MIME and extension come only from inspected bytes',
  legacyUploadRoute.includes('buildSlipPublicPath(user.id, bookingIds[0], inspected.extension)')
  && legacyUploadRoute.includes('contentType: inspected.mimeType')
  && !legacyUploadRoute.includes('contentType: file.type'))
check('29 future Legacy live SlipOK uses a canonical detected extension',
  legacyUploadRoute.includes('buildCanonicalSlipFileName(inspected.extension)')
  && !legacyUploadRoute.includes('verifySlip(fileBuffer, file.name'))

console.log(`Progressive payment integration checks passed: ${passed} checks.`)
