import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { register } from 'node:module'

register(new URL('./ts-alias-loader.mjs', import.meta.url).href, import.meta.url)

import {
  getAssignmentGroupsSignature,
  parseCanonicalAssignmentGroups,
  reconcileAssignmentDraft,
} from '../src/lib/coach-assignment-lifecycle.ts'
import {
  getGenuineLegacyOnlySlotIds,
  resolveCoachSlotAccess,
} from '../src/lib/coach-assignment-resolution.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
let passed = 0

async function check(name, action) {
  await action()
  passed += 1
  console.log(`PASS ${passed}: ${name}`)
}

const assignmentPage = read('src/app/(coach)/coach/assign-groups/page.tsx')
const assignmentClient = read('src/components/coach/assign-groups-client.tsx')
const assignmentRoute = read('src/app/api/coach/assignment-groups/route.ts')
const rescheduleRoute = read('src/app/api/reschedule/route.ts')
const walletRoute = read('src/app/api/lesson-wallet/route.ts')
const teachingHours = read('src/lib/coach-teaching-hours.ts')
const migration = read('supabase/migrations/20260804000000_assignment_group_lifecycle_integrity.sql')
const v1Migration = read('supabase/migrations/20260717070225_coach_assignment_conflict_guards.sql')

await check('assignment roster retains absent learners', () => {
  assert.match(
    assignmentPage,
    /\.in\('status', \['scheduled', 'completed', 'absent'\]\)/,
  )
})

const canonicalGroup = (id, sessionIds, overrides = {}) => ({
  id,
  name: 'กลุ่มเดิม',
  coachId: 'coach-a',
  levelMin: 1,
  levelMax: 5,
  sortOrder: 0,
  studentSessionIds: sessionIds,
  ...overrides,
})

await check('canonical comparison ignores group row identity and member order', () => {
  const before = [canonicalGroup('group-before', ['session-b', 'session-a'])]
  const after = [canonicalGroup('group-after', ['session-a', 'session-b'])]
  assert.equal(getAssignmentGroupsSignature(before), getAssignmentGroupsSignature(after))
})

await check('absent and all-absent rosters remain Saved when exact membership is unchanged', () => {
  const persisted = [canonicalGroup('group-a', ['absent-session'])]
  const draft = [canonicalGroup('local-draft', ['absent-session'])]
  assert.equal(getAssignmentGroupsSignature(persisted), getAssignmentGroupsSignature(draft))
})

await check('untouched draft follows a server lifecycle change', () => {
  const previous = [canonicalGroup('group-a', ['session-a', 'session-b'])]
  const next = [canonicalGroup('group-a', ['session-a'])]
  const result = reconcileAssignmentDraft({
    currentDraft: previous,
    previousServerDerivedDraft: previous,
    nextServerDerivedDraft: next,
    previousPersistedGroups: previous,
    nextPersistedGroups: next,
  })
  assert.deepEqual(result.draft, next)
  assert.equal(result.needsRefreshReview, false)
})

await check('edited draft survives a server lifecycle change and requires review', () => {
  const previous = [canonicalGroup('group-a', ['session-a', 'session-b'])]
  const edited = [canonicalGroup('group-a', ['session-a', 'session-b'], { name: 'ชื่อที่กำลังแก้' })]
  const next = [canonicalGroup('group-a', ['session-a'])]
  const result = reconcileAssignmentDraft({
    currentDraft: edited,
    previousServerDerivedDraft: previous,
    nextServerDerivedDraft: next,
    previousPersistedGroups: previous,
    nextPersistedGroups: next,
  })
  assert.deepEqual(result.draft, edited)
  assert.equal(result.needsRefreshReview, true)
})

await check('client uses canonical persisted response as the post-Save baseline', () => {
  assert.match(assignmentClient, /parseCanonicalAssignmentGroups\(json\?\.canonicalGroups\)/)
  assert.match(assignmentClient, /draftBaselinesBySlotRef\.current[\s\S]*canonicalDrafts/)
  assert.match(assignmentClient, /รายชื่อรอบเรียนบน Server เปลี่ยนระหว่างที่กำลังแก้ฉบับร่าง/)
})

