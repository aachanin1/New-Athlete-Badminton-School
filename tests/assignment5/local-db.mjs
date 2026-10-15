import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { verifyLessonSourceTarget, lessonSourceEnvironment } from '../../scripts/verify-lesson-source-test-target.mjs';
export const run = verifyLessonSourceTarget();
export const env = lessonSourceEnvironment();
export const db = createClient(env.apiUrl,env.serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
export const q = value => "'"+String(value).replaceAll("'","''")+"'";
export const container='supabase_db_'+run.target.project;
export function sql(value) { return execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],{input:value,encoding:'utf8',stdio:['pipe','pipe','pipe'],windowsHide:true}).trim(); }
export class Session {
  constructor(name) {
    this.out='';this.err='';this.dead=false;this.pending=null;
    this.child=spawn('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],{windowsHide:true});
    this.child.stdout.on('data',d=>{this.out+=d;this.check();});
    this.child.stderr.on('data',d=>{this.err+=d;});
    this.child.on('close',code=>{this.dead=true;if(this.pending){this.pending.reject(Error(this.err||'psql exit '+code));this.pending=null;}});
    this.child.stdin.write(`SET application_name=${q(name)}; SET statement_timeout='20s';\n\\set VERBOSITY verbose\n`);
  }
  check(){if(this.pending&&this.out.includes(this.pending.marker)){const p=this.pending;this.pending=null;const result=this.out.slice(0,this.out.indexOf(p.marker)).trim();this.out=this.out.slice(this.out.indexOf(p.marker)+p.marker.length);p.resolve(result);}}
  send(command){if(this.pending||this.dead)throw Error('Session unavailable');const marker='done_'+randomUUID();return new Promise((resolve,reject)=>{this.pending={marker,resolve,reject};this.child.stdin.write(command+'\n\\echo '+marker+'\n');});}
  close(){this.child.stdin.end();}
}
export async function account(role){const email=`assignment5-${randomUUID()}@example.com`;const r=await db.auth.admin.createUser({email,password:'Assignment5Local!2026',email_confirm:true});if(r.error)throw r.error;const id=r.data.user.id;const u=await db.from('profiles').update({role,full_name:'ทดสอบ '+role}).eq('id',id);if(u.error)throw u.error;return{id,email};}
let day=1;
export function seed(owner,coaches,count=2,courseName='kids_group'){
  const [booking,branch,slot,template]=Array.from({length:4},randomUUID),ids=Array.from({length:count},randomUUID),children=ids.map((_,i)=>courseName==='adult_group'||(courseName==='private'&&i===0)?null:randomUUID());
  const date=new Date(Date.UTC(2032,10,++day)).toISOString().slice(0,10),course=sql(`SELECT id FROM course_types WHERE name=${q(courseName)};`);
  sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);SELECT set_config('task10.payment_write','authorized',true);
    INSERT INTO branches(id,name,slug) VALUES(${q(branch)},'ทดสอบ Assignment5',${q('a5-'+branch)});
    ${coaches.map(c=>`INSERT INTO coach_branches(coach_id,branch_id) VALUES(${q(c.id)},${q(branch)});`).join('')}
    ${children.filter(Boolean).map(c=>`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(c)},${q(owner.id)},'เด็กทดสอบ','เด็กทดสอบ');`).join('')}
    INSERT INTO bookings(id,user_id,learner_type,child_id,branch_id,course_type_id,month,year,total_sessions,total_price,status) VALUES(${q(booking)},${q(owner.id)},${q(courseName==='kids_group'?'child':'self')},${courseName==='kids_group'?q(children[0]):'NULL'},${q(branch)},${q(course)},${Number(date.slice(5,7))},${date.slice(0,4)},1,500,'verified');
    INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(template)},${q(branch)},${q(course)},extract(dow FROM date ${q(date)}),'15:00','16:00',true);
    INSERT INTO schedule_slots(id,template_id,branch_id,course_type_id,date,start_time,end_time,status) VALUES(${q(slot)},${q(template)},${q(branch)},${q(course)},${q(date)},'15:00','16:00','open');
    ${ids.map((id,i)=>`INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup) VALUES(${q(id)},${q(booking)},${q(slot)},${q(date)},'15:00','16:00',${q(branch)},${children[i]?q(children[i]):'NULL'},'scheduled',false);`).join('')}
    COMMIT;`);return{booking,branch,slot,template,course,ids,children,date};
}
export const groups=(f,coach)=>[{name:'กลุ่มทดสอบ',coachId:coach?.id||null,levelMin:0,levelMax:0,sortOrder:0,studentSessionIds:f.ids}];
export const snapshot=f=>JSON.parse(sql(`SELECT coach_assignment_slot_snapshot_v2(${q(f.slot)})->'groups';`));
export const saveSql=(f,actor,coach,expected=snapshot(f),version='v3')=>version==='v2'?`SELECT save_coach_assignment_groups_v2(${q(f.slot)},${q(actor.id)},${q(JSON.stringify(groups(f,coach)))}::jsonb);`:`SELECT save_coach_assignment_groups_v3(${q(f.slot)},${q(actor.id)},${q(JSON.stringify(groups(f,coach)))}::jsonb,${q(JSON.stringify(expected))}::jsonb);`;
export const storeSql=(f,owner)=>`SELECT lesson_source_transition_v1(${q(owner.id)},'store',${q(f.ids[0])},'{}');`;
export function paymentEvidence(f,owner){
 const course=f.course||sql(`SELECT course_type_id FROM bookings WHERE id=${q(f.booking)};`);
 sql(`BEGIN;SELECT set_config('task10.payment_write','authorized',true);INSERT INTO payments(booking_id,user_id,amount,status,verified_at) VALUES(${q(f.booking)},${q(owner.id)},500,'approved',clock_timestamp());INSERT INTO pricing_tiers(course_type_id,min_sessions,max_sessions,price_per_session,package_price,valid_from) SELECT ${q(course)},1,1,500,500,'2020-01-01' WHERE NOT EXISTS(SELECT 1 FROM pricing_tiers WHERE course_type_id=${q(course)});COMMIT;`);
}
export const observedWait=async(name)=>{for(let n=0;n<50;n++){const value=sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('pid',pid,'wait',wait_event_type,'blockers',pg_blocking_pids(pid))),'[]') FROM pg_stat_activity WHERE application_name=${q(name)};`);const rows=JSON.parse(value);if(rows.some(r=>r.wait==='Lock'&&r.blockers.length))return rows;await new Promise(r=>setTimeout(r,100));}throw Error('No real overlap observed for '+name);};
