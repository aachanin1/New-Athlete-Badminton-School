import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createServerClient} from '@supabase/ssr'
import {sql,q,env,fixtures} from '../tests/booking-ux/runtime.mjs'
const root='.playwright/booking-ux-1/wallet-local-20261023',k=JSON.parse(fs.readFileSync(root+'/kids-ui-fixture.json')),f=JSON.parse(fs.readFileSync('.playwright/booking-ux-1/fixture.json')),jar=new Map()
const auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:xs=>xs.forEach(x=>jar.set(x.name,x.value))}})
assert.ifError((await auth.auth.signInWithPassword({email:f.sa.email,password:fixtures.password})).error)
const selected=JSON.parse(sql(`SELECT row_to_json(c) FROM lesson_wallet_credits c WHERE user_id=${q(k.actor.id)} AND child_id=${q(k.child)} AND status='active' AND NOT EXISTS(SELECT 1 FROM task10_family_makeup_uses u WHERE u.credit_id=c.id OR u.source_root_id=c.original_session_id) ORDER BY expires_at,id LIMIT 1`))
assert.equal(selected.original_date,process.env.WALLET_STALE_SOURCE_DATE||'2026-10-27','Must match the exact original date visible in the User review before changing it')
const before=JSON.parse(sql(`SELECT booking_ux_parent_state_v1(${q(k.actor.id)},${q(k.sourceMonth)})`));const date='2026-11-08',template=sql(`SELECT id FROM schedule_templates WHERE branch_id=${q(f.branch)} AND course_type_id=${q(f.courses.kids_group)} AND day_of_week=extract(dow FROM date ${q(date)}) AND start_time='17:00' AND is_active LIMIT 1`)
const body={original_session_id:selected.original_session_id,attending_child_id:k.child,schedule_template_id:template,branch_id:f.branch,makeup_date:date,start_time:'17:00',end_time:'18:00',request_id:randomUUID(),reason:'ตรวจหน้ากระเป๋าที่เปิดค้าง Local'}
const r=await fetch('http://127.0.0.1:3153/api/admin/makeup/kids-family',{method:'POST',headers:{Cookie:[...jar].map(([n,v])=>n+'='+v).join('; '),'Content-Type':'application/json',Origin:'http://127.0.0.1:3153'},body:JSON.stringify(body)})
const result=await r.json();assert.equal(r.status,200,JSON.stringify(result))
const state=JSON.parse(sql(`SELECT booking_ux_parent_state_v1(${q(k.actor.id)},${q(k.sourceMonth)})`))
assert.equal(state.remaining,before.remaining-1);assert.ok(!state.sources.some(s=>s.creditId===selected.id))
fs.writeFileSync(root+'/ui-admin-mutation-'+Date.now()+'.json',JSON.stringify({actor:k.actor,selected: selected.id,originalDate:selected.original_date,result,state,at:new Date().toISOString()},null,2));console.log('Admin used the exact source selected in the open User review; shared remaining=2')
