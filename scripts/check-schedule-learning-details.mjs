import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const {
  buildActiveScheduleLevelNameMap,
  buildLatestScheduleStudentLevelMap,
  formatScheduleLevel,
  getScheduleLevelDetails,
  getScheduleStudentKey,
  toSafeScheduleProgramResponse,
} = await import('../src/lib/schedule-learning-details.ts')

let passed = 0
function check(name, action) {
  action()
  passed += 1
  console.log(`PASS ${passed}: ${name}`)
}

const studentLevels = [
  { id: 'level-a', student_id: 'same-id', student_type: 'adult', level: 4, created_at: '2026-08-01T00:00:00Z' },
  { id: 'level-b', student_id: 'same-id', student_type: 'child', level: 8, created_at: '2026-08-01T00:00:00Z' },
  { id: 'level-c', student_id: 'same-id', student_type: 'child', level: 9, created_at: '2026-08-02T00:00:00Z' },
  { id: 'level-d', student_id: 'tie-id', student_type: 'child', level: 10, created_at: '2026-08-03T00:00:00Z' },
  { id: 'level-e', student_id: 'tie-id', student_type: 'child', level: 11, created_at: '2026-08-03T00:00:00Z' },
]
const latestLevels = buildLatestScheduleStudentLevelMap(studentLevels)
const activeLevelNames = buildActiveScheduleLevelNameMap([
  { id: 4, name: 'Adult Active', is_active: true },
  { id: 9, name: 'Child Active', is_active: true },
  { id: 10, name: 'Inactive Name', is_active: false },
])

check('student key includes exact student_type and student_id', () => {
  assert.equal(getScheduleStudentKey('adult', 'same-id'), 'adult:same-id')
  assert.equal(latestLevels.get('adult:same-id')?.level, 4)
  assert.equal(latestLevels.get('child:same-id')?.level, 9)
})

check('latest level selection is deterministic by created_at then row id', () => {
  assert.equal(latestLevels.get('child:tie-id')?.level, 11)
})

check('Level 0 fallback matches User Coach and Admin presentation', () => {
  const details = getScheduleLevelDetails('child', 'missing', latestLevels, activeLevelNames)
  assert.deepEqual(details, { level: 0, levelName: null, label: 'LV 0 / ยังไม่ประเมิน' })
  assert.equal(formatScheduleLevel(details.level, details.levelName), details.label)
})

check('active Level name is used without inventing a name', () => {
  assert.equal(getScheduleLevelDetails('child', 'same-id', latestLevels, activeLevelNames).label, 'LV 9 · Child Active')
  assert.equal(getScheduleLevelDetails('child', 'tie-id', latestLevels, activeLevelNames).label, 'LV 11')
})

check('safe program response projects only approved-display fields', () => {
  assert.deepEqual(toSafeScheduleProgramResponse({
    id: 'program-id',
    program_content: 'Full content',
    updated_at: '2026-08-19T00:00:00Z',
  }), {
    program: { id: 'program-id', programContent: 'Full content', updatedAt: '2026-08-19T00:00:00Z' },
  })
  assert.deepEqual(toSafeScheduleProgramResponse(null), { program: null })
})

const route = read('src/app/api/schedule/program/route.ts')
check('parent route authenticates before an explicit verified ownership lookup', () => {
  const authIndex = route.indexOf('auth.getUser()')
  const ownershipIndex = route.indexOf(".from('booking_sessions')")
  const exactGroupIndex = route.indexOf(".from('coach_assignment_group_students')")
  assert.ok(authIndex >= 0 && ownershipIndex > authIndex && exactGroupIndex > ownershipIndex)
  assert.equal(route.includes(".eq('bookings.user_id', user.id)"), true)
  assert.equal(route.includes(".eq('bookings.status', 'verified')"), true)
  assert.equal(route.includes("return json({ error: 'Not found' }, 404)"), true)
})

check('parent route resolves exact group and approved coach+slot without Legacy fallback', () => {
  assert.equal(route.includes(".from('coach_assignment_group_students')"), true)
  assert.equal(route.includes('group.schedule_slot_id !== ownedSession.schedule_slot_id'), true)
  assert.equal(route.includes(".eq('coach_id', group.coach_id)"), true)
  assert.equal(route.includes(".eq('schedule_slot_id', group.schedule_slot_id)"), true)
  assert.equal(route.includes(".eq('status', 'approved')"), true)
  assert.equal(route.includes(".order('updated_at', { ascending: false })"), true)
  assert.equal(route.includes(".order('id', { ascending: false })"), true)
  assert.equal(route.includes('coach_assignments'), false)
})

