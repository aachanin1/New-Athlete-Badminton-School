import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {run,sql,q,Session,account,seed,saveSql,snapshot,db} from './local-db.mjs';
const owner=await account('user'),actor=await account('super_admin'),coach=await account('coach'),other=await account('coach');
const source=seed(owner,[coach,other]),sibling=seed(owner,[coach,other]);
const held=new Session('a5-sibling-source');
await held.send(`BEGIN;SELECT lesson_source_transition_v1(${q(owner.id)},'store',${q(source.ids[0])},'{}');`);
try{
 const response=await db.rpc('save_coach_assignment_groups_v3',{p_schedule_slot_id:sibling.slot,p_actor_id:actor.id,p_groups:[{name:'กลุ่มทดสอบ',coachId:coach.id,levelMin:0,levelMax:0,studentSessionIds:sibling.ids}],p_expected_groups:[]});
 assert.equal(response.error?.code,'55P03');
}finally{await held.send('COMMIT;');held.close();}
sql(saveSql(sibling,actor,coach));
assert.equal(snapshot(sibling)[0].coach_id,coach.id);
const family=[];
for(let n=0;n<10;n++){
 const f=seed(owner,[coach,other],3,'private');
 sql(`BEGIN;SELECT set_config('task10.payment_write','authorized',true);INSERT INTO payments(booking_id,user_id,amount,status,verified_at) VALUES(${q(f.booking)},${q(owner.id)},500,'approved',clock_timestamp());INSERT INTO pricing_tiers(course_type_id,min_sessions,max_sessions,price_per_session,package_price,valid_from) SELECT ${q(f.course)},1,1,500,500,'2020-01-01' WHERE NOT EXISTS(SELECT 1 FROM pricing_tiers WHERE course_type_id=${q(f.course)});COMMIT;`);
 sql(saveSql(f,actor,coach));const baseline=snapshot(f);
 const args={p_actor_id:owner.id,p_operation:'store',p_id:f.ids[n%3],p_payload:{}};
 const [saved,stored]=await Promise.all([db.rpc('save_coach_assignment_groups_v3',{p_schedule_slot_id:f.slot,p_actor_id:actor.id,p_groups:[{name:'กลุ่มทดสอบ',coachId:other.id,levelMin:0,levelMax:0,studentSessionIds:f.ids}],p_expected_groups:baseline}),db.rpc('lesson_source_transition_v1',args)]);
 for(const result of [saved,stored])if(result.error){assert.notEqual(result.error.code,'40P01');assert.match(result.error.code+' '+result.error.message,/55P03|BASELINE_CONFLICT|ROSTER_CONFLICT|LOCK_CONFLICT|ATTENDANCE_RETRY/);}
 if(stored.error)assert.equal((await db.rpc('lesson_source_transition_v1',args)).error,null);
 const final=sql(`SELECT (SELECT count(*) FROM lesson_wallet_credits WHERE booking_id=${q(f.booking)})||'|'||(SELECT count(*) FROM booking_sessions WHERE id=ANY(ARRAY[${f.ids.map(q)}]::uuid[]) AND status='walleted')||'|'||(SELECT count(*) FROM coach_assignment_group_students WHERE booking_session_id=ANY(ARRAY[${f.ids.map(q)}]::uuid[]));`);
 assert.equal(final,'1|3|0');
 for(const id of f.ids){const replay=await db.rpc('lesson_source_transition_v1',{...args,p_id:id});assert.equal(replay.error,null);const confirm=await db.rpc('lesson_wallet_store_confirmation_v1',{p_actor_id:owner.id,p_session_id:id});assert.equal(confirm.error,null);assert.equal(confirm.data,true);}
 family.push({n,final});
}
const proof={at:new Date().toISOString(),project:run.target.project,sameParentDifferentSlot:true,familyConcurrentPairs:family};
fs.writeFileSync(run.outputDir+'/family-sibling-'+randomUUID()+'.json',JSON.stringify(proof,null,2),{flag:'wx'});
console.log('Same-parent sibling-slot +10 Family concurrent pairs/participant replays passed');
