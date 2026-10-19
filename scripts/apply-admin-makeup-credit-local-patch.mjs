// Candidate iteration only: the imported guard proves this task's disposable
// physical containers/volume/network and run marker before any SQL write.
import fs from 'node:fs'
import assert from 'node:assert/strict'
import {sql} from '../tests/admin-makeup-browse/runtime.mjs'
const migration=fs.readFileSync('supabase/migrations/20261019065814_admin_makeup_credit_approval_v1.sql','utf8')
const permissionsOnly=process.argv[2]==='permissions-only'
assert.ok(process.argv[2]===undefined||permissionsOnly,'Use no argument or permissions-only')
// Iterative CREATE OR REPLACE can introduce a helper after the first literal
// install. Reapply the literal migration's private grants in the same patch;
// PostgreSQL's default PUBLIC EXECUTE must never survive that Local rehearsal.
const privateGrants=`
REVOKE ALL ON FUNCTION public.admin_makeup_credit_store_proof_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.admin_makeup_credit_decide_v1(uuid,uuid,text,text,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_makeup_credit_decide_v1(uuid,uuid,text,text,uuid,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.admin_makeup_credit_store_v1(uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_makeup_credit_store_v1(uuid,text,uuid,jsonb) TO service_role;
`
for(const statement of privateGrants.trim().split('\n'))assert.ok(migration.includes(statement),'Private grants must match the literal migration')
if(permissionsOnly)assert.equal(sql("SELECT to_regclass('public.admin_makeup_credit_control') IS NOT NULL;"),'t')
if(sql("SELECT to_regclass('public.admin_makeup_credit_control') IS NULL;")==='t')sql(migration.split('-- BEGIN ADMIN CREDIT CONTROL')[1].split('-- END ADMIN CREDIT CONTROL')[0])
function definition(name){
 const index=migration.search(new RegExp('CREATE (?:OR REPLACE )?FUNCTION public\\.'+name+'\\('));assert.ok(index>=0,name)
 const text=migration.slice(index),delimiter=/\bAS (\$[a-z_]*\$)/i.exec(text);assert.ok(delimiter,name)
 const end=text.indexOf(delimiter[1],delimiter.index+delimiter[0].length);assert.ok(end>=0,name)
 return text.slice(0,end+delimiter[1].length).replace(/^CREATE FUNCTION/,'CREATE OR REPLACE FUNCTION')+';'
}
const names=['admin_makeup_credit_store_proof_v1','admin_makeup_credit_decide_v1','task10_family_makeup_state_v1','lesson_source_previous_kids_makeup_v1','admin_makeup_browse_v1','admin_makeup_history_v1','lesson_source_transition_v1','admin_makeup_credit_store_v1']
sql('BEGIN;SELECT pg_advisory_xact_lock(10,1);SELECT pg_advisory_xact_lock(10,2);\n'+(permissionsOnly?'':names.map(definition).join('\n'))+privateGrants+(permissionsOnly?'':"\nUPDATE public.admin_makeup_credit_control SET writer_hash=md5(pg_get_functiondef('public.lesson_source_transition_v1(uuid,text,uuid,jsonb)'::regprocedure)),enabled=true WHERE singleton;")+"NOTIFY pgrst,'reload schema';COMMIT;")
const privileges=JSON.parse(sql("SELECT jsonb_build_object('publicDenied',bool_and(NOT has_function_privilege('anon',oid,'EXECUTE') AND NOT has_function_privilege('authenticated',oid,'EXECUTE')),'storeService',has_function_privilege('service_role','public.admin_makeup_credit_store_v1(uuid,text,uuid,jsonb)','EXECUTE'),'proofInternal',NOT has_function_privilege('service_role','public.admin_makeup_credit_store_proof_v1(uuid,uuid)','EXECUTE')) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('admin_makeup_credit_store_proof_v1','admin_makeup_credit_decide_v1','admin_makeup_credit_store_v1');"))
assert.deepEqual(privileges,{publicDenied:true,storeService:true,proofInternal:true})
console.log(JSON.stringify({patched:permissionsOnly?0:names.length,privateGrantsVerified:true,enabled:'isolated Local only'}))
