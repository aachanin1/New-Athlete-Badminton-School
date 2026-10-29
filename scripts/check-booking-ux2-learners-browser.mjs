import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {expect} from '@playwright/test'
import {run,env,sql,q,fixtures} from '../tests/booking-ux/runtime.mjs'
import {adminBrowser} from '../tests/booking-ux/browser.mjs'

// Author-only by the delegated UI worker. The primary executes this harness.
// Fixtures, app, Auth, API and every SQL write remain physically guarded Local.
const base=process.env.BOOKING_UX2_BASE||'http://127.0.0.1:3150'
assert.match(base,/^http:\/\/127\.0\.0\.1:315[0-3]$/)
const runtime=JSON.parse(fs.readFileSync(process.env.BOOKING_UX2_RUNTIME||'.playwright/booking-ux-1/app-runtime.json','utf8'))
assert.equal(runtime.port,Number(new URL(base).port));assert.equal(runtime.api,env.apiUrl)
const binding=JSON.parse(fs.readFileSync(path.join(runtime.app,'.next/booking-ux-1-local-build.json'),'utf8'))
assert.equal(binding.runId,run.runId);assert.equal(binding.api,env.apiUrl)
assert.equal(binding.buildId,fs.readFileSync(path.join(runtime.app,'.next/BUILD_ID'),'utf8').trim())
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const source=JSON.parse(fs.readFileSync(path.join(runtime.app,'source-manifest.json'),'utf8'))
for(const [file,digest] of Object.entries(source.hashes))if(/^(src\/|public\/|supabase\/migrations\/|package(?:-lock)?\.json$|next\.config)/.test(file))assert.equal(sha(file),digest,'Built source differs: '+file)
const root=path.resolve('.playwright/booking-ux-2/revision-learners-20261029/browser-'+Date.now()+'-'+randomUUID().slice(0,8))
fs.mkdirSync(root,{recursive:true})
const f=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json'),'utf8'))
const checks=[],errors=[],egress=[],traffic=[],browsers=[],actors=[],bills=[]
const check=(ok,name)=>{assert.ok(ok,name);checks.push(name);console.log(name)}
const read=statement=>JSON.parse(sql(statement)),arg=value=>value==null?'NULL':typeof value==='object'?q(JSON.stringify(value))+'::jsonb':q(value)
const rpc=(name,...args)=>read(`SELECT ${name}(${args.map(arg).join(',')})`)
const escaped=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const state=id=>read(`SELECT jsonb_build_object('bill',to_jsonb(b),'hold',(SELECT to_jsonb(r) FROM progressive_coupon_reservations r WHERE booking_id=b.id),'sessions',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]') FROM booking_sessions s WHERE booking_id=b.id),'units',(SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY ordinal),'[]') FROM booking_package_units u WHERE booking_id=b.id),'uses',(SELECT count(*) FROM coupon_usages WHERE booking_id=b.id),'changes',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]') FROM booking_ux_coupon_changes c WHERE booking_id=b.id),'payments',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]') FROM payments p WHERE booking_id=b.id)) FROM bookings b WHERE id=${q(id)}`)
const activeSessions=s=>s.sessions.filter(row=>!['cancelled','walleted','rescheduled'].includes(row.status))
const members=ids=>[...ids].map(id=>id||'self').sort()
const sameMembers=(actual,expected)=>JSON.stringify(members(actual))===JSON.stringify(members(expected))
const offset=Number(process.env.BOOKING_UX2_LEARNER_DAY_OFFSET||25)
assert.ok(Number.isInteger(offset)&&offset>=0&&offset<=25)
const day=n=>sql(`SELECT (date_trunc('month',clock_timestamp() AT TIME ZONE 'Asia/Bangkok')+interval '1 month'+make_interval(days=>${n}))::date::text`)
function round(childId,n,course='kids_group'){
 const date=day(n),template=sql(`SELECT id FROM schedule_templates WHERE branch_id=${q(f.branch)} AND course_type_id=${q(f.courses[course])} AND day_of_week=extract(dow FROM date ${q(date)}) AND start_time='10:00' AND end_time='11:00' AND is_active LIMIT 1`)
 assert.match(template,/^[a-f0-9-]{36}$/,'Missing exact active Local test template: '+course+' '+date)
 return{date,startTime:'10:00',endTime:'11:00',branchId:f.branch,childId,scheduleTemplateId:template}
}
async function actor(label){const a=await fixtures.account('user',label);actors.push(a.id);return a}
function child(a,label){const c={id:randomUUID(),name:label+' '+randomUUID().slice(0,4)};sql(`INSERT INTO children(id,parent_id,full_name) VALUES(${q(c.id)},${q(a.id)},${q(c.name)})`);return c}
function coupon(type='fixed',value=500,min=0){const c={id:randomUUID(),code:'UILEARN'+randomUUID().slice(0,7).toUpperCase()};sql(`INSERT INTO coupons(id,code,discount_type,discount_value,min_purchase,max_uses,created_by) VALUES(${q(c.id)},${q(c.code)},${q(type)},${value},${min},1,${q(f.sa.id)})`);return c}
function kids(a,rounds,c){const date=rounds[0].date,course=f.courses.kids_group,policy=rpc('task10_booking_policy_quote_v1',a.id,course,date.slice(0,7)+'-01','progressive',null),baseline=read(`SELECT to_jsonb(x) FROM progressive_legacy_baseline_v1(${q(a.id)},${q(course)},${+date.slice(0,4)},${+date.slice(5,7)})x`),result=rpc('booking_ux_create_v1',a.id,randomUUID(),{courseTypeId:course,branchId:f.branch,learnerType:rounds[0].childId?'child':'self',childId:rounds[0].childId,sessions:rounds,coupon:c,expectedScopeRevision:0,expectedLegacyBaselineSessions:baseline.baseline_sessions,expectedLegacyBaselineFingerprint:baseline.baseline_fingerprint,expectedPolicyFingerprint:policy.fingerprint});bills.push(result.bookingId);return result.bookingId}
function pack(a,course='private',c=null,rounds=[],participants=[null]){
 const p=read(`SELECT to_jsonb(p) FROM booking_ux_packages p WHERE course=${q(course)} AND quantity=10 LIMIT 1`),date=rounds[0]?.date||day(offset),gross=Number(sql(`SELECT task10_legacy_price_v1(NULL,${q(f.courses[course])},${+date.slice(5,7)},${+date.slice(0,4)},10,NULL)`)),quote=c?rpc('booking_ux_coupon_quote_v2',a.id,c.id,f.courses[course],gross,null):null
 const result=rpc('booking_ux_create_v1',a.id,randomUUID(),{packageId:p.id,packageRevision:p.revision,courseTypeId:f.courses[course],branchId:f.branch,participants,month:+date.slice(5,7),year:+date.slice(0,4),totalSessions:10,totalAmount:gross,expectedTotalPrice:quote?.totalPrice??gross,sessions:rounds,coupon:c});bills.push(result.bookingId);return result.bookingId
}
const schema=read("SELECT jsonb_build_object('migrations',(SELECT jsonb_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations),'functionCount',count(*),'functionDefinitionsMd5',md5(string_agg(replace(pg_get_functiondef(p.oid),chr(13)||chr(10),chr(10)),E'\\n' ORDER BY p.oid::regprocedure::text))) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace")
const helpers=['tests/booking-ux/runtime.mjs','tests/booking-ux/browser.mjs','tests/branch-closure/isolated-runtime.mjs','tests/branch-closure/fixtures.mjs','scripts/verify-lesson-source-test-target.mjs']
const evidence={base,target:run.target,runId:run.runId,runtime,binding,schema,testDefinitionSha256:sha(import.meta.filename),helperHashes:Object.fromEntries(helpers.map(file=>[file,sha(file)]))}
fs.writeFileSync(path.join(root,'inputs.json'),JSON.stringify(evidence,null,2))
async function open(a,url){const b=await adminBrowser(base,a);browsers.push(b);b.page.on('pageerror',error=>errors.push(error.message));await b.context.route('**/*',route=>{const url=new URL(route.request().url());if(['data:','blob:'].includes(url.protocol)||[new URL(base).host,new URL(env.apiUrl).host].includes(url.host))return route.fallback();egress.push(url.host);return route.abort()});b.page.on('request',request=>{if(new URL(request.url()).pathname==='/api/booking-checkout'&&request.method()==='POST'){const body=request.postDataJSON();traffic.push({actor:a.id,action:body.action,preview:body.preview===true,inputAction:body.input?.action,requestId:body.requestId})}});await b.page.setViewportSize({width:390,height:844});await b.page.goto(base+url,{waitUntil:'networkidle'});return b.page}
async function snap(page,name){await page.evaluate(async()=>{window.scrollTo({top:0,left:0,behavior:'instant'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))});await page.screenshot({path:path.join(root,name+'.png'),fullPage:true})}
async function responsive(page,name){for(const width of [320,390,1280]){await page.setViewportSize({width,height:width===1280?900:844});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits width'+width);await snap(page,name+'-'+width)}await page.setViewportSize({width:390,height:844})}
const expectTotal=(page,amount,testId='booking-edit-total')=>expect(page.getByTestId(testId)).toHaveText('฿'+amount.toLocaleString(),{timeout:25000})
async function edit(page,amount){await expectTotal(page,amount,'payment-net-total');await page.getByRole('button',{name:/^แก้ไขวันเรียน \/ คูปอง/}).click();await expect(page.getByTestId('booking-calendar')).toBeVisible({timeout:20000});await expect(page.getByTestId('booking-edit-summary')).toHaveCount(0);await expect(page.getByTestId('pending-payment-entry')).not.toBeVisible();await expectTotal(page,amount)}
async function chooseLearner(page,c,{required=null,requiredSelf=false,selected=true,button=null}={}){
 await (button||page.getByRole('button',{name:'เปลี่ยนผู้เรียน',exact:true})).click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:/^เลือกผู้เรียน/})).toBeVisible()
 if(required)await expect(dialog.getByRole('checkbox',{name:new RegExp(escaped(required.name))})).toBeDisabled()
 if(requiredSelf)await expect(dialog.getByRole('checkbox',{name:/\(ตนเอง\)/})).toBeDisabled()
 const target=dialog.getByRole('checkbox',{name:new RegExp(escaped(c.name))});await expect(target).toBeEnabled();await target.setChecked(selected);await dialog.getByRole('button',{name:/^ใช้ผู้เรียน.*ที่เลือก/}).click();await expect(dialog).toHaveCount(0)
}
async function toggle(page,date){await expect(page.getByTestId('booking-date-'+date)).toBeEnabled();await page.getByTestId('booking-date-'+date).click();const slot=page.getByTestId(`booking-slot-${date}-${f.branch}-10:00`);await expect(slot).toBeEnabled();await slot.click()}
async function save(page,amount,double=false){await expect(page.getByTestId('booking-edit-save')).toBeEnabled();if(double)await page.getByTestId('booking-edit-save').dblclick();else await page.getByTestId('booking-edit-save').click();await expect(page.getByTestId('booking-stage2-editor')).toHaveCount(0,{timeout:30000});await expectTotal(page,amount,'payment-net-total')}
async function pay(page,name){await expect(page.getByTestId('payment-transfer-card')).toBeVisible({timeout:20000});await page.getByLabel('รูปสลิปการโอนเงิน',{exact:true}).setInputFiles({name:name+'.png',mimeType:'image/png',buffer:Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBXkAAAAASUVORK5CYII=','base64'),Buffer.from(randomUUID())])});await page.getByRole('button',{name:/3. ส่งสลิปยืนยันการชำระเงิน/}).click();await expect(page.getByRole('heading',{name:'ชำระเงินสำเร็จ',exact:true})).toBeVisible({timeout:30000})}

let currentPage
try{
 const ka=await actor('ตรวจ UI เพิ่มเด็ก'),kc1=child(ka,'ผู้เรียนเดิมเด็ก'),kc2=child(ka,'ผู้เรียนเพิ่มเด็ก'),fixed=coupon('fixed',500,1200),kr=[round(kc1.id,offset),round(kc1.id,offset+1),round(kc1.id,offset+2)],kid=kids(ka,kr,fixed)
 currentPage=await open(ka,'/dashboard/booking?payment='+kid);const kp=currentPage,original=state(kid)
 await edit(kp,1375);await chooseLearner(kp,kc2,{required:kc1});await expect(kp.getByTestId('booking-edit-missing-learner-rounds')).toContainText(kc2.name);await expect(kp.getByTestId('booking-edit-save')).toBeDisabled()
 await expect(kp.getByRole('group',{name:'เลือกผู้เรียนที่ต้องการเลือกวัน',exact:true}).getByRole('button',{name:new RegExp(escaped(kc2.name))})).toHaveAttribute('aria-pressed','true')
 check(JSON.stringify(state(kid))===JSON.stringify(original),'Kids chooses an owned new child, locks original, shows missing-round state and writes nothing')
 await snap(kp,'01-kids-new-child-missing');await toggle(kp,kr[0].date);await expectTotal(kp,2000);await expect(kp.getByText('รวมทั้งหมด 4 รอบ',{exact:true})).toBeVisible()
 check(JSON.stringify(state(kid))===JSON.stringify(original),'Kids fourth child-round at same slot quotes2500 minus500 =2000 without mutating original')
 const addedRoundChip=kp.getByRole('button',{name:new RegExp('^นำรอบ .* ของ '+escaped(kc2.name)+' ออก$')}),originalRoundChips=kp.getByRole('button',{name:new RegExp('^นำรอบ .* ของ '+escaped(kc1.name)+' ออก$')})
 await expect(addedRoundChip).toContainText(kc2.name);await expect(originalRoundChips).toHaveCount(3);await addedRoundChip.click();await expect(kp.getByTestId('booking-edit-missing-learner-rounds')).toContainText(kc2.name);await expect(originalRoundChips).toHaveCount(3);await expect(kp.getByTestId('booking-edit-save')).toBeDisabled();await kp.getByTestId(`booking-slot-${kr[0].date}-${f.branch}-10:00`).click();await expectTotal(kp,2000)
 check(JSON.stringify(state(kid))===JSON.stringify(original),'Same-slot Kids chips identify their exact child; removing added-child round preserves all three originals and only affects draft')
 await responsive(kp,'02-kids-four-child-rounds')
 await chooseLearner(kp,kc2,{required:kc1,selected:false});await expectTotal(kp,1375);await expect(kp.getByTestId('booking-edit-missing-learner-rounds')).toHaveCount(0);await expect(kp.getByText('รวมทั้งหมด 3 รอบ',{exact:true})).toBeVisible()
 check(JSON.stringify(state(kid))===JSON.stringify(original),'Removing only a draft-added child restores three original rounds and1375 without data or quota effects')
 await chooseLearner(kp,kc2,{required:kc1});await toggle(kp,kr[0].date);await expectTotal(kp,2000);await kp.getByRole('button',{name:'กลับโดยไม่บันทึก',exact:true}).click();await expectTotal(kp,1375,'payment-net-total')
 check(JSON.stringify(state(kid))===JSON.stringify(original),'Cancelling the added-child draft preserves original bill,sessions,coupon,deadline and audit exactly')
 await edit(kp,1375);await chooseLearner(kp,kc2,{required:kc1});await toggle(kp,kr[0].date);await expectTotal(kp,2000);const beforeSave=traffic.length;await save(kp,2000,true)
 let s=state(kid);check(s.bill.id===kid&&s.bill.child_id===null&&s.bill.total_sessions===4&&s.bill.entitlement_sessions===4&&s.bill.total_price===2000&&activeSessions(s).filter(r=>r.child_id===kc1.id).length===3&&activeSessions(s).filter(r=>r.child_id===kc2.id).length===1&&s.hold.status==='reserved'&&s.units.length===0&&s.bill.checkout_deadline===original.bill.checkout_deadline,'Kids save keeps same bill and deadline,exact3+1learner rows,four entitlements,2000 and unpaid hold')
 check(traffic.slice(beforeSave).filter(t=>t.actor===ka.id&&t.action==='set'&&!t.preview&&t.inputAction==='edit').length===1&&sql(`SELECT count(*) FROM bookings WHERE user_id=${q(ka.id)}`)==='1','Kids double click commits one edit without another bill or duplicated learner rows')
 await kp.reload({waitUntil:'networkidle'});await edit(kp,2000);await expect(kp.getByRole('group',{name:'เลือกผู้เรียนที่ต้องการเลือกวัน'}).getByRole('button')).toHaveCount(2)
 await kp.getByRole('button',{name:'เปลี่ยนผู้เรียน',exact:true}).click();for(const c of [kc1,kc2])await expect(kp.getByRole('dialog').getByRole('checkbox',{name:new RegExp(escaped(c.name))})).toBeDisabled();await kp.getByRole('dialog').getByRole('button',{name:/^ใช้ผู้เรียนที่เลือก/}).click();await kp.getByRole('button',{name:'กลับโดยไม่บันทึก',exact:true}).click()
 check(activeSessions(state(kid)).length===4,'Reloaded editor hydrates both saved children as original learners without a duplicate summary')
 await pay(kp,'learners-kids');s=state(kid);check(s.bill.status==='verified'&&s.hold.status==='consumed'&&s.uses===0&&activeSessions(s).filter(r=>r.child_id===kc1.id).length===3&&activeSessions(s).filter(r=>r.child_id===kc2.id).length===1&&s.bill.checkout_deadline===original.bill.checkout_deadline,'Real Local Kids PNG settles2000,consumes once and preserves every exact learner row')
 await snap(kp,'03-kids-multi-child-paid')

 const za=await actor('ตรวจ UI Private ไม่เลือกรอบ'),zc=child(za,'ผู้เรียนเพิ่ม Private ว่าง'),zcode=coupon(),zid=pack(za,'private',zcode),zp=await open(za,'/dashboard/booking?payment='+zid);currentPage=zp;const zb=state(zid)
 await edit(zp,7500);await chooseLearner(zp,zc,{requiredSelf:true});await expectTotal(zp,7500);await expect(zp.getByText('รวมทั้งหมด 0 รอบ',{exact:true})).toBeVisible();await expect(zp.getByTestId('booking-edit-save')).toBeEnabled()
 check(JSON.stringify(state(zid))===JSON.stringify(zb),'Private zero-round added Family previews same7500,allows save and grants no unpaid units')
 await chooseLearner(zp,zc,{selected:false});await expectTotal(zp,7500);await chooseLearner(zp,zc);await expectTotal(zp,7500);await snap(zp,'04-private-zero-round-family-draft');await save(zp,7500)
 s=state(zid);check(sameMembers(s.bill.package_participants,[null,zc.id])&&s.bill.total_sessions===10&&activeSessions(s).length===0&&s.units.length===0&&s.bill.checkout_deadline===zb.bill.checkout_deadline,'Private zero-round save changes only intended Family,keeps ten hours,original deadline and zero unpaid rights')
 await pay(zp,'learners-private-zero');s=state(zid);check(s.bill.status==='verified'&&s.hold.status==='consumed'&&s.units.length===10&&s.units.every(u=>sameMembers(u.participants,[null,zc.id])),'Private actual7500 PNG grants exactly ten complete self-plus-child Family units')
 await snap(zp,'05-private-zero-round-family-paid')

 const pa=await actor('ตรวจ UI Private หนึ่งรอบ'),pc=child(pa,'ผู้เรียนเพิ่ม Private ชั่วโมง'),pct=coupon('percent',10),pr=round(null,offset+1,'private'),pid=pack(pa,'private',pct,[pr]),pp=await open(pa,'/dashboard/booking?payment='+pid);currentPage=pp;const pb=state(pid)
 await edit(pp,7200);await chooseLearner(pp,pc,{requiredSelf:true});await expectTotal(pp,7200);await expect(pp.getByText('รวมทั้งหมด 1 รอบ',{exact:true})).toBeVisible();await expect(pp.getByText('นำออก 0 รอบ · เพิ่ม 0 รอบ',{exact:true})).toBeVisible()
 check(JSON.stringify(state(pid))===JSON.stringify(pb),'Private adding a member to an existing hour does not add an hour,change7200 or mutate persisted rows')
 await responsive(pp,'06-private-one-hour-family-draft');await save(pp,7200);s=state(pid)
 check(sameMembers(s.bill.package_participants,[null,pc.id])&&activeSessions(s).length===2&&sameMembers(activeSessions(s).map(r=>r.child_id),[null,pc.id])&&s.bill.total_sessions===10&&s.bill.total_price===7200&&s.bill.checkout_deadline===pb.bill.checkout_deadline,'Private save persists two exact participants in ONE scheduled hour with original ten-hour7200bill')
 await pay(pp,'learners-private-hour');s=state(pid);check(s.bill.status==='verified'&&s.hold.status==='consumed'&&activeSessions(s).length===2&&s.units.length===9&&s.units.every(u=>sameMembers(u.participants,[null,pc.id])),'Private real7200 payment yields one scheduled Family hour plus nine complete remaining units')
 await snap(pp,'07-private-one-hour-family-paid')

 const aa=await actor('ตรวจ UI ผู้ใหญ่ตนเอง'),ac=child(aa,'เด็กที่ไม่เลือกใน Adult'),aid=pack(aa,'adult_group'),ap=await open(aa,'/dashboard/booking?payment='+aid);currentPage=ap;const ab=state(aid),adultCode=coupon('percent',10),ar=round(null,offset+2,'adult_group')
 await edit(ap,5500);await expect(ap.getByRole('button',{name:'เปลี่ยนผู้เรียน',exact:true})).toHaveCount(0);await toggle(ap,ar.date)
 const asection=ap.getByTestId('booking-edit-coupon-'+aid);await asection.getByRole('textbox').fill(adultCode.code);await asection.getByRole('button',{name:'ใช้โค้ด',exact:true}).click();await expectTotal(ap,4950)
 check(state(aid).hold===null&&activeSessions(state(aid)).length===0,'Adult account with owned child has no learner chooser; ordinary date/coupon preview stays self-only without writes')
 await snap(ap,'08-adult-self-only-edit');await save(ap,4950);s=state(aid);check(sameMembers(s.bill.package_participants,[null])&&s.bill.child_id===null&&activeSessions(s).length===1&&activeSessions(s)[0].child_id===null&&s.bill.checkout_deadline===ab.bill.checkout_deadline,'Adult date/coupon save keeps self-only4950,one exact self round and original deadline')
 await pay(ap,'learners-adult');s=state(aid);check(s.bill.status==='verified'&&s.hold.status==='consumed'&&s.units.length===9&&s.units.every(u=>sameMembers(u.participants,[null]))&&activeSessions(s).every(r=>r.child_id!==ac.id),'Adult real4950 payment keeps one self round plus nine self-only remaining units')

 const ma=await actor('ตรวจ UI หลาย Private'),mc1=child(ma,'Private เดิมแพ็กเกจแรก'),mc2=child(ma,'Private เดิมแพ็กเกจสอง'),mc3=child(ma,'Private เพิ่มเฉพาะแรก'),mr1=round(mc1.id,offset+2,'private'),mr2={...mr1,childId:mc2.id},mid1=pack(ma,'private',null,[mr1],[mc1.id]),mid2=pack(ma,'private',null,[mr2],[mc2.id]),mp=await open(ma,'/dashboard/payments?legacy='+mid1+','+mid2);currentPage=mp;const mb1=state(mid1),mb2=state(mid2)
 await edit(mp,16000);const firstSelector=mp.getByRole('button',{name:/^เปลี่ยนผู้เรียนแพ็กเกจ/}).filter({hasText:mc1.name});await expect(firstSelector).toHaveCount(1);await chooseLearner(mp,mc3,{required:mc1,button:firstSelector});await expectTotal(mp,16000)
 await expect(mp.getByText('รวมทั้งหมด 2 รอบ',{exact:true})).toBeVisible();await expect(mp.getByText('นำออก 0 รอบ · เพิ่ม 0 รอบ',{exact:true})).toBeVisible()
 check(JSON.stringify(state(mid1))===JSON.stringify(mb1)&&JSON.stringify(state(mid2))===JSON.stringify(mb2),'Two Private bills at the same clock hour remain two units; targeted addition previews16000 with neither bill mutated')
 await snap(mp,'09-private-bulk-targeted-draft');await mp.getByRole('button',{name:'กลับโดยไม่บันทึก',exact:true}).click();await expectTotal(mp,16000,'payment-net-total');assert.deepEqual(state(mid1),mb1);assert.deepEqual(state(mid2),mb2)
 check(true,'Cancelling a targeted multi-Private learner addition preserves both original Family sets and complete bill rows')
 await edit(mp,16000);await chooseLearner(mp,mc3,{required:mc1,button:mp.getByRole('button',{name:/^เปลี่ยนผู้เรียนแพ็กเกจ/}).filter({hasText:mc1.name})});await expectTotal(mp,16000);await save(mp,16000)
 const ms1=state(mid1),ms2=state(mid2)
 check(sameMembers(ms1.bill.package_participants,[mc1.id,mc3.id])&&sameMembers(activeSessions(ms1).map(r=>r.child_id),[mc1.id,mc3.id])&&sameMembers(ms2.bill.package_participants,[mc2.id])&&sameMembers(activeSessions(ms2).map(r=>r.child_id),[mc2.id])&&ms1.bill.total_price===8000&&ms2.bill.total_price===8000&&ms1.bill.checkout_deadline===mb1.bill.checkout_deadline&&ms2.bill.checkout_deadline===mb2.bill.checkout_deadline,'Multi-Private save adds third child only to targeted bill,never transfers the other Family,price or deadlines')
 await responsive(mp,'10-private-bulk-payment-summary')
 check(errors.length===0&&egress.length===0,'All learner-addition UI cases have no page exception or external egress')
 // A fixed self-mode Kids bill is existing compatibility data, not a new child
 // selection option. The new UI must not send a child-only identity mutation.
 const la=await actor('ตรวจบิลรูปแบบผู้เรียนเดิม'),lid=kids(la,[round(null,offset)],null),lp=await open(la,'/dashboard/booking?payment='+lid);currentPage=lp;const lb=state(lid)
 await edit(lp,700);await expect(lp.getByRole('button',{name:'เปลี่ยนผู้เรียน',exact:true})).toHaveCount(0);await save(lp,700)
 check(state(lid).bill.learner_type==='self'&&state(lid).bill.child_id===null&&state(lid).bill.checkout_deadline===lb.bill.checkout_deadline&&activeSessions(state(lid)).length===1,'Fixed self-mode Kids compatibility bill can still save its original date/amount without entering new child-addition contract')
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify({pass:true,...evidence,checks,actors,bills,traffic,errors,egress},null,2));console.log(JSON.stringify({root,passed:checks.length}))
}catch(error){await currentPage?.screenshot({path:path.join(root,'failure.png'),fullPage:true}).catch(()=>{});fs.writeFileSync(path.join(root,'failure.json'),JSON.stringify({...evidence,checks,error:String(error),stack:error.stack,actors,bills,traffic,errors,egress,body:await currentPage?.locator('body').innerText().catch(()=>null)},null,2));throw error}
finally{for(const b of browsers){await b.context.close().catch(()=>{});await b.browser.close().catch(()=>{})}}
