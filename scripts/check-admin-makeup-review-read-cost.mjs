import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {run,sql} from '../tests/admin-makeup-review/runtime.mjs'
import {adminBrowser,fixture as f} from '../tests/admin-makeup-review/browser.mjs'
const snapshot=()=>JSON.parse(sql("SELECT coalesce(jsonb_object_agg(queryid::text,jsonb_build_object('calls',calls,'query',query)),'{}') FROM pg_stat_statements WHERE query ILIKE '%pgrst_source%' AND query NOT ILIKE '%pg_stat_statements%'"))
const results=[]
for(const [label,base]of [['baseline','http://127.0.0.1:3144'],['candidate','http://127.0.0.1:3145']]){
 const {browser,context}=await adminBrowser(base)
 try{
  const url=base+'/api/admin/makeup/queue?'+new URLSearchParams({month:f.month,search:'ตรวจต่อเนื่อง',pageSize:'25'})
  assert.equal((await context.request.get(url)).status(),200)
  const before=snapshot(),response=await context.request.get(url);assert.equal(response.status(),200);await response.body();const after=snapshot()
  const queries=Object.entries(after).map(([id,r])=>({query:r.query,calls:r.calls-(before[id]?.calls||0)})).filter(r=>r.calls>0)
  results.push({label,postgrestStatements:queries.reduce((n,r)=>n+r.calls,0),queries})
 }finally{await browser.close()}
}
assert.equal(results[1].queries.filter(q=>q.query.includes('admin_makeup_review_page_v1')).reduce((n,r)=>n+r.calls,0),1)
assert.ok(results[1].postgrestStatements<results[0].postgrestStatements)
const result={runId:run.runId,results,scope:'Real warm queue request on the same owned Local DB. pg_stat_statements track=top counts top-level PostgREST data statements including role/menu checks, not SQL inside stored functions, auth HTTP, transaction setup, or a database-load certification.'}
const file=path.join(run.outputDir,'read-cost-'+Date.now()+'.json');fs.writeFileSync(file,JSON.stringify(result,null,2));fs.writeFileSync(path.join(run.evidenceRoot,'read-cost-result.json'),JSON.stringify({...result,file},null,2));console.log(JSON.stringify({counts:results.map(r=>({label:r.label,calls:r.postgrestStatements})),file}))
