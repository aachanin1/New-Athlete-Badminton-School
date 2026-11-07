import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { run, sql, q, fixtures } from './runtime.mjs'
const file = path.join(run.evidenceRoot, 'fixture.json')
assert.ok(!fs.existsSync(file), 'Preserve existing fixtures')
for (const name of ['kids_group', 'adult_group', 'private']) sql(`INSERT INTO course_types(name,max_students,duration_hours) VALUES(${q(name)},6,${name==='private'?1:2});`)
const courses = JSON.parse(sql('SELECT jsonb_object_agg(name,id) FROM course_types'))
for (const [name, tiers] of Object.entries({ kids_group:[[1,1,700],[2,3,625],[4,5,500],[6,7,433],[8,9,406],[10,null,350]], adult_group:[[1,1,600],[10,10,550],[16,16,500]],private:[[1,1,900],[10,10,800]] })) {
  for (const [min,max,rate] of tiers) sql(`INSERT INTO pricing_tiers(course_type_id,min_sessions,max_sessions,price_per_session,package_price,valid_from) VALUES(${q(courses[name])},${min},${max??'NULL'},${rate},${min*rate},'2020-01-01');`)
}
sql('SELECT task10_bootstrap_catalogs_v1();')
const parent = await fixtures.account('user', 'ผู้ปกครองทดสอบข้ามเดือน')
const other = await fixtures.account('user', 'ครอบครัวอื่น')
const admin = await fixtures.account('super_admin', 'ผู้ตรวจข้ามเดือน')
const branch = randomUUID(), children = [randomUUID(),randomUUID()], foreignChild = randomUUID()
const dates = JSON.parse(sql("SELECT jsonb_build_object('previous',(date_trunc('month',clock_timestamp() AT TIME ZONE 'Asia/Bangkok')-interval '1 month')::date,'month',date_trunc('month',clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date,'past',(clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date-2,'future',(clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date+2)"))
sql(`INSERT INTO branches(id,name,slug) VALUES(${q(branch)},'สาขาจำลองข้ามเดือน',${q('makeup-scope-'+branch)});
 ${children.map((id,i)=>`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(id)},${q(parent.id)},${q('เด็กจำลอง '+(i+1))},${q('ทดสอบ '+(i+1))});`).join('')}
 INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(foreignChild)},${q(other.id)},'เด็กครอบครัวอื่น','ครอบครัวอื่น');`)
const templates=[]
for(const [course,cid] of Object.entries(courses)) for(let day=0;day<7;day++) for(const [start,end] of [['10:00','12:00'],['17:00','19:00']]){
 const id=randomUUID();templates.push({id,course,day,start,end});sql(`INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(id)},${q(branch)},${q(cid)},${day},${q(start)},${q(end)},true);`)
}
sql(`INSERT INTO system_settings(key,value) VALUES('payment_transfer_settings',${q(JSON.stringify({version:2,revision:randomUUID(),accounts:[{id:randomUUID(),bankName:'SCB',accountName:'บัญชีจำลอง',accountNumber:'1234567890',branchIds:[branch]}]}))}) ON CONFLICT(key) DO UPDATE SET value=excluded.value;`)
const f = {runId:run.runId,parent,other,admin,branch,children,foreignChild,courses,templates,dates,password:fixtures.password}
fs.writeFileSync(file,JSON.stringify(f,null,2),{flag:'wx'})
console.log(JSON.stringify({seeded:true,project:run.target.project,templates:templates.length}))
