import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { run, sql } from './runtime.mjs'
import { hashFile } from './helpers.mjs'

const json=file=>JSON.parse(fs.readFileSync(file,'utf8'))
const runtime=json(path.join(run.evidenceRoot,'app-runtime.json'))
assert.equal(runtime.runId,run.runId);assert.equal(runtime.port,63311)
assert.equal(runtime.app,path.join(run.evidenceRoot,'app-candidate7'))
const manifestPath=path.join(runtime.app,'source-manifest.json'),manifest=json(manifestPath)
const binding=json(path.join(runtime.app,'.next/booking-bill-policy-local-build.json'))
assert.equal(binding.runId,run.runId);assert.equal(binding.api,run.target.api)
assert.equal(binding.deploymentId,'booking-bill-policy-local-candidate7')
assert.equal(binding.buildId,fs.readFileSync(path.join(runtime.app,'.next/BUILD_ID'),'utf8').trim())
const processCommand=execFileSync('powershell.exe',['-NoProfile','-Command',`(Get-CimInstance Win32_Process -Filter "ProcessId=${runtime.pid}").CommandLine`],{encoding:'utf8',windowsHide:true})
assert.ok(processCommand.includes(runtime.app)&&processCommand.includes('start')&&processCommand.includes('63311'))
const product=file=>file.startsWith('src/')||file.startsWith('public/')||file.startsWith('supabase/migrations/')||['package.json','package-lock.json','next.config.mjs','tsconfig.json','postcss.config.mjs','tailwind.config.ts','components.json'].includes(file)
const inputs=Object.entries(manifest.hashes).filter(([file])=>product(file))
const inventory=[...new Set([['ls-files','-z'],['ls-files','--others','--exclude-standard','-z']].flatMap(args=>execFileSync('git',args,{encoding:'utf8'}).split('\0')))].filter(file=>file&&product(file)&&fs.existsSync(file)).sort()
assert.deepEqual(inputs.map(([file])=>file).sort(),inventory)
for(const[file,expected]of inputs){assert.equal(hashFile(file),expected,'Root changed: '+file);assert.equal(hashFile(path.join(runtime.app,file)),expected,'Frozen file changed: '+file)}
const previous=json(path.join(run.evidenceRoot,'app-candidate6/source-manifest.json'))
const changed=[...new Set([...Object.keys(previous.hashes),...Object.keys(manifest.hashes)])].filter(file=>product(file)&&previous.hashes[file]!==manifest.hashes[file]).sort()
assert.deepEqual(changed,['src/lib/admin-navigation.ts','src/components/admin/admin-menu-permissions-client.tsx','src/app/api/admin/settings/route.ts','src/app/api/admin/schedule-templates/route.ts','src/app/(admin)/admin/schedule-templates/page.tsx','src/components/admin/schedule-templates-client.tsx'].sort())
const schema=JSON.parse(sql("SELECT jsonb_object_agg(proname,md5(pg_get_functiondef(oid))) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('booking_ux_create_v1','booking_ux_update_v1','booking_ux_edit_set_v1','progressive_reprice_scope_v1','booking_bill_package_quote_v2','task10_booking_policy_quote_v1','booking_ux_expiry_v1','task10_previous_wallet_store_v2','admin_wallet_store_body_v1')"))
const suites=[]
for(const[name,count]of [['admin-menu',14],['pricing-settings',7]]){
  const files=fs.readdirSync(run.outputDir).filter(file=>file.startsWith(name+'-pass-')&&file.endsWith('.json')).sort();assert.ok(files.length)
  const file=path.join(run.outputDir,files.at(-1)),record=json(file)
  assert.equal(record.runId,run.runId);assert.equal(record.target.api,run.target.api)
  assert.equal(record.checks.length,count);assert.deepEqual(record.schema,schema)
  assert.deepEqual(record.artifact,{baseUrl:'http://127.0.0.1:63311',app:runtime.app,manifestHash:hashFile(manifestPath)})
  assert.ok(Date.parse(record.at)>=fs.statSync(runtime.logPath).birthtimeMs)
  for(const[definition,expected]of Object.entries(record.definitionFiles))assert.equal(hashFile(definition),expected,'Definition changed: '+definition)
  for(const[source,expected]of Object.entries(record.sourceHashes||{}))assert.equal(hashFile(source),expected)
  if(name==='admin-menu')assert.equal(record.restored,true)
  suites.push({name,checks:count,file,sha256:hashFile(file),at:record.at})
}
const state=JSON.parse(sql("SELECT jsonb_build_object('baselineMigrations',(SELECT count(*) FROM supabase_migrations.schema_migrations),'menuPermissions',(SELECT value FROM system_settings WHERE key='admin_menu_permissions'),'control',(SELECT to_jsonb(c) FROM booking_bill_policy_control c),'packageCatalog',booking_ux_catalog_v1())"))
assert.equal(state.baselineMigrations,101);assert.equal(state.control.enabled,true)
for(const key of ['dashboard','schedules','notifications','schedule_templates'])assert.ok(state.menuPermissions.adminAllowedMenuKeys.includes(key))
assert.ok(!state.menuPermissions.adminAllowedMenuKeys.some(key=>['settings','logs'].includes(key)))
assert.deepEqual(Object.fromEntries(state.packageCatalog.map(pack=>[pack.id,pack.price])),{'adult-1':600,'adult-10':5500,'adult-16':8000,'private-1':900,'private-10':8000})
const readiness=json(path.join(run.evidenceRoot,'admin-menu-owner-readiness.json'))
assert.equal(readiness.app,runtime.app);assert.equal(readiness.baseUrl,'http://127.0.0.1:63311')
assert.equal(readiness.regularRole,'admin');assert.equal(readiness.superAdminControls,true);assert.equal(readiness.regularTemplatePage,true)
const report={task:'ADMIN-MENU-PERMISSIONS-LOCAL-1',parentTask:'BOOKING-BILL-POLICY-1',status:'READY_FOR_OWNER_LOCAL_UAT',ownerUat:'pending',productionRelease:'not authorized or performed',at:new Date().toISOString(),runId:run.runId,target:run.target,runtime,binding,changedProductInputs:changed,productInputCount:inputs.length,productInputHashes:Object.fromEntries(inputs),suites,assertionCount:suites.reduce((n,s)=>n+s.checks,0),schema,state,readiness,collector:{file:'tests/booking-bill-policy/collect-admin-menu.mjs',sha256:hashFile('tests/booking-bill-policy/collect-admin-menu.mjs')}}
const file=path.join(run.outputDir,'admin-menu-handoff-'+Date.now()+'.json');fs.writeFileSync(file,JSON.stringify(report,null,2),{flag:'wx'})
console.log(JSON.stringify({ready:true,assertions:report.assertionCount,productInputs:inputs.length,evidence:file}))
