import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import {
  BOOKING_DATES,
  FULL_DATE,
  IDS,
  OVERFULL_DATE,
  RACE_DATE,
  TEST_ACCOUNT,
  TEST_ADMIN_ACCOUNT,
  createLocalAdmin,
  readBookingFixture,
  type BookingFixture,
} from './local-supabase'

test.describe.configure({ mode: 'serial' })

let fixture: BookingFixture

test.beforeAll(() => {
  fixture = readBookingFixture()
})

function observeBrowserErrors(page: Page, options: { allowExpectedBooking409?: boolean } = {}) {
  const errors: string[] = []
  let expectedBooking409s = 0
  page.on('response', (response) => {
    if (options.allowExpectedBooking409
      && response.status() === 409
      && response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/api/bookings') {
      expectedBooking409s += 1
    }
  })
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    if (options.allowExpectedBooking409 && /Failed to load resource:.*status of 409/.test(message.text())) return
    errors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  return { errors, getExpectedBooking409s: () => expectedBooking409s }
}

async function login(page: Page) {
  await page.goto('/auth/login')
  await page.locator('#email').fill(TEST_ACCOUNT.email)
  await page.locator('#password').fill(TEST_ACCOUNT.password)
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
  await page.waitForURL(/\/dashboard(?:\/|$)/)
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/auth/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
  await page.waitForURL(/\/(?:dashboard|admin)(?:\/|$)/)
}

async function openBooking(page: Page) {
  await login(page)
  await page.goto('/dashboard/booking')
  await expect(page.getByRole('heading', { name: 'จองคอร์สเรียน' })).toBeVisible()
}

async function verifyRootAndStaticAssets(page: Page) {
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)
  const sources = await page.locator('script[src*="/_next/static/"]').evaluateAll((scripts) => (
    scripts.map((script) => script.getAttribute('src')).filter((source): source is string => Boolean(source))
  ))
  expect(sources.length).toBeGreaterThan(0)
  for (const source of sources.slice(0, 3)) {
    const asset = await page.context().request.get(source)
    expect(asset.status(), source).toBe(200)
  }
}

async function verifyUnauthenticatedBookingGuards(page: Page) {
  for (const path of ['/api/bookings/availability', '/api/bookings/preview', '/api/bookings']) {
    const response = await page.context().request.post(path, { data: {} })
    expect(response.status(), path).toBe(401)
  }
}

function draftSession(date: string) {
  const day = String(new Date(`${date}T00:00:00Z`).getUTCDay())
  return {
    date,
    dayOfWeek: Number(day),
    start: '17:00',
    end: '19:00',
    branchId: fixture.branchId,
    scheduleTemplateId: fixture.templates[day],
    scheduleSlotId: fixture.slots[date],
  }
}

function bookingDraft(dates: readonly string[], step: 'calendar' | 'summary' = 'calendar') {
  return {
    version: 2,
    step,
    courseType: 'kids_group',
    learnerType: 'child',
    selectedChildIds: [fixture.mainChildId],
    privateSelfAttend: false,
    selectedBranchIds: [fixture.branchId],
    calMonth: 6,
    calYear: 2026,
    sessionsMap: { [fixture.mainChildId]: dates.map(draftSession) },
    activeChildTab: fixture.mainChildId,
    clientRequestId: randomUUID(),
    updatedAt: Date.now(),
  }
}

async function restoreDraft(page: Page, dates: readonly string[], step: 'calendar' | 'summary' = 'calendar') {
  await page.addInitScript(({ key, draft }) => sessionStorage.setItem(key, JSON.stringify(draft)), {
    key: `nabs:booking-draft:v2:${fixture.userId}:new`,
    draft: bookingDraft(dates, step),
  })
  await page.goto('/dashboard/booking')
}

async function selectKidsFlow(page: Page, dates: readonly string[]) {
  await page.getByText('เด็ก (กลุ่ม)', { exact: true }).click()
  await page.getByRole('button', { name: /ถัดไป/ }).click()
  await page.getByText(`${TEST_ACCOUNT.childNickname} - ${TEST_ACCOUNT.childName}`, { exact: true }).click()
  await page.getByRole('button', { name: /ถัดไป/ }).click()
  await page.getByText('สาขาทดสอบ Localhost', { exact: true }).click()
  await page.getByRole('button', { name: /ถัดไป/ }).click()
  for (const date of dates) {
    await page.getByTestId(`booking-date-${date}`).click()
    const slot = page.getByTestId(`booking-slot-${date}-${fixture.branchId}-17:00`)
    await expect(slot).toBeEnabled()
    await slot.click()
  }
}

