import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {randomUUID,createHash} from 'node:crypto'
import {fixtures,run,db,sql,q} from './runtime.mjs'
export {fixtures,run,db,sql,q,randomUUID}
export const read=s=>JSON.parse(sql(s))
export const rejects=(statement,code)=>assert.throws(()=>sql(statement),e=>String(e.stderr||e.message).includes(code))
export const output=label=>{const dir=path.join(run.outputDir,label+'-'+Date.now());fs.mkdirSync(dir,{recursive:true});return dir}
export const preview=(actor,f)=>read(`SELECT admin_no_class_return_v1(${q(actor.id)},${q(f.ids[0])},'preview');`)
export const command=(actor,f,p,request=randomUUID(),reason='ไม่ได้เปิดสอน ทดสอบคืนสิทธิ์เดิม')=>`SELECT admin_no_class_return_v1(${q(actor.id)},${q(f.ids[0])},'commit',${q(request)},${q(p.scopeFingerprint)},${q(reason)});`
export const status=(actor,f,request)=>read(`SELECT admin_no_class_return_v1(${q(actor.id)},${q(f.ids[0])},'status',${q(request)});`)
export const authorized=body=>`BEGIN;SET LOCAL lesson_source.write='authorized';SET LOCAL task10.source_write='authorized';SET LOCAL task10.payment_write='authorized';${body}COMMIT;`
export function seed(){
 for(const name of ['kids_group','adult_group','private'])sql(`INSERT INTO course_types(name,max_students,duration_hours) SELECT ${q(name)},1000,1 WHERE NOT EXISTS(SELECT 1 FROM course_types WHERE name=${q(name)});`)
 sql(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM task10_policy_activation WHERE effective_at IS NULL) THEN PERFORM task10_bootstrap_catalogs_v1();END IF;END $$;
 UPDATE task10_policy_activation SET state='active',effective_at=coalesce(effective_at,clock_timestamp()-interval '2 days'),makeup_enabled=true;
 UPDATE admin_makeup_credit_control SET enabled=true,store_once_enabled=true,writer_hash=md5(pg_get_functiondef('public.lesson_source_transition_v1(uuid,text,uuid,jsonb)'::regprocedure));
 INSERT INTO system_settings(key,value) VALUES('admin_menu_permissions','{"adminAllowedMenuKeys":["makeup"]}') ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value;`)
}
export async function actors(){return {admin:await fixtures.account('super_admin','คืนสิทธิ์ ผู้ดูแล'),menu:await fixtures.account('admin','คืนสิทธิ์ แอดมิน'),parent:await fixtures.account('user','คืนสิทธิ์ ผู้ปกครอง'),coach:await fixtures.account('coach','คืนสิทธิ์ โค้ชเอ'),other:await fixtures.account('coach','คืนสิทธิ์ โค้ชบี')}}
export function round(a,course='kids_group',{family=false,hours=1,count=1,assigned=true,date,coach=a.coach}={}){
 date||=sql("SELECT ((clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date-1);")
 const f=fixtures.fixture(course,family,a.parent,date,'11:00',hours===2?'13:00':'12:00'),group=randomUUID()
 if(!family&&count>1){
  const extra=Array.from({length:count-1},()=>({id:randomUUID(),child:course==='kids_group'?randomUUID():null}));
  sql(authorized(extra.map(x=>`${x.child?`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(x.child)},${q(a.parent.id)},'ทดสอบรายชื่อเต็ม','ผู้เรียน ${x.id.slice(0,8)}');`:''}
   INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup) VALUES(${q(x.id)},${q(f.booking)},${q(f.slot)},${q(date)},${q(f.start)},${q(f.end)},${q(f.branch)},${q(x.child)},'scheduled',false);`).join('\n')))
  f.ids.push(...extra.map(x=>x.id));f.children.push(...extra.map(x=>x.child))
 }
 if(assigned)sql(`INSERT INTO coach_assignment_groups(id,schedule_slot_id,coach_id,name,created_by) VALUES(${q(group)},${q(f.slot)},${q(coach.id)},'คืนสิทธิ์ กลุ่มทดสอบ',${q(a.admin.id)});
  ${f.ids.map((id,i)=>`INSERT INTO coach_assignment_group_students(group_id,booking_session_id,student_id,student_type) VALUES(${q(group)},${q(id)},${q(f.children[i]||a.parent.id)},${q(f.children[i]?'child':'adult')});`).join('\n')}`)
 return {...f,group:assigned?group:null,coach:assigned?coach:null}
}
export function attend(f,a,index=0,status='present'){
 return authorized(`INSERT INTO attendance(booking_session_id,student_id,student_type,coach_id,status) VALUES(${q(f.ids[index])},${q(f.children[index]||a.parent.id)},${q(f.children[index]?'child':'adult')},${q(a.coach.id)},${q(status)});UPDATE booking_sessions SET status=${q(status==='absent'?'absent':'completed')} WHERE id=${q(f.ids[index])};`)
}
export function money(a){return read(`SELECT jsonb_build_object(
 'bookings',(SELECT md5(coalesce(string_agg(to_jsonb(b)::text,'' ORDER BY id),'')) FROM bookings b WHERE user_id=${q(a.parent.id)}),
 'payments',(SELECT md5(coalesce(string_agg(to_jsonb(p)::text,'' ORDER BY id),'')) FROM payments p WHERE user_id=${q(a.parent.id)}),
 'coupons',(SELECT md5(coalesce(string_agg(to_jsonb(c)::text,'' ORDER BY id),'')) FROM coupons c),
 'couponUses',(SELECT md5(coalesce(string_agg(to_jsonb(c)::text,'' ORDER BY id),'')) FROM coupon_usages c));`)}
export function finish(dir,checks,extra={}){
 const files=[...fs.readdirSync('supabase/migrations').filter(f=>f.startsWith('20261104')&&f.endsWith('.sql')).map(f=>'supabase/migrations/'+f),import.meta.filename,...['db.mjs','concurrency.mjs','lifecycle.mjs','browser.mjs'].map(f=>path.join(path.dirname(import.meta.filename),f))].filter(f=>fs.existsSync(f));
 const result={passed:true,at:new Date().toISOString(),runId:run.runId,target:run.target,checks,hashes:Object.fromEntries(files.map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),...extra};
 fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({dir,passed:checks.length}));return result
}
export function failure(dir,checks,e){fs.writeFileSync(path.join(dir,'failure.json'),JSON.stringify({checks,error:e.stack,stderr:e.stderr?.toString()},null,2));console.error(e.stderr?.toString()||e);console.error(dir);process.exitCode=1}
