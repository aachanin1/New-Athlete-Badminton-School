import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createServerClient} from '@supabase/ssr'
import {sql,q,fixtures,env,concurrentSql,holdTransaction,observeLockWait} from '../tests/booking-ux/runtime.mjs'
const root='.playwright/booking-ux-1/ux-seven-20261022';fs.mkdirSync(root,{recursive:true})
const f=JSON.parse(fs.readFileSync('.playwright/booking-ux-1/fixture.json','utf8')),checks=[]
const json=s=>JSON.parse(sql(s)),rpc=(name,args)=>`SELECT public.${name}(${args})`,check=(ok,name)=>{assert.ok(ok,name);checks.push(name);console.log(name)}
export async function auth(actor){const cookies=new Map();const c=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:xs=>xs.forEach(x=>cookies.set(x.name,x.value))}});assert.ifError((await c.auth.signInWithPassword({email:actor.email,password:fixtures.password})).error);return [...cookies].map(([k,v])=>k+'='+v).join('; ')}
export async function kids(actor,dates,child,base='http://127.0.0.1:3153'){
 const cookie=await auth(actor),sessions=dates.map((date,i)=>({date,startTime:'10:00',endTime:'11:00',branchId:f.branch,childId:child,scheduleTemplateId:sql(`SELECT id FROM schedule_templates WHERE branch_id=${q(f.branch)} AND course_type_id=${q(f.courses.kids_group)} AND day_of_week=extract(dow FROM date ${q(date)}) AND start_time='10:00' AND is_active LIMIT 1`)}))
 const response=await fetch(base+'/api/bookings/preview',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json',Origin:base},body:JSON.stringify({courseTypeId:f.courses.kids_group,month:10,year:2026,totalSessions:dates.length})}),p=await response.json();assert.equal(response.status,200,JSON.stringify(p))
 const body={courseTypeId:f.courses.kids_group,branchId:f.branch,learnerType:'child',childId:child,month:10,year:2026,totalSessions:dates.length,totalAmount:p.grossPrice,expectedTotalPrice:p.totalPrice,sessions,expectedScopeRevision:p.expectedScopeRevision,expectedLegacyBaselineSessions:p.legacyBaselineSessions,expectedLegacyBaselineFingerprint:p.legacyBaselineFingerprint,expectedPolicyFingerprint:p.policy.fingerprint}
 return json(rpc('booking_ux_create_v1',`${q(actor.id)},${q(randomUUID())},${q(JSON.stringify(body))}::jsonb`)).bookingId
}
const token=(actor,ids)=>sql(rpc('booking_ux_set_token_v1',`${q(actor.id)},ARRAY[${ids.map(q)}]::uuid[]`))
const command=(actor,ids,edits,extra={})=>({action:'edit',token:token(actor,ids),bookingIds:ids,edits,...extra})
const invoke=(actor,input,preview=false,id=randomUUID())=>json(rpc('booking_ux_edit_set_v1',`${q(actor.id)},${q(id)},${q(JSON.stringify(input))}::jsonb,${preview}`))
const rounds=id=>json(`SELECT coalesce(jsonb_agg(jsonb_build_object('date',date,'startTime',to_char(start_time,'HH24:MI'),'endTime',to_char(end_time,'HH24:MI'),'branchId',branch_id,'childId',child_id) ORDER BY date,start_time),'[]') FROM booking_sessions WHERE booking_id=${q(id)}`)
const reject=(fn,pattern,name)=>{assert.throws(fn,pattern);checks.push(name);console.log(name)}
async function main(){
 const actor=await fixtures.account('user','ทดสอบธุรกรรมแก้ทั้งชุด'),other=await fixtures.account('user','ทดสอบสิทธิแก้ชุด'),child=randomUUID();sql(`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(child)},${q(actor.id)},'เด็กทดสอบธุรกรรม','น้องธุรกรรม')`)
 const a=await kids(actor,['2026-10-23','2026-10-24'],child),b=await kids(actor,['2026-10-25','2026-10-26','2026-10-27','2026-10-28'],child),ids=[a,b],before=token(actor,ids),deadlines=sql(`SELECT jsonb_agg(checkout_deadline ORDER BY id) FROM bookings WHERE id=ANY(ARRAY[${ids.map(q)}]::uuid[])`)
 let edits=ids.map(id=>({id,sessions:rounds(id)}));edits[0].sessions[0].date='2026-10-29';edits[1].sessions[0].date='2026-10-30'
 let input=command(actor,ids,edits),preview=invoke(actor,input,true)
 check(preview.total===2982,'Two Kids bills use the original Progressive prices: 1250 + 1732 = 2982')
 check(token(actor,ids)===before,'Real-writer preview rolls back all session, scope, receipt and bill changes')
 reject(()=>invoke(other,input,true),/FORBIDDEN/,'Other customer cannot read or edit this payable set')
 reject(()=>invoke(actor,command(actor,[a],[edits[0]]),true),/SET_CHANGED/,'Partial Progressive scope cannot be edited alone')
 const invalid=structuredClone(input);invalid.edits[1].sessions[0].branchId=randomUUID();reject(()=>invoke(actor,invalid),/ERROR/,'Failure in later member aborts every earlier edit')
 check(token(actor,ids)===before,'Failed group write leaves both bills byte-equivalent')
 const id=randomUUID();input.expectedTotal=preview.total;invoke(actor,input,false,id)
 check(rounds(a)[1].date==='2026-10-29'&&rounds(b).some(s=>s.date==='2026-10-30'),'Both replacements commit together without extra rounds')
 check(sql(`SELECT jsonb_agg(checkout_deadline ORDER BY id) FROM bookings WHERE id=ANY(ARRAY[${ids.map(q)}]::uuid[])`)===deadlines,'Whole-set editing preserves each original thirty-minute deadline')
 const after=token(actor,ids);check(invoke(actor,input,false,id).idempotentReplay===true&&token(actor,ids)===after,'Lost acknowledgement replay has no second effect')
 reject(()=>invoke(actor,{...input,expectedTotal:1},false,id),/IDEMPOTENCY/,'Same nonce with changed intent is rejected')
 reject(()=>invoke(actor,input),/SET_CHANGED/,'Stale-tab version cannot overwrite a completed edit')
 edits=ids.map(id=>({id,sessions:rounds(id)}));edits[1].sessions.pop();input=command(actor,ids,edits);preview=invoke(actor,input,true);check(preview.total!==2982,'Removing a round previews the authoritative changed group total')
 reject(()=>invoke(actor,{...input,expectedTotal:2982}),/AMOUNT_CONFLICT/,'Unconfirmed new price rolls back every mutation');check(token(actor,ids)===after,'Rejected price leaves full set unchanged')
 input.expectedTotal=preview.total;const race='ux-set-'+randomUUID(),held=await holdTransaction(`SELECT id FROM bookings WHERE id=${q(a)} FOR UPDATE;`,race+'-holder');let outcomes
 try{const pending=[0,1].map(i=>concurrentSql(`SET application_name=${q(race+i)};${rpc('booking_ux_edit_set_v1',`${q(actor.id)},${q(randomUUID())},${q(JSON.stringify(input))}::jsonb,false`)}`));await observeLockWait(race+'0');held.release();await held.done;outcomes=await Promise.allSettled(pending)}finally{if(!outcomes){held.release();await held.done.catch(()=>{})}}
 check(outcomes.filter(r=>r.status==='fulfilled').length===1,'Observed concurrent editors yield one success and one stale-version rejection')
 const cancel={action:'cancel',bookingIds:ids,token:token(actor,ids)},cid=randomUUID();invoke(actor,cancel,false,cid);check(sql(`SELECT count(*) FROM bookings WHERE id=ANY(ARRAY[${ids.map(q)}]::uuid[]) AND status='cancelled'`)==='2','Whole-set cancellation cancels every member atomically');check(invoke(actor,cancel,false,cid).idempotentReplay,'Whole-set cancellation is idempotent')
 check(sql(`SELECT count(*) FROM booking_package_units u JOIN bookings b ON b.id=u.booking_id WHERE b.user_id=${q(actor.id)}`)==='0','Unpaid edits and cancellation grant no package units')
 const summary=json(rpc('booking_ux_pending_summary_v1',q(actor.id)));check(summary.count===0&&summary.amount===0,'No outstanding entry after cancellation')
 const catalog=json('SELECT public.booking_ux_catalog_v1()')
 const makePackage=(course,members,ss=[])=>{const p=catalog.find(p=>p.course===course&&p.quantity===10);return json(rpc('booking_ux_create_v1',`${q(actor.id)},${q(randomUUID())},${q(JSON.stringify({packageId:p.id,packageRevision:p.revision,courseTypeId:f.courses[course],branchId:f.branch,participants:members,learnerType:members.includes(null)?'self':'child',childId:members.length===1?members[0]:null,month:10,year:2026,totalSessions:10,totalAmount:p.price,expectedTotalPrice:p.price,sessions:ss}))}::jsonb`)).bookingId}
 const adult=makePackage('adult_group',[null]),family=makePackage('private',[null,child])
 const t=(course,date)=>sql(`SELECT id FROM schedule_templates WHERE branch_id=${q(f.branch)} AND course_type_id=${q(f.courses[course])} AND day_of_week=extract(dow FROM date ${q(date)}) AND start_time='10:00' AND is_active LIMIT 1`)
 const one=(course,date,childId=null)=>({date,startTime:'10:00',endTime:'11:00',branchId:f.branch,childId,scheduleTemplateId:t(course,date)})
 let legacyIds=[adult,family],legacy=command(actor,legacyIds,[{id:adult,sessions:[one('adult_group','2026-10-29')]},{id:family,sessions:[one('private','2026-10-30'),one('private','2026-10-30',child)]}])
 let quote=invoke(actor,legacy,true);check(quote.total===13500,'Adult and Private full package prices survive partial scheduling and combined preview')
 let packageBefore=sql(`SELECT jsonb_agg(jsonb_build_array(checkout_deadline,package_snapshot,package_participants) ORDER BY id) FROM bookings WHERE id=ANY(ARRAY[${legacyIds.map(q)}]::uuid[])`)
 invoke(actor,{...legacy,expectedTotal:quote.total});check(rounds(adult).length===1&&rounds(family).length===2,'Private Family replacement retains self and child in the same round')
 check(sql(`SELECT jsonb_agg(jsonb_build_array(checkout_deadline,package_snapshot,package_participants) ORDER BY id) FROM bookings WHERE id=ANY(ARRAY[${legacyIds.map(q)}]::uuid[])`)===packageBefore,'Package validity, identity and original deadlines remain immutable in grouped edits')
 legacy=command(actor,legacyIds,[{id:adult,sessions:rounds(adult)},{id:family,sessions:[one('private','2026-10-30')]}]);reject(()=>invoke(actor,legacy,true),/FAMILY_PARTICIPANTS/,'Family participant omission fails before any grouped write can commit')
 legacy=command(actor,legacyIds,[{id:adult,sessions:[]},{id:family,sessions:[]}]);quote=invoke(actor,legacy,true);invoke(actor,{...legacy,expectedTotal:quote.total});check(rounds(adult).length===0&&rounds(family).length===0,'Multi-unit packages may return to zero scheduled rounds at unchanged full price')
 const summary2=json(rpc('booking_ux_pending_summary_v1',q(actor.id)));check(summary2.count===2&&summary2.amount===13500,'Independent legacy packages remain two payable sets until explicitly grouped')
 const crossMonth=command(actor,[adult],[{id:adult,sessions:[one('adult_group','2026-11-10')]}]),crossQuote=invoke(actor,crossMonth,true)
 invoke(actor,{...crossMonth,expectedTotal:crossQuote.total});check(sql(`SELECT month FROM bookings WHERE id=${q(adult)}`)==='11'&&rounds(adult)[0].date==='2026-11-10','Existing package editing can move its lesson month without changing the original deadline')
 check(sql(`SELECT checkout_deadline FROM bookings WHERE id=${q(adult)}`)===sql(`SELECT checkout_deadline FROM bookings WHERE id=${q(family)}`)||sql(`SELECT checkout_deadline<created_at+interval '31 minutes' FROM bookings WHERE id=${q(adult)}`)==='t','Moving a package month does not extend its thirty-minute bill')
 const expiryInput=command(actor,[adult],[{id:adult,sessions:[]}]);
 const expired=sql(`BEGIN;CREATE OR REPLACE FUNCTION public.task10_clock_v1() RETURNS timestamptz LANGUAGE sql VOLATILE AS $clock$ SELECT clock_timestamp()+interval '31 minutes' $clock$;DO $test$ BEGIN PERFORM public.booking_ux_edit_set_v1(${q(actor.id)},${q(randomUUID())},${q(JSON.stringify(expiryInput))}::jsonb,true);RAISE EXCEPTION 'TEST_EXPECTED_DEADLINE_REJECTION';EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%BOOKING_UX_SET_CHANGED%' THEN RAISE;END IF;END $test$;ROLLBACK;SELECT true;`);check(expired.endsWith('t'),'After-deadline edit is rejected; transactional test clock is rolled back immediately')
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBXkAAAAASUVORK5CYII=','base64'),slipId=randomUUID(),slipPath=actor.id+'/'+slipId+'/slip.png'
 const {db}=await import('../tests/booking-ux/runtime.mjs');assert.ifError((await db.storage.from('payment-slips').upload(slipPath,png,{contentType:'image/png'})).error)
 json(rpc('task10_accept_legacy_slip_v1',`${q(actor.id)},ARRAY[${q(adult)}]::uuid[],${q(slipPath)},${q(env.apiUrl+'/storage/v1/object/public/payment-slips/'+slipPath)},${q('b'.repeat(64))},5500,${q(slipId)}`))
 reject(()=>invoke(actor,expiryInput,true),/SET_CHANGED/,'Accepted receipt blocks later editing independently of its remaining deadline')
 const acceptedSummary=json(rpc('booking_ux_pending_summary_v1',q(actor.id)));check(acceptedSummary.count===1&&acceptedSummary.amount===8000&&acceptedSummary.received===1,'Received-slip bill is excluded from payable total and shown as a separate status')
 reject(()=>invoke(actor,{action:'cancel',bookingIds:legacyIds,token:token(actor,legacyIds)}),/SET_CHANGED/,'Group cancellation cannot cancel any member after another member has an accepted receipt')
 check(sql(`SELECT status FROM bookings WHERE id=${q(family)}`)==='pending_payment','Rejected group cancellation preserves every remaining member')
 check(sql(`SELECT count(*) FROM booking_package_units u JOIN bookings b ON b.id=u.booking_id WHERE b.user_id=${q(actor.id)}`)==='0','Accepted-only and unpaid packages still have no granted rights')
 sql(`SELECT public.task10_finalize_legacy_slip_v1(${q(actor.id)},${q(slipId)},true,'Local accepted receipt regression')`)
 invoke(actor,{action:'cancel',bookingIds:[family],token:token(actor,[family])})
 const result={passed:true,checks,actor,at:new Date().toISOString()};fs.writeFileSync(root+'/transaction-tests.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:checks.length}))
}
if(process.argv[1]?.endsWith('check-booking-ux-seven.mjs'))await main()
