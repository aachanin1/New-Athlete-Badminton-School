import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  getAdminScheduleRoundLearnerBuckets,
  hasExactValidCoachAssignment,
} from '../src/lib/admin-schedule-assignment-state.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const page = read('src/app/(admin)/admin/schedules/page.tsx')
const client = read('src/components/admin/schedules-client.tsx')

let passed = 0
function check(name, action) {
  action()
  passed += 1
  console.log(`PASS ${passed}: ${name}`)
}

const learner = (id, status = 'scheduled') => ({ id, status })
const group = ({
  id,
  learners,
  coachId = 'coach-1',
  profileId = coachId,
  coachName = 'Coach One',
  coachRole = 'coach',
}) => ({
  id,
  learners,
  coach_id: coachId,
  coach_profile_id: profileId,
  coach_name: coachName,
  coach_role: coachRole,
})

check('no group keeps an active learner waiting', () => {
  const result = getAdminScheduleRoundLearnerBuckets({ groups: [], unassigned_learners: [learner('a')] })
  assert.deepEqual([result.coachedLearnerCount, result.waitingCoachCount], [0, 1])
})

check('group with null coach remains grouped but waits for a coach', () => {
  const result = getAdminScheduleRoundLearnerBuckets({
    groups: [group({ id: 'g1', learners: [learner('a')], coachId: null, profileId: null, coachName: null, coachRole: null })],
    unassigned_learners: [],
  })
  assert.deepEqual([result.assignedGroups.length, result.unassignedGroups.length], [0, 1])
  assert.deepEqual([result.coachedLearnerCount, result.waitingCoachCount], [0, 1])
})

check('valid exact coach group is assigned', () => {
  const result = getAdminScheduleRoundLearnerBuckets({
    groups: [group({ id: 'g1', learners: [learner('a')] })],
    unassigned_learners: [],
  })
  assert.deepEqual([result.assignedGroups.length, result.coachedLearnerCount, result.waitingCoachCount], [1, 1, 0])
})

check('mixed assigned and unassigned learners have exact counters', () => {
  const result = getAdminScheduleRoundLearnerBuckets({
    groups: [
      group({ id: 'assigned', learners: [learner('a'), learner('b')] }),
      group({ id: 'waiting', learners: [learner('c')], coachId: null, profileId: null, coachName: null, coachRole: null }),
    ],
    unassigned_learners: [learner('d')],
  })
  assert.deepEqual([result.coachedLearnerCount, result.waitingCoachCount], [2, 2])
})

check('multiple groups count an unassigned group as waiting', () => {
  const result = getAdminScheduleRoundLearnerBuckets({
    groups: [
      group({ id: 'assigned', learners: [learner('a')] }),
      group({ id: 'waiting', learners: [learner('b'), learner('c')], coachId: null, profileId: null, coachName: null, coachRole: null }),
    ],
    unassigned_learners: [],
  })
  assert.deepEqual([result.assignedGroups.length, result.unassignedGroups.length, result.waitingCoachCount], [1, 1, 2])
})

check('walleted learners never require a coach', () => {
  const result = getAdminScheduleRoundLearnerBuckets({
    groups: [group({ id: 'waiting', learners: [learner('wallet-group', 'walleted')], coachId: null, profileId: null, coachName: null, coachRole: null })],
    unassigned_learners: [learner('wallet-standalone', 'walleted')],
  })
  assert.deepEqual([result.coachedLearnerCount, result.waitingCoachCount, result.walletedLearners.length], [0, 0, 2])
})

check('missing coach profile fails closed', () => {
  assert.equal(hasExactValidCoachAssignment(group({ id: 'g1', learners: [], profileId: null, coachName: null, coachRole: null })), false)
})

check('non-coach profile role fails closed', () => {
  assert.equal(hasExactValidCoachAssignment(group({ id: 'g1', learners: [], coachRole: 'user' })), false)
})

check('legacy slot assignments are absent from the assignment predicate', () => {
  const result = getAdminScheduleRoundLearnerBuckets({
    groups: [group({ id: 'g1', learners: [learner('a')], coachId: null, profileId: null, coachName: null, coachRole: null })],
    unassigned_learners: [],
    legacy_coaches: ['legacy-coach'],
  })
  assert.equal(result.waitingCoachCount, 1)
  assert.equal(read('src/lib/admin-schedule-assignment-state.ts').includes('legacy'), false)
})

check('server query resolves coach profile id, name and role', () => {
  assert.equal(page.includes('profiles!coach_assignment_groups_coach_id_fkey(id, full_name, role)'), true)
  for (const field of ['coach_profile_id:', 'coach_name:', 'coach_role:']) assert.equal(page.includes(field), true)
})

check('unassigned groups render a visible red warning without changing valid green groups', () => {
  assert.equal(client.includes('border border-red-200 bg-red-50/50'), true)
  assert.equal(client.includes('ยังไม่ได้มอบหมายโค้ช'), true)
  assert.equal(client.includes('border border-emerald-100 bg-emerald-50/30'), true)
})

check('attendance labels and teaching program boxes remain present', () => {
  for (const required of ['getDailyBoardLearnerStatus', 'โปรแกรมสอนรอบนี้', 'PROGRAM_STATUS_CONFIG']) {
    assert.equal(client.includes(required), true)
  }
})

console.log(`\nAdmin Schedule assignment-state checks passed: ${passed}`)
