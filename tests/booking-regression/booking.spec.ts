import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import {
  BOOKING_DATES,
  FULL_DATE,
  IDS,
  RACE_DATE,
  TEST_ACCOUNT,
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
  await page.getByText(TEST_ACCOUNT.childName, { exact: true }).click()
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

test('authoritative availability shows 5/6, disables 6/6, excludes inactive rows, and full API create is atomic', async ({ page }, testInfo) => {
  const browserErrors = observeBrowserErrors(page)
  await verifyRootAndStaticAssets(page)
  await openBooking(page)

  const availability = await page.evaluate(async ({ kidsCourseId, branchId, templates }) => {
    const candidates = ['2026-07-20', '2026-07-21', '2026-07-22'].map((date) => ({
      date,
      startTime: '17:00',
      endTime: '19:00',
      branchId,
      scheduleTemplateId: templates[String(new Date(`${date}T00:00:00Z`).getUTCDay())],
    }))
    const response = await fetch('/api/bookings/availability', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseTypeId: kidsCourseId, slots: candidates, requestedSlots: [] }),
    })
    return { status: response.status, body: await response.json() }
  }, fixture)
  expect(availability.status).toBe(200)
  const byDate = new Map(availability.body.slots.map((slot: { date: string; activeOccupancy: number; remainingSeats: number; full: boolean }) => [slot.date, slot]))
  expect(byDate.get('2026-07-20')).toMatchObject({ activeOccupancy: 5, remainingSeats: 1, full: false })
  expect(byDate.get('2026-07-21')).toMatchObject({ activeOccupancy: 0, remainingSeats: 6, full: false })
  expect(byDate.get('2026-07-22')).toMatchObject({ activeOccupancy: 6, remainingSeats: 0, full: true })

  await selectKidsFlow(page, [])
  await page.getByTestId(`booking-date-${FULL_DATE}`).click()
  const fullSlot = page.getByTestId(`booking-slot-${FULL_DATE}-${fixture.branchId}-17:00`)
  await expect(fullSlot).toBeDisabled()
  await expect(fullSlot).toContainText('เต็ม 6/6')
  await page.screenshot({ path: testInfo.outputPath('full-slot-disabled.png'), fullPage: true })

  const before = {
    bookings: await countForUser('bookings', fixture.userId),
    scopes: await countForUser('booking_pricing_scopes', fixture.userId),
    receipts: await countForUser('progressive_booking_mutation_receipts', fixture.userId),
  }
  const previewResponse = await page.context().request.post('/api/bookings/preview', {
    data: { courseTypeId: fixture.kidsCourseId, month: 7, year: 2026, totalSessions: 1 },
  })
  const preview = await previewResponse.json()
  const forcedResponse = await page.context().request.post('/api/bookings', {
    data: {
      learnerType: 'child', childId: fixture.mainChildId, branchId: fixture.branchId,
      courseTypeId: fixture.kidsCourseId, month: 7, year: 2026, totalSessions: 1,
      totalAmount: preview.grossPrice, expectedTotalPrice: preview.totalPrice,
      sessions: [{
        date: '2026-07-22', startTime: '17:00', endTime: '19:00', branchId: fixture.branchId,
        childId: fixture.mainChildId, scheduleTemplateId: fixture.templates['3'],
      }],
      coupon: null, clientRequestId: randomUUID(),
      expectedScopeRevision: preview.expectedScopeRevision,
      expectedLegacyBaselineSessions: preview.legacyBaselineSessions,
      expectedLegacyBaselineFingerprint: preview.legacyBaselineFingerprint,
    },
  })
  const forced = { status: forcedResponse.status(), body: await forcedResponse.json(), preview }
  expect(forced.preview).toMatchObject({ legacyBaselineSessions: 4, previousProgressiveActiveSessions: 0 })
  expect(forced.status).toBe(409)
  expect(forced.body).toMatchObject({ code: 'PROGRESSIVE_CAPACITY_EXCEEDED', error: 'รอบเรียนที่เลือกเต็มแล้ว กรุณาเลือกวันหรือเวลาใหม่' })
  expect({
    bookings: await countForUser('bookings', fixture.userId),
    scopes: await countForUser('booking_pricing_scopes', fixture.userId),
    receipts: await countForUser('progressive_booking_mutation_receipts', fixture.userId),
  }).toEqual(before)

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
  await expect(page.getByTestId('booking-progressive-preview')).toContainText('สิทธิ์เดิมที่ใช้กำหนดเรท: 4 ครั้ง')
  await expect(page.getByTestId('booking-progressive-preview')).toContainText('การจอง Progressive ก่อนหน้า: 0 ครั้ง')
  await expect(page.getByTestId('booking-progressive-preview')).toContainText('จำนวนสะสมหลังจอง: 8 ครั้ง')
  await page.screenshot({ path: testInfo.outputPath('restored-step5-2000.png'), fullPage: true })

  await page.getByPlaceholder('กรอกรหัสคูปอง').fill('TEST10')
  await page.getByRole('button', { name: 'ใช้คูปอง' }).click()
  await expect(page.getByTestId('booking-step5-total')).toHaveText('฿1,800')
  await expect(page.getByText('ยอดก่อนส่วนลด').locator('..')).toContainText('฿2,000')
  await expect(page.getByText('ส่วนลดคูปอง (TEST10)').locator('..')).toContainText('-฿200')
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

