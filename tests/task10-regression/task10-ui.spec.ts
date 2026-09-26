import { expect, test, type Page, type Locator } from '@playwright/test'
import { TEST_ADMIN_ACCOUNT, TEST_ACCOUNT } from '../booking-regression/local-supabase'
import { createHash, randomUUID } from 'node:crypto'
import { getBangkokDateKey } from '../../src/lib/date-format'
import { concurrentLocalSql, holdLocalTransaction, createLocalAdmin, localSql, readTask10Fixture, seedTask10Family, seedFamilyScheduleFixture, seedLegacyHeaderWalletFixture, setDisposableClock, trackTask10Storage, setupTask10, task10MigrationHashes, sqlLiteral, uploadTask10Slip, TASK10_ADMIN_EMAIL, TASK10_PASSWORD } from './local-supabase'

test.afterEach(async ({}, testInfo) => {
  // Preserve backend evidence even when a browser assertion fails, before teardown.
  const body = localSql(`BEGIN TRANSACTION READ ONLY;
    SELECT jsonb_build_object('controls',(SELECT row_to_json(p) FROM task10_policy_activation p),
      'uses',(SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM task10_family_makeup_uses u),
      'cancellations',(SELECT jsonb_agg(to_jsonb(c) ORDER BY booking_id) FROM task10_booking_cancellations c),
      'counts',jsonb_build_object('sessions',(SELECT count(*) FROM booking_sessions),'credits',(SELECT count(*) FROM lesson_wallet_credits),
        'payments',(SELECT count(*) FROM payments),'attendance',(SELECT count(*) FROM attendance)),
      'badDestinationIdentity',(SELECT count(*) FROM task10_family_makeup_uses u LEFT JOIN booking_sessions s ON s.id=u.destination_session_id
        WHERE s.id IS NULL OR s.child_id IS DISTINCT FROM u.attending_child_id OR s.rescheduled_from_id IS DISTINCT FROM u.source_session_id)); COMMIT;`)
  await testInfo.attach('disposable-backend-after-test', { body, contentType: 'application/json' })
})

async function openFamilyScheduleMonth(page: Page, date: string) {
  await page.goto('/dashboard/schedule')
  const current = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' }).formatToParts(new Date())
  const parts = Object.fromEntries(current.map((part) => [part.type, part.value]))
  const [year, month] = date.split('-').map(Number)
  const distance = (year - Number(parts.year)) * 12 + month - Number(parts.month)
  expect(Math.abs(distance)).toBeLessThanOrEqual(12)
  for (let index = 0; index < Math.abs(distance); index++) {
    await page.getByRole('button', { name: distance > 0 ? 'เดือนถัดไป' : 'เดือนก่อนหน้า', exact: true }).click()
  }
  await expect(page.getByRole('button', { name: `ดูตารางวันที่ ${date}`, exact: true })).toBeVisible()
}

async function expectSourceBreakdown(page: Page, card: Locator, parentId: string, month = '2031-07') {
  const response = await page.request.get(`/api/admin/makeup/kids-family?parentId=${parentId}&sourceMonth=${month}`)
  expect(response.status()).toBe(200)
  const state = await response.json()
  const wallet = state.sources.filter((source: { kind: string }) => source.kind === 'wallet').length
  const absent = state.sources.filter((source: { kind: string }) => source.kind === 'absent').length
  expect(wallet + absent).toBe(state.sources.length)
  await expect(card).toContainText(`ต้นทางที่ใช้ได้ ${wallet + absent}`)
  await expect(card.getByText(`กระเป๋า ${wallet}`, { exact: true })).toHaveClass(/text-purple-800/)
  await expect(card.getByText(`ขาดเรียน ${absent}`, { exact: true })).toHaveClass(/text-orange-800/)
  return { wallet, absent }
}

