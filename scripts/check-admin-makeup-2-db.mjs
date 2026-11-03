import {sql,q,fixtures,run,concurrentSql} from '../tests/admin-makeup-2/runtime.mjs'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
const root=path.join(run.outputDir,'db-'+Date.now());fs.mkdirSync(root,{recursive:true})
const checks=[];const check=(name,fn)=>{const result=fn();checks.push({name,passed:true});return result}
const read=s=>JSON.parse(sql(s)),{sa}=JSON.parse(fs.readFileSync('.playwright/admin-makeup-2/accounts.private.json'));const parent=await fixtures.account('user','AM2 DB '+Date.now())
const context=f=>read(`SELECT admin_makeup_context_v2(${q(sa.id)},${q(f.ids[0])},${q(f.date.slice(0,7)+'-01')});`)
const rejects=(statement,code)=>assert.throws(()=>sql(statement),e=>e.stderr?.includes(code))
const grant=(f,t,request=randomUUID(),actor=sa.id,child=f.children[0])=>`SELECT admin_makeup_grant_v2(${q(actor)},${q(f.ids[0])},${q(f.date.slice(0,7)+'-01')},${q(child)},${q(t.template)},${q(t.date)},${q(request)},'ทดสอบจัดเพิ่มเติม');`
const financiallyStable=()=>read(`SELECT jsonb_build_object('bookings',(SELECT md5(coalesce(string_agg(to_jsonb(b)::text,'' ORDER BY id),'')) FROM bookings b WHERE user_id=${q(parent.id)}),'payments',(SELECT md5(coalesce(string_agg(to_jsonb(p)::text,'' ORDER BY id),'')) FROM payments p WHERE user_id=${q(parent.id)}),'wallets',(SELECT md5(coalesce(string_agg(to_jsonb(w)::text,'' ORDER BY id),'')) FROM lesson_wallet_credits w WHERE user_id=${q(parent.id)}));`)
try{
 sql('UPDATE admin_makeup_workspace_control SET enabled=true;')
 const all=[]
 for(const course of ['kids_group','adult_group','private']){
  const f=fixtures.fixture(course,course==='private',parent),t=fixtures.target(f,false,8),req=randomUUID(),before=financiallyStable(),ctx=context(f)
  check(course+': zero real sources',()=>assert.equal(ctx.sources.length,0))
  const normalBefore=course==='kids_group'?ctx.family:null
  const result=check(course+': grant creates one complete unit',()=>{const r=read(grant(f,t,req));assert.equal(r.sessionIds.length,course==='private'?3:1);return r})
  check(course+': replay is exact',()=>assert.deepEqual(read(grant(f,t,req)),result))
  check(course+': no money or Wallet change',()=>assert.deepEqual(financiallyStable(),before))
  if(normalBefore)check('Kids ordinary quota unchanged',()=>{const after=context(f).family;assert.equal(after.used,normalBefore.used);assert.equal(after.remaining,normalBefore.remaining);assert.equal(after.sourcePurchase.quantity,normalBefore.sourcePurchase.quantity)})
  check(course+': history contains explicit addition',()=>{const history=read(`SELECT admin_makeup_history_v1(${q(sa.id)},${q(f.date.slice(0,7)+'-01')},${q(parent.id)},${q(course)},NULL,'all',1);`);assert.ok(history.items.some(e=>e.id==='additional:'+result.grantId&&e.source.referenceOnly))})
  check(course+': duplicate target rejected',()=>rejects(grant(f,t),'TASK10_LEARNER_OVERLAP'))
  check(course+': cannot store addition as Wallet',()=>rejects(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);UPDATE booking_sessions SET status='walleted' WHERE id=${q(result.sessionIds[0])};COMMIT;`,'ADMIN_MAKEUP_ADDITION_PROTECTED'))
  check(course+': normal user forbidden',()=>rejects(grant(f,fixtures.target(f,false,9),randomUUID(),parent.id),'TASK10_UNAUTHORIZED'))
  check(course+': fingerprint change forbidden',()=>rejects(grant(f,fixtures.target(f,false,10),req),'TASK10_IDEMPOTENCY_CONFLICT'))
  const revoke=`SELECT admin_makeup_revoke_v2(${q(sa.id)},${q(result.grantId)},${q(randomUUID())},'ทดสอบยกเลิก');`
  check(course+': revoke complete unit without refunds',()=>{assert.equal(read(revoke).revoked,true);assert.equal(Number(sql(`SELECT count(*) FROM booking_sessions WHERE admin_makeup_grant_id=${q(result.grantId)} AND cancelled_at IS NOT NULL;`)),result.sessionIds.length);assert.deepEqual(financiallyStable(),before)})
  check(course+': revoked unit refreshes slot capacity',()=>assert.equal(Number(sql(`SELECT sum(current_students) FROM schedule_slots WHERE id IN (SELECT schedule_slot_id FROM booking_sessions WHERE admin_makeup_grant_id=${q(result.grantId)});`)),0))
  all.push({f,t,result})
 }
 const f=fixtures.fixture('adult_group',false,parent),t=fixtures.target(f,false,11)
 const race=await Promise.allSettled([concurrentSql(grant(f,t)),concurrentSql(grant(f,t))]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);checks.push({name:'two Admin grant race: one winner',passed:true})
 const noPurchase=await fixtures.account('user','AM2 ไม่เคยซื้อ')
 check('cannot claim another account child',()=>rejects(grant(all[0].f,fixtures.target(all[0].f,false,12),randomUUID(),sa.id,noPurchase.id),'TASK10_CHILD_NOT_IN_FAMILY'))
 check('private participants retained exactly',()=>{const p=all[2];const children=read(`SELECT jsonb_agg(child_id ORDER BY child_id NULLS FIRST) FROM booking_sessions WHERE admin_makeup_grant_id=${q(p.result.grantId)};`);assert.deepEqual(children,[...p.f.children].sort((a,b)=>a===null?-1:b===null?1:a.localeCompare(b)))})
 sql("UPDATE admin_makeup_credit_control SET enabled=true,store_once_enabled=true,writer_hash=md5(pg_get_functiondef('public.lesson_source_transition_v1(uuid,text,uuid,jsonb)'::regprocedure));")
 for(const course of ['adult_group','private']){
  const w=fixtures.fixture(course,course==='private',parent),t=fixtures.target(w,false,course==='private'?17:16)
  sql(`BEGIN;SET LOCAL task10.payment_write='authorized';UPDATE payments SET verified_at='2026-11-01 09:00:00+07'::timestamptz WHERE booking_id=${q(w.booking)};COMMIT;`)
  const stored=read(`SELECT lesson_source_transition_v1(${q(sa.id)},'admin_store',${q(w.ids[0])},${q(JSON.stringify({reason:'เก็บทดสอบ',requestId:randomUUID(),storePolicy:'admin-store-once-v1'}))});`)
  check(course+': real Wallet source blocks additional button',()=>{const ctx=context(w);assert.ok(ctx.sources.some(s=>s.creditId===stored.credit_id));assert.equal(ctx.additionalAvailable,false)})
  check(course+': forged direct grant with existing source rejected',()=>rejects(grant(w,t),'TASK10_SOURCE_CONFLICT'))
  const payload={targetDate:t.date,startTime:t.start,endTime:t.end,branchId:t.branch,templateId:t.template,reason:'ใช้กระเป๋าโดยผู้ดูแล'}
  check(course+': Admin uses owner Wallet through existing writer',()=>{const r=read(`SELECT admin_makeup_use_v2(${q(sa.id)},${q(w.ids[0])},${q(w.date.slice(0,7)+'-01')},${q(context(w).sources.find(s=>s.creditId===stored.credit_id).sourceSessionId)},${q(randomUUID())},${q(JSON.stringify(payload))});`);assert.equal(r.success,true);assert.equal(sql(`SELECT status FROM lesson_wallet_credits WHERE id=${q(stored.credit_id)};`),'redeemed')})
 }
 sql('UPDATE admin_makeup_workspace_control SET enabled=false;')
 check('control off disables creation',()=>rejects(grant(f,fixtures.target(f,false,13)),'TASK10_MAKEUP_PAUSED'))
 sql('UPDATE admin_makeup_workspace_control SET enabled=true;')
 const output={passed:true,checks,fixtures:all,runId:run.runId,target:run.target,definitionSha256:createHash('sha256').update(fs.readFileSync(import.meta.filename)).digest('hex')};fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(output,null,2));console.log(JSON.stringify({root,passed:checks.length}))
}catch(e){fs.writeFileSync(path.join(root,'failure.json'),JSON.stringify({checks,error:e.stack,stderr:e.stderr},null,2));console.error(e.stderr||e);console.error(root);process.exitCode=1}
