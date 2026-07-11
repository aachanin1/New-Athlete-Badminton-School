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
  isProgressiveSlipOKTestMode,
  resolveProgressiveSlipVerification,
} = testModule.exports

let passed = 0
async function check(name, action) {
  await action()
  passed += 1
  console.log(`PASS ${name}`)
}

async function withEnv(values, action) {
  const previous = {
    legacy: process.env.SLIPOK_TEST_MODE,
    progressive: process.env.PROGRESSIVE_SLIPOK_TEST_MODE,
  }
  if (values.legacy === undefined) delete process.env.SLIPOK_TEST_MODE
  else process.env.SLIPOK_TEST_MODE = values.legacy
  if (values.progressive === undefined) delete process.env.PROGRESSIVE_SLIPOK_TEST_MODE
  else process.env.PROGRESSIVE_SLIPOK_TEST_MODE = values.progressive
  try {
    await action()
  } finally {
    if (previous.legacy === undefined) delete process.env.SLIPOK_TEST_MODE
    else process.env.SLIPOK_TEST_MODE = previous.legacy
    if (previous.progressive === undefined) delete process.env.PROGRESSIVE_SLIPOK_TEST_MODE
    else process.env.PROGRESSIVE_SLIPOK_TEST_MODE = previous.progressive
  }
}

async function main() {
  await check('1 progressive test mode is independent and makes no live or storage call', async () => {
    await withEnv({ legacy: 'false', progressive: 'true' }, async () => {
      liveCalls = 0
      let loadCalls = 0
      const mode = getProgressiveSlipProviderMode()
      const result = await resolveProgressiveSlipVerification({
        attemptId: 'attempt-1', totalAmount: 625, providerMode: mode,
        loadSlip: async () => { loadCalls += 1; throw new Error('test path must not load') },
      })
      assert.equal(mode, 'test')
      assert.equal(result.providerReference, 'TEST-attempt-1')
      assert.equal(result.decision, 'approved')
      assert.equal(liveCalls, 0)
      assert.equal(loadCalls, 0)
    })
  })

  await check('2 legacy true does not enable progressive test mode', async () => {
    await withEnv({ legacy: 'true', progressive: 'false' }, async () => {
      assert.equal(getProgressiveSlipProviderMode(), 'live')
      assert(legacyRoute.includes("process.env.SLIPOK_TEST_MODE === 'true'"))
      assert(!legacyRoute.includes('PROGRESSIVE_SLIPOK_TEST_MODE'))
    })
  })

  await check('3 both false selects mocked live helper without real network', async () => {
    await withEnv({ legacy: 'false', progressive: 'false' }, async () => {
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
    })
  })

  await check('4 malformed and unset progressive values fail closed', async () => {
    for (const value of [undefined, '', 'false', 'yes', '1', 'true-ish']) {
      assert.equal(isProgressiveSlipOKTestMode(value), false)
    }
    assert.equal(isProgressiveSlipOKTestMode(' TRUE '), true)
  })

  await check('5 client cannot select provider mode', async () => {
    assert(!submitSource.includes('body.testMode'))
    assert(!submitSource.includes('body.slipokMode'))
    assert(!submitSource.includes('body.providerMode'))
    assert(submitSource.includes('const providerMode = getProgressiveSlipProviderMode()'))
  })

  await check('6 resolved retries reuse one durable attempt and allocation path', async () => {
    assert(migration.includes('progressive_payment_attempt_key_unique'))
    assert(submitSource.includes("attempt.status === 'resolved' && attempt.decision"))
    assert(submitSource.includes("if (attempt.status !== 'resolved')"))
    assert(submitSource.includes('idempotencyKey: attempt.attemptId'))
  })

  await check('7 legacy and progressive import graphs stay isolated', async () => {
    assert(legacyRoute.includes("from '@/lib/slipok'"))
    assert(!legacyRoute.includes("@/lib/progressive-slipok"))
    assert(!progressiveSource.replaceAll('PROGRESSIVE_SLIPOK_TEST_MODE', '').includes('SLIPOK_TEST_MODE'))
    assert(!submitSource.replaceAll('PROGRESSIVE_SLIPOK_TEST_MODE', '').includes('SLIPOK_TEST_MODE'))
    assert(slipokSource.includes('export async function verifySlipLive'))
    assert(slipokSource.includes('return verifySlipLive(fileBuffer, fileName, expectedAmount)'))
  })

  console.log(`SlipOK Test Mode isolation checks passed: ${passed} checks.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
