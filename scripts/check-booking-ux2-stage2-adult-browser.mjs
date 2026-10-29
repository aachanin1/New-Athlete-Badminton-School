import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {expect} from '@playwright/test'
import {run,env,sql,q,fixtures} from '../tests/booking-ux/runtime.mjs'
import {adminBrowser} from '../tests/booking-ux/browser.mjs'
const base='http://127.0.0.1:3151',root='.playwright/booking-ux-2/revision-stage2-20261029/adult-browser-'+Date.now();fs.mkdirSync(root,{recursive:true})
const runtime=JSON.parse(fs.readFileSync('.playwright/booking-ux-1/app-runtime.json')),binding=JSON.parse(fs.readFileSync(path.join(runtime.app,'.next/booking-ux-1-local-build.json')))
assert.equal(runtime.port,3151);assert.equal(runtime.api,env.apiUrl);assert.equal(binding.runId,run.runId)
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex'),manifest=JSON.parse(fs.readFileSync(path.join(runtime.app,'source-manifest.json')))
for(const [f,h] of Object.entries(manifest.hashes))if(/^(src\/|public\/|supabase\/migrations\/)/.test(f))assert.equal(sha(f),h)
const checks=[],check=(ok,text)=>{assert.ok(ok,text);checks.push(text);console.log(text)},read=s=>JSON.parse(sql(s)),f=JSON.parse(fs.readFileSync(run.evidenceRoot+'/fixture.json')),actor=await fixtures.account('user','ตรวจรับแก้ไขผู้ใหญ่'),coupon={id:randomUUID(),code:'ADULTEDIT'+randomUUID().slice(0,6).toUpperCase()}
sql(`INSERT INTO coupons(id,code,discount_type,discount_value,max_uses,created_by) VALUES(${q(coupon.id)},${q(coupon.code)},'percent',10,1,${q(f.sa.id)})`)
const pkg=read("SELECT to_jsonb(p) FROM booking_ux_packages p WHERE id='adult-10'"),date=sql("SELECT (date_trunc('month',now() AT TIME ZONE 'Asia/Bangkok')+interval '1 month 13 days')::date::text"),input={packageId:'adult-10',packageRevision:pkg.revision,courseTypeId:f.courses.adult_group,branchId:f.branch,participants:[null],month:+date.slice(5,7),year:+date.slice(0,4),totalSessions:10,totalAmount:5500,expectedTotalPrice:5500,sessions:[]}
const id=read(`SELECT booking_ux_create_v1(${q(actor.id)},${q(randomUUID())},${q(JSON.stringify(input))}::jsonb)`).bookingId,state=()=>read(`SELECT jsonb_build_object('bill',to_jsonb(b),'hold',(SELECT to_jsonb(r) FROM progressive_coupon_reservations r WHERE booking_id=b.id),'units',(SELECT count(*) FROM booking_package_units WHERE booking_id=b.id),'sessions',(SELECT count(*) FROM booking_sessions WHERE booking_id=b.id AND status='scheduled')) FROM bookings b WHERE id=${q(id)}`),original=state()
const b=await adminBrowser(base,actor),errors=[],egress=[];b.page.on('pageerror',e=>errors.push(e.message))
await b.context.route('**/*',route=>{const u=new URL(route.request().url());if(['data:','blob:'].includes(u.protocol)||[new URL(base).host,new URL(env.apiUrl).host].includes(u.host))return route.fallback();egress.push(u.host);return route.abort()})
try{
 await b.page.setViewportSize({width:390,height:844});await b.page.goto(base+'/dashboard/booking?payment='+id,{waitUntil:'networkidle'})
 await expect(b.page.getByTestId('payment-net-total')).toHaveText('฿5,500');await b.page.getByRole('button',{name:'แก้ไขวันเรียน / คูปอง',exact:true}).click()
 await expect(b.page.getByTestId('booking-calendar')).toBeVisible();await expect(b.page.getByTestId('booking-edit-summary')).toHaveCount(0);await expect(b.page.getByTestId('pending-payment-entry')).not.toBeVisible()
 await b.page.getByTestId('booking-date-'+date).click();const slot=b.page.getByTestId(`booking-slot-${date}-${f.branch}-10:00`);await expect(slot).toBeEnabled();await slot.click()
 const section=b.page.getByTestId('booking-edit-coupon-'+id);await section.getByRole('textbox').fill(coupon.code);await section.getByRole('button',{name:'ใช้โค้ด',exact:true}).click()
 await expect(b.page.getByTestId('booking-edit-total')).toHaveText('฿4,950',{timeout:25000});await expect(b.page.getByTestId('booking-edit-save')).toBeEnabled()
 check(state().hold===null&&state().sessions===0&&state().units===0,'Adult code-free bill previews one new round and10percent without writes or rights')
 await b.page.getByTestId('booking-edit-save').click();await expect(b.page.getByTestId('payment-net-total')).toHaveText('฿4,950',{timeout:25000});await expect(b.page.getByTestId('booking-stage2-editor')).toHaveCount(0)
 let s=state();check(s.bill.id===id&&s.bill.checkout_deadline===original.bill.checkout_deadline&&s.bill.total_price===4950&&s.sessions===1&&s.hold.status==='reserved'&&s.units===0,'Adult one-step save returns actual stage3 with exact4950,new round,same bill/deadline and pending hold')
 await b.page.evaluate(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));await b.page.screenshot({path:root+'/adult-payment-summary.png',fullPage:true})
 await b.page.getByLabel('รูปสลิปการโอนเงิน',{exact:true}).setInputFiles({name:'adult-stage2.png',mimeType:'image/png',buffer:Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBXkAAAAASUVORK5CYII=','base64'),Buffer.from(randomUUID())])})
 await b.page.getByRole('button',{name:/3. ส่งสลิปยืนยันการชำระเงิน/}).click();await expect(b.page.getByRole('heading',{name:'ชำระเงินสำเร็จ',exact:true})).toBeVisible({timeout:30000})
 s=state();check(s.bill.status==='verified'&&s.hold.status==='consumed'&&s.units===9&&s.sessions===1&&s.units+s.sessions===s.bill.total_sessions&&s.bill.checkout_deadline===original.bill.checkout_deadline,'Adult actual TEST payment consumes on verification; one booked round plus nine remaining units equals the original ten-unit package')
 check(errors.length===0&&egress.length===0,'Adult flow has no page exception or external egress')
 fs.writeFileSync(root+'/result.json',JSON.stringify({pass:true,checks,base,binding,id,testDefinitionSha256:sha(import.meta.filename)},null,2));console.log({root,passed:checks.length})
}catch(e){await b.page.screenshot({path:root+'/failure.png',fullPage:true}).catch(()=>{});fs.writeFileSync(root+'/failure.json',JSON.stringify({checks,error:String(e),state:state()},null,2));throw e}finally{await b.context.close();await b.browser.close()}
