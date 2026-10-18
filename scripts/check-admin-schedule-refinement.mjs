import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {chromium,expect} from '@playwright/test'
import {createServerClient} from '@supabase/ssr'
import {run,env,sql,q} from '../tests/branch-closure/isolated-runtime.mjs'
import {account,fixture,password} from '../tests/branch-closure/fixtures.mjs'
const label=process.argv[2]||'refinement7',port=process.argv[3]||'3136',base='http://127.0.0.1:'+port,dir=path.join(run.evidenceRoot,'refinement'),f=JSON.parse(fs.readFileSync(path.join(dir,'fixture.json'))),checks=[],errors=[]
const output=path.join(dir,'schedule-'+Date.now());fs.mkdirSync(output,{recursive:true})
const check=(v,n)=>{assert.ok(v,n);checks.push(n)},parent=await account('user','ฟอร์มรอบประจำ '+randomUUID().slice(0,8)),source=fixture('kids_group',false,parent,f.future),branchName='สาขาฟอร์มรอบประจำ '+source.branch.slice(0,8),note='ตรวจฟอร์มหลายวัน '+source.branch.slice(0,8)
sql(`UPDATE branches SET name=${q(branchName)} WHERE id=${q(source.branch)}`)
const business=()=>sql(`SELECT md5(string_agg(row_to_json(s)::text,'' ORDER BY s.id)) FROM booking_sessions s WHERE booking_id=${q(source.booking)}`),before=business()
const cookies=new Map(),auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:items=>items.forEach(x=>cookies.set(x.name,x.value))}})
assert.ifError((await auth.auth.signInWithPassword({email:f.sa.email,password})).error)
const browser=await chromium.launch({headless:true}),context=await browser.newContext({baseURL:base,viewport:{width:1440,height:1050},timezoneId:'Asia/Bangkok',locale:'th-TH'})
await context.addCookies([...cookies].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/',sameSite:'Lax'})))
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
try{
 await page.goto('/admin/schedule-templates',{waitUntil:'networkidle'});await page.screenshot({path:path.join(output,'recurring-desktop.png')})
 await page.getByRole('button',{name:'เพิ่มรอบเรียน',exact:true}).click();const dialog=page.getByRole('dialog')
 await dialog.getByRole('combobox').nth(0).click();await page.getByRole('option',{name:branchName,exact:true}).click()
 await dialog.getByRole('combobox').nth(1).click();await page.getByRole('option',{name:'เด็กกลุ่ม',exact:true}).click()
 await dialog.getByLabel('เริ่ม',{exact:true}).fill('14:15');await dialog.getByLabel('จบ',{exact:true}).fill('15:15');await dialog.getByRole('button',{name:'ส.-อา.',exact:true}).click();await dialog.getByLabel('หมายเหตุ',{exact:true}).fill(note)
 const created=page.waitForResponse(r=>r.url().endsWith('/api/admin/schedule-templates')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'เพิ่ม 2 รอบเรียน',exact:true}).click();const cr=await created;assert.equal(cr.status(),200);check((await cr.json()).createdCount===2,'Recurring form creates both selected weekdays in one real request')
 const records=JSON.parse(sql(`SELECT jsonb_agg(to_jsonb(t) ORDER BY day_of_week) FROM schedule_templates t WHERE notes=${q(note)}`));check(records.length===2&&records[0].day_of_week===0&&records[1].day_of_week===6,'Created recurring days, branch and times persist correctly')
 await dialog.getByLabel('หมายเหตุ',{exact:true}).fill(note);const duplicate=page.waitForResponse(r=>r.url().endsWith('/api/admin/schedule-templates')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'เพิ่ม 2 รอบเรียน',exact:true}).click();const du=await(await duplicate).json();check(du.createdCount===0&&du.skippedDays.length===2,'Submitting the same weekdays skips both duplicate templates')
 await page.keyboard.press('Escape');await page.getByPlaceholder('ค้นหาสาขา คอร์ส วัน เวลา...').fill(note);await expect(page.getByText(note,{exact:true})).toHaveCount(2)
 const row=page.locator('div.grid').filter({has:page.getByText(note,{exact:true})}).first(),patch=page.waitForResponse(r=>r.request().method()==='PATCH'&&r.url().endsWith('/api/admin/schedule-templates'));await row.getByRole('button',{name:'ปิด',exact:true}).click();assert.equal((await patch).status(),200);await expect(page.getByText(note,{exact:true})).toHaveCount(1);check(Number(sql(`SELECT count(*) FROM schedule_templates WHERE notes=${q(note)} AND NOT is_active`))===1,'Deactivation refreshes the active filter and changes only the selected template')
 const remaining=page.locator('div.grid').filter({has:page.getByText(note,{exact:true})}).first();await remaining.getByRole('button',{name:'ลบรอบเรียน',exact:true}).click();const deleted=page.waitForResponse(r=>r.request().method()==='DELETE'&&r.url().includes('/api/admin/schedule-templates'));await page.getByRole('alertdialog').getByRole('button',{name:'ลบรอบเรียน',exact:true}).click();check((await(await deleted).json()).action==='deleted','Unreferenced recurring template is deleted through the confirmation dialog')
 const exactNote=note+' อ้างอิง';sql(`UPDATE schedule_templates SET notes=${q(exactNote)} WHERE id=${q(source.template)}`);await page.getByPlaceholder('ค้นหาสาขา คอร์ส วัน เวลา...').fill(exactNote);await expect(page.getByText(exactNote,{exact:true})).toBeVisible()
 await page.locator('div.grid').filter({has:page.getByText(exactNote,{exact:true})}).getByRole('button',{name:'ลบรอบเรียน',exact:true}).click();const referenced=page.waitForResponse(r=>r.request().method()==='DELETE'&&r.url().includes('/api/admin/schedule-templates'));await page.getByRole('alertdialog').getByRole('button',{name:'ลบรอบเรียน',exact:true}).click();check((await(await referenced).json()).action==='deactivated'&&sql(`SELECT is_active FROM schedule_templates WHERE id=${q(source.template)}`)==='f','Referenced recurring template is retained and deactivated instead of deleted')
 check(business()===before,'Create, duplicate, deactivate and delete flows preserve existing booked lessons')
 await page.getByRole('tab',{name:'วันปิดสาขา',exact:true}).click();await expect(page.getByText('กำลังอ่านวันปิดสาขา...',{exact:true})).toHaveCount(0);await page.getByRole('combobox').last().click();const option=page.getByRole('option').filter({hasText:'สาขาทดสอบเฉพาะงานวันปิด'}).first();await option.click();await page.waitForLoadState('networkidle');await page.screenshot({path:path.join(output,'closures-desktop.png')})
 check(errors.length===0,'Recurring flow has no browser script errors')
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({label,checks,errors},null,2),{flag:'wx'});console.log(JSON.stringify({passed:checks.length,output}))
}catch(e){fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:String(e),checks,errors},null,2),{flag:'wx'});throw e}finally{await context.close();await browser.close()}
