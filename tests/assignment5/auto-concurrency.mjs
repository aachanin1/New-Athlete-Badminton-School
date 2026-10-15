import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {db,sql,q,run,account,seed,groups,Session,observedWait,paymentEvidence} from './local-db.mjs';

const owner=await account('user'),head=await account('head_coach'),coach=await account('coach');
const context=f=>JSON.parse(sql(`SELECT assignment5_context_v1(${q(f.slot)});`));
function intent(f,c){const proposed=groups(f,coach);return{id:randomUUID(),context:c,proposed,body:{groups:proposed,expectedGroups:c.groups,deadline:new Date(Date.now()+20_000).toISOString()}};}
async function admit(f,i,attempt=false){const r=await db.rpc('assignment5_admit_v1',{p_actor:head.id,p_slot:f.slot,p_request:i.id,p_intent:i.body,p_attempt:attempt});if(r.error)throw r.error;return r.data;}
const argumentsFor=(f,i)=>({p_actor:head.id,p_slot:f.slot,p_request:i.id,p_intent:i.body,p_groups:i.proposed,p_context:i.context});
async function retry(fn){for(let n=0;n<3;n++){const r=await fn();if(!r.error)return r.data;if(r.error.code==='40P01'||!['55P03','40001','57014'].includes(r.error.code))throw r.error;await new Promise(resolve=>setTimeout(resolve,250));}throw Error('Three attempts exhausted');}
const controlled=[];
// Store's committed effect is still uncommitted here; the new wrapper must
// abort immediately instead of waiting while it owns a conflicting lock prefix.
{
 const f=seed(owner,[head,coach]),i=intent(f,context(f));await admit(f,i);
 const held=new Session('a5-auto-store-held');
 await held.send(`BEGIN;SELECT lesson_source_transition_v1(${q(owner.id)},'store',${q(f.ids[0])},'{}');`);
 try{await admit(f,i,true);const first=await db.rpc('assignment5_save_v1',argumentsFor(f,i));assert.equal(first.error?.code,'55P03');}
 finally{await held.send('COMMIT;');held.close();}
 await admit(f,i,true);const result=await db.rpc('assignment5_save_v1',argumentsFor(f,i));assert.equal(result.error,null);assert.equal(result.data.removedSessionIds.length,1);
 controlled.push({order:'Store-held',typedAbort:'55P03',sameIntentCompletes:true});
}
{
 const f=seed(owner,[head,coach]),i=intent(f,context(f));await admit(f,i);await admit(f,i,true);
 const save=new Session('a5-auto-save-held'),store=new Session('a5-auto-store-wait');
 await save.send(`BEGIN;SELECT assignment5_save_v1(${q(head.id)},${q(f.slot)},${q(i.id)},${q(JSON.stringify(i.body))},${q(JSON.stringify(i.proposed))},${q(JSON.stringify(i.context))});`);
 const waiting=store.send(`SELECT lesson_source_transition_v1(${q(owner.id)},'store',${q(f.ids[0])},'{}');`);
 let waits;
 try{waits=await observedWait('a5-auto-store-wait');}finally{await save.send('COMMIT;');save.close();}
 await waiting;store.close();controlled.push({order:'Save-held',waits,sameIntentCompletes:true});
}
const pairs=[];
for(let n=0;n<110;n++){
 const family=n>=100,f=seed(owner,[head,coach],family?3:2,family?'private':'kids_group');if(family)paymentEvidence(f,owner);const i=intent(f,context(f));await admit(f,i);
 const [saved,stored]=await Promise.all([
  retry(async()=>{await admit(f,i,true);return db.rpc('assignment5_save_v1',argumentsFor(f,i));}),
  retry(()=>db.rpc('lesson_source_transition_v1',{p_actor_id:owner.id,p_operation:'store',p_id:f.ids[0],p_payload:{}}))
 ]);
 const final=JSON.parse(sql(`SELECT jsonb_build_object('credits',(SELECT count(*) FROM lesson_wallet_credits WHERE booking_id=${q(f.booking)}),'members',(SELECT count(*) FROM coach_assignment_group_students WHERE booking_session_id=ANY(ARRAY[${f.ids.map(q).join(',')}]::uuid[])),'walleted',(SELECT count(*) FROM booking_sessions WHERE booking_id=${q(f.booking)} AND status='walleted'));`));
 assert.equal(final.credits,1);assert.equal(final.members,family?0:1);assert.equal(final.walleted,family?3:1);
 const replay=await db.rpc('assignment5_save_v1',argumentsFor(f,i));assert.equal(replay.error,null);assert.equal(replay.data.replayed,true);
 const confirmation=await db.rpc('lesson_wallet_store_confirmation_v1',{p_actor_id:owner.id,p_session_id:f.ids[0]});assert.equal(confirmation.data,true);
 const storeReplay=await db.rpc('lesson_source_transition_v1',{p_actor_id:owner.id,p_operation:'store',p_id:f.ids[0],p_payload:{}});assert.equal(storeReplay.error,null);
 pairs.push({slot:f.slot,family,saved:true,stored:Boolean(stored),removed:saved.removedSessionIds,final});
 if(n%20===0)console.log('pairs',n+1);
}
const hashes=JSON.parse(sql("SELECT jsonb_object_agg(proname,md5(replace(pg_get_functiondef(oid),E'\\r\\n',E'\\n'))) FROM pg_proc WHERE pronamespace='public'::regnamespace AND (proname LIKE 'assignment5_%' OR proname IN ('save_coach_assignment_groups_v2','save_coach_assignment_groups_v3','lesson_source_transition_v1'));"));
const output=path.join(run.outputDir,'auto-concurrency-'+randomUUID()+'.json');
fs.writeFileSync(output,JSON.stringify({at:new Date().toISOString(),schema:Number(sql('SELECT count(*) FROM supabase_migrations.schema_migrations;')),epoch:sql('SELECT epoch FROM assignment5_epoch;'),controlled,hashes,pairs},null,2));console.log({controlled:controlled.length,pairs:100,family:10,report:output});
