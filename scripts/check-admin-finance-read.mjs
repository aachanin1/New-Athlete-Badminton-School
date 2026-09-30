import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadProgressiveFinanceBookings } from '../src/lib/admin-finance-read.ts'

const id = (index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
function mock({ failAt = -1, missingAt = -1, duplicateAt = -1, wrongAt = -1 } = {}) {
  const calls = []; let active = 0; let peak = 0
  const service = { from(table) {
    assert.equal(table, 'bookings')
    return { select(columns) {
      assert.match(columns, /total_price, month, year, total_sessions/)
      assert.match(columns, /profiles!bookings_user_id_fkey/)
      return { async in(column, ids) {
        assert.equal(column, 'id'); assert.ok(ids.length > 0 && ids.length <= 100)
        const call = calls.length; calls.push(ids); active++; peak = Math.max(peak, active)
        await new Promise(resolve => setTimeout(resolve, (call % 3) + 1)); active--
        if (call === failAt) return { data: null, error: { message: 'injected HTTP failure' } }
        const rows = ids.map((bookingId, index) => ({ id: bookingId, total_price: String(500 + index), month: 9, year: 2026, total_sessions: 1, profiles: { full_name: bookingId, email: null } })).reverse()
        if (call === missingAt) rows.pop()
        if (call === duplicateAt) rows[0] = rows[1]
        if (call === wrongAt) rows[0] = { ...rows[0], id: id(99999) }
        return { data: rows, error: null }
      } }
    } }
  } }
  return { service, calls, peak: () => peak }
}

for (const size of [0, 1, 99, 100, 101, 400, 401, 685, 690, 1000, 2000]) {
  test(`complete hydration of ${size} unique bookings with bounded requests`, async () => {
    const m = mock(); const ids = Array.from({ length: size }, (_, index) => id(index))
    const rows = await loadProgressiveFinanceBookings(m.service, ids)
    assert.equal(rows.length, size)
    assert.deepEqual(new Set(rows.map(row => row.id)), new Set(ids))
    assert.equal(m.calls.length, Math.ceil(size / 100)); assert.ok(m.peak() <= 4)
    assert.equal(m.calls.flat().length, size)
  })
}
test('shared booking in multiple allocations is hydrated once without altering allocation cardinality', async () => {
  const m = mock(); const allocations = [{ booking_id: id(1), allocated_amount: 100 }, { booking_id: id(1), allocated_amount: 200 }, { booking_id: id(2), allocated_amount: 300 }]
  const rows = await loadProgressiveFinanceBookings(m.service, allocations.map(row => row.booking_id))
  assert.equal(rows.length, 2); assert.equal(m.calls.flat().length, 2)
  const map = new Map(rows.map(row => [row.id, row]))
  const hydrated = allocations.map(row => ({ ...row, booking: map.get(row.booking_id) }))
  assert.equal(hydrated.length, 3); assert.equal(hydrated.reduce((sum, row) => sum + row.allocated_amount, 0), 600)
  assert.ok(hydrated.every(row => row.booking))
})
for (const failure of ['failAt', 'missingAt', 'duplicateAt', 'wrongAt']) {
  test(`${failure} in a later batch rejects the entire read instead of returning partial totals`, async () => {
    const m = mock({ [failure]: 4 })
    await assert.rejects(loadProgressiveFinanceBookings(m.service, Array.from({ length: 690 }, (_, index) => id(index))), /progressive booking read/)
  })
}
test('network rejection propagates without manufacturing empty Finance data', async () => {
  const service = { from: () => ({ select: () => ({ in: () => Promise.reject(new Error('network unavailable')) }) }) }
  await assert.rejects(loadProgressiveFinanceBookings(service, [id(1)]), /network unavailable/)
})
