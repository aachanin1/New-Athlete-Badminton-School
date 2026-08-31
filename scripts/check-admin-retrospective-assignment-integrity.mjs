import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const routeSource = read('src/app/api/admin/makeup/route.ts')
const clientSource = read('src/components/admin/makeup-client.tsx')
const conflictSource = read('src/lib/coach-assignment-conflicts.ts')
const migrationSource = read('supabase/migrations/20260831060105_admin_retrospective_assignment_integrity.sql')
let passed = 0

function check(name) {
  passed += 1
  console.log(`PASS ${passed}: ${name}`)
}

for (const operation of [
  'assign_coach_to_round',
  'resolve_unassigned_round',
  'mark_attendance',
  'replace_coach_for_past_round',
  'move_learner_to_existing_coach_group',
]) assert.match(routeSource, new RegExp(`action === '${operation}'`))
assert.doesNotMatch(routeSource, /create_exact_coach_assignment_group_v1/)
assert.equal((routeSource.match(/admin_apply_retrospective_assignment_transition_v1/g) || []).length, 1)
assert.doesNotMatch(
  routeSource,
  /from\(['"](?:coach_assignment_groups|coach_assignment_group_students|coach_assignments|coach_assignment_exact_reservations)['"]\)[\s\S]{0,180}?\.(?:insert|update|delete)\(/,
)
assert.match(routeSource, /if \(result\.changed\) \{[\s\S]*?notifyUser/)
check('all five Admin actions route through one canonical RPC without direct assignment DML or the legacy create RPC')

const expectedClientOperations = [
  'assign_coach_to_round',
  'resolve_unassigned_round',
  'mark_attendance',
  'replace_coach_for_past_round',
  'move_learner_to_existing_coach_group',
]
const executableClientOperations = Array.from(clientSource.matchAll(
  /runRetrospectiveMutation\(\{\s*operation:\s*'([^']+)'/g,
), (match) => match[1])
for (const operation of expectedClientOperations) {
  assert.ok(
    executableClientOperations.includes(operation),
    `client lifecycle has no executable runRetrospectiveMutation call for ${operation}`,
  )
}
for (const required of [
  'runRetrospectiveMutation',
  'inFlightTargetKeysRef',
  'inFlightSessionIdsRef',
  'refreshSessionIdsRef',
  'applyCanonicalProjection',
  'projectedSessions',
  'idempotentReplay',
  'toast.success',
  'startRefreshTransition(() => router.refresh())',
  'กำลังบันทึกข้อมูล กรุณารอสักครู่',
  'บันทึกสำเร็จ กำลังยืนยันข้อมูลกับระบบ',
]) assert.ok(clientSource.includes(required), `client completion lifecycle missing ${required}`)
assert.doesNotMatch(clientSource, /(?:window\.)?location\.reload|setTimeout\(|setInterval\(/)
check('all five Admin retrospective operations share ref-guarded completion, canonical projection, Thai feedback, and background reconciliation primitives')

for (const prefix of ['ROSTER', 'LIFECYCLE', 'DUPLICATE', 'STALE_STATE', 'COACH_CONFLICT']) {
  assert.ok(conflictSource.includes(`ADMIN_RETRO_ASSIGNMENT_${prefix}`))
}
assert.match(routeSource, /getAdminRetrospectiveAssignmentConflict\(error\.message\)[\s\S]*?status: 409/)
check('stable database errors map to Thai-facing HTTP 409 responses and notifications require changed=true')

for (const required of [
  'security invoker',
  'set search_path = public, pg_temp',
  'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT|',
  'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|',
  'ADMIN_RETRO_ASSIGNMENT_DUPLICATE|',
  'ADMIN_RETRO_ASSIGNMENT_STALE_STATE|',
  'ADMIN_RETRO_ASSIGNMENT_COACH_CONFLICT|',
  'revoke all on function',
  'to service_role',
]) assert.ok(migrationSource.toLowerCase().includes(required.toLowerCase()), `migration missing ${required}`)
assert.doesNotMatch(migrationSource, /\bdo\s*\$\$/i)
check('migration is additive, SECURITY INVOKER, pinned-search-path, typed, and service-role-only')

if (process.argv.includes('--architecture-only')) {
  console.log(`Admin retrospective assignment architecture checks passed (${passed})`)
  process.exit(0)
}

function localEnvironment() {
  const output = execSync('npx.cmd supabase status -o env', { encoding: 'utf8' })
  const values = new Map()
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)="?(.*?)"?$/)
    if (match) values.set(match[1], match[2])
  }
  const apiUrl = values.get('API_URL')
  const serviceRoleKey = values.get('SERVICE_ROLE_KEY')
  if (!apiUrl || !serviceRoleKey || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(apiUrl)) {
    throw new Error('Retrospective integrity tests refuse to run unless Supabase is local.')
  }
  return { apiUrl, serviceRoleKey }
}

const env = localEnvironment()
const admin = createClient(env.apiUrl, env.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const prefix = `admin-retro-${Date.now()}`
const password = 'LocalOnly!2026'
const ids = {
  branchA: randomUUID(),
  branchB: randomUUID(),
  courseA: randomUUID(),
  courseB: randomUUID(),
}
const userIds = []
const bookingIds = []
const slotIds = []
const sessionIds = []
let actorId
let learnerId
let coachA
let coachB
let coachC
let dayOffset = 0

function noError(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}

function dateDaysAgo(days) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

async function createUser(role, suffix) {
  const result = await admin.auth.admin.createUser({
    email: `${prefix}-${suffix}@example.com`,
    password,
    email_confirm: true,
    user_metadata: { full_name: `${prefix} ${suffix}` },
  })
  noError(result, `create ${role}`)
  const id = result.data.user.id
  userIds.push(id)
  noError(await admin.from('profiles').update({ role, full_name: `${prefix} ${suffix}` }).eq('id', id), `set ${role}`)
  return id
}

async function createRound({
  sessionCount = 1,
  bookingStatus = 'verified',
  sessionStatus = 'scheduled',
  isMakeup = false,
  branchId = ids.branchA,
  bookingBranchId = branchId,
  courseId = ids.courseA,
  bookingCourseId = courseId,
  date,
  startTime = '13:00:00',
  endTime = '15:00:00',
} = {}) {
  const fixtureDate = date || dateDaysAgo(120 - dayOffset++)
  const bookingId = randomUUID()
  const slotId = randomUUID()
  bookingIds.push(bookingId)
  slotIds.push(slotId)
  noError(await admin.from('bookings').insert({
    id: bookingId,
    user_id: learnerId,
    learner_type: 'self',
    child_id: null,
    branch_id: bookingBranchId,
    course_type_id: bookingCourseId,
    month: Number(fixtureDate.slice(5, 7)),
    year: Number(fixtureDate.slice(0, 4)),
    total_sessions: sessionCount,
    total_price: 0,
    status: bookingStatus,
  }), 'insert booking')
  noError(await admin.from('schedule_slots').insert({
    id: slotId,
    template_id: null,
    branch_id: branchId,
    course_type_id: courseId,
    date: fixtureDate,
    start_time: startTime,
    end_time: endTime,
    max_students: 6,
    current_students: sessionCount,
    status: 'open',
  }), 'insert slot')
  const sessions = Array.from({ length: sessionCount }, () => randomUUID())
  sessionIds.push(...sessions)
  noError(await admin.from('booking_sessions').insert(sessions.map((id) => ({
    id,
    booking_id: bookingId,
    schedule_slot_id: slotId,
    date: fixtureDate,
    start_time: startTime,
    end_time: endTime,
    branch_id: branchId,
    child_id: null,
    status: sessionStatus,
    is_makeup: isMakeup,
  }))), 'insert booking sessions')
  return { bookingId, slotId, sessions, date: fixtureDate, startTime, endTime }
}

async function createGroup(round, { coachId = null, sessions = round.sessions, name = 'Persisted exact group' } = {}) {
  const groupId = randomUUID()
  noError(await admin.from('coach_assignment_groups').insert({
    id: groupId,
    schedule_slot_id: round.slotId,
    coach_id: coachId,
    name,
    sort_order: 0,
    notes: 'local integrity fixture',
    created_by: actorId,
  }), 'insert group')
  const memberIds = sessions.map(() => randomUUID())
  noError(await admin.from('coach_assignment_group_students').insert(sessions.map((sessionId, index) => ({
    id: memberIds[index],
    group_id: groupId,
    booking_session_id: sessionId,
    student_id: learnerId,
    student_type: 'adult',
  }))), 'insert memberships')
  if (coachId) {
    noError(await admin.from('coach_assignments').upsert({
      coach_id: coachId,
      schedule_slot_id: round.slotId,
      assigned_by: actorId,
    }, { onConflict: 'coach_id,schedule_slot_id' }), 'insert legacy assignment')
  }
  return { groupId, memberIds }
}

function rpc(round, {
  operation = 'assign_coach_to_round',
  coachId = coachA,
  sessions = round.sessions,
  targetGroupId = null,
  attendance = {},
  failStage = null,
} = {}) {
  return admin.rpc('admin_apply_retrospective_assignment_transition_v1', {
    p_operation: operation,
    p_schedule_slot_id: round.slotId,
    p_actor_id: actorId,
    p_coach_id: coachId,
    p_booking_session_ids: sessions,
    p_target_group_id: targetGroupId,
    p_reason: 'deterministic local integrity test',
    p_attendance_by_session_id: attendance,
    p_test_fail_stage: failStage,
  })
}

async function rows(table, query) {
  const result = await query(admin.from(table).select('*'))
  return noError(result, `read ${table}`) || []
}

async function fingerprint(round) {
  const groups = await rows('coach_assignment_groups', (q) => q.eq('schedule_slot_id', round.slotId).order('id'))
  const groupIds = groups.map((row) => row.id)
  const memberships = groupIds.length
    ? await rows('coach_assignment_group_students', (q) => q.in('group_id', groupIds).order('id'))
    : []
  const legacy = await rows('coach_assignments', (q) => q.eq('schedule_slot_id', round.slotId).order('id'))
  const reservations = await rows('coach_assignment_exact_reservations', (q) => q.eq('schedule_slot_id', round.slotId).order('group_id'))
  const attendance = await rows('attendance', (q) => q.in('booking_session_id', round.sessions).order('id'))
  const sessions = await rows('booking_sessions', (q) => q.in('id', round.sessions).order('id'))
  const activity = await rows('activity_logs', (q) => q.eq('entity_id', round.slotId).like('action', 'admin_retrospective_assignment_%').order('id'))
  return { groups, memberships, legacy, reservations, attendance, sessions, activity }
}

async function globalProtectedFingerprint() {
  const tables = [
    'notifications',
    'payments',
    'coupon_usages',
    'progressive_payment_allocations',
    'lesson_wallet_credits',
    'finance_expenses',
    'coach_checkins',
    'coach_weekly_teaching_summaries',
  ]
  const result = {}
  for (const table of tables) {
    const response = await admin.from(table).select('*', { count: 'exact', head: true })
    if (response.error) throw new Error(`protected fingerprint ${table}: ${response.error.message}`)
    result[table] = response.count
  }
  return result
}

async function expectConflict(run, prefix, name, round) {
  const before = round ? await fingerprint(round) : null
  const protectedBefore = await globalProtectedFingerprint()
  const result = await run()
  assert.ok(result.error, `${name}: expected conflict`)
  assert.match(result.error.message, new RegExp(prefix))
  if (round) assert.deepEqual(await fingerprint(round), before, `${name}: core residue`)
  assert.deepEqual(await globalProtectedFingerprint(), protectedBefore, `${name}: protected-domain residue`)
  check(name)
}

async function cleanup() {
  if (slotIds.length) {
    await admin.from('activity_logs').delete().in('entity_id', slotIds)
    await admin.from('coach_assignment_groups').delete().in('schedule_slot_id', slotIds)
    await admin.from('coach_assignments').delete().in('schedule_slot_id', slotIds)
  }
  if (sessionIds.length) await admin.from('attendance').delete().in('booking_session_id', sessionIds)
  if (sessionIds.length) await admin.from('booking_sessions').delete().in('id', sessionIds)
  if (slotIds.length) await admin.from('schedule_slots').delete().in('id', slotIds)
  if (bookingIds.length) await admin.from('bookings').delete().in('id', bookingIds)
  await admin.from('course_types').delete().in('id', [ids.courseA, ids.courseB])
  await admin.from('branches').delete().in('id', [ids.branchA, ids.branchB])
  for (const id of userIds.reverse()) await admin.auth.admin.deleteUser(id)
}

try {
  actorId = await createUser('admin', 'actor')
  learnerId = await createUser('user', 'learner')
  coachA = await createUser('coach', 'coach-a')
  coachB = await createUser('coach', 'coach-b')
  coachC = await createUser('head_coach', 'coach-c')
  noError(await admin.from('branches').insert([
    { id: ids.branchA, name: `${prefix} A`, slug: `${prefix}-a`, address: 'local', is_active: true },
    { id: ids.branchB, name: `${prefix} B`, slug: `${prefix}-b`, address: 'local', is_active: true },
  ]), 'insert branches')
  noError(await admin.from('course_types').insert([
    { id: ids.courseA, name: 'kids_group', description: prefix, max_students: 6, duration_hours: 2 },
    { id: ids.courseB, name: 'adult_group', description: prefix, max_students: 6, duration_hours: 2 },
  ]), 'insert courses')
  const protectedBaseline = await globalProtectedFingerprint()

  const noGroup = await createRound({ sessionCount: 2 })
  const noGroupResult = noError(await rpc(noGroup), 'no-group transition')
  assert.equal(noGroupResult.changed, true)
  assert.equal(noGroupResult.idempotentReplay, false)
  assert.equal(noGroupResult.after.groups.length, 1)
  assert.equal(noGroupResult.after.memberships.length, 2)
  assert.deepEqual(noGroupResult.after.sessionStatuses.map((row) => row.status), ['scheduled', 'scheduled'])
  assert.equal(noGroupResult.after.attendance.length, 0)
  check('no group creates one intended assigned group atomically without Attendance/status mutation')

  const nullGroup = await createRound({ sessionCount: 2 })
  const persisted = await createGroup(nullGroup, { name: 'ยังไม่จัดกลุ่ม' })
  const beforeNull = await fingerprint(nullGroup)
  const legacyFailure = await admin.rpc('create_exact_coach_assignment_group_v1', {
    p_schedule_slot_id: nullGroup.slotId,
    p_coach_id: coachA,
    p_name: 'Legacy duplicate reproduction',
    p_sort_order: 999,
    p_notes: 'pre-fix reproduction',
    p_actor_id: actorId,
    p_booking_session_ids: nullGroup.sessions,
  })
  assert.ok(legacyFailure.error)
  assert.match(legacyFailure.error.message, /coach_assignment_group_students_session_key|duplicate key/i)
  assert.deepEqual(await fingerprint(nullGroup), beforeNull)
  check('pre-fix legacy create RPC reproduces the duplicate-membership failure with zero transaction residue')
  const reuse = noError(await rpc(nullGroup), 'reuse NULL-coach group')
  assert.equal(reuse.groupId, persisted.groupId)
  assert.deepEqual(reuse.after.memberships.map((row) => row.id).sort(), persisted.memberIds.sort())
  assert.equal(reuse.after.groups.find((row) => row.id === persisted.groupId).name, 'ยังไม่จัดกลุ่ม')
  assert.equal(reuse.after.groups.find((row) => row.id === persisted.groupId).admin_retrospective_preserved_name, true)
  check('exact populated NULL-coach group is reused with group, membership IDs, name, and metadata preserved')
  const replayBefore = await fingerprint(nullGroup)
  const replay = noError(await rpc(nullGroup), 'exact replay')
  assert.equal(replay.changed, false)
  assert.equal(replay.idempotentReplay, true)
  assert.equal(replay.audit, null)
  assert.deepEqual(await fingerprint(nullGroup), replayBefore)
  check('exact replay is idempotent with no duplicate core write or activity')

  const assignedOther = await createRound({ sessionCount: 1 })
  await createGroup(assignedOther, { coachId: coachB })
  await expectConflict(() => rpc(assignedOther), 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT', 'assigned target requires explicit Replace routing', assignedOther)
  const replaced = noError(await rpc(assignedOther, { operation: 'replace_coach_for_past_round' }), 'replace coach')
  assert.equal(replaced.changed, true)
  assert.equal(replaced.after.groups[0].coach_id, coachA)
  check('Replace changes only the exact assigned target and legacy compatibility')

  const mixed = await createRound({ sessionCount: 3 })
  const mixedTarget = await createGroup(mixed, { sessions: mixed.sessions.slice(0, 2) })
  const unrelated = await createGroup(mixed, { coachId: coachB, sessions: mixed.sessions.slice(2), name: 'Unrelated coached group' })
  const unrelatedBefore = (await fingerprint(mixed))
  const mixedResult = noError(await rpc(mixed, { sessions: mixed.sessions.slice(0, 2) }), 'mixed slot')
  assert.equal(mixedResult.groupId, mixedTarget.groupId)
  const unrelatedAfter = await fingerprint(mixed)
  assert.deepEqual(unrelatedAfter.groups.find((row) => row.id === unrelated.groupId), unrelatedBefore.groups.find((row) => row.id === unrelated.groupId))
  assert.deepEqual(unrelatedAfter.memberships.filter((row) => row.group_id === unrelated.groupId), unrelatedBefore.memberships.filter((row) => row.group_id === unrelated.groupId))
  check('mixed slot mutates only the explicit NULL-coach group and preserves the unrelated coached group')

  const partial = await createRound({ sessionCount: 2 })
  await createGroup(partial)
  await expectConflict(() => rpc(partial, { sessions: partial.sessions.slice(0, 1) }), 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT', 'partial NULL-group roster fails closed', partial)

  const spanning = await createRound({ sessionCount: 2 })
  await createGroup(spanning, { sessions: spanning.sessions.slice(0, 1) })
  await createGroup(spanning, { sessions: spanning.sessions.slice(1) })
  await expectConflict(() => rpc(spanning), 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT', 'target spanning multiple NULL groups fails closed', spanning)

  const mismatch = await createRound()
  const badGroup = await createGroup(mismatch)
  noError(await admin.from('coach_assignment_group_students').update({ student_id: randomUUID() }).eq('group_id', badGroup.groupId), 'corrupt local identity fixture')
  await expectConflict(() => rpc(mismatch), 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT', 'session/member learner identity mismatch fails closed', mismatch)

  const wrongIdentity = await createRound({ bookingCourseId: ids.courseB })
  await expectConflict(() => rpc(wrongIdentity), 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT', 'wrong slot course identity fails closed', wrongIdentity)
  const wrongBranchIdentity = await createRound({ bookingBranchId: ids.branchB })
  await expectConflict(() => rpc(wrongBranchIdentity), 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT', 'wrong booking/slot branch identity fails closed', wrongBranchIdentity)
  const wrongSlotTarget = await createRound()
  const wrongSlotSession = await createRound({ branchId: ids.branchB, bookingBranchId: ids.branchB })
  await expectConflict(() => rpc(wrongSlotTarget, { sessions: wrongSlotSession.sessions }), 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT', 'wrong slot and branch fail closed', wrongSlotTarget)

  const unverified = await createRound({ bookingStatus: 'pending_payment' })
  await expectConflict(() => rpc(unverified), 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT', 'unverified booking fails closed', unverified)
  const makeup = await createRound({ isMakeup: true })
  await expectConflict(() => rpc(makeup), 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT', 'Makeup session fails closed', makeup)
  const ineligible = await createRound({ sessionStatus: 'walleted' })
  await expectConflict(() => rpc(ineligible), 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT', 'ineligible session lifecycle fails closed', ineligible)

  const attendanceRound = await createRound({ sessionCount: 2 })
  const attendanceMap = {
    [attendanceRound.sessions[0]]: 'present',
    [attendanceRound.sessions[1]]: 'absent',
  }
  const attendanceResult = noError(await rpc(attendanceRound, {
    operation: 'resolve_unassigned_round',
    attendance: attendanceMap,
  }), 'resolve attendance')
  assert.deepEqual(attendanceResult.after.attendance.map((row) => row.status).sort(), ['absent', 'present'])
  assert.deepEqual(attendanceResult.after.sessionStatuses.map((row) => row.status).sort(), ['absent', 'completed'])
  check('Resolve atomically writes exact Attendance and present/late-to-completed, absent-to-absent session status')
  const attendanceReplay = noError(await rpc(attendanceRound, {
    operation: 'resolve_unassigned_round',
    attendance: attendanceMap,
  }), 'resolve replay')
  assert.equal(attendanceReplay.changed, false)
  assert.equal(attendanceReplay.audit, null)
  check('Attendance replay is idempotent with no duplicate activity')

  const move = await createRound({ sessionCount: 3 })
  const moveSource = await createGroup(move, { sessions: move.sessions.slice(0, 2) })
  const moveTarget = await createGroup(move, { coachId: coachA, sessions: move.sessions.slice(2), name: 'Existing coach group' })
  const moveResult = noError(await rpc(move, {
    operation: 'move_learner_to_existing_coach_group',
    sessions: move.sessions.slice(0, 1),
    targetGroupId: moveTarget.groupId,
  }), 'move learner')
  assert.equal(moveResult.groupId, moveTarget.groupId)
  const moveAfter = await fingerprint(move)
  assert.equal(moveAfter.groups.some((row) => row.id === moveSource.groupId), true)
  assert.equal(moveAfter.memberships.filter((row) => row.group_id === moveSource.groupId).length, 1)
  assert.equal(moveAfter.memberships.filter((row) => row.group_id === moveTarget.groupId).length, 2)
  check('Move changes only the explicit learner membership and preserves a non-empty source group')
  const moveReplay = noError(await rpc(move, {
    operation: 'move_learner_to_existing_coach_group',
    sessions: move.sessions.slice(0, 1),
    targetGroupId: moveTarget.groupId,
  }), 'move replay')
  assert.equal(moveReplay.changed, false)
  check('Move replay is idempotent')

  const moveAttendance = await createRound({ sessionCount: 2 })
  const moveAttendanceSource = await createGroup(moveAttendance, { sessions: moveAttendance.sessions.slice(0, 1) })
  const moveAttendanceTarget = await createGroup(moveAttendance, { coachId: coachA, sessions: moveAttendance.sessions.slice(1) })
  noError(await admin.from('attendance').insert({
    booking_session_id: moveAttendance.sessions[0], student_id: learnerId, student_type: 'adult', coach_id: coachB, status: 'present',
  }), 'insert move-blocking attendance')
  await expectConflict(() => rpc(moveAttendance, {
    operation: 'move_learner_to_existing_coach_group',
    sessions: moveAttendance.sessions.slice(0, 1),
    targetGroupId: moveAttendanceTarget.groupId,
  }), 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT', 'Move with existing exact Attendance fails closed', moveAttendance)
  assert.ok(moveAttendanceSource.groupId)

  const overlapDate = dateDaysAgo(20)
  const overlapExisting = await createRound({ date: overlapDate, startTime: '13:00:00', endTime: '15:00:00' })
  await createGroup(overlapExisting, { coachId: coachC })
  const overlapTarget = await createRound({ date: overlapDate, startTime: '14:00:00', endTime: '16:00:00' })
  await expectConflict(() => rpc(overlapTarget, { coachId: coachC }), 'ADMIN_RETRO_ASSIGNMENT_COACH_CONFLICT', 'coach time overlap fails closed', overlapTarget)

  const stale = await createRound({ sessionCount: 2 })
  const staleGroup = await createGroup(stale)
  noError(await admin.from('coach_assignment_group_students').delete().eq('booking_session_id', stale.sessions[1]), 'simulate stale roster')
  await expectConflict(() => rpc(stale), 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT', 'stale roster between read and mutation fails closed', stale)
  assert.ok(staleGroup.groupId)

  const identicalRace = await createRound({ sessionCount: 2 })
  const identicalResults = await Promise.all([rpc(identicalRace), rpc(identicalRace)])
  assert.equal(identicalResults.filter((result) => !result.error).length, 2)
  assert.deepEqual(identicalResults.map((result) => result.data.changed).sort(), [false, true])
  const identicalAfter = await fingerprint(identicalRace)
  assert.equal(identicalAfter.groups.length, 1)
  assert.equal(identicalAfter.memberships.length, 2)
  assert.equal(identicalAfter.activity.length, 1)
  check('two simultaneous identical requests serialize to one change and one replay')

  const coachRace = await createRound({ sessionCount: 2 })
  const coachRaceResults = await Promise.all([rpc(coachRace, { coachId: coachA }), rpc(coachRace, { coachId: coachB })])
  assert.equal(coachRaceResults.filter((result) => !result.error).length, 1)
  assert.equal(coachRaceResults.filter((result) => result.error).length, 1)
  assert.match(coachRaceResults.find((result) => result.error).error.message, /ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT/)
  const coachRaceAfter = await fingerprint(coachRace)
  assert.equal(coachRaceAfter.groups.length, 1)
  assert.equal(coachRaceAfter.memberships.length, 2)
  assert.equal(coachRaceAfter.activity.length, 1)
  check('simultaneous conflicting coaches produce one winner, one typed conflict, and no residue')

  for (const failStage of ['after_group_write', 'after_membership_write', 'after_legacy_write', 'after_reservation_sync', 'after_activity_write']) {
    const failureRound = await createRound({ sessionCount: 2 })
    await expectConflict(() => rpc(failureRound, { failStage }), 'ADMIN_RETRO_ASSIGNMENT_TEST_FAILURE', `failure injection ${failStage} rolls back every core write`, failureRound)
  }
  for (const failStage of ['after_attendance_write', 'after_session_status_write']) {
    const failureRound = await createRound()
    await expectConflict(() => rpc(failureRound, {
      operation: 'mark_attendance',
      attendance: { [failureRound.sessions[0]]: 'present' },
      failStage,
    }), 'ADMIN_RETRO_ASSIGNMENT_TEST_FAILURE', `failure injection ${failStage} rolls back assignment, Attendance, status, and activity`, failureRound)
  }

  const protectedAfterAll = await globalProtectedFingerprint()
  assert.deepEqual(protectedAfterAll, protectedBaseline)
  check('assignment transitions create no notification, payment, coupon, allocation, wallet, finance, check-in, or payroll evidence')

  const allGroups = await rows('coach_assignment_groups', (q) => q.in('schedule_slot_id', slotIds).order('id'))
  const allMembers = allGroups.length
    ? await rows('coach_assignment_group_students', (q) => q.in('group_id', allGroups.map((row) => row.id)).order('id'))
    : []
  const membershipCounts = new Map()
  const populatedGroupIds = new Set()
  for (const member of allMembers) {
    membershipCounts.set(member.booking_session_id, (membershipCounts.get(member.booking_session_id) || 0) + 1)
    populatedGroupIds.add(member.group_id)
  }
  assert.equal(Array.from(membershipCounts.values()).some((count) => count > 1), false)
  assert.equal(allGroups.some((group) => !populatedGroupIds.has(group.id)), false)
  check('final fixtures contain zero duplicate memberships and zero unintended empty groups')
} finally {
  await cleanup()
}

console.log(`Admin retrospective assignment integrity checks passed (${passed})`)
