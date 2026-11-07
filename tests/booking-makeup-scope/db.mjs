import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { run,sql,q,concurrentSql } from './runtime.mjs'
import { fixture as f,read,rpc,historical,body,session,create,snapshot,evidence,hashFile } from './helpers.mjs'
const baseline=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'baseline-state.json'))),checks=[]
const check=(value,name)=>{assert.ok(value,name);checks.push(name);console.log(name)}
const guard=`public.progressive_assert_scope_membership_v1((SELECT id FROM booking_pricing_scopes WHERE user_id=${q(f.parent.id)} AND course_type_id=${q(f.courses.kids_group)} AND lesson_year=${+f.dates.month.slice(0,4)} AND lesson_month=${+f.dates.month.slice(5,7)}),${q(f.parent.id)},${q(f.courses.kids_group)},${+f.dates.month.slice(0,4)},${+f.dates.month.slice(5,7)})`
const snake=sessions=>sessions.map(s=>({date:s.date,start_time:s.startTime,end_time:s.endTime,branch_id:s.branchId,child_id:s.childId,schedule_template_id:s.scheduleTemplateId}))
try{
 check([...baseline.past.destinations,...baseline.future.destinations].every(id=>sql(`SELECT progressive_proven_makeup_destination_v1(${q(id)})`)==='t'),'Completed and scheduled sibling Makeup destinations have proven original lineage')
 check(sql("SELECT bool_and(NOT has_function_privilege(role,'public.progressive_proven_makeup_destination_v1(uuid)','EXECUTE')) FROM unnest(ARRAY['anon','authenticated','service_role']) role;")==='t','New helper is private to internal function owners')
 const key=randomUUID(),input=body([session(f.dates.future,f.children[0],'10:00')]),created=create(input,key)
 check(created.totalPrice===700&&created.status==='pending_payment','New monthly purchase succeeds at700; three old Makeup rows do not enter purchased tier')
 check(create(input,key).bookingId===created.bookingId,'Lost-response replay returns the same bill')
 assert.deepEqual(snapshot([baseline.past.booking,baseline.future.booking]),baseline.original)
 check(true,'Old bills, sessions, Makeup uses and payments remain byte-equivalent')
 assert.throws(()=>create(body([session(f.dates.future,f.children[0],'10:00')])),/TASK10_.*OVERLAP|TASK10_DUPLICATE_SESSION|PROGRESSIVE_DUPLICATE/)
 check(sql(`SELECT count(*) FROM bookings WHERE user_id=${q(f.parent.id)} AND month=${input.month} AND year=${input.year} AND status='pending_payment'`)==='1','Duplicate learner time is rejected with no extra active bill')
 const round=session(f.dates.future,f.children[0],'17:00'),policy=rpc('task10_booking_policy_quote_v1',`${q(f.parent.id)},${q(f.courses.kids_group)},${q(f.dates.month)},'progressive',${q(created.bookingId)}`)
 const updated=rpc('task10_update_progressive_booking_v1',`${q(f.parent.id)},${q(created.bookingId)},${q(f.branch)},${q(JSON.stringify(snake([round])))}::jsonb,${q(randomUUID())},${body([round]).expectedScopeRevision},${q(policy.fingerprint)}`)
 check(updated.bookingId===created.bookingId,'Shared guard also allows editing pending bill after cross-month Makeup')
 const cancelKey=randomUUID(),cancelArgs=`${q(f.parent.id)},${q(created.bookingId)},${q(cancelKey)},${body([round]).expectedScopeRevision}`
 const cancelled=rpc('cancel_progressive_pending_booking_v1',cancelArgs)
 check(cancelled.bookingId===created.bookingId&&sql(`SELECT status FROM bookings WHERE id=${q(created.bookingId)}`)==='cancelled','Shared guard also allows cancelling pending bill')
 check(rpc('cancel_progressive_pending_booking_v1',cancelArgs).idempotentReplay===true,'Cancel replay is idempotent')
 const mutations=[
  ['missing official receipt',`DELETE FROM task10_family_makeup_uses WHERE destination_session_id=${q(baseline.past.destinations[0])}`],
  ['a flag without a valid destination',`UPDATE booking_sessions SET is_makeup=false WHERE id=${q(baseline.past.destinations[0])}`],
  ['wrong parent receipt',`UPDATE task10_family_makeup_uses SET parent_id=${q(f.other.id)} WHERE destination_session_id=${q(baseline.past.destinations[0])}`],
  ['wrong attending child receipt',`UPDATE task10_family_makeup_uses SET attending_child_id=${q(f.children[1])} WHERE destination_session_id=${q(baseline.past.destinations[0])}`],
  ['foreign source child',`UPDATE task10_family_makeup_uses SET source_child_id=${q(f.foreignChild)} WHERE destination_session_id=${q(baseline.past.destinations[0])}`],
  ['missing predecessor',`UPDATE booking_sessions SET rescheduled_from_id=NULL WHERE id=${q(baseline.past.destinations[0])}`],
  ['cyclic source',`UPDATE booking_sessions SET rescheduled_from_id=id WHERE id=${q(baseline.past.rootIds[0])}`],
  ['corrupt original Makeup flag',`UPDATE booking_sessions SET is_makeup=true WHERE id=${q(baseline.past.rootIds[0])}`],
  ['source scope identity mismatch',`UPDATE booking_pricing_scopes SET currency='USD' WHERE id=${q(baseline.past.scope)}`],
  ['same-month bill in a different scope',`UPDATE bookings SET month=${input.month},year=${input.year} WHERE id=${q(baseline.past.booking)}`],
 ]
 for(const [label,change] of mutations){
  sql(`BEGIN;SET LOCAL session_replication_role=replica;${change};DO $negative$ BEGIN BEGIN PERFORM ${guard};RAISE EXCEPTION 'NEGATIVE_NOT_REJECTED';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'PROGRESSIVE_BOOKING_CONFLICT' THEN RAISE;END IF;END;END $negative$;ROLLBACK;`)
  check(true,'Corruption still rejected: '+label)
 }
 for(const status of ['rescheduled','walleted']){
  sql(`BEGIN;SET LOCAL session_replication_role=replica;UPDATE booking_sessions SET status=${q(status)} WHERE id=${q(baseline.past.destinations[0])};SELECT ${guard};ROLLBACK;`)
  check(true,'Proven historical destination does not block after status '+status)
 }
 sql(`BEGIN;SET LOCAL session_replication_role=replica;UPDATE booking_sessions SET cancelled_at=clock_timestamp() WHERE id=${q(baseline.past.destinations[0])};SELECT ${guard};ROLLBACK;`)
 check(true,'Proven historical destination does not block after cancellation timestamp')
 const monthPlus2=sql(`SELECT (date ${q(f.dates.month)}+interval '2 months 10 days')::date`)
 const distant=historical({targetDate:monthPlus2,status:'scheduled'})
 check(sql(`SELECT progressive_proven_makeup_destination_v1(${q(distant.destinations[0])})`)==='t','Accepted Admin source remains valid beyond next month and over year boundary')
 const distantPurchase=create(body([session(monthPlus2,f.children[1],'10:00')]))
 check(distantPurchase.totalPrice===700,'New purchase in distant destination month succeeds without historical repricing')
 const concurrentInput=body([session(f.dates.future,f.children[0],'10:00')]),concurrentKey=randomUUID()
 const statement=`SELECT booking_ux_create_v1(${q(f.parent.id)},${q(concurrentKey)},${q(JSON.stringify(concurrentInput))}::jsonb);`
 const outputs=await Promise.all([concurrentSql(statement),concurrentSql(statement)])
 const results=outputs.map(JSON.parse)
 check(results[0].bookingId===results[1].bookingId&&results.some(r=>r.idempotentReplay),'Two real concurrent requests commit only one bill')
 assert.deepEqual(snapshot([baseline.past.booking,baseline.future.booking]),baseline.original)
 check(true,'Old evidence is unchanged after edit/cancel/replay and concurrent creation')
 const file=evidence('db-pass',{checks,created,updated,cancelled,distantPurchase,concurrentBill:results[0].bookingId,migrationHash:hashFile('supabase/migrations/20261107060410_booking_makeup_scope_membership_v1.sql'),suiteHash:hashFile('tests/booking-makeup-scope/db.mjs')})
 fs.writeFileSync(path.join(run.outputDir,'db-state-'+Date.now()+'-'+randomUUID()+'.json'),JSON.stringify({created,cancelled,distant,concurrentBill:results[0].bookingId,file},null,2),{flag:'wx'})
 console.log(JSON.stringify({passed:checks.length,evidence:file}))
}catch(error){evidence('db-failed',{checks,error:String(error),stderr:String(error.stderr||'')});throw error}
