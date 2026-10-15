import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { run,sql,q,Session,account,seed,snapshot,saveSql,storeSql,observedWait,db } from './local-db.mjs';
const owner=await account('user'),actor=await account('super_admin'),coach=await account('coach'),other=await account('coach');
const results=[];
const facts=f=>JSON.parse(sql(`SELECT jsonb_build_object('credits',(SELECT count(*) FROM lesson_wallet_credits WHERE booking_id=${q(f.booking)}),'members',(SELECT count(*) FROM coach_assignment_group_students WHERE booking_session_id=${q(f.ids[0])}),'status',(SELECT status FROM booking_sessions WHERE id=${q(f.ids[0])}));`));
for(const version of ['v2','v3']){
 const f=seed(owner,[coach,other]);sql(saveSql(f,actor,coach));const baseline=snapshot(f);
 const a=new Session('a5-save-prefix-'+randomUUID()),name='a5-store-'+randomUUID(),b=new Session(name);
 await a.send(`BEGIN;SELECT id FROM schedule_slots WHERE id=${q(f.slot)} FOR UPDATE;SELECT id FROM booking_sessions WHERE id=ANY(ARRAY[${f.ids.map(q)}]::uuid[]) ORDER BY id FOR UPDATE;`);
 const pending=b.send('BEGIN;'+storeSql(f,owner)+'COMMIT;').then(value=>({ok:true,value}),e=>({ok:false,error:e.message}));
 const wait=await observedWait(name);
 const save=await a.send(saveSql(f,actor,other,baseline,version)+'COMMIT;').then(value=>({ok:true,value}),e=>({ok:false,error:e.message}));
 const store=await pending;a.close();b.close();
 assert.equal(save.ok,false);assert.match(save.error,/55P03/);assert.equal(store.ok,true);assert.deepEqual(facts(f),{credits:1,members:0,status:'walleted'});
 results.push({version,wait,save,store,final:facts(f)});
}
const stress=[];
for(let n=0;n<100;n++){
 const f=seed(owner,[coach,other],n%5===0?3:2);sql(saveSql(f,actor,coach));const expected=snapshot(f);
 const payload=JSON.parse(JSON.stringify([{name:'กลุ่มทดสอบ',coachId:other.id,levelMin:0,levelMax:0,sortOrder:0,studentSessionIds:f.ids}]));
 const params={p_schedule_slot_id:f.slot,p_actor_id:actor.id,p_groups:payload,p_expected_groups:expected};
 const store=()=>db.rpc('lesson_source_transition_v1',{p_actor_id:owner.id,p_operation:'store',p_id:f.ids[0],p_payload:{}});
 const save=()=>db.rpc('save_coach_assignment_groups_v3',params);
 const [first,second,read]=await Promise.all([...(n%2?[store(),save()]:[save(),store()]),db.rpc('lesson_wallet_store_confirmation_v1',{p_actor_id:owner.id,p_session_id:f.ids[0]})]);
 assert.equal(read.error,null);assert.equal(typeof read.data,'boolean');
 const s=n%2?first:second,a=n%2?second:first;
 for(const result of [s,a]) if(result.error){assert.notEqual(result.error.code,'40P01');assert.match(result.error.code+' '+result.error.message,/55P03|LESSON_SOURCE_LOCK_CONFLICT|BASELINE_CONFLICT|ROSTER_CONFLICT|ATTENDANCE_RETRY/);}
 // Retry only a returned aborted transaction. The original actor/source/payload stay fixed.
 if(s.error){const retry=await store();assert.equal(retry.error,null);}
 assert.deepEqual(facts(f),{credits:1,members:0,status:'walleted'});
 const replay=await store();assert.equal(replay.error,null);assert.deepEqual(facts(f),{credits:1,members:0,status:'walleted'});
 const confirmed=await db.rpc('lesson_wallet_store_confirmation_v1',{p_actor_id:owner.id,p_session_id:f.ids[0]});assert.equal(confirmed.error,null);assert.equal(confirmed.data,true);
 stress.push({n,store:s.error?.code||'ok',save:a.error?.code||'ok'});
 if((n+1)%20===0)console.log('Concurrent pairs',n+1,'passed');
}
const schema=JSON.parse(sql("SELECT jsonb_build_object('migrations',(SELECT count(*) FROM supabase_migrations.schema_migrations),'functions',(SELECT jsonb_object_agg(p.oid::regprocedure::text,md5(replace(pg_get_functiondef(p.oid),E'\\r\\n',E'\\n'))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('save_coach_assignment_groups_v2','save_coach_assignment_groups_v3','lesson_source_transition_v1','lesson_wallet_store_confirmation_v1')));"));
const proof={at:new Date().toISOString(),target:run.target,schema,controlled:results,concurrentPairs:stress};
fs.writeFileSync(run.outputDir+'/concurrency-'+randomUUID()+'.json',JSON.stringify(proof,null,2),{flag:'wx'});
console.log('Controlled v2/v3 +100 concurrent pairs passed');
