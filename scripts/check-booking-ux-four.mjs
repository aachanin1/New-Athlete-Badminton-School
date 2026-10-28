import fs from 'node:fs'
import assert from 'node:assert/strict'
import {auth} from './check-booking-ux-seven.mjs'
import {sql,q} from '../tests/booking-ux/runtime.mjs'
const root='.playwright/booking-ux-1/ux-four-20261022',actor=JSON.parse(fs.readFileSync(root+'/actor.json')),pending=JSON.parse(fs.readFileSync(root+'/pending-current.json'))
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label)},checks=[]
if(process.argv[2]==='readback'){
 const before=JSON.parse(fs.readFileSync(root+'/'+fs.readdirSync(root).find(n=>/^pending-\d/.test(n))))
 const after=JSON.parse(sql(`SELECT jsonb_build_object('deadlines',(SELECT jsonb_object_agg(id,checkout_deadline) FROM bookings WHERE id=ANY(ARRAY[${pending.ids.map(q)}]::uuid[])),'rows',(SELECT jsonb_agg(jsonb_build_object('bill',booking_id,'date',date,'child',child_id,'branch',branch_id)) FROM booking_sessions WHERE booking_id=ANY(ARRAY[${pending.ids.map(q)}]::uuid[])))`))
 assert.deepEqual(after.deadlines,JSON.parse(before.deadlines));check(after.rows.length===20,'Twenty rounds remain after calendar save');check(after.rows.some(r=>r.date==='2026-11-21')&&after.rows.some(r=>r.date==='2026-11-22'),'Both learner replacements committed');check(!after.rows.some(r=>r.date==='2026-11-01'||r.date==='2026-11-11'),'Both old dates removed');check(true,'Original deadlines retained exactly')
 fs.writeFileSync(root+'/20-rounds-readback.json',JSON.stringify({passed:true,checks,...after},null,2))
}else{
 const cookie=await auth(actor),base=process.env.BOOKING_FOUR_BASE||'http://127.0.0.1:3151',rows=[]
 for(const path of ['/dashboard/booking','/dashboard/progress','/dashboard/schedule'])for(const mode of ['document','document-rsc-query','rsc','prefetch','old-version']){
   const headers={Cookie:cookie,Accept:'text/html',...(['rsc','prefetch','old-version'].includes(mode)?{RSC:'1',Accept:'*/*'}:{}),...(mode==='prefetch'?{'Next-Router-Prefetch':'1'}:{}),...(mode==='old-version'?{'x-deployment-id':'booking-local-obsolete-test'}:{})}
   console.log('Checking',path,mode)
   const r=await fetch(base+path+(mode==='document'?'':'?_rsc=uxfourproof'),{headers,signal:AbortSignal.timeout(15000)}),body=await r.text(),type=r.headers.get('content-type'),disposition=r.headers.get('content-disposition')
   check(r.status===200,path+' '+mode+' returns200');check(!/attachment/i.test(disposition||''),path+' '+mode+' has no attachment disposition');check(mode.startsWith('document')?type?.includes('text/html')&&body.includes('<html'):type?.includes('text/x-component'),path+' '+mode+' has correct document/RSC type')
   rows.push({path,mode,status:r.status,type,disposition,vary:r.headers.get('vary'),cache:r.headers.get('cache-control'),deployment:r.headers.get('x-nextjs-deployment-id')})
   fs.writeFileSync(root+'/navigation-progress.json',JSON.stringify(rows,null,2))
 }
 const performance=[]
 for(const path of process.env.BOOKING_FOUR_SKIP_PERFORMANCE?[]:['/dashboard/booking','/dashboard/schedule','/dashboard/progress']){
   const samples=[[],[]],bases=['http://127.0.0.1:3153',base]
   for(let i=0;i<24;i++)for(const n of i%2?[1,0]:[0,1]){const t=performanceNow();const r=await fetch(bases[n]+path,{headers:{Cookie:cookie,Accept:'text/html'},signal:AbortSignal.timeout(15000)});await r.text();assert.equal(r.status,200);if(i>=4)samples[n].push(performanceNow()-t)}
   performance.push({path,samples:samples.map(x=>x.sort((a,b)=>a-b)),summary:samples.map(x=>({median:x[Math.floor(x.length/2)],p95:x[Math.ceil(x.length*.95)-1]}))})
 }
 fs.writeFileSync(root+(process.env.BOOKING_FOUR_SKIP_PERFORMANCE?'/navigation-final.json':'/navigation-http.json'),JSON.stringify({passed:true,base,checks,rows,performance,at:new Date().toISOString()},null,2))
}
console.log(JSON.stringify({passed:true,checks:checks.length}))
function performanceNow(){return Number(process.hrtime.bigint())/1e6}
