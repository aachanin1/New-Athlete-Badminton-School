import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {run,sql,q,concurrentSql,holdTransaction,observeLockWait} from './runtime.mjs'
import {fixture as f,read,evidence,hashFile} from './helpers.mjs'
const baseline=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'baseline-state.json')))
const migration=fs.readFileSync('supabase/migrations/20261107060410_booking_makeup_scope_membership_v1.sql','utf8')
const checks=[],check=(ok,name)=>{assert.ok(ok,name);checks.push(name);console.log(name)}
const state=()=>read(`SELECT jsonb_build_object('otherFunctions',(SELECT md5(jsonb_object_agg(p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid)))::text) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind='f' AND p.proname NOT IN ('progressive_assert_scope_membership_v1','progressive_proven_makeup_destination_v1')),
 'bills',(SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]')::text) FROM bookings t),'sessions',(SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]')::text) FROM booking_sessions t),
 'payments',(SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]')::text) FROM payments t),'units',(SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]')::text) FROM booking_package_units t),
 'uses',(SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]')::text) FROM task10_family_makeup_uses t),'requests',(SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY actor_id,request_id),'[]')::text) FROM booking_ux_requests t),
 'coupons',(SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id),'[]')::text) FROM progressive_coupon_reservations t),'controls',(SELECT to_jsonb(t) FROM booking_ux_control t),'policy',(SELECT to_jsonb(t) FROM task10_policy_activation t),'settings',(SELECT md5(jsonb_agg(to_jsonb(t) ORDER BY id)::text) FROM system_settings t));`)
try{
 const before=state(),grants=sql("SELECT proacl FROM pg_proc WHERE oid='public.progressive_assert_scope_membership_v1(uuid,uuid,uuid,integer,integer)'::regprocedure")
 sql('BEGIN;'+baseline.beforeDefinitions.guard+';\nDROP FUNCTION public.progressive_proven_makeup_destination_v1(uuid);COMMIT;')
 const year=+f.dates.month.slice(0,4),month=+f.dates.month.slice(5,7)
 assert.throws(()=>sql(`SELECT progressive_assert_scope_membership_v1((SELECT id FROM booking_pricing_scopes WHERE user_id=${q(f.parent.id)} AND course_type_id=${q(f.courses.kids_group)} AND lesson_year=${year} AND lesson_month=${month}),${q(f.parent.id)},${q(f.courses.kids_group)},${year},${month})`),/PROGRESSIVE_BOOKING_CONFLICT/)
 assert.deepEqual(state(),before);check(true,'Restoring old guard reblocks affected operations but preserves every successful bill, payment, right and receipt')
 sql(migration)
 assert.deepEqual(state(),before);check(true,'Exact forward migration installs without rewriting business data, controls, settings or unrelated functions')
 check(sql("SELECT proacl FROM pg_proc WHERE oid='public.progressive_assert_scope_membership_v1(uuid,uuid,uuid,integer,integer)'::regprocedure")===grants,'Original internal guard grants remain unchanged')
 assert.throws(()=>sql(migration),/BOOKING_MAKEUP_SCOPE_BASELINE_DRIFT/)
 assert.deepEqual(state(),before);check(true,'Repeated or stale migration stops at baseline drift before mutations')
 const held=await holdTransaction('SELECT pg_advisory_xact_lock_shared(10,1);','scope-migration-reader')
 const pending=concurrentSql("SET application_name='scope-migration-writer';"+migration).then(()=>null,error=>String(error))
 try{await observeLockWait('scope-migration-writer');check(true,'Migration waits behind a real in-flight Task10 shared lock')}finally{held.release();await held.done}
 check((await pending).includes('BOOKING_MAKEUP_SCOPE_BASELINE_DRIFT'),'After drain, incompatible schema still fails closed')
 assert.deepEqual(state(),before)
 const functionHashes=read("SELECT jsonb_object_agg(proname,md5(replace(pg_get_functiondef(oid),chr(13),''))) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('progressive_proven_makeup_destination_v1','progressive_assert_scope_membership_v1')")
 const file=evidence('migration-pass',{checks,state:before,functionHashes,migrationHash:hashFile('supabase/migrations/20261107060410_booking_makeup_scope_membership_v1.sql'),suiteHash:hashFile('tests/booking-makeup-scope/migration.mjs')})
 console.log(JSON.stringify({passed:checks.length,evidence:file}))
}catch(error){evidence('migration-failed',{checks,error:String(error),stderr:String(error.stderr||'')});throw error}
