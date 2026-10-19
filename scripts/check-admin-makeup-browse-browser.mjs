import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {chromium,expect} from '@playwright/test'
import {createServerClient} from '@supabase/ssr'
import {run,env,sql,q,fixtures} from '../tests/admin-makeup-browse/runtime.mjs'
const {account,fixture,target,password}=fixtures,label=process.argv[2]||'candidate2',phase=process.argv[3]||'all',baseURL='http://127.0.0.1:3142'
const storeOnce=label.startsWith('v9')
const f=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json'))),scenarioTag=f.tag+'-'+randomUUID().slice(0,6),binding=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'app-'+label,'.next/admin-makeup-local-build.json')))
assert.equal(binding.runId,run.runId);assert.equal(binding.api,env.apiUrl)
const runtime=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'app-runtime.json')))
assert.equal(runtime.app,path.join(run.evidenceRoot,'app-'+label))
const checks=[],errors=[],requests=[],unexpected=[],out=path.join(run.outputDir,'browser-'+label+'-'+Date.now());fs.mkdirSync(out,{recursive:true})
const check=(value,name)=>{assert.ok(value,name);checks.push(name);console.log(name)}
const browser=await chromium.launch({headless:true}),contexts=[]
async function context(a){
 const cookies=new Map(),auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:items=>items.forEach(c=>cookies.set(c.name,c.value))}})
 assert.ifError((await auth.auth.signInWithPassword({email:a.email,password})).error)
 const c=await browser.newContext({viewport:{width:1366,height:1000},locale:'th-TH',timezoneId:'Asia/Bangkok'})
 await c.addCookies([...cookies].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/',sameSite:'Lax'})))
 await c.route('**/*',r=>{const u=new URL(r.request().url());if(['http:','https:'].includes(u.protocol)&&![baseURL,env.apiUrl].includes(u.origin)){unexpected.push(u.origin);return r.abort()}return r.continue()})
 contexts.push(c);return c
}
const adminContext=await context(f.admin),parentContext=await context(f.owner),page=await adminContext.newPage();page.setDefaultTimeout(15000)
page.on('pageerror',error=>errors.push(error.message));page.on('request',r=>{if(r.url().includes('/api/admin/makeup'))requests.push({url:r.url(),method:r.method(),body:r.postDataJSON?.()})})
const dialog=()=>page.getByRole('dialog'),shot=name=>page.screenshot({path:path.join(out,name+'.png'),fullPage:false,animations:'disabled'})
const countLog=id=>Number(sql(`SELECT count(*) FROM activity_logs WHERE entity_id=${q(id)} AND action='attendance_gap_closed_no_action';`))
async function closeModal(){await dialog().getByRole('button',{name:'ปิด',exact:true}).click();await expect(dialog()).toHaveCount(0)}
async function reason(name){await dialog().getByRole('combobox',{name:'เหตุผลการจัดการ'}).click();await page.getByRole('option',{name,exact:true}).click()}
async function round(name,count=3,assigned=true){
 name+='-'+randomUUID().slice(0,5)
 const parent=await account('user','ครอบครัวตรวจสอบ'+randomUUID().slice(0,6))
 const rows=[]
 for(let i=0;i<count;i++)rows.push(fixture('kids_group',false,parent,f.past,'18:00','19:00'))
 const first=rows[0],group=randomUUID()
 sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);
 UPDATE branches SET name=${q(name)} WHERE id=${q(first.branch)};
 ${rows.map((r,i)=>`UPDATE booking_sessions SET branch_id=${q(first.branch)},schedule_slot_id=${q(first.slot)} WHERE id=${q(r.ids[0])};UPDATE children SET nickname=${q('ผู้เรียน '+['ก','ข','ค'][i])},full_name=${q('ทดสอบ คนที่ '+(i+1))} WHERE id=${q(r.children[0])};`).join('')}
 ${assigned?`INSERT INTO coach_assignment_groups(id,schedule_slot_id,coach_id,name,created_by) VALUES(${q(group)},${q(first.slot)},${q(f.coach.id)},${q(name)},${q(f.sa.id)});
 ${rows.map(r=>`INSERT INTO coach_assignment_group_students(group_id,booking_session_id,student_id,student_type) VALUES(${q(group)},${q(r.ids[0])},${q(r.children[0])},'child');`).join('')}`:''}COMMIT;`)
 return {first,rows,ids:rows.map(r=>r.ids[0]),name}
}
async function openRound(r){
 await page.goto(baseURL+`/admin/makeup?month=${f.month}&session=${r.ids[0]}`,{waitUntil:'networkidle'})
 const group=page.getByTestId('makeup-review-group').filter({hasText:r.name})
 await expect(group).toBeVisible({timeout:30000});r.ids=await group.locator('[data-testid^="review-session-"]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-testid').slice('review-session-'.length)));return group
}
function extraAbsent(fixtureRow,date){
 const id=randomUUID(),slot=randomUUID(),template=randomUUID()
 sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);
 INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(template)},${q(fixtureRow.branch)},${q(fixtureRow.course)},extract(dow FROM ${q(date)}::date),'08:00','09:00',true);
 INSERT INTO schedule_slots(id,template_id,branch_id,course_type_id,date,start_time,end_time,status) VALUES(${q(slot)},${q(template)},${q(fixtureRow.branch)},${q(fixtureRow.course)},${q(date)},'08:00','09:00','open');
 INSERT INTO booking_sessions(id,booking_id,child_id,schedule_slot_id,date,start_time,end_time,branch_id,status,is_makeup) VALUES(${q(id)},${q(fixtureRow.booking)},${q(fixtureRow.children[0])},${q(slot)},${q(date)},'08:00','09:00',${q(fixtureRow.branch)},'absent',false);
 INSERT INTO attendance(booking_session_id,student_id,student_type,coach_id,status) VALUES(${q(id)},${q(fixtureRow.children[0])},'child',${q(f.coach.id)},'absent');COMMIT;`)
 return id
}
let activeTemplates=[]
try{
 const asset=await adminContext.request.get(baseURL+`/_next/static/${binding.buildId}/_buildManifest.js`);check(asset.status()===200,'Browser uses the exact isolated build and database binding')
 if(phase==='all'){
 await page.goto(baseURL+`/admin/makeup?tab=manage&month=${f.month}`,{waitUntil:'networkidle'})
 check(!requests.some(r=>/\/(browse|lookup|lessons|options|history)/.test(r.url)),'Manage initial page loads no pupil, browse, calendar or history data')
 await page.getByRole('tab',{name:'เลือกวันชดเชย',exact:true}).click();await expect(page.locator('[data-testid^="kids-family-"]')).toHaveCount(10,{timeout:30000})
 check(!requests.some(r=>r.url.includes('/history?')),'Browse opens Kids immediately and keeps history lazy')
 await page.getByRole('textbox',{name:'ค้นหาเพิ่มเติม'}).fill(f.tag);await expect(page.locator('[data-testid^="kids-family-"]')).toHaveCount(10,{timeout:30000})
 const total=JSON.parse(sql(`SELECT admin_makeup_browse_v1(${q(f.admin.id)},${q(f.month+'-01')},'kids_group',${q(f.tag)});`)).total
 await page.getByRole('button',{name:'ถัดไป',exact:true}).click();await expect(page.locator('[data-testid^="kids-family-"]')).toHaveCount(Math.min(10,total-10),{timeout:30000})
 check(true,'Optional search and second server page use the same exact family scope')
 await page.getByRole('textbox',{name:'ค้นหาเพิ่มเติม'}).fill(sql(`SELECT full_name FROM profiles WHERE id=${q(f.owner.id)};`));await expect(page.getByTestId(`kids-family-${f.owner.id}:${f.month}`)).toBeVisible({timeout:30000})
 const own=page.getByTestId(`kids-family-${f.owner.id}:${f.month}`),historyButton=own.getByRole('button',{name:'ดูประวัติ',exact:true})
 await historyButton.scrollIntoViewIfNeeded();const scroll=await page.evaluate(()=>scrollY);await historyButton.click()
 await expect(dialog().locator('[data-history-event]')).not.toHaveCount(0,{timeout:30000});await shot('history-desktop')
 const parentStore=dialog().locator(`[data-history-event="store:${f.parentStored.credit_id}"]`)
 check(!(await parentStore.innerText()).includes('เหตุผล'),'Parent store event displays no invented reason')
 check((await dialog().innerText()).includes('ใช้กระเป๋าเรียนตามปกติ'),'History distinguishes ordinary Wallet use')
 const bounds=await dialog().boundingBox();check(bounds.y>=0&&bounds.y+bounds.height<=1001,'History from a lower card is centered in the visible viewport')
 await closeModal();check(Math.abs((await page.evaluate(()=>scrollY))-scroll)<2,'Closing history preserves the page scroll position')
 check(await historyButton.evaluate(e=>e===document.activeElement),'Closing history returns focus to the invoking button')
 let failHistory=true
 await adminContext.route('**/api/admin/makeup/history?**',r=>failHistory?r.fulfill({status:503,json:{error:'จำลองอ่านประวัติไม่สำเร็จ'}}):r.continue())
 await historyButton.click();await expect(dialog().getByRole('alert')).toBeVisible();check(!(await dialog().innerText()).includes('ไม่มีประวัติประเภทนี้'),'History read failure never appears as empty history')
 failHistory=false;await dialog().getByRole('button',{name:'ลองใหม่',exact:true}).click();await expect(dialog().locator('[data-history-event]')).not.toHaveCount(0,{timeout:30000});await closeModal();await adminContext.unroute('**/api/admin/makeup/history?**')
 await page.getByRole('button',{name:'ผู้ใหญ่กลุ่ม',exact:true}).click();await expect(page.locator('[data-makeup-learner]')).not.toHaveCount(0,{timeout:30000});check(true,'Adult category browses without a search gate')
 await page.getByRole('textbox',{name:'ค้นหาเพิ่มเติม'}).fill(f.tag);await expect(page.locator('[data-makeup-learner]')).toHaveCount(1,{timeout:30000})
 await page.getByRole('button',{name:'Private',exact:true}).click();await page.getByRole('textbox',{name:'ค้นหาเพิ่มเติม'}).fill(f.tag);await expect(page.locator('[data-makeup-learner]')).toHaveCount(1,{timeout:30000})
 check(await page.getByRole('button',{name:'เลือกรอบชดเชย',exact:true}).count()===0,'Private cannot gain a new right after Adult consumed the shared month')
 const noPermission=await parentContext.request.get(baseURL+`/api/admin/makeup/browse?month=${f.month}&course=kids_group`)
 check([401,403].includes(noPermission.status()),'Parent is denied Admin browse API')
 const invalid=await adminContext.request.get(baseURL+`/api/admin/makeup/history?month=${f.month}&parent=invalid&course=kids_group`)
 check(invalid.status()===400,'History rejects malformed identity before database reads')

 const full=await round('ปิดครบ'+f.tag),fullGroup=await openRound(full),before=requests.length
 check(await fullGroup.getByRole('button').count()>=5,'Assigned round keeps its existing round actions')
 await fullGroup.getByRole('button',{name:'ปิดเคสทั้งรอบ',exact:true}).click();await expect(dialog().getByRole('heading',{name:'ยืนยันปิดเคสทั้งรอบ'})).toBeVisible()
 check(requests.slice(before).every(r=>!r.url.includes('/review-close'))&&full.ids.every(id=>countLog(id)===0),'Opening close confirmation sends no write')
 await dialog().getByRole('button',{name:'ยกเลิก',exact:true}).click();check(full.ids.every(id=>countLog(id)===0),'Cancelling confirmation preserves every case')
 await fullGroup.getByRole('button',{name:'ปิดเคสทั้งรอบ',exact:true}).click();await shot('close-confirm');await dialog().getByRole('button',{name:'ยืนยันปิดเคส 3 คน',exact:true}).click()
 await expect(dialog().getByRole('heading',{name:'ปิดเคสสำเร็จครบทั้งรอบ'})).toBeVisible({timeout:30000});check(await dialog().locator('[data-close-status="done"]').count()===3&&full.ids.every(id=>countLog(id)===1),'Full result remains visible with three real committed closures');await shot('close-full');await closeModal()
 }

 const partial=await round('ปิดบางส่วน'+f.tag),partialGroup=await openRound(partial);let failSecond=true
 await adminContext.route('**/api/admin/makeup/review-close',r=>{const body=r.request().postDataJSON();if(body.session===partial.ids[1]&&!body.readOnly&&failSecond)return r.fulfill({status:409,json:{error:'จำลองข้อมูลเปลี่ยน',definitive:true}});return r.continue()})
 await partialGroup.getByRole('button',{name:'ปิดเคสทั้งรอบ',exact:true}).click();await dialog().getByRole('button',{name:'ยืนยันปิดเคส 3 คน',exact:true}).click()
 await expect(dialog().getByRole('heading',{name:'ปิดเคสสำเร็จบางส่วน'})).toBeVisible({timeout:30000});check(await dialog().locator('[data-close-status="done"]').count()===1&&await dialog().locator('[data-close-status="failed"]').count()===1&&await dialog().locator('[data-close-status="pending"]').count()===1,'Partial result distinguishes committed, failed and unattempted learners')
 check(countLog(partial.ids[0])===1&&countLog(partial.ids[1])===0&&countLog(partial.ids[2])===0,'Partial stops after the failed learner and preserves remaining cases');await shot('close-partial')
 failSecond=false;await dialog().getByRole('button',{name:'ดำเนินการต่อเฉพาะที่ยังไม่ปิด (2)',exact:true}).click();await dialog().getByRole('button',{name:'ยืนยันปิดเคส 2 คน',exact:true}).click();await expect(dialog().getByRole('heading',{name:'ปิดเคสสำเร็จครบทั้งรอบ'})).toBeVisible({timeout:30000})
 check(partial.ids.every(id=>countLog(id)===1),'Retry closes only the remaining learners with no duplicate audit');await closeModal();await adminContext.unroute('**/api/admin/makeup/review-close')
 const rejected=await round('ปิดไม่สำเร็จ'+f.tag,2),rejectedGroup=await openRound(rejected)
 await adminContext.route('**/api/admin/makeup/review-close',r=>r.fulfill({status:409,json:{error:'จำลองเคสไม่พร้อมปิด',definitive:true}}))
 await rejectedGroup.getByRole('button',{name:'ปิดเคสทั้งรอบ',exact:true}).click();await dialog().getByRole('button',{name:'ยืนยันปิดเคส 2 คน',exact:true}).click();await expect(dialog().getByRole('heading',{name:'ยังปิดเคสไม่สำเร็จ'})).toBeVisible({timeout:30000})
 check(rejected.ids.every(id=>countLog(id)===0),'Failure before the first closure preserves the entire round');await shot('close-failed');await adminContext.unroute('**/api/admin/makeup/review-close')
 await dialog().getByRole('button',{name:'ดำเนินการต่อเฉพาะที่ยังไม่ปิด (2)',exact:true}).click();await dialog().getByRole('button',{name:'ยืนยันปิดเคส 2 คน',exact:true}).click();await expect(dialog().getByRole('heading',{name:'ปิดเคสสำเร็จครบทั้งรอบ'})).toBeVisible({timeout:30000});await closeModal()

 const unknown=await round('ผลไม่แน่นอน'+f.tag,2),unknownGroup=await openRound(unknown);let lose=true,failRead=true,originalRequest
 await adminContext.route('**/api/admin/makeup/review-close',async r=>{const body=r.request().postDataJSON();if(body.session===unknown.ids[0]&&!body.readOnly&&lose){lose=false;originalRequest=body.requestId;const response=await r.fetch();assert.equal(response.status(),200);return r.abort()}if(body.readOnly&&failRead)return r.fulfill({status:503,json:{error:'จำลองอ่านผลไม่ได้',definitive:false}});return r.continue()})
 await unknownGroup.getByRole('button',{name:'ปิดเคสทั้งรอบ',exact:true}).click();await dialog().getByRole('button',{name:'ยืนยันปิดเคส 2 คน',exact:true}).click();await expect(dialog().getByRole('heading',{name:'ยังยืนยันผลปิดเคสไม่ครบ'})).toBeVisible({timeout:30000})
 check(countLog(unknown.ids[0])===1&&countLog(unknown.ids[1])===0,'Lost response preserves the actual committed first closure and leaves the second untouched')
 await closeModal();await page.getByRole('button').filter({hasText:'ตรวจผลเดิม ·'}).last().click();await expect(dialog().locator('[data-close-status="unknown"]')).toHaveCount(1)
 const mark=requests.length;await dialog().getByRole('button',{name:'ตรวจสอบผลเดิม',exact:true}).click();await expect(dialog().getByRole('button',{name:'ตรวจสอบผลเดิม',exact:true})).toBeEnabled();check(requests.slice(mark).every(r=>r.body?.readOnly===true),'Unknown outcome checks the old request without resending a write')
 failRead=false;await dialog().getByRole('button',{name:'ตรวจสอบผลเดิม',exact:true}).click();await expect(dialog().locator('[data-close-status="done"]')).toHaveCount(1,{timeout:30000})
 check(requests.filter(r=>r.body?.session===unknown.ids[0]&&r.body?.readOnly).every(r=>r.body.requestId===originalRequest),'Readback retains the original operation UUID across modal close/reopen');await shot('close-readback')
 await dialog().getByRole('button',{name:'ดำเนินการต่อเฉพาะที่ยังไม่ปิด (1)',exact:true}).click();await dialog().getByRole('button',{name:'ยืนยันปิดเคส 1 คน',exact:true}).click();await expect(dialog().getByRole('heading',{name:'ปิดเคสสำเร็จครบทั้งรอบ'})).toBeVisible({timeout:30000});await closeModal();await adminContext.unroute('**/api/admin/makeup/review-close')
 check(unknown.ids.every(id=>countLog(id)===1),'Resolved unknown and subsequent retry create no duplicate closures')
 const unassigned=await round('ไม่มีโค้ช'+f.tag,2,false),unassignedGroup=await openRound(unassigned)
 await unassignedGroup.getByRole('button',{name:'มอบหมายโค้ชใหม่',exact:true}).click();await dialog().getByRole('combobox').first().click();check(await page.getByRole('option').count()===4,'Unassigned modal retains all four existing modes');await page.getByRole('option',{name:'ปิดเคสทั้งรอบ ไม่สร้างสิทธิ์ชดเชย',exact:true}).click()
 await expect(dialog().getByRole('button',{name:'ยืนยันปิดเคส 2 คน',exact:true})).toBeDisabled();await dialog().getByRole('textbox').fill('ตรวจสอบรอบที่ไม่มีโค้ชแล้ว');await dialog().getByRole('button',{name:'ยืนยันปิดเคส 2 คน',exact:true}).click();await expect(dialog().getByRole('heading',{name:'ปิดเคสสำเร็จครบทั้งรอบ'})).toBeVisible({timeout:30000})
 check(unassigned.ids.every(id=>countLog(id)===1),'Unassigned close keeps the existing reason requirement and commits after its confirmation');await closeModal()
 const oldClient=fixture('kids_group',false,f.owner,f.past,'14:00','15:00')
 const oldResponse=await adminContext.request.patch(baseURL+'/api/admin/makeup',{data:{session_id:oldClient.ids[0],action:'close_review',reason:'ทดสอบลูกค้ารุ่นเดิม'}}),oldBody=await oldResponse.json()
 check(oldResponse.status()===200&&oldBody.success===true&&oldBody.confirmed===true&&countLog(oldClient.ids[0])===1,'Compatible old close client receives success only after durable audit')

 // No-destination scenario uses a real complete empty calendar in this disposable.
 const end=sql(`SELECT (${q(f.month+'-01')}::date+interval '1 month'-interval '1 day')::date;`),endOwner=await account('user','สิ้นเดือน'+scenarioTag),endLesson=fixture('kids_group',false,endOwner,end,'16:00','17:00')
 activeTemplates=JSON.parse(sql("SELECT coalesce(json_agg(id),'[]') FROM schedule_templates WHERE is_active AND course_type_id IN (SELECT id FROM course_types WHERE name='kids_group');"))
 sql("UPDATE schedule_templates SET is_active=false WHERE course_type_id IN (SELECT id FROM course_types WHERE name='kids_group');")
 await page.goto(baseURL+`/admin/makeup?tab=manage&month=${f.month}`,{waitUntil:'networkidle'});await page.getByRole('button',{name:'เด็กกลุ่ม',exact:true}).click();await page.getByRole('textbox',{name:'ค้นหารอบเรียน'}).fill('สิ้นเดือน'+scenarioTag);await page.getByRole('button',{name:'ค้นหา',exact:true}).click();await expect(page.locator('[data-testid^="admin-lesson-"]')).toHaveCount(0)
 await page.getByRole('button').filter({hasText:'สิ้นเดือน'+scenarioTag}).filter({hasText:'เด็กกลุ่ม'}).click();await expect(page.getByTestId('admin-lesson-'+endLesson.ids[0])).toBeVisible({timeout:30000})
 check(true,'Manage requires exact learner selection before loading rounds')
 let releaseOptions,readMode='hold';const heldOptions=new Promise(resolve=>{releaseOptions=resolve})
 await adminContext.route('**/api/admin/makeup/options',async r=>{if(readMode==='hold'){await heldOptions;return r.fulfill({status:503,json:{error:'จำลองอ่านปฏิทินไม่สำเร็จ'}})}return r.continue()})
 await page.getByTestId('admin-lesson-'+endLesson.ids[0]).getByRole('button',{name:'ย้ายวัน/รอบ',exact:true}).click();await expect(dialog().getByText('กำลังอ่านรอบเรียน...', {exact:true})).toBeVisible()
 check(await dialog().locator('[data-no-move-target]').count()===0,'Loading calendar is not shown as a confirmed empty calendar')
 releaseOptions();await expect(dialog().getByRole('alert').filter({hasText:'จำลองอ่านปฏิทินไม่สำเร็จ'})).toBeVisible();check(await dialog().locator('[data-no-move-target]').count()===0,'Calendar read failure does not offer Store as an empty-calendar fallback')
 readMode='actual';await dialog().getByRole('button',{name:'ลองใหม่',exact:true}).click();await expect(dialog().locator('[data-no-move-target]')).toBeVisible({timeout:30000});await expect(dialog().getByRole('button',{name:'เก็บรอบนี้เข้ากระเป๋า',exact:true})).toBeEnabled({timeout:30000});await adminContext.unroute('**/api/admin/makeup/options');await shot('manage-no-target')
 await dialog().getByRole('button',{name:'เก็บรอบนี้เข้ากระเป๋า',exact:true}).click();await expect(dialog().getByRole('combobox',{name:'เหตุผลการจัดการ'})).toContainText('เดือนนี้ไม่มีวันใช้แล้ว');await expect(dialog().getByRole('button',{name:'ยืนยันเก็บเข้ากระเป๋า',exact:true})).toBeEnabled({timeout:30000})
 check(storeOnce?(await dialog().innerText()).includes('เก็บสิทธิ์ตามอายุเดิม')&&await dialog().getByRole('checkbox').count()===0:(await dialog().innerText()).includes('เพิ่มในกระเป๋า 1 หน่วยเรียน')&&(await dialog().innerText()).includes('หมดอายุกระเป๋าปกติ'),'Before Store explains original entitlement and uses the approved confirmation form');await shot('store-before-confirm')
 await dialog().getByRole('button',{name:'ยืนยันเก็บเข้ากระเป๋า',exact:true}).click();await expect(dialog().getByRole('heading',{name:'เก็บเข้ากระเป๋าสำเร็จ'})).toBeVisible({timeout:30000});await expect(dialog().getByRole('button',{name:storeOnce?'เสร็จ':'เลือกวันชดเชยต่อ',exact:true})).toBeVisible({timeout:30000})
 check(sql(`SELECT count(*) FROM lesson_wallet_credits WHERE original_session_id=${q(endLesson.ids[0])};`)==='1','Month-end path commits exactly one real Wallet credit');await shot('store-success')
 const continuationTarget=target(endLesson,true)
 if(storeOnce){await dialog().getByRole('button',{name:'เสร็จ',exact:true}).click();await page.getByRole('tab',{name:'เลือกวันชดเชย',exact:true}).click();await page.getByRole('textbox',{name:'ค้นหาเพิ่มเติม'}).fill('สิ้นเดือน'+scenarioTag);await page.getByTestId(`kids-family-${endOwner.id}:${f.month}`).getByRole('button',{name:'เลือกวันชดเชย',exact:true}).click();await expect(dialog().getByRole('heading',{name:'เลือกเด็กและรอบชดเชย',exact:true})).toBeVisible({timeout:30000});await reason('เดือนนี้ไม่มีวันใช้แล้ว')}
 else{await dialog().getByRole('button',{name:'เลือกวันชดเชยต่อ',exact:true}).click();await expect(dialog().getByRole('heading',{name:'เลือกเด็กและรอบชดเชย',exact:true})).toBeVisible({timeout:30000})}
 check((await dialog().innerText()).includes('ต้นทาง: กระเป๋า')&&(await dialog().getByRole('combobox',{name:'เหตุผลการจัดการ'}).innerText()).includes('เดือนนี้ไม่มีวันใช้แล้ว'),'Store continuation retains exact Wallet source, learner and reason')
 await dialog().getByTestId('makeup-day-'+continuationTarget.date).click();await dialog().locator(`[data-template-id="${continuationTarget.template}"]`).click();await dialog().getByRole('button',{name:'สร้างวันชดเชย',exact:true}).click();await expect(dialog()).toHaveCount(0,{timeout:30000})
 check(sql(`SELECT count(*) FROM booking_sessions s JOIN bookings b ON b.id=s.booking_id WHERE b.user_id=${q(endOwner.id)} AND s.is_makeup AND s.child_id=${q(endLesson.children[0])} AND s.date=${q(continuationTarget.date)};`)==='1'&&sql(`SELECT count(*) FROM task10_family_makeup_uses WHERE parent_id=${q(endOwner.id)};`)==='1','Store continuation creates the exact learner next-month Makeup and consumes one shared quota without destination purchase')
 const exhaustedOwner=await account('user','โควตาเต็ม'+scenarioTag),exhausted=fixture('kids_group',false,exhaustedOwner,end,'16:00','17:00')
 const absentOne=extraAbsent(exhausted,f.past),absentTwo=extraAbsent(exhausted,sql(`SELECT (${q(f.past)}::date-1);`)),next=target(exhausted,true),nextTemplate=randomUUID()
 sql(`INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(nextTemplate)},${q(exhausted.branch)},${q(exhausted.course)},extract(dow FROM ${q(next.date)}::date),'12:00','13:00',true);`)
 for(const [source,start,endTime,template]of[[absentOne,next.start,next.end,next.template],[absentTwo,'12:00','13:00',nextTemplate]])sql(`SELECT lesson_source_transition_v1(${q(f.admin.id)},'makeup',${q(source)},${q(JSON.stringify({attendingChildId:exhausted.children[0],targetDate:next.date,startTime:start,endTime,branchId:next.branch,templateId:template,requestId:randomUUID(),reason:'ใช้โควตาครบตามข้อมูลทดสอบ'}))}::jsonb);`)
 activeTemplates=[...new Set([...activeTemplates,...JSON.parse(sql("SELECT coalesce(json_agg(id),'[]') FROM schedule_templates WHERE is_active AND course_type_id IN (SELECT id FROM course_types WHERE name='kids_group');"))])]
 sql("UPDATE schedule_templates SET is_active=false WHERE course_type_id IN (SELECT id FROM course_types WHERE name='kids_group');")
 await page.goto(baseURL+`/admin/makeup?tab=manage&month=${f.month}`,{waitUntil:'networkidle'});await page.getByRole('button',{name:'เด็กกลุ่ม',exact:true}).click();await page.getByRole('textbox',{name:'ค้นหารอบเรียน'}).fill('โควตาเต็ม'+scenarioTag);await page.getByRole('button',{name:'ค้นหา',exact:true}).click();await page.getByRole('button').filter({hasText:'โควตาเต็ม'+scenarioTag}).filter({hasText:'เด็กกลุ่ม'}).click();await expect(page.getByTestId('admin-lesson-'+exhausted.ids[0])).toBeVisible({timeout:30000})
 await page.getByTestId('admin-lesson-'+exhausted.ids[0]).getByRole('button',{name:'ย้ายวัน/รอบ',exact:true}).click();await expect(dialog().getByRole('button',{name:'เก็บรอบนี้เข้ากระเป๋า',exact:true})).toBeEnabled({timeout:30000});await dialog().getByRole('button',{name:'เก็บรอบนี้เข้ากระเป๋า',exact:true}).click();await expect(dialog().locator(`[data-store-makeup-eligible="${storeOnce?'true':'false'}"]`)).toBeVisible({timeout:30000})
 check((await dialog().innerText()).includes(storeOnce?'โควตาปกติเต็มแล้ว':'โควตาปกติใช้ครบแล้ว'),'Zero-quota consequence is visible before storing');await shot('store-zero-before-confirm')
 await expect(dialog().getByRole('button',{name:'ยืนยันเก็บเข้ากระเป๋า',exact:true})).toBeEnabled({timeout:30000});await dialog().getByRole('button',{name:'ยืนยันเก็บเข้ากระเป๋า',exact:true}).click();await expect(dialog().getByRole('heading',{name:'เก็บเข้ากระเป๋าสำเร็จ'})).toBeVisible({timeout:30000});await expect(dialog().locator(`[data-store-makeup-eligible="${storeOnce?'true':'false'}"]`)).toBeVisible({timeout:30000})
 check(await dialog().getByRole('button',{name:'เลือกวันชดเชยต่อ',exact:true}).count()===0,storeOnce?'Store ends with Done and a usable exact confirmed credit; no second approval step':'Storing with exhausted quota does not promise or enable next-month use');await shot('store-zero-quota');await dialog().getByRole('button',{name:storeOnce?'เสร็จ':'กลับไปหน้ารายการ',exact:true}).click()
 check(sql(`SELECT count(*) FROM task10_family_makeup_uses WHERE parent_id=${q(exhaustedOwner.id)};`)==='2','Store adds no cross-month quota or consumption beyond the two real uses')
 sql(`UPDATE schedule_templates SET is_active=true WHERE id IN (${activeTemplates.map(q).join(',')});`);activeTemplates=[]
 const responsive=await round('จอเล็ก'+f.tag,2)
 for(const width of [1024,390,320]){
  await page.setViewportSize({width,height:1000});const group=await openRound(responsive);await group.getByRole('button',{name:'ปิดเคสทั้งรอบ',exact:true}).click();await shot('confirm-'+width);check(await dialog().evaluate(e=>{const b=e.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth+1&&e.scrollWidth<=e.clientWidth+1}),`Close confirmation fits ${width}px`);await dialog().getByRole('button',{name:'ยกเลิก',exact:true}).click()
  await page.getByRole('tab',{name:'เลือกวันชดเชย',exact:true}).click();await page.getByRole('textbox',{name:'ค้นหาเพิ่มเติม'}).fill('สิ้นเดือน'+scenarioTag);await expect(page.locator('[data-testid^="kids-family-"]')).toHaveCount(1,{timeout:30000});await page.getByRole('button',{name:'ดูประวัติ',exact:true}).click();await expect(dialog().locator('[data-history-event]')).not.toHaveCount(0,{timeout:30000});await shot('history-'+width)
  check(await dialog().evaluate(e=>{const b=e.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth+1&&e.scrollWidth<=e.clientWidth+1}),`History fits ${width}px`);await closeModal()
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Browse shell has no horizontal overflow at ${width}px`)
 }
 check(errors.length===0,'No browser runtime exceptions');check(unexpected.length===0,'Browser contacts only the owned app and disposable Supabase API')
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({phase,checks,errors,requests,unexpected,binding,scope:'Synthetic isolated Local only; no Production/real customer/manual Owner UAT'},null,2))
 console.log(JSON.stringify({passed:checks.length,out}))
}catch(error){await shot('failure');fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:String(error),checks,errors,requests,unexpected},null,2));throw error}
finally{if(activeTemplates.length)sql(`UPDATE schedule_templates SET is_active=true WHERE id IN (${activeTemplates.map(q).join(',')});`);await browser.close()}
