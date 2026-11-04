import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { verifyLessonSourceTarget, lessonSourceEnvironment } from './verify-lesson-source-test-target.mjs'

// Frozen Local app only. This script never edits the canonical checkout, applies
// a migration, creates fixtures, resets a runtime, or stops an existing server.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
assert.equal(process.cwd(), root, 'Run from the canonical application checkout')
const [label = 'candidate1', mode = 'build', portArgument = '62810', ...extra] = process.argv.slice(2)
assert.match(label, /^[a-z0-9][a-z0-9-]{0,63}$/, 'Use a new task-owned artifact label')
assert.ok(['build', 'serve'].includes(mode) && extra.length === 0, 'Usage: node scripts/build-no-class-return-local.mjs LABEL build|serve 62810')
assert.equal(portArgument, '62810', 'Only task-owned application port62810 is allowed')
const port = Number(portArgument), distDir = '.next-no-class-return-1'
const taskRoot = path.join(root, '.playwright/no-class-return-1')
process.env.LESSON_SOURCE_RUN_MANIFEST ||= path.join(taskRoot, 'run.json')
process.env.TASK10_DISPOSABLE_TARGET ||= path.join(path.dirname(process.env.LESSON_SOURCE_RUN_MANIFEST), 'target.json')
const manifest = path.resolve(process.env.LESSON_SOURCE_RUN_MANIFEST)
assert.ok([path.join(taskRoot, 'run.json'), path.join(taskRoot, 'fresh/run.json')].includes(manifest), 'Only this task runtime is allowed')

function verifiedRuntime() {
  // Physically inspects DB/Auth/REST/Storage/Kong container IDs, ownership labels,
  // network, DB volume and every service's database URL before obtaining keys.
  const run = verifyLessonSourceTarget()
  assert.match(run.runId, /^no-class-return-1-20261104-[a-f0-9-]{36}$/)
  assert.ok(['NoClassReturn20261104', 'NoClassReturnFresh20261104'].includes(run.target.project))
  assert.equal(path.resolve(run.evidenceRoot), path.dirname(manifest))
  assert.equal(path.resolve(run.outputDir), path.join(path.dirname(manifest), 'acceptance'))
  const local = lessonSourceEnvironment()
  assert.equal(local.apiUrl, run.target.api)
  assert.ok(['http://127.0.0.1:62801', 'http://127.0.0.1:62901'].includes(local.apiUrl))
  return { run, local }
}
const { run, local } = verifiedRuntime()
const app = path.join(run.evidenceRoot, 'app-' + label)
assert.equal(path.dirname(app), path.resolve(run.evidenceRoot), 'Artifact must remain in task evidence')
const deploymentId = 'no-class-return-local-' + label
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const hashFiles = files => Object.fromEntries(files.map(file => [file, sha(fs.readFileSync(path.join(app, file)))]))
const hashObject = value => sha(JSON.stringify(value))
const bindingFile = path.join(app, distDir, 'no-class-return-local-build.json')
const sourceManifestFile = path.join(app, 'source-manifest.json')
const helperHash = sha(fs.readFileSync(path.join(root, 'scripts/verify-lesson-source-test-target.mjs')))

// Inherit only OS/tool lookup settings. Never inherit unrelated service keys,
// provider URLs, NODE_OPTIONS preload hooks or a hosted deployment environment.
const osKeys = new Set(['path', 'systemroot', 'windir', 'comspec', 'pathext', 'temp', 'tmp', 'appdata', 'localappdata',
  'userprofile', 'homedrive', 'homepath', 'number_of_processors', 'processor_architecture', 'programfiles', 'programfiles(x86)', 'programdata'])
