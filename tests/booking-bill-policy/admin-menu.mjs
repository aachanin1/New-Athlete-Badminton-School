import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { expect } from '@playwright/test'
import { run, db, sql, q } from './runtime.mjs'
import { fixture, account, authCookie, browserSession, baseUrl, request, evidence, hashFile } from './helpers.mjs'
import { ADMIN_MENU_ITEMS, ADMIN_REQUIRED_MENU_KEYS, ADMIN_STANDARD_MENU_KEYS, getAllowedAdminMenuKeys } from '../../src/lib/admin-navigation.ts'

const checks=[], browsers=[], errors=[], f=fixture(), note='LOCAL ADMIN MENU '+randomUUID()
const output=path.join(run.outputDir,'admin-menu-'+Date.now());fs.mkdirSync(output,{recursive:true})
const app=new URL(baseUrl).port==='63311'?JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'app-runtime.json'))).app:path.join(run.evidenceRoot,'app-development')
const manifestPath=path.join(app,'source-manifest.json'), manifest=JSON.parse(fs.readFileSync(manifestPath))
assert.equal(manifest.runId,run.runId)
for(const [file,hash]of Object.entries(manifest.hashes).filter(([file])=>file.startsWith('src/')||file.startsWith('public/')||['package.json','package-lock.json','next.config.mjs'].includes(file))){assert.equal(hashFile(file),hash,'Source not synced: '+file);assert.equal(hashFile(path.join(app,file)),hash)}
const artifact={baseUrl,app,manifestHash:hashFile(manifestPath)}
const key='admin_menu_permissions', sa=await authCookie(f.actors.sa), admin=await authCookie(f.actors.admin), user=await authCookie(f.actors.other), coachActor=await account('coach','ทดสอบสิทธิ์โค้ช Local'), coach=await authCookie(coachActor)
const original=(await db.from('system_settings').select('*').eq('key',key).maybeSingle());assert.ifError(original.error)
const protectedSnapshot=()=>sql("SELECT jsonb_build_object('bookings',(SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]')::text) FROM bookings t),'sessions',(SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]')::text) FROM booking_sessions t),'payments',(SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]')::text) FROM payments t),'credits',(SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]')::text) FROM lesson_wallet_credits t),'catalog',booking_ux_catalog_v1())")
const protectedBefore=protectedSnapshot()
const check=label=>{checks.push(label);console.log(label)}
const setting=async()=>{const r=await db.from('system_settings').select('*').eq('key',key).single();assert.ifError(r.error);return r.data}
const call=async(cookie,route,body,options={})=>{const r=await request(cookie,route,body,options);assert.equal(r.status,200,route+': '+JSON.stringify(r.result));return r.result}
const allowed=async()=>getAllowedAdminMenuKeys((await setting()).value)
async function browser(actor,mobile=false){const b=await browserSession(actor,mobile);b.page.on('pageerror',e=>errors.push(e.message));browsers.push(b);return b}
async function save(page){const pending=page.waitForResponse(r=>r.url().endsWith('/api/admin/settings')&&['PATCH','POST'].includes(r.request().method()));await page.getByRole('button',{name:'บันทึกสิทธิ์',exact:true}).click();const r=await pending;assert.equal(r.status(),200,await r.text());await expect(page.getByText('บันทึกสิทธิ์เมนู Admin แล้ว',{exact:true})).toBeVisible()}
async function blocked(cookie){for(const method of ['GET','POST','PATCH','DELETE']){const r=await request(cookie,'/api/admin/schedule-templates'+(method==='DELETE'?'?id='+randomUUID():''),method==='GET'||method==='DELETE'?undefined:{id:randomUUID(),isActive:false},{method});assert.ok([401,403].includes(r.status),method+': '+JSON.stringify(r))}}
let touched=false,failure,restored=false
try{
  assert.equal(ADMIN_STANDARD_MENU_KEYS.length,16)
  assert.deepEqual([...ADMIN_REQUIRED_MENU_KEYS].sort(),['dashboard','schedules','notifications'].sort())
  assert.ok(!getAllowedAdminMenuKeys(null).includes('schedule_templates'))
  assert.deepEqual(getAllowedAdminMenuKeys({adminAllowedMenuKeys:[]}),ADMIN_REQUIRED_MENU_KEYS)
  assert.deepEqual(getAllowedAdminMenuKeys({adminAllowedMenuKeys:['settings','logs','bad','schedule_templates']}),[...ADMIN_REQUIRED_MENU_KEYS,'schedule_templates'])
  check('Registry has16 delegable menus,3 mandatory menus and explicit opt-in for recurring lessons; Super Admin menus cannot be granted')

  touched=true;assert.ifError((await db.from('system_settings').delete().eq('key',key)).error)
  await call(sa,'/api/admin/settings',{key,value:{adminAllowedMenuKeys:['settings','logs','bad']}},{method:'POST'})
  assert.deepEqual((await setting()).value.adminAllowedMenuKeys,ADMIN_REQUIRED_MENU_KEYS)
  check('POST saves all3 mandatory keys and removes unknown/Super Admin-only keys')
  await call(sa,'/api/admin/settings',{key,value:{adminAllowedMenuKeys:[]}},{method:'PATCH'})
  const row=await setting();await call(sa,'/api/admin/settings',{id:row.id,key:'forged_other_key',value:{adminAllowedMenuKeys:[]}},{method:'PATCH'})
  assert.deepEqual((await setting()).value.adminAllowedMenuKeys,ADMIN_REQUIRED_MENU_KEYS)
  check('PATCH by key and by actual row id cannot omit mandatory keys, including a forged key supplied with the id')

  const superBrowser=await browser(f.actors.sa), page=superBrowser.page
  await page.goto(baseUrl+'/admin/settings?section=admin-menus',{waitUntil:'networkidle'})
  await expect(page.getByRole('heading',{name:'สิทธิ์เมนู Admin',exact:true})).toBeVisible()
  await expect(page.getByRole('checkbox')).toHaveCount(16)
  for(const item of ADMIN_MENU_ITEMS.filter(i=>!i.superAdminOnly)){const box=page.locator('#menu-'+item.key);await expect(box).toBeVisible();if(item.lockedForAdmin){await expect(box).toBeChecked();await expect(box).toBeDisabled()}else await expect(box).toBeEnabled()}
  await expect(page.locator('#menu-schedule_templates')).not.toBeChecked()
  await expect(page.getByRole('checkbox',{name:/Activity Log|ตั้งค่าระบบ/})).toHaveCount(0)
  check('Permission UI lists every delegable sidebar menu, including recurring lessons, and locks all3 required checkboxes')
  await blocked(admin)
  await page.locator('#menu-schedule_templates').check();await save(page)
  assert.ok((await allowed()).includes('schedule_templates'))
  await page.reload({waitUntil:'networkidle'});await expect(page.locator('#menu-schedule_templates')).toBeChecked()
  await page.screenshot({path:path.join(output,'super-admin-permissions.png'),fullPage:true})
  check('Super Admin enables recurring lessons through the real UI and the saved selection survives reload')

  const regular=await browser(f.actors.admin)
  await regular.page.goto(baseUrl+'/admin/schedule-templates?tab=closures',{waitUntil:'networkidle'})
  await expect(regular.page.getByRole('heading',{name:'รอบเรียนประจำ',exact:true,level:1})).toBeVisible()
  await expect(regular.page.getByRole('link',{name:'รอบเรียนประจำ',exact:true})).toBeVisible()
  await expect(regular.page.getByRole('tab',{name:'วันปิดสาขา',exact:true})).toHaveCount(0)
  assert.equal((await request(admin,'/api/admin/branch-closures?mode=overview&month='+f.dates.month)).status,403)
  assert.ok(Array.isArray((await call(admin,'/api/admin/schedule-templates')).items))
  check('An enabled ordinary Admin can open the page and its list API; the Super Admin closure controls stay protected')

  await regular.page.getByRole('button',{name:'เพิ่มรอบเรียน',exact:true}).click()
  const dialog=regular.page.getByRole('dialog')
  await dialog.getByRole('combobox').nth(0).press('Space');await regular.page.getByRole('option',{name:'สาขาทดสอบบิล 1',exact:true}).click()
  await dialog.getByRole('combobox').nth(1).press('Space');await regular.page.getByRole('option',{name:'Private',exact:true}).click()
  await dialog.locator('#template-start').fill('22:00');await dialog.locator('#template-end').fill('23:00')
  await dialog.getByRole('button',{name:'ส.-อา.',exact:true}).click();await dialog.locator('#template-notes').fill(note)
  const createdResponse=regular.page.waitForResponse(r=>r.url().endsWith('/api/admin/schedule-templates')&&r.request().method()==='POST')
  await dialog.getByRole('button',{name:'เพิ่ม 2 รอบเรียน',exact:true}).click()
  const cr=await createdResponse,created=await cr.json();assert.equal(cr.status(),200,JSON.stringify(created));assert.equal(created.createdCount,2)
  const data=(await db.from('schedule_templates').select('*').eq('notes',note));assert.ifError(data.error)
  assert.deepEqual(data.data.map(r=>r.day_of_week).sort(),[0,6]);assert.ok(data.data.every(r=>r.branch_id===f.branches[0]&&r.course_type_id===f.courses.private&&r.is_active&&r.start_time.startsWith('22:00')&&r.end_time.startsWith('23:00')))
  const audit=JSON.parse(sql(`SELECT jsonb_agg(to_jsonb(a)) FROM activity_logs a WHERE action='create_schedule_templates' AND entity_id=ANY(${q('{'+created.templateIds.join(',')+'}')}::uuid[])`))
  assert.ok(audit.some(a=>a.user_id===f.actors.admin.id&&a.details.notes===note))
  await regular.page.keyboard.press('Escape');await regular.page.getByPlaceholder(/ค้นหา/).fill(note)
  await expect(regular.page.getByText(note,{exact:true})).toHaveCount(2)
  check('Ordinary Admin creates two recurring lessons through the real form; branch/course/days/times and actual actor audit match stored data')

  const first=regular.page.getByText(note,{exact:true}).first().locator('xpath=../..')
  const updatedResponse=regular.page.waitForResponse(r=>r.url().endsWith('/api/admin/schedule-templates')&&r.request().method()==='PATCH')
  await first.getByRole('button',{name:'ปิด',exact:true}).click()
  const ur=await updatedResponse;assert.equal(ur.status(),200);const changedId=ur.request().postDataJSON().id
  assert.equal((await db.from('schedule_templates').select('is_active').eq('id',changedId).single()).data.is_active,false)
  await expect(regular.page.getByText(note,{exact:true})).toHaveCount(1)
  check('Ordinary Admin toggles a test lesson through the UI and the active list and database both reflect the change')

  const deleteResponse=regular.page.waitForResponse(r=>r.url().includes('/api/admin/schedule-templates?id=')&&r.request().method()==='DELETE')
  await regular.page.getByText(note,{exact:true}).locator('xpath=../..').getByRole('button',{name:'ลบรอบเรียน',exact:true}).click()
  await regular.page.getByRole('alertdialog').getByRole('button').last().click()
  assert.equal((await deleteResponse).status(),200)
  await call(admin,'/api/admin/schedule-templates?id='+changedId,undefined,{method:'DELETE'})
  assert.equal((await db.from('schedule_templates').select('id').eq('notes',note)).data.length,0)
  assert.equal(Number(sql(`SELECT count(*) FROM activity_logs WHERE user_id=${q(f.actors.admin.id)} AND action='delete_unreferenced_schedule_template' AND entity_id=ANY(${q('{'+created.templateIds.join(',')+'}')}::uuid[])`)),2)
  check('Ordinary Admin deletes test lessons via UI/API; only those fixture rows disappear and both deletion audits name that Admin')

  await page.locator('#menu-schedule_templates').uncheck();await save(page)
  await blocked(admin)
  await regular.page.reload({waitUntil:'networkidle'});await expect(regular.page).toHaveURL(baseUrl+'/admin')
  await expect(regular.page.getByRole('link',{name:'รอบเรียนประจำ',exact:true})).toHaveCount(0)
  check('Revoking the menu blocks every direct API verb and an already-open Admin page redirects after reload; the sidebar also removes it')
  for(const [route,label]of [['/admin','ภาพรวม'],['/admin/schedules','ตารางเรียน'],['/admin/notifications','แจ้งเตือน']]){await regular.page.goto(baseUrl+route,{waitUntil:'networkidle'});await expect(regular.page).toHaveURL(baseUrl+route);const link=regular.page.locator('nav a').filter({hasText:label});await expect(link).toBeVisible();await expect(link).toHaveAttribute('href',route)}
  check('The3 mandatory pages and sidebar entries remain usable when every optional menu is disabled')
  await blocked(user);await blocked(coach);await blocked('')
  for(const method of ['POST','PATCH'])assert.equal((await request(admin,'/api/admin/settings',{key,value:{adminAllowedMenuKeys:['schedule_templates']}},{method})).status,401)
  assert.equal((await request(sa,'/api/admin/schedule-templates')).status,200)
  await page.goto(baseUrl+'/admin/schedule-templates?tab=closures',{waitUntil:'networkidle'});await expect(page.getByRole('tab',{name:'วันปิดสาขา',exact:true})).toBeVisible()
  assert.equal((await request(sa,'/api/admin/branch-closures?mode=overview&month='+f.dates.month)).status,200)
  check('User/Coach/anonymous cannot use template APIs or grant themselves access; Super Admin retains recurring lessons, settings and closures')

  const mobile=await browser(f.actors.sa,true);await mobile.page.goto(baseUrl+'/admin/settings?section=admin-menus',{waitUntil:'networkidle'})
  await expect(mobile.page.getByRole('checkbox')).toHaveCount(16)
  for(const k of ADMIN_REQUIRED_MENU_KEYS){await expect(mobile.page.locator('#menu-'+k)).toBeDisabled();await expect(mobile.page.locator('#menu-'+k)).toBeChecked()}
  assert.ok(!await mobile.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))
  await mobile.page.screenshot({path:path.join(output,'mobile-permissions.png'),fullPage:true})
  assert.deepEqual(errors,[])
  check('Mobile permission UI preserves all16 options and3 locked selections without overflow or browser errors')
}catch(error){failure=error;for(let i=0;i<browsers.length;i++)await browsers[i].page.screenshot({path:path.join(output,'failure-'+i+'.png'),fullPage:true}).catch(()=>{})}
finally{
  try{
    assert.ifError((await db.from('schedule_templates').delete().eq('notes',note)).error)
    if(touched){assert.ifError((await db.from('system_settings').delete().eq('key',key)).error);if(original.data)assert.ifError((await db.from('system_settings').insert(original.data)).error)}
    const final=(await db.from('system_settings').select('*').eq('key',key).maybeSingle());assert.ifError(final.error);assert.deepEqual(final.data,original.data)
    assert.equal(protectedSnapshot(),protectedBefore)
    restored=true;if(!failure)check('Original Local permissions restored exactly, test templates removed and all bookings/sessions/payments/credits/prices remain unchanged')
  }catch(error){failure=failure?new AggregateError([failure,error],'Acceptance and restoration failed'):error}
  for(const b of browsers)await b.browser.close()
}
const result={checks,artifact,restored,screenshots:output,protectedBefore,sourceHashes:Object.fromEntries(['src/lib/admin-navigation.ts','src/components/admin/admin-menu-permissions-client.tsx','src/app/api/admin/settings/route.ts','src/app/api/admin/schedule-templates/route.ts','src/app/(admin)/admin/schedule-templates/page.tsx','src/components/admin/schedule-templates-client.tsx'].map(file=>[file,hashFile(file)]))}
if(failure){evidence('admin-menu-failed',{...result,error:String(failure)});throw failure}
console.log(JSON.stringify({passed:checks.length,evidence:evidence('admin-menu-pass',result)}))
