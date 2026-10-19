import fs from 'node:fs'
import path from 'node:path'
import {expect} from '@playwright/test'
import {run,sql,q} from '../tests/admin-makeup-review/runtime.mjs'
import {adminBrowser,fixture as f} from '../tests/admin-makeup-review/browser.mjs'
const base='http://127.0.0.1:3145',root=path.join(run.outputDir,'screens-'+Date.now());fs.mkdirSync(root)
const {browser,context,page}=await adminBrowser(base),before=JSON.parse(sql("SELECT jsonb_build_object('a',coalesce((SELECT jsonb_agg(id) FROM activity_logs),'[]'),'n',coalesce((SELECT jsonb_agg(id) FROM notifications),'[]'),'r',coalesce((SELECT jsonb_agg(request_id) FROM admin_makeup_review_requests),'[]'))"))
try{
 await page.setViewportSize({width:1440,height:1350});await page.goto(base+'/admin/makeup?month='+f.month,{waitUntil:'networkidle'})
 await page.getByPlaceholder('ค้นหานักเรียน, ผู้ปกครอง, โค้ช, สาขา...').fill('ตรวจต่อเนื่อง');await expect(page.getByTestId('makeup-review-group')).toHaveCount(15);await expect(page.getByTestId('review-request-recovery')).toHaveCount(0)
 await page.screenshot({path:path.join(root,'review-desktop-before.png')})
 const c=page.getByTestId('makeup-review-group').first(),anchor=await c.getAttribute('data-review-anchor'),round=f.rounds.find(r=>r.ids.includes(anchor)),button=c.getByRole('button',{name:/^ส่งให้โค้ชตรวจสอบรอบนี้/})
 if(!round)throw Error('Unexpected showcase round')
 await button.click();await expect(c.getByTestId('review-round-result')).toContainText('สำเร็จ',{timeout:30000});await expect(button).toBeEnabled({timeout:30000});await expect(page.getByTestId('makeup-review-group')).toHaveCount(15);await expect(page.getByTestId('review-request-recovery')).toHaveCount(0)
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(root,'review-desktop-real-app.png')})
 await page.getByPlaceholder('ค้นหานักเรียน, ผู้ปกครอง, โค้ช, สาขา...').fill('ผู้เรียน '+round.name);await expect(page.getByTestId('makeup-review-group')).toHaveCount(1);await page.setViewportSize({width:390,height:1100});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(root,'review-mobile-real-app.png'),fullPage:true})
 const result={runId:run.runId,root,build:fs.readFileSync(path.join(run.evidenceRoot,'app-candidate7/.next/BUILD_ID'),'utf8').trim(),scope:'Fresh authenticated browser, no network interception or previous recovery references; actual built app, synthetic data; one confirmed send retains all fifteen open rounds'}
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(run.evidenceRoot,'screens-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result))
}finally{sql(`DELETE FROM activity_logs WHERE NOT(id=ANY(ARRAY[${before.a.map(q).join(',')}]::uuid[]));DELETE FROM notifications WHERE NOT(id=ANY(ARRAY[${before.n.map(q).join(',')}]::uuid[]));DELETE FROM admin_makeup_review_requests WHERE NOT(request_id=ANY(ARRAY[${before.r.map(q).join(',')}]::uuid[]));`);await context.close();await browser.close()}
