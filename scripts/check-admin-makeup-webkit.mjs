import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {webkit,expect} from '@playwright/test'
import {createServerClient} from '@supabase/ssr'
import {run,env} from '../tests/branch-closure/isolated-runtime.mjs'
import {password} from '../tests/branch-closure/fixtures.mjs'
const label=process.argv[2]||'refinement6',base='http://127.0.0.1:'+(process.argv[3]||'3135'),dir=path.join(run.evidenceRoot,'refinement'),f=JSON.parse(fs.readFileSync(path.join(dir,'fixture.json'))),checks=[],errors=[]
const cookies=new Map(),auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:v=>v.forEach(x=>cookies.set(x.name,x.value))}})
assert.ifError((await auth.auth.signInWithPassword({email:f.sa.email,password})).error)
const browser=await webkit.launch({headless:true}),context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'th-TH',timezoneId:'Asia/Bangkok'})
await context.addCookies([...cookies].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/',sameSite:'Lax'})))
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const check=(v,n)=>{assert.ok(v,n);checks.push(n)}
try{
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});const reads=[];const listen=r=>{if(/\/makeup\/(lookup|queue|options|lessons)/.test(r.url()))reads.push(r.url())};page.on('request',listen)
  await page.goto(base+`/admin/makeup?tab=manage&month=${f.f.date.slice(0,7)}`,{waitUntil:'networkidle'});await expect(page.getByRole('button',{name:'เด็กกลุ่ม',exact:true})).toBeVisible();page.off('request',listen)
  check(reads.length===0,`WebKit initial manage has zero pupil/calendar requests at ${width}`)
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`WebKit manage fits ${width}`)
  await page.getByRole('button',{name:'เด็กกลุ่ม',exact:true}).click();await page.getByRole('textbox',{name:'ค้นหารอบเรียน'}).fill('ครอบครัวปริมาณ 0 user');await page.getByRole('textbox',{name:'ค้นหารอบเรียน'}).press('Enter')
  const person=page.getByRole('button').filter({hasText:'ครอบครัวปริมาณ 0 user'}).first();await person.click();await expect(page.getByTestId('admin-lesson-'+f.families[0].ids[0])).toBeVisible({timeout:30000});checks.push(`WebKit keyboard search selects exact learner at ${width}`)
  await page.getByTestId('admin-lesson-'+f.families[0].ids[0]).getByRole('button',{name:'ย้ายวัน/รอบ',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('dialog').getByText('กำลังอ่านรอบเรียน...',{exact:true})).toBeHidden({timeout:30000});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`WebKit move dialog fits ${width}`);await page.getByRole('dialog').getByRole('button',{name:'ยกเลิก',exact:true}).click()
  await page.goto(base+'/admin/schedule-templates?tab=closures',{waitUntil:'networkidle'});await expect(page.getByRole('button',{name:'เพิ่มวันปิดสาขา',exact:true})).toBeVisible();check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`WebKit closure list fits ${width}`)
  await page.getByRole('button',{name:'เพิ่มวันปิดสาขา',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`WebKit closure dialog fits ${width}`);await page.getByRole('dialog').getByRole('button',{name:'ยกเลิก',exact:true}).click()
 }
 check(errors.length===0,'WebKit has no uncaught script errors')
 const file=path.join(dir,'webkit-'+Date.now()+'.json');fs.writeFileSync(file,JSON.stringify({label,passed:true,checks,errors,scope:'WebKit mobile emulation, not physical iPhone or LINE UAT'},null,2),{flag:'wx'});console.log(JSON.stringify({passed:checks.length,file}))
}finally{await context.close();await browser.close()}
