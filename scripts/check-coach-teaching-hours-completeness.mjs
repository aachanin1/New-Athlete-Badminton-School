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
  getCoachTeachingHourSourceRead,
} = await import('../src/lib/coach-teaching-hours.ts')
const {
  buildAdminPayrollSummaries,
  loadAdminPayrollCoachWeekDetail,
} = await import('../src/lib/admin-payroll-read.ts')
const {
  calculateTeachingPayEntries,
  COACH_TEACHING_RULES,
  getTeachingWeekInfoBangkok,
} = await import('../src/lib/coach-teaching-rules.ts')

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
let passed = 0
async function check(name, action) {
  await action()
  passed += 1
  console.log(`PASS ${passed}: ${name}`)
}

function nestedValue(row, rawPath) {
  const normalized = rawPath.replace(/\(([^)]+)\)/g, '.$1')
  return normalized.split('.').filter(Boolean).reduce((value, key) => value?.[key], row)
}

class FakeQuery {
  constructor(database, table) {
    this.database = database
    this.table = table
    this.filters = []
    this.orders = []
    this.from = 0
    this.to = Number.MAX_SAFE_INTEGER
    this.single = false
  }

  eq(column, value) { this.filters.push(['eq', column, value]); return this }
  gte(column, value) { this.filters.push(['gte', column, value]); return this }
  lt(column, value) { this.filters.push(['lt', column, value]); return this }
  in(column, values) { this.filters.push(['in', column, values]); return this }
  order(column, options = {}) { this.orders.push([column, options.ascending !== false]); return this }
  range(from, to) { this.from = from; this.to = to; return this }
  maybeSingle() { this.single = true; return this }

  execute() {
    const errorMessage = this.database.errors[this.table]
    if (errorMessage) return { data: null, error: { message: errorMessage }, count: null }
    let rows = [...(this.database.tables[this.table] || [])]
    for (const [operator, column, expected] of this.filters) {
      rows = rows.filter((row) => {
        const actual = nestedValue(row, column)
        if (operator === 'eq') return actual === expected
        if (operator === 'gte') return actual >= expected
        if (operator === 'lt') return actual < expected
        if (operator === 'in') return expected.includes(actual)
        return true
      })
    }
    rows.sort((left, right) => {
      for (const [column, ascending] of this.orders) {
        const leftValue = nestedValue(left, column)
        const rightValue = nestedValue(right, column)
        const comparison = String(leftValue ?? '').localeCompare(String(rightValue ?? ''))
        if (comparison !== 0) return ascending ? comparison : -comparison
      }
      return 0
    })
    const count = this.database.countOverrides[this.table] ?? rows.length
    const page = rows.slice(this.from, this.to + 1)
    return {
      data: this.single ? (page[0] || null) : page,
      error: null,
      count,
    }
  }

  then(resolve, reject) {
    return Promise.resolve(this.execute()).then(resolve, reject)
  }
}

class FakeSupabase {
  constructor(tables, { errors = {}, countOverrides = {} } = {}) {
    this.tables = tables
    this.errors = errors
    this.countOverrides = countOverrides
  }

  from(table) {
    return { select: () => new FakeQuery(this, table) }
  }
}

function slot(id, date, startTime = '10:00:00', endTime = '12:00:00', course = 'Kids Group') {
  return {
    id,
    branch_id: 'branch-a',
    date,
    start_time: startTime,
    end_time: endTime,
    branches: { name: 'สาขาทดสอบ' },
    course_types: { name: course },
  }
}

function profile(name, employmentType = 'part_time') {
  return { full_name: name, coach_employment_type: employmentType }
}

function group(id, coachId, scheduleSlot, sessionIds, sortOrder = 0) {
  return {
    id,
    coach_id: coachId,
    schedule_slot_id: scheduleSlot.id,
    sort_order: sortOrder,
    schedule_slots: scheduleSlot,
    profiles: profile(coachId),
    coach_assignment_group_students: sessionIds.map((booking_session_id) => ({ booking_session_id })),
  }
}

function legacyAssignment(id, coachId, scheduleSlot) {
  return {
    id,
    coach_id: coachId,
    schedule_slot_id: scheduleSlot.id,
    schedule_slots: scheduleSlot,
    profiles: profile(coachId),
  }
}

