import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createHash, randomUUID } from 'node:crypto'
import ts from 'typescript'

// Pure contract checks: no runtime helper, network, Auth client or database import.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const evidenceRoot = path.join(root, '.playwright/no-class-return-1')
const manifest = path.resolve(process.env.LESSON_SOURCE_RUN_MANIFEST || path.join(evidenceRoot, 'run.json'))
assert.ok([path.join(evidenceRoot, 'run.json'), path.join(evidenceRoot, 'fresh/run.json')].includes(manifest), 'Wrong task manifest')
const run = JSON.parse(fs.readFileSync(manifest, 'utf8'))
assert.match(run.runId, /^no-class-return-1-20261104-[a-f0-9-]{36}$/)
assert.ok(['NoClassReturn20261104', 'NoClassReturnFresh20261104'].includes(run.target.project))
assert.equal(path.resolve(run.evidenceRoot), path.dirname(manifest))
assert.equal(path.resolve(run.outputDir), path.join(path.dirname(manifest), 'acceptance'))
const tested = ['src/lib/no-class-return.ts', 'src/lib/no-class-return-server.ts',
  'src/lib/no-class-return-release.ts', 'src/app/api/admin/makeup/return-round/route.ts']
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const definitionHash = sha(fs.readFileSync(fileURLToPath(import.meta.url)))
const sourceBytes = new Map(tested.map(file => [file, fs.readFileSync(path.join(root, file))]))
const sourceHashes = Object.fromEntries([...sourceBytes].map(([file, bytes]) => [file, sha(bytes)]))
const results = []
function check(value, name) { assert.equal(value, true, name); results.push({ name, passed: true }) }
function load(file, dependencies = {}) {
  const loadedModule = { exports: {} }
  assert.ok(sourceBytes.has(file), 'Only hash-bound source can run in this harness')
  const code = ts.transpileModule(sourceBytes.get(file).toString('utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, { module: loadedModule, exports: loadedModule.exports, require: name => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name]
    throw Error('Unexpected dependency in pure test: ' + name)
  }, Date, Set, Error, Number, Array, JSON }, { filename: file })
  return loadedModule.exports
}
const shared = load(tested[0]), clone = value => JSON.parse(JSON.stringify(value))
const a = '10000000-0000-4000-8000-000000000001', b = '10000000-0000-4000-8000-000000000002'
const slot = '10000000-0000-4000-8000-000000000003', unit = '10000000-0000-4000-8000-000000000004'
const requestId = '10000000-0000-4000-8000-000000000005', creditId = '10000000-0000-4000-8000-000000000006'
const preview = { eligible: true, anchorId: a, scopeFingerprint: 'sha256', scheduleSlotId: slot, coachId: null,
  coachName: null, branchName: 'fixture', courseType: 'private', date: '2026-11-01', startTime: '11:00:00', endTime: '13:00:00',
  sessions: [{ sessionId: a, learnerName: 'A', parentName: 'P', unitId: unit }, { sessionId: b, learnerName: 'B', parentName: 'P', unitId: unit }],
  units: [{ unitId: unit, sessionIds: [a, b], amount: 2, unit: 'hour', expiresAt: '2027-06-30T16:59:59.999Z' }],
  targetSessionIds: [a, b], targetCount: 2, blockers: [], coachHours: 0 }
const receipt = { confirmed: true, requestId, anchorId: a, recordedAt: '2026-11-04T05:00:00.000Z',
  targetSessionIds: [a, b], targetCount: 2, credits: [{ ...preview.units[0], creditId }], coachHours: 0 }
