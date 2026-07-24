import { expect, test, type Page } from '@playwright/test'
import {
  TEST_ADMIN_ACCOUNT,
  TEST_ACCOUNT,
  createLocalAdmin,
  readBookingFixture,
} from '../booking-regression/local-supabase'

const IDS = {
  slot: 'a1000000-0000-4000-8000-000000000001',
  forwardSlot: 'a1000000-0000-4000-8000-000000000002',
  overlapSlot: 'a1000000-0000-4000-8000-000000000003',
  booking: 'a2000000-0000-4000-8000-000000000001',
  children: [
    'a3000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000002',
    'a3000000-0000-4000-8000-000000000003',
    'a3000000-0000-4000-8000-000000000004',
  ],
  forwardChildren: [
    'a3000000-0000-4000-8000-000000000011',
    'a3000000-0000-4000-8000-000000000012',
    'a3000000-0000-4000-8000-000000000013',
  ],
  sessions: [
    'a4000000-0000-4000-8000-000000000001',
    'a4000000-0000-4000-8000-000000000002',
    'a4000000-0000-4000-8000-000000000003',
    'a4000000-0000-4000-8000-000000000004',
  ],
  forwardSessions: [
    'a4000000-0000-4000-8000-000000000011',
    'a4000000-0000-4000-8000-000000000012',
    'a4000000-0000-4000-8000-000000000013',
  ],
  overlapSession: 'a4000000-0000-4000-8000-000000000014',
  validGroup: 'a5000000-0000-4000-8000-000000000001',
  unassignedGroup: 'a5000000-0000-4000-8000-000000000002',
  bulkBooking: 'b2000000-0000-4000-8000-000000000001',
  augustBooking: 'b2000000-0000-4000-8000-999999999999',
  augustChild: 'b3000000-0000-4000-8000-999999999999',
  augustSlot: 'b1000000-0000-4000-8000-999999999999',
  augustSession: 'b4000000-0000-4000-8000-999999999999',
} as const

test.describe.configure({ mode: 'serial' })

let coachUserId = ''
let standardAdminUserId = ''
const HEAD_COACH_EMAIL = 'admin-schedule-coach@example.com'
const STANDARD_ADMIN = {
  email: 'admin-schedule-standard@example.com',
  password: TEST_ADMIN_ACCOUNT.password,
}

function assertNoError(error: { message?: string } | null, label: string) {
  if (error) throw new Error(`${label}: ${error.message || JSON.stringify(error)}`)
}

async function loginAsAdmin(page: Page) {
  await login(page, TEST_ADMIN_ACCOUNT.email)
}

async function loginAsHeadCoach(page: Page) {
  await page.goto('/auth/login')
  await page.locator('#email').fill(HEAD_COACH_EMAIL)
  await page.locator('#password').fill(TEST_ADMIN_ACCOUNT.password)
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
  await page.waitForURL(/\/coach(?:\/|$)/)
}

