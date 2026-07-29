import assert from 'node:assert/strict'
import { register } from 'node:module'

register(new URL('./ts-alias-loader.mjs', import.meta.url).href, import.meta.url)

import {
  CoachAssignmentDataUnavailableError,
  classifyCoachAssignmentSessionProvenance,
  getGenuineLegacyOnlySlotIds,
  getLegacyEligibleSessions,
  isPendingUserRescheduleIn,
  loadWalletRedeemedSessionIds,
  requireCoachAssignmentQueryData,
  resolveAssignedCoachIds,
  resolveCoachLearnerAccess,
  resolveCoachSlotAccess,
} from '../src/lib/coach-assignment-resolution.ts'
import {
  buildRescheduleSuccessResponse,
  deliverAdminAssignmentReviewNotifications,
  deliverCoachNotificationOnce,
  deliverHeadCoachAssignmentReviewNotifications,
  summarizeAssignmentReviewNotifications,
} from '../src/lib/coach-notification-delivery.ts'

const { loadCoachStudentHistoryExactMembershipRows } = await import(
  '../src/lib/coach-student-memory.ts'
)

let passed = 0
async function check(name, action) {
  await action()
  passed += 1
  console.log(`PASS ${passed}: ${name}`)
}

const group = (coachId, sessionIds, slotId = 'slot-1') => ({
  schedule_slot_id: slotId,
  coach_id: coachId,
  coach_assignment_group_students: sessionIds.map((booking_session_id) => ({ booking_session_id })),
})

const normalSession = {
  id: 'normal-session',
  rescheduled_from_id: null,
  is_makeup: false,
}
const userRescheduleSession = {
  id: 'user-reschedule-session',
  rescheduled_from_id: 'original-session',
  is_makeup: false,
}
const walletSession = {
  id: 'wallet-session',
  rescheduled_from_id: 'wallet-original',
  is_makeup: false,
}
const makeupSession = {
  id: 'makeup-session',
  rescheduled_from_id: 'makeup-original',
  is_makeup: true,
}
const walletIds = new Set([walletSession.id])

function thenableResult(result, thrownError = null) {
  const chain = {
    eq: () => chain,
    in: () => chain,
    is: () => chain,
    limit: () => chain,
    then: (resolve, reject) => (
      thrownError
        ? Promise.reject(thrownError).then(resolve, reject)
        : Promise.resolve(result).then(resolve, reject)
    ),
  }
  return chain
}

function createExactMembershipSupabase({ failedBatch = null } = {}) {
  const queries = []
  return {
    queries,
    from(table) {
      assert.equal(table, 'coach_assignment_group_students')
      return {
        select(columns) {
          assert.match(columns, /coach_assignment_groups_coach_id_fkey/)
          let requestedIds = []
          const chain = {
            in(column, values) {
              assert.equal(column, 'booking_session_id')
              requestedIds = [...values]
              return chain
            },
            then(resolve, reject) {
              queries.push(requestedIds)
              const batchNumber = queries.length
              const result = batchNumber === failedBatch
                ? { data: [], error: { message: 'forced exact membership failure' } }
                : {
                    data: requestedIds.map((booking_session_id) => ({
                      booking_session_id,
                      coach_assignment_groups: {
                        coach_id: 'coach-a',
                        profiles: { full_name: 'Coach A', role: 'coach' },
                      },
                    })),
                    error: null,
                  }
              return Promise.resolve(result).then(resolve, reject)
            },
          }
          return chain
        },
      }
    },
  }
}

