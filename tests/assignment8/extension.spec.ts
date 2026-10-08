import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createLocalAdmin, getLocalSupabaseEnv } from '../booking-regression/local-supabase'
import { localSql, concurrentLocalSql, sqlLiteral as q } from '../task10-regression/local-supabase'
import { verifyLessonSourceTarget, lessonSourceRun } from '../../scripts/verify-lesson-source-test-target.mjs'
import { getCoachAssignmentHistory } from '../../src/lib/coach-assignment-history'
import { getCoachVisibleStudents } from '../../src/lib/coach-student-access'
import { createCompleteCoachStudentReadClient } from '../../src/lib/coach-student-reads'

type Account={id:string;email:string}
type Fixture={booking:string;branch:string;slot:string;template:string;course:string;ids:string[];children:(string|null)[];date:string}
const password='Assignment8Local!2026', db=()=>createLocalAdmin()
let owner:Account,coach:Account,otherCoach:Account,head:Account,admin:Account,superAdmin:Account
const contexts:APIRequestContext[]=[]
let fixtureDay=85
const forward=()=>localSql(readFileSync('supabase/migrations/20261007073831_assignment_wallet_history_notifications.sql','utf8'))
const rollback=()=>localSql(readFileSync('supabase/rollbacks/assignment8.sql','utf8'))
async function account(role:string,label:string):Promise<Account>{
  const email=`assignment8-${randomUUID()}@example.com`,r=await db().auth.admin.createUser({email,password,email_confirm:true})
  expect(r.error).toBeNull();const id=r.data.user!.id
  expect((await db().from('profiles').update({role,full_name:label}).eq('id',id)).error).toBeNull()
  return{id,email}
}
function seed(courseName='kids_group',count=1,dateOverride?:string,ordering?:'low'|'high'):Fixture{
  verifyLessonSourceTarget();const [booking,branch,slot,template]=Array.from({length:4},()=>randomUUID())
  const course=localSql(`SELECT id FROM course_types WHERE name=${q(courseName)};`),date=dateOverride||new Date(Date.UTC(2031,9,++fixtureDay)).toISOString().slice(0,10)
  const children=Array.from({length:count},(_,i)=>courseName==='adult_group'||(courseName==='private'&&i===0)?null:randomUUID())
  const ids=children.map(()=>{const id=randomUUID();return ordering?(ordering==='low'?'00000000':'ffffffff')+id.slice(8):id})
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

const familyForward=()=>localSql(readFileSync('supabase/migrations/20261008023229_assignment_family_same_slot_generation.sql','utf8'))
const familyRollback=()=>localSql(readFileSync('supabase/rollbacks/assignment8-family.sql','utf8'))
async function redeemSame(f:Fixture,credit:string){
 const r=await db().rpc('lesson_source_transition_v1',{p_actor_id:owner.id,p_operation:'redeem',p_id:credit,p_payload:{targetDate:f.date,startTime:'15:00',endTime:'16:00',branchId:f.branch,templateId:f.template}});expect(r.error).toBeNull()
 return {...f,ids:(r.data as {session_ids:string[]}).session_ids,slot:(r.data as {schedule_slot_id:string}).schedule_slot_id}
}
async function signed(a:Account){const r=await db().auth.signInWithPassword({email:a.email,password});expect(r.error).toBeNull();return dbWithToken(r.data.session!.access_token)}
function dbWithToken(token:string){const env=getLocalSupabaseEnv();return createClient(env.apiUrl,env.publishableKey,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}})}
async function login(page:Page,a:Account){
 await page.goto('/auth/login');await page.getByLabel('อีเมล',{exact:true}).fill(a.email);await page.locator('input#password').fill(password);await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await expect(page).not.toHaveURL(/auth\/login/)
}

test('Family baseline reproduces both stale replay and non-storable new generation, then applies correction',async()=>{
 familyRollback()
 for(const ordering of ['low','high'] as const){const f=seed('private',3,undefined,ordering);await assign(f);const first=await store(f);const next=await redeemSame(f,first.credit_id);await assign(next)
 const second=await db().rpc('lesson_source_transition_v1',{p_actor_id:owner.id,p_operation:'store',p_id:next.ids[1],p_payload:{}})
 if(ordering==='low'){expect(second.error).toBeNull();expect(second.data.credit_id).toBe(first.credit_id)}else expect(second.error).not.toBeNull()
 expect(localSql(`SELECT count(*) FROM booking_sessions WHERE id IN(${next.ids.map(q).join(',')}) AND status='scheduled';`)).toBe('3')}
 familyForward()
})

