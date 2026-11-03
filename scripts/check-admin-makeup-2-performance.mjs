import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {sql,q,fixtures,run} from '../tests/admin-makeup-2/runtime.mjs'
const seedFile=path.join(run.evidenceRoot,'performance-fixture.private.json'),root=path.join(run.outputDir,'performance-'+Date.now());fs.mkdirSync(root,{recursive:true})
const {sa}=JSON.parse(fs.readFileSync('.playwright/admin-makeup-2/accounts.private.json'))
try{
 let seed
 if(fs.existsSync(seedFile))seed=JSON.parse(fs.readFileSync(seedFile))
 else{
  const coach=await fixtures.account('coach','AM2 Perf coach'),people=[]
  for(let i=0;i<100;i+=10){const batch=await Promise.all(Array.from({length:10},(_,n)=>fixtures.account('user','AM2 Perf '+(i+n<10?'Small ':'Large ')+(i+n))));people.push(...batch);console.log('synthetic families '+people.length)}
  const date=sql("SELECT (date_trunc('month',clock_timestamp() AT TIME ZONE 'Asia/Bangkok'))::date;")
  const cases=people.map(p=>fixtures.fixture('kids_group',false,p,date,'09:00','11:00'))
  sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);${cases.map(f=>`UPDATE booking_sessions SET status='absent' WHERE id=${q(f.ids[0])};INSERT INTO attendance(booking_session_id,student_id,student_type,coach_id,status) VALUES(${q(f.ids[0])},${q(f.children[0])},'child',${q(coach.id)},'absent');`).join('')}COMMIT;`)
  seed={people,cases,date};fs.writeFileSync(seedFile,JSON.stringify(seed,null,2))
 }
 const results=[]
 for(const [size,search] of [[10,'AM2 Perf Small'],[100,'AM2 Perf ']]){
  for(const status of ['all','actionable','makeup','expired'])for(const fn of ['admin_makeup_browse_v1','admin_makeup_workspace_v2']){
   const call=`public.${fn}(${q(sa.id)},${q(seed.date)},'kids_group',${q(search)},NULL,${q(status)},1)`
   const data=JSON.parse(sql(`CREATE TEMP TABLE am2_perf(samples jsonb);DO $$ DECLARE times numeric[]:='{}';start_at timestamptz;j jsonb;BEGIN FOR i IN 1..31 LOOP start_at:=clock_timestamp();j:=${call};times:=array_append(times,extract(epoch FROM clock_timestamp()-start_at)*1000);END LOOP;INSERT INTO am2_perf VALUES(jsonb_build_object('times',times,'total',j->'total'));END $$;SELECT samples FROM am2_perf;`))
   assert.equal(Number(data.total),status==='all'||status==='actionable'?size:0);const warm=data.times.slice(1).map(Number).sort((a,b)=>a-b)
   results.push({size,status,fn,coldMs:Number(data.times[0]),medianMs:warm[15],p95Ms:warm[28],samples:data.times});fs.writeFileSync(path.join(root,'samples.json'),JSON.stringify(results,null,2))
  }
 }
 const noiseBandMs=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'baseline-performance.json'))).noiseBandMs
 for(const size of [10,100])for(const status of ['all','actionable','makeup','expired']){const old=results.find(r=>r.size===size&&r.status===status&&r.fn==='admin_makeup_browse_v1'),current=results.find(r=>r.size===size&&r.status===status&&r.fn==='admin_makeup_workspace_v2');assert.ok(current.medianMs<=old.medianMs+noiseBandMs,'median regression '+size+' '+status+' '+current.medianMs+' > '+old.medianMs+' + '+noiseBandMs);assert.ok(current.p95Ms<=old.p95Ms+noiseBandMs,'p95 regression '+size+' '+status+' '+current.p95Ms+' > '+old.p95Ms+' + '+noiseBandMs)}
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify({passed:true,results,noiseBandMs,definition:'31 actual DB executions per flow/dataset: cold first and 30 warm; same 10/100 eligible source families. Existing browse excludes additions but cohort contains no additions. HTTP/browser comparison is separate.'},null,2));console.log(JSON.stringify({root,results:results.map(({samples,...rest})=>rest)}))
}catch(e){fs.writeFileSync(path.join(root,'failure.json'),JSON.stringify({error:e.stack},null,2));console.error(e);console.error(root);process.exitCode=1}
