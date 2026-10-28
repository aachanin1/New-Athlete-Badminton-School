import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID}from'node:crypto'
import {performance}from'node:perf_hooks'
import {expect}from'@playwright/test'
import {execFileSync}from'node:child_process'
import {run,sql,q}from'../tests/booking-ux/runtime.mjs'
import {adminBrowser,fixture as f}from'../tests/booking-ux/browser.mjs'
const label=process.argv[2],mode=process.argv[3],large=process.argv[4]==='large',old=mode==='old',base=old?'http://127.0.0.1:3150':'http://127.0.0.1:3153'
if(!/^[a-z0-9-]+$/.test(label)||!['old','new'].includes(mode))throw Error('Frozen matched applications required')
// Optional sequential read-only baseline repeats at a quiet boundary between
// complete write scenarios. This never runs a second workload concurrently.
const repeatPath=path.join(run.evidenceRoot,'flow-baseline-repeat-request.json')
if(fs.existsSync(repeatPath)){
 const repeat=JSON.parse(fs.readFileSync(repeatPath))
 if(repeat.beforeFlow===label&&!repeat.completed){
  for(const item of repeat.cases){assert.ok(/^[a-z0-9-]+$/.test(item.label)&&['small','large'].includes(item.size));execFileSync(process.execPath,['scripts/check-booking-ux-performance.mjs',item.label,'http://127.0.0.1:3150',item.size],{windowsHide:true,stdio:['ignore','inherit','inherit']})}
  fs.writeFileSync(repeatPath,JSON.stringify({...repeat,completed:true,completedAt:new Date().toISOString()},null,2))
 }
}
const fixtureName=process.argv[5]||'flow-performance-fixture.json'
if(!/^flow-performance-fixture(-v\d+)?\.json$/.test(fixtureName))throw Error('Owned fixture file required')
const fixture=JSON.parse(fs.readFileSync(run.evidenceRoot+'/'+fixtureName)),actor=fixture.actors[(old?'old':'new')+(large?'Large':'Small')]
if(sql(`SELECT count(*) FROM bookings WHERE user_id=${q(actor.id)} AND course_type_id=${q(f.courses.kids_group)}`)!=='0')throw Error('Use a fresh matched sequence; never reuse a partial benchmark')
const result={label,mode,base,size:large?'large':'small',actor:actor.id,initialKids:0,initialOtherBookings:Number(sql(`SELECT count(*) FROM bookings WHERE user_id=${q(actor.id)}`)),rows:[],errors:[],egress:[]},root=path.join(run.evidenceRoot,'flow-performance-'+label);fs.mkdirSync(root)
const {browser,context,page}=await adminBrowser(base,actor),cdp=await context.newCDPSession(page);await cdp.send('Network.enable');let bytes=0;cdp.on('Network.loadingFinished',e=>bytes+=e.encodedDataLength)
// Each sample measures a new booking intent, independently of the old app's
// occasionally restored completed draft. Apply the same reset to both builds.
await context.addInitScript(()=>{for(const key of Object.keys(sessionStorage))if(key.startsWith('nabs:booking-draft:'))sessionStorage.removeItem(key)})
page.on('pageerror',e=>result.errors.push(e.message));await context.route('**/*',route=>{const host=new URL(route.request().url()).host;if(![new URL(base).host,'127.0.0.1:62201'].includes(host)){result.egress.push(host);return route.abort()}return route.continue()})
const month=sql("SELECT to_char(date_trunc('month',clock_timestamp() AT TIME ZONE 'Asia/Bangkok')+interval '1 month','YYYY-MM')"),next=async()=>{await expect(page.getByTestId('booking-next')).toBeEnabled({timeout:20000});await page.getByTestId('booking-next').click()}
let activeRequestCount=0;page.on('request',()=>activeRequestCount++)
sql(`UPDATE booking_ux_control SET enabled=${old?'false':'true'} WHERE singleton`)
try{
 for(let i=0;i<35;i++){
  if(i<5)await cdp.send('Network.clearBrowserCache')
  const transferred=bytes,requests=activeRequestCount,start=performance.now(),date=month+'-'+String(1+Math.floor(i/2)).padStart(2,'0'),time=i%2?'17:00':'10:00'
  await page.goto(base+'/dashboard/booking?month='+month,{waitUntil:'domcontentloaded'});await page.getByText('เด็ก (กลุ่ม)',{exact:true}).first().click();await next()
  if(old){await page.getByText('น้องวัดเวลา - นักเรียนวัดเวลา',{exact:true}).click();await next();await page.getByText('สาขาทดสอบการจอง',{exact:true}).first().click();await next()}
  else if(!await page.getByRole('heading',{name:/เลือกวันเรียน/}).isVisible())await page.getByText('สาขาทดสอบการจอง',{exact:true}).first().click()
  await page.getByTestId('booking-date-'+date).click();const slot=page.getByTestId(`booking-slot-${date}-${f.branch}-${time}`);await expect(slot).toBeEnabled({timeout:20000});await slot.click();await next();await expect(page.getByTestId('booking-confirm')).toBeEnabled({timeout:20000})
  const priceReady=performance.now()-start,endpoint=old?'/api/bookings':'/api/booking-checkout',responsePromise=page.waitForResponse(r=>new URL(r.url()).pathname===endpoint&&r.request().method()==='POST');await page.getByTestId('booking-confirm').click();const response=await responsePromise;assert.equal(response.status(),200,await response.text());const bill=await response.json();assert.ok(bill.bookingId)
  if(old){await expect(page.getByTestId('history-booking-'+bill.bookingId)).toBeVisible({timeout:20000});if(bill.status!=='verified'){await page.locator('[data-testid^="progressive-payment-prepare-"]').click();await expect(page.getByTestId('payment-slip-modal')).toBeVisible({timeout:15000})}}
  else await expect(page.getByTestId('booking-payment')).toBeVisible({timeout:20000})
  if(bill.status!=='verified'){
   await expect(page.getByTestId('payment-transfer-card')).toBeVisible({timeout:15000});const paymentReady=performance.now()-start,file={name:'local-'+i+'.png',mimeType:'image/png',buffer:Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBXkAAAAASUVORK5CYII=','base64'),Buffer.from(randomUUID())])}
   if(old){await page.locator('#slip-upload').setInputFiles(file);await page.getByTestId('payment-slip-submit').click();await expect(page.getByText('ยืนยันสลิปสำเร็จ!',{exact:true})).toBeVisible({timeout:25000})}
   else{await page.getByLabel('2. แนบสลิปการโอนเงิน').setInputFiles(file);await page.getByRole('button',{name:/3. ส่งสลิปยืนยันการชำระเงิน/}).click();await expect(page.getByRole('heading',{name:'ยืนยันการจองแล้ว',exact:true})).toBeVisible({timeout:25000})}
   result.rows.push({ms:performance.now()-start,priceReady,paymentReady,requests:activeRequestCount-requests,wireBytes:bytes-transferred,bookingId:bill.bookingId})
  }else result.rows.push({ms:performance.now()-start,priceReady,paymentReady:performance.now()-start,requests:activeRequestCount-requests,wireBytes:bytes-transferred,bookingId:bill.bookingId,zero:true})
  assert.equal(sql(`SELECT status FROM bookings WHERE id=${q(bill.bookingId)}`),'verified')
  if(i===0||i===34)await page.screenshot({path:root+'/confirmation-'+i+'.png',fullPage:!large})
  if((i+1)%5===0)console.log(JSON.stringify({label,completed:i+1,ms:result.rows.at(-1).ms}))
 }
 const warm=result.rows.slice(5).map(r=>r.ms).sort((a,b)=>a-b);result.median=warm[14];result.p95=warm[28];assert.equal(result.errors.length,0);assert.equal(result.egress.length,0);result.confirmed=Number(sql(`SELECT count(*) FROM bookings WHERE user_id=${q(actor.id)} AND course_type_id=${q(f.courses.kids_group)} AND status='verified'`));assert.equal(result.confirmed,35)
}catch(e){result.error=String(e);await page.screenshot({path:root+'/failure.png',fullPage:false}).catch(()=>{});result.failureBody=await page.locator('body').innerText().catch(()=>null);throw e}
finally{sql('UPDATE booking_ux_control SET enabled=true WHERE singleton');await context.close();await browser.close();fs.writeFileSync(root+'/result.json',JSON.stringify(result,null,2))}
console.log(JSON.stringify({label,median:result.median,p95:result.p95,confirmed:result.confirmed}))
