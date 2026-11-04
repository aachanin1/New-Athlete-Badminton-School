import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {run,sql,q,read,output,finish,failure} from './helpers.mjs'
import {verifyLessonSourceTarget} from '../../scripts/verify-lesson-source-test-target.mjs'
const dir=output('schema'),checks=[];
try{
 const files=fs.readdirSync('supabase/migrations').filter(f=>f.startsWith('20261104')&&f.endsWith('.sql')).sort();assert.equal(files.length,3);
 const expected={'20261104020934_no_class_round_return_v1.sql':'03b38642f064c89eb2ef469e0a63a9216a535bb37f0a491441c4998b3d762bad','20261104024749_coach_wallet_member_provenance_read_v1.sql':'f6daac8234e8d226c7f8cdfd634c2c53f58a5cf65b8637df3f19dca957e64cfa','20261104024943_no_class_family_rewallet_credit_guard_v1.sql':'7fcc35e71bf73059ce0c629a7b635fc7bf36a7a5aedc5055fe7e4f3ab9f4d9b6'};
 for(const file of files)assert.equal(createHash('sha256').update(fs.readFileSync('supabase/migrations/'+file)).digest('hex'),expected[file]);
 const structure=read(`SELECT jsonb_build_object(
  'publicFunctions',(SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f'),
  'returnRPC',(SELECT jsonb_build_object('definition',pg_get_functiondef(oid),'acl',proacl,'config',proconfig,'definer',prosecdef) FROM pg_proc WHERE oid='public.admin_no_class_return_v1(uuid,uuid,text,uuid,text,text,text)'::regprocedure),
  'payrollFence',pg_get_functiondef('public.admin_no_class_payroll_fence_v1()'::regprocedure),
  'kidsCreditClose',pg_get_functiondef('public.admin_makeup_credit_close_v1()'::regprocedure),
  'view',pg_get_viewdef('public.coach_wallet_member_redemptions_v1'::regclass,true),
  'viewOptions',(SELECT reloptions FROM pg_class WHERE oid='public.coach_wallet_member_redemptions_v1'::regclass),
  'rawMemberAuth',has_table_privilege('authenticated','public.lesson_wallet_credit_members','SELECT'),
  'rawMemberAnon',has_table_privilege('anon','public.lesson_wallet_credit_members','SELECT'),
  'authMutate',has_function_privilege('authenticated','public.admin_no_class_return_v1(uuid,uuid,text,uuid,text,text,text)','EXECUTE'),
  'anonMutate',has_function_privilege('anon','public.admin_no_class_return_v1(uuid,uuid,text,uuid,text,text,text)','EXECUTE'),
  'serviceMutate',has_function_privilege('service_role','public.admin_no_class_return_v1(uuid,uuid,text,uuid,text,text,text)','EXECUTE'),
  'receiptRLS',(SELECT relrowsecurity FROM pg_class WHERE oid='public.admin_no_class_return_receipts'::regclass));`);
 assert.equal(structure.publicFunctions,441);assert.equal(structure.rawMemberAuth,false);assert.equal(structure.rawMemberAnon,false);assert.equal(structure.authMutate,false);assert.equal(structure.anonMutate,false);assert.equal(structure.serviceMutate,true);assert.equal(structure.receiptRLS,true);assert.deepEqual(structure.viewOptions,['security_barrier=true']);assert.ok(structure.returnRPC.config.includes('TimeZone=Asia/Bangkok'));checks.push({name:'current candidate definitions, scoped provenance view and ACL/RLS match reviewed structure',passed:true});
 // These candidate files were already applied as exact SQL on this disposable.
 // Reflect those direct applications in LOCAL history only; never link/cloud.
 // CLI local repair failed to connect on Windows (retained separately), so use
 // the same physically guarded psql transport as the actual SQL applications.
 verifyLessonSourceTarget();const missing=files.map(f=>f.slice(0,14)).filter(v=>sql(`SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='${v}';`)==='0');
 if(missing.length)sql('BEGIN;'+files.filter(f=>missing.includes(f.slice(0,14))).map(f=>`INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES(${q(f.slice(0,14))},${q(f.slice(15,-4))},ARRAY[${q(fs.readFileSync('supabase/migrations/'+f,'utf8'))}]::text[]) ON CONFLICT(version) DO NOTHING;`).join('\n')+'COMMIT;');
 const ledger=read("SELECT jsonb_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations;");assert.equal(ledger.length,95);for(const f of files)assert.ok(ledger.includes(f.slice(0,14)));checks.push({name:'Local history reflects all95 actually applied migrations; frozen bootstrap manifest retained',passed:true});
 fs.writeFileSync(path.join(dir,'structure.json'),JSON.stringify({structure,ledger,migrationHashes:expected,tracking:'93fresh bootstrap then94/95 exact guarded SQL; guarded local history records prior direct applications with exact source SQL'},null,2));finish(dir,checks,{schemaSha256:createHash('sha256').update(JSON.stringify(structure)).digest('hex')})
}catch(e){failure(dir,checks,e)}