await check('v2 Save and both retirement call sites are wired while v1 remains intact', () => {
  assert.match(assignmentRoute, /rpc\('save_coach_assignment_groups_v2'/)
  assert.match(rescheduleRoute, /rpc\('retire_coach_assignment_membership_v1'[\s\S]*p_reason: 'reschedule_out'/)
  assert.match(walletRoute, /rpc\('retire_coach_assignment_membership_v1'[\s\S]*p_reason: 'wallet_store'/)
  assert.match(v1Migration, /create or replace function public\.save_coach_assignment_groups_v1/)
})

await check('destination Reschedule-in and Wallet redemption remain unassigned', () => {
  const rescheduleDestination = rescheduleRoute.slice(rescheduleRoute.indexOf("status: 'scheduled'"))
  const walletDestination = walletRoute.slice(walletRoute.indexOf('async function redeemWalletCredit'))
  for (const source of [rescheduleDestination, walletDestination]) {
    assert.doesNotMatch(source, /coach_assignment_group_students[\s\S]*\.insert\(/)
    assert.doesNotMatch(source, /create_exact_coach_assignment_group_v1/)
  }
})

await check('empty exact boundary suppresses Legacy while a genuine zero-exact slot retains compatibility', () => {
  const emptyGroup = canonicalGroup('empty-group', [])
  assert.deepEqual(getGenuineLegacyOnlySlotIds(['slot-empty'], [{
    schedule_slot_id: 'slot-empty',
    coach_id: 'coach-a',
    coach_assignment_group_students: [],
  }]), [])
  assert.deepEqual(getGenuineLegacyOnlySlotIds(['slot-legacy'], []), ['slot-legacy'])
  assert.deepEqual(resolveCoachSlotAccess({
    exactGroups: [emptyGroup],
    coachId: 'coach-a',
    hasLegacyAssignment: true,
    legacyEligibleLearnerCount: 1,
  }), { allowed: false, source: 'exact' })
})

await check('Payroll suppresses only truly empty raw exact aggregates', () => {
  assert.match(teachingHours, /const rawSessionIds =[\s\S]*if \(rawSessionIds\.length === 0\) return[\s\S]*if \(sessionIds\.length === 0 && !options\.includeExcluded\) return/)
})

await check('migration is additive, service-role-only, audit-complete, and contains no apply-time mutation block', () => {
  for (const required of [
    'coach_assignment_slot_snapshot_v2',
    'save_coach_assignment_groups_v2',
    'retire_coach_assignment_membership_v1',
    "session_item.status in ('scheduled', 'completed', 'absent')",
    'COACH_ASSIGNMENT_ROSTER_CONFLICT|submitted_session_ineligible',
    'COACH_ASSIGNMENT_ROSTER_CONFLICT|missing_current_eligible_session',
    'COACH_ASSIGNMENT_DUPLICATE_MEMBERSHIP|duplicate_submitted_session',
    'COACH_ASSIGNMENT_RETIREMENT_CONFLICT|session_or_slot_changed',
    "p_reason not in ('reschedule_out', 'wallet_store')",
    "'before', before_snapshot",
    "'after', after_snapshot",
  ]) assert.equal(migration.includes(required), true, `migration missing ${required}`)
  assert.doesNotMatch(migration, /\bdo\s+\$\$/iu)
  assert.doesNotMatch(migration, /errcode\s*=\s*'40001'/iu)
  assert.doesNotMatch(migration, /drop\s+function\s+public\.save_coach_assignment_groups_v1/iu)
  assert.match(migration, /select schedule_slot_id into target_slot_id[\s\S]*from public\.schedule_slots[\s\S]*for update;[\s\S]*select \* into session_row[\s\S]*for update;/u)
  for (const signature of [
    'public.save_coach_assignment_groups_v2(uuid, uuid, jsonb)',
    'public.retire_coach_assignment_membership_v1(uuid, uuid, text)',
  ]) {
    assert.equal(migration.includes(`revoke all on function ${signature} from public, anon, authenticated`), true)
    assert.equal(migration.includes(`grant execute on function ${signature} to service_role`), true)
  }
})

await check('canonical database snapshot parser keeps IDs needed for audit reconstruction', () => {
  assert.deepEqual(parseCanonicalAssignmentGroups([{
    id: 'group-db',
    name: 'กลุ่มฐานข้อมูล',
    coach_id: 'coach-db',
    level_min: 4,
    level_max: 9,
    sort_order: 2,
    student_session_ids: ['session-db'],
  }]), [{
    id: 'group-db',
    name: 'กลุ่มฐานข้อมูล',
    coachId: 'coach-db',
    levelMin: 4,
    levelMax: 9,
    sortOrder: 2,
    studentSessionIds: ['session-db'],
  }])
})

function localEnvironment() {
  const output = execSync('npx.cmd --yes supabase@2.111.0 status -o env', {
    cwd: root,
    encoding: 'utf8',
  })
  const values = new Map()
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)="?(.*?)"?$/)
    if (match) values.set(match[1], match[2])
  }
  const apiUrl = values.get('API_URL')
  const dbUrl = values.get('DB_URL')
  const serviceRoleKey = values.get('SERVICE_ROLE_KEY')
  assert.match(apiUrl || '', /^http:\/\/(127\.0\.0\.1|localhost):54321$/)
  assert.match(dbUrl || '', /^postgresql:\/\/postgres:postgres@(127\.0\.0\.1|localhost):54322\/postgres$/)
  assert.ok(serviceRoleKey)
  assert.equal(read('supabase/config.toml').includes('project_id = "New-Athlete-Badminton-School"'), true)
  return { apiUrl, serviceRoleKey }
}

const local = localEnvironment()
await check('isolated Supabase identity is loopback-only and matches the target project ports', () => {})

const admin = createClient(local.apiUrl, local.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const prefix = `assignment-lifecycle-${Date.now()}`
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
const auditIds = []

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

async function addSlot({
  date = '2099-08-20',
  startTime = '10:00:00',
  endTime = '12:00:00',
  statuses = ['scheduled'],
  branchId = ids.branchA,
} = {}) {
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
    current_students: statuses.length,
    status: 'open',
  }), 'insert slot')
  const sessions = statuses.map((status) => ({ id: randomUUID(), status }))
  sessionIds.push(...sessions.map((session) => session.id))
  noError(await admin.from('booking_sessions').insert(sessions.map((session) => ({
    id: session.id,
    booking_id: ids.booking,
    schedule_slot_id: slotId,
    date,
    start_time: startTime,
    end_time: endTime,
    branch_id: branchId,
    child_id: null,
    status: session.status,
  }))), 'insert sessions')
  return { slotId, sessions }
}

