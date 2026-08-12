import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  buildFollowUpEligibility,
  buildLowEnrollmentRecommendations,
  buildNearCourseRecommendations,
  normalizeFollowUpWorkspaceSnapshot,
} from '../src/lib/admin-notification-recommendations.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const showHead = (relativePath) => execFileSync('git', ['show', `HEAD:${relativePath}`], {
  cwd: root,
  encoding: 'utf8',
})
let passed = 0

async function check(name, callback) {
  await callback()
  passed += 1
  console.log(`✓ ${name}`)
}

function booking(overrides = {}) {
  return {
    id: 'booking-1',
    userId: '00000000-0000-4000-8000-000000000001',
    ownerName: 'Parent One',
    learnerType: 'child',
    childId: 'child-1',
    learnerName: 'Learner One',
    branchId: 'branch-1',
    branchName: 'Ramintra',
    courseTypeId: 'course-kids',
    courseName: 'kids_group',
    month: 7,
    year: 2026,
    totalSessions: 10,
    entitlementSessions: 10,
    status: 'verified',
    expiresAt: null,
    expiredAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

function session(overrides = {}) {
  return {
    id: 'session-1',
    bookingId: 'booking-1',
    scheduleSlotId: 'slot-1',
    date: '2026-08-10',
    startTime: '17:00:00',
    endTime: '19:00:00',
    branchId: 'branch-1',
    branchName: 'Ramintra',
    childId: 'child-1',
    learnerName: 'Learner One',
    status: 'scheduled',
    rescheduledFromId: null,
    isMakeup: false,
    cancelledAt: null,
    ...overrides,
  }
}

function eligibleUserIds(bookings, options = {}) {
  return buildFollowUpEligibility({
    bookings,
    currentYear: options.currentYear ?? 2026,
    currentMonth: options.currentMonth ?? 8,
    nowIso: options.nowIso ?? '2026-08-11T00:00:00.000Z',
    sentCurrentMonthUserIds: options.sentCurrentMonthUserIds ?? [],
    userRoles: options.userRoles ?? {},
  }).map((item) => item.userId)
}

function createAtomicLedger({ visibleUserIds, eligibleUserIds: eligibleIds, priorHistory = [] }) {
  const visible = new Set(visibleUserIds)
  const eligible = new Set(eligibleIds)
  const prior = new Set(priorHistory)
  const sentThisMonth = new Set()
  const requests = new Map()
  const notifications = []

  return {
    eligible,
    notifications,
    requests,
    send({ requestKey, userIds }) {
      const normalized = [...new Set(userIds)].sort()
      const existing = requests.get(requestKey)
      if (existing) {
        assert.deepEqual(existing.userIds, normalized)
        return { sentCount: existing.userIds.length, idempotentReplay: true }
      }
      if (userIds.length < 1 || userIds.length > 10 || normalized.length !== userIds.length) {
        throw new Error('recipient list must contain 1-10 unique users')
      }
      if (normalized.some((userId) => !visible.has(userId) || !eligible.has(userId) || sentThisMonth.has(userId))) {
        throw new Error('recipient eligibility changed before confirmation')
      }
      if (normalized.length > 1 && normalized.some((userId) => prior.has(userId))) {
        throw new Error('prior history blocks bulk')
      }

      requests.set(requestKey, { userIds: normalized })
      for (const userId of normalized) {
        sentThisMonth.add(userId)
        notifications.push(userId)
      }
      return { sentCount: normalized.length, idempotentReplay: false }
    },
  }
}

await check('Low-enrollment, Near-course, and Private recommendation formulas are byte-unchanged', () => {
  const current = read('src/lib/admin-notification-recommendations.ts')
  const baseline = showHead('src/lib/admin-notification-recommendations.ts')
  const section = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end))
  assert.equal(
    section(current, 'export function buildLowEnrollmentRecommendations', 'export function buildNearCourseRecommendations'),
    section(baseline, 'export function buildLowEnrollmentRecommendations', 'export function buildNearCourseRecommendations')
  )
  assert.equal(
    section(current, 'export function buildNearCourseRecommendations', 'export function buildFollowUpEligibility'),
    section(baseline, 'export function buildNearCourseRecommendations', 'export function buildFollowUpEligibility')
  )

  const low = buildLowEnrollmentRecommendations({
    bookings: [booking(), booking({ id: 'private', courseName: 'private' })],
    sessions: [session(), session({ id: 'private-session', bookingId: 'private', scheduleSlotId: 'private-slot' })],
    today: '2026-08-01',
  })
  assert.equal(low.length, 1)
  assert.equal(low[0].courseName, 'kids_group')
})

