import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {createServerClient} from '@supabase/ssr'
import {run,env,sql,q,fixtures} from '../tests/booking-ux/runtime.mjs'

const base='http://127.0.0.1:3151',root='.playwright/booking-ux-2/scope-cancel-'+Date.now();fs.mkdirSync(root,{recursive:true})
const f=JSON.parse(fs.readFileSync(run.evidenceRoot+'/fixture.json')),checks=[]
const check=(ok,name)=>{assert.ok(ok,name);checks.push(name);console.log(name)}
const json=s=>JSON.parse(sql(s)),actor=await fixtures.account('user','ขอบเขตยกเลิกคูปอง UX2'),child=randomUUID(),coupon=randomUUID()
sql(`INSERT INTO children(id,parent_id,full_name) VALUES(${q(child)},${q(actor.id)},'ผู้เรียนทดสอบ tier/cancel');INSERT INTO coupons(id,code,discount_type,discount_value,min_purchase,created_by) VALUES(${q(coupon)},${q('UX2CANCEL'+randomUUID().slice(0,8))},'fixed',100,600,${q(f.sa.id)})`)
const cookies=new Map(),auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:xs=>xs.forEach(x=>cookies.set(x.name,x.value))}});assert.ifError((await auth.auth.signInWithPassword({email:actor.email,password:fixtures.password})).error)
const cookie=[...cookies].map(([k,v])=>k+'='+v).join('; ')
const api=async(path,input)=>{const r=await fetch(base+path,{method:'POST',headers:{Cookie:cookie,Origin:base,Connection:'close','Content-Type':'application/json'},body:JSON.stringify(input)});const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));return d}
const round=n=>{const date=sql(`SELECT (date_trunc('month',now() AT TIME ZONE 'Asia/Bangkok')+interval '1 month ${n} days')::date::text`);return{date,startTime:'10:00',endTime:'11:00',branchId:f.branch,childId:child,scheduleTemplateId:sql(`SELECT id FROM schedule_templates WHERE branch_id=${q(f.branch)} AND course_type_id=${q(f.courses.kids_group)} AND day_of_week=extract(dow FROM date ${q(date)}) AND start_time='10:00' AND is_active LIMIT 1`)}}
const create=async(ns,c=null)=>{const rounds=ns.map(round),date=rounds[0].date,p=await api('/api/bookings/preview',{courseTypeId:f.courses.kids_group,month:+date.slice(5,7),year:+date.slice(0,4),totalSessions:rounds.length,couponId:c});const r=await api('/api/booking-checkout',{action:'create',requestId:randomUUID(),input:{courseTypeId:f.courses.kids_group,branchId:f.branch,learnerType:'child',childId:child,month:+date.slice(5,7),year:+date.slice(0,4),totalSessions:rounds.length,totalAmount:p.grossPrice,expectedTotalPrice:p.totalPrice,sessions:rounds,coupon:c?{id:c}:null,expectedScopeRevision:p.expectedScopeRevision,expectedLegacyBaselineSessions:p.legacyBaselineSessions,expectedLegacyBaselineFingerprint:p.legacyBaselineFingerprint,expectedPolicyFingerprint:p.policy.fingerprint}});return r.bookingId}
try{
 const a=await create([3]),c=await create([4]),b=await create([5],coupon)
 const edited=[4,6,7,8,9,10].map(round).map(r=>({date:r.date,start_time:r.startTime,end_time:r.endTime,branch_id:r.branchId,child_id:r.childId,schedule_template_id:r.scheduleTemplateId})),scope=json(`SELECT to_jsonb(s) FROM booking_pricing_scopes s JOIN bookings b ON b.pricing_scope_id=s.id WHERE b.id=${q(c)}`),month=edited[0].date.slice(0,7)+'-01'
 const policy=json(`SELECT task10_booking_policy_quote_v1(${q(actor.id)},${q(f.courses.kids_group)},${q(month)}::date,'progressive',${q(c)})`)
 json(`SELECT task10_update_progressive_booking_v1(${q(actor.id)},${q(c)},${q(f.branch)},${q(JSON.stringify(edited))}::jsonb,${q(randomUUID())},${scope.revision},${q(policy.fingerprint)})`)
 check(Number(sql(`SELECT total_price FROM bookings WHERE id=${q(b)}`))===400&&sql(`SELECT status FROM progressive_coupon_reservations WHERE booking_id=${q(b)}`)==='reserved','Editing an earlier different bill through the authoritative single writer reprices the later issued coupon without invalidating its held terms')
 const ids=[a,b,c],input={action:'cancel',bookingIds:ids,token:sql(`SELECT booking_ux_set_token_v1(${q(actor.id)},ARRAY[${ids.map(q)}]::uuid[])`)}
 const current=sql("SELECT pg_get_functiondef('booking_ux_edit_set_v1(uuid,uuid,jsonb,boolean)'::regprocedure)"),regressed=current.replace("(CASE WHEN action='edit' THEN coalesce(p_input->'bookingIds','[]') ELSE '[]'::jsonb END)::text","coalesce(p_input->'bookingIds','[]')::text")
 assert.notEqual(current,regressed)
 assert.throws(()=>sql(`BEGIN;${regressed};SELECT booking_ux_edit_set_v1(${q(actor.id)},${q(randomUUID())},${q(JSON.stringify(input))}::jsonb,false);COMMIT;`),/COUPON_ACK_REQUIRED/)
 check(sql(`SELECT count(*) FROM bookings WHERE id=ANY(ARRAY[${ids.map(q)}]::uuid[]) AND status='pending_payment'`)==='3','Old cancel context reproduces the failure inside a rolled-back transaction with all original bills preserved')
 const request=randomUUID(),result=json(`SELECT booking_ux_edit_set_v1(${q(actor.id)},${q(request)},${q(JSON.stringify(input))}::jsonb,false)`)
 check(result.total===0&&sql(`SELECT count(*) FROM bookings WHERE id=ANY(ARRAY[${ids.map(q)}]::uuid[]) AND status='cancelled'`)==='3'&&sql(`SELECT status FROM progressive_coupon_reservations WHERE booking_id=${q(b)}`)==='released','Fixed whole-set cancellation releases the held coupon and cancels all three bills without a price acknowledgement')
 check(json(`SELECT booking_ux_edit_set_v1(${q(actor.id)},${q(request)},${q(JSON.stringify(input))}::jsonb,false)`).idempotentReplay===true,'Whole-set cancel replay does not repeat releases or cancellations')
 fs.writeFileSync(root+'/result.json',JSON.stringify({pass:true,checks,base,target:run.target,actor:actor.id,testDefinitionSha256:createHash('sha256').update(fs.readFileSync(import.meta.filename)).digest('hex')},null,2));console.log({root,passed:checks.length})
}catch(e){fs.writeFileSync(root+'/failure.json',JSON.stringify({checks,error:String(e),stderr:String(e.stderr||'')},null,2));throw e}
