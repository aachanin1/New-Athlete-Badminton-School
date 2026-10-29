import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash,randomUUID} from 'node:crypto'
import {chromium,expect} from '@playwright/test'
import {createServerClient} from '@supabase/ssr'

// Authored for P5. The primary prepares the authorized QA fixture, executes this
// harness, and corroborates exact payment/coupon/unit/attendance rows separately.
// No Local runtime imports, service key, fixture creation, cleanup, or response mocks.
const fixturePath=process.env.BOOKING_UX2_RELEASE_FIXTURE
assert.ok(fixturePath,'BOOKING_UX2_RELEASE_FIXTURE must name the primary-owned ignored QA fixture')
const fixture=JSON.parse(fs.readFileSync(fixturePath,'utf8').replace(/^\uFEFF/,''))
assert.equal(fixture.authorizedMutation,true,'Explicit authorized hosted QA mutation scope required')
assert.ok(typeof fixture.authorizationReference==='string'&&fixture.authorizationReference.length>8)
const base=new URL(fixture.baseUrl).origin,api=new URL(fixture.apiUrl).origin
assert.equal(new URL(base).protocol,'https:')
assert.ok(['www.newathleteschool.com','new-athlete-badminton-school.vercel.app',
 'new-athlete-badminton-school-aachanin1s-projects.vercel.app',
 'new-athlete-badminton-school-aachanin1-aachanin1s-projects.vercel.app'].includes(new URL(base).host)
 || /^new-athlete-badminton-school-[a-z0-9]+-aachanin1s-projects\.vercel\.app$/.test(new URL(base).host),'Unexpected hosted application target')
assert.equal(api,'https://tvnhholicwjtxdhlxfqs.supabase.co','Unexpected Supabase target')
assert.match(fixture.deploymentId||'',/^dpl_[A-Za-z0-9]+$/)
assert.match(fixture.acceptedSourceSha||'',/^[a-f0-9]{40}$/)
assert.ok(fixture.schema&&fixture.runId&&fixture.publishableKey)
const uuid=/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i
const customer=fixture.customer,staff=fixture.staff,target=fixture.target
for(const actor of [customer,staff?.head,staff?.coach,staff?.other]){
 assert.match(actor?.id||'',uuid);assert.ok(actor.email&&actor.password&&actor.name)
}
assert.equal(new Set([customer.id,staff.head.id,staff.coach.id,staff.other.id]).size,4)
assert.equal(customer.children?.length,2,'The scoped Private test uses exactly two owned children')
for(const child of customer.children){assert.match(child.id,uuid);assert.ok(child.name)}
assert.equal(new Set(customer.children.map(c=>c.id)).size,2)
assert.match(fixture.privateBillId||'',uuid);assert.match(fixture.branchId||'',uuid)
assert.match(target?.templateId||'',uuid);assert.match(target?.date||'',/^\d{4}-\d{2}-\d{2}$/)
assert.match(target?.start||'',/^\d{2}:\d{2}$/);assert.match(target?.end||'',/^\d{2}:\d{2}$/)
assert.ok(Number.isInteger(fixture.remainingHoursBefore)&&fixture.remainingHoursBefore>0)
assert.equal((Date.parse(target.date+'T'+target.end+':00+07:00')-Date.parse(target.date+'T'+target.start+':00+07:00'))/3600000,1)
const initialBangkokToday=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const targetStartsAt=Date.parse(target.date+'T'+target.start+':00+07:00')
assert.equal(target.date,initialBangkokToday,'Check-in fixture must be today before any hosted mutation')
assert.ok(targetStartsAt>Date.now()&&targetStartsAt-Date.now()<=30*60000,'Prepare a future target inside the real next30minute check-in window')
const evidenceParent=path.resolve(fixture.evidenceRoot)
const allowedEvidenceParent=path.resolve('.playwright/booking-ux-2/production-release-20261029')
const evidenceRelative=path.relative(allowedEvidenceParent,evidenceParent)
assert.ok(!path.isAbsolute(evidenceRelative)&&evidenceRelative!=='..'&&!evidenceRelative.startsWith('..'+path.sep),'Evidence must stay inside this release evidence directory')
const root=path.join(evidenceParent,'hosted-browser-'+Date.now()+'-'+randomUUID().slice(0,8))
fs.mkdirSync(root,{recursive:true})
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const checks=[],unexecuted=[],errors=[],egress=[],traffic=[],opened=[],observations={}
const check=(condition,label)=>{assert.ok(condition,label);checks.push(label);console.log(label)}
const escaped=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const normalizedMembers=ids=>ids.map(id=>id??'self').sort()
const sameMembers=(a,b)=>JSON.stringify(normalizedMembers(a))===JSON.stringify(normalizedMembers(b))
const family=[null,...customer.children.map(c=>c.id)]
const money=amount=>'฿'+Number(amount).toLocaleString('en-US')
const protectionHeaders=fixture.protectionHeaders||{}
assert.ok(Object.values(protectionHeaders).every(v=>typeof v==='string'))
const inputs={runId:fixture.runId,at:new Date().toISOString(),base,api,
 deploymentId:fixture.deploymentId,acceptedSourceSha:fixture.acceptedSourceSha,
 declaredSchema:fixture.schema,authorizationReference:fixture.authorizationReference,
 testDefinitionSha256:sha(import.meta.filename),fixtureSha256:sha(fixturePath),
 actors:{customer:customer.id,head:staff.head.id,coach:staff.coach.id,other:staff.other.id},
 privateBillId:fixture.privateBillId,remainingHoursBefore:fixture.remainingHoursBefore,
 branchId:fixture.branchId,target,pendingBookingId:fixture.pendingBooking?.id||null,
 note:'Hosted UI/API evidence; primary must corroborate exact persisted financial, coupon, unit and attendance rows. No real camera/GPS or bank claim.'}