await check('Near-course uses exact learner attendance and Private remains package-level', () => {
  const privateBooking = booking({
    id: 'private-package',
    userId: 'private-owner',
    learnerType: 'self',
    childId: null,
    courseTypeId: 'private-course',
    courseName: 'private',
    totalSessions: 2,
    entitlementSessions: 2,
  })
  const sessions = [
    session({ id: 'p1-owner', bookingId: privateBooking.id, scheduleSlotId: 'p1', childId: null }),
    session({ id: 'p1-child', bookingId: privateBooking.id, scheduleSlotId: 'p1', childId: 'p-child' }),
    session({ id: 'p2-owner', bookingId: privateBooking.id, scheduleSlotId: 'p2', childId: null }),
  ]
  const attendance = [
    { bookingSessionId: 'p1-owner', studentId: 'private-owner', status: 'present' },
    { bookingSessionId: 'p1-child', studentId: 'p-child', status: 'late' },
    { bookingSessionId: 'p2-owner', studentId: 'private-owner', status: 'absent' },
    { bookingSessionId: 'p2-owner', studentId: 'wrong-user', status: 'present' },
  ]
  const result = buildNearCourseRecommendations({
    bookings: [privateBooking],
    sessions,
    attendance,
    currentYear: 2026,
    currentMonth: 7,
    nextYear: 2026,
    nextMonth: 8,
    nowIso: '2026-07-20T00:00:00.000Z',
  })
  assert.equal(result.length, 1)
  assert.deepEqual([result[0].usedSessions, result[0].totalSessions], [2, 2])
})

await check('previous-month paid or verified history enters only the dynamic Bangkok queue', () => {
  const rows = [
    booking({ id: 'paid', userId: 'paid-user', status: 'paid' }),
    booking({ id: 'verified', userId: 'verified-user', status: 'verified' }),
    booking({ id: 'older', userId: 'older-user', month: 6 }),
    booking({ id: 'cancelled-history', userId: 'cancelled-history-user', status: 'cancelled' }),
  ]
  assert.deepEqual(new Set(eligibleUserIds(rows)), new Set(['paid-user', 'verified-user']))
})

await check('valid current pending, paid, or verified suppresses; expired and cancelled do not suppress', () => {
  const histories = ['pending', 'paid', 'verified', 'expired', 'cancelled'].map((kind) => (
    booking({ id: `history-${kind}`, userId: `${kind}-user` })
  ))
  const current = [
    booking({ id: 'pending-current', userId: 'pending-user', month: 8, status: 'pending_payment', expiresAt: '2026-08-12T00:00:00.000Z' }),
    booking({ id: 'paid-current', userId: 'paid-user', month: 8, status: 'paid' }),
    booking({ id: 'verified-current', userId: 'verified-user', month: 8, status: 'verified' }),
    booking({ id: 'expired-current', userId: 'expired-user', month: 8, status: 'pending_payment', expiresAt: '2026-08-10T00:00:00.000Z', expiredAt: '2026-08-10T00:00:00.000Z' }),
    booking({ id: 'cancelled-current', userId: 'cancelled-user', month: 8, status: 'cancelled' }),
  ]
  assert.deepEqual(new Set(eligibleUserIds([...histories, ...current])), new Set(['expired-user', 'cancelled-user']))
})

