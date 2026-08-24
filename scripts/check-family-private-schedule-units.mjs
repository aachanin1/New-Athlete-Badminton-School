import assert from 'node:assert/strict'

import { groupFamilyPrivateScheduleUnits } from '../src/lib/family-private-schedule-units.ts'

function session(overrides = {}) {
  return {
    id: 'session-1',
    booking_id: 'booking-family',
    schedule_slot_id: 'slot-1',
    branch_id: 'branch-1',
    date: '2026-09-06',
    start_time: '10:00:00',
    end_time: '11:00:00',
    child_id: null,
    bookings: { course_types: { name: 'private' } },
    ...overrides,
  }
}

const sessions = [
  session(),
  session({ id: 'session-2', child_id: 'child-1' }),
  session({ id: 'session-3', schedule_slot_id: 'slot-2', start_time: '11:00:00', end_time: '12:00:00' }),
  session({ id: 'session-4', child_id: 'child-1', schedule_slot_id: 'slot-2', start_time: '11:00:00', end_time: '12:00:00' }),
]

const units = groupFamilyPrivateScheduleUnits(sessions)
assert.equal(units.length, 2, 'four participant sessions across two Family hours must become two units')
assert.deepEqual(units.map((unit) => unit.participantCount), [2, 2])
assert.equal(units.every((unit) => unit.isFamilyPrivate && unit.isConsistent), true)
assert.deepEqual(units[0].sessions.map((item) => item.child_id), [null, 'child-1'])
assert.deepEqual(units[1].sessions.map((item) => item.child_id), [null, 'child-1'])

const nonPrivate = groupFamilyPrivateScheduleUnits([
  session({ id: 'adult-1', bookings: { course_types: { name: 'adult_group' } } }),
  session({ id: 'adult-2', child_id: 'child-1', bookings: { course_types: { name: 'adult_group' } } }),
])
assert.equal(nonPrivate.length, 2, 'non-Private courses must remain one session per unit')
assert.equal(nonPrivate.every((unit) => !unit.isFamilyPrivate && unit.participantCount === 1), true)

const exactKeyBoundaries = groupFamilyPrivateScheduleUnits([
  session({ id: 'booking-a', booking_id: 'booking-a' }),
  session({ id: 'booking-b', booking_id: 'booking-b' }),
  session({ id: 'branch-b', branch_id: 'branch-2' }),
  session({ id: 'slot-b', schedule_slot_id: 'slot-2' }),
  session({ id: 'date-b', date: '2026-09-13' }),
])
assert.equal(exactKeyBoundaries.length, 5, 'every approved exact-key field must prevent cross-unit merging')

const duplicateIdentity = groupFamilyPrivateScheduleUnits([
  session({ id: 'duplicate-1', child_id: 'child-1' }),
  session({ id: 'duplicate-2', child_id: 'child-1' }),
])
assert.equal(duplicateIdentity[0].isConsistent, false, 'duplicate learner identities must fail the group-level consistency gate')

const missingSlot = groupFamilyPrivateScheduleUnits([
  session({ id: 'missing-slot', schedule_slot_id: null }),
])
assert.equal(missingSlot[0].isConsistent, false, 'a Family unit without a real schedule slot must fail closed')

console.log('PASS Family Private schedule-unit grouping contract')
