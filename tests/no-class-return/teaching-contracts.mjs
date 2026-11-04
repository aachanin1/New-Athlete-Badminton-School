import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createHash, randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import ts from 'typescript'

// Public teaching reader with an in-memory Supabase query implementation only.
// No runtime helper, service client, database query or network is imported.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const taskRoot = path.join(root, '.playwright/no-class-return-1')
const manifest = path.resolve(process.env.LESSON_SOURCE_RUN_MANIFEST || path.join(taskRoot, 'run.json'))
assert.ok([path.join(taskRoot, 'run.json'), path.join(taskRoot, 'fresh/run.json')].includes(manifest))
const run = JSON.parse(fs.readFileSync(manifest, 'utf8'))
assert.match(run.runId, /^no-class-return-1-20261104-[a-f0-9-]{36}$/)
assert.equal(path.resolve(run.evidenceRoot), path.dirname(manifest))
assert.equal(path.resolve(run.outputDir), path.join(path.dirname(manifest), 'acceptance'))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const definitionHash = sha(fs.readFileSync(fileURLToPath(import.meta.url)))
const sourceBytes = new Map(['src/lib/coach-teaching-hours.ts', 'src/lib/coach-assignment-resolution.ts']
  .map(file => [file, fs.readFileSync(path.join(root, file))]))
const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file)
  assert.ok(sourceBytes.has(file), 'Only captured pure source may execute')
  const loaded = { exports: {} }; cache.set(file, loaded.exports)
  const code = ts.transpileModule(sourceBytes.get(file).toString('utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, { module: loaded, exports: loaded.exports, performance, require: name => {
    assert.ok(name.startsWith('@/lib/'), 'Unexpected non-pure dependency: ' + name)
    return load('src/' + name.slice(2) + '.ts')
  } }, { filename: file })
  cache.set(file, loaded.exports); return loaded.exports
}
const { getCoachTeachingHourSourceRead } = load('src/lib/coach-teaching-hours.ts')
const nested = (row, column) => column.split('.').reduce((value, key) => value?.[key], row)
class Query {
  constructor(database, table, columns, options) {
    this.database = database; this.table = table; this.filters = []; this.orders = []; this.start = 0; this.end = Number.MAX_SAFE_INTEGER
    assert.equal(options?.count, 'exact', 'Every reader query must request exact pagination counts')
    database.queries.push({ table, columns })
  }
  eq(column, value) { this.filters.push(row => nested(row, column) === value); return this }
  gte(column, value) { this.filters.push(row => nested(row, column) >= value); return this }
  lt(column, value) { this.filters.push(row => nested(row, column) < value); return this }
  in(column, values) { this.filters.push(row => values.includes(nested(row, column))); return this }
  order(column) { this.orders.push(column); return this }
  range(start, end) { this.start = start; this.end = end; return this }
  then(resolve, reject) {
    return Promise.resolve().then(() => {
      if (this.database.errors[this.table]) return { data: null, error: { message: this.database.errors[this.table] }, count: null }
      const rows = (this.database.tables[this.table] || []).filter(row => this.filters.every(filter => filter(row)))
      rows.sort((left, right) => {
        for (const column of this.orders) {
          const result = String(nested(left, column) || '').localeCompare(String(nested(right, column) || ''))
          if (result) return result
        }
        return 0
      })
      return { data: rows.slice(this.start, this.end + 1), error: null,
        count: this.database.incomplete === this.table ? rows.length + 1 : rows.length }
    }).then(resolve, reject)
  }
}
class MemoryDatabase {
  constructor(tables) { this.tables = tables; this.queries = []; this.errors = {}; this.incomplete = '' }
  from(table) { return { select: (columns, options) => new Query(this, table, columns, options) } }
}
const ids = ['redeemed-a', 'redeemed-b', 'redeemed-c']
const slot = { id: 'family-slot', branch_id: 'fixture-branch', date: '2026-11-01', start_time: '11:00:00', end_time: '12:00:00',
  branches: { name: 'fixture' }, course_types: { name: 'private' } }
