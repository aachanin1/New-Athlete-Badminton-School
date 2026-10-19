import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { run, sql, q, fixtures } from '../tests/admin-makeup-review/runtime.mjs'

const { account, fixture } = fixtures, output = path.join(run.evidenceRoot, 'fixture.json')
if (fs.existsSync(output)) throw Error('Fixture already exists; no reset/reseed')
for (const name of ['kids_group', 'adult_group', 'private']) sql(`INSERT INTO course_types(name,max_students,duration_hours) SELECT ${q(name)},20,1 WHERE NOT EXISTS(SELECT 1 FROM course_types WHERE name=${q(name)});`)
sql("DO $$ BEGIN IF EXISTS(SELECT 1 FROM task10_policy_activation WHERE effective_at IS NULL) THEN PERFORM task10_bootstrap_catalogs_v1();END IF;END $$;UPDATE task10_policy_activation SET state='active',effective_at=coalesce(effective_at,clock_timestamp()-interval '1 day'),makeup_enabled=true;UPDATE admin_makeup_credit_control SET enabled=true,store_once_enabled=true;")
sql(`INSERT INTO system_settings(key,value) VALUES('admin_menu_permissions','{"adminAllowedMenuKeys":["makeup"]}') ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value;`)
const sa = await account('super_admin', 'รีวิวผู้ดูแล'), admin = await account('admin', 'รีวิวแอดมิน'), parent = await account('user', 'รีวิวผู้ปกครอง'), coach = await account('coach', 'โค้ชเอ รีวิว'), coach2 = await account('coach', 'โค้ชบี รีวิว')
const today = sql("SELECT (clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date"), past = sql("SELECT ((clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date-2)"), future = sql("SELECT ((clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date+3)"), month = today.slice(0, 7)
assert.equal(past.slice(0, 7), month)
function round(name, count = 5, assigned = true, evidence = false, course = 'kids_group') {
  const r = fixture(course, false, parent, past, '10:00', '11:00'), group = randomUUID()
  const rows = Array.from({ length: count }, (_, i) => ({ id: i ? randomUUID() : r.ids[0], child: course === 'kids_group' ? i ? randomUUID() : r.children[0] : null, name: `ผู้เรียน ${name} ${String(i + 1).padStart(3, '0')}` }))
  sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);
   UPDATE branches SET name=${q(name)} WHERE id=${q(r.branch)};
   ${rows.map((x, i) => `${x.child ? i ? `INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(x.child)},${q(parent.id)},${q(x.name)},${q(x.name)});` : `UPDATE children SET full_name=${q(x.name)},nickname=${q(x.name)} WHERE id=${q(x.child)};` : ''}
    ${i ? `INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup) VALUES(${q(x.id)},${q(r.booking)},${q(r.slot)},${q(past)},'10:00','11:00',${q(r.branch)},${q(x.child)},'scheduled',false);` : ''}`).join('\n')}
   ${assigned ? `INSERT INTO coach_assignment_groups(id,schedule_slot_id,coach_id,name,created_by) VALUES(${q(group)},${q(r.slot)},${q(coach.id)},${q('กลุ่ม '+name)},${q(sa.id)});
   ${rows.map(x => `INSERT INTO coach_assignment_group_students(group_id,booking_session_id,student_id,student_type) VALUES(${q(group)},${q(x.id)},${q(x.child || parent.id)},${q(x.child ? 'child' : 'adult')});`).join('\n')}` : ''}
   ${evidence ? rows.map(x => `INSERT INTO attendance(booking_session_id,student_id,student_type,coach_id,status) VALUES(${q(x.id)},${q(x.child || parent.id)},${q(x.child ? 'child' : 'adult')},${q(coach.id)},'present');UPDATE booking_sessions SET status='completed' WHERE id=${q(x.id)};`).join('\n') : ''}
   COMMIT;`)
  return { ...r, name, group: assigned ? group : null, ids: rows.map(x => x.id), children: rows.map(x => x.child), assigned, evidence }
}
const rounds = []
for (let i = 0; i < 20; i++) rounds.push(round(`ตรวจต่อเนื่อง ${String(i + 1).padStart(2, '0')}`))
const evidence = round('หลักฐานโค้ช', 4, true, true), unassigned = round('ไม่มีโค้ช', 3, false), large = round('รอบใหญ่ 600', 600)
const adult = round('ผู้ใหญ่ตรวจสอบ', 1, true, false, 'adult_group'), privateRound = round('ไพรเวทตรวจสอบ', 1, false, false, 'private')
const absent = round('ขาดเรียนจริง', 1)
sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);UPDATE booking_sessions SET status='absent' WHERE id=${q(absent.ids[0])};INSERT INTO attendance(booking_session_id,student_id,student_type,coach_id,status) VALUES(${q(absent.ids[0])},${q(absent.children[0])},'child',${q(coach.id)},'absent');COMMIT;`)
const mixed = round('ผสมรอเช็คชื่อและหลักฐาน', 3)
sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);INSERT INTO attendance(booking_session_id,student_id,student_type,coach_id,status) VALUES(${q(mixed.ids[0])},${q(mixed.children[0])},'child',${q(coach.id)},'present');UPDATE booking_sessions SET status='completed' WHERE id=${q(mixed.ids[0])};COMMIT;`)
const complete = round('หลักฐานครบ', 2, true, true)
sql(`INSERT INTO coach_checkins(schedule_slot_id,coach_id,branch_id,photo_url,location_lat,location_lng) VALUES(${q(complete.slot)},${q(coach.id)},${q(complete.branch)},'https://example.invalid/local-fixture.jpg',13.7,100.5);`)
const futureRound = fixture('kids_group', false, parent, future, '12:00', '13:00')
const state = { runId: run.runId, sa, admin, parent, coach, coach2, today, past, future, month, rounds, evidence, unassigned, large, adult, privateRound, absent, mixed, complete, futureRound }
fs.writeFileSync(output, JSON.stringify(state, null, 2), { flag: 'wx' })
fs.writeFileSync(path.join(run.evidenceRoot, 'baseline-functions.json'), sql("SELECT jsonb_object_agg(oid::regprocedure::text,jsonb_build_object('definition',pg_get_functiondef(oid),'acl',proacl,'config',proconfig,'definer',prosecdef)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f'"))
console.log(JSON.stringify({ seeded: true, rounds: rounds.length, largeMembers: large.ids.length, project: run.target.project }))
