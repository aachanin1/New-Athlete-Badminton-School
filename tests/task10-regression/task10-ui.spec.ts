import { expect, test, type Page } from '@playwright/test'
import { TEST_ADMIN_ACCOUNT, TEST_ACCOUNT } from '../booking-regression/local-supabase'
import { createHash, randomUUID } from 'node:crypto'
import { concurrentLocalSql, holdLocalTransaction, createLocalAdmin, localSql, readTask10Fixture, seedTask10Family, seedFamilyScheduleFixture, seedLegacyHeaderWalletFixture, setDisposableClock, trackTask10Storage, TASK10_ADMIN_EMAIL, TASK10_PASSWORD } from './local-supabase'

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
      const scopes = page.getByRole('combobox', { name: 'ครอบครัวและเดือนต้นทาง', exact: true })
      if (state === 'never_activated') await expect(scopes).toHaveCount(0)
      else {
        // Select the future source month; linked references never enter its totals.
        await page.getByLabel('เดือนและปีของรายการ').fill('2031-07')
        await expect(page.getByLabel('เดือนและปีของรายการ')).toHaveValue('2031-07')
        await scopes.click()
        await page.getByRole('option', { name: 'Read Scope Family · 2031-07', exact: true }).click()
        await expect(page.getByText('เดือนต้นทาง 2031-07 → เดือนปลายทาง 2031-08', { exact: true })).toBeVisible()
        await expect(page.getByRole('button', { name: 'จัดชดเชยร่วมครอบครัว', exact: true })).toBeDisabled()
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

test('Makeup Admin uses the family UI to select a source child separately from the actual attendee after verified D is sufficient',async({page})=>{
  const family=await seedTask10Family();const f=readTask10Fixture()
  localSql(`UPDATE profiles SET full_name='Task10 UI Family' WHERE id='${family.parentId}';`)
  await login(page,TASK10_ADMIN_EMAIL,TASK10_PASSWORD);await page.goto('/admin/makeup?month=2031-07')
  await page.getByRole('combobox',{name:'ครอบครัวและเดือนต้นทาง',exact:true}).click()
  await page.getByRole('option',{name:'Task10 UI Family · 2031-07',exact:true}).click()
  await expect(page.getByText('ซื้อเดือนปลายทางยืนยันแล้ว 0 ครั้ง · ขั้นต่ำ 2 ครั้ง',{exact:true})).toBeVisible()
  await expect(page.getByText('รอชำระ 1 ครั้ง · รอตรวจยืนยัน 1 ครั้ง — ยังไม่นับเป็นยอดยืนยัน',{exact:true})).toBeVisible()
  await expect(page.getByRole('combobox',{name:'รายการต้นทาง',exact:true})).toBeDisabled()
  localSql(`BEGIN; SELECT public.task10_lock_pricing_scope_v1('${family.parentId}','${f.kidsCourseId}',2031,8); UPDATE bookings SET status='verified' WHERE id IN ('${family.bookings[2]}','${family.bookings[3]}'); COMMIT;`)
  await page.getByRole('button',{name:'โหลดสิทธิ์ใหม่',exact:true}).click()
  await expect(page.getByText('ซื้อเดือนปลายทางยืนยันแล้ว 2 ครั้ง · ขั้นต่ำ 2 ครั้ง',{exact:true})).toBeVisible()
  await page.getByRole('combobox',{name:'รายการต้นทาง',exact:true}).click()
  await page.getByRole('option',{name:'2031-07-02 · Task10 Family 2 · ขาดเรียน',exact:true}).click()
  await page.getByRole('combobox',{name:'เด็กที่มาเรียนจริง',exact:true}).click()
  await page.getByRole('option',{name:'Task10 Family 1',exact:true}).click()
  await page.getByLabel('วันชดเชยร่วมครอบครัว',{exact:true}).fill('2031-08-20')
  await page.getByRole('combobox',{name:'รอบชดเชยร่วมครอบครัว',exact:true}).click()
  await page.getByRole('option',{name:'สาขาทดสอบ Localhost · 17:00–19:00',exact:true}).click()
  const response=page.waitForResponse(r=>r.url().includes('/api/admin/makeup/kids-family') && r.request().method()==='POST')
  await page.getByRole('button',{name:'จัดชดเชยร่วมครอบครัว',exact:true}).click()
  const saved=await response;const body=await saved.json();expect(saved.status(),JSON.stringify(body)).toBe(200)
  await expect(page.getByRole('status').filter({hasText:'จัดชดเชยสำเร็จ โควตาเหลือ 4 ครั้ง'})).toBeVisible()
  expect(localSql(`SELECT child_id FROM booking_sessions WHERE id='${body.data.id}';`)).toBe(family.children[0])
  expect(localSql(`SELECT child_id FROM booking_sessions WHERE id='${family.sources[1]}';`)).toBe(family.children[1])
  expect(localSql(`SELECT count(*) FROM task10_family_makeup_uses WHERE parent_id='${family.parentId}';`)).toBe('1')
  await page.setViewportSize({width:390,height:844})
  await expect(page.getByText('โควตา 5 · ใช้แล้ว 1 · เหลือ 4 · ต้นทางที่ใช้ได้ 7',{exact:true})).toBeVisible()
  await page.screenshot({path:'test-results/task10-regression/family-makeup-mobile.png',fullPage:true})
})

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
  expect(localSql(`SELECT status FROM bookings WHERE id='${due}';`)).toBe('pending_payment')
  const expired=await createLocalAdmin().rpc('task10_expire_booking_v1',{p_booking_id:due});expect(expired.error).toBeNull();expect(expired.data.cancelled).toBe(true)
  await page.reload();await expect(card.getByText('ยกเลิกอัตโนมัติ เนื่องจากไม่มีหลักฐานรับสลิปสำเร็จก่อนกำหนด',{exact:true})).toBeVisible()
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
