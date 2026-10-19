import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {createHash,randomUUID} from 'node:crypto'
import {run,sql,q} from '../tests/admin-makeup-browse/runtime.mjs'

// The shared guard physically verifies this task's Docker IDs, bindings, volume
// and ownership marker before this disposable-only clone is created.
const name='admin_makeup_recovery_'+randomUUID().replaceAll('-',''),container='supabase_db_'+run.target.project
assert.match(name,/^admin_makeup_recovery_[a-f0-9]{32}$/)
const output=path.join(run.outputDir,'recovery-'+Date.now()+'.json'),checks=[]
const check=(value,label)=>{assert.ok(value,label);checks.push(label);console.log(label)}
const invoke=(args,input)=>execFileSync('docker',['exec','-i',container,...args],{input,encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','pipe'],maxBuffer:64*1024*1024})
// All data in this new project is synthetic. No hosted database is read.
const schema=invoke(['pg_dump','-U','postgres','-d','postgres','--schema-only','--no-owner','--exclude-extension=pg_cron','--exclude-schema=cron'])
const data=invoke(['pg_dump','-U','postgres','-d','postgres','--data-only','--disable-triggers','--no-owner','--no-privileges','--schema=public','--schema=auth'])
sql(`CREATE DATABASE ${name} TEMPLATE template0;`)
const scratch=input=>invoke(['psql','-U','supabase_admin','-d',name,'-X','-qAt','-v','ON_ERROR_STOP=1'],input).trim()
scratch(schema);scratch(data)
const names=['admin_makeup_browse_v1','admin_makeup_history_v1','admin_close_makeup_review_v1'],list=names.map(q).join(',')
const functions=(query)=>JSON.parse(query(`SELECT coalesce(jsonb_object_agg(p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid))),'{}') FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind='f' AND p.proname NOT IN (${list});`))
const newFunctions=query=>JSON.parse(query(`SELECT jsonb_object_agg(p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid))) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN (${list});`))
const tables=['bookings','booking_sessions','attendance','lesson_wallet_credits','lesson_wallet_credit_members','task10_family_makeup_uses','activity_logs','notifications']
const fingerprint=query=>Object.fromEntries(tables.map(table=>[table,JSON.parse(query(`SELECT jsonb_build_object('count',count(*),'md5',md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''))) FROM public.${table} t;`))]))
const before=fingerprint(scratch),oldFunctions=functions(scratch),originalNew=newFunctions(sql)
check(tables.every(t=>before[t].count>0),'Recovery clone contains real synthetic source, attendance, wallet, quota, audit and notification records')
const drop=`DO $drop$ DECLARE f record;BEGIN FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN (${list}) LOOP EXECUTE 'DROP FUNCTION '||f.signature;END LOOP;END $drop$;`
scratch(drop)
check(scratch(`SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN (${list});`)==='0','Additive rollback needs no cascade or changes to old functions')
assert.deepEqual(functions(scratch),oldFunctions);check(true,'Old business function definitions survive rollback unchanged')
const migration=fs.readFileSync('supabase/migrations/20261019045238_admin_makeup_browse_history_review_close_v1.sql','utf8')
scratch(migration)
assert.deepEqual(newFunctions(scratch),originalNew);check(true,'Literal candidate migration installs the exact three functions tested by the application')
assert.deepEqual(fingerprint(scratch),before);check(true,'Migration changes no rows across eight business tables')
assert.deepEqual(functions(scratch),oldFunctions);check(true,'Migration leaves every pre-existing public function unchanged')
const privileges=scratch(`SELECT bool_and(p.prosecdef AND p.proconfig @> ARRAY['search_path=public, pg_temp'] AND has_function_privilege('service_role',p.oid,'execute') AND NOT has_function_privilege('anon',p.oid,'execute') AND NOT has_function_privilege('authenticated',p.oid,'execute')) FROM pg_proc p WHERE pronamespace='public'::regnamespace AND proname IN (${list});`)
check(privileges==='t','All new functions have fixed search paths and service-only execute grants')
scratch(drop);assert.deepEqual(fingerprint(scratch),before);assert.deepEqual(functions(scratch),oldFunctions)
check(true,'Recovery removes only new functions and preserves all business rows and old writers')
scratch(migration);assert.deepEqual(fingerprint(scratch),before);assert.deepEqual(newFunctions(scratch),originalNew)
check(true,'Reapplying after recovery preserves data and restores the exact candidate')
const f=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json')))
const result=JSON.parse(scratch(`SELECT admin_makeup_browse_v1(${q(f.admin.id)},${q(f.month+'-01')},'kids_group');`))
check(result.cards.length<=10&&result.total>10,'Reapplied candidate reads the cloned permissions and real synthetic family facts')
const advisorPath=fs.readdirSync(run.outputDir).filter(f=>f.startsWith('security-advisors-')).sort().at(-1),advisors=JSON.parse(fs.readFileSync(path.join(run.outputDir,advisorPath)))
check(advisors.every(a=>!names.includes(a.metadata?.name)),'Security advisors flag no newly added object')
const baselineObjects=new Set(Object.keys(oldFunctions).map(s=>s.split('(')[0].split('.').at(-1)))
check(advisors.filter(a=>a.metadata?.type==='function').every(a=>baselineObjects.has(a.metadata.name)),'Advisor function warnings belong to unchanged baseline functions')
fs.writeFileSync(output,JSON.stringify({passed:true,runId:run.runId,database:name,scope:'Owned synthetic Local clone, unreachable by app/API',checks,before,migrationSha256:createHash('sha256').update(migration).digest('hex'),newFunctions:originalNew,oldFunctionCount:Object.keys(oldFunctions).length,advisors:advisors.map(a=>({name:a.name,level:a.level,object:a.metadata?.name}))},null,2),{flag:'wx'})
console.log(JSON.stringify({passed:checks.length,output}))
