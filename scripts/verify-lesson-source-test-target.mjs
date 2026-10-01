import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { resolve, relative, isAbsolute } from 'node:path'

// Each approved round has an exact run-bound pair of newly owned disposables.
// A local hostname alone is never evidence of ownership.
export function validateLessonSourceTarget(run, target, containers, marker) {
  assert.equal(run.version, 1, 'Missing approved run manifest')
  const contracts = [
    { id: /^lesson-source-resume-20260930-[a-f0-9-]{36}$/, ports: { LessonSourceResume20260930: '64601', LessonSourceUpgrade20260930: '64701' } },
    { id: /^lesson-source-return-expiry-20261001-[a-f0-9-]{36}$/, ports: { LessonSourceExpiry20261001: '64801', LessonSourceExpiryUpgrade20261001: '64901' } },
    { id: /^lesson-source-makeup-clock-20261001-[a-f0-9-]{36}$/, ports: { LessonSourceMakeup20261001: '65001', LessonSourceMakeupUpgrade20261001: '65101' } },
  ]
  const contract = contracts.find(item => item.id.test(run.runId))
  assert.ok(contract, 'Run outside approved rounds')
  assert.ok(Object.hasOwn(contract.ports, target.project), 'Target outside approved round')
  assert.equal(run.target.project, target.project, 'CLI/API target mismatch')
  assert.equal(resolve(run.target.workdir), resolve(target.workdir), 'CLI workdir mismatch')
  assert.equal(run.target.api, target.api, 'API mismatch')
  const url = new URL(target.api)
  assert.equal(url.protocol, 'http:')
  assert.equal(url.hostname, '127.0.0.1')
  const expected = contract.ports[target.project]
  assert.equal(url.port, expected, 'Unexpected API port')
  assert.equal(String(target.dbPort), String(Number(expected) + 1), 'Unexpected DB port')
  const within = (parent, child) => {
    const rel = relative(resolve(parent), resolve(child))
    return rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel)
  }
  assert.ok(within(run.evidenceRoot, target.workdir), 'Target must belong to this run')
  assert.ok(within(run.evidenceRoot, run.outputDir), 'Output must belong to this run')
  assert.equal(marker.owner, run.owner, 'Disposable ownership mismatch')
  assert.equal(marker.project, target.project)
  const dbName = `supabase_db_${target.project}`
  const network = `supabase_network_${target.project}`
  for (const suffix of ['db', 'auth', 'rest', 'storage', 'kong']) {
    const name = `supabase_${suffix}_${target.project}`
    const item = containers.find(c => c.Name === `/${name}`)
    assert.ok(item?.State.Running, `Missing running ${suffix}`)
    assert.equal(item.Id, run.containerIds[suffix], `Replaced ${suffix} container`)
    assert.equal(item.Config.Labels['com.supabase.cli.project'], target.project)
    assert.equal(resolve(item.Config.Labels['com.supabase.cli.workdir']), resolve(target.workdir))
    assert.ok(item.NetworkSettings.Networks[network], `Wrong ${suffix} network`)
    if (suffix === 'db') {
      assert.ok(item.Mounts.some(m => m.Name === dbName && m.Destination === '/var/lib/postgresql/data'), 'Wrong DB volume')
      assert.ok(item.NetworkSettings.Ports['5432/tcp']?.some(p => p.HostPort === String(target.dbPort)), 'Wrong DB binding')
    }
    if (suffix === 'kong') assert.ok(item.NetworkSettings.Ports['8000/tcp']?.some(p => p.HostPort === expected), 'Wrong API binding')
    const key = { auth: 'GOTRUE_DB_DATABASE_URL', rest: 'PGRST_DB_URI', storage: 'DATABASE_URL' }[suffix]
    if (key) {
      const raw = item.Config.Env.find(v => v.startsWith(`${key}=`))?.slice(key.length + 1)
      assert.ok(raw, `Missing ${suffix} database binding`)
      const db = new URL(raw)
      assert.equal(db.hostname, dbName, `Wrong ${suffix} database`)
      assert.equal(db.port, '5432')
      assert.equal(db.pathname, '/postgres')
    }
  }
  return target
}

