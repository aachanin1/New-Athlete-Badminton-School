import { expect, test, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import {
  HISTORY_ACCOUNT,
  createLocalAdmin,
  readHistoryPaymentFixture,
  type HistoryPaymentFixture,
} from './local-supabase'

test.describe.configure({ mode: 'serial' })

let fixture: HistoryPaymentFixture

test.beforeAll(() => {
  fixture = readHistoryPaymentFixture()
})

function observeBrowserErrors(page: Page, allowExpectedPrepare409 = false) {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    if (allowExpectedPrepare409 && /Failed to load resource:.*status of 409/.test(message.text())) return
    errors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  return errors
}

async function loginAndOpenHistory(page: Page) {
  await page.goto('/auth/login')
  await page.locator('#email').fill(HISTORY_ACCOUNT.email)
  await page.locator('#password').fill(HISTORY_ACCOUNT.password)
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
  await page.waitForURL(/\/dashboard(?:\/|$)/)
  await page.goto('/dashboard/history')
  await expect(page.getByTestId(`progressive-payment-prepare-${fixture.scopeId}`)).toBeVisible()
}

async function selectTwo(page: Page) {
  const second = page.getByTestId(`progressive-payment-select-${fixture.bookingIds[1]}`)
  if (!await second.isChecked()) await second.check()
  await expect(second).toBeChecked()
  await expect(page.getByText('ยอดที่เลือก ฿4,330', { exact: true })).toBeVisible()
}

async function waitForLifecycle(page: Page, state: string) {
  await expect(page.getByTestId('progressive-payment-lifecycle')).toHaveText(state)
}

async function countRows(table: string, filters: Record<string, string> = {}) {
  const admin = createLocalAdmin()
  let query = admin.from(table).select('*', { count: 'exact', head: true })
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value)
  const { count, error } = await query
  if (error) throw new Error(`count ${table}: ${error.message}`)
  return count || 0
}

async function readScope() {
  const admin = createLocalAdmin()
  const { data, error } = await admin.from('booking_pricing_scopes')
    .select('revision,locked_by_payment_batch_id,locked_at')
    .eq('id', fixture.scopeId)
    .single()
  if (error) throw new Error(`read scope: ${error.message}`)
  return data
}

async function readBatches() {
  const admin = createLocalAdmin()
  const { data, error } = await admin.from('progressive_payment_batches')
    .select('id,status,total_amount,member_count,slip_storage_path,slip_sha256')
    .eq('user_id', fixture.userId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`read batches: ${error.message}`)
  return data
}

async function financialSnapshot() {
  return {
    payments: await countRows('payments'),
    attempts: await countRows('progressive_payment_verification_attempts'),
    allocations: await countRows('progressive_payment_allocations'),
    ledger: await countRows('Ledger'),
    finance: await countRows('finance_expenses'),
    couponReservations: await countRows('progressive_coupon_reservations'),
    couponUsages: await countRows('coupon_usages'),
    wallet: await countRows('lesson_wallet_credits'),
  }
}

async function protectedBookingSnapshot() {
  const admin = createLocalAdmin()
  const { data: bookings, error: bookingError } = await admin.from('bookings')
    .select('id,status,total_price,total_sessions,pricing_scope_id,pricing_revision')
    .in('id', fixture.bookingIds)
    .order('created_at', { ascending: true })
  if (bookingError) throw new Error(`read protected bookings: ${bookingError.message}`)
  const { data: sessions, error: sessionError } = await admin.from('booking_sessions')
    .select('id,booking_id,status,date,start_time,end_time')
    .in('booking_id', fixture.bookingIds)
    .order('date', { ascending: true })
  if (sessionError) throw new Error(`read protected sessions: ${sessionError.message}`)
  return { bookings, sessions }
}