fs.writeFileSync(path.join(root,'inputs.json'),JSON.stringify(inputs,null,2))
let currentPage

async function open(actor,route){
 const cookies=new Map()
 const auth=createServerClient(api,fixture.publishableKey,{global:{fetch:async(input,init)=>{
  const url=new URL(typeof input==='string'||input instanceof URL?input.toString():input.url)
  assert.equal(url.origin,api,'Auth/read request outside intended Supabase target')
  return fetch(input,init)
 }},cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:values=>values.forEach(v=>cookies.set(v.name,v.value))}})
 assert.ifError((await auth.auth.signInWithPassword({email:actor.email,password:actor.password})).error)
 const {data:{user},error}=await auth.auth.getUser();assert.ifError(error);assert.equal(user?.id,actor.id)
 const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Bangkok',locale:'th-TH',extraHTTPHeaders:{Origin:base}})
 opened.push({browser,context,auth,actor})
 const protectedCookies=fixture.protectionCookies||[];for(const cookie of protectedCookies){assert.equal(cookie.name,'_vercel_jwt');assert.equal(cookie.domain,new URL(base).hostname);assert.equal(cookie.secure,true)}
 await context.addCookies([...protectedCookies,...[...cookies].map(([name,value])=>({name,value,domain:new URL(base).hostname,path:'/',secure:true,sameSite:'Lax'}))])
 context.setDefaultTimeout(15000);context.setDefaultNavigationTimeout(30000)
 await context.route('**/*',route=>{
  const url=new URL(route.request().url())
  if(['data:','blob:'].includes(url.protocol))return route.fallback()
  if(url.origin===base)return Object.keys(protectionHeaders).length?route.continue({headers:{...route.request().headers(),...protectionHeaders}}):route.fallback()
  if(url.origin===api)return route.fallback()
  egress.push(url.origin);return route.abort()
 })
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message))
 page.on('request',request=>{const url=new URL(request.url());if(url.origin===base&&request.method()==='POST'&&['/api/booking-wallet','/api/booking-checkout','/api/coach/attendance'].includes(url.pathname)){
  let body;try{body=request.postDataJSON()}catch{body=null}
  traffic.push({actor:actor.id,path:url.pathname,body})
 }})
 await page.goto(base+route,{waitUntil:'networkidle'});currentPage=page
 return{browser,context,page,auth,actor}
}
async function requestJSON(context,route,data){
 assert.ok(route.startsWith('/api/'))
 const response=data?await context.request.post(base+route,{headers:protectionHeaders,data}):await context.request.get(base+route,{headers:protectionHeaders})
 const text=await response.text();let body;try{body=JSON.parse(text)}catch{throw Error('Non-JSON application response '+response.status()+' '+route)}
 return{status:response.status(),body}
}
async function snapshot(page,name){
 await page.evaluate(async()=>{window.scrollTo({top:0,left:0,behavior:'instant'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})
 await page.screenshot({path:path.join(root,name+'.png'),fullPage:true})
}
async function responsive(page,name){
 for(const width of [390,1280]){await page.setViewportSize({width,height:width===1280?900:844});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits width'+width);await snapshot(page,name+'-'+width)}
 await page.setViewportSize({width:390,height:844})
}
async function checkout(context,id){const r=await requestJSON(context,'/api/booking-checkout?bookingId='+id);assert.equal(r.status,200);assert.ok(r.body.bookings?.some(b=>b.id===id));return r.body}
function billOf(data,id){return data.bookings.find(b=>b.id===id)}
function moneyState(data,id){const b=billOf(data,id);return{bill:{id:b.id,status:b.status,total_price:b.total_price,total_sessions:b.total_sessions,
 learner_type:b.learner_type,child_id:b.child_id,package_snapshot:b.package_snapshot,package_participants:b.package_participants,
 coupon_gross:b.coupon_gross,coupon_discount:b.coupon_discount,coupon_code:b.coupon_code,coupon_state:b.coupon_state,
 checkout_deadline:b.checkout_deadline,package_expiry:b.package_expiry,lifecycle:b.lifecycle},payments:data.payments,batches:data.batches}}
async function inventory(context){const r=await requestJSON(context,'/api/booking-wallet?inventory=2');assert.equal(r.status,200);return r.body}
const availableFor=(data,id)=>data.sources.filter(s=>s.kind==='package'&&s.bookingId===id)
async function viewDate(page,date){
 const day=page.getByTestId('booking-date-'+date)
 for(let attempt=0;attempt<12&&!await day.count();attempt++){
  const visible=await page.locator('[data-testid^="booking-date-"]').first().getAttribute('data-testid'),month=visible?.slice('booking-date-'.length,'booking-date-'.length+7)
  assert.ok(month,'Visible calendar month required')
  await page.getByRole('button',{name:month<date.slice(0,7)?'เดือนถัดไป':'เดือนก่อนหน้า',exact:true}).click()
 }
 await expect(day).toBeEnabled();await day.click()
}
async function openPrivate(page){
 await expect(page.getByTestId('booking-wallet')).toBeVisible()
 const tab=page.getByRole('button',{name:'Private',exact:true});if(await tab.count())await tab.click()
 await expect(page.getByRole('button',{name:'เลือกวันเรียน',exact:true})).toHaveCount(1)
 await page.getByRole('button',{name:'เลือกวันเรียน',exact:true}).click()
 await expect(page.getByTestId('wallet-private-default-members')).toBeVisible()
}
async function chooseFamily(page){
 await page.getByTestId('wallet-private-default-members').getByRole('button',{name:'เปลี่ยนผู้เรียนสำหรับรอบใหม่',exact:true}).click()
 const dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:'เลือกผู้เรียนสำหรับรอบใหม่',exact:true})).toBeVisible()
 await dialog.getByRole('checkbox',{name:/\(ตนเอง\)/}).check()
 for(const child of customer.children)await dialog.getByRole('checkbox',{name:new RegExp(escaped(child.name))}).check()
 await dialog.getByRole('button',{name:/^ใช้ผู้เรียน.*ที่เลือก/}).click();await expect(dialog).toHaveCount(0)
}
async function expectPayment(page,amount){await expect(page.getByTestId('payment-net-total')).toHaveText(money(amount),{timeout:30000})}
async function editPending(page,amount){
 await expectPayment(page,amount);await page.getByRole('button',{name:/^แก้ไขวันเรียน \/ คูปอง/}).click()
 await expect(page.getByTestId('booking-stage2-editor')).toBeVisible()
 await expect(page.getByTestId('booking-calendar')).toBeVisible();await expect(page.getByTestId('booking-edit-summary')).toHaveCount(0)
 await expect(page.getByTestId('booking-edit-total')).toHaveText(money(amount),{timeout:25000})
}
async function savePending(page,amount){
 await expect(page.getByTestId('booking-edit-save')).toBeEnabled();await page.getByTestId('booking-edit-save').click()
 await expect(page.getByTestId('booking-stage2-editor')).toHaveCount(0,{timeout:30000});await expectPayment(page,amount)
}
function assertPending(data,p,expected){
 const b=billOf(data,p.id);assert.equal(b.status,'pending_payment');assert.equal(Number(b.total_price),expected.net)
 assert.equal(Number(b.coupon_gross),expected.gross);assert.equal(Number(b.coupon_discount),expected.discount)
 assert.equal(b.lifecycle?.deadline||b.checkout_deadline,p.deadline);assert.equal(b.lifecycle?.acceptedReceipt,false)
 assert.notEqual(b.coupon_state,'consumed');assert.ok(!data.payments?.some(payment=>payment.status==='approved'))
 return b
}
async function pendingFlow(session){
 const p=fixture.pendingBooking
 if(!p){unexecuted.push('Pending coupon removal/reapply/round-change/recalculation UI (fixture not supplied)');return}
 assert.match(p.id,uuid);assert.ok(p.couponCode&&p.deadline&&p.net>0&&p.gross>0)
 const page=session.page;currentPage=page
 await page.goto(base+'/dashboard/booking?payment='+p.id,{waitUntil:'networkidle'})
 const before=await checkout(session.context,p.id);assertPending(before,p,p)
 await editPending(page,p.net);const coupon=page.getByTestId('booking-edit-coupon-'+p.id)
 await coupon.getByRole('button',{name:'ไม่ใช้คูปอง',exact:true}).click()
 await expect(page.getByTestId('booking-edit-total')).toHaveText(money(p.gross),{timeout:25000})
 assertPending(await checkout(session.context,p.id),p,p)
 check(true,'Pending coupon removal preview recalculates gross without consuming coupon or changing the persisted bill/deadline')
 await savePending(page,p.gross);const removed=await checkout(session.context,p.id)
 assertPending(removed,p,{gross:p.gross,discount:0,net:p.gross});assert.equal(billOf(removed,p.id).coupon_state,'released')
 check(true,'Removing coupon saves the same pending bill/gross/deadline and explicitly releases its hold')
 await editPending(page,p.gross);await page.getByTestId('booking-edit-coupon-'+p.id).getByRole('textbox').fill(p.couponCode)
 await page.getByTestId('booking-edit-coupon-'+p.id).getByRole('button',{name:'ใช้โค้ด',exact:true}).click()
 await expect(page.getByTestId('booking-edit-total')).toHaveText(money(p.net),{timeout:25000})
 await savePending(page,p.net);const reapplied=await checkout(session.context,p.id);assertPending(reapplied,p,p)
 assert.equal(billOf(reapplied,p.id).coupon_state,'reserved')
 check(true,'Reapplying coupon restores the authoritative discount/net as a reservation, with original bill and deadline unchanged')
 observations.pending={before,removed,reapplied}
 if(p.roundChange){
  const r=p.roundChange;assert.match(r.branchId,uuid);assert.ok(r.expectedNet>0)
  await editPending(page,p.net);await viewDate(page,r.date)
  const slot=page.getByTestId('booking-slot-'+r.date+'-'+r.branchId+'-'+r.start)
  await expect(slot).toBeEnabled();assert.notEqual(await slot.getAttribute('aria-pressed'),'true','roundChange must add a currently unselected round')
  await slot.click();await expect(page.getByTestId('booking-edit-total')).toHaveText(money(r.expectedNet),{timeout:25000})
  assertPending(await checkout(session.context,p.id),p,p)
  await savePending(page,r.expectedNet);const changed=await checkout(session.context,p.id)
  assertPending(changed,p,{gross:r.expectedGross,discount:r.expectedDiscount,net:r.expectedNet})
  assert.ok(changed.sessions.some(s=>s.booking_id===p.id&&s.date===r.date&&s.start_time.slice(0,5)===r.start&&s.end_time.slice(0,5)===r.end&&s.branch_id===r.branchId&&s.status==='scheduled'))
  assert.equal(billOf(changed,p.id).coupon_state,'reserved');observations.pending.changed=changed
  check(true,'Adding the requested round saves exact date/branch and recalculated gross/discount/net on the same pending bill without coupon consumption or deadline extension')
 }else unexecuted.push('Pending coupon recalculation after round change (roundChange fixture not supplied)')
 await responsive(page,'01-pending-coupon-summary')
}

