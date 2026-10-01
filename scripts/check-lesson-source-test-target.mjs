import assert from 'node:assert/strict'
import { validateLessonSourceTarget, lessonSourceRun } from './verify-lesson-source-test-target.mjs'

const target = { project: 'LessonSourceResume20260930', workdir: 'C:/isolated/fresh', api: 'http://127.0.0.1:64601', dbPort: '64602' }
const run = { version: 1, runId: 'lesson-source-resume-20260930-11111111-1111-4111-8111-111111111111', evidenceRoot: 'C:/isolated', outputDir: 'C:/isolated/output', owner: 'owned', target, containerIds: {} }
const containers = ['db', 'auth', 'rest', 'storage', 'kong'].map(suffix => {
  run.containerIds[suffix] = `id-${suffix}`
  return { Id: `id-${suffix}`, Name: `/supabase_${suffix}_${target.project}`, State: { Running: true }, Config: {
    Labels: { 'com.supabase.cli.project': target.project, 'com.supabase.cli.workdir': target.workdir },
    Env: Object.values({ auth: 'GOTRUE_DB_DATABASE_URL', rest: 'PGRST_DB_URI', storage: 'DATABASE_URL' }).map(key => `${key}=postgres://user:local@supabase_db_${target.project}:5432/postgres`),
  }, Mounts: [{ Name: `supabase_db_${target.project}`, Destination: '/var/lib/postgresql/data' }], NetworkSettings: {
    Networks: { [`supabase_network_${target.project}`]: {} }, Ports: { '5432/tcp': [{ HostPort: '64602' }], '8000/tcp': [{ HostPort: '64601' }] },
  } }
})
const marker = { project: target.project, owner: 'owned' }
assert.equal(validateLessonSourceTarget(run, target, containers, marker), target)
let rejected = 0
const reject = mutate => {
  const data = structuredClone({ run, target, containers, marker })
  mutate(data)
  assert.throws(() => validateLessonSourceTarget(data.run, data.target, data.containers, data.marker))
  rejected++
}
reject(d => { d.target.project = 'New-Athlete-Badminton-School' })
reject(d => { d.target.api = 'https://example.supabase.co' })
reject(d => { d.target.api = 'http://127.0.0.1:54321' })
reject(d => { d.target.workdir = 'C:/other' })
reject(d => { d.run.outputDir = 'C:/old-evidence' })
reject(d => { d.marker.owner = 'other-owner' })
reject(d => { d.containers[0].Id = 'replaced' })
reject(d => { d.containers[0].Mounts[0].Name = 'old-volume' })
reject(d => { d.containers[1].Config.Env = ['GOTRUE_DB_DATABASE_URL=postgres://user:local@other:5432/postgres'] })
reject(d => { d.containers[2].NetworkSettings.Networks = {} })
reject(d => { d.containers[3].Config.Labels['com.supabase.cli.workdir'] = 'C:/old-target' })
reject(d => { d.containers[4].NetworkSettings.Ports['8000/tcp'][0].HostPort = '54321' })
const previous = process.env.LESSON_SOURCE_RUN_MANIFEST
delete process.env.LESSON_SOURCE_RUN_MANIFEST
assert.throws(() => lessonSourceRun(), /manifest is required/)
if (previous) process.env.LESSON_SOURCE_RUN_MANIFEST = previous
let addedValid = 0
for (const [project, port] of [['LessonSourceExpiry20261001', '64801'], ['LessonSourceExpiryUpgrade20261001', '64901']]) {
  const data = structuredClone({ run, target, containers, marker })
  const oldProject = data.target.project
  data.target.project = project
  data.target.api = `http://127.0.0.1:${port}`
  data.target.dbPort = String(Number(port) + 1)
  data.run.target = data.target
  data.run.runId = 'lesson-source-return-expiry-20261001-11111111-1111-4111-8111-111111111111'
  data.marker.project = project
  for (const c of data.containers) {
    c.Name = c.Name.replace(oldProject, project)
    c.Config.Labels['com.supabase.cli.project'] = project
    c.Config.Env = c.Config.Env.map(value => value.replaceAll(oldProject, project))
    c.Mounts[0].Name = `supabase_db_${project}`
    c.NetworkSettings.Networks = { [`supabase_network_${project}`]: {} }
    c.NetworkSettings.Ports['5432/tcp'][0].HostPort = data.target.dbPort
    c.NetworkSettings.Ports['8000/tcp'][0].HostPort = port
  }
  assert.equal(validateLessonSourceTarget(data.run, data.target, data.containers, data.marker), data.target)
  addedValid++
  for (const mutate of [
    d => { d.run.runId = run.runId },
    d => { d.run.runId = 'lesson-source-return-expiry-20261002-11111111-1111-4111-8111-111111111111' },
    d => { d.containers[0].Mounts[0].Name = `supabase_db_${target.project}` },
  ]) {
    const bad = structuredClone(data)
    mutate(bad)
    assert.throws(() => validateLessonSourceTarget(bad.run, bad.target, bad.containers, bad.marker))
    rejected++
  }
}
reject(d => { d.run.runId = 'lesson-source-return-expiry-20261001-11111111-1111-4111-8111-111111111111' })
console.log(`Target guard PASS: ${1 + addedValid} valid ownership cases + ${rejected + 1} rejection cases; no network or database writes`)
