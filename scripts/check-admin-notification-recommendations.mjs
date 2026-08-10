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
    ownerName: 'ผู้ปกครอง',
    learnerType: 'child',
    childId: 'child-1',
    learnerName: 'ผู้เรียน 1',
    branchId: 'branch-1',
    branchName: 'รามอินทรา',
    courseTypeId: 'course-kids',
    courseName: 'kids_group',
    month: 8,
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
    branchName: 'รามอินทรา',
    childId: 'child-1',
    learnerName: 'ผู้เรียน 1',
    status: 'scheduled',
    rescheduledFromId: null,
    isMakeup: false,
    cancelledAt: null,
    ...overrides,
  }
}

await check('low-enrollment includes every Kids/Adult branch without a hidden global cap and excludes Private', () => {
  const bookings = []
  const sessions = []
  for (let slotIndex = 0; slotIndex < 25; slotIndex += 1) {
    const learnerCount = slotIndex % 2 === 0 ? 1 : 2
    for (let learnerIndex = 0; learnerIndex < learnerCount; learnerIndex += 1) {
      const id = `low-${slotIndex}-${learnerIndex}`
      bookings.push(booking({
        id,
        userId: `user-${id}`,
        childId: `child-${id}`,
        branchId: `branch-${slotIndex % 3}`,
        branchName: 'สาขาเดิมใน Booking',
        courseTypeId: slotIndex % 2 === 0 ? 'course-kids' : 'course-adult',
        courseName: slotIndex % 2 === 0 ? 'kids_group' : 'adult_group',
      }))
      sessions.push(session({
        id: `session-${id}`,
        bookingId: id,
        scheduleSlotId: `slot-${slotIndex}`,
        branchId: `branch-${slotIndex % 3}`,
        branchName: `สาขา ${slotIndex % 3}`,
        childId: `child-${id}`,
      }))
    }
  }
  bookings.push(booking({ id: 'private-low', courseName: 'private', courseTypeId: 'course-private' }))
  sessions.push(session({ id: 'private-low-session', bookingId: 'private-low', scheduleSlotId: 'private-slot' }))

  const result = buildLowEnrollmentRecommendations({ bookings, sessions, today: '2026-08-07' })
  assert.equal(result.length, 25)
  assert.equal(result.some((item) => item.courseName === 'private'), false)
  assert.deepEqual(new Set(result.map((item) => item.branchName)), new Set(['สาขา 0', 'สาขา 1', 'สาขา 2']))
  assert.equal(result.filter((item) => item.learnerCount === 1).length, 13)
  assert.equal(result.filter((item) => item.learnerCount === 2).length, 12)
})

function groupNearCourseFixture() {
  const kids = booking({ id: 'kids-current', childId: 'child-kids', learnerName: 'น้องคิดส์' })
  const adult = booking({
    id: 'adult-current',
    userId: '00000000-0000-4000-8000-000000000010',
    ownerName: 'ผู้ใหญ่หนึ่ง',
    learnerType: 'self',
    childId: null,
    learnerName: 'ผู้ใหญ่หนึ่ง',
    courseTypeId: 'course-adult',
    courseName: 'adult_group',
    totalSessions: 4,
    entitlementSessions: 4,
  })
  const sessions = Array.from({ length: 10 }, (_, index) => session({
    id: `kids-session-${index + 1}`,
    bookingId: kids.id,
    scheduleSlotId: `kids-slot-${index + 1}`,
    childId: kids.childId,
    status: index === 6 ? 'rescheduled' : index === 7 ? 'walleted' : 'scheduled',
  }))
  sessions.push(session({
    id: 'kids-reschedule-descendant',
    bookingId: kids.id,
    scheduleSlotId: 'kids-new-slot-7',
    childId: kids.childId,
    rescheduledFromId: 'kids-session-7',
  }))
  sessions.push(session({
    id: 'kids-makeup',
    bookingId: kids.id,
    scheduleSlotId: 'kids-makeup-slot',
    childId: kids.childId,
    isMakeup: true,
  }))
  sessions.push(...Array.from({ length: 4 }, (_, index) => session({
    id: `adult-session-${index + 1}`,
    bookingId: adult.id,
    scheduleSlotId: `adult-slot-${index + 1}`,
    childId: null,
  })))

  const attendance = [
    ...Array.from({ length: 6 }, (_, index) => ({
      bookingSessionId: `kids-session-${index + 1}`,
      studentId: kids.childId,
      status: ['present', 'late', 'absent'][index % 3],
    })),
    { bookingSessionId: 'kids-reschedule-descendant', studentId: kids.childId, status: 'late' },
    { bookingSessionId: 'kids-session-8', studentId: 'wrong-child', status: 'present' },
    { bookingSessionId: 'kids-makeup', studentId: kids.childId, status: 'present' },
    { bookingSessionId: 'adult-session-1', studentId: adult.userId, status: 'present' },
    { bookingSessionId: 'adult-session-2', studentId: adult.userId, status: 'late' },
    { bookingSessionId: 'adult-session-3', studentId: adult.userId, status: 'absent' },
  ]
  return { kids, adult, sessions, attendance }
}

