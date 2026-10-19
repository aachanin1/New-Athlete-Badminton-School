import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { expect } from '@playwright/test'
import { run, sql, q } from '../tests/admin-makeup-review/runtime.mjs'
import { adminBrowser, fixture as f } from '../tests/admin-makeup-review/browser.mjs'
const mode=process.argv[2]||'candidate',base=mode==='baseline'?'http://127.0.0.1:3144':'http://127.0.0.1:3145'
assert.ok(['baseline','candidate'].includes(mode))
const root=path.join(run.outputDir,'flow-'+mode+'-'+Date.now());fs.mkdirSync(root)
const {browser,context,page}=await adminBrowser(base),trace=[],errors=[],checks=[],timings=[];let firstPosition=null,firstAfter=null
const check=(v,n)=>{assert.ok(v,n);checks.push(n)}
const before=JSON.parse(sql("SELECT jsonb_build_object('audit',coalesce((SELECT jsonb_agg(id) FROM activity_logs),'[]'),'notification',coalesce((SELECT jsonb_agg(id) FROM notifications),'[]'),'receipt',coalesce((SELECT jsonb_agg(request_id) FROM admin_makeup_review_requests),'[]'))"))
page.on('pageerror',e=>errors.push(e.message))
page.on('request',r=>{const u=new URL(r.url());if(u.origin===base&&u.pathname.startsWith('/api/admin/makeup'))trace.push({method:r.method(),path:u.pathname,detail:u.searchParams.has('group'),scope:u.searchParams.has('scope')})})
try{
 for(let i=0;i<31;i++){
  const start=performance.now(),r=await context.request.get(base+'/api/admin/makeup/queue?'+new URLSearchParams({mode:'review',month:f.month,search:'ตรวจต่อเนื่อง',pageSize:'25'}));assert.equal(r.status(),200,await r.text());const text=await r.text(),data=JSON.parse(text)
  check(data.total===20&&data.sessionTotal===100,'Warm read '+i+' retains all twenty rounds/one hundred learners');timings.push({ms:performance.now()-start,bytes:Buffer.byteLength(text)})
 }
 await page.goto(base+'/admin/makeup?month='+f.month,{waitUntil:'networkidle'})
 await page.getByPlaceholder('ค้นหานักเรียน, ผู้ปกครอง, โค้ช, สาขา...').fill('ตรวจต่อเนื่อง')
 const pagination=page.getByLabel('แบ่งหน้ารอบที่ต้องตรวจสอบ')
 await pagination.getByRole('combobox').click();await page.getByRole('option',{name:'25 / หน้า',exact:true}).click()
 if(mode==='baseline')await expect(page.locator('[data-review-summary]')).toHaveCount(20,{timeout:30000})
 else{await expect(page.getByTestId('makeup-review-group')).toHaveCount(20,{timeout:30000});check(await page.getByRole('button',{name:'ดูรายละเอียดรอบ',exact:true}).count()===0,'Twenty complete rounds are actionable without opening details');check(await page.locator('[data-testid^="review-session-"]').count()===100,'All one hundred learners are visible immediately')}
 const initialTrace=trace.length,started=performance.now();let anchorDelta=null
 for(let i=0;i<f.rounds.length;i++){
  const rr=f.rounds[i]
  if(mode==='baseline')await page.locator('[data-review-summary]').filter({hasText:rr.name}).getByRole('button',{name:'ดูรายละเอียดรอบ',exact:true}).click()
  const card=page.getByTestId('makeup-review-group').filter({hasText:rr.name});await expect(card).toBeVisible({timeout:30000})
  const button=card.getByRole('button',{name:/^ส่งให้โค้ชตรวจสอบรอบนี้/});await button.scrollIntoViewIfNeeded()
  const next=mode==='candidate'&&i===0?page.getByTestId('makeup-review-group').filter({hasText:f.rounds[1].name}):null
  const position=next?await next.boundingBox():null
  const fresh=mode==='baseline'?page.waitForResponse(r=>{const u=new URL(r.url());return u.pathname==='/api/admin/makeup/queue'&&!u.searchParams.has('group')&&r.status()===200}):null
  await button.click()
  if(mode==='baseline'){await fresh;await expect(page.getByTestId('makeup-review-group')).toHaveCount(0,{timeout:30000})}
  else{
   await expect(card.getByTestId('review-round-result')).toContainText('สำเร็จ',{timeout:30000});await expect(button).toBeEnabled({timeout:30000})
   check(await page.getByTestId('makeup-review-group').count()===20,'After send '+(i+1)+' every round stays open')
   if(next&&position){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const after=await next.boundingBox();firstPosition=position;firstAfter=after;anchorDelta=Math.abs(after.y-position.y)}
  }
 }
 const elapsedMs=performance.now()-started,flowTrace=trace.slice(initialTrace),writeRequests=flowTrace.filter(r=>r.method!=='GET'),reads=flowTrace.filter(r=>r.method==='GET')
 check(mode==='baseline'?writeRequests.length===100:writeRequests.length===20,'Actual twenty-round browser writes match the intended request count')
 if(mode==='candidate'){check(writeRequests.every(r=>r.path.endsWith('/review-request')),'Every send uses the round command');check(reads.length===20&&reads.every(r=>r.scope),'Exactly one affected-scope read per round, no detail or full-page reload');check(anchorDelta<3,'Next card stays at the same viewport position after first send')}
 check(errors.length===0,'No browser runtime errors during the full twenty-round flow')
 await page.screenshot({path:path.join(root,'after-twenty-rounds.png'),fullPage:false})
 const result={mode,root,runId:run.runId,rounds:20,learners:100,elapsedMs,writeRequests:writeRequests.length,reads:reads.length,detailReads:reads.filter(r=>r.detail).length,scopeReads:reads.filter(r=>r.scope).length,anchorDelta,timings,checks,errors,trace:flowTrace}
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(run.evidenceRoot,'flow-'+mode+'-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({mode,elapsedMs,writes:writeRequests.length,reads:reads.length,anchorDelta,checks:checks.length}))
}catch(error){fs.writeFileSync(path.join(root,'failure.json'),JSON.stringify({message:error.message,checks,errors,trace,firstPosition,firstAfter},null,2));await page.screenshot({path:path.join(root,'failure.png'),fullPage:true}).catch(()=>{});throw error}
finally{
 sql(`DELETE FROM activity_logs WHERE NOT(id=ANY(ARRAY[${before.audit.map(q).join(',')}]::uuid[]));DELETE FROM notifications WHERE NOT(id=ANY(ARRAY[${before.notification.map(q).join(',')}]::uuid[]));DELETE FROM admin_makeup_review_requests WHERE NOT(request_id=ANY(ARRAY[${before.receipt.map(q).join(',')}]::uuid[]));`)
 await browser.close()
}
