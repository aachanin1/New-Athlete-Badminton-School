import { expect, test, type Page } from '@playwright/test'
import {
  TEST_ADMIN_ACCOUNT,
  createLocalAdmin,
  readBookingFixture,
} from '../booking-regression/local-supabase'

const IDS = {
  slot: 'a1000000-0000-4000-8000-000000000001',
  forwardSlot: 'a1000000-0000-4000-8000-000000000002',
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
  forwardSessions: [
    'a4000000-0000-4000-8000-000000000011',
    'a4000000-0000-4000-8000-000000000012',
    'a4000000-0000-4000-8000-000000000013',
  ],
  validGroup: 'a5000000-0000-4000-8000-000000000001',
  unassignedGroup: 'a5000000-0000-4000-8000-000000000002',
} as const

let coachUserId = ''

function assertNoError(error: { message?: string } | null, label: string) {
  if (error) throw new Error(`${label}: ${error.message || JSON.stringify(error)}`)
}

async function loginAsAdmin(page: Page) {
  await page.goto('/auth/login')
  await page.locator('#email').fill(TEST_ADMIN_ACCOUNT.email)
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

  assertNoError((await admin.from('schedule_slots').insert({
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
  })).error, 'insert forward-fix slot')

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

  assertNoError((await admin.from('booking_sessions').insert(IDS.forwardSessions.map((id, index) => ({
    id,
    booking_id: IDS.booking,
    schedule_slot_id: IDS.forwardSlot,
    date: '2026-07-30',
    start_time: '17:00',
    end_time: '19:00',
    branch_id: fixture.branchId,
    child_id: IDS.children[index],
    status: 'scheduled',
  })))).error, 'insert forward-fix sessions')

  assertNoError((await admin.from('student_levels').insert([
    { student_id: IDS.children[0], student_type: 'child', level: 8, updated_by: fixture.adminUserId },
    { student_id: IDS.children[1], student_type: 'child', level: 29, updated_by: fixture.adminUserId },
    { student_id: IDS.children[2], student_type: 'child', level: 35, updated_by: fixture.adminUserId },
  ])).error, 'insert forward-fix levels')

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
})

test('Daily Board separates valid, unassigned-group, standalone, and walleted learners on desktop and mobile', async ({ page }, testInfo) => {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`))

  await page.setViewportSize({ width: 1440, height: 1000 })
  await loginAsAdmin(page)
  await page.goto('/admin/schedules?year=2026&month=7')
  const fixtureDayButton = page.locator('button').filter({
    has: page.locator('span').filter({ hasText: /^17$/ }),
  })
  await expect(fixtureDayButton).toHaveCount(1)
  await fixtureDayButton.click()

  await expect(page.getByText('Fixture Assigned Group', { exact: true })).toBeVisible()
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

test('forward fix saves wide/mixed Levels atomically and renders assigned state on desktop/mobile', async ({ page }) => {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`))

  await loginAsAdmin(page)
  const admin = createLocalAdmin()

  const saveGroups = async (groups: Array<{
    name: string
    coachId: string | null
    studentSessionIds: string[]
  }>) => page.evaluate(async ({ slotId, branchId, payloadGroups }) => {
    const response = await fetch('/api/coach/assignment-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduleSlotId: slotId,
        branchId,
        groups: payloadGroups.map((group, index) => ({ ...group, sortOrder: index })),
      }),
    })
    return { status: response.status, body: await response.json() }
  }, { slotId: IDS.forwardSlot, branchId: readBookingFixture().branchId, payloadGroups: groups })

  const manualWide = await saveGroups([{
    name: 'พื้นฐาน',
    coachId: coachUserId,
    studentSessionIds: IDS.forwardSessions.slice(0, 2),
  }])
  expect(manualWide.status, JSON.stringify(manualWide.body)).toBe(200)

  const legacyCount = await saveGroups([{
    name: 'ระดับสูง (2 คน)',
    coachId: coachUserId,
    studentSessionIds: IDS.forwardSessions.slice(0, 2),
  }])
  expect(legacyCount.status, JSON.stringify(legacyCount.body)).toBe(200)
  const { data: normalizedLegacyName, error: normalizedLegacyNameError } = await admin.from('coach_assignment_groups')
    .select('name, coach_id')
    .eq('schedule_slot_id', IDS.forwardSlot)
    .single()
  assertNoError(normalizedLegacyNameError, 'read normalized legacy-count name')
  expect(normalizedLegacyName).toEqual({ name: 'ระดับสูง', coach_id: coachUserId })

  const mixedAuto = await saveGroups([{
    name: '',
    coachId: coachUserId,
    studentSessionIds: [...IDS.forwardSessions],
  }])
  expect(mixedAuto.status, JSON.stringify(mixedAuto.body)).toBe(200)
  const { data: mixedAutoName, error: mixedAutoNameError } = await admin.from('coach_assignment_groups')
    .select('name, coach_id')
    .eq('schedule_slot_id', IDS.forwardSlot)
    .single()
  assertNoError(mixedAutoNameError, 'read mixed auto-name')
  expect(mixedAutoName).toEqual({ name: 'กลุ่มผสม', coach_id: coachUserId })

  const manualMixed = await saveGroups([{
    name: 'พื้นฐาน',
    coachId: coachUserId,
    studentSessionIds: [...IDS.forwardSessions],
  }])
  expect(manualMixed.status, JSON.stringify(manualMixed.body)).toBe(200)

  const { data: groups, error: groupsError } = await admin.from('coach_assignment_groups')
    .select('id, coach_id, name, coach_assignment_group_students(booking_session_id)')
    .eq('schedule_slot_id', IDS.forwardSlot)
  assertNoError(groupsError, 'read forward-fix saved group')
  expect(groups).toHaveLength(1)
  expect(groups?.[0]?.coach_id).toBe(coachUserId)
  expect(groups?.[0]?.name).toBe('พื้นฐาน')
  expect(groups?.[0]?.coach_assignment_group_students).toHaveLength(3)
  expect(groups?.[0]?.name).not.toMatch(/\(\d+ คน\)$/u)

  const { count: legacyCountRows, error: legacyError } = await admin.from('coach_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('schedule_slot_id', IDS.forwardSlot)
    .eq('coach_id', coachUserId)
  assertNoError(legacyError, 'count forward-fix legacy rows')
  expect(legacyCountRows).toBe(1)

  const groupId = groups?.[0]?.id || ''
  const { count: reservationCount, error: reservationError } = await admin.from('coach_assignment_exact_reservations')
    .select('group_id', { count: 'exact', head: true })
    .eq('group_id', groupId)
  assertNoError(reservationError, 'count forward-fix reservations')
  expect(reservationCount).toBe(1)

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/coach/assign-groups')
  const dateButton = page.getByRole('button').filter({ hasText: '30 ก.ค.' }).first()
  await expect(dateButton).toBeVisible()
  await dateButton.click()
  await expect(page.getByText('มอบหมายแล้ว', { exact: true }).first()).toBeVisible()
  await expect(page.locator('input[value="พื้นฐาน"]')).toBeVisible()
  await expect(page.getByText('Level ห่างมาก', { exact: true }).first()).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  const warning = page.getByText('Level ห่างมาก', { exact: true }).first()
  const warningBox = await warning.boundingBox()
  expect(warningBox).not.toBeNull()
  expect(warningBox?.x || 0).toBeGreaterThanOrEqual(0)
  expect((warningBox?.x || 0) + (warningBox?.width || 0)).toBeLessThanOrEqual(390)
  expect(browserErrors).toEqual([])
})