test('rapid prepare is single-flight; cancel waits for refresh; reprepare uses the new revision', async ({ page }, testInfo) => {
  const browserErrors = observeBrowserErrors(page)
  const financialBefore = await financialSnapshot()
  const protectedBefore = await protectedBookingSnapshot()
  const activityBefore = await countRows('activity_logs', { user_id: fixture.userId })
  await loginAndOpenHistory(page)
  await selectTwo(page)

  let prepareRequests = 0
  let cancelRequests = 0
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (request.method() === 'POST' && path === '/api/progressive-payments/prepare') prepareRequests += 1
    if (request.method() === 'POST' && path.endsWith('/cancel')) cancelRequests += 1
  })
  await page.route('**/api/progressive-payments/prepare', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400))
    await route.continue()
  })

  const prepareButton = page.getByTestId(`progressive-payment-prepare-${fixture.scopeId}`)
  await prepareButton.evaluate((button) => {
    ;(button as HTMLButtonElement).click()
    ;(button as HTMLButtonElement).click()
  })
  await waitForLifecycle(page, 'preparing')
  await expect(prepareButton).toBeDisabled()
  await expect(page.getByTestId('payment-slip-modal')).toBeVisible()
  expect(prepareRequests).toBe(1)
  await expect(page.getByTestId('payment-slip-modal')).toContainText('฿4,330 · 2 รายการ')
  await expect(page.locator('#slip-upload')).toBeEnabled()
  await page.screenshot({ path: testInfo.outputPath('history-first-prepared-4330.png'), fullPage: true })
  await page.unroute('**/api/progressive-payments/prepare')

  await page.route('**/api/progressive-payments/*/cancel', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    await route.continue()
  })
  await page.getByTestId('payment-modal-cancel').click()
  await waitForLifecycle(page, 'cancelling')
  await expect(prepareButton).toBeDisabled()
  await expect(page.locator('#slip-upload')).toHaveCount(0)
  await waitForLifecycle(page, 'idle')
  expect(cancelRequests).toBe(1)
  await page.unroute('**/api/progressive-payments/*/cancel')
  expect(await readScope()).toMatchObject({ revision: 2, locked_by_payment_batch_id: null, locked_at: null })

  await expect(prepareButton).toBeEnabled()
  await prepareButton.click()
  await expect(page.getByTestId('payment-slip-modal')).toBeVisible()
  expect(prepareRequests).toBe(2)
  await expect(page.getByTestId('payment-slip-modal')).toContainText('฿4,330 · 2 รายการ')
  await page.getByTestId('payment-modal-cancel').click()
  await waitForLifecycle(page, 'idle')
  expect(cancelRequests).toBe(2)

  const batches = await readBatches()
  expect(batches).toHaveLength(2)
  expect(batches.map((batch) => batch.status)).toEqual(['cancelled', 'cancelled'])
  expect(batches.map((batch) => [Number(batch.total_amount), batch.member_count])).toEqual([[4330, 2], [4330, 2]])
  expect(batches.every((batch) => !batch.slip_storage_path && !batch.slip_sha256)).toBe(true)
  expect(await countRows('progressive_payment_batch_bookings')).toBe(4)
  expect(await countRows('progressive_payment_batch_bookings', { active: 'true' })).toBe(0)
  expect(await readScope()).toMatchObject({ revision: 3, locked_by_payment_batch_id: null, locked_at: null })
  expect(await financialSnapshot()).toEqual(financialBefore)
  expect(await protectedBookingSnapshot()).toEqual(protectedBefore)
  expect(await countRows('activity_logs', { user_id: fixture.userId }) - activityBefore).toBe(4)
  expect(browserErrors).toEqual([])
})

test('stale revision returns typed 409, shows Thai error outside the modal, refreshes once, then retries safely', async ({ page }, testInfo) => {
  const browserErrors = observeBrowserErrors(page, true)
  await loginAndOpenHistory(page)
  await selectTwo(page)
  const scopeBefore = await readScope()
  const batchesBefore = await countRows('progressive_payment_batches')
  const membersBefore = await countRows('progressive_payment_batch_bookings')
  const admin = createLocalAdmin()
  const { error: revisionError } = await admin.from('booking_pricing_scopes')
    .update({ revision: scopeBefore.revision + 1 })
    .eq('id', fixture.scopeId)
  if (revisionError) throw new Error(`advance disposable scope revision: ${revisionError.message}`)

  let prepareRequests = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/progressive-payments/prepare') prepareRequests += 1
  })
  const responsePromise = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/progressive-payments/prepare'
  ))
  await page.getByTestId(`progressive-payment-prepare-${fixture.scopeId}`).click()
  const response = await responsePromise
  expect(response.status()).toBe(409)
  await expect(response.json()).resolves.toMatchObject({
    code: 'PROGRESSIVE_SCOPE_REVISION_CONFLICT',
    error: 'Progressive payment scope changed',
    refreshRequired: true,
  })
  await expect(page.getByTestId('payment-slip-modal')).toHaveCount(0)
  await expect(page.getByTestId('progressive-payment-error')).toHaveText(
    'ข้อมูลรายการชำระมีการเปลี่ยนแปลง ระบบกำลังอัปเดตรายการ กรุณาลองใหม่อีกครั้ง',
  )
  await expect(page.getByTestId('progressive-payment-error')).not.toContainText('PROGRESSIVE_SCOPE_REVISION_CONFLICT')
  await page.screenshot({ path: testInfo.outputPath('history-stale-revision-thai-error.png'), fullPage: true })
  await waitForLifecycle(page, 'idle')
  await expect(page.getByTestId(`progressive-payment-select-${fixture.bookingIds[1]}`)).toBeChecked()
  await page.waitForTimeout(500)
  expect(prepareRequests).toBe(1)
  expect(await countRows('progressive_payment_batches')).toBe(batchesBefore)
  expect(await countRows('progressive_payment_batch_bookings')).toBe(membersBefore)

  await page.getByTestId(`progressive-payment-prepare-${fixture.scopeId}`).click()
  await expect(page.getByTestId('payment-slip-modal')).toBeVisible()
  expect(prepareRequests).toBe(2)
  await page.getByTestId('payment-modal-cancel').click()
  await waitForLifecycle(page, 'idle')
  expect((await readScope()).locked_by_payment_batch_id).toBeNull()
  expect(browserErrors).toEqual([])
})

