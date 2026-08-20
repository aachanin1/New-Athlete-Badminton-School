import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

function getBangkokCalendarDate(now) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function addCalendarDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

const bangkokToday = getBangkokCalendarDate(new Date())
const fixtureBaseDate = addCalendarDays(bangkokToday, 30)
const fixtureDates = {
  crossBranch: addCalendarDays(fixtureBaseDate, 0),
  sameBranchOverlap: addCalendarDays(fixtureBaseDate, 1),
  duplicateGroup: addCalendarDays(fixtureBaseDate, 2),
  partialOverlap: addCalendarDays(fixtureBaseDate, 3),
  adjacent: addCalendarDays(fixtureBaseDate, 4),
  differentDayA: addCalendarDays(fixtureBaseDate, 5),
  differentDayB: addCalendarDays(fixtureBaseDate, 6),
  edit: addCalendarDays(fixtureBaseDate, 7),
  legacyOverlap: addCalendarDays(fixtureBaseDate, 8),
  race: addCalendarDays(fixtureBaseDate, 9),
  adminRace: addCalendarDays(fixtureBaseDate, 10),
  invalidName: addCalendarDays(fixtureBaseDate, 11),
  lifecycle: addCalendarDays(fixtureBaseDate, 12),
}
const [fixtureYear, fixtureMonth] = fixtureBaseDate.split('-').map(Number)

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
    throw new Error('Conflict tests refuse to run unless Supabase is local.')
  }
  return { apiUrl, serviceRoleKey }
}

const env = localEnvironment()
const admin = createClient(env.apiUrl, env.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const prefix = `coach-conflict-${Date.now()}`
const password = 'LocalOnly!2026'
const ids = {
  branchA: randomUUID(),
  branchB: randomUUID(),
  course: randomUUID(),
  booking: randomUUID(),
}
let coachId = null
let learnerId = null
const slotIds = []
const sessionIds = []
let passed = 0

function check(name) {
  passed += 1
  console.log(`PASS ${passed}: ${name}`)
}

const preflightSql = read('scripts/preflight-coach-assignment-conflicts.sql')
const preflightStatements = preflightSql.replace(/^\s*--.*$/gmu, '')
assert.doesNotMatch(preflightStatements, /\b(insert|update|delete|create|alter|drop|truncate|grant|revoke|call|do)\b/iu)
assert.match(preflightStatements, /^\s*with\b/iu)
assert.match(preflightStatements, /blocking_current_or_future_conflict_count/u)
assert.match(preflightStatements, /historical_report_only_conflict_count/u)
check('standalone Production preflight is one read-only SELECT and exists before migration apply')

const migrationSql = read('supabase/migrations/20260717070225_coach_assignment_conflict_guards.sql')
for (const required of [
  'backfill_coach_assignment_exact_reservations_v1',
  'enforce_coach_assignment_slot_reservations_v1',
  'enforce_coach_assignment_session_reservations_v1',
  'enforce_coach_assignment_booking_reservations_v1',
  'coach_assignment_exact_group_name_check',
  "first_slot.date >= (now() at time zone 'Asia/Bangkok')::date",
]) assert.equal(migrationSql.includes(required), true, `migration missing ${required}`)
check('migration contains existing-group backfill, lifecycle sync and current/future safety gate')

assert.ok(
  Object.values(fixtureDates).every((date) => date >= bangkokToday),
  `all conflict fixture dates must be Bangkok current/future (today ${bangkokToday})`,
)
console.log(`Bangkok conflict fixture window: ${fixtureDates.crossBranch}..${fixtureDates.lifecycle}`)
check('dynamic conflict fixture dates are Bangkok current/future before writes')

function noError(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}

async function createUser(email, role) {
  const result = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: prefix },
  })
  noError(result, `create ${role}`)
  const id = result.data.user.id
  noError(await admin.from('profiles').update({ role, full_name: prefix }).eq('id', id), `update ${role}`)
  return id
}

