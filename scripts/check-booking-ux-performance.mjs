import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { run,sql,q } from '../tests/booking-ux/runtime.mjs'
import { adminBrowser,fixture } from '../tests/booking-ux/browser.mjs'
import {domainSnapshot,flushMetrics}from'../tests/booking-ux/performance-metrics.mjs'
const label=process.argv[2]||'baseline',base=process.argv[3]||'http://127.0.0.1:3150'
const routeFilter=process.argv[5]
if(routeFilter&&routeFilter!=='booking')throw Error('Only the scoped booking repeat is supported')
if(!/^http:\/\/127\.0\.0\.1:315[0-3]$/.test(base)||!/^[a-z0-9-]+$/.test(label))throw Error('Owned app required')
const result={label,runId:run.runId,base,startedAt:new Date().toISOString(),routes:{},errors:[]}
const actor=process.argv[4]==='large'?JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'performance-large-fixture.json'))).parent:fixture.parent
const fingerprint=()=>sql(`SELECT md5(coalesce((SELECT string_agg(row_to_json(b)::text,'' ORDER BY id) FROM bookings b WHERE user_id=${q(actor.id)}),'')||coalesce((SELECT string_agg(row_to_json(c)::text,'' ORDER BY id) FROM lesson_wallet_credits c WHERE user_id=${q(actor.id)}),''))`)
result.datasetBefore=fingerprint();result.actor=actor.id;result.size=process.argv[4]||'small';result.coldDefinition='5 navigations with cleared browser HTTP cache; not cold server starts'
const {browser,context,page}=await adminBrowser(base,actor),cdp=await context.newCDPSession(page)
await cdp.send('Network.enable');let transferred=0;cdp.on('Network.loadingFinished',event=>transferred+=event.encodedDataLength)
page.on('pageerror',e=>result.errors.push(e.message))
try{
 for(const route of (routeFilter?['/dashboard/booking']:['/dashboard/booking','/dashboard/history','/dashboard/lesson-wallet'])){
  const rows=[],queriesBefore=domainSnapshot()
  for(let i=0;i<35;i++){
   if(i<5)await cdp.send('Network.clearBrowserCache')
   const requests=[];const on=r=>requests.push(r.url());page.on('request',on)
   const bytesBefore=transferred,start=performance.now(),response=await page.goto(base+route,{waitUntil:'networkidle'});assert.equal(response.status(),200)
   const html=await page.textContent('body');assert.ok(!html.includes('Application error:'))
   rows.push({ms:performance.now()-start,requests:requests.length,wireBytes:transferred-bytesBefore});page.off('request',on)
  }
  const warm=rows.slice(5).map(x=>x.ms).sort((a,b)=>a-b)
  await flushMetrics();const queriesAfter=domainSnapshot()
  result.routes[route]={cold:rows.slice(0,5),warm:rows.slice(5),median:warm[14],p95:warm[28],domainSqlCalls:queriesAfter.calls-queriesBefore.calls,domainSqlExecutionMs:queriesAfter.executionMs-queriesBefore.executionMs}
  await page.screenshot({path:path.join(run.evidenceRoot,label+'-'+route.split('/').at(-1)+'-desktop.png'),fullPage:result.size!=='large'})
 }
 assert.equal(result.errors.length,0)
 result.datasetAfter=fingerprint();assert.equal(result.datasetAfter,result.datasetBefore)
}finally{await context.close();await browser.close();fs.writeFileSync(path.join(run.evidenceRoot,'performance-'+label+'.json'),JSON.stringify(result,null,2))}
console.log(JSON.stringify({label,routes:Object.fromEntries(Object.entries(result.routes).map(([k,v])=>[k,{median:v.median,p95:v.p95}]))}))
