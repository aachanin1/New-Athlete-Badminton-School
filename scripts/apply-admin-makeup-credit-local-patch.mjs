// Candidate iteration only: the imported guard proves this task's disposable
// physical containers/volume/network and run marker before any SQL write.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {sql} from '../tests/admin-makeup-browse/runtime.mjs'
const migration=fs.readFileSync('supabase/migrations/20261019065814_admin_makeup_credit_approval_v1.sql','utf8')
if(sql("SELECT to_regclass('public.admin_makeup_credit_control') IS NULL;")==='t')sql(migration.split('-- BEGIN ADMIN CREDIT CONTROL')[1].split('-- END ADMIN CREDIT CONTROL')[0])
function definition(name){
 const index=migration.search(new RegExp('CREATE (?:OR REPLACE )?FUNCTION public\\.'+name+'\\('));assert.ok(index>=0,name)
 const text=migration.slice(index),delimiter=/\bAS (\$[a-z_]*\$)/i.exec(text);assert.ok(delimiter,name)
 const end=text.indexOf(delimiter[1],delimiter.index+delimiter[0].length);assert.ok(end>=0,name)
 return text.slice(0,end+delimiter[1].length).replace(/^CREATE FUNCTION/,'CREATE OR REPLACE FUNCTION')+';'
}
const names=['admin_makeup_credit_store_proof_v1','admin_makeup_credit_decide_v1','task10_family_makeup_state_v1','lesson_source_previous_kids_makeup_v1','admin_makeup_browse_v1','admin_makeup_history_v1','lesson_source_transition_v1','admin_makeup_credit_store_v1']
sql('BEGIN;SELECT pg_advisory_xact_lock(10,1);SELECT pg_advisory_xact_lock(10,2);\n'+names.map(definition).join('\n')+"\nUPDATE public.admin_makeup_credit_control SET writer_hash=md5(pg_get_functiondef('public.lesson_source_transition_v1(uuid,text,uuid,jsonb)'::regprocedure)),enabled=true WHERE singleton;NOTIFY pgrst,'reload schema';COMMIT;")
console.log(JSON.stringify({patched:names.length,enabled:'isolated Local only'}))
