import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {hourlyFixtures} from './hourly-fixtures.mjs'
import {sql,q,read,preview,command,randomUUID,output,finish,failure,authorized,attend,db} from './helpers.mjs'
import {holdTransaction,concurrentSql,observeLockWait} from './runtime.mjs'
import {getCoachTeachingHourSourceRows} from '../../src/lib/coach-teaching-hours.ts'
import {calculateTeachingPayEntries,COACH_TEACHING_RULES} from '../../src/lib/coach-teaching-rules.ts'
const dir=output('hourly-concurrency'),checks=[],check=name=>checks.push({name,passed:true});
try {
 const m=await hourlyFixtures(),a=m.a,f=m.cases.find(f=>f.key==='family2'),p=preview(a.admin,f),r=read(command(a.admin,f,p)),credit=r.credits[0].creditId;
 const units=read(`SELECT jsonb_agg(unit_id ORDER BY ordinal) FROM no_class_return_hour_units WHERE credit_id=${q(credit)}`),req=randomUUID();
 const pick={id:units[0],kind:'package',date:m.future,start:f.start,end:f.targetEnd,branchId:m.branch,templateId:f.targetTemplate,requestId:randomUUID()},call=id=>`SELECT booking_ux_redeem_many_v3(${q(a.parent.id)},${q(id)},${q(JSON.stringify([pick]))}::jsonb);`;
 const held=await holdTransaction(call(req),'hour-winner-'+randomUUID()),loserName='hour-loser-'+randomUUID();let released=false;
 try {
  const pending=concurrentSql(`SET application_name=${q(loserName)};${call(randomUUID())}`).then(value=>({ok:true,value}),error=>({ok:false,error:String(error.stderr||error.message)}));
  await observeLockWait(loserName);held.release();released=true;await held.done;const loser=await pending;assert.equal(loser.ok,false);assert.match(loser.error,/UNAVAILABLE|REDEEMED|CONFLICT/);
 } finally {if(!released){held.release();await held.done.catch(()=>{})}}
 const sessions=read(`SELECT jsonb_agg(id ORDER BY id) FROM booking_sessions WHERE booking_id=${q(f.booking)} AND date=${q(m.future)}`);
 assert.equal(sessions.length,3);assert.equal(sql(`SELECT status FROM booking_package_units WHERE id=${q(units[1])}`),'available');
 assert.equal(sql(`SELECT count(*) FROM booking_sessions WHERE id=ANY(${q('{'+sessions.join(',')+'}')}::uuid[]) AND end_time-start_time=interval '1hour'`),'3');
 assert.equal(read(`SELECT booking_ux_wallet_inventory_v1(${q(a.parent.id)})`).groups.find(g=>g.source.returnCreditId===credit).total,1);check('Two concurrent requests for the same hour have one winner; complete Family once and second hour remains');
 const slot=sql(`SELECT schedule_slot_id FROM booking_sessions WHERE id=${q(sessions[0])}`),group=randomUUID(),past=sql(`SELECT date ${q(m.date)}-2;`);
 sql(authorized(`UPDATE schedule_slots SET date=${q(past)} WHERE id=${q(slot)};UPDATE booking_sessions SET date=${q(past)} WHERE id=ANY(${q('{'+sessions.join(',')+'}')}::uuid[]);
 INSERT INTO coach_assignment_groups(id,schedule_slot_id,coach_id,name)VALUES(${q(group)},${q(slot)},${q(a.other.id)},'Local native hour actually taught');
 INSERT INTO coach_assignment_group_students(group_id,booking_session_id,student_id,student_type) SELECT ${q(group)},s.id,coalesce(s.child_id,${q(a.parent.id)}::uuid),CASE WHEN s.child_id IS NULL THEN 'adult'::student_type ELSE 'child'::student_type END FROM booking_sessions s WHERE id=ANY(${q('{'+sessions.join(',')+'}')}::uuid[]);
 INSERT INTO coach_checkins(schedule_slot_id,coach_id,branch_id,photo_url,location_lat,location_lng)VALUES(${q(slot)},${q(a.other.id)},${q(m.branch)},'https://example.invalid/local-native-hour.jpg',13.7,100.5);`));
 const nf={...f,ids:sessions,slot,children:read(`SELECT jsonb_agg(child_id ORDER BY id) FROM booking_sessions WHERE id=ANY(${q('{'+sessions.join(',')+'}')}::uuid[])`)};
 for(let i=0;i<sessions.length;i++)sql(attend(nf,{...a,coach:a.other},i));
 const options={startDate:past,endDateExclusive:sql(`SELECT date ${q(past)}+1;`),coachId:a.other.id,includeExcluded:true},rows=await getCoachTeachingHourSourceRows(db,options),row=rows.find(r=>r.schedule_slot_id===slot);
 assert.ok(row);assert.equal(row.is_verified,true);assert.equal(row.student_count,3);assert.deepEqual([...row.student_session_ids].sort(),sessions);assert.equal(calculateTeachingPayEntries([row],COACH_TEACHING_RULES.part_time)[0].hours,1);check('Actually taught redeemed native Family hour counts exactly1hour with full3-person attendance/check-in evidence');
 const old=await getCoachTeachingHourSourceRows(db,{...options,coachId:a.coach.id});assert.ok(old.filter(r=>r.schedule_slot_id===f.slot).every(r=>!r.is_verified&&r.student_count===0));assert.equal(sql(`SELECT count(*) FROM attendance WHERE booking_session_id=ANY(${q('{'+f.ids.join(',')+'}')}::uuid[])`),'0');check('Original not-taught round still contributes zero and has no absence evidence');
 fs.writeFileSync(path.join(dir,'effects.private.json'),JSON.stringify({m,r,units,sessions,slot,source:row},null,2));finish(dir,checks,{testDefinition:'tests/no-class-return/hourly-concurrency.mjs'});
}catch(e){failure(dir,checks,e)}