const platformEnvironment = Object.fromEntries(Object.entries(process.env).filter(([key]) => osKeys.has(key.toLowerCase())))
const environment = { ...platformEnvironment, NODE_ENV: 'production', TZ: 'UTC', NEXT_TELEMETRY_DISABLED: '1',
  NEXT_DEPLOYMENT_ID: deploymentId, NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:62810',
  NEXT_PUBLIC_SUPABASE_URL: local.apiUrl, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.publishableKey,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: local.publishableKey, SUPABASE_SERVICE_ROLE_KEY: local.serviceRoleKey,
  BOOKING_UX_ENABLED: 'true', SLIPOK_TEST_MODE: 'true', PROGRESSIVE_BOOKING_ENTRY_ENABLED: 'true',
  PROGRESSIVE_PRICING_WRITES_ENABLED: 'true', PROGRESSIVE_COUPON_LIFECYCLE_ENABLED: 'true',
  PROGRESSIVE_PAYMENT_BATCH_ENABLED: 'true', PROGRESSIVE_PAYMENT_ENTRY_ENABLED: 'true', PROGRESSIVE_PAYMENT_REVIEW_ENABLED: 'true' }

let sourceManifest, binding
if (mode === 'build') {
  assert.ok(!fs.existsSync(app), 'Existing artifact is immutable; use a new label')
  const listed = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8', windowsHide: true })
  const rootInput = /^(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|tsconfig\.json|next\.config\.[cm]?[jt]s|postcss\.config\.[cm]?[jt]s|tailwind\.config\.[cm]?[jt]s|components\.json)$/
  const files = [...new Set(listed.split('\0'))].filter(file => file && !file.split('/').some(part => part === '..' || part === '.env' || part.startsWith('.env.'))
    && (file.startsWith('src/') || file.startsWith('public/') || rootInput.test(file))
    && fs.existsSync(path.join(root, file)) && fs.statSync(path.join(root, file)).isFile()).sort()
  for (const required of ['package.json', 'package-lock.json', 'tsconfig.json', 'next.config.mjs', 'src/app/layout.tsx']) assert.ok(files.includes(required), 'Missing build input: ' + required)
  fs.mkdirSync(app, { recursive: true })
  const sourceHashes = {}
  for (const file of files) {
    const destination = path.join(app, file), bytes = fs.readFileSync(path.join(root, file))
    fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, bytes, { flag: 'wx' }); sourceHashes[file] = sha(bytes)
  }
  const configFile = path.join(app, 'next.config.mjs'), originalConfig = fs.readFileSync(configFile, 'utf8')
  assert.equal((originalConfig.match(/export default nextConfig\s*;/g) || []).length, 1, 'Review changed config before applying harness overlay')
  const frozenConfig = originalConfig.replace(/export default nextConfig\s*;/,
    `export default { ...nextConfig, distDir: ${JSON.stringify(distDir)}, deploymentId: ${JSON.stringify(deploymentId)} };`)
  fs.writeFileSync(configFile, frozenConfig)
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(app, 'node_modules'), 'junction')
  sourceManifest = { runId: run.runId, api: local.apiUrl, project: run.target.project,
    sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim(),
    capturedAt: new Date().toISOString(), sourceHashes, artifactInputHashes: hashFiles(files),
    overlays: [{ file: 'next.config.mjs', purpose: 'Local-only distDir and deployment identity',
      beforeSha256: sha(originalConfig), afterSha256: sha(frozenConfig) }] }
  fs.writeFileSync(sourceManifestFile, JSON.stringify(sourceManifest, null, 2), { flag: 'wx' })
} else {
  binding = JSON.parse(fs.readFileSync(bindingFile, 'utf8'))
  sourceManifest = JSON.parse(fs.readFileSync(sourceManifestFile, 'utf8'))
  assert.equal(binding.runId, run.runId, 'Build belongs to another task run')
  assert.equal(binding.api, local.apiUrl, 'Build/database API mismatch')
  assert.equal(binding.project, run.target.project)
  assert.equal(binding.distDir, distDir)
  assert.equal(binding.deploymentId, deploymentId)
  assert.equal(binding.helperSha256, helperHash, 'Isolation helper changed; review the frozen build binding')
  assert.deepEqual(binding.containerIds, run.containerIds, 'Build services were replaced')
  assert.equal(binding.buildId, fs.readFileSync(path.join(app, distDir, 'BUILD_ID'), 'utf8').trim())
  assert.deepEqual(hashFiles(Object.keys(binding.postBuildInputHashes)), binding.postBuildInputHashes, 'Frozen application inputs changed')
  assert.equal(binding.sourceManifestSha256, sha(fs.readFileSync(sourceManifestFile)))
  await new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.once('error', error => reject(Error('Application port62810 is occupied: ' + error.message)))
    probe.listen({ host: '127.0.0.1', port, exclusive: true }, () => probe.close(resolve))
  })
}
// Recheck identity immediately before the child can make service requests.
const immediatelyVerified = verifiedRuntime().run
assert.deepEqual(immediatelyVerified.containerIds, run.containerIds)
fs.mkdirSync(run.outputDir, { recursive: true })
const executionId = `${mode}-${label}-${Date.now()}-${randomUUID()}`
const logPath = path.join(run.outputDir, executionId + '.log'), log = fs.openSync(logPath, 'wx')
const args = [path.join(root, 'node_modules/next/dist/bin/next'), mode === 'build' ? 'build' : 'start', app,
  ...(mode === 'build' ? ['--webpack'] : ['--hostname', '127.0.0.1', '--port', String(port)])]