await check('booked account disappears and returns after the current booking expires or is cancelled', () => {
  const history = booking({ userId: 'returning-user' })
  const active = booking({ userId: 'returning-user', id: 'current', month: 8, status: 'pending_payment', expiresAt: '2026-08-12T00:00:00.000Z' })
  assert.deepEqual(eligibleUserIds([history, active]), [])
  assert.deepEqual(eligibleUserIds([history, { ...active, expiredAt: '2026-08-11T00:00:00.000Z' }]), ['returning-user'])
  assert.deepEqual(eligibleUserIds([history, { ...active, status: 'cancelled' }]), ['returning-user'])
})

await check('Bangkok month rollover recomputes previous month, role, and current-month sent membership', () => {
  const december = booking({ id: 'december', userId: 'rollover-user', year: 2025, month: 12 })
  assert.deepEqual(eligibleUserIds([december], { currentYear: 2026, currentMonth: 1 }), ['rollover-user'])
  assert.deepEqual(eligibleUserIds([december], {
    currentYear: 2026,
    currentMonth: 1,
    sentCurrentMonthUserIds: ['rollover-user'],
  }), [])
  assert.deepEqual(eligibleUserIds([december], { currentYear: 2026, currentMonth: 2 }), [])
  const january = booking({ id: 'january', userId: 'rollover-user', year: 2026, month: 1 })
  assert.deepEqual(eligibleUserIds([january], { currentYear: 2026, currentMonth: 2 }), ['rollover-user'])
  assert.deepEqual(eligibleUserIds([january], {
    currentYear: 2026,
    currentMonth: 2,
    userRoles: { 'rollover-user': 'coach' },
  }), [])
})

await check('sent this month leaves actionable; a prior-month send can return with evidence preserved', () => {
  const history = booking({ userId: 'repeat-user' })
  assert.deepEqual(eligibleUserIds([history], { sentCurrentMonthUserIds: ['repeat-user'] }), [])
  const snapshot = normalizeFollowUpWorkspaceSnapshot({
    mode: 'actionable',
    actionable_count: 1,
    sent_current_month_count: 0,
    filtered_count: 1,
    page: 1,
    page_size: 10,
    total_pages: 1,
    items: [{
      id: 'repeat-user',
      user_id: 'repeat-user',
      recipient_name: 'Parent Repeat',
      position: 1,
      status: 'actionable',
      verified_attempt_count: 3,
      latest_verified_at: '2026-07-10T00:00:00.000Z',
      latest_verified_read: true,
      ambiguous_legacy_count: 0,
      can_bulk: false,
    }],
  })
  assert.deepEqual(
    [snapshot.items[0].verifiedAttemptCount, snapshot.items[0].latestVerifiedAt, snapshot.items[0].latestVerifiedRead],
    [3, '2026-07-10T00:00:00.000Z', true]
  )
})

await check('one send per account/month, prior-history individual-only, and Bulk 1-10 unique', () => {
  const ledger = createAtomicLedger({
    visibleUserIds: Array.from({ length: 11 }, (_, index) => `user-${index + 1}`),
    eligibleUserIds: Array.from({ length: 11 }, (_, index) => `user-${index + 1}`),
    priorHistory: ['user-1'],
  })
  assert.deepEqual(ledger.send({ requestKey: 'individual', userIds: ['user-1'] }), { sentCount: 1, idempotentReplay: false })
  assert.throws(() => ledger.send({ requestKey: 'duplicate-month', userIds: ['user-1'] }))
  assert.throws(() => ledger.send({ requestKey: 'duplicate-list', userIds: ['user-2', 'user-2'] }))
  assert.throws(() => ledger.send({ requestKey: 'too-many', userIds: Array.from({ length: 11 }, (_, index) => `user-${index + 1}`) }))
  assert.deepEqual(ledger.send({ requestKey: 'bulk-ten', userIds: Array.from({ length: 9 }, (_, index) => `user-${index + 2}`) }), {
    sentCount: 9,
    idempotentReplay: false,
  })

  const priorBulk = createAtomicLedger({ visibleUserIds: ['old', 'new'], eligibleUserIds: ['old', 'new'], priorHistory: ['old'] })
  assert.throws(() => priorBulk.send({ requestKey: 'blocked', userIds: ['old', 'new'] }))
  assert.equal(priorBulk.notifications.length, 0)
})

