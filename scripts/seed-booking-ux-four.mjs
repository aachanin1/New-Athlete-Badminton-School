import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import sharp from 'sharp'
import {sql,q,db,fixtures} from '../tests/booking-ux/runtime.mjs'
import {auth} from './check-booking-ux-seven.mjs'
const root='.playwright/booking-ux-1/ux-four-20261022',base=process.env.BOOKING_FOUR_BASE||'http://127.0.0.1:3153'
fs.mkdirSync(root,{recursive:true})
const f=JSON.parse(fs.readFileSync('.playwright/booking-ux-1/fixture.json','utf8'))
let actor
if(fs.existsSync(root+'/actor.json'))actor=JSON.parse(fs.readFileSync(root+'/actor.json','utf8'))
else{
 const email='booking-ux4-20261022@example.invalid',existing=sql(`SELECT id FROM auth.users WHERE email=${q(email)}`)
 const r=existing?await db.auth.admin.getUserById(existing):await db.auth.admin.createUser({email,password:fixtures.password,email_confirm:true});assert.ifError(r.error)
 actor={id:r.data.user.id,email,password:fixtures.password,children:[randomUUID(),randomUUID()],branches:[f.branch,sql(`SELECT id FROM branches WHERE name='สาขาทดสอบ UX 02' AND is_active LIMIT 1`)]};assert.ok(actor.branches[1])
 assert.ifError((await db.from('profiles').update({full_name:'ผู้ปกครองทดสอบ UX 4 จุด',role:'user'}).eq('id',actor.id)).error)
 sql(`INSERT INTO children(id,parent_id,full_name,nickname)VALUES(${q(actor.children[0])},${q(actor.id)},'เด็กทดสอบ เอ','น้องเอ'),(${q(actor.children[1])},${q(actor.id)},'เด็กทดสอบ บี','น้องบี')`)
 fs.writeFileSync(root+'/actor.json',JSON.stringify(actor,null,2))
}
const cookie=await auth(actor),request=async(path,body)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Cookie:cookie,Origin:base,...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body?body instanceof FormData?body:JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data}
async function make(month,child,branch,days){
 const sessions=days.map(day=>{const date=`2026-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;return {date,startTime:'10:00',endTime:'11:00',branchId:branch,childId:child,scheduleTemplateId:sql(`SELECT id FROM schedule_templates WHERE branch_id=${q(branch)} AND course_type_id=${q(f.courses.kids_group)} AND day_of_week=extract(dow FROM date ${q(date)}) AND start_time='10:00' AND is_active LIMIT 1`)}})
 const p=await request('/api/bookings/preview',{courseTypeId:f.courses.kids_group,month,year:2026,totalSessions:days.length})
 return (await request('/api/booking-checkout',{action:'create',requestId:randomUUID(),input:{courseTypeId:f.courses.kids_group,branchId:branch,learnerType:'child',childId:child,month,year:2026,totalSessions:days.length,totalAmount:p.grossPrice,expectedTotalPrice:p.totalPrice,sessions,expectedScopeRevision:p.expectedScopeRevision,expectedLegacyBaselineSessions:p.legacyBaselineSessions,expectedLegacyBaselineFingerprint:p.legacyBaselineFingerprint,expectedPolicyFingerprint:p.policy.fingerprint}})).bookingId
}
if(process.argv[2]==='history'){
 assert.ok(!fs.existsSync(root+'/history.json'),'History already seeded')
 const ids=[await make(10,actor.children[0],actor.branches[0],[25,26]),await make(10,actor.children[1],actor.branches[1],[27,28])]
 const state=await request('/api/booking-checkout?bookingId='+ids[0]),batch=await request('/api/progressive-payments/prepare',{pricingScopeId:state.scopes[0].id,bookingIds:ids,expectedScopeRevision:state.scopes[0].revision,idempotencyKey:randomUUID()}),batchId=batch.batch.batchId||batch.batch.id
 const png=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="160"><text x="15" y="60">LOCAL TEST ONLY '+randomUUID()+'</text></svg>')).png().toBuffer(),form=new FormData();form.set('batchId',batchId);form.set('file',new Blob([png],{type:'image/png'}),'LOCAL-TEST-NO-REAL-TRANSFER.png')
 await request('/api/progressive-payments/upload',form);await request('/api/progressive-payments/submit',{batchId,submitKey:randomUUID(),attemptKey:randomUUID()})
 assert.equal(sql(`SELECT count(*) FROM bookings WHERE id=ANY(ARRAY[${ids.map(q)}]::uuid[]) AND status='verified'`),'2')
 fs.writeFileSync(root+'/history.json',JSON.stringify({ids,batchId},null,2))
}else if(process.argv[2]==='pending'){
 const ids=[await make(11,actor.children[0],actor.branches[0],Array.from({length:10},(_,i)=>i+1)),await make(11,actor.children[1],actor.branches[1],Array.from({length:10},(_,i)=>i+11))]
 fs.writeFileSync(root+'/pending-'+Date.now()+'.json',JSON.stringify({ids,deadlines:sql(`SELECT jsonb_object_agg(id,checkout_deadline) FROM bookings WHERE id=ANY(ARRAY[${ids.map(q)}]::uuid[])`)},null,2));fs.writeFileSync(root+'/pending-current.json',JSON.stringify({ids},null,2))
}
console.log(JSON.stringify({actor:actor.email,mode:process.argv[2]}))