test('Incomplete Payment shows canonical Thai deadline, accepted receipt and Paused truth without changing bookings', async ({ page }, testInfo) => {
  test.setTimeout(240_000) // Independent setup and restoration both verify physical bindings.
  // The preceding transaction suite can end Paused after real activation.
  // Own a fresh, physically guarded disposable fixture for this activation case.
  await setupTask10()
  const f = readTask10Fixture(), ids = f.lifecycle!, client = createLocalAdmin()
  setDisposableClock('2031-07-31T18:00:00+07:00')
  const artifact = { sourceSha: 'a'.repeat(40), deploymentId: 'dpl_local_deadline_ui', targetProjectRef: 'verified-local-disposable',
    migrationHashes: task10MigrationHashes(), productionPromotionConfirmed: true, healthChecksPassed: true }
  localSql(`SELECT task10_activate_v1('${f.adminUserId}',task10_activation_manifest_v1('${f.adminUserId}',${sqlLiteral(JSON.stringify(artifact))}::jsonb));`)
  try {
    const slip = await uploadTask10Slip(f.otherUserId)
    const accepted = await client.rpc('task10_accept_legacy_slip_v1', { p_user_id: f.otherUserId, p_booking_ids: [ids.onTime],
      p_storage_path: slip.storagePath, p_public_url: slip.publicUrl, p_sha256: slip.sha256, p_expected_amount: 500, p_request_id: randomUUID() })
    expect(accepted.error).toBeNull()
    const snapshot = () => localSql(`SELECT md5(jsonb_build_object('bookings',(SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM bookings b),
      'sessions',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM booking_sessions s),'receipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM task10_accepted_receipts r))::text);`)
    const before = snapshot()
    await login(page)
    await page.goto('/admin/payments?month=2031-08')
    const due = page.getByTestId(`incomplete-deadline-${ids.adultDue}`)
    await expect(due).toContainText('ส่งสลิปก่อน เสาร์ 2 ส.ค. 74 09:00')
    await expect(due).toContainText('บิลและรอบเรียนในบิลจะถูกยกเลิกอัตโนมัติ')
    await expect(page.getByTestId(`incomplete-deadline-${ids.onTime}`)).toContainText('ระบบรับสลิปทันกำหนดแล้ว')
    await expect(page.getByTestId(`incomplete-deadline-${ids.verified}`)).toHaveCount(0)
    const revision = Number(localSql('SELECT revision FROM task10_policy_activation;'))
    localSql(`SELECT task10_pause_v1('${f.adminUserId}',${revision},true,${sqlLiteral(JSON.stringify(artifact))}::jsonb);`)
    await page.reload()
    await expect(due).toContainText('การยกเลิกอัตโนมัติหยุดชั่วคราว')
    await expect(due).not.toContainText('ระบบกำลังดำเนินการยกเลิก')
    await expect(page.getByTestId(`incomplete-deadline-${ids.onTime}`)).toContainText('ระบบรับสลิปทันกำหนดแล้ว')
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(due).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await testInfo.attach('payment-deadline-paused-mobile', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
    await page.goto('/admin/payments?month=2031-07')
    await expect(page.getByTestId(`incomplete-deadline-${ids.oldOverdue}`)).toContainText('อยู่นอกกลุ่มยกเลิกอัตโนมัติ')
    expect(snapshot()).toBe(before)
  } finally { await setupTask10() }
})

for (const childRepresentative of [false, true]) {
  test(`Family Schedule UI Store/Redeem keeps one complete unit with ${childRepresentative ? 'child' : 'parent'} representative`, async ({ page }, testInfo) => {
    test.setTimeout(180_000)
    const c = await seedFamilyScheduleFixture(childRepresentative)
    const financialBefore = localSql(c.invariants)
    await page.goto('/auth/login')
    await page.locator('#email').fill(c.email)
    await page.locator('#password').fill(TASK10_PASSWORD)
    await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
    await page.waitForURL(/\/dashboard(?:\/|$)/)
    await openFamilyScheduleMonth(page, c.dates.source)
    await expect(page.getByText('รวม 2 ครั้ง', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: `ดูตารางวันที่ ${c.dates.source}`, exact: true }).click()
    const store = page.getByRole('button', { name: 'เก็บทั้งครอบครัวเข้ากระเป๋า', exact: true })
    await expect(store).toHaveCount(1)
    await store.click()
    const stored = page.waitForResponse(r => r.url().includes('/api/lesson-wallet') && r.request().method() === 'POST')
    await page.getByRole('button', { name: 'ยืนยันเก็บทั้งครอบครัว', exact: true }).click()
    const storeResponse = await stored
    const storeResult = await storeResponse.json()
    expect(storeResponse.status(), JSON.stringify(storeResult)).toBe(200)
    expect(storeResult.participantCount).toBe(2)
    // The button sorts by participant identity; SQL independently selects the
    // lowest source UUID for its header. Prove both, without conflating them.
    const buttonSource = c.extraChild && c.extraChild.localeCompare(c.childId) > 0 ? c.sources[1] : c.sources[0]
    expect(storeResponse.request().postDataJSON()).toMatchObject({ action: 'store', sessionId: buttonSource })
    expect(localSql(`SELECT original_session_id FROM lesson_wallet_credits WHERE id='${storeResult.creditId}';`)).toBe(c.sources[0])
    expect(JSON.parse(localSql(c.snapshot))).toMatchObject({ credits: 1, members: 2, walleted: 2, otherScheduled: 2, memberIdentity: true })
    await openFamilyScheduleMonth(page, c.dates.source)
    await expect(page.getByText('รวม 2 ครั้ง', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: `ดูตารางวันที่ ${c.dates.source}`, exact: true }).click()
    await expect(page.getByText('Family Private · 1 ชั่วโมง · 2 คน', { exact: true })).toBeVisible()
    await expect(page.getByText('รอบครอบครัวนี้ยังไม่พร้อมเก็บทั้งหน่วย โปรดตรวจสถานะผู้เรียนทุกคน', { exact: true })).toHaveCount(0)
    await page.goto('/dashboard/lesson-wallet')
    await expect(page.getByRole('button', { name: 'ใช้วันเรียน', exact: true })).toHaveCount(1)
    await page.getByRole('button', { name: 'ใช้วันเรียน', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: String(Number(c.dates.target.slice(-2))), exact: true }).click()
    await dialog.getByText(c.branchName, { exact: true }).locator('..').getByRole('button', { name: `${c.start.slice(0, 5)}-${c.end.slice(0, 5)}`, exact: true }).click()
    const redeemed = page.waitForResponse(r => r.url().includes('/api/lesson-wallet') && r.request().method() === 'POST')
    await dialog.getByRole('button', { name: 'ยืนยันใช้วันเรียน', exact: true }).click()
    const redeemResponse = await redeemed
    expect(redeemResponse.status(), await redeemResponse.text()).toBe(200)
    expect(JSON.parse(localSql(c.snapshot))).toMatchObject({ credits: 1, members: 2, memberIdentity: true, walleted: 2, otherScheduled: 2, descendants: 2, childIdentity: true, targetSlots: 1, orphanCredits: 0 })
    expect(localSql(c.invariants)).toBe(financialBefore)
    await openFamilyScheduleMonth(page, c.dates.source)
    await testInfo.attach('family-after-redeem-desktop', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
    await expect(page.getByText('รวม 2 ครั้ง', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: `ดูตารางวันที่ ${c.dates.source}`, exact: true })).not.toContainText('1 รอบ')
    await page.getByRole('button', { name: `ดูตารางวันที่ ${c.dates.target}`, exact: true }).click()
    await expect(page.getByText('Family Private · 1 ชั่วโมง · 2 คน', { exact: true })).toBeVisible()
    await expect(page.getByText('Z Family participant', { exact: true }).last()).toBeVisible()
    await expect(page.getByText(childRepresentative ? 'A Family participant' : 'Schedule Family parent', { exact: true }).last()).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByText('รวม 2 ครั้ง', { exact: true })).toBeVisible()
    await testInfo.attach('family-after-redeem-mobile', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  })
}

test('Legacy header-only Wallet stays visible while active and shows only the redeemed target in Schedule', async ({ page }) => {
  test.setTimeout(180_000)
  const c = await seedLegacyHeaderWalletFixture()
  const financialBefore = localSql(c.invariants)
  expect(localSql(`SELECT count(*) FROM lesson_wallet_credit_members WHERE credit_id='${c.creditId}';`)).toBe('0')
  await page.goto('/auth/login')
  await page.locator('#email').fill(c.email)
  await page.locator('#password').fill(TASK10_PASSWORD)
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
  await page.waitForURL(/\/dashboard(?:\/|$)/)
  await openFamilyScheduleMonth(page, c.dates.source)
  await expect(page.getByText('รวม 1 ครั้ง', { exact: true })).toBeVisible()
  await page.goto('/dashboard/lesson-wallet')
  await expect(page.getByRole('button', { name: 'ใช้วันเรียน', exact: true })).toHaveCount(1)
  await page.getByRole('button', { name: 'ใช้วันเรียน', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: String(Number(c.dates.target.slice(-2))), exact: true }).click()
  await dialog.getByText(c.branchName, { exact: true }).locator('..').getByRole('button', { name: `${c.start.slice(0, 5)}-${c.end.slice(0, 5)}`, exact: true }).click()
  const redeemed = page.waitForResponse(r => r.url().includes('/api/lesson-wallet') && r.request().method() === 'POST')
  await dialog.getByRole('button', { name: 'ยืนยันใช้วันเรียน', exact: true }).click()
  const response = await redeemed
  expect(response.status(), await response.text()).toBe(200)
  expect(localSql(c.invariants)).toBe(financialBefore)
  expect(JSON.parse(localSql(`SELECT jsonb_build_object('credits',(SELECT count(*) FROM lesson_wallet_credits WHERE booking_id='${c.booking}'), 'redeemed',(SELECT status='redeemed' AND redeemed_session_id IS NOT NULL FROM lesson_wallet_credits WHERE id='${c.creditId}'), 'targets',(SELECT count(*) FROM booking_sessions WHERE rescheduled_from_id='${c.sources[0]}' AND child_id IS NULL));`))).toEqual({ credits: 1, redeemed: true, targets: 1 })
  await openFamilyScheduleMonth(page, c.dates.source)
  await expect(page.getByText('รวม 1 ครั้ง', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: `ดูตารางวันที่ ${c.dates.source}`, exact: true })).not.toContainText('1 รอบ')
  await page.getByRole('button', { name: `ดูตารางวันที่ ${c.dates.target}`, exact: true }).click()
  await expect(page.getByText('Legacy Wallet learner', { exact: true }).last()).toBeVisible()
})

async function login(page: Page, email=TEST_ADMIN_ACCOUNT.email, password=TEST_ADMIN_ACCOUNT.password) {
  await page.goto('/auth/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click()
  await page.waitForURL(/\/admin(?:\/|$)/)
}

test('Makeup excludes quota-only families and reconciles source-empty reload while keeping D/M and Paused explanations', async ({ page }, testInfo) => {
  const family = await seedTask10Family()
  const f = readTask10Fixture()
  setDisposableClock('2031-08-01T10:00:00+07:00')
  const client = createLocalAdmin()
  const empty = await client.rpc('task10_family_makeup_state_v1', { p_actor_id: f.makeupAdminId, p_parent_id: family.parentId, p_source_month: '2031-09-01' })
  expect(empty.error).toBeNull()
  expect(empty.data).toMatchObject({ quota: 1, used: 0, sources: [] })
  await login(page)
  await page.goto('/admin/makeup?month=2031-09')
  await page.getByRole('tab', { name: /เลือกวันชดเชย/ }).click()
  await expect(page.getByTestId(`kids-family-${family.parentId}:2031-09`)).toHaveCount(0)
  await page.reload(); await page.getByRole('tab', { name: /เลือกวันชดเชย/ }).click()
  await expect(page.getByTestId(`kids-family-${family.parentId}:2031-09`)).toHaveCount(0)
  await page.goto('/admin/makeup?month=2031-07')
  await page.getByRole('tab', { name: /เลือกวันชดเชย/ }).click()
  const card = page.getByTestId(`kids-family-${family.parentId}:2031-07`)
  await expect(card).toContainText('เดือนปลายทางยืนยันชำระแล้ว 0 ครั้ง')
  await expect(card.getByRole('button', { name: 'เลือกเด็กและรอบชดเชย', exact: true })).toBeDisabled()
  expect(await expectSourceBreakdown(page, card, family.parentId)).toEqual({ wallet: 2, absent: 6 })
  localSql("UPDATE task10_policy_activation SET state='paused',makeup_enabled=false,pricing_enabled=false;")
  await card.getByRole('button', { name: 'โหลดสิทธิ์ใหม่', exact: true }).click()
  await expect(card).toContainText('ระบบชดเชยคอร์สเด็กหยุดรับรายการใหม่ชั่วคราว')
  // A controlled transport response checks the client override path; real DB
  // zero-source reads are proved above, and real last-source consumption in
  // the integrated Active case preserves its destination history.
  const state = await (await page.request.get(`/api/admin/makeup/kids-family?parentId=${family.parentId}&sourceMonth=2031-07`)).json()
  await page.route('**/api/admin/makeup/kids-family?**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ...state, sources: [], used: 0, destinations: [], eligible: false, reason: 'no_source' }),
  }))
  await card.getByRole('button', { name: 'โหลดสิทธิ์ใหม่', exact: true }).click()
  await expect(card).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await testInfo.attach('makeup-source-empty-mobile', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  await page.unroute('**/api/admin/makeup/kids-family?**')
})

