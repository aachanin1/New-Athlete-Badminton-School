import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {chromium,expect} from '@playwright/test'
import {createServerClient} from '@supabase/ssr'
import {run,env,sql,q} from '../tests/branch-closure/isolated-runtime.mjs'
import {account,fixture,target,password} from '../tests/branch-closure/fixtures.mjs'
const label=process.argv[2]||'refinement4',base='http://127.0.0.1:'+(process.argv[3]||'3138'),checks=[],errors=[],bodies=[],output=path.join(run.evidenceRoot,'refinement','transition-recovery-'+Date.now())
fs.mkdirSync(output,{recursive:true});const tag='ทวนสิทธิ์'+randomUUID().slice(0,8),admin=await account('admin','แอดมิน'+tag),owner=await account('user',tag),coach=await account('coach','โค้ช'+tag)
const k=fixture('kids_group',false,owner),family=fixture('private',true,owner),familyTarget=target(family),past=k.date.slice(0,7)+'-02',adult=fixture('adult_group',false,owner,past,'13:00','14:00'),adultTarget=target(adult,true)
sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);UPDATE booking_sessions SET status='absent' WHERE id=${q(adult.ids[0])};INSERT INTO attendance(booking_session_id,student_id,student_type,coach_id,status) VALUES(${q(adult.ids[0])},${q(owner.id)},'adult',${q(coach.id)},'absent');COMMIT;`)
const financial=()=>sql(`SELECT md5(string_agg(payload,'' ORDER BY payload)) FROM (SELECT row_to_json(x)::text payload FROM bookings x WHERE id=ANY(ARRAY[${[k.booking,family.booking,adult.booking].map(q)}]::uuid[]) UNION ALL SELECT row_to_json(x)::text FROM payments x WHERE booking_id=ANY(ARRAY[${[k.booking,family.booking,adult.booking].map(q)}]::uuid[]))s`),before=financial()
const cookies=new Map(),auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:v=>v.forEach(x=>cookies.set(x.name,x.value))}})
assert.ifError((await auth.auth.signInWithPassword({email:admin.email,password})).error)
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1280,height:1000},locale:'th-TH',timezoneId:'Asia/Bangkok'}),page=await context.newPage()
await context.addCookies([...cookies].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/',sameSite:'Lax'})));page.on('pageerror',e=>errors.push(e.message))
const check=(v,n)=>{assert.ok(v,n);checks.push(n)},month=k.date.slice(0,7)
async function reason(name='เลือกวันผิด'){await page.getByRole('dialog').getByRole('combobox',{name:'เหตุผลการจัดการ'}).click();await page.getByRole('option',{name,exact:true}).click()}
async function slot(t){await page.getByTestId('makeup-day-'+t.date).click();await page.getByRole('dialog').locator(`button[data-template-id="${t.template}"]`).click()}
try{
 await page.goto(base+`/admin/makeup?month=${month}&tab=manage&session=${k.ids[0]}`);await expect(page.getByRole('dialog')).toBeVisible({timeout:30000});await page.getByRole('button',{name:'ยกเลิก',exact:true}).click();await page.getByTestId('admin-lesson-'+k.ids[0]).getByRole('button',{name:'เก็บเข้ากระเป๋า',exact:true}).click();await reason('ผู้เรียนป่วย / ลา')
 let postCount=0,failedRead=false
 await page.route('**/api/admin/makeup/lessons',async route=>{
  if(route.request().method()!=='POST')return route.continue()
  bodies.push(route.request().postData());postCount++;const response=await route.fetch();assert.equal(response.status(),200,await response.text())
  if(postCount===1)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'ทดสอบคำตอบบันทึกขาดหายหลังระบบบันทึกแล้ว',code:'LESSON_SOURCE_UNAVAILABLE'})})
  return route.fulfill({response})
 })
 await page.route('**/api/admin/makeup/lookup?**',route=>{if(postCount>=2&&!failedRead&&new URL(route.request().url()).searchParams.get('mode')==='sessions'){failedRead=true;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'ทดสอบอ่านผลกลับล้มเหลว'})})}return route.continue()})
 await page.getByRole('button',{name:'ยืนยันเก็บเข้ากระเป๋า',exact:true}).click();await expect(page.getByRole('button',{name:'ตรวจสอบคำขอเดิม',exact:true})).toBeVisible({timeout:30000})
 check(sql(`SELECT count(*) FROM lesson_wallet_credits WHERE original_session_id=${q(k.ids[0])}`)==='1','Lost POST response still has exactly one committed credit')
 check(await page.getByRole('dialog').getByRole('combobox',{name:'เหตุผลการจัดการ'}).isDisabled(),'Uncertain result locks the exact reason and original payload')
 await page.getByRole('button',{name:'ตรวจสอบคำขอเดิม',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('บันทึกแล้วแต่ยังอ่านรายการล่าสุดไม่ได้',{timeout:30000})
 await page.screenshot({path:path.join(output,'uncertain-readback.png'),fullPage:true})
 await page.getByRole('button',{name:'ตรวจสอบคำขอเดิม',exact:true}).click();await expect(page.getByRole('heading',{name:'เก็บเข้ากระเป๋าสำเร็จ',exact:true})).toBeVisible({timeout:30000})
 check(bodies.length===3&&bodies.every(x=>x===bodies[0]),'Response-loss and readback-failure retries reuse one exact request fingerprint')
 check(sql(`SELECT count(*) FROM lesson_wallet_credits WHERE original_session_id=${q(k.ids[0])}`)==='1'&&sql(`SELECT count(*) FROM activity_logs WHERE action='admin_lesson_assistance' AND entity_id=${q(k.ids[0])}`)==='1','Retries add neither duplicate entitlement nor duplicate assistance audit')
 await page.unroute('**/api/admin/makeup/lessons');await page.unroute('**/api/admin/makeup/lookup?**')
 // Search a private booking, not one of its three participant identities.
 await page.goto(base+`/admin/makeup?month=${month}&tab=manage`);await page.getByRole('button',{name:'Private',exact:true}).click();await page.getByRole('textbox',{name:'ค้นหารอบเรียน'}).fill(tag);await page.getByRole('button',{name:'ค้นหา',exact:true}).click();await page.getByRole('button').filter({hasText:tag}).filter({hasText:'Private'}).last().click()
 await expect(page.locator('[data-testid^="admin-lesson-"]')).toHaveCount(1,{timeout:30000});await page.locator('[data-testid^="admin-lesson-"]').getByRole('button',{name:'ย้ายวัน/รอบ',exact:true}).click();await slot(familyTarget);await reason();await page.getByRole('button',{name:'ยืนยันย้ายวัน/รอบ',exact:true}).click();await expect(page.getByRole('heading',{name:'ย้ายวัน/รอบสำเร็จ'})).toBeVisible({timeout:30000})
 check(sql(`SELECT count(*) FROM booking_sessions WHERE id=ANY(ARRAY[${family.ids.map(q)}]::uuid[]) AND status='rescheduled'`)==='3','Private unit selection moves every original Family participant')
 check(sql(`SELECT count(*) FROM booking_sessions WHERE booking_id=${q(family.booking)} AND date=${q(familyTarget.date)} AND status='scheduled'`)==='3','Moved Family retains all three distinct booked identities')
 await page.getByRole('button',{name:'กลับไปหน้ารายการ',exact:true}).click();await expect(page.locator('[data-testid^="admin-lesson-"]')).toHaveCount(1);await page.locator('[data-testid^="admin-lesson-"]').getByRole('button',{name:'เก็บเข้ากระเป๋า',exact:true}).click();await reason('ผู้เรียนป่วย / ลา');await page.getByRole('button',{name:'ยืนยันเก็บเข้ากระเป๋า',exact:true}).click();await expect(page.getByRole('heading',{name:'เก็บเข้ากระเป๋าสำเร็จ',exact:true})).toBeVisible({timeout:30000})
 check(sql(`SELECT count(*) FROM booking_sessions WHERE booking_id=${q(family.booking)} AND date=${q(familyTarget.date)} AND status='walleted'`)==='3','Family Store keeps the whole moved generation together')
 // Adult/Private legacy Makeup remains available alongside searched Kids families.
 await page.goto(base+`/admin/makeup?month=${month}&tab=makeup`);await page.getByRole('tabpanel',{name:'เลือกวันชดเชย',exact:true}).getByRole('combobox').nth(2).click();await page.getByRole('option',{name:'ยังชดเชยได้',exact:true}).click();await page.getByRole('tabpanel',{name:'เลือกวันชดเชย',exact:true}).getByRole('textbox').first().fill(tag)
 const adultCard=page.locator(`[data-makeup-learner="self:${owner.id}"]`);await expect(adultCard).toBeVisible({timeout:30000});await adultCard.getByRole('button',{name:'เลือกรอบชดเชย',exact:true}).click();await slot(adultTarget);await reason()
 let legacyPosts=0,confirmationFailed=false
 await page.route('**/api/admin/makeup',async route=>{if(route.request().method()!=='POST')return route.continue();legacyPosts++;const response=await route.fetch();assert.equal(response.status(),200,await response.text());return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'ทดสอบคำตอบ legacy ขาดหายหลังบันทึก'})})})
 await page.route('**/api/admin/makeup/confirmation?**',route=>{if(!confirmationFailed){confirmationFailed=true;return route.fulfill({status:503,contentType:'application/json',body:'{"error":"ทดสอบอ่านยืนยันยังไม่ได้"}'})}return route.continue()})
 await page.getByRole('button',{name:'สร้างวันชดเชย',exact:true}).click();await expect(page.getByRole('button',{name:'ตรวจสอบสถานะล่าสุด',exact:true})).toBeVisible({timeout:30000});await page.getByRole('button',{name:'ตรวจสอบสถานะล่าสุด',exact:true}).click();await expect(page.getByRole('heading',{name:'เลือกวันและรอบเรียนชดเชย'})).toBeHidden({timeout:30000})
 check(legacyPosts===1,'Legacy unknown result resolves by exact-source read without posting another grant')
 check(sql(`SELECT count(*) FROM booking_sessions WHERE rescheduled_from_id=${q(adult.ids[0])} AND is_makeup AND child_id IS NULL`)==='1','Legacy Adult Makeup creates exactly one destination for the real self identity')
 check(financial()===before,'Move/Store/replay and legacy Makeup preserve original booking/payment evidence')
 check(errors.length===0,'Transition recovery browser has no script errors')
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({label,passed:true,checks,errors,requestCount:bodies.length},null,2),{flag:'wx'});console.log(JSON.stringify({passed:checks.length,output}))
}catch(e){await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:String(e),checks,errors},null,2),{flag:'wx'});throw e}
finally{await context.close();await browser.close()}
