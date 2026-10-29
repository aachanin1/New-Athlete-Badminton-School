import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {createServerClient} from '@supabase/ssr'
import {sql,q,db,env,fixtures,holdTransaction,concurrentSql,observeLockWait} from '../tests/booking-ux/runtime.mjs'
const root=process.env.WALLET_EVIDENCE_ROOT||'.playwright/booking-ux-1/wallet-local-20261023',base=process.env.WALLET_LOCAL_URL||'http://127.0.0.1:3151',checks=[]
process.on('uncaughtExceptionMonitor',error=>fs.writeFileSync(root+'/failure-'+Date.now()+'.json',JSON.stringify({checks,error:String(error)},null,2)));
const f=JSON.parse(fs.readFileSync('.playwright/booking-ux-1/fixture.json'))
const read=s=>JSON.parse(sql(s)),check=(ok,label)=>{assert.ok(ok,label);checks.push(label);console.log(label)}
const rpc=(name,...args)=>`SELECT public.${name}(${args.map(v=>v===null?'NULL':typeof v==='object'?q(JSON.stringify(v))+'::jsonb':q(v)).join(',')})`
const actor=await fixtures.account('user','ตรวจรับกระเป๋า'),other=await fixtures.account('user','ผู้ใช้อื่นกระเป๋า')
const cookieFor=async a=>{const jar=new Map(),auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:xs=>xs.forEach(x=>jar.set(x.name,x.value))}});assert.ifError((await auth.auth.signInWithPassword({email:a.email,password:fixtures.password})).error);return [...jar].map(([k,v])=>k+'='+v).join('; ')}
const userCookie=await cookieFor(actor),adminCookie=await cookieFor(f.sa),otherCookie=await cookieFor(other)
const req=async(path,body,cookie=userCookie)=>{const options={method:body?'POST':'GET',headers:{Cookie:cookie,Origin:base,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined};const response=await fetch(base+path,options).catch(()=>fetch(base+path,options));return{status:response.status,body:await response.json()}}
const now=sql("SELECT (clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date"),sourceMonth=sql("SELECT date_trunc('month',clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date"),currentMonth=now.slice(0,7)
const template=(course,date,start='10:00')=>sql(`SELECT id FROM schedule_templates WHERE branch_id=${q(f.branch)} AND course_type_id=${q(f.courses[course])} AND day_of_week=extract(dow FROM date ${q(date)}) AND start_time=${q(start)} AND is_active LIMIT 1`)
const dates=[3,4,5,6,7].map(n=>sql(`SELECT (date ${q(now)}+${n})::text`))
const makePackage=async(course,members)=>{
 const p=read('SELECT booking_ux_catalog_v1()').find(p=>p.course===course&&p.quantity===10)
 const bill=read(rpc('booking_ux_create_v1',actor.id,randomUUID(),{packageId:p.id,packageRevision:p.revision,courseTypeId:f.courses[course],branchId:f.branch,participants:members,learnerType:members.includes(null)?'self':'child',month:+now.slice(5,7),year:+now.slice(0,4),totalSessions:10,totalAmount:p.price,expectedTotalPrice:p.price,sessions:[]}))
 const request=randomUUID(),path=actor.id+'/'+request+'/proof.png',bytes=Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBXkAAAAASUVORK5CYII=','base64'),Buffer.from(request)])
 assert.ifError((await db.storage.from('payment-slips').upload(path,bytes,{contentType:'image/png'})).error)
 read(`SELECT task10_accept_legacy_slip_v1(${q(actor.id)},ARRAY[${q(bill.bookingId)}]::uuid[],${q(path)},${q(env.apiUrl+'/storage/v1/object/public/payment-slips/'+path)},${q(createHash('sha256').update(bytes).digest('hex'))},${p.price},${q(request)})`)
 read(rpc('task10_finalize_legacy_slip_v1',actor.id,request,true,'Local Wallet acceptance fixture'))
 return bill.bookingId
}
const child=randomUUID(),childB=randomUUID();sql(`INSERT INTO children(id,parent_id,full_name,nickname)VALUES(${q(child)},${q(actor.id)},'นักเรียนกระเป๋า เอ','น้องเอ'),(${q(childB)},${q(actor.id)},'นักเรียนกระเป๋า บี','น้องบี')`)
const adult=await makePackage('adult_group',[null]),family=await makePackage('private',[null,child,childB])
fs.writeFileSync(root+'/actor.json',JSON.stringify({actor,child,childB,adult,family,dates,branch:f.branch},null,2))
const units=id=>read(`SELECT jsonb_agg(id ORDER BY ordinal) FROM booking_package_units WHERE booking_id=${q(id)} AND status='available'`)
const pick=(id,course,date,start='10:00',kind='package')=>({id,kind,date,start,end:String(+start.slice(0,2)+1).padStart(2,'0')+':00',branchId:f.branch,templateId:template(course,date,start),requestId:randomUUID()})
const initialUnits=units(adult),three=initialUnits.slice(0,3).map((id,i)=>pick(id,'adult_group',dates[i])),request=randomUUID()
check((await req('/api/booking-wallet',null,'')).status===401,'Anonymous Wallet denied')
check((await req('/api/booking-wallet?calendarOnly=1&month=bad')).status===400,'Invalid calendar month denied')
const result=await req('/api/booking-wallet',{requestId:request,picks:three});check(result.status===200&&result.body.used===3,'User redeems three days atomically through the real API')
check(units(adult).length===7,'Ten paid units become seven after three real redemptions')
const before=sql(`SELECT count(*) FROM booking_sessions WHERE booking_id=${q(adult)}`)
check((await req('/api/booking-wallet',{requestId:request,picks:three})).status===200&&sql(`SELECT count(*) FROM booking_sessions WHERE booking_id=${q(adult)}`)===before,'Identical request replay creates no extra sessions or spent rights')
const calendar=await req('/api/booking-wallet?calendarOnly=1&month='+dates[0].slice(0,7));fs.writeFileSync(root+'/calendar-response.json',JSON.stringify(calendar,null,2));check(calendar.status===200&&calendar.body.sessions.some(s=>s.date===dates[0]&&s.childId===null),'Calendar reads owned real redeemed sessions')
check(!(await req('/api/booking-wallet?calendarOnly=1&month='+dates[0].slice(0,7),null,otherCookie)).body.sessions.some(s=>s.date===dates[0]),'Calendar cannot expose another account sessions')
const rights=units(adult),bad=[pick(rights[0],'adult_group',dates[3]),three[0]]
check((await req('/api/booking-wallet',{requestId:randomUUID(),picks:bad})).status===409&&units(adult).length===7,'One stale source rejects the whole mixed batch without partial spending')
const familyPick=pick(units(family)[0],'private',dates[4]);check((await req('/api/booking-wallet',{requestId:randomUUID(),picks:[familyPick]})).status===200,'Family redemption succeeds')
check(sql(`SELECT count(*) FROM booking_sessions WHERE booking_id=${q(family)}`)==='3'&&units(family).length===9,'One Family hour moves all three participants and spends one unit')
// Historical synthetic Kids sources, introduced in one guarded fixture transaction.
const kids=randomUUID(),kidsDest=randomUUID(),sourceDates=Array.from({length:4},()=>sql(`SELECT (date ${q(sourceMonth)}+interval '1 month'-interval '1 day')::date::text`)),sourceStarts=['17:00','18:00','19:00','20:00'],sourceIds=sourceDates.map(()=>randomUUID()),sourceSlots=sourceDates.map(()=>randomUUID()),credits=sourceDates.map(()=>randomUUID())
// Original Oct23 harness fixed26–29 dates are now inside48h/past. Keep all checks; create four real future month-end hours instead.
for(const start of sourceStarts){assert.equal(sql(`SELECT ((date ${q(sourceDates[0])}+time ${q(start)}) AT TIME ZONE 'Asia/Bangkok'>clock_timestamp()+interval '48 hours')`),'t','Month-end regression fixture needs >48h remaining');if(!template('kids_group',sourceDates[0],start))sql(`INSERT INTO schedule_templates(branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(f.branch)},${q(f.courses.kids_group)},extract(dow FROM date ${q(sourceDates[0])}),${q(start)},${q(String(+start.slice(0,2)+1).padStart(2,'0')+':00')},true)`)}
sql(`BEGIN;CREATE TEMP TABLE wallet_saved_control ON COMMIT DROP AS SELECT enabled FROM booking_ux_control;CREATE TEMP TABLE wallet_saved_policy ON COMMIT DROP AS SELECT * FROM task10_policy_activation;UPDATE task10_policy_activation SET state='never_activated',effective_at=NULL,pricing_enabled=false,makeup_enabled=false,expiry_enabled=false;UPDATE booking_ux_control SET enabled=false;
 SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);SELECT set_config('task10.payment_write','authorized',true);
 INSERT INTO bookings(id,user_id,learner_type,child_id,branch_id,course_type_id,month,year,total_sessions,total_price,status,created_at)VALUES(${q(kids)},${q(actor.id)},'child',${q(child)},${q(f.branch)},${q(f.courses.kids_group)},extract(month FROM date ${q(sourceMonth)}),extract(year FROM date ${q(sourceMonth)}),12,500,'verified',date ${q(sourceMonth)}),(${q(kidsDest)},${q(actor.id)},'child',${q(child)},${q(f.branch)},${q(f.courses.kids_group)},extract(month FROM (date ${q(sourceMonth)}+interval '1 month')),extract(year FROM (date ${q(sourceMonth)}+interval '1 month')),4,500,'verified',date ${q(now)});
 ${sourceIds.map((id,i)=>`INSERT INTO schedule_slots(id,template_id,branch_id,course_type_id,date,start_time,end_time,status)VALUES(${q(sourceSlots[i])},${q(template('kids_group',sourceDates[i],sourceStarts[i]))},${q(f.branch)},${q(f.courses.kids_group)},${q(sourceDates[i])},${q(sourceStarts[i])},${q(String(+sourceStarts[i].slice(0,2)+1).padStart(2,'0')+':00')},'open') ON CONFLICT (branch_id,course_type_id,date,start_time) DO NOTHING;INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup)VALUES(${q(id)},${q(kids)},(SELECT id FROM schedule_slots WHERE branch_id=${q(f.branch)} AND course_type_id=${q(f.courses.kids_group)} AND date=${q(sourceDates[i])} AND start_time=${q(sourceStarts[i])}),${q(sourceDates[i])},${q(sourceStarts[i])},${q(String(+sourceStarts[i].slice(0,2)+1).padStart(2,'0')+':00')},${q(f.branch)},${q(i===3?childB:child)},'scheduled',false);
`).join('')}
 UPDATE task10_policy_activation SET state=(SELECT state FROM wallet_saved_policy),effective_at=(SELECT effective_at FROM wallet_saved_policy),pricing_enabled=(SELECT pricing_enabled FROM wallet_saved_policy),makeup_enabled=(SELECT makeup_enabled FROM wallet_saved_policy),expiry_enabled=(SELECT expiry_enabled FROM wallet_saved_policy);UPDATE booking_ux_control SET enabled=(SELECT enabled FROM wallet_saved_control);COMMIT;`)
