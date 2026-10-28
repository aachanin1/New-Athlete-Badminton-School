import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createServerClient} from '@supabase/ssr'
import {sql,q,env,fixtures} from '../tests/booking-ux/runtime.mjs'
const root='.playwright/booking-ux-1/wallet-local-20261023',f=JSON.parse(fs.readFileSync('.playwright/booking-ux-1/fixture.json')),ui=JSON.parse(fs.readFileSync(root+'/kids-ui-fixture.json')),integration=JSON.parse(fs.readFileSync(root+'/integration.json'))
// Only fixture actors uniquely named by this run's Wallet tests; never Owner/customer rows.
const candidates=JSON.parse(sql(`SELECT jsonb_agg(x) FROM (SELECT p.id,u.email,booking_ux_parent_state_v1(p.id,'2026-10-01') state FROM profiles p JOIN auth.users u ON u.id=p.id WHERE p.full_name='ตรวจรับกระเป๋า user' AND u.email LIKE '%@example.invalid' AND p.id NOT IN (${q(ui.actor.id)},${q(integration.actor.id)}) ORDER BY p.id LIMIT 30)x`))
const actor=candidates.find(c=>c.state.eligible&&c.state.remaining>0);assert.ok(actor,'Owned earlier fixture has an available source')
const cookieFor=async a=>{const jar=new Map(),auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:xs=>xs.forEach(x=>jar.set(x.name,x.value))}});assert.ifError((await auth.auth.signInWithPassword({email:a.email,password:fixtures.password})).error);return[...jar].map(([n,v])=>n+'='+v).join('; ')}
const requestId=randomUUID(),date='2026-11-12',template=sql(`SELECT id FROM schedule_templates WHERE branch_id=${q(f.branch)} AND course_type_id=${q(f.courses.kids_group)} AND day_of_week=extract(dow FROM date ${q(date)}) AND start_time='17:00' AND is_active LIMIT 1`)
const response=await fetch('http://127.0.0.1:3153/api/admin/makeup/kids-family',{method:'POST',headers:{Cookie:await cookieFor(f.sa),'Content-Type':'application/json',Origin:'http://127.0.0.1:3153'},body:JSON.stringify({parent_id:actor.id,source_month:'2026-10',attending_child_id:actor.state.sources[0].sourceChildId,schedule_template_id:template,branch_id:f.branch,makeup_date:date,start_time:'17:00',end_time:'18:00',request_id:requestId,reason:'ตรวจเส้นทางการ์ด Admin รุ่นปัจจุบัน Local'})})
const result=await response.json();assert.equal(response.status,200,JSON.stringify(result))
const used=JSON.parse(sql(`SELECT row_to_json(u) FROM task10_family_makeup_uses u WHERE request_id=${q(requestId)} AND actor_id=${q(f.sa.id)}`)),after=JSON.parse(sql(`SELECT booking_ux_parent_state_v1(${q(actor.id)},'2026-10-01')`))
assert.equal(after.remaining,actor.state.remaining-1)
const userRead=await fetch('http://127.0.0.1:3153/api/booking-wallet',{headers:{Cookie:await cookieFor(actor)}}),wallet=await userRead.json()
assert.equal(userRead.status,200);assert.equal(wallet.credits.find(c=>c.id===used.credit_id).status,'redeemed')
fs.writeFileSync(root+'/admin-current-card.json',JSON.stringify({passed:3,actor:{id:actor.id},before:actor.state.remaining,after:after.remaining,usedCredit:used.credit_id,result},null,2));console.log('PASS 3: current Admin card auto-select route commits, shares quota and removes source from User available Wallet')