test('Makeup renders shared nickname-full-name labels, keeps child identities and searches either name', async ({ page }, testInfo) => {
  const family = await seedTask10Family(), f = readTask10Fixture()
  const extras = [randomUUID(), randomUUID(), randomUUID()]
  localSql(`BEGIN; SELECT task10_lock_pricing_scope_v1('${family.parentId}','${f.kidsCourseId}',2031,8);
    UPDATE bookings SET status='verified' WHERE id IN ('${family.bookings[2]}','${family.bookings[3]}');
    UPDATE children SET full_name='เมย์ ใจดี',nickname='น้องเมย์' WHERE id='${family.children[0]}';
    UPDATE children SET full_name='มิน ใจดี',nickname=NULL WHERE id='${family.children[1]}';
    INSERT INTO children(id,parent_id,full_name,nickname,date_of_birth) VALUES
      ('${extras[0]}','${family.parentId}','ชื่อเดียว','ชื่อเดียว','2016-01-01'),
      ('${extras[1]}','${family.parentId}','','เล่นอย่างเดียว','2016-01-01'),
      ('${extras[2]}','${family.parentId}','','','2016-01-01'); COMMIT;`)
  const template = localSql(`SELECT id FROM schedule_templates WHERE branch_id='${f.branchId}' AND course_type_id='${f.kidsCourseId}'
    AND day_of_week=extract(dow FROM date '2031-08-20') AND start_time='17:00' AND end_time='19:00' AND is_active;`)
  const consumed = await createLocalAdmin().rpc('task10_consume_family_makeup_v1', { p_actor_id: f.makeupAdminId,
    p_source_session_id: family.sources[1], p_attending_child_id: family.children[0], p_template_id: template,
    p_branch_id: f.branchId, p_target_date: '2031-08-20', p_start_time: '17:00', p_end_time: '19:00', p_request_id: randomUUID() })
  expect(consumed.error).toBeNull()
  // A separate past, unmarked round exercises the Review roster with the same
  // authorized child IDs; Auth/browser clocks remain real.
  const reviewDate = getBangkokDateKey(new Date(Date.now() - 86_400_000)), reviewBooking = randomUUID()
  const [reviewYear, reviewMonth] = reviewDate.split('-').map(Number)
  const reviewControls = localSql('SELECT row_to_json(p) FROM task10_policy_activation p;')
  // Seed this historical review round using the existing disposable fixture
  // convention; restore every activation field in the same locked transaction.
  localSql(`BEGIN; SELECT pg_advisory_xact_lock(10,1);
    UPDATE task10_policy_activation SET state='never_activated',effective_at=NULL,pricing_enabled=false,makeup_enabled=false,expiry_enabled=false;
    SELECT set_config('task10.source_write','authorized',true);
    INSERT INTO bookings(id,user_id,learner_type,child_id,branch_id,course_type_id,month,year,total_sessions,entitlement_sessions,total_price,status,created_at)
      VALUES('${reviewBooking}','${family.parentId}','child','${family.children[0]}','${f.branchId}','${f.kidsCourseId}',${reviewMonth},${reviewYear},5,5,3500,'verified','${reviewDate}T00:00:00Z');
    INSERT INTO schedule_slots(template_id,branch_id,course_type_id,date,start_time,end_time,max_students,current_students,status)
      SELECT id,branch_id,course_type_id,'${reviewDate}',start_time,end_time,6,0,'open' FROM schedule_templates
      WHERE branch_id='${f.branchId}' AND course_type_id='${f.kidsCourseId}' AND day_of_week=extract(dow FROM date '${reviewDate}') AND start_time='17:00' AND end_time='19:00' AND is_active
      ON CONFLICT(branch_id,course_type_id,date,start_time) DO NOTHING;
    INSERT INTO booking_sessions(booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup)
      SELECT '${reviewBooking}',s.id,s.date,s.start_time,s.end_time,s.branch_id,c,'scheduled',false FROM schedule_slots s
      CROSS JOIN unnest(ARRAY[${[...family.children, ...extras].map(id => `'${id}'::uuid`).join(',')}]) c
      WHERE s.branch_id='${f.branchId}' AND s.course_type_id='${f.kidsCourseId}' AND s.date='${reviewDate}' AND s.start_time='17:00';
    UPDATE task10_policy_activation p SET state=b.state,effective_at=b.effective_at,revision=b.revision,
      pricing_enabled=b.pricing_enabled,makeup_enabled=b.makeup_enabled,expiry_enabled=b.expiry_enabled,artifact=b.artifact
      FROM json_populate_record(NULL::task10_policy_activation,'${reviewControls.replace(/'/g, "''")}'::json) b; COMMIT;`)
  expect(localSql('SELECT row_to_json(p) FROM task10_policy_activation p;')).toBe(reviewControls)
  const before = localSql(`SELECT md5(jsonb_build_object('uses',(SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM task10_family_makeup_uses u),
    'credits',(SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM lesson_wallet_credits w),'bookings',(SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM bookings b))::text);`)
  await login(page)
  for (const reload of [false, true]) {
    if (reload) await page.reload(); else await page.goto('/admin/makeup?month=2031-07')
    await page.getByRole('tab', { name: /เลือกวันชดเชย/ }).click()
    const card = page.getByTestId(`kids-family-${family.parentId}:2031-07`)
    for (const name of ['น้องเมย์ - เมย์ ใจดี', 'มิน ใจดี', 'ชื่อเดียว', 'เล่นอย่างเดียว', 'ไม่ระบุชื่อผู้เรียน']) await expect(card).toContainText(name)
    await expect(card).not.toContainText('ชื่อเดียว - ชื่อเดียว')
    await expect(card).toContainText('จองชดเชยแล้ว · น้องเมย์ - เมย์ ใจดี')
    await expect(card).toContainText('เหลือ 4')
  }
  const search = page.getByPlaceholder('ค้นหานักเรียน, ผู้ปกครอง, สาขา, เดือน...')
  for (const query of ['น้องเมย์', 'เมย์ ใจดี']) {
    await search.fill(query)
    await expect(page.getByTestId(`kids-family-${family.parentId}:2031-07`)).toContainText('มิน ใจดี')
  }
  await search.fill('')
  await page.getByTestId(`kids-family-${family.parentId}:2031-07`).getByRole('button', { name: 'เลือกเด็กและรอบชดเชย' }).click()
  await page.getByRole('combobox', { name: 'เด็กที่มาเรียนจริง' }).click()
  await expect(page.getByRole('option', { name: 'น้องเมย์ - เมย์ ใจดี', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await testInfo.attach('makeup-names-mobile', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  await page.goto(`/admin/makeup?month=${reviewDate.slice(0, 7)}`)
  const reviewSearch = page.getByPlaceholder('ค้นหานักเรียน, ผู้ปกครอง, โค้ช, สาขา...')
  for (const query of ['น้องเมย์', 'เมย์ ใจดี']) {
    await reviewSearch.fill(query)
    for (const name of ['น้องเมย์ - เมย์ ใจดี', 'มิน ใจดี', 'ชื่อเดียว', 'เล่นอย่างเดียว', 'ไม่ระบุชื่อผู้เรียน']) await expect(page.getByRole('tabpanel')).toContainText(name)
  }
  await page.reload()
  await reviewSearch.fill('น้องเมย์')
  await expect(page.getByRole('tabpanel')).toContainText('น้องเมย์ - เมย์ ใจดี')
  expect(localSql(`SELECT md5(jsonb_build_object('uses',(SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM task10_family_makeup_uses u),
    'credits',(SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM lesson_wallet_credits w),'bookings',(SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM bookings b))::text);`)).toBe(before)
})

test('Owner corrective: Kids entitlement is one family card inside the Makeup tab without source selection', async ({ page }) => {
  const family = await seedTask10Family()
  setDisposableClock('2031-08-01T10:00:00+07:00')
  localSql(`UPDATE profiles SET full_name='Owner corrective family' WHERE id='${family.parentId}';`)
  await login(page)
  await page.goto('/admin/makeup?month=2031-07')
  await page.getByRole('tab', { name: /เลือกวันชดเชย/ }).click()
  const tab = page.getByRole('tabpanel', { name: /เลือกวันชดเชย/ })
  const card = tab.getByTestId(`kids-family-${family.parentId}:2031-07`)
  await expect(card).toHaveCount(1)
  await expect(card).toContainText('Task10 Family 1')
  await expect(card).toContainText('Task10 Family 2')
  await expect(card).toContainText('Owner corrective family')
  await expect(card).toContainText('กรกฎาคม 2574')
  await expect(card).toContainText('โควตา 5')
  expect(await expectSourceBreakdown(page, card, family.parentId)).toEqual({ wallet: 2, absent: 6 })
  await expect(page.getByRole('tab', { name: 'เลือกวันชดเชย', exact: true })).toBeVisible()
  await expect(page.getByText('ยังชดเชยได้ (ผู้ใหญ่/Private)', { exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'รายการต้นทาง', exact: true })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'ครอบครัวและเดือนต้นทาง', exact: true })).toHaveCount(0)
  await expect(tab.getByText('แสดง 0-0 จาก 0 รายการ', { exact: true })).toHaveCount(0)
  await tab.getByPlaceholder('ค้นหานักเรียน, ผู้ปกครอง, สาขา, เดือน...').fill('no-such-family-calendar')
  await expect(tab.getByText('ไม่มีครอบครัวที่ตรงกับเดือนและตัวกรองนี้', { exact: true })).toBeVisible()
  await expect(tab.getByText('แสดง 0-0 จาก 0 รายการ', { exact: true })).toHaveCount(0)
  expect(localSql(`SELECT count(*) FROM task10_family_makeup_uses WHERE parent_id='${family.parentId}';`)).toBe('0')
})

test('Makeup keeps linked next-month lessons and future Kids Wallet scopes across never-activated, active and paused reads', async ({ page }) => {
  test.setTimeout(180_000)
  const family = await seedTask10Family(), f = readTask10Fixture()
  const booking = randomUUID(), source = randomUUID(), target = randomUUID()
  const slots = [randomUUID(), randomUUID()]
  const dates = JSON.parse(localSql(`SELECT jsonb_build_object('source',(date_trunc('month',transaction_timestamp() AT TIME ZONE 'Asia/Bangkok')-interval '1 month'+interval '19 days')::date,'target',(date_trunc('month',transaction_timestamp() AT TIME ZONE 'Asia/Bangkok')+interval '24 days')::date);`)) as { source: string; target: string }
  const controls = localSql('SELECT row_to_json(p) FROM task10_policy_activation p;')
  const restore = `UPDATE task10_policy_activation p SET state=b.state,effective_at=b.effective_at,revision=b.revision,pricing_enabled=b.pricing_enabled,makeup_enabled=b.makeup_enabled,expiry_enabled=b.expiry_enabled,artifact=b.artifact FROM json_populate_record(NULL::task10_policy_activation,'${controls.replace(/'/g, "''")}'::json) b;`
  localSql(`BEGIN; SELECT pg_advisory_xact_lock(10,1);
    UPDATE task10_policy_activation SET state='never_activated',effective_at=NULL,revision=0,pricing_enabled=false,makeup_enabled=false,expiry_enabled=false;
    UPDATE profiles SET full_name='Read Scope Family' WHERE id='${family.parentId}';
    INSERT INTO bookings(id,user_id,learner_type,branch_id,course_type_id,month,year,total_sessions,total_price,status)
      VALUES('${booking}','${family.parentId}','self','${f.branchId}','${f.adultCourseId}',extract(month FROM date '${dates.source}'),extract(year FROM date '${dates.source}'),1,500,'verified');
    INSERT INTO schedule_slots(id,branch_id,course_type_id,date,start_time,end_time,status) VALUES
      ('${slots[0]}','${f.branchId}','${f.adultCourseId}','${dates.source}','04:13','05:13','open'),
      ('${slots[1]}','${f.branchId}','${f.adultCourseId}','${dates.target}','04:13','05:13','open');
    INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,branch_id,date,start_time,end_time,status,is_makeup,rescheduled_from_id) VALUES
      ('${source}','${booking}','${slots[0]}','${f.branchId}','${dates.source}','04:13','05:13','absent',false,NULL),
      ('${target}','${booking}','${slots[1]}','${f.branchId}','${dates.target}','04:13','05:13','scheduled',true,'${source}');
    INSERT INTO attendance(booking_session_id,student_id,student_type,coach_id,status) VALUES('${source}','${family.parentId}','adult','${f.adminUserId}','absent');
    ${restore} COMMIT;`)
  const invariant = `SELECT md5(jsonb_build_object('sessions',(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM booking_sessions s JOIN bookings b ON b.id=s.booking_id WHERE b.user_id='${family.parentId}'),'uses',(SELECT count(*) FROM task10_family_makeup_uses WHERE parent_id='${family.parentId}'),'payments',(SELECT count(*) FROM payments),'coupons',(SELECT count(*) FROM coupon_usages))::text);`
  const before = localSql(invariant), errors: string[] = [], writes: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await login(page)
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(new URL(request.url()).pathname) })
  try {
    for (const state of ['never_activated', 'active', 'paused'] as const) {
      localSql(`BEGIN; SELECT pg_advisory_xact_lock(10,1); ${restore}
        UPDATE task10_policy_activation SET state='${state}',makeup_enabled=${state === 'active'},pricing_enabled=false,expiry_enabled=false
        ${state === 'never_activated' ? ',effective_at=NULL,revision=0' : ''}; COMMIT;`)
      await page.goto(`/admin/makeup?month=${dates.source.slice(0, 7)}`)
      await page.getByRole('tab', { name: /เลือกวันชดเชย/ }).click()
      const panel = page.getByRole('tabpanel', { name: /เลือกวันชดเชย/ })
      await panel.getByRole('textbox').fill('Read Scope Family')
      const learner = panel.locator('[data-makeup-learner]').filter({ hasText: 'Read Scope Family' })
      await expect(learner).toHaveCount(1)
      await expect(learner.getByText('ใช้สิทธิ์แล้ว', { exact: true })).toBeVisible()
      await expect(learner.getByRole('button', { name: 'เลือกรอบชดเชย', exact: true })).toHaveCount(0)
      const scopes = page.getByRole('region', { name: 'สิทธิ์ชดเชยคอร์สเด็กร่วมครอบครัว', exact: true })
      if (state === 'never_activated') await expect(scopes).toHaveCount(0)
      else {
        // Select the future source month; linked references never enter its totals.
        await page.getByLabel('เดือนและปีของรายการ').fill('2031-07')
        await expect(page.getByLabel('เดือนและปีของรายการ')).toHaveValue('2031-07')
        const familyCard = scopes.getByTestId(`kids-family-${family.parentId}:2031-07`)
        await expect(familyCard).toContainText('กรกฎาคม 2574')
        await expect(familyCard).toContainText('สิงหาคม 2574')
        await expect(familyCard.getByRole('button', { name: 'เลือกเด็กและรอบชดเชย', exact: true })).toBeDisabled()
      }
      expect(localSql(invariant)).toBe(before)
    }
    expect(errors).toEqual([])
    expect(writes).toEqual([])
  } finally { localSql(`BEGIN; SELECT pg_advisory_xact_lock(10,1); ${restore} COMMIT;`) }
})

