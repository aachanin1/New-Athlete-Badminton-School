import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {run,sql,q,db} from './runtime.mjs'
import {isMakeupEligibleMissedSession,isAttendanceGapReviewSession} from '../../src/lib/session-attendance-status.ts'
import {isCoachEvidenceReviewSession,isMissingCoachEvidenceSession} from '../../src/lib/admin-makeup-read-model.ts'
import {getCoachTeachingHourSourceRead} from '../../src/lib/coach-teaching-hours.ts'
const f=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json'))),r=f.rounds[3],checks=[]
const check=(v,n)=>{assert.ok(v,n);checks.push(n)}
const count=(change)=>sql(`BEGIN;SET LOCAL session_replication_role=replica;SET LOCAL "lesson_source.write"='authorized';SET LOCAL "task10.source_write"='authorized';${change};SELECT count(*) FROM admin_makeup_review_rows_v1(${q(f.month+'-01')}) WHERE id=${q(r.id)};ROLLBACK;`)
for(const makeup of [true,false]){
 check(count(`UPDATE booking_sessions SET is_makeup=${makeup} WHERE id=${q(r.id)}`)==='1','Pending follow-up includes '+(makeup?'Makeup':'normal'))
 for(const status of ['walleted','rescheduled','completed','absent'])check(count(`UPDATE booking_sessions SET is_makeup=${makeup},status=${q(status)} WHERE id=${q(r.id)}`)==='0','Lifecycle without attendance retains existing '+makeup+'/'+status+' behavior')
}
for(const status of ['cancelled','pending_payment'])check(count(`UPDATE bookings SET status=${q(status)} WHERE id=${q(r.booking)}`)==='0','Unverified booking '+status+' excluded')
check(count(`UPDATE booking_sessions SET date=CURRENT_DATE+3 WHERE id=${q(r.id)}`)==='0','Future round excluded')
check(count(`INSERT INTO activity_logs(user_id,action,entity_type,entity_id,details) VALUES(${q(f.sa.id)},'attendance_gap_closed_no_action','booking_sessions',${q(r.id)},'{"reason":"local closed negative"}')`)==='0','Explicitly closed review excluded')
const input={status:'scheduled',date:r.date,startTime:'17:00',endTime:'19:00',isMakeup:true,attendanceStatus:null}
check(isAttendanceGapReviewSession(input),'TypeScript review recognizes Makeup gap')
check(!isMakeupEligibleMissedSession({...input,status:'absent',attendanceStatus:'absent'}),'Makeup absence never grants another Makeup entitlement')
const session={id:r.id,status:'scheduled',date:r.date,start_time:'17:00',end_time:'19:00',is_makeup:true,schedule_slot_id:r.slot,coach_name:'Synthetic Coach',attendance_status:null,coach_checkin_time:null,coach_checkin_photo_url:null,coach_checkin_has_location:false}
check(isMissingCoachEvidenceSession(session)&&!isCoachEvidenceReviewSession(session),'Broadened filter does not enable evidence-only request before attendance')
check(isCoachEvidenceReviewSession({...session,attendance_status:'present'}),'Evidence-only request supports recorded Makeup attendance')
for(const missing of ['coach_checkin_time','coach_checkin_photo_url','coach_checkin_has_location']){const complete={...session,attendance_status:'present',coach_checkin_time:new Date().toISOString(),coach_checkin_photo_url:'https://example.invalid/qa.jpg',coach_checkin_has_location:true};complete[missing]=missing==='coach_checkin_has_location'?false:null;check(isCoachEvidenceReviewSession(complete),'Each required evidence component is checked: '+missing)}
const teaching=await getCoachTeachingHourSourceRead(db,{coachId:f.coach.id,startDate:f.month+'-01',endDateExclusive:sql(`SELECT (date ${q(f.month+'-01')}+interval '1 month')::date`)})
fs.writeFileSync(path.join(run.outputDir,'teaching-source.json'),JSON.stringify(teaching,null,2))
check(teaching.rows.filter(x=>x.schedule_slot_id===f.rounds[0].slot).length===1,'Completed exact Makeup slot yields one canonical teaching source row')
check(teaching.rows.filter(x=>x.is_verified).length===1,'Only the completed Makeup slot has verified teaching evidence')
fs.writeFileSync(path.join(run.outputDir,'boundaries-'+Date.now()+'.json'),JSON.stringify({checks,passed:checks.length},null,2));console.log(JSON.stringify({passed:checks.length}))


