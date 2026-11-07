import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import { execFileSync, spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { validateLessonSourceTarget } from './verify-lesson-source-test-target.mjs'

// New task-owned Local baseline only. Preserve the accepted97-migration source
// before applying this task's candidate migration through the guarded test runner.
const fresh = true
const resume = process.argv.includes('--resume-setup')
const root = process.cwd()
const base = path.resolve('.playwright/booking-makeup-scope-1')
const workdir = path.join(base, 'runtime')
const project = 'BookingMakeupScope20261107'
const portPrefix = '630'
const subnet = '10.222.27.0/24'
const network = 'supabase_network_' + project
const docker = 'C:/Program Files/Docker/Docker/resources/bin/docker.exe'
const cli = JSON.parse(fs.readFileSync('.playwright/branch-closure-1/run.json', 'utf8')).cli
assert.ok(fs.existsSync(cli), 'Existing Supabase CLI is required')
assert.ok(fs.existsSync(docker), 'Existing Docker CLI is required')
assert.ok(base.startsWith(path.join(root, '.playwright') + path.sep), 'Evidence root must remain in the workspace')
const sha = buffer => createHash('sha256').update(buffer).digest('hex')
const inspect = (...args) => execFileSync(docker, args, { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
inspect('info', '--format', '{{.ServerVersion}}')

let baseline, owner
if (fs.existsSync(base)) {
  assert.ok(resume, 'Existing evidence directory: inspect ownership and use --resume-setup deliberately')
  baseline = JSON.parse(fs.readFileSync(path.join(base, 'baseline-migrations.json'), 'utf8'))
  const marker = JSON.parse(fs.readFileSync(path.join(workdir, '.lesson-source-owned.json'), 'utf8'))
  owner = marker.owner
  assert.equal(marker.project, project)
  assert.equal(baseline.owner, owner)
  assert.match(owner, /^booking-makeup-scope-1-20261107-[a-f0-9-]{36}$/)
  assert.ok(!fs.existsSync(path.join(base, 'run.json')), 'Completed runtime must not be set up again')
  const actual = fs.readdirSync(path.join(workdir, 'supabase/migrations')).sort()
  assert.deepEqual(actual, baseline.files.map(f => f.name).sort(), 'Frozen migration list changed')
  for (const file of baseline.files) assert.equal(sha(fs.readFileSync(path.join(workdir, 'supabase/migrations', file.name))), file.sha256, 'Frozen migration changed: ' + file.name)
} else {
  owner = 'booking-makeup-scope-1-20261107-' + randomUUID()
  const names = fs.readdirSync('supabase/migrations').filter(name => /^\d{14}_.*\.sql$/.test(name)
    && name.slice(0, 14) <= '20261104044000'
    && fs.statSync(path.join('supabase/migrations', name)).size > 0).sort()
  assert.equal(names.length, 97, 'Baseline must have exactly97 migrations')
  fs.mkdirSync(path.join(workdir, 'supabase/migrations'), { recursive: true })
  const files = names.map(name => {
    const bytes = fs.readFileSync(path.join('supabase/migrations', name))
    fs.writeFileSync(path.join(workdir, 'supabase/migrations', name), bytes, { flag: 'wx' })
    return { name, sha256: sha(bytes), bytes: bytes.length }
  })
  baseline = { owner, source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim(),
    through: fresh ? files.at(-1).name.slice(0, 14) : '20261103143434', frozenAt: new Date().toISOString(), files }
  fs.writeFileSync(path.join(base, 'baseline-migrations.json'), JSON.stringify(baseline, null, 2), { flag: 'wx' })
  fs.writeFileSync(path.join(workdir, '.lesson-source-owned.json'), JSON.stringify({ owner, project }, null, 2), { flag: 'wx' })
}

const target = { project, workdir, api: 'http://127.0.0.1:' + portPrefix + '01', dbPort: Number(portPrefix + '02') }
const names = ['db', 'auth', 'rest', 'storage', 'kong'].map(service => `supabase_${service}_${project}`)
const allNames = inspect('ps', '-a', '--format', '{{.Names}}').split(/\r?\n/).filter(Boolean)
const existingNames = allNames.filter(name => name.endsWith('_' + project))
if (existingNames.length) {
  assert.ok(resume, 'New runtime name already exists')
  const existing = JSON.parse(inspect('inspect', ...existingNames))
  for (const container of existing) {
    assert.equal(container.Config.Labels['com.supabase.cli.project'], project)
    assert.equal(path.resolve(container.Config.Labels['com.supabase.cli.workdir']), workdir)
  }
} else {
  for (let suffix = 0; suffix <= 9; suffix++) {
    const port = Number(portPrefix + String(suffix).padStart(2, '0'))
    await new Promise((resolve, reject) => {
      const server = net.createServer()
      server.once('error', error => reject(Error('Required new runtime port is not free: ' + port + ': ' + error.message)))
      server.listen({ port, host: '127.0.0.1', exclusive: true }, () => server.close(resolve))
    })
  }
}

const template = fs.readFileSync('.playwright/admin-makeup-2/runtime/supabase/config.toml', 'utf8')
const config = template.replace(/^project_id\s*=.*$/m, 'project_id = "' + project + '"').replaceAll('625', portPrefix)
assert.match(config, /\[db.seed\][\s\S]*?enabled = false/, 'Seed data must remain disabled')
const configPath = path.join(workdir, 'supabase/config.toml')
if (fs.existsSync(configPath)) assert.equal(fs.readFileSync(configPath, 'utf8'), config, 'Existing runtime config changed')
else fs.writeFileSync(configPath, config, { flag: 'wx' })
const targetPath = path.join(base, 'target.json')
if (fs.existsSync(targetPath)) assert.deepEqual(JSON.parse(fs.readFileSync(targetPath, 'utf8')), target)
else fs.writeFileSync(targetPath, JSON.stringify(target, null, 2), { flag: 'wx' })

const networkIds = inspect('network', 'ls', '-q').split(/\r?\n/).filter(Boolean)
const networks = networkIds.length ? JSON.parse(inspect('network', 'inspect', ...networkIds)) : []
const ours = networks.find(item => item.Name === network)
assert.ok(!networks.some(item => item.Name !== network && (item.IPAM.Config || []).some(c => c.Subnet === subnet)), 'Required subnet already belongs to another runtime')
if (ours) assert.ok(ours.IPAM.Config.some(c => c.Subnet === subnet), 'Existing network subnet mismatch')
else inspect('network', 'create', '--subnet', subnet, network)

const logPath = path.join(base, 'start-' + new Date().toISOString().replaceAll(/[:.]/g, '-') + '-' + randomUUID() + '.log')
const log = fs.openSync(logPath, 'wx')
const child = spawn(cli, ['start', '--workdir', workdir, '--network-id', network,
  '--exclude', 'realtime,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor'],
{ stdio: ['ignore', log, log], windowsHide: true })
const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve) })
fs.closeSync(log)
if (code !== 0) throw Error('Owned Local setup failed (' + code + '); preserved log: ' + logPath)