test('Super Admin minimum save, loading, reload, errors and id/key mismatch', async ({page}) => {
  await login(page)
  await page.goto('/admin/settings?section=kids-makeup')
  const input=page.getByLabel('จำนวนเรียนขั้นต่ำในเดือนถัดไปเพื่อใช้สิทธิ์ชดเชย')
  await expect(input).toHaveValue('2')
  await input.fill('3')
  let release!:()=>void
  const held=new Promise<void>(resolve=>{release=resolve})
  await page.route('**/api/admin/settings',async route=>{await held;await route.continue()},{times:1})
  try {
    await page.getByRole('button',{name:'บันทึกขั้นต่ำ',exact:true}).click()
    await expect(page.getByRole('button',{name:'กำลังบันทึก...',exact:true})).toBeDisabled()
    await expect(input).toBeDisabled()
  } finally { release() }
  await expect(page.getByRole('status')).toHaveText('บันทึกสำเร็จ')
  await page.reload()
  await expect(input).toHaveValue('3')
  await input.fill('0')
  await page.getByRole('button',{name:'บันทึกขั้นต่ำ',exact:true}).click()
  await expect(page.getByRole('alert').filter({ hasText: 'กรุณากรอกจำนวนเต็มตั้งแต่ 1' })).toBeVisible()
  await input.fill('2')
  await page.getByRole('button',{name:'บันทึกขั้นต่ำ',exact:true}).click()
  await expect(page.getByRole('status')).toHaveText('บันทึกสำเร็จ')
  const mismatch=await page.request.patch('/api/admin/settings',{data:{id:'00000000-0000-4000-8000-000000000000',key:'kids_makeup_destination_minimum_sessions',minimum:9,expectedRevision:1,requestId:'00000000-0000-4000-8000-000000000001'}})
  expect(mismatch.status()).toBe(409)
})

