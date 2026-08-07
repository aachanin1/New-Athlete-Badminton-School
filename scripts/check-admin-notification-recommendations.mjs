import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  buildFollowUpEligibility,
  buildLowEnrollmentRecommendations,
  buildNearCourseRecommendations,
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
    { used: result[0].usedSessions, total: result[0].totalSessions, learnerName: result[0].learnerName },
    { used: 35, total: 35, learnerName: null }
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

function queueSummary(population, seen, batch, sent) {
  const pending = batch.filter((id) => !sent.has(id))
  const waiting = population.filter((id) => !seen.has(id))
  return {
    total: pending.length + waiting.length,
    current: pending.length,
    waiting: waiting.length,
    processed: sent.size,
  }
}

await check('durable 140-person queue follows 30→29, bulk 10, complete/load-next math', () => {
  const population = Array.from({ length: 140 }, (_, index) => `user-${index + 1}`)
  const firstBatch = population.slice(0, 30)
  const seen = new Set(firstBatch)
  assert.deepEqual(queueSummary(population, seen, firstBatch, new Set()), { total: 140, current: 30, waiting: 110, processed: 0 })
  assert.deepEqual(queueSummary(population, seen, firstBatch, new Set(firstBatch.slice(0, 1))), { total: 139, current: 29, waiting: 110, processed: 1 })
  assert.deepEqual(queueSummary(population, seen, firstBatch, new Set(firstBatch.slice(0, 10))), { total: 130, current: 20, waiting: 110, processed: 10 })

  const completed = new Set(firstBatch)
  assert.deepEqual(queueSummary(population, seen, firstBatch, completed), { total: 110, current: 0, waiting: 110, processed: 30 })
  const nextBatch = population.slice(30, 60)
  nextBatch.forEach((id) => seen.add(id))
  assert.deepEqual(queueSummary(population, seen, nextBatch, new Set()), { total: 110, current: 30, waiting: 80, processed: 0 })
})

await check('workspace enforces 10-per-page, Preview, bulk max 10, and no automatic batch mutation', () => {
  const component = read('src/components/admin/notification-recommendations-workspace.tsx')
  const page = read('src/app/(admin)/admin/notifications/page.tsx')
  assert.match(component, /const PAGE_SIZE = 10/)
  assert.match(component, /Preview การส่งพร้อมกัน/)
  assert.match(component, /selectedUserIds\.size >= 10/)
  assert.match(component, /Bulk เป็น all-or-nothing/)
  assert.doesNotMatch(component, /useEffect\s*\(/)
  assert.doesNotMatch(page, /admin_notification_follow_up_start_batch_v1/)
  assert.doesNotMatch(page, /admin_notification_follow_up_send_v1/)
})

await check('service-only migration provides durable evidence, locks, idempotency, revalidation, RLS, and least privilege', () => {
  const migration = read('supabase/migrations/20260807155346_admin_notification_recommendation_tracking.sql')
  assert.match(migration, /notification_id uuid unique references public\.notifications/)
  assert.match(migration, /pg_advisory_xact_lock/)
  assert.match(migration, /request_key uuid primary key/)
  assert.match(migration, /limit 30/)
  assert.match(migration, /cardinality\(recipient_ids\) between 1 and 10/)
  assert.match(migration, /admin_notification_follow_up_is_eligible_v1\(item\.user_id\)/)
  assert.match(migration, /bulk recipients must not have prior verified or ambiguous legacy evidence/)
  assert.match(migration, /enable row level security/g)
  assert.match(migration, /revoke all on table[\s\S]*from public, anon, authenticated/)
  assert.match(migration, /grant execute[\s\S]*to service_role/)
  assert.match(migration, /security invoker/g)
  assert.doesNotMatch(migration, /insert into public\.admin_notification_follow_up_(campaigns|batches|items)[\s\S]*select[\s\S]*from public\.(bookings|notifications);\s*$/)
})

await check('API rejects forged source markers, authenticates Admin, and GET remains read-only', () => {
  const route = read('src/app/api/admin/notifications/customer-follow-up/route.ts')
  const getSection = route.slice(route.indexOf('export async function GET'), route.indexOf('export async function POST'))
  assert.match(route, /requireAdminMenuAccess\('notifications'\)/)
  assert.match(route, /FORGED_SOURCE_KEYS/)
  assert.match(route, /ไม่รับ source marker หรือ batch identity จาก Client/)
  assert.doesNotMatch(getSection, /start_batch_v1|send_v1|\.insert\(|\.update\(|\.delete\(/)
})

await check('Private UI is booking/package-only and generic Notifications API remains unchanged', () => {
  const component = read('src/components/admin/notification-recommendations-workspace.tsx')
  assert.match(component, /item\.courseName !== 'private' && item\.learnerName/)
  assert.match(component, /ใช้แล้ว \{item\.usedSessions\}\/\{item\.totalSessions\} รอบ/)
  assert.doesNotMatch(component, /Level|ระดับ/)
  execFileSync('git', ['diff', '--exit-code', '--', 'src/app/api/admin/notifications/route.ts'], {
    cwd: root,
    stdio: 'pipe',
  })
})

console.log(`\nAdmin notification recommendation checks passed: ${passed}`)