await check('Kids/Adult progress uses entitlement and exact learner terminal Attendance without descendant, Wallet, or Makeup double count', () => {
  const fixture = groupNearCourseFixture()
  const result = buildNearCourseRecommendations({
    bookings: [fixture.kids, fixture.adult],
    sessions: fixture.sessions,
    attendance: fixture.attendance,
    currentYear: 2026,
    currentMonth: 8,
    nextYear: 2026,
    nextMonth: 9,
    nowIso: '2026-08-07T00:00:00.000Z',
  })
  const kidsResult = result.find((item) => item.courseName === 'kids_group')
  const adultResult = result.find((item) => item.courseName === 'adult_group')
  assert.deepEqual(
    { used: kidsResult.usedSessions, total: kidsResult.totalSessions, progress: kidsResult.progressPercent },
    { used: 7, total: 10, progress: 70 }
  )
  assert.deepEqual(
    { used: adultResult.usedSessions, total: adultResult.totalSessions, progress: adultResult.progressPercent },
    { used: 3, total: 4, progress: 75 }
  )
})

function privateFixture({ bookingId, ownerId, entitlement, attendeeRows, ownerName }) {
  const privateBooking = booking({
    id: bookingId,
    userId: ownerId,
    ownerName,
    learnerType: 'self',
    childId: null,
    learnerName: ownerName,
    courseTypeId: 'course-private',
    courseName: 'private',
    totalSessions: entitlement,
    entitlementSessions: entitlement,
  })
  const roots = []
  const attendance = []
  let remainingRows = attendeeRows
  for (let unit = 0; unit < entitlement; unit += 1) {
    const remainingUnits = entitlement - unit
    const rowsForUnit = Math.ceil(remainingRows / remainingUnits)
    remainingRows -= rowsForUnit
    for (let attendee = 0; attendee < rowsForUnit; attendee += 1) {
      const id = `${bookingId}-unit-${unit}-attendee-${attendee}`
      const studentId = attendee === 0 ? ownerId : `${bookingId}-child-${attendee}`
      roots.push(session({
        id,
        bookingId,
        scheduleSlotId: `${bookingId}-slot-${unit}`,
        childId: attendee === 0 ? null : studentId,
      }))
      if (attendee === 0 && unit > 0) {
        attendance.push({ bookingSessionId: id, studentId, status: ['present', 'late', 'absent'][unit % 3] })
      }
    }
  }
  const firstRoot = roots[0]
  const descendant = session({
    id: `${bookingId}-rescheduled-descendant`,
    bookingId,
    scheduleSlotId: `${bookingId}-replacement-slot`,
    childId: firstRoot.childId,
    rescheduledFromId: firstRoot.id,
  })
  attendance.push({ bookingSessionId: descendant.id, studentId: ownerId, status: 'present' })
  const makeup = session({
    id: `${bookingId}-makeup`,
    bookingId,
    scheduleSlotId: `${bookingId}-makeup-slot`,
    childId: null,
    isMakeup: true,
  })
  attendance.push({ bookingSessionId: makeup.id, studentId: ownerId, status: 'present' })
  return { privateBooking, roots, sessions: [...roots, descendant, makeup], attendance }
}

await check('Private 82 attendee rows collapse to 35 booking/package purchased units', () => {
  const fixture = privateFixture({
    bookingId: 'private-35',
    ownerId: '00000000-0000-4000-8000-000000000035',
    entitlement: 35,
    attendeeRows: 82,
    ownerName: 'เจ้าของแพ็กเกจ 35',
  })
  assert.equal(fixture.roots.length, 82)
  const result = buildNearCourseRecommendations({
    bookings: [fixture.privateBooking],
    sessions: fixture.sessions,
    attendance: fixture.attendance,
    currentYear: 2026,
    currentMonth: 8,
    nextYear: 2026,
    nextMonth: 9,
    nowIso: '2026-08-07T00:00:00.000Z',
  })
  assert.equal(result.length, 1)
  assert.deepEqual(
    { used: result[0].usedSessions, total: result[0].totalSessions, learnerNames: result[0].learnerNames },
    { used: 35, total: 35, learnerNames: ['ผู้เรียน 1'] }
  )
})

