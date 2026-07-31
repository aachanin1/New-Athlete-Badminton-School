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

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]
const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]
const WEBP_BYTES = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]
const GIF_BYTES = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]
const HEIC_BYTES = [0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]

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
    .select('id,status,total_amount,member_count,slip_storage_path,slip_mime_type,slip_size_bytes,slip_sha256')
    .eq('user_id', fixture.userId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`read batches: ${error.message}`)
  return data
}

async function listBatchStorage(batchId: string) {
  const admin = createLocalAdmin()
  const { data, error } = await admin.storage.from('progressive-payment-slips')
    .list(`${fixture.userId}/batches/${batchId}`, { limit: 100, offset: 0 })
  if (error) throw new Error(`list batch storage: ${error.message}`)
  return data
}

async function prepareCurrentBatch(page: Page) {
  const scope = await readScope()
  const prepared = await page.evaluate(async ({ scopeId, bookingIds, revision }) => {
    const response = await fetch('/api/progressive-payments/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pricingScopeId: scopeId,
        bookingIds,
        expectedScopeRevision: revision,
        idempotencyKey: crypto.randomUUID(),
      }),
    })
    return { status: response.status, body: await response.json() }
  }, { scopeId: fixture.scopeId, bookingIds: fixture.bookingIds, revision: scope.revision })
  expect(prepared.status).toBe(200)
  expect(prepared.body.batch).toMatchObject({ status: 'prepared', bookingIds: fixture.bookingIds })
  return prepared.body.batch as { batchId: string; status: string }
}

async function uploadProgressiveFile(page: Page, input: {
  batchId?: string
  name?: string
  mimeType?: string
  bytes?: number[]
  size?: number
}) {
  return page.evaluate(async ({ batchId, name, mimeType, bytes, size }) => {
    const form = new FormData()
    if (batchId) form.append('batchId', batchId)
    if (name && bytes) {
      const content = new Uint8Array(size || bytes.length)
      content.set(bytes)
      form.append('file', new File([content], name, mimeType ? { type: mimeType } : undefined))
    }
    const response = await fetch('/api/progressive-payments/upload', { method: 'POST', body: form })
    const body = await response.json().catch(() => ({}))
    return { status: response.status, body }
  }, input)
}

async function uploadLegacyFile(page: Page, input: {
  bookingId?: string
  expectedAmount?: number
  name?: string
  mimeType?: string
  bytes?: number[]
  size?: number
}) {
  return page.evaluate(async ({ bookingId, expectedAmount, name, mimeType, bytes, size }) => {
    const form = new FormData()
    if (bookingId) form.append('bookingIds', JSON.stringify([bookingId]))
    if (expectedAmount !== undefined) form.append('expectedAmount', String(expectedAmount))
    if (name && bytes) {
      const content = new Uint8Array(size || bytes.length)
      content.set(bytes)
      form.append('file', new File([content], name, mimeType ? { type: mimeType } : undefined))
    }
    const response = await fetch('/api/verify-slip', { method: 'POST', body: form })
    const body = await response.json().catch(() => ({}))
    return { status: response.status, body }
  }, input)
}

async function readLegacyBooking(bookingId: string) {
  const admin = createLocalAdmin()
  const { data, error } = await admin.from('bookings')
    .select('id,status,total_price,pricing_scope_id')
    .eq('id', bookingId)
    .single()
  if (error) throw new Error(`read Legacy booking: ${error.message}`)
  return data
}

async function readLegacyPayment(bookingId: string) {
  const admin = createLocalAdmin()
  const { data, error } = await admin.from('payments')
    .select('id,booking_id,status,amount,slip_image_url,notes')
    .eq('booking_id', bookingId)
    .maybeSingle()
  if (error) throw new Error(`read Legacy payment: ${error.message}`)
  return data
}

async function listLegacyStorage() {
  const admin = createLocalAdmin()
  const { data, error } = await admin.storage.from('payment-slips')
    .list(fixture.userId, { limit: 100, offset: 0 })
  if (error) throw new Error(`list Legacy storage: ${error.message}`)
  return data
}

