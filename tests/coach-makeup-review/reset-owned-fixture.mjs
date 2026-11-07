import fs from 'node:fs'
import path from 'node:path'
import {run,sql,q,db} from './runtime.mjs'
const f=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json')))
const ids=f.rounds.map(r=>q(r.id)).join(',')
fs.writeFileSync(path.join(run.outputDir,'pre-retry-'+Date.now()+'.json'),sql(`SELECT jsonb_build_object('audits',(SELECT jsonb_agg(l) FROM activity_logs l WHERE entity_id IN(${ids})),'attendance',(SELECT jsonb_agg(a) FROM attendance a WHERE booking_session_id IN(${ids})))`))
sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);
DELETE FROM admin_makeup_review_requests WHERE actor_id=${q(f.sa.id)};DELETE FROM activity_logs WHERE entity_id IN(${ids});DELETE FROM notifications WHERE user_id IN(${q(f.coach.id)},${q(f.coach2.id)},${q(f.parent.id)});DELETE FROM attendance WHERE booking_session_id IN(${ids});DELETE FROM coach_checkins WHERE coach_id IN(${q(f.coach.id)},${q(f.coach2.id)});UPDATE booking_sessions SET status='scheduled' WHERE id IN(${ids});UPDATE coach_assignment_groups SET coach_id=${q(f.coach.id)} WHERE id IN(${f.rounds.map(r=>q(r.group)).join(',')});COMMIT;`)
const b=await db.storage.getBucket('coach-checkins');if(b.error){const created=await db.storage.createBucket('coach-checkins',{public:true});if(created.error)throw created.error}
console.log('Task-owned fixture reset; prior observations preserved')
