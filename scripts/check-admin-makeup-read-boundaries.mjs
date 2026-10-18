import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {chromium,expect} from '@playwright/test'
import {createServerClient} from '@supabase/ssr'
import {run,env,sql,q} from '../tests/branch-closure/isolated-runtime.mjs'
import {account,fixture,password} from '../tests/branch-closure/fixtures.mjs'
const label=process.argv[2]||'refinement2',base='http://127.0.0.1:'+(process.argv[3]||'3136'),dir=path.join(run.evidenceRoot,'refinement'),f=JSON.parse(fs.readFileSync(path.join(dir,'fixture.json')))
const checks=[],errors=[],output=path.join(dir,'boundaries-'+Date.now());fs.mkdirSync(output,{recursive:true});const check=(v,n)=>{assert.ok(v,n);checks.push(n)}
const cookies=new Map(),auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:values=>values.forEach(v=>cookies.set(v.name,v.value))}})
assert.ifError((await auth.auth.signInWithPassword({email:f.sa.email,password})).error)
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1280,height:1000},timezoneId:'Asia/Bangkok',locale:'th-TH'})
await context.addCookies([...cookies].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/',sameSite:'Lax'})))
const get=async(p)=>{const r=await context.request.get(base+p);assert.equal(r.status(),200,await r.text());return r.json()}
const month=f.f.date.slice(0,7),lookup='/api/admin/makeup/lookup?'+new URLSearchParams({month,course:'kids_group',search:'ค้นเร็ว',mode:'learners'})
try{
 const a=await get(lookup),b=await get(lookup+'&page=2');check(a.total===600&&a.items.length===10,'Real HTTP lookup returns ten of six hundred learners')
 check(!a.items.some(x=>b.items.some(y=>x.learner_key===y.learner_key)),'HTTP lookup pagination has stable distinct identities')
 const exact=await get('/api/admin/makeup/lookup?'+new URLSearchParams({month,course:'kids_group',mode:'sessions',user:a.items[0].user_id,child:a.items[0].child_id}))
 check(exact.items.length===1&&exact.items[0].child_id===a.items[0].child_id,'HTTP selected identity returns no sibling rows')
 const templates=await get('/api/admin/schedule-templates?status=all');check(templates.stats.total===Number(sql('SELECT count(*) FROM schedule_templates'))&&templates.stats.total>1000,'Recurring read passes the one thousand row boundary without losing total')
 check(templates.items.length===50,'Recurring payload limited to fifty rendered rows')
 const allActive=await get('/api/admin/makeup/options');check(allActive.templates.length===Number(sql('SELECT count(*) FROM schedule_templates WHERE is_active')),'Calendar options retain complete active canonical templates')
 // Six hundred existing bookings: declaring closure must not serialize all their names into the overview.
 const fingerprint=sql(`SELECT md5(string_agg(row_to_json(x)::text,'' ORDER BY id)) FROM booking_sessions x WHERE branch_id=${q(f.f.branch)}`)
 const close=await context.request.post(base+'/api/admin/branch-closures',{data:{branchId:f.f.branch,date:f.future,closed:true,reason:'ทดสอบแบ่งหน้า 600 รายการในฐานข้อมูลเฉพาะงาน',requestId:randomUUID()}});assert.equal(close.status(),200,await close.text())
 const overview=await get('/api/admin/branch-closures?'+new URLSearchParams({mode:'overview',month,branch:f.f.branch})),closed=overview.closures.find(x=>x.closure_date===f.future)
 check(closed.impact_count===600&&!('impact' in overview),'Closure overview returns correct aggregate without learner payload')
 const summary=await get('/api/admin/branch-closures?'+new URLSearchParams({mode:'summary',branch:f.f.branch,date:f.future}));check(summary.total===600&&!('impact' in summary),'Dialog summary reads count without names')
 const impact='/api/admin/branch-closures?'+new URLSearchParams({mode:'impact',branch:f.f.branch,date:f.future}),first=await get(impact),second=await get(impact+'&page=2')
 check(first.total===600&&first.impact.length===20&&second.impact.length===20,'Impact details return twenty rows per requested page')
 check(!first.impact.some(x=>second.impact.some(y=>y.id===x.id)),'Impact pages have no duplicated booked identities')
 check(fingerprint===sql(`SELECT md5(string_agg(row_to_json(x)::text,'' ORDER BY id)) FROM booking_sessions x WHERE branch_id=${q(f.f.branch)}`),'Aggregate/impact/closure flow preserves every original booked row')
 // A Review search matches one member but must open the whole six-hundred-member round.
 const review='/api/admin/makeup/queue?'+new URLSearchParams({mode:'review',month,search:'ค้นเร็ว 1',branch:f.f.branch,page:'1',pageSize:'15'})
 const headers=await get(review);check(headers.total===1&&headers.groups[0].count===600&&headers.sessions.length===1,'Review search selects complete round but initially sends only its representative')
 const detail=await get(review+'&group='+encodeURIComponent(headers.groups[0].key));check(detail.sessions.length===600&&new Set(detail.sessions.map(s=>s.id)).size===600,'Opening Review sends all six hundred distinct members of the matched round')
 const missing=await context.request.get(base+review+'&group=not-the-selected-round');check(missing.status()===409,'Stale/nonmatching review detail cannot turn into a partial editable roster')
 // Faults and out-of-order browser reads use canned local responses; no business action is sent.
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
 await page.goto(base+`/admin/makeup?tab=manage&month=${month}`,{waitUntil:'networkidle'});await page.getByRole('button',{name:'เด็กกลุ่ม',exact:true}).click()
 let fault=true
 await page.route('**/api/admin/makeup/lookup?**',async route=>{if(fault){fault=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'อ่านข้อมูลทดสอบไม่สำเร็จ'})})}return route.continue()})
 check(await page.getByRole('button',{name:'ค้นหา',exact:true}).isDisabled(),'Empty lookup cannot be submitted')
 await page.getByRole('textbox',{name:'ค้นหารอบเรียน'}).fill('ค้นเร็ว');await page.getByRole('textbox',{name:'ค้นหารอบเรียน'}).press('Enter');await expect(page.locator('main').getByRole('alert')).toContainText('อ่านข้อมูลทดสอบไม่สำเร็จ')
 check(await page.locator('[data-testid^="admin-lesson-"]').count()===0,'Read failure does not expose a former roster as a new search result')
 await page.getByRole('button',{name:'ลองอ่านใหม่',exact:true}).click();await expect(page.getByRole('heading',{name:'พบ 600 รายชื่อ'})).toBeVisible({timeout:30000});checks.push('Lookup retry returns the applied result scope')
 await page.unroute('**/api/admin/makeup/lookup?**')
 let released;const barrier=new Promise(resolve=>{released=resolve});let observed;const seen=new Promise(resolve=>{observed=resolve});let completed;const delivered=new Promise(resolve=>{completed=resolve})
 await page.route('**/api/admin/makeup/lookup?**',async route=>{if(new URL(route.request().url()).searchParams.get('search')==='คำตอบเก่า'){observed();await barrier;try{await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[{learner_key:'old',user_id:f.parent.id,child_id:null,booking_id:null,learner_name:'ชื่อจากคำตอบเก่า',parent_name:'เก่า',branch_ids:[],branch_names:[],course_type:'kids_group'}],total:1,page:1,pageSize:10})})}catch{}finally{completed()}return}return route.continue()})
 await page.getByRole('textbox',{name:'ค้นหารอบเรียน'}).fill('คำตอบเก่า');await page.getByRole('button',{name:'ค้นหา',exact:true}).click();await seen;await page.getByRole('button',{name:'ผู้ใหญ่กลุ่ม',exact:true}).click();released();await delivered;await expect(page.getByText('ชื่อจากคำตอบเก่า')).toHaveCount(0);checks.push('Late old-course response cannot render under newly selected course')
 await page.unroute('**/api/admin/makeup/lookup?**')
 await page.goto(base+`/admin/makeup?month=${month}`,{waitUntil:'networkidle'});await expect(page.locator('[data-review-summary]').first()).toBeVisible({timeout:30000});check(await page.getByRole('button',{name:'ดูรายละเอียดรอบ',exact:true}).count()>0,'Default Review page starts with summaries, not editable full rosters')
 await page.screenshot({path:path.join(output,'review-summaries.png'),fullPage:true})
 const denied=await context.request.get(base+`/api/admin/makeup/lookup?month=${month}&course=kids_group&search=x`);check(denied.status()===400,'One-character lookup rejected before database read')
 // Snapshot of the existing semantics: data-backed groups include their complete two-person roster in a retrospective dialog.
 const rp=await account('user','ตรวจสอบสองคน'+randomUUID().slice(0,8)),r=fixture('kids_group',false,rp,f.past,'13:00','14:00'),child=randomUUID(),session=randomUUID()
 sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);UPDATE branches SET name=${q('สาขาตรวจสองคน '+r.branch.slice(0,8))} WHERE id=${q(r.branch)};INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(child)},${q(rp.id)},'ผู้เรียนคนที่สอง','คนที่สอง');INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup) VALUES(${q(session)},${q(r.booking)},${q(r.slot)},${q(r.date)},${q(r.start)},${q(r.end)},${q(r.branch)},${q(child)},'scheduled',false);COMMIT;`)
 await page.goto(base+`/admin/makeup?month=${month}&session=${r.ids[0]}`,{waitUntil:'networkidle'});await expect(page.getByText('คนที่สอง',{exact:false}).first()).toBeVisible({timeout:30000});await page.getByRole('button',{name:'มอบหมายโค้ชใหม่',exact:true}).first().click();await expect(page.getByRole('dialog')).toBeVisible();check(await page.getByRole('dialog').getByText('คนที่สอง',{exact:false}).count()>0,'Exact Review link loads the full roster before enabling whole-round actions');await page.keyboard.press('Escape')
 // Compare actual pre-task app counters on exactly the same DB, not a reconstructed formula.
 const oldPage=await context.newPage();await oldPage.goto('http://127.0.0.1:3134/admin/makeup?month='+month,{waitUntil:'networkidle',timeout:120000})
 const oldStats={}
 for(const [key,text] of [['review','ต้องตรวจสอบ'],['reviewNoCoach','ไม่มีโค้ช'],['reviewCoachEvidence','ขาดหลักฐานโค้ช']])oldStats[key]=Number(await oldPage.getByText(text,{exact:true}).locator('..').locator('p').last().innerText())
 const currentStats=(await get('/api/admin/makeup/queue?'+new URLSearchParams({mode:'review',month}))).stats
 check(JSON.stringify(oldStats)===JSON.stringify(currentStats),'All three global Review counters match the immutable pre-task app on identical data')
 await oldPage.close()
 await page.goto(base+'/admin/makeup?tab=manage&date=2026-13-99',{waitUntil:'networkidle'});check(await page.getByLabel('เดือนและปีของรายการ').inputValue()===month,'Invalid deep-link date falls back to current valid Bangkok month')
 await page.route('**/api/admin/schedule-templates?**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'อ่านรอบเรียนทดสอบไม่สำเร็จ'})}))
 await page.goto(base+'/admin/schedule-templates',{waitUntil:'networkidle'});await expect(page.locator('main').getByRole('alert')).toContainText('อ่านรอบเรียนทดสอบไม่สำเร็จ')
 check(await page.getByText('ไม่พบรอบเรียนตามตัวกรองที่เลือก',{exact:true}).count()===0,'Recurring read failure cannot masquerade as a genuine empty result')
 await page.unroute('**/api/admin/schedule-templates?**');await page.getByRole('button',{name:'ลองอ่านใหม่',exact:true}).click();await expect(page.locator('main').getByRole('alert')).toHaveCount(0)
 check(errors.length===0,'Fault and summary tests have no browser script errors')
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({label,checks,errors,passed:true},null,2),{flag:'wx'});console.log(JSON.stringify({passed:checks.length,output}))
}catch(e){fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:String(e),checks,errors},null,2),{flag:'wx'});throw e}
finally{await context.close();await browser.close()}