const child = spawn(process.execPath, args, { cwd: app, env: environment, stdio: ['ignore', log, log], windowsHide: true })
const executionProof = { startedAt: new Date().toISOString(), runId: run.runId, mode, label, app, distDir, deploymentId,
  pid: child.pid, port, api: local.apiUrl, project: run.target.project, containerIds: run.containerIds, helperSha256: helperHash,
  runnerSha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))), logPath,
  environment: { source: 'verified task runtime helpers', inheritedKeys: Object.keys(platformEnvironment),
    credentialValuesRecorded: false, testMode: true }, schemaAcceptance: 'Verified separately by task integration tests' }
const proofPath = path.join(run.outputDir, executionId + '.json')
fs.writeFileSync(proofPath, JSON.stringify(executionProof, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ mode, label, pid: child.pid, app, port, logPath, proof: proofPath }))
let code
try { code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve) }) }
catch (error) { console.error(error.message); code = 1 }
finally { fs.closeSync(log) }
if (code === 0 && mode === 'build') {
  const postBuildInputHashes = hashFiles(Object.keys(sourceManifest.artifactInputHashes))
  binding = { runId: run.runId, api: local.apiUrl, project: run.target.project, containerIds: run.containerIds,
    distDir, deploymentId, buildId: fs.readFileSync(path.join(app, distDir, 'BUILD_ID'), 'utf8').trim(),
    inputsHash: hashObject(postBuildInputHashes), postBuildInputHashes, sourceManifestSha256: sha(fs.readFileSync(sourceManifestFile)),
    helperSha256: helperHash, runnerSha256: executionProof.runnerSha256,
    generatedInputChanges: Object.keys(postBuildInputHashes).filter(file => postBuildInputHashes[file] !== sourceManifest.artifactInputHashes[file]) }
  fs.writeFileSync(bindingFile, JSON.stringify(binding, null, 2), { flag: 'wx' })
  console.log(JSON.stringify({ built: true, runId: run.runId, buildId: binding.buildId, inputsHash: binding.inputsHash, bindingFile }))
}
const completionPath = path.join(run.outputDir, executionId + '-completed.json')
fs.writeFileSync(completionPath, JSON.stringify({ ...executionProof, completedAt: new Date().toISOString(), code,
  ...(mode === 'build' && code === 0 ? { buildId: binding.buildId, inputsHash: binding.inputsHash } : {}) }, null, 2), { flag: 'wx' })
if (code !== 0) console.error('Local ' + mode + ' failed; evidence preserved: ' + logPath)
process.exitCode = code ?? 1
