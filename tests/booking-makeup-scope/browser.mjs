import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { chromium,expect } from '@playwright/test'
import { createServerClient } from '@supabase/ssr'
import { run,env,sql,q } from './runtime.mjs'
import { fixture as f,body,session,rpc,read,snapshot,evidence,hashFile } from './helpers.mjs'
const base='http://127.0.0.1:63010',root=path.join(run.outputDir,'browser-'+Date.now()+'-'+randomUUID())
fs.mkdirSync(root)
sql("UPDATE system_settings SET value=jsonb_set(value,'{revision}',to_jsonb('scope-local-fixture-v1'::text)) WHERE key='payment_transfer_settings'")
const cookies=new Map(),auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:values=>values.forEach(v=>cookies.set(v.name,v.value))}})
assert.ifError((await auth.auth.signInWithPassword({email:f.parent.email,password:f.password})).error)
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Bangkok',locale:'th-TH',extraHTTPHeaders:{Origin:base}})
await context.addCookies([...cookies].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/',sameSite:'Lax'})))
const page=await context.newPage(),checks=[],errors=[],egress=[],network=[]
page.setDefaultTimeout(20000)
page.on('pageerror',e=>errors.push(e.message))
page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))network.push({path:new URL(r.url()).pathname,status:r.status()})})
await context.route('**/*',route=>{const host=new URL(route.request().url()).host;if(![new URL(base).host,new URL(env.apiUrl).host].includes(host)){egress.push(host);return route.abort()}return route.continue()})
const check=(ok,name)=>{assert.ok(ok,name);checks.push(name);console.log(name)}
const oldIds=read(`SELECT jsonb_agg(id) FROM bookings WHERE user_id=${q(f.parent.id)} AND status='verified'`),before=snapshot(oldIds)
try{
 const targetDate=sql(`SELECT (date ${q(f.dates.future)}+1)::date`),baseline=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'baseline-state.json')))
 const corrupt=baseline.past.destinations[0],input=body([session(targetDate)])
 sql(`BEGIN;SET LOCAL session_replication_role=replica;UPDATE task10_family_makeup_uses SET attending_child_id=${q(f.children[1])} WHERE destination_session_id=${q(corrupt)};COMMIT;`)
 try{
  const denied=await context.request.post(base+'/api/booking-checkout',{data:{action:'create',requestId:randomUUID(),input}})
  const result=await denied.json()
  check(denied.status()===409&&result.definitive===true&&result.error==='พบข้อมูลชุดราคาของรายการเดิมไม่สอดคล้องกัน กรุณาติดต่อเจ้าหน้าที่เพื่อตรวจสอบ','Real HTTP409 uses clear conflict message and definitive rollback')
 }finally{sql(`BEGIN;SET LOCAL session_replication_role=replica;UPDATE task10_family_makeup_uses SET attending_child_id=${q(f.children[0])} WHERE destination_session_id=${q(corrupt)};COMMIT;`)}
 const anonymous=await fetch(base+'/api/booking-checkout?catalog=1')
 check(anonymous.status===401,'Unauthenticated checkout cannot read private booking data')
 const wrongOrigin=await context.request.post(base+'/api/booking-checkout',{headers:{Origin:'https://example.invalid'},data:{}})
 check(wrongOrigin.status()===403,'Cross-origin checkout mutation remains blocked')
 const foreign=await context.request.post(base+'/api/booking-checkout',{data:{action:'create',requestId:randomUUID(),input:{...input,childId:f.foreignChild,sessions:[session(targetDate,f.foreignChild)]}}})
 check(foreign.status()===409,'Authenticated parent cannot book another family child')
 await page.goto(base+'/dashboard/booking',{waitUntil:'networkidle'})
 await expect(page.getByRole('heading',{name:'จองคอร์สเรียน',exact:true})).toBeVisible()
 await page.getByText('เด็ก (กลุ่ม)',{exact:true}).first().click()
 await page.getByTestId('booking-next').click()
 await page.getByRole('button',{name:'เปลี่ยนผู้เรียน',exact:true}).click()
 await page.getByRole('checkbox',{name:/ทดสอบ 1/}).check()
 await page.getByRole('checkbox',{name:/ทดสอบ 2/}).uncheck()
 await page.getByRole('button',{name:/ใช้ผู้เรียนที่เลือก/}).click()
 if(!await page.getByTestId('booking-calendar').isVisible()){
  await page.getByRole('button',{name:'เปลี่ยนสาขา',exact:true}).click()
  await page.getByRole('checkbox',{name:/สาขาจำลองข้ามเดือน/}).check()
  await page.getByRole('button',{name:/ใช้สาขาที่เลือก/}).click()
 }
 await page.getByTestId('booking-date-'+targetDate).click()
 const slot=page.getByTestId(`booking-slot-${targetDate}-${f.branch}-17:00`)
 await expect(slot).toBeEnabled();await slot.click()
 await expect(page.getByTestId('booking-checkout-total')).toContainText('625')
 await expect(page.getByTestId('booking-confirm')).toBeEnabled()
 await page.screenshot({path:path.join(root,'mobile-summary.png'),fullPage:true})
 await page.getByTestId('booking-confirm').click()
 await expect(page.getByTestId('booking-payment')).toBeVisible({timeout:30000})
 const id=new URL(page.url()).searchParams.get('payment');assert.ok(id)
 const bill=read(`SELECT jsonb_build_object('price',total_price,'child',child_id,'month',month,'year',year,'status',status,'sessions',total_sessions) FROM bookings WHERE id=${q(id)}`)
 check(bill.price===625&&bill.child===f.children[0]&&bill.sessions===1&&bill.status==='pending_payment','Mobile UI creates correct learner bill at625 from one prior purchase, excluding old Makeup')
 await expect(page.getByTestId('payment-countdown')).toBeVisible()
 await expect(page.getByTestId('payment-transfer-number')).toHaveText('1234567890')
 await page.screenshot({path:path.join(root,'mobile-payment.png'),fullPage:true})
 const deadline=sql(`SELECT checkout_deadline FROM bookings WHERE id=${q(id)}`)
 await page.reload({waitUntil:'networkidle'});await expect(page.getByTestId('payment-countdown')).toBeVisible()
 check(sql(`SELECT checkout_deadline FROM bookings WHERE id=${q(id)}`)===deadline,'Refreshing payment preserves original deadline and bill')
 const updatedRound=session(targetDate,f.children[0],'10:00'),updatedInput=body([updatedRound]),policy=rpc('task10_booking_policy_quote_v1',`${q(f.parent.id)},${q(f.courses.kids_group)},${q(f.dates.month)},'progressive',${q(id)}`)
 const edited=await context.request.put(base+'/api/bookings',{data:{...updatedInput,bookingId:id,totalAmount:625,expectedTotalPrice:625,clientRequestId:randomUUID(),expectedPolicyFingerprint:policy.fingerprint}})
 assert.equal(edited.status(),200,await edited.text());check(true,'Authenticated HTTP edit succeeds through shared guard')
 const cancel=await context.request.delete(base+'/api/bookings',{data:{action:'cancel_pending_booking',bookingId:id,clientRequestId:randomUUID(),expectedScopeRevision:body([updatedRound]).expectedScopeRevision}})
 assert.equal(cancel.status(),200,await cancel.text());check(sql(`SELECT status FROM bookings WHERE id=${q(id)}`)==='cancelled','Authenticated HTTP cancel succeeds through shared guard')
 assert.deepEqual(snapshot(oldIds),before);check(true,'Browser/API flow preserves every pre-existing verified source bill and Makeup receipt')
 check(errors.length===0&&egress.length===0,'No browser exceptions or non-owned network egress')
 const result={checks,errors,egress,network,bill,id,base,build:JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'app-candidate1/.next/booking-makeup-scope-local-build.json'))),suiteHash:hashFile('tests/booking-makeup-scope/browser.mjs')}
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(result,null,2));evidence('browser-pass',result)
 console.log(JSON.stringify({passed:checks.length,root}))
}catch(error){await page.screenshot({path:path.join(root,'failure.png'),fullPage:true}).catch(()=>{});fs.writeFileSync(path.join(root,'failure.json'),JSON.stringify({checks,errors,egress,network,error:String(error)},null,2));throw error}
finally{await context.close();await browser.close()}
