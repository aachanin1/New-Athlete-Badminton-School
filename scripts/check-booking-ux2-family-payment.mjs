import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {expect} from '@playwright/test'
import {run,sql,q,fixtures} from '../tests/booking-ux/runtime.mjs'
import {adminBrowser} from '../tests/booking-ux/browser.mjs'

const prior=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),base=prior.base
assert.ok(prior.pass&&base==='http://127.0.0.1:3151'&&prior.target.api===run.target.api)
const root='.playwright/booking-ux-2/family-payment-'+Date.now();fs.mkdirSync(root,{recursive:true})
const f=JSON.parse(fs.readFileSync(run.evidenceRoot+'/fixture.json')),actor=await fixtures.account('user','ชำระ Family UX2'),child=randomUUID(),coupon=randomUUID(),code='UX2FAM'+randomUUID().slice(0,8).toUpperCase()
sql(`INSERT INTO children(id,parent_id,full_name) VALUES(${q(child)},${q(actor.id)},'ผู้เรียนครอบครัวสมมติ');INSERT INTO coupons(id,code,discount_type,discount_value,created_by) VALUES(${q(coupon)},${q(code)},'fixed',500,${q(f.sa.id)});`)
const pkg=JSON.parse(sql("SELECT to_jsonb(p) FROM booking_ux_packages p WHERE id='private-10'")),d=sql("SELECT (now() AT TIME ZONE 'Asia/Bangkok')::date::text"),input={packageId:'private-10',packageRevision:pkg.revision,courseTypeId:f.courses.private,branchId:f.branch,participants:[null,child],learnerType:'self',childId:null,month:+d.slice(5,7),year:+d.slice(0,4),totalSessions:10,totalAmount:8000,expectedTotalPrice:7500,sessions:[],coupon:{id:coupon,code}}
const id=JSON.parse(sql(`SELECT booking_ux_create_v1(${q(actor.id)},${q(randomUUID())},${q(JSON.stringify(input))}::jsonb)`)).bookingId
const state=()=>JSON.parse(sql(`SELECT jsonb_build_object('bill',to_jsonb(b),'hold',(SELECT to_jsonb(r) FROM progressive_coupon_reservations r WHERE booking_id=b.id),'units',(SELECT jsonb_agg(to_jsonb(u) ORDER BY ordinal) FROM booking_package_units u WHERE booking_id=b.id)) FROM bookings b WHERE id=${q(id)}`))
const original=state();assert.equal(original.bill.status,'pending_payment');assert.equal(original.bill.total_price,7500);assert.equal(original.bill.package_participants.length,2)
const b=await adminBrowser(base,actor)
try{
 await b.page.setViewportSize({width:390,height:844});await b.page.goto(base+'/dashboard/booking?payment='+id,{waitUntil:'networkidle'})
 await expect(b.page.getByTestId('payment-net-total')).toHaveText('฿7,500')
 await b.page.getByLabel('รูปสลิปการโอนเงิน',{exact:true}).setInputFiles({name:'ux2-family.png',mimeType:'image/png',buffer:Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBXkAAAAASUVORK5CYII=','base64'),Buffer.from(randomUUID())])})
 await b.page.getByRole('button',{name:/3. ส่งสลิปยืนยันการชำระเงิน/}).click()
 await expect(b.page.getByRole('heading',{name:/^(ยืนยันการจองแล้ว|ชำระเงินสำเร็จ)$/})).toBeVisible({timeout:30000})
 const paid=state();assert.equal(paid.bill.status,'verified');assert.equal(paid.hold.status,'consumed');assert.equal(paid.units.length,10)
 assert.deepEqual(paid.bill.package_participants,original.bill.package_participants)
 for(const unit of paid.units)assert.deepEqual(unit.participants,original.bill.package_participants)
 assert.equal(paid.bill.checkout_deadline,original.bill.checkout_deadline)
 await b.page.reload({waitUntil:'networkidle'});assert.equal(state().units.length,10)
 await b.page.evaluate(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));await b.page.screenshot({path:root+'/family-confirmed.png',fullPage:true})
 fs.writeFileSync(root+'/result.json',JSON.stringify({pass:true,checks:['Fixed-discount Private Family payment consumes only upon verification','Ten units retain the exact complete original parent/child participant set','Original deadline remains and reload creates no extra units'],id,base,binding:prior.binding,testDefinitionSha256:createHash('sha256').update(fs.readFileSync(import.meta.filename)).digest('hex')},null,2));console.log({root,passed:3})
}catch(e){fs.writeFileSync(root+'/failure.json',JSON.stringify({error:String(e),state:state()},null,2));throw e}finally{await b.context.close();await b.browser.close()}
