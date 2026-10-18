import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {chromium,expect} from '@playwright/test'
import {createServerClient} from '@supabase/ssr'
import {run,env,sql,q} from '../tests/branch-closure/isolated-runtime.mjs'
import {account,fixture,target,password} from '../tests/branch-closure/fixtures.mjs'

const label=process.argv[2]||'refinement1',port=process.argv[3]||'3135',baseURL='http://127.0.0.1:'+port
const binding=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'app-'+label,'.next/branch-closure-build.json')))
assert.equal(binding.api,env.apiUrl)
const output=path.join(run.evidenceRoot,'refinement','browser-'+Date.now());fs.mkdirSync(output,{recursive:true})
const checks=[],errors=[],requests=[],unexpected=[],tag='ปรับเร็ว'+randomUUID().slice(0,8)
const sa=await account('super_admin','ผู้ดูแล'+tag),admin=await account('admin','แอดมิน'+tag),owner=await account('user','ผู้ปกครอง'+tag)
const f=fixture('kids_group',false,owner),next=target(f),makeup=target(f,true),other=fixture('adult_group',false,owner),family=fixture('private',true,owner)
sql(`UPDATE children SET nickname=${q(tag)},full_name='ผู้เรียนทดสอบการค้นหา' WHERE id=${q(f.children[0])};UPDATE branches SET name=${q('สาขา'+tag)} WHERE id=${q(f.branch)};`)
const check=(v,n)=>{assert.ok(v,n);checks.push(n)}
const browser=await chromium.launch({headless:true}),contexts=[]
async function context(a){
 const cookies=new Map(),auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:values=>values.forEach(v=>cookies.set(v.name,v.value))}})
 assert.ifError((await auth.auth.signInWithPassword({email:a.email,password})).error)
 const c=await browser.newContext({viewport:{width:1366,height:1000},locale:'th-TH',timezoneId:'Asia/Bangkok'})
 await c.addCookies([...cookies].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/',sameSite:'Lax'})))
 await c.route('**/*',r=>{const u=new URL(r.request().url());if(['http:','https:'].includes(u.protocol)&&![baseURL,env.apiUrl].includes(u.origin)){unexpected.push(u.origin);return r.abort()}return r.continue()})
 contexts.push(c);return c
}
const a=await context(admin),s=await context(sa),u=await context(owner),page=await a.newPage(),sp=await s.newPage()
for(const p of [page,sp]){p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.url().includes('/api/admin/'))requests.push({url:r.url(),method:r.method()})})}
const month=f.date.slice(0,7)
async function screenshot(name,p=page){await p.screenshot({path:path.join(output,name+'.png'),fullPage:true,animations:'disabled'})}
async function chooseReason(name){await page.getByRole('dialog').getByRole('combobox',{name:'เหตุผลการจัดการ'}).click();await page.getByRole('option',{name,exact:true}).click()}
async function chooseSlot(t){await page.getByTestId('makeup-day-'+t.date).click();await page.getByRole('dialog').locator(`button[data-template-id="${t.template}"]`).click()}
async function searchKids(){await page.getByRole('button',{name:'เด็กกลุ่ม',exact:true}).click();await page.getByRole('textbox',{name:'ค้นหารอบเรียน'}).fill(tag);await page.getByRole('button',{name:'ค้นหา',exact:true}).click();await page.getByRole('button').filter({hasText:tag}).filter({hasText:'ผู้ปกครอง'}).first().click()}
try{
 await page.goto(baseURL+`/admin/makeup?tab=manage&month=${month}`,{waitUntil:'networkidle'})
 await expect(page.getByRole('heading',{name:'1. เลือกประเภทคอร์ส'})).toBeVisible()
 check(!requests.some(r=>/\/makeup\/(lookup|lessons|queue|options)/.test(r.url)),'Manage opens with zero list/queue/calendar requests')
 check(await page.getByRole('tab').count()===3,'Existing makeup route retains all three tabs');await screenshot('manage-start')
 await searchKids();await expect(page.getByTestId('admin-lesson-'+f.ids[0])).toBeVisible({timeout:30000})
 check((await page.locator('[data-testid^="admin-lesson-"]').count())===1,'Search selects one exact child, not all parent bookings');await screenshot('manage-person')
 const row=page.getByTestId('admin-lesson-'+f.ids[0]);await row.getByRole('button',{name:'ย้ายวัน/รอบ',exact:true}).click();await chooseSlot(next);await chooseReason('เลือกวันผิด');await screenshot('move-dialog')
 await page.getByRole('button',{name:'ยืนยันย้ายวัน/รอบ',exact:true}).click();await expect(page.getByRole('heading',{name:'ย้ายวัน/รอบสำเร็จ'})).toBeVisible({timeout:30000})
 const moved=sql(`SELECT id FROM booking_sessions WHERE rescheduled_from_id=${q(f.ids[0])}`)
 check(Boolean(moved)&&sql(`SELECT status FROM booking_sessions WHERE id=${q(f.ids[0])}`)==='rescheduled','Move creates one linked destination and retires only selected source')
 check(sql(`SELECT status FROM booking_sessions WHERE id=${q(other.ids[0])}`)==='scheduled','Other course remains untouched')
 await page.getByRole('button',{name:'กลับไปหน้ารายการ',exact:true}).click();await expect(page.getByTestId('admin-lesson-'+moved)).toBeVisible({timeout:30000})
 await page.getByTestId('admin-lesson-'+moved).getByRole('button',{name:'เก็บเข้ากระเป๋า',exact:true}).click();await chooseReason('ผู้เรียนป่วย / ลา');await screenshot('store-dialog')
 await page.getByRole('button',{name:'ยืนยันเก็บเข้ากระเป๋า',exact:true}).click();await expect(page.getByRole('heading',{name:'เก็บเข้ากระเป๋าสำเร็จ'})).toBeVisible({timeout:30000})
 check(sql(`SELECT count(*) FROM lesson_wallet_credits WHERE original_session_id=${q(moved)}`)==='1','Store commits one real credit for selected source')
 const beforeContinuation=requests.length;await page.getByRole('button',{name:'เลือกวันชดเชยต่อ',exact:true}).click();await expect(page.getByRole('heading',{name:'เลือกเด็กและรอบชดเชย',exact:true})).toBeVisible({timeout:30000})
 check(!requests.slice(beforeContinuation).some(r=>r.url.includes('/queue?')),'Store continuation hydrates exact family without month-wide queue')
 await expect(page.getByRole('dialog').getByRole('combobox',{name:'เหตุผลการจัดการ'})).toContainText('ผู้เรียนป่วย / ลา')
 await chooseSlot(makeup);await screenshot('makeup-dialog');await page.getByRole('dialog').getByRole('button',{name:'สร้างวันชดเชย',exact:true}).click();await expect(page.getByRole('heading',{name:'เลือกเด็กและรอบชดเชย',exact:true})).toBeHidden({timeout:30000})
 const usage=JSON.parse(sql(`SELECT row_to_json(x) FROM task10_family_makeup_uses x WHERE parent_id=${q(owner.id)} ORDER BY created_at DESC LIMIT 1`))
 check(usage.source_session_id===moved&&usage.decision_evidence.destinationPurchase.quantity===0,'Continued makeup uses exact Wallet source and shared quota with Admin D0 evidence')
 // Course changes must clear the former child before another request can render.
 await page.getByRole('tab',{name:'จัดการวันเรียน',exact:true}).click();await page.getByRole('button',{name:'Private',exact:true}).click();await expect(page.locator('[data-testid^="admin-lesson-"]')).toHaveCount(0)
 await page.getByRole('textbox',{name:'ค้นหารอบเรียน'}).fill('ผู้ปกครอง'+tag);await page.getByRole('button',{name:'ค้นหา',exact:true}).click();await page.getByRole('button').filter({hasText:'ผู้ปกครอง'+tag}).filter({hasText:'Private'}).last().click()
 await expect(page.locator('[data-testid^="admin-lesson-"]')).toHaveCount(1,{timeout:30000});checks.push('Private presents one complete Family unit rather than three participant rows')
 const noPermission=await u.request.get(baseURL+`/api/admin/makeup/lookup?month=${month}&course=kids_group&search=${encodeURIComponent(tag)}`);check([401,403].includes(noPermission.status()),'Parent cannot use Admin lookup')
 const broad=await a.request.get(baseURL+`/api/admin/makeup/lookup?month=${month}&course=kids_group`);check(broad.status()===400,'HTTP API rejects empty broad lookup')
 const oldBroad=await a.request.get(baseURL+`/api/admin/makeup/lessons?month=${month}`);check(oldBroad.status()===400,'Legacy lesson API permits exact-session navigation only')
 const deniedClosure=await a.request.get(baseURL+`/api/admin/branch-closures?mode=overview&month=${month}`);check(deniedClosure.status()===403,'Makeup Admin cannot gain Super Admin closure access')
 // Schedule page loads the regular list only; closure tab does not preload names.
 let mark=requests.length;await sp.goto(baseURL+'/admin/schedule-templates',{waitUntil:'networkidle'});await expect(sp.getByRole('heading',{name:'ตารางเรียนและวันปิดสาขา'})).toBeVisible()
 check(!requests.slice(mark).some(r=>r.url.includes('/branch-closures')),'Recurring tab does not read closure data')
 await sp.getByRole('tab',{name:'วันปิดสาขา',exact:true}).click();await expect(sp.getByRole('button',{name:'เพิ่มวันปิดสาขา',exact:true})).toBeVisible()
 await sp.getByRole('button',{name:'เพิ่มวันปิดสาขา',exact:true}).click();await sp.getByRole('combobox',{name:'สาขาที่ประกาศปิด'}).click();await sp.getByRole('option',{name:'สาขา'+tag,exact:true}).click();await sp.locator('#branch-closure-date').fill(f.date)
 await sp.locator('#branch-closure-reason').fill('ปิดสาขาเฉพาะวันเพื่อทดสอบ UI แบบแยกข้อมูล');await expect(sp.getByRole('button',{name:'ยืนยันปิดเฉพาะวันนี้',exact:true})).toBeEnabled({timeout:30000});await screenshot('closure-dialog',sp)
 const sourceHash=sql(`SELECT md5(row_to_json(x)::text) FROM booking_sessions x WHERE id=${q(f.ids[0])}`)
 await sp.getByRole('button',{name:'ยืนยันปิดเฉพาะวันนี้',exact:true}).click();await expect(sp.getByText('ประกาศปิดเฉพาะวันที่แล้ว · รายการจองเดิมยังอยู่ให้จัดการต่อ',{exact:true})).toBeVisible({timeout:30000})
 check(sql(`SELECT md5(row_to_json(x)::text) FROM booking_sessions x WHERE id=${q(f.ids[0])}`)===sourceHash,'Closure leaves existing session history intact')
 await screenshot('schedule-closure',sp)
 await sp.getByRole('button',{name:/ดูรายการจองเดิม/}).filter({visible:true}).first().click();await expect(sp.getByText('รายการเดิมยังอยู่ · เลือกจัดการทีละรายการ')).toBeVisible();checks.push('Closure details are fetched only on explicit expansion')
 await sp.getByRole('tab',{name:'รอบเรียนประจำ',exact:true}).click();await sp.getByRole('button',{name:'เพิ่มรอบเรียน',exact:true}).click();await expect(sp.getByRole('dialog').getByText('วันที่เปิดรอบ',{exact:true})).toBeVisible();check(await sp.getByRole('dialog').getByRole('button',{name:'ส.-อา.',exact:true}).count()===1,'Full original recurring multi-day form retained');await sp.keyboard.press('Escape')
 for(const width of [390,320]){await page.setViewportSize({width,height:900});await sp.setViewportSize({width,height:900});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Manage fits ${width}`);await sp.getByRole('tab',{name:'วันปิดสาขา',exact:true}).click();check(await sp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Closure fits ${width}`);await screenshot('mobile-'+width);await screenshot('closure-mobile-'+width,sp)}
 check(errors.length===0,'No browser script errors');check(unexpected.length===0,'All browser/API traffic stayed on owned local app and DB')
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({label,buildId:binding.buildId,passed:true,checks,errors,requests,unexpected},null,2),{flag:'wx'});console.log(JSON.stringify({passed:checks.length,output}))
}catch(e){await screenshot('failure');await screenshot('failure-schedule',sp);fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({checks,errors,requests,error:String(e)},null,2));throw e}
finally{await Promise.all(contexts.map(c=>c.close()));await browser.close()}
