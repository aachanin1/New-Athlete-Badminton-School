import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {run,sql,q} from './runtime.mjs'
import {fixture as f,body,session,create,read,snapshot,evidence} from './helpers.mjs'
const baseline=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'baseline-state.json'))),checks=[]
const check=(ok,name)=>{assert.ok(ok,name);checks.push(name);console.log(name)}
try{
 const ids=[baseline.past.booking,baseline.future.booking],before=snapshot(ids),input=body([session(f.dates.future,f.children[1],'17:00')])
 const count=()=>sql(`SELECT count(*)||'/'||(SELECT count(*) FROM booking_ux_requests WHERE actor_id=${q(f.parent.id)}) FROM bookings WHERE user_id=${q(f.parent.id)}`),originalCount=count()
 sql('BEGIN;'+baseline.beforeDefinitions.guard+';\n'+`DO $old$ BEGIN BEGIN PERFORM booking_ux_create_v1(${q(f.parent.id)},${q(randomUUID())},${q(JSON.stringify(input))}::jsonb);RAISE EXCEPTION 'BASELINE_NOT_REPRODUCED';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'PROGRESSIVE_BOOKING_CONFLICT' THEN RAISE;END IF;END;END $old$;ROLLBACK;`)
 check(count()===originalCount,'Final frozen definitions reproduce original guard failure with no persisted bill or receipt')
 assert.throws(()=>create(input),/TASK10_.*OVERLAP|TASK10_DUPLICATE_SESSION|PROGRESSIVE_DUPLICATE/)
 check(count()===originalCount,'Booking over an actual future Makeup for the attending child is rejected atomically')
 const alternate=baseline.past.rootIds[1],destination=baseline.past.destinations[0]
 sql(`BEGIN;SET LOCAL session_replication_role=replica;
 INSERT INTO lesson_wallet_credits(user_id,booking_id,original_session_id,redeemed_session_id,child_id,branch_id,course_type_id,original_date,original_start_time,original_end_time,status,expires_at)
 SELECT ${q(f.parent.id)},booking_id,id,${q(destination)},child_id,branch_id,${q(f.courses.kids_group)},date,start_time,end_time,'redeemed',clock_timestamp()+interval '1 year' FROM booking_sessions WHERE id=${q(alternate)};
 DO $ambiguous$ BEGIN IF progressive_proven_makeup_destination_v1(${q(destination)}) THEN RAISE EXCEPTION 'AMBIGUOUS_PROOF_ACCEPTED';END IF;END $ambiguous$;ROLLBACK;`)
 check(true,'Competing wallet and reschedule predecessors are rejected as ambiguous lineage')
 const bill=read(`SELECT to_jsonb(b) FROM bookings b WHERE b.user_id=${q(f.parent.id)} AND b.status='pending_payment' AND b.month=${+f.dates.month.slice(5,7)} AND b.year=${+f.dates.month.slice(0,4)} ORDER BY created_at DESC LIMIT 1`)
 assert.ok(bill)
 for(const status of ['paid','verified']){
  sql(`BEGIN;SET LOCAL session_replication_role=replica;UPDATE bookings SET status=${q(status)} WHERE id=${q(bill.id)};
  DO $settled$ BEGIN BEGIN PERFORM cancel_progressive_pending_booking_v1(${q(f.parent.id)},${q(bill.id)},${q(randomUUID())},(SELECT revision FROM booking_pricing_scopes WHERE id=${q(bill.pricing_scope_id)}));RAISE EXCEPTION 'SETTLED_CANCEL_ACCEPTED';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'PROGRESSIVE_BOOKING_NOT_PENDING' THEN RAISE;END IF;END;END $settled$;ROLLBACK;`)
  check(true,'Pending-only cancel still rejects '+status+' bill')
 }
 assert.deepEqual(snapshot(ids),before);check(true,'Boundary probes leave original source and official Makeup evidence unchanged')
 const file=evidence('boundaries-pass',{checks});console.log(JSON.stringify({passed:checks.length,evidence:file}))
}catch(error){evidence('boundaries-failed',{checks,error:String(error),stderr:String(error.stderr||'')});throw error}
