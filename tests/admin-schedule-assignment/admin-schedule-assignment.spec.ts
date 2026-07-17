import { expect, test, type Page } from '@playwright/test'
import {
  TEST_ADMIN_ACCOUNT,
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
      name: 'Fixture Unassigned Group',
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

test('Daily Board separates valid, unassigned-group, standalone, and walleted learners on desktop and mobile', async ({ page }, testInfo) => {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`))

  await page.setViewportSize({ width: 1440, height: 1000 })
  await loginAsAdmin(page)
  await page.goto('/admin/schedules?year=2026&month=7')

  await expect(page.getByText('Fixture Assigned Group', { exact: true })).toBeVisible()
  await expect(page.getByText('Fixture Unassigned Group', { exact: true })).toBeVisible()
  await expect(page.getByText('ยังไม่ได้มอบหมายโค้ช', { exact: true })).toBeVisible()
  await expect(page.getByText('โค้ช: Fixture Coach', { exact: true })).toBeVisible()
  await expect(page.getByText('มีโค้ชแล้ว 1 คน', { exact: true })).toBeVisible()
  await expect(page.getByText('รอจัดโค้ช 2 คน', { exact: true })).toBeVisible()
  await expect(page.getByText('อยู่ในกระเป๋า 1 คน', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('โปรแกรมสอนรอบนี้', { exact: true })).toBeVisible()

  const unassignedCard = page.getByText('Fixture Unassigned Group', { exact: true }).locator('xpath=ancestor::div[contains(@class,"border-red-200")]')
  const assignedCard = page.getByText('Fixture Assigned Group', { exact: true }).locator('xpath=ancestor::div[contains(@class,"border-emerald-100")]')
  await expect(unassignedCard).toBeVisible()
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
