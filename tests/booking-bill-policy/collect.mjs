import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { run, sql } from './runtime.mjs'

const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const runtime = JSON.parse(fs.readFileSync(path.join(run.evidenceRoot, 'app-runtime.json'), 'utf8'))
assert.equal(runtime.runId, run.runId)
assert.equal(runtime.port, 63311)
assert.ok(runtime.app.endsWith('app-candidate4'))
const manifest = JSON.parse(fs.readFileSync(path.join(runtime.app, 'source-manifest.json'), 'utf8'))
const binding = JSON.parse(fs.readFileSync(path.join(runtime.app, '.next/booking-bill-policy-local-build.json'), 'utf8'))
assert.equal(binding.runId, run.runId)
assert.equal(binding.api, run.target.api)
assert.equal(binding.buildId, fs.readFileSync(path.join(runtime.app, '.next/BUILD_ID'), 'utf8').trim())
const productInput = file => file.startsWith('src/') || file.startsWith('public/') || file.startsWith('supabase/migrations/') || ['package.json','package-lock.json','next.config.mjs','tsconfig.json','postcss.config.mjs','tailwind.config.ts','components.json'].includes(file)
const inputs = Object.entries(manifest.hashes).filter(([file]) => productInput(file))
for (const [file, expected] of inputs) {
  assert.equal(hash(file), expected, 'Root changed after frozen build: ' + file)
  assert.equal(hash(path.join(runtime.app, file)), expected, 'Frozen copy differs: ' + file)
}
const schema = JSON.parse(sql("SELECT jsonb_object_agg(proname,md5(pg_get_functiondef(oid))) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('booking_ux_create_v1','booking_ux_update_v1','booking_ux_edit_set_v1','progressive_reprice_scope_v1','booking_bill_package_quote_v2','task10_booking_policy_quote_v1','booking_ux_expiry_v1','task10_previous_wallet_store_v2','admin_wallet_store_body_v1')"))
const suites = []
for (const [name, count] of [['db',17],['clock',4],['http',15],['protected',21],['browser',11],['readers',10],['owner-readiness',3],['notifications',2]]) {
  const files = fs.readdirSync(run.outputDir).filter(file => file.startsWith(name + '-pass-') && file.endsWith('.json')).sort()
  assert.ok(files.length, 'No passing evidence: ' + name)
  const file = path.join(run.outputDir, files.at(-1)), record = JSON.parse(fs.readFileSync(file, 'utf8'))
  assert.equal(record.runId, run.runId)
  assert.equal(record.target.project, run.target.project)
  assert.equal(record.target.api, run.target.api)
  assert.equal(record.checks.length, count)
  assert.deepEqual(record.schema, schema, 'Database definitions changed after ' + name)
  for (const [definition, expected] of Object.entries(record.definitionFiles)) assert.equal(hash(definition), expected, 'Evidence definition changed: ' + definition)
  for (const required of ['runtime.mjs','helpers.mjs',...(name === 'owner-readiness' ? [] : [name + '.mjs'])]) assert.ok(record.definitionFiles['tests/booking-bill-policy/' + required], 'Missing test binding ' + required)
  suites.push({ name, checks: count, observedAt: record.at, file, sha256: hash(file) })
}
const state = JSON.parse(sql("SELECT jsonb_build_object('baselineMigrations',(SELECT count(*) FROM supabase_migrations.schema_migrations),'control',(SELECT to_jsonb(c) FROM booking_bill_policy_control c),'packageCatalog',booking_ux_catalog_v1(),'functionCount',(SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f'))"))
assert.equal(state.control.enabled, true)
assert.equal(state.packageCatalog.find(p => p.id === 'adult-1').price, 600)
assert.equal(state.packageCatalog.find(p => p.id === 'adult-10').price, 5500)
assert.equal(state.packageCatalog.find(p => p.id === 'adult-16').price, 8000)
assert.equal(state.packageCatalog.find(p => p.id === 'private-1').price, 900)
assert.equal(state.packageCatalog.find(p => p.id === 'private-10').price, 8000)
const report = { task: 'BOOKING-BILL-POLICY-1', status: 'READY_FOR_OWNER_LOCAL_UAT', ownerUat: 'pending', productionRelease: 'not authorized or performed', runId: run.runId, target: run.target, app: runtime, binding, observedAt: new Date().toISOString(), productInputCount: inputs.length, productInputHashes: Object.fromEntries(inputs), suites, assertionCount: suites.reduce((n,s) => n+s.checks,0), state, schema, collector: { file: 'tests/booking-bill-policy/collect.mjs', sha256: hash('tests/booking-bill-policy/collect.mjs') } }
const file = path.join(run.outputDir, 'local-handoff-' + Date.now() + '.json')
fs.writeFileSync(file, JSON.stringify(report, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ ready: true, ownerUat: 'pending', assertions: report.assertionCount, productInputs: report.productInputCount, evidence: file }))
