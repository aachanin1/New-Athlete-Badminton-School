import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { TEST_ACCOUNT, TEST_ADMIN_ACCOUNT } from '../booking-regression/local-supabase'
import { concurrentLocalSql, createLocalAdmin, localSql, readTask10Fixture, setDisposableClock, setupTask10, sqlLiteral, task10MigrationHashes, trackTask10Storage } from './local-supabase'

test.afterAll(async () => { await setupTask10() })

test('Adult and Private retain preview recovery after a transient read failure without the Kids policy latch', async ({ page }, testInfo) => {
  test.setTimeout(180_000)
  await setupTask10()
  const f = readTask10Fixture()
  const client = createLocalAdmin()
  const date = '2031-07-20'
  const courses = [{ id: f.adultCourseId, label: 'ผู้ใหญ่ (กลุ่ม)' }, { id: f.privateCourseId, label: 'Private' }]
  const templates = await client.from('schedule_templates').insert(courses.map(course => ({
    id: randomUUID(), branch_id: f.branchId, course_type_id: course.id,
    day_of_week: new Date(`${date}T00:00:00Z`).getUTCDay(), start_time: '09:00', end_time: '10:00', is_active: true,
  })))
  expect(templates.error).toBeNull()
  const invariant = () => localSql(`SELECT md5(jsonb_build_object('b',(SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM bookings b),
    's',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM booking_sessions s),'p',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM payments p))::text);`)
  const before = invariant()
  await page.goto('/auth/login')
  await page.locator('#email').fill(TEST_ACCOUNT.email); await page.locator('#password').fill(TEST_ACCOUNT.password)
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click(); await page.waitForURL(/\/dashboard(?:\/|$)/)
  const evidence: { course: string; requests: number; mode: string }[] = []
  for (const course of courses) {
    // Unmount the prior draft saver before clearing storage for the next course.
    await page.goto('/dashboard')
    await page.evaluate(() => sessionStorage.clear())
    await page.goto('/dashboard/booking?month=2031-07')
    await page.getByText(course.label, { exact: true }).click()
    await page.getByTestId('booking-next').click()
    if (course.label === 'Private') await page.getByText('ตัวเอง', { exact: true }).click()
    await page.getByTestId('booking-next').click()
    await page.getByText('สาขาทดสอบ Localhost', { exact: true }).click()
    await page.getByTestId('booking-next').click()
    let requests = 0
    await page.route('**/api/bookings/preview', async route => {
      requests++
      if (requests === 1) await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'จำลองการอ่านขัดข้องชั่วคราว' }) })
      else await route.continue()
    })
    const recovered = page.waitForResponse(r => r.url().includes('/api/bookings/preview') && r.status() === 200, { timeout: 15_000 })
    await page.getByTestId(`booking-date-${date}`).click()
    await page.getByTestId(`booking-slot-${date}-${f.branchId}-09:00`).click()
    const quote = await (await recovered).json()
    expect(quote.mode).toBe('legacy')
    expect(requests).toBe(2)
    await expect(page.getByTestId('booking-step4-total')).toHaveText(`฿${quote.totalPrice.toLocaleString()}`)
    await expect(page.getByTestId('booking-next')).toBeEnabled()
    evidence.push({ course: course.label, requests, mode: quote.mode })
    await page.unroute('**/api/bookings/preview')
  }
  expect(invariant()).toBe(before)
  await testInfo.attach('non-kids-preview-recovery', { body: Buffer.from(JSON.stringify({ evidence, businessRowsUnchanged: true })), contentType: 'application/json' })
})