async function expectNoBrowserErrors(observation: ReturnType<typeof observeBrowserErrors>) {
  expect(observation.errors, observation.errors.join('\n')).toEqual([])
}

async function countForUser(table: string, userId: string) {
  const admin = createLocalAdmin()
  const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId)
  if (error) throw new Error(`count ${table}: ${error.message}`)
  return count || 0
}

test('authoritative availability keeps occupancy informational and does not disable learner 7', async ({ page }, testInfo) => {
  const browserErrors = observeBrowserErrors(page)
  await verifyRootAndStaticAssets(page)
  await verifyUnauthenticatedBookingGuards(page)
  await openBooking(page)

  const availability = await page.evaluate(async ({ kidsCourseId, branchId, templates, FULL_DATE, OVERFULL_DATE }) => {
    const candidates = ['2026-07-20', '2026-07-21', FULL_DATE, OVERFULL_DATE].map((date) => ({
      date,
      startTime: '17:00',
      endTime: '19:00',
      branchId,
      scheduleTemplateId: templates[String(new Date(`${date}T00:00:00Z`).getUTCDay())],
    }))
    const response = await fetch('/api/bookings/availability', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseTypeId: kidsCourseId, slots: candidates }),
    })
    return { status: response.status, body: await response.json() }
  }, { ...fixture, FULL_DATE, OVERFULL_DATE })
  expect(availability.status).toBe(200)
  const byDate = new Map(availability.body.slots.map((slot: { date: string; activeOccupancy: number; valid: boolean }) => [slot.date, slot]))
  expect(byDate.get('2026-07-20')).toMatchObject({ activeOccupancy: 5, valid: true })
  expect(byDate.get('2026-07-21')).toMatchObject({ activeOccupancy: 0, valid: true })
  expect(byDate.get('2026-07-22')).toMatchObject({ activeOccupancy: 6, valid: true })
  expect(byDate.get(OVERFULL_DATE)).toMatchObject({ activeOccupancy: 20, valid: true })
  for (const slot of availability.body.slots) {
    expect(slot).not.toHaveProperty('capacity')
    expect(slot).not.toHaveProperty('remainingSeats')
    expect(slot).not.toHaveProperty('full')
    expect(slot).not.toHaveProperty('canFitRequestedSeats')
  }

  await selectKidsFlow(page, [])
  await page.getByTestId(`booking-date-${FULL_DATE}`).click()
  const fullSlot = page.getByTestId(`booking-slot-${FULL_DATE}-${fixture.branchId}-17:00`)
  await expect(fullSlot).toBeEnabled()
  await expect(fullSlot).not.toContainText(/เต็ม|\/6/)
  await page.getByTestId(`booking-date-${OVERFULL_DATE}`).click()
  const overfullSlot = page.getByTestId(`booking-slot-${OVERFULL_DATE}-${fixture.branchId}-17:00`)
  await expect(overfullSlot).toBeEnabled()
  await expect(overfullSlot).not.toContainText(/เต็ม|\/20/)
  await page.screenshot({ path: testInfo.outputPath('learner-7-slot-enabled.png'), fullPage: true })

  const legacyModes = await page.evaluate(async ({ adultCourseId, privateCourseId }) => Promise.all(
    [adultCourseId, privateCourseId].map(async (courseTypeId) => {
      const response = await fetch('/api/bookings/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseTypeId, month: 7, year: 2026, totalSessions: 1 }),
      })
      return (await response.json()).mode
    }),
  ), fixture)
  expect(legacyModes).toEqual(['legacy', 'legacy'])
  await expectNoBrowserErrors(browserErrors)
})

test('self adult learner heading uses profile full name once', async ({ page }) => {
  const browserErrors = observeBrowserErrors(page)
  await openBooking(page)
  await page.getByText('ผู้ใหญ่ (กลุ่ม)', { exact: true }).click()
  await page.getByRole('button', { name: /ถัดไป/ }).click()
  await expect(page.getByRole('heading', { name: `ผู้เรียน: ${TEST_ACCOUNT.fullName}` })).toBeVisible()
  await expect(page.getByText(`${TEST_ACCOUNT.fullName} - ${TEST_ACCOUNT.fullName}`)).toHaveCount(0)
  await expectNoBrowserErrors(browserErrors)
})