try{
 const session=await open(customer,'/dashboard/lesson-wallet'),page=session.page
 await pendingFlow(session)
 await page.goto(base+'/dashboard/lesson-wallet',{waitUntil:'networkidle'});currentPage=page
 const initial=await inventory(session.context),before=await checkout(session.context,fixture.privateBillId)
 const issued=availableFor(initial,fixture.privateBillId);assert.equal(issued.length,fixture.remainingHoursBefore)
 assert.ok(issued.every(s=>s.course==='private'&&sameMembers(s.participants,[null])))
 assert.equal(billOf(before,fixture.privateBillId).status,'verified')
 const moneyBefore=moneyState(before,fixture.privateBillId);observations.privateBefore={inventory:initial,checkout:before}
 check(true,'Verified self-only paid Private fixture has the exact declared remaining hours before any use')
 assert.ok(Date.parse(target.date+'T'+target.start+':00+07:00')>Date.now(),'Private target must still be future before selection')
 await openPrivate(page);await chooseFamily(page);await viewDate(page,target.date)
 const slot=page.getByTestId('wallet-slot-'+target.date+'-'+fixture.branchId+'-'+target.start)
 await expect(slot).toBeEnabled();await slot.click()
 const selected=page.locator('div[data-testid^="wallet-pick-"]');await expect(selected).toHaveCount(1)
 const pickedId=(await selected.getAttribute('data-testid')).slice('wallet-pick-'.length)
 assert.ok(issued.some(s=>s.id===pickedId),'Selected hour must belong to the explicitly scoped Private bill')
 await expect(selected.getByTestId('wallet-pick-attendee-count')).toHaveText('Private 1 ชั่วโมง · 3 คน')
 for(const name of [customer.name,...customer.children.map(c=>c.name)])await expect(selected.getByTestId('wallet-pick-attendee-names')).toContainText(name)
 assert.equal(availableFor(await inventory(session.context),fixture.privateBillId).length,fixture.remainingHoursBefore)
 assert.deepEqual(moneyState(await checkout(session.context,fixture.privateBillId),fixture.privateBillId),moneyBefore)
 check(true,'One selected Private hour contains self and two owned children; draft selection has not spent rights or changed paid money')
 await page.getByTestId('wallet-review-use').click();await expect(page.getByRole('heading',{name:'สรุปใช้สิทธิ 1 รอบ',exact:true})).toBeVisible()
 await responsive(page,'02-one-hour-three-person-summary')
 const postIndex=traffic.length,response=page.waitForResponse(r=>new URL(r.url()).origin===base&&new URL(r.url()).pathname==='/api/booking-wallet'&&r.request().method()==='POST')
 await page.getByTestId('wallet-confirm-use').dblclick();const saved=await response,used=await saved.json();assert.equal(saved.status(),200)
 await expect(page.getByTestId('wallet-use-success')).toBeVisible({timeout:30000})
 const posts=traffic.slice(postIndex).filter(t=>t.actor===customer.id&&t.path==='/api/booking-wallet');assert.equal(posts.length,1)
 const body=posts[0].body;assert.equal(body.picks.length,1);assert.equal(body.picks[0].id,pickedId);assert.ok(sameMembers(body.picks[0].participants,family))
 assert.equal(used.used,1);assert.equal(used.sessionIds?.length,3)
 const after=await checkout(session.context,fixture.privateBillId),afterInventory=await inventory(session.context)
 assert.equal(availableFor(afterInventory,fixture.privateBillId).length,fixture.remainingHoursBefore-1)
 assert.deepEqual(moneyState(after,fixture.privateBillId),moneyBefore)
 const rows=after.sessions.filter(s=>used.sessionIds.includes(s.id));assert.equal(rows.length,3)
 assert.ok(sameMembers(rows.map(s=>s.child_id),family));assert.ok(rows.every(s=>s.booking_id===fixture.privateBillId&&s.date===target.date&&s.branch_id===fixture.branchId&&s.start_time.slice(0,5)===target.start&&s.end_time.slice(0,5)===target.end))
 observations.privateUse={request:body,response:used,checkout:after,inventory:afterInventory}
 check(true,'Actual double-click confirms one request/one spent hour and three exact same-slot learners; paid money/coupon/expiry remain unchanged')
 const replay=await requestJSON(session.context,'/api/booking-wallet',body);assert.equal(replay.status,200)
 assert.equal(availableFor(await inventory(session.context),fixture.privateBillId).length,fixture.remainingHoursBefore-1)
 const altered=await requestJSON(session.context,'/api/booking-wallet',{...body,picks:body.picks.map(p=>({...p,participants:[customer.children[0].id]}))});assert.equal(altered.status,409)
 assert.equal(availableFor(await inventory(session.context),fixture.privateBillId).length,fixture.remainingHoursBefore-1)
 check(true,'Same request replays without another hour; changing roster under its request ID is rejected')
 const history=await requestJSON(session.context,'/api/booking-wallet?historyOnly=1&historyFormat=2&month='+target.date.slice(0,7)+'&course=private')
 assert.equal(history.status,200);assert.ok(history.body.rows.some(r=>r.kind==='package'&&r.id===pickedId&&sameMembers(r.participants,family)))
 check(true,'Owned Wallet history records the three actual participants for the single consumed unit')
 const owned=await session.auth.from('booking_sessions').select('id,booking_id,schedule_slot_id,child_id').eq('booking_id',fixture.privateBillId).in('id',used.sessionIds)
 let slotId,slotEvidence
 if(!owned.error&&owned.data?.length===3){assert.ok(owned.data.every(s=>s.booking_id===fixture.privateBillId));const slots=[...new Set(owned.data.map(s=>s.schedule_slot_id))];assert.equal(slots.length,1);slotId=slots[0];slotEvidence={source:'authenticated-customer-RLS',rows:owned.data}}
 else{assert.match(target.slotId||'',uuid,'Customer slot lookup unavailable; primary-verified target.slotId required');slotId=target.slotId;slotEvidence={source:'primary-verified-fixture',errorCode:owned.error?.code||null};unexecuted.push('Authenticated customer schedule_slot_id readback unavailable; primary must corroborate exact returned session IDs and declared slot')}
 assert.match(slotId,uuid);observations.slotEvidence=slotEvidence
 const head=await open(staff.head,'/coach/assign-groups?month='+target.date.slice(0,7));currentPage=head.page
 const context=await requestJSON(head.context,'/api/coach/assignment-groups?scheduleSlotId='+slotId+'&branchId='+fixture.branchId);assert.equal(context.status,200)
 assert.deepEqual([...context.body.rosterSessionIds].sort(),[...used.sessionIds].sort())
 const assignment={scheduleSlotId:slotId,branchId:fixture.branchId,groups:[{name:'BOOKING-UX-2 QA '+randomUUID().slice(0,6),coachId:staff.coach.id,levelMin:0,levelMax:0,sortOrder:0,studentSessionIds:used.sessionIds}],expectedGroups:context.body.canonicalGroups,saveContext:context.body.saveContext,requestId:randomUUID(),deadline:new Date(Date.now()+20000).toISOString()}
 assert.equal((await requestJSON(head.context,'/api/coach/assignment-groups',{...assignment,prepare:true})).status,200)
 const assigned=await requestJSON(head.context,'/api/coach/assignment-groups',assignment);assert.equal(assigned.status,200);assert.equal(assigned.body.confirmed,true)
 observations.assignment={context:context.body,request:assignment,response:assigned.body}
 await head.page.reload({waitUntil:'networkidle'});await head.page.getByRole('button',{name:new RegExp('^'+escaped(target.start)+' - '+escaped(target.end))}).click()
 for(const name of [customer.name,...customer.children.map(c=>c.name)])await expect(head.page.getByText(name,{exact:true}).first()).toBeVisible()
 await expect(head.page.getByText('3 คน',{exact:true}).first()).toBeVisible();await snapshot(head.page,'03-head-coach-three-person-assignment')
 check(true,'Normal Head Coach signed prepare/save assigns all three exact session IDs and existing roster UI shows three names/count')
 const coach=await open(staff.coach,'/coach/today?date='+target.date);currentPage=coach.page
 for(const name of [customer.name,...customer.children.map(c=>c.name)])await expect(coach.page.getByText(name,{exact:true}).first()).toBeVisible()
 await expect(coach.page.getByText('3 คน',{exact:true}).first()).toBeVisible();await responsive(coach.page,'04-coach-full-roster')
 check(true,'Responsible coach teaching-day UI shows the complete actual three-person Private roster')
 const bangkokToday=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 assert.equal(target.date,bangkokToday,'Actual normal coach check-in requires today in Bangkok')
 assert.ok(Math.abs(Date.parse(target.date+'T'+target.start+':00+07:00')-Date.now())<=30*60000,'Actual coach check-in must be inside its normal ±30 minute window')
 const image=Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBXkAAAAASUVORK5CYII=','base64'),Buffer.from(randomUUID())])
 const checked=await coach.context.request.post(base+'/api/coach/checkin',{headers:protectionHeaders,multipart:{scheduleSlotId:slotId,lat:String(fixture.checkin?.lat??13.7563),lng:String(fixture.checkin?.lng??100.5018),photoSource:'camera_capture',photo:{name:'synthetic-booking-ux2-qa.png',mimeType:'image/png',buffer:image}}})
 const checkedBody=await checked.json();assert.equal(checked.status(),200,JSON.stringify(checkedBody));observations.checkin={status:checked.status(),body:checkedBody,syntheticPhotoAndCoordinates:true}
 check(true,'Normal authenticated check-in/storage API accepts synthetic QA photo/GPS inside the actual today/time window')
 await coach.page.goto(base+'/coach/attendance?date='+target.date+'&slot='+slotId,{waitUntil:'networkidle'})
 const attendanceCard=coach.page.locator('#attendance-slot-'+slotId);await expect(attendanceCard).toBeVisible()
 const expectedAttendance=[{id:customer.id,name:customer.name,type:'adult',status:'present',label:'มา'},
  {id:customer.children[0].id,name:customer.children[0].name,type:'child',status:'late',label:'สาย'},
  {id:customer.children[1].id,name:customer.children[1].name,type:'child',status:'absent',label:'ขาด'}]
 observations.attendance={expected:expectedAttendance.map(s=>({studentId:s.id,studentType:s.type,status:s.status,bookingSessionId:rows.find(row=>row.child_id===(s.type==='adult'?null:s.id)).id})),readbacks:[]}
 for(const[index,student]of expectedAttendance.entries()){
  const row=attendanceCard.locator('div.rounded-lg.bg-white.p-3').filter({has:coach.page.getByText(student.name,{exact:true})});await expect(row).toHaveCount(1)
  const response=coach.page.waitForResponse(r=>new URL(r.url()).origin===base&&new URL(r.url()).pathname==='/api/coach/attendance'&&r.request().method()==='POST')
  await row.getByRole('button',{name:student.label,exact:true}).click();const result=await response;assert.equal(result.status(),200)
  const sent=traffic.filter(t=>t.actor===staff.coach.id&&t.path==='/api/coach/attendance').at(-1)?.body
  assert.equal(sent.studentId,student.id);assert.equal(sent.studentType,student.type);assert.equal(sent.status,student.status)
  assert.equal(sent.bookingSessionId,rows.find(s=>s.child_id===(student.type==='adult'?null:student.id)).id)
  const readback=await coach.auth.from('attendance').select('booking_session_id,student_id,student_type,coach_id,status').in('booking_session_id',used.sessionIds)
  if(!readback.error){assert.equal(readback.data.length,index+1);assert.ok(readback.data.some(r=>r.student_id===student.id&&r.student_type===student.type&&r.coach_id===staff.coach.id&&r.status===student.status));observations.attendance.readbacks.push(readback.data)}
  else{observations.attendance.readbacks.push({unavailable:true,errorCode:readback.error.code||null});if(!unexecuted.includes('Direct authenticated attendance row readback; primary MCP corroboration required'))unexecuted.push('Direct authenticated attendance row readback; primary MCP corroboration required')}
  check(true,'Coach normal API independently records exact '+student.type+' '+student.status+' without bulk-marking other learners')
 }
 await snapshot(coach.page,'05-independent-attendance')
 const other=await open(staff.other,'/coach/today?date='+target.date);currentPage=other.page
 const denied=await requestJSON(other.context,'/api/coach/attendance',{bookingSessionId:used.sessionIds[0],studentId:rows.find(s=>s.id===used.sessionIds[0]).child_id||customer.id,studentType:rows.find(s=>s.id===used.sessionIds[0]).child_id?'child':'adult',status:'present'})
 assert.equal(denied.status,403);check(true,'Unassigned coach cannot mark any learner in the scoped Private hour')
 const final=await checkout(session.context,fixture.privateBillId);assert.deepEqual(moneyState(final,fixture.privateBillId),moneyBefore)
 assert.equal(availableFor(await inventory(session.context),fixture.privateBillId).length,fixture.remainingHoursBefore-1)
 check(errors.length===0&&egress.length===0,'Hosted customer/Head Coach/coach flows have no page exception or external egress')
 observations.finalCheckout=final
 const result={pass:true,...inputs,checks,unexecuted,errors,egress,traffic,observations,
  primaryDatabaseCorroborationRequired:true,exactSessionIds:used.sessionIds,slotId,spentUnitId:pickedId,
  expectedRemainingHours:fixture.remainingHoursBefore-1,
  limitations:['Normal APIs used; synthetic photo/GPS is not hardware/location verification','TEST MODE is not live bank verification','Positive payment/coupon settlement tests and full schema/data reconciliation are separate primary evidence']}
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({root,passed:checks.length,unexecuted:unexecuted.length,requiresPrimaryDatabaseCorroboration:true}))
}catch(error){
 await currentPage?.screenshot({path:path.join(root,'failure.png'),fullPage:true}).catch(()=>{})
 fs.writeFileSync(path.join(root,'failure.json'),JSON.stringify({...inputs,checks,unexecuted,errors,egress,traffic,observations,error:String(error),stack:error.stack,body:await currentPage?.locator('body').innerText().catch(()=>null)},null,2));throw error
}finally{for(const session of opened){await session.context.close().catch(()=>{});await session.browser.close().catch(()=>{})}}