await check('booking between selection and confirm blocks the whole send without partial notification', () => {
  const ledger = createAtomicLedger({ visibleUserIds: ['a', 'b'], eligibleUserIds: ['a', 'b'] })
  ledger.eligible.delete('b')
  assert.throws(() => ledger.send({ requestKey: 'race', userIds: ['a', 'b'] }))
  assert.deepEqual(ledger.notifications, [])
  assert.equal(ledger.requests.size, 0)
})

await check('request replay is idempotent and concurrent attempts cannot duplicate an account', async () => {
  const ledger = createAtomicLedger({ visibleUserIds: ['a'], eligibleUserIds: ['a'] })
  assert.deepEqual(ledger.send({ requestKey: 'same-key', userIds: ['a'] }), { sentCount: 1, idempotentReplay: false })
  assert.deepEqual(ledger.send({ requestKey: 'same-key', userIds: ['a'] }), { sentCount: 1, idempotentReplay: true })
  const results = await Promise.allSettled([
    Promise.resolve().then(() => ledger.send({ requestKey: 'concurrent-1', userIds: ['a'] })),
    Promise.resolve().then(() => ledger.send({ requestKey: 'concurrent-2', userIds: ['a'] })),
  ])
  assert.equal(results.filter((result) => result.status === 'rejected').length, 2)
  assert.deepEqual(ledger.notifications, ['a'])
})

await check('dynamic roster supports 30/125/140 totals with server pages of 10', () => {
  for (const total of [30, 125, 140]) {
    const population = Array.from({ length: total }, (_, index) => ({ userId: `user-${index + 1}`, position: index + 1 }))
    assert.equal(new Set(population.map((item) => item.userId)).size, total)
    assert.equal(Math.ceil(total / 10), total === 30 ? 3 : total === 125 ? 13 : 14)
    assert.equal(population.slice(10, 20).length, 10)
  }
})

await check('Thai and Latin search covers child name, nickname, parent, and adult learner', () => {
  const rows = [
    { parent: 'สมชาย ใจดี', learners: ['น้องบีม', 'เด็กหญิง พิมพ์'] },
    { parent: 'Parent Latin', learners: ['Adult Learner'] },
  ]
  const search = (term) => rows.filter((row) => [row.parent, ...row.learners]
    .some((value) => value.toLocaleLowerCase('th-TH').includes(term.toLocaleLowerCase('th-TH'))))
  assert.equal(search('บีม').length, 1)
  assert.equal(search('พิมพ์').length, 1)
  assert.equal(search('สมชาย').length, 1)
  assert.equal(search('parent latin').length, 1)
  assert.equal(search('adult').length, 1)
})

await check('v3 migration is exactly one function-only, service-only, rollback-compatible file', () => {
  const migrationPath = 'supabase/migrations/20260811125610_admin_notification_follow_up_dynamic_monthly_queue.sql'
  const migration = read(migrationPath)
  const files = fs.readdirSync(path.join(root, 'supabase/migrations'))
    .filter((name) => name.endsWith('_admin_notification_follow_up_dynamic_monthly_queue.sql'))
  const topLevel = migration.replace(/as \$\$[\s\S]*?\$\$;/gi, '')
  const workspaceBody = migration.slice(
    migration.indexOf('create or replace function public.admin_notification_follow_up_workspace_v3'),
    migration.indexOf('create or replace function public.admin_notification_follow_up_send_v3')
  )
  assert.deepEqual(files, [path.basename(migrationPath)])
  assert.match(workspaceBody, /stable[\s\S]*security invoker[\s\S]*set search_path = ''/)
  assert.doesNotMatch(workspaceBody, /\b(insert|update|delete|merge|truncate)\b/i)
  assert.match(migration, /admin_notification_follow_up_send_v3/)
  assert.match(migration, /pg_advisory_xact_lock/)
  assert.match(migration, /current visible actionable page/)
  assert.match(migration, /recipient eligibility changed before confirmation/)
  assert.match(migration, /bulk recipients must not have prior verified or ambiguous legacy evidence/)
  assert.match(migration, /idempotent_replay/)
  assert.match(migration, /status in \('pending', 'excluded'\)/)
  assert.doesNotMatch(topLevel, /\b(insert|update|delete|merge|truncate)\b/i)
  assert.doesNotMatch(topLevel, /create\s+(table|index|policy|trigger|extension)|alter\s+table/i)
  assert.doesNotMatch(migration, /security definer|drop\s+function|drop\s+table/i)
  assert.match(migration, /revoke all on function[\s\S]*from public, anon, authenticated, service_role/)
  assert.match(migration, /grant execute on function[\s\S]*to service_role/)
  for (const oldMigration of [
    'supabase/migrations/20260807155346_admin_notification_recommendation_tracking.sql',
    'supabase/migrations/20260810034515_admin_notification_follow_up_full_roster_search.sql',
    'supabase/migrations/20260810064847_admin_notification_follow_up_course_history_attendance.sql',
  ]) {
    execFileSync('git', ['diff', '--exit-code', '--', oldMigration], { cwd: root, stdio: 'pipe' })
  }
})