test('Both pricing settings entries save independent catalogs with loading, error, stale conflict and reload from the database',async ({page})=>{
  test.setTimeout(180_000)
  const established=localSql('SELECT effective_at IS NOT NULL FROM public.task10_policy_activation;')==='t'
  if(established) localSql("UPDATE public.task10_policy_activation SET state='paused',pricing_enabled=false,makeup_enabled=false,expiry_enabled=false WHERE singleton;")
  await login(page)
  try {
    for(const url of ['/admin/settings/pricing','/admin/settings?section=pricing']) {
      await page.goto(url)
      await expect(page.getByRole('heading',{name:'เด็ก — จองวันที่ 1–15',exact:true})).toBeVisible()
      await expect(page.getByRole('heading',{name:'เด็ก — จองวันที่ 16–สิ้นเดือน',exact:true})).toBeVisible()
      await expect(page.getByText('ชุดราคาสองช่วงยังไม่เปิดใช้กับการจอง')).toBeVisible()
      for(const regime of ['early','late'] as const) {
        const card=page.getByRole('heading',{name:regime==='early'?'เด็ก — จองวันที่ 1–15':'เด็ก — จองวันที่ 16–สิ้นเดือน',exact:true}).locator('..')
        const inputs=card.getByRole('spinbutton');const rateInput=inputs.last();const rate=Number(await rateInput.inputValue())
        const lowestSummary=page.getByText('เด็ก ต่ำสุด/ครั้ง',{exact:true}).locator('..')
        const client=createLocalAdmin();const actor=readTask10Fixture().adminUserId
        const before=await client.rpc('task10_read_pricing_catalogs_v1',{p_actor_id:actor});expect(before.error).toBeNull()
        await inputs.first().fill('0');await card.getByRole('button').click()
        await expect(card.getByRole('alert')).toBeVisible()
        await inputs.first().fill('1');await rateInput.fill(String(rate-1))
        let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve})
        await page.route('**/api/admin/pricing',async route=>{await held;await route.continue()},{times:1})
        try {
          await card.getByRole('button').click()
          await expect(card.getByRole('button',{name:'กำลังบันทึก...',exact:true})).toBeDisabled()
          await expect(rateInput).toBeDisabled()
        } finally { release() }
        await expect(card.getByRole('status')).toHaveText('บันทึกสำเร็จ')
        const after=await client.rpc('task10_read_pricing_catalogs_v1',{p_actor_id:actor});expect(after.error).toBeNull()
        expect(after.data[regime].tiers.at(-1).ratePerSession).toBe(rate-1)
        expect(after.data[regime==='early'?'late':'early']).toEqual(before.data[regime==='early'?'late':'early'])
        await expect(lowestSummary).toContainText(`฿${rate-1}`)
        await page.reload();await expect(rateInput).toHaveValue(String(rate-1))
        await expect(lowestSummary).toContainText(`฿${rate-1}`)
        // A second editor commits first. The stale visible form must conflict.
        const changed=await client.rpc('task10_save_pricing_catalog_v1',{p_actor_id:actor,p_regime:regime,p_expected_revision:after.data[regime].revision,p_tiers:after.data[regime].tiers})
        expect(changed.error).toBeNull()
        await card.getByRole('button').click();await expect(card.getByRole('alert')).toBeVisible()
        await page.reload();await rateInput.fill(String(rate));await card.getByRole('button').click()
        await expect(card.getByRole('status')).toHaveText('บันทึกสำเร็จ')
        await expect(lowestSummary).toContainText(`฿${rate}`)
        await page.reload();await expect(rateInput).toHaveValue(String(rate))
      }
    }
  } finally {
    if(established) localSql("UPDATE public.task10_policy_activation SET state='active',pricing_enabled=true,makeup_enabled=true,expiry_enabled=false WHERE singleton;")
  }
})

test('Ordinary Makeup Admin cannot save minimum through the API',async ({page})=>{
  await login(page,TASK10_ADMIN_EMAIL,TASK10_PASSWORD)
  const response=await page.request.patch('/api/admin/settings',{data:{key:'kids_makeup_destination_minimum_sessions',minimum:3,expectedRevision:1,requestId:'00000000-0000-4000-8000-000000000002'}})
  expect(response.status()).toBe(401)
  const pricing=await page.request.patch('/api/admin/pricing',{data:{regime:'late',expectedRevision:1,tiers:[]}})
  expect(pricing.status()).toBe(401)
})

test('Makeup Admin chooses the attendee once and server selects an exact source after verified D is sufficient',async({page})=>{
  const family=await seedTask10Family();const f=readTask10Fixture()
  localSql(`UPDATE profiles SET full_name='Task10 UI Family' WHERE id='${family.parentId}';`)
  await login(page,TASK10_ADMIN_EMAIL,TASK10_PASSWORD);await page.goto('/admin/makeup?month=2031-07')
  await page.getByRole('tab',{name:/เลือกวันชดเชย/}).click()
  const card=page.getByTestId(`kids-family-${family.parentId}:2031-07`)
  await expect(card.getByText('ซื้อเดือนปลายทางยืนยันแล้ว 0 ครั้ง · ขั้นต่ำ 2 ครั้ง',{exact:true})).toBeVisible()
  await expectSourceBreakdown(page, card, family.parentId)
  await expect(card.getByText('รอชำระ 1 ครั้ง · รอตรวจยืนยัน 1 ครั้ง — ยังไม่นับเป็นยอดยืนยัน',{exact:true})).toBeVisible()
  await expect(page.getByRole('combobox',{name:'รายการต้นทาง',exact:true})).toHaveCount(0)
  await expect(card.getByRole('button',{name:'เลือกเด็กและรอบชดเชย',exact:true})).toBeDisabled()
  localSql(`BEGIN; SELECT public.task10_lock_pricing_scope_v1('${family.parentId}','${f.kidsCourseId}',2031,8); UPDATE bookings SET status='verified' WHERE id IN ('${family.bookings[2]}','${family.bookings[3]}'); COMMIT;`)
  await card.getByRole('button',{name:'โหลดสิทธิ์ใหม่',exact:true}).click()
  await expect(card.getByText('ซื้อเดือนปลายทางยืนยันแล้ว 2 ครั้ง · ขั้นต่ำ 2 ครั้ง',{exact:true})).toBeVisible()
  const initial = await page.request.get(`/api/admin/makeup/kids-family?parentId=${family.parentId}&sourceMonth=2031-07`)
  const chosen=(await initial.json()).sources[0]
  const attendee=family.children.find(id=>id!==chosen.sourceChildId)!
  await card.getByRole('button',{name:'เลือกเด็กและรอบชดเชย',exact:true}).click()
  await page.getByRole('combobox',{name:'เด็กที่มาเรียนจริง',exact:true}).click()
  await page.getByRole('option',{name:`Task10 Family ${family.children.indexOf(attendee)+1}`,exact:true}).click()
  await expect(page.getByTestId('makeup-calendar')).toContainText('สิงหาคม 2574')
  await page.getByTestId('makeup-day-2031-08-20').click()
  await page.getByRole('dialog').getByText('สาขาทดสอบ Localhost',{exact:true}).locator('..').getByRole('button',{name:'17:00-19:00',exact:true}).click()
  const response=page.waitForResponse(r=>r.url().includes('/api/admin/makeup/kids-family') && r.request().method()==='POST')
  await page.getByRole('button',{name:'จัดชดเชยร่วมครอบครัว',exact:true}).click()
  const saved=await response;const body=await saved.json();expect(saved.status(),JSON.stringify(body)).toBe(200)
  expect(saved.request().postDataJSON().schedule_template_id).toBe(localSql(`SELECT id FROM schedule_templates WHERE branch_id='${f.branchId}' AND course_type_id='${f.kidsCourseId}' AND day_of_week=extract(dow FROM date '2031-08-20') AND start_time='17:00' AND end_time='19:00' AND is_active;`))
  await expect(page.getByRole('status').filter({hasText:'จัดชดเชยสำเร็จ โควตาเหลือ 4 ครั้ง'})).toBeVisible()
  expect(saved.request().postDataJSON()).not.toHaveProperty('original_session_id')
  expect(localSql(`SELECT child_id FROM booking_sessions WHERE id='${body.data.id}';`)).toBe(attendee)
  expect(localSql(`SELECT rescheduled_from_id FROM booking_sessions WHERE id='${body.data.id}';`)).toBe(chosen.sourceSessionId)
  expect(localSql(`SELECT child_id FROM booking_sessions WHERE id='${chosen.sourceSessionId}';`)).toBe(chosen.sourceChildId)
  expect(localSql(`SELECT count(*) FROM task10_family_makeup_uses WHERE parent_id='${family.parentId}';`)).toBe('1')
  await page.setViewportSize({width:390,height:844})
  await expect(card.getByText('โควตา 5 · ใช้แล้ว 1 · เหลือ 4 · ต้นทางที่ใช้ได้ 7',{exact:true})).toBeVisible()
  await expectSourceBreakdown(page, card, family.parentId)
  await expect(card.locator(`[data-makeup-destination="${body.data.id}"]`)).toContainText('20 ส.ค. 74')
  await expect(card.locator(`[data-makeup-destination="${body.data.id}"]`)).toContainText('สาขาทดสอบ Localhost')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:'test-results/task10-regression/family-makeup-mobile.png',fullPage:true})
  await page.reload()
  await page.getByRole('tab',{name:/เลือกวันชดเชย/}).click()
  await expect(card.locator(`[data-makeup-destination="${body.data.id}"]`)).toContainText(`Task10 Family ${family.children.indexOf(attendee)+1}`)
  await expectSourceBreakdown(page, card, family.parentId)
  await expect(card.getByText('โควตา 5 · ใช้แล้ว 1 · เหลือ 4 · ต้นทางที่ใช้ได้ 7',{exact:true})).toBeVisible()
})