test('a restored multi-date draft marks the full slot invalid and preserves other selections', async ({ page }, testInfo) => {
  const browserErrors = observeBrowserErrors(page)
  await openBooking(page)
  await restoreDraft(page, [BOOKING_DATES[0], BOOKING_DATES[1], FULL_DATE])
  await expect(page.getByText(/เต็มแล้ว กรุณาเลือกวันเรียนใหม่/).first()).toBeVisible()
  await expect(page.getByText('รวมทั้งหมด 3 ครั้ง')).toBeVisible()
  await expect(page.getByText(/เต็ม\/ไม่พร้อม/)).toBeVisible()
  await expect(page.getByRole('button', { name: /ถัดไป/ })).toBeDisabled()
  await page.screenshot({ path: testInfo.outputPath('restored-full-slot-blocked.png'), fullPage: true })
  await expectNoBrowserErrors(browserErrors)
})

test('capacity race is rejected by the RPC, refreshes the UI in Thai, and leaves no partial write', async ({ page }, testInfo) => {
  const browserErrors = observeBrowserErrors(page, { allowExpectedBooking409: true })
  await openBooking(page)
  await restoreDraft(page, [RACE_DATE])
  await expect(page.getByTestId('booking-step4-total')).toHaveText('฿625')
  await page.getByRole('button', { name: /ถัดไป/ }).click()
  await expect(page.getByTestId('booking-step5-total')).toHaveText('฿625')
  const beforeBookings = await countForUser('bookings', fixture.userId)
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
    if (error) throw new Error(`arm capacity race: ${error.message}`)
    await route.fulfill({ response })
  })
  await page.getByTestId('booking-confirm').click()
  await expect(page.getByText(/เต็มแล้ว กรุณาเลือกวันเรียนใหม่/).first()).toBeVisible()
  await expect(page.getByText('PROGRESSIVE_CAPACITY_EXCEEDED')).toHaveCount(0)
  await expect(page.getByText('รวมทั้งหมด 1 ครั้ง')).toBeVisible()
  await expect(page.getByText(/เต็ม\/ไม่พร้อม/)).toBeVisible()
  expect(await countForUser('bookings', fixture.userId)).toBe(beforeBookings)
  await page.screenshot({ path: testInfo.outputPath('capacity-race-thai-error.png'), fullPage: true })
  expect(browserErrors.getExpectedBooking409s()).toBe(1)
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

  await openBooking(page)
  await selectKidsFlow(page, BOOKING_DATES)
  await expect(page.getByTestId('booking-step4-total')).toHaveText('฿2,000')
  await page.screenshot({ path: testInfo.outputPath('actual-step4-2000.png'), fullPage: true })
  await page.getByRole('button', { name: /ถัดไป/ }).click()
  await expect(page.getByTestId('booking-step5-total')).toHaveText('฿2,000')
  await expect(page.getByTestId('booking-progressive-preview')).toContainText('จองเพิ่มครั้งนี้: 4 ครั้ง')
  await expect(page.getByTestId('booking-progressive-preview')).toContainText('เรทสำหรับการจองครั้งนี้: 500 บาท/ครั้ง')
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
  const zeroTables = ['progressive_payment_batch_bookings', 'progressive_payment_allocations', 'progressive_payment_verification_attempts', 'lesson_wallet_credits', 'finance_expenses']
  for (const table of zeroTables) {
    const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true })
    if (error) throw new Error(`count ${table}: ${error.message}`)
    expect(count, table).toBe(0)
  }
  await expectNoBrowserErrors(browserErrors)
})