test('reschedule 20+1 and Lesson Wallet 6+1 stay non-blocking', async ({ page }) => {
  const browserErrors = observeBrowserErrors(page)
  await openBooking(page)
  const admin = createLocalAdmin()
  const sourceSessionId = 'de000000-0000-4000-8000-000000000001'
  const { error: sourceError } = await admin.from('booking_sessions').insert({
    id: sourceSessionId,
    booking_id: fixture.legacyBookingId,
    schedule_slot_id: fixture.slots['2026-07-21'],
    date: '2026-07-21', start_time: '17:00', end_time: '19:00',
    branch_id: fixture.branchId, child_id: fixture.mainChildId, status: 'scheduled',
  })
  if (sourceError) throw new Error(sourceError.message)

  const rescheduleResponse = await page.evaluate(async ({ sessionId, targetDate, branchId, templateId }) => {
    const response = await fetch('/api/reschedule', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, targetDate, startTime: '17:00', endTime: '19:00', branchId, scheduleTemplateId: templateId }),
    })
    return { status: response.status, body: await response.json() }
  }, {
    sessionId: sourceSessionId,
    targetDate: OVERFULL_DATE,
    branchId: fixture.branchId,
    templateId: fixture.templates[String(new Date(`${OVERFULL_DATE}T00:00:00Z`).getUTCDay())],
  })
  expect(rescheduleResponse.status, JSON.stringify(rescheduleResponse.body)).toBe(200)

  const walletCreditId = 'ef000000-0000-4000-8000-000000000001'
  const { error: slotStateError } = await admin.from('schedule_slots')
    .update({ current_students: 6, status: 'full' }).eq('id', fixture.slots[FULL_DATE])
  if (slotStateError) throw new Error(slotStateError.message)
  const { error: creditError } = await admin.from('lesson_wallet_credits').insert({
    id: walletCreditId,
    user_id: fixture.userId,
    booking_id: fixture.legacyBookingId,
    original_session_id: sourceSessionId,
    child_id: fixture.mainChildId,
    branch_id: fixture.branchId,
    course_type_id: fixture.kidsCourseId,
    original_date: '2026-07-21', original_start_time: '17:00', original_end_time: '19:00',
    status: 'active', expires_at: '2026-07-31T16:59:59Z',
  })
  if (creditError) throw new Error(creditError.message)
  const paymentCountBefore = await countForUser('payments', fixture.userId)
  const walletResponse = await page.evaluate(async ({ creditId, targetDate, branchId, templateId }) => {
    const response = await fetch('/api/lesson-wallet', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'redeem', creditId, targetDate, startTime: '17:00', endTime: '19:00', branchId, scheduleTemplateId: templateId }),
    })
    return { status: response.status, body: await response.json() }
  }, {
    creditId: walletCreditId,
    targetDate: FULL_DATE,
    branchId: fixture.branchId,
    templateId: fixture.templates[String(new Date(`${FULL_DATE}T00:00:00Z`).getUTCDay())],
  })
  expect(walletResponse.status, JSON.stringify(walletResponse.body)).toBe(200)
  const { data: walletSlot } = await admin.from('schedule_slots').select('current_students,status').eq('id', fixture.slots[FULL_DATE]).single()
  expect(walletSlot).toMatchObject({ current_students: 7, status: 'full' })
  expect(await countForUser('payments', fixture.userId)).toBe(paymentCountBefore)
  await expectNoBrowserErrors(browserErrors)
})

