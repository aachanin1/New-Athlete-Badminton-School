import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { expect } from '@playwright/test'
import { run, sql, q } from '../tests/admin-makeup-review/runtime.mjs'
import { adminBrowser, fixture as f } from '../tests/admin-makeup-review/browser.mjs'
const base='http://127.0.0.1:3145',root=path.join(run.outputDir,'browser-'+Date.now());fs.mkdirSync(root)
const {browser,context,page}=await adminBrowser(base),checks=[],errors=[],egress=[],trace=[]
const check=(v,n)=>{assert.ok(v,n);checks.push(n)}
const before=JSON.parse(sql("SELECT jsonb_build_object('a',coalesce((SELECT jsonb_agg(id) FROM activity_logs),'[]'),'n',coalesce((SELECT jsonb_agg(id) FROM notifications),'[]'),'r',coalesce((SELECT jsonb_agg(request_id) FROM admin_makeup_review_requests),'[]'))"))
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{const u=new URL(r.url());if(![base,'http://127.0.0.1:62101'].includes(u.origin)&&/^http/.test(u.protocol))egress.push(u.origin);if(u.pathname.endsWith('/review-request'))trace.push(r.postDataJSON())})
const card=id=>page.getByTestId('makeup-review-group').filter({has:page.getByTestId('review-session-'+id)})
async function open(rr){await page.goto(base+`/admin/makeup?month=${f.month}&session=${rr.ids[0]}`,{waitUntil:'networkidle'});await expect(card(rr.ids[0])).toBeVisible({timeout:30000});return card(rr.ids[0])}
const send=c=>c.getByRole('button',{name:/^(ส่งให้โค้ชตรวจสอบรอบนี้|ขอหลักฐานโค้ชรอบนี้)/})
const result=c=>c.getByTestId('review-round-result')
const counts=()=>JSON.parse(sql("SELECT jsonb_build_object('a',(SELECT count(*) FROM activity_logs WHERE action IN('attendance_gap_request_coach_review','attendance_gap_request_coach_evidence')),'n',(SELECT count(*) FROM notifications),'r',(SELECT count(*) FROM admin_makeup_review_requests))"))
try{
 let c=await open(f.rounds[0]);check(await c.locator('[data-testid^="review-session-"]').count()===5,'Initial real app displays all five learners before any extra click');check(await c.getByRole('button').count()===5,'Assigned round keeps all five existing actions')
 check(await page.getByRole('button',{name:'ดูรายละเอียดรอบ',exact:true}).count()===0,'No mandatory detail button remains in the Review tab')
 let beforeCount=counts(),start=trace.length
 await send(c).evaluate(button=>{button.click();button.click()});await expect(result(c)).toContainText('สำเร็จ',{timeout:30000});await expect(send(c)).toBeEnabled()
 check(trace.slice(start).filter(r=>!r.readOnly).length===1,'Synchronous double click dispatches one HTTP write')
 check(counts().n-beforeCount.n===1&&counts().a-beforeCount.a===5,'Real double click commits one coach notification and complete learner audit')
 // The mutation commits, but the browser loses its response.
 c=await open(f.rounds[1]);let lose=true;start=trace.length;beforeCount=counts()
 await context.route('**/api/admin/makeup/review-request',async route=>{const body=route.request().postDataJSON();if(!body.readOnly&&lose){lose=false;const r=await route.fetch();assert.equal(r.status(),200);return route.abort()}return route.continue()})
 await send(c).click();await expect(result(c)).toContainText('ยังยืนยันผลไม่ได้',{timeout:30000});check(await send(c).isDisabled(),'Unknown committed outcome blocks a second write')
 const pending=await page.evaluate(()=>Object.entries(sessionStorage).filter(([key])=>key.startsWith('nasc-admin-review-round-v1:')).map(([,value])=>JSON.parse(value)))
 check(pending.length===1&&JSON.stringify(pending).match(/^[\x00-\x7F]*$/)&&pending[0].every(r=>!('group' in r)&&!('members' in r)),'Persisted recovery references contain no names, reasons or learner roster')
 await c.getByRole('button',{name:'ตรวจสอบผลเดิม',exact:true}).click();await expect(result(c)).toContainText('สำเร็จ',{timeout:30000});await expect(send(c)).toBeEnabled()
 check(trace.slice(start).filter(r=>!r.readOnly).length===1&&trace.slice(start).filter(r=>r.readOnly).length===1,'Lost response recovery reads the original request instead of resending it')
 check(counts().n-beforeCount.n===1&&counts().a-beforeCount.a===5,'Readback creates no additional notification or audit');await context.unroute('**/api/admin/makeup/review-request')
 // The same recovery survives a real page reload.
 c=await open(f.rounds[2]);lose=true;start=trace.length
 await context.route('**/api/admin/makeup/review-request',async route=>{const body=route.request().postDataJSON();if(!body.readOnly&&lose){lose=false;const r=await route.fetch();assert.equal(r.status(),200);return route.abort()}return route.continue()})
 await send(c).click();await expect(result(c)).toContainText('ยังยืนยันผลไม่ได้',{timeout:30000});await page.reload({waitUntil:'networkidle'});c=card(f.rounds[2].ids[0]);await expect(result(c)).toContainText('คำขอเดิม',{timeout:30000})
 check(await send(c).isDisabled(),'Reload restores the unresolved round lock')
 await c.getByRole('button',{name:'ตรวจสอบผลเดิม',exact:true}).click();await expect(result(c)).toContainText('สำเร็จ',{timeout:30000});await expect(send(c)).toBeEnabled()
 check(trace.slice(start).filter(r=>!r.readOnly).length===1,'Reload recovery never replays the committed write');await context.unroute('**/api/admin/makeup/review-request')
 // A failed request with no committed receipt can be read back, then retried.
 c=await open(f.rounds[3]);let unavailable=true;start=trace.length;beforeCount=counts()
 await context.route('**/api/admin/makeup/review-request',route=>{if(unavailable&&!route.request().postDataJSON().readOnly){unavailable=false;return route.fulfill({status:503,json:{error:'จำลองปลายทางไม่พร้อม',definitive:false}})}return route.continue()})
 await send(c).click();await expect(c.getByRole('button',{name:'ตรวจสอบผลเดิม'})).toBeVisible();await c.getByRole('button',{name:'ตรวจสอบผลเดิม'}).click();await expect(result(c)).toContainText('ยังไม่พบการส่ง',{timeout:30000});check(await send(c).isEnabled(),'A definitive missing receipt enables an explicit retry')
 await send(c).click();await expect(result(c)).toContainText('สำเร็จ',{timeout:30000});const writes=trace.slice(start).filter(r=>!r.readOnly);check(writes.length===2&&writes[0].requestId===writes[1].requestId,'Explicit retry preserves the original request ID');check(counts().n-beforeCount.n===1,'Unavailable-before-write retry delivers once');await context.unroute('**/api/admin/makeup/review-request')
 // The send commits but its follow-up data read fails; another send stays locked.
 c=await open(f.rounds[4]);start=trace.length;let failRead=true
 await page.route('**/api/admin/makeup/queue?**',route=>new URL(route.request().url()).searchParams.has('scope')&&failRead?route.fulfill({status:503,json:{error:'จำลองอ่านข้อมูลล่าสุดไม่ได้'}}):route.continue())
 await send(c).click();await expect(result(c)).toContainText('รออ่านข้อมูลล่าสุด',{timeout:30000});check(await send(c).isDisabled(),'Confirmed send stays locked until fresh scoped read succeeds');failRead=false
 await c.getByRole('button',{name:'ตรวจสอบผลเดิม'}).click();await expect(send(c)).toBeEnabled({timeout:30000});check(trace.slice(start).filter(r=>!r.readOnly).length===1,'Fresh-read retry performs no duplicate write');await page.unroute('**/api/admin/makeup/queue?**')
 // Mixed and evidence-only conditions remain exactly the source workflow.
 c=await open(f.mixed);await send(c).click();await expect(result(c)).toContainText('2 คน',{timeout:30000});check(await c.locator('[data-testid^="review-session-"]').count()===3,'Mixed round retains its recorded learner and complete roster')
 c=await open(f.evidence);check(await c.getByRole('button',{name:'บันทึกย้อนหลังทั้งรอบ',exact:true}).isDisabled(),'Evidence-only round cannot overwrite attendance');await send(c).click();await expect(result(c)).toContainText('4 คน',{timeout:30000});check((await send(c).innerText()).includes('ขอหลักฐาน'),'Evidence-only primary action requests coach evidence')
 c=await open(f.unassigned);check(await c.getByRole('button',{name:'มอบหมายโค้ชใหม่',exact:true}).isVisible()&&await c.getByRole('button',{name:'บันทึกโค้ชและเช็คชื่อย้อนหลัง',exact:true}).isVisible(),'Unassigned round retains its two appropriate source actions');check(await c.getByRole('button',{name:/^ส่งให้โค้ชตรวจสอบ/}).count()===0,'Unassigned round exposes no fabricated send action')
 c=await open(f.large);check(await c.locator('[data-testid^="review-session-"]').count()===600,'Real browser receives all six hundred members in a single page read')
 await page.getByPlaceholder('ค้นหานักเรียน, ผู้ปกครอง, โค้ช, สาขา...').fill('ผู้เรียน รอบใหญ่ 600 001');await expect(page.getByTestId('makeup-review-group')).toHaveCount(1);check(await page.locator('[data-testid^="review-session-"]').count()===600,'A name filter never truncates the action roster to one learner')
 // A delayed old search may not replace a newer filter's complete roster.
 let releaseOld,seenOld,deliveredOld;const oldBarrier=new Promise(r=>releaseOld=r),oldSeen=new Promise(r=>seenOld=r),oldDelivered=new Promise(r=>deliveredOld=r)
 const search=page.getByPlaceholder('ค้นหานักเรียน, ผู้ปกครอง, โค้ช, สาขา...')
 await page.route('**/api/admin/makeup/queue?**',async route=>{if(new URL(route.request().url()).searchParams.get('search')==='ผู้เรียน ตรวจต่อเนื่อง 06'){const response=await route.fetch();seenOld();await oldBarrier;try{await route.fulfill({response})}catch{}finally{deliveredOld()}return}return route.continue()})
 await search.fill('ผู้เรียน ตรวจต่อเนื่อง 06');await oldSeen;await search.fill('ผู้เรียน ตรวจต่อเนื่อง 07');await expect(card(f.rounds[6].ids[0])).toBeVisible({timeout:30000});releaseOld();await oldDelivered
 check(await page.getByTestId('makeup-review-group').count()===1&&await card(f.rounds[5].ids[0]).count()===0,'Late old-filter response cannot replace the new roster');await page.unroute('**/api/admin/makeup/queue?**')
 // Independent rounds can finish their scoped reads out of order without
 // dropping either confirmed result or reordering the displayed queue.
 await search.fill('ตรวจต่อเนื่อง');await page.getByLabel('แบ่งหน้ารอบที่ต้องตรวจสอบ').getByRole('combobox').click();await page.getByRole('option',{name:'25 / หน้า',exact:true}).click();await expect(page.getByTestId('makeup-review-group')).toHaveCount(20)
 const one=card(f.rounds[10].ids[0]),two=card(f.rounds[11].ids[0]);let releaseScope,scopeSeen;const scopeBarrier=new Promise(r=>releaseScope=r),scopeObserved=new Promise(r=>scopeSeen=r)
 const oneAnchor=await one.getAttribute('data-review-anchor')
 await page.route('**/api/admin/makeup/queue?**',async route=>{if(new URL(route.request().url()).searchParams.get('scope')===oneAnchor){const response=await route.fetch();scopeSeen();await scopeBarrier;try{await route.fulfill({response})}catch{}return}return route.continue()})
 await send(one).click();await scopeObserved;check(await send(two).isEnabled(),'Another non-overlapping round remains actionable while a scoped read waits');await send(two).click();await expect(send(two)).toBeEnabled({timeout:30000});releaseScope();await expect(send(one)).toBeEnabled({timeout:30000})
 check(await one.getByText('ส่งให้โค้ชแล้ว 1 ครั้ง',{exact:true}).isVisible()&&await two.getByText('ส่งให้โค้ชแล้ว 1 ครั้ง',{exact:true}).isVisible(),'Out-of-order independent refreshes retain both confirmed counts');check(await page.getByTestId('makeup-review-group').count()===20,'Out-of-order refreshes preserve the complete open page');await page.unroute('**/api/admin/makeup/queue?**')
 // Role and origin checks execute against the real candidate API.
 const body={anchor:f.rounds[5].ids[0],group:'fixture',members:f.rounds[5].ids,action:'request_coach_review',requestId:randomUUID()}
 const rejected=await context.request.post(base+'/api/admin/makeup/review-request',{headers:{Origin:'https://invalid.example'},data:body});check(rejected.status()===403,'Cross-origin round request is rejected before mutation')
 const missingOrigin=await context.request.post(base+'/api/admin/makeup/review-request',{headers:{Origin:''},data:body});check(missingOrigin.status()===403,'Missing-origin write is rejected')
 const guest=await browser.newContext();try{check((await guest.request.get(base+'/api/admin/makeup/queue?month='+f.month)).status()===401,'Guest cannot read the Review queue');check((await guest.request.post(base+'/api/admin/makeup/review-request',{headers:{Origin:base},data:body})).status()===401,'Guest cannot write a Review request')}finally{await guest.close()}
 for(const actor of [f.parent,f.coach]){const other=await adminBrowser(base,actor);try{check([401,403].includes((await other.context.request.get(base+'/api/admin/makeup/queue?month='+f.month)).status()),actor===f.parent?'Parent queue read denied':'Coach queue read denied');check([401,403].includes((await other.context.request.post(base+'/api/admin/makeup/review-request',{data:body})).status()),actor===f.parent?'Parent round write denied':'Coach round write denied')}finally{await other.browser.close()}}
 // Other two tabs still use their existing lookup/browse paths.
 await page.goto(base+'/admin/makeup?month='+f.month,{waitUntil:'networkidle'});await page.getByRole('tab',{name:'จัดการวันเรียน',exact:true}).click();await page.getByRole('button',{name:'เด็กกลุ่ม',exact:true}).click();check(await page.getByRole('button',{name:'ค้นหา',exact:true}).isDisabled(),'Manage keeps its empty-search gate')
 await page.getByRole('textbox',{name:'ค้นหารอบเรียน'}).fill('รีวิวผู้ปกครอง');await page.getByRole('textbox',{name:'ค้นหารอบเรียน'}).press('Enter');await expect(page.getByRole('heading',{name:/^พบ .* รายชื่อ/})).toBeVisible({timeout:30000});checks.push('Manage search still resolves learner identities through the existing read model')
 await page.getByRole('tab',{name:'เลือกวันชดเชย',exact:true}).click();await expect(page.getByRole('button',{name:'เด็กกลุ่ม',exact:true}).first()).toBeVisible();checks.push('Makeup tab retains course-first browse entry')
 const legacy=await context.request.get(base+'/api/admin/makeup/queue?'+new URLSearchParams({month:f.month,mode:'legacy',course:'adult_group'}));check(legacy.status()===200&&Array.isArray((await legacy.json()).sessions),'Legacy non-Kids queue remains compatible')
 // Capture real, fully built application surfaces with synthetic learners only.
 c=await open(f.rounds[0]);await page.getByPlaceholder('ค้นหานักเรียน, ผู้ปกครอง, โค้ช, สาขา...').fill('ผู้เรียน ตรวจต่อเนื่อง 01');await expect(page.getByTestId('makeup-review-group')).toHaveCount(1)
 await page.setViewportSize({width:1440,height:1350});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(root,'review-desktop-real-app.png'),fullPage:false})
 await page.setViewportSize({width:390,height:1100});await page.evaluate(()=>window.scrollTo(0,0));check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'390px real app has no horizontal overflow');await page.screenshot({path:path.join(root,'review-mobile-real-app.png'),fullPage:true})
 await page.setViewportSize({width:320,height:1000});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'320px real app has no horizontal overflow')
 check(errors.length===0,'No browser JavaScript exceptions in core, failure or recovery flows');check(egress.length===0,'No browser egress outside this app and the owned Local API')
 const output={runId:run.runId,root,checks,errors,egress,scope:'Real production-mode Local app; synthetic DB only; injected network failures are identified above'}
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(output,null,2));fs.writeFileSync(path.join(run.evidenceRoot,'browser-result.json'),JSON.stringify(output,null,2));console.log(JSON.stringify({passed:checks.length,root}))
}catch(error){fs.writeFileSync(path.join(root,'failure.json'),JSON.stringify({message:error.message,checks,errors,egress},null,2));await page.screenshot({path:path.join(root,'failure.png'),fullPage:true}).catch(()=>{});throw error}
finally{
 sql(`DELETE FROM activity_logs WHERE NOT(id=ANY(ARRAY[${before.a.map(q).join(',')}]::uuid[]));DELETE FROM notifications WHERE NOT(id=ANY(ARRAY[${before.n.map(q).join(',')}]::uuid[]));DELETE FROM admin_makeup_review_requests WHERE NOT(request_id=ANY(ARRAY[${before.r.map(q).join(',')}]::uuid[]));`)
 await browser.close()
}