test('cancel failure keeps the prepared batch safe until refreshed server state is reconciled', async ({ page }) => {
  const browserErrors = observeBrowserErrors(page)
  await loginAndOpenHistory(page)
  await selectTwo(page)
  await page.getByTestId(`progressive-payment-prepare-${fixture.scopeId}`).click()
  await expect(page.getByTestId('payment-slip-modal')).toBeVisible()

  await page.route('**/api/progressive-payments/*/cancel', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'PROGRESSIVE_RPC_UNAVAILABLE',
        error: 'Progressive payment service is unavailable',
        refreshRequired: false,
      }),
    })
  })
  await page.getByTestId('payment-modal-cancel').click()
  await expect(page.getByTestId('payment-slip-modal')).toHaveCount(0)
  await expect(page.getByTestId('progressive-payment-error')).toHaveText(
    'ยกเลิกรายการชำระเงินไม่สำเร็จ ระบบกำลังตรวจสอบสถานะ กรุณารอสักครู่',
  )
  await expect(page.locator('#slip-upload')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'ดำเนินการชำระต่อ' })).toBeVisible()
  const active = (await readBatches()).filter((batch) => batch.status === 'prepared')
  expect(active).toHaveLength(1)
  expect((await readScope()).locked_by_payment_batch_id).toBe(active[0].id)

  await page.unroute('**/api/progressive-payments/*/cancel')
  await page.getByRole('button', { name: 'ดำเนินการชำระต่อ' }).click()
  await expect(page.getByTestId('payment-slip-modal')).toBeVisible()
  await page.getByTestId('payment-modal-cancel').click()
  await waitForLifecycle(page, 'idle')
  expect((await readScope()).locked_by_payment_batch_id).toBeNull()
  expect(browserErrors).toEqual([])
})

test('real payment guards preserve one-item prefix and reject a skipped prefix with typed zero-write 409', async ({ page }) => {
  const browserErrors = observeBrowserErrors(page, true)
  await loginAndOpenHistory(page)
  const scope = await readScope()
  const first = await page.evaluate(async ({ scopeId, bookingId, revision }) => {
    const response = await fetch('/api/progressive-payments/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pricingScopeId: scopeId,
        bookingIds: [bookingId],
        expectedScopeRevision: revision,
        idempotencyKey: crypto.randomUUID(),
      }),
    })
    return { status: response.status, body: await response.json() }
  }, { scopeId: fixture.scopeId, bookingId: fixture.bookingIds[0], revision: scope.revision })
  expect(first.status).toBe(200)
  expect(first.body.batch).toMatchObject({ status: 'prepared', bookingIds: [fixture.bookingIds[0]], totalAmount: 3464 })
  const cancelled = await page.evaluate(async (batchId) => {
    const response = await fetch(`/api/progressive-payments/${batchId}/cancel`, { method: 'POST' })
    return { status: response.status, body: await response.json() }
  }, first.body.batch.batchId as string)
  expect(cancelled.status).toBe(200)
  expect(cancelled.body.batch.status).toBe('cancelled')

  const current = await readScope()
  const batchCountBefore = await countRows('progressive_payment_batches')
  const memberCountBefore = await countRows('progressive_payment_batch_bookings')
  const skipped = await page.evaluate(async ({ scopeId, bookingId, revision }) => {
    const response = await fetch('/api/progressive-payments/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pricingScopeId: scopeId,
        bookingIds: [bookingId],
        expectedScopeRevision: revision,
        idempotencyKey: crypto.randomUUID(),
      }),
    })
    return { status: response.status, body: await response.json() }
  }, { scopeId: fixture.scopeId, bookingId: fixture.bookingIds[1], revision: current.revision })
  expect(skipped).toMatchObject({
    status: 409,
    body: { code: 'PROGRESSIVE_PAYMENT_PREFIX_REQUIRED', refreshRequired: true },
  })
  expect(await countRows('progressive_payment_batches')).toBe(batchCountBefore)
  expect(await countRows('progressive_payment_batch_bookings')).toBe(memberCountBefore)
  expect((await readScope()).locked_by_payment_batch_id).toBeNull()
  expect(browserErrors).toEqual([])
})