test('Single child family enters the Thai calendar immediately; calendar works on desktop and 390px without consuming quota', async ({ page }, testInfo) => {
  const family=await seedTask10Family(), f=readTask10Fixture()
  // Convert only this new owned synthetic family into a one-child household,
  // preserving all purchased quantities and exact learner references together.
  localSql(`BEGIN; SELECT pg_advisory_xact_lock(10,1); SELECT set_config('task10.source_write','authorized',true);
    SELECT task10_lock_pricing_scope_v1('${family.parentId}','${f.kidsCourseId}',2031,8);
    UPDATE bookings SET child_id='${family.children[0]}' WHERE user_id='${family.parentId}' AND child_id='${family.children[1]}';
    UPDATE booking_sessions SET child_id='${family.children[0]}' WHERE booking_id IN (SELECT id FROM bookings WHERE user_id='${family.parentId}') AND child_id='${family.children[1]}';
    UPDATE attendance SET student_id='${family.children[0]}' WHERE student_id='${family.children[1]}';
    UPDATE lesson_wallet_credits SET child_id='${family.children[0]}' WHERE user_id='${family.parentId}' AND child_id='${family.children[1]}';
    DELETE FROM children WHERE id='${family.children[1]}' AND parent_id='${family.parentId}';
    UPDATE bookings SET status='verified' WHERE id IN ('${family.bookings[2]}','${family.bookings[3]}'); COMMIT;`)
  await login(page,TASK10_ADMIN_EMAIL,TASK10_PASSWORD)
  await page.goto('/admin/makeup?month=2031-07'); await page.getByRole('tab',{name:/เลือกวันชดเชย/}).click()
  const card=page.getByTestId(`kids-family-${family.parentId}:2031-07`)
  await card.getByRole('button',{name:'เลือกเด็กและรอบชดเชย',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await expect(dialog.getByRole('combobox',{name:'เด็กที่มาเรียนจริง',exact:true})).toHaveCount(0)
  await expect(dialog).toContainText('เด็กที่มาเรียนจริง: Task10 Family 1')
  await expect(dialog.getByTestId('makeup-calendar')).toBeVisible()
  await dialog.getByTestId('makeup-day-2031-08-20').click()
  await dialog.getByText('สาขาทดสอบ Localhost',{exact:true}).locator('..').getByRole('button',{name:'17:00-19:00',exact:true}).click()
  await expect(dialog.getByRole('button',{name:'จัดชดเชยร่วมครอบครัว',exact:true})).toBeEnabled()
  await testInfo.attach('single-child-calendar-desktop',{body:await page.screenshot({fullPage:true}),contentType:'image/png'})
  await page.setViewportSize({width:390,height:844})
  await expect(dialog.getByTestId('makeup-day-2031-08-20')).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await testInfo.attach('single-child-calendar-mobile',{body:await page.screenshot({fullPage:true}),contentType:'image/png'})
  expect(localSql(`SELECT count(*) FROM task10_family_makeup_uses WHERE parent_id='${family.parentId}';`)).toBe('0')
  expect(localSql(`SELECT count(*) FROM booking_sessions s JOIN bookings b ON b.id=s.booking_id WHERE b.user_id='${family.parentId}' AND s.child_id<>'${family.children[0]}';`)).toBe('0')
})

test('Open Kids calendar expires a selected real-time slot without sending a new transaction', async ({ page }) => {
  const f=readTask10Fixture(), client=createLocalAdmin(), child=randomUUID(), booking=randomUUID(), purchase=randomUUID(), source=randomUUID(), template=randomUUID(), slot=randomUUID()
  const account=await client.auth.admin.createUser({email:`calendar-clock-${randomUUID()}@example.com`,password:TASK10_PASSWORD,email_confirm:true})
  expect(account.error).toBeNull(); const parent=account.data.user!.id
  await login(page,TASK10_ADMIN_EMAIL,TASK10_PASSWORD)
  // Match the HH:mm template API; leave 30–90 real seconds to select before the exact minute starts.
  const now=new Date(), target=new Date(Math.ceil((now.getTime()+30_000)/60_000)*60_000), end=new Date(target.getTime()+3_600_000)
  const today=getBangkokDateKey(now), month=today.slice(0,7), [year,number]=month.split('-').map(Number)
  const previous=new Date(Date.UTC(year,number-2,1)).toISOString().slice(0,7)
  const time=(date:Date)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(date)
  const startTime=time(target), endTime=time(end)
  expect(getBangkokDateKey(end),'Run this real-time fixture before the final hour of the Bangkok day').toBe(today)
  setDisposableClock(now.toISOString())
  localSql(`BEGIN; SELECT pg_advisory_xact_lock(10,1); SELECT set_config('task10.source_write','authorized',true);
    UPDATE task10_policy_activation SET state='never_activated',effective_at=NULL,pricing_enabled=false,makeup_enabled=false,expiry_enabled=false;
    INSERT INTO children(id,parent_id,full_name,date_of_birth) VALUES('${child}','${parent}','Calendar real-time child','2016-01-01');
    INSERT INTO bookings(id,user_id,learner_type,child_id,branch_id,course_type_id,month,year,total_sessions,entitlement_sessions,total_price,status) VALUES
      ('${booking}','${parent}','child','${child}','${f.branchId}','${f.kidsCourseId}',${Number(previous.slice(5))},${Number(previous.slice(0,4))},20,20,10000,'verified'),
      ('${purchase}','${parent}','child','${child}','${f.branchId}','${f.kidsCourseId}',${number},${year},2,2,1400,'verified');
    INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active)
      VALUES('${template}','${f.branchId}','${f.kidsCourseId}',extract(dow FROM date '${today}'),'${startTime}','${endTime}',true);
    INSERT INTO schedule_slots(id,branch_id,course_type_id,date,start_time,end_time,status)
      VALUES('${slot}','${f.branchId}','${f.kidsCourseId}','${previous}-01','17:00','19:00','open');
    INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup)
      VALUES('${source}','${booking}','${slot}','${previous}-01','17:00','19:00','${f.branchId}','${child}','absent',false);
    INSERT INTO attendance(booking_session_id,student_id,student_type,coach_id,status) VALUES('${source}','${child}','child','${f.adminUserId}','absent');
    UPDATE task10_policy_activation SET state='active',effective_at='${month}-01T00:00:00+07:00',makeup_enabled=true; COMMIT;`)
  let posts=0
  page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname==='/api/admin/makeup/kids-family')posts++})
  await page.goto(`/admin/makeup?month=${previous}`); await page.getByRole('tab',{name:/เลือกวันชดเชย/}).click()
  await page.getByTestId(`kids-family-${parent}:${previous}`).getByRole('button',{name:'เลือกเด็กและรอบชดเชย',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await dialog.getByTestId(`makeup-day-${today}`).click()
  await dialog.locator(`[data-template-id="${template}"]`).click()
  await expect(dialog.getByRole('button',{name:'จัดชดเชยร่วมครอบครัว',exact:true})).toBeEnabled()
  // Wait for this fixture's actual wall-clock boundary; Auth and browser Date stay real.
  await page.waitForTimeout(Math.max(0,target.getTime()-Date.now())+1200)
  await expect(dialog.locator(`[data-template-id="${template}"]`)).toHaveCount(0)
  await expect(dialog.getByRole('button',{name:'จัดชดเชยร่วมครอบครัว',exact:true})).toBeDisabled()
  expect(posts).toBe(0)
  expect(localSql(`SELECT count(*) FROM task10_family_makeup_uses WHERE parent_id='${parent}';`)).toBe('0')
  expect(localSql(`SELECT count(*) FROM booking_sessions WHERE booking_id='${booking}' AND is_makeup;`)).toBe('0')
})

test('Automatic family source API preserves D, request replay after pause, changed-payload rejection and concurrent last quota', async ({ page }) => {
  const family=await seedTask10Family(), f=readTask10Fixture()
  await login(page,TASK10_ADMIN_EMAIL,TASK10_PASSWORD)
  const get=async()=>{const r=await page.request.get(`/api/admin/makeup/kids-family?parentId=${family.parentId}&sourceMonth=2031-07`);expect(r.status()).toBe(200);return r.json()}
  const body=(day:number,requestId=randomUUID())=>({parent_id:family.parentId,source_month:'2031-07',attending_child_id:family.children[0],
    makeup_date:`2031-08-${day}`,start_time:'17:00',end_time:'19:00',branch_id:f.branchId,request_id:requestId,
    schedule_template_id:localSql(`SELECT id FROM schedule_templates WHERE branch_id='${f.branchId}' AND course_type_id='${f.kidsCourseId}' AND day_of_week=extract(dow FROM date '2031-08-${day}') AND start_time='17:00' AND end_time='19:00' AND is_active;`)})
  const send=(data:Record<string,unknown>)=>page.request.post('/api/admin/makeup/kids-family',{data})
  expect(await get()).toMatchObject({quota:5,remaining:5,destinationPurchase:{quantity:0},eligible:false})
  expect((await send(body(20))).status()).toBe(409)
  localSql(`BEGIN; SELECT task10_lock_pricing_scope_v1('${family.parentId}','${f.kidsCourseId}',2031,8); UPDATE bookings SET status='verified' WHERE id='${family.bookings[2]}'; COMMIT;`)
  expect(await get()).toMatchObject({destinationPurchase:{quantity:1},eligible:false})
  expect((await send(body(20))).status()).toBe(409)
  localSql(`BEGIN; SELECT task10_lock_pricing_scope_v1('${family.parentId}','${f.kidsCourseId}',2031,8); UPDATE bookings SET status='verified' WHERE id='${family.bookings[3]}'; COMMIT;`)
  expect(await get()).toMatchObject({destinationPurchase:{quantity:2},eligible:true})
  const original=body(20), ordered=(await get()).sources.map((s:{sourceSessionId:string})=>s.sourceSessionId)
  const duplicates=await Promise.all([send(original),send(original)])
  const results=await Promise.all(duplicates.map(async r=>{expect(r.status(),await r.text()).toBe(200);return r.json()}))
  expect(results[0].data.id).toBe(results[1].data.id)
  expect(results[0].data.rescheduled_from_id).toBe(ordered[0])
  localSql("UPDATE task10_policy_activation SET state='paused',pricing_enabled=false,makeup_enabled=false,expiry_enabled=false;")
  const replay=await send(original);expect(replay.status()).toBe(200);expect((await replay.json()).data.id).toBe(results[0].data.id)
  expect((await send({...original,attending_child_id:family.children[1]})).status()).toBe(409)
  expect((await send({...original,source_month:'2031-06'})).status()).toBe(409)
  expect((await send(body(21))).status()).toBe(409)
  localSql("UPDATE task10_policy_activation SET state='active',pricing_enabled=true,makeup_enabled=true;")
  for(const day of [21,22,23]) {const r=await send(body(day));expect(r.status(),await r.text()).toBe(200)}
  const last=await Promise.all([send(body(24)),send(body(25))]);expect(last.map(r=>r.status()).sort()).toEqual([200,409])
  expect((await send(body(26))).status()).toBe(409)
  expect(await get()).toMatchObject({quota:5,used:5,remaining:0,destinationPurchase:{quantity:2},eligible:false})
  expect(JSON.parse(localSql(`SELECT jsonb_build_object('uses',count(*),'roots',count(DISTINCT source_root_id),'requests',count(DISTINCT request_id),'exact',bool_and(s.child_id=u.attending_child_id AND s.rescheduled_from_id=u.source_session_id AND s.is_makeup),'oneChild',bool_and(u.attending_child_id='${family.children[0]}')) FROM task10_family_makeup_uses u JOIN booking_sessions s ON s.id=u.destination_session_id WHERE u.parent_id='${family.parentId}';`))).toEqual({uses:5,roots:5,requests:5,exact:true,oneChild:true})
})

for (const failure of ['lost response', 'failed authoritative refresh'] as const) {
test(`Family ${failure} retains the exact request across tabs and blocks month changes until real replay is reconciled`, async ({ page }) => {
  const family=await seedTask10Family(), f=readTask10Fixture()
  localSql(`BEGIN; SELECT task10_lock_pricing_scope_v1('${family.parentId}','${f.kidsCourseId}',2031,8); UPDATE bookings SET status='verified' WHERE id IN ('${family.bookings[2]}','${family.bookings[3]}'); COMMIT;`)
  await login(page,TASK10_ADMIN_EMAIL,TASK10_PASSWORD)
  await page.goto('/admin/makeup?month=2031-07');await page.getByRole('tab',{name:/เลือกวันชดเชย/}).click()
  const card=page.getByTestId(`kids-family-${family.parentId}:2031-07`)
  await card.getByRole('button',{name:'เลือกเด็กและรอบชดเชย',exact:true}).click()
  await page.getByRole('combobox',{name:'เด็กที่มาเรียนจริง',exact:true}).click();await page.getByRole('option',{name:'Task10 Family 1',exact:true}).click()
  await page.getByTestId('makeup-day-2031-08-20').click()
  await page.getByRole('dialog').getByText('สาขาทดสอบ Localhost',{exact:true}).locator('..').getByRole('button',{name:'17:00-19:00',exact:true}).click()
  const requests:unknown[]=[]
  page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname==='/api/admin/makeup/kids-family')requests.push(r.postDataJSON())})
  if (failure === 'lost response') {
    await page.route('**/api/admin/makeup/kids-family',async route=>{if(route.request().method()!=='POST')return route.continue();const r=await route.fetch();expect(r.status()).toBe(200);await route.abort('failed')},{times:1})
  } else {
    await page.route('**/api/admin/makeup/kids-family?**',route=>route.abort('failed'),{times:1})
  }
  await page.getByRole('button',{name:'จัดชดเชยร่วมครอบครัว',exact:true}).click()
  await expect(page.getByRole('button',{name:'ตรวจสอบคำขอเดิม',exact:true})).toBeVisible()
  await expect(page.getByLabel('เดือนและปีของรายการ')).toBeDisabled()
  await expect(page.getByRole('combobox',{name:'เด็กที่มาเรียนจริง',exact:true})).toBeDisabled()
  expect(localSql(`SELECT count(*) FROM task10_family_makeup_uses WHERE parent_id='${family.parentId}';`)).toBe('1')
  const replay=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/admin/makeup/kids-family')
  await page.getByRole('button',{name:'ตรวจสอบคำขอเดิม',exact:true}).click();expect((await replay).status()).toBe(200)
  await expect(page.getByRole('status').filter({hasText:'โควตาเหลือ 4'})).toBeVisible()
  expect(requests).toHaveLength(2);expect(requests[0]).toEqual(requests[1])
  expect(localSql(`SELECT count(*) FROM task10_family_makeup_uses WHERE parent_id='${family.parentId}';`)).toBe('1')
  await expect(page.getByLabel('เดือนและปีของรายการ')).toBeEnabled()
  await page.getByRole('tab',{name:/ต้องตรวจสอบ/}).click();await page.getByRole('tab',{name:/เลือกวันชดเชย/}).click()
  await expect(card.locator('[data-makeup-destination]')).toHaveCount(1)
})
}