async function financialSnapshot() {
  return {
    payments: await countRows('payments'),
    attempts: await countRows('progressive_payment_verification_attempts'),
    allocations: await countRows('progressive_payment_allocations'),
    ledger: await countRows('Ledger'),
    ledgerAllocations: await countRows('payment_ledger_allocations_v1'),
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

test('valid JPEG bytes declared as image/jpg upload without requiring a resave', async ({ page }) => {
  await loginAndOpenHistory(page)
  const batch = await prepareCurrentBatch(page)
  const uploaded = await uploadProgressiveFile(page, {
    batchId: batch.batchId,
    name: 'android-line-slip.jpg',
    mimeType: 'image/jpg',
    bytes: JPEG_BYTES,
  })
  expect(uploaded).toMatchObject({
    status: 200,
    body: { success: true, upload: { mimeType: 'image/jpeg', sizeBytes: JPEG_BYTES.length } },
  })
  const cancelled = await page.evaluate(async (batchId) => {
    const response = await fetch(`/api/progressive-payments/${batchId}/cancel`, { method: 'POST' })
    return { status: response.status, body: await response.json() }
  }, batch.batchId)
  expect(cancelled).toMatchObject({ status: 200, body: { batch: { status: 'cancelled' } } })
})

test('Progressive upload client preserves Thai server errors and reserves the network message for transport failure', async ({ page }) => {
  const financialBefore = await financialSnapshot()
  const protectedBefore = await protectedBookingSnapshot()
  await loginAndOpenHistory(page)
  await selectTwo(page)
  await page.getByTestId(`progressive-payment-prepare-${fixture.scopeId}`).click()
  await expect(page.getByTestId('payment-slip-modal')).toBeVisible()

  await page.locator('#slip-upload').setInputFiles({
    name: 'android-line-slip.jpg',
    mimeType: 'image/jpg',
    buffer: Buffer.from([...JPEG_BYTES, 0xe8]),
  })
  await expect(page.getByRole('button', { name: 'ส่งสลิปชำระเงิน' })).toBeEnabled()

  const serverMessage = 'เนื้อไฟล์ไม่ใช่ JPEG, PNG หรือ WebP ที่ระบบรองรับ'
  await page.route('**/api/progressive-payments/upload', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'PROGRESSIVE_UPLOAD_UNSUPPORTED_FILE', error: serverMessage }),
    })
  })
  await page.getByRole('button', { name: 'ส่งสลิปชำระเงิน' }).click()
  await expect(page.getByText(serverMessage, { exact: true })).toBeVisible()
  await expect(page.getByTestId('payment-slip-modal')).not.toContainText('ตรวจสอบอินเทอร์เน็ต')
  await page.unroute('**/api/progressive-payments/upload')

  await page.route('**/api/progressive-payments/upload', async (route) => {
    await route.abort('internetdisconnected')
  })
  await page.getByRole('button', { name: 'ส่งสลิปชำระเงิน' }).evaluate((button) => {
    ;(button as HTMLButtonElement).click()
  })
  await expect(page.getByText('เชื่อมต่อระบบตรวจสอบสลิปไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่', { exact: true })).toBeVisible()
  await page.unroute('**/api/progressive-payments/upload')

  await page.getByTestId('payment-modal-cancel').evaluate((button) => {
    ;(button as HTMLButtonElement).click()
  })
  await waitForLifecycle(page, 'idle')
  expect(await financialSnapshot()).toEqual(financialBefore)
  expect(await protectedBookingSnapshot()).toEqual(protectedBefore)
})