async function login(page: Page, email: string) {
  await page.goto('/auth/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(TEST_ADMIN_ACCOUNT.password)
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
  await page.waitForURL(/\/admin(?:\/|$)/)
}

test.beforeAll(async () => {
  const admin = createLocalAdmin()
  const fixture = readBookingFixture()
  const { data: coachUser, error: coachUserError } = await admin.auth.admin.createUser({
    email: HEAD_COACH_EMAIL,
    password: TEST_ADMIN_ACCOUNT.password,
    email_confirm: true,
    user_metadata: { full_name: 'Fixture Coach' },
  })
  assertNoError(coachUserError, 'create fixture coach')
  if (!coachUser.user) throw new Error('create fixture coach: user missing')
  coachUserId = coachUser.user.id

  const { data: standardAdmin, error: standardAdminError } = await admin.auth.admin.createUser({
    email: STANDARD_ADMIN.email,
    password: STANDARD_ADMIN.password,
    email_confirm: true,
    user_metadata: { full_name: 'Fixture Standard Admin' },
  })
  assertNoError(standardAdminError, 'create fixture standard admin')
  if (!standardAdmin.user) throw new Error('create fixture standard admin: user missing')
  standardAdminUserId = standardAdmin.user.id
  assertNoError((await admin.from('profiles').update({
    full_name: 'Fixture Standard Admin',
    role: 'admin',
  }).eq('id', standardAdminUserId)).error, 'update fixture standard admin profile')

  assertNoError((await admin.from('profiles').update({
    full_name: 'Fixture Coach',
    role: 'head_coach',
  }).eq('id', coachUserId)).error, 'update fixture coach profile')
  assertNoError((await admin.from('coach_branches').insert({
    coach_id: coachUserId,
    branch_id: fixture.branchId,
  })).error, 'insert fixture coach branch')

  assertNoError((await admin.from('schedule_slots').insert({
    id: IDS.slot,
    template_id: null,
    branch_id: fixture.branchId,
    course_type_id: fixture.kidsCourseId,
    date: '2026-07-17',
    start_time: '20:00',
    end_time: '22:00',
    max_students: 6,
    current_students: 4,
    status: 'open',
  })).error, 'insert fixture slot')

  assertNoError((await admin.from('schedule_slots').insert([
    {
      id: IDS.forwardSlot,
      template_id: null,
      branch_id: fixture.branchId,
      course_type_id: fixture.kidsCourseId,
      date: '2026-07-30',
      start_time: '17:00',
      end_time: '19:00',
      max_students: 6,
      current_students: 3,
      status: 'open',
    },
    {
      id: IDS.overlapSlot,
      template_id: null,
      branch_id: fixture.branchId,
      course_type_id: fixture.kidsCourseId,
      date: '2026-07-30',
      start_time: '18:30',
      end_time: '20:30',
      max_students: 6,
      current_students: 1,
      status: 'open',
    },
  ])).error, 'insert mixed-Level and overlap fixture slots')

  const learnerNames = [
    { fullName: 'Schedule Fixture Learner 1', nickname: 'SF1' },
    { fullName: 'Café Fixture Learner', nickname: 'ก' },
    { fullName: 'Literal % _ \\ , () Fixture Learner', nickname: 'LIT' },
    { fullName: 'Schedule Fixture Learner 4', nickname: 'SF4' },
  ]
  assertNoError((await admin.from('children').insert(IDS.children.map((id, index) => ({
    id,
    parent_id: fixture.userId,
    full_name: learnerNames[index].fullName,
    nickname: learnerNames[index].nickname,
    date_of_birth: '2015-01-01',
  })))).error, 'insert fixture learners')
  assertNoError((await admin.from('children').insert(IDS.forwardChildren.map((id, index) => ({
    id,
    parent_id: fixture.userId,
    full_name: `Coach Mixed Learner ${index + 1}`,
    nickname: `MX${index + 1}`,
    date_of_birth: '2015-01-01',
  })))).error, 'insert mixed-Level Coach learners')
  assertNoError((await admin.from('children').insert({
    id: IDS.augustChild,
    parent_id: fixture.userId,
    full_name: 'August Only Marker',
    nickname: 'AUGONLY',
    date_of_birth: '2015-01-01',
  })).error, 'insert outside-month fixture learner')

  assertNoError((await admin.from('bookings').insert({
    id: IDS.booking,
    user_id: fixture.userId,
    learner_type: 'child',
    child_id: null,
    branch_id: fixture.branchId,
    course_type_id: fixture.kidsCourseId,
    month: 7,
    year: 2026,
    total_sessions: 4,
    total_price: 0,
    status: 'verified',
  })).error, 'insert fixture booking')

  assertNoError((await admin.from('booking_sessions').insert(IDS.sessions.map((id, index) => ({
    id,
    booking_id: IDS.booking,
    schedule_slot_id: IDS.slot,
    date: '2026-07-17',
    start_time: '20:00',
    end_time: '22:00',
    branch_id: fixture.branchId,
    child_id: IDS.children[index],
    status: index === 3 ? 'walleted' : 'scheduled',
  })))).error, 'insert fixture sessions')

  assertNoError((await admin.from('booking_sessions').insert([
    ...IDS.forwardSessions.map((id, index) => ({
      id,
      booking_id: IDS.booking,
      schedule_slot_id: IDS.forwardSlot,
      date: '2026-07-30',
      start_time: '17:00',
      end_time: '19:00',
      branch_id: fixture.branchId,
      child_id: IDS.forwardChildren[index],
      status: 'scheduled' as const,
    })),
    {
      id: IDS.overlapSession,
      booking_id: IDS.booking,
      schedule_slot_id: IDS.overlapSlot,
      date: '2026-07-30',
      start_time: '18:30',
      end_time: '20:30',
      branch_id: fixture.branchId,
      child_id: IDS.children[3],
      status: 'scheduled' as const,
    },
  ])).error, 'insert mixed-Level and overlap fixture sessions')

  assertNoError((await admin.from('student_levels').insert([
    { student_id: IDS.forwardChildren[0], student_type: 'child', level: 8, updated_by: fixture.adminUserId },
    { student_id: IDS.forwardChildren[1], student_type: 'child', level: 29, updated_by: fixture.adminUserId },
    { student_id: IDS.forwardChildren[2], student_type: 'child', level: 35, updated_by: fixture.adminUserId },
  ])).error, 'insert mixed-Level fixture levels')

  assertNoError((await admin.from('coach_assignment_groups').insert([
    {
      id: IDS.validGroup,
      schedule_slot_id: IDS.slot,
      coach_id: coachUserId,
      name: 'Fixture Assigned Group',
      sort_order: 0,
      created_by: fixture.adminUserId,
    },
    {
      id: IDS.unassignedGroup,
      schedule_slot_id: IDS.slot,
      coach_id: null,
      name: 'ยังไม่จัดกลุ่ม',
      sort_order: 1,
      created_by: fixture.adminUserId,
    },
  ])).error, 'insert fixture groups')

  assertNoError((await admin.from('coach_assignment_group_students').insert([
    {
      group_id: IDS.validGroup,
      booking_session_id: IDS.sessions[0],
      student_id: IDS.children[0],
      student_type: 'child',
    },
    {
      group_id: IDS.unassignedGroup,
      booking_session_id: IDS.sessions[1],
      student_id: IDS.children[1],
      student_type: 'child',
    },
  ])).error, 'insert fixture group memberships')

  const bulkDates = Array.from({ length: 31 }, (_, index) => index + 1).filter((day) => day !== 17)
  const bulkSlots = Array.from({ length: 205 }, (_, index) => {
    const hour = 6 + (index % 7) * 2
    const day = bulkDates[Math.floor(index / 7)]
    return {
      id: `b1000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      template_id: null,
      branch_id: fixture.branchId,
      course_type_id: fixture.kidsCourseId,
      date: `2026-07-${String(day).padStart(2, '0')}`,
      start_time: `${String(hour).padStart(2, '0')}:00`,
      end_time: `${String(hour + 2).padStart(2, '0')}:00`,
      max_students: 1,
      current_students: 1,
      status: 'open' as const,
    }
  })
  assertNoError((await admin.from('schedule_slots').insert([
    ...bulkSlots,
    {
      id: IDS.augustSlot,
      template_id: null,
      branch_id: fixture.branchId,
      course_type_id: fixture.kidsCourseId,
      date: '2026-08-01',
      start_time: '06:00',
      end_time: '08:00',
      max_students: 1,
      current_students: 1,
      status: 'open' as const,
    },
  ])).error, 'insert high-cardinality fixture slots')
  assertNoError((await admin.from('bookings').insert([
    {
      id: IDS.bulkBooking,
      user_id: fixture.userId,
      learner_type: 'child',
      child_id: IDS.children[3],
      branch_id: fixture.branchId,
      course_type_id: fixture.kidsCourseId,
      month: 7,
      year: 2026,
      total_sessions: 205,
      total_price: 0,
      status: 'verified' as const,
    },
    {
      id: IDS.augustBooking,
      user_id: fixture.userId,
      learner_type: 'child',
      child_id: IDS.augustChild,
      branch_id: fixture.branchId,
      course_type_id: fixture.kidsCourseId,
      month: 8,
      year: 2026,
      total_sessions: 1,
      total_price: 0,
      status: 'verified' as const,
    },
  ])).error, 'insert high-cardinality fixture bookings')
  assertNoError((await admin.from('booking_sessions').insert([
    ...bulkSlots.map((slot, index) => ({
      id: `b4000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      booking_id: IDS.bulkBooking,
      schedule_slot_id: slot.id,
      date: slot.date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      branch_id: fixture.branchId,
      child_id: IDS.children[3],
      status: 'scheduled' as const,
    })),
    {
      id: IDS.augustSession,
      booking_id: IDS.augustBooking,
      schedule_slot_id: IDS.augustSlot,
      date: '2026-08-01',
      start_time: '06:00',
      end_time: '08:00',
      branch_id: fixture.branchId,
      child_id: IDS.augustChild,
      status: 'scheduled' as const,
    },
  ])).error, 'insert high-cardinality fixture sessions')
  assertNoError((await admin.from('coach_assignment_groups').insert(bulkSlots.map((slot, index) => ({
    id: `b5000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    schedule_slot_id: slot.id,
    coach_id: null,
    name: `Bulk Fixture Group ${index + 1}`,
    sort_order: 0,
    created_by: fixture.adminUserId,
  })))).error, 'insert high-cardinality fixture groups')
})

test('production-active assignment write routes reject anonymous callers', async ({ request }) => {
  const groupWrite = await request.post('/api/coach/assignment-groups', {
    data: { scheduleSlotId: IDS.slot, branchId: 'anonymous', groups: [] },
  })
  expect(groupWrite.status()).toBe(401)

  const makeupWrite = await request.patch('/api/admin/makeup', {
    data: { action: 'assign_coach_to_round', session_ids: [IDS.sessions[0]] },
  })
  expect(makeupWrite.status()).toBe(401)

  const dayRead = await request.get('/api/admin/schedules/day?date=2026-07-17&year=2026&month=7')
  expect(dayRead.status()).toBe(401)
  const searchRead = await request.get('/api/admin/schedules/search?q=SF1&year=2026&month=7')
  expect(searchRead.status()).toBe(401)
})

test('local performance instrumentation measures summary, month, day, search, calls, and transfer', async ({ page }) => {
  await loginAsAdmin(page)
  const coldStarted = performance.now()
  const documentResponse = await page.goto('/admin/schedules?year=2026&month=7')
  const coldNavigationMs = Math.round((performance.now() - coldStarted) * 10) / 10
  if (!documentResponse) throw new Error('Admin schedules document response missing')
  const documentBytes = (await documentResponse.body()).byteLength
  const summaryRoot = page.getByTestId('admin-schedules-root')
  const summaryDurationMs = Number(await summaryRoot.getAttribute('data-summary-duration-ms'))
  const summaryExternalCalls = Number(await summaryRoot.getAttribute('data-summary-external-calls'))
  const summaryRows = JSON.parse(await summaryRoot.getAttribute('data-summary-row-counts') || '{}')
  const summaryCalls = JSON.parse(await summaryRoot.getAttribute('data-summary-call-counts') || '{}')
  expect(summaryExternalCalls).toBe(4)
  expect(summaryCalls.groupPages).toBe(1)
  expect(summaryRows.groups).toBe(207)
  expect(summaryRows.sessions).toBeGreaterThanOrEqual(209)
  const initialTransferredBytes = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    return [...navigation, ...resources].reduce((sum, entry) => sum + entry.transferSize, 0)
  })

  const warmNavigationSamples: number[] = []
  for (let index = 0; index < 5; index += 1) {
    const started = performance.now()
    await page.reload()
    warmNavigationSamples.push(Math.round((performance.now() - started) * 10) / 10)
  }
  const sortedWarm = warmNavigationSamples.toSorted((a, b) => a - b)
  const warmP95Ms = sortedWarm[Math.ceil(sortedWarm.length * 0.95) - 1]

  const monthStarted = performance.now()
  await page.getByTestId('admin-schedule-next-month').click()
  await page.waitForURL(/year=2026&month=8/)
  const monthChangeMs = Math.round((performance.now() - monthStarted) * 10) / 10
  await page.getByTestId('admin-schedule-previous-month').click()
  await page.waitForURL(/year=2026&month=7/)

  const dayResponsePromise = page.waitForResponse((response) => response.url().includes('/api/admin/schedules/day?'))
  const dayStarted = performance.now()
  await page.getByTestId('admin-schedule-calendar-day-2026-07-17').click()
  const dayResponse = await dayResponsePromise
  await expect(page.getByText('Fixture Assigned Group', { exact: true })).toBeVisible()
  const dayLoadMs = Math.round((performance.now() - dayStarted) * 10) / 10
  const dayPayload = await dayResponse.json()

  const searchResponsePromise = page.waitForResponse((response) => response.url().includes('/api/admin/schedules/search?'))
  const searchStarted = performance.now()
  await page.getByPlaceholder('ค้นหาผู้เรียน ผู้ปกครอง โค้ช สาขา...').fill('SF1')
  const searchResponse = await searchResponsePromise
  const searchPayload = await searchResponse.json()
  const searchLatencyMs = Math.round((performance.now() - searchStarted) * 10) / 10
  expect(dayPayload.performance.calls.sessionPages).toBe(1)
  expect(dayPayload.performance.calls.slotSessionPages).toBeUndefined()
  expect(dayPayload.performance.rows.slotSessionsDerived).toBe(3)
  expect(searchPayload.performance.externalCalls).toBe(6)
  expect(searchPayload.performance.rows.candidateSessions).toBe(1)
  expect(searchPayload.performance.rows.sessions).toBeUndefined()
  const dayProfiles = [
    { profile: 'low', date: '2026-07-31' },
    { profile: 'medium', date: '2026-07-17' },
    { profile: 'high', date: '2026-07-01' },
  ]
  const selectedDaySamples = []
  for (const sample of dayProfiles) {
    const started = performance.now()
    const response = await page.request.get(`/api/admin/schedules/day?date=${sample.date}&year=2026&month=7`)
    expect(response.status()).toBe(200)
    const payload = await response.json()
    selectedDaySamples.push({
      profile: sample.profile,
      clientMs: Math.round((performance.now() - started) * 10) / 10,
      serverMs: payload.performance.durationMs,
      externalCalls: payload.performance.externalCalls,
      sessionRows: payload.performance.rows.sessions || 0,
    })
    expect(payload.performance.externalCalls).toBeLessThanOrEqual(6)
  }
  const searchProfiles = [
    { profile: 'coach', value: 'Fixture Coach' },
    { profile: 'status', value: 'verified' },
  ]
  const representativeSearchSamples = [{
    profile: 'learner',
    clientMs: searchLatencyMs,
    serverMs: searchPayload.performance.durationMs,
    externalCalls: searchPayload.performance.externalCalls,
    candidateRows: searchPayload.performance.rows.candidateSessions || 0,
  }]
  for (const sample of searchProfiles) {
    const started = performance.now()
    const response = await page.request.get(
      `/api/admin/schedules/search?q=${encodeURIComponent(sample.value)}&year=2026&month=7`,
    )
    expect(response.status()).toBe(200)
    const payload = await response.json()
    representativeSearchSamples.push({
      profile: sample.profile,
      clientMs: Math.round((performance.now() - started) * 10) / 10,
      serverMs: payload.performance.durationMs,
      externalCalls: payload.performance.externalCalls,
      candidateRows: payload.performance.rows.candidateSessions || 0,
    })
  }
  console.log('ADMIN_SCHEDULE_PERFORMANCE', JSON.stringify({
    coldNavigationMs,
    warmNavigationSamples,
    warmP95Ms,
    monthChangeMs,
    dayLoadMs,
    searchLatencyMs,
    summaryDurationMs,
    summaryExternalCalls,
    dayServerDurationMs: dayPayload.performance.durationMs,
    dayExternalCalls: dayPayload.performance.externalCalls,
    searchServerDurationMs: searchPayload.performance.durationMs,
    searchExternalCalls: searchPayload.performance.externalCalls,
    summaryCalls,
    summaryRows,
    dayCalls: dayPayload.performance.calls,
    searchCalls: searchPayload.performance.calls,
    searchRows: searchPayload.performance.rows,
    selectedDaySamples,
    representativeSearchSamples,
    documentBytes,
    initialTransferredBytes,
  }))
})

test('authenticated Super Admin and standard Admin can use bounded day/search reads', async ({ browser }) => {
  const superContext = await browser.newContext()
  const superPage = await superContext.newPage()
  await loginAsAdmin(superPage)
  const superDay = await superPage.request.get('/api/admin/schedules/day?date=2026-07-17&year=2026&month=7')
  expect(superDay.status()).toBe(200)
  for (const query of [
    'SF1',
    TEST_ACCOUNT.fullName,
    'Fixture Coach',
    'สาขาทดสอบ Localhost',
    'kids_group',
    'verified',
    'ก',
    'Cafe\u0301',
    '%',
    '_',
    '\\',
    ',',
    '(',
  ]) {
    const response = await superPage.request.get(`/api/admin/schedules/search?q=${encodeURIComponent(query)}&year=2026&month=7`)
    expect(response.status()).toBe(200)
    const payload = await response.json()
    expect(payload.matchCount).toBeGreaterThan(0)
    expect(payload.dates.every((date: string) => date.startsWith('2026-07-'))).toBe(true)
    const serialized = JSON.stringify(payload)
    for (const forbidden of ['Café Fixture Learner', 'Literal % _', 'Fixture Coach', TEST_ACCOUNT.fullName]) {
      expect(serialized).not.toContain(forbidden)
    }
  }
  const isolatedJuly = await superPage.request.get('/api/admin/schedules/search?q=AUGONLY&year=2026&month=7')
  expect(isolatedJuly.status()).toBe(200)
  expect((await isolatedJuly.json()).matchCount).toBe(0)
  const isolatedAugust = await superPage.request.get('/api/admin/schedules/search?q=AUGONLY&year=2026&month=8')
  expect(isolatedAugust.status()).toBe(200)
  expect((await isolatedAugust.json()).matchCount).toBe(1)
  const filtered = await superPage.request.get(
    `/api/admin/schedules/search?q=SF1&year=2026&month=7&branch=${encodeURIComponent(readBookingFixture().branchId)}&course=kids_group`,
  )
  expect(filtered.status()).toBe(200)
  expect((await filtered.json()).matchCount).toBe(1)
  const bounded = await superPage.request.get('/api/admin/schedules/search?q=verified&year=2026&month=7')
  expect(bounded.status()).toBe(200)
  const boundedPayload = await bounded.json()
  expect(boundedPayload.roundKeys).toHaveLength(200)
  expect(boundedPayload.truncated).toBe(true)
  await superContext.close()

  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()
  await login(adminPage, STANDARD_ADMIN.email)
  const adminDay = await adminPage.request.get('/api/admin/schedules/day?date=2026-07-17&year=2026&month=7')
  expect(adminDay.status()).toBe(200)
  const adminSearch = await adminPage.request.get('/api/admin/schedules/search?q=Fixture%20Coach&year=2026&month=7')
  expect(adminSearch.status()).toBe(200)
  expect((await adminSearch.json()).matchCount).toBeGreaterThan(0)
  await adminContext.close()
})

test('Head Coach mixed-Level save is warning-only, atomic, and stable on desktop/mobile', async ({ page }) => {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`))

  await loginAsHeadCoach(page)
  const admin = createLocalAdmin()
  const branchId = readBookingFixture().branchId

  const saveGroups = async ({
    slotId = IDS.forwardSlot,
    groups,
  }: {
    slotId?: string
    groups: Array<{
      name: string
      coachId: string | null
      studentSessionIds: string[]
    }>
  }) => page.evaluate(async ({ targetSlotId, targetBranchId, payloadGroups }) => {
    const response = await fetch('/api/coach/assignment-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduleSlotId: targetSlotId,
        branchId: targetBranchId,
        groups: payloadGroups.map((group, index) => ({ ...group, sortOrder: index })),
      }),
    })
    return { status: response.status, body: await response.json() }
  }, { targetSlotId: slotId, targetBranchId: branchId, payloadGroups: groups })

  const duplicateCoach = await saveGroups({
    groups: [
      { name: 'กลุ่ม 1', coachId: coachUserId, studentSessionIds: [IDS.forwardSessions[0]] },
      { name: 'กลุ่ม 2', coachId: coachUserId, studentSessionIds: IDS.forwardSessions.slice(1) },
    ],
  })
  expect(duplicateCoach.status).toBe(400)

  const genericMixed = await saveGroups({
    groups: [{
      name: 'กลุ่ม 1',
      coachId: coachUserId,
      studentSessionIds: [...IDS.forwardSessions],
    }],
  })
  expect(genericMixed.status, JSON.stringify(genericMixed.body)).toBe(200)

  const { data: genericGroup, error: genericGroupError } = await admin
    .from('coach_assignment_groups')
    .select('id, name, coach_id, level_min, level_max, coach_assignment_group_students(booking_session_id)')
    .eq('schedule_slot_id', IDS.forwardSlot)
    .single()
  assertNoError(genericGroupError, 'read generic mixed-Level Coach save')
  expect(genericGroup?.name).toBe('กลุ่มผสม')
  expect(genericGroup?.coach_id).toBe(coachUserId)
  expect([genericGroup?.level_min, genericGroup?.level_max]).toEqual([8, 35])
  expect((genericGroup?.coach_assignment_group_students || []).map((row) => row.booking_session_id).toSorted())
    .toEqual([...IDS.forwardSessions].toSorted())

  const manualWithCount = await saveGroups({
    groups: [{
      name: 'กลาง-สูง (3 คน)',
      coachId: coachUserId,
      studentSessionIds: [...IDS.forwardSessions],
    }],
  })
  expect(manualWithCount.status, JSON.stringify(manualWithCount.body)).toBe(200)

  const { data: manualGroup, error: manualGroupError } = await admin
    .from('coach_assignment_groups')
    .select('id, name, coach_id')
    .eq('schedule_slot_id', IDS.forwardSlot)
    .single()
  assertNoError(manualGroupError, 'read manual mixed-Level Coach save')
  expect(manualGroup?.name).toBe('กลาง-สูง')

  const exactConflict = await saveGroups({
    slotId: IDS.overlapSlot,
    groups: [{
      name: 'กลุ่มทับเวลา',
      coachId: coachUserId,
      studentSessionIds: [IDS.overlapSession],
    }],
  })
  expect(exactConflict.status).toBe(409)

  const { count: overlapGroupCount, error: overlapGroupError } = await admin
    .from('coach_assignment_groups')
    .select('id', { count: 'exact', head: true })
    .eq('schedule_slot_id', IDS.overlapSlot)
  assertNoError(overlapGroupError, 'count exact-conflict partial groups')
  expect(overlapGroupCount).toBe(0)

  const { count: legacyCount, error: legacyError } = await admin
    .from('coach_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('schedule_slot_id', IDS.forwardSlot)
    .eq('coach_id', coachUserId)
  assertNoError(legacyError, 'count mixed-Level legacy rows')
  expect(legacyCount).toBe(1)

  const { data: reservation, error: reservationError } = await admin
    .from('coach_assignment_exact_reservations')
    .select('group_id, coach_id, schedule_slot_id')
    .eq('group_id', manualGroup?.id || '')
    .single()
  assertNoError(reservationError, 'read mixed-Level exact reservation')
  expect(reservation).toEqual({
    group_id: manualGroup?.id,
    coach_id: coachUserId,
    schedule_slot_id: IDS.forwardSlot,
  })

  assertNoError((await admin.from('coach_assignment_groups').delete().eq('schedule_slot_id', IDS.forwardSlot)).error, 'reset mixed-Level groups before UI flow')
  assertNoError((await admin.from('coach_assignments').delete().eq('schedule_slot_id', IDS.forwardSlot)).error, 'reset mixed-Level legacy rows before UI flow')
  browserErrors.length = 0

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/coach/assign-groups')
  const dateButton = page.getByRole('button').filter({ hasText: '30 ก.ค.' }).first()
  await expect(dateButton).toBeVisible()
  await dateButton.click()
  await page.getByRole('button').filter({ hasText: '17:00 - 19:00' }).first().click()

  const mixedLearnerRow = page.getByText('MX3', { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"rounded-md border bg-gray-50 p-2")][1]')
  await mixedLearnerRow.getByRole('combobox').click()
  await page.getByRole('option', { name: 'ชุดพื้นฐาน', exact: true }).click()

  const emptyGroupCard = page.getByText('0 คน', { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"rounded-lg border bg-white p-3")][1]')
  await emptyGroupCard.getByRole('button', { name: 'ลบกลุ่ม' }).click()

  const groupInput = page.locator('input.font-semibold').first()
  await groupInput.fill('กลุ่ม 1')
  await page.getByRole('combobox').filter({ hasText: 'ยังไม่มอบหมาย' }).first().click()
  await page.getByRole('option', { name: /Fixture Coach.*หัวหน้าโค้ช/ }).click()

  await expect(page.getByText('Level ห่างมาก', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Level ต่างหมวด — เตือนเท่านั้น', { exact: true })).toBeVisible()
  await expect(page.getByText('ผู้เรียนอยู่คนละหมวด Level และยังไม่มีกฎชื่อรวม กรุณาตั้งชื่อกลุ่มเองหรือใช้ “จัดตาม Level”', { exact: true })).toHaveCount(0)

  const saveButton = page.getByRole('button', { name: 'บันทึก/ยืนยันการมอบหมาย', exact: true })
  await expect(saveButton).toBeEnabled()
  const genericSaveResponse = page.waitForResponse((response) => (
    response.url().includes('/api/coach/assignment-groups') && response.request().method() === 'POST'
  ))
  await saveButton.click()
  expect((await genericSaveResponse).status()).toBe(200)
  await expect(page.locator('input[value="กลุ่มผสม"]')).toBeVisible()
  await expect(page.getByText('รอบนี้มอบหมายแล้ว โค้ชผู้สอนจะเห็นรอบนี้ในตารางสอนของตัวเอง', { exact: true })).toBeVisible()

  const persistedInput = page.locator('input[value="กลุ่มผสม"]')
  await persistedInput.fill('ระดับสูง')
  const manualSaveResponse = page.waitForResponse((response) => (
    response.url().includes('/api/coach/assignment-groups') && response.request().method() === 'POST'
  ))
  await page.getByRole('button', { name: 'บันทึก/ยืนยันการมอบหมาย', exact: true }).click()
  expect((await manualSaveResponse).status()).toBe(200)
  await expect(page.locator('input[value="ระดับสูง"]')).toBeVisible()

  const { data: refetchedManual, error: refetchedManualError } = await admin
    .from('coach_assignment_groups')
    .select('name, level_min, level_max, coach_assignment_group_students(booking_session_id)')
    .eq('schedule_slot_id', IDS.forwardSlot)
    .single()
  assertNoError(refetchedManualError, 'refetch Head Coach manual mixed-Level name')
  expect(refetchedManual?.name).toBe('ระดับสูง')
  expect([refetchedManual?.level_min, refetchedManual?.level_max]).toEqual([8, 35])
  expect(refetchedManual?.coach_assignment_group_students).toHaveLength(3)

  await page.setViewportSize({ width: 390, height: 844 })
  const warning = page.getByText('Level ต่างหมวด — เตือนเท่านั้น', { exact: true })
  await expect(warning).toBeVisible()
  const warningBox = await warning.boundingBox()
  expect(warningBox).not.toBeNull()
  expect(warningBox?.x || 0).toBeGreaterThanOrEqual(0)
  expect((warningBox?.x || 0) + (warningBox?.width || 0)).toBeLessThanOrEqual(390)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0)
  expect(browserErrors).toEqual([])
})

test('day-detail loading, empty, error, and stale-response states are deterministic', async ({ page }) => {
  await loginAsAdmin(page)
  await page.route('**/api/admin/schedules/day?**', async (route) => {
    const date = new URL(route.request().url()).searchParams.get('date')
    if (date === '2026-07-17') {
      await new Promise((resolve) => setTimeout(resolve, 500))
      await route.continue()
      return
    }
    if (date === '2026-07-18') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sessions: [], rounds: [] }) })
      return
    }
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'forced error' }) })
  })

  await page.goto('/admin/schedules?year=2026&month=7')
  await page.getByTestId('admin-schedule-calendar-day-2026-07-17').click()
  await expect(page.getByTestId('admin-schedule-day-loading')).toBeVisible()
  await page.getByTestId('admin-schedule-calendar-day-2026-07-18').click()
  await expect(page.getByText('ไม่พบตารางเรียนในเงื่อนไขที่เลือก')).toBeVisible()
  await page.waitForTimeout(650)
  await expect(page.getByText('Fixture Assigned Group', { exact: true })).toHaveCount(0)

  await page.getByTestId('admin-schedule-calendar-day-2026-07-19').click()
  await expect(page.getByTestId('admin-schedule-day-error')).toBeVisible()
})

