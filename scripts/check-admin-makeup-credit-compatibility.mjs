// Read-only HTTP compatibility proof around a reversible, guarded LOCAL-only
// function rollback. Every envelope/business row is fingerprinted unchanged.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createServerClient} from '@supabase/ssr'
import {run,env,sql,q,fixtures} from '../tests/admin-makeup-browse/runtime.mjs'
const root=path.join(run.outputDir,'v8'),mode=process.argv[2],suffix=process.argv[3]||''
assert.match(suffix,/^(?:final)?$/)
const file=path.join(root,'compatibility'+(suffix?'-'+suffix:'')+'.json')
const runtime=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'app-runtime.json')))
if(['prepare','rollback'].includes(mode))assert.equal(runtime.app,path.join(run.evidenceRoot,'app-v8candidate8'),'New-app compatibility probes require the exact new app; never send new read_only flags to the old API')
const f=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json'))),cookies=new Map()
const auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:rows=>rows.forEach(c=>cookies.set(c.name,c.value))}})
assert.ifError((await auth.auth.signInWithPassword({email:f.admin.email,password:fixtures.password})).error)
const headers={Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),'Content-Type':'application/json'}
const post=async(route,body)=>{const r=await fetch('http://127.0.0.1:3142'+route,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});return {status:r.status,body:await r.json()}}
const tables=['bookings','booking_sessions','attendance','lesson_wallet_credits','lesson_wallet_credit_members','task10_family_makeup_uses','lesson_source_operations','activity_logs','notifications','payments','coupon_usages','admin_makeup_credit_approvals','admin_makeup_credit_decisions','admin_makeup_store_requests','admin_makeup_credit_intents']
const snapshot=()=>Object.fromEntries(tables.map(table=>[table,JSON.parse(sql(`SELECT jsonb_build_object('count',count(*),'md5',md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''))) FROM public.${table} t;`))]))
if(mode==='prepare'){
 const source=suffix?sql("SELECT s.id FROM booking_sessions s JOIN bookings b ON b.id=s.booking_id JOIN course_types c ON c.id=b.course_type_id WHERE c.name='kids_group' AND b.status='verified' AND s.status='scheduled' AND NOT s.is_makeup AND s.cancelled_at IS NULL AND s.date>=current_date AND NOT EXISTS(SELECT 1 FROM attendance a WHERE a.booking_session_id=s.id) ORDER BY s.id LIMIT 1;"):f.futureReview.ids[0]
 const payload={session_id:source,operation:'store',request_id:randomUUID(),reason:'ตรวจผลเดิมต้องไม่เขียนเมื่อถอยเวอร์ชัน',approve_credit:true}
 assert.equal(sql(`SELECT status FROM booking_sessions WHERE id=${q(payload.session_id)};`),'scheduled')
 const prep=await post('/api/admin/makeup/credit-operation',{kind:'store',payload});assert.equal(prep.status,200);assert.equal(prep.body.prepared,true)
 const before=snapshot(),read=await post('/api/admin/makeup/lessons',{...payload,read_only:true})
 assert.equal(read.status,200);assert.equal(read.body.result.confirmed,false);assert.deepEqual(snapshot(),before)
 const changed=['task10_family_makeup_state_v1','lesson_source_previous_kids_makeup_v1','admin_makeup_browse_v1','admin_makeup_history_v1','lesson_source_transition_v1']
 const forward=JSON.parse(sql(`SELECT jsonb_object_agg(oid::regprocedure::text,pg_get_functiondef(oid)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN (${changed.map(q).join(',')});`))
 fs.writeFileSync(file,JSON.stringify({runId:run.runId,payload,before,forward,checks:['Prepared envelope with no business mutation','Readback of an unexecuted Store writes nothing']},null,2),{flag:'wx'})
 console.log('Prepared compatibility envelope; no business changes')
}else if(mode==='rollback'){
 const r=JSON.parse(fs.readFileSync(file));assert.equal(r.runId,run.runId)
 sql(fs.readFileSync(path.join(root,'rollback-functions.sql'),'utf8'))
 assert.equal(sql(`SELECT admin_makeup_credit_ready_v1(${q(f.admin.id)});`),'f')
 const read=await post('/api/admin/makeup/lessons',{...r.payload,read_only:true});assert.equal(read.status,200);assert.equal(read.body.result.confirmed,false)
 const write=await post('/api/admin/makeup/lessons',r.payload);assert.equal(write.status,503);assert.equal(write.body.code,'TASK10_UNAVAILABLE')
 const prep=await post('/api/admin/makeup/credit-operation',{kind:'store',payload:r.payload});assert.equal(prep.status,503)
 assert.deepEqual(snapshot(),r.before)
 r.checks.push('New app/old writer: Store readback never invokes the writer','New app/old writer: Store+approval and prepare fail closed before any mutation','Rollback and compatibility HTTP calls preserve all fifteen business/private table fingerprints')
 fs.writeFileSync(file,JSON.stringify(r,null,2));console.log(JSON.stringify({rolledBack:true,checks:r.checks.length}))
}else if(mode==='restore'){
 const r=JSON.parse(fs.readFileSync(file));assert.equal(r.runId,run.runId)
 const immediatelyBefore=snapshot()
 sql('BEGIN;SELECT pg_advisory_xact_lock(10,1);SELECT pg_advisory_xact_lock(10,2);\n'+Object.values(r.forward).map(body=>body+';').join('\n')+"\nUPDATE admin_makeup_credit_control SET enabled=true;NOTIFY pgrst,'reload schema';COMMIT;")
 assert.equal(sql(`SELECT admin_makeup_credit_ready_v1(${q(f.admin.id)});`),'t');assert.deepEqual(snapshot(),immediatelyBefore)
 r.originalBaselineStillMatches=JSON.stringify(immediatelyBefore)===JSON.stringify(r.before)
 r.checks.push('Exact v8 writer and Local exception readiness restored with all rows unchanged');r.restored=true
 fs.writeFileSync(file,JSON.stringify(r,null,2));console.log(JSON.stringify({restored:true,checks:r.checks.length}))
}else throw Error('Use prepare, rollback, restore on this guarded Local target only')
