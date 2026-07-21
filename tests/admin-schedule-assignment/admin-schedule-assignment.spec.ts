import { expect, test, type Page } from '@playwright/test'
import {
  TEST_ADMIN_ACCOUNT,
  TEST_ACCOUNT,
  createLocalAdmin,
  readBookingFixture,
} from '../booking-regression/local-supabase'

const IDS = {
  slot: 'a1000000-0000-4000-8000-000000000001',
  booking: 'a2000000-0000-4000-8000-000000000001',
  children: [
    'a3000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000002',
    'a3000000-0000-4000-8000-000000000003',
    'a3000000-0000-4000-8000-000000000004',
  ],
  sessions: [
    'a4000000-0000-4000-8000-000000000001',
    'a4000000-0000-4000-8000-000000000002',
    'a4000000-0000-4000-8000-000000000003',
    'a4000000-0000-4000-8000-000000000004',
  ],
  validGroup: 'a5000000-0000-4000-8000-000000000001',
  unassignedGroup: 'a5000000-0000-4000-8000-000000000002',
} as const

let coachUserId = ''
let standardAdminUserId = ''
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
    email: 'admin-schedule-coach@example.com',
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
    role: 'coach',
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

  assertNoError((await admin.from('children').insert(IDS.children.map((id, index) => ({
    id,
    parent_id: fixture.userId,
    full_name: `Schedule Fixture Learner ${index + 1}`,
    nickname: `SF${index + 1}`,
    date_of_birth: '2015-01-01',
  })))).error, 'insert fixture learners')

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
  ]) {
    const response = await superPage.request.get(`/api/admin/schedules/search?q=${encodeURIComponent(query)}&year=2026&month=7`)
    expect(response.status()).toBe(200)
    const payload = await response.json()
    expect(payload.matchCount).toBeGreaterThan(0)
    expect(payload.dates.every((date: string) => date.startsWith('2026-07-'))).toBe(true)
  }
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
