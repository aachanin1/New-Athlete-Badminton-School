import fs from 'node:fs'
import path from 'node:path'
import {execFileSync,spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
import {run,env as local} from '../tests/admin-makeup-review/runtime.mjs'
import {applyReviewRecoveryOverlay} from './prepare-admin-makeup-review-recovery.mjs'
const label=process.argv[2]||'candidate1',mode=process.argv[3]||'build',port=Number(process.argv[4]||3145)
if(!/^[a-z0-9-]+$/.test(label)||!['build','serve'].includes(mode)||![3144,3145,3146,3147].includes(port))throw Error('Use the task-owned label and app ports3144/3145/3146/3147')
const app=path.join(run.evidenceRoot,'app-'+label)
const environment={...process.env,NODE_ENV:'production',TZ:'UTC',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:local.apiUrl,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:local.publishableKey,NEXT_PUBLIC_SUPABASE_ANON_KEY:local.publishableKey,SUPABASE_SERVICE_ROLE_KEY:local.serviceRoleKey,SLIPOK_TEST_MODE:'true',PROGRESSIVE_BOOKING_ENTRY_ENABLED:'true',PROGRESSIVE_PRICING_WRITES_ENABLED:'true',PROGRESSIVE_COUPON_LIFECYCLE_ENABLED:'true',PROGRESSIVE_PAYMENT_BATCH_ENABLED:'true',PROGRESSIVE_PAYMENT_ENTRY_ENABLED:'true',PROGRESSIVE_PAYMENT_REVIEW_ENABLED:'true'}
let hashes
if(mode==='build'){
 if(fs.existsSync(app))throw Error('Use a new build label; existing evidence is immutable')
 fs.mkdirSync(app,{recursive:true})
 const files=[...new Set([...execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0'),...execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0')])].filter(p=>p&&fs.existsSync(p)&&fs.statSync(p).isFile()&&!/(^|\/)\.env($|\.)/.test(p))
 hashes={}
 for(const file of files){const target=path.join(app,file);fs.mkdirSync(path.dirname(target),{recursive:true});const bytes=fs.readFileSync(file);fs.writeFileSync(target,bytes);hashes[file]=createHash('sha256').update(bytes).digest('hex')}
 if(label.startsWith('recovery-')){
  applyReviewRecoveryOverlay(app)
  for(const file of Object.keys(hashes))hashes[file]=createHash('sha256').update(fs.readFileSync(path.join(app,file))).digest('hex')
 }
 fs.symlinkSync(path.resolve('node_modules'),path.join(app,'node_modules'),'junction')
 fs.writeFileSync(path.join(app,'source-manifest.json'),JSON.stringify({runId:run.runId,api:local.apiUrl,hashes},null,2))
}else{
 const binding=JSON.parse(fs.readFileSync(path.join(app,'.next/admin-makeup-review-local-build.json')))
 if(binding.runId!==run.runId||binding.api!==local.apiUrl||binding.buildId!==fs.readFileSync(path.join(app,'.next/BUILD_ID'),'utf8').trim())throw Error('Build/database binding mismatch')
}
const logPath=path.join(run.evidenceRoot,(mode==='build'?'build-':'serve-')+label+(mode==='serve'?'-'+Date.now():'')+'.log'),log=fs.openSync(logPath,'wx')
const args=[path.resolve('node_modules/next/dist/bin/next'),mode==='build'?'build':'start',app,...(mode==='build'?['--webpack']:['--hostname','127.0.0.1','--port',String(port)])]
const child=spawn(process.execPath,args,{env:environment,stdio:['ignore',log,log],windowsHide:true})
if(mode==='serve')fs.writeFileSync(path.join(run.evidenceRoot,'app-runtime.json'),JSON.stringify({runId:run.runId,app,pid:child.pid,port,api:local.apiUrl,logPath},null,2))
console.log(JSON.stringify({mode,label,pid:child.pid,logPath}))
child.on('exit',code=>{
 if(!code&&mode==='build'){
  const binding={runId:run.runId,api:local.apiUrl,buildId:fs.readFileSync(path.join(app,'.next/BUILD_ID'),'utf8').trim(),inputsHash:createHash('sha256').update(JSON.stringify(hashes)).digest('hex')}
  fs.writeFileSync(path.join(app,'.next/admin-makeup-review-local-build.json'),JSON.stringify(binding,null,2));console.log(JSON.stringify({built:true,...binding}))
 }
 if(code)console.error('Local '+mode+' failed: '+logPath)
 process.exitCode=code??1
})

