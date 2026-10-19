import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { randomUUID, createHash } from 'node:crypto'

const base = path.resolve('.playwright/admin-makeup-review'), workdir = path.join(base, 'runtime'), project = 'AdminMakeupReview20261019'
const cli = JSON.parse(fs.readFileSync('.playwright/branch-closure-1/run.json', 'utf8')).cli
const resume = process.argv.includes('--resume-setup')
if (fs.existsSync(base) && !resume) throw Error('Fresh task evidence directory required')
if (execFileSync('docker', ['ps', '-a', '--format', '{{.Names}}'], { encoding: 'utf8', windowsHide: true }).includes(project)) throw Error('Disposable already exists')
const runId = resume ? JSON.parse(fs.readFileSync(path.join(workdir, '.lesson-source-owned.json'), 'utf8')).owner : 'admin-makeup-review-20261019-' + randomUUID()
if (!/^admin-makeup-review-20261019-[a-f0-9-]{36}$/.test(runId)) throw Error('Wrong setup ownership')
if (!resume) {
fs.mkdirSync(path.join(workdir, 'supabase/migrations'), { recursive: true })
const config = fs.readFileSync('.playwright/admin-makeup-browse-v7/runtime/supabase/config.toml', 'utf8').replaceAll('AdminMakeupBrowse20261019', project).replaceAll('620', '621')
fs.writeFileSync(path.join(workdir, 'supabase/config.toml'), config)
for (const name of fs.readdirSync('supabase/migrations')) if (fs.statSync(path.join('supabase/migrations', name)).size) fs.copyFileSync(path.join('supabase/migrations', name), path.join(workdir, 'supabase/migrations', name))
const target = { project, workdir, api: 'http://127.0.0.1:62101', dbPort: 62102 }
fs.writeFileSync(path.join(base, 'target.json'), JSON.stringify(target, null, 2))
fs.writeFileSync(path.join(workdir, '.lesson-source-owned.json'), JSON.stringify({ owner: runId, project }))
const dirty = ['AGENTS.md', 'PROJECT_STATE.md', 'TODO-CODEX.md', 'BUSINESS_RULES.md', 'context-archive/BUSINESS_RULES.source-2026-10-02.md']
fs.writeFileSync(path.join(base, 'pre-existing-dirty-hashes.json'), JSON.stringify(Object.fromEntries(dirty.map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])), null, 2))
}
const target = JSON.parse(fs.readFileSync(path.join(base, 'target.json'), 'utf8'))
// An explicitly inspected free /24 avoids the exhausted Docker default pools.
execFileSync('docker', ['network', 'create', '--subnet', '10.221.19.0/24', 'supabase_network_' + project], { stdio: 'pipe', windowsHide: true })
const log = fs.openSync(path.join(base, 'start.log'), 'wx')
const child = spawn(cli, ['start', '--workdir', workdir, '--network-id', 'supabase_network_' + project, '--exclude', 'realtime,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor'], { stdio: ['ignore', log, log], windowsHide: true })
child.on('exit', code => {
  if (code) { console.error('Owned Local start failed; see .playwright/admin-makeup-review/start.log'); process.exitCode = code; return }
  const containers = JSON.parse(execFileSync('docker', ['inspect', ...['db', 'auth', 'rest', 'storage', 'kong'].map(s => 'supabase_' + s + '_' + project)], { encoding: 'utf8', windowsHide: true }))
  fs.mkdirSync(path.join(base, 'acceptance'), { recursive: true })
  fs.writeFileSync(path.join(base, 'run.json'), JSON.stringify({ version: 1, runId, owner: runId, evidenceRoot: base, outputDir: path.join(base, 'acceptance'), targetFile: path.join(base, 'target.json'), target, cli, containerIds: Object.fromEntries(containers.map(c => [c.Name.split('_')[1], c.Id])) }, null, 2))
  console.log(JSON.stringify({ created: true, project, api: target.api, dbPort: target.dbPort }))
})
