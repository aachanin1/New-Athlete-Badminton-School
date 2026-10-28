import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {fixtures,sql,q} from '../tests/booking-ux/runtime.mjs'
import {auth} from './check-booking-ux-seven.mjs'
const root='.playwright/booking-ux-1/ux-four-20261022',f=JSON.parse(fs.readFileSync('.playwright/booking-ux-1/fixture.json')),actor=await fixtures.account('user','ตรวจปฏิทิน Adult Private'),child=randomUUID(),base='http://127.0.0.1:3152'
sql(`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(child)},${q(actor.id)},'เด็กทดสอบ Family','น้องแฟมิลี')`)
const cookie=await auth(actor),catalog=JSON.parse(sql('SELECT public.booking_ux_catalog_v1()')),ids=[]
for(const course of ['adult_group','private']){
 const p=catalog.find(x=>x.course===course&&x.quantity===10),date=course==='private'?'2026-11-24':'2026-11-23',participants=course==='private'?[null,child]:[null]
 const template=sql(`SELECT id FROM schedule_templates WHERE branch_id=${q(f.branch)} AND course_type_id=${q(f.courses[course])} AND day_of_week=extract(dow FROM date ${q(date)}) AND start_time='10:00' AND is_active LIMIT 1`)
 const sessions=participants.map(childId=>({date,startTime:'10:00',endTime:'11:00',branchId:f.branch,childId,scheduleTemplateId:template}))
 const r=await fetch(base+'/api/booking-checkout',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:JSON.stringify({action:'create',requestId:randomUUID(),input:{packageId:p.id,packageRevision:p.revision,courseTypeId:f.courses[course],branchId:f.branch,participants,learnerType:'self',childId:null,month:11,year:2026,totalSessions:10,totalAmount:p.price,expectedTotalPrice:p.price,sessions}})}),body=await r.json();assert.equal(r.status,200,JSON.stringify(body));ids.push(body.bookingId)
}
fs.writeFileSync(root+'/packages.json',JSON.stringify({actor,child,ids,deadlines:JSON.parse(sql(`SELECT jsonb_object_agg(id,checkout_deadline) FROM bookings WHERE id=ANY(ARRAY[${ids.map(q)}]::uuid[])`))},null,2));console.log(JSON.stringify({ids,email:actor.email}))