test('Real User API, concurrent Legacy slip retry and History show receipt success versus due and committed cancellation',async({page})=>{
  const f=readTask10Fixture();setDisposableClock('2034-01-01T10:00:00+07:00')
  localSql(`UPDATE task10_policy_activation SET state='active',expiry_enabled=true;
    INSERT INTO schedule_templates(branch_id,course_type_id,day_of_week,start_time,end_time,is_active)
      SELECT '${f.branchId}','${f.adultCourseId}',d,'10:00','11:00',true FROM generate_series(0,6) d
      WHERE NOT EXISTS(SELECT 1 FROM schedule_templates WHERE branch_id='${f.branchId}' AND course_type_id='${f.adultCourseId}' AND day_of_week=d AND start_time='10:00' AND end_time='11:00' AND is_active);`)
  await page.goto('/auth/login');await page.locator('#email').fill(TEST_ACCOUNT.email);await page.locator('#password').fill(TEST_ACCOUNT.password)
  await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await page.waitForURL(/\/dashboard(?:\/|$)/)
  const create=async(day:number)=>{
    const response=await page.request.post('/api/bookings',{data:{learnerType:'self',childId:null,branchId:f.branchId,courseTypeId:f.adultCourseId,
      month:1,year:2034,totalSessions:1,totalAmount:500,expectedTotalPrice:500,clientRequestId:randomUUID(),
      sessions:[{date:`2034-01-${day}`,startTime:'10:00',endTime:'11:00',branchId:f.branchId,childId:null}]}})
    const body=await response.json();expect(response.status(),JSON.stringify(body)).toBe(200);return body.bookingId as string
  }
  const onTime=await create(10);const due=await create(11)
  await page.goto('/dashboard/history')
  await page.getByTestId(`history-booking-${due}`).getByRole('button',{name:'ดูรายละเอียด',exact:true}).click()
  await expect(page.getByRole('dialog')).toContainText('1/1 ครั้ง')
  await expect(page.getByRole('dialog')).toContainText('แก้ไขผ่านปฏิทิน')
  await page.keyboard.press('Escape')
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1cAAAAASUVORK5CYII=','base64')
  const requestId=randomUUID();const sha=createHash('sha256').update(bytes).digest('hex')
  trackTask10Storage('payment-slips',`${f.userId}/${requestId}-${sha}.png`)
  setDisposableClock('2034-01-10T09:59:59.999+07:00')
  const send=()=>page.request.post('/api/verify-slip',{multipart:{bookingIds:JSON.stringify([onTime]),expectedAmount:'500',requestId,file:{name:'task10.png',mimeType:'image/png',buffer:bytes}}})
  const results=await Promise.all([send(),send()])
  for(const r of results){const body=await r.json();expect(r.status(),JSON.stringify(body)).toBe(200);expect(body).toMatchObject({verified:true,bookingStatus:'verified'})}
  expect(localSql(`SELECT count(*) FROM payments WHERE booking_id='${onTime}' AND status='approved';`)).toBe('1')
  expect(localSql(`SELECT count(*) FROM task10_accepted_receipts WHERE booking_id='${onTime}';`)).toBe('1')
  expect(localSql(`SELECT count(*) FROM activity_logs WHERE action='task10_slip_finalized' AND details->>'bookingId'='${onTime}';`)).toBe('1')
  setDisposableClock('2034-01-11T10:00:00+07:00')
  await page.setViewportSize({width:390,height:844});await page.goto('/dashboard/history')
  const card=page.getByTestId(`history-booking-${due}`)
  await expect(card.getByText('หมดกำหนดรับสลิป',{exact:true})).toBeVisible()
  await expect(card.getByRole('button',{name:'แนบสลิป',exact:true})).toHaveCount(0)
  await card.getByRole('button',{name:'ดูรายละเอียด',exact:true}).click()
  await expect(page.getByRole('dialog')).toContainText('หมดกำหนดรับสลิป — รอยกเลิก')
  await expect(page.getByRole('dialog')).toContainText('0/1 ครั้ง')
  await expect(page.getByRole('dialog').getByText('รอเรียน',{exact:true})).toHaveCount(0)
  await page.keyboard.press('Escape')
  expect(localSql(`SELECT status FROM bookings WHERE id='${due}';`)).toBe('pending_payment')
  const expired=await createLocalAdmin().rpc('task10_expire_booking_v1',{p_booking_id:due});expect(expired.error).toBeNull();expect(expired.data.cancelled).toBe(true)
  await page.reload();await expect(card.getByText('ยกเลิกอัตโนมัติ เนื่องจากไม่มีหลักฐานรับสลิปสำเร็จก่อนกำหนด',{exact:true})).toBeVisible()
  await card.getByRole('button',{name:'ดูรายละเอียด',exact:true}).click()
  await expect(page.getByRole('dialog')).toContainText('ยกเลิกแล้ว')
  await expect(page.getByRole('dialog')).toContainText('0/1 ครั้ง')
  await expect(page.getByRole('dialog').getByText('รอเรียน',{exact:true})).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.getByTestId(`history-booking-${onTime}`).getByRole('button',{name:'ดูรายละเอียด',exact:true}).click()
  await expect(page.getByRole('dialog')).toContainText('1/1 ครั้ง')
  await expect(page.getByRole('dialog').getByText('หมดกำหนดรับสลิป — รอยกเลิก',{exact:true})).toHaveCount(0)
  expect(localSql(`SELECT status FROM bookings WHERE id='${onTime}';`)).toBe('verified')
  expect(localSql(`SELECT count(*) FROM booking_sessions WHERE booking_id='${due}' AND cancelled_at IS NOT NULL;`)).toBe('1')
  await page.screenshot({path:'test-results/task10-regression/history-deadline-mobile.png',fullPage:true})
})

