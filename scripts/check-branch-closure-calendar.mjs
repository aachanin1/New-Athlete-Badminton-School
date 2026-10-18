import assert from 'node:assert/strict'
import { getTemplateSlots, hasTemplateSlots } from '../src/lib/schedule-template-utils.ts'
import { kidsMakeupCalendarDays, makeupCalendarCells } from '../src/lib/makeup-calendar.ts'
import { buildBookingSlotAvailability } from '../src/lib/booking-slot-availability.ts'
const checks=[],check=(v,s)=>{assert.ok(v,s);checks.push(s)}
const branches=[{id:'chaeng',name:'แจ้งวัฒนะ',slug:'chaeng'},{id:'ramin',name:'รามอินทรา',slug:'ramin'}]
const courses=['kids_group','adult_group','private']
const templates=courses.flatMap(course=>branches.map(b=>({id:b.id+'-'+course,branch_id:b.id,branch_slug:b.slug,course_type_id:course,course_type_name:course,day_of_week:2,start_time:'16:00',end_time:'17:00',is_active:true,notes:null,closed_dates:b.id==='chaeng'?['2026-10-20']:[]})))
for(const course of courses){
 for(const day of [6,13,27])check(getTemplateSlots(templates,'chaeng',course,2,`2026-10-${String(day).padStart(2,'0')}`).length===1,`${course} remains open on Tuesday ${day}`)
 check(getTemplateSlots(templates,'chaeng',course,2,'2026-10-20').length===0,`${course} closes only Tuesday 20`)
 check(getTemplateSlots(templates,'ramin',course,2,'2026-10-20').length===1,`${course} remains open at the other branch`)
}
check(!hasTemplateSlots(templates,'chaeng','kids_group',new Date(2026,9,20)),'Parent date selection recognizes the branch closure')
const days=kidsMakeupCalendarDays('2026-10',branches,templates,new Date('2026-10-01T00:00:00Z'))
check(days.find(d=>d.dateInput==='2026-10-20').slotsByBranch.every(b=>b.branch.id==='ramin'),'Makeup calendar retains the other open branch on the same date')
check(makeupCalendarCells('2026-10',days).filter(Boolean).length===31,'Dated closure does not remove a calendar date or alter weekdays')
const candidates=branches.map(b=>({branchId:b.id,date:'2026-10-20',startTime:'16:00',endTime:'17:00',scheduleTemplateId:b.id+'-kids_group'}))
const slots=buildBookingSlotAvailability({courseTypeId:'kids_group',candidates,templates,closures:[{id:'closure',branch_id:'chaeng',closure_date:'2026-10-20',is_active:true,reason:'หยุดเฉพาะวัน',updated_at:'2026-10-01T00:00:00Z'}],
 scheduleSlots:[{id:'occupied',template_id:'ramin-kids_group',branch_id:'ramin',course_type_id:'kids_group',date:'2026-10-20',start_time:'16:00',end_time:'17:00',status:'full',max_students:1,current_students:99}],
 bookingSessions:Array.from({length:99},(_,i)=>({schedule_slot_id:'occupied',booking_id:'b'+i,cancelled_at:null,status:'scheduled',bookings:{status:'verified',expires_at:null}})),nowMs:Date.parse('2026-10-01T00:00:00Z')})
check(!slots[0].valid&&slots[0].unavailableReason==='branch_closed','Availability reports a dated closure explicitly')
check(slots[1].valid&&slots[1].activeOccupancy===99,'Closure change preserves unlimited learner admission in open branches')
console.log(JSON.stringify({passed:true,checks:checks.length}))