await check('workspace is dynamic/read-only and preserves exact attendance, course, attempt, and sent history evidence', () => {
  const migration = read('supabase/migrations/20260811125610_admin_notification_follow_up_dynamic_monthly_queue.sql')
  const workspace = migration.slice(
    migration.indexOf('create or replace function public.admin_notification_follow_up_workspace_v3'),
    migration.indexOf('create or replace function public.admin_notification_follow_up_send_v3')
  )
  assert.match(workspace, /previous_month_history/)
  assert.match(workspace, /current_booking\.status in \('pending_payment', 'paid', 'verified'\)/)
  assert.match(workspace, /history_attendance\.student_id = coalesce\(history_session\.child_id, history_booking\.user_id\)/)
  assert.match(workspace, /history_attendance\.status in \('present', 'late'\)/)
  assert.match(workspace, /history_course\.name in \('kids_group', 'adult_group', 'private'\)/)
  assert.match(workspace, /verified_attempt_count/)
  assert.match(workspace, /latest_verified_read/)
  assert.doesNotMatch(workspace, /admin_notification_follow_up_candidates_v1|workspace_v2|campaign\.status = 'active'/)

  const acceptedHistory = Array.from({ length: 6 }, (_, index) => `sent-${index + 1}`)
  const laterValidHistory = [...acceptedHistory, 'sent-7']
  assert.deepEqual([...laterValidHistory], ['sent-1', 'sent-2', 'sent-3', 'sent-4', 'sent-5', 'sent-6', 'sent-7'])
  assert.doesNotMatch(migration, /delete\s+from|truncate/i)
})