function bookingSession(id, scheduleSlot, {
  bookingStatus = 'verified',
  status = 'scheduled',
  rescheduledFromId = null,
  isMakeup = false,
} = {}) {
  return {
    id,
    schedule_slot_id: scheduleSlot.id,
    rescheduled_from_id: rescheduledFromId,
    is_makeup: isMakeup,
    status,
    bookings: { status: bookingStatus },
  }
}

function attendance(id, sessionId, status = 'present') {
  return { id, booking_session_id: sessionId, status }
}

function checkin(id, coachId, scheduleSlot, {
  photo = 'evidence.jpg',
  lat = 13.7,
  lng = 100.5,
} = {}) {
  return {
    id,
    coach_id: coachId,
    schedule_slot_id: scheduleSlot.id,
    checkin_time: `${scheduleSlot.date}T${scheduleSlot.start_time}+07:00`,
    photo_url: photo,
    location_lat: lat,
    location_lng: lng,
  }
}

function createFixtureDatabase() {
  const tables = {
    coach_assignment_groups: [],
    coach_assignments: [],
    booking_sessions: [],
    coach_checkins: [],
    attendance: [],
    lesson_wallet_credits: [],
    coach_weekly_teaching_summaries: [],
    system_settings: [{ value: null }],
  }
  const addExact = ({ id, coachId, scheduleSlot, sessionId, booking = {}, evidence = {}, withAttendance = true, sortOrder = 0 }) => {
    tables.coach_assignment_groups.push(group(id, coachId, scheduleSlot, [sessionId], sortOrder))
    tables.booking_sessions.push(bookingSession(sessionId, scheduleSlot, booking))
    if (evidence.checkin !== false) tables.coach_checkins.push(checkin(`checkin-${id}`, coachId, scheduleSlot, evidence))
    if (withAttendance) tables.attendance.push(attendance(`attendance-${id}`, sessionId))
  }

  for (let index = 0; index < 1000; index += 1) {
    const id = String(index).padStart(4, '0')
    const scheduleSlot = slot(`filler-slot-${id}`, '2026-07-01')
    addExact({ id: `filler-group-${id}`, coachId: 'coach-filler', scheduleSlot, sessionId: `filler-session-${id}` })
  }

  const cakeSlots = [
    slot('cake-1', '2026-07-20', '15:00:00', '17:00:00'),
    slot('cake-2', '2026-07-20', '17:00:00', '19:00:00'),
    slot('cake-3', '2026-07-23', '15:00:00', '17:00:00'),
    slot('cake-4', '2026-07-23', '19:00:00', '21:00:00', 'Adult Group'),
    slot('cake-5', '2026-07-25', '16:00:00', '18:00:00'),
  ]
  cakeSlots.forEach((scheduleSlot, index) => addExact({
    id: `cake-group-${index}`,
    coachId: 'coach-cake',
    scheduleSlot,
    sessionId: `cake-session-${index}`,
  }))

  const domeSlot = slot('dome-private', '2026-08-01', '17:00:00', '18:00:00', 'Private')
  addExact({ id: 'zz-dome-group-after-cutoff', coachId: 'coach-dome', scheduleSlot: domeSlot, sessionId: 'dome-session' })

  const multiSlot = slot('multi-group-slot', '2026-07-27')
  addExact({ id: 'multi-group-a', coachId: 'coach-multi', scheduleSlot: multiSlot, sessionId: 'multi-session-a', sortOrder: 0 })
  addExact({ id: 'multi-group-b', coachId: 'coach-multi', scheduleSlot: multiSlot, sessionId: 'multi-session-b', sortOrder: 1 })

  const conflictSlot = slot('conflict-slot', '2026-07-28')
  tables.coach_assignment_groups.push(group('conflict-a', 'coach-conflict', conflictSlot, ['conflict-session'], 0))
  tables.coach_assignment_groups.push(group('conflict-b', 'coach-conflict', conflictSlot, ['conflict-session'], 1))
  tables.booking_sessions.push(bookingSession('conflict-session', conflictSlot))
  tables.coach_checkins.push(checkin('conflict-checkin', 'coach-conflict', conflictSlot))
  tables.attendance.push(attendance('conflict-attendance', 'conflict-session'))

  const missingCheckinSlot = slot('missing-checkin-slot', '2026-07-29')
  addExact({ id: 'missing-checkin', coachId: 'coach-evidence', scheduleSlot: missingCheckinSlot, sessionId: 'missing-checkin-session', evidence: { checkin: false } })
  const missingPhotoSlot = slot('missing-photo-slot', '2026-07-30')
  addExact({ id: 'missing-photo', coachId: 'coach-evidence', scheduleSlot: missingPhotoSlot, sessionId: 'missing-photo-session', evidence: { photo: null } })
  const missingLocationSlot = slot('missing-location-slot', '2026-07-31')
  addExact({ id: 'missing-location', coachId: 'coach-evidence', scheduleSlot: missingLocationSlot, sessionId: 'missing-location-session', evidence: { lat: null, lng: null } })
  const missingAttendanceSlot = slot('missing-attendance-slot', '2026-08-01')
  addExact({ id: 'missing-attendance', coachId: 'coach-evidence', scheduleSlot: missingAttendanceSlot, sessionId: 'missing-attendance-session', withAttendance: false })
  const noEligibleSlot = slot('no-eligible-slot', '2026-08-02')
  addExact({ id: 'no-eligible', coachId: 'coach-evidence', scheduleSlot: noEligibleSlot, sessionId: 'no-eligible-session', booking: { bookingStatus: 'pending_payment' } })

  const emptyExactSlot = slot('empty-exact-slot', '2026-08-02', '13:00:00', '15:00:00')
  tables.coach_assignment_groups.push(group('empty-exact-group', 'coach-empty', emptyExactSlot, []))
  tables.coach_assignments.push(legacyAssignment('empty-exact-legacy', 'coach-empty', emptyExactSlot))

  const allAbsentSlot = slot('all-absent-slot', '2026-08-02', '15:00:00', '17:00:00')
  addExact({ id: 'all-absent-group', coachId: 'coach-absent', scheduleSlot: allAbsentSlot, sessionId: 'all-absent-session', booking: { status: 'absent' } })
  tables.attendance.splice(
    tables.attendance.findIndex((row) => row.booking_session_id === 'all-absent-session'),
    1,
    attendance('attendance-all-absent', 'all-absent-session', 'absent'),
  )

  const legacySlot = slot('legacy-only-slot', '2026-07-26')
  tables.coach_assignments.push(legacyAssignment('legacy-only', 'coach-legacy', legacySlot))
  const legacySessions = [
    bookingSession('legacy-normal', legacySlot),
    bookingSession('legacy-user-reschedule', legacySlot, { rescheduledFromId: 'old-a' }),
    bookingSession('legacy-wallet', legacySlot, { rescheduledFromId: 'old-b' }),
    bookingSession('legacy-makeup', legacySlot, { rescheduledFromId: 'old-c', isMakeup: true }),
  ]
  tables.booking_sessions.push(...legacySessions)
  tables.lesson_wallet_credits.push({ id: 'wallet-credit', redeemed_session_id: 'legacy-wallet' })
  tables.coach_checkins.push(checkin('legacy-checkin', 'coach-legacy', legacySlot))
  for (const sessionId of ['legacy-normal', 'legacy-wallet', 'legacy-makeup']) {
    tables.attendance.push(attendance(`attendance-${sessionId}`, sessionId))
  }

  tables.coach_assignments.push(legacyAssignment('legacy-shadowed', 'coach-shadowed', cakeSlots[0]))
  return new FakeSupabase(tables)
}

