import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { run, sql, q } from '../tests/admin-makeup-review/runtime.mjs'

const f = JSON.parse(fs.readFileSync(path.join(run.evidenceRoot, 'fixture.json'))), marker = randomUUID()
const root = path.join(run.outputDir, 'read-plan-' + Date.now()); fs.mkdirSync(root)
const migration = 'supabase/migrations/20261019165858_admin_makeup_review_read_plan_v1.sql'
const tables = ['bookings', 'booking_sessions', 'attendance', 'coach_assignment_groups', 'coach_assignment_group_students', 'coach_checkins', 'lesson_wallet_credits', 'lesson_wallet_credit_members', 'task10_family_makeup_uses', 'lesson_source_operations', 'activity_logs', 'notifications', 'payments', 'coupon_usages', 'admin_makeup_review_requests']
const fingerprints = () => Object.fromEntries(tables.map(t => [t, sql(`SELECT md5(coalesce(string_agg(to_jsonb(x)::text,'' ORDER BY to_jsonb(x)::text),'')) FROM ${t} x`)]))
const rows = () => JSON.parse(sql(`SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),'[]') FROM public.admin_makeup_review_rows_v1(${q(f.month + '-01')}) r`))
const cases = [['all', 15], ['no_coach', 25], ['waiting_attendance', 50], ['coach_evidence', 15], ['coach_requested', 25]]
const pages = () => cases.map(([status, size]) => JSON.parse(sql(`SELECT public.admin_makeup_review_page_v1(${q(f.sa.id)},${q(f.month + '-01')},'',NULL,'all',${q(status)},1,${size})`)))
const functions = () => JSON.parse(sql("SELECT jsonb_object_agg(oid::regprocedure::text,jsonb_build_object('definition',pg_get_functiondef(oid),'acl',proacl,'config',proconfig,'definer',prosecdef)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f'"))
const checkTimedPage = () => {
  const start = performance.now()
  const output = JSON.parse(sql(`BEGIN;SET LOCAL statement_timeout='8s';SET LOCAL plan_cache_mode=force_generic_plan;SELECT public.admin_makeup_review_page_v1(${q(f.sa.id)},${q(f.month + '-01')});ROLLBACK;`))
  assert.equal(output.complete, true)
  return { ms: performance.now() - start, groups: output.total, sessions: output.sessionTotal }
}
const initial = fingerprints(), beforeRows = rows(), beforePages = pages(), beforeFunctions = functions(), checks = []
let noiseCreated = false
try {
  sql(`INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details) SELECT ${q(f.sa.id)},'review_read_plan_noise','review_read_plan_test',gen_random_uuid(),jsonb_build_object('runId',${q(marker)}) FROM generate_series(1,30000);ANALYZE public.activity_logs;`)
  noiseCreated = true
  let baseline
  try { baseline = checkTimedPage() } catch (error) { baseline = { timedOut: /statement timeout/.test(error.message) }; if (!baseline.timedOut) throw error }
  const noisyBefore = fingerprints()
  sql(fs.readFileSync(migration, 'utf8'))
  assert.deepEqual(fingerprints(), noisyBefore); checks.push('Corrective migration changes none of fifteen business/receipt tables')
  assert.deepEqual(rows(), beforeRows); checks.push('Every projected member and all fields match the original reader')
  assert.deepEqual(pages(), beforePages); checks.push('All five status filters, three page sizes, global counters and complete rosters match')
  const afterFunctions = functions(), changed = Object.keys(beforeFunctions).filter(name => JSON.stringify(beforeFunctions[name]) !== JSON.stringify(afterFunctions[name]))
  assert.deepEqual(changed, ['admin_makeup_review_rows_v1(date)'])
  const old = beforeFunctions[changed[0]], current = afterFunctions[changed[0]]
  assert.deepEqual({ acl: current.acl, config: current.config, definer: current.definer }, { acl: old.acl, config: old.config, definer: old.definer })
  checks.push('Only the new private Review projection body changes; all other functions and its grants/config stay identical')
  const revised = checkTimedPage(); assert.ok(revised.ms < 8000); checks.push('Full page read passes the real eight-second budget with a generic plan and thirty thousand unrelated audit records')
  const result = { runId: run.runId, root, marker, checks, projectedRows: beforeRows.length, syntheticAuditNoise: 30000, baseline, revised, migration }
  fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify(result, null, 2)); fs.writeFileSync(path.join(run.evidenceRoot, 'read-plan-local-result.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify({ passed: checks.length, rows: beforeRows.length, baseline, revised, root }))
} finally {
  if (noiseCreated) sql(`DELETE FROM public.activity_logs WHERE user_id=${q(f.sa.id)} AND entity_type='review_read_plan_test' AND details->>'runId'=${q(marker)};ANALYZE public.activity_logs;`)
  assert.deepEqual(fingerprints(), initial, 'Owner Local records and request history must survive the scoped noise test')
}
