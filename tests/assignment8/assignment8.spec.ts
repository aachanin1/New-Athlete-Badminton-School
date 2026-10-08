import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { createServerClient } from '@supabase/ssr'
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createLocalAdmin, getLocalSupabaseEnv } from '../booking-regression/local-supabase'
import { localSql, concurrentLocalSql, sqlLiteral as q } from '../task10-regression/local-supabase'
import { verifyLessonSourceTarget, lessonSourceRun } from '../../scripts/verify-lesson-source-test-target.mjs'
import { getCoachAssignmentHistory } from '../../src/lib/coach-assignment-history'
import { getAssignmentCoverage } from '../../src/lib/coach-assignment-lifecycle'

type Account={id:string;email:string}
type Fixture={booking:string;branch:string;slot:string;template:string;course:string;ids:string[];children:(string|null)[];date:string}
const password='Assignment8Local!2026', db=()=>createLocalAdmin()
let owner:Account,coach:Account,otherCoach:Account,head:Account,admin:Account,superAdmin:Account
const contexts:APIRequestContext[]=[]
let fixtureDay=8
const forward=()=>localSql(readFileSync('supabase/migrations/20261007073831_assignment_wallet_history_notifications.sql','utf8'))
const rollback=()=>localSql(readFileSync('supabase/rollbacks/assignment8.sql','utf8'))
async function account(role:string,label:string):Promise<Account>{
  const email=`assignment8-${randomUUID()}@example.com`,r=await db().auth.admin.createUser({email,password,email_confirm:true})
  expect(r.error).toBeNull();const id=r.data.user!.id
  expect((await db().from('profiles').update({role,full_name:label}).eq('id',id)).error).toBeNull()
  return{id,email}
}
function seed(courseName='kids_group',count=1,dateOverride?:string):Fixture{
  verifyLessonSourceTarget();const [booking,branch,slot,template]=Array.from({length:4},()=>randomUUID())
  const course=localSql(`SELECT id FROM course_types WHERE name=${q(courseName)};`),date=dateOverride||new Date(Date.UTC(2031,9,++fixtureDay)).toISOString().slice(0,10)
  const children=Array.from({length:count},(_,i)=>courseName==='adult_group'||(courseName==='private'&&i===0)?null:randomUUID())
  const ids=children.map(()=>randomUUID())
  localSql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);SELECT set_config('task10.payment_write','authorized',true);
    INSERT INTO branches(id,name,slug) VALUES(${q(branch)},'สาขาทดสอบข้อ8',${q('a8-'+branch)});
    INSERT INTO coach_branches(coach_id,branch_id) VALUES(${q(head.id)},${q(branch)}),(${q(coach.id)},${q(branch)}),(${q(otherCoach.id)},${q(branch)});
    ${children.filter(Boolean).map(id=>`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(id!)},${q(owner.id)},${q('เด็ก '+id!.slice(0,6))},${q('เด็ก '+id!.slice(0,6))});`).join('\n')}
    INSERT INTO bookings(id,user_id,learner_type,child_id,branch_id,course_type_id,month,year,total_sessions,total_price,status)
      VALUES(${q(booking)},${q(owner.id)},${q(courseName==='kids_group'?'child':'self')},${courseName==='kids_group'?q(children[0]!):'NULL'},${q(branch)},${q(course)},${Number(date.slice(5,7))},${date.slice(0,4)},1,500,'verified');
    INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(template)},${q(branch)},${q(course)},extract(dow FROM date '${date}'),'15:00','16:00',true);
    INSERT INTO schedule_slots(id,template_id,branch_id,course_type_id,date,start_time,end_time,status) VALUES(${q(slot)},${q(template)},${q(branch)},${q(course)},'${date}','15:00','16:00','open');
    ${ids.map((id,i)=>`INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup) VALUES(${q(id)},${q(booking)},${q(slot)},'${date}','15:00','16:00',${q(branch)},${children[i]?q(children[i]!):'NULL'},'scheduled',false);`).join('\n')}
    ${courseName==='kids_group'?'':`INSERT INTO payments(booking_id,user_id,amount,status,verified_at) VALUES(${q(booking)},${q(owner.id)},500,'approved',clock_timestamp());
      INSERT INTO pricing_tiers(course_type_id,min_sessions,max_sessions,price_per_session,package_price,valid_from) SELECT ${q(course)},1,1,500,500,'2020-01-01' WHERE NOT EXISTS(SELECT 1 FROM pricing_tiers WHERE course_type_id=${q(course)});`}
    COMMIT;`)
  return{booking,branch,slot,template,course,ids,children,date}
}
function groups(f:Fixture,coaches:(string|null)[]=[coach.id]){
 return coaches.map((id,i)=>({name:`กลุ่มทดสอบ ${i+1}`,coachId:id,levelMin:0,levelMax:0,sortOrder:i,studentSessionIds:coaches.length===1?f.ids:[f.ids[i]]}))
}
const snapshot=(f:Fixture)=>JSON.parse(localSql(`SELECT coach_assignment_slot_snapshot_v2(${q(f.slot)})->'groups';`))
async function assign(f:Fixture,payload=groups(f),expected=snapshot(f)){
 const r=await db().rpc('save_coach_assignment_groups_v3',{p_schedule_slot_id:f.slot,p_actor_id:superAdmin.id,p_groups:payload,p_expected_groups:expected});expect(r.error).toBeNull();return r.data
}
async function store(f:Fixture,id=f.ids[0]){
 const r=await db().rpc('lesson_source_transition_v1',{p_actor_id:owner.id,p_operation:'store',p_id:id,p_payload:{}});expect(r.error).toBeNull();return r.data as {credit_id:string;expires_at:string}
}
const notices=(credit:string)=>JSON.parse(localSql(`SELECT coalesce(jsonb_agg(to_jsonb(n) ORDER BY user_id),'[]') FROM notifications n WHERE created_at=(SELECT created_at FROM lesson_wallet_credits WHERE id=${q(credit)}) AND title='ผู้เรียนเก็บรอบเรียนเข้ากระเป๋า';`)) as Array<{user_id:string;message:string;link_url:string}>
async function history(f:Fixture){const rows=[];let before:string|null=null;do{const page=await getCoachAssignmentHistory(db() as never,{scheduleSlotId:f.slot,branchId:f.branch,before});rows.push(...page.events);before=page.nextCursor}while(before);return rows}
const money=()=>localSql(`SELECT md5(jsonb_build_object('bookings',(SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM bookings b),'payments',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM payments p),'coupons',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM coupons c),'allocations',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM progressive_payment_allocations a))::text);`)
async function auth(a:Account,request:Parameters<typeof test>[0] extends never?never: {newContext: (options:object)=>Promise<APIRequestContext>}){
 const env=getLocalSupabaseEnv(),cookies=new Map<string,string>()
 const client=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:values=>values.forEach(v=>cookies.set(v.name,v.value))}})
 expect((await client.auth.signInWithPassword({email:a.email,password})).error).toBeNull()
 const context=await request.newContext({baseURL:'http://127.0.0.1:3161',extraHTTPHeaders:{Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; ')}});contexts.push(context);return context
}
test.beforeAll(async()=>{
 verifyLessonSourceTarget();localSql(`INSERT INTO course_types(name,max_students,duration_hours) VALUES('kids_group',6,2),('adult_group',6,2),('private',4,1) ON CONFLICT(name) DO NOTHING;`);owner=await account('user','ผู้ปกครองข้อ8');coach=await account('coach','โค้ชรับผิดชอบ');otherCoach=await account('coach','โค้ชอีกกลุ่ม');head=await account('head_coach','หัวหน้าโค้ช');admin=await account('admin','แอดมิน');superAdmin=await account('super_admin','Super Admin')
})
test.afterAll(async()=>{for(const c of contexts)await c.dispose()})

test('baseline reproduces missing last-learner coach notice, then installs forward candidate',async()=>{
 rollback();const f=seed();const saved=await db().rpc('save_coach_assignment_groups_v2',{p_schedule_slot_id:f.slot,p_actor_id:superAdmin.id,p_groups:groups(f)});expect(saved.error).toBeNull()
 const result=await store(f);expect(notices(result.credit_id).some(n=>n.user_id===coach.id)).toBe(false)
 forward();writeFileSync(lessonSourceRun().outputDir+'/baseline.json',JSON.stringify({missingResponsibleNotice:true,project:lessonSourceRun().target.project}))
})
test('last learner gets one responsible-coach notice with zero remaining and safe link',async()=>{
 const f=seed();await assign(f);const before=money(),r=await store(f),rows=notices(r.credit_id)
 expect(rows.filter(n=>n.user_id===coach.id)).toHaveLength(1);expect(rows.find(n=>n.user_id===coach.id)!.message).toContain('ไม่มีผู้เรียนเหลือ');expect(rows.find(n=>n.user_id===coach.id)!.link_url).toBe('/coach/notifications')
 expect(rows.some(n=>n.user_id===head.id)).toBe(false);expect(rows.some(n=>n.user_id===admin.id)).toBe(true);expect(money()).toBe(before)
 const events=await history(f);expect(events.filter(e=>e.type==='wallet_store')).toHaveLength(1);expect(events.some(e=>e.type==='booking_added')).toBe(true);expect(events.find(e=>e.type==='wallet_store')!.actorName).toBe('ผู้ปกครองข้อ8')
})
test('partial exit and fully coached remainder notify only affected coach',async()=>{
 const f=seed('kids_group',2);await assign(f,groups(f,[coach.id,otherCoach.id]));const r=await store(f),rows=notices(r.credit_id)
 expect(rows.some(n=>n.user_id===coach.id)).toBe(true);expect(rows.some(n=>n.user_id===otherCoach.id)).toBe(false);expect(rows.some(n=>n.user_id===head.id)).toBe(false);expect(rows[0].message).toContain('รอบนี้เหลือผู้เรียน 1 คน')
})
test('remainder grouped without coach requires Head Coach review',async()=>{
 const f=seed('kids_group',2);await assign(f,groups(f,[coach.id,null]));const r=await store(f),rows=notices(r.credit_id)
 expect(rows.some(n=>n.user_id===head.id)).toBe(true);expect(rows.find(n=>n.user_id===head.id)!.message).toContain('รอมอบหมายโค้ช 1 คน')
})
test('unassigned Store has no fake responsible coach',async()=>{
 const f=seed('kids_group',2);const r=await store(f),rows=notices(r.credit_id)
 expect(rows.some(n=>n.user_id===coach.id||n.user_id===otherCoach.id)).toBe(false);expect(rows.some(n=>n.user_id===head.id)).toBe(true)
})
test('responsible Head Coach and review audience merge into one notice',async()=>{
 const f=seed('kids_group',2);await assign(f,groups(f,[head.id,null]));const r=await store(f),rows=notices(r.credit_id)
 expect(rows.filter(n=>n.user_id===head.id)).toHaveLength(1);expect(rows.find(n=>n.user_id===head.id)!.link_url).toContain('/coach/assign-groups')
})
test('Store replay and race produce one credit and one notice per recipient',async()=>{
 const f=seed();await assign(f);const [a,b]=await Promise.all([store(f),store(f)])
 expect(a.credit_id).toBe(b.credit_id);expect(notices(a.credit_id).filter(n=>n.user_id===coach.id)).toHaveLength(1)
 expect(localSql(`SELECT count(*) FROM lesson_wallet_credits WHERE booking_id=${q(f.booking)};`)).toBe('1')
})
test('Redeem, Assign and Store again retain distinct history and original expiry',async()=>{
 const f=seed();await assign(f);const first=await store(f)
 const redeemed=await db().rpc('lesson_source_transition_v1',{p_actor_id:owner.id,p_operation:'redeem',p_id:first.credit_id,p_payload:{targetDate:f.date,startTime:'15:00',endTime:'16:00',branchId:f.branch,templateId:f.template}})
 expect(redeemed.error).toBeNull();const id=(redeemed.data as {session_ids:string[]}).session_ids[0],next={...f,ids:[id]}
 await assign(next);const second=await store(next);expect(second.expires_at).toBe(first.expires_at);expect(second.credit_id).not.toBe(first.credit_id)
 const events=await history(f);expect(events.filter(e=>e.type==='wallet_store')).toHaveLength(2);expect(events.filter(e=>e.type==='wallet_redeem')).toHaveLength(1)
 expect(events.filter(e=>e.type==='wallet_redeem')[0].learnerNames).toHaveLength(1);expect(events.filter(e=>e.type==='wallet_redeem')[0].actorName).toBe('ผู้ปกครองข้อ8');expect(notices(second.credit_id).some(n=>n.user_id===coach.id)).toBe(true)
})
test('Family atomic Store/Redeem/Store retains every self/child participant once',async()=>{
 const f=seed('private',3);localSql(`UPDATE children SET full_name='ชื่อซ้ำ',nickname='ชื่อซ้ำ' WHERE id IN(${f.children.filter(Boolean).map(id=>q(id!)).join(',')});`);await assign(f);const r=await store(f,f.ids[2]);expect(localSql(`SELECT count(*) FROM booking_sessions WHERE booking_id=${q(f.booking)} AND status='walleted';`)).toBe('3')
 const template=randomUUID();localSql(`INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(template)},${q(f.branch)},${q(f.course)},extract(dow FROM date '${f.date}'),'17:00','18:00',true);`)
 const redeemed=await db().rpc('lesson_source_transition_v1',{p_actor_id:owner.id,p_operation:'redeem',p_id:r.credit_id,p_payload:{targetDate:f.date,startTime:'17:00',endTime:'18:00',branchId:f.branch,templateId:template}});expect(redeemed.error).toBeNull()
 const {session_ids:ids,schedule_slot_id:slot}=redeemed.data as {session_ids:string[];schedule_slot_id:string};expect(ids).toHaveLength(3);const next={...f,ids,slot};await assign(next);const second=await store(next);expect(second.credit_id).not.toBe(r.credit_id);expect(second.expires_at).toBe(r.expires_at)
 const original=await history(f),events=await history(next);expect(original.filter(e=>e.type==='wallet_store')).toHaveLength(1);expect(events.filter(e=>e.type==='wallet_store')).toHaveLength(1);expect(events.find(e=>e.type==='wallet_redeem')!.learnerNames).toHaveLength(3);expect([...original,...events].filter(e=>e.type==='wallet_store').every(e=>e.learnerNames.length===3)).toBe(true)
 expect(events.find(e=>e.type==='wallet_redeem')!.learnerNames.filter(name=>name==='ชื่อซ้ำ')).toHaveLength(2)
})
test('self Adult Wallet preserves money and has learner evidence',async()=>{const f=seed('adult_group');await assign(f);const before=money();await store(f);expect(money()).toBe(before);expect((await history(f)).find(e=>e.type==='wallet_store')!.learnerNames).toEqual(['ผู้ปกครองข้อ8'])})
test('legacy-only normal slot responsible coach is included',async()=>{
 const f=seed();localSql(`INSERT INTO coach_assignments(coach_id,schedule_slot_id,assigned_by) VALUES(${q(coach.id)},${q(f.slot)},${q(superAdmin.id)});`);const r=await store(f);expect(notices(r.credit_id).some(n=>n.user_id===coach.id)).toBe(true)
})
test('exact groups suppress unrelated legacy coach',async()=>{
 const f=seed();await assign(f);localSql(`INSERT INTO coach_assignments(coach_id,schedule_slot_id,assigned_by) VALUES(${q(otherCoach.id)},${q(f.slot)},${q(superAdmin.id)});`);const r=await store(f);expect(notices(r.credit_id).some(n=>n.user_id===otherCoach.id)).toBe(false)
})
test('history over fifty audits paginates stably and preserves repeated real changes',async()=>{
 const f=seed();for(let i=0;i<56;i++) await assign(f,groups(f,[i%2?coach.id:otherCoach.id]))
 const rows=await history(f);expect(rows.filter(e=>e.type==='assignment_saved')).toHaveLength(56);expect(rows.some(e=>e.type==='booking_added')).toBe(true)
 const noChangeBefore=rows.length;await assign(f,groups(f,[coach.id]));expect((await history(f)).length).toBe(noChangeBefore)
 expect(rows.every(e=>e.type!=='assignment_saved'||(e.contextLines?.length||0)>0)).toBe(true)
})
test('stale baseline rejects overwrite while same successful replay is a no-op',async()=>{
 const f=seed(),baseline=snapshot(f);await assign(f,groups(f),baseline)
 const conflict=await db().rpc('save_coach_assignment_groups_v3',{p_schedule_slot_id:f.slot,p_actor_id:superAdmin.id,p_groups:groups(f,[otherCoach.id]),p_expected_groups:baseline});expect(conflict.error?.message).toContain('BASELINE_CONFLICT')
 const replay=await assign(f,groups(f),baseline);expect((replay as {no_change:boolean}).no_change).toBe(true)
})
test('concurrent editors yield one winner and typed conflict',async()=>{
 const f=seed(),baseline=snapshot(f)
 const write=(coachId:string)=>concurrentLocalSql(`SELECT save_coach_assignment_groups_v3(${q(f.slot)},${q(superAdmin.id)},${q(JSON.stringify(groups(f,[coachId])))}::jsonb,${q(JSON.stringify(baseline))}::jsonb);`)
 const results=await Promise.allSettled([write(coach.id),write(otherCoach.id)]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1)
})
test('coverage distinguishes saved groups without, partial and full responsibility',async()=>{
 const f=seed('kids_group',2);expect(getAssignmentCoverage(f.ids,groups(f,[null,null])).waiting).toBe(2);expect(getAssignmentCoverage(f.ids,groups(f,[coach.id,null])).waiting).toBe(1);expect(getAssignmentCoverage(f.ids,groups(f,[coach.id,otherCoach.id])).waiting).toBe(0);expect(getAssignmentCoverage([],groups(f)).total).toBe(0)
})
test('history and readback maintain role/branch gates',async({playwright})=>{
 const f=seed();await assign(f);const userApi=await auth(owner,playwright.request),coachApi=await auth(coach,playwright.request),headApi=await auth(head,playwright.request),sa=await auth(superAdmin,playwright.request)
 expect((await userApi.get(`/api/coach/assignment-history?scheduleSlotId=${f.slot}`)).status()).toBe(403);expect((await coachApi.get(`/api/coach/assignment-history?scheduleSlotId=${f.slot}`)).status()).toBe(403)
 expect((await headApi.get(`/api/coach/assignment-history?scheduleSlotId=${f.slot}`)).status()).toBe(200)
 const wrong=seed();localSql(`DELETE FROM coach_branches WHERE coach_id=${q(head.id)} AND branch_id=${q(wrong.branch)};`);expect((await headApi.get(`/api/coach/assignment-history?scheduleSlotId=${wrong.slot}`)).status()).toBe(403)
 expect((await sa.get(`/api/coach/assignment-groups?scheduleSlotId=${f.slot}&branchId=${f.branch}`)).status()).toBe(200)
 expect((await userApi.get(`/api/coach/assignment-groups?scheduleSlotId=${f.slot}&branchId=${f.branch}`)).status()).toBe(401)
})
test('HTTP Save persists no-coach groups and does not confuse notice failure with save failure',async({playwright})=>{
 const f=seed(),sa=await auth(superAdmin,playwright.request);const saved=await sa.post('/api/coach/assignment-groups',{data:{scheduleSlotId:f.slot,branchId:f.branch,groups:groups(f,[null]),expectedGroups:[]}})
 expect(saved.status()).toBe(200);expect((await saved.json()).success).toBe(true)
 const read=await sa.get(`/api/coach/assignment-groups?scheduleSlotId=${f.slot}&branchId=${f.branch}`);expect((await read.json()).canonicalGroups[0].coach_id).toBeNull()
})
test('rollback/reapply preserves business rows and forward contracts',async()=>{
 const before=localSql(`SELECT md5(jsonb_build_object('credits',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM lesson_wallet_credits c),'sessions',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM booking_sessions s),'logs',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM activity_logs a),'notices',(SELECT jsonb_agg(to_jsonb(n) ORDER BY id) FROM notifications n))::text);`)
 rollback();forward();const after=localSql(`SELECT md5(jsonb_build_object('credits',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM lesson_wallet_credits c),'sessions',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM booking_sessions s),'logs',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM activity_logs a),'notices',(SELECT jsonb_agg(to_jsonb(n) ORDER BY id) FROM notifications n))::text);`);expect(after).toBe(before)
})

test('Store notice failure rolls back credit, membership, audit and session atomically',async()=>{
 const f=seed();await assign(f);const before=snapshot(f)
 localSql(`CREATE FUNCTION assignment8_reject_notice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.user_id=${q(coach.id)}::uuid AND NEW.title='ผู้เรียนเก็บรอบเรียนเข้ากระเป๋า' THEN RAISE EXCEPTION 'ASSIGNMENT8_INJECTED_NOTICE_FAILURE'; END IF; RETURN NEW; END $$; CREATE TRIGGER assignment8_reject_notice BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION assignment8_reject_notice();`)
 try{const r=await db().rpc('lesson_source_transition_v1',{p_actor_id:owner.id,p_operation:'store',p_id:f.ids[0],p_payload:{}});expect(r.error?.message).toContain('INJECTED_NOTICE_FAILURE');expect(snapshot(f)).toEqual(before);expect(localSql(`SELECT status FROM booking_sessions WHERE id=${q(f.ids[0])};`)).toBe('scheduled');expect(localSql(`SELECT count(*) FROM lesson_wallet_credits WHERE booking_id=${q(f.booking)};`)).toBe('0')}
 finally{localSql('DROP TRIGGER assignment8_reject_notice ON notifications;DROP FUNCTION assignment8_reject_notice();')}
})

test('committed Save returns success and warning when coach notice insert fails',async({playwright})=>{
 const f=seed(),sa=await auth(superAdmin,playwright.request)
 localSql(`CREATE FUNCTION assignment8_reject_save_notice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.user_id=${q(coach.id)}::uuid AND NEW.title='ได้รับมอบหมายรอบสอน' THEN RAISE EXCEPTION 'ASSIGNMENT8_INJECTED_SAVE_NOTICE_FAILURE'; END IF; RETURN NEW; END $$; CREATE TRIGGER assignment8_reject_save_notice BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION assignment8_reject_save_notice();`)
 try{const r=await sa.post('/api/coach/assignment-groups',{data:{scheduleSlotId:f.slot,branchId:f.branch,groups:groups(f),expectedGroups:[]}});expect(r.status()).toBe(200);const body=await r.json();expect(body.success).toBe(true);expect(body.warnings).toContain('บันทึกกลุ่มสำเร็จ');expect(snapshot(f)[0].coach_id).toBe(coach.id)}
 finally{localSql('DROP TRIGGER assignment8_reject_save_notice ON notifications;DROP FUNCTION assignment8_reject_save_notice();')}
})

test('mixed Store and Save never retain membership for a walleted learner',async()=>{
 const f=seed();await assign(f);const baseline=snapshot(f)
 const results=await Promise.all([db().rpc('save_coach_assignment_groups_v3',{p_schedule_slot_id:f.slot,p_actor_id:superAdmin.id,p_groups:groups(f,[otherCoach.id]),p_expected_groups:baseline}),db().rpc('lesson_source_transition_v1',{p_actor_id:owner.id,p_operation:'store',p_id:f.ids[0],p_payload:{}})])
 expect(results[1].error).toBeNull();if(results[0].error)expect(results[0].error.message).toMatch(/BASELINE_CONFLICT|ROSTER_CONFLICT|ATTENDANCE_RETRY|LOCK_CONFLICT/)
 expect(localSql(`SELECT count(*) FROM coach_assignment_group_students WHERE booking_session_id=${q(f.ids[0])};`)).toBe('0');expect(localSql(`SELECT count(*) FROM lesson_wallet_credits WHERE booking_id=${q(f.booking)};`)).toBe('1')
})

test('historical singular logs and missing audit retain exact durable Wallet evidence',async()=>{
 const f=seed();await assign(f);const r=await store(f)
 localSql(`UPDATE activity_logs SET details=jsonb_build_object('sessionId',${q(f.ids[0])}) WHERE action='store_lesson_wallet_credit' AND entity_id=${q(r.credit_id)};`)
 expect((await history(f)).filter(e=>e.type==='wallet_store')).toHaveLength(1)
 localSql(`DELETE FROM activity_logs WHERE (action='store_lesson_wallet_credit' AND entity_id=${q(r.credit_id)}) OR (action='retire_coach_assignment_membership' AND details->>'bookingSessionId'=${q(f.ids[0])});`)
 const events=await history(f),event=events.find(e=>e.type==='wallet_store')!;expect(events.filter(e=>e.type==='wallet_store')).toHaveLength(1);expect(event.actorName).toBeNull();expect(event.learnerNames).toHaveLength(1);expect(events.some(e=>e.type==='booking_added')).toBe(true)
})

test('unavailable history evidence fails closed instead of presenting an empty complete history',async()=>{
 const f=seed(),client=db(),broken={from:(table:string)=>client.from(table==='activity_logs'?'assignment8_missing_evidence':table)}
 await expect(getCoachAssignmentHistory(broken as never,{scheduleSlotId:f.slot,branchId:f.branch})).rejects.toThrow('query failed')
})

test('new and protected function grants retain service-only mutation entrypoints',()=>{
 expect(localSql(`SELECT has_function_privilege('authenticated','save_coach_assignment_groups_v3(uuid,uuid,jsonb,jsonb)','EXECUTE'),has_function_privilege('anon','save_coach_assignment_groups_v3(uuid,uuid,jsonb,jsonb)','EXECUTE'),has_function_privilege('authenticated','assignment8_group_signature_v1(jsonb)','EXECUTE'),has_function_privilege('authenticated','lesson_source_transition_v1(uuid,text,uuid,jsonb)','EXECUTE');`)).toBe('f|f|f|f')
})

test('Wallet HTTP ownership and round trip preserve current API flow',async({playwright})=>{
 const f=seed();await assign(f);const ownerApi=await auth(owner,playwright.request),outsider=await auth(otherCoach,playwright.request)
 expect((await outsider.post('/api/lesson-wallet',{data:{action:'store',sessionId:f.ids[0]}})).status()).toBe(404)
 const response=await ownerApi.post('/api/lesson-wallet',{data:{action:'store',sessionId:f.ids[0]}});expect(response.status()).toBe(200);const {creditId}=await response.json();expect(notices(creditId).some(n=>n.user_id===coach.id)).toBe(true)
 const redeemed=await ownerApi.post('/api/lesson-wallet',{data:{action:'redeem',creditId,targetDate:f.date,startTime:'15:00',endTime:'16:00',branchId:f.branch,scheduleTemplateId:f.template}});expect(redeemed.status()).toBe(200);expect((await redeemed.json()).sessionIds).toHaveLength(1)
})

async function login(page:Page,a:Account){
 await page.goto('/auth/login');await page.getByLabel('อีเมล',{exact:true}).fill(a.email);await page.locator('input#password').fill(password);await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await expect(page).not.toHaveURL(/auth\/login/)
}
async function scopedHead(f:Fixture){const a=await account('head_coach','หัวหน้าโค้ชหน้าจอ');localSql(`INSERT INTO coach_branches(coach_id,branch_id) VALUES(${q(a.id)},${q(f.branch)});`);return a}

for(const width of [1366,390])test(`browser ${width}px shows saved waiting state, real history pages and retry`,async({page},info)=>{
 const f=seed();for(let i=0;i<7;i++)await assign(f,groups(f,[i%2?coach.id:null]));const a=await scopedHead(f);await page.setViewportSize({width,height:900});await login(page,a);await page.goto(`/coach/assign-groups?month=${f.date.slice(0,7)}`)
 await expect(page.getByText('บันทึกกลุ่มแล้ว — รอมอบหมายโค้ช 1 คน / 1 กลุ่ม',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'บันทึกกลุ่มแล้ว',exact:true})).toBeDisabled()
 for(const label of ['ต้องดำเนินการ','มีโค้ชครบแล้ว','ทั้งหมด'])expect(await page.getByRole('button',{name:label,exact:true}).evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
 await page.getByRole('button',{name:'ดูประวัติการเปลี่ยนแปลง',exact:true}).click();await expect(page.locator('ol li')).toHaveCount(5)
 let failed=false;await page.route('**/api/coach/assignment-history?**',async route=>{if(route.request().url().includes('before=')&&!failed){failed=true;await route.abort()}else await route.continue()})
 await page.getByRole('button',{name:'ดูประวัติก่อนหน้า',exact:true}).click();await expect(page.getByRole('button',{name:'ลองอีกครั้ง',exact:true})).toBeVisible();await page.getByRole('button',{name:'ลองอีกครั้ง',exact:true}).click();await expect(page.locator('ol li')).toHaveCount(8)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('waiting-history.png'),fullPage:true})
})

test('browser level change preserves responsibility through refresh and a new login',async({page,browser})=>{
 const f=seed();await assign(f);const before=snapshot(f),a=await scopedHead(f);await login(page,a);await page.goto(`/coach/assign-groups?month=${f.date.slice(0,7)}`);await expect(page.getByRole('button',{name:'มีโค้ชครบแล้ว',exact:true}).last()).toBeDisabled()
 localSql(`INSERT INTO student_levels(student_id,student_type,level,updated_by) VALUES(${q(f.children[0]!)},'child',7,${q(superAdmin.id)});`);await page.reload();await expect(page.getByRole('button',{name:'มีโค้ชครบแล้ว',exact:true}).last()).toBeDisabled();expect(snapshot(f)).toEqual(before)
 const context=await browser.newContext();try{const fresh=await context.newPage();await login(fresh,a);await fresh.goto(`/coach/assign-groups?month=${f.date.slice(0,7)}`);await expect(fresh.getByRole('button',{name:'มีโค้ชครบแล้ว',exact:true}).last()).toBeDisabled();expect(snapshot(f)).toEqual(before)}finally{await context.close()}
})

test('browser reads back a committed Save after losing its response and preserves the draft',async({page})=>{
 const f=seed();await assign(f,groups(f,[null]));const a=await scopedHead(f);await login(page,a);await page.goto(`/coach/assign-groups?month=${f.date.slice(0,7)}`)
 await page.getByLabel('ชื่อกลุ่ม',{exact:true}).fill('กลุ่มเปลี่ยนชื่อข้อ8')
 let committed=false;await page.route('**/api/coach/assignment-groups',async route=>{if(route.request().method()==='POST'){const result=await route.fetch();expect(result.status()).toBe(200);committed=true;await route.abort()}else await route.continue()})
 await page.getByRole('button',{name:'บันทึก/ยืนยันการมอบหมาย',exact:true}).click();await expect(page.getByText('ตรวจพบผลที่บันทึกแล้วบน Server กรุณาตรวจข้อมูลล่าสุดก่อนทำรายการต่อ',{exact:true})).toBeVisible();expect(committed).toBe(true);expect(snapshot(f)[0].name).toBe('กลุ่มเปลี่ยนชื่อข้อ8');await expect(page.getByLabel('ชื่อกลุ่ม',{exact:true})).toHaveValue('กลุ่มเปลี่ยนชื่อข้อ8')
})

test('late history response cannot replace the cache after a newer Save',async({page})=>{
 const f=seed();await assign(f,groups(f,[null]));const a=await scopedHead(f);await login(page,a);await page.goto(`/coach/assign-groups?month=${f.date.slice(0,7)}`)
 let captured=false,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve})
 await page.route('**/api/coach/assignment-history?**',async route=>{if(!captured){captured=true;const response=await route.fetch();await gate;await route.fulfill({response})}else await route.continue()})
 await page.getByLabel('ชื่อกลุ่ม',{exact:true}).fill('ชื่อใหม่หลังSave');await page.getByRole('button',{name:'ดูประวัติการเปลี่ยนแปลง',exact:true}).click();await expect.poll(()=>captured).toBe(true)
 await page.getByRole('button',{name:'บันทึก/ยืนยันการมอบหมาย',exact:true}).click();await expect(page.getByRole('button',{name:'บันทึกกลุ่มแล้ว',exact:true})).toBeDisabled();release()
 await page.getByRole('button',{name:'ดูประวัติการเปลี่ยนแปลง',exact:true}).click();await expect(page.locator('[id^="assignment-history-"] ol')).toContainText('ชื่อใหม่หลังSave')
})

test('Admin Family entitlement return merges retirement evidence into one truthful adjustment',async()=>{
 const f=seed('private',3,localSql("SELECT ((clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date-2)::text;"));await assign(f)
 const returned=await db().rpc('lesson_source_transition_v1',{p_actor_id:superAdmin.id,p_operation:'return_entitlement',p_id:f.ids[0],p_payload:{reason:'ตรวจคืนสิทธิ์ในระบบแยก'}});expect(returned.error).toBeNull()
 const events=await history(f);expect(events.filter(e=>e.type==='wallet_store')).toHaveLength(0);const adjustments=events.filter(e=>e.type==='admin_adjustment');expect(adjustments).toHaveLength(1);expect(adjustments[0].learnerNames).toHaveLength(3);expect(adjustments[0].actorName).toBe('Super Admin');expect(adjustments[0].reason).toBe('ตรวจคืนสิทธิ์ในระบบแยก')
})