const fixtureDb = createFixtureDatabase()
const sourceRead = await getCoachTeachingHourSourceRead(fixtureDb, {
  startDate: '2026-06-29',
  endDateExclusive: '2026-08-03',
  includeExcluded: true,
})

await check('more than 1,000 exact assignment groups are paged without row loss', () => {
  assert.ok(sourceRead.metrics.rowsBySource.coach_assignment_groups > 1000)
  assert.equal(sourceRead.metrics.callsBySource.coach_assignment_groups, 2)
  assert.ok(sourceRead.rows.some((row) => row.assignment_id === 'zz-dome-group-after-cutoff'))
})

await check('Dome private fixture after the old cutoff is counted as exactly one hour', () => {
  const dome = sourceRead.rows.find((row) => row.coach_id === 'coach-dome')
  assert.equal(dome?.classification, 'counted')
  const [entry] = calculateTeachingPayEntries([dome], COACH_TEACHING_RULES.part_time)
  assert.equal(entry.hours, 1)
  assert.equal(entry.isPrivate, true)
})

await check('Cake week reconciles to five rounds and ten hours', () => {
  const summary = buildAdminPayrollSummaries(sourceRead.rows, COACH_TEACHING_RULES, [])
  const cake = summary.coaches.find((coach) => coach.coach_id === 'coach-cake')
  const week = cake?.weeks.find((item) => item.week_start === '2026-07-20')
  assert.equal(week?.countable_round_count, 5)
  assert.equal(week?.total_hours, 10)
})