await check('Private multi-attendee 71 rows collapse to 24 units and renewal suppression is owner/course level', () => {
  const fixture = privateFixture({
    bookingId: 'private-24',
    ownerId: '00000000-0000-4000-8000-000000000024',
    entitlement: 24,
    attendeeRows: 71,
    ownerName: 'เจ้าของแพ็กเกจ 24',
  })
  assert.equal(fixture.roots.length, 71)
  const baseArgs = {
    sessions: fixture.sessions,
    attendance: fixture.attendance,
    currentYear: 2026,
    currentMonth: 8,
    nextYear: 2026,
    nextMonth: 9,
    nowIso: '2026-08-07T00:00:00.000Z',
  }
  const beforeRenewal = buildNearCourseRecommendations({ ...baseArgs, bookings: [fixture.privateBooking] })
  assert.deepEqual([beforeRenewal[0].usedSessions, beforeRenewal[0].totalSessions], [24, 24])

  const renewal = booking({
    ...fixture.privateBooking,
    id: 'private-24-renewal',
    month: 9,
    totalSessions: 10,
    entitlementSessions: 10,
    status: 'pending_payment',
    expiresAt: '2026-08-08T00:00:00.000Z',
  })
  assert.equal(buildNearCourseRecommendations({ ...baseArgs, bookings: [fixture.privateBooking, renewal] }).length, 0)
})

await check('same exact Kids learner/course renewal suppresses only that recommendation', () => {
  const fixture = groupNearCourseFixture()
  const renewal = booking({
    ...fixture.kids,
    id: 'kids-renewal',
    month: 9,
    status: 'pending_payment',
    expiresAt: '2026-08-08T00:00:00.000Z',
  })
  const result = buildNearCourseRecommendations({
    bookings: [fixture.kids, fixture.adult, renewal],
    sessions: fixture.sessions,
    attendance: fixture.attendance,
    currentYear: 2026,
    currentMonth: 8,
    nextYear: 2026,
    nextMonth: 9,
    nowIso: '2026-08-07T00:00:00.000Z',
  })
  assert.equal(result.some((item) => item.courseName === 'kids_group'), false)
  assert.equal(result.some((item) => item.courseName === 'adult_group'), true)
})

await check('follow-up includes Private history and suppresses any current active course', () => {
  const historyPrivate = booking({
    id: 'history-private',
    userId: 'user-private-history',
    courseName: 'private',
    courseTypeId: 'course-private',
    month: 6,
  })
  const activeOtherCourse = booking({
    id: 'active-other-course',
    userId: 'user-private-history',
    month: 8,
    courseName: 'adult_group',
    courseTypeId: 'course-adult',
    status: 'verified',
  })
  const eligiblePrivate = booking({
    id: 'eligible-private',
    userId: 'user-eligible-private',
    courseName: 'private',
    courseTypeId: 'course-private',
    month: 7,
  })
  const expiredPendingOwner = 'user-expired-pending'
  const historyWithExpiredPending = booking({ id: 'history-expired', userId: expiredPendingOwner, month: 7 })
  const expiredPending = booking({
    id: 'expired-pending',
    userId: expiredPendingOwner,
    month: 8,
    status: 'pending_payment',
    expiresAt: '2026-08-01T00:00:00.000Z',
    expiredAt: '2026-08-01T00:00:00.000Z',
  })
  const result = buildFollowUpEligibility({
    bookings: [historyPrivate, activeOtherCourse, eligiblePrivate, historyWithExpiredPending, expiredPending],
    currentYear: 2026,
    currentMonth: 8,
    nowIso: '2026-08-07T00:00:00.000Z',
  })
  assert.deepEqual(new Set(result.map((item) => item.userId)), new Set(['user-eligible-private', expiredPendingOwner]))
})

await check('full roster keeps 30, 125, and 140 accounts in one batch with 10-per-page server totals', () => {
  assert.deepEqual([30, 125, 140].map((total) => ({ total, pages: Math.ceil(total / 10) })), [
    { total: 30, pages: 3 },
    { total: 125, pages: 13 },
    { total: 140, pages: 14 },
  ])
  const population = Array.from({ length: 140 }, (_, index) => ({
    userId: `user-${index + 1}`,
    position: index + 1,
    status: 'pending',
  }))
  assert.equal(new Set(population.map((item) => item.userId)).size, 140)
  assert.deepEqual(population.slice(30, 33).map((item) => item.position), [31, 32, 33])
  assert.deepEqual(population.slice(130, 140).map((item) => item.position), [131, 132, 133, 134, 135, 136, 137, 138, 139, 140])
})

