import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {chromium} from '@playwright/test'
import {createServerClient} from '@supabase/ssr'
import {run,env,sql} from '../tests/branch-closure/isolated-runtime.mjs'
import {password} from '../tests/branch-closure/fixtures.mjs'
const label=process.argv[2],port=process.argv[3],dir=path.join(run.evidenceRoot,'refinement'),f=JSON.parse(fs.readFileSync(path.join(dir,'fixture.json')))
assert.ok(label&&/^313[4-8]$/.test(port),'Explicit owned artifact label and local port required')
const app=path.join(run.evidenceRoot,'app-'+(label==='baseline'?'final4':label)),binding=JSON.parse(fs.readFileSync(path.join(app,'.next/branch-closure-build.json')))
assert.equal(binding.api,env.apiUrl)
const tables=['bookings','payments','booking_sessions','attendance','lesson_wallet_credits','task10_family_makeup_uses','task10_policy_activation','schedule_templates','branch_date_closures','branches','children']
const hash=()=>JSON.parse(sql('SELECT jsonb_build_object('+tables.map(t=>`'${t}',(SELECT md5(coalesce(string_agg(row_to_json(r)::text,'' ORDER BY row_to_json(r)::text),'')) FROM public.${t} r)`).join(',')+",'profilesDisplay',(SELECT md5(string_agg(id::text||coalesce(full_name,''),'' ORDER BY id)) FROM profiles));"))
const before=hash(),cookies=new Map(),auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:v=>v.forEach(x=>cookies.set(x.name,x.value))}})
assert.ifError((await auth.auth.signInWithPassword({email:f.sa.email,password})).error)
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000},locale:'th-TH',timezoneId:'Asia/Bangkok'})
await context.addCookies([...cookies].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/',sameSite:'Lax'})))
const page=await context.newPage(),errors=[],rows=[],base='http://127.0.0.1:'+port
page.on('pageerror',e=>errors.push(e.message))
for(const route of ['/admin/makeup?tab=manage&month='+f.f.date.slice(0,7),'/admin/schedule-templates','/admin/schedule-templates?tab=closures']){
 for(let iteration=0;iteration<5;iteration++){
  const pending=[],apis=[];let documentBytes=0,apiBytes=0,allDecodedBytes=0
  const response=r=>{const url=r.url(),kind=r.request().resourceType();if(url.includes('/api/admin/'))apis.push(new URL(url).pathname)
   pending.push(r.body().then(b=>{allDecodedBytes+=b.length;if(kind==='document')documentBytes+=b.length;if(url.includes('/api/admin/'))apiBytes+=b.length}).catch(()=>{}))}
  page.on('response',response);const start=performance.now();await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:120000});await page.getByRole('heading',{level:1}).waitFor()
  await page.waitForFunction(()=>[...document.querySelectorAll('main h1,main button')].some(e=>Object.keys(e).some(k=>k.startsWith('__reactFiber$'))))
  const readyMs=Math.round(performance.now()-start);await page.waitForLoadState('networkidle');const settledMs=Math.round(performance.now()-start);await Promise.all(pending);page.off('response',response)
  rows.push({route,iteration,readyMs,settledMs,documentBytes,apiBytes,allDecodedBytes,apis});console.log(JSON.stringify(rows.at(-1)))
 }
}
if(label!=='baseline'){
 const params=new URLSearchParams({month:f.f.date.slice(0,7),course:'kids_group',search:'ค้นเร็ว',mode:'learners'}),samples=[]
 for(let i=0;i<5;i++){const start=performance.now(),r=await context.request.get(base+'/api/admin/makeup/lookup?'+params),data=await r.json();assert.equal(r.status(),200);assert.equal(data.items.length,10);samples.push(Math.round(performance.now()-start))}
 rows.push({kind:'search',samples})
 const flow=[]
 for(let iteration=0;iteration<5;iteration++){
  await page.goto(base+'/admin/makeup?tab=manage&month='+f.f.date.slice(0,7),{waitUntil:'networkidle'})
  await page.getByRole('button',{name:'เด็กกลุ่ม',exact:true}).click();await page.getByRole('textbox',{name:'ค้นหารอบเรียน'}).fill('ครอบครัวปริมาณ 0 user')
  const searchStart=performance.now();await page.getByRole('button',{name:'ค้นหา',exact:true}).click();const person=page.getByRole('button').filter({hasText:'ครอบครัวปริมาณ 0 user'}).first();await person.waitFor();const searchReadyMs=Math.round(performance.now()-searchStart)
  const selectionStart=performance.now();await person.click();const lesson=page.getByTestId('admin-lesson-'+f.families[0].ids[0]);await lesson.waitFor();const selectionReadyMs=Math.round(performance.now()-selectionStart)
  const options=page.waitForResponse(r=>r.url().includes('/api/admin/makeup/options')&&r.status()===200),dialogStart=performance.now();await lesson.getByRole('button',{name:'ย้ายวัน/รอบ',exact:true}).click();await options;await page.getByRole('dialog').getByText('กำลังอ่านรอบเรียน...',{exact:true}).waitFor({state:'hidden'});const dialogCalendarReadyMs=Math.round(performance.now()-dialogStart)
  flow.push({iteration,searchReadyMs,selectionReadyMs,dialogCalendarReadyMs});await page.getByRole('button',{name:'ยกเลิก',exact:true}).click()
 }
 rows.push({kind:'interactive',samples:flow});console.log(JSON.stringify({interactive:flow}))
}
const after=hash();assert.deepEqual(after,before,'Performance comparison must not change business dataset');assert.deepEqual(errors,[])
const output={label,buildId:binding.buildId,at:new Date().toISOString(),dataset:before,rows,errors,definition:'readyMs: heading visible and React attached; settledMs: networkidle including 500ms quiet interval; body byte counts decoded, not compressed network transfer. First sample per route cold navigation then warm.'}
const file=path.join(dir,'performance-'+label+'-'+Date.now()+'.json');fs.writeFileSync(file,JSON.stringify(output,null,2),{flag:'wx'});console.log(JSON.stringify({file}));await browser.close()
