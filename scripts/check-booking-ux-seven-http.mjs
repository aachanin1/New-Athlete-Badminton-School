import fs from'node:fs'
import assert from'node:assert/strict'
import {randomUUID}from'node:crypto'
import sharp from 'sharp'
import {sql,q,fixtures,db}from'../tests/booking-ux/runtime.mjs'
import {auth,kids}from'./check-booking-ux-seven.mjs'
const base='http://127.0.0.1:3153',root='.playwright/booking-ux-1/ux-seven-20261022',checks=[]
const check=(v,s)=>{assert.ok(v,s);checks.push(s);console.log(s)},actor=await fixtures.account('user','ทดสอบ HTTP ชุดชำระ'),other=await fixtures.account('user','ทดสอบ HTTP บัญชีอื่น'),child=randomUUID()
sql(`INSERT INTO children(id,parent_id,full_name)VALUES(${q(child)},${q(actor.id)},'เด็กทดสอบ HTTP')`)
const cookie=await auth(actor),otherCookie=await auth(other)
const req=async(url,body,who=cookie,origin=base)=>{const r=await fetch(base+url,{method:body?'POST':'GET',headers:{Cookie:who,Origin:origin,...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body?(body instanceof FormData?body:JSON.stringify(body)):undefined});return {status:r.status,body:await r.json()}}
check((await req('/api/booking-checkout',null,'')).status===401,'Unauthenticated checkout read denied')
check((await req('/api/booking-checkout',{action:'set'},'')).status===401,'Unauthenticated grouped mutation denied')
check((await req('/api/booking-checkout',{action:'set'},cookie,'https://unrelated.invalid')).status===403,'Cross-origin grouped mutation denied')
const ids=[await kids(actor,['2026-10-23','2026-10-24'],child,base),await kids(actor,['2026-10-25','2026-10-26','2026-10-27','2026-10-28'],child,base)]
const url='/api/booking-checkout?bookingId='+ids[0],read=async()=>{const r=await req(url);assert.equal(r.status,200,JSON.stringify(r));return r.body}
check((await req(url,null,otherCookie)).status===404,'Other customer cannot read an owned payable set')
let state=await read();const prepared=await req('/api/progressive-payments/prepare',{pricingScopeId:state.scopes[0].id,bookingIds:ids,expectedScopeRevision:state.scopes[0].revision,idempotencyKey:randomUUID()});assert.equal(prepared.status,200,JSON.stringify(prepared));const batchId=prepared.body.batch.batchId||prepared.body.batch.id
check(sql(`SELECT status FROM progressive_payment_batches WHERE id=${q(batchId)}`)==='prepared','Prepared batch exists through actual payment API')
const editor=await req(url+'&editor=1');assert.equal(editor.status,200,JSON.stringify(editor));state=editor.body
const edits=state.bookings.map(b=>({id:b.id,sessions:state.sessions.filter(s=>s.booking_id===b.id).map(s=>({date:s.date,startTime:s.start_time.slice(0,5),endTime:s.end_time.slice(0,5),branchId:s.branch_id,childId:s.child_id}))}))
edits[0].sessions[0].date='2026-10-29';edits[1].sessions[0].date='2026-10-30'
const input={action:'edit',bookingIds:ids,token:state.editor.token,edits},nonce=randomUUID()
const preview=await req('/api/booking-checkout',{action:'set',requestId:randomUUID(),preview:true,input});assert.equal(preview.status,200,JSON.stringify(preview))
check(sql(`SELECT status FROM progressive_payment_batches WHERE id=${q(batchId)}`)==='prepared','Preview leaves prepared batch and reservation intact')
input.expectedTotal=preview.body.total;const saved=await req('/api/booking-checkout',{action:'set',requestId:nonce,input});assert.equal(saved.status,200,JSON.stringify(saved))
check(sql(`SELECT status FROM progressive_payment_batches WHERE id=${q(batchId)}`)==='cancelled','Grouped edit cancels old prepared batch inside the same transaction')
check((await req('/api/booking-checkout?requestId='+nonce+'&operation=set')).body.found===true,'HTTP readback resolves committed grouped mutation')
check((await req('/api/booking-checkout?requestId='+nonce+'&operation=set',null,otherCookie)).body.found===false,'Mutation receipt is private to authenticated owner')
const replay=await req('/api/booking-checkout',{action:'set',requestId:nonce,input});check(replay.status===200&&replay.body.idempotentReplay===true,'HTTP write replay returns durable original result')
state=await read();const prep2=await req('/api/progressive-payments/prepare',{pricingScopeId:state.scopes[0].id,bookingIds:ids,expectedScopeRevision:state.scopes[0].revision,idempotencyKey:randomUUID()});assert.equal(prep2.status,200,JSON.stringify(prep2));const nextId=prep2.body.batch.batchId||prep2.body.batch.id
const invalid=new FormData();invalid.set('batchId',nextId);invalid.set('file',new Blob(['not a real image'],{type:'image/jpeg'}),'fake.jpg')
check((await req('/api/progressive-payments/upload',invalid)).status===400,'Server rejects fake image bytes despite JPEG declaration')
const duplicate=new FormData();duplicate.set('batchId',nextId);duplicate.set('file',new Blob([fs.readFileSync(root+'/LOCAL-TEST-NO-REAL-PAYMENT.png')],{type:'image/png'}),'old-slip.png');const repeated=await req('/api/progressive-payments/upload',duplicate);check(repeated.status===409&&repeated.body.code==='PROGRESSIVE_UPLOAD_EXISTING_PAYMENT','Duplicate slip is rejected with an explicit existing-payment message');
const unique=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="100"><text x="5" y="40">LOCAL TEST '+randomUUID()+'</text></svg>')).png().toBuffer();
assert.ifError((await db.storage.from('progressive-payment-slips').upload(actor.id+'/batches/'+nextId+'/storage-only.png',unique,{contentType:'image/png'})).error);
check(sql(`SELECT count(*) FROM bookings WHERE id=ANY(ARRAY[${ids.map(q)}]::uuid[]) AND public.task10_has_accepted_receipt_v1(id)`)==='0','Raw Storage write alone is not an accepted receipt');
const upload=new FormData();upload.set('batchId',nextId);upload.set('file',new Blob([unique],{type:'image/png'}),'LOCAL-UNIQUE-TEST.png')
const uploaded=await req('/api/progressive-payments/upload',upload);assert.equal(uploaded.status,200,JSON.stringify(uploaded))
check(sql(`SELECT count(*) FROM bookings WHERE id=ANY(ARRAY[${ids.map(q)}]::uuid[]) AND public.task10_has_accepted_receipt_v1(id)`)==='2','Validated payment-upload endpoint durably accepts receipts for both members')
const submit={batchId:nextId,submitKey:randomUUID(),attemptKey:randomUUID()},accepted=await req('/api/progressive-payments/submit',submit);assert.equal(accepted.status,200,JSON.stringify(accepted))
check(sql(`SELECT count(*) FROM bookings WHERE id=ANY(ARRAY[${ids.map(q)}]::uuid[]) AND status='verified'`)==='2','Local provider policy verifies all members of complete payment scope')
const paymentCount=sql(`SELECT count(*) FROM payments WHERE booking_id=ANY(ARRAY[${ids.map(q)}]::uuid[])`)
check((await req('/api/progressive-payments/submit',submit)).status===200&&sql(`SELECT count(*) FROM payments WHERE booking_id=ANY(ARRAY[${ids.map(q)}]::uuid[])`)===paymentCount,'Repeated submit adds no duplicate payment')
check(sql("SELECT has_function_privilege('authenticated','public.booking_ux_edit_set_v1(uuid,uuid,jsonb,boolean)','EXECUTE')") ==='f','Grouped definer function is not directly callable by customer role')
fs.writeFileSync(root+'/http-tests.json',JSON.stringify({passed:true,checks,actor,ids,at:new Date().toISOString()},null,2));console.log(JSON.stringify({passed:checks.length}))
