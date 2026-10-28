import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {fixtures,sql,q} from '../tests/booking-ux/runtime.mjs'
import {auth} from './check-booking-ux-seven.mjs'
const root='.playwright/booking-ux-1/ux-two-20261022',base=process.env.BOOKING_TWO_BASE||'http://127.0.0.1:3153',f=JSON.parse(fs.readFileSync('.playwright/booking-ux-1/fixture.json'))
assert.ok(!fs.existsSync(root+'/actor.json'),'Use existing fixture instead of creating duplicates')
const actor=await fixtures.account('user','ผู้ปกครองทดสอบ UX สองจุด'),children=[randomUUID(),randomUUID()],branches=[f.branch,sql("SELECT id FROM branches WHERE name='สาขาทดสอบ UX 02' AND is_active LIMIT 1")]
sql(`INSERT INTO children(id,parent_id,full_name,nickname)VALUES(${q(children[0])},${q(actor.id)},'เด็กทดสอบ เอ','น้องเอ'),(${q(children[1])},${q(actor.id)},'เด็กทดสอบ บี','น้องบี')`)
fs.writeFileSync(root+'/actor.json',JSON.stringify({...actor,children,branches},null,2))
const cookie=await auth(actor),request=async(path,body)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Cookie:cookie,Origin:base,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d}
const session=(course,date,branch,childId,start='10:00')=>({date,startTime:start,endTime:start==='10:00'?'11:00':'18:00',branchId:branch,childId,scheduleTemplateId:sql(`SELECT id FROM schedule_templates WHERE branch_id=${q(branch)} AND course_type_id=${q(f.courses[course])} AND day_of_week=extract(dow FROM date ${q(date)}) AND start_time=${q(start)} AND is_active LIMIT 1`)})
async function kids(month,child,ss){const p=await request('/api/bookings/preview',{courseTypeId:f.courses.kids_group,month,year:2026,totalSessions:ss.length});return(await request('/api/booking-checkout',{action:'create',requestId:randomUUID(),input:{courseTypeId:f.courses.kids_group,branchId:ss[0].branchId,learnerType:'child',childId:child,month,year:2026,totalSessions:ss.length,totalAmount:p.grossPrice,expectedTotalPrice:p.totalPrice,sessions:ss,expectedScopeRevision:p.expectedScopeRevision,expectedLegacyBaselineSessions:p.legacyBaselineSessions,expectedLegacyBaselineFingerprint:p.legacyBaselineFingerprint,expectedPolicyFingerprint:p.policy.fingerprint}})).bookingId}
const ids=[await kids(10,children[0],[session('kids_group','2026-10-31',branches[0],children[0])]),await kids(10,children[1],[session('kids_group','2026-10-30',branches[1],children[1]),session('kids_group','2026-10-30',branches[0],children[1],'17:00')])]
const many=[await kids(11,children[0],Array.from({length:10},(_,i)=>session('kids_group','2026-11-'+String(i+1).padStart(2,'0'),branches[0],children[0]))),await kids(11,children[1],Array.from({length:10},(_,i)=>session('kids_group','2026-11-'+String(i+11).padStart(2,'0'),branches[i%2],children[1])))]
const snapshot=ids=>JSON.parse(sql(`SELECT jsonb_agg(jsonb_build_object('id',id,'checkout_deadline',checkout_deadline,'total_price',total_price,'child_id',child_id,'package_snapshot',package_snapshot,'package_participants',package_participants) ORDER BY id) FROM bookings WHERE id=ANY(ARRAY[${ids.map(q)}]::uuid[])`))
const evidence={ids,many,before:snapshot([...ids,...many])};fs.writeFileSync(root+'/fixture.json',JSON.stringify(evidence,null,2))
console.log(JSON.stringify({email:actor.email,ids,many}))