sourceIds.forEach((id,i)=>{credits[i]=read(rpc('lesson_source_transition_v1',actor.id,'store',id,{})).credit_id});
fs.writeFileSync(root+'/kids-fixture.json',JSON.stringify({actor,kids,kidsDest,credits,sourceIds,sourceMonth,child,childB},null,2));
if(process.env.WALLET_UI_FIXTURE_ONLY==='1'){console.log('UI fixture ready: '+actor.email);process.exit(0)}
const parentState=()=>read(rpc('booking_ux_parent_state_v1',actor.id,sourceMonth))
check(parentState().eligible&&parentState().remaining===3,'Parent reads eligible historical Wallet with Q=3 and verified destination purchase')
const kidsTargets=[14,15,16].map(n=>sql(`SELECT ((date ${q(sourceMonth)}+interval '1 month')::date+${n})::date`))
assert.ok(kidsTargets.length>=3,'Need three future target dates in current month')
const adminBody=(i,date)=>({original_session_id:sourceIds[i],attending_child_id:i===3?childB:child,schedule_template_id:template('kids_group',date),branch_id:f.branch,makeup_date:date,start_time:'10:00',end_time:'11:00',request_id:randomUUID(),reason:'ทดสอบกระเป๋าร่วม Local'})
const admin=await req('/api/admin/makeup/kids-family',adminBody(0,kidsTargets[0]),adminCookie)
check(admin.status===200,'Existing Admin family Makeup API consumes one original Wallet source')
check(parentState().remaining===2&&!parentState().sources.some(s=>s.creditId===credits[0]),'Admin action reduces Parent shared quota and removes its exact original source')
const reread=await req('/api/booking-wallet');check(reread.body.credits.find(c=>c.id===credits[0])?.status==='redeemed','Admin-spent source is removed from normal-month available Wallet too');
check((await req('/api/booking-wallet',{requestId:randomUUID(),picks:[pick(credits[0],'kids_group',dates[3],'17:00','wallet')]})).status===409,'Normal-month use also rejects a source already consumed by Admin');
check(reread.body.makeup.find(m=>m.sourceMonth===sourceMonth.slice(0,7))?.remaining===2,'User Wallet API immediately reports Admin-updated remaining count')
const cross=pick(credits[1],'kids_group',kidsTargets[1],'10:00','wallet'),crossRequest=randomUUID()
check((await req('/api/booking-wallet',{requestId:crossRequest,picks:[cross]})).status===200&&parentState().remaining===1,'Parent use reduces the same shared Admin quota')
const adminRead=await req('/api/admin/makeup/kids-family?parentId='+actor.id+'&sourceMonth='+sourceMonth.slice(0,7),null,adminCookie)
fs.writeFileSync(root+'/admin-read-response.json',JSON.stringify(adminRead,null,2))
check(adminRead.status===200&&adminRead.body.remaining===1,'Existing Admin read API sees the reduced shared quota after Parent use')
check((await req('/api/booking-wallet',{requestId:randomUUID(),picks:[pick(credits[0],'kids_group',kidsTargets[2],'10:00','wallet')]})).status===409,'Parent cannot replay the source already used by Admin')
const racePick=pick(credits[2],'kids_group',kidsTargets[2],'10:00','wallet'),raceBody=adminBody(2,kidsTargets[2])
const [a,u]=await Promise.all([req('/api/admin/makeup/kids-family',raceBody,adminCookie),req('/api/booking-wallet',{requestId:randomUUID(),picks:[racePick]})])
check([a,u].filter(r=>r.status===200).length===1&&parentState().remaining===0,'Concurrent Admin/User use of the same source has one winner and one shared quota deduction')
check((await req('/api/booking-wallet',{requestId:randomUUID(),picks:[pick(credits[3],'kids_group',kidsTargets[2],'17:00','wallet')]})).status===409,'Unused sibling Wallet cannot exceed the shared exhausted quota')
const still=units(adult)[0],race=pick(still,'adult_group',dates[4],'17:00'),name='wallet-race-'+randomUUID()
const held=await holdTransaction(`SELECT id FROM booking_package_units WHERE id=${q(still)} FOR UPDATE;`,name)
const competing=concurrentSql(`SET application_name=${q(name+'-wait')};${rpc('booking_ux_redeem_many_v1',actor.id,randomUUID(),[race])}`)
await observeLockWait(name+'-wait');held.release();await held.done;await competing
check(units(adult).length===6,'Real row-lock wait still spends a package unit once')
const snapshot={actor,other,child,childB,adult,family,kids,kidsDest,credits,sourceIds,sourceMonth,dates,branch:f.branch,admin:f.sa,parentState:parentState(),checks,at:new Date().toISOString()}
fs.writeFileSync(root+'/integration.json',JSON.stringify(snapshot,null,2));console.log(JSON.stringify({passed:checks.length,actor:actor.email}))