for(const ordering of ['low','high'] as const)test(`Family same-slot three Store generations preserve atomic rights and replay (${ordering})`,async()=>{
 let f=seed('private',3,undefined,ordering);await assign(f);const before=money();let expiry:string|undefined,previous:string|undefined
 for(let generation=0;generation<3;generation++){
 const r=await store(f,f.ids[generation%3]);expect(r.credit_id).not.toBe(previous);if(expiry)expect(r.expires_at).toBe(expiry);expiry=r.expires_at
 expect(localSql(`SELECT count(*) FROM lesson_wallet_credit_members WHERE credit_id=${q(r.credit_id)};`)).toBe('3')
 expect(localSql(`SELECT count(*) FROM booking_sessions WHERE id IN(${f.ids.map(q).join(',')}) AND status='walleted';`)).toBe('3')
 const replay=await store(f,f.ids[(generation+1)%3]);expect(replay.credit_id).toBe(r.credit_id);expect(notices(r.credit_id).filter(n=>n.user_id===coach.id)).toHaveLength(1)
 previous=r.credit_id;if(generation<2){f=await redeemSame(f,r.credit_id);await assign(f)}
 }
 const events=await history(f);expect(events.filter(e=>e.type==='wallet_store')).toHaveLength(3);expect(events.filter(e=>e.type==='wallet_redeem')).toHaveLength(2);expect(events.filter(e=>e.type.startsWith('wallet_')).every(e=>e.learnerNames.length===3)).toBe(true);expect(money()).toBe(before)
})

test('Family second Store race and notice failure retain one generation and no residue',async()=>{
 const first=seed('private',3);await assign(first);const r=await store(first);const f=await redeemSame(first,r.credit_id);await assign(f)
 localSql(`CREATE FUNCTION assignment8_ext_notice_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.title='ผู้เรียนเก็บรอบเรียนเข้ากระเป๋า' THEN RAISE EXCEPTION 'assignment8 injected failure'; END IF;RETURN NEW;END $$;CREATE TRIGGER assignment8_ext_notice_fail BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION assignment8_ext_notice_fail();`)
 try{const failed=await db().rpc('lesson_source_transition_v1',{p_actor_id:owner.id,p_operation:'store',p_id:f.ids[0],p_payload:{}});expect(failed.error).not.toBeNull();expect(localSql(`SELECT count(*) FROM booking_sessions WHERE id IN(${f.ids.map(q).join(',')}) AND status='scheduled';`)).toBe('3');expect(localSql(`SELECT count(*) FROM lesson_wallet_credits WHERE booking_id=${q(f.booking)};`)).toBe('1')}
 finally{localSql('DROP TRIGGER assignment8_ext_notice_fail ON notifications;DROP FUNCTION assignment8_ext_notice_fail();')}
 const results=await Promise.all(f.ids.map(id=>db().rpc('lesson_source_transition_v1',{p_actor_id:owner.id,p_operation:'store',p_id:id,p_payload:{}})));expect(results.every(r=>!r.error)).toBe(true);expect(new Set(results.map(r=>r.data.credit_id)).size).toBe(1)
 expect(localSql(`SELECT count(*) FROM lesson_wallet_credits WHERE booking_id=${q(f.booking)};`)).toBe('2')
})

test('large assignment roster reproduces unbounded URL failure and reads every exact learner/level',async()=>{
 const f=seed('kids_group',1105);await assign(f);const client=await signed(coach)
 const unbounded=await client.from('booking_sessions').select('id,bookings!inner(user_id,status)').in('id',f.ids);expect(unbounded.error).not.toBeNull()
 const students=await getCoachVisibleStudents(client,coach);const fixtureStudents=students.filter(s=>f.children.includes(s.id));expect(fixtureStudents).toHaveLength(1105);expect(new Set(students.map(s=>`${s.type}:${s.id}`)).size).toBe(students.length)
 localSql(`INSERT INTO student_levels(student_id,student_type,level,updated_by) SELECT id,'child',1,${q(coach.id)} FROM children WHERE id IN(${f.children.filter(Boolean).map(id=>q(id!)).join(',')});`)
 const levels=await createCompleteCoachStudentReadClient(client).from('student_levels').select('student_id,student_type,level,created_at').in('student_id',f.children.filter(Boolean)).order('created_at',{ascending:false});expect(levels.data).toHaveLength(1105)
})

