import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createServerClient} from '@supabase/ssr'
import {run,env,sql,q,fixtures} from '../tests/admin-makeup-browse/runtime.mjs'
const root=path.join(run.outputDir,'v9'),mode=process.argv[2],file=path.join(root,'compatibility.json'),base='http://127.0.0.1:3142'
const runtime=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'app-runtime.json')))
if(['prepare','rollback','restore'].includes(mode))assert.match(runtime.app,/app-v9candidate4$/)
const f=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json'))),cookies=new Map()
const auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:items=>items.forEach(c=>cookies.set(c.name,c.value))}})
assert.ifError((await auth.auth.signInWithPassword({email:f.admin.email,password:fixtures.password})).error)
const headers={Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),'Content-Type':'application/json'}
const post=async(route,payload)=>{const r=await fetch(base+route,{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});return{status:r.status,body:await r.json()}}
const tables=['bookings','booking_sessions','attendance','lesson_wallet_credits','lesson_wallet_credit_members','task10_family_makeup_uses','lesson_source_operations','activity_logs','notifications','payments','coupon_usages','admin_makeup_credit_approvals','admin_makeup_credit_decisions','admin_makeup_store_requests','admin_makeup_credit_intents']
const snapshot=()=>Object.fromEntries(tables.map(table=>[table,JSON.parse(sql(`SELECT jsonb_build_object('count',count(*),'md5',md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''))) FROM public.${table} t;`))]))
if(mode==='prepare'){
 const sources=JSON.parse(sql("SELECT jsonb_agg(x) FROM (SELECT s.id,ct.name AS course,b.total_sessions FROM booking_sessions s JOIN bookings b ON b.id=s.booking_id JOIN course_types ct ON ct.id=b.course_type_id JOIN profiles p ON p.id=b.user_id WHERE ct.name='kids_group' AND b.status='verified' AND s.status='scheduled' AND NOT s.is_makeup AND s.cancelled_at IS NULL AND s.date>current_date AND NOT EXISTS(SELECT 1 FROM attendance a WHERE a.booking_session_id=s.id) AND NOT EXISTS(SELECT 1 FROM lesson_wallet_credits w WHERE w.original_session_id=s.id) ORDER BY s.id LIMIT 8) x;"))
 assert.ok(sources?.length)
 let selected
 for(const s of sources){const r=await fetch(base+'/api/admin/makeup/store-preview?session='+s.id,{headers});const preview=await r.json();if(r.ok&&preview.eligible&&preview.confirmation?.confirmCredit){selected=s;break}}
 assert.ok(selected,'Need exact fresh source for equivalent atomic Store benchmark')
 const payload={session_id:selected.id,operation:'store',request_id:randomUUID(),reason:'ตรวจคำขอเดิมฉบับ9',store_policy:'admin-store-once-v1'}
 const prep=await post('/api/admin/makeup/credit-operation',{kind:'store',payload});assert.equal(prep.status,200)
 const before=snapshot(),read=await post('/api/admin/makeup/lessons',{...payload,read_only:true});assert.equal(read.status,200);assert.equal(read.body.result.confirmed,false);assert.deepEqual(snapshot(),before)
 const functions=JSON.parse(sql("SELECT jsonb_object_agg(oid::regprocedure::text,pg_get_functiondef(oid)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('task10_family_makeup_state_v1','lesson_source_previous_kids_makeup_v1','admin_makeup_browse_v1','admin_makeup_history_v1','lesson_source_transition_v1');"))
 const forward='BEGIN;SELECT pg_advisory_xact_lock(10,1);SELECT pg_advisory_xact_lock(10,2);\n'+Object.values(functions).map(b=>b+';').join('\n')+"\nUPDATE admin_makeup_credit_control SET writer_hash=md5(pg_get_functiondef('public.lesson_source_transition_v1(uuid,text,uuid,jsonb)'::regprocedure)),store_once_enabled=true;NOTIFY pgrst,'reload schema';COMMIT;"
 fs.writeFileSync(file,JSON.stringify({runId:run.runId,payload,before,forward,sources:[selected,...sources.filter(s=>s.id!==selected.id)],checks:['Prepared private versioned envelope without business write','Missing-result readback writes nothing']},null,2),{flag:'wx'});console.log('Prepared v9 compatibility proof')
}else if(mode==='rollback'){
 const record=JSON.parse(fs.readFileSync(file));assert.deepEqual(snapshot(),record.before)
 sql(fs.readFileSync(root+'/rollback-v8.sql','utf8'))
 const read=await post('/api/admin/makeup/lessons',{...record.payload,read_only:true}),write=await post('/api/admin/makeup/lessons',record.payload),prep=await post('/api/admin/makeup/credit-operation',{kind:'store',payload:record.payload})
 assert.equal(read.status,200);assert.equal(read.body.result.confirmed,false);assert.equal(write.status,503);assert.equal(prep.status,503);assert.deepEqual(snapshot(),record.before)
 record.checks.push('New app with v8 writer reads old result without invoking mutation','New Store and prepare fail before mutation when policy/writer is unavailable','All fifteen business/private fingerprints preserved through rollback probes');fs.writeFileSync(file,JSON.stringify(record,null,2));console.log(JSON.stringify({rolledBack:true,checks:record.checks.length}))
}else if(mode==='restore'){
 const record=JSON.parse(fs.readFileSync(file));assert.deepEqual(snapshot(),record.before);sql(record.forward);assert.deepEqual(snapshot(),record.before)
 assert.equal(sql(`SELECT admin_makeup_store_once_ready_v1(${q(f.admin.id)});`),'t');record.checks.push('Exact v9 forward functions restored with all business/private rows preserved');record.restored=true;fs.writeFileSync(file,JSON.stringify(record,null,2));console.log(JSON.stringify({restored:true,checks:record.checks.length}))
}else if(['before','after'].includes(mode)){
 const record=JSON.parse(fs.readFileSync(file));assert.deepEqual(snapshot(),record.before)
 const source=record.sources[0].id,route='/api/admin/makeup/store-preview?session='+source,reads=[]
 for(let i=0;i<31;i++){const t=performance.now(),r=await fetch(base+route,{headers}),data=await r.json();assert.equal(r.status,200);assert.equal(data.eligible,true);reads.push({ms:performance.now()-t,bytes:JSON.stringify(data).length})}
 const writer=[];for(let i=0;i<20;i++){
  const payload={requestId:randomUUID(),reason:'เหตุผลทดสอบความเร็ว',...(mode==='before'?{approveCredit:true}:{storePolicy:'admin-store-once-v1'})}
  const plan=JSON.parse(sql(`BEGIN;EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) SELECT lesson_source_transition_v1(${q(f.admin.id)},'admin_store',${q(source)},${q(JSON.stringify(payload))}::jsonb);ROLLBACK;`));writer.push({ms:plan[0]['Execution Time'],plan:i===0?plan:undefined})
 }
 assert.deepEqual(snapshot(),record.before)
 const percentile=(rows,p)=>rows.map(r=>r.ms).sort((a,b)=>a-b)[Math.ceil(rows.length*p)-1]
 const output={label:mode,runId:run.runId,app:runtime.app,source,scope:'Same exact unused source; HTTP Store preview31 incl separate cold; PostgreSQL atomic Store+confirmation20 rolled-back EXPLAIN ANALYZE samples; no committed mutation',preview:{cold:reads[0],samples:reads.slice(1),p50:percentile(reads.slice(1),.5),p95:percentile(reads.slice(1),.95)},writer:{samples:writer,p50:percentile(writer,.5),p95:percentile(writer,.95)},allFifteenFingerprintsPreserved:true}
 fs.writeFileSync(root+'/store-performance-'+mode+'.json',JSON.stringify(output,null,2),{flag:'wx'});console.log(JSON.stringify({mode,previewP95:output.preview.p95,writerP95:output.writer.p95}))
}else throw Error('Use prepare/rollback/restore/before/after')