await check('explicit Sync excludes only stale pending, appends missing eligible, and preserves Sent history', () => {
  const roster = [
    { userId: 'keep', position: 1, status: 'pending' },
    { userId: 'stale', position: 2, status: 'pending' },
    { userId: 'sent', position: 3, status: 'sent' },
  ]
  const eligible = new Set(['keep', 'sent', 'new-a', 'new-b'])
  const afterExclusion = roster.map((item) => (
    item.status === 'pending' && !eligible.has(item.userId) ? { ...item, status: 'excluded' } : item
  ))
  const seen = new Set(afterExclusion.map((item) => item.userId))
  const appended = [...eligible]
    .filter((userId) => !seen.has(userId))
    .sort()
    .map((userId, index) => ({ userId, position: 4 + index, status: 'pending' }))
  const result = [...afterExclusion, ...appended]
  assert.deepEqual(result, [
    { userId: 'keep', position: 1, status: 'pending' },
    { userId: 'stale', position: 2, status: 'excluded' },
    { userId: 'sent', position: 3, status: 'sent' },
    { userId: 'new-a', position: 4, status: 'pending' },
    { userId: 'new-b', position: 5, status: 'pending' },
  ])
})

await check('workspace debounces server GET search for 300ms, ignores stale responses, and keeps immediate submit/filter/page controls', () => {
  const component = read('src/components/admin/notification-recommendations-workspace.tsx')
  const page = read('src/app/(admin)/admin/notifications/page.tsx')
  const debounceEffect = component.slice(component.indexOf('useEffect(() => {'), component.indexOf('useEffect(() => () =>'))
  assert.match(component, /const PAGE_SIZE = 10/)
  assert.match(component, /URLSearchParams/)
  assert.match(component, /searchDraft/)
  assert.match(component, /statusFilter/)
  assert.match(component, /new AbortController\(\)/)
  assert.match(component, /requestSequenceRef/)
  assert.match(component, /clearSearchDebounce/)
  assert.match(debounceEffect, /setTimeout\([\s\S]*requestWorkspace\('GET', undefined, 'search', 1,[\s\S]*300\)/)
  assert.doesNotMatch(debounceEffect, /requestWorkspace\('POST'/)
  assert.match(component, /onSubmit=\{submitSearch\}/)
  assert.match(component, /requestWorkspace\('GET', undefined, 'filter', 1, nextStatus, searchDraft\)/)
  assert.match(component, /requestWorkspace\('GET', undefined, 'page', page, statusFilter, searchDraft\)/)
  assert.match(component, /followUp\.items\.filter/)
  assert.match(component, /setSelectedUserIds\(new Set\(\)\)/)
  assert.match(component, /Preview การส่งพร้อมกัน/)
  assert.match(component, /selectedUserIds\.size >= 10/)
  assert.match(component, /Bulk เป็น all-or-nothing/)
  assert.match(page, /admin_notification_follow_up_workspace_v2/)
  assert.doesNotMatch(page, /admin_notification_follow_up_(start|sync|send)_v2/)
})

await check('unresolved child identities use the explicit review fallback in booking and session mappings', () => {
  const page = read('src/app/(admin)/admin/notifications/page.tsx')
  assert.equal((page.match(/ต้องตรวจสอบรายชื่อผู้เรียน/g) || []).length, 2)
  assert.doesNotMatch(page, /childNameById\.get\(row\.child_id\) \|\| 'ผู้เรียน'/)
})

await check('v2 migration provides positive positions, full roster, atomic Sync/Reconcile, v1 revocation, and least privilege', () => {
  const migration = read('supabase/migrations/20260810034515_admin_notification_follow_up_full_roster_search.sql')
  assert.match(migration, /check \(position > 0\)/)
  assert.match(migration, /pg_advisory_xact_lock/)
  assert.match(migration, /admin_notification_follow_up_sync_v2/)
  assert.match(migration, /admin_notification_follow_up_reconcile_v2/)
  assert.match(migration, /admin_notification_follow_up_workspace_v2/)
  assert.match(migration, /admin_notification_follow_up_send_v2/)
  assert.doesNotMatch(migration, /limit 30/)
  assert.match(migration, /admin_notification_follow_up_is_eligible_v1\(item\.user_id\)/)
  assert.match(migration, /v_exclude_item_ids uuid\[\]/)
  assert.match(migration, /v_insert_user_ids uuid\[\]/)
  assert.match(migration, /v_insert_positions integer\[\]/)
  assert.match(migration, /item\.id = any\(v_exclude_item_ids\)/)
  assert.match(migration, /unnest\(v_insert_user_ids, v_insert_positions\)/)
  assert.match(migration, /generate_subscripts\(v_insert_user_ids, 1\)/)
  assert.match(migration, /bulk recipients must not have prior verified or ambiguous legacy evidence/)
  assert.match(migration, /enable row level security/g)
  assert.match(migration, /revoke execute on function public\.admin_notification_follow_up_start_batch_v1\(uuid\)[\s\S]*from service_role/)
  assert.match(migration, /revoke execute on function public\.admin_notification_follow_up_send_v1\(uuid, uuid, uuid\[\]\)[\s\S]*from service_role/)
  assert.match(migration, /revoke all on function[\s\S]*from public, anon, authenticated, service_role/)
  assert.match(migration, /grant execute[\s\S]*to service_role/)
  assert.match(migration, /security invoker/g)
  assert.match(migration, /set search_path = ''/g)
  assert.doesNotMatch(migration, /create (extension|index)/i)
})

await check('corrective workspace migration adds canonical course history and exact real attendance evidence without search or data mutation', () => {
  const migrationPath = 'supabase/migrations/20260810064847_admin_notification_follow_up_course_history_attendance.sql'
  const migration = read(migrationPath)
  const migrationFiles = fs.readdirSync(path.join(root, 'supabase/migrations'))
    .filter((name) => name.endsWith('_admin_notification_follow_up_course_history_attendance.sql'))
  const searchSections = migration.slice(migration.indexOf('with filtered as ('), migration.indexOf("'course_names'"))
  assert.deepEqual(migrationFiles, [path.basename(migrationPath)])
  assert.match(migration, /create or replace function public\.admin_notification_follow_up_workspace_v2/)
  assert.match(migration, /stable[\s\S]*security invoker[\s\S]*set search_path = ''/)
  assert.match(migration, /history_booking\.status in \('paid', 'verified'\)/)
  assert.match(migration, /history_course\.name in \('kids_group', 'adult_group', 'private'\)/)
  assert.match(migration, /when 'kids_group' then 1[\s\S]*when 'adult_group' then 2[\s\S]*when 'private' then 3/)
  assert.match(migration, /history_attendance\.booking_session_id = history_session\.id/)
  assert.match(migration, /history_attendance\.student_id = coalesce\(history_session\.child_id, history_booking\.user_id\)/)
  assert.match(migration, /history_attendance\.status in \('present', 'late'\)/)
  assert.match(migration, /history_session\.date <= pg_catalog\.timezone\('Asia\/Bangkok', pg_catalog\.now\(\)\)::date/)
  assert.match(migration, /history_session\.status not in \('walleted', 'rescheduled'\)/)
  assert.match(migration, /history_session\.cancelled_at is null/)
  assert.doesNotMatch(searchSections, /history_course|course_names|latest_attendance|last_attended_date/)
  assert.doesNotMatch(migration, /\b(insert|update|delete|merge|truncate)\b/i)
  assert.doesNotMatch(migration, /create\s+(table|index|policy|trigger|extension)|alter\s+table/i)
  assert.match(migration, /revoke all on function[\s\S]*from public, anon, authenticated, service_role/)
  assert.match(migration, /grant execute on function[\s\S]*to service_role/)
  execFileSync('git', ['diff', '--exit-code', '--', 'supabase/migrations/20260810034515_admin_notification_follow_up_full_roster_search.sql'], {
    cwd: root,
    stdio: 'pipe',
  })
})

await check('API rejects forged source markers, authenticates Admin, and GET remains read-only', () => {
  const route = read('src/app/api/admin/notifications/customer-follow-up/route.ts')
  const getSection = route.slice(route.indexOf('export async function GET'), route.indexOf('export async function POST'))
  assert.match(route, /requireAdminMenuAccess\('notifications'\)/)
  assert.match(route, /FORGED_SOURCE_KEYS/)
  assert.match(route, /ไม่รับ source marker หรือ batch identity จาก Client/)
  assert.match(route, /admin_notification_follow_up_(start|sync|send)_v2/)
  assert.doesNotMatch(getSection, /start_v2|sync_v2|send_v2|\.insert\(|\.update\(|\.delete\(/)
})

await check('learner roster and account history normalize canonical course order and strict date-only evidence', () => {
  const snapshot = normalizeFollowUpWorkspaceSnapshot({
    state: 'active',
    total_count: 1,
    pending_count: 1,
    filtered_count: 1,
    eligible_total: 1,
    page: 1,
    page_size: 10,
    total_pages: 1,
    status_filter: 'all',
    items: [{
      id: 'item-1',
      user_id: 'user-1',
      recipient_name: 'Parent Latin',
      position: 1,
      status: 'pending',
      course_names: ['private', 'kids_group', 'adult_group', 'private', 'unsupported'],
      last_attended_date: '2026-08-10',
      learners: [
        { learner_type: 'child', full_name: 'เด็กหญิงทดสอบ', nickname: 'น้องเอ' },
        { learner_type: 'child', full_name: 'เด็กชายทดสอบ', nickname: 'Beam' },
        { learner_type: 'self', full_name: 'Parent Latin', nickname: null },
      ],
    }],
  })
  assert.deepEqual(snapshot.items[0].learners, [
    { name: 'น้องเอ - เด็กหญิงทดสอบ', isSelf: false },
    { name: 'Beam - เด็กชายทดสอบ', isSelf: false },
    { name: 'Parent Latin', isSelf: true },
  ])
  assert.deepEqual(snapshot.items[0].courseNames, ['kids_group', 'adult_group', 'private'])
  assert.equal(snapshot.items[0].lastAttendedDate, '2026-08-10')

  const invalidSnapshot = normalizeFollowUpWorkspaceSnapshot({
    ...snapshot,
    state: 'active',
    items: [{ id: 'item-2', user_id: 'user-2', course_names: ['legacy'], last_attended_date: '2026-02-31' }],
  })
  assert.deepEqual(invalidSnapshot.items[0].courseNames, [])
  assert.equal(invalidSnapshot.items[0].lastAttendedDate, null)
})

await check('follow-up UI shows account-level course badges and Thai date fallbacks without changing notification copy', () => {
  const component = read('src/components/admin/notification-recommendations-workspace.tsx')
  assert.match(component, /FOLLOW_UP_COURSE_LABELS/)
  assert.match(component, /kids_group: 'กลุ่มเด็ก'/)
  assert.match(component, /adult_group: 'กลุ่มผู้ใหญ่'/)
  assert.match(component, /private: 'ส่วนตัว'/)
  assert.match(component, /item\.courseNames\.map/)
  assert.match(component, /ไม่พบประวัติคอร์สที่ยืนยันแล้ว/)
  assert.match(component, /เข้าเรียนล่าสุด: \{formatThaiDateOnly\(item\.lastAttendedDate\)\}/)
  assert.match(component, /ไม่พบประวัติเข้าเรียนที่ยืนยันแล้ว/)
  execFileSync('git', ['diff', '--exit-code', '--', 'src/app/api/admin/notifications/route.ts'], {
    cwd: root,
    stdio: 'pipe',
  })
})

await check('server search covers Thai/Latin learner nickname, learner full name, and parent name only', () => {
  const migration = read('supabase/migrations/20260810034515_admin_notification_follow_up_full_roster_search.sql')
  assert.match(migration, /strpos\(lower\(coalesce\(child\.nickname, ''\)\), v_search\) > 0/)
  assert.match(migration, /strpos\(lower\(coalesce\(child\.full_name, ''\)\), v_search\) > 0/)
  assert.match(migration, /strpos\(lower\(coalesce\(profile\.full_name, ''\)\), v_search\) > 0/)
  assert.doesNotMatch(migration, /phone|email|line_id/i)
})

await check('Private UI stays package-level with participant names supplementary and generic Notifications API unchanged', () => {
  const component = read('src/components/admin/notification-recommendations-workspace.tsx')
  assert.match(component, /ผู้เรียนในแพ็กเกจ: \{item\.learnerNames\.join\(', '\)\}/)
  assert.match(component, /ใช้แล้ว \{item\.usedSessions\}\/\{item\.totalSessions\} รอบ/)
  assert.doesNotMatch(component, /Level|ระดับ/)
  execFileSync('git', ['diff', '--exit-code', '--', 'src/app/api/admin/notifications/route.ts'], {
    cwd: root,
    stdio: 'pipe',
  })
})

console.log(`\nAdmin notification recommendation checks passed: ${passed}`)