test('Admin Makeup selects a canonical slot above occupancy 20 without a capacity rejection', async ({ page }) => {
  const browserErrors = observeBrowserErrors(page)
  const admin = createLocalAdmin()
  const bookingId = 'd1000000-0000-4000-8000-000000000001'
  const originalSessionId = 'd2000000-0000-4000-8000-000000000001'
  const makeupChildId = 'd3000000-0000-4000-8000-000000000001'
  const { error: childError } = await admin.from('children').insert({
    id: makeupChildId, parent_id: fixture.otherUserId, full_name: 'Makeup Learner', date_of_birth: '2015-01-01',
  })
  if (childError) throw new Error(childError.message)
  const { error: bookingError } = await admin.from('bookings').insert({
    id: bookingId, user_id: fixture.otherUserId, learner_type: 'child', child_id: makeupChildId,
    branch_id: fixture.branchId, course_type_id: fixture.kidsCourseId,
    month: 6, year: 2026, total_sessions: 1, total_price: 0, status: 'verified',
  })
  if (bookingError) throw new Error(bookingError.message)
  const { error: sessionError } = await admin.from('booking_sessions').insert({
    id: originalSessionId, booking_id: bookingId, date: '2026-06-20', start_time: '17:00', end_time: '19:00',
    branch_id: fixture.branchId, child_id: makeupChildId, status: 'absent',
  })
  if (sessionError) throw new Error(sessionError.message)

  await loginAs(page, TEST_ADMIN_ACCOUNT.email, TEST_ADMIN_ACCOUNT.password)
  const response = await page.evaluate(async ({ originalSessionId, bookingId, targetDate, branchId }) => {
    const result = await fetch('/api/admin/makeup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ original_session_id: originalSessionId, booking_id: bookingId, makeup_date: targetDate, start_time: '17:00', end_time: '19:00', branch_id: branchId }),
    })
    return { status: result.status, body: await result.json() }
  }, { originalSessionId, bookingId, targetDate: OVERFULL_DATE, branchId: fixture.branchId })
  expect(response.status, JSON.stringify(response.body)).toBe(200)
  const { data: makeupSession, error: makeupError } = await admin.from('booking_sessions')
    .select('schedule_slot_id,is_makeup,status').eq('rescheduled_from_id', originalSessionId).single()
  if (makeupError) throw new Error(makeupError.message)
  expect(makeupSession).toMatchObject({ schedule_slot_id: fixture.slots[OVERFULL_DATE], is_makeup: true, status: 'scheduled' })
  await expectNoBrowserErrors(browserErrors)
})

test('restored draft recalculates 2,000 without a 1,500 fallback and coupon stays equal on Steps 4 and 5', async ({ page }, testInfo) => {
  const browserErrors = observeBrowserErrors(page)
  await openBooking(page)
  await page.addInitScript(() => {
    ;(window as typeof window & { __legacy1500Seen?: boolean }).__legacy1500Seen = false
    const inspect = () => {
      const text = document.body?.innerText || ''
      if (text.includes('฿1,500')) (window as typeof window & { __legacy1500Seen?: boolean }).__legacy1500Seen = true
    }
    const observe = () => new MutationObserver(inspect).observe(document.documentElement, {
      subtree: true, childList: true, characterData: true,
    })
    if (document.documentElement) observe()
    else document.addEventListener('DOMContentLoaded', observe, { once: true })
  })
  await restoreDraft(page, BOOKING_DATES)
  await expect(page.getByTestId('booking-step4-total')).toHaveText('฿2,000')
  expect(await page.evaluate(() => Boolean((window as typeof window & { __legacy1500Seen?: boolean }).__legacy1500Seen))).toBe(false)
  await page.screenshot({ path: testInfo.outputPath('restored-step4-2000.png'), fullPage: true })
  await page.getByRole('button', { name: /ถัดไป/ }).click()
  await expect(page.getByTestId('booking-step5-total')).toHaveText('฿2,000')
  await expect(page.getByTestId('booking-progressive-preview')).toContainText('เดือนนี้มีรอบเรียนเดิม 4 ครั้ง')
  await expect(page.getByTestId('booking-progressive-preview')).toContainText('หลังจองจะรวมเป็น 8 ครั้ง')
  await expect(page.getByTestId('booking-progressive-preview')).toContainText('ช่วงราคา 7–10 ครั้ง')
  await page.screenshot({ path: testInfo.outputPath('restored-step5-2000.png'), fullPage: true })

  await page.getByPlaceholder('กรอกรหัสคูปอง').fill('TEST10')
  await page.getByRole('button', { name: 'ใช้คูปอง' }).click()
  await expect(page.getByTestId('booking-step5-total')).toHaveText('฿1,800')
  await expect(page.getByText(/ราคาก่อนใช้คูปอง: 2,000 บาท/)).toBeVisible()
  await expect(page.getByText(/ส่วนลดคูปอง TEST10: 200 บาท/)).toBeVisible()
  await page.getByRole('button', { name: /ย้อนกลับ/ }).click()
  await expect(page.getByTestId('booking-step4-total')).toHaveText('฿1,800')
  await expect(page.getByText(/ราคา 2,000 − ส่วนลด 200 บาท/)).toBeVisible()
  await page.getByRole('button', { name: /ถัดไป/ }).click()
  await expect(page.getByTestId('booking-step5-total')).toHaveText('฿1,800')
  await expectNoBrowserErrors(browserErrors)
})