const containers = JSON.parse(inspect('inspect', ...names))
const run = { version: 1, runId: owner, owner, evidenceRoot: base, outputDir: path.join(base, 'acceptance'), targetFile: targetPath,
  target, cli, containerIds: Object.fromEntries(containers.map(c => [c.Name.split('_')[1], c.Id])) }
const marker = JSON.parse(fs.readFileSync(path.join(workdir, '.lesson-source-owned.json'), 'utf8'))
validateLessonSourceTarget(run, target, containers, marker)
fs.mkdirSync(run.outputDir, { recursive: true })
fs.writeFileSync(path.join(base, 'run.json'), JSON.stringify(run, null, 2), { flag: 'wx' })
const proof = { checkedAt: new Date().toISOString(), owner, project, configSha256: sha(Buffer.from(config)),
  copiedMigrationCount: baseline.files.length, migrationManifest: path.join(base, 'baseline-migrations.json'),
  api: target.api, dbPort: target.dbPort, network, subnet,
  containers: containers.map(container => {
    const service = container.Name.split('_')[1]
    const key = { auth: 'GOTRUE_DB_DATABASE_URL', rest: 'PGRST_DB_URI', storage: 'DATABASE_URL' }[service]
    const raw = key && container.Config.Env.find(v => v.startsWith(key + '='))?.slice(key.length + 1)
    const db = raw && new URL(raw)
    return { service, id: container.Id, running: container.State.Running, projectLabel: container.Config.Labels['com.supabase.cli.project'],
      workdirLabel: container.Config.Labels['com.supabase.cli.workdir'], networkId: container.NetworkSettings.Networks[network].NetworkID,
      dbBinding: db ? { host: db.hostname, port: db.port, database: db.pathname } : null,
      volumes: container.Mounts.filter(m => m.Type === 'volume').map(m => ({ name: m.Name, destination: m.Destination })),
      ports: container.NetworkSettings.Ports }
  }) }
const proofPath = path.join(base, 'isolation-proof.json')
fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ created: true, project, owner, api: target.api, dbPort: target.dbPort, migrations: baseline.files.length,
  runManifest: path.join(base, 'run.json'), targetFile: targetPath, proof: proofPath }))
