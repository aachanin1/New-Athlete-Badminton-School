import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {sql,q,fixtures,run} from '../tests/admin-makeup-2/runtime.mjs'

const root=path.join(run.outputDir,'wallet-period-'+Date.now());fs.mkdirSync(root,{recursive:true})
const checks=[],cases=[],read=s=>JSON.parse(sql(s))
const {sa}=JSON.parse(fs.readFileSync('.playwright/admin-makeup-2/accounts.private.json'))
const dates=read("SELECT jsonb_build_object('previous',(date_trunc('month',clock_timestamp() AT TIME ZONE 'Asia/Bangkok')-interval '1 month'+interval '14 days')::date,'current',(date_trunc('month',clock_timestamp() AT TIME ZONE 'Asia/Bangkok')+interval '9 days')::date);")
const context=f=>read(`SELECT admin_makeup_context_v2(${q(sa.id)},${q(f.ids[0])},${q(f.date.slice(0,7)+'-01')});`)
const check=(name,fn)=>{fn();checks.push(name)}
const rejects=(s,code)=>assert.throws(()=>sql(s),e=>e.stderr?.includes(code))
function clone(f,date){
 const template=randomUUID(),slot=randomUUID(),ids=f.children.map(()=>randomUUID())
 sql(`BEGIN;SET LOCAL lesson_source.write='authorized';SET LOCAL task10.source_write='authorized';
 INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(template)},${q(f.branch)},${q(f.course)},extract(dow FROM date ${q(date)}),${q(f.start)},${q(f.end)},true);
 INSERT INTO schedule_slots(id,template_id,branch_id,course_type_id,date,start_time,end_time,status) VALUES(${q(slot)},${q(template)},${q(f.branch)},${q(f.course)},${q(date)},${q(f.start)},${q(f.end)},'open');
 ${ids.map((id,i)=>`INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup) VALUES(${q(id)},${q(f.booking)},${q(slot)},${q(date)},${q(f.start)},${q(f.end)},${q(f.branch)},${q(f.children[i])},'scheduled',false);`).join('')}COMMIT;`)
 return {...f,date,template,slot,ids}
}
function fingerprint(parent){return read(`SELECT jsonb_build_object('booking',(SELECT md5(string_agg(to_jsonb(b)::text,'' ORDER BY id)) FROM bookings b WHERE user_id=${q(parent)}),'payment',(SELECT md5(string_agg(to_jsonb(p)::text,'' ORDER BY id)) FROM payments p WHERE user_id=${q(parent)}),'wallet',(SELECT md5(string_agg(to_jsonb(w)::text,'' ORDER BY id)) FROM lesson_wallet_credits w WHERE user_id=${q(parent)}));`)}
try{
 sql("UPDATE admin_makeup_workspace_control SET enabled=true;UPDATE admin_makeup_credit_control SET enabled=true,store_once_enabled=true,writer_hash=md5(pg_get_functiondef('public.lesson_source_transition_v1(uuid,text,uuid,jsonb)'::regprocedure));")
 for(const kind of ['adult_group','private_child','private_family']){
  const course=kind==='adult_group'?kind:'private',parent=await fixtures.account('user','AM2 Wallet period '+kind+' '+Date.now())
  const original=fixtures.fixture(course,kind==='private_family',parent,dates.previous,'08:00','09:00')
  if(kind==='private_child'){
   const child=randomUUID();sql(`BEGIN;SET LOCAL lesson_source.write='authorized';SET LOCAL task10.source_write='authorized';INSERT INTO children(id,parent_id,full_name) VALUES(${q(child)},${q(parent.id)},'นักเรียนทดสอบกระเป๋าข้ามเดือน');UPDATE booking_sessions SET child_id=${q(child)} WHERE id=${q(original.ids[0])};COMMIT;`);original.children=[child]
  }
  sql(`BEGIN;SET LOCAL task10.booking_write='authorized';SET LOCAL task10.payment_write='authorized';
  INSERT INTO pricing_tiers(course_type_id,min_sessions,max_sessions,price_per_session,package_price,valid_from,valid_to)
   SELECT ${q(original.course)},10,10,500,5000,date_trunc('month',date ${q(dates.previous)})::date,(date_trunc('month',date ${q(dates.previous)})+interval '1 month'-interval '1 day')::date
   WHERE NOT EXISTS(SELECT 1 FROM pricing_tiers WHERE course_type_id=${q(original.course)} AND min_sessions=10 AND valid_from<=date ${q(dates.previous)} AND (valid_to IS NULL OR valid_to>=date ${q(dates.previous)}));
  UPDATE bookings SET total_sessions=10 WHERE id=${q(original.booking)};UPDATE payments SET verified_at=(date_trunc('month',date ${q(dates.previous)})+interval '9 hours') AT TIME ZONE 'Asia/Bangkok' WHERE booking_id=${q(original.booking)};COMMIT;`)
  const second=clone(original,sql(`SELECT (date ${q(dates.previous)}+1)::date;`)),reference=clone(original,dates.current)
  const stored=[original,second].map(f=>read(`SELECT lesson_source_transition_v1(${q(sa.id)},'admin_store',${q(f.ids[0])},${q(JSON.stringify({reason:'ทดสอบสิทธิ์ข้ามเดือน',requestId:randomUUID(),storePolicy:'admin-store-once-v1'}))});`))
  const inventory=read(`SELECT jsonb_build_object('count',count(*),'hours',sum(extract(epoch FROM original_end_time-original_start_time)/3600),'valid',bool_and(expires_at>clock_timestamp())) FROM lesson_wallet_credits WHERE user_id=${q(parent.id)} AND status='active' AND redeemed_session_id IS NULL;`)
  assert.equal(inventory.count,2);assert.equal(inventory.hours,2);assert.equal(inventory.valid,true)
  cases.push({kind,parent,original,second,reference,stored,inventory})
 }
 fs.writeFileSync(path.join(root,'fixtures.private.json'),JSON.stringify(cases,null,2))
 // Inventory is derived directly from actual stored credits, never from context_v2.
 const observed=cases.map(c=>({kind:c.kind,inventory:c.inventory,context:context(c.reference)}))
 fs.writeFileSync(path.join(root,'before-assertions.json'),JSON.stringify(observed,null,2))
 for(const c of cases){
  const before=fingerprint(c.parent.id),ctx=context(c.reference),month=c.reference.date.slice(0,7)+'-01'
  check(c.kind+': two earlier-month valid Wallet credits visible',()=>assert.equal(ctx.sources.filter(s=>s.kind==='wallet').length,2))
  check(c.kind+': additional grant unavailable with unspent Wallet',()=>assert.equal(ctx.additionalAvailable,false))
  const hydrated=read(`SELECT admin_makeup_context_state_v2(${q(sa.id)},${q(c.reference.ids[0])},${q(month)},NULL);`)
  check(c.kind+': hydration and authoritative details agree',()=>assert.deepEqual(hydrated.sources,ctx.sources))
  const browse=read(`SELECT admin_makeup_workspace_v2(${q(sa.id)},${q(month)},${q(c.original.courseName)},${q(c.parent.id)},NULL,'all',1);`)
  const byName=read(`SELECT admin_makeup_workspace_v2(${q(sa.id)},${q(month)},${q(c.original.courseName)},(SELECT full_name FROM profiles WHERE id=${q(c.parent.id)}),NULL,'all',1);`)
  check(c.kind+': actual card shows the same Wallet and hides grant',()=>{assert.equal(byName.total,1);assert.equal(byName.cards[0].sources.filter(s=>s.kind==='wallet').length,2);assert.equal(byName.cards[0].additionalAvailable,false);assert.ok(Array.isArray(browse.cards))})
  if(c.original.courseName==='private'){
   const otherChild=randomUUID();sql(`INSERT INTO children(id,parent_id,full_name) VALUES(${q(otherChild)},${q(c.parent.id)},'สมาชิกคนละหน่วยทดสอบ');`)
   const other=clone({...c.original,children:[otherChild]},sql(`SELECT (date ${q(c.reference.date)}+1)::date;`))
   check(c.kind+': earlier-month Wallet never leaks to another roster',()=>assert.equal(context(other).sources.filter(s=>s.kind==='wallet').length,0))
   check(c.kind+': forged Wallet use for another roster is rejected',()=>rejects(`SELECT admin_makeup_use_v2(${q(sa.id)},${q(other.ids[0])},${q(month)},${q(c.original.ids[0])},${q(randomUUID())},'{"reason":"ทดสอบห้ามสลับหน่วย"}');`,'TASK10_SOURCE_CONFLICT'))
  }
  const target=fixtures.target(c.reference,false,5)
  check(c.kind+': forged additional grant rejected by server',()=>rejects(`SELECT admin_makeup_grant_v2(${q(sa.id)},${q(c.reference.ids[0])},${q(month)},${q(c.reference.children[0])},${q(target.template)},${q(target.date)},${q(randomUUID())},'ทดสอบห้ามข้ามกระเป๋า');`,'TASK10_SOURCE_CONFLICT'))
  check(c.kind+': read and rejected grant do not alter money/credits',()=>assert.deepEqual(fingerprint(c.parent.id),before))
  const source=ctx.sources.find(s=>s.creditId===c.stored[0].credit_id)
  const payload={targetDate:target.date,startTime:target.start,endTime:target.end,branchId:target.branch,templateId:target.template,reason:'ทดสอบใช้กระเป๋าเดิมข้ามเดือน'}
  check(c.kind+': old-month credit redeems through unchanged writer',()=>{const result=read(`SELECT admin_makeup_use_v2(${q(sa.id)},${q(c.reference.ids[0])},${q(month)},${q(source.sourceSessionId)},${q(randomUUID())},${q(JSON.stringify(payload))});`);assert.equal(result.success,true);assert.equal(sql(`SELECT status FROM lesson_wallet_credits WHERE id=${q(source.creditId)};`),'redeemed')})
  check(c.kind+': one remaining credit still blocks grant',()=>{const after=context(c.reference);assert.equal(after.sources.filter(s=>s.kind==='wallet').length,1);assert.equal(after.additionalAvailable,false)})
  check(c.kind+': expired remaining credit is excluded without revival',()=>{sql(`BEGIN;SET LOCAL lesson_source.write='authorized';SET LOCAL task10.source_write='authorized';UPDATE lesson_wallet_credits SET expires_at=clock_timestamp()-interval '1 second' WHERE id=${q(c.stored[1].credit_id)};COMMIT;`);const after=context(c.reference);assert.equal(after.sources.filter(s=>s.kind==='wallet').length,0);assert.equal(after.additionalAvailable,true)})
 }
 const result={passed:true,checks,runId:run.runId,target:run.target,definitionSha256:createHash('sha256').update(fs.readFileSync(import.meta.filename)).digest('hex')}
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({root,passed:checks.length}))
}catch(e){fs.writeFileSync(path.join(root,'failure.json'),JSON.stringify({checks,error:e.stack,stderr:e.stderr},null,2));console.error(root);console.error(e.stderr||e);process.exitCode=1}
