import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { run, sql, q, fixtures } from '../tests/booking-ux/runtime.mjs'
const output=path.join(run.evidenceRoot,'fixture.json')
if(fs.existsSync(output))throw Error('Preserve existing fixture')
for(const name of ['kids_group','adult_group','private'])sql(`INSERT INTO course_types(name,max_students,duration_hours) VALUES(${q(name)},20,1);`)
const courses=JSON.parse(sql('SELECT jsonb_object_agg(name,id) FROM course_types'))
for(const [name,tiers]of Object.entries({kids_group:[[1,1,700,700],[2,6,625,2500],[7,10,500,4000],[11,14,433,5200],[15,18,406,6500],[19,null,350,7000]],adult_group:[[1,1,600,600],[10,10,550,5500],[16,16,500,8000]],private:[[1,1,900,900],[10,10,800,8000]]})){
 for(const [min,max,unit,price]of tiers)sql(`INSERT INTO pricing_tiers(course_type_id,min_sessions,max_sessions,price_per_session,package_price,valid_from) VALUES(${q(courses[name])},${min},${max??'NULL'},${unit},${price},'2020-01-01');`)
}
sql("SELECT task10_bootstrap_catalogs_v1();UPDATE task10_policy_activation SET state='active',effective_at=clock_timestamp()-interval '1 day',pricing_enabled=true,makeup_enabled=true,expiry_enabled=true;UPDATE admin_makeup_credit_control SET enabled=true,store_once_enabled=true;")
const parent=await fixtures.account('user','ผู้ปกครองทดสอบ'),empty=await fixtures.account('user','เริ่มจองครั้งแรก'),sa=await fixtures.account('super_admin','ผู้ดูแลแพ็กเกจ'),other=await fixtures.account('user','บัญชีอื่น')
const branch=randomUUID(),children=[randomUUID(),randomUUID()]
sql(`INSERT INTO branches(id,name,slug,address) VALUES(${q(branch)},'สาขาทดสอบการจอง','booking-ux-local','ข้อมูลสมมติสำหรับตรวจ Local');${children.map((id,i)=>`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(id)},${q(parent.id)},${q('ผู้เรียนสมมติ '+(i+1))},${q('น้องทดสอบ '+(i+1))});`).join('')}`)
const templates=[]
for(const [course,cid]of Object.entries(courses))for(let day=0;day<7;day++)for(const [start,end]of [['10:00','11:00'],['17:00','18:00']]){
 const id=randomUUID();templates.push({id,course,day,start,end});sql(`INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(id)},${q(branch)},${q(cid)},${day},${q(start)},${q(end)},true);`)
}
sql(`INSERT INTO system_settings(key,value) VALUES('branch_payment_accounts',${q(JSON.stringify({version:1,accounts:[]}))}) ON CONFLICT(key) DO NOTHING;`)
const f={runId:run.runId,parent,empty,sa,other,password:fixtures.password,branch,children,courses,templates,today:sql("SELECT (clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date")}
fs.writeFileSync(output,JSON.stringify(f,null,2),{flag:'wx'})
console.log(JSON.stringify({seeded:true,project:run.target.project,templates:templates.length}))