test('Progressive upload trusts JPEG, PNG, and WebP magic bytes, rejects unsafe files, and keeps rejected batches zero-write', async ({ page }) => {
  const financialBefore = await financialSnapshot()
  const protectedBefore = await protectedBookingSnapshot()
  await loginAndOpenHistory(page)
  const batch = await prepareCurrentBatch(page)

  const rejectedCases = [
    {
      expectedStatus: 400,
      expectedCode: 'PROGRESSIVE_UPLOAD_INVALID_PAYLOAD',
      input: {},
    },
    {
      expectedStatus: 413,
      expectedCode: 'PROGRESSIVE_UPLOAD_FILE_TOO_LARGE',
      input: {
        batchId: batch.batchId,
        name: 'oversize.jpg',
        mimeType: 'image/jpeg',
        bytes: JPEG_BYTES,
        size: 4 * 1024 * 1024 + 1,
      },
    },
    {
      expectedStatus: 400,
      expectedCode: 'PROGRESSIVE_UPLOAD_UNSUPPORTED_FILE',
      input: { batchId: batch.batchId, name: 'fake.jpg', mimeType: 'image/jpeg', bytes: Array(12).fill(0x41) },
    },
    {
      expectedStatus: 400,
      expectedCode: 'PROGRESSIVE_UPLOAD_UNSUPPORTED_FILE',
      input: { batchId: batch.batchId, name: 'animated.gif', mimeType: 'image/gif', bytes: GIF_BYTES },
    },
    {
      expectedStatus: 400,
      expectedCode: 'PROGRESSIVE_UPLOAD_UNSUPPORTED_FILE',
      input: { batchId: batch.batchId, name: 'phone.heic', mimeType: 'image/heic', bytes: HEIC_BYTES },
    },
  ]
  for (const rejected of rejectedCases) {
    const result = await uploadProgressiveFile(page, rejected.input)
    expect(result).toMatchObject({
      status: rejected.expectedStatus,
      body: { code: rejected.expectedCode },
    })
    expect(String((result.body as { error?: string }).error || '')).toMatch(/[ก-๙]/)
  }

  const rejectedBatch = (await readBatches()).find((candidate) => candidate.id === batch.batchId)
  expect(rejectedBatch).toMatchObject({
    status: 'prepared',
    slip_storage_path: null,
    slip_mime_type: null,
    slip_size_bytes: null,
    slip_sha256: null,
  })
  expect(await listBatchStorage(batch.batchId)).toHaveLength(0)
  expect(await financialSnapshot()).toEqual(financialBefore)
  expect(await protectedBookingSnapshot()).toEqual(protectedBefore)

  const acceptedCases = [
    {
      name: 'boundary.jpg',
      mimeType: 'image/jpeg',
      bytes: JPEG_BYTES,
      size: 4 * 1024 * 1024,
      expectedMime: 'image/jpeg',
    },
    { name: 'standard.jpg', mimeType: 'image/jpeg', bytes: [...JPEG_BYTES, 0xd1], expectedMime: 'image/jpeg' },
    { name: 'android-alias.jpg', mimeType: 'image/jpg', bytes: [...JPEG_BYTES, 0xd2], expectedMime: 'image/jpeg' },
    { name: 'untrusted.bin', mimeType: 'application/octet-stream', bytes: [...JPEG_BYTES, 0xd3], expectedMime: 'image/jpeg' },
    { name: 'blank-mime.jpg', mimeType: '', bytes: [...JPEG_BYTES, 0xd4], expectedMime: 'image/jpeg' },
    { name: 'standard.png', mimeType: 'image/png', bytes: [...PNG_BYTES, 0xd5], expectedMime: 'image/png' },
    { name: 'standard.webp', mimeType: 'image/webp', bytes: [...WEBP_BYTES, 0xd6], expectedMime: 'image/webp' },
  ]
  for (const accepted of acceptedCases) {
    const result = await uploadProgressiveFile(page, { batchId: batch.batchId, ...accepted })
    expect(result).toMatchObject({
      status: 200,
      body: {
        success: true,
        upload: { mimeType: accepted.expectedMime, sizeBytes: accepted.size || accepted.bytes.length },
      },
    })
  }

  const uploadedBatch = (await readBatches()).find((candidate) => candidate.id === batch.batchId)
  expect(uploadedBatch).toMatchObject({
    status: 'prepared',
    slip_mime_type: 'image/webp',
    slip_size_bytes: WEBP_BYTES.length + 1,
  })
  expect((await listBatchStorage(batch.batchId)).length).toBeGreaterThanOrEqual(acceptedCases.length)
  expect(await financialSnapshot()).toEqual(financialBefore)
  expect(await protectedBookingSnapshot()).toEqual(protectedBefore)

  const cancelled = await page.evaluate(async (batchId) => {
    const response = await fetch(`/api/progressive-payments/${batchId}/cancel`, { method: 'POST' })
    return { status: response.status, body: await response.json() }
  }, batch.batchId)
  expect(cancelled).toMatchObject({ status: 200, body: { batch: { status: 'cancelled' } } })
  const notReady = await uploadProgressiveFile(page, {
    batchId: batch.batchId,
    name: 'retry.jpg',
    mimeType: 'image/jpeg',
    bytes: JPEG_BYTES,
  })
  expect(notReady).toMatchObject({
    status: 409,
    body: { code: 'PROGRESSIVE_UPLOAD_BATCH_NOT_READY' },
  })
})

