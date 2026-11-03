import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {run,sql,q,fixtures} from '../tests/admin-makeup-2/runtime.mjs'
const root=path.join(run.outputDir,'boundaries-'+Date.now());fs.mkdirSync(root,{recursive:true});const checks=[]
const read=s=>JSON.parse(sql(s)),{sa}=JSON.parse(fs.readFileSync('.playwright/admin-makeup-2/accounts.private.json'))
const check=(name,fn)=>{fn();checks.push(name)},rejects=(s,code)=>assert.throws(()=>sql(s),e=>e.stderr?.includes(code))
const coach=await fixtures.account('coach','AM2 Boundary coach'),parent=await fixtures.account('user','AM2 Boundary '+Date.now())
const past=sql("SELECT date_trunc('month',clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date;")
const ctx=f=>read(`SELECT admin_makeup_context_v2(${q(sa.id)},${q(f.ids[0])},${q(f.date.slice(0,7)+'-01')});`)
const absence=f=>sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);${f.ids.map((id,i)=>`UPDATE booking_sessions SET status='absent' WHERE id=${q(id)};INSERT INTO attendance(booking_session_id,student_id,student_type,coach_id,status) VALUES(${q(id)},${q(f.children[i]||parent.id)},${q(f.children[i]?'child':'adult')},${q(coach.id)},'absent');`).join('')}COMMIT;`)
try{
 check('new RPCs not callable by Parent or anon',()=>{assert.equal(Number(sql("SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('admin_makeup_grant_v2','admin_makeup_use_v2','admin_makeup_revoke_v2','admin_makeup_context_v2','admin_makeup_context_state_v2','admin_makeup_workspace_history_v2','admin_makeup_workspace_v2','admin_makeup_busy_v2','admin_makeup_busy_legacy_v2','admin_makeup_catalog_v2') AND (has_function_privilege('anon',oid,'EXECUTE') OR has_function_privilege('authenticated',oid,'EXECUTE'));")),0)})
 check('grant, reason, replay tables private to Admin server',()=>{for(const t of ['admin_makeup_grants_v2','admin_makeup_actions_v2','admin_makeup_requests_v2'])assert.equal(sql(`SELECT has_table_privilege('authenticated','public.${t}','SELECT');`),'f')})
 check('cached hydrator is internal and cannot be called as a service RPC',()=>assert.equal(sql("SELECT has_function_privilege('service_role','admin_makeup_context_state_v2(uuid,uuid,date,jsonb)','EXECUTE');"),'f'))
 for(const course of ['adult_group','private']){
  const f=fixtures.fixture(course,course==='private',parent,past,'08:00','09:00');absence(f);const c=ctx(f),source=c.sources.find(s=>s.kind==='absent'&&(course!=='private'||s.sourceChildId))||c.sources.find(s=>s.kind==='absent')
  check(course+': exact absence is a real source',()=>{assert.ok(source);assert.equal(c.additionalAvailable,false)})
  const target=fixtures.target(f,false,course==='private'?24:23),payload={targetDate:target.date,startTime:target.start,endTime:target.end,branchId:target.branch,templateId:target.template,reason:'ทดสอบขาดเรียนจริง'}
  check(course+': ordinary absence uses old per-learner rule',()=>{const r=read(`SELECT admin_makeup_use_v2(${q(sa.id)},${q(f.ids[0])},${q(f.date.slice(0,7)+'-01')},${q(source.sourceSessionId)},${q(randomUUID())},${q(JSON.stringify(payload))});`);assert.equal(r.success,true);assert.equal(Number(sql(`SELECT count(*) FROM booking_sessions WHERE rescheduled_from_id=${q(source.sourceSessionId)} AND is_makeup;`)),1)})
  if(course==='private')check('Private card and roster history include the selected child absence destination',()=>{assert.ok(ctx(f).destinations.some(d=>d.childId===source.sourceChildId));const h=read(`SELECT admin_makeup_workspace_history_v2(${q(sa.id)},${q(past)},${q(parent.id)},'private',NULL,'all',1,${q(f.ids[0])});`);assert.ok(h.items.some(e=>e.title==='จัดวันชดเชยแล้ว'&&e.source.id===source.sourceSessionId));assert.equal(new Set(h.items.map(e=>e.id)).size,h.items.length)})
 }
 const kid=fixtures.fixture('kids_group',false,parent,past,'10:00','11:00');absence(kid)
 const more=[randomUUID(),randomUUID()]
 sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);${more.map(id=>`INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup) SELECT ${q(id)},booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,'absent',false FROM booking_sessions WHERE id=${q(kid.ids[0])};INSERT INTO attendance(booking_session_id,student_id,student_type,coach_id,status) VALUES(${q(id)},${q(kid.children[0])},'child',${q(coach.id)},'absent');`).join('')}COMMIT;`)
 for(const [i,source] of [kid.ids[0],more[0]].entries()){const t=fixtures.target(kid,false,20+i*2);read(`SELECT admin_consume_family_makeup_v1(${q(sa.id)},${q(source)},${q(kid.children[0])},${q(t.template)},${q(t.branch)},${q(t.date)},${q(t.start)},${q(t.end)},${q(randomUUID())},'ทดสอบโควตา');`)}
 check('quota zero alone never enables addition',()=>{const c=ctx(kid);assert.equal(c.family.remaining,0);assert.ok(c.sources.length>0);assert.equal(c.additionalAvailable,false)})
 sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);UPDATE attendance SET status='present' WHERE booking_session_id=${q(more[1])};UPDATE booking_sessions SET status='completed' WHERE id=${q(more[1])};COMMIT;`)
 check('quota zero and both real sources zero enables addition',()=>{const c=ctx(kid);assert.equal(c.family.remaining,0);assert.equal(c.sources.length,0);assert.equal(c.additionalAvailable,true)})
 const kt=fixtures.target(kid,false,26)
 check('additional grant at exhausted quota leaves normal use count unchanged',()=>{const before=ctx(kid).family;const r=read(`SELECT admin_makeup_grant_v2(${q(sa.id)},${q(kid.ids[0])},${q(past)},${q(kid.children[0])},${q(kt.template)},${q(kt.date)},${q(randomUUID())},'จัดเพิ่มเมื่อไม่มีต้นทาง');`);assert.equal(r.success,true);const after=ctx(kid).family;assert.equal(after.used,before.used);assert.equal(after.remaining,before.remaining)})
 const fresh=fixtures.fixture('private',true,parent),t=fixtures.target(fresh,false,25),req=randomUUID()
 const statement=`SELECT admin_makeup_grant_v2(${q(sa.id)},${q(fresh.ids[0])},${q(fresh.date.slice(0,7)+'-01')},NULL,${q(t.template)},${q(t.date)},${q(req)},'ทดสอบatomic');`
 check('side-effect failure rolls back entire Family grant',()=>{
  rejects(`BEGIN;CREATE FUNCTION pg_temp.am2_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'AM2_TEST_NOTIFICATION_FAILURE';END $$;CREATE TRIGGER am2_fail_notification BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION pg_temp.am2_fail();${statement}COMMIT;`,'AM2_TEST_NOTIFICATION_FAILURE')
  assert.equal(Number(sql(`SELECT count(*) FROM admin_makeup_grants_v2 WHERE request_id=${q(req)};`)),0)
  assert.equal(Number(sql(`SELECT count(*) FROM booking_sessions WHERE booking_id=${q(fresh.booking)} AND is_makeup;`)),0)
 })
 check('unknown request retry can then create one Family grant',()=>assert.equal(read(statement).sessionIds.length,3))
 const r=read(statement),before=sql(`SELECT count(*) FROM admin_makeup_grants_v2 WHERE booking_id=${q(fresh.booking)};`)
 check('one overlapping Family member rejects whole next unit',()=>{rejects(statement.replace(req,randomUUID()),'TASK10_LEARNER_OVERLAP');assert.equal(sql(`SELECT count(*) FROM admin_makeup_grants_v2 WHERE booking_id=${q(fresh.booking)};`),before)})
 check('readonly Parent cannot read internal reason',()=>rejects('BEGIN;SET LOCAL ROLE authenticated;SELECT reason FROM admin_makeup_grants_v2;COMMIT;','permission denied'))
 const busy=read(`SELECT admin_makeup_busy_v2(${q(sa.id)},${q(parent.id)},ARRAY[${q(fresh.children[1])}]::uuid[],${q(t.date.slice(0,7)+'-01')});`)
 check('availability covers actual additional destination',()=>assert.ok(busy.some(x=>x.date===t.date&&x.childId===fresh.children[1])))
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify({passed:true,checks,grant:r,runId:run.runId,target:run.target,definitionSha256:createHash('sha256').update(fs.readFileSync(import.meta.filename)).digest('hex')},null,2));console.log(JSON.stringify({root,passed:checks.length}))
}catch(e){fs.writeFileSync(path.join(root,'failure.json'),JSON.stringify({checks,error:e.stack,stderr:e.stderr},null,2));console.error(e.stderr||e);console.error(root);process.exitCode=1}