function createNotificationSupabase({
  adminRecipientRows = [{ id: 'admin-1' }],
  adminRecipientError = null,
  adminRecipientThrow = null,
  headCoachRecipientRows = [{ coach_id: 'head-coach-1', profiles: { role: 'head_coach' } }],
  headCoachRecipientError = null,
  headCoachRecipientThrow = null,
  existenceRows = [],
  existenceError = null,
  existenceThrow = null,
  existingRecipientIds = [],
  insertError = null,
  insertThrow = null,
} = {}) {
  const insertedValues = []
  return {
    insertedValues,
    from(table) {
      if (table === 'profiles') {
        return {
          select: () => thenableResult(
            { data: adminRecipientRows, error: adminRecipientError },
            adminRecipientThrow,
          ),
        }
      }
      if (table === 'coach_branches') {
        return {
          select: () => thenableResult(
            { data: headCoachRecipientRows, error: headCoachRecipientError },
            headCoachRecipientThrow,
          ),
        }
      }
      if (table === 'notifications') {
        return {
          select: () => {
            let selectedUserId = null
            const chain = thenableResult(
              {
                get data() {
                  return existingRecipientIds.includes(selectedUserId) ? [{ id: 'existing' }] : existenceRows
                },
                error: existenceError,
              },
              existenceThrow,
            )
            const originalEq = chain.eq
            chain.eq = (column, value) => {
              if (column === 'user_id') selectedUserId = value
              return originalEq(column, value)
            }
            return chain
          },
          insert: async (values) => {
            if (insertThrow) throw insertThrow
            insertedValues.push(values)
            return { error: insertError }
          },
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

const assignmentReviewInput = {
  title: 'Review',
  message: 'Review assignment',
  linkUrl: '/coach/assign-groups',
}

await check('provenance matrix distinguishes normal, User Reschedule, Wallet, and Admin Makeup', () => {
  assert.equal(classifyCoachAssignmentSessionProvenance(normalSession, walletIds), 'normal')
  assert.equal(classifyCoachAssignmentSessionProvenance(userRescheduleSession, walletIds), 'user_reschedule')
  assert.equal(classifyCoachAssignmentSessionProvenance(walletSession, walletIds), 'lesson_wallet')
  assert.equal(classifyCoachAssignmentSessionProvenance(makeupSession, walletIds), 'admin_makeup')
})

await check('rescheduled_from_id alone is not treated as User Reschedule provenance', () => {
  assert.equal(isPendingUserRescheduleIn({
    session: walletSession,
    walletRedeemedSessionIds: walletIds,
    hasExactMembership: false,
  }), false)
  assert.equal(isPendingUserRescheduleIn({
    session: makeupSession,
    walletRedeemedSessionIds: walletIds,
    hasExactMembership: false,
  }), false)
})

await check('empty Exact group plus stale Legacy blocks the incoming learner', () => {
  const result = resolveCoachLearnerAccess({
    exactGroups: [group('coach-a', [])],
    coachId: 'coach-a',
    bookingSessionId: userRescheduleSession.id,
    hasLegacyAssignment: true,
    sessionProvenance: 'user_reschedule',
  })
  assert.deepEqual(result, { allowed: false, source: 'exact' })
})

await check('genuine Legacy-only normal learner retains compatibility', () => {
  assert.deepEqual(resolveCoachLearnerAccess({
    exactGroups: [],
    coachId: 'coach-a',
    bookingSessionId: normalSession.id,
    hasLegacyAssignment: true,
    sessionProvenance: 'normal',
  }), { allowed: true, source: 'legacy' })
  assert.deepEqual(getGenuineLegacyOnlySlotIds(['legacy-only'], []), ['legacy-only'])
})

await check('genuine Legacy-only User Reschedule-in does not inherit the coach', () => {
  assert.deepEqual(resolveCoachLearnerAccess({
    exactGroups: [],
    coachId: 'coach-a',
    bookingSessionId: userRescheduleSession.id,
    hasLegacyAssignment: true,
    sessionProvenance: 'user_reschedule',
  }), { allowed: false, source: 'legacy' })
})

await check('mixed Legacy roster retains only legitimate learners', () => {
  assert.deepEqual(
    getLegacyEligibleSessions([normalSession, userRescheduleSession], walletIds).map((row) => row.id),
    [normalSession.id],
  )
})

await check('slot containing only pending User Reschedule-in creates no Coach slot evidence', () => {
  const eligible = getLegacyEligibleSessions([userRescheduleSession], walletIds)
  assert.equal(eligible.length, 0)
  assert.deepEqual(resolveCoachSlotAccess({
    exactGroups: [],
    coachId: 'coach-a',
    hasLegacyAssignment: true,
    legacyEligibleLearnerCount: eligible.length,
  }), { allowed: false, source: 'legacy' })
})

await check('mixed Legacy slot still permits Coach work for the legitimate learner only', () => {
  const eligible = getLegacyEligibleSessions([normalSession, userRescheduleSession], walletIds)
  assert.deepEqual(resolveCoachSlotAccess({
    exactGroups: [],
    coachId: 'coach-a',
    hasLegacyAssignment: true,
    legacyEligibleLearnerCount: eligible.length,
  }), { allowed: true, source: 'legacy' })
  assert.equal(eligible[0].id, normalSession.id)
})

await check('Head Coach Save creates persisted Exact membership and makes User Reschedule-in assigned', () => {
  const savedGroups = [group('coach-a', [userRescheduleSession.id])]
  assert.deepEqual(resolveCoachLearnerAccess({
    exactGroups: savedGroups,
    coachId: 'coach-a',
    bookingSessionId: userRescheduleSession.id,
    hasLegacyAssignment: false,
    sessionProvenance: 'user_reschedule',
  }), { allowed: true, source: 'exact' })
  assert.deepEqual(resolveCoachSlotAccess({
    exactGroups: savedGroups,
    coachId: 'coach-a',
    hasLegacyAssignment: false,
    legacyEligibleLearnerCount: 0,
  }), { allowed: true, source: 'exact' })
})

await check('Wallet redemption and Admin Makeup preserve Legacy compatibility', () => {
  for (const sessionProvenance of ['lesson_wallet', 'admin_makeup']) {
    assert.equal(resolveCoachLearnerAccess({
      exactGroups: [],
      coachId: 'coach-a',
      bookingSessionId: `${sessionProvenance}-session`,
      hasLegacyAssignment: true,
      sessionProvenance,
    }).allowed, true)
  }
})

await check('Exact assignment query failure fails closed as unavailable', () => {
  assert.throws(
    () => requireCoachAssignmentQueryData(
      { data: [], error: { message: 'exact lookup failed' } },
      'Exact lookup',
    ),
    (error) => error instanceof CoachAssignmentDataUnavailableError
      && error.message.includes('exact lookup failed'),
  )
})

await check('Coach student history exact membership uses one query for up to 100 IDs', async () => {
  const supabase = createExactMembershipSupabase()
  const sessionIds = Array.from({ length: 100 }, (_, index) => `session-${index + 1}`)
  const rows = await loadCoachStudentHistoryExactMembershipRows(supabase, sessionIds)
  assert.equal(supabase.queries.length, 1)
  assert.equal(supabase.queries[0].length, 100)
  assert.equal(rows.length, 100)
})

await check('Coach student history exact membership batches over 100 IDs without row loss', async () => {
  const supabase = createExactMembershipSupabase()
  const sessionIds = Array.from({ length: 205 }, (_, index) => `session-${index + 1}`)
  const rows = await loadCoachStudentHistoryExactMembershipRows(supabase, sessionIds)
  assert.deepEqual(supabase.queries.map((query) => query.length), [100, 100, 5])
  assert.deepEqual(rows.map((row) => row.booking_session_id), sessionIds)
})

await check('Coach student history exact membership deduplicates session IDs before querying', async () => {
  const supabase = createExactMembershipSupabase()
  const uniqueSessionIds = Array.from({ length: 101 }, (_, index) => `session-${index + 1}`)
  const rows = await loadCoachStudentHistoryExactMembershipRows(
    supabase,
    [...uniqueSessionIds, uniqueSessionIds[0], uniqueSessionIds[50]],
  )
  assert.deepEqual(supabase.queries.map((query) => query.length), [100, 1])
  assert.deepEqual(rows.map((row) => row.booking_session_id), uniqueSessionIds)
})

await check('Coach student history exact membership batch failure remains fail-closed', async () => {
  const supabase = createExactMembershipSupabase({ failedBatch: 2 })
  const sessionIds = Array.from({ length: 101 }, (_, index) => `session-${index + 1}`)
  await assert.rejects(
    loadCoachStudentHistoryExactMembershipRows(supabase, sessionIds),
    (error) => error instanceof CoachAssignmentDataUnavailableError
      && error.message.includes('exact membership query batch 2 failed')
      && error.message.includes('forced exact membership failure'),
  )
})

await check('Wallet provenance query failure fails closed', async () => {
  const supabase = {
    from: () => ({
      select: () => thenableResult({ data: [], error: { message: 'wallet lookup failed' } }),
    }),
  }
  await assert.rejects(
    loadWalletRedeemedSessionIds(supabase, [userRescheduleSession], 'Test provenance'),
    (error) => error instanceof CoachAssignmentDataUnavailableError
      && error.message.includes('wallet lookup failed'),
  )
})

await check('batch Wallet provenance lookup classifies redeemed sessions without per-learner queries', async () => {
  let queryCount = 0
  const supabase = {
    from: () => ({
      select: () => {
        queryCount += 1
        return thenableResult({
          data: [{ redeemed_session_id: walletSession.id }],
          error: null,
        })
      },
    }),
  }
  const ids = await loadWalletRedeemedSessionIds(
    supabase,
    [userRescheduleSession, walletSession, makeupSession],
    'Test provenance',
  )
  assert.deepEqual([...ids], [walletSession.id])
  assert.equal(queryCount, 1)
})

await check('zero Admin recipients is a required recipient_empty failure', async () => {
  const report = await deliverAdminAssignmentReviewNotifications(createNotificationSupabase({
    adminRecipientRows: [],
  }), assignmentReviewInput)
  assert.equal(report.success, false)
  assert.equal(report.recipientEmpty, true)
  const summary = summarizeAssignmentReviewNotifications([{ audience: 'admin', report }])
  assert.equal(summary.failures[0].stage, 'recipient_empty')
})

await check('zero new-branch Head Coach recipients is a required recipient_empty failure', async () => {
  const report = await deliverHeadCoachAssignmentReviewNotifications(createNotificationSupabase({
    headCoachRecipientRows: [],
  }), { branchId: 'new-branch', ...assignmentReviewInput })
  const summary = summarizeAssignmentReviewNotifications([
    { audience: 'new_branch_head_coach', report },
  ])
  assert.equal(report.success, false)
  assert.equal(report.recipientEmpty, true)
  assert.equal(summary.failures[0].stage, 'recipient_empty')
})

await check('zero old-branch Head Coach recipients after membership removal is required failure', async () => {
  const report = await deliverHeadCoachAssignmentReviewNotifications(createNotificationSupabase({
    headCoachRecipientRows: [],
  }), { branchId: 'old-branch', ...assignmentReviewInput })
  const summary = summarizeAssignmentReviewNotifications([
    { audience: 'old_branch_head_coach', report },
  ])
  assert.equal(summary.success, false)
  assert.equal(summary.requiredAudienceCount, 1)
  assert.deepEqual(
    summary.failures.map(({ audience, stage }) => ({ audience, stage })),
    [{ audience: 'old_branch_head_coach', stage: 'recipient_empty' }],
  )
})

await check('returned Admin recipient lookup error is distinct and observable', async () => {
  const report = await deliverAdminAssignmentReviewNotifications(createNotificationSupabase({
    adminRecipientError: { message: 'admin recipient lookup failed' },
  }), assignmentReviewInput)
  assert.equal(report.success, false)
  assert.equal(report.recipientLookupError?.message, 'admin recipient lookup failed')
  assert.equal(report.recipientEmpty, false)
  assert.equal(report.deliveries.length, 0)
  const summary = summarizeAssignmentReviewNotifications([{ audience: 'admin', report }])
  assert.equal(summary.failures[0].stage, 'recipient_lookup')
})

await check('thrown Head Coach recipient lookup error is distinct and observable', async () => {
  const report = await deliverHeadCoachAssignmentReviewNotifications(createNotificationSupabase({
    headCoachRecipientThrow: new Error('head recipient lookup threw'),
  }), { branchId: 'branch-1', ...assignmentReviewInput })
  assert.equal(report.success, false)
  assert.equal(report.recipientLookupError?.message, 'head recipient lookup threw')
  assert.equal(report.deliveries.length, 0)
  const summary = summarizeAssignmentReviewNotifications([
    { audience: 'new_branch_head_coach', report },
  ])
  assert.equal(summary.failures[0].stage, 'recipient_lookup')
})

await check('returned notification existence-check error is observable and does not insert', async () => {
  const supabase = createNotificationSupabase({ existenceError: { message: 'existence returned' } })
  const report = await deliverAdminAssignmentReviewNotifications(supabase, assignmentReviewInput)
  const result = report.deliveries[0]
  assert.equal(report.success, false)
  assert.equal(result.success, false)
  assert.equal(result.stage, 'existence_check')
  assert.equal(result.error?.message, 'existence returned')
  assert.equal(supabase.insertedValues.length, 0)
})

await check('thrown notification existence-check error stays at existence_check', async () => {
  const supabase = createNotificationSupabase({ existenceThrow: new Error('existence threw') })
  const result = await deliverCoachNotificationOnce(supabase, {
    userId: 'head-coach-1',
    ...assignmentReviewInput,
  })
  assert.equal(result.success, false)
  assert.equal(result.stage, 'existence_check')
  assert.equal(result.error?.message, 'existence threw')
  assert.equal(supabase.insertedValues.length, 0)
})

await check('returned notification insert error is observable at insert stage', async () => {
  const report = await deliverHeadCoachAssignmentReviewNotifications(createNotificationSupabase({
    insertError: { message: 'insert returned' },
  }), { branchId: 'branch-1', ...assignmentReviewInput })
  const result = report.deliveries[0]
  assert.equal(report.success, false)
  assert.equal(result.success, false)
  assert.equal(result.stage, 'insert')
  assert.equal(result.error?.message, 'insert returned')
})

await check('thrown notification insert error is observable at insert stage', async () => {
  const report = await deliverAdminAssignmentReviewNotifications(createNotificationSupabase({
    insertThrow: new Error('insert threw'),
  }), assignmentReviewInput)
  const result = report.deliveries[0]
  assert.equal(report.success, false)
  assert.equal(result.success, false)
  assert.equal(result.stage, 'insert')
  assert.equal(result.error?.message, 'insert threw')
})

await check('structured Admin report includes recipient IDs and per-recipient skipped/success results', async () => {
  const report = await deliverAdminAssignmentReviewNotifications(createNotificationSupabase({
    adminRecipientRows: [{ id: 'admin-1' }, { id: 'super-admin-1' }],
    existingRecipientIds: ['admin-1'],
  }), assignmentReviewInput)
  assert.equal(report.success, true)
  assert.deepEqual(report.recipientIds, ['admin-1', 'super-admin-1'])
  assert.deepEqual(
    report.deliveries.map(({ userId, success, skipped }) => ({ userId, success, skipped })),
    [
      { userId: 'admin-1', success: true, skipped: true },
      { userId: 'super-admin-1', success: true, skipped: false },
    ],
  )
})

await check('activity totals include Admin, new Head Coach, and old Head Coach audiences', async () => {
  const adminReport = await deliverAdminAssignmentReviewNotifications(createNotificationSupabase({
    adminRecipientRows: [{ id: 'admin-1' }, { id: 'super-admin-1' }],
    existingRecipientIds: ['admin-1'],
  }), assignmentReviewInput)
  const newReport = await deliverHeadCoachAssignmentReviewNotifications(createNotificationSupabase({
    headCoachRecipientRows: [{ coach_id: 'new-head-1', profiles: { role: 'head_coach' } }],
  }), { branchId: 'new-branch', ...assignmentReviewInput })
  const oldReport = await deliverHeadCoachAssignmentReviewNotifications(createNotificationSupabase({
    headCoachRecipientRows: [{ coach_id: 'old-head-1', profiles: { role: 'head_coach' } }],
  }), { branchId: 'old-branch', ...assignmentReviewInput })
  const summary = summarizeAssignmentReviewNotifications([
    { audience: 'admin', report: adminReport },
    { audience: 'new_branch_head_coach', report: newReport },
    { audience: 'old_branch_head_coach', report: oldReport },
  ])
  assert.deepEqual({
    requiredAudienceCount: summary.requiredAudienceCount,
    recipientCount: summary.recipientCount,
    attemptCount: summary.attemptCount,
    successfulRecipientCount: summary.successfulRecipientCount,
    skippedCount: summary.skippedCount,
    failedRecipientCount: summary.failedRecipientCount,
    audienceFailureCount: summary.audienceFailureCount,
    failureCount: summary.failureCount,
  }, {
    requiredAudienceCount: 3,
    recipientCount: 4,
    attemptCount: 4,
    successfulRecipientCount: 4,
    skippedCount: 1,
    failedRecipientCount: 0,
    audienceFailureCount: 0,
    failureCount: 0,
  })
})

await check('post-commit API response remains success with assignment-review warning on failure', () => {
  const failedSummary = summarizeAssignmentReviewNotifications([{
    audience: 'admin',
    report: {
      success: false,
      recipientIds: [],
      recipientLookupError: null,
      recipientEmpty: true,
      deliveries: [],
    },
  }])
  const response = buildRescheduleSuccessResponse('new-session', 'slot-1', failedSummary)
  assert.equal(response.success, true)
  assert.equal(response.warning?.code, 'ASSIGNMENT_REVIEW_NOTIFICATION_FAILED')
})

await check('successful assignment-review delivery returns success without warning', async () => {
  const report = await deliverHeadCoachAssignmentReviewNotifications(createNotificationSupabase(), {
    branchId: 'branch-1',
    ...assignmentReviewInput,
  })
  const summary = summarizeAssignmentReviewNotifications([
    { audience: 'new_branch_head_coach', report },
  ])
  const response = buildRescheduleSuccessResponse('new-session', 'slot-1', summary)
  assert.equal(report.success, true)
  assert.equal(summary.success, true)
  assert.equal(response.success, true)
  assert.equal(response.warning, null)
})

await check('Attendance Gap does not attribute a stale Legacy coach to pending User Reschedule-in', () => {
  assert.deepEqual(resolveAssignedCoachIds({
    exactGroups: [],
    bookingSessionId: userRescheduleSession.id,
    legacyCoachIds: ['stale-legacy-coach'],
    sessionProvenance: 'user_reschedule',
  }), [])
})

await check('Exact Attendance Gap attribution remains learner-specific', () => {
  assert.deepEqual(resolveAssignedCoachIds({
    exactGroups: [
      group('coach-a', ['session-a']),
      group('coach-b', ['session-b']),
    ],
    bookingSessionId: 'session-b',
    legacyCoachIds: ['stale-legacy-coach'],
    sessionProvenance: 'normal',
  }), ['coach-b'])
})

await check('pending-only Legacy roster yields no ghost Teaching Hours or Payroll learner evidence', () => {
  const eligibleSessions = getLegacyEligibleSessions([userRescheduleSession], walletIds)
  const studentCount = eligibleSessions.length
  const isVerifiedEvidence = studentCount > 0
  assert.equal(studentCount, 0)
  assert.equal(isVerifiedEvidence, false)
})

console.log(`Coach assignment exact/legacy behavior checks passed: ${passed}/${passed}`)
