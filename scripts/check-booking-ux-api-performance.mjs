import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {performance}from'node:perf_hooks'
import {run,sql,q}from'../tests/booking-ux/runtime.mjs'
import {adminBrowser,fixture as f}from'../tests/booking-ux/browser.mjs'
import {domainSnapshot,flushMetrics}from'../tests/booking-ux/performance-metrics.mjs'
const label=process.argv[2],base=process.argv[3],large=process.argv[4]==='large'
if(!/^[a-z0-9-]+$/.test(label)||!/^http:\/\/127\.0\.0\.1:315[03]$/.test(base))throw Error('Frozen task apps required')
const actor=large?JSON.parse(fs.readFileSync(run.evidenceRoot+'/performance-large-fixture.json')).parent:f.parent,{browser,context,page}=await adminBrowser(base,actor),admin=await adminBrowser(base,f.sa),result={label,base,actor:actor.id,size:large?'large':'small',scenarios:{},errors:[]}
page.on('pageerror',e=>result.errors.push(e.message))
const month=sql("SELECT to_char(clock_timestamp() AT TIME ZONE 'Asia/Bangkok','YYYY-MM')"),next=sql("SELECT to_char(date_trunc('month',clock_timestamp() AT TIME ZONE 'Asia/Bangkok')+interval '1 month','YYYY-MM')"),slots=[]
for(let n=1;n<=28;n++){const date=next+'-'+String(n).padStart(2,'0');for(const start of ['10:00','17:00']){const template=f.templates.find(t=>t.course==='kids_group'&&t.day===new Date(date+'T12:00+07:00').getUTCDay()&&t.start===start);slots.push({date,startTime:start,endTime:start==='10:00'?'11:00':'18:00',branchId:f.branch,scheduleTemplateId:template.id})}}
const edge=JSON.parse(fs.readFileSync(run.evidenceRoot+'/policy-edge-fixture.json')),source=sql(`SELECT id FROM booking_sessions WHERE booking_id=${q(edge.old.booking)} AND status='scheduled' ORDER BY date LIMIT 1`)
const scenarios=[['current-month-price','/api/bookings/preview',{courseTypeId:f.courses.kids_group,month:+month.slice(5,7),year:+month.slice(0,4),totalSessions:1}],['next-month-price','/api/bookings/preview',{courseTypeId:f.courses.kids_group,month:+next.slice(5,7),year:+next.slice(0,4),totalSessions:1}],['family-quantity-price','/api/bookings/preview',{courseTypeId:f.courses.kids_group,month:+next.slice(5,7),year:+next.slice(0,4),totalSessions:2}],['month-calendar-56-slots','/api/bookings/availability',{courseTypeId:f.courses.kids_group,slots}],['shared-admin-store-preview','/api/admin/makeup/store-preview?session='+source,null]]
try{
 for(const [name,url,data]of scenarios){const rows=[],queriesBefore=domainSnapshot(),client=name==='shared-admin-store-preview'?admin.page.request:page.request
  for(let i=0;i<35;i++){const start=performance.now(),r=data?await client.post(base+url,{data}):await client.get(base+url),body=await r.body();assert.equal(r.status(),200,body.toString());rows.push({ms:performance.now()-start,requestBytes:data?Buffer.byteLength(JSON.stringify(data)):0,responseBytes:body.length})}
  await flushMetrics();const queriesAfter=domainSnapshot()
  const warm=rows.slice(5).map(r=>r.ms).sort((a,b)=>a-b);result.scenarios[name]={initial:rows.slice(0,5),warm:rows.slice(5),median:warm[14],p95:warm[28],domainSqlCalls:queriesAfter.calls-queriesBefore.calls,domainSqlExecutionMs:queriesAfter.executionMs-queriesBefore.executionMs}
 }
 assert.equal(result.errors.length,0)
}finally{await context.close();await browser.close();await admin.context.close();await admin.browser.close();fs.writeFileSync(path.join(run.evidenceRoot,'api-performance-'+label+'.json'),JSON.stringify(result,null,2))}
console.log(JSON.stringify({label,scenarios:Object.fromEntries(Object.entries(result.scenarios).map(([n,v])=>[n,{median:v.median,p95:v.p95}]))}))
