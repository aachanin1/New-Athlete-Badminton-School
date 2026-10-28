import assert from 'node:assert/strict'
import {adminMakeupCurrentMonth,adminMakeupShiftMonth} from '../src/lib/admin-makeup-month.ts'
import {kidsMakeupCalendarDays,makeupMonthDates,findKidsMakeupSlot} from '../src/lib/makeup-calendar.ts'
const checks=[],check=(ok,label)=>{assert.ok(ok,label);checks.push(label)}
check(adminMakeupCurrentMonth(new Date('2026-10-31T16:59:59Z'))==='2026-10','Bangkok last second of October')
check(adminMakeupCurrentMonth(new Date('2026-10-31T17:00:00Z'))==='2026-11','Bangkok new month')
check(adminMakeupShiftMonth('2026-12',1)==='2027-01','Next year navigation')
check(adminMakeupShiftMonth('2027-01',-1)==='2026-12','Previous year navigation')
check(adminMakeupShiftMonth('2026-10',1)==='2026-11','Adjacent month navigation')
check(adminMakeupShiftMonth('bad',1)===''&&adminMakeupShiftMonth('2026-13',1)==='','Invalid month cannot produce a calendar')
check(makeupMonthDates('2028-02').at(-1)==='2028-02-29','Leap year calendar')
const branches=[{id:'branch',slug:'test',name:'ทดสอบ'}],templates=Array.from({length:7},(_,day_of_week)=>({id:'t'+day_of_week,is_active:true,course_type_name:'kids_group',branch_id:'branch',branch_slug:'test',day_of_week,start_time:'17:00:00',end_time:'18:00:00'}))
const now=new Date('2026-10-27T16:59:59+07:00'),days=kidsMakeupCalendarDays('2026-10',branches,templates,now)
check(days[0].dateInput==='2026-10-27','Current month includes the not-started round today')
check(kidsMakeupCalendarDays('2026-10',branches,templates,new Date('2026-10-27T17:00:00+07:00'))[0].dateInput==='2026-10-28','Round at its start is unavailable')
check(kidsMakeupCalendarDays('2026-09',branches,templates,now).length===0,'Past dates remain unavailable')
check(kidsMakeupCalendarDays('2027-01',branches,templates,now).length===31,'Later year month is available without loading other months')
check(findKidsMakeupSlot('2027-01','2027-01-02','t6',branches,templates,now)?.date==='2027-01-02','Selected future month validates its real template')
check(findKidsMakeupSlot('2026-11','2027-01-02','t6',branches,templates,now)===null,'A stale selection from another displayed month is rejected')
console.log(JSON.stringify({passed:checks.length,checks}))
