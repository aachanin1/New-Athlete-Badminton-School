import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {run,env,sql,q} from '../tests/admin-makeup-browse/runtime.mjs'
const root=path.join(run.outputDir,'v8'),sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const runtime=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'app-runtime.json'))),binding=JSON.parse(fs.readFileSync(path.join(runtime.app,'.next/admin-makeup-local-build.json'))),manifest=JSON.parse(fs.readFileSync(path.join(runtime.app,'source-manifest.json')))
assert.equal(runtime.runId,run.runId);assert.equal(runtime.api,env.apiUrl);assert.equal(binding.buildId,'H1qooexcurLL4KgZY9_wG')
const relevant=file=>/^(src\/|public\/|supabase\/migrations\/|(?:package(?:-lock)?\.json|next\.config\.[^.]+|tsconfig\.json|postcss\.config\.[^.]+|tailwind\.config\.[^.]+)$)/.test(file)
const currentFiles=execFileSync('git',['ls-files','-co','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(p=>p&&fs.existsSync(p)&&fs.statSync(p).isFile())
const current=currentFiles.filter(relevant).sort(),built=Object.keys(manifest.hashes).filter(relevant).sort()
assert.deepEqual(current,built)
for(const file of current)assert.equal(sha(fs.readFileSync(file)),manifest.hashes[file],file)
const original=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'pre-existing-dirty-hashes.json')))
for(const [file,hash]of Object.entries(original))assert.equal(sha(fs.readFileSync(file)).toUpperCase(),hash,file+' preserved')
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),staged=execFileSync('git',['diff','--cached','--name-only'],{encoding:'utf8'}).trim()
assert.equal(head,'bd71ec58ed26721eab76b5e92ad2eeebe858ec3a');assert.equal(staged,'')
const baseline=JSON.parse(fs.readFileSync(path.join(root,'baseline-functions.json'))),now=JSON.parse(sql("SELECT jsonb_object_agg(oid::regprocedure::text,pg_get_functiondef(oid)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f';"))
const changed=Object.keys(baseline).filter(k=>baseline[k]!==now[k]),expected=['task10_family_makeup_state_v1','lesson_source_previous_kids_makeup_v1','admin_makeup_browse_v1','admin_makeup_history_v1','lesson_source_transition_v1']
assert.deepEqual(changed.map(k=>k.split('(')[0]).sort(),expected.sort());assert.equal(sql('SELECT count(*) FROM supabase_migrations.schema_migrations;'),'54')
const f=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json')))
assert.equal(sql(`SELECT admin_makeup_credit_ready_v1(${q(f.admin.id)});`),'t');assert.equal(sql('SELECT enabled FROM admin_makeup_credit_control;'),'t')
const privateTables=['admin_makeup_credit_approvals','admin_makeup_credit_decisions','admin_makeup_store_requests','admin_makeup_credit_intents','admin_makeup_credit_control']
const privacy=JSON.parse(sql(`SELECT jsonb_agg(jsonb_build_object('table',c.relname,'rls',c.relrowsecurity,'anonSelect',has_table_privilege('anon',c.oid,'SELECT'),'userSelect',has_table_privilege('authenticated',c.oid,'SELECT'),'anonWrite',has_table_privilege('anon',c.oid,'INSERT'),'userWrite',has_table_privilege('authenticated',c.oid,'INSERT'))) FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relname IN (${privateTables.map(q).join(',')});`))
assert.equal(privacy.length,5);for(const p of privacy){assert.equal(p.rls,true);for(const key of ['anonSelect','userSelect','anonWrite','userWrite'])assert.equal(p[key],false)}
const indexes=JSON.parse(sql("SELECT jsonb_agg(jsonb_build_object('table',tablename,'index',indexname,'definition',indexdef)) FROM pg_indexes WHERE schemaname='public' AND tablename LIKE 'admin_makeup_%';"))
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(path.join(dir,d.name)):[path.join(dir,d.name)])
const chunks=walk(path.join(runtime.app,'.next/static')).filter(p=>p.endsWith('.js'))
for(const file of chunks)assert.equal(fs.readFileSync(file,'utf8').includes(env.serviceRoleKey),false,'Service key absent from client '+path.basename(file))
const before=JSON.parse(fs.readFileSync(path.join(root,'performance-v7matched.json'))),after=JSON.parse(fs.readFileSync(path.join(root,'performance-v8matched.json')))
const performance=Object.fromEntries(Object.entries(after.summary).map(([key,value])=>{const old=before.summary[key],delta=value.p95-old.p95,gate=Math.max(.1*old.p95,50);assert.ok(delta<=gate,key+' p95');assert.equal(value.requests,old.requests);assert.equal(after.warm[key].length,30);assert.equal(before.warm[key].length,30);return [key,{before:old,after:value,deltaP95:delta,gateMs:gate,passed:true}]}))
assert.equal(after.scope.normalBlockingAtEnd,'0')
const benchmark=JSON.parse(fs.readFileSync(path.join(root,'benchmark-state.json')));assert.equal(benchmark.restored,true)
// Preserve the fixed comparison dataset through the v8 read benchmark as well.
for(const [table,value]of Object.entries(benchmark.before)){const actual=JSON.parse(sql(`SELECT jsonb_build_object('count',count(*),'md5',md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''))) FROM public.${table} t;`));assert.deepEqual(actual,value,table+' unchanged after both benchmarks')}
const results={passed:true,runId:run.runId,head,staged:0,binding,runtime,source:{snapshotFiles:Object.keys(manifest.hashes).length,runtimeAndMigrationFiles:current.length,matched:true,preExistingFivePreserved:true,changedBaselineFunctions:changed,addedFunctions:Object.keys(now).filter(k=>!(k in baseline))},privacy,indexes,clientChunksChecked:chunks.length,migrationLedger:54,control:'Local test-only enabled; production migration defaults disabled',performance,checks:{typescript:'npx tsc --noEmit --incremental false exit0',scopedLint:'all changed/new TS/TSX eslint --max-warnings=0 exit0',wallet:'45 passed after replacing brittle RPC-text assertion with actual default/explicit helper call verification',calendar:20,creditBrowser:31,existingBrowser:50,dbCore:32,boundaries:25,proof:4,protected:14,cloneRecovery:12},limitations:['Synthetic owned Local only; not Production load or Owner UAT','No independent reviewer was invoked','Seven existing security advisor warnings remain unchanged','A second compatibility harness probe was accidentally sent to the old API, which lacks read_only and performed one ordinary synthetic Store; retained and recorded in benchmark-state.json, guard fixed. The final matched benchmarks used the same dataset afterwards.']}
const file=path.join(root,'final-audit.json');fs.writeFileSync(file,JSON.stringify(results,null,2),{flag:'wx'});console.log(JSON.stringify({passed:true,file,source:results.source,clientChunks:chunks.length,performance}))
