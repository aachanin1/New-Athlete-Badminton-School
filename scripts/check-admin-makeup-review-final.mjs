import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
import {run,env,sql} from '../tests/admin-makeup-review/runtime.mjs'
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex'),checks=[]
const active=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'app-runtime.json'))),manifest=JSON.parse(fs.readFileSync(path.join(active.app,'source-manifest.json'))),binding=JSON.parse(fs.readFileSync(path.join(active.app,'.next/admin-makeup-review-local-build.json')))
assert.equal(active.runId,run.runId);assert.equal(binding.api,env.apiUrl);assert.equal(binding.buildId,fs.readFileSync(path.join(active.app,'.next/BUILD_ID'),'utf8').trim());assert.equal(binding.inputsHash,createHash('sha256').update(JSON.stringify(manifest.hashes)).digest('hex'));checks.push('Running immutable candidate has the expected Source/Local API/build binding')
const runtime=p=>/^(src\/|supabase\/migrations\/|public\/)/.test(p)||/^(package(-lock)?\.json|next\.config\.mjs|tsconfig\.json|postcss\.config\.mjs|tailwind\.config\.ts)$/.test(p)
const files=[...new Set([...execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0'),...execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0')])].filter(p=>p&&runtime(p)&&fs.existsSync(p)&&fs.statSync(p).isFile())
for(const file of files)assert.equal(sha(file),manifest.hashes[file],file)
checks.push(`All ${files.length} current runtime/migration/public/config inputs match the exact built candidate`)
const dirty=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'pre-existing-dirty-hashes.json')));for(const [file,hash]of Object.entries(dirty))assert.equal(sha(file),hash,file);checks.push('All five unrelated pre-existing dirty files remain byte-identical')
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();assert.equal(head,'ebd9b78f4fc5202d431105851dae382d99c55f56');assert.equal(execFileSync('git',['diff','--cached','--name-only'],{encoding:'utf8'}).trim(),'');checks.push('HEAD unchanged and nothing staged')
const chunks=path.join(active.app,'.next/static/chunks'),stack=[chunks];let scanned=0
while(stack.length){const entry=stack.pop();for(const file of fs.readdirSync(entry,{withFileTypes:true})){const p=path.join(entry,file.name);if(file.isDirectory())stack.push(p);else if(file.name.endsWith('.js')){assert.ok(!fs.readFileSync(p,'utf8').includes(env.serviceRoleKey),'Private key in browser chunk');scanned++}}}
checks.push(`Private Local service credential absent from all ${scanned} browser JavaScript chunks`)
assert.equal(sql("SELECT count(*) FROM admin_makeup_review_requests WHERE result->>'confirmed' IS DISTINCT FROM 'true'"),'0');checks.push('Durable receipts contain only confirmed committed outcomes; Owner Local test history is retained')
const original=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'baseline-functions.json'))),current=JSON.parse(sql("SELECT jsonb_object_agg(oid::regprocedure::text,jsonb_build_object('definition',pg_get_functiondef(oid),'acl',proacl,'config',proconfig,'definer',prosecdef)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f'"))
for(const [name,value]of Object.entries(original))assert.deepEqual(current[name],value,name)
checks.push(`All ${Object.keys(original).length} pre-task function bodies, ACLs, configurations and security-definer flags match`)
const output={runId:run.runId,checks,head,build:binding.buildId,api:binding.api,files:files.length,migration:'20261019133852_admin_makeup_review_workflow_v1.sql',migrationSha:sha('supabase/migrations/20261019133852_admin_makeup_review_workflow_v1.sql'),newFunctions:Object.keys(current).filter(n=>!original[n]),activeApp:active.app}
const file=path.join(run.outputDir,'final-'+Date.now()+'.json');fs.writeFileSync(file,JSON.stringify(output,null,2));fs.writeFileSync(path.join(run.evidenceRoot,'final-result.json'),JSON.stringify({...output,file},null,2));console.log(JSON.stringify({passed:checks.length,build:binding.buildId,files:files.length,file}))