const range = { startDate: '2026-11-01', endDateExclusive: '2026-11-02', coachId: 'fixture-coach' }
function fixture({ header = true, members = true } = {}) {
  return new MemoryDatabase({
    coach_assignment_groups: [],
    coach_assignments: [{ id: 'legacy-assignment', coach_id: range.coachId, schedule_slot_id: slot.id, schedule_slots: slot,
      profiles: { full_name: 'fixture coach', coach_employment_type: 'part_time' } }],
    booking_sessions: [...ids, 'pending-user-reschedule'].map(id => ({ id, schedule_slot_id: slot.id, rescheduled_from_id: 'original-' + id,
      is_makeup: false, status: 'scheduled', bookings: { status: 'verified' } })),
    lesson_wallet_credits: header ? [{ id: 'family-credit', redeemed_session_id: ids[0] }] : [],
    coach_wallet_member_redemptions_v1: members ? ids.map((id, index) => ({ credit_id: 'family-credit', original_session_id: 'source-' + index, redeemed_session_id: id })) : [],
    coach_checkins: [{ id: 'fixture-checkin', coach_id: range.coachId, schedule_slot_id: slot.id,
      checkin_time: '2026-11-01T03:50:00Z', photo_url: 'fixture.jpg', location_lat: 13, location_lng: 100 }],
    attendance: ids.map(id => ({ id: 'attendance-' + id, booking_session_id: id, status: 'present' })),
  })
}
const results = []
let failure
async function check(name, action) { await action(); results.push({ name, passed: true }) }
function exactFamily(read) {
  assert.equal(read.rows.length, 1)
  const row = read.rows[0]
  assert.equal(row.assignment_source, 'legacy'); assert.equal(row.student_count, 3)
  assert.deepEqual([...row.student_session_ids].sort(), ids)
  assert.equal(row.attendance_count, 3); assert.equal(row.classification, 'counted')
  assert.equal(row.start_time, slot.start_time); assert.equal(row.end_time, slot.end_time)
}
try {
  await check('Family header plus members retains exact three eligible session identities once', async () => {
    const database = fixture(), read = await getCoachTeachingHourSourceRead(database, range)
    exactFamily(read)
    assert.equal(read.metrics.rowsBySource.lesson_wallet_credits, 1)
    assert.equal(read.metrics.rowsBySource.coach_wallet_member_redemptions_v1, 3)
    assert.ok(database.queries.some(query => query.table === 'coach_wallet_member_redemptions_v1' && query.columns.includes('original_session_id')))
  })
  await check('Member-only Family provenance counts all three and excludes unaccepted user reschedule', async () => {
    const read = await getCoachTeachingHourSourceRead(fixture({ header: false }), range)
    exactFamily(read); assert.equal(read.metrics.rowsBySource.lesson_wallet_credits, 0)
  })
  await check('Header-only legacy provenance remains eligible with unchanged count', async () => {
    const read = await getCoachTeachingHourSourceRead(fixture({ members: false }), range)
    assert.equal(read.rows[0].student_count, 1); assert.deepEqual([...read.rows[0].student_session_ids], [ids[0]])
  })
  await check('Member query error fails closed despite valid credit header', async () => {
    const database = fixture(); database.errors.coach_wallet_member_redemptions_v1 = 'member provenance unavailable'
    await assert.rejects(getCoachTeachingHourSourceRead(database, range), /wallet member provenance.*member provenance unavailable/)
  })
  await check('Incomplete member pagination fails closed instead of silently dropping Family learners', async () => {
    const database = fixture(); database.incomplete = 'coach_wallet_member_redemptions_v1'
    await assert.rejects(getCoachTeachingHourSourceRead(database, range), /wallet member provenance.*pagination incomplete/)
  })
  await check('Composite credit and original-session identity distinguishes members of one credit', async () => {
    const database = fixture({ header: false })
    database.tables.coach_wallet_member_redemptions_v1.push({ credit_id: 'historical-credit', original_session_id: 'source-0', redeemed_session_id: ids[0] })
    exactFamily(await getCoachTeachingHourSourceRead(database, range))
  })
  await check('Duplicate composite member identity fails closed', async () => {
    const database = fixture(); database.tables.coach_wallet_member_redemptions_v1.push({ ...database.tables.coach_wallet_member_redemptions_v1[0] })
    await assert.rejects(getCoachTeachingHourSourceRead(database, range), /wallet member provenance.*pagination returned duplicate row/)
  })
} catch (error) { failure = error }
const proof = { checkedAt: new Date().toISOString(), runId: run.runId, manifest, passed: !failure, checks: results.length,
  scope: 'Public teaching reader against pure in-memory query fixtures; no DB/network calls or writes',
  testDefinition: { file: 'tests/no-class-return/teaching-contracts.mjs', sha256: definitionHash },
  sourceHashes: Object.fromEntries([...sourceBytes].map(([file, bytes]) => [file, sha(bytes)])), results,
  ...(failure ? { error: { message: failure.message, stack: failure.stack } } : {}) }
fs.mkdirSync(run.outputDir, { recursive: true })
const proofPath = path.join(run.outputDir, `teaching-contracts-${Date.now()}-${randomUUID()}.json`)
fs.writeFileSync(proofPath, JSON.stringify(proof, null, 2), { flag: 'wx' })
console.log(JSON.stringify({ passed: proof.passed, checks: results.length, proof: proofPath }))
if (failure) { console.error(failure); process.exitCode = 1 }
