import fs from 'node:fs'
import assert from 'node:assert/strict'
import {run,sql} from '../tests/admin-makeup-browse/runtime.mjs'
assert.equal(run.target.project,'AdminMakeupBrowse20261019')
assert.equal(sql('SELECT count(*) FROM public.admin_makeup_credit_control;'),'1')
const migration=fs.readFileSync('supabase/migrations/20261019100346_admin_makeup_store_once_v9.sql','utf8')
if(process.argv[2]==='iterate'){
 assert.equal(sql('SELECT store_once_enabled FROM public.admin_makeup_credit_control;'),'t')
 const names=['task10_family_makeup_state_v1','lesson_source_previous_kids_makeup_v1','admin_makeup_browse_v1','admin_makeup_history_v1','lesson_source_transition_v1']
 const definitions=names.map(name=>{const start=migration.indexOf('CREATE OR REPLACE FUNCTION public.'+name+'(');assert.ok(start>=0,name);const body=migration.slice(start),delimiter=/\bAS (\$[a-z_]*\$)/i.exec(body);assert.ok(delimiter,name);const end=body.indexOf(delimiter[1],delimiter.index+delimiter[0].length);assert.ok(end>=0,name);return body.slice(0,end+delimiter[1].length)+';'})
 sql('BEGIN;SELECT pg_advisory_xact_lock(10,1);SELECT pg_advisory_xact_lock(10,2);\n'+definitions.join('\n')+"\nUPDATE public.admin_makeup_credit_control SET writer_hash=md5(pg_get_functiondef('public.lesson_source_transition_v1(uuid,text,uuid,jsonb)'::regprocedure));NOTIFY pgrst,'reload schema';COMMIT;")
}else{
 sql(migration)
 assert.equal(sql('SELECT store_once_enabled FROM public.admin_makeup_credit_control;'),'f')
}
sql('UPDATE public.admin_makeup_credit_control SET store_once_enabled=true;')
console.log(JSON.stringify({applied:true,enabled:'owned Local synthetic acceptance only',ledger:sql('SELECT count(*) FROM supabase_migrations.schema_migrations;')}))