class ServerError extends Error { constructor(message, code) { super(message); this.databaseCode = code } }
let dbResult = preview, dbError = null, calls = 0, origin = true
let access = { ok: true, ctx: { user: { id: b } } }
const request = body => ({ headers: { get: () => null }, json: async () => body })
const flags = { noClassReturnReadOnly: false }
const route = load(tested[3], {
  'next/server': { NextResponse: { json: (body, options) => ({ body, ...options }) } },
  '@/lib/auth/admin': { requireAdminMenuAccess: async () => access },
  '@/lib/progressive-payment-integration': { isSameOriginMutation: () => origin },
  '@/lib/no-class-return': shared,
  '@/lib/no-class-return-server': { NoClassReturnServerError: ServerError, readOrReturnUntaughtRound: async () => {
    calls++; if (dbError) throw dbError; return dbResult
  } }, '@/lib/no-class-return-release': flags,
})
const base = { mode: 'commit', anchor: a, requestId, expected: preview.scopeFingerprint, reason: 'fixture' }
let failure
try {
  check(shared.isNoClassReturnPreview(preview, a), 'valid full Family unit preview')
  check(shared.isNoClassReturnPreview({ ...preview, eligible: false, blockers: [{ code: 'FAMILY_SCOPE', message: 'blocked' }] }, a), 'blocked partition preview')
  check(shared.isNoClassReturnPreview({ ...preview, eligible: false, sessions: [], units: [], targetSessionIds: [], targetCount: 0,
    blockers: [{ code: 'INELIGIBLE', message: 'blocked' }] }, a), 'blocked empty preview')
  for (const [name, mutate] of [
    ['duplicate preview member', x => { x.sessions[1].sessionId = a }],
    ['incomplete Family preview', x => { x.units[0].sessionIds = [a] }],
    ['extra unit member', x => { x.units[0].sessionIds.push(creditId) }],
    ['zero unit amount', x => { x.units[0].amount = 0 }], ['unknown course', x => { x.courseType = 'other' }],
    ['invalid expiry', x => { x.units[0].expiresAt = 'bad' }], ['nonzero coach hours', x => { x.coachHours = 1 }],
    ['wrong target count', x => { x.targetCount = 1 }], ['blocked malformed partition', x => { x.eligible = false; x.units = [] }],
  ]) { const value = clone(preview); mutate(value); check(!shared.isNoClassReturnPreview(value, a), name) }
  check(shared.isNoClassReturnReceipt(receipt, requestId, a, preview), 'valid durable receipt')
  for (const [name, mutate] of [
    ['wrong receipt request', x => { x.requestId = b }], ['wrong receipt anchor', x => { x.anchorId = b }],
    ['missing Family receipt member', x => { x.credits[0].sessionIds = [a] }],
    ['changed receipt expiry', x => { x.credits[0].expiresAt = '2027-07-01T16:59:59.999Z' }],
    ['changed receipt amount', x => { x.credits[0].amount = 1 }], ['changed receipt unit', x => { x.credits[0].unit = 'session' }],
    ['duplicate receipt credit', x => { x.credits.push({ ...x.credits[0], creditId: b }) }], ['unconfirmed receipt', x => { x.confirmed = false }],
  ]) { const value = clone(receipt); mutate(value); check(!shared.isNoClassReturnReceipt(value, requestId, a, preview), name) }
  let response = await route.POST(request({ mode: 'preview', anchor: a }))
  check(response.status === 200 && response.body === preview, 'preview API response')
  check(response.headers['Cache-Control'] === 'private, no-store', 'private uncached response')
  for (const [name, body] of [
    ['array mode', { mode: ['preview'], anchor: a }], ['invalid anchor', { mode: 'preview', anchor: 'bad' }],
    ['spoofed actor', { ...base, actor: b }], ['empty reason', { ...base, reason: ' ' }], ['missing status request ID', { mode: 'status', anchor: a }],
  ]) { const before = calls; response = await route.POST(request(body)); check(response.status === 400 && response.body.definitive === true && calls === before, 'reject before RPC: ' + name) }
  origin = false; response = await route.POST(request(base)); check(response.status === 403, 'same origin guard'); origin = true
  access = { ok: false, status: 403, message: 'denied' }; response = await route.POST(request(base)); check(response.status === 403, 'menu permission guard')
  access = { ok: true, ctx: { user: { id: b } } }
  dbResult = receipt; response = await route.POST(request(base)); check(response.status === 200 && response.body.confirmed, 'commit API receipt')
  dbResult = { confirmed: false, requestId, pending: true, definitive: false }
  response = await route.POST(request({ mode: 'status', anchor: a, requestId })); check(response.status === 200 && response.body.pending, 'pending status preserved')
  dbResult = { confirmed: true, requestId }; response = await route.POST(request(base)); check(response.status === 503 && response.body.definitive === false, 'malformed receipt remains unknown')
  for (const code of ['NOT_ENDED', 'ATTENDANCE_EXISTS', 'ALREADY_USED', 'EXPIRED', 'FAMILY_SCOPE', 'AMBIGUOUS', 'CLOSED_PAYROLL',
    'CLOSED_REVIEW', 'INELIGIBLE', 'SCOPE_CHANGED', 'REQUEST_MISMATCH', 'BUSY', 'INCOMPLETE']) {
    dbError = new ServerError('NO_CLASS_RETURN_' + code); response = await route.POST(request(base))
    check(response.status === 409 && response.body.definitive === true, 'definitive rollback: ' + code)
  }
  for (const code of ['40P01', '40001', '55P03', '57014']) {
    dbError = new ServerError('transaction aborted', code); response = await route.POST(request(base))
    check(response.status === 409 && response.body.definitive === true, 'PG transaction rollback: ' + code)
  }
  dbError = new ServerError('TASK10_FORBIDDEN'); response = await route.POST(request(base)); check(response.status === 403 && response.body.definitive, 'DB authorization mapping')
  dbError = new ServerError('NO_CLASS_RETURN_INVALID_REQUEST'); response = await route.POST(request(base)); check(response.status === 400 && response.body.definitive, 'DB invalid request mapping')
  dbError = new Error('fetch failed'); response = await route.POST(request(base)); check(response.status === 503 && response.body.definitive === false, 'transport remains unknown')

  const rpcCalls = []
  const bridge = load(tested[1], { 'server-only': {}, '@/lib/auth/admin': { getServiceRoleClient: () => ({ rpc: async (name, args) => {
    rpcCalls.push({ name, args }); return { data: { fixture: true }, error: null }
  } }) } })
  await bridge.readOrReturnUntaughtRound({ actor: b, anchor: a, mode: 'commit', requestId, expected: 'fingerprint', reason: ' reason ', ip: '127.0.0.1' })
  check(rpcCalls[0].name === 'admin_no_class_return_v1', 'server RPC name')
  check(JSON.stringify(Object.keys(rpcCalls[0].args).sort()) === JSON.stringify(['p_actor', 'p_anchor', 'p_mode', 'p_request', 'p_expected', 'p_reason', 'p_ip'].sort()), 'server RPC argument contract')
  check(rpcCalls[0].args.p_actor === b, 'server actor mapping')
  check(rpcCalls[0].args.p_reason === 'reason', 'server reason trim')
  flags.noClassReturnReadOnly = true; dbError = null
  const beforeRecovery = calls
  response = await route.POST(request(base)); check(response.status === 409, 'recovery blocks commit')
  check(response.body.definitive === true, 'recovery rejection definitive')
  check(calls === beforeRecovery, 'recovery rejection before RPC')
  dbResult = preview; response = await route.POST(request({ mode: 'preview', anchor: a })); check(response.status === 200, 'recovery permits preview')
  dbResult = receipt; response = await route.POST(request({ mode: 'status', anchor: a, requestId })); check(response.status === 200, 'recovery permits original status')
  check(calls === beforeRecovery + 2, 'recovery dispatches only reads')
  assert.equal(results.length, 63, 'Keep contract evidence count explicit')
} catch (error) { failure = error }
const proof = { checkedAt: new Date().toISOString(), runId: run.runId, manifest,
  scope: 'Pure validators, API with mocked RPC, bridge argument mapping and recovery switch; no DB/network calls or writes',
  testDefinition: { file: 'tests/no-class-return/contracts.mjs', sha256: definitionHash },
  sourceHashes, passed: !failure, assertionCount: results.length, results,
  ...(failure ? { error: { message: failure.message, stack: failure.stack } } : {}) }
fs.mkdirSync(run.outputDir, { recursive: true })
const proofPath = path.join(run.outputDir, `contracts-${Date.now()}-${randomUUID()}.json`)
fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ passed: proof.passed, assertions: results.length, proof: proofPath }))
if (failure) { console.error(failure); process.exitCode = 1 }
