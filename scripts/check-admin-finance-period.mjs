import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { readCompleteFinanceRows, loadProgressiveFinanceAllocations } from '../src/lib/admin-finance-read.ts'
import { getFinancePeriod, financePeriodHref, financePeriodDateRange } from '../src/lib/admin-finance-period.ts'

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
for (const size of [0, 1, 499, 500, 501, 1000, 1001, 2501]) {
  test(`complete ${size} rows without relying on a single API limit`, async () => {
    const source = Array.from({ length: size }, (_, i) => ({ id: id(i), amount: i + 0.25 }))
    const ranges = []
    const actual = await readCompleteFinanceRows('fixture', async (start, end) => {
      ranges.push([start, end])
      return { data: source.slice(start, end + 1), error: null, count: size }
    }, row => row.id)
    assert.deepEqual(actual, source)
    assert.equal(ranges.length, Math.max(1, Math.ceil(size / 500)))
    assert.equal(actual.reduce((s, r) => s + r.amount, 0), source.reduce((s, r) => s + r.amount, 0))
  })
}

for (const failure of ['error', 'short', 'duplicate', 'changed-count', 'missing-count', 'missing-data']) {
  test(`reject ${failure} on a later page, never return partial money`, async () => {
    const source = Array.from({ length: 1201 }, (_, i) => ({ id: id(i) }))
    await assert.rejects(readCompleteFinanceRows('failure fixture', async (start, end) => {
      const result = { data: source.slice(start, end + 1), error: null, count: source.length }
      if (start === 1000) {
        if (failure === 'error') result.error = { message: 'injected failure' }
        if (failure === 'short') result.data.pop()
        if (failure === 'duplicate') result.data[0] = source[0]
        if (failure === 'changed-count') result.count += 1
        if (failure === 'missing-count') result.count = null
        if (failure === 'missing-data') result.data = null
      }
      return result
    }, row => row.id), /admin\/finance/)
  })
}

test('Bangkok boundary, validated URL selection and previous-year date scope', () => {
  assert.deepEqual(getFinancePeriod({}, new Date('2026-10-31T17:00:00Z')), { mode: 'month', year: 2026, month: 11 })
  const period = getFinancePeriod({ mode: 'year', month: '12', year: '2025' })
  assert.deepEqual(getFinancePeriod(Object.fromEntries(new URL(financePeriodHref(period), 'http://localhost').searchParams)), period)
  assert.deepEqual(financePeriodDateRange(period), { start: '2025-01-01', end: '2026-01-01' })
  assert.deepEqual(financePeriodDateRange({ mode: 'month', month: 12, year: 2025 }), { start: '2025-12-01', end: '2026-01-01' })
  assert.deepEqual(getFinancePeriod({ month: ['11'], year: '2569junk', mode: 'x' }, new Date('2026-01-01T00:00:00Z')), { mode: 'month', year: 2026, month: 1 })
})

test('period selection precedes pagination: >1,000 matching bookings after unrelated history', async () => {
  const bookings = Array.from({ length: 2201 }, (_, i) => ({ id: id(i), year: 2026, month: i < 1000 ? 10 : 11 }))
  const allocations = bookings.map((b, i) => ({ source_kind: 'progressive', source_id: id(i % 2 ? i - 1 : i), booking_id: b.id, status: 'approved', allocated_amount: i + 0.25 }))
  const requests = []
  let active = 0, peak = 0
  const service = createClient('http://127.0.0.1:1', 'synthetic-not-a-credential', {
    auth: { persistSession: false },
    global: { fetch: async (input, options) => {
      const url = new URL(input), q = url.searchParams
      requests.push({ path: url.pathname, query: q.toString() })
      assert.match(new Headers(options.headers).get('prefer'), /count=exact/)
      assert.ok(q.get('order'), 'each paged query needs deterministic ordering')
      let selected
      if (url.pathname.endsWith('/bookings')) {
        assert.equal(q.get('year'), 'eq.2026')
        assert.equal(q.get('month'), 'eq.11')
        selected = bookings.filter(b => b.month === 11)
      } else {
        assert.equal(url.pathname, '/rest/v1/payment_ledger_allocations_v1')
        assert.equal(q.get('status'), 'eq.approved')
        assert.equal(q.get('source_kind'), 'eq.progressive')
        const ids = q.get('booking_id').slice(4, -1).split(',')
        assert.ok(ids.length <= 100, 'bound UUID URL size')
        assert.ok(ids.every(i => bookings.find(b => b.id === i)?.month === 11), 'never fetch another period ledger')
        selected = allocations.filter(a => ids.includes(a.booking_id))
      }
      const start = Number(q.get('offset') || 0), limit = Number(q.get('limit'))
      assert.ok(limit <= 500)
      const rows = selected.slice(start, start + limit)
      active++; peak = Math.max(peak, active)
      await new Promise(resolve => setTimeout(resolve, 1)); active--
      return new Response(JSON.stringify(rows), { status: 200, headers: {
        'content-type': 'application/json',
        'content-range': `${start}-${start + rows.length - 1}/${selected.length}`,
      } })
    } },
  })
  const rows = await loadProgressiveFinanceAllocations(service, { year: 2026, month: 11, mode: 'month' })
  const expected = allocations.filter(a => bookings.find(b => b.id === a.booking_id).month === 11)
  assert.deepEqual(rows, expected)
  assert.equal(rows.length, 1201)
  assert.equal(rows.reduce((s, r) => s + r.allocated_amount, 0), expected.reduce((s, r) => s + r.allocated_amount, 0))
  assert.equal(new Set(rows.map(r => r.source_id)).size, new Set(expected.map(r => r.source_id)).size)
  assert.equal(requests.filter(r => r.path.endsWith('/bookings')).length, 3)
  assert.ok(peak <= 4)
})
