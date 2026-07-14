import assert from 'node:assert/strict'
import {
  buildBookingSlotAvailability,
  getBookingAvailabilitySlotKey,
} from '../src/lib/booking-slot-availability.ts'

const courseTypeId = '10000000-0000-4000-8000-000000000001'
const branchId = '20000000-0000-4000-8000-000000000001'
const templateId = '30000000-0000-4000-8000-000000000001'
const slotId = '40000000-0000-4000-8000-000000000001'
const candidate = {
  date: '2026-07-22',
  startTime: '17:00',
  endTime: '19:00',
  branchId,
  scheduleTemplateId: templateId,
}
const templates = [{
  id: templateId,
  branch_id: branchId,
  course_type_id: courseTypeId,
  day_of_week: 3,
  start_time: '17:00:00',
  end_time: '19:00:00',
  is_active: true,
}]
const scheduleSlots = [{
  id: slotId,
  template_id: templateId,
  branch_id: branchId,
  course_type_id: courseTypeId,
  date: candidate.date,
  start_time: '17:00:00',
  end_time: '19:00:00',
  max_students: 6,
  status: 'open',
}]
const nowMs = new Date('2026-07-14T00:00:00.000Z').getTime()

function session(index, overrides = {}) {
  return {
    schedule_slot_id: slotId,
    booking_id: `50000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    cancelled_at: null,
    status: 'scheduled',
    bookings: { status: 'verified', expires_at: null },
    ...overrides,
  }
}

function snapshot({ occupancy = [], requestedSlots = [candidate], slots = scheduleSlots, availableTemplates = templates } = {}) {
  return buildBookingSlotAvailability({
    courseTypeId,
    defaultCapacity: 6,
    candidates: [candidate],
    requestedSlots,
    templates: availableTemplates,
    scheduleSlots: slots,
    bookingSessions: occupancy,
    nowMs,
  })[0]
}

let passed = 0
function check(name, action) {
  action()
  passed += 1
  console.log(`PASS ${passed}: ${name}`)
}

check('slot key contains only canonical non-personal slot identity', () => {
  assert.equal(getBookingAvailabilitySlotKey(candidate), `${branchId}|2026-07-22|17:00|19:00`)
})

check('capacity 6 occupancy 5 leaves one selectable seat', () => {
  const result = snapshot({ occupancy: Array.from({ length: 5 }, (_, index) => session(index + 1)) })
  assert.equal(result.activeOccupancy, 5)
  assert.equal(result.remainingSeats, 1)
  assert.equal(result.full, false)
  assert.equal(result.canFitRequestedSeats, true)
})

check('capacity 6 occupancy 6 is full and not selectable', () => {
  const result = snapshot({ occupancy: Array.from({ length: 6 }, (_, index) => session(index + 1)) })
  assert.equal(result.activeOccupancy, 6)
  assert.equal(result.remainingSeats, 0)
  assert.equal(result.full, true)
  assert.equal(result.canFitRequestedSeats, false)
  assert.equal(result.unavailableReason, 'full')
})

check('two requested learners cannot fit into one remaining seat', () => {
  const result = snapshot({
    occupancy: Array.from({ length: 5 }, (_, index) => session(index + 1)),
    requestedSlots: [candidate, candidate],
  })
  assert.equal(result.requestedSeats, 2)
  assert.equal(result.full, false)
  assert.equal(result.canFitRequestedSeats, false)
  assert.equal(result.unavailableReason, 'insufficient_remaining')
})

check('RPC exclusions remove rescheduled walleted cancelled and expired-pending rows', () => {
  const result = snapshot({
    occupancy: [
      session(1),
      session(2, { status: 'rescheduled' }),
      session(3, { status: 'walleted' }),
      session(4, { cancelled_at: '2026-07-13T00:00:00.000Z' }),
      session(5, { bookings: { status: 'cancelled', expires_at: null } }),
      session(6, { bookings: { status: 'pending_payment', expires_at: '2026-07-13T00:00:00.000Z' } }),
      session(7, { bookings: { status: 'pending_payment', expires_at: '2026-07-15T00:00:00.000Z' } }),
      session(8, { status: 'completed' }),
      session(9, { status: 'absent' }),
    ],
  })
  assert.equal(result.activeOccupancy, 4)
  assert.equal(result.remainingSeats, 2)
})

check('cancelled canonical slot is invalid even when occupancy is zero', () => {
  const result = snapshot({ slots: [{ ...scheduleSlots[0], status: 'cancelled' }] })
  assert.equal(result.valid, false)
  assert.equal(result.canFitRequestedSeats, false)
  assert.equal(result.unavailableReason, 'cancelled_slot')
})

check('inactive or missing recurring template is invalid', () => {
  const result = snapshot({ availableTemplates: [] })
  assert.equal(result.valid, false)
  assert.equal(result.scheduleSlotId, null)
  assert.equal(result.unavailableReason, 'invalid_template')
})

check('no schedule-slot row uses course capacity and zero live occupancy', () => {
  const result = snapshot({ slots: [], occupancy: [] })
  assert.equal(result.capacity, 6)
  assert.equal(result.activeOccupancy, 0)
  assert.equal(result.remainingSeats, 6)
  assert.equal(result.canFitRequestedSeats, true)
})

console.log(`\nBooking slot availability executable checks passed: ${passed}`)
