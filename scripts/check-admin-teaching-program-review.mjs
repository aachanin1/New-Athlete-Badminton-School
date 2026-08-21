import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const {
  ADMIN_TEACHING_PROGRAM_RESULT_CAP,
  getAdminTeachingProgramMonthRange,
  readAdminTeachingProgramsForRange,
  resolveAdminTeachingProgramDateRange,
} = await import('../src/lib/admin-teaching-programs-read.ts')

let passed = 0
function check(name, action) {
  action()
  passed += 1
  console.log(`PASS ${passed}: ${name}`)
}

async function checkAsync(name, action) {
  await action()
  passed += 1
  console.log(`PASS ${passed}: ${name}`)
}

check('Bangkok current-month range covers the entire calendar month', () => {
  assert.deepEqual(getAdminTeachingProgramMonthRange('2026-08-20'), {
    from: '2026-08-01',
    to: '2026-08-31',
  })
  assert.deepEqual(getAdminTeachingProgramMonthRange('2028-02-10'), {
    from: '2028-02-01',
    to: '2028-02-29',
  })
})

check('server date validation rejects missing, invalid, and reversed bounds without fallback', () => {
  assert.deepEqual(resolveAdminTeachingProgramDateRange({ bangkokToday: '2026-08-20' }), {
    ok: true,
    range: { from: '2026-08-01', to: '2026-08-31' },
  })
  assert.equal(resolveAdminTeachingProgramDateRange({ from: '2026-08-01', bangkokToday: '2026-08-20' }).ok, false)
  assert.equal(resolveAdminTeachingProgramDateRange({ from: '2026-02-30', to: '2026-03-01', bangkokToday: '2026-08-20' }).ok, false)
  assert.equal(resolveAdminTeachingProgramDateRange({ from: '2026-08-31', to: '2026-08-01', bangkokToday: '2026-08-20' }).ok, false)
})

function createReadFixture({ count = 1, error = null } = {}) {
  const operations = []
  const row = {
    id: 'program-1',
    coach_id: 'coach-1',
    schedule_slot_id: 'slot-1',
    program_content: 'Program body',
    status: 'submitted',
    reviewed_by: null,
    reviewed_at: null,
    notes: null,
    created_at: '2026-08-20T00:00:00Z',
    updated_at: '2026-08-20T00:00:00Z',
    coach: { id: 'coach-1', full_name: 'Coach', email: 'coach@example.test', avatar_url: null },
    reviewer: null,
    slot: {
      id: 'slot-1', date: '2026-08-20', start_time: '17:00:00', end_time: '19:00:00',
      branches: { id: 'branch-1', name: 'Branch', slug: 'branch' },
      course_types: { name: 'kids_group' },
    },
  }
  const response = { data: error ? null : [row], error, count }
  const query = {
    select(columns, options) { operations.push(['select', columns, options]); return this },
    gte(column, value) { operations.push(['gte', column, value]); return this },
    lte(column, value) { operations.push(['lte', column, value]); return this },
    order(column, options) { operations.push(['order', column, options]); return this },
    range(from, to) { operations.push(['range', from, to]); return this },
    then(resolve, reject) { return Promise.resolve(response).then(resolve, reject) },
  }
  return {
    operations,
    supabase: { from(table) { operations.push(['from', table]); return query } },
  }
}

await checkAsync('read filters the slot relation on the server before bounded program bodies', async () => {
  const fixture = createReadFixture()
  const result = await readAdminTeachingProgramsForRange(fixture.supabase, { from: '2026-08-01', to: '2026-08-31' })
  assert.equal(result.ok, true)
  assert.equal(result.programs.length, 1)
  assert.deepEqual(fixture.operations.filter(([operation]) => operation === 'gte' || operation === 'lte'), [
    ['gte', 'slot.date', '2026-08-01'],
    ['lte', 'slot.date', '2026-08-31'],
  ])
  assert.deepEqual(fixture.operations.find(([operation]) => operation === 'range'), [
    'range', 0, ADMIN_TEACHING_PROGRAM_RESULT_CAP,
  ])
})

