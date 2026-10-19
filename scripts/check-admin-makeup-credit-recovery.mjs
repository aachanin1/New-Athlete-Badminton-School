import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {createHash,randomUUID} from 'node:crypto'
import {run,sql,q} from '../tests/admin-makeup-browse/runtime.mjs'
const root=path.join(run.outputDir,'v8'),container='supabase_db_'+run.target.project,checks=[]
const check=(v,name)=>{assert.ok(v,name);checks.push(name);console.log(name)}
const invoke=(args,input)=>execFileSync('docker',['exec','-i',container,...args],{input,encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','pipe'],maxBuffer:96*1024*1024})
const schema=invoke(['pg_dump','-U','postgres','-d','postgres','--schema-only','--no-owner','--exclude-extension=pg_cron','--exclude-schema=cron'])
const data=invoke(['pg_dump','-U','postgres','-d','postgres','--data-only','--disable-triggers','--no-owner','--no-privileges','--schema=public','--schema=auth'])
function clone(label){
 const name='admin_credit_'+label+'_'+randomUUID().replaceAll('-','');assert.match(name,/^admin_credit_[a-z]+_[a-f0-9]{32}$/)
 sql(`CREATE DATABASE ${name} TEMPLATE template0;`)
 const query=input=>invoke(['psql','-U','supabase_admin','-d',name,'-X','-qAt','-v','ON_ERROR_STOP=1'],input).trim()
 query(schema);query(data);return {name,query}
}
const business=['bookings','booking_sessions','attendance','lesson_wallet_credits','lesson_wallet_credit_members','task10_family_makeup_uses','activity_logs','notifications','payments','coupon_usages']
const privateTables=['admin_makeup_credit_approvals','admin_makeup_credit_decisions','admin_makeup_store_requests','admin_makeup_credit_intents']
const fingerprint=(query,tables)=>Object.fromEntries(tables.map(table=>[table,JSON.parse(query(`SELECT jsonb_build_object('count',count(*),'md5',md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''))) FROM public.${table} t;`))]))
const changed=['task10_family_makeup_state_v1','lesson_source_previous_kids_makeup_v1','admin_makeup_browse_v1','admin_makeup_history_v1','lesson_source_transition_v1']
const forward=JSON.parse(sql(`SELECT jsonb_object_agg(oid::regprocedure::text,pg_get_functiondef(oid)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN (${changed.map(q).join(',')});`))
const restore='BEGIN;SELECT pg_advisory_xact_lock(10,1);SELECT pg_advisory_xact_lock(10,2);\n'+Object.values(forward).map(body=>body+';').join('\n')+"\nUPDATE admin_makeup_credit_control SET enabled=true;NOTIFY pgrst,'reload schema';COMMIT;"
fs.writeFileSync(path.join(root,'forward-functions.sql'),restore,{flag:'wx'})
const rollback=fs.readFileSync(path.join(root,'rollback-functions.sql'),'utf8'),f=JSON.parse(fs.readFileSync(path.join(root,'credit-fixture.json'))),old=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json')))
const recovery=clone('recovery'),before=fingerprint(recovery.query,[...business,...privateTables])
recovery.query(rollback)
assert.deepEqual(fingerprint(recovery.query,[...business,...privateTables]),before);check(true,'Rollback preserves every business and private approval/decision/replay row')
check(recovery.query('SELECT enabled FROM admin_makeup_credit_control;')==='f','Rollback disables exception control while retaining evidence')
const readState=()=>JSON.parse(recovery.query(`SELECT task10_family_makeup_state_v1(${q(f.admin.id)},${q(f.paused.parent.id)},${q(f.month+'-01')});`))
check(readState().eligible===false&&readState().remaining===0,'Old authoritative writer fails closed for a Q0 approved source')
const pending={requestId:randomUUID(),reason:'ทดสอบversionrace',approveCredit:true}
assert.throws(()=>recovery.query(`SELECT admin_makeup_credit_store_v1(${q(f.admin.id)},'admin_store',${q(old.futureReview.ids[0])},${q(JSON.stringify(pending))}::jsonb);`),/TASK10_UNAVAILABLE/)
assert.deepEqual(fingerprint(recovery.query,[...business,...privateTables]),before);check(true,'Dedicated v8 Store refuses an old writer inside the transaction without residue')
recovery.query(restore)
check(recovery.query(`SELECT admin_makeup_credit_ready_v1(${q(f.admin.id)});`)==='t'&&readState().eligible===true,'Exact forward functions restore readiness and the same unspent credit')
assert.deepEqual(fingerprint(recovery.query,[...business,...privateTables]),before);check(true,'Forward recovery changes no business row or approval evidence')

// Separate installation clone: remove only this task's synthetic new objects
// to reconstruct populated v7 schema. This is not the recovery procedure.
const install=clone('install');install.query(rollback)
install.query(`DROP TRIGGER admin_makeup_credit_close_wallet ON public.lesson_wallet_credits;
 DROP TRIGGER admin_makeup_credit_close_makeup ON public.task10_family_makeup_uses;
 DROP FUNCTION public.admin_makeup_credit_close_v1();
 DROP FUNCTION public.admin_makeup_credit_decide_v1(uuid,uuid,text,text,uuid,boolean);
 DROP FUNCTION public.admin_makeup_credit_store_proof_v1(uuid,uuid);
 DROP FUNCTION public.admin_makeup_credit_ready_v1(uuid);
 DROP FUNCTION public.admin_makeup_credit_store_v1(uuid,text,uuid,jsonb);
 DROP FUNCTION public.admin_makeup_previous_transition_v1(uuid,text,uuid,jsonb);
 DROP TABLE public.admin_makeup_credit_decisions;
 DROP TABLE public.admin_makeup_credit_approvals;
 DROP TABLE public.admin_makeup_store_requests;
 DROP TABLE public.admin_makeup_credit_intents;
 DROP TABLE public.admin_makeup_credit_control;
 DROP INDEX public.admin_makeup_store_proof_idx;`)
const installBefore=fingerprint(install.query,business)
const migration=fs.readFileSync('supabase/migrations/20261019065814_admin_makeup_credit_approval_v1.sql','utf8')
install.query(migration)
assert.deepEqual(fingerprint(install.query,business),installBefore);check(true,'Literal migration installs on populated v7 and rewrites no business or historical row')
check(install.query('SELECT enabled FROM admin_makeup_credit_control;')==='f','Literal migration starts exceptions disabled')
check(install.query(`SELECT admin_makeup_credit_ready_v1(${q(f.admin.id)});`)==='t','Literal migration binds readiness to the exact compatible writer')
check(install.query('SELECT count(*) FROM admin_makeup_credit_approvals;')==='0','Migration creates no automatic or historical approvals')
const privilegeTables=[...privateTables,'admin_makeup_credit_control']
check(privilegeTables.every(table=>install.query(`SELECT relrowsecurity AND NOT has_table_privilege('anon',oid,'SELECT') AND NOT has_table_privilege('authenticated',oid,'SELECT') FROM pg_class WHERE oid=${q('public.'+table)}::regclass;`)==='t'),'Every private table retains RLS and denies User/anonymous reads')
const addedFunctions=['admin_makeup_credit_decide_v1','admin_makeup_credit_store_proof_v1','admin_makeup_credit_ready_v1','admin_makeup_credit_store_v1','admin_makeup_credit_close_v1','admin_makeup_previous_transition_v1']
check(install.query(`SELECT bool_and(NOT has_function_privilege('anon',oid,'execute') AND NOT has_function_privilege('authenticated',oid,'execute')) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN (${addedFunctions.map(q).join(',')});`)==='t','All new privileged functions deny direct User/anonymous execution')
fs.writeFileSync(path.join(root,'recovery-'+Date.now()+'.json'),JSON.stringify({passed:true,checks,runId:run.runId,recoveryDatabase:recovery.name,installationDatabase:install.name,scope:'Owned disposable clones unreachable from app/API; no hosted data',before,migrationSha256:createHash('sha256').update(migration).digest('hex')},null,2),{flag:'wx'});console.log(JSON.stringify({passed:checks.length,recovery:recovery.name,install:install.name}))
