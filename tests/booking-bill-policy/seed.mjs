import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { run, db, sql, q } from './runtime.mjs'
import { account, password, read, evidence } from './helpers.mjs'

const output = path.join(run.evidenceRoot, 'fixture.json')
assert.ok(!fs.existsSync(output), 'Preserve existing fixture; seeding is one-time for this owned runtime')
for (const name of ['kids_group', 'adult_group', 'private']) sql(`INSERT INTO course_types(name,max_students,duration_hours) SELECT ${q(name)},20,${name === 'private' ? 1 : 2} WHERE NOT EXISTS(SELECT 1 FROM course_types WHERE name=${q(name)})`)
const courses = read('SELECT jsonb_object_agg(name,id) FROM course_types')
const catalog = { kids_group: [[1,1,700,700],[2,6,625,2500],[7,10,500,4000],[11,14,433,5200],[15,18,406,6500],[19,null,350,7000]], adult_group: [[1,1,600,600],[10,10,550,5500],[16,16,500,8000]], private: [[1,1,900,900],[10,10,800,8000]] }
for (const [name, tiers] of Object.entries(catalog)) for (const [min,max,unit,price] of tiers) sql(`INSERT INTO pricing_tiers(course_type_id,min_sessions,max_sessions,price_per_session,package_price,valid_from) SELECT ${q(courses[name])},${min},${max ?? 'NULL'},${unit},${price},'2020-01-01' WHERE NOT EXISTS(SELECT 1 FROM pricing_tiers WHERE course_type_id=${q(courses[name])} AND min_sessions=${min} AND valid_to IS NULL)`)
sql("SELECT task10_bootstrap_catalogs_v1(); UPDATE task10_policy_activation SET state='active',effective_at=clock_timestamp()-interval '1 day',pricing_enabled=true,makeup_enabled=true,expiry_enabled=true; UPDATE booking_ux_control SET enabled=true; UPDATE admin_makeup_credit_control SET enabled=true,store_once_enabled=true;")
const actors = {}
for (const [key, role, label] of [['parent','user','ผู้ปกครองตรวจบิล'],['adult','user','ผู้ใหญ่ตรวจรายครั้ง'],['family','user','ครอบครัวตรวจ Private'],['other','user','ผู้ใช้บัญชีอื่น'],['admin','admin','ผู้ดูแลตรวจบิล'],['sa','super_admin','ผู้ดูแลตั้งราคา'],['browser','user','ผู้เรียนตรวจหน้าจอ'],['legacy','user','ผู้เรียนบิลเดิม']]) actors[key] = await account(role, label)
const branches = [randomUUID(), randomUUID()], children = [randomUUID(), randomUUID()], familyChildren = [randomUUID(), randomUUID()], browserChildren = [randomUUID(), randomUUID()]
for (let i = 0; i < branches.length; i++) sql(`INSERT INTO branches(id,name,slug,address) VALUES(${q(branches[i])},${q('สาขาทดสอบบิล ' + (i + 1))},${q('bill-policy-' + (i + 1))},'ข้อมูลสมมติ Local เฉพาะงาน')`)
for (const [ids, parent] of [[children, actors.parent], [familyChildren, actors.family], [browserChildren, actors.browser]]) for (let i = 0; i < ids.length; i++) sql(`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(ids[i])},${q(parent.id)},${q('ผู้เรียนสมมติ ' + (i + 1))},${q('น้องทดสอบ ' + (i + 1))})`)
const templates = []
for (const branch of branches) for (const [course, courseId] of Object.entries(courses)) for (let day = 0; day < 7; day++) for (const [start, end] of course === 'private' ? [['08:00','09:00'],['10:00','11:00'],['11:00','12:00'],['13:00','14:00'],['14:00','15:00'],['17:00','18:00']] : [['08:00','10:00'],['10:00','12:00'],['14:00','16:00'],['17:00','19:00']]) {
  const id = randomUUID(); templates.push({ id, branch, course, day, start, end })
  sql(`INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(id)},${q(branch)},${q(courseId)},${day},${q(start)},${q(end)},true)`)
}
const paymentSettings = { version: 2, revision: 'booking-bill-policy-local-v1', accounts: [{ id: 'local-bill-test', bankName: 'SCB', accountName: 'บัญชีสมมติ Local', accountNumber: '9990001111', branchIds: branches }] }
sql(`INSERT INTO system_settings(key,value) VALUES('payment_transfer_settings',${q(JSON.stringify(paymentSettings))}::jsonb) ON CONFLICT(key) DO UPDATE SET value=excluded.value; UPDATE booking_bill_policy_control SET enabled=true;`)
const storage = await db.storage.createBucket('payment-slips', { public: true })
assert.ok(!storage.error || /already exists/i.test(storage.error.message), storage.error?.message)
const dates = read("SELECT jsonb_build_object('today',(clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date,'month',to_char(date_trunc('month',clock_timestamp() AT TIME ZONE 'Asia/Bangkok')+interval '1 month','YYYY-MM'),'nextMonth',to_char(date_trunc('month',clock_timestamp() AT TIME ZONE 'Asia/Bangkok')+interval '2 months','YYYY-MM'))")
const f = { runId: run.runId, actors, branches, courses, children, familyChildren, browserChildren, templates, dates, password }
fs.writeFileSync(output, JSON.stringify(f, null, 2), { flag: 'wx' })
const file = evidence('seed', { seeded: true, actorIds: Object.fromEntries(Object.entries(actors).map(([key, actor]) => [key, actor.id])), branches, templates: templates.length })
console.log(JSON.stringify({ seeded: true, project: run.target.project, actors: Object.keys(actors), templates: templates.length, evidence: file }))

