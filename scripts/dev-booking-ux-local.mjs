import fs from 'node:fs'
import path from 'node:path'
import {spawn} from 'node:child_process'
import {run,env as local} from '../tests/booking-ux/runtime.mjs'
const app=path.join(run.evidenceRoot,'app-development')
fs.mkdirSync(app,{recursive:true})
for(const file of ['src','public','package.json','package-lock.json','next.config.mjs','tsconfig.json','postcss.config.mjs','tailwind.config.ts','components.json']){
 if(fs.existsSync(file))fs.cpSync(file,path.join(app,file),{recursive:fs.statSync(file).isDirectory()})
}
if(!fs.existsSync(path.join(app,'node_modules')))fs.symlinkSync(path.resolve('node_modules'),path.join(app,'node_modules'),'junction')
if(process.argv.includes('--sync')){console.log('Synced task-owned development app');process.exit(0)}
const environment={...process.env,NODE_ENV:'development',TZ:'UTC',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:local.apiUrl,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:local.publishableKey,NEXT_PUBLIC_SUPABASE_ANON_KEY:local.publishableKey,SUPABASE_SERVICE_ROLE_KEY:local.serviceRoleKey,SLIPOK_TEST_MODE:'true',BOOKING_UX_ENABLED:'true',PROGRESSIVE_BOOKING_ENTRY_ENABLED:'true',PROGRESSIVE_PRICING_WRITES_ENABLED:'true',PROGRESSIVE_COUPON_LIFECYCLE_ENABLED:'true',PROGRESSIVE_PAYMENT_BATCH_ENABLED:'true',PROGRESSIVE_PAYMENT_ENTRY_ENABLED:'true',PROGRESSIVE_PAYMENT_REVIEW_ENABLED:'true'}
const logPath=path.join(run.evidenceRoot,'development-'+Date.now()+'.log'),log=fs.openSync(logPath,'wx')
const child=spawn(process.execPath,[path.resolve('node_modules/next/dist/bin/next'),'dev',app,'--webpack','--hostname','127.0.0.1','--port','3152'],{env:environment,stdio:['ignore',log,log],windowsHide:true})
fs.writeFileSync(path.join(run.evidenceRoot,'development-runtime.json'),JSON.stringify({runId:run.runId,app,pid:child.pid,port:3152,api:local.apiUrl,logPath},null,2))
console.log(JSON.stringify({pid:child.pid,port:3152,logPath}));child.on('exit',code=>{process.exitCode=code??1})
