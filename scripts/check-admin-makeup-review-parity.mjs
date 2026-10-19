import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { run, sql, q } from '../tests/admin-makeup-review/runtime.mjs'
const f = JSON.parse(fs.readFileSync(path.join(run.evidenceRoot, 'fixture.json'))), baseline = JSON.parse(fs.readFileSync(path.join(run.evidenceRoot, 'baseline-result.json')))
const old = JSON.parse(fs.readFileSync(path.join(baseline.root, 'read-model.json'))), checks = []
export const read = (extra = {}) => {
  const o = { actor: f.sa.id, month: f.month + '-01', search: '', branch: null, course: 'all', status: 'all', page: 1, size: 50, target: null, date: null, detail: null, scope: null, ...extra }
  return JSON.parse(sql(`SELECT public.admin_makeup_review_page_v1(${q(o.actor)},${q(o.month)},${q(o.search)},${q(o.branch)},${q(o.course)},${q(o.status)},${o.page},${o.size},${q(o.target)},${q(o.date)},${q(o.detail)},${q(o.scope)});`))
}
const actual = read()
assert.equal(actual.total, old.total); assert.equal(actual.sessionTotal, old.sessionTotal); assert.deepEqual(actual.stats, old.stats); checks.push('Full monthly round/session totals and all three counters match actual baseline')
const expectedRows = old.fullGroups.flatMap(g => g.sessions).sort((a, b) => a.id.localeCompare(b.id)), rows = actual.sessions.sort((a, b) => a.id.localeCompare(b.id))
assert.deepEqual(rows, expectedRows); checks.push(`Every payload field for ${rows.length} actual baseline Review members matches, including exact attendance and scope counts`)
assert.deepEqual(new Map(actual.groups.map(g => [g.key, g.count])), new Map(old.groups.map(g => [g.key, g.count]))); checks.push('Displayed grouping semantics and complete membership counts match baseline')
const first = read({ size: 15 }), second = read({ size: 15, page: 2 })
assert.equal(first.groups.length, 15); assert.ok(!first.sessions.some(r => second.sessions.some(s => r.id === s.id))); checks.push('Pages select complete distinct groups with no member leakage across pages')
const large = read({ search: 'ผู้เรียน รอบใหญ่ 600 001' }); assert.equal(large.total, 1); assert.equal(large.sessions.length, 600); checks.push('Single learner search returns the complete six-hundred-member round in one read')
const scoped = read({ scope: f.rounds[0].ids[0] }); assert.equal(scoped.sessions.length, 5); assert.equal(scoped.scopeSessionIds.length, 5); assert.deepEqual(scoped.stats, actual.stats); checks.push('Scoped refresh returns only five affected members while keeping exact global counters')
const contracts = JSON.parse(sql("SELECT jsonb_object_agg(r,jsonb_build_object('read',has_function_privilege(r,'public.admin_makeup_review_page_v1(uuid,date,text,uuid,text,text,integer,integer,uuid,date,text,uuid)','EXECUTE'),'request',has_function_privilege(r,'public.admin_makeup_request_review_round_v1(uuid,uuid,text,text,uuid[],uuid,boolean,text)','EXECUTE'),'table',has_table_privilege(r,'public.admin_makeup_review_requests','SELECT'))) FROM unnest(ARRAY['anon','authenticated','service_role'])r"))
assert.ok(!contracts.anon.read && !contracts.authenticated.read && contracts.service_role.read && !contracts.anon.request && !contracts.authenticated.request && contracts.service_role.request); assert.ok(Object.values(contracts).every(c => !c.table)); checks.push('RPCs are service-only and durable receipt table has no client/service direct access')
fs.writeFileSync(path.join(run.outputDir, 'parity-' + Date.now() + '.json'), JSON.stringify({ checks, rows: rows.length, contracts }, null, 2)); console.log(JSON.stringify({ passed: checks.length, rows: rows.length }))
