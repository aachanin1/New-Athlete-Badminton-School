import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {run,sql,q,fixtures,concurrentSql,holdTransaction,observeLockWait} from '../tests/admin-makeup-2/runtime.mjs'
const root=path.join(run.outputDir,'concurrency-'+Date.now());fs.mkdirSync(root,{recursive:true});const checks=[]
const read=s=>JSON.parse(sql(s)),{sa}=JSON.parse(fs.readFileSync('.playwright/admin-makeup-2/accounts.private.json'))
const previous=sql("SELECT (date_trunc('month',clock_timestamp() AT TIME ZONE 'Asia/Bangkok')-interval '1 month')::date;")
async function race(kind){
 const parent=await fixtures.account('user','AM2 Race '+kind+' '+Date.now()),ref=fixtures.fixture('adult_group',false,parent,previous,'08:00','09:00')
 const current=kind==='reschedule'?fixtures.fixture('adult_group',false,parent,sql("SELECT (clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date+4;"),'08:00','09:00'):fixtures.fixture('adult_group',false,parent),target=fixtures.target(current,false,kind==='booking'?12:13)
 sql(`BEGIN;SET LOCAL task10.payment_write='authorized';UPDATE payments SET verified_at='2026-11-01 09:00:00+07'::timestamptz WHERE booking_id=${q(current.booking)};COMMIT;`)
 const grant=`SELECT admin_makeup_grant_v2(${q(sa.id)},${q(ref.ids[0])},${q(previous)},NULL,${q(target.template)},${q(target.date)},${q(randomUUID())},'ทดสอบแข่งรายการ');`
 let competing
 if(kind==='booking'){
  const price=Number(sql(`SELECT task10_legacy_price_v1(NULL,${q(current.course)},${Number(target.date.slice(5,7))},${Number(target.date.slice(0,4))},1,NULL);`))
  const input={courseTypeId:current.course,branchId:target.branch,learnerType:'self',participants:[null],month:Number(target.date.slice(5,7)),year:Number(target.date.slice(0,4)),totalSessions:1,totalAmount:price,expectedTotalPrice:price,sessions:[{date:target.date,startTime:target.start,endTime:target.end,branchId:target.branch,childId:null,scheduleTemplateId:target.template}]}
  competing=`SELECT task10_write_legacy_booking_v1(${q(parent.id)},'create',${q(randomUUID())},${q(JSON.stringify(input))});`
  assert.ok(read('BEGIN;'+competing+'ROLLBACK;').bookingId)
 }else if(kind==='reschedule'){
  const payload={targetDate:target.date,startTime:target.start,endTime:target.end,branchId:target.branch,templateId:target.template,requestId:randomUUID()}
  competing=`SELECT lesson_source_transition_v1(${q(parent.id)},'reschedule',${q(current.ids[0])},${q(JSON.stringify(payload))});`
  assert.ok(read('BEGIN;'+competing+'ROLLBACK;'))
 }else{
  const stored=read(`SELECT lesson_source_transition_v1(${q(sa.id)},'admin_store',${q(current.ids[0])},${q(JSON.stringify({reason:'ทดสอบเก็บก่อนแข่ง',requestId:randomUUID(),storePolicy:'admin-store-once-v1'}))});`)
  const payload={targetDate:target.date,startTime:target.start,endTime:target.end,branchId:target.branch,templateId:target.template,requestId:randomUUID()}
  competing=`SELECT lesson_source_transition_v1(${q(parent.id)},'redeem',${q(stored.credit_id)},${q(JSON.stringify(payload))});`
  assert.ok(read('BEGIN;'+competing+'ROLLBACK;'))
 }
 assert.equal(read('BEGIN;'+grant+'ROLLBACK;').success,true)
 checks.push(kind+': both operations independently valid before race')
 const results=await Promise.allSettled([concurrentSql(grant),concurrentSql(competing)]),success=results.filter(r=>r.status==='fulfilled'),failure=results.find(r=>r.status==='rejected')
 assert.equal(success.length,1);assert.ok(/OVERLAP|CONFLICT|DUPLICATE_SESSION/.test(failure.reason.message))
 assert.equal(Number(sql(`SELECT count(*) FROM booking_sessions x JOIN bookings b ON b.id=x.booking_id WHERE b.user_id=${q(parent.id)} AND x.date=${q(target.date)} AND x.start_time<${q(target.end)} AND x.end_time>${q(target.start)} AND x.child_id IS NULL AND x.cancelled_at IS NULL AND x.status::text NOT IN ('walleted','rescheduled') AND b.status::text<>'cancelled';`)),1)
 checks.push(kind+': actual simultaneous Admin/User writers produce one active lesson')
 return {kind,winner:results[0].status==='fulfilled'?'admin':'user',failure:failure.reason.message}
}
try{
 const races=[await race('booking'),await race('wallet'),await race('reschedule')]
 const parent=await fixtures.account('user','AM2 Revoke lock'),f=fixtures.fixture('private',true,parent),t=fixtures.target(f,false,18),g=read(`SELECT admin_makeup_grant_v2(${q(sa.id)},${q(f.ids[0])},${q(f.date.slice(0,7)+'-01')},NULL,${q(t.template)},${q(t.date)},${q(randomUUID())},'AM2 revoke lock');`),name='am2-revoke-'+randomUUID(),held=await holdTransaction(`SELECT pg_advisory_xact_lock_shared(hashtextextended(${q('lesson-source-attendance-parent-v2|'+parent.id)},0));`,name+'-held')
 let revoked
 try{const pending=concurrentSql(`SET application_name=${q(name)};SELECT admin_makeup_revoke_v2(${q(sa.id)},${q(g.grantId)},${q(randomUUID())},'AM2 safe cancellation');`);await observeLockWait(name);held.release();await held.done;revoked=JSON.parse(await pending);assert.equal(revoked.revoked,true);checks.push('revoke waits on the shared attendance parent lock before cancelling the complete unit')}finally{if(!revoked){held.release();await held.done.catch(()=>{})}}
 const controls=read("SELECT jsonb_build_object('pricing',(SELECT pricing_enabled FROM task10_policy_activation WHERE singleton),'checkout',(SELECT enabled FROM booking_ux_control WHERE singleton));")
 sql('UPDATE task10_policy_activation SET pricing_enabled=true WHERE singleton;UPDATE booking_ux_control SET enabled=true WHERE singleton;')
 try{
  const p=await fixtures.account('user','AM2 Progressive race');sql('UPDATE booking_ux_control SET enabled=false WHERE singleton;');const kid=fixtures.fixture('kids_group',false,p);sql('UPDATE booking_ux_control SET enabled=true WHERE singleton;');const target=fixtures.target(kid,false,14),sourceMonth=kid.date.slice(0,7)+'-01',year=Number(target.date.slice(0,4)),month=Number(target.date.slice(5,7)),baseline=read(`SELECT to_jsonb(x) FROM progressive_legacy_baseline_v1(${q(p.id)},${q(kid.course)},${year},${month})x;`),policy=read(`SELECT task10_booking_policy_quote_v1(${q(p.id)},${q(kid.course)},${q(sourceMonth)},'progressive',NULL);`)
  const input={courseTypeId:kid.course,branchId:target.branch,learnerType:'child',childId:kid.children[0],totalSessions:1,sessions:[{date:target.date,startTime:target.start,endTime:target.end,branchId:target.branch,childId:kid.children[0],scheduleTemplateId:target.template}],expectedScopeRevision:0,expectedLegacyBaselineSessions:baseline.baseline_sessions,expectedLegacyBaselineFingerprint:baseline.baseline_fingerprint,expectedPolicyFingerprint:policy.fingerprint}
  const admin=`SELECT admin_makeup_grant_v2(${q(sa.id)},${q(kid.ids[0])},${q(sourceMonth)},${q(kid.children[0])},${q(target.template)},${q(target.date)},${q(randomUUID())},'AM2 progressive race');`,user=`SELECT booking_ux_create_v1(${q(p.id)},${q(randomUUID())},${q(JSON.stringify(input))});`
  assert.equal(read('BEGIN;'+admin+'ROLLBACK;').success,true);assert.ok(read('BEGIN;'+user+'ROLLBACK;').bookingId)
  const outcomes=await Promise.allSettled([concurrentSql(admin),concurrentSql(user)]);assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.match(outcomes.find(x=>x.status==='rejected').reason.message,/OVERLAP|DUPLICATE/)
  assert.equal(Number(sql(`SELECT count(*) FROM booking_sessions x JOIN bookings b ON b.id=x.booking_id WHERE b.user_id=${q(p.id)} AND b.status::text<>'cancelled' AND x.child_id=${q(kid.children[0])} AND x.date=${q(target.date)} AND x.cancelled_at IS NULL AND x.status::text NOT IN ('walleted','rescheduled');`)),1);checks.push('actual Progressive Kids checkout and Admin grant race has one active lesson')
 }finally{sql(`UPDATE task10_policy_activation SET pricing_enabled=${controls.pricing} WHERE singleton;UPDATE booking_ux_control SET enabled=${controls.checkout} WHERE singleton;`)}
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify({passed:true,checks,races,runId:run.runId,target:run.target,definitionSha256:createHash('sha256').update(fs.readFileSync(import.meta.filename)).digest('hex')},null,2));console.log(JSON.stringify({root,passed:checks.length}))
}catch(e){fs.writeFileSync(path.join(root,'failure.json'),JSON.stringify({checks,error:e.stack,stderr:e.stderr},null,2));console.error(e.stderr||e);console.error(root);process.exitCode=1}