await check('multiple exact groups for one coach and slot aggregate learners but count time once', () => {
  const rows = sourceRead.rows.filter((row) => row.coach_id === 'coach-multi')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].student_count, 2)
  assert.equal(calculateTeachingPayEntries(rows, COACH_TEACHING_RULES.part_time)[0].hours, 2)
})

await check('duplicate exact learner membership fails closed into review', () => {
  const row = sourceRead.rows.find((item) => item.coach_id === 'coach-conflict')
  assert.equal(row?.classification, 'review')
  assert.ok(row?.evidence_reasons.includes('duplicate_assignment_data'))
  assert.equal(row?.is_verified, false)
})

await check('exact assignment model takes precedence over a legacy assignment on the same slot', () => {
  assert.equal(sourceRead.rows.some((row) => row.assignment_id === 'legacy-shadowed'), false)
})

await check('genuine legacy fallback keeps normal, wallet, and makeup but excludes pending user reschedule-in', () => {
  const row = sourceRead.rows.find((item) => item.assignment_id === 'legacy-only')
  assert.equal(row?.assignment_source, 'legacy')
  assert.equal(row?.student_count, 3)
  assert.equal(row?.classification, 'counted')
})

await check('unverified booking produces an explicit excluded row with no eligible learner', () => {
  const row = sourceRead.rows.find((item) => item.assignment_id === 'no-eligible')
  assert.equal(row?.classification, 'excluded')
  assert.deepEqual(row?.evidence_reasons, ['no_eligible_learner'])
})

await check('truly empty exact group suppresses Legacy without creating a Payroll operational row', () => {
  assert.equal(sourceRead.rows.some((row) => row.assignment_id === 'empty-exact-group'), false)
  assert.equal(sourceRead.rows.some((row) => row.assignment_id === 'empty-exact-legacy'), false)
})

await check('all-absent exact membership remains legitimate assignment evidence', () => {
  const row = sourceRead.rows.find((item) => item.assignment_id === 'all-absent-group')
  assert.equal(row?.student_count, 1)
  assert.equal(row?.absent_count, 1)
  assert.equal(row?.classification, 'counted')
})

await check('missing evidence reasons remain deterministic and visible', () => {
  const reasons = new Map(sourceRead.rows
    .filter((row) => row.coach_id === 'coach-evidence')
    .map((row) => [row.assignment_id, row.classification_reason]))
  assert.equal(reasons.get('missing-checkin'), 'missing_checkin')
  assert.equal(reasons.get('missing-photo'), 'missing_photo')
  assert.equal(reasons.get('missing-location'), 'missing_location')
  assert.equal(reasons.get('missing-attendance'), 'missing_attendance')
})