test('Daily Board separates valid, unassigned-group, standalone, and walleted learners on desktop and mobile', async ({ page }, testInfo) => {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`))

  await page.setViewportSize({ width: 1440, height: 1000 })
  await loginAsAdmin(page)
  let dayReadCount = 0
  await page.route('**/api/admin/schedules/day?**', async (route) => {
    dayReadCount += 1
    await new Promise((resolve) => setTimeout(resolve, 250))
    await route.continue()
  })
  await page.goto('/admin/schedules?year=2026&month=7')

  await expect(page.getByTestId('admin-schedule-month-summary')).toBeVisible()
  expect(dayReadCount).toBe(0)
  await expect(page.getByText('Fixture Assigned Group', { exact: true })).toHaveCount(0)
  await page.getByTestId('admin-schedule-calendar-day-2026-07-17').click()
  await expect(page.getByTestId('admin-schedule-day-loading')).toBeVisible()

  await expect(page.getByText('Fixture Assigned Group', { exact: true })).toBeVisible()
  expect(dayReadCount).toBe(1)
  await expect(page.getByText('ยังไม่จัดกลุ่ม', { exact: true })).toBeVisible()
  await expect(page.getByText('ยังไม่ได้มอบหมายโค้ช', { exact: true })).toBeVisible()
  await expect(page.getByText('โค้ช: Fixture Coach', { exact: true })).toBeVisible()
  await expect(page.getByText('โค้ช: Fixture Coach', { exact: true })).toHaveCount(1)
  await expect(page.getByText('มีโค้ชแล้ว 1 คน', { exact: true })).toBeVisible()
  await expect(page.getByText('รอจัดโค้ช 2 คน', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('อยู่ในกระเป๋า 1 คน', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('โปรแกรมสอนรอบนี้', { exact: true })).toBeVisible()

  const unassignedCard = page.getByText('ยังไม่จัดกลุ่ม', { exact: true }).locator('xpath=ancestor::div[contains(@class,"border-red-200")]')
  const assignedCard = page.getByText('Fixture Assigned Group', { exact: true }).locator('xpath=ancestor::div[contains(@class,"border-emerald-100")]')
  await expect(unassignedCard).toBeVisible()
  await expect(unassignedCard.getByText('โค้ช: Fixture Coach', { exact: true })).toHaveCount(0)
  await expect(assignedCard).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(unassignedCard).toBeVisible()
  await expect(page.getByText('ยังไม่ได้มอบหมายโค้ช', { exact: true })).toBeVisible()
  const warningBox = await page.getByText('ยังไม่ได้มอบหมายโค้ช', { exact: true }).boundingBox()
  expect(warningBox).not.toBeNull()
  expect(warningBox?.x || 0).toBeGreaterThanOrEqual(0)
  expect((warningBox?.x || 0) + (warningBox?.width || 0)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true })

  await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0)
  expect(browserErrors).toEqual([])
})