function groupPayload(sessionIdsForGroup, overrides = {}) {
  return {
    name: 'กลุ่ม Lifecycle',
    coachId,
    levelMin: 1,
    levelMax: 5,
    sortOrder: 0,
    studentSessionIds: sessionIdsForGroup,
    ...overrides,
  }
}

async function saveV2(slotId, groups, actorId = coachId) {
  return admin.rpc('save_coach_assignment_groups_v2', {
    p_schedule_slot_id: slotId,
    p_actor_id: actorId,
    p_groups: groups,
  })
}

async function retire(sessionId, reason, actorId = learnerId) {
  return admin.rpc('retire_coach_assignment_membership_v1', {
    p_booking_session_id: sessionId,
    p_actor_id: actorId,
    p_reason: reason,
  })
}

async function expectConflict(resultPromise, pattern, label) {
  const result = await resultPromise
  assert.ok(result.error, `${label}: expected conflict`)
  assert.match(result.error.message, pattern)
}

async function snapshot(slotId) {
  return noError(await admin.rpc('coach_assignment_slot_snapshot_v2', {
    p_schedule_slot_id: slotId,
  }), 'load lifecycle snapshot')
}

async function cleanup() {
  if (auditIds.length) await admin.from('activity_logs').delete().in('id', auditIds)
  if (coachId || learnerId) {
    await admin.from('activity_logs').delete().in('user_id', [coachId, learnerId].filter(Boolean))
  }
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
    description: prefix,
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
    month: 8,
    year: 2099,
    total_sessions: 20,
    total_price: 0,
    status: 'verified',
  }), 'insert booking')

  const absent = await addSlot({ statuses: ['absent', 'absent'] })
  const absentSave = noError(await saveV2(
    absent.slotId,
    [groupPayload(absent.sessions.map((session) => session.id))],
  ), 'save all-absent roster')
  auditIds.push(absentSave.audit.id)
  await check('all-absent group saves as exact canonical evidence', () => {
    assert.deepEqual(absentSave.eligible_session_ids, absent.sessions.map((session) => session.id).sort())
    assert.deepEqual(absentSave.snapshot.membership_session_ids, absent.sessions.map((session) => session.id).sort())
  })

  const absentAudit = noError(await admin.from('activity_logs')
    .select('id, user_id, action, entity_id, details, created_at')
    .eq('id', absentSave.audit.id)
    .single(), 'read atomic save audit')
  await check('atomic Save audit reconstructs before/after groups, coaches, memberships, actor, slot and timestamp', () => {
    assert.equal(absentAudit.user_id, coachId)
    assert.equal(absentAudit.entity_id, absent.slotId)
    assert.equal(absentAudit.action, 'save_coach_assignment_groups_v2')
    assert.ok(absentAudit.created_at)
    assert.deepEqual(absentAudit.details.before.group_ids, [])
    assert.equal(absentAudit.details.after.group_ids.length, 1)
    assert.deepEqual(absentAudit.details.after.coach_ids, [coachId])
    assert.deepEqual(absentAudit.details.after.membership_session_ids, absent.sessions.map((session) => session.id).sort())
  })

  const beforeFailedSave = await snapshot(absent.slotId)
  await expectConflict(
    saveV2(absent.slotId, [groupPayload(absent.sessions.map((session) => session.id), { name: 'ต้อง rollback' })], null),
    /null value in column "user_id"|not-null constraint/iu,
    'save audit failure',
  )
  await check('Save mutation rolls back atomically when its audit insert fails', async () => {
    assert.deepEqual(await snapshot(absent.slotId), beforeFailedSave)
  })

  const missing = await addSlot({
    statuses: ['scheduled', 'completed'],
    startTime: '12:00:00',
    endTime: '14:00:00',
  })
  await expectConflict(
    saveV2(missing.slotId, [groupPayload([missing.sessions[0].id])]),
    /COACH_ASSIGNMENT_ROSTER_CONFLICT\|missing_current_eligible_session/,
    'missing eligible learner',
  )
  await check('missing current eligible learner returns a typed roster conflict', () => {})

  await expectConflict(
    saveV2(missing.slotId, [
      groupPayload([missing.sessions[0].id], { name: 'ซ้ำ A', coachId: null, sortOrder: 0 }),
      groupPayload([missing.sessions[0].id, missing.sessions[1].id], { name: 'ซ้ำ B', coachId, sortOrder: 1 }),
    ]),
    /COACH_ASSIGNMENT_DUPLICATE_MEMBERSHIP\|duplicate_submitted_session/,
    'duplicate submitted learner',
  )
  await check('duplicate submitted learner is rejected before mutation', () => {})

  const reschedule = await addSlot({ statuses: ['scheduled'], startTime: '13:00:00', endTime: '15:00:00' })
  const rescheduleSave = noError(await saveV2(reschedule.slotId, [groupPayload([reschedule.sessions[0].id])]), 'seed reschedule ordering')
  auditIds.push(rescheduleSave.audit.id)
  noError(await admin.from('booking_sessions').update({ status: 'rescheduled' }).eq('id', reschedule.sessions[0].id), 'mark rescheduled')
  const rescheduleRetirement = noError(await retire(reschedule.sessions[0].id, 'reschedule_out'), 'retire rescheduled membership')
  auditIds.push(rescheduleRetirement.audit.id)
  await check('Save-wins ordering then Reschedule retirement preserves the empty parent and removes only membership', async () => {
    const current = await snapshot(reschedule.slotId)
    assert.equal(rescheduleRetirement.removed_count, 1)
    assert.equal(current.groups.length, 1)
    assert.deepEqual(current.groups[0].student_session_ids, [])
    assert.deepEqual(current.membership_session_ids, [])
  })
  await expectConflict(
    saveV2(reschedule.slotId, [groupPayload([reschedule.sessions[0].id])]),
    /COACH_ASSIGNMENT_ROSTER_CONFLICT\|submitted_session_ineligible/,
    'stale rescheduled session save',
  )
  await check('Reschedule-wins ordering makes a stale Save fail closed', () => {})

  const retirementAudit = noError(await admin.from('activity_logs')
    .select('id, user_id, entity_id, details, created_at')
    .eq('id', rescheduleRetirement.audit.id)
    .single(), 'read retirement audit')
  await check('retirement audit captures reconstructable reason and before/after exact IDs without PII', () => {
    assert.equal(retirementAudit.user_id, learnerId)
    assert.equal(retirementAudit.entity_id, reschedule.slotId)
    assert.equal(retirementAudit.details.reason, 'reschedule_out')
    assert.equal(retirementAudit.details.before.group_ids.length, 1)
    assert.equal(retirementAudit.details.before.membership_session_ids.length, 1)
    assert.equal(retirementAudit.details.after.group_ids.length, 1)
    assert.deepEqual(retirementAudit.details.after.membership_session_ids, [])
    assert.equal(JSON.stringify(retirementAudit.details).includes(prefix), false)
  })

  const walletRollback = await addSlot({ statuses: ['scheduled'], startTime: '15:00:00', endTime: '17:00:00' })
  const walletRollbackSave = noError(await saveV2(walletRollback.slotId, [groupPayload([walletRollback.sessions[0].id])]), 'seed wallet rollback')
  auditIds.push(walletRollbackSave.audit.id)
  noError(await admin.from('booking_sessions').update({ status: 'walleted' }).eq('id', walletRollback.sessions[0].id), 'mark walleted for rollback')
  await expectConflict(
    retire(walletRollback.sessions[0].id, 'wallet_store', null),
    /null value in column "user_id"|not-null constraint/iu,
    'retirement audit failure',
  )
  await check('membership retirement rolls back atomically when its audit insert fails', async () => {
    const current = await snapshot(walletRollback.slotId)
    assert.deepEqual(current.membership_session_ids, [walletRollback.sessions[0].id])
  })
  const walletRetirement = noError(await retire(walletRollback.sessions[0].id, 'wallet_store'), 'retire wallet membership')
  auditIds.push(walletRetirement.audit.id)
  await check('Wallet-store retirement preserves empty parent and returns exact context', async () => {
    const current = await snapshot(walletRollback.slotId)
    assert.equal(walletRetirement.reason, 'wallet_store')
    assert.equal(walletRetirement.removed_count, 1)
    assert.equal(current.groups.length, 1)
    assert.deepEqual(current.groups[0].student_session_ids, [])
  })
  await expectConflict(
    saveV2(walletRollback.slotId, [groupPayload([walletRollback.sessions[0].id])]),
    /COACH_ASSIGNMENT_ROSTER_CONFLICT\|submitted_session_ineligible/,
    'stale walleted session save',
  )
  await check('Wallet-wins ordering makes a stale Save fail closed', () => {})

  const overlapA = await addSlot({ date: '2099-08-21', startTime: '10:00:00', endTime: '12:00:00', branchId: ids.branchA })
  const overlapB = await addSlot({ date: '2099-08-21', startTime: '11:00:00', endTime: '13:00:00', branchId: ids.branchB })
  const overlapSave = noError(await saveV2(overlapA.slotId, [groupPayload([overlapA.sessions[0].id])]), 'seed exact conflict')
  auditIds.push(overlapSave.audit.id)
  await expectConflict(
    saveV2(overlapB.slotId, [groupPayload([overlapB.sessions[0].id])]),
    /COACH_ASSIGNMENT_CONFLICT/,
    'existing exact reservation conflict',
  )
  await check('existing exact coach conflict reservation behavior remains enforced by v2', () => {})
} finally {
  await cleanup()
}

await check('fixture cleanup leaves no lifecycle residue', async () => {
  const [branches, courses, bookings, sessions, slots, activities] = await Promise.all([
    admin.from('branches').select('id', { count: 'exact', head: true }).ilike('name', `${prefix}%`),
    admin.from('course_types').select('id', { count: 'exact', head: true }).eq('description', prefix),
    admin.from('bookings').select('id', { count: 'exact', head: true }).eq('id', ids.booking),
    admin.from('booking_sessions').select('id', { count: 'exact', head: true }).in('id', sessionIds),
    admin.from('schedule_slots').select('id', { count: 'exact', head: true }).in('id', slotIds),
    admin.from('activity_logs').select('id', { count: 'exact', head: true }).in('id', auditIds),
  ])
  for (const result of [branches, courses, bookings, sessions, slots, activities]) {
    noError(result, 'verify fixture cleanup')
    assert.equal(result.count, 0)
  }
})

console.log(`\nCoach assignment lifecycle checks passed: ${passed}`)
