import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {run,sql,q} from '../tests/admin-makeup-review/runtime.mjs'
const f=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'fixture.json'))),checks=[]
const tables=['bookings','booking_sessions','attendance','coach_assignment_groups','coach_assignment_group_students','coach_checkins','lesson_wallet_credits','payments','activity_logs','notifications','admin_makeup_review_requests','admin_makeup_credit_control','task10_policy_activation']
const state=()=>JSON.parse(sql('SELECT jsonb_build_object('+tables.map(t=>`${q(t)},(SELECT md5(coalesce(string_agg(to_jsonb(x)::text,'' ORDER BY to_jsonb(x)::text),'')) FROM public.${t} x)`).join(',')+')'))
const definitions=()=>sql("SELECT jsonb_object_agg(oid::regprocedure::text,jsonb_build_object('definition',md5(pg_get_functiondef(oid)),'acl',proacl,'config',proconfig,'definer',prosecdef)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f'")
const before=state(),functions=JSON.parse(definitions()),migration=fs.readFileSync('supabase/migrations/20261019133852_admin_makeup_review_workflow_v1.sql','utf8'),inner=migration.replace(/^BEGIN;\s*/,'').replace(/COMMIT;\s*$/,'')
assert.equal(sql('SELECT count(*) FROM admin_makeup_review_requests'),'0','Rehearsal needs no in-flight synthetic requests')
const rehearsal=sql(`BEGIN;
 DROP FUNCTION public.admin_makeup_request_review_round_v1(uuid,uuid,text,text,uuid[],uuid,boolean,text);
 DROP FUNCTION public.admin_makeup_review_page_v1(uuid,date,text,uuid,text,text,integer,integer,uuid,date,text,uuid);
 DROP FUNCTION public.admin_makeup_review_rows_v1(date);
 DROP TABLE public.admin_makeup_review_requests;
 SELECT jsonb_build_object('oldLookup',admin_makeup_lookup_v1(${q(f.sa.id)},${q(f.month+'-01')},'kids_group','รีวิวผู้ปกครอง',NULL,1,'learners')->>'total');
 ${inner}
 SELECT jsonb_object_agg(oid::regprocedure::text,jsonb_build_object('definition',md5(pg_get_functiondef(oid)),'acl',proacl,'config',proconfig,'definer',prosecdef)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f';
 SELECT jsonb_build_object('receiptRls',relrowsecurity,'clientTableAccess',has_table_privilege('authenticated',oid,'SELECT')) FROM pg_class WHERE oid='public.admin_makeup_review_requests'::regclass;
 ROLLBACK;`)
const rows=rehearsal.split('\n').filter(s=>s.startsWith('{')).map(JSON.parse)
assert.ok(Number(rows[0].oldLookup)>0);checks.push('Pre-task Manage lookup remains functional with every new Review helper absent')
assert.deepEqual(rows[1],functions);checks.push('Literal migration on populated baseline recreates all function definitions and ACL/config exactly')
assert.ok(rows[2].receiptRls&&!rows[2].clientTableAccess);checks.push('Fresh receipt table defaults to RLS private with no authenticated read')
assert.deepEqual(JSON.parse(definitions()),functions);checks.push('Outer rollback restores all original and new helper definitions')
assert.deepEqual(state(),before);checks.push('Fresh-install/recovery rehearsal preserves all thirteen business, audit, receipt and policy table fingerprints')
const originals=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'baseline-functions.json')))
for(const [name,entry]of Object.entries(originals))assert.equal(functions[name].definition,createHash('md5').update(entry.definition).digest('hex'),name)
checks.push('Every pre-task public function remains source-equivalent for application-only recovery')
const file=path.join(run.outputDir,'recovery-'+Date.now()+'.json');fs.writeFileSync(file,JSON.stringify({checks,scope:'Owned Local only; literal install and rollback inside one transaction, no Production recovery invoked',tables:before},null,2));console.log(JSON.stringify({passed:checks.length,file}))
