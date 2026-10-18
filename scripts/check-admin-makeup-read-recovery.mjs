import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {run,sql,q} from '../tests/branch-closure/isolated-runtime.mjs'
const dir=path.join(run.evidenceRoot,'refinement'),f=JSON.parse(fs.readFileSync(path.join(dir,'fixture.json'))),checks=[]
const tables=['bookings','payments','booking_sessions','attendance','lesson_wallet_credits','task10_family_makeup_uses','task10_policy_activation']
const state=()=>JSON.parse(sql('SELECT jsonb_build_object('+tables.map(t=>`${q(t)},(SELECT md5(coalesce(string_agg(row_to_json(r)::text,'' ORDER BY row_to_json(r)::text),'')) FROM public.${t} r)`).join(',')+');'))
const hashes=()=>JSON.parse(sql("SELECT jsonb_object_agg(proname||'('||pg_get_function_identity_arguments(oid)||')',md5(pg_get_functiondef(oid))) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f';"))
const before=state(),functions=hashes(),migration=fs.readFileSync('supabase/migrations/20261018135934_admin_makeup_scoped_reads.sql','utf8'),inner=migration.replace(/^BEGIN;\s*/,'').replace(/COMMIT;\s*$/,'')
assert.ok(!inner.includes('COMMIT;')&&!inner.includes('BEGIN;'),'Rehearsal must retain outer rollback transaction')
const output=sql(`BEGIN;
DROP FUNCTION public.admin_makeup_lookup_v1(uuid,date,text,text,uuid,integer,text,uuid,uuid,uuid);
DROP FUNCTION public.admin_branch_closure_overview_v1(uuid,date,uuid);
SELECT jsonb_build_object('oldReaderAfterDrop',(admin_lesson_sessions_v1(${q(f.sa.id)},${q(f.f.date.slice(0,7)+'-01')},'',NULL,NULL,1,${q(f.f.ids[0])})->'items'->0->>'id'));
${inner}
SELECT jsonb_object_agg(proname||'('||pg_get_function_identity_arguments(oid)||')',md5(pg_get_functiondef(oid))) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f';
ROLLBACK;`)
const rows=output.split('\n').filter(x=>x.startsWith('{')).map(x=>JSON.parse(x));assert.equal(rows[0].oldReaderAfterDrop,f.f.ids[0]);checks.push('Previous application reader remains usable with both new helpers absent')
assert.deepEqual(rows[1],functions);checks.push('Fresh application of the exact additive migration reconstructs every function body exactly')
assert.deepEqual(hashes(),functions);checks.push('Rollback restores the original local function snapshot')
assert.deepEqual(state(),before);checks.push('Fresh/recovery rehearsal preserves all seven business and policy table hashes')
const baseline=JSON.parse(fs.readFileSync(path.join(dir,'baseline-benchmark.json'))).functions
assert.ok(Object.entries(baseline).every(([key,hash])=>functions[key]===hash));checks.push('All pre-task public functions remain byte-equivalent for application-only recovery')
const grants=JSON.parse(sql("SELECT jsonb_object_agg(proname,jsonb_build_object('anon',has_function_privilege('anon',oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',oid,'EXECUTE'),'service',has_function_privilege('service_role',oid,'EXECUTE'))) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('admin_makeup_lookup_v1','admin_branch_closure_overview_v1');"))
assert.ok(Object.values(grants).every(g=>!g.anon&&!g.authenticated&&g.service));checks.push('Both read helpers retain service-only ACL after recovery')
const file=path.join(dir,'read-recovery-'+Date.now()+'.json');fs.writeFileSync(file,JSON.stringify({passed:true,checks,tableHashes:before,baselineFunctions:Object.keys(baseline).length,currentFunctions:Object.keys(functions).length,grants},null,2),{flag:'wx'});console.log(JSON.stringify({passed:checks.length,file}))
