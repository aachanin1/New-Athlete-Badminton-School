import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash,randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
import {createServerClient} from '@supabase/ssr'
import {run,env,sql,q,fixtures} from '../tests/admin-makeup-browse/runtime.mjs'
const root=path.join(run.outputDir,'v8'),mode=process.argv[2]||'capture'
fs.mkdirSync(root,{recursive:true})
if(mode==='capture'){
 const files=execFileSync('git',['ls-files','-co','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean).sort(),hashes={}
 for(const file of files)if(fs.statSync(file).isFile())hashes[file]=createHash('sha256').update(fs.readFileSync(file)).digest('hex')
 const functions=JSON.parse(sql("SELECT jsonb_object_agg(oid::regprocedure::text,pg_get_functiondef(oid)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f';"))
 fs.writeFileSync(path.join(root,'baseline-functions.json'),JSON.stringify(functions,null,2),{flag:'wx'})
 fs.writeFileSync(path.join(root,'baseline-source.json'),JSON.stringify({runId:run.runId,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),hashes},null,2),{flag:'wx'})
 for(const [name,body] of Object.entries(functions))if(/v_remaining|v_state->>'remaining'/.test(body)&&/makeup/.test(name))console.log(name)
 console.log(JSON.stringify({captured:true,files:files.length,root}))
}else if(mode==='seed'){
 const accounts=[]
 for(let i=0;i<100;i++)accounts.push(await fixtures.account('user','ความเร็วฉบับแปด'+String(i).padStart(3,'0')))
 const course=sql("SELECT id FROM course_types WHERE name='kids_group';"),branch=randomUUID(),template=randomUUID(),slot=randomUUID(),coach=await fixtures.account('coach','หลักฐานความเร็ว'),date=sql("SELECT ((clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date-1);")
 const rows=accounts.map((parent,i)=>({parent,child:randomUUID(),booking:randomUUID(),session:randomUUID(),name:'ความเร็วฉบับแปด'+String(i).padStart(3,'0')}))
 sql(`BEGIN;SELECT pg_advisory_xact_lock(10,1);CREATE TEMP TABLE credit_perf_policy ON COMMIT DROP AS SELECT * FROM task10_policy_activation;
 UPDATE task10_policy_activation SET state='never_activated',effective_at=NULL,pricing_enabled=false,makeup_enabled=false,expiry_enabled=false;
 SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);
 INSERT INTO branches(id,name,slug) VALUES(${q(branch)},'สาขาทดสอบความเร็วฉบับ8',${q('credit-perf-'+branch)});
 INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(template)},${q(branch)},${q(course)},extract(dow FROM date ${q(date)}),'10:00','11:00',true);
 INSERT INTO schedule_slots(id,template_id,branch_id,course_type_id,date,start_time,end_time,status) VALUES(${q(slot)},${q(template)},${q(branch)},${q(course)},${q(date)},'10:00','11:00','open');
 ${rows.map(r=>`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(r.child)},${q(r.parent.id)},${q(r.name)},'ทดสอบ');
 INSERT INTO bookings(id,user_id,learner_type,child_id,branch_id,course_type_id,month,year,total_sessions,total_price,status,created_at) VALUES(${q(r.booking)},${q(r.parent.id)},'child',${q(r.child)},${q(branch)},${q(course)},extract(month FROM date ${q(date)}),extract(year FROM date ${q(date)}),8,500,'verified',(SELECT effective_at-interval '1 day' FROM credit_perf_policy));
 INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup) VALUES(${q(r.session)},${q(r.booking)},${q(slot)},${q(date)},'10:00','11:00',${q(branch)},${q(r.child)},'absent',false);
 INSERT INTO attendance(booking_session_id,student_id,student_type,coach_id,status) VALUES(${q(r.session)},${q(r.child)},'child',${q(coach.id)},'absent');`).join('\n')}
 UPDATE task10_policy_activation SET state=(SELECT state FROM credit_perf_policy),effective_at=(SELECT effective_at FROM credit_perf_policy),pricing_enabled=(SELECT pricing_enabled FROM credit_perf_policy),makeup_enabled=(SELECT makeup_enabled FROM credit_perf_policy),expiry_enabled=(SELECT expiry_enabled FROM credit_perf_policy);COMMIT;`)
 fs.writeFileSync(path.join(root,'performance-fixture.json'),JSON.stringify({tag:'ความเร็วฉบับแปด',tenTag:'ความเร็วฉบับแปด00',month:date.slice(0,7),branch,rows},null,2),{flag:'wx'})
 console.log(JSON.stringify({seeded:true,count:rows.length}))
}else if(mode==='measure'){
 const label=process.argv[3];assert.match(label||'',/^[a-z0-9-]+$/)
 const f=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json'))),p=JSON.parse(fs.readFileSync(path.join(root,'performance-fixture.json'))),runtime=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'app-runtime.json')))
 const cookies=new Map(),auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:items=>items.forEach(c=>cookies.set(c.name,c.value))}})
 assert.ifError((await auth.auth.signInWithPassword({email:f.admin.email,password:fixtures.password})).error)
 const headers={Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')}
 const ownerCookies=new Map(),ownerAuth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...ownerCookies].map(([name,value])=>({name,value})),setAll:items=>items.forEach(c=>ownerCookies.set(c.name,c.value))}})
 assert.ifError((await ownerAuth.auth.signInWithPassword({email:f.owner.email,password:fixtures.password})).error)
 const ownerHeaders={Cookie:[...ownerCookies].map(([k,v])=>k+'='+v).join('; ')}
 const full=true,browser=JSON.parse(fs.readFileSync(path.join(root,'browser-v8candidate8-1792397135371/results.json')))
 const fullParent=browser?.fixtures.lostStore.parent.id,fullName=full?sql(`SELECT full_name FROM profiles WHERE id=${q(fullParent)};`):null
 const routes={ten:`/api/admin/makeup/browse?month=${p.month}&course=kids_group&search=${encodeURIComponent(p.tenTag)}`,hundred:`/api/admin/makeup/browse?month=${p.month}&course=kids_group&search=${encodeURIComponent(p.tag)}`,history:`/api/admin/makeup/history?month=${f.month}&parent=${f.families[1].parent.id}&course=kids_group`,user:'/dashboard/lesson-wallet',quotaFull:`/api/admin/makeup/browse?month=${p.month}&course=kids_group&search=${encodeURIComponent(fullName)}`}
 const measure=async(route)=>{const start=performance.now(),res=await fetch('http://127.0.0.1:3142'+route,{headers:route.startsWith('/dashboard/')?ownerHeaders:headers,redirect:'error'}),body=await res.text();assert.equal(res.status,200,route+': '+body.slice(0,120));if(route.includes('/history?'))assert.equal(JSON.parse(body).items.length,20,'Equivalent twenty-event history page');return {ms:performance.now()-start,bytes:Buffer.byteLength(body)}}
 const result={label,runId:run.runId,app:runtime.app,cold:{},warm:{},routes}
 for(const [key,route]of Object.entries(routes)){result.cold[key]=await measure(route);result.warm[key]=[];for(let i=0;i<30;i++)result.warm[key].push(await measure(route))}
 const percentile=(rows,p)=>[...rows].sort((a,b)=>a.ms-b.ms)[Math.ceil(rows.length*p)-1].ms
 result.summary=Object.fromEntries(Object.entries(result.warm).map(([key,rows])=>[key,{requests:1,p50:percentile(rows,.5),p95:percentile(rows,.95),bytes:rows[0].bytes}]))
 result.plans={ten:JSON.parse(sql(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT admin_makeup_browse_v1(${q(f.admin.id)},${q(p.month+'-01')},'kids_group',${q(p.tenTag)});`)),hundred:JSON.parse(sql(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT admin_makeup_browse_v1(${q(f.admin.id)},${q(p.month+'-01')},'kids_group',${q(p.tag)});`)),history:JSON.parse(sql(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT admin_makeup_history_v1(${q(f.admin.id)},${q(f.month+'-01')},${q(f.families[1].parent.id)},'kids_group');`))}
 if(full){result.plans.quotaFull=JSON.parse(sql(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT admin_makeup_browse_v1(${q(f.admin.id)},${q(p.month+'-01')},'kids_group',${q(fullName)});`));result.quotaFull={parent:fullParent,state:JSON.parse(sql(`SELECT task10_family_makeup_state_v1(${q(f.admin.id)},${q(fullParent)},${q(p.month+'-01')});`))};assert.equal(result.quotaFull.state.remaining,0)}
 result.scope={families:[10,100],pageSize:10,historyPage:20,samples:30,coldSeparate:true,sourceFacts:'same owned synthetic dataset',normalBlockingAtEnd:sql("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock';")}
 fs.writeFileSync(path.join(root,'performance-'+label+'.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify({passed:true,label,summary:result.summary}))
}else throw Error('Unknown mode')