await checkAsync('query failure is explicit and does not masquerade as an empty success', async () => {
  const fixture = createReadFixture({ error: { code: 'PGRST_TEST' } })
  const originalError = console.error
  console.error = () => {}
  try {
    const result = await readAdminTeachingProgramsForRange(fixture.supabase, { from: '2026-08-01', to: '2026-08-31' })
    assert.equal(result.ok, false)
    assert.equal(result.programs.length, 0)
    assert.match(result.error, /ไม่สามารถโหลดรายการโปรแกรมสอน/)
  } finally {
    console.error = originalError
  }
})

await checkAsync('safe cap is declared and truncation is never silent', async () => {
  const fixture = createReadFixture({ count: ADMIN_TEACHING_PROGRAM_RESULT_CAP + 1 })
  const result = await readAdminTeachingProgramsForRange(fixture.supabase, { from: '2026-08-01', to: '2026-08-31' })
  assert.equal(result.isTruncated, true)
  assert.equal(result.totalCount, ADMIN_TEACHING_PROGRAM_RESULT_CAP + 1)
})

const page = read('src/app/(admin)/admin/teaching-programs/page.tsx')
const client = read('src/components/admin/teaching-programs-client.tsx')
const reader = read('src/lib/admin-teaching-programs-read.ts')

check('Admin page defaults to submitted and never issues an unbounded read for invalid dates', () => {
  assert.equal(page.includes("normalizedFilter(params?.status, 'submitted')"), true)
  assert.equal(page.includes('dateRangeResult.ok\n    ? await readAdminTeachingProgramsForRange'), true)
  assert.equal(page.includes(".limit(800)"), false)
})

check('review read uses one inner relation instead of oversized ID lists', () => {
  assert.equal(reader.includes('slot:schedule_slots!inner'), true)
  assert.equal(reader.includes(".gte('slot.date', range.from)"), true)
  assert.equal(reader.includes(".lte('slot.date', range.to)"), true)
  assert.equal(reader.includes(".in('id'"), false)
})

check('client exposes Apply, current-month reset, safe read retry, and 18-row pagination', () => {
  assert.equal(client.includes('const PAGE_SIZE = 18'), true)
  assert.equal(client.includes('ค้นหาช่วงวันที่'), true)
  assert.equal(client.includes('เดือนนี้'), true)
  assert.equal(client.includes('router.push(`/admin/teaching-programs?'), true)
  assert.equal(client.includes('router.refresh()'), true)
  assert.equal(client.includes('สถิติและรายการด้านล่างจึงยังไม่ครบทั้งหมด'), true)
})

check('program refresh is isolated from draft filters and resolved primitive filters skip the initial mount', () => {
  const programSyncEffect = client.match(/useEffect\(\(\) => \{\s*setItems\(programs\)\s*\}, \[programs\]\)/s)?.[0] || ''
  assert.notEqual(programSyncEffect, '')
  assert.equal(programSyncEffect.includes('setFromDate'), false)
  assert.equal(programSyncEffect.includes('setToDate'), false)
  assert.equal(client.includes('const syncedResolvedFilterKey = useRef(resolvedFilterKey)'), true)
  assert.equal(client.includes('if (syncedResolvedFilterKey.current === resolvedFilterKey) return'), true)
  assert.equal(client.includes('syncedResolvedFilterKey.current = resolvedFilterKey'), true)
  assert.equal(client.includes('}, [initialFilters, programs])'), false)
})

check('approve and reject mutation contract remains unchanged', () => {
  assert.equal(client.includes("fetch('/api/admin/teaching-programs'"), true)
  assert.equal(client.includes("method: 'PATCH'"), true)
  assert.equal(client.includes("reviewAction === 'approved'"), true)
  assert.equal(client.includes("reviewAction === 'rejected'"), true)
})

console.log(`\nAdmin teaching-program review checks passed: ${passed}`)