export function lessonSourceRun() {
  const file = process.env.LESSON_SOURCE_RUN_MANIFEST
  if (!file || !existsSync(file)) throw new Error('Explicit approved lesson-source run manifest is required before any test write')
  const run = JSON.parse(readFileSync(file, 'utf8'))
  const targetFile = process.env.TASK10_DISPOSABLE_TARGET
  if (!targetFile || resolve(targetFile) !== resolve(run.targetFile)) throw new Error('Explicit bound test target is required')
  return run
}

export function verifyLessonSourceTarget() {
  const run = lessonSourceRun()
  const target = JSON.parse(readFileSync(run.targetFile, 'utf8'))
  const marker = JSON.parse(readFileSync(resolve(target.workdir, '.lesson-source-owned.json'), 'utf8'))
  const names = ['db', 'auth', 'rest', 'storage', 'kong'].map(s => `supabase_${s}_${target.project}`)
  const containers = JSON.parse(execFileSync('docker', ['inspect', ...names], { encoding: 'utf8', windowsHide: true }))
  validateLessonSourceTarget(run, target, containers, marker)
  return run
}

let environmentCache
export function lessonSourceEnvironment() {
  const run = verifyLessonSourceTarget()
  const identity = JSON.stringify(run.containerIds)
  if (environmentCache?.identity === identity) return environmentCache.env
  const output = execFileSync(run.cli, ['status', '-o', 'env', '--workdir', run.target.workdir], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  const values = new Map(output.split(/\r?\n/).map(line => line.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map(m => [m[1], m[2]]))
  assert.equal(values.get('API_URL'), run.target.api, 'CLI selected wrong API')
  const publishableKey = values.get('ANON_KEY') || values.get('PUBLISHABLE_KEY')
  const serviceRoleKey = values.get('SERVICE_ROLE_KEY') || values.get('SECRET_KEY')
  assert.ok(publishableKey && serviceRoleKey, 'Missing isolated credentials')
  const env = { apiUrl: run.target.api, publishableKey, serviceRoleKey }
  environmentCache = { identity, env }
  return env
}

// The CLI deliberately recreates the DB container on an authorized local reset.
// Rebind only that container, after checking every other ID, ownership marker,
// volume, API/service binding and the new container's creation time. Retain both
// manifest versions as immutable evidence; an unexplained replacement still fails.
export function completeLessonSourceReset(before, startedAt) {
  const names = ['db', 'auth', 'rest', 'storage', 'kong'].map(s => `supabase_${s}_${before.target.project}`)
  const containers = JSON.parse(execFileSync('docker', ['inspect', ...names], { encoding: 'utf8', windowsHide: true }))
  const db = containers.find(c => c.Name === names[0].replace(/^/, '/'))
  assert.ok(new Date(db.Created).getTime() >= startedAt, 'Replacement DB predates authorized reset')
  const next = { ...before, containerIds: { ...before.containerIds, db: db.Id } }
  const marker = JSON.parse(readFileSync(resolve(before.target.workdir, '.lesson-source-owned.json'), 'utf8'))
  validateLessonSourceTarget(next, next.target, containers, marker)
  const id = randomUUID()
  writeFileSync(resolve(before.outputDir, `reset-${id}.json`), JSON.stringify({ startedAt, completedAt: new Date().toISOString(), before, after: next }, null, 2), { flag: 'wx' })
  writeFileSync(process.env.LESSON_SOURCE_RUN_MANIFEST, JSON.stringify(next, null, 2))
  return next
}

export async function lessonSourceFetch(input, init) {
  const run = verifyLessonSourceTarget()
  const url = new URL(typeof input === 'string' || input instanceof URL ? input.toString() : input.url)
  assert.equal(url.origin, run.target.api, 'Refusing request outside disposable API')
  return fetch(input, init)
}