test('Legacy upload shares the four MiB magic-byte contract and keeps invalid requests zero-write', async ({ page }) => {
  const financialBeforeInvalid = await financialSnapshot()
  await loginAndOpenHistory(page)
  expect(await listLegacyStorage()).toHaveLength(0)
  expect(await readLegacyPayment(fixture.legacyInvalidBookingId)).toBeNull()
  expect(await readLegacyBooking(fixture.legacyInvalidBookingId)).toMatchObject({
    status: 'pending_payment',
    pricing_scope_id: null,
  })

  const rejectedCases = [
    {
      expectedStatus: 400,
      expectedCode: 'INVALID_SLIP_UPLOAD_PAYLOAD',
      input: {},
    },
    {
      expectedStatus: 413,
      expectedCode: 'SLIP_FILE_TOO_LARGE',
      input: {
        bookingId: fixture.legacyInvalidBookingId,
        expectedAmount: fixture.legacyAmount,
        name: 'oversize.jpg',
        mimeType: 'image/jpeg',
        bytes: JPEG_BYTES,
        size: 4 * 1024 * 1024 + 1,
      },
    },
    {
      expectedStatus: 400,
      expectedCode: 'INVALID_SLIP_FILE_TYPE',
      input: {
        bookingId: fixture.legacyInvalidBookingId,
        expectedAmount: fixture.legacyAmount,
        name: 'fake.jpg',
        mimeType: 'image/jpeg',
        bytes: Array(12).fill(0x41),
      },
    },
    {
      expectedStatus: 400,
      expectedCode: 'INVALID_SLIP_FILE_TYPE',
      input: {
        bookingId: fixture.legacyInvalidBookingId,
        expectedAmount: fixture.legacyAmount,
        name: 'animated.gif',
        mimeType: 'image/gif',
        bytes: GIF_BYTES,
      },
    },
    {
      expectedStatus: 400,
      expectedCode: 'INVALID_SLIP_FILE_TYPE',
      input: {
        bookingId: fixture.legacyInvalidBookingId,
        expectedAmount: fixture.legacyAmount,
        name: 'phone.heic',
        mimeType: 'image/heic',
        bytes: HEIC_BYTES,
      },
    },
  ]
  for (const rejected of rejectedCases) {
    const result = await uploadLegacyFile(page, rejected.input)
    expect(result).toMatchObject({
      status: rejected.expectedStatus,
      body: { success: false, code: rejected.expectedCode },
    })
    expect(String((result.body as { error?: string }).error || '')).toMatch(/[ก-๙]/)
  }

  expect(await listLegacyStorage()).toHaveLength(0)
  expect(await readLegacyPayment(fixture.legacyInvalidBookingId)).toBeNull()
  expect(await readLegacyBooking(fixture.legacyInvalidBookingId)).toMatchObject({ status: 'pending_payment' })
  expect(await financialSnapshot()).toEqual(financialBeforeInvalid)

  const acceptedCases = [
    {
      name: 'boundary.jpg',
      mimeType: 'image/jpeg',
      bytes: JPEG_BYTES,
      size: 4 * 1024 * 1024,
      expectedMime: 'image/jpeg',
      expectedExtension: 'jpg',
    },
    {
      name: 'android-alias.jpg',
      mimeType: 'image/jpg',
      bytes: [...JPEG_BYTES, 0xe1],
      expectedMime: 'image/jpeg',
      expectedExtension: 'jpg',
    },
    {
      name: 'blank-mime.jpg',
      mimeType: '',
      bytes: [...JPEG_BYTES, 0xe2],
      expectedMime: 'image/jpeg',
      expectedExtension: 'jpg',
    },
    {
      name: 'untrusted.bin',
      mimeType: 'application/octet-stream',
      bytes: [...JPEG_BYTES, 0xe3],
      expectedMime: 'image/jpeg',
      expectedExtension: 'jpg',
    },
    {
      name: 'standard.png',
      mimeType: 'image/png',
      bytes: [...PNG_BYTES, 0xe4],
      expectedMime: 'image/png',
      expectedExtension: 'png',
    },
    {
      name: 'standard.webp',
      mimeType: 'image/webp',
      bytes: [...WEBP_BYTES, 0xe5],
      expectedMime: 'image/webp',
      expectedExtension: 'webp',
    },
  ]
  const paymentsBeforeAccepted = await countRows('payments')
  for (const [index, accepted] of acceptedCases.entries()) {
    const bookingId = fixture.legacyBookingIds[index]
    const result = await uploadLegacyFile(page, {
      bookingId,
      expectedAmount: fixture.legacyAmount,
      ...accepted,
    })
    expect(result).toMatchObject({
      status: 200,
      body: {
        success: true,
        verified: true,
        paymentStatus: 'approved',
        bookingStatus: 'verified',
      },
    })
    expect(await readLegacyBooking(bookingId)).toMatchObject({ status: 'verified', pricing_scope_id: null })
    const payment = await readLegacyPayment(bookingId)
    expect(payment).toMatchObject({
      booking_id: bookingId,
      status: 'approved',
      amount: fixture.legacyAmount,
    })
    expect(payment?.notes).toContain('[TEST MODE] Auto-verified')
    expect(payment?.slip_image_url).toMatch(new RegExp(`${bookingId}-\\d+\\.${accepted.expectedExtension}$`))
    const stored = await fetch(payment!.slip_image_url!, { method: 'HEAD' })
    expect(stored.ok).toBe(true)
    expect(stored.headers.get('content-type')?.split(';')[0]).toBe(accepted.expectedMime)
  }

  expect(await countRows('payments') - paymentsBeforeAccepted).toBe(acceptedCases.length)
  expect(await listLegacyStorage()).toHaveLength(acceptedCases.length)
  expect(await readLegacyPayment(fixture.legacyInvalidBookingId)).toBeNull()
  expect(await readLegacyBooking(fixture.legacyInvalidBookingId)).toMatchObject({ status: 'pending_payment' })
})

