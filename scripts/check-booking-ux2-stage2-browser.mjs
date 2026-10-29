import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {expect} from '@playwright/test'
import {run,env,sql,q,fixtures} from '../tests/booking-ux/runtime.mjs'
import {adminBrowser} from '../tests/booking-ux/browser.mjs'

// Primary-executed acceptance only. Every write uses the imported physical
// disposable guard. Network fault fixtures delay/drop REAL upstream responses;
// they never manufacture a financial quote, save or verification response.
const base=process.env.BOOKING_UX2_BASE||'http://127.0.0.1:3150'
assert.match(base,/^http:\/\/127\.0\.0\.1:315[0-3]$/)
const runtimeFile=process.env.BOOKING_UX2_RUNTIME||'.playwright/booking-ux-1/app-runtime.json'
const runtime=JSON.parse(fs.readFileSync(runtimeFile,'utf8'))
assert.equal(runtime.port,Number(new URL(base).port),'Exact tested app listener required')
assert.equal(runtime.api,env.apiUrl,'App must use the physically guarded disposable API')
const binding=JSON.parse(fs.readFileSync(path.join(runtime.app,'.next/booking-ux-1-local-build.json'),'utf8'))
assert.equal(binding.runId,run.runId);assert.equal(binding.api,env.apiUrl)
assert.equal(binding.buildId,fs.readFileSync(path.join(runtime.app,'.next/BUILD_ID'),'utf8').trim())
const sourceManifest=JSON.parse(fs.readFileSync(path.join(runtime.app,'source-manifest.json'),'utf8'))
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex')
for(const [file,hash] of Object.entries(sourceManifest.hashes)){
 if(/^(src\/|public\/|supabase\/migrations\/|package(?:-lock)?\.json$|next\.config)/.test(file))assert.equal(sha(file),hash,'Built source differs: '+file)
}
const f=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json'),'utf8'))
const root=path.resolve('.playwright/booking-ux-2/revision-stage2-20261029/browser-'+Date.now()+'-'+randomUUID().slice(0,8))
fs.mkdirSync(root,{recursive:true})
const checks=[],errors=[],egress=[],sessions=[],actors=[],bills=[],traffic=[],networkFaults=[]
const check=(condition,name)=>{assert.ok(condition,name);checks.push(name);console.log(name)}
const read=statement=>JSON.parse(sql(statement))
const branchName=sql(`SELECT name FROM branches WHERE id=${q(f.branch)}`)
const escaped=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const state=id=>read(`SELECT jsonb_build_object('bill',to_jsonb(b),'hold',(SELECT to_jsonb(r) FROM progressive_coupon_reservations r WHERE booking_id=b.id),'sessions',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]'::jsonb) FROM booking_sessions s WHERE s.booking_id=b.id),'uses',(SELECT count(*) FROM coupon_usages WHERE booking_id=b.id),'units',(SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.ordinal),'[]'::jsonb) FROM booking_package_units u WHERE u.booking_id=b.id),'changes',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.created_at,c.id),'[]'::jsonb) FROM booking_ux_coupon_changes c WHERE c.booking_id=b.id)) FROM bookings b WHERE b.id=${q(id)}`)
const actorBillCount=actor=>Number(sql(`SELECT count(*) FROM bookings WHERE user_id=${q(actor.id)}`))
const beforeSchema=read("SELECT jsonb_build_object('migrations',(SELECT jsonb_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations),'functions',(SELECT jsonb_object_agg(p.proname,md5(pg_get_functiondef(p.oid))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('booking_ux_edit_set_v1','booking_ux_coupon_choice_v3','booking_ux_coupon_quote_v2','booking_ux_coupon_reprice_v2')))")
const helpers=['tests/booking-ux/runtime.mjs','tests/booking-ux/browser.mjs','tests/branch-closure/isolated-runtime.mjs','tests/branch-closure/fixtures.mjs','scripts/verify-lesson-source-test-target.mjs']
const evidence={base,target:run.target,runId:run.runId,runtime,binding,testDefinitionSha256:sha(import.meta.filename),helperHashes:Object.fromEntries(helpers.map(file=>[file,sha(file)])),schema:beforeSchema}
fs.writeFileSync(path.join(root,'inputs.json'),JSON.stringify(evidence,null,2))
const newActor=async label=>{const actor=await fixtures.account('user',label);actors.push(actor);return actor}
const newCoupon=(type,value,min=0)=>{
 const coupon={id:randomUUID(),code:'UX2STAGE'+randomUUID().slice(0,8).toUpperCase()}
 sql(`INSERT INTO coupons(id,code,discount_type,discount_value,min_purchase,max_uses,created_by) VALUES(${q(coupon.id)},${q(coupon.code)},${q(type)},${value},${min},1,${q(f.sa.id)})`)
 return coupon
}
const open=async actor=>{
 const session=await adminBrowser(base,actor);sessions.push(session)
 session.page.on('pageerror',error=>errors.push(error.message))
 await session.context.route('**/*',route=>{
  const url=new URL(route.request().url())
  if(['data:','blob:'].includes(url.protocol))return route.fallback()
  if(![new URL(base).host,new URL(env.apiUrl).host].includes(url.host)){egress.push(url.host);return route.abort()}
  return route.fallback()
 })
 session.page.on('request',request=>{
  if(new URL(request.url()).pathname==='/api/booking-checkout'&&request.method()==='POST'){
   const body=request.postDataJSON();traffic.push({actor:actor.id,action:body?.action,preview:body?.preview===true,requestId:body?.requestId,inputAction:body?.input?.action})
  }
 })
 return session
}
const snap=async(page,name)=>{
 await page.evaluate(async()=>{window.scrollTo({top:0,left:0,behavior:'instant'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})
 await page.screenshot({path:path.join(root,name+'.png'),fullPage:true})
}
const responsive=async(page,label)=>{
 for(const width of [320,390,1280]){
  await page.setViewportSize({width,height:width===1280?900:844})
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' has no horizontal overflow at '+width)
  await snap(page,label+'-'+width)
 }
 await page.setViewportSize({width:390,height:844})
}
const choose=async(page,title,names)=>{
 await page.getByRole('button',{name:'เปลี่ยน'+title,exact:true}).click()
 const dialog=page.getByRole('dialog')
 await expect(dialog.getByRole('heading',{name:'เลือก'+title,exact:true})).toBeVisible()
 for(const checkbox of await dialog.getByRole('checkbox').all())await checkbox.uncheck()
 const search=dialog.getByRole('textbox',{name:'ค้นหา'+title,exact:true})
 for(const name of names){if(await search.count())await search.fill(name);await dialog.getByRole('checkbox',{name:new RegExp(escaped(name))}).check()}
 await dialog.getByRole('button',{name:new RegExp('^ใช้'+title+'ที่เลือก')}).click()
 await expect(dialog).toHaveCount(0)
}
const viewDate=async(page,date)=>{
 await expect(page.getByTestId('booking-calendar')).toBeVisible({timeout:20000})
 for(let attempt=0;attempt<12&&!await page.getByTestId('booking-date-'+date).count();attempt++){
  const first=page.locator('[data-testid^="booking-date-"]').first(),prior=await first.getAttribute('data-testid')
  await page.getByRole('button',{name:'เดือนถัดไป',exact:true}).click();await expect(first).not.toHaveAttribute('data-testid',prior)
 }
 await expect(page.getByTestId('booking-date-'+date)).toBeEnabled({timeout:20000})
}
const toggle=async(page,date)=>{
 await viewDate(page,date);await page.getByTestId('booking-date-'+date).click()
 const slot=page.getByTestId(`booking-slot-${date}-${f.branch}-10:00`)
 await expect(slot).toBeEnabled({timeout:20000});await slot.click()
}
const useCreateCoupon=async(page,coupon,net)=>{
 await page.getByLabel('รหัสส่วนลด',{exact:true}).fill(coupon.code);await page.getByRole('button',{name:'ใช้โค้ด',exact:true}).click()
 await expect(page.getByTestId('booking-step4-total')).toHaveText('฿'+net.toLocaleString(),{timeout:20000})
}
const confirm=async(page,actor,net)=>{
 const start=traffic.length
 await page.getByTestId('booking-confirm').click()
 await page.waitForURL(url=>Boolean(url.searchParams.get('payment')),{timeout:25000})
 await expect(page.getByTestId('payment-countdown')).toBeVisible({timeout:25000})
 const id=new URL(page.url()).searchParams.get('payment');bills.push(id)
 await expect(page.getByTestId('payment-net-total')).toHaveText('฿'+net.toLocaleString())
 check(traffic.slice(start).filter(t=>t.actor===actor.id&&t.action==='create').length===1&&actorBillCount(actor)===1,'One normal stage2 confirmation creates exactly one actual payment bill')
 return id
}
const edit=async(page,net)=>{
 await expect(page.getByTestId('pending-payment-entry')).toBeVisible({timeout:20000})
 await page.getByRole('button',{name:'แก้ไขวันเรียน / คูปอง',exact:true}).click()
 await expect(page.getByTestId('booking-stage2-editor')).toBeVisible({timeout:20000})
 await expect(page.getByTestId('booking-calendar')).toBeVisible()
 await expect(page.getByTestId('pending-payment-entry')).not.toBeVisible()
 await expect(page.getByTestId('booking-edit-summary')).toHaveCount(0)
 await expect(page.getByRole('heading',{name:'สรุปการจอง',exact:true})).toHaveCount(0)
 await expect(page.getByTestId('booking-edit-total')).toHaveText('฿'+net.toLocaleString(),{timeout:25000})
}
const editCoupon=(page,id)=>page.getByTestId('booking-edit-coupon-'+id)
const applyEditCode=async(page,id,code)=>{
 const section=editCoupon(page,id)
 await section.getByRole('textbox').fill(code);await section.getByRole('button',{name:'ใช้โค้ด',exact:true}).click()
}
const pay=async(page,name)=>{
 await expect(page.getByTestId('payment-transfer-card')).toBeVisible({timeout:20000})
 await page.getByLabel('รูปสลิปการโอนเงิน',{exact:true}).setInputFiles({name:name+'.png',mimeType:'image/png',buffer:Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBXkAAAAASUVORK5CYII=','base64'),Buffer.from(randomUUID())])})
 await expect(page.getByAltText('ภาพตัวอย่างสลิปที่เลือก ยังไม่ได้ส่ง')).toBeVisible()
 await page.getByRole('button',{name:/3\. ส่งสลิปยืนยันการชำระเงิน/}).click()
 await expect(page.getByRole('heading',{name:/^(ชำระเงินสำเร็จ|ยืนยันการจองแล้ว)$/})).toBeVisible({timeout:30000})
}
const bounded=async(promise,label)=>{
 let timer
 try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Timed out: '+label)),25000)})])}
 finally{clearTimeout(timer)}
}

let currentPage,kidsId,familyId
try{
 const actor=await newActor('ตรวจรับขั้น2 เด็ก'),child=randomUUID(),childName='ผู้เรียนสมมติขั้น2 เด็ก'
 sql(`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(child)},${q(actor.id)},${q(childName)},'น้องขั้น2')`)
 const fixed=newCoupon('fixed',500,1200),session=await open(actor),page=session.page;currentPage=page
 const offset=Number(process.env.BOOKING_UX2_KIDS_DAY_OFFSET||5)
 assert.ok(Number.isInteger(offset)&&offset>=0&&offset<=20)
 const dates=read(`SELECT jsonb_agg((date_trunc('month',clock_timestamp() AT TIME ZONE 'Asia/Bangkok')+interval '1 month'+make_interval(days=>n))::date ORDER BY n) FROM generate_series(${offset},${offset+2})n`)
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/dashboard/booking',{waitUntil:'networkidle'})
 await page.getByText('เด็ก (กลุ่ม)',{exact:true}).first().click();await page.getByTestId('booking-next').click()
 await choose(page,'สาขา',[branchName]);for(const date of dates)await toggle(page,date)
 await expect(page.getByTestId('booking-step4-total')).toHaveText('฿1,875',{timeout:20000})
 await useCreateCoupon(page,fixed,1375);await expect(page.getByRole('heading',{name:'สรุปการจอง',exact:true})).toHaveCount(0)
 check(sql(`SELECT count(*) FROM progressive_coupon_reservations WHERE user_id=${q(actor.id)}`)==='0','Kids normal stage2 quote is1875−500=1375 without reserving or consuming')
 await snap(page,'01-kids-create-stage2')
 kidsId=await confirm(page,actor,1375);const original=state(kidsId)
 check(original.sessions.length===3&&original.sessions.every(s=>s.child_id===child)&&original.hold.status==='reserved'&&original.uses===0,'Pending Kids original has three exact-learner rounds and one unconsumed reserved coupon')
 await edit(page,1375);await toggle(page,dates[1]);await toggle(page,dates[2])
 await expect(page.getByTestId('booking-edit-coupon-warning')).toBeVisible({timeout:25000})
 await expect(page.getByTestId('booking-edit-total')).toHaveText('฿700')
 await expect(page.getByTestId('booking-edit-save')).toBeDisabled()
 check(JSON.stringify(state(kidsId))===JSON.stringify(original),'Below-min inline preview leaves original bill/sessions/reservation/audit exactly unchanged')
 await responsive(page,'02-kids-inline-warning')
 await page.getByRole('button',{name:'กลับโดยไม่บันทึก',exact:true}).click();await expect(page.getByTestId('payment-net-total')).toHaveText('฿1,375')
 check(JSON.stringify(state(kidsId))===JSON.stringify(original),'Back without saving preserves original1375 bill,3rounds,coupon and deadline exactly')
 await edit(page,1375);await toggle(page,dates[1]);await toggle(page,dates[2])
 await expect(page.getByTestId('booking-edit-coupon-warning')).toBeVisible({timeout:25000})
 await editCoupon(page,kidsId).getByRole('button',{name:'ไม่ใช้คูปอง',exact:true}).click()
 await expect(page.getByTestId('booking-edit-coupon-warning')).toHaveCount(0)
 await expect(page.getByTestId('booking-edit-total')).toHaveText('฿700',{timeout:25000})
 await expect(page.getByTestId('booking-edit-save')).toBeEnabled()
 check(JSON.stringify(state(kidsId))===JSON.stringify(original),'Choosing removal in draft still neither releases the real hold nor writes rounds')
 const beforeSave=traffic.length
 await page.getByTestId('booking-edit-save').dblclick()
 await expect(page.getByTestId('booking-stage2-editor')).toHaveCount(0,{timeout:25000})
 await expect(page.getByTestId('payment-net-total')).toHaveText('฿700')
 const edited=state(kidsId)
 check(traffic.slice(beforeSave).filter(t=>t.actor===actor.id&&t.action==='set'&&!t.preview&&t.inputAction==='edit').length===1&&actorBillCount(actor)===1,'Double click sends one edit save and creates no second bill')
 check(edited.bill.id===original.bill.id&&edited.bill.checkout_deadline===original.bill.checkout_deadline&&edited.sessions.filter(s=>s.status==='scheduled').length===1&&edited.sessions.filter(s=>s.status==='scheduled')[0].child_id===child&&Number(edited.bill.total_price)===700&&edited.hold.status==='released','One save returns actual stage3 with original bill/deadline,one exact round,700 and released coupon')
 await snap(page,'03-kids-payment-after-remove');await pay(page,'stage2-kids-local')
 const paidKids=state(kidsId)
 check(paidKids.bill.status==='verified'&&Number(paidKids.bill.total_price)===700&&paidKids.hold.status==='released'&&paidKids.uses===0,'Actual Local TEST PNG settles700 and never consumes the removed Kids coupon')
 check(paidKids.bill.checkout_deadline===original.bill.checkout_deadline&&paidKids.sessions.filter(s=>s.status==='scheduled').every(s=>s.child_id===child),'Kids verification keeps original deadline and learner identity')
 await snap(page,'04-kids-payment-verified')

 const family=await newActor('ตรวจรับขั้น2 ครอบครัว'),familyChild=randomUUID(),familyChildName='ผู้เรียนสมมติขั้น2 ครอบครัว'
 sql(`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(familyChild)},${q(family.id)},${q(familyChildName)},'น้องขั้น2 Family')`)
 const percent=newCoupon('percent',10),alternate=newCoupon('fixed',500),familySession=await open(family),familyPage=familySession.page;currentPage=familyPage
 const parentName=sql(`SELECT full_name FROM profiles WHERE id=${q(family.id)}`)
 await familyPage.setViewportSize({width:390,height:844});await familyPage.goto(base+'/dashboard/booking',{waitUntil:'networkidle'})
 await familyPage.getByText('Private',{exact:true}).first().click();await familyPage.getByTestId('package-private-10').click();await familyPage.getByTestId('booking-next').click()
 await choose(familyPage,'ผู้เรียน',[parentName,familyChildName]);await choose(familyPage,'สาขา',[branchName])
 await expect(familyPage.getByTestId('booking-step4-total')).toHaveText('฿8,000',{timeout:20000});await useCreateCoupon(familyPage,percent,7200)
 familyId=await confirm(familyPage,family,7200);const familyOriginal=state(familyId)
 assert.equal(familyOriginal.sessions.length,0);assert.equal(familyOriginal.units.length,0)
 assert.deepEqual(new Set(familyOriginal.bill.package_participants),new Set([null,familyChild]))
 await edit(familyPage,7200)
 await editCoupon(familyPage,familyId).getByRole('button',{name:'ไม่ใช้คูปอง',exact:true}).click();await expect(familyPage.getByTestId('booking-edit-total')).toHaveText('฿8,000',{timeout:25000})
 check(JSON.stringify(state(familyId))===JSON.stringify(familyOriginal),'Voluntary Private coupon removal without changing dates previews full8000 without touching original bill/hold')
 await editCoupon(familyPage,familyId).getByRole('button',{name:'คืนคูปองเดิม',exact:true}).click();await expect(familyPage.getByTestId('booking-edit-total')).toHaveText('฿7,200',{timeout:25000})
 check(JSON.stringify(state(familyId))===JSON.stringify(familyOriginal),'Undo before save retains the original percent coupon and issued terms')
 await applyEditCode(familyPage,familyId,'INVALID'+randomUUID().slice(0,8))
 await expect(familyPage.getByTestId('booking-stage2-editor').getByRole('alert').filter({hasText:'ไม่พบคูปอง'})).toBeVisible({timeout:25000});await expect(familyPage.getByTestId('booking-calendar')).toBeVisible();await expect(familyPage.getByTestId('booking-edit-save')).toBeDisabled()
 check(JSON.stringify(state(familyId))===JSON.stringify(familyOriginal),'Invalid replacement keeps original7200 bill,Family and coupon unchanged while calendar remains editable')
 await editCoupon(familyPage,familyId).getByRole('button',{name:'คืนคูปองเดิม',exact:true}).click();await expect(familyPage.getByTestId('booking-edit-total')).toHaveText('฿7,200',{timeout:25000})

 // Let an actual removal quote reach the server, hold its response delivery,
 // then request an alternate coupon and deliver that genuine response first.
 let delayedReadyResolve,releaseDelayed,delayedDoneResolve,heldResponse=false
 const delayedReady=new Promise(resolve=>{delayedReadyResolve=resolve}),deliveryGate=new Promise(resolve=>{releaseDelayed=resolve}),delayedDone=new Promise(resolve=>{delayedDoneResolve=resolve})
 const delayHandler=async route=>{
  const request=route.request(),body=request.method()==='POST'?request.postDataJSON():null
  if(body?.action!=='set'||!body.preview||heldResponse||body.input?.couponChanges?.find(c=>c.bookingId===familyId)?.action!=='remove')return route.fallback()
  heldResponse=true
  try{
   const response=await route.fetch();assert.ok(response.ok(),'Delayed real removal quote must succeed upstream')
   delayedReadyResolve();await deliveryGate
   try{await route.fulfill({response})}catch(error){networkFaults.push({kind:'superseded-real-preview-delivery',message:String(error)})}
  }catch(error){networkFaults.push({kind:'preview-upstream-error',message:String(error)});delayedReadyResolve()}
  finally{delayedDoneResolve()}
 }
 await familyPage.route('**/api/booking-checkout',delayHandler)
 await editCoupon(familyPage,familyId).getByRole('button',{name:'ไม่ใช้คูปอง',exact:true}).click();await bounded(delayedReady,'upstream removal quote')
 await applyEditCode(familyPage,familyId,alternate.code)
 await expect(familyPage.getByTestId('booking-edit-total')).toHaveText('฿7,500',{timeout:25000})
 releaseDelayed();await bounded(delayedDone,'delayed genuine quote delivery');await familyPage.unroute('**/api/booking-checkout',delayHandler)
 await expect(familyPage.getByTestId('booking-edit-total')).toHaveText('฿7,500');await expect(familyPage.getByTestId('booking-edit-save')).toBeEnabled()
 check(heldResponse&&!networkFaults.some(f=>f.kind==='preview-upstream-error')&&JSON.stringify(state(familyId))===JSON.stringify(familyOriginal),'Later genuine7500 quote wins over delayed older8000 response; all previews roll back actual data')
 await responsive(familyPage,'05-private-inline-coupon-swap')

 // Commit the actual authoritative save, then drop only its browser response.
 // The UI must recover the original request, rather than issue another save.
 let lostResponse=null
 const loseHandler=async route=>{
  const request=route.request(),body=request.method()==='POST'?request.postDataJSON():null
  if(body?.action!=='set'||body.preview||body.input?.action!=='edit')return route.fallback()
  try{
   const response=await route.fetch(),result=await response.json()
   assert.ok(response.ok()&&result.success,'Lost-response fixture must first commit a real successful save')
   lostResponse={requestId:body.requestId,status:response.status(),total:result.total}
   await route.abort('connectionfailed')
  }catch(error){networkFaults.push({kind:'save-upstream-error',message:String(error)});await route.abort('failed').catch(()=>{})}
 }
 await familyPage.route('**/api/booking-checkout',loseHandler)
 const priorLostSave=traffic.length
 await familyPage.getByTestId('booking-edit-save').click();await expect(familyPage.getByRole('button',{name:'ตรวจผลคำขอเดิม',exact:true})).toBeVisible({timeout:25000})
 check(lostResponse?.status===200&&lostResponse.total===7500&&state(familyId).hold.coupon_id===alternate.id&&state(familyId).hold.status==='reserved','Lost-response fixture commits real7500 swap but leaves usage unconsumed')
 await familyPage.getByRole('button',{name:'ตรวจผลคำขอเดิม',exact:true}).click();await expect(familyPage.getByTestId('payment-net-total')).toHaveText('฿7,500',{timeout:25000})
 await expect(familyPage.getByTestId('booking-stage2-editor')).toHaveCount(0);await familyPage.unroute('**/api/booking-checkout',loseHandler)
 const familyEdited=state(familyId)
 check(traffic.slice(priorLostSave).filter(t=>t.actor===family.id&&t.action==='set'&&!t.preview&&t.inputAction==='edit').length===1&&actorBillCount(family)===1,'Readback recovers committed save from lost response without another save or duplicate bill')
 check(familyEdited.bill.id===familyOriginal.bill.id&&familyEdited.bill.checkout_deadline===familyOriginal.bill.checkout_deadline&&familyEdited.sessions.length===0&&familyEdited.units.length===0,'Coupon-only edit preserves original bill/deadline,zero scheduled rounds and no unpaid units')
 check(familyEdited.changes.some(c=>c.before_state?.coupon_id===percent.id&&c.after_state?.status==='released')&&familyEdited.uses===0,'Original held percent coupon is released with append-only evidence; no Legacy usage manufactured')
 await familyPage.goto(base+'/dashboard/booking?editBookingId='+familyId,{waitUntil:'networkidle'})
 await expect(familyPage.getByTestId('booking-stage2-editor')).toBeVisible({timeout:20000});await expect(familyPage.getByTestId('booking-calendar')).toBeVisible()
 await expect(familyPage.getByTestId('booking-edit-total')).toHaveText('฿7,500',{timeout:25000});await expect(familyPage.getByTestId('booking-edit-summary')).toHaveCount(0)
 check(new URL(familyPage.url()).searchParams.get('payment')===familyId&&new URL(familyPage.url()).searchParams.get('edit')==='1','Old editBookingId link routes to the same stage2 editor for the original bill')
 await familyPage.getByRole('button',{name:'กลับโดยไม่บันทึก',exact:true}).click();await expect(familyPage.getByTestId('payment-net-total')).toHaveText('฿7,500')
 await pay(familyPage,'stage2-family-local');const familyPaid=state(familyId)
 check(familyPaid.bill.status==='verified'&&Number(familyPaid.bill.total_price)===7500&&familyPaid.hold.coupon_id===alternate.id&&familyPaid.hold.status==='consumed','Actual Local Family PNG settles7500 and consumes only the new fixed coupon')
 check(sql(`SELECT count(*) FROM progressive_coupon_reservations WHERE coupon_id=${q(percent.id)} AND status IN ('reserved','consumed')`)==='0'&&sql(`SELECT count(*) FROM coupon_usages WHERE coupon_id=${q(percent.id)}`)==='0','Old percent code has no active/consumed reservation or Legacy usage after replacement payment')
 check(familyPaid.units.length===10&&familyPaid.units.every(unit=>JSON.stringify(unit.participants)===JSON.stringify(familyOriginal.bill.package_participants))&&familyPaid.bill.checkout_deadline===familyOriginal.bill.checkout_deadline,'Ten paid Family units retain every original participant and the original deadline')
 await familyPage.reload({waitUntil:'networkidle'});check(state(familyId).units.length===10&&state(familyId).hold.status==='consumed','Reload does not repeat coupon consumption or grant extra Family units')
 await responsive(familyPage,'06-private-family-payment-success')
 check(errors.length===0&&egress.length===0&&!networkFaults.some(f=>f.kind==='save-upstream-error'),'No page exceptions, external egress or upstream financial fixture failures')
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify({pass:true,...evidence,checks,actors:actors.map(a=>a.id),bills,traffic,lostResponse,networkFaults,errors,egress},null,2))
 console.log(JSON.stringify({root,passed:checks.length}))
}catch(error){
 await currentPage?.screenshot({path:path.join(root,'failure.png'),fullPage:true}).catch(()=>{})
 fs.writeFileSync(path.join(root,'failure.json'),JSON.stringify({...evidence,checks,error:String(error),stack:error.stack,actors:actors.map(a=>a.id),bills,kidsId,familyId,traffic,networkFaults,errors,egress,body:await currentPage?.locator('body').innerText().catch(()=>null)},null,2))
 throw error
}finally{
 for(const session of sessions){await session.context.close();await session.browser.close()}
}
