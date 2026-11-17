import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { fixture } from './regression.mjs'

// Import the production read functions with only their service-client factory
// replaced. No credentials, network, database or storage exist in this fixture.
const authStub = 'data:text/javascript,export const getServiceRoleClient = () => globalThis.schedulePeopleReadFixture'
registerHooks({ resolve(specifier, context, next) {
  return specifier === '@/lib/auth/admin' ? { url: authStub, shortCircuit: true } : next(specifier, context)
} })
const calls = []
let failGroups = false
const tables = {
  booking_sessions: fixture.sessions,
  coach_assignment_groups: [...fixture.groups, { ...fixture.groups[0], id: 'blank-coach', coach_id: 'blank-coach', profiles: { id: 'blank-coach', full_name: ' ', role: 'coach' } }],
  lesson_wallet_credits: fixture.walletCredits.map(c => ({ ...c, id: 'credit-' + c.original_session_id, user_id: 'parent' })),
  branches: [{ id: 'branch-a', name: 'สาขาทดสอบ', slug: 'test' }],
  task10_family_makeup_uses: [], attendance: [], student_levels: [], levels: [], teaching_programs: [],
}
const snapshot = JSON.stringify(tables)
const db = { from(table) {
  assert.ok(table in tables, 'unexpected table ' + table)
  const call = { table, columns: '', filters: [], start: 0, end: 999999 }
  const query = {
    select(columns) { call.columns = columns; return query },
    order() { return query },
    range(start, end) { call.start = start; call.end = end; return query },
    then(resolve, reject) {
      calls.push(call)
      let data = structuredClone(tables[table])
      if (table === 'coach_assignment_groups') {
        const cols = call.columns.match(/profiles!coach_assignment_groups_coach_id_fkey\(([^)]+)\)/)?.[1].split(',').map(s => s.trim()) || []
        data = data.map(g => ({ ...g, profiles: Object.fromEntries(Object.entries(g.profiles).filter(([key]) => cols.includes(key))) }))
      }
      return Promise.resolve({ data: data.slice(call.start, call.end + 1), error: table === 'coach_assignment_groups' && failGroups ? { message: 'synthetic unavailable' } : null }).then(resolve, reject)
    },
  }
  for (const op of ['eq', 'neq', 'gte', 'lte', 'in', 'or']) query[op] = (...args) => { call.filters.push({ op, args }); return query }
  return query
} }
globalThis.schedulePeopleReadFixture = db
const { loadAdminScheduleMonthSummary, loadAdminScheduleDayDetail } = await import('../../src/lib/admin-schedules-read.ts')
const month = await loadAdminScheduleMonthSummary(db, 2026, 11)
const day = await loadAdminScheduleDayDetail(db, '2026-11-16')
assert.equal(month.summary.totalsByFilter['all:all'].coachCount, 1)
assert.equal(month.summary.totalsByFilter['all:all'].learnerCount, 2)
assert.deepEqual(month.summary.rounds.map(r => r.coach_ids), day.detail.rounds.map(r => r.coach_ids))
assert.deepEqual(month.summary.rounds.map(r => r.learner_count), day.detail.rounds.map(r => r.learner_count))
const groupReads = calls.filter(c => c.table === 'coach_assignment_groups')
assert.equal(groupReads.length, 2)
for (const query of groupReads) {
  assert.match(query.columns, /profiles!coach_assignment_groups_coach_id_fkey\(id, full_name, role\)/)
  assert.deepEqual([query.start, query.end], [0, 999])
  assert.ok(query.filters.some(f => f.op === 'gte' && f.args[0] === 'schedule_slots.date'))
}
console.log('PASS month/day read paths request the same complete coach evidence and produce identical people counts')
failGroups = true
await assert.rejects(loadAdminScheduleMonthSummary(db, 2026, 11), /assignment groups query failed/)
await assert.rejects(loadAdminScheduleDayDetail(db, '2026-11-16'), /assignment groups query failed/)
console.log('PASS assignment evidence read failures reject both paths instead of reporting zero coaches')
assert.equal(JSON.stringify(tables), snapshot)
console.log('PASS all reads preserve fixture source rows; no mutation methods or external services provided')
console.log(JSON.stringify({ passed: 3, queryCalls: calls.length, customerWrites: 0, target: 'synthetic read adapter, not hosted PostgREST' }))
