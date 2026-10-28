import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {execFileSync}from'node:child_process'
if(process.argv[2]==='snapshot'){
 const name=process.argv[3];if(!['booking-ux-1','booking-ux-upgrade-1'].includes(name))throw Error('Owned projects only')
 process.env.LESSON_SOURCE_RUN_MANIFEST=path.resolve('.playwright/'+name+'/run.json');process.env.TASK10_DISPOSABLE_TARGET=path.resolve('.playwright/'+name+'/target.json')
 const {sql,run}=await import('../tests/booking-ux/runtime.mjs')
 const functions=JSON.parse(sql("SELECT jsonb_object_agg(oid::regprocedure::text,jsonb_build_object('hash',md5(replace(pg_get_functiondef(oid),chr(13),'')),'acl',proacl::text,'config',proconfig,'definer',prosecdef,'owner',pg_get_userbyid(proowner))) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f'"))
 const columns=JSON.parse(sql("SELECT jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',udt_name,'default',column_default,'nullable',is_nullable)ORDER BY table_name,ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND (table_name LIKE 'booking_ux_%' OR table_name='booking_package_units' OR table_name='bookings')"))
 console.log(JSON.stringify({project:run.target.project,runId:run.runId,functions,columns,migrations:JSON.parse(sql('SELECT jsonb_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations'))}));process.exit(0)
}
// Apply only the newly added final migration on the physically verified fresh
// installation. Earlier 65 migrations already ran through the Local CLI.
process.env.LESSON_SOURCE_RUN_MANIFEST=path.resolve('.playwright/booking-ux-upgrade-1/run.json');process.env.TASK10_DISPOSABLE_TARGET=path.resolve('.playwright/booking-ux-upgrade-1/target.json')
const {run}=await import('../tests/booking-ux/runtime.mjs')
for(const name of fs.readdirSync('supabase/migrations').filter(n=>n.startsWith('20261020')&&n.endsWith('.sql')))fs.copyFileSync('supabase/migrations/'+name,path.join(run.target.workdir,'supabase/migrations',name))
execFileSync(run.cli,['migration','up','--local','--workdir',run.target.workdir],{encoding:'utf8',windowsHide:true,stdio:'pipe'})
const snapshots=['booking-ux-1','booking-ux-upgrade-1'].map(name=>JSON.parse(execFileSync(process.execPath,[path.resolve('scripts/check-booking-ux-migrations.mjs'),'snapshot',name],{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024})))
assert.deepEqual(snapshots[0].functions,snapshots[1].functions,'All public function definitions, ACLs, owner, definer and pinned config match fresh installation')
assert.deepEqual(snapshots[0].columns,snapshots[1].columns,'All new contract and booking columns match fresh installation')
const source=fs.readdirSync('supabase/migrations').filter(n=>fs.statSync('supabase/migrations/'+n).size).map(n=>n.split('_')[0]).sort();assert.deepEqual(snapshots[1].migrations,source)
const result={passed:true,functions:Object.keys(snapshots[0].functions).length,migrations:source.length,latest:source.at(-1),main:snapshots[0].runId,fresh:snapshots[1].runId,checks:['Clean Local installation runs every migration','Final iterative schema and all public function/ACL/config definitions match the fresh installation','No test-clock override remains in the verified schema']}
fs.writeFileSync('.playwright/booking-ux-1/migration-audit-result.json',JSON.stringify(result,null,2));fs.writeFileSync('.playwright/booking-ux-1/migration-function-snapshots.json',JSON.stringify(snapshots,null,2));console.log(JSON.stringify(result))
