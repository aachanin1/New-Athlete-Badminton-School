import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID,createHash}from'node:crypto'
import {run,sql,q,db,fixtures}from'../tests/booking-ux/runtime.mjs'
const f=JSON.parse(fs.readFileSync(run.evidenceRoot+'/fixture.json')),checks=[]
const latest=fs.readdirSync(run.evidenceRoot).filter(n=>n.startsWith('contracts-fixture-')).sort().at(-1)
const proof=JSON.parse(fs.readFileSync(run.evidenceRoot+'/'+latest)),x=proof.parentStateFixture
const check=(value,label)=>{assert.ok(value,label);checks.push(label);console.log(label)}
const reject=(fn,re,label)=>{assert.throws(fn,re);checks.push(label);console.log(label)}
const rpc=(n,...a)=>`SELECT public.${n}(${a.map(v=>typeof v==='object'?q(JSON.stringify(v))+'::jsonb':q(v)).join(',')});`,read=s=>JSON.parse(sql(s))
const transition=(a,op,id,p={})=>read(rpc('lesson_source_transition_v1',a,op,id,p)),state=()=>read(rpc('booking_ux_parent_state_v1',x.parent.id,x.sourceMonth))
const target=(d,start='10:00')=>{let id=sql(`SELECT id FROM schedule_templates WHERE branch_id=${q(x.src.branch)} AND course_type_id=${q(x.src.course)} AND day_of_week=extract(dow FROM date ${q(d)}) AND start_time=${q(start)} AND is_active`);if(!id){id=randomUUID();sql(`INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active)VALUES(${q(id)},${q(x.src.branch)},${q(x.src.course)},extract(dow FROM date ${q(d)}),${q(start)},'11:00',true)`)}return{id,date:d,branch:x.src.branch,start,end:'11:00'}}
const source=(n)=>{const d=sql(`SELECT (date ${q(x.src.date)}+${n})::text`),t=target(d),id=randomUUID();sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup)VALUES(${q(id)},${q(x.src.booking)},task10_target_slot_v1(${q(x.src.course)},${q(t.id)},${q(t.branch)},${q(d)},'10:00','11:00'),${q(d)},'10:00','11:00',${q(t.branch)},${q(x.src.children[0])},'scheduled',false);COMMIT;`);return id}
const payload=(t)=>({attendingChildId:x.src.children[0],targetDate:t.date,startTime:t.start,endTime:t.end,branchId:t.branch,templateId:t.id,requestId:randomUUID(),reason:'Local shared-quota proof'})
const picks=(credit,t)=>[{id:credit,kind:'wallet',date:t.date,start:t.start,end:t.end,branchId:t.branch,templateId:t.id,requestId:randomUUID()}]
const oldClock=sql("SELECT pg_get_functiondef('task10_clock_v1()'::regprocedure)"),oldDuration=read("SELECT to_jsonb(p) FROM booking_ux_packages p WHERE id='adult-10'")
let durationChanged=false
try{
 check(state().used===1&&state().remaining===1,'Parent proof begins from the already consumed shared monthly quota')
 const ids=[source(1),source(2),source(3)],b=transition(x.parent.id,'store',ids[0]),d=transition(x.parent.id,'store',ids[2])
 const dst1=target(sql(`SELECT (date ${q(x.dst.date)}+1)::text`)),adminUse=transition(f.sa.id,'makeup',ids[0],payload(dst1))
 check(adminUse.useMode==='normal'&&state().used===2&&state().remaining===0,'Admin normal use consumes the same quota that Parent already used')
 const c=transition(f.sa.id,'admin_store',ids[1],{requestId:randomUUID(),reason:'Local explicit Admin exception',storePolicy:'admin-store-once-v1'})
 const dst2=target(sql(`SELECT (date ${q(x.dst.date)}+2)::text`))
 reject(()=>sql(rpc('booking_ux_redeem_many_v1',x.parent.id,randomUUID(),picks(c.credit_id,dst2))),/INELIGIBLE|APPROVAL_REQUIRED/,'Parent cannot spend an Admin exception after normal quota is exhausted')
 const exceptional=transition(f.sa.id,'makeup',ids[1],payload(dst2))
 check(exceptional.useMode==='exception'&&state().used===3&&state().remaining===0,'Admin exceptional use remains spent in shared source accounting without reviving normal quota')
 reject(()=>sql(rpc('booking_ux_redeem_many_v1',x.parent.id,randomUUID(),picks(d.credit_id,target(sql(`SELECT (date ${q(x.dst.date)}+3)::text`))))),/INELIGIBLE|APPROVAL_REQUIRED/,'Another unused Parent Wallet cannot bypass exhausted shared quota')
 sql("CREATE OR REPLACE FUNCTION public.task10_clock_v1() RETURNS timestamptz LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $$SELECT coalesce(nullif(current_setting('booking_ux.test_clock',true),'')::timestamptz,clock_timestamp())$$")
 const expired=read(`BEGIN;SET LOCAL booking_ux.test_clock=${q(state().expiresAt)};${rpc('booking_ux_parent_state_v1',x.parent.id,x.sourceMonth)}COMMIT;`)
 check(!expired.eligible&&expired.reason==='expired'&&expired.destinationPurchase.quantity>=expired.minimum.minimum,'Verified destination purchase never revives an entitlement at its expiry boundary');sql(oldClock)
 const actor=await fixtures.account('user','ตรวจอายุสิทธิเดิมและใหม่'),date=sql("SELECT ((clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date+20)::text")
 sql('UPDATE booking_ux_control SET enabled=false WHERE singleton');let old
 try{old=fixtures.fixture('adult_group',false,actor,date,'16:00','17:00')}finally{sql('UPDATE booking_ux_control SET enabled=true WHERE singleton')}
 sql(`BEGIN;SELECT set_config('task10.booking_write','authorized',true);SELECT set_config('task10.payment_write','authorized',true);UPDATE bookings SET total_sessions=10,total_price=5500 WHERE id=${q(old.booking)};UPDATE payments SET amount=5500 WHERE booking_id=${q(old.booking)};COMMIT;`)
 // Ten genuine synthetic future teaching rounds back the historical package.
 for(let n=1;n<10;n++)sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);INSERT INTO booking_sessions(booking_id,schedule_slot_id,date,start_time,end_time,branch_id,status,is_makeup)SELECT ${q(old.booking)},task10_target_slot_v1(${q(old.course)},${q(old.template)},${q(old.branch)},date ${q(date)}+${7*n},'16:00','17:00'),date ${q(date)}+${7*n},'16:00','17:00',${q(old.branch)},'scheduled',false;COMMIT;`)
 read(rpc('booking_ux_set_duration_v1',f.sa.id,'adult-10',12,oldDuration.revision));durationChanged=true
 const oldStored=transition(actor.id,'store',old.ids[0]),oldExpiry=sql(`SELECT expires_at FROM lesson_wallet_credits WHERE id=${q(oldStored.credit_id)}`)
 check(sql(`SELECT (${q(oldExpiry)}::timestamptz=(date_trunc('month',p.verified_at AT TIME ZONE 'Asia/Bangkok')+interval '10 months') AT TIME ZONE 'Asia/Bangkok'-interval '1 millisecond') FROM payments p WHERE booking_id=${q(old.booking)}`)==='t','Historical paid ten-round package keeps its original ten-month age when first stored after policy change')
 const template=f.templates.find(t=>t.course==='adult_group'&&t.day===new Date(date+'T12:00+07:00').getUTCDay()&&t.start==='10:00'),p=read("SELECT to_jsonb(p) FROM booking_ux_packages p WHERE id='adult-10'")
 const input={packageId:p.id,packageRevision:p.revision,participants:[null],courseTypeId:f.courses.adult_group,branchId:f.branch,learnerType:'self',childId:null,month:+date.slice(5,7),year:+date.slice(0,4),totalSessions:10,totalAmount:5500,expectedTotalPrice:5500,sessions:[{date,startTime:'10:00',endTime:'11:00',branchId:f.branch,childId:null,scheduleTemplateId:template.id}]}
 const bill=read(rpc('booking_ux_create_v1',actor.id,randomUUID(),input)),receipt=randomUUID(),slip=actor.id+'/'+receipt+'/proof.png',bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBXkAAAAASUVORK5CYII=','base64');assert.ifError((await db.storage.from('payment-slips').upload(slip,bytes,{contentType:'image/png'})).error)
 sql(`SELECT task10_accept_legacy_slip_v1(${q(actor.id)},ARRAY[${q(bill.bookingId)}]::uuid[],${q(slip)},${q(run.target.api+'/storage/v1/object/public/payment-slips/'+slip)},${q(createHash('sha256').update(bytes).digest('hex'))},5500,${q(receipt)})`)
 read(rpc('task10_finalize_legacy_slip_v1',actor.id,receipt,true,'Local duration12'))
 const session=sql(`SELECT id FROM booking_sessions WHERE booking_id=${q(bill.bookingId)}`),stored=transition(actor.id,'store',session),expiry=sql(`SELECT expires_at FROM lesson_wallet_credits WHERE id=${q(stored.credit_id)}`)
 check(sql(`SELECT (${q(expiry)}::timestamptz=(date_trunc('month',p.verified_at AT TIME ZONE 'Asia/Bangkok')+interval '12 months') AT TIME ZONE 'Asia/Bangkok'-interval '1 millisecond') FROM payments p WHERE booking_id=${q(bill.bookingId)}`)==='t','New twelve-month snapshot controls Store expiry beyond the former ten-month age')
 const zero=sql("SELECT b.id FROM bookings b JOIN payments p ON p.booking_id=b.id WHERE b.package_snapshot IS NOT NULL AND b.status='verified' AND b.total_price=0 AND p.method='coupon' ORDER BY b.created_at DESC LIMIT 1")
 check(Boolean(zero)&&sql(`SELECT count(*) FROM payments WHERE booking_id=${q(zero)} AND amount=0 AND method='coupon' AND status='approved' AND slip_image_url IS NULL`)==='1','Fully discounted package has one explicit zero-baht coupon settlement with no transfer slip')
 const paidBefore=sql(`SELECT md5(row_to_json(b)::text) FROM bookings b WHERE id=${q(proof.partial.bookingId)}`)
 read(rpc('booking_ux_previous_v1',proof.parentStateFixture.parent.id))
 check(paidBefore===sql(`SELECT md5(row_to_json(b)::text) FROM bookings b WHERE id=${q(proof.partial.bookingId)}`),'Last-booking preparation reads committed data without changing paid booking evidence')
 fs.writeFileSync(run.evidenceRoot+'/policy-edge-fixture.json',JSON.stringify({actor,old,bill,stored,oldStored,zero,x,ids,b,c,d},null,2))
}catch(e){fs.writeFileSync(run.evidenceRoot+'/policy-edge-failure-'+Date.now()+'.json',JSON.stringify({checks,error:String(e),stderr:e.stderr?.toString()},null,2));throw e}
finally{sql(oldClock);if(durationChanged){const revision=sql("SELECT revision FROM booking_ux_packages WHERE id='adult-10'");read(rpc('booking_ux_set_duration_v1',f.sa.id,'adult-10',oldDuration.validity_months,revision))}sql('UPDATE booking_ux_control SET enabled=true WHERE singleton');fs.writeFileSync(run.evidenceRoot+'/policy-edge-result-'+Date.now()+'.json',JSON.stringify({checks,passed:checks.length,runId:run.runId},null,2))}
console.log(JSON.stringify({passed:checks.length}))
