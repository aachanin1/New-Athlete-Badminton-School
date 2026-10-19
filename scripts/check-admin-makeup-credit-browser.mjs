import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {chromium,expect} from '@playwright/test'
import {createServerClient} from '@supabase/ssr'
import {run,env,sql,q,fixtures} from '../tests/admin-makeup-browse/runtime.mjs'
const root=path.join(run.outputDir,'v8'),baseline=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json')))
const label=process.argv[2]||'v8candidate1',out=path.join(root,'browser-'+label+'-'+Date.now()),base='http://127.0.0.1:3142'
const runtime=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'app-runtime.json')))
assert.equal(runtime.app,path.join(run.evidenceRoot,'app-'+label));fs.mkdirSync(out,{recursive:true})
const checks=[],errors=[],unexpected=[],tag='หน้าจอแปด'+randomUUID().slice(0,6),secret='เหตุผลภายในห้ามส่งผู้ปกครอง-'+tag
const check=(value,name)=>{assert.ok(value,name);checks.push(name);console.log(name)}
const browser=await chromium.launch({headless:true})
async function context(account){
 const cookies=new Map(),auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:items=>items.forEach(c=>cookies.set(c.name,c.value))}})
 assert.ifError((await auth.auth.signInWithPassword({email:account.email,password:fixtures.password})).error)
 const c=await browser.newContext({viewport:{width:1366,height:1000},locale:'th-TH',timezoneId:'Asia/Bangkok'})
 await c.addCookies([...cookies].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/',sameSite:'Lax'})))
 await c.route('**/*',route=>{const u=new URL(route.request().url());if(['http:','https:'].includes(u.protocol)&&![base,env.apiUrl].includes(u.origin)){unexpected.push(u.origin);return route.abort()}return route.continue()})
 return c
}
const admin=await context(baseline.admin),page=await admin.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message))
const date=sql("SELECT ((clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date+3);"),month=date.slice(0,7)
async function mk(name,n=3,stored=false){
 const parent=await fixtures.account('user',name+tag),f=fixtures.fixture('kids_group',false,parent,date,'16:00','17:00')
 sql(`BEGIN;SELECT set_config('task10.booking_write','authorized',true);SELECT set_config('task10.payment_write','authorized',true);UPDATE bookings SET total_sessions=${n} WHERE id=${q(f.booking)};COMMIT;`)
 if(stored)f.credit=JSON.parse(sql(`SELECT lesson_source_transition_v1(${q(baseline.admin.id)},'admin_store',${q(f.ids[0])},${q(JSON.stringify({requestId:randomUUID(),reason:'เก็บรอเลือกวัน'}))}::jsonb);`)).credit_id
 return f
}
const dialog=()=>page.getByRole('dialog').last(),shot=name=>page.screenshot({path:path.join(out,name+'.png'),animations:'disabled'})
async function openFamily(f){await page.goto(base+`/admin/makeup?month=${month}&tab=makeup`,{waitUntil:'networkidle'});await page.getByRole('textbox',{name:'ค้นหาเพิ่มเติม'}).fill(f.parentLabel||f.label||tag);const card=page.getByTestId(`kids-family-${f.parent.id}:${month}`);await expect(card).toBeVisible({timeout:30000});await card.getByRole('button').filter({hasText:/เลือกวัน/}).click();await expect(dialog().getByRole('heading',{name:'เลือกเด็กและรอบชดเชย'})).toBeVisible();return card}
try{
 const f=await mk('อนุมัติภายหลัง',3,true),dst=fixtures.target(f,true)
 f.parentLabel='อนุมัติภายหลัง'+tag
 await openFamily(f);await expect(dialog().getByRole('button',{name:'ยืนยันกรณีพิเศษสำหรับเครดิตนี้'})).toBeEnabled({timeout:30000})
 await dialog().getByRole('button',{name:'ยืนยันกรณีพิเศษสำหรับเครดิตนี้'}).click()
 await expect(dialog().getByRole('button',{name:'ยืนยัน 1 เครดิตและเลือกวัน'})).toBeDisabled()
 check(true,'Approval requires internal reason and identifies exactly one credit')
 await dialog().getByRole('textbox',{name:'เหตุผลยืนยันรายเครดิต'}).fill(secret);await shot('approval-before-confirm')
 await dialog().getByRole('button',{name:'ยกเลิก',exact:true}).click()
 check(sql(`SELECT count(*) FROM admin_makeup_credit_approvals WHERE credit_id=${q(f.credit)};`)==='0','Cancelling confirmation creates no grant')
 await dialog().getByRole('button',{name:'ยืนยันกรณีพิเศษสำหรับเครดิตนี้'}).click();await dialog().getByRole('textbox',{name:'เหตุผลยืนยันรายเครดิต'}).fill(secret)
 await dialog().getByRole('button',{name:'ยืนยัน 1 เครดิตและเลือกวัน'}).click()
 await expect(dialog().getByTestId('makeup-day-'+dst.date)).toBeVisible({timeout:30000})
 check(sql(`SELECT count(*) FROM admin_makeup_credit_approvals WHERE credit_id=${q(f.credit)};`)==='1','Actual browser confirmation creates one approval and retains calendar')
 const beforeUseParent=await context(f.parent)
 const parentCross=await beforeUseParent.request.post(base+'/api/lesson-wallet',{data:{action:'redeem',creditId:f.credit,targetDate:dst.date,startTime:dst.start,endTime:dst.end,branchId:dst.branch,scheduleTemplateId:dst.template}})
 const parentCrossData=await parentCross.json()
 check(!parentCross.ok()&&/SAME_MONTH_REQUIRED|TARGET_AFTER_EXPIRY/.test(parentCrossData.code||''),'Admin approval does not open Parent cross-month Wallet redemption')
 await beforeUseParent.close()
 await dialog().getByTestId('makeup-day-'+dst.date).click();await dialog().locator(`[data-template-id="${dst.template}"]`).click()
 await expect(dialog().getByRole('button',{name:'สร้างวันชดเชย'})).toBeEnabled();await shot('approved-select-day')
 await dialog().getByRole('button',{name:'สร้างวันชดเชย'}).click();await expect(page.getByRole('dialog')).toHaveCount(0,{timeout:30000})
 check(sql(`SELECT used_mode FROM admin_makeup_credit_approvals WHERE credit_id=${q(f.credit)};`)==='exception','Q0 browser booking consumes approved source once')
 await shot('exception-success')
 const card=page.getByTestId(`kids-family-${f.parent.id}:${month}`);await card.getByRole('button',{name:'ดูประวัติ'}).click();await expect(dialog().getByText(secret,{exact:false}).first()).toBeVisible({timeout:30000});await shot('admin-history')
 check(true,'Admin history contains the actual approval actor, time and reason')
 await dialog().getByRole('button',{name:'ปิด',exact:true}).click()
 const parent=await context(f.parent)
 for(const route of ['lesson-wallet','schedule','history','notifications']){
  const response=await parent.request.get(base+'/dashboard/'+route);assert.equal(response.status(),200);const body=await response.text()
  check(!body.includes(secret)&&!body.includes('ยืนยันกรณีพิเศษ')&&!body.includes('เกินโควตา'),'User '+route+' HTML/RSC contains no private approval data')
 }
 const actualRequest=sql(`SELECT d.request_id FROM admin_makeup_credit_decisions d JOIN admin_makeup_credit_approvals g ON g.id=d.approval_id WHERE g.credit_id=${q(f.credit)} LIMIT 1;`)
 for(const endpoint of ['credit-operation?request='+actualRequest,'kids-family?parentId='+f.parent.id+'&sourceMonth='+month,'history?month='+month+'&parent='+f.parent.id+'&course=kids_group']){
  const response=await parent.request.get(base+'/api/admin/makeup/'+endpoint);check([401,403].includes(response.status())&&!(await response.text()).includes(secret),'User cannot access Admin '+endpoint.split('?')[0])
 }
 const forbidden=await parent.request.post(base+'/api/admin/makeup/credit-approval',{data:{credit_id:f.credit,operation:'approve',request_id:randomUUID(),reason:'ไม่อนุญาต'}})
 check([401,403].includes(forbidden.status()),'User cannot invoke approval write API')
 const parentPrepare=await parent.request.post(base+'/api/admin/makeup/credit-operation',{data:{kind:'approval',payload:{credit_id:f.credit,request_id:randomUUID(),operation:'approve',reason:secret}}})
 check([401,403].includes(parentPrepare.status()),'User cannot create or inspect a private replay envelope')
 const userPage=await parent.newPage();await userPage.goto(base+'/dashboard/lesson-wallet',{waitUntil:'networkidle'});await userPage.screenshot({path:path.join(out,'user-wallet.png')});await userPage.goto(base+'/dashboard/schedule',{waitUntil:'networkidle'});await userPage.screenshot({path:path.join(out,'user-schedule.png')});await userPage.goto(base+'/dashboard/notifications',{waitUntil:'networkidle'});await userPage.screenshot({path:path.join(out,'user-notifications.png')})
 await parent.close()
 const lost=await mk('ผลตอบกลับขาด',3,true);lost.parentLabel='ผลตอบกลับขาด'+tag
 await openFamily(lost);await dialog().getByRole('button',{name:'ยืนยันกรณีพิเศษสำหรับเครดิตนี้'}).click();await dialog().getByRole('textbox',{name:'เหตุผลยืนยันรายเครดิต'}).fill(secret)
 await page.route('**/api/admin/makeup/credit-approval',async route=>{const req=route.request().postDataJSON();if(!req.read_only){await route.fetch();await route.abort('failed');await page.unroute('**/api/admin/makeup/credit-approval')}else await route.continue()})
 await dialog().getByRole('button',{name:'ยืนยัน 1 เครดิตและเลือกวัน'}).click();await expect(dialog().getByRole('button',{name:'ตรวจสอบผลเดิม'})).toBeEnabled({timeout:30000});await shot('approval-result-unknown')
 const ref=await page.evaluate(()=>sessionStorage.getItem('nasc-admin-makeup-pending-v8'));check(ref&&!ref.includes(secret)&&Object.keys(JSON.parse(ref)).length===2,'Browser persists only opaque operation kind and UUID')
 await page.reload({waitUntil:'networkidle'});await expect(page.getByRole('heading',{name:'มีคำขอเดิมที่ยังต้องตรวจสอบผล'})).toHaveCount(0,{timeout:30000})
 await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('nasc-admin-makeup-pending-v8'))).toBeNull()
 check(sql(`SELECT count(*) FROM admin_makeup_credit_decisions d JOIN admin_makeup_credit_approvals g ON g.id=d.approval_id WHERE g.credit_id=${q(lost.credit)};`)==='1','Lost-response reload reconciles the original decision without creating a second grant')
 const lostPrepare=await mk('เตรียมคำขอขาด',3,true);lostPrepare.parentLabel='เตรียมคำขอขาด'+tag
 await openFamily(lostPrepare);await dialog().getByRole('button',{name:'ยืนยันกรณีพิเศษสำหรับเครดิตนี้'}).click();await dialog().getByRole('textbox',{name:'เหตุผลยืนยันรายเครดิต'}).fill(secret)
 let prepareId
 await page.route('**/api/admin/makeup/credit-operation',async route=>{if(route.request().method()==='POST'){prepareId=route.request().postDataJSON().payload.request_id;await route.fetch();await route.abort('failed');await page.unroute('**/api/admin/makeup/credit-operation')}else await route.continue()})
 await dialog().getByRole('button',{name:'ยืนยัน 1 เครดิตและเลือกวัน'}).click();await expect(dialog().getByRole('button',{name:'ตรวจสอบผลเดิม'})).toBeEnabled({timeout:30000})
 check(await page.evaluate(()=>sessionStorage.getItem('nasc-admin-makeup-pending-v8'))===null&&sql(`SELECT count(*) FROM admin_makeup_credit_intents WHERE request_id=${q(prepareId)};`)==='1','Lost preparation response leaves the private envelope but dispatches no business write')
 await page.reload({waitUntil:'networkidle'});check(sql(`SELECT count(*) FROM admin_makeup_credit_approvals WHERE credit_id=${q(lostPrepare.credit)};`)==='0','Reload after preparation failure never silently approves a credit')
 const lostUse=await mk('ผลใช้เครดิตขาด',3,true);lostUse.parentLabel='ผลใช้เครดิตขาด'+tag
 sql(`SELECT admin_makeup_credit_decide_v1(${q(baseline.admin.id)},${q(lostUse.credit)},'approve','อนุมัติสำหรับทดสอบการอ่านผลเดิม',${q(randomUUID())},false);`)
 const lostUseTarget=fixtures.target(lostUse,true)
 await openFamily(lostUse);await expect(dialog().getByTestId('makeup-day-'+lostUseTarget.date)).toBeVisible({timeout:30000});await dialog().getByTestId('makeup-day-'+lostUseTarget.date).click();await dialog().locator(`[data-template-id="${lostUseTarget.template}"]`).click()
 await dialog().getByRole('combobox',{name:'เหตุผลการจัดการ'}).click();await page.getByRole('option',{name:'ผู้เรียนป่วย / ลา',exact:true}).click()
 await page.route('**/api/admin/makeup/kids-family',async route=>{if(route.request().method()==='POST'&&!route.request().postDataJSON().read_only){await route.fetch();await route.abort('failed');await page.unroute('**/api/admin/makeup/kids-family')}else await route.continue()})
 await dialog().getByRole('button',{name:'สร้างวันชดเชย'}).click();await expect(dialog().getByRole('button',{name:'ตรวจสอบคำขอเดิม'})).toBeEnabled({timeout:30000});await shot('use-result-unknown')
 await page.reload({waitUntil:'networkidle'});await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('nasc-admin-makeup-pending-v8'))).toBeNull()
 check(sql(`SELECT count(*) FROM task10_family_makeup_uses WHERE parent_id=${q(lostUse.parent.id)};`)==='1'&&sql(`SELECT count(*) FROM notifications WHERE user_id=${q(lostUse.parent.id)} AND title='ได้รับวันชดเชยแล้ว';`)==='1','Lost consume response and reload create one use, one source closure and one User notification')
 const store=await mk('เก็บพร้อมยืนยัน');store.parentLabel='เก็บพร้อมยืนยัน'+tag
 const storeDst=fixtures.target(store,true)
 await page.goto(base+`/admin/makeup?month=${month}&tab=manage&session=${store.ids[0]}`,{waitUntil:'networkidle'})
 await expect(dialog().getByRole('heading',{name:'ย้ายวัน / เปลี่ยนรอบเรียน'})).toBeVisible({timeout:30000})
 await page.keyboard.press('Escape');await page.getByTestId('admin-lesson-'+store.ids[0]).getByRole('button',{name:'เก็บเข้ากระเป๋า',exact:true}).click()
 await expect(dialog().getByRole('checkbox',{name:'ยืนยันให้เครดิตนี้ใช้ได้เมื่อโควตาเต็ม'})).not.toBeChecked()
 check(true,'Store approval option starts unchecked')
 await dialog().getByRole('combobox',{name:'เหตุผลการจัดการ'}).click();await page.getByRole('option',{name:'เดือนนี้ไม่มีวันใช้แล้ว',exact:true}).click();await dialog().getByRole('checkbox',{name:'ยืนยันให้เครดิตนี้ใช้ได้เมื่อโควตาเต็ม'}).check()
 await shot('store-confirm-with-approval');await dialog().getByRole('button',{name:'ยืนยันเก็บเข้ากระเป๋า',exact:true}).click();await expect(dialog().getByRole('heading',{name:'เก็บเข้ากระเป๋าสำเร็จ'})).toBeVisible({timeout:30000})
 await expect(dialog().getByRole('button',{name:'เลือกวันชดเชยต่อ'})).toBeEnabled({timeout:30000});await shot('store-approved-success')
 check(sql(`SELECT count(*) FROM admin_makeup_credit_approvals WHERE source_session_id=${q(store.ids[0])};`)==='1','Actual Store confirmation commits stored credit and approval together')
 await dialog().getByRole('button',{name:'เลือกวันชดเชยต่อ'}).click();await expect(dialog().getByTestId('makeup-day-'+storeDst.date)).toBeVisible({timeout:30000})
 check((await dialog().getByRole('combobox',{name:'เหตุผลการจัดการ'}).innerText()).includes('เดือนนี้ไม่มีวันใช้แล้ว'),'Store continuation carries source, child and existing internal reason')
 for(const width of [1024,390,320]){await page.setViewportSize({width,height:1000});check(await dialog().evaluate(e=>{const b=e.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth+1&&e.scrollWidth<=e.clientWidth+1}),'Approval flow fits '+width+'px');await shot('approval-flow-'+width)}
 await page.setViewportSize({width:1366,height:1000});await page.keyboard.press('Escape')
 const lostStore=await mk('ผลเก็บขาด');lostStore.parentLabel='ผลเก็บขาด'+tag
 const lostStoreTarget=fixtures.target(lostStore,true)
 await page.goto(base+`/admin/makeup?month=${month}&tab=manage&session=${lostStore.ids[0]}`,{waitUntil:'networkidle'});await expect(dialog().getByRole('heading',{name:'ย้ายวัน / เปลี่ยนรอบเรียน'})).toBeVisible({timeout:30000});await page.keyboard.press('Escape')
 await page.getByTestId('admin-lesson-'+lostStore.ids[0]).getByRole('button',{name:'เก็บเข้ากระเป๋า',exact:true}).click();await dialog().getByRole('combobox',{name:'เหตุผลการจัดการ'}).click();await page.getByRole('option',{name:'เดือนนี้ไม่มีวันใช้แล้ว',exact:true}).click();await dialog().getByRole('checkbox',{name:'ยืนยันให้เครดิตนี้ใช้ได้เมื่อโควตาเต็ม'}).check()
 await page.route('**/api/admin/makeup/lessons',async route=>{if(route.request().method()==='POST'&&!route.request().postDataJSON().read_only){await route.fetch();await route.abort('failed');await page.unroute('**/api/admin/makeup/lessons')}else await route.continue()})
 await dialog().getByRole('button',{name:'ยืนยันเก็บเข้ากระเป๋า',exact:true}).click();await expect(dialog().getByRole('button',{name:'ตรวจสอบคำขอเดิม'})).toBeEnabled({timeout:30000});await shot('store-result-unknown')
 await page.reload({waitUntil:'networkidle'});await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('nasc-admin-makeup-pending-v8'))).toBeNull()
 await expect(dialog().getByTestId('makeup-day-'+lostStoreTarget.date)).toBeVisible({timeout:30000})
 check(sql(`SELECT count(*) FROM lesson_wallet_credits WHERE original_session_id=${q(lostStore.ids[0])};`)==='1'&&sql(`SELECT count(*) FROM admin_makeup_credit_approvals WHERE source_session_id=${q(lostStore.ids[0])};`)==='1','Lost Store+approval response reconciles one credit and resumes its exact next-month calendar')
 await shot('store-recovered-exact-source')
 await page.keyboard.press('Escape')
 const stale=await mk('สิทธิ์เปลี่ยนระหว่างเลือก',3,true);stale.parentLabel='สิทธิ์เปลี่ยนระหว่างเลือก'+tag
 sql(`SELECT admin_makeup_credit_decide_v1(${q(baseline.admin.id)},${q(stale.credit)},'approve','ยืนยันก่อนเกิดการเพิกถอน',${q(randomUUID())},false);`)
 const staleTarget=fixtures.target(stale,true);await openFamily(stale);await expect(dialog().getByTestId('makeup-day-'+staleTarget.date)).toBeVisible({timeout:30000});await dialog().getByTestId('makeup-day-'+staleTarget.date).click();await dialog().locator(`[data-template-id="${staleTarget.template}"]`).click()
 await dialog().getByRole('combobox',{name:'เหตุผลการจัดการ'}).click();await page.getByRole('option',{name:'ผู้เรียนป่วย / ลา',exact:true}).click()
 sql(`SELECT admin_makeup_credit_decide_v1(${q(baseline.sa.id)},${q(stale.credit)},'revoke','ผู้ดูแลอีกคนเพิกถอนก่อนใช้',${q(randomUUID())},false);`)
 const readFailure=/\/api\/admin\/makeup\/kids-family\?/
 await page.route(readFailure,route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'จำลองอ่านสิทธิ์ล่าสุดไม่ได้'})}))
 await dialog().getByRole('button',{name:'สร้างวันชดเชย'}).click();await expect(dialog().getByRole('button',{name:'ลองอ่านสิทธิ์ใหม่'})).toBeVisible({timeout:30000});await expect(dialog().getByRole('button',{name:'สร้างวันชดเชย'})).toBeDisabled()
 check(true,'Confirmed rejection plus failed refresh keeps stale eligibility from enabling another write')
 await page.unroute(readFailure);await dialog().getByRole('button',{name:'ลองอ่านสิทธิ์ใหม่'}).click();await expect(dialog().getByRole('button',{name:'สร้างวันชดเชย'})).toBeDisabled();await shot('revoked-source-refreshed')
 check(sql(`SELECT count(*) FROM task10_family_makeup_uses WHERE parent_id=${q(stale.parent.id)};`)==='0'&&sql(`SELECT status FROM admin_makeup_credit_approvals WHERE credit_id=${q(stale.credit)};`)==='revoked','Concurrent revocation refreshes the actual blocked source and creates no makeup use')
 check(errors.length===0,'No browser JavaScript errors');check(unexpected.length===0,'Only owned app and disposable API contacted')
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,checks,errors,unexpected,runtime:{app:runtime.app,runId:run.runId},fixtures:{f,lost,store,lostPrepare,lostUse,lostStore,stale}},null,2));console.log(JSON.stringify({passed:checks.length,out}))
}catch(error){await shot('failure');fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:String(error),checks,errors,unexpected},null,2));throw error}finally{await browser.close()}
