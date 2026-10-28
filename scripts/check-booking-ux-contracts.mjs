import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {run,sql,q,db,concurrentSql,holdTransaction,observeLockWait,fixtures} from '../tests/booking-ux/runtime.mjs'
const f=JSON.parse(fs.readFileSync(run.evidenceRoot+'/fixture.json')),checks=[]
const check=(value,label)=>{assert.ok(value,label);checks.push(label);console.log(label)}
const reject=(fn,re,label)=>{assert.throws(fn,re);checks.push(label);console.log(label)}
const json=input=>JSON.parse(sql(input)),rpc=(name,...args)=>`SELECT public.${name}(${args.map(v=>typeof v==='object'?q(JSON.stringify(v))+'::jsonb':q(v)).join(',')});`
const date=(days)=>sql(`SELECT ((clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date+${days})::text`)
const template=(course,d,start='10:00')=>f.templates.find(t=>t.course===course&&t.day===new Date(d+'T12:00+07:00').getUTCDay()&&t.start===start).id
const body=(pkg='adult-10',sessions=[],participants=[null])=>{const p=json(`SELECT to_jsonb(p) FROM booking_ux_packages p WHERE id=${q(pkg)}`),d=sessions[0]?.date||date(3);return{packageId:pkg,packageRevision:p.revision,participants,courseTypeId:f.courses[p.course],branchId:f.branch,month:+d.slice(5,7),year:+d.slice(0,4),learnerType:participants.includes(null)?'self':'child',childId:participants.length===1?participants[0]:null,totalSessions:p.quantity,totalAmount:{'adult-1':600,'adult-10':5500,'adult-16':8000,'private-1':900,'private-10':8000}[pkg],expectedTotalPrice:{'adult-1':600,'adult-10':5500,'adult-16':8000,'private-1':900,'private-10':8000}[pkg],sessions}}
const create=(b,actor=f.parent.id,request=randomUUID())=>json(rpc('booking_ux_create_v1',actor,request,b))
const session=(course,d,child=null,start='10:00',end='11:00')=>({date:d,startTime:start,endTime:end,childId:child,branchId:f.branch,scheduleTemplateId:template(course,d,start)})
const pick=(id,course,d,kind='package',branch=f.branch,t=template(course,d))=>({id,kind,date:d,start:'10:00',end:'11:00',branchId:branch,templateId:t,requestId:randomUUID()})
const units=id=>json(`SELECT coalesce(jsonb_agg(id ORDER BY ordinal),'[]') FROM booking_package_units WHERE booking_id=${q(id)} AND status='available'`)
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBXkAAAAASUVORK5CYII=','base64')
const slip=async(owner=f.parent.id)=>{const request=randomUUID(),path=owner+'/'+request+'/slip.png';const upload=await db.storage.from('payment-slips').upload(path,png,{contentType:'image/png'});assert.ifError(upload.error);return{request,path,sha:createHash('sha256').update(png).digest('hex'),url:run.target.api+'/storage/v1/object/public/payment-slips/'+path}}
const accept=(b,s,owner=f.parent.id)=>rpc('task10_accept_legacy_slip_v1',owner)+'' // SQL array is intentionally constructed below.
const acceptSql=(b,s,owner=f.parent.id)=>`SELECT task10_accept_legacy_slip_v1(${q(owner)},ARRAY[${q(b.bookingId)}]::uuid[],${q(s.path)},${q(s.url)},${q(s.sha)},${b.totalPrice},${q(s.request)});`
const pay=async b=>{const s=await slip();sql(acceptSql(b,s));json(rpc('task10_finalize_legacy_slip_v1',f.parent.id,s.request,true,'Local synthetic approved'));return s}
const oldClock=sql("SELECT pg_get_functiondef('task10_clock_v1()'::regprocedure)")
const clock=(when,input)=>`BEGIN;SET LOCAL booking_ux.test_clock=${q(when)};${input}COMMIT;`
let parentStateFixture
try{
 sql('UPDATE booking_ux_control SET enabled=true WHERE singleton')
 f.parent=await fixtures.account('user','ชุดทดสอบสัญญาจอง '+randomUUID().slice(0,6));f.children=[randomUUID(),randomUUID()]
 sql(f.children.map(id=>`INSERT INTO children(id,parent_id,full_name) VALUES(${q(id)},${q(f.parent.id)},'ผู้เรียนครอบครัวสมมติ');`).join(''))
 const beforeChildren=Number(sql(`SELECT count(*) FROM children WHERE parent_id=${q(f.other.id)}`)),childReq=randomUUID()
 const child=json(rpc('booking_ux_child_v1',f.other.id,childReq,'ผู้เรียนเพิ่มระหว่างจอง','ลูกใหม่'))
 check(json(rpc('booking_ux_child_v1',f.other.id,childReq,'ผู้เรียนเพิ่มระหว่างจอง','ลูกใหม่')).id===child.id&&Number(sql(`SELECT count(*) FROM children WHERE parent_id=${q(f.other.id)}`))===beforeChildren+1,'Inline child replay creates exactly one owned child')
 reject(()=>sql(rpc('booking_ux_child_v1',f.other.id,childReq,'ชื่อที่เปลี่ยน','ลูกใหม่')),/IDEMPOTENCY_CONFLICT/,'Child request cannot change its submitted identity')
 reject(()=>create(body('adult-1')),/PACKAGE_QUANTITY/,'Single package requires exactly one scheduled unit')
 reject(()=>create({...body(),participants:[f.children[0]]}),/INVALID_LEARNER/,'Adult package is always self')
 reject(()=>create(body('private-10',[],[child.id])),/INVALID_LEARNER/,'Private cannot include another family child')
 reject(()=>create({...body(),packageRevision:-1}),/PACKAGE_CHANGED/,'Stale duration revision is rejected before bill creation')
 reject(()=>sql(rpc('booking_ux_set_duration_v1',f.parent.id,'adult-10',7,1)),/FORBIDDEN/,'Parent cannot change package policy')
 const partial=create(body('adult-16',[session('adult_group',date(5))]));await pay(partial)
 check(units(partial.bookingId).length===15,'Partial Adult16 purchase grants only fifteen unallocated units after payment')
 const family=create(body('private-10',[],[null,...f.children]));await pay(family)
 check(units(family.bookingId).length===10,'Private Family package grants ten whole-family atomic hours')
 const familyPick=pick(units(family.bookingId)[0],'private',date(6)),familyRequest=randomUUID()
 const used=json(rpc('booking_ux_redeem_many_v1',f.parent.id,familyRequest,[familyPick]))
 check(used.sessionIds.length===3&&sql(`SELECT count(DISTINCT coalesce(child_id::text,'self')) FROM booking_sessions WHERE id=ANY(ARRAY[${used.sessionIds.map(q).join(',')}]::uuid[])`)==='3','One Family hour schedules every original participant together')
 const auditBefore=sql('SELECT count(*) FROM activity_logs'),noticeBefore=sql('SELECT count(*) FROM notifications')
 check(JSON.stringify(json(rpc('booking_ux_redeem_many_v1',f.parent.id,familyRequest,[familyPick])))===JSON.stringify(used)&&auditBefore===sql('SELECT count(*) FROM activity_logs')&&noticeBefore===sql('SELECT count(*) FROM notifications'),'Wallet replay has no extra lesson, audit or notice')
 const adultUnits=units(partial.bookingId),rollbackPicks=[pick(adultUnits[0],'adult_group',date(7)),{...pick(adultUnits[1],'adult_group',date(8)),templateId:randomUUID()}]
 reject(()=>sql(rpc('booking_ux_redeem_many_v1',f.parent.id,randomUUID(),rollbackPicks)),/INVALID_TEMPLATE/,'Invalid second basket item rolls back the entire transaction')
 check(units(partial.bookingId).length===15&&sql(`SELECT count(*) FROM booking_sessions WHERE booking_id=${q(partial.bookingId)}`)==='1','Failed multi-use preserves both source units and all destination rows')
 const good=rollbackPicks.map((p,i)=>pick(p.id,'adult_group',date(7+i)))
 const many=json(rpc('booking_ux_redeem_many_v1',f.parent.id,randomUUID(),good));check(many.used===2&&many.sessionIds.length===2&&units(partial.bookingId).length===13,'Two distinct selected units commit together')
 const racePick=pick(units(partial.bookingId)[0],'adult_group',date(9)),raceName='booking-ux-race-'+randomUUID(),held=await holdTransaction(`SELECT id FROM booking_package_units WHERE id=${q(racePick.id)} FOR UPDATE;`,raceName+'-held')
 let outcomes
 try{const race=[0,1].map(i=>concurrentSql(`SET application_name=${q(raceName+i)};${rpc('booking_ux_redeem_many_v1',f.parent.id,randomUUID(),[racePick])}`));await observeLockWait(raceName+'0');held.release();await held.done;outcomes=await Promise.allSettled(race)}finally{if(!outcomes){held.release();await held.done.catch(()=>{})}}
 check(outcomes.filter(r=>r.status==='fulfilled').length===1&&sql(`SELECT cardinality(session_ids) FROM booking_package_units WHERE id=${q(racePick.id)}`)==='1','Observed real lock contention consumes a unit exactly once')
 reject(()=>sql(rpc('booking_ux_redeem_many_v1',f.other.id,randomUUID(),[pick(units(partial.bookingId)[0],'adult_group',date(10))])),/FORBIDDEN/,'Wallet consumption cannot cross account ownership')
 const editable=create(body()),deadline=sql(`SELECT checkout_deadline FROM bookings WHERE id=${q(editable.bookingId)}`)
 const editInput={...body(),bookingId:editable.bookingId,sessions:[session('adult_group',date(11))]}
 json(rpc('booking_ux_update_v1',f.parent.id,randomUUID(),editInput))
 check(sql(`SELECT checkout_deadline FROM bookings WHERE id=${q(editable.bookingId)}`)===deadline,'Editing partial scheduled days cannot extend the payment deadline')
 // Test-only clock is restored verbatim in finally; never included in shipped SQL.
 sql("CREATE OR REPLACE FUNCTION public.task10_clock_v1() RETURNS timestamptz LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $$SELECT coalesce(nullif(current_setting('booking_ux.test_clock',true),'')::timestamptz,clock_timestamp())$$;")
 const near=body('adult-1',[session('adult_group',date(12))]),nearWhen=date(12)+'T09:45:00+07:00'
 reject(()=>sql(clock(nearWhen,rpc('booking_ux_create_v1',f.parent.id,randomUUID(),near))),/START_WITHIN_PAYMENT_WINDOW/,'Server rejects a lesson starting inside the thirty-minute payment window')
 const expired=create(body()),exp=sql(`SELECT checkout_deadline FROM bookings WHERE id=${q(expired.bookingId)}`),ss=await slip()
 reject(()=>sql(clock(exp,acceptSql(expired,ss))),/DEADLINE|EXPIRED|DUE/,'Receipt committed exactly at deadline is rejected')
 check(json(clock(exp,`SELECT task10_expire_booking_v1(${q(expired.bookingId)});`)).cancelled,'Storage-only upload does not protect expired booking')
 const protectedBill=create(body()),protectedSlip=await slip(),dl=sql(`SELECT checkout_deadline FROM bookings WHERE id=${q(protectedBill.bookingId)}`)
 const pre=sql(`SELECT (${q(dl)}::timestamptz-interval '1 millisecond')::text`),post=sql(`SELECT (${q(dl)}::timestamptz+interval '1 minute')::text`)
 sql(clock(pre,acceptSql(protectedBill,protectedSlip)))
 check(!json(clock(post,`SELECT task10_expire_booking_v1(${q(protectedBill.bookingId)});`)).cancelled,'Accepted receipt strictly before deadline protects pending review afterwards')
 json(clock(post,rpc('task10_finalize_legacy_slip_v1',f.parent.id,protectedSlip.request,true,'Delayed Local verification')))
 check(units(protectedBill.bookingId).length===10,'Delayed verification grants rights once without extending original deadline')
 const legacyBefore=sql("SELECT count(*) FROM bookings WHERE checkout_version IS NULL AND status='cancelled'")
 json('SELECT booking_ux_run_expiry_v1(50)');check(legacyBefore===sql("SELECT count(*) FROM bookings WHERE checkout_version IS NULL AND status='cancelled'"),'Dedicated new-bill worker never sweeps historical bills')
 sql(oldClock)
 // The known old-row fixture factory is used only inside this verified disposable.
 const mk=(parent,d)=>{sql('UPDATE booking_ux_control SET enabled=false WHERE singleton');try{return fixtures.fixture('kids_group',false,parent,d,'16:00','17:00')}finally{sql('UPDATE booking_ux_control SET enabled=true WHERE singleton')}}
 const parent=await fixtures.account('user','ทดสอบโควตาร่วม'),src=mk(parent,date(3)),dst=fixtures.target(src,true),sourceMonth=src.date.slice(0,7)+'-01'
 const transition=(actor,op,id,p={})=>json(rpc('lesson_source_transition_v1',actor,op,id,p))
 const stored=transition(parent.id,'store',src.ids[0]);src.credit=stored.credit_id
 const state=()=>json(rpc('booking_ux_parent_state_v1',parent.id,sourceMonth))
 check(!state().eligible&&state().reason==='destination_minimum','Parent cross-month Wallet requires verified destination-month purchase D ≥ M')
 const destination=mk(parent,dst.date)
 check(state().eligible&&state().quota===2&&state().sources.every(s=>s.kind==='wallet'),'Shared Parent state exposes only owned Wallet sources with Q=min(5,floor(N/4))')
 reject(()=>sql(rpc('booking_ux_parent_consume_v1',parent.id,src.ids[0],destination.children[0],dst.template,dst.branch,dst.date,dst.start,dst.end,randomUUID())),/FORBIDDEN/,'Parent cannot switch the source entitlement to a sibling')
 const crossPick={id:src.credit,kind:'wallet',date:dst.date,start:dst.start,end:dst.end,branchId:dst.branch,templateId:dst.template,requestId:randomUUID()},crossRequest=randomUUID()
 const cross=json(rpc('booking_ux_redeem_many_v1',parent.id,crossRequest,[crossPick]))
 check(cross.sessionIds.length===1&&state().used===1&&state().remaining===1&&sql(`SELECT status FROM lesson_wallet_credits WHERE id=${q(src.credit)}`)==='redeemed','Parent next-month use consumes shared quota, original child and source exactly once')
 check(sql(`SELECT count(*) FROM activity_logs WHERE action='redeem_lesson_wallet_credit' AND entity_id=${q(src.credit)}`)==='1','Parent cross-month use retains the shared Wallet audit and notification effects')
 check(json(rpc('booking_ux_redeem_many_v1',parent.id,crossRequest,[crossPick])).used===1&&state().used===1,'Cross-month replay does not consume quota again')
 parentStateFixture={parent,src,dst,destination,cross,sourceMonth}
 const pausedUnit=pick(units(partial.bookingId)[0],'adult_group',date(14));sql('UPDATE booking_ux_control SET enabled=false WHERE singleton')
 reject(()=>create(body()),/DISABLED/,'Controlled recovery pauses new checkout')
 check(json(rpc('booking_ux_redeem_many_v1',f.parent.id,randomUUID(),[pausedUnit])).used===1,'Compatible recovery continues using already paid package rights')
 sql('UPDATE booking_ux_control SET enabled=true WHERE singleton')
 for(const role of ['anon','authenticated']){
  reject(()=>sql(`SET ROLE ${role};SELECT * FROM booking_ux_requests`),/permission denied/,role+' cannot read private request ledger')
  reject(()=>sql(`SET ROLE ${role};${rpc('booking_ux_redeem_many_v1',f.parent.id,randomUUID(),[])}`),/permission denied/,role+' cannot directly forge a trusted actor RPC')
 }
 fs.writeFileSync(run.evidenceRoot+'/contracts-fixture-'+Date.now()+'.json',JSON.stringify({partial,family,editable,expired,protectedBill,parentStateFixture},null,2))
}catch(e){fs.writeFileSync(run.evidenceRoot+'/contracts-failure-'+Date.now()+'.json',JSON.stringify({checks,error:String(e),stderr:e.stderr?.toString()},null,2));throw e}
finally{sql(oldClock);sql('UPDATE booking_ux_control SET enabled=true WHERE singleton');fs.writeFileSync(run.evidenceRoot+'/contracts-result-'+Date.now()+'.json',JSON.stringify({checks,passed:checks.length,runId:run.runId},null,2))}
console.log(JSON.stringify({passed:checks.length}))
