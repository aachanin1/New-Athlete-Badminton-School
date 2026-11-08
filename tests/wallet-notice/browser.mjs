import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {chromium,expect} from '@playwright/test'
import {createServerClient} from '@supabase/ssr'
const root='.playwright/wallet-store-notice-actor-1',post=process.argv.includes('--production')
const fixture=JSON.parse(fs.readFileSync(root+(post?'/production-qa.private.json':'/fixture.private.json')))
const {env}=post?{env:JSON.parse(fs.readFileSync(root+'/public-env.private.json'))}:await import('./runtime.mjs')
const base=post?'https://www.newathleteschool.com':'http://127.0.0.1:63210',actor=fixture.accounts.sa
const cookies=new Map(),auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:values=>values.forEach(v=>cookies.set(v.name,v.value))}})
assert.ifError((await auth.auth.signInWithPassword({email:actor.email,password:fixture.password})).error)
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:430,height:932},timezoneId:'Asia/Bangkok',locale:'th-TH',extraHTTPHeaders:{Origin:base}})
await context.addCookies([...cookies].map(([name,value])=>({name,value,domain:new URL(base).hostname,path:'/',sameSite:'Lax',secure:post})))
const page=await context.newPage(),errors=[],checks=[]
page.on('pageerror',e=>errors.push(e.message))
try{
 await page.goto(base+'/admin/notifications',{timeout:120000});await expect(page.getByRole('tab',{name:'Inbox Admin',exact:true})).toBeVisible({timeout:120000})
 const titles=post?fixture.expectedTitles:[...new Set(fixture.records.map(r=>r.notices[0].title))]
 for(const title of titles){
  await page.getByRole('tab',{name:'ประวัติทั้งหมด',exact:true}).click();await page.getByPlaceholder('ค้นหาหัวข้อ, ข้อความ, ผู้รับ...').fill(title)
  const entry=page.getByText(title,{exact:true}).first();await expect(entry).toBeVisible();const box=await entry.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=431)
  checks.push('Mobile full list shows '+title)
 }
 await page.getByRole('tab',{name:'Inbox Admin',exact:true}).click();await expect(page.getByText(titles[0],{exact:true}).first()).toBeVisible();checks.push('Compact Admin inbox shows actual stored actor title')
 assert.equal(errors.length,0,errors.join('\n'));checks.push('No browser runtime errors')
 const out=root+'/'+(post?'production':'local')+'-browser-'+Date.now();await page.screenshot({path:out+'.png',fullPage:true});fs.writeFileSync(out+'.json',JSON.stringify({passed:true,checks,errors,base,definitionHash:createHash('sha256').update(fs.readFileSync(import.meta.filename)).digest('hex')},null,2));console.log(JSON.stringify({passed:true,count:checks.length,out}))
}finally{await context.close();await browser.close();await auth.auth.signOut()}
