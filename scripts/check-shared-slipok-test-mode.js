const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const progressiveSource = read('src/lib/progressive-slipok.ts')
const submitSource = read('src/app/api/progressive-payments/submit/route.ts')
const legacyRoute = read('src/app/api/verify-slip/route.ts')
const slipokSource = read('src/lib/slipok.ts')
const migration = read('supabase/migrations/20260711150500_add_progressive_payment_integration.sql')
const progressiveOnlyFlag = ['PROGRESSIVE', 'SLIPOK', 'TEST', 'MODE'].join('_')

let liveResult = null
let liveCalls = 0
const compiled = ts.transpileModule(progressiveSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const testModule = { exports: {} }
const requireMock = (request) => {
  if (request !== '@/lib/slipok') throw new Error(`Unexpected import: ${request}`)
  return {
    isSlipOKTimeout: (response) => Boolean(response?.timeout || response?.code === 'SLIPOK_TIMEOUT'),
    validateSlipData: (data, expected) => ({ valid: Boolean(data) && Math.abs(data.amount - expected) <= 1 }),
    verifySlipLive: async () => {
      liveCalls += 1
      return liveResult
    },
  }
}
new Function('require', 'module', 'exports', 'process', compiled)(requireMock, testModule, testModule.exports, process)
const {
  getProgressiveSlipProviderMode,
  isSharedSlipOKTestMode,
  resolveProgressiveSlipVerification,
} = testModule.exports

let passed = 0
async function check(name, action) {
  await action()
  passed += 1
  console.log(`PASS ${name}`)
}

async function withGlobalMode(value, action) {
  const previous = process.env.SLIPOK_TEST_MODE
  if (value === undefined) delete process.env.SLIPOK_TEST_MODE
  else process.env.SLIPOK_TEST_MODE = value
  try {
    await action()
  } finally {
    if (previous === undefined) delete process.env.SLIPOK_TEST_MODE
    else process.env.SLIPOK_TEST_MODE = previous
  }
}

async function main() {
  await check('1 global true keeps Legacy and Progressive in no-network auto-approve mode', async () => {
    await withGlobalMode('true', async () => {
      liveCalls = 0
      let loadCalls = 0
      const mode = getProgressiveSlipProviderMode()
      const result = await resolveProgressiveSlipVerification({
        attemptId: 'attempt-1', totalAmount: 625, providerMode: mode,
        loadSlip: async () => { loadCalls += 1; throw new Error('test mode must not load the slip') },
      })
      assert.equal(mode, 'test')
      assert.equal(result.decision, 'approved')
      assert.equal(result.providerReference, 'TEST-attempt-1')
      assert.equal(result.verifiedAmount, 625)
      assert.equal(liveCalls, 0)
      assert.equal(loadCalls, 0)
      assert(legacyRoute.includes("process.env.SLIPOK_TEST_MODE === 'true'"))
      assert(legacyRoute.includes("verificationStatus = 'approved'"))
      assert(legacyRoute.includes("const nextBookingStatus = verificationStatus === 'approved' ? 'verified' : 'paid'"))
    })
  })

  await check('2 global false selects mocked live paths without a real network call', async () => {
    await withGlobalMode('false', async () => {
      liveCalls = 0
      liveResult = { success: true, data: { transRef: 'MOCK-LIVE', amount: 625, date: '2026-07-11' } }
      let loadCalls = 0
      const result = await resolveProgressiveSlipVerification({
        attemptId: 'attempt-2', totalAmount: 625, providerMode: getProgressiveSlipProviderMode(),
        loadSlip: async () => { loadCalls += 1; return { buffer: Buffer.from('mock'), fileName: 'mock.png' } },
      }, { verifyLive: requireMock('@/lib/slipok').verifySlipLive })
      assert.equal(result.decision, 'approved')
      assert.equal(result.providerReference, 'MOCK-LIVE')
      assert.equal(liveCalls, 1)
      assert.equal(loadCalls, 1)
      assert(legacyRoute.includes('buildCanonicalSlipFileName(inspected.extension)'))
      assert(!legacyRoute.includes('verifySlip(fileBuffer, file.name'))
    })
  })

  await check('3 malformed and unset shared mode values fail closed to the live path', async () => {
    for (const value of [undefined, '', 'false', 'TRUE', ' true ', 'yes', '1', 'true-ish']) {
      assert.equal(isSharedSlipOKTestMode(value), false)
    }
    assert.equal(isSharedSlipOKTestMode('true'), true)
  })

  await check('4 clients cannot select Test or Live mode', async () => {
    for (const field of ['testMode', 'slipokMode', 'providerMode']) {
      assert(!submitSource.includes(`body.${field}`))
    }
    assert(submitSource.includes('const providerMode = getProgressiveSlipProviderMode()'))
  })

  await check('5 Progressive retries keep one attempt, result, approval and allocation path', async () => {
    assert(migration.includes('progressive_payment_attempt_key_unique'))
    assert(submitSource.includes("attempt.status === 'resolved' && attempt.decision"))
    assert(submitSource.includes("if (attempt.status !== 'resolved')"))
    assert(submitSource.includes('idempotencyKey: attempt.attemptId'))
  })

  await check('6 only the shared server-side flag controls payment verification mode', async () => {
    assert(!progressiveSource.includes(progressiveOnlyFlag))
    assert(!submitSource.includes(progressiveOnlyFlag))
    assert(!legacyRoute.includes(progressiveOnlyFlag))
    assert(progressiveSource.includes('process.env.SLIPOK_TEST_MODE'))
    assert(!progressiveSource.includes('NEXT_PUBLIC_'))
    assert(slipokSource.includes('export async function verifySlipLive'))
    assert(slipokSource.includes('return verifySlipLive(fileBuffer, fileName, expectedAmount)'))
  })

  console.log(`Shared SlipOK Test Mode checks passed: ${passed} checks.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
