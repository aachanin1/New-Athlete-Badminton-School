import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {run,sql,q,fixtures} from '../tests/admin-makeup-browse/runtime.mjs'
const root=path.join(run.outputDir,'v8'),base=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json'))),checks=[]
const check=(v,name)=>{assert.ok(v,name);checks.push(name);console.log(name)}
const reject=(fn,re,name)=>{assert.throws(fn,re);checks.push(name);console.log(name)}
const state=(parent,month)=>JSON.parse(sql(`SELECT task10_family_makeup_state_v1(${q(base.admin.id)},${q(parent)},${q(month+'-01')});`))
const transition=(actor,op,id,payload={})=>JSON.parse(sql(`SELECT lesson_source_transition_v1(${q(actor)},${q(op)},${q(id)},${q(JSON.stringify(payload))}::jsonb);`))
const exhausted=JSON.parse(sql("SELECT row_to_json(x) FROM (SELECT w.id AS credit,w.original_session_id AS source,w.user_id AS parent,s.booking_id,s.child_id,s.branch_id,b.course_type_id,to_char(s.date,'YYYY-MM') AS month FROM lesson_wallet_credits w JOIN booking_sessions s ON s.id=w.original_session_id JOIN bookings b ON b.id=s.booking_id JOIN profiles p ON p.id=w.user_id WHERE p.full_name LIKE 'โควตาเต็ม%' AND NOT EXISTS(SELECT 1 FROM admin_makeup_credit_approvals g WHERE g.credit_id=w.id) ORDER BY w.stored_at DESC LIMIT 1) x;"))
assert.ok(exhausted)
const old=state(exhausted.parent,exhausted.month)
check(old.quota===2&&old.used===2&&old.remaining===0,'Observed real Q2/used2 Admin-stored fixture starts exhausted')
const approval=JSON.parse(sql(`SELECT admin_makeup_credit_decide_v1(${q(base.admin.id)},${q(exhausted.credit)},'approve','เหตุจำเป็นเฉพาะเครดิต',${q(randomUUID())},false);`));check(approval.confirmed,'Admin explicitly approves the exhausted normal-quota credit')
const template=randomUUID(),date=sql(`SELECT (date ${q(exhausted.month+'-01')}+interval '1 month 8 days')::date;`)
sql(`INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(template)},${q(exhausted.branch_id)},${q(exhausted.course_type_id)},extract(dow FROM date ${q(date)}),'14:00','15:00',true);`)
const payload={attendingChildId:exhausted.child_id,targetDate:date,startTime:'14:00',endTime:'15:00',branchId:exhausted.branch_id,templateId:template,requestId:randomUUID(),reason:'จัดวันตามสิทธิ์เดิม'}
const result=transition(base.admin.id,'makeup',exhausted.source,payload),after=state(exhausted.parent,exhausted.month)
check(result.useMode==='exception'&&after.quota===2&&after.used===3&&after.remaining===0&&after.exceptionUsed===1,'Q2 plus one exceptional use shows actual used3/exception1/remaining0')
sql(`BEGIN;SELECT set_config('task10.booking_write','authorized',true);SELECT set_config('task10.payment_write','authorized',true);UPDATE bookings SET total_sessions=12 WHERE id=${q(exhausted.booking_id)};COMMIT;`)
const bought=state(exhausted.parent,exhausted.month)
check(bought.quota===3&&bought.used===3&&bought.remaining===0,'Later verified quantity increasing Q does not grant a second benefit for past exceptional use')
const within=sql("SELECT ((clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date+4);"),kidOwner=await fixtures.account('user','ตรวจพี่น้องเครดิตแปด'),kid=fixtures.fixture('kids_group',false,kidOwner,within,'16:00','17:00'),sibling=randomUUID()
sql(`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(sibling)},${q(kidOwner.id)},'พี่น้องคนที่สอง','น้องอีกคน');BEGIN;SELECT set_config('task10.booking_write','authorized',true);SELECT set_config('task10.payment_write','authorized',true);UPDATE bookings SET total_sessions=3 WHERE id=${q(kid.booking)};COMMIT;`)
const stored=transition(base.admin.id,'admin_store',kid.ids[0],{requestId:randomUUID(),reason:'ต้นทางครอบครัว',approveCredit:true}),kidTarget=fixtures.target(kid,true)
const otherSource=randomUUID(),otherTemplate=randomUUID(),otherSlot=randomUUID()
sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);
 INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(otherTemplate)},${q(kid.branch)},${q(kid.course)},extract(dow FROM date ${q(within)}),'18:00','19:00',true);
 INSERT INTO schedule_slots(id,template_id,branch_id,course_type_id,date,start_time,end_time,status) VALUES(${q(otherSlot)},${q(otherTemplate)},${q(kid.branch)},${q(kid.course)},${q(within)},'18:00','19:00','open');
 INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup) VALUES(${q(otherSource)},${q(kid.booking)},${q(otherSlot)},${q(within)},'18:00','19:00',${q(kid.branch)},${q(kid.children[0])},'scheduled',false);COMMIT;`)
transition(base.admin.id,'admin_store',otherSource,{requestId:randomUUID(),reason:'เครดิตอื่นที่ยังไม่ยืนยัน'})
reject(()=>transition(base.admin.id,'makeup',otherSource,{attendingChildId:sibling,targetDate:kidTarget.date,startTime:kidTarget.start,endTime:kidTarget.end,branchId:kidTarget.branch,templateId:kidTarget.template,requestId:randomUUID(),reason:'ห้ามนำการยืนยันเครดิตอื่นมาใช้'}),/APPROVAL_REQUIRED/,'A family-level eligible result cannot apply one credit approval to another unapproved source')
const used=transition(base.admin.id,'makeup',kid.ids[0],{attendingChildId:sibling,targetDate:kidTarget.date,startTime:kidTarget.start,endTime:kidTarget.end,branchId:kidTarget.branch,templateId:kidTarget.template,requestId:randomUUID(),reason:'จัดให้พี่น้องในครอบครัวเดิม'})
check(sql(`SELECT source_child_id=${q(kid.children[0])}::uuid AND attending_child_id=${q(sibling)}::uuid FROM task10_family_makeup_uses WHERE destination_session_id=${q(used.data.id)};`)==='t','Sibling attendance preserves distinct original-source and attending-child identities')
const sameMonth=fixtures.target(kid,false,2)
reject(()=>transition(kidOwner.id,'redeem',stored.credit_id,{targetDate:sameMonth.date,startTime:sameMonth.start,endTime:sameMonth.end,branchId:sameMonth.branch,templateId:sameMonth.template}),/ALREADY_USED|CONFLICT|CREDIT_STALE/,'Parent cannot redeem a Wallet source already consumed by exceptional Makeup')
const familyOwner=await fixtures.account('user','ตรวจPrivateครบหน่วย'),family=fixtures.fixture('private',true,familyOwner,within,'16:00','17:00')
const financial=()=>sql("SELECT jsonb_build_object('payments',(SELECT md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'[]')) FROM payments x),'coupons',(SELECT md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY id)::text,'[]')) FROM coupon_usages x))::text;")
const beforeFinance=financial(),wallet=transition(familyOwner.id,'store',family.ids[0]),destination=fixtures.target(family,false,1)
const redeemed=transition(familyOwner.id,'redeem',wallet.credit_id,{targetDate:destination.date,startTime:destination.start,endTime:destination.end,branchId:destination.branch,templateId:destination.template})
check(wallet.participant_count===3&&redeemed.session_ids.length===3,'Family Private Store/Redeem moves all three participants as one entitlement')
check(sql(`SELECT count(DISTINCT child_id) FROM booking_sessions WHERE id IN (${redeemed.session_ids.map(q).join(',')});`)==='2'&&financial()===beforeFinance,'Family Private retains self/child identities and creates no payment or coupon side effects')
const gatedOwner=await fixtures.account('user','ตรวจปิดเฉพาะข้อยกเว้น'),gated=fixtures.fixture('kids_group',false,gatedOwner,within,'16:00','17:00')
const gatedStore=transition(base.admin.id,'admin_store',gated.ids[0],{requestId:randomUUID(),reason:'เก็บจริง',approveCredit:true})
sql("BEGIN;SELECT pg_advisory_xact_lock(10,1);SELECT pg_advisory_xact_lock(10,2);UPDATE admin_makeup_credit_control SET enabled=false;COMMIT;")
try{
 const s=state(gatedOwner.id,within.slice(0,7));check(s.creditApprovalsEnabled===false&&s.approvedSources===0,'Exception control disables fallback eligibility without removing evidence')
 const d=fixtures.target(gated,true),normal=transition(base.admin.id,'makeup',gated.ids[0],{attendingChildId:gated.children[0],targetDate:d.date,startTime:d.start,endTime:d.end,branchId:d.branch,templateId:d.template,requestId:randomUUID(),reason:'ใช้โควตาปกติขณะปิดข้อยกเว้น'})
 check(normal.useMode==='normal','Disabling exceptions leaves ordinary quota consumption available')
 const request=randomUUID();reject(()=>sql(`SELECT admin_makeup_credit_decide_v1(${q(base.admin.id)},${q(gatedStore.credit_id)},'approve','ไม่ให้เปิดเพิ่ม',${q(request)},false);`),/APPROVAL_DISABLED/,'Disabled control rejects fresh exception approvals')
}finally{sql("BEGIN;SELECT pg_advisory_xact_lock(10,1);SELECT pg_advisory_xact_lock(10,2);UPDATE admin_makeup_credit_control SET enabled=true;COMMIT;")}
for(const role of ['anon','authenticated'])reject(()=>sql(`SET ROLE ${role};SELECT * FROM admin_makeup_credit_control;`),/permission denied/,role+' cannot read or toggle private exception controls')
fs.writeFileSync(path.join(root,'protected-'+Date.now()+'.json'),JSON.stringify({passed:true,checks,runId:run.runId},null,2),{flag:'wx'});console.log(JSON.stringify({passed:checks.length}))