for(const width of [1366,390])test(`Level browser ${width}px loads large roster and saves correct child through new login`,async({page,browser},info)=>{
 const f=seed('kids_group',260);await assign(f);localSql(`UPDATE children SET full_name='เด็กชื่อซ้ำ',nickname=NULL WHERE id IN(${f.children.slice(0,2).map(id=>q(id!)).join(',')});`)
 const actor=width===390?await account('head_coach','หัวหน้าเฉพาะหน้าจอ'):coach
 if(actor!==coach)localSql(`INSERT INTO coach_branches(coach_id,branch_id) VALUES(${q(actor.id)},${q(f.branch)});`)
 const persisted=snapshot(f)
 await page.setViewportSize({width,height:900});await login(page,actor);if(width===390)await page.goto('/coach/levels');else await page.getByRole('link',{name:'กรอก LV นักเรียน',exact:true}).click();await expect(page.getByText('ประเมิน Level นักเรียน',{exact:true})).toBeVisible()
 await page.getByPlaceholder('ค้นหาชื่อนักเรียนหรือผู้ปกครอง...').fill('เด็กชื่อซ้ำ');await expect(page.getByRole('button',{name:'กรอก LV',exact:true})).toHaveCount(2)
 await page.getByRole('button',{name:'กรอก LV',exact:true}).first().click();await page.getByRole('combobox').click();await page.getByRole('option',{name:/^LV 1 -/}).click();await page.getByPlaceholder('เช่น พัฒนาดี, ต้องฝึก backhand เพิ่ม').fill('ประเมินทดสอบชื่อซ้ำ')
 const saveRequest=page.waitForRequest(r=>r.url().endsWith('/api/coach/levels')&&r.method()==='POST');await page.getByRole('button',{name:'บันทึกการประเมิน',exact:true}).click();const savedId=(await saveRequest).postDataJSON().studentId;await expect(page.getByText(/อัปเดต .* เป็น LV 1 สำเร็จ/)).toBeVisible()
 const rows=JSON.parse(localSql(`SELECT coalesce(jsonb_agg(jsonb_build_object('student_id',student_id,'level',level,'updated_by',updated_by,'notes',notes,'created_at',created_at)),'[]') FROM student_levels WHERE student_id IN(${f.children.slice(0,2).map(id=>q(id!)).join(',')});`));expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({student_id:savedId,level:1,updated_by:actor.id,notes:'ประเมินทดสอบชื่อซ้ำ'});expect(Number.isFinite(Date.parse(rows[0].created_at))).toBe(true)
 await page.reload();expect(snapshot(f)).toEqual(persisted)
 const context=await browser.newContext({viewport:{width,height:900},locale:'th-TH'});const fresh=await context.newPage();await login(fresh,actor);await fresh.goto('/coach/levels');await fresh.getByPlaceholder('ค้นหาชื่อนักเรียนหรือผู้ปกครอง...').fill('เด็กชื่อซ้ำ');await expect(fresh.getByText('อัปเดต:',{exact:false}).first()).toBeVisible();await fresh.getByRole('button',{name:'กรอก LV',exact:true}).last().click();await expect(fresh.getByText('Level ปัจจุบัน: 1',{exact:true})).toBeVisible();await fresh.getByRole('button',{name:'ยกเลิก',exact:true}).click();await expect(fresh.getByRole('dialog')).toBeHidden();expect(await fresh.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await fresh.screenshot({path:info.outputPath('level-saved.png'),fullPage:true});await context.close()
})

test('Level role/branch gates and shared student/achievement paths retain exact responsibility',async({page,playwright})=>{
 const request=playwright.request
 const stress=seed('kids_group',260);await assign(stress)
 const f=seed('private',3);await assign(f);const coachApi=await auth(coach,request),otherApi=await auth(otherCoach,request),parentApi=await auth(owner,request)
 for(let i=0;i<3;i++){const type=f.children[i]?'child':'adult',id=f.children[i]||owner.id;const r=await coachApi.post('/api/coach/levels',{data:{studentId:id,studentType:type,level:i+1}});expect(r.status()).toBe(200)}
 const g=seed();await assign(g,groups(g,[otherCoach.id]));expect((await coachApi.post('/api/coach/levels',{data:{studentId:g.children[0],studentType:'child',level:2}})).status()).toBe(403)
 expect((await otherApi.post('/api/coach/levels',{data:{studentId:f.children[1],studentType:'child',level:2}})).status()).toBe(403);expect((await parentApi.post('/api/coach/levels',{data:{studentId:f.children[1],studentType:'child',level:2}})).status()).toBe(401)
 expect((await coachApi.post('/api/coach/levels',{data:{studentId:f.children[1],studentType:'child',level:0}})).status()).toBe(400);expect((await coachApi.post('/api/coach/levels',{data:{studentId:f.children[1],studentType:'child',level:71}})).status()).toBe(400)
 await login(page,coach);await page.goto('/coach/students');await expect(page.getByRole('heading',{name:'รายชื่อนักเรียน',exact:true})).toBeVisible();await page.getByPlaceholder('ค้นหาชื่อนักเรียน ผู้ปกครอง สาขา Level หรือโค้ชที่เคยสอน...').fill('เด็ก '+f.children[1]!.slice(0,6));await expect(page.getByText('เด็ก '+f.children[1]!.slice(0,6)+' (เด็ก '+f.children[1]!.slice(0,6)+')',{exact:true})).toBeVisible()
 expect((await coachApi.post('/api/student-achievements',{data:{studentId:f.children[1],studentType:'child',emoji:'🏸',title:'ทดสอบความสำเร็จ'}})).status()).toBe(200)
 expect((await otherApi.post('/api/student-achievements',{data:{studentId:f.children[1],studentType:'child',emoji:'🏸',title:'ไม่มีสิทธิ์'}})).status()).toBe(403)
 const h=await account('head_coach','หัวหน้าเฉพาะสาขา');localSql(`INSERT INTO coach_branches(coach_id,branch_id) VALUES(${q(h.id)},${q(f.branch)});`);const headApi=await auth(h,request);expect((await headApi.post('/api/coach/levels',{data:{studentId:f.children[1],studentType:'child',level:4}})).status()).toBe(200);expect((await headApi.post('/api/coach/levels',{data:{studentId:g.children[0],studentType:'child',level:4}})).status()).toBe(403)
})

test('Level query failure fails closed, returns503 on Save and recovers through explicit retry',async({page,playwright})=>{
 const request=playwright.request
 const f=seed();await assign(f);const client=await signed(coach),api=await auth(coach,request);await login(page,coach)
 localSql('REVOKE SELECT ON public.booking_sessions FROM authenticated;')
 try{await expect(getCoachVisibleStudents(client,coach)).rejects.toThrow();const failed=await api.post('/api/coach/levels',{data:{studentId:f.children[0],studentType:'child',level:1}});expect(failed.status()).toBe(503);await page.goto('/coach/levels');await expect(page.getByText('โหลดข้อมูลสำหรับประเมิน Level ไม่สำเร็จ',{exact:true})).toBeVisible();expect(localSql(`SELECT count(*) FROM student_levels WHERE student_id=${q(f.children[0]!)};`)).toBe('0')}
 finally{localSql('GRANT SELECT ON public.booking_sessions TO authenticated;')}
 await page.getByRole('button',{name:'ลองโหลดอีกครั้ง',exact:true}).click();await expect(page.getByText('ประเมิน Level นักเรียน',{exact:true})).toBeVisible()
})

test('Family schema rollback/reapply preserves all business rows and internal helper stays private',async()=>{
 const hash=()=>localSql(`SELECT md5(jsonb_build_object('credits',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM lesson_wallet_credits c),'sessions',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM booking_sessions s),'operations',(SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM lesson_source_operations o),'activity',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM activity_logs a),'notices',(SELECT jsonb_agg(to_jsonb(n) ORDER BY id) FROM notifications n))::text);`)
 const before=hash();familyRollback();expect(hash()).toBe(before);familyForward();expect(hash()).toBe(before)
 for(const role of ['anon','authenticated','service_role'])expect(localSql(`SELECT has_function_privilege(${q(role)},'public.lesson_source_family_unit_sessions_v1(uuid)','EXECUTE');`)).toBe('f')
})

test('Level empty Coach and Head Coach pages load; anonymous Save remains unauthorized',async({page,playwright})=>{
 for(const role of ['coach','head_coach']){const empty=await account(role,'โค้ชไม่มีผู้เรียน');await login(page,empty);await page.goto('/coach/levels');await expect(page.getByText('ประเมิน Level นักเรียน',{exact:true})).toBeVisible();await expect(page.getByText('ยังไม่มีนักเรียนในสาขาของคุณ',{exact:true})).toBeVisible();await page.context().clearCookies()}
 const anonymous=await playwright.request.newContext({baseURL:'http://127.0.0.1:3161'});try{expect((await anonymous.post('/api/coach/levels',{data:{studentId:randomUUID(),studentType:'child',level:1}})).status()).toBe(401)}finally{await anonymous.dispose()}
})

test('Level responsibility follows Family Store, unassigned Redeem and reassignment',async({playwright})=>{
 const previousOwner=owner;owner=await account('user','ผู้ปกครองทดสอบสิทธิ์รุ่นใหม่')
 try{
 const f=seed('private',3);await assign(f);const client=await signed(coach),api=await auth(coach,playwright.request)
 const relevant=(students:Awaited<ReturnType<typeof getCoachVisibleStudents>>)=>students.filter(s=>s.id===owner.id||f.children.includes(s.id))
 expect(relevant(await getCoachVisibleStudents(client,coach))).toHaveLength(3)
 const stored=await store(f);expect(relevant(await getCoachVisibleStudents(client,coach))).toHaveLength(0);expect((await api.post('/api/coach/levels',{data:{studentId:f.children[1],studentType:'child',level:1}})).status()).toBe(403)
 const next=await redeemSame(f,stored.credit_id);expect(relevant(await getCoachVisibleStudents(client,coach))).toHaveLength(0);await assign(next);expect(relevant(await getCoachVisibleStudents(client,coach))).toHaveLength(3)
 }finally{owner=previousOwner}
})

test('Admin Family return after same-slot Redeem selects current generation and preserves expiry',async()=>{
 const f=seed('private',3);await assign(f);const first=await store(f);const next=await redeemSame(f,first.credit_id)
 // Advance only this synthetic fixture to an elapsed lesson, preserving credit evidence.
 const date=localSql("SELECT ((clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date-2)::text;")
 localSql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);UPDATE booking_sessions SET date='${date}' WHERE booking_id=${q(f.booking)};UPDATE schedule_slots SET date='${date}' WHERE id=${q(f.slot)};COMMIT;`)
 const elapsed={...next,date};await assign(elapsed);const before=money()
 const returned=await db().rpc('lesson_source_transition_v1',{p_actor_id:superAdmin.id,p_operation:'return_entitlement',p_id:next.ids[1],p_payload:{reason:'คืนสิทธิ์ Family รุ่นปัจจุบัน'}});expect(returned.error).toBeNull()
 const newCredit=localSql(`SELECT id FROM lesson_wallet_credits WHERE booking_id=${q(f.booking)} AND id<>${q(first.credit_id)};`);expect(newCredit).not.toBe('');expect(localSql(`SELECT count(*) FROM lesson_wallet_credit_members WHERE credit_id=${q(newCredit)};`)).toBe('3');expect(localSql(`SELECT expires_at=(SELECT expires_at FROM lesson_wallet_credits WHERE id=${q(first.credit_id)}) FROM lesson_wallet_credits WHERE id=${q(newCredit)};`)).toBe('t')
 expect(localSql(`SELECT count(*) FROM lesson_wallet_credit_members WHERE credit_id=${q(newCredit)} AND original_session_id IN(${next.ids.map(q).join(',')});`)).toBe('3');expect(money()).toBe(before)
})

