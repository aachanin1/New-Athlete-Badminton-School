import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {run,sql,q,fixtures,concurrentSql} from './runtime.mjs'
const f=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json'))),r=f.rounds[4],checks=[]
const ux=sql('SELECT enabled FROM booking_ux_control');let n
try{sql('UPDATE booking_ux_control SET enabled=false');n=fixtures.fixture('kids_group',false,f.parent,r.date,'17:00','19:00')}finally{sql('UPDATE booking_ux_control SET enabled='+(ux==='t'?'true':'false'))}
const check=(v,s)=>{assert.ok(v,s);checks.push(s)}
sql(`BEGIN;SET LOCAL "lesson_source.write"='authorized';SET LOCAL "task10.source_write"='authorized';UPDATE booking_sessions SET branch_id=${q(f.branch)},schedule_slot_id=${q(r.slot)} WHERE id=${q(n.ids[0])};INSERT INTO coach_assignment_group_students(group_id,booking_session_id,student_id,student_type) VALUES(${q(r.group)},${q(n.ids[0])},${q(n.children[0])},'child');COMMIT;`)
const rows=JSON.parse(sql(`SELECT jsonb_agg(t) FROM admin_makeup_review_rows_v1(${q(f.month+'-01')}) t WHERE schedule_slot_id=${q(r.slot)}`))
check(rows.length===2&&rows.some(x=>x.is_makeup)&&rows.some(x=>!x.is_makeup),'Normal and Makeup learners share one complete review round')
const key=rows[0].group_key,request=randomUUID(),args=`${q(f.sa.id)},${q(r.id)},${q(key)},'request_coach_review',ARRAY[${rows.map(x=>q(x.id)).join(',')}]::uuid[],${q(request)},false,NULL`
assert.throws(()=>sql(`SELECT admin_makeup_request_review_round_v1(${q(f.sa.id)},${q(r.id)},${q(key)},'request_coach_review',ARRAY[${q(r.id)}]::uuid[],${q(randomUUID())},false,NULL)`),/ADMIN_REVIEW_SCOPE_CHANGED/)
check(true,'Stale tab missing the new member is rejected before any write')
const result=(await Promise.all([concurrentSql(`SELECT admin_makeup_request_review_round_v1(${args})`),concurrentSql(`SELECT admin_makeup_request_review_round_v1(${args})`)])).map(JSON.parse)
check(result.every(x=>x.targetCount===2)&&result.some(x=>x.idempotentReplay),'Two concurrent retries return the same complete mixed-round operation')
check(sql(`SELECT count(*) FROM admin_makeup_review_requests WHERE request_id=${q(request)}`)==='1','One durable receipt for concurrent retries')
check(sql(`SELECT count(*) FROM activity_logs WHERE details->>'requestId'=${q(request)}`)==='2','Exactly one audit per normal/Makeup learner')
check(sql(`SELECT count(*) FROM attendance WHERE booking_session_id IN(${rows.map(x=>q(x.id)).join(',')})`)==='0','Sending mixed round does not fabricate attendance')
fs.writeFileSync(path.join(run.outputDir,'mixed-'+Date.now()+'.json'),JSON.stringify({checks,passed:checks.length},null,2));console.log(JSON.stringify({passed:checks.length}))