test('Booking pricing fails closed for Paused and unavailable, retries and refreshes month without stale tables', async ({ page }, testInfo) => {
  test.setTimeout(300_000)
  await setupTask10()
  const f = readTask10Fixture()
  setDisposableClock('2026-09-15T23:59:59+07:00')
  const artifact = { sourceSha: 'a'.repeat(40), deploymentId: 'dpl_local_policy_ui', targetProjectRef: 'verified-local-disposable',
    migrationHashes: task10MigrationHashes(), productionPromotionConfirmed: true, healthChecksPassed: true }
  localSql(`SELECT task10_activate_v1('${f.adminUserId}',task10_activation_manifest_v1('${f.adminUserId}',${sqlLiteral(JSON.stringify(artifact))}::jsonb));`)
  const invariant = () => localSql(`SELECT md5(jsonb_build_object('b',(SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM bookings b),
    's',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM booking_sessions s),'p',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM payments p))::text);`)
  const before = invariant()
  try {
    await page.goto('/auth/login')
    await page.locator('#email').fill(TEST_ACCOUNT.email); await page.locator('#password').fill(TEST_ACCOUNT.password)
    await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click(); await page.waitForURL(/\/dashboard(?:\/|$)/)
    await page.goto('/dashboard/booking?month=2026-10')
    await page.getByText('เด็ก (กลุ่ม)', { exact: true }).click()
    await expect(page.getByText('ชุดราคาวันจองช่วง 1–15', { exact: false })).toBeVisible()
    localSql(`SELECT task10_pause_v1('${f.adminUserId}',1,true,${sqlLiteral(JSON.stringify(artifact))}::jsonb);`)
    await page.reload(); await page.getByText('เด็ก (กลุ่ม)', { exact: true }).click()
    const status = page.getByTestId('kids-pricing-status')
    await expect(status).toHaveAttribute('data-policy-code', 'TASK10_PRICING_PAUSED')
    await expect(status).toContainText('หยุดชั่วคราว')
    await expect(page.locator('table')).toHaveCount(0)
    await expect(page.getByTestId('booking-next')).toBeDisabled()
    setDisposableClock('2026-09-16T00:00:00+07:00')
    localSql(`SELECT task10_pause_v1('${f.adminUserId}',2,false,${sqlLiteral(JSON.stringify(artifact))}::jsonb);`)
    await page.getByRole('button', { name: 'อ่านสถานะและราคาใหม่', exact: true }).click()
    await expect(status).toHaveCount(0)
    await expect(page.getByText('ชุดราคาวันจองช่วง 16–สิ้นเดือน', { exact: false })).toBeVisible()
    await expect(page.getByText('700 บาท', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: /ถัดไป/ }).click()
    await page.getByText(`${TEST_ACCOUNT.childNickname} - ${TEST_ACCOUNT.childName}`, { exact: true }).click()
    await page.getByRole('button', { name: /ถัดไป/ }).click()
    await page.getByText('สาขาทดสอบ Localhost', { exact: true }).click()
    await page.getByRole('button', { name: /ถัดไป/ }).click()
    let failures = 0
    await page.route('**/api/bookings/preview', async route => {
      failures++
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'TASK10_UNAVAILABLE', error: 'private SQL diagnostic' }) })
    })
    const date = page.locator('[data-testid^="booking-date-2026-10-"]:enabled').first()
    await date.click()
    const openedSlot = page.locator('[data-testid^="booking-slot-2026-10-"]').first()
    const openedSlotId = await openedSlot.getAttribute('data-testid')
    expect(openedSlotId).toBeTruthy()
    await openedSlot.click()
    await expect(status).toHaveAttribute('data-policy-code', 'TASK10_UNAVAILABLE')
    await expect(status).not.toContainText('หยุดชั่วคราว')
    await expect(page.getByText('private SQL diagnostic', { exact: false })).toHaveCount(0)
    await expect(page.getByTestId('booking-step4-total')).toHaveCount(0)
    await expect(page.getByTestId('booking-next')).toBeDisabled()
    expect(failures).toBe(1) // One failed request; explicit retry owns recovery.
    await page.unroute('**/api/bookings/preview')
    await page.getByRole('button', { name: 'อ่านสถานะและราคาใหม่', exact: true }).click()
    await expect(status).toHaveCount(0)
    await expect(page.getByTestId('booking-step4-total')).toHaveText('฿700')
    await expect(page.getByTestId(openedSlotId!)).toBeVisible()
    await page.getByText('ตุลาคม 2569', { exact: true }).locator('..').getByRole('button').last().click()
    await expect(page).toHaveURL(/month=2026-11/)
    await expect(status).toHaveCount(0)
    await testInfo.attach('booking-policy-recovery', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
    expect(invariant()).toBe(before)
  } finally { await setupTask10() }
})

