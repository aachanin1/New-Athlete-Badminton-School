import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {run,sql} from '../tests/booking-makeup-scope/runtime.mjs'
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const schemas=JSON.parse(sql("SELECT jsonb_object_agg(proname,md5(replace(pg_get_functiondef(oid),chr(13),''))) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('progressive_assert_scope_membership_v1','progressive_proven_makeup_destination_v1')"))
const suites=[]
for(const [label,count] of [['db',26],['browser',10],['protected',14],['migration',6],['boundaries',6],['multi-branch',3],['quality',3]]){
 const found=fs.readdirSync(run.outputDir).filter(name=>name.startsWith(label+'-pass-')&&name.endsWith('.json')).map(name=>({file:path.join(run.outputDir,name),value:JSON.parse(fs.readFileSync(path.join(run.outputDir,name)))})).sort((a,b)=>a.value.at.localeCompare(b.value.at)).at(-1)
 assert.ok(found,label+' evidence missing');const {file,value}=found
 assert.equal(value.runId,run.runId);assert.equal(value.checks.length,count)
 assert.ok(value.definitionFiles,'Historical unbound result cannot satisfy final checks')
 for(const [dependency,expected] of Object.entries({...value.definitionFiles,...value.sourceFiles}))assert.equal(hash(dependency),expected,'Changed input after '+label+': '+dependency)
 assert.deepEqual(value.schemaIdentity,schemas,'Schema changed after '+label)
 suites.push({label,passed:count,observedAt:value.at,file,sha256:hash(file)})
}
const runtime=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'app-runtime.json'))),app=runtime.app
const build=JSON.parse(fs.readFileSync(path.join(app,'.next/booking-makeup-scope-local-build.json'))),inputs=JSON.parse(fs.readFileSync(path.join(app,'source-manifest.json')))
assert.equal(build.runId,run.runId);assert.equal(build.api,run.target.api);assert.equal(build.buildId,fs.readFileSync(path.join(app,'.next/BUILD_ID'),'utf8').trim())
const appFiles=Object.keys(inputs.hashes).filter(file=>file.startsWith('src/')||file.startsWith('public/')||['next.config.mjs','package.json','package-lock.json','tsconfig.json','postcss.config.mjs','tailwind.config.ts','components.json'].includes(file))
for(const file of appFiles)assert.equal(hash(file),inputs.hashes[file],'App input changed after native build: '+file)
const summary={status:'LOCAL VERIFIED; not published or deployed',runId:run.runId,at:new Date().toISOString(),scope:'Owner-approved Local W1–W4 only',behaviorIntegrityChecks:65,qualityChecks:3,suites,schemas,build:{...build,appSourceFilesCompared:appFiles.length,inputsManifest:path.join(app,'source-manifest.json')},isolationProof:path.join(run.evidenceRoot,'isolation-proof.json'),collectorHash:hash('scripts/collect-booking-makeup-scope-results.mjs'),limits:['No Production schema/config/data/publish action','No Owner manual UAT or real-bank payment','Wallet/Makeup grant/No-Class/Payroll complete lifecycles were not rerun; preserved definitions/data and package issuance were checked'],earlierFailures:'Preserved: fixture enum, lifecycle schema, receiver revision, package payload and test-harness assumptions corrected; original failing baseline retained'}
const file=path.join(run.outputDir,'local-verified-'+Date.now()+'.json');fs.writeFileSync(file,JSON.stringify(summary,null,2),{flag:'wx'})
console.log(JSON.stringify({status:summary.status,behaviorIntegrityChecks:65,qualityChecks:3,appSourceFilesCompared:appFiles.length,file}))
