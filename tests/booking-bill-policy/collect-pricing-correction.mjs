import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { run, sql } from './runtime.mjs'
import { hashFile } from './helpers.mjs'

const json = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const runtime = json(path.join(run.evidenceRoot, 'app-runtime.json'))
assert.equal(runtime.runId, run.runId)
assert.equal(runtime.port, 63311)
assert.equal(runtime.app, path.join(run.evidenceRoot, 'app-candidate6'))
const manifestPath = path.join(runtime.app, 'source-manifest.json'), manifest = json(manifestPath)
const binding = json(path.join(runtime.app, '.next/booking-bill-policy-local-build.json'))
assert.equal(binding.runId, run.runId)
assert.equal(binding.api, run.target.api)
assert.equal(binding.deploymentId, 'booking-bill-policy-local-candidate6')
assert.equal(binding.buildId, fs.readFileSync(path.join(runtime.app, '.next/BUILD_ID'), 'utf8').trim())
const commandLine = execFileSync('powershell.exe', ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter "ProcessId=${runtime.pid}").CommandLine`], { encoding: 'utf8', windowsHide: true })
assert.ok(commandLine.includes(runtime.app) && commandLine.includes('start') && commandLine.includes('63311'), 'Actual process must serve this frozen app')
const productInput = file => file.startsWith('src/') || file.startsWith('public/') || file.startsWith('supabase/migrations/') || ['package.json','package-lock.json','next.config.mjs','tsconfig.json','postcss.config.mjs','tailwind.config.ts','components.json'].includes(file)
const inputs = Object.entries(manifest.hashes).filter(([file]) => productInput(file))
const inventory = [...new Set(['ls-files', 'untracked'].flatMap(mode => execFileSync('git', mode === 'ls-files' ? ['ls-files', '-z'] : ['ls-files', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0')))].filter(file => file && productInput(file) && fs.existsSync(file)).sort()
assert.deepEqual(inputs.map(([file]) => file).sort(), inventory)
for (const [file, expected] of inputs) {
  assert.equal(hashFile(file), expected, 'Root changed since build: ' + file)
  assert.equal(hashFile(path.join(runtime.app, file)), expected, 'Frozen file changed: ' + file)
}
const previous = json(path.join(run.evidenceRoot, 'app-candidate4/source-manifest.json'))
const changed = [...new Set([...Object.keys(previous.hashes), ...Object.keys(manifest.hashes)])].filter(file => productInput(file) && previous.hashes[file] !== manifest.hashes[file]).sort()
assert.deepEqual(changed, ['src/components/admin/pricing-settings-client.tsx','src/lib/admin-pricing-settings.ts','src/lib/admin-purchase-options.ts'].sort())
const schema = JSON.parse(sql("SELECT jsonb_object_agg(proname,md5(pg_get_functiondef(oid))) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('booking_ux_create_v1','booking_ux_update_v1','booking_ux_edit_set_v1','progressive_reprice_scope_v1','booking_bill_package_quote_v2','task10_booking_policy_quote_v1','booking_ux_expiry_v1','task10_previous_wallet_store_v2','admin_wallet_store_body_v1')"))
const suites = []
for (const [name, count] of [['pricing-settings',7],['readers',10]]) {
  const files = fs.readdirSync(run.outputDir).filter(file => file.startsWith(name + '-pass-') && file.endsWith('.json')).sort()
  assert.ok(files.length)
  const file = path.join(run.outputDir, files.at(-1)), record = json(file)
  assert.equal(record.runId, run.runId)
  assert.equal(record.target.api, run.target.api)
  assert.equal(record.checks.length, count)
  assert.deepEqual(record.schema, schema)
  assert.deepEqual(record.artifact, { baseUrl: 'http://127.0.0.1:63311', app: runtime.app, manifestHash: hashFile(manifestPath) })
  assert.ok(Date.parse(record.at) >= fs.statSync(runtime.logPath).birthtimeMs, 'Test must follow this runtime start')
  for (const [definition, expected] of Object.entries(record.definitionFiles)) assert.equal(hashFile(definition), expected, 'Test definition changed: ' + definition)
  for (const [source, expected] of Object.entries(record.sourceHashes || record.readerSourceHashes || {})) assert.equal(hashFile(source), expected)
  if (name === 'readers') assert.equal(record.pricingRestored, true)
  suites.push({ name, checks: count, file, sha256: hashFile(file), observedAt: record.at })
}
const state = JSON.parse(sql("SELECT jsonb_build_object('baselineMigrations',(SELECT count(*) FROM supabase_migrations.schema_migrations),'control',(SELECT to_jsonb(c) FROM booking_bill_policy_control c),'packageCatalog',booking_ux_catalog_v1(),'pricingSchema',(SELECT jsonb_object_agg(proname,md5(pg_get_functiondef(oid))) FROM pg_proc WHERE pronamespace='public'::regnamespace AND (proname='booking_ux_catalog_v1' OR proname LIKE 'admin_%pricing%')))"))
assert.equal(state.baselineMigrations, 101)
assert.equal(state.control.enabled, true)
assert.deepEqual(Object.fromEntries(state.packageCatalog.map(pack => [pack.id, pack.price])), { 'adult-1':600, 'adult-10':5500, 'adult-16':8000, 'private-1':900, 'private-10':8000 })
const report = { task:'BOOKING-BILL-POLICY-1', stage:'Pricing UI correction', status:'READY_FOR_OWNER_LOCAL_UAT', ownerUat:'pending', productionRelease:'not authorized or performed', observedAt:new Date().toISOString(), runId:run.runId, target:run.target, runtime, binding, changedProductInputs:changed, productInputCount:inputs.length, productInputHashes:Object.fromEntries(inputs), schema, state, suites, assertionCount:suites.reduce((n,s)=>n+s.checks,0), priorCoverage:'Original candidate4 coverage is historical; this correction rechecks affected Admin/public/User readers and actual pricing saves. Original83 checks were not all rerun.', collector:{file:'tests/booking-bill-policy/collect-pricing-correction.mjs',sha256:hashFile('tests/booking-bill-policy/collect-pricing-correction.mjs')} }
const file = path.join(run.outputDir, 'pricing-correction-handoff-' + Date.now() + '.json')
fs.writeFileSync(file, JSON.stringify(report,null,2), {flag:'wx'})
console.log(JSON.stringify({ready:true,ownerUat:'pending',assertions:report.assertionCount,productInputs:inputs.length,evidence:file}))
