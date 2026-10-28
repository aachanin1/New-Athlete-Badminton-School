import fs from 'node:fs'
import assert from 'node:assert/strict'
import {auth} from './check-booking-ux-seven.mjs'
const root='.playwright/booking-ux-1/ux-two-20261022',actor=JSON.parse(fs.readFileSync(root+'/actor.json')),cookie=await auth(actor),base='http://127.0.0.1:3153',rows=[]
let checks=0
for(const path of ['/dashboard/booking','/dashboard/progress','/dashboard/schedule'])for(const mode of ['document','document-rsc-query','rsc','prefetch','old-version']){
 const headers={Cookie:cookie,Accept:'text/html',...(['rsc','prefetch','old-version'].includes(mode)?{RSC:'1',Accept:'*/*'}:{}),...(mode==='prefetch'?{'Next-Router-Prefetch':'1'}:{}),...(mode==='old-version'?{'x-deployment-id':'booking-local-ux-four-20261022-final'}:{})}
 const r=await fetch(base+path+(mode==='document'?'':'?_rsc=uxtwoproof'),{headers,signal:AbortSignal.timeout(15000)}),body=await r.text(),type=r.headers.get('content-type'),disposition=r.headers.get('content-disposition')
 assert.equal(r.status,200);checks++;assert.ok(!/attachment/i.test(disposition||''));checks++;assert.ok(mode.startsWith('document')?type?.includes('text/html')&&body.includes('<html'):type?.includes('text/x-component'));checks++
 rows.push({path,mode,status:r.status,type,disposition,deployment:r.headers.get('x-nextjs-deployment-id')})
}
fs.writeFileSync(root+'/navigation-final.json',JSON.stringify({passed:true,checks,rows,base,at:new Date().toISOString()},null,2));console.log(JSON.stringify({passed:true,checks}))
