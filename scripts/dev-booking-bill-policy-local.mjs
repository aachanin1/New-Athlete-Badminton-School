import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { run, env as local } from '../tests/booking-bill-policy/runtime.mjs'

const app = path.join(run.evidenceRoot, 'app-development')
assert.equal(local.apiUrl, 'http://127.0.0.1:63301')
fs.mkdirSync(app, { recursive: true })
const files = ['src', 'public', 'package.json', 'package-lock.json', 'next.config.mjs', 'tsconfig.json', 'postcss.config.mjs', 'tailwind.config.ts', 'components.json']
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
function inputFiles(file) {
  if (!fs.existsSync(file)) return []
  if (fs.statSync(file).isDirectory()) return fs.readdirSync(file).sort().flatMap(name => inputFiles(path.join(file, name)))
  return [file]
}
for (const file of files) {
  if (fs.existsSync(file)) fs.cpSync(file, path.join(app, file), { recursive: fs.statSync(file).isDirectory() })
}
assert.ok(!fs.existsSync(path.join(app, '.env.local')), 'Task app must not contain inherited environment files')
assert.ok(!fs.existsSync(path.join(app, '.env')), 'Task app must not contain inherited environment files')
if (!fs.existsSync(path.join(app, 'node_modules'))) fs.symlinkSync(path.resolve('node_modules'), path.join(app, 'node_modules'), 'junction')
const sourceIdentity = Object.fromEntries(files.flatMap(inputFiles).map(file => [file.replaceAll('\\', '/'), sha(file)]))
fs.writeFileSync(path.join(app, 'source-manifest.json'), JSON.stringify({ runId: run.runId, copiedAt: new Date().toISOString(), hashes: sourceIdentity }, null, 2))
if (process.argv.includes('--sync')) { console.log('Synced task-owned booking-bill-policy Local app'); process.exit(0) }
await new Promise((resolve, reject) => { const server = net.createServer(); server.once('error', reject); server.listen({ host: '127.0.0.1', port: 63310, exclusive: true }, () => server.close(resolve)) })

// Carry only operating-system variables; no provider credentials or Production
// endpoint values are inherited into this isolated development process.
const environment = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'ComSpec', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'PATHEXT'].filter(name => process.env[name]).map(name => [name, process.env[name]]))
Object.assign(environment, {
  NODE_ENV: 'development', TZ: 'UTC', NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_SUPABASE_URL: local.apiUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.publishableKey,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: local.publishableKey,
  SUPABASE_SERVICE_ROLE_KEY: local.serviceRoleKey,
  SLIPOK_TEST_MODE: 'true', BOOKING_UX_ENABLED: 'true',
  PROGRESSIVE_BOOKING_ENTRY_ENABLED: 'true', PROGRESSIVE_PRICING_WRITES_ENABLED: 'true',
  PROGRESSIVE_COUPON_LIFECYCLE_ENABLED: 'true', PROGRESSIVE_PAYMENT_BATCH_ENABLED: 'true',
  PROGRESSIVE_PAYMENT_ENTRY_ENABLED: 'true', PROGRESSIVE_PAYMENT_REVIEW_ENABLED: 'true',
})
const logPath = path.join(run.evidenceRoot, 'development-' + Date.now() + '.log')
const log = fs.openSync(logPath, 'wx')
const child = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'dev', app, '--webpack', '--hostname', '127.0.0.1', '--port', '63310'], { env: environment, stdio: ['ignore', log, log], windowsHide: true })
fs.writeFileSync(path.join(run.evidenceRoot, 'development-runtime.json'), JSON.stringify({ runId: run.runId, app, pid: child.pid, port: 63310, api: local.apiUrl, logPath, sourceIdentity, startedAt: new Date().toISOString() }, null, 2))
console.log(JSON.stringify({ pid: child.pid, port: 63310, api: local.apiUrl, logPath }))
child.on('exit', code => { process.exitCode = code ?? 1 })

