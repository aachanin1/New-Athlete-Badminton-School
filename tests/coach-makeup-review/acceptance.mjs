import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {chromium,expect} from '@playwright/test'
import {createServerClient} from '@supabase/ssr'
import {run,env,sql,q,fixtures} from './runtime.mjs'
const f=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json'))),base=process.env.REVIEW_BASE||'http://127.0.0.1:63110'
const out=path.join(run.outputDir,'acceptance-'+Date.now()+'-'+randomUUID());fs.mkdirSync(out)
const checks=[],errors=[];const check=(value,label)=>{assert.ok(value,label);checks.push(label);console.log(label)}
const read=s=>JSON.parse(sql(s)),rows=()=>read(`SELECT coalesce(jsonb_agg(r),'[]') FROM admin_makeup_review_rows_v1(${q(f.month+'-01')}) r`)
const rights=()=>read("SELECT jsonb_build_object('bills',(SELECT md5(coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.id)::text,'')) FROM bookings b),'uses',(SELECT md5(coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.id)::text,'')) FROM task10_family_makeup_uses u),'wallet',(SELECT md5(coalesce(jsonb_agg(to_jsonb(w) ORDER BY w.id)::text,'')) FROM lesson_wallet_credits w),'payments',(SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id)::text,'')) FROM payments p))")
const before=rights(),r=f.rounds[0]
const browser=await chromium.launch({headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']})
async function actor(account){const cookies=new Map(),auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:values=>values.forEach(v=>cookies.set(v.name,v.value))}});assert.ifError((await auth.auth.signInWithPassword({email:account.email,password:fixtures.password})).error);const context=await browser.newContext({viewport:{width:430,height:932},locale:'th-TH',timezoneId:'Asia/Bangkok',permissions:['camera','geolocation'],geolocation:{latitude:13.7,longitude:100.5},extraHTTPHeaders:{Origin:base}});await context.addCookies([...cookies].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/',sameSite:'Lax'})));const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return{context,page}}
const admin=await actor(f.sa),coach=await actor(f.coach),other=await actor(f.coach2)
const queue=async(status='all')=>{const res=await admin.context.request.get(base+'/api/admin/makeup/queue?'+new URLSearchParams({month:f.month,status,pageSize:'50'}));assert.equal(res.status(),200,await res.text());return res.json()}
try{
 check(f.rounds.every(r=>rows().some(s=>s.id===r.id)),'All six source-backed Makeup rounds appear in the actual SQL projection')
 for(const status of ['all','waiting_attendance','coach_evidence'])check((await queue(status)).sessions.some(s=>s.id===r.id),'Case appears through authenticated API filter '+status)
 const photo=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9mQAAAAASUVORK5CYII=','base64')
 const checkin=(actor,slot)=>actor.context.request.post(base+'/api/coach/checkin',{multipart:{scheduleSlotId:slot,lat:'13.7',lng:'100.5',photoSource:'camera_capture',photo:{name:'synthetic.png',mimeType:'image/png',buffer:photo}}})
 const denied=await checkin(coach,r.slot);check(denied.status()===400,'Coach cannot retrospectively check in before Admin returns this exact slot')
 const attendance=(actor,round,status='present',child=round.child)=>actor.context.request.post(base+'/api/coach/attendance',{data:{bookingSessionId:round.id,studentId:child,studentType:'child',status}})
 check((await attendance(coach,r)).status()===403,'Coach attendance remains blocked before check-in')
 await admin.page.goto(base+`/admin/makeup?month=${f.month}&session=${r.id}`)
 const card=admin.page.getByTestId('makeup-review-group').filter({has:admin.page.getByTestId('review-session-'+r.id)})
 await expect(card).toBeVisible();await expect(card.getByText('รอบชดเชย',{exact:true})).toBeVisible()
 await expect(card.getByRole('button',{name:'ไม่ได้เปิดสอน / คืนสิทธิ์',exact:true})).toBeEnabled()
 await expect(card.getByRole('button',{name:'ปิดเคสทั้งรอบ',exact:true})).toBeEnabled()
 check(true,'Mobile UI identifies Makeup and preserves original administrative button availability')
 const send=admin.page.waitForResponse(res=>res.url().endsWith('/api/admin/makeup/review-request')&&res.request().method()==='POST')
 await card.getByRole('button',{name:/^ส่งให้โค้ชตรวจสอบรอบนี้/}).click();const response=await send;assert.equal(response.status(),200,await response.text());const receipt=await response.json(),payload=response.request().postDataJSON()
 check(receipt.confirmed===true&&receipt.targetCount===1,'Actual Admin button returns one exact session with a durable receipt')
 const counts=()=>read(`SELECT jsonb_build_object('receipts',(SELECT count(*) FROM admin_makeup_review_requests WHERE request_id=${q(payload.requestId)}),'audits',(SELECT count(*) FROM activity_logs WHERE action='attendance_gap_request_coach_review' AND entity_id=${q(r.id)}),'notifications',(SELECT count(*) FROM notifications WHERE user_id=${q(f.coach.id)}))`)
 const countBefore=counts();const replay=await admin.context.request.post(base+'/api/admin/makeup/review-request',{data:payload});check(replay.status()===200&&(await replay.json()).idempotentReplay===true,'Retry of the same committed request returns original receipt');assert.deepEqual(counts(),countBefore)
 check(sql(`SELECT count(*) FROM notifications WHERE user_id=${q(f.coach2.id)}`)==='0','Other coach receives no notification')
 check((await checkin(other,r.slot)).status()===403,'Other coach cannot use returned slot')
 check((await checkin(coach,f.rounds[1].slot)).status()===400,'Returning one slot does not unlock another expired slot')
 await coach.page.goto(base+`/coach/checkin?date=${r.date}&slot=${r.slot}`)
 await coach.page.getByRole('button',{name:'เปิดกล้องหน้า',exact:true}).click();await expect(coach.page.getByText('กล้องพร้อม',{exact:true})).toBeVisible({timeout:15000})
 await coach.page.getByRole('button',{name:'ถ่ายเซลฟี่',exact:true}).click()
 const gps=coach.page.getByRole('button',{name:'อนุญาตตำแหน่ง',exact:true});if(await gps.isVisible())await gps.click()
 const saved=coach.page.waitForResponse(res=>res.url().endsWith('/api/coach/checkin')&&res.request().method()==='POST')
 await coach.page.getByRole('button',{name:'เช็คอิน',exact:true}).click();assert.equal((await saved).status(),200)
 check(sql(`SELECT count(*) FROM coach_checkins WHERE coach_id=${q(f.coach.id)} AND schedule_slot_id=${q(r.slot)} AND photo_url<>'' AND location_lat IS NOT NULL AND location_lng IS NOT NULL`)==='1','Coach UI captures synthetic camera/GPS through actual API and Storage')
 await coach.page.goto(base+`/coach/attendance?date=${r.date}&slot=${r.slot}`)
 const marked=coach.page.waitForResponse(res=>res.url().endsWith('/api/coach/attendance')&&res.request().method()==='POST')
 await coach.page.getByRole('button',{name:'มา',exact:true}).click();assert.equal((await marked).status(),200)
 check(sql(`SELECT count(*) FROM attendance WHERE booking_session_id=${q(r.id)} AND student_id=${q(r.child)} AND coach_id=${q(f.coach.id)} AND status='present'`)==='1','Coach UI records attendance for the exact learner')
 check(!rows().some(s=>s.id===r.id),'Fully completed Makeup case leaves the review queue')
 check((await attendance(coach,r)).status()===200&&sql(`SELECT count(*) FROM attendance WHERE booking_session_id=${q(r.id)} AND student_id=${q(r.child)}`)==='1','Attendance replay keeps exactly one row')
 check((await attendance(coach,r,'present',f.children[1])).status()===403,'Wrong learner identity is rejected')
 check((await checkin(coach,r.slot)).status()===400&&sql(`SELECT count(*) FROM coach_checkins WHERE schedule_slot_id=${q(r.slot)} AND coach_id=${q(f.coach.id)}`)==='1','Check-in replay cannot add another check-in')
 const evidence=f.rounds[1];sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);INSERT INTO attendance(booking_session_id,student_id,student_type,coach_id,status) VALUES(${q(evidence.id)},${q(evidence.child)},'child',${q(f.coach.id)},'absent');UPDATE booking_sessions SET status='absent' WHERE id=${q(evidence.id)};COMMIT;`)
 check(rows().find(s=>s.id===evidence.id)?.needs_evidence===true,'Recorded Makeup absence still requires missing coach evidence')
 check((await queue('coach_evidence')).sessions.some(s=>s.id===evidence.id),'Evidence-only Makeup remains visible under the broadened filter')
 const bad=await admin.context.request.patch(base+'/api/admin/makeup',{data:{session_id:evidence.id,action:'confirm_absent',reason:'synthetic duplicate entitlement rejection'}});check(bad.status()===400,'Legacy entitlement action still rejects a Makeup source')
 const next=f.rounds[2],stale=(await queue()).sessions.find(s=>s.id===next.id),key=[stale.date,stale.start_time,stale.end_time,stale.branch_name,stale.course_type,stale.coach_name].join('|')
 sql(`UPDATE coach_assignment_groups SET coach_id=${q(f.coach2.id)} WHERE id=${q(next.group)}`)
 const changed=await admin.context.request.post(base+'/api/admin/makeup/review-request',{data:{anchor:next.id,group:key,members:[next.id],action:'request_coach_review',requestId:randomUUID()}});check(changed.status()===409,'Changed roster invalidates stale request without notifying the old coach')
 assert.deepEqual(rights(),before);check(true,'Bills, payments, Makeup consumption receipts and Wallet remain byte-equivalent after send/check-in/attendance/replay/absence')
 await admin.page.reload();await admin.page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});await admin.page.setViewportSize({width:1440,height:1000});await admin.page.reload();await admin.page.screenshot({path:path.join(out,'desktop.png'),fullPage:true})
 check(errors.length===0,'No browser exceptions throughout Admin and Coach flow')
 fs.writeFileSync(path.join(out,'pass.json'),JSON.stringify({checks,errors,before,after:rights(),sourceFiles:Object.fromEntries(['src/app/api/admin/makeup/route.ts','supabase/migrations/20261107150253_coach_makeup_review_actions_v1.sql','src/lib/session-attendance-status.ts','src/lib/admin-makeup-read-model.ts','src/lib/admin-makeup-selection.ts','src/components/admin/makeup-client.tsx','supabase/migrations/20261107142057_coach_makeup_review_v1.sql','tests/coach-makeup-review/acceptance.mjs'].map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),at:new Date().toISOString()},null,2))
 console.log(JSON.stringify({pass:true,checks:checks.length,out}))
}catch(error){fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:String(error),checks,errors},null,2));await admin.page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});throw error}finally{await browser.close()}

