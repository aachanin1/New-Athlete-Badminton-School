import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {randomUUID,createHash} from 'node:crypto'
import {run,sql,q} from '../tests/admin-makeup-browse/runtime.mjs'
const root=path.join(run.outputDir,'v9'),container='supabase_db_'+run.target.project,checks=[]
const check=(ok,name)=>{assert.ok(ok,name);checks.push(name);console.log(name)}
const invoke=(args,input)=>execFileSync('docker',['exec','-i',container,...args],{input,encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','pipe'],maxBuffer:96*1024*1024})
const schema=invoke(['pg_dump','-U','postgres','-d','postgres','--schema-only','--no-owner','--exclude-extension=pg_cron','--exclude-schema=cron'])
const data=invoke(['pg_dump','-U','postgres','-d','postgres','--data-only','--disable-triggers','--no-owner','--no-privileges','--schema=public','--schema=auth'])
const name='admin_store_once_'+randomUUID().replaceAll('-','');assert.match(name,/^admin_store_once_[a-f0-9]{32}$/)
sql(`CREATE DATABASE ${name} TEMPLATE template0;`)
const query=input=>invoke(['psql','-U','supabase_admin','-d',name,'-X','-qAt','-v','ON_ERROR_STOP=1'],input).trim()
query(schema);query(data)
const tables=['bookings','booking_sessions','attendance','lesson_wallet_credits','lesson_wallet_credit_members','task10_family_makeup_uses','lesson_source_operations','activity_logs','notifications','payments','coupon_usages','admin_makeup_credit_approvals','admin_makeup_credit_decisions','admin_makeup_store_requests','admin_makeup_credit_intents']
const snapshot=()=>Object.fromEntries(tables.map(table=>[table,JSON.parse(query(`SELECT jsonb_build_object('count',count(*),'md5',md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''))) FROM public.${table} t;`))]))
const before=snapshot(),changed=['task10_family_makeup_state_v1','lesson_source_previous_kids_makeup_v1','admin_makeup_browse_v1','admin_makeup_history_v1','lesson_source_transition_v1']
const functions=JSON.parse(sql(`SELECT jsonb_object_agg(oid::regprocedure::text,pg_get_functiondef(oid)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN (${changed.map(q).join(',')});`))
const forward='BEGIN;SELECT pg_advisory_xact_lock(10,1);SELECT pg_advisory_xact_lock(10,2);\n'+Object.values(functions).map(body=>body+';').join('\n')+"\nUPDATE public.admin_makeup_credit_control SET writer_hash=md5(pg_get_functiondef('public.lesson_source_transition_v1(uuid,text,uuid,jsonb)'::regprocedure)),store_once_enabled=true;NOTIFY pgrst,'reload schema';COMMIT;\n"
const forwardFile=root+'/forward-v9-'+Date.now()+'.sql';fs.writeFileSync(forwardFile,forward,{flag:'wx'})
query(fs.readFileSync(root+'/rollback-v8.sql','utf8'))
check(query('SELECT store_once_enabled FROM admin_makeup_credit_control;')==='f','Rollback disables new Store policy and preserves private evidence')
assert.deepEqual(snapshot(),before);check(true,'V8 rollback preserves all fifteen business/private table fingerprints')
query(forward);assert.deepEqual(snapshot(),before);check(true,'Exact v9 forward recovery preserves all rows and evidence')
query(fs.readFileSync(root+'/rollback-v8.sql','utf8'))
query(`DROP FUNCTION public.admin_makeup_confirm_stored_source_v9(uuid,uuid,uuid);
DROP FUNCTION public.admin_makeup_store_once_preview_v1(uuid,uuid);
DROP FUNCTION public.admin_makeup_store_once_ready_v1(uuid);
ALTER TABLE public.admin_makeup_credit_control DROP COLUMN store_once_enabled;`)
const migration=fs.readFileSync('supabase/migrations/20261019100346_admin_makeup_store_once_v9.sql','utf8')
query(migration);assert.deepEqual(snapshot(),before);check(true,'Literal v9 migration installs on populated v8 with no historical or balance writes')
check(query('SELECT store_once_enabled FROM admin_makeup_credit_control;')==='f','Literal migration defaults the new policy off')
const f=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json')))
check(query(`SELECT admin_makeup_store_once_ready_v1(${q(f.admin.id)});`)==='f','New Store refuses a disabled installation')
const legacyCandidate=JSON.parse(query("SELECT row_to_json(x) FROM (SELECT s.id,b.id AS booking,b.user_id FROM booking_sessions s JOIN bookings b ON b.id=s.booking_id JOIN profiles p ON p.id=b.user_id WHERE p.full_name LIKE 'เตรียมไม่สำเร็จหน้าจอเก็บเดียว%' AND s.status='scheduled' AND NOT EXISTS(SELECT 1 FROM lesson_wallet_credits w WHERE w.original_session_id=s.id) ORDER BY s.id LIMIT 1) x;"))
assert.ok(legacyCandidate)
const disabledState=JSON.parse(query(`BEGIN;SELECT set_config('task10.booking_write','authorized',true);SELECT set_config('task10.payment_write','authorized',true);UPDATE bookings SET total_sessions=3 WHERE id=${q(legacyCandidate.booking)};SELECT lesson_source_transition_v1(${q(f.admin.id)},'admin_store',${q(legacyCandidate.id)},${q(JSON.stringify({reason:'เครดิตเดิมยังใช้งานตามรุ่น8',requestId:randomUUID()}))}::jsonb);SELECT task10_family_makeup_state_v1(${q(f.admin.id)},${q(legacyCandidate.user_id)},date_trunc('month',(SELECT date FROM booking_sessions WHERE id=${q(legacyCandidate.id)}))::date);ROLLBACK;`).split('\n').findLast(line=>line.startsWith('{')&&line.includes('sourceMonth')))
check(!disabledState.eligible&&disabledState.sources[0].approvalAvailable&&disabledState.storedReadySources===0,'Disabled v9 preserves v8 manual approval availability without enabling automatic legacy use')
query('UPDATE admin_makeup_credit_control SET store_once_enabled=true;')
check(query(`SELECT admin_makeup_store_once_ready_v1(${q(f.admin.id)});`)==='t','Compatible writer enables readiness without data rewriting')
for(const role of ['anon','authenticated'])check(query(`SELECT bool_and(NOT has_function_privilege(${q(role)},oid,'EXECUTE')) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('admin_makeup_confirm_stored_source_v9','admin_makeup_store_once_preview_v1','admin_makeup_store_once_ready_v1');`)==='t',role+' cannot execute new private helpers')
check(query("SELECT NOT has_function_privilege('service_role','public.admin_makeup_confirm_stored_source_v9(uuid,uuid,uuid)','EXECUTE');")==='t','Legacy confirmation has no direct service-role RPC entry')
assert.deepEqual(snapshot(),before);check(true,'Migration/enable/permissions checks leave all historical evidence unchanged')
fs.writeFileSync(path.join(root,'recovery-'+Date.now()+'.json'),JSON.stringify({passed:true,runId:run.runId,clone:name,checks,before,forwardFile,migrationSha256:createHash('sha256').update(migration).digest('hex')},null,2),{flag:'wx'})
console.log(JSON.stringify({passed:checks.length,clone:name}))
