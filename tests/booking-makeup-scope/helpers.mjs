import fs from 'node:fs'
import path from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { run, sql, q } from './runtime.mjs'
export const fixture=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json'),'utf8'))
export const read=s=>JSON.parse(sql(s))
export const rpc=(name,args)=>read(`SELECT public.${name}(${args});`)
export function historical({parent=fixture.parent,sourceChild=fixture.children[0],attending=fixture.children[0],count=1,status='completed',sourceMonth=fixture.dates.previous,targetDate=fixture.dates.past}={}) {
 const booking=randomUUID(),rootIds=Array.from({length:count*4},randomUUID),destinations=Array.from({length:count},randomUUID)
 const course=fixture.courses.kids_group
 const scope=sql(`INSERT INTO booking_pricing_scopes(user_id,course_type_id,lesson_year,lesson_month) VALUES(${q(parent.id)},${q(course)},extract(year FROM date ${q(sourceMonth)}),extract(month FROM date ${q(sourceMonth)})) ON CONFLICT(user_id,course_type_id,lesson_year,lesson_month,currency) DO UPDATE SET currency=excluded.currency RETURNING id;`)
 // Historical synthetic purchase, before policy activation. Fixture construction
 // is permitted only by the physically verified task-owned Local transport.
 sql(`BEGIN;CREATE TEMP TABLE scope_fixture_policy ON COMMIT DROP AS SELECT * FROM task10_policy_activation;
 CREATE TEMP TABLE scope_fixture_control ON COMMIT DROP AS SELECT * FROM booking_ux_control;
 UPDATE booking_ux_control SET enabled=false;
 UPDATE task10_policy_activation SET state='never_activated',effective_at=NULL,pricing_enabled=false,makeup_enabled=false,expiry_enabled=false;
 SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);SELECT set_config('task10.booking_write','authorized',true);
 INSERT INTO bookings(id,user_id,learner_type,child_id,branch_id,course_type_id,month,year,total_sessions,total_price,status,pricing_scope_id,entitlement_sessions,created_at)
 VALUES(${q(booking)},${q(parent.id)},'child',${q(sourceChild)},${q(fixture.branch)},${q(course)},extract(month FROM date ${q(sourceMonth)}),extract(year FROM date ${q(sourceMonth)}),${count*4},${count*2500},'verified',${q(scope)},${count*4},date ${q(sourceMonth)});
 ${rootIds.map((id,i)=>`INSERT INTO booking_sessions(id,booking_id,date,start_time,end_time,branch_id,child_id,status,is_makeup) VALUES(${q(id)},${q(booking)},date ${q(sourceMonth)}+${i},'17:00','19:00',${q(fixture.branch)},${q(sourceChild)},'absent',false);`).join('')}
 ${destinations.map((id,i)=>`INSERT INTO booking_sessions(id,booking_id,date,start_time,end_time,branch_id,child_id,status,is_makeup,rescheduled_from_id) VALUES(${q(id)},${q(booking)},${q(targetDate)},${q(i?'10:00':'17:00')},${q(i?'12:00':'19:00')},${q(fixture.branch)},${q(attending)},${q(status)},true,${q(rootIds[i])});
 INSERT INTO task10_family_makeup_uses(parent_id,source_month,source_booking_id,source_root_id,source_session_id,source_child_id,attending_child_id,destination_session_id,minimum_revision,decision_evidence,actor_id,request_id,request_fingerprint,result)
 VALUES(${q(parent.id)},${q(sourceMonth)},${q(booking)},${q(rootIds[i])},${q(rootIds[i])},${q(sourceChild)},${q(attending)},${q(id)},(SELECT min(revision) FROM task10_setting_revisions),'{}',${q(fixture.admin.id)},${q(randomUUID())},repeat('a',64),${q(JSON.stringify({sessionId:id}))});`).join('')}
 UPDATE task10_policy_activation SET state=p.state,effective_at=p.effective_at,pricing_enabled=p.pricing_enabled,makeup_enabled=p.makeup_enabled,expiry_enabled=p.expiry_enabled FROM scope_fixture_policy p;
 UPDATE booking_ux_control SET enabled=p.enabled FROM scope_fixture_control p;COMMIT;`)
 return {booking,scope,rootIds,destinations,parent,attending,sourceMonth,targetDate}
}
export function activate(){sql("UPDATE task10_policy_activation SET state='active',effective_at=clock_timestamp()-interval '1 day',pricing_enabled=true,makeup_enabled=true,expiry_enabled=true;UPDATE booking_ux_control SET enabled=true;")}
export function session(date,child=fixture.children[0],start='17:00'){
 const end=start==='17:00'?'19:00':'12:00',day=new Date(date+'T12:00:00+07:00').getUTCDay()
 const template=fixture.templates.find(t=>t.course==='kids_group'&&t.day===day&&t.start===start)
 if(!template)throw Error('No canonical fixture template')
 return {date,startTime:start,endTime:end,branchId:fixture.branch,childId:child,scheduleTemplateId:template.id}
}
export function body(sessions,actor=fixture.parent){
 const [year,month]=sessions[0].date.split('-').map(Number),course=fixture.courses.kids_group
 const scope=read(`SELECT coalesce((SELECT to_jsonb(s) FROM booking_pricing_scopes s WHERE user_id=${q(actor.id)} AND course_type_id=${q(course)} AND lesson_year=${year} AND lesson_month=${month}),'null'::jsonb);`)
 const baseline=read(`SELECT to_jsonb(x) FROM progressive_legacy_baseline_v1(${q(actor.id)},${q(course)},${year},${month}) x;`)
 const policy=rpc('task10_booking_policy_quote_v1',`${q(actor.id)},${q(course)},${q(`${year}-${String(month).padStart(2,'0')}-01`)},'progressive',NULL`)
 return {learnerType:'child',childId:sessions.every(s=>s.childId===sessions[0].childId)?sessions[0].childId:null,participants:[...new Set(sessions.map(s=>s.childId))],branchId:fixture.branch,courseTypeId:course,month,year,totalSessions:sessions.length,sessions,expectedScopeRevision:scope?.revision||0,expectedLegacyBaselineSessions:Number(baseline.baseline_sessions),expectedLegacyBaselineFingerprint:baseline.baseline_fingerprint,expectedPolicyFingerprint:policy.fingerprint}
}
export const create=(input,request=randomUUID(),actor=fixture.parent)=>rpc('booking_ux_create_v1',`${q(actor.id)},${q(request)},${q(JSON.stringify(input))}::jsonb`)
export const snapshot=ids=>read(`SELECT jsonb_build_object('bills',(SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM bookings b WHERE b.id=ANY(${q('{'+ids.join(',')+'}')}::uuid[])),'sessions',(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM booking_sessions s WHERE s.booking_id=ANY(${q('{'+ids.join(',')+'}')}::uuid[])),'uses',(SELECT jsonb_agg(to_jsonb(u) ORDER BY u.id) FROM task10_family_makeup_uses u WHERE u.source_booking_id=ANY(${q('{'+ids.join(',')+'}')}::uuid[])),'payments',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM payments p WHERE p.booking_id=ANY(${q('{'+ids.join(',')+'}')}::uuid[])));`)
export function evidence(label,data){
 const dependencies=[...fs.readdirSync('tests/booking-makeup-scope').filter(n=>n.endsWith('.mjs')).map(n=>'tests/booking-makeup-scope/'+n),'tests/branch-closure/isolated-runtime.mjs','tests/branch-closure/fixtures.mjs','scripts/verify-lesson-source-test-target.mjs','scripts/build-booking-makeup-scope-local.mjs','scripts/prepare-booking-makeup-scope-local.mjs']
 const definitionFiles=Object.fromEntries(dependencies.sort().map(file=>[file,hashFile(file)]))
 const sourceFiles=Object.fromEntries(['src/lib/booking-checkout-server.ts','supabase/migrations/20261107060410_booking_makeup_scope_membership_v1.sql'].map(file=>[file,hashFile(file)]))
 const schemaIdentity=read("SELECT jsonb_object_agg(proname,md5(replace(pg_get_functiondef(oid),chr(13),''))) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('progressive_assert_scope_membership_v1','progressive_proven_makeup_destination_v1')")
 const file=path.join(run.outputDir,label+'-'+Date.now()+'-'+randomUUID()+'.json')
 fs.writeFileSync(file,JSON.stringify({runId:run.runId,at:new Date().toISOString(),definitionFiles,sourceFiles,schemaIdentity,...data},null,2),{flag:'wx'});return file
}
export const hashFile=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex')