test('Real pg_cron tick retries a busy family and records one atomic cancellation in the disposable database',async()=>{
  test.setTimeout(180_000)
  if(!readTask10Fixture().family) await seedTask10Family()
  const f=readTask10Fixture();setDisposableClock('2035-01-01T10:00:00+07:00')
  localSql(`UPDATE task10_policy_activation SET state='active',expiry_enabled=true;
    INSERT INTO schedule_templates(branch_id,course_type_id,day_of_week,start_time,end_time,is_active)
      SELECT '${f.branchId}','${f.adultCourseId}',d,'10:00','11:00',true FROM generate_series(0,6) d
      WHERE NOT EXISTS(SELECT 1 FROM schedule_templates WHERE branch_id='${f.branchId}' AND course_type_id='${f.adultCourseId}' AND day_of_week=d AND start_time='10:00' AND end_time='11:00' AND is_active);`)
  const created=await createLocalAdmin().rpc('task10_write_legacy_booking_v1',{p_user_id:f.userId,p_action:'create',p_request_id:randomUUID(),p_input:{
    learnerType:'self',childId:null,branchId:f.branchId,courseTypeId:f.adultCourseId,month:1,year:2035,totalSessions:1,totalAmount:500,expectedTotalPrice:500,
    sessions:[{date:'2035-01-15',startTime:'10:00',endTime:'11:00',branchId:f.branchId,childId:null}],
  }})
  expect(created.error).toBeNull();const id=created.data.bookingId
  setDisposableClock('2035-01-15T10:00:00+07:00')
  const app=`task10-worker-${randomUUID()}`
  const holder=concurrentLocalSql(`SET application_name='${app}'; BEGIN; SELECT pg_advisory_xact_lock(hashtextextended('task10-family|${f.userId}|2035-01-01',0)); SELECT pg_sleep(12); COMMIT;`)
  try {
    await expect.poll(()=>localSql(`SELECT count(*) FROM pg_stat_activity WHERE application_name='${app}' AND wait_event='PgSleep';`)).toBe('1')
    const skipped=JSON.parse(localSql('SELECT public.task10_run_expiry_v1(50);'))
    expect(skipped.skipped).toContainEqual({bookingId:id,reason:'family_busy'})
    expect(localSql(`SELECT status FROM bookings WHERE id='${id}';`)).toBe('pending_payment')
    expect(localSql(`SELECT count(*) FROM task10_worker_runs WHERE id='${skipped.runId}' AND finished_at IS NOT NULL;`)).toBe('1')
  } finally { await holder }
  const rowHolder=await holdLocalTransaction(`SELECT id FROM bookings WHERE id='${id}' FOR UPDATE;`,`task10-worker-row-${randomUUID()}`)
  try {
    const timedOut=JSON.parse(localSql('SELECT public.task10_run_expiry_v1(50);'))
    expect(timedOut.skipped).toContainEqual({bookingId:id,reason:'lock_busy',sqlstate:'55P03'})
    expect(localSql(`SELECT status FROM bookings WHERE id='${id}';`)).toBe('pending_payment')
  } finally { await rowHolder.finish() }
  expect(localSql("SELECT active FROM cron.job WHERE jobname='task10-expire-unpaid-bookings-v1';")).toBe('f')
  const before=localSql('SELECT clock_timestamp();')
  try {
    localSql("SELECT cron.alter_job(jobid,active:=true) FROM cron.job WHERE jobname='task10-expire-unpaid-bookings-v1';")
    await expect.poll(()=>localSql(`SELECT count(*) FROM cron.job_run_details WHERE jobid=(SELECT jobid FROM cron.job WHERE jobname='task10-expire-unpaid-bookings-v1') AND start_time>'${before}'::timestamptz AND status='succeeded';`),{timeout:75_000,intervals:[1000,2000]}).not.toBe('0')
    expect(localSql(`SELECT status FROM bookings WHERE id='${id}';`)).toBe('cancelled')
    expect(localSql(`SELECT count(*) FROM task10_booking_cancellations WHERE booking_id='${id}';`)).toBe('1')
    expect(localSql(`SELECT count(*) FROM booking_sessions WHERE booking_id='${id}' AND cancelled_at IS NOT NULL;`)).toBe('1')
    expect(Number(localSql(`SELECT count(*) FROM task10_worker_runs WHERE started_at>'${before}'::timestamptz AND status='complete' AND cancelled>=1;`))).toBeGreaterThanOrEqual(1)
  } finally {
    localSql("SELECT cron.alter_job(jobid,active:=false) FROM cron.job WHERE jobname='task10-expire-unpaid-bookings-v1';")
  }
  expect(localSql("SELECT active FROM cron.job WHERE jobname='task10-expire-unpaid-bookings-v1';")).toBe('f')
})

test('Excluded historical overdue bill remains visible and payable through the real User API',async({page})=>{
  const f=readTask10Fixture();const id=f.lifecycle!.oldOverdue
  setDisposableClock('2035-02-01T10:00:00+07:00')
  if(!f.family) await seedTask10Family()
  const projection=await createLocalAdmin().rpc('task10_payment_projection_v1',{p_booking_ids:[id]});expect(projection.error).toBeNull()
  expect(projection.data[0]).toMatchObject({inCohort:false,due:false,status:'pending_payment'})
  await page.goto('/auth/login')
  await page.locator('#email').fill('booking-regression-occupancy@example.com');await page.locator('#password').fill(TEST_ACCOUNT.password)
  await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await page.waitForURL(/\/dashboard(?:\/|$)/)
  await page.goto('/dashboard/history')
  const card=page.getByTestId(`history-booking-${id}`)
  await expect(card.getByText('รอแนบสลิป',{exact:true})).toBeVisible()
  await expect(card.getByText('หมดกำหนดรับสลิป',{exact:true})).toHaveCount(0)
  await expect(card.getByRole('button',{name:'ดูรายละเอียด',exact:true})).toBeEnabled()
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1cAAAAASUVORK5CYII=','base64')
  const requestId=randomUUID();const sha=createHash('sha256').update(bytes).digest('hex')
  trackTask10Storage('payment-slips',`${f.otherUserId}/${requestId}-${sha}.png`)
  const response=await page.request.post('/api/verify-slip',{multipart:{bookingIds:JSON.stringify([id]),expectedAmount:'500',requestId,
    file:{name:'task10-historical.png',mimeType:'image/png',buffer:bytes}}})
  const result=await response.json();expect(response.status(),JSON.stringify(result)).toBe(200);expect(result.bookingStatus).toBe('verified')
  expect(localSql(`SELECT count(*) FROM task10_booking_cancellations WHERE booking_id='${id}';`)).toBe('0')
  await page.reload();await expect(card.getByText('จองสำเร็จ',{exact:true})).toBeVisible()
})
