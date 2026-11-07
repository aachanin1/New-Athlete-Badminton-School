import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {run,sql,q,fixtures} from './runtime.mjs'
await import('./base-seed.mjs')
const h=await import('./helpers.mjs'),f=h.fixture
f.sa=f.admin;f.coach=await fixtures.account('coach','โค้ชทดสอบรอบชดเชย');f.coach2=await fixtures.account('coach','โค้ชอื่น')
sql(`UPDATE profiles SET coach_employment_type='part_time' WHERE id IN(${q(f.coach.id)},${q(f.coach2.id)});INSERT INTO system_settings(key,value) VALUES('admin_menu_permissions','{"adminAllowedMenuKeys":["makeup"]}') ON CONFLICT(key) DO UPDATE SET value=excluded.value;`)
f.rounds=[]
for(let i=0;i<6;i++){
 const date=sql(`SELECT ((clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date-${i+1})::text`)
 const r=h.historical({targetDate:date,status:'scheduled'}),id=r.destinations[0],slot=randomUUID(),group=randomUUID()
 const template=f.templates.find(t=>t.course==='kids_group'&&t.start==='17:00'&&t.day===new Date(date+'T12:00:00+07:00').getUTCDay())
 sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);
 INSERT INTO schedule_slots(id,template_id,branch_id,course_type_id,date,start_time,end_time,status) VALUES(${q(slot)},${q(template.id)},${q(f.branch)},${q(f.courses.kids_group)},${q(date)},'17:00','19:00','open');
 UPDATE booking_sessions SET schedule_slot_id=${q(slot)} WHERE id=${q(id)};
 INSERT INTO coach_assignment_groups(id,schedule_slot_id,coach_id,name,created_by) VALUES(${q(group)},${q(slot)},${q(f.coach.id)},'กลุ่มทดสอบรอบชดเชย',${q(f.sa.id)});
 INSERT INTO coach_assignment_group_students(group_id,booking_session_id,student_id,student_type) VALUES(${q(group)},${q(id)},${q(f.children[0])},'child');COMMIT;`)
 assert.equal(sql(`SELECT progressive_proven_makeup_destination_v1(${q(id)})`),'t')
 f.rounds.push({...r,id,slot,group,date,child:f.children[0]})
}
f.month=f.rounds[0].date.slice(0,7)
assert.ok(f.rounds.every(r=>r.date.slice(0,7)===f.month),'Fixture month boundary needs explicit dates')
h.activate()
fs.writeFileSync(path.join(run.evidenceRoot,'fixture.json'),JSON.stringify(f,null,2))
// Original released function must miss the Makeup scenario before migration.
assert.equal(sql(`SELECT count(*) FROM admin_makeup_review_rows_v1(${q(f.month+'-01')}) WHERE id=ANY(ARRAY[${f.rounds.map(r=>q(r.id)).join(',')}]::uuid[])`),'0')
fs.writeFileSync(path.join(run.outputDir,'baseline-failure.json'),JSON.stringify({source:'62eb7a4',case:'source-backed Makeup awaiting attendance',expected:6,actual:0,at:new Date().toISOString()},null,2))
fs.writeFileSync(path.join(run.evidenceRoot,'before-rights.json'),h.snapshot(f.rounds.map(r=>r.booking))?JSON.stringify(h.snapshot(f.rounds.map(r=>r.booking)),null,2):'null')
sql(fs.readFileSync('supabase/migrations/20261107142057_coach_makeup_review_v1.sql','utf8'))
console.log(JSON.stringify({seeded:true,rounds:6,baselineMisses:6,project:run.target.project}))

