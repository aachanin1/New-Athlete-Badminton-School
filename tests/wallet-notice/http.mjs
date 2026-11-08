import assert from 'node:assert/strict'
import fs from 'node:fs'
import {randomUUID,createHash} from 'node:crypto'
import {createServerClient} from '@supabase/ssr'
import {chromium} from '@playwright/test'
const dir='.playwright/wallet-store-notice-actor-1',post=process.argv.includes('--production'),m=JSON.parse(fs.readFileSync(dir+'/production-qa.private.json'))
const env=post?JSON.parse(fs.readFileSync(dir+'/public-env.private.json')):(await import('./runtime.mjs')).env
const base=post?m.base:'http://127.0.0.1:63210',checks=[],receipts=[],browser=await chromium.launch({headless:true})
assert.equal(new URL(env.apiUrl).hostname,post?'tvnhholicwjtxdhlxfqs.supabase.co':'127.0.0.1')
try{
 for(let i=0;i<m.cases.length;i++){
  const f=m.cases[i],a=m.accounts[f.actor],cookies=new Map(),auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:values=>values.forEach(v=>cookies.set(v.name,v.value))}})
  assert.ifError((await auth.auth.signInWithPassword({email:a.email,password:m.password})).error)
  const ctx=await browser.newContext({extraHTTPHeaders:{Origin:base}});await ctx.addCookies([...cookies].map(([name,value])=>({name,value,domain:new URL(base).hostname,path:'/',sameSite:'Lax',secure:post})))
  const admin=f.actor!=='owner',path=admin?'/api/admin/makeup/lessons':'/api/lesson-wallet',body=admin?{session_id:f.id,request_id:randomUUID(),operation:'store',reason:'QA ตรวจชื่อแอดมินในแจ้งเตือน',store_policy:'admin-store-once-v1'}:{action:'store',sessionId:f.id,actorName:'FORGED CLIENT NAME',policyActor:'admin'}
  const response=await ctx.request.post(base+path,{data:body,timeout:120000}),result=await response.json()
  if(i===3){assert.equal(response.status(),400,JSON.stringify(result));assert.equal(result.code,'LESSON_WALLET_UNIT_NOT_STORABLE');checks.push('Real User API rejects under48 hours')}
  else{assert.equal(response.status(),200,JSON.stringify(result));assert.equal(result.success,true);const replay=await ctx.request.post(base+path,{data:body});assert.equal(replay.status(),200,await replay.text());checks.push('Real '+a.role+' Store and idempotent replay '+i)}
  receipts.push({case:i,session:f.id,status:response.status(),result});await ctx.close();await auth.auth.signOut()
 }
 const output=dir+'/'+(post?'production':'local')+'-http-'+Date.now()+'.json';fs.writeFileSync(output,JSON.stringify({passed:true,checks,receipts,base,definitionHash:createHash('sha256').update(fs.readFileSync(import.meta.filename)).digest('hex')},null,2));console.log(JSON.stringify({passed:true,count:checks.length,output}))
}finally{await browser.close()}