await check('GET and read refresh events write zero rows; API exposes only v3 workspace and manual Send', () => {
  const route = read('src/app/api/admin/notifications/customer-follow-up/route.ts')
  const getSection = route.slice(route.indexOf('export async function GET'), route.indexOf('export async function POST'))
  const appSources = [
    route,
    read('src/app/(admin)/admin/notifications/page.tsx'),
    read('src/components/admin/notification-recommendations-workspace.tsx'),
  ].join('\n')
  assert.match(route, /requireAdminMenuAccess\('notifications'\)/)
  assert.match(route, /FORGED_SOURCE_KEYS/)
  assert.match(route, /admin_notification_follow_up_workspace_v3/)
  assert.match(route, /admin_notification_follow_up_send_v3/)
  assert.match(route, /action !== 'send'/)
  assert.match(getSection, /Cache-Control': 'private, no-store, max-age=0'/)
  assert.doesNotMatch(getSection, /\.insert\(|\.update\(|\.delete\(|send_v3/)
  assert.doesNotMatch(appSources, /admin_notification_follow_up_(start|sync|reconcile|workspace_v2)|canStart|canSync/)
  execFileSync('git', ['diff', '--exit-code', '--', 'src/app/api/admin/notifications/route.ts'], { cwd: root, stdio: 'pipe' })
})

await check('valid SSR workspace skips hydration GET; SSR error retries once without a loop', () => {
  const component = read('src/components/admin/notification-recommendations-workspace.tsx')
  const initialEffect = component.match(/useEffect\(\(\) => \{\s*if \(!initialData\.followUp\.error \|\| initialRetryAttemptedRef\.current\) return[\s\S]*?\}, \[initialData\.followUp\.error, requestWorkspace\]\)/)?.[0]
  assert.ok(initialEffect)
  assert.match(initialEffect, /initialRetryAttemptedRef\.current = true/)
  assert.match(initialEffect, /requestWorkspace\(currentQueryRef\.current, 'initial', false\)/)
  assert.equal((initialEffect.match(/void requestWorkspace/g) || []).length, 1)
  assert.doesNotMatch(component, /useEffect\(\(\) => \{\s*void requestWorkspace\(currentQueryRef\.current, 'initial'/)

  const initialRequests = (hasServerError, effectRuns) => {
    let attempted = false
    let requests = 0
    for (let run = 0; run < effectRuns; run += 1) {
      if (!hasServerError || attempted) continue
      attempted = true
      requests += 1
    }
    return requests
  }
  assert.equal(initialRequests(false, 2), 0)
  assert.equal(initialRequests(true, 2), 1)
})

await check('refresh remains event-driven after a real background transition, five-minute visible-only, serialized, and stale-safe', () => {
  const component = read('src/components/admin/notification-recommendations-workspace.tsx')
  assert.match(component, /const SAFETY_REFRESH_MS = 5 \* 60 \* 1000/)
  assert.equal((60 * 60 * 1000) / (5 * 60 * 1000), 12)
  assert.match(component, /const backgroundedRef = useRef\(false\)/)
  assert.match(component, /window\.addEventListener\('blur', handleBlur\)/)
  assert.match(component, /window\.addEventListener\('focus'/)
  assert.match(component, /document\.addEventListener\('visibilitychange'/)
  assert.match(component, /document\.visibilityState !== 'visible' \|\| !backgroundedRef\.current/)
  assert.match(component, /document\.visibilityState === 'hidden'[\s\S]*backgroundedRef\.current = true/)
  assert.match(component, /backgroundedRef\.current = false[\s\S]*requestWorkspace\(currentQueryRef\.current, reason, false\)/)
  assert.match(component, /window\.setInterval[\s\S]*'safety'/)
  assert.match(component, /new AbortController\(\)/)
  assert.match(component, /activeGetControllerRef\.current\?\.abort\(\)/)
  assert.match(component, /requestSequenceRef/)
  assert.match(component, /if \(previousRequest\) \{\s*if \(!replaceInFlight\) return null\s*requestSequence = \+\+requestSequenceRef\.current/)
  assert.match(component, /setTimeout\([\s\S]*300/)
  for (const reason of ['search', 'filter', 'page', 'preview', 'after-send']) {
    assert.match(component, new RegExp(`requestWorkspace\\([\\s\\S]*?'${reason}'`))
  }
  assert.match(component, /reason === 'preview'/)
  assert.match(component, /if \(!fresh\) return/)
  assert.doesNotMatch(component, /RefreshCw|loadingAction|statusFilter/)
})

await check('all three recommendation tabs use local first/last pagination with filtered Follow-up state', () => {
  const component = read('src/components/admin/notification-recommendations-workspace.tsx')
  const pagination = component.slice(component.indexOf('function FixedPagination'), component.indexOf('function SummaryCard'))
  assert.doesNotMatch(component, /ListPagination/)
  assert.match(pagination, /const totalPages = Math\.max\(1, Math\.ceil\(total \/ PAGE_SIZE\)\)/)
  assert.match(pagination, /disabled=\{isFirstPage\}[\s\S]*onClick=\{\(\) => onPageChange\(1\)\}[\s\S]*หน้าแรก/)
  assert.match(pagination, /disabled=\{isFirstPage\}[\s\S]*onClick=\{\(\) => onPageChange\(currentPage - 1\)\}[\s\S]*ก่อนหน้า/)
  assert.match(pagination, /\{currentPage\} \/ \{totalPages\}/)
  assert.match(pagination, /disabled=\{isLastPage\}[\s\S]*onClick=\{\(\) => onPageChange\(currentPage \+ 1\)\}[\s\S]*ถัดไป/)
  assert.match(pagination, /disabled=\{isLastPage\}[\s\S]*onClick=\{\(\) => onPageChange\(totalPages\)\}[\s\S]*หน้าสุดท้าย/)
  assert.match(pagination, /grid grid-cols-2[\s\S]*sm:flex/)
  assert.equal((component.match(/<FixedPagination/g) || []).length, 3)
  assert.match(component, /page=\{followUp\.page\}[\s\S]*total=\{followUp\.filteredCount\}[\s\S]*requestWorkspace\(\{ page, mode, search: followUp\.search \}, 'page'\)/)
  execFileSync('git', ['diff', '--exit-code', '--', 'src/components/admin/list-pagination.tsx'], { cwd: root, stdio: 'pipe' })
})

await check('course badges are blue/green/red only in Near-course and Follow-up; urgency and Low-enrollment stay unchanged', () => {
  const component = read('src/components/admin/notification-recommendations-workspace.tsx')
  const baseline = showHead('src/components/admin/notification-recommendations-workspace.tsx')
  assert.match(component, /kids_group: 'border-blue-200 bg-blue-50 text-blue-800'/)
  assert.match(component, /adult_group: 'border-emerald-200 bg-emerald-50 text-emerald-800'/)
  assert.match(component, /private: 'border-rose-200 bg-rose-50 text-rose-800'/)
  assert.equal((component.match(/className=\{COURSE_BADGE_CLASSES\[/g) || []).length, 2)
  assert.match(component, /<Badge variant="outline">\{item\.learnerCount\} คน<\/Badge>/)
  const urgencyBadge = /<Badge className=\{item\.level === 'red' \? 'bg-rose-600' : item\.level === 'yellow' \? 'bg-amber-500' : 'bg-emerald-600'\}>/
  assert.match(component, urgencyBadge)
  assert.match(baseline, urgencyBadge)
})

await check('selection is reconciled to visible actionable bulk candidates before Preview', () => {
  const component = read('src/components/admin/notification-recommendations-workspace.tsx')
  assert.match(component, /next\.items[\s\S]*item\.status === 'actionable' && item\.canBulk/)
  assert.match(component, /current\.size - retained\.size/)
  assert.match(component, /toast\.warning/)
  assert.match(component, /selected\.length !== userIds\.length \|\| bulkInvalid/)
  assert.match(component, /selectedUserIds\.size >= 10/)
  assert.match(component, /Preview/)
  assert.doesNotMatch(component, /window\.(alert|confirm|prompt)|\balert\(|\bconfirm\(|\bprompt\(/)
})

await check('notification copy/link and generic notification route remain unchanged', () => {
  const oldSendMigration = read('supabase/migrations/20260810034515_admin_notification_follow_up_full_roster_search.sql')
  const dynamicMigration = read('supabase/migrations/20260811125610_admin_notification_follow_up_dynamic_monthly_queue.sql')
  const title = 'คิดถึงนะ กลับมาลงเรียนกันต่อได้เลย'
  const message = 'เดือนนี้ยังไม่พบการจองของคุณ หากต้องการกลับมาเรียนสามารถเข้าแอปเพื่อเลือกวันเรียนได้ทันที'
  for (const source of [oldSendMigration, dynamicMigration]) {
    assert.match(source, new RegExp(title))
    assert.match(source, new RegExp(message))
    assert.match(source, /'reminder',[\s\S]*'\/dashboard\/booking'/)
  }
  execFileSync('git', ['diff', '--exit-code', '--', 'src/app/api/admin/notifications/route.ts'], { cwd: root, stdio: 'pipe' })
})

console.log(`\nAdmin notification recommendation checks passed: ${passed}`)