test('a stale preview response cannot overwrite a newer three-session draft', async ({ page }) => {
  const browserErrors = observeBrowserErrors(page)
  await openBooking(page)
  await page.route('**/api/bookings/preview', async (route) => {
    const body = route.request().postDataJSON() as { totalSessions?: number }
    if (body.totalSessions === 4) await new Promise((resolve) => setTimeout(resolve, 1_500))
    await route.continue()
  })
  await restoreDraft(page, BOOKING_DATES)
  await page.getByTestId(`remove-session-${fixture.mainChildId}-${BOOKING_DATES[3]}-17:00`).click()
  await expect(page.getByText('รวมทั้งหมด 3 ครั้ง')).toBeVisible()
  await expect(page.getByTestId('booking-step4-total')).toHaveText('฿1,500')
  await page.waitForTimeout(1_800)
  await expect(page.getByTestId('booking-step4-total')).toHaveText('฿1,500')
  await expectNoBrowserErrors(browserErrors)
})

test('a restored multi-date draft keeps an occupied slot valid and preserves selections', async ({ page }, testInfo) => {
  const browserErrors = observeBrowserErrors(page)
  await openBooking(page)
  await restoreDraft(page, [BOOKING_DATES[0], BOOKING_DATES[1], FULL_DATE])
  await expect(page.getByText(/เต็มแล้ว กรุณาเลือกวันเรียนใหม่/)).toHaveCount(0)
  await expect(page.getByText('รวมทั้งหมด 3 ครั้ง')).toBeVisible()
  await expect(page.getByText(/เต็ม\/ไม่พร้อม/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: /ถัดไป/ })).toBeEnabled()
  await page.screenshot({ path: testInfo.outputPath('restored-occupied-slot-valid.png'), fullPage: true })
  await expectNoBrowserErrors(browserErrors)
})

test('occupancy changing after preview does not create a capacity flash or block confirmation', async ({ page }, testInfo) => {
  const browserErrors = observeBrowserErrors(page)
  await openBooking(page)
  await restoreDraft(page, [RACE_DATE])
  await expect(page.getByTestId('booking-step4-total')).toHaveText('฿625')
  await page.getByRole('button', { name: /ถัดไป/ }).click()
  await expect(page.getByTestId('booking-step5-total')).toHaveText('฿625')
  let armRace = true
  await page.route('**/api/bookings/availability', async (route) => {
    if (!armRace) return route.continue()
    armRace = false
    const response = await route.fetch()
    const admin = createLocalAdmin()
    const { error } = await admin.from('booking_sessions').insert({
      id: 'ce000000-0000-4000-8000-000000000001',
      booking_id: 'bb000000-0000-4000-8000-000000000006',
      schedule_slot_id: fixture.slots[RACE_DATE],
      date: RACE_DATE,
      start_time: '17:00', end_time: '19:00', branch_id: fixture.branchId,
      child_id: '77000000-0000-4000-8000-000000000006', status: 'scheduled',
    })
    if (error) throw new Error(`arm occupancy change: ${error.message}`)
    await route.fulfill({ response })
  })
  await page.getByRole('button', { name: /ย้อนกลับ/ }).click()
  await page.getByRole('button', { name: /ถัดไป/ }).click()
  await expect(page.getByText(/เต็มแล้ว กรุณาเลือกวันเรียนใหม่/)).toHaveCount(0)
  await expect(page.getByText('PROGRESSIVE_CAPACITY_EXCEEDED')).toHaveCount(0)
  await expect(page.getByText('รวมทั้งหมด 1 ครั้ง')).toBeVisible()
  await expect(page.getByText(/เต็ม\/ไม่พร้อม/)).toHaveCount(0)
  await expect(page.getByTestId('booking-confirm')).toBeEnabled()
  await page.screenshot({ path: testInfo.outputPath('occupancy-change-nonblocking.png'), fullPage: true })
  await expectNoBrowserErrors(browserErrors)
})

