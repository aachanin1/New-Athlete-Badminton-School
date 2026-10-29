import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {run,sql,q,fixtures} from '../tests/booking-ux/runtime.mjs'
const root='.playwright/booking-ux-2/revision-stage2-20261029/sets-'+Date.now();fs.mkdirSync(root,{recursive:true})
const f=JSON.parse(fs.readFileSync(run.evidenceRoot+'/fixture.json')),checks=[]
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label);console.log(label)}
const json=s=>JSON.parse(sql(s)),arg=v=>v==null?'NULL':Array.isArray(v)&&v.every(x=>typeof x==='string'&&/^[a-f0-9-]{36}$/.test(x))?'ARRAY['+v.map(q).join(',')+']::uuid[]':typeof v==='object'?q(JSON.stringify(v))+'::jsonb':q(v)
const rpc=(n,...a)=>json(`SELECT ${n}(${a.map(arg).join(',')})`)
const snapshot=ids=>json(`SELECT jsonb_agg(jsonb_build_object('bill',to_jsonb(b),'hold',(SELECT to_jsonb(r) FROM progressive_coupon_reservations r WHERE booking_id=b.id),'sessions',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM booking_sessions s WHERE booking_id=b.id),'changes',(SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM booking_ux_coupon_changes x WHERE booking_id=b.id)) ORDER BY b.id) FROM bookings b WHERE id IN (${ids.map(q)})`)
const coupon=(type='fixed',value=100,max=null)=>{const id=randomUUID(),code='SETUX2'+randomUUID().slice(0,8).toUpperCase();sql(`INSERT INTO coupons(id,code,discount_type,discount_value,max_uses,created_by) VALUES(${q(id)},${q(code)},${q(type)},${value},${max??'NULL'},${q(f.sa.id)})`);return{id,code}}
const day=n=>sql(`SELECT (date_trunc('month',now() AT TIME ZONE 'Asia/Bangkok')+interval '1 month'+interval '${n} days')::date::text`)
function round(child,n){const date=day(n);return{date,startTime:'10:00',endTime:'11:00',branchId:f.branch,childId:child,scheduleTemplateId:sql(`SELECT id FROM schedule_templates WHERE branch_id=${q(f.branch)} AND course_type_id=${q(f.courses.kids_group)} AND day_of_week=extract(dow FROM date ${q(date)}) AND start_time='10:00' AND is_active LIMIT 1`)}}
function kids(a,sessions,c=null){const d=sessions[0].date,course=f.courses.kids_group,baseline=json(`SELECT to_jsonb(x) FROM progressive_legacy_baseline_v1(${q(a.id)},${q(course)},${+d.slice(0,4)},${+d.slice(5,7)})x`),policy=rpc('task10_booking_policy_quote_v1',a.id,course,d.slice(0,7)+'-01','progressive',null);return rpc('booking_ux_create_v1',a.id,randomUUID(),{courseTypeId:course,branchId:f.branch,learnerType:'child',childId:sessions[0].childId,sessions,coupon:c,expectedScopeRevision:Number(sql(`SELECT coalesce((SELECT revision FROM booking_pricing_scopes WHERE user_id=${q(a.id)} AND course_type_id=${q(course)} AND lesson_year=${+d.slice(0,4)} AND lesson_month=${+d.slice(5,7)}),0)`)),expectedLegacyBaselineSessions:baseline.baseline_sessions,expectedLegacyBaselineFingerprint:baseline.baseline_fingerprint,expectedPolicyFingerprint:policy.fingerprint}).bookingId}
const command=(a,ids,edits,changes)=>({action:'edit',bookingIds:ids,token:sql(`SELECT booking_ux_set_token_v1(${q(a.id)},ARRAY[${ids.map(q)}]::uuid[])`),edits,couponChanges:changes})
const edit=(a,i,p=false,k=randomUUID())=>rpc('booking_ux_edit_set_v1',a.id,k,i,p)
try{
 const a=await fixtures.account('user','หลายบิลคูปองรอบสอง'),child=randomUUID();sql(`INSERT INTO children(id,parent_id,full_name) VALUES(${q(child)},${q(a.id)},'ผู้เรียนชุดหลายบิล')`)
 const old=coupon('fixed',100),c1=coupon('percent',10),c3=coupon('fixed',100)
 const rounds=[round(child,19),round(child,20),round(child,21)],ids=rounds.map((s,n)=>kids(a,[s],n===0?old:null)),before=snapshot(ids)
 const scope=before[0].bill.pricing_scope_id,rev=Number(sql(`SELECT revision FROM booking_pricing_scopes WHERE id=${q(scope)}`)),originalTotal=before.reduce((n,x)=>n+x.bill.total_price,0)
 const batch=rpc('prepare_progressive_payment_batch_v2',a.id,scope,ids,rev,originalTotal,randomUUID()),batchBefore=json(`SELECT to_jsonb(b) FROM progressive_payment_batches b WHERE id=${q(batch.batchId)}`)
 check(batchBefore.status==='prepared'&&Number(sql(`SELECT count(*) FROM progressive_payment_batch_bookings WHERE payment_batch_id=${q(batch.batchId)} AND active`))===3,'Original three-bill batch is actually prepared and owns three active payment members')
 let i=command(a,ids,ids.map((id,n)=>({id,sessions:[rounds[n]]})),ids.map((bookingId,n)=>({bookingId,action:n===1?'keep':'apply',...(n===1?{}:{code:n===0?c1.code:c3.code})})))
 const p=edit(a,i,true);assert.deepEqual(snapshot(ids),before)
 check(p.total===1780&&p.bills.length===3,'Multi-bill quote applies codes only to their exact targets and rolls back all original fields')
 check(json(`SELECT to_jsonb(b) FROM progressive_payment_batches b WHERE id=${q(batch.batchId)}`).status==='prepared','Preview cancellation of prepared batch is rolled back too')
 const bad={...i,couponChanges:i.couponChanges.map((x,n)=>n===2?{...x,code:'NOTFOUND'}:x)}
 assert.throws(()=>edit(a,bad,true),/COUPON_NOT_FOUND/);assert.deepEqual(snapshot(ids),before)
 check(true,'Failure in a later coupon choice rolls back earlier release, bill edits and audit')
 const request=randomUUID(),savedInput={...i,expectedTotal:p.total,quoteToken:p.quoteToken};edit(a,savedInput,false,request)
 const after=snapshot(ids)
 check(after.reduce((n,x)=>n+x.bill.total_price,0)===1780&&after.every(x=>x.bill.status==='pending_payment'),'All selected bills save correct positive totals together without unpaid settlement')
 check(after.every(x=>before.find(b=>b.bill.id===x.bill.id).bill.checkout_deadline===x.bill.checkout_deadline),'Every bill retains its own original deadline')
 const calculation=json(`SELECT jsonb_agg(jsonb_build_object('id',b.id,'revision',b.pricing_revision,'billGross',b.gross_price_snapshot,'billDiscount',b.coupon_discount_snapshot,'billFinal',b.final_price_snapshot,'evidence',c.evidence)) FROM bookings b LEFT JOIN task10_booking_calculations c ON c.booking_id=b.id AND c.revision=b.pricing_revision WHERE b.id IN (${ids.map(q)})`)
 check(calculation.every(x=>x.evidence&&Number(x.evidence.gross)===x.billGross&&Number(x.evidence.discount)===x.billDiscount&&Number(x.evidence.final)===x.billFinal),'Every current bill revision has matching append-only gross/discount/final calculation evidence')
 check(new Set(calculation.map(x=>x.revision)).size>1,'Fixture exercises multiple current revisions, not just the final scope revision')
 const batchAfter=json(`SELECT to_jsonb(b) FROM progressive_payment_batches b WHERE id=${q(batch.batchId)}`)
 check(batchAfter.status==='cancelled'&&batchAfter.total_amount===batchBefore.total_amount&&sql(`SELECT count(*) FROM progressive_payment_batch_bookings WHERE payment_batch_id=${q(batch.batchId)} AND active`)==='0','Old prepared batch is cancelled with its original amount preserved and all members inactive')
 assert.throws(()=>rpc('approve_progressive_payment_batch_v1',batch.batchId,f.sa.id,randomUUID()),/PROGRESSIVE_/)
 check(snapshot(ids).every(x=>x.bill.status==='pending_payment'),'Cancelled old batch cannot approve or settle any edited bill')
 const currentRevision=Number(sql(`SELECT revision FROM booking_pricing_scopes WHERE id=${q(scope)}`)),newBatch=rpc('prepare_progressive_payment_batch_v2',a.id,scope,ids,currentRevision,1780,randomUUID())
 check(newBatch.batchId!==batch.batchId&&Number(json(`SELECT to_jsonb(b) FROM progressive_payment_batches b WHERE id=${q(newBatch.batchId)}`).total_amount)===1780,'Replacement payment batch binds the current 1780 amount')
 check(edit(a,savedInput,false,request).idempotentReplay===true&&snapshot(ids).every(x=>x.bill.status==='pending_payment'),'Successful set replay cannot mutate a subsequently prepared batch or duplicate coupon state')
 // Historic usage is evidence, not a removable reservation. These are newly
 // generated synthetic records, never a customer repair or backfill.
 const h=await fixtures.account('user','ประวัติคูปองเก่าจำลอง'),hc=coupon(),pkg=json("SELECT to_jsonb(p) FROM booking_ux_packages p WHERE id='adult-10'"),d=day(1)
 const hist=rpc('booking_ux_create_v1',h.id,randomUUID(),{packageId:'adult-10',packageRevision:pkg.revision,courseTypeId:f.courses.adult_group,branchId:f.branch,participants:[null],month:+d.slice(5,7),year:+d.slice(0,4),totalSessions:10,totalAmount:5500,expectedTotalPrice:5500,sessions:[]}).bookingId
 sql(`BEGIN;SET LOCAL task10.payment_write='authorized';INSERT INTO coupon_usages(coupon_id,user_id,booking_id,discount_amount) VALUES(${q(hc.id)},${q(h.id)},${q(hist)},100);UPDATE bookings SET total_price=5400 WHERE id=${q(hist)};COMMIT;`)
 const historical=snapshot([hist]);i=command(h,[hist],[{id:hist,sessions:[]}],[{bookingId:hist,action:'remove'}])
 assert.throws(()=>edit(h,i,true),/LEGACY_COUPON_REVIEW_REQUIRED/);assert.deepEqual(snapshot([hist]),historical)
 check(true,'Historical consumed usage cannot be silently removed or returned as a fresh quota')
 const acl=sql("SELECT count(*) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN ('booking_ux_coupon_choice_v3','booking_ux_coupon_zero_edit_v3') AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('service_role',p.oid,'EXECUTE'))")
 check(acl==='0'&&sql("SELECT relrowsecurity FROM pg_class WHERE oid='public.booking_ux_coupon_changes'::regclass")==='t','New internal helpers are not API-callable and coupon transition history has RLS')
 fs.writeFileSync(root+'/result.json',JSON.stringify({pass:true,checks,actor:a,ids,batch:batch.batchId,newBatch:newBatch.batchId,calculation},null,2));console.log(JSON.stringify({root,passed:checks.length}))
}catch(e){fs.writeFileSync(root+'/failure.json',JSON.stringify({checks,error:String(e),stderr:String(e.stderr||''),stack:e.stack},null,2));throw e}
