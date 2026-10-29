import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {expect} from '@playwright/test'
import {run,env,sql,q,db,fixtures} from '../tests/booking-ux/runtime.mjs'
import {adminBrowser} from '../tests/booking-ux/browser.mjs'

// Authored under W1; only the primary executes this guarded Local harness.
// Real Auth/API/DB/storage paths, with synthetic Local PNG/GPS evidence.
const base=process.env.BOOKING_UX2_BASE||'http://127.0.0.1:3150'
assert.match(base,/^http:\/\/127\.0\.0\.1:315[0-3]$/)
const runtime=JSON.parse(fs.readFileSync(process.env.BOOKING_UX2_RUNTIME||'.playwright/booking-ux-1/app-runtime.json','utf8'))
assert.equal(runtime.port,Number(new URL(base).port));assert.equal(runtime.api,env.apiUrl)
const binding=JSON.parse(fs.readFileSync(path.join(runtime.app,'.next/booking-ux-1-local-build.json'),'utf8'))
assert.equal(binding.runId,run.runId);assert.equal(binding.api,env.apiUrl)
assert.equal(binding.buildId,fs.readFileSync(path.join(runtime.app,'.next/BUILD_ID'),'utf8').trim())
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const manifest=JSON.parse(fs.readFileSync(path.join(runtime.app,'source-manifest.json'),'utf8'))
for(const [file,digest] of Object.entries(manifest.hashes))if(/^(src\/|public\/|supabase\/migrations\/|package(?:-lock)?\.json$|next\.config)/.test(file))assert.equal(sha(file),digest,'Built source differs: '+file)
const root=path.resolve('.playwright/booking-ux-2/revision-private-wallet-20261029/readers-'+Date.now()+'-'+randomUUID().slice(0,8))
fs.mkdirSync(root,{recursive:true})
const f=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json'),'utf8'))
const checks=[],errors=[],egress=[],traffic=[],browsers=[],actors=[],bills=[]
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label);console.log(label)}
const read=s=>JSON.parse(sql(s)),arg=v=>v==null?'NULL':typeof v==='object'?q(JSON.stringify(v))+'::jsonb':q(v)
const rpc=(n,...a)=>read(`SELECT ${n}(${a.map(arg).join(',')})`)
const members=ids=>ids.map(id=>id||'self').sort(),sameMembers=(a,b)=>JSON.stringify(members(a))===JSON.stringify(members(b))
const escaped=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const state=id=>read(`SELECT jsonb_build_object('bill',to_jsonb(b),'sessions',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY id),'[]') FROM booking_sessions s WHERE s.booking_id=b.id),'units',(SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY ordinal),'[]') FROM booking_package_units u WHERE u.booking_id=b.id),'payments',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY id),'[]') FROM payments p WHERE p.booking_id=b.id),'hold',(SELECT to_jsonb(r) FROM progressive_coupon_reservations r WHERE r.booking_id=b.id),'audit',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id),'[]') FROM activity_logs a WHERE a.entity_id=b.id)) FROM bookings b WHERE b.id=${q(id)}`)
const available=s=>s.units.filter(u=>u.status==='available')
const png=()=>Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBXkAAAAASUVORK5CYII=','base64'),Buffer.from(randomUUID())])
async function account(role,label){const a=await fixtures.account(role,label);a.name=sql(`SELECT full_name FROM profiles WHERE id=${q(a.id)}`);actors.push(a.id);return a}
function child(a,label){const c={id:randomUUID(),name:label+' '+randomUUID().slice(0,5)};sql(`INSERT INTO children(id,parent_id,full_name) VALUES(${q(c.id)},${q(a.id)},${q(c.name)})`);return c}
const branch=randomUUID(),branchName='สาขาตรวจรับ Private Wallet '+randomUUID().slice(0,5)
const today=sql("SELECT (clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date::text")
const afterDay=n=>sql(`SELECT (date ${q(today)}+${n})::text`)
const soon=read("SELECT jsonb_build_object('date',s::date,'start',to_char(s,'HH24:MI'),'end',to_char(s+interval '1 hour','HH24:MI')) FROM(SELECT date_trunc('hour',clock_timestamp() AT TIME ZONE 'Asia/Bangkok')+(floor(extract(minute FROM clock_timestamp() AT TIME ZONE 'Asia/Bangkok')/5)::integer*5+25)*interval '1 minute' s)x")
assert.equal(soon.date,today,'Run staff check-in proof while the next20–25min slot is still today')
assert.ok(soon.start<'23:00','Same-day one-hour check-in fixture must not cross midnight')
function template(course,date,start='10:00',end='11:00'){
 const id=sql(`SELECT id FROM schedule_templates WHERE branch_id=${q(branch)} AND course_type_id=${q(f.courses[course])} AND day_of_week=extract(dow FROM date ${q(date)}) AND start_time=${q(start)} AND end_time=${q(end)} AND is_active LIMIT 1`)
 if(id)return id
 const next=randomUUID();sql(`INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(next)},${q(branch)},${q(f.courses[course])},extract(dow FROM date ${q(date)}),${q(start)},${q(end)},true)`);return next
}
function round(childId,date,course='private',start='10:00',end='11:00'){return{date,startTime:start,endTime:end,branchId:branch,childId,scheduleTemplateId:template(course,date,start,end)}}
function pack(a,course='private',rounds=[],participants=[null]){
 const p=read(`SELECT to_jsonb(p) FROM booking_ux_packages p WHERE course=${q(course)} AND quantity=10 LIMIT 1`),date=rounds[0]?.date||today,gross=Number(sql(`SELECT task10_legacy_price_v1(NULL,${q(f.courses[course])},${+date.slice(5,7)},${+date.slice(0,4)},10,NULL)`)),result=rpc('booking_ux_create_v1',a.id,randomUUID(),{packageId:p.id,packageRevision:p.revision,courseTypeId:f.courses[course],branchId:branch,participants,month:+date.slice(5,7),year:+date.slice(0,4),totalSessions:10,totalAmount:gross,expectedTotalPrice:gross,sessions:rounds});bills.push(result.bookingId);return{id:result.bookingId,gross}
}
async function settle(a,bill){const request=randomUUID(),storage=a.id+'/'+request+'/private-wallet.png',bytes=png();assert.ifError((await db.storage.from('payment-slips').upload(storage,bytes,{contentType:'image/png'})).error);sql(`SELECT task10_accept_legacy_slip_v1(${q(a.id)},ARRAY[${q(bill.id)}]::uuid[],${q(storage)},${q(run.target.api+'/storage/v1/object/public/payment-slips/'+storage)},${q(createHash('sha256').update(bytes).digest('hex'))},${bill.gross},${q(request)})`);rpc('task10_finalize_legacy_slip_v1',a.id,request,true,'Local Private Wallet attendee fixture')}
const schema=read("SELECT jsonb_build_object('migrations',(SELECT jsonb_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations),'functionCount',count(*),'functionDefinitionsMd5',md5(string_agg(replace(pg_get_functiondef(p.oid),chr(13)||chr(10),chr(10)),E'\\n' ORDER BY p.oid::regprocedure::text))) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace")
const helpers=['tests/booking-ux/runtime.mjs','tests/booking-ux/browser.mjs','tests/branch-closure/isolated-runtime.mjs','tests/branch-closure/fixtures.mjs','scripts/verify-lesson-source-test-target.mjs']
const evidence={base,target:run.target,runId:run.runId,runtime,binding,schema,testDefinitionSha256:sha(import.meta.filename),helperHashes:Object.fromEntries(helpers.map(p=>[p,sha(p)])),fixture:{branch,branchName,today,soon}}
fs.writeFileSync(path.join(root,'inputs.json'),JSON.stringify(evidence,null,2))
async function open(a,url){const b=await adminBrowser(base,a);browsers.push(b);b.page.on('pageerror',e=>errors.push(e.message));await b.context.route('**/*',route=>{const u=new URL(route.request().url());if(['data:','blob:'].includes(u.protocol)||[new URL(base).host,new URL(env.apiUrl).host].includes(u.host))return route.fallback();egress.push(u.host);return route.abort()});b.page.on('request',r=>{if(new URL(r.url()).pathname==='/api/booking-wallet'&&r.method()==='POST')traffic.push({actor:a.id,body:r.postDataJSON()})});await b.page.setViewportSize({width:390,height:844});await b.page.goto(base+url,{waitUntil:'networkidle'});return b}
// Verify the changed real read helpers with authenticated Local staff clients.
import {register} from 'node:module'
import {createClient} from '@supabase/supabase-js'
import {lessonSourceFetch} from './verify-lesson-source-test-target.mjs'
register(new URL('./ts-alias-loader.mjs',import.meta.url).href,import.meta.url)
const {getCoachVisibleStudents}=await import('../src/lib/coach-student-access.ts')
const {getCoachStudentMemoryMap,getCoachMemoryKey}=await import('../src/lib/coach-student-memory.ts')
evidence.readerHashes=Object.fromEntries(['src/lib/coach-student-access.ts','src/lib/coach-student-memory.ts','src/lib/coach-student-reads.ts','src/lib/coach-assignment-resolution.ts','scripts/ts-alias-loader.mjs'].map(p=>[p,sha(p)]))
async function requestJSON(context,url,data){const response=data?await context.request.post(base+url,{data}):await context.request.get(base+url);return{status:response.status(),body:await response.json()}}
async function auth(a){const client=createClient(env.apiUrl,env.publishableKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:lessonSourceFetch}});assert.ifError((await client.auth.signInWithPassword({email:a.email,password:fixtures.password})).error);return client}
try{
 sql(`INSERT INTO branches(id,name,slug) VALUES(${q(branch)},${q(branchName)},${q('wallet-reader-'+branch)})`)
 const owner=await account('user','ตรวจ Private ใบเสร็จเด็ก ผู้เรียนจริงตนเอง'),c=child(owner,'เด็กในใบเสร็จเดิม'),bill=pack(owner,'private',[],[c.id]);await settle(owner,bill);const before=state(bill.id)
 assert.equal(before.bill.learner_type,'child');assert.equal(before.bill.child_id,c.id)
 const r=round(null,today,'private',soon.start,soon.end),pick={id:available(before)[0].id,kind:'package',date:today,start:soon.start,end:soon.end,branchId:branch,templateId:r.scheduleTemplateId,requestId:randomUUID(),participants:[null]},used=rpc('booking_ux_redeem_many_v2',owner.id,randomUUID(),[pick]),after=state(bill.id),session=after.sessions.find(s=>used.sessionIds.includes(s.id))
 assert.deepEqual(after.bill,before.bill);assert.deepEqual(after.payments,before.payments);check(used.used===1&&used.sessionIds.length===1&&session.child_id===null&&available(after).length===9,'Originally child-only paid invoice remains immutable while one hour is used by the actual parent/self')
 const head=await account('head_coach','หัวหน้าตรวจอ่าน Private'),coach=await account('coach','โค้ชตรวจอ่าน Private'),other=await account('coach','โค้ชไม่มีรายชื่อ Private');for(const a of [head,coach,other])sql(`INSERT INTO coach_branches(coach_id,branch_id) VALUES(${q(a.id)},${q(branch)})`)
 const hb=await open(head,'/coach/assign-groups?month='+today.slice(0,7)),contextRead=await requestJSON(hb.context,`/api/coach/assignment-groups?scheduleSlotId=${session.schedule_slot_id}&branchId=${branch}`);assert.equal(contextRead.status,200);assert.deepEqual(contextRead.body.rosterSessionIds,[session.id])
 const assignment={scheduleSlotId:session.schedule_slot_id,branchId:branch,groups:[{name:'Private actual self '+randomUUID().slice(0,5),coachId:coach.id,levelMin:0,levelMax:0,sortOrder:0,studentSessionIds:[session.id]}],expectedGroups:contextRead.body.canonicalGroups,saveContext:contextRead.body.saveContext,requestId:randomUUID(),deadline:new Date(Date.now()+20000).toISOString()}
 assert.equal((await requestJSON(hb.context,'/api/coach/assignment-groups',{...assignment,prepare:true})).status,200);assert.equal((await requestJSON(hb.context,'/api/coach/assignment-groups',assignment)).status,200)
 const cc=await auth(coach),hc=await auth(head),oc=await auth(other),visible=await getCoachVisibleStudents(cc,{id:coach.id}),headVisible=await getCoachVisibleStudents(hc,{id:head.id}),unrelated=await getCoachVisibleStudents(oc,{id:other.id})
 check(visible.some(s=>s.id===owner.id&&s.type==='adult')&&!visible.some(s=>s.id===c.id),'Responsible coach authenticated exact-assignment student reader shows attending self and excludes nonattending invoice child')
 check(headVisible.some(s=>s.id===owner.id&&s.type==='adult')&&!headVisible.some(s=>s.id===c.id),'Head Coach authenticated branch student reader follows actual Private identity despite child-only invoice')
 check(!unrelated.some(s=>s.id===owner.id||s.id===c.id),'Unassigned coach in the same branch does not gain access to the actual or invoice-only learner')
 const cb=await open(coach,'/coach/today?date='+today),proof=await cb.context.request.post(base+'/api/coach/checkin',{multipart:{scheduleSlotId:session.schedule_slot_id,lat:'13.7563',lng:'100.5018',photoSource:'camera_capture',photo:{name:'synthetic-reader.png',mimeType:'image/png',buffer:png()}}});assert.equal(proof.status(),200,await proof.text())
 const attended=await requestJSON(cb.context,'/api/coach/attendance',{bookingSessionId:session.id,studentId:owner.id,studentType:'adult',status:'present'});assert.equal(attended.status,200,JSON.stringify(attended.body))
 const refs=[{id:owner.id,type:'adult'},{id:c.id,type:'child'}],memory=await getCoachStudentMemoryMap(hc,refs),actual=memory[getCoachMemoryKey(refs[0])],invoiceOnly=memory[getCoachMemoryKey(refs[1])]
 check(actual.coaches.length===1&&actual.coaches[0].coachId===coach.id&&actual.coaches[0].totalSessions===1&&actual.coaches[0].courseTypes.includes('private')&&actual.suggestedCoach?.coachId===coach.id,'Authenticated Head Coach history includes one actual Private parent/self lesson and correct responsible coach from child-only paid bill')
 check(invoiceOnly.coaches.length===0&&invoiceOnly.suggestedCoach===null,'Original invoice child receives no fabricated coaching history when not attending')
 const final=state(bill.id);assert.deepEqual(final.bill,before.bill);assert.deepEqual(final.payments,before.payments);assert.deepEqual(final.units.filter(u=>u.id!==pick.id),before.units.filter(u=>u.id!==pick.id));check(true,'Actual attendance/read integration preserves original paid invoice,payment,expiry and all other package units')
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify({pass:true,...evidence,checks,bill:bill.id,owner:owner.id,child:c.id,staff:{head:head.id,coach:coach.id,other:other.id},session:session.id,visible,headVisible,unrelated,memory},null,2));console.log(JSON.stringify({root,passed:checks.length}))
}catch(error){fs.writeFileSync(path.join(root,'failure.json'),JSON.stringify({...evidence,checks,error:String(error),stack:error.stack},null,2));throw error}
finally{for(const b of browsers){await b.context.close().catch(()=>{});await b.browser.close().catch(()=>{})}}
