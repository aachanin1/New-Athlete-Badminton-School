import assert from 'node:assert/strict'
import fs from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith('@/')) return nextResolve(specifier, context)
    return {
      url: pathToFileURL(path.join(root, 'src', `${specifier.slice(2)}.ts`)).href,
      shortCircuit: true,
    }
  },
})
const {
  buildAdminScheduleDayDetail,
  buildAdminScheduleMonthSummary,
  buildAdminScheduleSearchResult,
} = await import('../src/lib/admin-schedules-model.ts')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
let passed = 0
function check(name, action) {
  action()
  passed += 1
  console.log(`PASS ${passed}: ${name}`)
}

const session = ({
  id,
  date = '2026-07-20',
  status = 'scheduled',
  childId = `child-${id}`,
  branchId = 'branch-a',
  branchName = 'รามอินทรา',
  course = 'kids_group',
  learner = `Learner ${id}`,
  nickname = null,
  parent = `Parent ${id}`,
  bookingStatus = 'verified',
  slotId = 'slot-a',
}) => ({
  id,
  date,
  start_time: slotId === 'slot-b' ? '12:00' : '10:00',
  end_time: slotId === 'slot-b' ? '14:00' : '12:00',
  status,
  is_makeup: false,
  child_id: childId,
  schedule_slot_id: slotId,
  branch_id: branchId,
  branches: { name: branchName },
  children: childId ? { full_name: learner, nickname } : null,
  bookings: {
    id: `booking-${id}`,
    user_id: `user-${id}`,
    learner_type: childId ? 'child' : 'adult',
    course_type_id: `course-${course}`,
    status: bookingStatus,
    profiles: { full_name: parent },
    course_types: { name: course },
  },
})

const group = ({ id, slotId = 'slot-a', coachId = 'coach-a', coachName = 'Coach Alpha', members = [] }) => ({
  id,
  schedule_slot_id: slotId,
  coach_id: coachId,
  name: coachId ? `Group ${id}` : 'ยังไม่จัดกลุ่ม',
  level_min: null,
  level_max: null,
  sort_order: 0,
  profiles: coachId ? { id: coachId, full_name: coachName, role: 'coach' } : null,
  coach_assignment_group_students: members.map((booking_session_id) => ({ booking_session_id })),
})

const sessions = [
  session({ id: 'assigned', nickname: 'น้องเอ' }),
  session({ id: 'waiting', slotId: 'slot-b', learner: 'เบต้า', parent: 'ผู้ปกครองบี' }),
  session({ id: 'wallet', status: 'walleted', slotId: 'slot-b' }),
  session({ id: 'old-wallet', status: 'walleted', slotId: 'slot-b' }),
]
const groups = [
  group({ id: 'assigned', members: ['assigned'] }),
  group({ id: 'waiting', slotId: 'slot-b', coachId: null, coachName: null, members: ['waiting'] }),
]
const walletCredits = [
  { original_session_id: 'wallet', status: 'active' },
  { original_session_id: 'old-wallet', status: 'redeemed' },
]

check('monthly summary preserves session, round, waiting-coach, wallet, and unique-learner counts', () => {
  const summary = buildAdminScheduleMonthSummary({ sessions, groups, walletCredits })
  assert.equal(summary.rounds.length, 2)
  assert.deepEqual(summary.totalsByFilter['all:all'], {
    sessionCount: 3,
    learnerCount: 3,
    roundCount: 2,
    branchCount: 1,
    waitingCoachCount: 1,
    walletedCount: 1,
  })
})

check('walleted learners never enter waiting-coach totals', () => {
  const summary = buildAdminScheduleMonthSummary({ sessions, groups, walletCredits })
  const slotB = summary.rounds.find((round) => round.key === 'slot:slot-b')
  assert.deepEqual([slotB?.waiting_coach_count, slotB?.walleted_count], [1, 1])
})

check('selected-day detail uses exact child attendance and ignores another student row', () => {
  const detail = buildAdminScheduleDayDetail({
    sessions,
    groups,
    walletCredits,
    slotSessions: sessions.map((row) => ({ id: row.id, schedule_slot_id: row.schedule_slot_id })),
    attendanceRows: [
      { booking_session_id: 'assigned', student_id: 'wrong-child', status: 'absent', checked_at: '2026-07-20T03:00:00Z' },
      { booking_session_id: 'assigned', student_id: 'child-assigned', status: 'present', checked_at: '2026-07-20T03:01:00Z' },
    ],
    studentLevels: [{ student_id: 'child-assigned', student_type: 'child', level: 6, created_at: '2026-07-01T00:00:00Z' }],
    levels: [{ id: 6, name: 'พื้นฐาน', category: 'basic' }],
    teachingPrograms: [{
      id: 'program-a', coach_id: 'coach-a', schedule_slot_id: 'slot-a',
      program_content: 'Footwork', status: 'approved', created_at: '2026-07-20T00:00:00Z', updated_at: '2026-07-20T01:00:00Z',
    }],
  })
  const assigned = detail.sessions.find((row) => row.id === 'assigned')
  assert.deepEqual([assigned?.status, assigned?.level, assigned?.level_name], ['completed', 6, 'พื้นฐาน'])
  assert.equal(detail.rounds[0].groups[0].teaching_program?.program_content, 'Footwork')
  assert.equal(detail.sessions.some((row) => row.id === 'old-wallet'), false)
})