test('valid image/jpg completes the existing shared Test Mode approval transition', async ({ page }) => {
  const financialBefore = await financialSnapshot()
  await loginAndOpenHistory(page)
  await selectTwo(page)
  await page.getByTestId(`progressive-payment-prepare-${fixture.scopeId}`).click()
  await expect(page.getByTestId('payment-slip-modal')).toBeVisible()
  await page.locator('#slip-upload').setInputFiles({
    name: 'android-line-slip.jpg',
    mimeType: 'image/jpg',
    buffer: Buffer.from([...JPEG_BYTES, 0xe9]),
  })

  const uploadResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/progressive-payments/upload'
  ))
  const submitResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/progressive-payments/submit'
  ))
  await page.getByRole('button', { name: 'ส่งสลิปชำระเงิน' }).click()
  expect((await uploadResponse).status()).toBe(200)
  expect((await submitResponse).status()).toBe(200)
  await expect(page.getByTestId('payment-slip-modal')).toHaveCount(0)

  const batches = await readBatches()
  expect(batches.at(-1)).toMatchObject({ status: 'approved', slip_mime_type: 'image/jpeg' })
  const protectedAfter = await protectedBookingSnapshot()
  expect(protectedAfter.bookings.map((booking) => booking.status)).toEqual(['verified', 'verified'])
  expect(await readScope()).toMatchObject({ locked_by_payment_batch_id: null, locked_at: null })
  const financialAfter = await financialSnapshot()
  expect(financialAfter.payments).toBe(financialBefore.payments)
  expect(financialAfter.attempts - financialBefore.attempts).toBe(1)
  expect(financialAfter.allocations - financialBefore.allocations).toBe(2)
  expect(financialAfter.ledger).toBe(financialBefore.ledger)
  expect(financialAfter.ledgerAllocations - financialBefore.ledgerAllocations).toBe(2)
  expect(financialAfter.finance).toBe(financialBefore.finance)
})
