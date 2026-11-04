import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {chromium} from '@playwright/test'
import {createServerClient} from '@supabase/ssr'
import {seed,actors,round,preview,read,sql,q,attend,output,finish,failure,fixtures} from './helpers.mjs'
import {env,run} from './runtime.mjs'
const dir=output('browser'),checks=[],base='http://127.0.0.1:62810';let browser,context,page;
const check=name=>{checks.push({name,passed:true});console.log(name)}
async function authContext(actor){
 const cookies=new Map(),auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:items=>items.forEach(x=>cookies.set(x.name,x.value))}});
 assert.ifError((await auth.auth.signInWithPassword({email:actor.email,password:fixtures.password})).error);
 const c=await browser.newContext({viewport:{width:1440,height:1000},locale:'th-TH',timezoneId:'Asia/Bangkok',extraHTTPHeaders:{Origin:base}});
 await c.addCookies([...cookies].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/',sameSite:'Lax'})));return c
}
async function open(f){
 await page.goto(base+'/admin/makeup?month='+f.date.slice(0,7)+'&session='+f.ids[0],{waitUntil:'networkidle'});
 const card=page.getByTestId('makeup-review-group').filter({hasText:f.label});await card.waitFor({timeout:30000});
 await card.getByRole('button',{name:'ไม่ได้เปิดสอน / คืนสิทธิ์',exact:true}).click();
 const d=page.getByRole('dialog');await d.getByText('คืนสิทธิ์เดิมเข้ากระเป๋า · คงวันหมดอายุเดิม',{exact:true}).waitFor();return d
}
async function confirmed(f){
 await page.getByRole('dialog').getByRole('heading',{name:'คืนสิทธิ์สำเร็จแล้ว',exact:true}).waitFor({timeout:30000});
 await page.getByRole('dialog').getByRole('button',{name:'ปิด',exact:true}).waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.querySelector('[role="dialog"] button[disabled]'));
 const s=read(`SELECT jsonb_build_object('walleted',(SELECT count(*) FROM booking_sessions WHERE id=ANY(${q('{'+f.ids.join(',')+'}')}::uuid[]) AND status='walleted'),'attendance',(SELECT count(*) FROM attendance WHERE booking_session_id=ANY(${q('{'+f.ids.join(',')+'}')}::uuid[])),'credits',(SELECT count(*) FROM lesson_wallet_credits WHERE original_session_id=ANY(${q('{'+f.ids.join(',')+'}')}::uuid[])));`);
 assert.equal(s.walleted,f.ids.length);assert.equal(s.attendance,0);assert.equal(s.credits,1);return s
}
try{
 seed();const a=await actors();const cases=[];
 for(const [name,course,options] of [['Kids','kids_group',{}],['Adult','adult_group',{}],['Family','private',{family:true}],['Lost','private',{family:true,hours:2}],['Refresh','adult_group',{}],['Stale','kids_group',{}],['NoCoach','adult_group',{assigned:false}],['Before','adult_group',{}]]){
  const f=round(a,course,options);f.label='NCR UI '+name+' '+f.branch.slice(0,8);sql(`UPDATE branches SET name=${q(f.label)} WHERE id=${q(f.branch)};`);cases.push(f)
 }
 fs.writeFileSync(path.join(dir,'fixtures.private.json'),JSON.stringify({a,cases},null,2));
 browser=await chromium.launch({headless:true});context=await authContext(a.admin);page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'||u.hostname==='localhost'?route.continue():route.abort()});
 // Real HTTP authentication, origin and menu boundary, independent of visible buttons.
 for(const actor of [a.parent,a.coach]){const c=await authContext(actor);const response=await c.request.post(base+'/api/admin/makeup/return-round',{data:{mode:'preview',anchor:cases[0].ids[0]}});assert.equal(response.status(),401);await c.close()};check('actual Parent and Coach HTTP mutation access denied');
 const c=await authContext(a.menu);sql(`UPDATE system_settings SET value='{"adminAllowedMenuKeys":[]}' WHERE key='admin_menu_permissions';`);try{assert.equal((await c.request.post(base+'/api/admin/makeup/return-round',{data:{mode:'preview',anchor:cases[0].ids[0]}})).status(),403)}finally{sql(`UPDATE system_settings SET value='{"adminAllowedMenuKeys":["makeup"]}' WHERE key='admin_menu_permissions';`);await c.close()};check('actual Admin without makeup menu denied');
 assert.equal((await context.request.post(base+'/api/admin/makeup/return-round',{headers:{Origin:'https://example.invalid'},data:{mode:'preview',anchor:cases[0].ids[0]}})).status(),403);check('actual cross-origin request denied');
 for(const f of cases.slice(0,3)){
  const d=await open(f),p=preview(a.admin,f);assert.equal(p.eligible,true);assert.match(await d.innerText(),new RegExp('รายชื่อล่าสุดในขอบเขตรอบนี้ '+f.ids.length+' คน'));
  const button=d.getByRole('button',{name:'ยืนยันไม่ได้เปิดสอน / คืนสิทธิ์',exact:true});assert.equal(await button.isDisabled(),true);
  if(f.courseName==='private'){assert.equal(p.units.length,1);assert.match(await d.innerText(),/1 ชั่วโมง/);await page.screenshot({path:path.join(dir,'family-desktop-preview.png'),fullPage:false})}
  await d.getByLabel('เหตุผลที่ไม่ได้เปิดสอน').fill('ผู้เรียนมารอ แต่รอบนี้ไม่ได้เปิดสอน ทดสอบ Local');await button.click();await confirmed(f);check(f.courseName+': real preview → required reason → atomic return → queue refresh');await d.getByRole('button',{name:'ปิด',exact:true}).click();
 }
 const lost=cases[3];await page.setViewportSize({width:390,height:844});const ld=await open(lost);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.match(await ld.innerText(),/2 ชั่วโมง/);await page.screenshot({path:path.join(dir,'family-mobile-preview.png'),fullPage:false});
 // Close/reopen via keyboard and preserve focus into the trigger.
 await page.keyboard.press('Escape');await ld.waitFor({state:'hidden'});assert.match(await page.evaluate(()=>document.activeElement?.textContent||''),/ไม่ได้เปิดสอน/);check('mobile390px preview fits; Escape restores trigger focus');
 await page.getByTestId('makeup-review-group').filter({hasText:lost.label}).getByRole('button',{name:'ไม่ได้เปิดสอน / คืนสิทธิ์',exact:true}).click();await ld.getByLabel('เหตุผลที่ไม่ได้เปิดสอน').waitFor();
 let dropped=false;const drop=async route=>{if(route.request().postDataJSON().mode==='commit'){const response=await route.fetch();assert.equal(response.status(),200);dropped=true;await route.abort('failed')}else await route.continue()};
 await page.route('**/api/admin/makeup/return-round',drop);await ld.getByLabel('เหตุผลที่ไม่ได้เปิดสอน').fill('เหตุผลลับจำลอง ต้องไม่อยู่ใน sessionStorage');await ld.getByRole('button',{name:'ยืนยันไม่ได้เปิดสอน / คืนสิทธิ์',exact:true}).click();await ld.getByRole('button',{name:'ตรวจสอบผลคำขอเดิม',exact:true}).waitFor();assert.ok(dropped);assert.equal(await ld.getByRole('heading',{name:'คืนสิทธิ์สำเร็จแล้ว',exact:true}).count(),0);
 const stored=await page.evaluate(()=>JSON.stringify({...sessionStorage}));assert.ok(!stored.includes('เหตุผลลับจำลอง'));assert.ok(!stored.includes(a.parent.email));assert.equal(await page.getByTestId('makeup-review-group').filter({hasText:lost.label}).getByRole('button',{name:'ไม่ได้เปิดสอน / คืนสิทธิ์',exact:true,includeHidden:true}).isDisabled(),true);check('response lost after real commit stays unknown, blocks related action and persists IDs only');
 await page.unroute('**/api/admin/makeup/return-round',drop);await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:/ตรวจคำขอเดิม · เดือน/}).click();await page.getByRole('dialog').getByRole('button',{name:'ตรวจสอบผลคำขอเดิม',exact:true}).click();await confirmed(lost);check('reload reconciles durable real receipt without returning twice');await page.getByRole('dialog').getByRole('button',{name:'ปิด',exact:true}).click();
 await page.setViewportSize({width:1440,height:1000});const refreshed=cases[4],fd=await open(refreshed);const failQueue=route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Local forced queue refresh failure'})});await page.route('**/api/admin/makeup/queue?*',failQueue);
 await fd.getByLabel('เหตุผลที่ไม่ได้เปิดสอน').fill('ทดสอบยืนยันเครดิตก่อนอ่านคิว');await fd.getByRole('button',{name:'ยืนยันไม่ได้เปิดสอน / คืนสิทธิ์',exact:true}).click();await fd.getByText('คืนสิทธิ์สำเร็จแล้ว แต่ยังอ่านคิวล่าสุดไม่ได้ กรุณากดอ่านคิวล่าสุด ไม่ต้องส่งคืนซ้ำ',{exact:true}).waitFor();assert.equal(await fd.getByRole('button',{name:'ยืนยันไม่ได้เปิดสอน / คืนสิทธิ์',exact:true}).count(),0);check('confirmed credit remains confirmed when queue refresh fails');
 await page.unroute('**/api/admin/makeup/queue?*',failQueue);await fd.getByRole('button',{name:'อ่านคิวล่าสุด',exact:true}).click();await confirmed(refreshed);await fd.getByRole('button',{name:'ปิด',exact:true}).click();
 const stale=cases[5],sd=await open(stale);sql(attend(stale,a));await sd.getByLabel('เหตุผลที่ไม่ได้เปิดสอน').fill('ข้อมูลเปลี่ยนหลัง preview');await sd.getByRole('button',{name:'ยืนยันไม่ได้เปิดสอน / คืนสิทธิ์',exact:true}).click();await sd.getByText('ข้อมูลรอบเปลี่ยนแล้ว กรุณาอ่านผลกระทบล่าสุดก่อนยืนยัน',{exact:true}).waitFor();assert.equal(sql(`SELECT count(*) FROM lesson_wallet_credits WHERE original_session_id=${q(stale.ids[0])}`),'0');check('stale preview after attendance rejects with no credit');await sd.getByRole('button',{name:'ปิด',exact:true}).click();
 const unassigned=cases[6],ud=await open(unassigned);assert.match(await ud.innerText(),/ยังไม่มีโค้ช/);await ud.getByLabel('เหตุผลที่ไม่ได้เปิดสอน').fill('ไม่มีโค้ชและไม่ได้เปิดสอน');await ud.getByRole('button',{name:'ยืนยันไม่ได้เปิดสอน / คืนสิทธิ์',exact:true}).click();await confirmed(unassigned);check('unassigned card uses same complete return flow');await ud.getByRole('button',{name:'ปิด',exact:true}).click();
 const before=cases[7],bd=await open(before),abortBefore=route=>route.request().postDataJSON().mode==='commit'?route.abort('failed'):route.continue();await page.route('**/api/admin/makeup/return-round',abortBefore);await bd.getByLabel('เหตุผลที่ไม่ได้เปิดสอน').fill('ทดสอบคำขอไม่ถึงระบบ');await bd.getByRole('button',{name:'ยืนยันไม่ได้เปิดสอน / คืนสิทธิ์',exact:true}).click();await bd.getByRole('button',{name:'ตรวจสอบผลคำขอเดิม',exact:true}).waitFor();await page.unroute('**/api/admin/makeup/return-round',abortBefore);await bd.getByRole('button',{name:'ตรวจสอบผลคำขอเดิม',exact:true}).click();await bd.getByText('ระบบยืนยันว่าไม่มีการคืนสิทธิ์จากคำขอเดิม สามารถอ่านผลกระทบใหม่ก่อนดำเนินการได้',{exact:true}).waitFor();assert.equal(sql(`SELECT count(*) FROM lesson_wallet_credits WHERE original_session_id=${q(before.ids[0])}`),'0');check('request lost before server is distinguished from committed receipt');
 await page.screenshot({path:path.join(dir,'before-server-reconciled.png'),fullPage:true});assert.deepEqual(errors,[]);check('no browser JavaScript errors');finish(dir,checks,{buildBinding:JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'app-candidate4/.next-no-class-return-1/no-class-return-local-build.json'),'utf8'))})
}catch(e){if(page)await page.screenshot({path:path.join(dir,'failure.png'),fullPage:true}).catch(()=>{});failure(dir,checks,e)}finally{await context?.close();await browser?.close()}
