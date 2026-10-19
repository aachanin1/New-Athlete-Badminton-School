import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {expect} from '@playwright/test'
import {run,sql,q} from '../tests/admin-makeup-review/runtime.mjs'
import {adminBrowser,fixture as f} from '../tests/admin-makeup-review/browser.mjs'
const base='http://127.0.0.1:3145',root=path.join(run.outputDir,'navigation-'+Date.now());fs.mkdirSync(root)
const {browser,context,page}=await adminBrowser(base),checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message))
const before=JSON.parse(sql("SELECT jsonb_build_object('a',coalesce((SELECT jsonb_agg(id) FROM activity_logs),'[]'),'n',coalesce((SELECT jsonb_agg(id) FROM notifications),'[]'),'r',coalesce((SELECT jsonb_agg(request_id) FROM admin_makeup_review_requests),'[]'))"))
const search=()=>page.getByPlaceholder('ค้นหานักเรียน, ผู้ปกครอง, โค้ช, สาขา...'),card=id=>page.getByTestId('makeup-review-group').filter({has:page.getByTestId('review-session-'+id)})
async function delayed(matches,trigger,change,verify,name){
 let release,seen,delivered;const barrier=new Promise(r=>release=r),observed=new Promise(r=>seen=r),done=new Promise(r=>delivered=r)
 const handler=async route=>{if(matches(new URL(route.request().url()))){const response=await route.fetch();seen();await barrier;try{await route.fulfill({response})}catch{}finally{delivered()}return}return route.continue()}
 await page.route('**/api/admin/makeup/queue?**',handler)
 try{await trigger();await Promise.race([observed,new Promise((_,reject)=>setTimeout(()=>reject(Error('No intercepted old request: '+name)),15000))]);await change();release();await done;await verify();checks.push(name)}finally{release();await page.unroute('**/api/admin/makeup/queue?**',handler)}
}
try{
 await page.goto(base+'/admin/makeup?month='+f.month,{waitUntil:'networkidle'});await search().fill('ตรวจต่อเนื่อง');await expect(page.getByTestId('makeup-review-group')).toHaveCount(15)
 await delayed(u=>u.searchParams.get('page')==='2',()=>page.getByLabel('แบ่งหน้ารอบที่ต้องตรวจสอบ').getByRole('button',{name:'ถัดไป',exact:true}).click(),async()=>{await search().fill('ผู้เรียน ตรวจต่อเนื่อง 01');await expect(card(f.rounds[0].ids[0])).toBeVisible()},async()=>{await expect(page.getByTestId('makeup-review-group')).toHaveCount(1)},'Late previous-page response cannot replace the new filtered first page')
 const nextMonth=sql(`SELECT (date ${q(f.month+'-01')}+interval '1 month')::date`).slice(0,7)
 await delayed(u=>u.searchParams.get('month')===nextMonth,()=>page.getByLabel('เดือนและปีของรายการ').fill(nextMonth),async()=>{await expect(page.getByLabel('เดือนและปีของรายการ')).toBeEnabled();await page.getByLabel('เดือนและปีของรายการ').fill(f.month);await expect(card(f.rounds[0].ids[0])).toBeVisible()},async()=>{await expect(page.getByLabel('เดือนและปีของรายการ')).toHaveValue(f.month);await expect(card(f.rounds[0].ids[0])).toBeVisible()},'Late previous-month response cannot replace the selected month')
 await delayed(u=>u.searchParams.get('search')==='ผู้เรียน ตรวจต่อเนื่อง 02',()=>search().fill('ผู้เรียน ตรวจต่อเนื่อง 02'),()=>page.getByRole('tab',{name:'จัดการวันเรียน',exact:true}).click(),async()=>{await expect(page.getByRole('button',{name:'เด็กกลุ่ม',exact:true})).toBeVisible();await expect(page.getByTestId('makeup-review-group')).toHaveCount(0)},'Leaving Review aborts its late response without leaking results into Manage')
 await page.getByRole('tab',{name:/^ต้องตรวจสอบ/}).click();const c=card(f.rounds[1].ids[0]);await expect(c).toBeVisible({timeout:30000})
 const button=c.getByRole('button',{name:/^ส่งให้โค้ชตรวจสอบรอบนี้/});await button.click();await expect(c.getByTestId('review-round-result')).toContainText('สำเร็จ',{timeout:30000});await expect(button).toBeEnabled({timeout:30000});await expect(button).toBeFocused();checks.push('Confirmed scoped refresh preserves focus on the original send control')
 let releaseWrite,writeSeen;const writeBarrier=new Promise(r=>releaseWrite=r),writeObserved=new Promise(r=>writeSeen=r)
 await context.route('**/api/admin/makeup/review-request',async route=>{const response=await route.fetch();writeSeen();await writeBarrier;await route.fulfill({response})})
 try{await button.click();await writeObserved;await search().focus();releaseWrite();await expect(button).toBeEnabled({timeout:30000});await expect(search()).toBeFocused();checks.push('Finishing a send never steals focus after the operator moves elsewhere')}finally{releaseWrite();await context.unroute('**/api/admin/makeup/review-request')}
 const references=Array.from({length:51},()=>({requestId:randomUUID(),anchor:randomUUID(),action:'request_coach_review',month:f.month,slots:[f.rounds[0].slot],group:{sessions:'invalid extra field must be ignored'}}))
 await page.evaluate(({key,references})=>sessionStorage.setItem(key,JSON.stringify(references)),{key:'nasc-admin-review-round-v1:'+f.sa.id,references});await page.reload({waitUntil:'networkidle'});await expect(page.getByTestId('review-request-recovery')).toHaveCount(51);checks.push('Reload retains every unresolved minimal reference beyond one fifty-round page and ignores arbitrary extra fields')
 assert.equal(errors.length,0);checks.push('No JavaScript exception across navigation and focus checks')
 const result={runId:run.runId,root,checks,errors};fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(run.evidenceRoot,'navigation-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:checks.length,root}))
}catch(error){fs.writeFileSync(path.join(root,'failure.json'),JSON.stringify({message:error.message,checks,errors,activeElement:await page.evaluate(()=>document.activeElement?.outerHTML.slice(0,500))},null,2));await page.screenshot({path:path.join(root,'failure.png')});throw error}
finally{sql(`DELETE FROM activity_logs WHERE NOT(id=ANY(ARRAY[${before.a.map(q).join(',')}]::uuid[]));DELETE FROM notifications WHERE NOT(id=ANY(ARRAY[${before.n.map(q).join(',')}]::uuid[]));DELETE FROM admin_makeup_review_requests WHERE NOT(request_id=ANY(ARRAY[${before.r.map(q).join(',')}]::uuid[]));`);await browser.close()}
