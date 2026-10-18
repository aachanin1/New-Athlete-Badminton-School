import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { chromium, expect } from '@playwright/test'
import { createServerClient } from '@supabase/ssr'
import { run, env, sql, q } from '../tests/branch-closure/isolated-runtime.mjs'
import { account, fixture, target, source } from '../tests/branch-closure/fixtures.mjs'

const label=process.argv[2]||'candidate1',app=path.join(run.evidenceRoot,'app-'+label),binding=JSON.parse(fs.readFileSync(path.join(app,'.next/branch-closure-build.json')))
assert.equal(binding.api,env.apiUrl);assert.equal(binding.buildId,fs.readFileSync(path.join(app,'.next/BUILD_ID'),'utf8').trim())
const output=path.join(run.outputDir,'browser-'+Date.now());fs.mkdirSync(output,{recursive:true})
const checks=[],errors=[],unexpectedNetwork=[],password='BranchClosureLocal!2026',baseURL='http://127.0.0.1:3134'
const ownerLabel='ครอบครัวหน้าจอ '+randomUUID().slice(0,8)
const sa=await account('super_admin','ผู้ดูแลหน้าจอ'),admin=await account('admin','แอดมินหน้าจอ'),owner=await account('user',ownerLabel)
const f=fixture('kids_group',false,owner),moveTarget=target(f),makeupTarget=target(f,true)
const branchName='สาขาหน้าจอ '+randomUUID().slice(0,8)
sql(`UPDATE branches SET name=${q(branchName)} WHERE id=${q(f.branch)};`)
const closureTarget=target(f,false,2),futureDate=sql(`SELECT (date ${q(f.date)}+7)::date`)
function session(date,t) {
 const id=randomUUID(),slot=sql(`SELECT id FROM schedule_slots WHERE branch_id=${q(f.branch)} AND course_type_id=${q(f.course)} AND date=${q(date)} AND start_time=${q(t.start)};`)||randomUUID()
 sql(`BEGIN;SELECT set_config('task10.source_write','authorized',true);SELECT set_config('lesson_source.write','authorized',true);
  INSERT INTO schedule_slots(id,template_id,branch_id,course_type_id,date,start_time,end_time,status) VALUES(${q(slot)},${q(t.template)},${q(f.branch)},${q(f.course)},${q(date)},${q(t.start)},${q(t.end)},'open') ON CONFLICT(id) DO NOTHING;
  INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup) VALUES(${q(id)},${q(f.booking)},${q(slot)},${q(date)},${q(t.start)},${q(t.end)},${q(f.branch)},${q(f.children[0])},'scheduled',false);COMMIT;`)
 return id
}
const unaffected=session(futureDate,{template:f.template,start:f.start,end:f.end}),impacted=session(closureTarget.date,closureTarget)
const browser=await chromium.launch({headless:true}),contexts=[]
async function contextFor(a) {
 const cookies=new Map(),auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:values=>values.forEach(v=>cookies.set(v.name,v.value))}})
 assert.ifError((await auth.auth.signInWithPassword({email:a.email,password})).error)
 const c=await browser.newContext({viewport:{width:1280,height:1000},locale:'th-TH',timezoneId:'Asia/Bangkok'})
 await c.addCookies([...cookies].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/',httpOnly:false,sameSite:'Lax'})))
 await c.route('**/*',route=>{const u=new URL(route.request().url());if(['http:','https:'].includes(u.protocol)&&!([baseURL,env.apiUrl].includes(u.origin))){unexpectedNetwork.push(u.origin);return route.abort()}return route.continue()})
 contexts.push(c);return c
}
const a=await contextFor(admin),s=await contextFor(sa),u=await contextFor(owner),page=await a.newPage()
page.on('pageerror',e=>errors.push(e.message))
const check=(condition,name)=>{assert.ok(condition,name);checks.push(name)}
async function dialogShot(name) {
 const dialog=page.getByRole('dialog');await expect(dialog).toHaveCSS('opacity','1');await dialog.evaluate(element=>{element.scrollTop=0})
 await dialog.screenshot({path:path.join(output,name),animations:'disabled'})
}
async function reason(value){await page.getByRole('dialog').getByRole('combobox',{name:'เหตุผลการจัดการ'}).click();await page.getByRole('option',{name:value,exact:true}).click()}
async function dayAndSlot(date) {
 const d=page.getByRole('dialog');await d.getByTestId('makeup-day-'+date).click()
 const button=d.locator('button[data-template-id]').filter({hasText:'10:00-11:00'})
 const exact=d.locator(`button[data-template-id="${date===makeupTarget.date?makeupTarget.template:date===moveTarget.date?moveTarget.template:closureTarget.template}"]`)
 await (await exact.count()?exact:button.first()).click()
}
async function gotoLesson(id){await page.goto(`${baseURL}/admin/makeup?month=${f.date.slice(0,7)}&tab=manage&session=${id}`);await expect(page.getByRole('dialog')).toBeVisible({timeout:30000})}
try {
 const list=await a.request.get(`${baseURL}/api/admin/makeup/lessons?month=${f.date.slice(0,7)}&session=${f.ids[0]}`)
 const dto=await list.json();check(list.ok()&&dto.items[0]?.id===f.ids[0],'Authorized lesson API returns exact source identity')
 const denied=await u.request.post(`${baseURL}/api/admin/makeup/lessons`,{data:{operation:'store',session_id:f.ids[0],request_id:randomUUID(),reason:'forged',actorId:sa.id}})
 check([401,403].includes(denied.status()),'Parent cannot forge actor through the Admin API')
 const noClosurePermission=await a.request.post(`${baseURL}/api/admin/branch-closures`,{data:{branchId:f.branch,date:f.date,closed:true,reason:'forged',requestId:randomUUID()}})
 check(noClosurePermission.status()===403,'Makeup Admin cannot gain Super Admin closure authority')
 await gotoLesson(f.ids[0]);check(await page.getByRole('tab',{includeHidden:true}).count()===3,'Existing route has all three tabs')
 await dayAndSlot(moveTarget.date);await reason('เลือกวันผิด');await page.getByRole('button',{name:'ยืนยันย้ายวัน/รอบ',exact:true}).click()
 await expect(page.getByRole('heading',{name:'ย้ายวัน/รอบสำเร็จ',exact:true})).toBeVisible({timeout:30000})
 const moved=sql(`SELECT id FROM booking_sessions WHERE rescheduled_from_id=${q(f.ids[0])}`)
 check(Boolean(moved)&&sql(`SELECT status FROM booking_sessions WHERE id=${q(f.ids[0])}`)==='rescheduled','Move UI commits one linked destination and retires the source')
 check(sql(`SELECT status FROM booking_sessions WHERE id=${q(unaffected)}`)==='scheduled','Moving one source preserves the other booking')
 await page.screenshot({path:path.join(output,'move-success.png'),fullPage:true});await page.getByRole('button',{name:'กลับไปหน้ารายการ',exact:true}).click()
 await gotoLesson(moved);await page.getByRole('button',{name:'ยกเลิก',exact:true}).click()
 await page.getByRole('textbox',{name:'ค้นหารอบเรียน'}).fill(ownerLabel)
 const row=page.locator('[data-testid="admin-lesson-'+moved+'"]')
 await expect(row).toBeVisible({timeout:30000});await row.getByRole('button',{name:'เก็บเข้ากระเป๋า',exact:true}).click()
 await reason('ผู้เรียนป่วย / ลา');await page.getByRole('button',{name:'ยืนยันเก็บเข้ากระเป๋า',exact:true}).click()
 await expect(page.getByRole('heading',{name:'เก็บเข้ากระเป๋าสำเร็จ',exact:true})).toBeVisible({timeout:30000})
 const stored=sql(`SELECT original_session_id FROM lesson_wallet_credits WHERE booking_id=${q(f.booking)} ORDER BY stored_at DESC LIMIT 1`)
 check(stored===moved,'Store UI carries the selected moved source')
 await page.getByRole('button',{name:'เลือกวันชดเชยต่อ',exact:true}).click()
 await expect(page.getByRole('heading',{name:'เลือกเด็กและรอบชดเชย',exact:true})).toBeVisible({timeout:30000})
 await expect(page.getByRole('dialog').getByRole('combobox',{name:'เหตุผลการจัดการ'})).toContainText('ผู้เรียนป่วย / ลา')
 checks.push('Store continues in the same route with the exact source and prefilled reason')
 await dayAndSlot(makeupTarget.date);await dialogShot('makeup-dialog.png')
 await page.getByRole('dialog').getByRole('button',{name:'สร้างวันชดเชย',exact:true}).click()
 await expect(page.getByRole('heading',{name:'เลือกเด็กและรอบชดเชย',exact:true})).toBeHidden({timeout:30000})
 const use=JSON.parse(sql(`SELECT row_to_json(x) FROM task10_family_makeup_uses x WHERE parent_id=${q(owner.id)} ORDER BY created_at DESC LIMIT 1`))
 check(use.source_session_id===moved,'Makeup UI consumes the exact continued source')
 check(sql(`SELECT count(*) FROM task10_family_makeup_uses WHERE parent_id=${q(owner.id)}`)==='1','Makeup UI consumes one shared quota at D0')
 check(use.decision_evidence.destinationPurchase.quantity===0,'D0 waiver is recorded with real decision evidence')
 const saPage=await s.newPage();saPage.on('pageerror',e=>errors.push(e.message));await saPage.goto(baseURL+'/admin/schedule-templates')
 await saPage.getByRole('combobox',{name:'สาขาที่ประกาศปิด'}).click();await saPage.getByRole('option',{name:branchName,exact:true}).click()
 await saPage.locator('#branch-closure-date').fill(closureTarget.date)
 await expect(saPage.getByRole('button',{name:'ประกาศปิดเฉพาะวันนี้',exact:true})).toBeEnabled({timeout:30000})
 const before=sql(`SELECT md5(row_to_json(x)::text) FROM booking_sessions x WHERE id=${q(impacted)}`)
 await saPage.getByRole('button',{name:'ประกาศปิดเฉพาะวันนี้',exact:true}).click();await saPage.locator('#branch-closure-reason').fill('หยุดทำการเฉพาะวันทดสอบหน้าจอ')
 await saPage.getByRole('button',{name:'ยืนยันปิดเฉพาะวันนี้',exact:true}).click();await expect(saPage.getByText('ประกาศปิดเฉพาะวันที่แล้ว · รายการจองเดิมยังอยู่ให้จัดการต่อ',{exact:true})).toBeVisible({timeout:30000})
 check(sql(`SELECT md5(row_to_json(x)::text) FROM booking_sessions x WHERE id=${q(impacted)}`)===before,'Closing UI preserves the existing booked name and lifecycle')
 await saPage.getByText(/ดูรายการจองเดิม/).click();await expect(saPage.getByRole('link',{name:'จัดการวันเรียน',exact:true})).toBeVisible()
 checks.push('Closure impact shows the existing name and links back to Admin Makeup')
 await saPage.screenshot({path:path.join(output,'closure-impact.png'),fullPage:true})
 const activeRead=await u.request.get(`${env.apiUrl}/rest/v1/branch_date_closures?select=branch_id,closure_date,is_active`,{headers:{apikey:env.publishableKey}})
 // The application APIs enforce identity; a request without the user's DB JWT
 // must not inherit service-role credentials from the local test environment.
 check([401,403].includes(activeRead.status()),'Anonymous Data API cannot read closure metadata')
 await page.goto(`${baseURL}/admin/makeup?month=${f.date.slice(0,7)}&tab=manage&session=${unaffected}`);await expect(page.getByRole('dialog')).toBeVisible({timeout:30000})
 const closeDay=page.getByTestId('makeup-day-'+closureTarget.date)
 if(await closeDay.isEnabled()){await closeDay.click();check(!await page.getByRole('dialog').locator(`button[data-template-id="${closureTarget.template}"]`).count(),'Admin calendar omits the closed branch while retaining other open branches')}
 else checks.push('Admin calendar disables a date with no remaining open branch')
 await page.getByRole('button',{name:'ยกเลิก',exact:true}).click()
 for(const [name,file] of [[/^ต้องตรวจสอบ/,'review'],[/^เลือกวันชดเชย/,'makeup'],['จัดการวันเรียน','manage']]){
  const tab=page.getByRole('tab',{name});await tab.click();await expect(tab).toHaveAttribute('aria-selected','true');await expect(tab).toHaveAttribute('data-state','active');if(file==='manage'){await expect(page.getByText('กำลังอ่านรายการเรียน...',{exact:true})).toBeHidden();await expect(page.getByRole('dialog')).toBeHidden();checks.push('Dismissed deep link stays dismissed after tab switches')}checks.push('Existing route opens '+file+' tab');await page.screenshot({path:path.join(output,'tab-'+file+'.png'),animations:'disabled'})
 }
 for(const width of [390,320]){await page.setViewportSize({width,height:1000});await page.goto(`${baseURL}/admin/makeup?month=${f.date.slice(0,7)}&tab=manage&session=${unaffected}`);await expect(page.getByRole('dialog')).toBeVisible({timeout:30000});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Responsive lesson dialog fits '+width);await dialogShot('mobile-'+width+'.png');await page.getByRole('button',{name:'ยกเลิก',exact:true}).click()}
 await saPage.getByRole('button',{name:'ยกเลิกวันปิด',exact:true}).click();await saPage.getByRole('button',{name:'ยืนยันยกเลิกวันปิด',exact:true}).click();await expect(saPage.getByText('ยกเลิกวันปิดแล้ว · เปิดรับจองตามรอบประจำที่เปิดใช้งาน',{exact:true})).toBeVisible({timeout:30000})
 check(sql(`SELECT is_active FROM branch_date_closures WHERE branch_id=${q(f.branch)} AND closure_date=${q(closureTarget.date)}`)==='f','Reopen UI commits exact dated closure state')
 const closureColumns='id,branch_id,closure_date,reason,is_active,updated_at'
 try {
  sql(`REVOKE SELECT(${closureColumns}) ON public.branch_date_closures FROM authenticated;`)
  for(const [client,route] of [[a,'/admin/makeup'],[u,'/dashboard/booking'],[u,'/dashboard/reschedule'],[u,'/dashboard/lesson-wallet']]){
   const response=await client.request.get(baseURL+route),html=await response.text()
   check(response.ok()&&html.includes('ยังตรวจสอบวันเปิดสาขาไม่ได้')&&html.includes('รายการเดิมยังดูได้ตามปกติ'),'Closure read failure preserves existing page and blocks new-date choices at '+route)
  }
  await page.setViewportSize({width:1280,height:1000});await gotoLesson(unaffected)
  check(await page.getByRole('dialog').locator('button[data-testid^="makeup-day-"]:enabled').count()===0,'Unavailable closure policy disables every new target date without hiding the source')
  await page.getByRole('button',{name:'ยกเลิก',exact:true}).click()
 } finally {sql(`GRANT SELECT(${closureColumns}) ON public.branch_date_closures TO authenticated;`)}
 await page.getByRole('button',{name:'ลองอ่านใหม่',exact:true}).click()
 await expect(page.getByRole('alert').filter({hasText:'ยังตรวจสอบวันเปิดสาขาไม่ได้'})).toBeHidden({timeout:30000})
 checks.push('Retry restores verified date selection after the closure policy read recovers')
 const anonymous=await browser.newContext();contexts.push(anonymous)
 for(const route of ['/admin/makeup','/dashboard/booking','/dashboard/reschedule','/dashboard/lesson-wallet']){
  const response=await anonymous.request.get(baseURL+route);check(response.ok()&&new URL(response.url()).pathname==='/auth/login','Anonymous request still reaches login for '+route)
 }
 check(errors.length===0,'Browser has no uncaught script errors');check(unexpectedNetwork.length===0,'Browser network stays inside the owned app and Supabase runtime')
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,build:binding,runId:run.runId,checks,errors,unexpectedNetwork},null,2));console.log(JSON.stringify({passed:true,checks:checks.length,output}))
} catch(error) {
 await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{})
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:false,error:String(error),checks,errors,unexpectedNetwork},null,2));throw error
} finally {await Promise.all(contexts.map(c=>c.close()));await browser.close()}