test('all controls Active: UI Booking → slip Payment → sibling Makeup with natural cron and Pause/Resume recovery', async ({ page }, testInfo) => {
  test.setTimeout(420_000)
  const f = readTask10Fixture(), client = createLocalAdmin(), sibling = randomUUID(), sourceBooking = randomUUID(), source = randomUUID()
  setDisposableClock('2026-09-25T10:00:00+07:00')
  // Synthetic historical purchase, before local cutover only. Every write uses
  // localSql's physical container/volume/Auth/REST/Storage identity guard.
  localSql(`BEGIN;
    INSERT INTO children(id,parent_id,full_name,nickname,date_of_birth) VALUES('${sibling}','${f.userId}','Readiness Sibling','Sibling','2016-01-01');
    INSERT INTO schedule_templates(branch_id,course_type_id,day_of_week,start_time,end_time,is_active)
      SELECT '${f.branchId}','${f.kidsCourseId}',d,'17:00','19:00',true FROM generate_series(0,6) d
      WHERE NOT EXISTS(SELECT 1 FROM schedule_templates WHERE branch_id='${f.branchId}' AND course_type_id='${f.kidsCourseId}' AND day_of_week=d AND start_time='17:00' AND end_time='19:00' AND is_active);
    INSERT INTO bookings(id,user_id,learner_type,child_id,branch_id,course_type_id,year,month,total_sessions,entitlement_sessions,total_price,status,created_at)
      VALUES('${sourceBooking}','${f.userId}','child','${f.mainChildId}','${f.branchId}','${f.kidsCourseId}',2026,9,20,20,10000,'verified','2026-09-01T00:00:00Z');
    INSERT INTO schedule_slots(template_id,branch_id,course_type_id,date,start_time,end_time,max_students,current_students,status)
      SELECT t.id,t.branch_id,t.course_type_id,d::date,t.start_time,t.end_time,6,0,'open' FROM generate_series('2026-09-01'::date,'2026-09-20'::date,interval '1 day') d
      JOIN schedule_templates t ON t.branch_id='${f.branchId}' AND t.course_type_id='${f.kidsCourseId}' AND t.day_of_week=extract(dow FROM d) AND t.start_time='17:00' AND t.end_time='19:00' AND t.is_active;
    INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup)
      SELECT CASE WHEN date='2026-09-01' THEN '${source}'::uuid ELSE gen_random_uuid() END,'${sourceBooking}',id,date,start_time,end_time,branch_id,'${f.mainChildId}',
        CASE WHEN date='2026-09-01' THEN 'absent'::session_status ELSE 'scheduled'::session_status END,false
      FROM schedule_slots WHERE branch_id='${f.branchId}' AND course_type_id='${f.kidsCourseId}' AND date BETWEEN '2026-09-01' AND '2026-09-20' AND start_time='17:00';
    INSERT INTO attendance(booking_session_id,student_id,student_type,coach_id,status) VALUES('${source}','${f.mainChildId}','child','${f.adminUserId}','absent'); COMMIT;`)
  const artifact = { sourceSha: 'a'.repeat(40), deploymentId: 'dpl_local_full_readiness', targetProjectRef: 'verified-local-disposable',
    migrationHashes: task10MigrationHashes(), productionPromotionConfirmed: true, healthChecksPassed: true }
  localSql(`SELECT task10_activate_v1('${f.adminUserId}',task10_activation_manifest_v1('${f.adminUserId}',${sqlLiteral(JSON.stringify(artifact))}::jsonb));`)
  const controls = () => JSON.parse(localSql(`SELECT jsonb_build_object('pricing',pricing_enabled,'makeup',makeup_enabled,'expiry',expiry_enabled,'cron',
    (SELECT active FROM cron.job WHERE jobname='task10-expire-unpaid-bookings-v1')) FROM task10_policy_activation;`))
  expect(controls()).toEqual({ pricing: true, makeup: true, expiry: true, cron: true })
  const cronBoundary = localSql('SELECT clock_timestamp();')
  const naturalRuns = () => Number(localSql(`SELECT count(*) FROM cron.job_run_details WHERE jobid=(SELECT jobid FROM cron.job WHERE jobname='task10-expire-unpaid-bookings-v1') AND start_time>'${cronBoundary}'::timestamptz AND status='succeeded';`))
  const worker = async () => {
    const result = JSON.parse(await concurrentLocalSql('SELECT task10_run_expiry_v1(50);'))
    expect(result.failures || []).toEqual([])
    expect(result.status).not.toBe('inactive')
    return result
  }
  await page.goto('/auth/login')
  await page.locator('#email').fill(TEST_ACCOUNT.email); await page.locator('#password').fill(TEST_ACCOUNT.password)
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click(); await page.waitForURL(/\/dashboard(?:\/|$)/)
  const ids: string[] = []
  for (const [index, child] of [f.mainChildId, sibling].entries()) {
    // Preserve real creation order instead of collapsing both bills onto the
    // same synthetic instant and allowing random UUID order to reverse them.
    setDisposableClock(`2026-09-25T10:00:0${index}+07:00`)
    await page.goto('/dashboard/booking')
    await page.getByText('เด็ก (กลุ่ม)', { exact: true }).click()
    await page.getByRole('button', { name: /ถัดไป/ }).click()
    await page.getByText(index === 0 ? `${TEST_ACCOUNT.childNickname} - ${TEST_ACCOUNT.childName}` : 'Sibling - Readiness Sibling', { exact: true }).click()
    await page.getByRole('button', { name: /ถัดไป/ }).click()
    await page.getByText('สาขาทดสอบ Localhost', { exact: true }).click()
    await page.getByRole('button', { name: /ถัดไป/ }).click()
    await page.getByText('กันยายน 2569', { exact: true }).locator('..').getByRole('button').last().click()
    await page.getByTestId(`booking-date-2026-10-${10 + index}`).click()
    await page.getByTestId(`booking-slot-2026-10-${10 + index}-${f.branchId}-17:00`).click()
    await expect(page.getByTestId('booking-step4-total')).toHaveText(index === 0 ? '฿700' : '฿625')
    await page.getByRole('button', { name: /ถัดไป/ }).click()
    await expect(page.getByTestId('booking-step5-total')).toHaveText(index === 0 ? '฿700' : '฿625')
    const responsePromise = page.waitForResponse(r => new URL(r.url()).pathname === '/api/bookings' && r.request().method() === 'POST')
    await Promise.all([page.getByTestId('booking-confirm').click(), worker()])
    const response = await responsePromise
    const body = await response.json(); expect(response.status(), JSON.stringify(body)).toBe(200)
    ids.push(body.bookingId || body.data?.bookingId)
    expect(ids[index]).toMatch(/^[a-f0-9-]{36}$/)
    await page.waitForURL(/\/dashboard\/history/)
    expect(localSql(`SELECT child_id FROM booking_sessions WHERE booking_id='${ids[index]}';`)).toBe(child)
  }
  const stored = await client.from('bookings').select('id,total_price,pricing_scope_id,status').in('id', ids).order('created_at').order('id')
  expect(stored.error).toBeNull(); expect(stored.data!.map(b => Number(b.total_price))).toEqual([700, 625])
  expect(localSql(`SELECT count(*) FROM task10_booking_pricing_evidence WHERE booking_id IN (${ids.map(sqlLiteral)}) AND bangkok_date='2026-09-25' AND lesson_month='2026-10-01' AND formula='progressive';`)).toBe('2')
  const scopeId = stored.data![0].pricing_scope_id
  await page.getByTestId(`progressive-payment-prepare-${scopeId}`).click()
  await expect(page.getByTestId('payment-slip-modal')).toBeVisible()
  await page.locator('#slip-upload').setInputFiles({ name: 'local-readiness.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1cAAAAASUVORK5CYII=', 'base64') })
  const submittedPromise = page.waitForResponse(r => new URL(r.url()).pathname === '/api/progressive-payments/submit' && r.request().method() === 'POST')
  await Promise.all([page.getByRole('button', { name: 'ส่งสลิปชำระเงิน', exact: true }).click(), worker()])
  const submitted = await submittedPromise
  expect(submitted.status(), await submitted.text()).toBe(200)
  const storedSlip = JSON.parse(localSql(`SELECT jsonb_build_object('bucket',slip_storage_bucket,'path',slip_storage_path) FROM progressive_payment_batches WHERE pricing_scope_id='${scopeId}' AND status='approved';`))
  trackTask10Storage(storedSlip.bucket, storedSlip.path)
  await expect(page.getByTestId('payment-slip-modal')).toHaveCount(0)
  expect(localSql(`SELECT count(*) FROM task10_accepted_receipts WHERE booking_id IN (${ids.map(sqlLiteral)});`)).toBe('2')
  const state = await client.rpc('task10_family_makeup_state_v1', { p_actor_id: f.makeupAdminId, p_parent_id: f.userId, p_source_month: '2026-09-01' })
  expect(state.error).toBeNull(); expect(state.data).toMatchObject({ quota: 5, used: 0, remaining: 5, destinationPurchase: { quantity: 2 }, eligible: true })
  await page.context().clearCookies()
  await page.goto('/auth/login')
  await page.locator('#email').fill(TEST_ADMIN_ACCOUNT.email); await page.locator('#password').fill(TEST_ADMIN_ACCOUNT.password)
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click(); await page.waitForURL(/\/admin(?:\/|$)/)
  await page.goto('/admin/makeup?month=2026-09')
  await page.getByRole('tab', { name: /เลือกวันชดเชย/ }).click()
  const card = page.getByTestId(`kids-family-${f.userId}:2026-09`)
  await expect(card.getByText('กระเป๋า 0', { exact: true })).toBeVisible()
  await expect(card.getByText('ขาดเรียน 1', { exact: true })).toBeVisible()
  await card.getByRole('button', { name: 'เลือกเด็กและรอบชดเชย', exact: true }).click()
  await page.getByRole('combobox', { name: 'เด็กที่มาเรียนจริง', exact: true }).click()
  await page.getByRole('option', { name: 'Sibling - Readiness Sibling', exact: true }).click()
  await page.getByTestId('makeup-day-2026-10-20').click()
  await page.getByRole('dialog').getByText('สาขาทดสอบ Localhost', { exact: true }).locator('..').getByRole('button', { name: '17:00-19:00', exact: true }).click()
  const consumedPromise = page.waitForResponse(r => new URL(r.url()).pathname === '/api/admin/makeup/kids-family' && r.request().method() === 'POST')
  await Promise.all([page.getByRole('button', { name: 'จัดชดเชยร่วมครอบครัว', exact: true }).click(), worker()])
  const consumed = await consumedPromise, used = await consumed.json()
  expect(consumed.status(), JSON.stringify(used)).toBe(200)
  expect(used).toMatchObject({ remaining: 4, data: { child_id: sibling, rescheduled_from_id: source } })
  const replay = await page.request.post('/api/admin/makeup/kids-family', { data: consumed.request().postDataJSON() })
  expect(await replay.json()).toEqual(used)
  await page.reload(); await page.getByRole('tab', { name: /เลือกวันชดเชย/ }).click()
  await expect(card).toContainText('ใช้แล้ว 1 · เหลือ 4 · ต้นทางที่ใช้ได้ 0')
  await expect(card.getByText('กระเป๋า 0', { exact: true })).toBeVisible()
  await expect(card.getByText('ขาดเรียน 0', { exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: 'เลือกเด็กและรอบชดเชย', exact: true })).toHaveCount(0)
  await expect(card).toContainText('แสดงประวัติชดเชย · ไม่มีต้นทางสำหรับใช้สิทธิ์ใหม่')
  await expect(card.locator('[data-makeup-destination]')).toHaveCount(1)
  await expect.poll(naturalRuns, { timeout: 75_000, intervals: [1000, 2000] }).toBeGreaterThanOrEqual(1)
  const original = JSON.parse(localSql('SELECT to_jsonb(a) FROM task10_policy_activation a;'))
  localSql(`SELECT task10_pause_v1('${f.adminUserId}',${original.revision},true,${sqlLiteral(JSON.stringify(artifact))}::jsonb);`)
  expect(controls()).toEqual({ pricing: false, makeup: false, expiry: false, cron: false })
  const blockedQuote = await client.rpc('task10_booking_policy_quote_v1', { p_user_id: f.userId, p_course_type_id: f.kidsCourseId, p_lesson_month: '2026-10-01', p_formula: 'progressive', p_booking_id: null })
  expect(blockedQuote.error?.message).toContain('TASK10_PRICING_PAUSED')
  localSql(`SELECT task10_pause_v1('${f.adminUserId}',${original.revision + 1},false,${sqlLiteral(JSON.stringify(artifact))}::jsonb);`)
  expect(controls()).toEqual({ pricing: true, makeup: true, expiry: true, cron: true })
  expect(localSql('SELECT effective_at FROM task10_policy_activation;')).toBe(localSql(`SELECT '${original.effective_at}'::timestamptz;`))
  expect(localSql('SELECT count(*) FROM task10_activation_events;')).toBe('3')
  localSql(`INSERT INTO schedule_templates(branch_id,course_type_id,day_of_week,start_time,end_time,is_active)
    SELECT '${f.branchId}','${f.adultCourseId}',extract(dow FROM date '2026-10-22'),'10:00','11:00',true
    WHERE NOT EXISTS(SELECT 1 FROM schedule_templates WHERE branch_id='${f.branchId}' AND course_type_id='${f.adultCourseId}'
      AND day_of_week=extract(dow FROM date '2026-10-22') AND start_time='10:00' AND end_time='11:00' AND is_active);`)
  const unpaid = await client.rpc('task10_write_legacy_booking_v1', { p_user_id: f.userId, p_action: 'create', p_request_id: randomUUID(),
    p_input: { learnerType: 'self', childId: null, branchId: f.branchId, courseTypeId: f.adultCourseId, year: 2026, month: 10,
      totalSessions: 1, totalAmount: 500, expectedTotalPrice: 500, sessions: [{ date: '2026-10-22', startTime: '10:00', endTime: '11:00', branchId: f.branchId, childId: null }] } })
  expect(unpaid.error).toBeNull()
  setDisposableClock('2026-10-23T10:00:00+07:00')
  const beforeExpiryTicks = naturalRuns()
  await expect.poll(naturalRuns, { timeout: 75_000, intervals: [1000, 2000] }).toBeGreaterThan(beforeExpiryTicks)
  expect(localSql(`SELECT status FROM bookings WHERE id='${unpaid.data.bookingId}';`)).toBe('cancelled')
  expect(localSql(`SELECT count(*) FROM task10_booking_cancellations WHERE booking_id='${unpaid.data.bookingId}';`)).toBe('1')
  expect(localSql(`SELECT status||':'||total_price FROM bookings WHERE id='${sourceBooking}';`)).toBe('verified:10000.00')
  expect((await client.from('bookings').select('status').in('id', ids)).data!.map(b => b.status)).toEqual(['verified', 'verified'])
  expect(localSql(`SELECT count(*) FROM task10_family_makeup_uses WHERE parent_id='${f.userId}';`)).toBe('1')
  expect(controls()).toEqual({ pricing: true, makeup: true, expiry: true, cron: true })
  await testInfo.attach('active-integration-backend', { body: Buffer.from(localSql(`SELECT jsonb_build_object('controls',(SELECT to_jsonb(a) FROM task10_policy_activation a),
    'bills',(SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM bookings b WHERE id IN (${ids.map(sqlLiteral)})),
    'uses',(SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM task10_family_makeup_uses u),'worker',(SELECT jsonb_agg(to_jsonb(w) ORDER BY started_at) FROM task10_worker_runs w));`)), contentType: 'application/json' })
})
