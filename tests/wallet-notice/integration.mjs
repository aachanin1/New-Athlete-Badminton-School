import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import {run,db,sql,q,fixtures} from './runtime.mjs'
const root=run.evidenceRoot, out=root+'/integration-'+Date.now(), checks=[]
fs.mkdirSync(out,{recursive:true})
const hash=s=>createHash('sha256').update(s).digest('hex')
const check=(name,condition=true)=>{assert.ok(condition,name);checks.push(name)}
const def=()=>sql("SELECT pg_get_functiondef('public.lesson_source_effects_v1(uuid,text,uuid,jsonb,jsonb)'::regprocedure)")
const notices=c=>JSON.parse(sql(`SELECT coalesce(jsonb_agg(to_jsonb(n) ORDER BY user_id),'[]') FROM notifications n WHERE created_at=(SELECT created_at FROM lesson_wallet_credits WHERE id=${q(c)})`))
const date=sql("SELECT (current_date+5)::text"), start='10:00:00', end='11:00:00'
const accounts={}, records=[]
async function store(f,actor,admin=false,request=randomUUID()){
 const r=await db.rpc('lesson_source_transition_v1',{p_actor_id:actor.id,p_operation:admin?'admin_store':'store',p_id:f.ids[0],p_payload:admin?{reason:'QA wallet notice actor',requestId:request,storePolicy:'admin-store-once-v1'}:{}})
 return {...r,request}
}
function money(f){return sql(`SELECT md5(jsonb_build_object('booking',(SELECT to_jsonb(b) FROM bookings b WHERE id=${q(f.booking)}),'payments',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM payments p WHERE booking_id=${q(f.booking)}))::text)`)}
function fixture(course='kids_group',family=false){return fixtures.fixture(course,family,accounts.owner,date,start,end)}
function assign(f){
 const group=randomUUID();sql(`INSERT INTO coach_branches(coach_id,branch_id) VALUES(${q(accounts.coach.id)},${q(f.branch)}),(${q(accounts.head.id)},${q(f.branch)});
 INSERT INTO coach_assignment_groups(id,schedule_slot_id,coach_id,name,created_by) VALUES(${q(group)},${q(f.slot)},${q(accounts.coach.id)},'QA กลุ่ม',${q(accounts.sa.id)});
 ${f.ids.map((id,i)=>`INSERT INTO coach_assignment_group_students(group_id,booking_session_id,student_id,student_type) VALUES(${q(group)},${q(id)},${q(f.children[i]||accounts.owner.id)},${q(f.children[i]?'child':'adult')});`).join('')}`)
}
async function good(course,actor,admin,family=false){
 const f=fixture(course,family);assign(f);const before=money(f),r=await store(f,actor,admin);assert.ifError(r.error)
 const ns=notices(r.data.credit_id), title=admin?'แอดมิน '+(sql(`SELECT coalesce(nullif(btrim(full_name),''),'(ไม่ระบุชื่อ)') FROM profiles WHERE id=${q(actor.id)}`))+' เก็บรอบเรียนให้':'ผู้ใช้เก็บรอบเรียนเข้ากระเป๋าเอง'
 check(course+' '+(family?'family ':'')+title,ns.length>=3&&ns.every(n=>n.title===title&&n.type==='schedule'&&n.message.includes('รอบนี้เหลือผู้เรียน 0 คน')&&n.message.includes('QA กลุ่ม')))
 check('exact recipients and links '+f.booking,ns.some(n=>n.user_id===accounts.coach.id&&n.link_url==='/coach/notifications')&&ns.some(n=>n.user_id===accounts.sa.id&&n.link_url==='/admin/schedules')&&!ns.some(n=>n.user_id===accounts.owner.id))
 check('money and identity '+f.booking,money(f)===before&&Number(sql(`SELECT count(*) FROM lesson_wallet_credit_members WHERE credit_id=${q(r.data.credit_id)}`))===f.ids.length)
 const repeat=await store(f,actor,admin,r.request);assert.ifError(repeat.error)
 check('replay has no new credit/notice '+f.booking,repeat.data.credit_id===r.data.credit_id&&JSON.stringify(notices(r.data.credit_id))===JSON.stringify(ns))
 records.push({f,credit:r.data.credit_id,notices:ns});return {f,r,ns}
}
try{
 for(const name of ['kids_group','adult_group','private'])sql(`INSERT INTO course_types(name,max_students,duration_hours) SELECT ${q(name)},6,${name==='private'?1:2} WHERE NOT EXISTS(SELECT 1 FROM course_types WHERE name=${q(name)});`)
 sql("DO $$ BEGIN IF EXISTS(SELECT 1 FROM task10_policy_activation WHERE effective_at IS NULL) THEN PERFORM task10_bootstrap_catalogs_v1();END IF;END $$;UPDATE task10_policy_activation SET state='active',effective_at=coalesce(effective_at,clock_timestamp()-interval '1 day'),makeup_enabled=true;UPDATE admin_makeup_credit_control SET enabled=true,store_once_enabled=true;")
 sql(`INSERT INTO system_settings(key,value) VALUES('admin_menu_permissions','{"adminAllowedMenuKeys":["makeup","notifications"]}') ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value;`)
 for(const [k,role,name] of [['owner','user','QA ผู้ปกครอง'],['sa','super_admin','QA สุดยอดแอดมิน 🏸'],['admin','admin','QA แอดมิน นัทตี้ 🎊'],['coach','coach','QA โค้ช'],['head','head_coach','QA หัวหน้าโค้ช']])accounts[k]=await fixtures.account(role,name)
 // A real baseline transaction must exhibit the old misleading title.
 sql(fs.readFileSync(root+'/baseline-effects.sql','utf8'))
 const old=await store(fixture(),accounts.owner);assert.ifError(old.error)
 const oldNotices=notices(old.data.credit_id);check('baseline reproduces misleading title',oldNotices.length>0&&oldNotices.every(n=>n.title==='ผู้เรียนเก็บรอบเรียนเข้ากระเป๋า'))
 const protectedBefore=sql("SELECT md5(string_agg(proname||pg_get_functiondef(p.oid)||coalesce(proacl::text,''),'' ORDER BY p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND proname<>'lesson_source_effects_v1'")
 const migration=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_wallet_store_notice_actor_v1.sql'));sql(fs.readFileSync('supabase/migrations/'+migration,'utf8'))
 const candidate=fs.readFileSync(root+'/candidate-effects.sql','utf8').trim().replace(/;$/,'').trim()
 check('candidate function matches tested migration',def().trim()===candidate)
 for(const course of ['kids_group','adult_group','private']){
  await good(course,accounts.owner,false,course==='private')
  await good(course,accounts.admin,true,course==='private')
  await good(course,accounts.sa,true,course==='private')
 }
 const originalName=sql(`SELECT full_name FROM profiles WHERE id=${q(accounts.admin.id)}`)
 for(const name of ['   ','QA แอดมินชื่อยาวมาก 🏸🎊 '.repeat(5)]){
  sql(`UPDATE profiles SET full_name=${q(name)} WHERE id=${q(accounts.admin.id)}`);await good('kids_group',accounts.admin,true)
 }
 sql(`UPDATE profiles SET full_name=${q(originalName)} WHERE id=${q(accounts.admin.id)}`)
 check('old notices and name snapshot retained',JSON.stringify(notices(old.data.credit_id))===JSON.stringify(oldNotices)&&records.filter(r=>r.notices[0].title.includes('ชื่อยาว')).every(r=>notices(r.credit)[0].title===r.notices[0].title))
 // Same-transaction source timestamp proves the exact 48-hour boundary without timing guesses.
 for(const course of ['kids_group','adult_group','private'])for(const [label,offset,pass] of [['over48','48 hours 1 minute',true],['exact48','48 hours',false],['under48','47 hours 59 minutes',false]]){
  const f=fixture(course);const result=sql(`BEGIN;
   SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);
   UPDATE schedule_templates SET day_of_week=extract(dow FROM (transaction_timestamp()+interval '${offset}') AT TIME ZONE 'Asia/Bangkok'),start_time=((transaction_timestamp()+interval '${offset}') AT TIME ZONE 'Asia/Bangkok')::time,end_time=((transaction_timestamp()+interval '${offset}'+interval '1 hour') AT TIME ZONE 'Asia/Bangkok')::time WHERE id=${q(f.template)};
   UPDATE schedule_slots SET date=((transaction_timestamp()+interval '${offset}') AT TIME ZONE 'Asia/Bangkok')::date,start_time=((transaction_timestamp()+interval '${offset}') AT TIME ZONE 'Asia/Bangkok')::time,end_time=((transaction_timestamp()+interval '${offset}'+interval '1 hour') AT TIME ZONE 'Asia/Bangkok')::time WHERE id=${q(f.slot)};
   UPDATE booking_sessions SET date=((transaction_timestamp()+interval '${offset}') AT TIME ZONE 'Asia/Bangkok')::date,start_time=((transaction_timestamp()+interval '${offset}') AT TIME ZONE 'Asia/Bangkok')::time,end_time=((transaction_timestamp()+interval '${offset}'+interval '1 hour') AT TIME ZONE 'Asia/Bangkok')::time WHERE id=${q(f.ids[0])};
   DO $b$ BEGIN BEGIN PERFORM lesson_source_transition_v1(${q(accounts.owner.id)},'store',${q(f.ids[0])},'{}');IF NOT ${pass} THEN RAISE EXCEPTION 'UNEXPECTED_BOUNDARY_SUCCESS';END IF;EXCEPTION WHEN OTHERS THEN IF ${pass} OR SQLERRM<>'LESSON_WALLET_UNIT_NOT_STORABLE' THEN RAISE;END IF;END;END $b$;
   SELECT count(*) FROM lesson_wallet_credits WHERE booking_id=${q(f.booking)};COMMIT;`)
  check(course+' '+label+' cutoff preserved',result.split('\n').filter(Boolean).at(-1)===(pass?'1':'0'))
 }
 // Admin can retain the existing near-start exception.
 const near=fixtures.fixture('kids_group',false,accounts.owner,sql('SELECT current_date::text'),sql("SELECT (localtime-interval '15 minutes')::text"),sql("SELECT (localtime+interval '45 minutes')::text"));const nearR=await store(near,accounts.admin,true);assert.ifError(nearR.error);check('admin keeps timing waiver',notices(nearR.data.credit_id).every(n=>n.title.startsWith('แอดมิน ')))
 const fail=fixture();const beforeFail=money(fail)
 sql("CREATE FUNCTION wallet_notice_qa_fail() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.title='ผู้ใช้เก็บรอบเรียนเข้ากระเป๋าเอง' THEN RAISE EXCEPTION 'WALLET_NOTICE_INJECTED_FAILURE';END IF;RETURN NEW;END$$;CREATE TRIGGER wallet_notice_qa_fail BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION wallet_notice_qa_fail();")
 try{const r=await store(fail,accounts.owner);check('notification failure injected',r.error?.message.includes('WALLET_NOTICE_INJECTED_FAILURE'));check('failed notice rolls back transaction',sql(`SELECT count(*) FROM lesson_wallet_credits WHERE booking_id=${q(fail.booking)}`)==='0'&&sql(`SELECT status FROM booking_sessions WHERE id=${q(fail.ids[0])}`)==='scheduled'&&money(fail)===beforeFail)}finally{sql('DROP TRIGGER wallet_notice_qa_fail ON notifications;DROP FUNCTION wallet_notice_qa_fail()')}
 check('all other functions and grants retained',protectedBefore===sql("SELECT md5(string_agg(proname||pg_get_functiondef(p.oid)||coalesce(proacl::text,''),'' ORDER BY p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND proname<>'lesson_source_effects_v1'"))
 check('candidate still active after all tests',def().trim()===candidate)
 fs.writeFileSync(root+'/fixture.private.json',JSON.stringify({accounts,password:fixtures.password,records},null,2))
 fs.writeFileSync(out+'/pass.json',JSON.stringify({passed:true,checks,definitionHash:hash(fs.readFileSync(import.meta.filename)),candidateHash:hash(candidate),records},null,2));console.log(JSON.stringify({passed:true,count:checks.length,out}))
}catch(error){fs.writeFileSync(out+'/failure.json',JSON.stringify({error:String(error),checks,stack:error.stack},null,2));throw error}
