import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {run,sql,q,db,fixtures,concurrentSql,holdTransaction,observeLockWait} from '../tests/booking-ux/runtime.mjs'

const root='.playwright/booking-ux-2/revision-stage2-20261029/db-'+Date.now();fs.mkdirSync(root,{recursive:true})
const f=JSON.parse(fs.readFileSync(run.evidenceRoot+'/fixture.json')),checks=[]
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label);console.log(label)}
const json=s=>JSON.parse(sql(s)),arg=v=>v==null?'NULL':Array.isArray(v)&&v.every(x=>typeof x==='string'&&/^[a-f0-9-]{36}$/.test(x))?'ARRAY['+v.map(q).join(',')+']::uuid[]':typeof v==='object'?q(JSON.stringify(v))+'::jsonb':q(v)
const stmt=(n,...a)=>`SELECT ${n}(${a.map(arg).join(',')});`,rpc=(n,...a)=>json(stmt(n,...a))
const state=id=>json(`SELECT jsonb_build_object('bill',to_jsonb(b),'hold',(SELECT to_jsonb(r) FROM progressive_coupon_reservations r WHERE booking_id=b.id),'sessions',(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM booking_sessions s WHERE booking_id=b.id),'audit',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM booking_ux_coupon_changes a WHERE booking_id=b.id),'units',(SELECT count(*) FROM booking_package_units WHERE booking_id=b.id),'payments',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM payments p WHERE booking_id=b.id)) FROM bookings b WHERE id=${q(id)}`)
const unchanged=(id,before)=>assert.deepEqual(state(id),before)
const coupon=(type='fixed',value=500,min=0,max=null)=>{const id=randomUUID(),code='EDITUX2'+randomUUID().slice(0,8).toUpperCase();sql(`INSERT INTO coupons(id,code,discount_type,discount_value,min_purchase,max_uses,created_by) VALUES(${q(id)},${q(code)},${q(type)},${value},${min},${max??'NULL'},${q(f.sa.id)})`);return{id,code}}
const packageBody=(pkg,c=null,participants=[null])=>{const p=json(`SELECT to_jsonb(p) FROM booking_ux_packages p WHERE id=${q(pkg)}`),date=sql("SELECT (now() AT TIME ZONE 'Asia/Bangkok')::date+3"),gross=Number(sql(`SELECT task10_legacy_price_v1(NULL,${q(f.courses[p.course])},${+date.slice(5,7)},${+date.slice(0,4)},${p.quantity},NULL)`));let discount=0;if(c){const quote=rpc('booking_ux_coupon_quote_v2',currentActor.id,c.id,f.courses[p.course],gross,null);discount=quote.discountAmount}return {packageId:pkg,packageRevision:p.revision,courseTypeId:f.courses[p.course],branchId:f.branch,participants,month:+date.slice(5,7),year:+date.slice(0,4),totalSessions:p.quantity,totalAmount:gross,expectedTotalPrice:gross-discount,sessions:[],coupon:c}}
let currentActor
const createPackage=(a,pkg='adult-10',c=null,participants=[null])=>{currentActor=a;return rpc('booking_ux_create_v1',a.id,randomUUID(),packageBody(pkg,c,participants)).bookingId}
const input=(a,ids,edits,choices)=>({action:'edit',bookingIds:ids,token:sql(`SELECT booking_ux_set_token_v1(${q(a.id)},ARRAY[${ids.map(q)}]::uuid[])`),edits:edits||ids.map(id=>({id,sessions:[]})),couponChanges:choices||ids.map(bookingId=>({bookingId,action:'keep'}))})
const edit=(a,i,preview=false,key=randomUUID())=>rpc('booking_ux_edit_set_v1',a.id,key,i,preview)
const preview=(a,i)=>edit(a,i,true),save=(a,i,p,key=randomUUID())=>edit(a,{...i,expectedTotal:p.total,quoteToken:p.quoteToken},false,key)
const choice=(id,action,c)=>[{bookingId:id,action,...(c?{code:c.code}:{})}]
const day=n=>sql(`SELECT (date_trunc('month',now() AT TIME ZONE 'Asia/Bangkok')+interval '1 month'+interval '${n} days')::date::text`)
function round(child,n,course='kids_group'){const date=day(n);return{date,startTime:'10:00',endTime:'11:00',branchId:f.branch,childId:child,scheduleTemplateId:sql(`SELECT id FROM schedule_templates WHERE branch_id=${q(f.branch)} AND course_type_id=${q(f.courses[course])} AND day_of_week=extract(dow FROM date ${q(date)}) AND start_time='10:00' AND is_active LIMIT 1`)}}
function child(a){const id=randomUUID();sql(`INSERT INTO children(id,parent_id,full_name) VALUES(${q(id)},${q(a.id)},'ผู้เรียนแก้ไขคูปอง')`);return id}
function kids(a,rounds,c=null){const d=rounds[0].date,course=f.courses.kids_group;const baseline=json(`SELECT to_jsonb(x) FROM progressive_legacy_baseline_v1(${q(a.id)},${q(course)},${+d.slice(0,4)},${+d.slice(5,7)})x`);const p=rpc('task10_booking_policy_quote_v1',a.id,course,d.slice(0,7)+'-01','progressive',null);return rpc('booking_ux_create_v1',a.id,randomUUID(),{courseTypeId:course,branchId:f.branch,learnerType:'child',childId:rounds[0].childId,month:+d.slice(5,7),year:+d.slice(0,4),totalSessions:rounds.length,sessions:rounds,coupon:c,expectedScopeRevision:Number(sql(`SELECT coalesce((SELECT revision FROM booking_pricing_scopes WHERE user_id=${q(a.id)} AND course_type_id=${q(course)} AND lesson_year=${+d.slice(0,4)} AND lesson_month=${+d.slice(5,7)}),0)`)),expectedLegacyBaselineSessions:baseline.baseline_sessions,expectedLegacyBaselineFingerprint:baseline.baseline_fingerprint,expectedPolicyFingerprint:p.fingerprint}).bookingId}
const err=(a,i,pattern)=>assert.throws(()=>edit(a,i),pattern)
const clockBefore=sql("SELECT pg_get_functiondef('task10_clock_v1()'::regprocedure)")
let actor,other
try{
 actor=await fixtures.account('user','แก้ไขคูปองรอบสอง');other=await fixtures.account('user','โควตาแก้ไขรอบสอง')
 const ten=coupon('percent',10),id=createPackage(actor,'adult-10',ten),initial=state(id)
 check(initial.bill.total_price===4950&&initial.hold.status==='reserved'&&initial.units===0,'Adult starts 5500 - 10% = 4950 with a hold and no unpaid units')
 let i=input(actor,[id]),p=preview(actor,i);unchanged(id,initial)
 check(p.total===4950&&p.quoteToken.length===64,'Keep quote is authoritative and rolls back bill, sessions, hold and audit')
 const removal=input(actor,[id],null,choice(id,'remove')),removalQuote=preview(actor,removal);unchanged(id,initial)
 check(removalQuote.total===5500&&removalQuote.bills[0].coupon_discount===0,'Voluntary removal quotes full price even with unchanged dates; draft has no quota effect')
 const undo=preview(actor,i);check(undo.total===4950,'Undo before save keeps the original held terms')
 const key=randomUUID();save(actor,removal,removalQuote,key);let s=state(id)
 check(s.bill.id===id&&s.bill.total_price===5500&&s.hold.status==='released'&&s.bill.checkout_deadline===initial.bill.checkout_deadline&&s.audit.length===1,'Save removal keeps original bill/deadline and appends one release history')
 check(save(actor,removal,removalQuote,key).idempotentReplay===true&&state(id).audit.length===1,'Original request replay does not repeat release/history')
 i=input(actor,[id],null,choice(id,'apply',ten));p=preview(actor,i);save(actor,i,p)
 check(state(id).bill.total_price===4950&&state(id).hold.status==='reserved'&&state(id).audit.length===2,'Reapply released code revalidates and reserves it in the same bill')
 const fixed=coupon('fixed',500),beforeSwap=state(id);i=input(actor,[id],null,choice(id,'apply',fixed));p=preview(actor,i);unchanged(id,beforeSwap)
 check(p.total===5000,'Swap quotes new fixed discount from full gross, without stacking')
 save(actor,i,p);s=state(id)
 check(s.bill.total_price===5000&&s.hold.coupon_id===fixed.id&&s.hold.status==='reserved'&&s.audit.at(-2).before_state.coupon_id===ten.id,'Atomic swap preserves complete old code evidence and holds exactly the new code')
 const saved=state(id),bad={code:'DOESNOTEXIST'};i=input(actor,[id],null,choice(id,'apply',bad));assert.throws(()=>preview(actor,i),/COUPON_NOT_FOUND/);unchanged(id,saved);check(true,'Invalid replacement rolls back old bill, reservation, sessions and history')
 for(const [kind,change,pattern] of [
  ['expired',c=>sql(`UPDATE coupons SET valid_to=current_date-1 WHERE id=${q(c.id)}`),/COUPON_EXPIRED/],
  ['inactive',c=>sql(`UPDATE coupons SET is_active=false WHERE id=${q(c.id)}`),/COUPON_INACTIVE/],
  ['minimum',c=>sql(`UPDATE coupons SET min_purchase=6000 WHERE id=${q(c.id)}`),/COUPON_MIN_PURCHASE/],
  ['course',c=>sql(`INSERT INTO coupon_course_types(coupon_id,course_type_id) VALUES(${q(c.id)},${q(f.courses.private)})`),/COUPON_COURSE_NOT_ALLOWED/]
 ]){const c=coupon();change(c);i=input(actor,[id],null,choice(id,'apply',c));assert.throws(()=>preview(actor,i),pattern);unchanged(id,saved);check(true,kind+' replacement rejected without losing original coupon')}
 const same=coupon('percent',10),fresh=createPackage(actor);i=input(actor,[fresh],null,choice(fresh,'apply',same));p=preview(actor,i)
 sql(`UPDATE coupons SET discount_type='fixed',discount_value=550 WHERE id=${q(same.id)}`);err(actor,{...i,expectedTotal:p.total,quoteToken:p.quoteToken},/QUOTE_CHANGED/)
 check(state(fresh).hold===null&&state(fresh).bill.total_price===5500,'Same-price changed coupon terms invalidate the quote and roll back acquisition')
 i=input(actor,[fresh],null,choice(fresh,'apply',same));p=preview(actor,i)
 err(actor,{...i,expectedTotal:p.total},/QUOTE_CHANGED/);err(actor,{...i,expectedTotal:p.total-1,quoteToken:p.quoteToken},/AMOUNT_CONFLICT/)
 check(state(fresh).hold===null,'Missing quote token and tampered total cannot save or acquire quota')
 const malformed={...i,couponChanges:[...i.couponChanges,...i.couponChanges]};err(actor,malformed,/INVALID_REQUEST/);check(true,'Duplicate or excess coupon targets rejected')
 save(actor,i,p);err(actor,{...i,expectedTotal:p.total,quoteToken:p.quoteToken},/SET_CHANGED/);check(true,'A stale second tab cannot overwrite a committed edit')
 const privateChild=child(actor),family=createPackage(actor,'private-10',null,[null,privateChild]),famBefore=state(family),familyCode=coupon('fixed',500)
 i=input(actor,[family],null,choice(family,'apply',familyCode));p=preview(actor,i);save(actor,i,p);s=state(family)
 check(s.bill.total_price===7500&&JSON.stringify(s.bill.package_participants)===JSON.stringify(famBefore.bill.package_participants)&&s.bill.total_sessions===10&&s.units===0,'Private Family application preserves exact participants and ten unpaid purchased units')
 const kchild=child(actor),rounds=[round(kchild,3),round(kchild,4),round(kchild,5)],minCode=coupon('fixed',500,1200),kid=kids(actor,rounds,minCode),kidBefore=state(kid)
 check(kidBefore.bill.total_price===1375,'Kids begins at 1875 - fixed500 = 1375')
 i=input(actor,[kid],[{id:kid,sessions:rounds.slice(0,1)}]);p=preview(actor,i);unchanged(kid,kidBefore)
 check(p.total===700&&p.couponWarnings.length===1,'Below-minimum keep quotes full700 with warning; real original hold stays reserved')
 err(actor,{...i,expectedTotal:p.total,quoteToken:p.quoteToken},/ACK_REQUIRED|QUOTE_CHANGED/);unchanged(kid,kidBefore)
 check(true,'Keep below minimum cannot silently release the code on save')
 i=input(actor,[kid],[{id:kid,sessions:rounds.slice(0,1)}],choice(kid,'remove'));p=preview(actor,i);save(actor,i,p);s=state(kid)
 check(s.bill.total_price===700&&s.hold.status==='released'&&s.bill.checkout_deadline===kidBefore.bill.checkout_deadline,'Explicit remove with fewer rounds saves full700 and preserves deadline')
 const percent=coupon('percent',10);i=input(actor,[kid],[{id:kid,sessions:rounds}],choice(kid,'apply',percent));p=preview(actor,i)
 check(p.total===1687&&p.bills[0].coupon_discount===188,'Kids percent recomputes 1875 minus rounded188 = 1687')
 save(actor,i,p);s=state(kid)
 check(s.bill.total_price===1687&&s.hold.status==='reserved'&&s.hold.pricing_revision===s.bill.pricing_revision,'New Kids coupon saves with matching booking/reservation revision')
 check(Number(sql(`SELECT evidence->>'final' FROM task10_booking_calculations WHERE booking_id=${q(kid)} AND revision=${s.bill.pricing_revision}`))===1687,'Append-only final calculation records discounted amount, not intermediate full price')
 const zeroCode=coupon('percent',100),adultZero=createPackage(other);i=input(other,[adultZero],null,choice(adultZero,'apply',zeroCode));p=preview(other,i)
 check(p.total===0&&state(adultZero).bill.status==='pending_payment'&&state(adultZero).units===0,'Zero preview creates no payment, consumed coupon or rights')
 save(other,i,p);s=state(adultZero)
 check(s.bill.status==='verified'&&s.hold.status==='consumed'&&s.units===10&&s.payments.length===1&&s.payments[0].amount===0,'Adult zero edit atomically settles once with approved zero payment and ten units')
 const k2=child(other),kZero=kids(other,[round(k2,8),round(k2,9)]),kidsZeroCode=coupon('percent',100);i=input(other,[kZero],[{id:kZero,sessions:[round(k2,8),round(k2,9)]}],choice(kZero,'apply',kidsZeroCode));p=preview(other,i);save(other,i,p);s=state(kZero)
 check(s.bill.status==='verified'&&s.hold.status==='consumed'&&s.bill.total_price===0,'Kids zero application settles only at final authoritative save')
 const k3=child(other),keepZeroCode=coupon('fixed',1000),keepZero=kids(other,[round(k3,11),round(k3,12)],keepZeroCode);i=input(other,[keepZero],[{id:keepZero,sessions:[round(k3,11)]}]);p=preview(other,i);save(other,i,p)
 check(state(keepZero).bill.status==='verified'&&state(keepZero).hold.status==='consumed','Keeping fixed coupon that becomes zero after reducing rounds still settles correctly')
 const a1=createPackage(actor),a2=createPackage(other),last=coupon('fixed',100,0,1),i1=input(actor,[a1],null,choice(a1,'apply',last)),i2=input(other,[a2],null,choice(a2,'apply',last)),p1=preview(actor,i1),p2=preview(other,i2),name='ux2-edit-last-'+randomUUID()
 const held=await holdTransaction(`SELECT id FROM coupons WHERE id=${q(last.id)} FOR UPDATE;`,name+'holder')
 const pending=Promise.allSettled([[actor,i1,p1],[other,i2,p2]].map(([a,x,p],n)=>concurrentSql(`SET application_name=${q(name+n)};${stmt('booking_ux_edit_set_v1',a.id,randomUUID(),{...x,expectedTotal:p.total,quoteToken:p.quoteToken},false)}`)))
 await observeLockWait(name+'0');held.release();await held.done;const raced=await pending
 check(raced.filter(x=>x.status==='fulfilled').length===1&&sql(`SELECT count(*) FROM progressive_coupon_reservations WHERE coupon_id=${q(last.id)} AND status='reserved'`)==='1','Actual last-quota contention has exactly one winner; failed bill retains full original amount')
 const expireBill=createPackage(actor),expireInput=input(actor,[expireBill]),expireQuote=preview(actor,expireInput),expireBefore=state(expireBill)
 sql("CREATE OR REPLACE FUNCTION task10_clock_v1() RETURNS timestamptz LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $$ SELECT coalesce(nullif(current_setting('booking_ux.test_clock',true),'')::timestamptz,clock_timestamp()) $$;")
 assert.throws(()=>sql(`BEGIN;SET LOCAL booking_ux.test_clock=${q(new Date(Date.parse(expireBefore.bill.checkout_deadline)+1000).toISOString())};${stmt('booking_ux_edit_set_v1',actor.id,randomUUID(),{...expireInput,expectedTotal:expireQuote.total,quoteToken:expireQuote.quoteToken},false)}COMMIT;`),/SET_CHANGED/);unchanged(expireBill,expireBefore)
 check(true,'Expiry after quote rejects save without restarting deadline or changing the bill')
 const crossing=createPackage(actor),crossingBefore=state(crossing),crossCode=coupon('percent',100),crossChoice={bookingId:crossing,action:'apply',code:crossCode.code},crossRequest=randomUUID()
 assert.throws(()=>sql(`BEGIN;SET LOCAL task10.payment_write='authorized';${stmt('booking_ux_coupon_choice_v3',actor.id,crossing,crossChoice,false,crossRequest)}${stmt('booking_ux_coupon_choice_v3',actor.id,crossing,crossChoice,true,crossRequest)}SET LOCAL booking_ux.test_clock=${q(new Date(Date.parse(crossingBefore.bill.checkout_deadline)+1000).toISOString())};${stmt('booking_ux_coupon_zero_edit_v3',actor.id,crossing,crossRequest)}COMMIT;`),/SET_CHANGED/);unchanged(crossing,crossingBefore)
 check(true,'Legacy zero settlement crossing deadline rolls back its new reservation, zero amount and payment together')
 sql(clockBefore+';')
 const receiptBill=createPackage(actor),receiptInput=input(actor,[receiptBill]),receiptQuote=preview(actor,receiptInput),request=randomUUID(),namePath=actor.id+'/'+request+'/slip.png',bytes=Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBXkAAAAASUVORK5CYII=','base64'),Buffer.from(request)])
 assert.ifError((await db.storage.from('payment-slips').upload(namePath,bytes,{contentType:'image/png'})).error)
 rpc('task10_accept_legacy_slip_v1',actor.id,[receiptBill],namePath,run.target.api+'/storage/v1/object/public/payment-slips/'+namePath,createHash('sha256').update(bytes).digest('hex'),5500,request)
 const accepted=state(receiptBill);err(actor,{...receiptInput,expectedTotal:receiptQuote.total,quoteToken:receiptQuote.quoteToken},/SET_CHANGED/);unchanged(receiptBill,accepted)
 check(true,'On-time accepted receipt blocks an already-open editor without changing money or receipt history')
 check(sql("SELECT count(*) FROM bookings b JOIN progressive_coupon_reservations r ON r.booking_id=b.id WHERE b.status='pending_payment' AND r.status='consumed'")==='0','No pending bill has a consumed coupon')
 fs.writeFileSync(root+'/result.json',JSON.stringify({pass:true,checks,actor,other,ids:{id,fresh,family,kid,adultZero,kZero,keepZero,a1,a2,expireBill,receiptBill}},null,2));console.log(JSON.stringify({root,passed:checks.length}))
}catch(e){fs.writeFileSync(root+'/failure.json',JSON.stringify({checks,error:String(e),stderr:String(e.stderr||''),stack:e.stack},null,2));throw e}
finally{sql(clockBefore+';')}
