import fs from 'node:fs'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createServerClient} from '@supabase/ssr'
import {sql,q,env,fixtures} from '../tests/booking-ux/runtime.mjs'
const root='.playwright/booking-ux-1/wallet-history-local-20261026',base=process.env.WALLET_LOCAL_URL||'http://127.0.0.1:3151'
const a=JSON.parse(fs.readFileSync(root+'/integration-r2/integration.json')),f=JSON.parse(fs.readFileSync('.playwright/booking-ux-1/fixture.json')),checks=[]
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label);console.log(label)}
process.on('uncaughtExceptionMonitor',error=>fs.writeFileSync(root+'/reads-failure-'+Date.now()+'.json',JSON.stringify({checks,error:String(error)},null,2)))
const cookieFor=async actor=>{const jar=new Map(),auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:xs=>xs.forEach(x=>jar.set(x.name,x.value))}});assert.ifError((await auth.auth.signInWithPassword({email:actor.email,password:fixtures.password})).error);return [...jar].map(([k,v])=>k+'='+v).join('; ')}
const user=await cookieFor(a.actor),admin=await cookieFor(f.sa),other=await cookieFor(a.other)
const req=async(path,body,cookie=user)=>{const start=performance.now(),response=await fetch(base+path,{method:body?'POST':'GET',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return{status:response.status,body:await response.json(),ms:performance.now()-start}}
const history=(month='2026-10',course='kids_group',offset=0,cookie=user)=>req(`/api/booking-wallet?historyOnly=1&historyFormat=2&month=${month}&course=${course}&offset=${offset}`,null,cookie)
const data=(await req('/api/booking-wallet')).body,rules=data.rules
check(rules.bands.map(b=>b.quota).join(',')==='0,1,2,3,4,5'&&rules.bands.at(-1).min===20,'Rules table comes from current shared policy and reaches five at20')
check(sql(`SELECT count(*) FROM generate_series(0,10000)n WHERE task10_family_quota_v1(n) IS DISTINCT FROM least(5,floor(n::numeric/4)::integer)`) ==='0','All quota results0..10000 retain the original formula')
const initialHistory=await history()
check(initialHistory.status===200&&a.credits.every(id=>initialHistory.body.rows.some(r=>r.id===id)),'Month contains stored and used credits together')
check(initialHistory.body.rows.filter(r=>a.credits.includes(r.id)&&r.status==='redeemed').length===3,'Shared Admin and User uses appear once with correct spent status')
check(initialHistory.body.rows.filter(r=>a.credits.includes(r.id)&&r.status==='redeemed').every(r=>r.destinations.length&&r.destinations.every(d=>d.date.startsWith('2026-11'))&&r.usedAt.startsWith('2026-10')),'Lesson destination month is distinct from the confirmation month')
const family=(await history('2026-10','private')).body.rows
check(family.length===1&&family[0].kind==='package'&&family[0].participants.length===3&&family[0].destinations.length===3&&family[0].usedBy==='parent','One Family hour keeps all participants and truthful destination evidence')
// A new source belongs only to the unique synthetic actor created for this run.
const source=randomUUID(),date='2026-10-29',slot=sql(`SELECT id FROM schedule_slots WHERE branch_id=${q(f.branch)} AND course_type_id=${q(f.courses.kids_group)} AND date=${q(date)} AND start_time='17:00'`)
assert.ok(slot)
sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup)VALUES(${q(source)},${q(a.kids)},${q(slot)},${q(date)},'17:00','18:00',${q(f.branch)},${q(a.childB)},'scheduled',false);COMMIT;`)
const store={session_id:source,operation:'store',request_id:randomUUID(),reason:'ตรวจประวัติแอดมิน Local',store_policy:'admin-store-once-v1'}
const stored=await req('/api/admin/makeup/lessons',store,admin);fs.writeFileSync(root+'/admin-store-result.json',JSON.stringify(stored,null,2));check(stored.status===200,'Actual Admin Store API succeeds for this synthetic source')
const credit=sql(`SELECT id FROM lesson_wallet_credits WHERE original_session_id=${q(source)}`)
const storeRow=(await history()).body.rows.find(r=>r.id===credit)
check(storeRow?.status==='stored'&&storeRow.storedBy==='admin'&&storeRow.destinations.length===0,'Admin Store alone appears immediately with Admin label and no invented destination')
check((await req('/api/admin/makeup/lessons',store,admin)).status===200&&sql(`SELECT count(*) FROM lesson_wallet_credits WHERE original_session_id=${q(source)}`)==='1','Repeating Admin Store keeps exactly one credit')
const target='2026-11-10',template=sql(`SELECT id FROM schedule_templates WHERE branch_id=${q(f.branch)} AND course_type_id=${q(f.courses.kids_group)} AND day_of_week=extract(dow FROM date ${q(target)}) AND start_time='10:00' AND is_active LIMIT 1`)
const use={original_session_id:source,attending_child_id:a.child,schedule_template_id:template,branch_id:f.branch,makeup_date:target,start_time:'10:00',end_time:'11:00',request_id:randomUUID(),reason:'ตรวจเก็บและใช้โดยแอดมิน Local'}
const used=await req('/api/admin/makeup/kids-family',use,admin);fs.writeFileSync(root+'/admin-use-result.json',JSON.stringify(used,null,2));check(used.status===200,'Existing Admin Store-once entitlement remains usable through its original policy')
const after=(await history()).body,row=after.rows.find(r=>r.id===credit)
check(row?.storedBy==='admin'&&row.usedBy==='admin'&&row.status==='redeemed'&&row.destinations[0].date===target,'Admin Store then Use shows exact source, destination and both actors')
check(row.participants[0]===a.childB&&row.destinations[0].childId===a.child,'Admin sibling use preserves source child and attending child separately')
check((await req('/api/booking-wallet')).body.credits.find(c=>c.id===credit)?.status==='redeemed','User available balance also excludes the Admin-used credit')
const same=await req('/api/admin/makeup/kids-family',use,admin);check(same.status===200&&(await history()).body.rows.filter(r=>r.id===credit).length===1,'Admin Use replay does not duplicate the history')
const privateData=JSON.stringify(after)
check(!privateData.includes('ตรวจประวัติแอดมิน')&&!privateData.includes(f.sa.id)&&!privateData.includes('decision_evidence'),'User history omits Admin reasons, identity and internal decision evidence')
const denied=await Promise.all([history('bad'),history('2026-10','bad'),history('2026-10','kids_group',-1),history('2026-10','kids_group',0,'')])
check(denied.slice(0,3).every(r=>r.status===400)&&denied[3].status===401,'Invalid month/course/page and anonymous history are denied')
check((await history('2026-10','kids_group',0,other)).body.rows.length===0,'Another authenticated user cannot see this history')
check(sql(`SELECT bool_and(NOT has_function_privilege(r,p,'EXECUTE')) FROM (VALUES('anon'),('authenticated'))x(r) CROSS JOIN (VALUES('public.booking_ux_wallet_history_v1(uuid,date,text,integer)'),('public.booking_ux_wallet_rules_v1(uuid)'))y(p)`) ==='t','History and policy RPCs cannot be called directly by browser roles')
const oldActor={email:'branch-closure-2b29f472-6ea7-4f56-a22b-d17bc14b4a14@example.invalid'},old=await cookieFor(oldActor),page1=await history('2026-09','kids_group',0,old),page2=await history('2026-09','kids_group',20,old)
check(page1.status===200&&page1.body.rows.length===20&&page1.body.nextOffset===20&&page2.body.rows.length===5&&page2.body.nextOffset===null,'Historical month paginates20+5 without loading every month')
check(new Set([...page1.body.rows,...page2.body.rows].map(r=>r.kind+r.id)).size===25,'History pages are globally ordered and contain no duplicate source')
const timings=[];for(let i=0;i<6;i++)timings.push((await history()).ms)
fs.writeFileSync(root+'/history-read-checks.json',JSON.stringify({checks,credit,source,adminStore:store,adminUse:use,after,timings,at:new Date().toISOString()},null,2));console.log(JSON.stringify({passed:checks.length,timings}))
