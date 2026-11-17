import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
registerHooks({ resolve(s, c, next) { return s.startsWith('@/') ? { url: pathToFileURL(path.resolve('src', s.slice(2) + '.ts')).href, shortCircuit: true } : next(s, c) } })
const model = await import('../../src/lib/admin-schedules-model.ts')
const { getAdminScheduleRoundLearnerBuckets } = await import('../../src/lib/admin-schedule-assignment-state.ts')
const session = (id, extra = {}) => ({ id, date: '2026-11-16', start_time: '10:00', end_time: '12:00', status: 'scheduled', is_makeup: false, child_id: id, schedule_slot_id: 'slot-a', branch_id: 'branch-a', branches: { name: 'สาขาทดสอบ' }, children: { full_name: id, nickname: id }, bookings: { user_id: 'parent', learner_type: 'child', course_type_id: 'kids', status: 'verified', course_types: { name: 'kids_group' }, profiles: { full_name: 'ผู้ปกครองทดสอบ' } }, ...extra })
const group = (id, members, extra = {}) => ({ id, schedule_slot_id: 'slot-a', coach_id: 'coach-a', name: 'กลุ่มทดสอบ', level_min: null, level_max: null, sort_order: 0, profiles: { id: 'coach-a', full_name: 'โค้ชทดสอบ', role: 'coach' }, coach_assignment_group_students: members.map(booking_session_id => ({ booking_session_id })), ...extra })
export const fixture = {
  sessions: [session('active-a'), session('wallet-a', { status: 'walleted' }), session('wallet-b', { status: 'walleted' }), session('active-b', { schedule_slot_id: 'slot-b', start_time: '14:00', end_time: '16:00' })],
  groups: [group('group-a', ['active-a', 'wallet-a', 'wallet-b']), group('group-b', ['active-b'], { schedule_slot_id: 'slot-b' })],
  walletCredits: ['wallet-a', 'wallet-b'].map(original_session_id => ({ original_session_id, status: 'active' })),
}
export const dayDetail = (input = fixture) => model.buildAdminScheduleDayDetail({ ...input, slotSessions: [], attendanceRows: [], studentLevels: [], levels: [], teachingPrograms: [] })
let passed = 0
function check(name, fn) { fn(); console.log('PASS ' + name); passed++ }
check('screenshot pattern: two active learners, two Wallet learners, one coach across two rounds', () => {
  const summary = model.buildAdminScheduleMonthSummary(fixture)
  assert.equal(summary.totalsByFilter['all:all'].learnerCount, 2)
  assert.equal(summary.totalsByFilter['all:all'].sessionCount, 2)
  assert.equal(summary.totalsByFilter['all:all'].walletedCount, 2)
  assert.equal(summary.totalsByFilter['all:all'].coachCount, 1)
  const people = model.getAdminSchedulePeopleSummary(summary.rounds)
  assert.equal(people.learnerCount, 2)
  assert.equal(people.coachCount, 1)
  assert.equal(people.markers.length, 2)
  const detail = dayDetail()
  assert.deepEqual(detail.rounds.map(r => r.learner_count), [1, 1])
  assert.equal(getAdminScheduleRoundLearnerBuckets(detail.rounds[0]).walletedLearners.length, 2)
  assert.equal(getAdminScheduleRoundLearnerBuckets(detail.rounds[0]).coachCount, 1)
})
check('Wallet-only day remains discoverable but contributes zero learners, markers or coaches', () => {
  const f = { ...fixture, sessions: fixture.sessions.filter(s => s.status === 'walleted') }
  const summary = model.buildAdminScheduleMonthSummary(f)
  assert.equal(summary.rounds.length, 1)
  assert.deepEqual(model.getAdminSchedulePeopleSummary(summary.rounds), { learnerCount: 0, coachCount: 0, markers: [] })
  assert.equal(summary.rounds[0].walleted_count, 2)
  assert.equal(dayDetail(f).rounds[0].learner_count, 0)
  assert.equal(getAdminScheduleRoundLearnerBuckets(dayDetail(f).rounds[0]).coachCount, 0)
})
check('coach counts reject empty, Wallet-only, invalid-role/profile/name and wrong-slot assignments', () => {
  const variants = [
    group('empty', []), group('wallet', ['wallet-a']),
    group('wrong-slot', ['active-a'], { schedule_slot_id: 'slot-other' }),
    group('unassigned', ['active-a'], { name: 'ยังไม่จัดกลุ่ม' }),
    group('invalid-role', ['active-a'], { profiles: { id: 'coach-a', full_name: 'X', role: 'admin' } }),
    group('invalid-id', ['active-a'], { profiles: { id: 'coach-b', full_name: 'X', role: 'coach' } }),
    group('blank-name', ['active-a'], { profiles: { id: 'coach-a', full_name: ' ', role: 'coach' } }),
    group('missing-profile', ['active-a'], { profiles: null }),
  ]
  for (const g of variants) {
    const f = { ...fixture, groups: [g] }
    const summary = model.buildAdminScheduleMonthSummary(f)
    assert.equal(summary.totalsByFilter['all:all'].coachCount, 0, g.id)
    assert.equal(summary.totalsByFilter['all:all'].waitingCoachCount, 2, g.id)
    for (const r of dayDetail(f).rounds) assert.equal(getAdminScheduleRoundLearnerBuckets(r).coachCount, 0, g.id)
  }
})
check('coaches deduplicate by identity; distinct same-name coaches and head coaches count separately', () => {
  const f = { ...fixture, groups: [...fixture.groups, group('repeat', ['active-a']), group('second', ['active-a'], { coach_id: 'coach-b', profiles: { id: 'coach-b', full_name: 'โค้ชทดสอบ', role: 'head_coach' } })] }
  assert.equal(model.buildAdminScheduleMonthSummary(f).totalsByFilter['all:all'].coachCount, 2)
  assert.equal(getAdminScheduleRoundLearnerBuckets(dayDetail(f).rounds[0]).coachCount, 2)
})
check('repeat learner across rounds counts once; self and child with same raw ID remain distinct', () => {
  const f = { ...fixture, sessions: [session('same'), session('repeat', { child_id: 'same', schedule_slot_id: 'slot-b' }), session('self', { child_id: null, bookings: { ...fixture.sessions[0].bookings, user_id: 'same', learner_type: 'adult' } })] }
  const summary = model.buildAdminScheduleMonthSummary(f)
  assert.equal(summary.totalsByFilter['all:all'].sessionCount, 3)
  assert.equal(summary.totalsByFilter['all:all'].learnerCount, 2)
  assert.equal(model.getAdminSchedulePeopleSummary(summary.rounds).learnerCount, 2)
  assert.equal(model.getAdminSchedulePeopleSummary(summary.rounds).markers.length, 2)
})
check('branch/course filters count only coaches assigned to active learners in the selected rounds', () => {
  const f = { ...fixture, sessions: [...fixture.sessions, session('adult', { schedule_slot_id: 'slot-c', branch_id: 'branch-b', child_id: null, bookings: { ...fixture.sessions[0].bookings, user_id: 'adult', learner_type: 'adult', course_type_id: 'adult', course_types: { name: 'adult_group' } } })], groups: [...fixture.groups, group('c', ['adult'], { schedule_slot_id: 'slot-c', coach_id: 'coach-c', profiles: { id: 'coach-c', full_name: 'Coach C', role: 'coach' } })] }
  const summary = model.buildAdminScheduleMonthSummary(f)
  assert.equal(summary.totalsByFilter['all:all'].coachCount, 2)
  assert.equal(summary.totalsByFilter['branch-a:kids_group'].coachCount, 1)
  assert.equal(summary.totalsByFilter['branch-b:adult_group'].learnerCount, 1)
  assert.equal(model.getAdminScheduleSummaryTotals(summary, 'none', 'all').coachCount, 0)
})
check('search preserves Wallet discovery, excludes it from learner counts and spent Wallet remains hidden', () => {
  const args = { ...fixture, sessions: [fixture.sessions[1]], startDate: '2026-11-01', endDate: '2026-11-30', limit: 200, sourceTruncated: false }
  const result = model.buildAdminScheduleSearchCandidateResult(args)
  assert.equal(result.roundKeys.length, 1)
  assert.equal(result.learnerCount, 0)
  assert.equal(model.buildAdminScheduleSearchResult({ ...args, query: 'wallet' }).learnerCount, 0)
  const spent = { ...args, walletCredits: [{ original_session_id: 'wallet-a', status: 'redeemed' }] }
  assert.equal(model.buildAdminScheduleSearchCandidateResult(spent).roundKeys.length, 0)
  assert.equal(model.buildAdminScheduleMonthSummary(spent).rounds.length, 0)
})
check('aggregation is read-only and does not replace exact attendance or Wallet state', () => {
  const before = JSON.stringify(fixture)
  const detail = model.buildAdminScheduleDayDetail({ ...fixture, slotSessions: [], studentLevels: [], levels: [], teachingPrograms: [], attendanceRows: [
    { booking_session_id: 'active-a', student_id: 'other-child', status: 'absent', checked_at: '2026-11-16T03:00:00Z' },
    { booking_session_id: 'active-a', student_id: 'active-a', status: 'present', checked_at: '2026-11-16T03:01:00Z' },
  ] })
  assert.equal(detail.sessions.find(s => s.id === 'active-a').status, 'completed')
  assert.equal(detail.sessions.find(s => s.id === 'wallet-a').status, 'walleted')
  model.buildAdminScheduleMonthSummary(fixture)
  assert.equal(JSON.stringify(fixture), before)
})
console.log(JSON.stringify({ passed, target: 'in-memory synthetic fixture', customerWrites: 0 }))