async function addSlot(date, startTime, endTime, branchId = ids.branchA, sessionCount = 1) {
  const slotId = randomUUID()
  slotIds.push(slotId)
  noError(await admin.from('schedule_slots').insert({
    id: slotId,
    template_id: null,
    branch_id: branchId,
    course_type_id: ids.course,
    date,
    start_time: startTime,
    end_time: endTime,
    max_students: 6,
    current_students: sessionCount,
    status: 'open',
  }), 'insert slot')

  const createdSessions = Array.from({ length: sessionCount }, () => randomUUID())
  sessionIds.push(...createdSessions)
  noError(await admin.from('booking_sessions').insert(createdSessions.map((id) => ({
    id,
    booking_id: ids.booking,
    schedule_slot_id: slotId,
    date,
    start_time: startTime,
    end_time: endTime,
    branch_id: branchId,
    child_id: null,
    status: 'scheduled',
  }))), 'insert sessions')
  return { slotId, sessions: createdSessions }
}

async function save(slotId, sessions, name = 'Exact local group') {
  return admin.rpc('save_coach_assignment_groups_v1', {
    p_schedule_slot_id: slotId,
    p_actor_id: coachId,
    p_groups: [{
      name,
      coachId,
      levelMin: null,
      levelMax: null,
      sortOrder: 0,
      studentSessionIds: sessions,
    }],
  })
}

async function expectConflict(resultPromise, name) {
  const result = await resultPromise
  assert.ok(result.error, `${name}: expected a rejected write`)
  assert.match(result.error.message, /COACH_ASSIGNMENT_CONFLICT|รับผิดชอบหลายกลุ่ม/)
  check(name)
}

async function cleanup() {
  if (slotIds.length) {
    await admin.from('coach_assignment_groups').delete().in('schedule_slot_id', slotIds)
    await admin.from('coach_assignments').delete().in('schedule_slot_id', slotIds)
  }
  if (sessionIds.length) await admin.from('booking_sessions').delete().in('id', sessionIds)
  if (slotIds.length) await admin.from('schedule_slots').delete().in('id', slotIds)
  await admin.from('bookings').delete().eq('id', ids.booking)
  if (coachId) await admin.from('coach_branches').delete().eq('coach_id', coachId)
  await admin.from('course_types').delete().eq('id', ids.course)
  await admin.from('branches').delete().in('id', [ids.branchA, ids.branchB])
  if (coachId) await admin.auth.admin.deleteUser(coachId)
  if (learnerId) await admin.auth.admin.deleteUser(learnerId)
}