check('selected-day detail maps self/adult attendance to bookings.user_id', () => {
  const adultSession = session({ id: 'adult-exact', childId: null, parent: 'Adult Learner' })
  const detail = buildAdminScheduleDayDetail({
    sessions: [adultSession],
    groups: [],
    walletCredits: [],
    slotSessions: [{ id: adultSession.id, schedule_slot_id: adultSession.schedule_slot_id }],
    attendanceRows: [
      { booking_session_id: adultSession.id, student_id: 'wrong-user', status: 'present', checked_at: '2026-07-20T03:00:00Z' },
      { booking_session_id: adultSession.id, student_id: 'user-adult-exact', status: 'absent', checked_at: '2026-07-20T03:01:00Z' },
    ],
    studentLevels: [],
    levels: [],
    teachingPrograms: [],
  })
  assert.equal(detail.sessions[0]?.status, 'absent')
})

const searchable = [
  session({ id: 'thai-short', learner: 'กานต์', nickname: 'ก', parent: 'สมชาย', branchName: 'แจ้งวัฒนะ' }),
  session({ id: 'adult', childId: null, learner: 'ignored', parent: 'Alice Parent', branchId: 'branch-b', branchName: 'พระราม 2', course: 'private', slotId: 'slot-b' }),
  session({ id: 'outside', date: '2026-08-01', learner: 'กานต์นอกเดือน', nickname: 'ก' }),
]
const searchableGroups = [group({ id: 'coach-search', coachName: 'Coach Nice', members: ['thai-short'] })]
const search = (query, extra = {}) => buildAdminScheduleSearchResult({
  sessions: searchable,
  groups: searchableGroups,
  query,
  startDate: '2026-07-01',
  endDate: '2026-07-31',
  limit: 200,
  ...extra,
})

check('month-wide search covers short Thai learner names without a minimum length', () => {
  assert.deepEqual(search('ก').roundKeys, ['slot:slot-a'])
})
check('month-wide search covers parent names', () => assert.equal(search('Alice').matchCount, 1))
check('month-wide search covers coach names', () => assert.equal(search('Nice').matchCount, 1))
check('month-wide search covers branches', () => assert.equal(search('แจ้ง').matchCount, 1))
check('month-wide search covers courses', () => assert.equal(search('private').matchCount, 1))
check('month-wide search covers booking status', () => assert.equal(search('verified').matchCount, 2))
check('search stays inside the selected month', () => assert.equal(search('นอกเดือน').matchCount, 0))
check('branch and course filters retain their previous exact behavior', () => {
  assert.equal(search('verified', { branchId: 'branch-b', courseType: 'private' }).matchCount, 1)
})

check('month-wide search returns a bounded round-key payload', () => {
  const manySessions = Array.from({ length: 205 }, (_, index) => session({
    id: `bounded-${index}`,
    slotId: `bounded-slot-${index}`,
  }))
  const result = buildAdminScheduleSearchResult({
    sessions: manySessions,
    groups: [],
    query: 'verified',
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    limit: 200,
  })
  assert.equal(result.roundKeys.length, 200)
  assert.equal(result.matchCount, 205)
  assert.equal(result.truncated, true)
})

check('initial RSC serializes summary only and does not preload day detail', () => {
  const page = read('src/app/(admin)/admin/schedules/page.tsx')
  assert.equal(page.includes('loadAdminScheduleMonthSummary'), true)
  for (const forbidden of ['loadAdminScheduleDayDetail', 'attendanceRows', 'studentLevels', 'teachingPrograms']) {
    assert.equal(page.includes(forbidden), false)
  }
})

check('day detail and search boundaries require schedules authorization', () => {
  for (const route of [
    'src/app/api/admin/schedules/day/route.ts',
    'src/app/api/admin/schedules/search/route.ts',
  ]) {
    assert.equal(read(route).includes("requireAdminMenuAccess('schedules')"), true)
  }
  const auth = read('src/lib/auth/admin.ts')
  assert.equal(auth.includes("['admin', 'super_admin']"), true)
})

check('client debounces search and rejects aborted or stale day/search responses', () => {
  const client = read('src/components/admin/schedules-client.tsx')
  assert.equal(client.includes('}, 300)'), true)
  assert.ok((client.match(/AbortController/g) || []).length >= 2)
  assert.equal(client.includes('generation !== dayRequestGeneration.current'), true)
  assert.equal(client.includes('generation !== searchRequestGeneration.current'), true)
})

check('performance instrumentation excludes search terms and known PII field names', () => {
  const source = read('src/lib/admin-schedules-read.ts')
  const logBlock = source.slice(source.indexOf("console.info('[admin-schedules-performance]'"), source.indexOf('return result', source.indexOf("console.info('[admin-schedules-performance]'")))
  for (const forbidden of ['query', 'full_name', 'phone', 'learner', 'parent']) assert.equal(logBlock.includes(forbidden), false)
})

console.log(`\nAdmin Schedules Phase B checks passed: ${passed}`)