test('actual rendered 4+4 flow creates exactly 2,000 and leaves legacy/payment data unchanged', async ({ page }, testInfo) => {
  const browserErrors = observeBrowserErrors(page)
  const admin = createLocalAdmin()
  const { data: legacyBefore, error: legacyBeforeError } = await admin.from('bookings')
    .select('id,total_sessions,total_price,pricing_scope_id,pricing_revision,gross_price_snapshot,final_price_snapshot')
    .eq('id', fixture.legacyBookingId).single()
  if (legacyBeforeError) throw new Error(legacyBeforeError.message)
  const protectedBefore = {
    payments: await countForUser('payments', fixture.userId),
    batches: await countForUser('progressive_payment_batches', fixture.userId),
  }
  const protectedTables = ['progressive_payment_batch_bookings', 'progressive_payment_allocations', 'progressive_payment_verification_attempts', 'lesson_wallet_credits', 'finance_expenses']
  const protectedTableCounts = new Map<string, number>()
  for (const table of protectedTables) {
    const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true })
    if (error) throw new Error(`count ${table}: ${error.message}`)
    protectedTableCounts.set(table, count || 0)
  }

  await openBooking(page)
  await selectKidsFlow(page, BOOKING_DATES)
  await expect(page.getByTestId('booking-step4-total')).toHaveText('฿2,000')
  await page.screenshot({ path: testInfo.outputPath('actual-step4-2000.png'), fullPage: true })
  await page.getByRole('button', { name: /ถัดไป/ }).click()
  await expect(page.getByTestId('booking-step5-total')).toHaveText('฿2,000')
  await expect(page.getByTestId('booking-progressive-preview')).toContainText('ครั้งนี้เลือกเพิ่ม 4 ครั้ง')
  await expect(page.getByTestId('booking-progressive-preview')).toContainText('ราคาสำหรับการจองครั้งนี้ 500 บาทต่อครั้ง')
  await page.screenshot({ path: testInfo.outputPath('actual-step5-2000.png'), fullPage: true })
  await page.getByTestId('booking-confirm').click()
  await page.waitForURL(/\/dashboard\/history/)

  const { data: created, error: createdError } = await admin.from('bookings')
    .select('id,total_sessions,total_price,status,entitlement_sessions,pricing_scope_id,pricing_revision,cumulative_sessions_before,cumulative_sessions_after,pricing_rate_snapshot,gross_price_snapshot,coupon_discount_snapshot,final_price_snapshot')
    .eq('user_id', fixture.userId).neq('id', fixture.legacyBookingId).single()
  if (createdError) throw new Error(createdError.message)
  expect(created).toMatchObject({
    total_sessions: 4,
    total_price: 2000,
    status: 'pending_payment',
    entitlement_sessions: 4,
    cumulative_sessions_before: 4,
    cumulative_sessions_after: 8,
    pricing_rate_snapshot: 500,
    gross_price_snapshot: 2000,
    coupon_discount_snapshot: 0,
    final_price_snapshot: 2000,
  })
  expect(created?.pricing_scope_id).toBeTruthy()
  expect(created?.pricing_revision).toBe(1)
  const { count: createdSessions, error: createdSessionsError } = await admin.from('booking_sessions')
    .select('*', { count: 'exact', head: true }).eq('booking_id', created?.id)
  if (createdSessionsError) throw new Error(createdSessionsError.message)
  expect(createdSessions).toBe(4)

  const { data: legacyAfter, error: legacyAfterError } = await admin.from('bookings')
    .select('id,total_sessions,total_price,pricing_scope_id,pricing_revision,gross_price_snapshot,final_price_snapshot')
    .eq('id', fixture.legacyBookingId).single()
  if (legacyAfterError) throw new Error(legacyAfterError.message)
  expect(legacyAfter).toEqual(legacyBefore)
  expect(legacyAfter).toMatchObject({ total_sessions: 4, total_price: 2500, pricing_scope_id: null, pricing_revision: null, gross_price_snapshot: null, final_price_snapshot: null })

  expect({
    payments: await countForUser('payments', fixture.userId),
    batches: await countForUser('progressive_payment_batches', fixture.userId),
  }).toEqual(protectedBefore)
  for (const table of protectedTables) {
    const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true })
    if (error) throw new Error(`count ${table}: ${error.message}`)
    expect(count, table).toBe(protectedTableCounts.get(table))
  }
  await expectNoBrowserErrors(browserErrors)
})
