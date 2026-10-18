import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {db,sql,q} from './isolated-runtime.mjs'
export const password='BranchClosureLocal!2026'
export async function account(role,label="ทดสอบวันปิด") {
  const email = `branch-closure-${randomUUID()}@example.invalid`
  const result = await db.auth.admin.createUser({ email, password, email_confirm: true })
  assert.ifError(result.error); const id = result.data.user.id
  const update = await db.from('profiles').update({ role, full_name: `${label} ${role}` }).eq('id', id); assert.ifError(update.error)
  return { id, email }
}
export const source = JSON.parse(sql("SELECT jsonb_build_object('date',t::date,'start',t::time,'end',(t+interval '1 hour')::time) FROM (SELECT CASE WHEN extract(hour FROM clock_timestamp() AT TIME ZONE 'Asia/Bangkok')>=20 THEN date_trunc('day',clock_timestamp() AT TIME ZONE 'Asia/Bangkok')+interval '1 day 7 hours' ELSE date_trunc('hour',clock_timestamp() AT TIME ZONE 'Asia/Bangkok')+interval '2 hours' END AS t) x;"))
export function fixture(courseName = 'kids_group', family = false, parent, date = source.date, start = source.start, end = source.end) {
  const [booking, branch, template, slot] = Array.from({ length: 4 }, randomUUID), ids = Array.from({ length: family ? 3 : 1 }, randomUUID)
  const children = family ? [null, randomUUID(), randomUUID()] : courseName === 'kids_group' ? [randomUUID()] : [null]
  const course = sql(`SELECT id FROM course_types WHERE name=${q(courseName)}`)
  assert.ok(course, 'Migration baseline must include course types')
  sql(`BEGIN; SELECT pg_advisory_xact_lock(10,1); CREATE TEMP TABLE closure_fixture_policy ON COMMIT DROP AS SELECT * FROM task10_policy_activation;
    UPDATE task10_policy_activation SET state='never_activated',effective_at=NULL,pricing_enabled=false,makeup_enabled=false,expiry_enabled=false;
    SELECT set_config('lesson_source.write','authorized',true); SELECT set_config('task10.source_write','authorized',true); SELECT set_config('task10.payment_write','authorized',true);
    INSERT INTO branches(id,name,slug) VALUES(${q(branch)},'สาขาทดสอบเฉพาะงานวันปิด',${q('closure-'+branch)});
    ${children.filter(Boolean).map(id => `INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(id)},${q(parent.id)},'นักเรียนทดสอบวันปิด','เด็กทดสอบ');`).join('')}
    INSERT INTO bookings(id,user_id,learner_type,child_id,branch_id,course_type_id,month,year,total_sessions,total_price,status,created_at) VALUES(${q(booking)},${q(parent.id)},${q(courseName==='kids_group'?'child':'self')},${q(courseName==='kids_group'?children[0]:null)},${q(branch)},${q(course)},extract(month FROM date ${q(date)}),extract(year FROM date ${q(date)}),${courseName==='kids_group'?8:1},500,'verified',(SELECT effective_at-interval '1 day' FROM closure_fixture_policy));
    INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(template)},${q(branch)},${q(course)},extract(dow FROM date ${q(date)}),${q(start)},${q(end)},true);
    INSERT INTO schedule_slots(id,template_id,branch_id,course_type_id,date,start_time,end_time,status) VALUES(${q(slot)},${q(template)},${q(branch)},${q(course)},${q(date)},${q(start)},${q(end)},'open');
    ${ids.map((id,i)=>`INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup) VALUES(${q(id)},${q(booking)},${q(slot)},${q(date)},${q(start)},${q(end)},${q(branch)},${q(children[i])},'scheduled',false);`).join('')}
    ${courseName!=='kids_group'?`INSERT INTO payments(booking_id,user_id,amount,status,verified_at) VALUES(${q(booking)},${q(parent.id)},500,'approved',clock_timestamp());
    INSERT INTO pricing_tiers(course_type_id,min_sessions,max_sessions,price_per_session,package_price,valid_from) SELECT ${q(course)},1,1,500,500,'2020-01-01' WHERE NOT EXISTS(SELECT 1 FROM pricing_tiers WHERE course_type_id=${q(course)});`:''}
    UPDATE task10_policy_activation SET state=(SELECT state FROM closure_fixture_policy),effective_at=(SELECT effective_at FROM closure_fixture_policy),
      pricing_enabled=(SELECT pricing_enabled FROM closure_fixture_policy),makeup_enabled=(SELECT makeup_enabled FROM closure_fixture_policy),expiry_enabled=(SELECT expiry_enabled FROM closure_fixture_policy); COMMIT;`)
  return { parent, booking, branch, course, courseName, template, slot, ids, children, date, start, end }
}
export function target(f, nextMonth = false, offset = 1) {
  const date = sql(nextMonth ? `SELECT (date_trunc('month',date ${q(f.date)})+interval '1 month 6 days')::date;` : `SELECT (date ${q(f.date)}+${offset})::date;`), template = randomUUID()
  sql(`INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(template)},${q(f.branch)},${q(f.course)},extract(dow FROM date ${q(date)}),'10:00','11:00',true);`)
  return { date, template, branch: f.branch, start: '10:00', end: '11:00' }
}
