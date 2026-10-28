import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID}from'node:crypto'
import {expect}from'@playwright/test'
import {run,sql,q}from'../tests/booking-ux/runtime.mjs'
import {adminBrowser,fixture as f}from'../tests/booking-ux/browser.mjs'
const base=process.argv[2]||'http://127.0.0.1:3151',label=process.argv[3]||'smoke1'
if(!/^http:\/\/127\.0\.0\.1:315[0-3]$/.test(base)||!/^[a-z0-9-]+$/.test(label))throw Error('Owned Local app required')
const root=path.join(run.evidenceRoot,'browser-'+label+'-'+Date.now());fs.mkdirSync(root)
sql(`INSERT INTO system_settings(key,value)VALUES('payment_transfer_settings',${q(JSON.stringify({version:2,revision:randomUUID(),accounts:[{id:randomUUID(),bankName:'SCB',accountNumber:'0000000000',accountName:'บัญชีทดสอบ Local ไม่มีการโอนเงินจริง',branchIds:[f.branch]}]}))}::jsonb)ON CONFLICT(key)DO UPDATE SET value=EXCLUDED.value`)
const {browser,context,page}=await adminBrowser(base,f.empty),checks=[],errors=[],egress=[]
page.on('pageerror',e=>errors.push(e.message))
await context.route('**/*',route=>{const host=new URL(route.request().url()).host;if(![new URL(base).host,'127.0.0.1:62201'].includes(host)){egress.push(host);return route.abort()}return route.continue()})
try{
 await page.goto(base+'/dashboard/booking',{waitUntil:'networkidle'})
 await expect(page.getByRole('heading',{name:'จองคอร์สเรียน',exact:true})).toBeVisible()
 await page.getByText('ผู้ใหญ่ (กลุ่ม)',{exact:true}).first().click()
 await page.getByTestId('package-adult-10').click();await page.getByTestId('booking-next').click()
 if(!await page.getByRole('heading',{name:/เลือกวันเรียน/}).isVisible())await page.getByText('สาขาทดสอบการจอง',{exact:true}).first().click()
 await expect(page.getByRole('heading',{name:/เลือกวันเรียน/})).toBeVisible();checks.push('Adult package enters combined learner/branch/calendar step')
 await page.screenshot({path:root+'/adult-zero-calendar.png',fullPage:true})
 await expect(page.getByTestId('booking-next')).toBeEnabled({timeout:20000});await page.getByTestId('booking-next').click()
 await expect(page.getByRole('heading',{name:'สรุปการจอง',exact:true})).toBeVisible();checks.push('Zero selected rounds reach summary at package price')
 await page.screenshot({path:root+'/adult-zero-summary.png',fullPage:true})
 await page.getByTestId('booking-confirm').click()
 await expect(page.getByTestId('booking-payment')).toBeVisible({timeout:25000})
 await expect(page.getByTestId('payment-countdown')).toBeVisible({timeout:20000})
 await expect(page.getByText('5,500',{exact:false}).first()).toBeVisible();checks.push('Confirmed package creates bill and opens inline payment with countdown')
 await expect(page.getByTestId('payment-transfer-card')).toBeVisible();await expect(page.getByTestId('payment-transfer-number')).toHaveText('0000000000');checks.push('Actual configured branch receiver is visible before upload')
 const url=page.url(),id=new URL(url).searchParams.get('payment');assert.ok(id)
 await page.screenshot({path:root+'/payment-desktop.png',fullPage:true})
 const deadline=sql(`SELECT checkout_deadline FROM bookings WHERE id=${q(id)}`)
 await page.reload({waitUntil:'networkidle'});await expect(page.getByTestId('payment-countdown')).toBeVisible();assert.equal(sql(`SELECT checkout_deadline FROM bookings WHERE id=${q(id)}`),deadline);checks.push('Refresh preserves original bill deadline')
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:root+'/payment-mobile.png',fullPage:true})
 await page.getByLabel('2. แนบสลิปการโอนเงิน').setInputFiles({name:'local-slip.png',mimeType:'image/png',buffer:Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBXkAAAAASUVORK5CYII=','base64'),Buffer.from(randomUUID())])})
 await page.getByRole('button',{name:/3. ส่งสลิปยืนยันการชำระเงิน/}).click()
 await expect(page.getByRole('heading',{name:'ยืนยันการจองแล้ว',exact:true})).toBeVisible({timeout:30000})
 assert.equal(sql(`SELECT count(*) FROM booking_package_units WHERE booking_id=${q(id)}`),'10');checks.push('Real Local upload/verification grants exactly ten units and shows confirmed state')
 await page.screenshot({path:root+'/payment-confirmed-mobile.png',fullPage:true})
 await page.goto(base+'/dashboard/history',{waitUntil:'networkidle'});await expect(page.getByRole('button',{name:/แนบสลิป|ชำระรวม|ชำระเงิน/})).toHaveCount(0);checks.push('Customer history has no payment mutation controls')
 assert.equal(errors.length,0);assert.equal(egress.length,0);checks.push('No browser exceptions or non-owned network egress')
 fs.writeFileSync(root+'/result.json',JSON.stringify({checks,errors,egress,bookingId:id,base},null,2));console.log(JSON.stringify({passed:checks.length,root}))
}catch(e){await page.screenshot({path:root+'/failure.png',fullPage:true}).catch(()=>{});fs.writeFileSync(root+'/failure.json',JSON.stringify({checks,errors,egress,error:String(e)},null,2));throw e}
finally{await context.close();await browser.close()}
