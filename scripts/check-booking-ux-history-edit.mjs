import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createServerClient} from '@supabase/ssr'
import {sql,q,fixtures,env} from '../tests/booking-ux/runtime.mjs'
import {bookingHistoryTime,bookingHistoryMonth} from '../src/lib/booking-history.ts'

const root='.playwright/booking-ux-1/ux-history-edit-20261023',base='http://127.0.0.1:3153',checks=[]
const check=(ok,name)=>{assert.ok(ok,name);checks.push(name);console.log(name)}
const record={id:'old',status:'verified',created_at:'2026-01-01T00:00:00Z'}
check(bookingHistoryMonth(bookingHistoryTime(record,{old:'2026-10-31T17:01:00Z'}))==='2026-11','Confirmation month uses Bangkok boundary, not lesson month or UTC month')
check(bookingHistoryTime({...record,status:'pending_payment'},{old:'2099-01-01'})===Date.parse(record.created_at),'Unconfirmed bill uses creation, not an unrelated receipt date')
check(bookingHistoryTime(record,{old:'invalid'})===Date.parse(record.created_at),'Old bill without valid confirmation falls back without inventing a payment date')

const source=JSON.parse(fs.readFileSync('.playwright/booking-ux-1/fixture.json'))
const actor=await fixtures.account('user','ทดสอบสรุปแพ็กเกจ'),cookies=new Map()
const auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:xs=>xs.forEach(x=>cookies.set(x.name,x.value))}})
assert.ifError((await auth.auth.signInWithPassword({email:actor.email,password:fixtures.password})).error)
const cookie=[...cookies].map(([k,v])=>k+'='+v).join('; ')
const req=async(url,body,who=cookie)=>{const r=await fetch(base+url,{method:body?'POST':'GET',headers:{Cookie:who,Origin:base,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()}}
check((await req('/api/booking-checkout',null,'')).status===401,'Anonymous read remains denied')
const child=randomUUID();sql(`INSERT INTO children(id,parent_id,full_name)VALUES(${q(child)},${q(actor.id)},'เด็กทดสอบ Family สรุป')`)
const catalog=JSON.parse(sql('SELECT public.booking_ux_catalog_v1()'))
const make=(course,members)=>{
 const p=catalog.find(p=>p.course===course&&p.quantity===10)
 return JSON.parse(sql(`SELECT public.booking_ux_create_v1(${q(actor.id)},${q(randomUUID())},${q(JSON.stringify({packageId:p.id,packageRevision:p.revision,courseTypeId:source.courses[course],branchId:source.branch,participants:members,learnerType:members.includes(null)?'self':'child',month:11,year:2026,totalSessions:10,totalAmount:p.price,expectedTotalPrice:p.price,sessions:[]}))}::jsonb)`)).bookingId
}
const adult=make('adult_group',[null]),family=make('private',[null,child]),ids=[adult,family]
const url='/api/booking-checkout?legacyIds='+ids.join(',')
const state=(await req(url+'&editor=1')).body
const snapshot=()=>sql(`SELECT jsonb_agg(jsonb_build_array(id,total_price,checkout_deadline,package_snapshot,package_participants,(SELECT count(*) FROM booking_sessions WHERE booking_id=b.id)) ORDER BY id) FROM bookings b WHERE id=ANY(ARRAY[${ids.map(q)}]::uuid[])`)
const before=snapshot()
const one=(course,date,childId)=>({date,startTime:'10:00',endTime:'11:00',branchId:source.branch,childId,scheduleTemplateId:sql(`SELECT id FROM schedule_templates WHERE branch_id=${q(source.branch)} AND course_type_id=${q(source.courses[course])} AND day_of_week=extract(dow FROM date ${q(date)}) AND start_time='10:00' AND is_active LIMIT 1`)})
const input={action:'edit',token:state.editor.token,bookingIds:ids,edits:[{id:adult,sessions:[one('adult_group','2026-11-29',null)]},{id:family,sessions:[one('private','2026-11-30',null),one('private','2026-11-30',child)]}]}
const preview=await req('/api/booking-checkout',{action:'set',preview:true,requestId:randomUUID(),input})
check(preview.status===200&&preview.body.total===13500,'Adult + Private Family combined preview keeps full package prices')
check(snapshot()===before,'Opening summary leaves every bill and Family participant unchanged')
const conflict=await req('/api/booking-checkout',{action:'set',requestId:randomUUID(),input:{...input,expectedTotal:1}})
check(conflict.status===409&&snapshot()===before,'Unconfirmed price cannot partially save a payable set')
const key=randomUUID(),save=await req('/api/booking-checkout',{action:'set',requestId:key,input:{...input,expectedTotal:preview.body.total}})
check(save.status===200,'Confirmed summary saves the complete payable set')
const after=(await req(url)).body
check(ids.every(id=>after.bookings.find(b=>b.id===id)?.lifecycle.deadline===state.bookings.find(b=>b.id===id)?.lifecycle.deadline),'Summary confirmation keeps both original deadlines')
check(after.sessions.filter(s=>s.booking_id===family).length===2,'Family hour retains self and child together')
const saved=snapshot(),replay=await req('/api/booking-checkout',{action:'set',requestId:key,input:{...input,expectedTotal:preview.body.total}})
check(replay.status===200&&replay.body.idempotentReplay&&snapshot()===saved,'Lost acknowledgement/replay does not duplicate edits')
const receipt=await req('/api/booking-checkout?operation=set&requestId='+key)
check(receipt.body.found===true,'Committed edit can be recovered by original request ID')
check(sql(`SELECT count(*) FROM booking_package_units WHERE booking_id=ANY(ARRAY[${ids.map(q)}]::uuid[])`)==='0','Preview/save of unpaid packages grants no rights')
const stale=await req('/api/booking-checkout',{action:'set',preview:true,requestId:randomUUID(),input})
check(stale.status===409,'Stale review cannot overwrite another saved edit')
fs.writeFileSync(root+'/http-checks.json',JSON.stringify({passed:true,checks,actor,child,ids,before,after:saved,at:new Date().toISOString()},null,2))