await check('Full-Time, Half-Time, and Part-Time thresholds and rates remain unchanged', () => {
  const row = { date: '2026-07-20', start_time: '00:00:00', end_time: '02:00:00', course_type: 'Kids Group' }
  const fullRows = Array.from({ length: 15 }, (_, index) => ({ ...row, start_time: `${String(index).padStart(2, '0')}:00:00`, end_time: `${String(index + 2).padStart(2, '0')}:00:00` }))
  const full = calculateTeachingPayEntries(fullRows, COACH_TEACHING_RULES.full_time)
  assert.equal(full.reduce((sum, entry) => sum + entry.payableHours, 0), 5)
  assert.equal(full.reduce((sum, entry) => sum + entry.payableAmount, 0), 1000)
  const half = calculateTeachingPayEntries(fullRows.slice(0, 7), COACH_TEACHING_RULES.half_time)
  assert.equal(half.reduce((sum, entry) => sum + entry.payableHours, 0), 1.5)
  assert.equal(half.reduce((sum, entry) => sum + entry.payableAmount, 0), 300)
  const part = calculateTeachingPayEntries([row], COACH_TEACHING_RULES.part_time)
  assert.equal(part[0].payableHours, 2)
  assert.equal(part[0].payableAmount, 500)
})

await check('back-to-back slots remain separate deterministic rounds', () => {
  const entries = calculateTeachingPayEntries([
    { date: '2026-07-20', start_time: '15:00:00', end_time: '17:00:00', course_type: 'Kids Group' },
    { date: '2026-07-20', start_time: '17:00:00', end_time: '19:00:00', course_type: 'Kids Group' },
  ], COACH_TEACHING_RULES.part_time)
  assert.equal(entries.length, 2)
  assert.equal(entries.reduce((sum, entry) => sum + entry.hours, 0), 4)
})

await check('Monday-Sunday weeks remain canonical across the year boundary', () => {
  const week = getTeachingWeekInfoBangkok('2027-01-01')
  assert.equal(week.weekStart, '2026-12-28')
  assert.equal(week.weekEnd, '2027-01-03')
})

await check('Admin summary and on-demand detail use the same canonical totals', async () => {
  const detail = await loadAdminPayrollCoachWeekDetail(fixtureDb, 'coach-cake', '2026-07-20', '2026-07-26')
  const summary = buildAdminPayrollSummaries(sourceRead.rows, COACH_TEACHING_RULES, [])
  const week = summary.coaches.find((coach) => coach.coach_id === 'coach-cake')?.weeks
    .find((item) => item.week_start === '2026-07-20')
  assert.equal(detail.week.countable_round_count, week?.countable_round_count)
  assert.equal(detail.week.total_hours, week?.total_hours)
  assert.equal(detail.week.payable_amount, week?.payable_amount)
})

await check('assignment query failures fail closed with a descriptive error', async () => {
  const database = new FakeSupabase({ coach_assignment_groups: [], coach_assignments: [] }, {
    errors: { coach_assignment_groups: 'forced assignment failure' },
  })
  await assert.rejects(
    getCoachTeachingHourSourceRead(database, { startDate: '2026-07-01', endDateExclusive: '2026-07-08' }),
    /assignment groups page 1 query failed: forced assignment failure/,
  )
})

await check('incomplete pagination fails closed instead of silently truncating', async () => {
  const database = new FakeSupabase({ coach_assignment_groups: [], coach_assignments: [] }, {
    countOverrides: { coach_assignment_groups: 1001 },
  })
  await assert.rejects(
    getCoachTeachingHourSourceRead(database, { startDate: '2026-07-01', endDateExclusive: '2026-07-08' }),
    /pagination incomplete: fetched 0 of 1001/,
  )
})

await check('annual source reads are rejected so protected consumers stay bounded', async () => {
  await assert.rejects(
    getCoachTeachingHourSourceRead(fixtureDb, { startDate: '2026-01-01', endDateExclusive: '2027-01-01' }),
    /range exceeds 62 days/,
  )
})

await check('weekly close still calculates from the canonical teaching-hour source', () => {
  const route = read('src/app/api/admin/coach-payouts/route.ts')
  assert.match(route, /getCoachTeachingHourSourceRows\(supabase/)
  assert.match(route, /calculateTeachingPayEntries\(verifiedRows, rule\)/)
})

await check('Coach Hours remains a protected bounded consumer of the shared source', () => {
  const page = read('src/app/(coach)/coach/hours/page.tsx')
  assert.match(page, /getCoachTeachingHourSourceRows\(supabase/)
  assert.match(page, /startDate: monthStartKey/)
  assert.match(page, /endDateExclusive: toInputDate\(nextMonthStart\)/)
})

console.log(`\nCoach Teaching Hours completeness checks passed: ${passed}`)
