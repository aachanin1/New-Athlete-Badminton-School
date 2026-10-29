import fs from 'node:fs'
import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { run, sql, q, db, fixtures, concurrentSql, holdTransaction, observeLockWait } from '../tests/booking-ux/runtime.mjs'

const root='.playwright/booking-ux-2/db-'+Date.now();fs.mkdirSync(root,{recursive:true})
const f=JSON.parse(fs.readFileSync(run.evidenceRoot+'/fixture.json')), checks=[]
const check=(ok,name)=>{assert.ok(ok,name);checks.push(name);console.log(name)}
const json=s=>JSON.parse(sql(s)), arg=v=>v===null?'NULL':typeof v==='object'?q(JSON.stringify(v))+'::jsonb':q(v)
const statement=(n,...a)=>`SELECT public.${n}(${a.map(arg).join(',')});`
const rpc=(n,...a)=>json(statement(n,...a))
const state=id=>json(`SELECT jsonb_build_object('booking',to_jsonb(b),'hold',(SELECT to_jsonb(r) FROM progressive_coupon_reservations r WHERE booking_id=b.id),'uses',(SELECT count(*) FROM coupon_usages WHERE booking_id=b.id),'units',(SELECT count(*) FROM booking_package_units WHERE booking_id=b.id)) FROM bookings b WHERE id=${q(id)}`)
const body=(pkg,coupon,discount=0,sessions=[],participants=[null])=>{
 const p=json(`SELECT to_jsonb(p) FROM booking_ux_packages p WHERE id=${q(pkg)}`),date=sessions[0]?.date||sql("SELECT (now() AT TIME ZONE 'Asia/Bangkok')::date+3")
 const gross=Number(sql(`SELECT task10_legacy_price_v1(NULL,${q(f.courses[p.course])},${Number(date.slice(5,7))},${Number(date.slice(0,4))},${p.quantity},NULL)`))
 return {packageId:pkg,packageRevision:p.revision,courseTypeId:f.courses[p.course],branchId:f.branch,participants,learnerType:participants.includes(null)?'self':'child',childId:participants.length===1?participants[0]:null,month:Number(date.slice(5,7)),year:Number(date.slice(0,4)),totalSessions:p.quantity,totalAmount:gross,expectedTotalPrice:gross-discount,sessions,coupon:coupon?{id:coupon.id,code:coupon.code}:null}
}
const coupon=(type='fixed',value=500,min=0,max=null)=>{const id=randomUUID(),code='UX2'+randomUUID().slice(0,8).toUpperCase();sql(`INSERT INTO coupons(id,code,discount_type,discount_value,min_purchase,max_uses,created_by) VALUES(${q(id)},${q(code)},${q(type)},${value},${min},${max===null?'NULL':max},${q(f.sa.id)})`);return{id,code}}
const create=(actor,input,request=randomUUID())=>rpc('booking_ux_create_v1',actor.id,request,input)
const edit=(actor,id,sessions,extra={})=>({action:'edit',bookingIds:[id],token:sql(`SELECT booking_ux_set_token_v1(${q(actor.id)},ARRAY[${q(id)}]::uuid[])`),edits:[{id,sessions}],...extra})
const invoke=(actor,input,preview=false,request=randomUUID())=>json(`SELECT booking_ux_edit_set_v1(${q(actor.id)},${q(request)},${arg(input)},${preview})`)
const cancel=(actor,id)=>invoke(actor,{...edit(actor,id,[]),action:'cancel'})
async function accept(actor,bill){
 const request=randomUUID(),name=actor.id+'/'+request+'/slip.png',bytes=Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBXkAAAAASUVORK5CYII=','base64'),Buffer.from(request)])
 const upload=await db.storage.from('payment-slips').upload(name,bytes,{contentType:'image/png'});assert.ifError(upload.error)
 sql(`SELECT task10_accept_legacy_slip_v1(${q(actor.id)},ARRAY[${q(bill.bookingId)}]::uuid[],${q(name)},${q(run.target.api+'/storage/v1/object/public/payment-slips/'+name)},${q(createHash('sha256').update(bytes).digest('hex'))},${bill.totalPrice},${q(request)})`)
 return request
}
let actor,other
try{
 actor=await fixtures.account('user','คูปองทดสอบ UX2');other=await fixtures.account('user','โควตาทดสอบ UX2')
 const c=coupon('fixed',500,500,1),input=body('adult-10',c,500),request=randomUUID()
 const quote=rpc('booking_ux_coupon_quote_v2',actor.id,c.id,input.courseTypeId,input.totalAmount,null)
 check(quote.totalPrice===input.expectedTotalPrice&&sql(`SELECT count(*) FROM progressive_coupon_reservations WHERE user_id=${q(actor.id)}`)==='0','Preview computes discount without reserving or consuming')
 const a=create(actor,input,request),before=state(a.bookingId)
 check(a.status==='pending_payment'&&before.hold.status==='reserved'&&before.uses===0&&before.units===0,'Pending Adult coupon holds quota without actual usage or rights')
 check(create(actor,input,request).bookingId===a.bookingId&&state(a.bookingId).hold.id===before.hold.id,'Creation replay creates one bill and one hold')
 assert.throws(()=>create(actor,body('private-10',c,500)),/COUPON_ALREADY_USED/);checks.push('Same account cannot reuse pending coupon across course paths')
 assert.throws(()=>create(other,input),/COUPON_MAX_USES/);checks.push('Held last aggregate quota blocks another account')
 cancel(actor,a.bookingId);check(state(a.bookingId).hold.status==='released','Terminal cancellation releases pending hold')
 const again=create(actor,input);check(state(again.bookingId).hold.status==='reserved','Released coupon can be used on a fresh bill')
 const accepted=await accept(actor,again)
 check(state(again.bookingId).hold.status==='reserved'&&state(again.bookingId).units===0,'Accepted receipt alone does not consume coupon or grant rights')
 rpc('task10_finalize_legacy_slip_v1',actor.id,accepted,true,'UX2 isolated success')
 check(state(again.bookingId).hold.status==='consumed'&&state(again.bookingId).units===10,'Verified payment consumes coupon and grants ten units atomically')
 rpc('task10_finalize_legacy_slip_v1',actor.id,accepted,true,'UX2 isolated success')
 check(state(again.bookingId).units===10&&state(again.bookingId).uses===0,'Payment replay does not duplicate coupon usage or rights')
 const percent=coupon('percent',10),p=create(actor,body('private-10',percent,800)),deadline=state(p.bookingId).booking.checkout_deadline
 const date=sql("SELECT ((now() AT TIME ZONE 'Asia/Bangkok')::date+4)::text"),template=sql(`SELECT id FROM schedule_templates WHERE branch_id=${q(f.branch)} AND course_type_id=${q(f.courses.private)} AND day_of_week=extract(dow FROM date ${q(date)}) AND start_time='10:00' AND is_active LIMIT 1`)
 const sessions=[{date,startTime:'10:00',endTime:'11:00',branchId:f.branch,childId:null,scheduleTemplateId:template}],e=edit(actor,p.bookingId,sessions),token=e.token
 const preview=invoke(actor,e,true)
 check(preview.total===7200&&preview.bills[0].coupon_discount===800&&edit(actor,p.bookingId,sessions).token===token,'Real-writer edit preview retains percent discount and rolls back all changes')
 e.expectedTotal=preview.total;invoke(actor,e)
 check(state(p.bookingId).booking.total_price===7200&&state(p.bookingId).hold.status==='reserved'&&state(p.bookingId).booking.checkout_deadline===deadline,'Date edit preserves percent discount, same bill and original deadline')
 const zero=coupon('percent',100),z=create(other,body('adult-10',zero,5500))
 check(z.status==='verified'&&state(z.bookingId).hold.status==='consumed'&&state(z.bookingId).units===10,'Explicit zero-charge confirmation consumes coupon without slip')
 const raceCoupon=coupon('fixed',100,0,1),rInput=body('adult-10',raceCoupon,100),name='ux2-quota-'+randomUUID()
 const held=await holdTransaction(`SELECT id FROM coupons WHERE id=${q(raceCoupon.id)} FOR UPDATE;`,name+'-holder')
 const outcomesPromise=Promise.allSettled([actor,other].map((u,i)=>concurrentSql(`SET application_name=${q(name+i)};${statement('booking_ux_create_v1',u.id,randomUUID(),rInput)}`)))
 await observeLockWait(name+'0');held.release();await held.done;const outcomes=await outcomesPromise
 check(outcomes.filter(r=>r.status==='fulfilled').length===1&&sql(`SELECT count(*) FROM progressive_coupon_reservations WHERE coupon_id=${q(raceCoupon.id)} AND status='reserved'`)==='1','Observed quota lock contention allows exactly one last-slot winner')
 check(sql(`SELECT count(*) FROM bookings b JOIN progressive_coupon_reservations r ON r.booking_id=b.id WHERE b.user_id IN (${q(actor.id)},${q(other.id)}) AND b.status='pending_payment' AND r.status='consumed'`)==='0','No pending coupon is recorded consumed')
 fs.writeFileSync('.playwright/booking-ux-2/fixture.json',JSON.stringify({actor,other,password:fixtures.password,branch:f.branch,courses:f.courses,checks},null,2))
 fs.writeFileSync(root+'/result.json',JSON.stringify({pass:true,checks,actor,other,target:run.target},null,2));console.log(JSON.stringify({root,passed:checks.length}))
}catch(e){fs.writeFileSync(root+'/failure.json',JSON.stringify({checks,error:String(e),stderr:String(e.stderr||''),actor,other},null,2));throw e}
