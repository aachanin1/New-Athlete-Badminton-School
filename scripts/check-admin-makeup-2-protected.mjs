// Reuse released checkout acceptance definitions against this task's owned DB.
import fs from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {randomUUID,createHash} from 'node:crypto'
import {run,sql,q,db,fixtures} from '../tests/admin-makeup-2/runtime.mjs'
const root=path.join(run.outputDir,'protected-'+Date.now());fs.mkdirSync(root,{recursive:true})
const before=JSON.parse(sql("SELECT jsonb_build_object('policy',(SELECT to_jsonb(p) FROM task10_policy_activation p),'checkout',(SELECT enabled FROM booking_ux_control));"))
const courses=JSON.parse(sql('SELECT jsonb_object_agg(name,id) FROM course_types;')),{sa}=JSON.parse(fs.readFileSync('.playwright/admin-makeup-2/accounts.private.json'))
const parent=await fixtures.account('user','AM2 Protected parent'),other=await fixtures.account('user','AM2 Protected other'),branch=randomUUID(),children=[randomUUID(),randomUUID()],templates=[]
sql(`INSERT INTO branches(id,name,slug) VALUES(${q(branch)},'AM2 Protected',${q('am2-protected-'+branch)});${children.map(id=>`INSERT INTO children(id,parent_id,full_name) VALUES(${q(id)},${q(parent.id)},'AM2 Protected child');`).join('')}`)
const tierStatements=[]
for(const [name,tiers] of Object.entries({kids_group:[[1,1,700,700],[2,6,625,2500],[7,10,500,4000],[11,14,433,5200],[15,18,406,6500],[19,null,350,7000]],adult_group:[[1,1,600,600],[10,10,550,5500],[16,16,500,8000]],private:[[1,1,900,900],[10,10,800,8000]]}))for(const [min,max,unit,price] of tiers)tierStatements.push(`INSERT INTO pricing_tiers(course_type_id,min_sessions,max_sessions,price_per_session,package_price,valid_from) VALUES(${q(courses[name])},${min},${max??'NULL'},${unit},${price},(clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date);`)
for(const [course,cid] of Object.entries(courses))for(let day=0;day<7;day++)for(const [start,end] of [['10:00','11:00'],['17:00','18:00']]){const id=randomUUID();templates.push({id,course,day,start,end});sql(`INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(id)},${q(branch)},${q(cid)},${day},${q(start)},${q(end)},true);`)}
sql(`BEGIN;SELECT pg_advisory_xact_lock(10,1);UPDATE task10_policy_activation SET state='never_activated',effective_at=NULL,pricing_enabled=false,makeup_enabled=false,expiry_enabled=false;${tierStatements.join('')}SELECT task10_bootstrap_catalogs_v1();UPDATE task10_policy_activation SET state='active',effective_at=clock_timestamp()-interval '1 day',pricing_enabled=true,makeup_enabled=true,expiry_enabled=true;UPDATE booking_ux_control SET enabled=true;COMMIT;`)
fs.writeFileSync(path.join(run.evidenceRoot,'protected-fixture.private.json'),JSON.stringify({sa,parent,other,branch,children,courses,templates},null,2))
const checks=[]
try{
 const bucket=await db.storage.getBucket('payment-slips');if(bucket.error){if(bucket.error.status!==404&&bucket.error.status!==400)throw bucket.error;const created=await db.storage.createBucket('payment-slips',{public:false});if(created.error)throw created.error}
 for(const label of ['contracts','2-coupons','2-participants-legacy']){
  const original=path.join('scripts',label==='contracts'?'check-booking-ux-contracts.mjs':'check-booking-ux'+label+'.mjs'),source=fs.readFileSync(original,'utf8')
  let body=source.replaceAll('../tests/booking-ux/runtime.mjs',pathToFileURL(path.resolve('tests/admin-makeup-2/runtime.mjs')).href).replaceAll("run.evidenceRoot+'/fixture.json'","run.evidenceRoot+'/protected-fixture.private.json'")
  body=body.replace(/const root=[^\n]+/,`const root=${JSON.stringify(path.join(root,label))};fs.mkdirSync(root,{recursive:true})`)
  const file=path.join(root,label+'.mjs');fs.writeFileSync(file,body);const log=fs.openSync(path.join(root,label+'.log'),'wx')
  try{execFileSync(process.execPath,[file],{stdio:['ignore',log,log],windowsHide:true,timeout:240000})}finally{fs.closeSync(log)}
  checks.push({label,original,originalSha256:createHash('sha256').update(source).digest('hex'),executedSha256:createHash('sha256').update(body).digest('hex')});console.log('passed protected '+label)
 }
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify({passed:true,checks,runId:run.runId},null,2));console.log(JSON.stringify({root,passed:checks.length}))
}catch(e){fs.writeFileSync(path.join(root,'failure.json'),JSON.stringify({checks,error:e.message},null,2));console.error(root);throw e}
finally{sql(`BEGIN;SELECT pg_advisory_xact_lock(10,1);UPDATE task10_policy_activation SET state=${q(before.policy.state)},effective_at=${q(before.policy.effective_at)},pricing_enabled=${before.policy.pricing_enabled},makeup_enabled=${before.policy.makeup_enabled},expiry_enabled=${before.policy.expiry_enabled};UPDATE booking_ux_control SET enabled=${before.checkout};COMMIT;`)}
