import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createServerClient} from '@supabase/ssr'
import {run,env,sql,q,fixtures} from '../tests/admin-makeup-browse/runtime.mjs'

const f=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json'))),runtime=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'app-runtime.json')))
assert.equal(runtime.runId,run.runId);assert.equal(runtime.port,3142);assert.equal(runtime.api,env.apiUrl)
const cookies=new Map(),auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:items=>items.forEach(c=>cookies.set(c.name,c.value))}})
assert.ifError((await auth.auth.signInWithPassword({email:f.admin.email,password:fixtures.password})).error)
const base='http://127.0.0.1:3142',headers={Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}
async function read(route){const begin=performance.now(),r=await fetch(base+route,{headers,redirect:'error'}),text=await r.text();assert.equal(r.status,200);return {data:JSON.parse(text),bytes:Buffer.byteLength(text),ms:performance.now()-begin}}
const statQuery="SELECT coalesce(jsonb_object_agg(queryid::text,jsonb_build_object('calls',calls,'ms',total_exec_time)),'{}') FROM extensions.pg_stat_statements WHERE dbid=(SELECT oid FROM pg_database WHERE datname=current_database()) AND query NOT LIKE '%pg_stat_statements%';"
const snapshot=()=>JSON.parse(sql(statQuery)),delta=(a,b)=>Object.entries(b).reduce((sum,[key,v])=>({calls:sum.calls+Math.max(0,v.calls-(a[key]?.calls||0)),ms:sum.ms+Math.max(0,v.ms-(a[key]?.ms||0))}),{calls:0,ms:0})
const route=`/api/admin/makeup/browse?month=${f.month}&course=kids_group&search=${encodeURIComponent(f.tag)}`
const first=await read(route),ids=first.data.cards.map(c=>c.state.parentId)
assert.equal(ids.length,10)
const oldRoutes=ids.map(parent=>`/api/admin/makeup/family-card?parent=${parent}&month=${f.month}`)
// Normalize the information returned: ten complete family cards. The old UI
// searched first and opened ONE card; ten old detail reads below are a measured
// equivalent-information baseline, not a claim about its initial page traffic.
const measure=async(routes)=>{const before=snapshot(),start=performance.now(),rows=await Promise.all(routes.map(read)),wallMs=performance.now()-start,after=snapshot();return {appRequests:routes.length,bytes:rows.reduce((n,r)=>n+r.bytes,0),wallMs,dbTopLevel:delta(before,after),rows}}
await measure(oldRoutes);await measure([route])
const samples=[]
for(let i=0;i<3;i++){
 const old=await measure(oldRoutes),current=await measure([route])
 const actual=new Map(current.rows[0].data.cards.map(c=>[c.state.parentId,c.state]))
 old.rows.forEach((row,index)=>{const a=actual.get(ids[index]),b=row.data.state;for(const key of ['quota','used','remaining','eligible'])assert.equal(a[key],b[key]);assert.deepEqual(a.sources.map(s=>s.sourceSessionId).sort(),b.sources.map(s=>s.sourceSessionId).sort())})
 const strip=({rows,...measurement})=>measurement
 samples.push({old:strip(old),current:strip(current)})
}
const legacySamples=[]
for(let i=0;i<3;i++){
 const old=await measure([`/api/admin/makeup/queue?mode=legacy&month=${f.month}&course=adult_group&pageSize=15`]),current=await measure([`/api/admin/makeup/browse?month=${f.month}&course=adult_group`])
 legacySamples.push({old:{...old,rows:undefined},current:{...current,rows:undefined}})
}
const plan=JSON.parse(sql(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT admin_makeup_browse_v1(${q(f.admin.id)},${q(f.month+'-01')},'kids_group',${q(f.tag)});`))
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]
const summary=Object.fromEntries(['old','current'].map(key=>[key,{appRequests:samples[0][key].appRequests,bytes:median(samples.map(s=>s[key].bytes)),wallMs:median(samples.map(s=>s[key].wallMs)),dbTopLevelCalls:median(samples.map(s=>s[key].dbTopLevel.calls)),dbTopLevelMs:median(samples.map(s=>s[key].dbTopLevel.ms))}]))
const output=path.join(run.outputDir,'performance-'+Date.now()+'.json')
fs.writeFileSync(output,JSON.stringify({passed:true,runId:run.runId,binding:runtime.app,fixture:{month:f.month,totalMatchingFamilies:first.data.total,comparedCards:ids.length},scope:'Same synthetic Local runtime; ten equivalent family card facts. Old actual UI showed a search result and one selected card. No Production speed claim.',samples,summary,legacySamples,plan,statisticsTrack:sql('SHOW pg_stat_statements.track;'),limitations:'Three warmed samples; SQL statistics count top-level statements, including local authentication, not nested internal statements. Legacy old/new page limits differ (15/10). No network throttle or Production volume benchmark.'},null,2),{flag:'wx'})
console.log(JSON.stringify({passed:true,output,summary}))
