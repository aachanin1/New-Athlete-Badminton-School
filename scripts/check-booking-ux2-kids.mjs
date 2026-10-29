import fs from 'node:fs'
import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { createServerClient } from '@supabase/ssr'
import { run, env, sql, q, db, fixtures } from '../tests/booking-ux/runtime.mjs'

const base=process.env.BOOKING_UX2_BASE||'http://127.0.0.1:3152',root='.playwright/booking-ux-2/kids-'+Date.now();fs.mkdirSync(root,{recursive:true})
const f=JSON.parse(fs.readFileSync(run.evidenceRoot+'/fixture.json')),checks=[]
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label);console.log(label)}
const json=s=>JSON.parse(sql(s)),arg=v=>v===null?'NULL':typeof v==='object'?q(JSON.stringify(v))+'::jsonb':q(v)
const rpc=(n,...a)=>json(`SELECT ${n}(${a.map(arg).join(',')})`)
const state=id=>json(`SELECT jsonb_build_object('bill',to_jsonb(b),'hold',(SELECT to_jsonb(r) FROM progressive_coupon_reservations r WHERE booking_id=b.id)) FROM bookings b WHERE id=${q(id)}`)
async function login(a){const cookies=new Map();const c=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:xs=>xs.forEach(x=>cookies.set(x.name,x.value))}});assert.ifError((await c.auth.signInWithPassword({email:a.email,password:fixtures.password})).error);return [...cookies].map(([k,v])=>k+'='+v).join('; ')}
async function api(cookie,path,input){const r=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{Cookie:cookie,Origin:base,Connection:'close',...(input instanceof FormData?{}:{'Content-Type':'application/json'})},body:input===undefined?undefined:input instanceof FormData?input:JSON.stringify(input)});const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d}
const coupon=(min=0,type='fixed',value=500)=>{const id=randomUUID(),code='KIDSUX2'+randomUUID().slice(0,8).toUpperCase();sql(`INSERT INTO coupons(id,code,discount_type,discount_value,min_purchase,created_by) VALUES(${q(id)},${q(code)},${q(type)},${value},${min},${q(f.sa.id)})`);return{id,code}}
const date=n=>sql(`SELECT (date_trunc('month',now() AT TIME ZONE 'Asia/Bangkok')+interval '1 month'+interval '${n} days')::date::text`)
function round(child,n){const d=date(n);return{date:d,startTime:'10:00',endTime:'11:00',branchId:f.branch,childId:child,scheduleTemplateId:sql(`SELECT id FROM schedule_templates WHERE branch_id=${q(f.branch)} AND course_type_id=${q(f.courses.kids_group)} AND day_of_week=extract(dow FROM date ${q(d)}) AND start_time='10:00' AND is_active LIMIT 1`)}}
async function create(a,cookie,child,c,rounds){const d=rounds[0].date,p=await api(cookie,'/api/bookings/preview',{courseTypeId:f.courses.kids_group,month:+d.slice(5,7),year:+d.slice(0,4),totalSessions:rounds.length,couponId:c?.id});const b={courseTypeId:f.courses.kids_group,branchId:f.branch,learnerType:'child',childId:child,month:+d.slice(5,7),year:+d.slice(0,4),totalSessions:rounds.length,totalAmount:p.grossPrice,expectedTotalPrice:p.totalPrice,sessions:rounds,coupon:c,expectedScopeRevision:p.expectedScopeRevision,expectedLegacyBaselineSessions:p.legacyBaselineSessions,expectedLegacyBaselineFingerprint:p.legacyBaselineFingerprint,expectedPolicyFingerprint:p.policy.fingerprint};const r=await api(cookie,'/api/booking-checkout',{action:'create',requestId:randomUUID(),input:b});return r.bookingId||r.result?.bookingId}
const command=(a,ids,edits)=>({action:'edit',bookingIds:ids,token:sql(`SELECT booking_ux_set_token_v1(${q(a.id)},ARRAY[${ids.map(q)}]::uuid[])`),edits})
const edit=(a,input,preview=false,key=randomUUID())=>json(`SELECT booking_ux_edit_set_v1(${q(a.id)},${q(key)},${arg(input)},${preview})`)
async function prepare(cookie,id){const s=await api(cookie,'/api/booking-checkout?bookingId='+id);return(await api(cookie,'/api/progressive-payments/prepare',{pricingScopeId:s.bookings[0].pricing_scope_id,bookingIds:s.bookings.map(b=>b.id),expectedScopeRevision:s.scopes[0].revision,idempotencyKey:randomUUID()})).batch}
async function upload(cookie,batch){const bytes=Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBXkAAAAASUVORK5CYII=','base64'),Buffer.from(randomUUID())]),form=new FormData();form.set('batchId',batch.batchId);form.set('file',new Blob([bytes],{type:'image/png'}),'ux2.png');await api(cookie,'/api/progressive-payments/upload',form);return await api(cookie,'/api/progressive-payments/'+batch.batchId+'/status')}
const clockBefore=sql("SELECT pg_get_functiondef('task10_clock_v1()'::regprocedure)")
const transactionClockBefore=sql("SELECT pg_get_functiondef('task10_transaction_start_v1()'::regprocedure)")
try{
 const a=await fixtures.account('user','เด็กคูปอง UX2'),cookie=await login(a),child=randomUUID();sql(`INSERT INTO children(id,parent_id,full_name) VALUES(${q(child)},${q(a.id)},'ผู้เรียนทดสอบคูปอง')`)
 const c=coupon(1200),rounds=[round(child,3),round(child,4),round(child,5)],id=await create(a,cookie,child,c,rounds),initial=state(id)
 check(initial.hold.status==='reserved'&&initial.bill.total_price===1375,'Kids coupon starts reserved at authoritative 1875 minus 500')
 const directPreview=await api(cookie,'/api/bookings/preview',{bookingId:id,courseTypeId:f.courses.kids_group,month:+rounds[0].date.slice(5,7),year:+rounds[0].date.slice(0,4),totalSessions:1})
 const direct=await fetch(base+'/api/bookings',{method:'PUT',headers:{Cookie:cookie,Origin:base,Connection:'close','Content-Type':'application/json'},body:JSON.stringify({bookingId:id,branchId:f.branch,courseTypeId:f.courses.kids_group,month:+rounds[0].date.slice(5,7),year:+rounds[0].date.slice(0,4),totalSessions:1,totalAmount:700,expectedTotalPrice:200,sessions:rounds.slice(0,1),clientRequestId:randomUUID(),expectedScopeRevision:directPreview.expectedScopeRevision,expectedPolicyFingerprint:directPreview.policy.fingerprint})})
 const directResult=await direct.json();check(direct.status===409&&directResult.code==='BOOKING_UX_COUPON_ACK_REQUIRED'&&state(id).bill.total_price===1375,'Direct old-tab PUT cannot bypass below-minimum acknowledgement and leaves original bill intact')
 const one=command(a,[id],[{id,sessions:rounds.slice(0,1)}]),token=one.token,p=edit(a,one,true)
 check(p.total===700&&p.couponWarnings.length===1&&state(id).hold.status==='reserved'&&command(a,[id],[]).token===token,'Below-minimum preview warns at full new price and leaves every original field unchanged')
 assert.throws(()=>edit(a,{...one,expectedTotal:700}),/ACK_REQUIRED/);check(state(id).hold.status==='reserved','Below-minimum save without acknowledgement is rejected atomically')
 const key=randomUUID(),confirmed={...one,expectedTotal:700,releaseCouponBookingIds:[id]};edit(a,confirmed,false,key)
 check(state(id).bill.total_price===700&&state(id).hold.status==='released'&&state(id).bill.checkout_deadline===initial.bill.checkout_deadline,'Explicit acknowledgement updates days/net and releases coupon without restarting deadline')
 check(edit(a,confirmed,false,key).idempotentReplay===true,'Acknowledged edit replay is stable')
 let batch=await prepare(cookie,id);await upload(cookie,batch);await api(cookie,'/api/progressive-payments/submit',{batchId:batch.batchId,submitKey:randomUUID(),attemptKey:randomUUID()})
 check(state(id).bill.status==='verified'&&state(id).hold.status==='released','Released-coupon bill can pay full revised price successfully')
 const c2=coupon(0,'percent',10),id2=await create(a,cookie,child,c2,[round(child,8),round(child,9)]),before=state(id2)
 const editTwo=command(a,[id2],[{id:id2,sessions:[round(child,8),round(child,9),round(child,10)]}]),p2=edit(a,editTwo,true)
 check(p2.total===1687&&p2.bills[0].coupon_discount===188&&state(id2).bill.total_price===before.bill.total_price,'Percent coupon recalculates and rounds from new Kids gross; preview does not write')
 edit(a,{...editTwo,expectedTotal:p2.total})
 batch=await prepare(cookie,id2);await upload(cookie,batch)
 const meta=json(`SELECT jsonb_build_object('storageBucket',slip_storage_bucket,'storagePath',slip_storage_path,'mimeType',slip_mime_type,'sizeBytes',slip_size_bytes,'sha256',slip_sha256) FROM progressive_payment_batches WHERE id=${q(batch.batchId)}`)
 rpc('submit_progressive_payment_batch_v1',batch.batchId,a.id,meta,randomUUID())
 rpc('reject_progressive_payment_batch_v1',batch.batchId,f.sa.id,'กรุณาแก้หลักฐานทดสอบ',randomUUID())
 check(state(id2).hold.status==='reserved'&&state(id2).bill.total_price===1687,'Returned Kids receipt retains coupon and revised price')
 const deadline=state(id2).bill.checkout_deadline,after=sql(`SELECT (${q(deadline)}::timestamptz+interval '1 minute')::text`)
 sql("CREATE OR REPLACE FUNCTION public.task10_clock_v1() RETURNS timestamptz LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $$SELECT coalesce(nullif(current_setting('booking_ux.test_clock',true),'')::timestamptz,clock_timestamp())$$;")
 sql("CREATE OR REPLACE FUNCTION public.task10_transaction_start_v1() RETURNS timestamptz LANGUAGE sql STABLE SET search_path=pg_catalog AS $$SELECT coalesce(nullif(current_setting('booking_ux.test_clock',true),'')::timestamptz,transaction_timestamp())$$;")
 check(!json(`BEGIN;SET LOCAL booking_ux.test_clock=${q(after)};SELECT task10_expire_booking_v1(${q(id2)});COMMIT;`).cancelled,'On-time accepted returned receipt protects original bill after deadline')
 const payable=await api(cookie,'/api/booking-checkout?bookingId='+id2),scope=payable.bookings[0].pricing_scope_id
 batch=json(`BEGIN;SET LOCAL booking_ux.test_clock=${q(after)};SELECT prepare_progressive_payment_batch_v2(${q(a.id)},${q(scope)},ARRAY[${q(id2)}]::uuid[],${payable.scopes[0].revision},1687,${q(randomUUID())});COMMIT;`)
 const bytes=Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBXkAAAAASUVORK5CYII=','base64'),Buffer.from(randomUUID())]),sha=createHash('sha256').update(bytes).digest('hex'),storagePath=a.id+'/batches/'+batch.batchId+'/'+sha+'.png'
 assert.ifError((await db.storage.from('progressive-payment-slips').upload(storagePath,bytes,{contentType:'image/png'})).error)
 const correction={storageBucket:'progressive-payment-slips',storagePath,mimeType:'image/png',sizeBytes:bytes.length,sha256:sha}
 sql(`BEGIN;SET LOCAL booking_ux.test_clock=${q(after)};SELECT record_progressive_payment_upload_v1(${q(batch.batchId)},${q(a.id)},'progressive-payment-slips',${q(storagePath)},'image/png',${bytes.length},${q(sha)});SELECT submit_progressive_payment_batch_v1(${q(batch.batchId)},${q(a.id)},${arg(correction)},${q(randomUUID())});SELECT approve_progressive_payment_batch_v1(${q(batch.batchId)},${q(f.sa.id)},${q(randomUUID())});COMMIT;`)
 check(state(id2).bill.status==='verified'&&state(id2).hold.status==='consumed','Corrected Kids receipt consumes held coupon only upon successful approval')
 const zero=coupon(0,'percent',100),z=await create(a,cookie,child,zero,[round(child,15)])
 check(state(z).bill.status==='verified'&&state(z).hold.status==='consumed','Kids zero-charge confirmation consumes once without slip')
 fs.writeFileSync(root+'/result.json',JSON.stringify({pass:true,checks,base,actor:a,id,id2,z},null,2));console.log(JSON.stringify({root,passed:checks.length}))
}catch(e){fs.writeFileSync(root+'/failure.json',JSON.stringify({checks,error:String(e),stderr:String(e.stderr||'')},null,2));throw e}
finally{sql(clockBefore+';'+transactionClockBefore+';')}
