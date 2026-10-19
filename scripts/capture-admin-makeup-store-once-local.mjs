import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {chromium,expect} from '@playwright/test'
import {createServerClient} from '@supabase/ssr'
import {run,env,sql,q,fixtures} from '../tests/admin-makeup-browse/runtime.mjs'
const f=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json'))),runtime=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'app-runtime.json'))),binding=JSON.parse(fs.readFileSync(path.join(runtime.app,'.next/admin-makeup-local-build.json'))),base='http://127.0.0.1:3142'
assert.equal(runtime.runId,run.runId);assert.equal(runtime.api,env.apiUrl);assert.equal(runtime.app,path.join(run.evidenceRoot,'app-v9candidate4'))
const out=path.join(run.outputDir,'v9','owner-screens-'+Date.now());fs.mkdirSync(out,{recursive:true})
const cookies=new Map(),auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:items=>items.forEach(c=>cookies.set(c.name,c.value))}})
assert.ifError((await auth.auth.signInWithPassword({email:f.admin.email,password:fixtures.password})).error)
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1366,height:1000},locale:'th-TH',timezoneId:'Asia/Bangkok'}),blocked=[],writes=[],errors=[],shots=[]
await context.addCookies([...cookies].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/',sameSite:'Lax'})))
await context.route('**/*',r=>{const u=new URL(r.request().url());if(['http:','https:'].includes(u.protocol)&&![base,env.apiUrl].includes(u.origin)){blocked.push(u.origin);return r.abort()}if(u.pathname.startsWith('/api/admin/')&&r.request().method()!=='GET'){writes.push(u.pathname);return r.abort()}return r.continue()})
const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message))
const shot=async name=>{await page.evaluate(async()=>{await document.fonts.ready;window.scrollTo(0,0)});await page.screenshot({path:path.join(out,name+'.png'),animations:'disabled'});shots.push(name+'.png')}
try{
 await page.goto(base+`/admin/makeup?tab=makeup&month=${f.month}`,{waitUntil:'networkidle'});await expect(page.locator('[data-testid^="kids-family-"]')).toHaveCount(10,{timeout:30000});await shot('tab-choose')
 const review=JSON.parse(sql("SELECT jsonb_build_object('session',s.id,'name',g.name) FROM coach_assignment_groups g JOIN coach_assignment_group_students gs ON gs.group_id=g.id JOIN booking_sessions s ON s.id=gs.booking_session_id WHERE g.name LIKE 'จอเล็ก%' AND NOT EXISTS(SELECT 1 FROM activity_logs a WHERE a.entity_id=s.id AND a.action='attendance_gap_closed_no_action') ORDER BY g.id LIMIT 1;"))
 await page.goto(base+`/admin/makeup?month=${f.month}&session=${review.session}`,{waitUntil:'networkidle'});await page.getByPlaceholder('ค้นหานักเรียน, ผู้ปกครอง, โค้ช, สาขา...').fill(review.name);await expect(page.getByTestId('makeup-review-group')).toHaveCount(1,{timeout:30000});await expect(page.getByRole('button',{name:'ปิดเคสทั้งรอบ',exact:true})).toBeVisible();await shot('tab-review')
 await page.getByRole('tab',{name:'จัดการวันเรียน',exact:true}).click();await expect(page.getByText('เลือกคอร์ส แล้วค้นหาคนที่ต้องการช่วยจัดการ',{exact:true})).toBeVisible();await shot('tab-manage-before-select')
 const source=JSON.parse(sql(`SELECT jsonb_build_object('id',s.id,'user',b.user_id,'child',s.child_id,'parent',p.full_name) FROM booking_sessions s JOIN bookings b ON b.id=s.booking_id JOIN course_types c ON c.id=b.course_type_id JOIN profiles p ON p.id=b.user_id WHERE c.name='kids_group' AND b.status='verified' AND s.status='scheduled' AND NOT s.is_makeup AND s.cancelled_at IS NULL AND s.date>=current_date AND s.date<(${q(f.month+'-01')}::date+interval '1 month') AND NOT EXISTS(SELECT 1 FROM attendance a WHERE a.booking_session_id=s.id) ORDER BY s.date DESC,s.id LIMIT 1;`))
 await page.getByRole('button',{name:'เด็กกลุ่ม',exact:true}).click();await page.getByRole('textbox',{name:'ค้นหารอบเรียน'}).fill(source.parent);await page.getByRole('button',{name:'ค้นหา',exact:true}).click()
 const response=await context.request.get(base+'/api/admin/makeup/lookup?'+new URLSearchParams({month:f.month,course:'kids_group',search:source.parent,mode:'learners',page:'1'}));assert.equal(response.status(),200);const data=await response.json(),person=data.items.find(i=>i.user_id===source.user&&i.child_id===source.child);assert.ok(person)
 await page.getByRole('button').filter({hasText:person.learner_name}).filter({hasText:person.parent_name}).first().click();await expect(page.getByTestId('admin-lesson-'+source.id)).toBeVisible({timeout:30000});await shot('tab-manage')
 const browserDirectories=fs.readdirSync(path.join(run.outputDir,'v9')).filter(name=>name.startsWith('browser-v9candidate4-')).sort()
 const approved=JSON.parse(fs.readFileSync(path.join(run.outputDir,'v9',browserDirectories.at(-1),'results.json'))).records.full
 const name=sql(`SELECT full_name FROM profiles WHERE id=${q(approved.parent.id)};`)
 await page.getByRole('tab',{name:'เลือกวันชดเชย',exact:true}).click();await page.getByRole('textbox',{name:'ค้นหาเพิ่มเติม'}).fill(name);const card=page.getByTestId(`kids-family-${approved.parent.id}:${f.month}`);await expect(card).toBeVisible({timeout:30000});await card.getByRole('button',{name:'ดูประวัติ',exact:true}).click();await expect(page.getByRole('dialog').locator('[data-history-event]')).toHaveCount(1,{timeout:30000});await shot('history-modal')
 assert.equal(blocked.length,0);assert.equal(writes.length,0);assert.equal(errors.length,0)
 fs.writeFileSync(path.join(out,'screens.json'),JSON.stringify({binding,scope:'Actual Local v9 candidate4 rendered by Chromium; existing synthetic database; GET-only UI capture with non-GET Admin requests blocked; no mock DOM or image edits',viewport:{width:1366,height:1000},shots,blocked,writes,errors},null,2));console.log(JSON.stringify({out,shots}))
}catch(e){await shot('capture-failure');throw e}finally{await browser.close()}