check('parent route is dynamic, private no-store, UUID bounded, and safely projected', () => {
  assert.equal(route.includes("export const dynamic = 'force-dynamic'"), true)
  assert.equal(route.includes("'Cache-Control': 'private, no-store'"), true)
  assert.equal(route.includes('UUID_PATTERN.test(sessionId)'), true)
  assert.equal(route.includes(".select('id, program_content, updated_at')"), true)
  for (const forbidden of ['admin_notes', 'review_notes', 'reviewed_by', 'reviewer']) {
    assert.equal(route.includes(forbidden), false)
  }
})

const userPage = read('src/app/(dashboard)/dashboard/schedule/page.tsx')
const userClient = read('src/components/dashboard/schedule-calendar-client.tsx')
const coachPage = read('src/app/(coach)/coach/today/page.tsx')
const adminClient = read('src/components/admin/schedules-client.tsx')

check('User initial render has no program query/content and fetches only on demand', () => {
  assert.equal(userPage.includes(".from('teaching_programs')"), false)
  assert.equal(userPage.includes('program_content'), false)
  assert.equal(userClient.includes("fetch(`/api/schedule/program?sessionId="), true)
  assert.equal(userClient.includes('ดูโปรแกรมสอนรอบนี้'), true)
  assert.equal(userClient.includes('can_view_program'), true)
  assert.equal(userClient.includes('programCache.current.has(session.id)'), true)
  assert.equal(userClient.includes('AbortController'), true)
})

check('User and Coach Level reads are fixed batch/reference calls, not render-loop reads', () => {
  assert.equal((userPage.match(/\.from\('student_levels'\)/g) || []).length, 1)
  assert.equal((userPage.match(/\.from\('levels'\)/g) || []).length, 1)
  assert.equal((coachPage.match(/\.from\('student_levels'\)/g) || []).length, 1)
  assert.equal((coachPage.match(/\.from\('levels'\)/g) || []).length, 1)
  assert.equal(userPage.includes('.map(async'), false)
  assert.equal(coachPage.includes('.map(async'), false)
})

check('high-cardinality User assignment uses ownership-scoped exact and legacy reads without URI fan-out', () => {
  assert.equal(userPage.includes('useOwnershipScopedMembershipRead = slotIds.length > 100'), true)
  assert.equal(userPage.includes(".from('coach_assignment_group_students')"), true)
  assert.equal(userPage.includes(".eq('booking_sessions.bookings.user_id', user.id)"), true)
  assert.equal(userPage.includes(".eq('booking_sessions.bookings.status', 'verified')"), true)
  assert.equal(userPage.includes('ownershipScopedSlotAssignments'), true)
  assert.equal(userPage.includes('coach_assignment_groups(id)'), true)
  assert.equal(userPage.includes('coach_assignments('), true)
  assert.equal(userPage.includes('groupCountBySlotId[row.schedule_slot_id] = (slot.coach_assignment_groups || []).length'), true)
  assert.equal(userPage.includes('legacyAssignmentBySlotId[assignment.schedule_slot_id] = assignment'), true)
  assert.match(userPage, /can_view_program:\s*Boolean\(\s*assignment\?\.id\s*&& assignment\.coach_id/u)
})

check('Admin keeps line-clamped preview and opens full content from existing payload', () => {
  assert.equal(adminClient.includes('className="line-clamp-2"'), true)
  assert.equal(adminClient.includes('setProgramDialog({'), true)
  assert.equal(adminClient.includes('programDialog?.program.program_content'), true)
  assert.equal(adminClient.includes('whitespace-pre-wrap'), true)
  assert.equal(adminClient.includes('aria-label={`อ่านโปรแกรมสอนฉบับเต็ม'), true)
})

check('one shared formatter provides User Coach Admin Level parity', () => {
  assert.equal(userPage.includes('getScheduleLevelDetails'), true)
  assert.equal(coachPage.includes('getScheduleLevelDetails'), true)
  assert.equal(adminClient.includes('formatScheduleLevel(session.level, session.level_name)'), true)
})

console.log(`\nSchedule learning details checks passed: ${passed}`)