try {
  coachId = await createUser(`${prefix}-coach@example.com`, 'coach')
  learnerId = await createUser(`${prefix}-learner@example.com`, 'user')
  noError(await admin.from('branches').insert([
    { id: ids.branchA, name: `${prefix} A`, slug: `${prefix}-a`, address: 'local', is_active: true },
    { id: ids.branchB, name: `${prefix} B`, slug: `${prefix}-b`, address: 'local', is_active: true },
  ]), 'insert branches')
  noError(await admin.from('course_types').insert({
    id: ids.course,
    name: 'kids_group',
    description: 'local conflict test',
    max_students: 6,
    duration_hours: 2,
  }), 'insert course')
  noError(await admin.from('coach_branches').insert([
    { coach_id: coachId, branch_id: ids.branchA },
    { coach_id: coachId, branch_id: ids.branchB },
  ]), 'insert coach branches')
  noError(await admin.from('bookings').insert({
    id: ids.booking,
    user_id: learnerId,
    learner_type: 'self',
    child_id: null,
    branch_id: ids.branchA,
    course_type_id: ids.course,
    month: fixtureMonth,
    year: fixtureYear,
    total_sessions: 20,
    total_price: 0,
    status: 'verified',
  }), 'insert booking')

  const crossA = await addSlot(fixtureDates.crossBranch, '17:00', '19:00', ids.branchA)
  const crossB = await addSlot(fixtureDates.crossBranch, '17:00', '19:00', ids.branchB)
  noError(await save(crossA.slotId, crossA.sessions), 'seed cross-branch exact')
  await expectConflict(save(crossB.slotId, crossB.sessions), 'different branches at the same time are rejected')

  const crossGroup = noError(
    await admin.from('coach_assignment_groups').select('id').eq('schedule_slot_id', crossA.slotId).single(),
    'read existing exact group for backfill',
  )
  noError(await admin.from('coach_assignment_exact_reservations').delete().eq('group_id', crossGroup.id), 'simulate pre-migration missing reservation')
  const backfilledCount = noError(await admin.rpc('backfill_coach_assignment_exact_reservations_v1'), 'backfill existing exact groups')
  assert.ok(backfilledCount >= 1)
  const backfilledReservation = noError(
    await admin.from('coach_assignment_exact_reservations').select('group_id').eq('group_id', crossGroup.id).maybeSingle(),
    'read backfilled reservation',
  )
  assert.equal(backfilledReservation?.group_id, crossGroup.id)
  check('existing exact groups are inserted into reservation protection')

  const sameA = await addSlot(fixtureDates.sameBranchOverlap, '17:00', '19:00')
  const sameB = await addSlot(fixtureDates.sameBranchOverlap, '18:00', '20:00')
  noError(await save(sameA.slotId, sameA.sessions), 'seed same-branch exact')
  await expectConflict(save(sameB.slotId, sameB.sessions), 'same branch overlap is rejected')

  const duplicate = await addSlot(fixtureDates.duplicateGroup, '17:00', '19:00', ids.branchA, 2)
  await expectConflict(admin.rpc('save_coach_assignment_groups_v1', {
    p_schedule_slot_id: duplicate.slotId,
    p_actor_id: coachId,
    p_groups: duplicate.sessions.map((sessionId, index) => ({
      name: `Duplicate ${index + 1}`,
      coachId,
      sortOrder: index,
      studentSessionIds: [sessionId],
    })),
  }), 'one coach owning multiple groups in one slot is rejected')

  const partialA = await addSlot(fixtureDates.partialOverlap, '17:00', '19:00')
  const partialB = await addSlot(fixtureDates.partialOverlap, '18:30', '20:00')
  noError(await save(partialA.slotId, partialA.sessions), 'seed partial overlap')
  await expectConflict(save(partialB.slotId, partialB.sessions), 'partial interval overlap is rejected')

  const adjacentA = await addSlot(fixtureDates.adjacent, '17:00', '19:00')
  const adjacentB = await addSlot(fixtureDates.adjacent, '19:00', '21:00')
  noError(await save(adjacentA.slotId, adjacentA.sessions), 'seed adjacent')
  noError(await save(adjacentB.slotId, adjacentB.sessions), 'adjacent write')
  check('an end time equal to the next start time is allowed')

  const dayA = await addSlot(fixtureDates.differentDayA, '17:00', '19:00')
  const dayB = await addSlot(fixtureDates.differentDayB, '17:00', '19:00')
  noError(await save(dayA.slotId, dayA.sessions), 'seed different day')
  noError(await save(dayB.slotId, dayB.sessions), 'different day write')
  check('same time on different dates is allowed')

  const edit = await addSlot(fixtureDates.edit, '17:00', '19:00')
  noError(await save(edit.slotId, edit.sessions), 'seed edit')
  const editGroup = noError(await admin.from('coach_assignment_groups').select('id').eq('schedule_slot_id', edit.slotId).single(), 'read edit group')
  noError(await admin.from('coach_assignment_groups').update({ name: 'Exact renamed group' }).eq('id', editGroup.id), 'edit same record')
  check('editing the same exact record without changing coach is allowed')

  noError(await admin.from('coach_assignment_groups').update({ coach_id: null }).eq('id', editGroup.id), 'unassign exact group')
  const unassignedReservation = noError(
    await admin.from('coach_assignment_exact_reservations').select('group_id').eq('group_id', editGroup.id).maybeSingle(),
    'read unassigned reservation',
  )
  assert.equal(unassignedReservation, null)
  check('unassigning a coach is allowed')

  noError(await admin.from('coach_assignment_groups').update({ coach_id: coachId }).eq('id', editGroup.id), 'reassign exact group')
  const reassignedReservation = noError(
    await admin.from('coach_assignment_exact_reservations').select('group_id').eq('group_id', editGroup.id).maybeSingle(),
    'read reassigned reservation',
  )
  assert.equal(reassignedReservation?.group_id, editGroup.id)
  check('changing the exact group coach resynchronizes its reservation')

  const legacySource = await addSlot(fixtureDates.legacyOverlap, '17:00', '19:00')
  const legacyTarget = await addSlot(fixtureDates.legacyOverlap, '17:30', '18:30', ids.branchB)
  noError(await admin.from('coach_assignments').insert({ coach_id: coachId, schedule_slot_id: legacySource.slotId, assigned_by: coachId }), 'insert legacy-only row')
  const warningResult = noError(await admin.rpc('get_coach_assignment_conflicts_v1', {
    p_coach_id: coachId,
    p_schedule_slot_id: legacyTarget.slotId,
    p_exclude_group_ids: [],
    p_replace_current_slot: false,
  }), 'read legacy warning')
  assert.equal(warningResult.exact_conflicts.length, 0)
  assert.equal(warningResult.legacy_warnings.length, 1)
  noError(await save(legacyTarget.slotId, legacyTarget.sessions), 'legacy-only write')
  check('legacy-only overlap warns but does not block')

  const raceA = await addSlot(fixtureDates.race, '17:00', '19:00')
  const raceB = await addSlot(fixtureDates.race, '17:00', '19:00', ids.branchB)
  const race = await Promise.all([save(raceA.slotId, raceA.sessions), save(raceB.slotId, raceB.sessions)])
  assert.equal(race.filter((result) => !result.error).length, 1)
  assert.equal(race.filter((result) => result.error).length, 1)
  check('concurrent exact writes allow exactly one winner')

  const adminRaceA = await addSlot(fixtureDates.adminRace, '17:00', '19:00')
  const adminRaceB = await addSlot(fixtureDates.adminRace, '17:00', '19:00', ids.branchB)
  const createArgs = (slot) => ({
    p_schedule_slot_id: slot.slotId,
    p_coach_id: coachId,
    p_name: 'Atomic Admin group',
    p_sort_order: 999,
    p_notes: 'local concurrency test',
    p_actor_id: coachId,
    p_booking_session_ids: slot.sessions,
  })
  const adminRace = await Promise.all([
    admin.rpc('create_exact_coach_assignment_group_v1', createArgs(adminRaceA)),
    admin.rpc('create_exact_coach_assignment_group_v1', createArgs(adminRaceB)),
  ])
  assert.equal(adminRace.filter((result) => !result.error).length, 1)
  assert.equal(adminRace.filter((result) => result.error).length, 1)
  const adminRaceGroups = await admin.from('coach_assignment_groups')
    .select('id')
    .in('schedule_slot_id', [adminRaceA.slotId, adminRaceB.slotId])
  noError(adminRaceGroups, 'read atomic Admin race groups')
  assert.equal(adminRaceGroups.data.length, 1)
  check('concurrent Admin-style group creation rolls back the losing command without an empty group')

  const invalidNameSlot = await addSlot(fixtureDates.invalidName, '17:00', '19:00')
  const invalidNameResult = await save(invalidNameSlot.slotId, invalidNameSlot.sessions, 'ยังไม่จัดกลุ่ม')
  assert.ok(invalidNameResult.error)
  assert.match(invalidNameResult.error.message, /coach_assignment_exact_group_name_check/)
  check('database rejects an exact coach group that keeps the placeholder name')

  const lifecycle = await addSlot(fixtureDates.lifecycle, '17:00', '19:00')
  noError(await save(lifecycle.slotId, lifecycle.sessions, 'Lifecycle exact group'), 'seed lifecycle group')
  const lifecycleGroup = noError(
    await admin.from('coach_assignment_groups').select('id').eq('schedule_slot_id', lifecycle.slotId).single(),
    'read lifecycle group',
  )
  const lifecycleMember = noError(
    await admin.from('coach_assignment_group_students')
      .select('id, booking_session_id, student_id, student_type')
      .eq('group_id', lifecycleGroup.id)
      .single(),
    'read lifecycle member',
  )
  const reservationBeforeSlotChange = noError(
    await admin.from('coach_assignment_exact_reservations')
      .select('teaching_time_range')
      .eq('group_id', lifecycleGroup.id)
      .single(),
    'read reservation before slot change',
  )
  noError(await admin.from('schedule_slots').update({ start_time: '16:00', end_time: '18:00' }).eq('id', lifecycle.slotId), 'update slot time')
  const reservationAfterSlotChange = noError(
    await admin.from('coach_assignment_exact_reservations')
      .select('teaching_time_range')
      .eq('group_id', lifecycleGroup.id)
      .single(),
    'read reservation after slot change',
  )
  assert.notEqual(reservationAfterSlotChange.teaching_time_range, reservationBeforeSlotChange.teaching_time_range)
  check('slot time changes resynchronize the protected interval')

  noError(await admin.from('coach_assignment_group_students').delete().eq('id', lifecycleMember.id), 'remove lifecycle member')
  const reservationAfterMemberDelete = noError(
    await admin.from('coach_assignment_exact_reservations').select('group_id').eq('group_id', lifecycleGroup.id).maybeSingle(),
    'read reservation after member delete',
  )
  assert.equal(reservationAfterMemberDelete, null)
  noError(await admin.from('coach_assignment_group_students').insert({
    group_id: lifecycleGroup.id,
    booking_session_id: lifecycleMember.booking_session_id,
    student_id: lifecycleMember.student_id,
    student_type: lifecycleMember.student_type,
  }), 'restore lifecycle member')
  check('member removal and restoration remove and restore the reservation')

  noError(await admin.from('booking_sessions').update({ status: 'walleted' }).eq('id', lifecycle.sessions[0]), 'deactivate lifecycle session')
  const reservationAfterSessionDeactivate = noError(
    await admin.from('coach_assignment_exact_reservations').select('group_id').eq('group_id', lifecycleGroup.id).maybeSingle(),
    'read reservation after session deactivate',
  )
  assert.equal(reservationAfterSessionDeactivate, null)
  noError(await admin.from('booking_sessions').update({ status: 'scheduled' }).eq('id', lifecycle.sessions[0]), 'reactivate lifecycle session')
  check('booking-session lifecycle changes resynchronize reservation activity')

  noError(await admin.from('bookings').update({ status: 'pending_payment' }).eq('id', ids.booking), 'deactivate booking')
  const reservationAfterBookingDeactivate = noError(
    await admin.from('coach_assignment_exact_reservations').select('group_id').eq('group_id', lifecycleGroup.id).maybeSingle(),
    'read reservation after booking deactivate',
  )
  assert.equal(reservationAfterBookingDeactivate, null)
  noError(await admin.from('bookings').update({ status: 'verified' }).eq('id', ids.booking), 'reactivate booking')
  const reservationAfterBookingReactivate = noError(
    await admin.from('coach_assignment_exact_reservations').select('group_id').eq('group_id', lifecycleGroup.id).maybeSingle(),
    'read reservation after booking reactivate',
  )
  assert.equal(reservationAfterBookingReactivate?.group_id, lifecycleGroup.id)
  check('booking lifecycle changes resynchronize all affected exact reservations')

  const preflight = noError(await admin.rpc('preflight_coach_assignment_conflicts_v1'), 'run local migration preflight')
  assert.equal(preflight.length, 0)
  check('local current/future migration preflight has zero blocking conflicts')

  console.log(`\nCoach assignment conflict checks passed: ${passed}`)
} finally {
  await cleanup()
  const slotResidue = await admin.from('schedule_slots').select('id', { count: 'exact', head: true }).in('id', slotIds)
  noError(slotResidue, 'count slot residue')
  assert.equal(slotResidue.count, 0)
  const reservationResidue = await admin.from('coach_assignment_exact_reservations').select('group_id', { count: 'exact', head: true })
  noError(reservationResidue, 'count reservation residue')
  assert.equal(reservationResidue.count, 0)
  console.log('Local conflict fixture residue: 0')
}
