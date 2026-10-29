import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { expect } from '@playwright/test'
import { run, env, sql, q, fixtures } from '../tests/booking-ux/runtime.mjs'
import { adminBrowser } from '../tests/booking-ux/browser.mjs'

const base = process.env.BOOKING_UX2_BASE || 'http://127.0.0.1:3150'
assert.match(base, /^http:\/\/127\.0\.0\.1:315[0-3]$/)
const runtime = JSON.parse(fs.readFileSync(process.env.BOOKING_UX2_RUNTIME || '.playwright/booking-ux-1/app-runtime.json', 'utf8'))
assert.equal(runtime.port, Number(new URL(base).port), 'Runtime must identify the exact tested app')
assert.equal(runtime.api, env.apiUrl, 'App must use the physically guarded disposable API')
const binding = JSON.parse(fs.readFileSync(path.join(runtime.app, '.next/booking-ux-1-local-build.json'), 'utf8'))
assert.equal(binding.runId, run.runId)
assert.equal(binding.api, env.apiUrl)
assert.equal(binding.buildId, fs.readFileSync(path.join(runtime.app, '.next/BUILD_ID'), 'utf8').trim())
const manifest = JSON.parse(fs.readFileSync(path.join(runtime.app, 'source-manifest.json'), 'utf8'))
for (const [file, hash] of Object.entries(manifest.hashes)) {
  if (/^(src\/|public\/|supabase\/migrations\/|package(?:-lock)?\.json$|next\.config)/.test(file)) assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'), hash, 'Built source differs: ' + file)
}
const f = JSON.parse(fs.readFileSync(path.join(run.evidenceRoot, 'fixture.json'), 'utf8'))
const root = path.resolve('.playwright/booking-ux-2/kids-browser-' + Date.now() + '-' + randomUUID().slice(0, 8))
fs.mkdirSync(root, { recursive: true })
const checks = [], errors = [], egress = []
const check = (condition, name) => { assert.ok(condition, name); checks.push(name); console.log(name) }
const read = statement => JSON.parse(sql(statement))
const state = id => read(`SELECT jsonb_build_object('bill',to_jsonb(b),'hold',(SELECT to_jsonb(r) FROM progressive_coupon_reservations r WHERE r.booking_id=b.id),'sessions',(SELECT jsonb_agg(to_jsonb(s) ORDER BY s.date,s.start_time,s.id) FROM booking_sessions s WHERE s.booking_id=b.id AND s.status='scheduled'),'uses',(SELECT count(*) FROM coupon_usages WHERE booking_id=b.id)) FROM bookings b WHERE id=${q(id)}`)
const dates = read("SELECT jsonb_agg((date_trunc('month',clock_timestamp() AT TIME ZONE 'Asia/Bangkok')+interval '1 month'+make_interval(days=>n))::date ORDER BY n) FROM generate_series(0,2)n")
const actor = await fixtures.account('user', 'ตรวจรับ UX2 เด็กขั้นต่ำคูปอง'), child = randomUUID(), childName = 'ผู้เรียนสมมติ UX2 เด็ก'
sql(`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(child)},${q(actor.id)},${q(childName)},'น้องตรวจ UX2')`)
const coupon = { id: randomUUID(), code: 'UX2KID' + randomUUID().slice(0, 8).toUpperCase() }
sql(`INSERT INTO coupons(id,code,discount_type,discount_value,min_purchase,max_uses,created_by) VALUES(${q(coupon.id)},${q(coupon.code)},'fixed',500,1200,1,${q(f.sa.id)})`)
const { browser, context, page } = await adminBrowser(base, actor)
page.on('pageerror', error => errors.push(error.message))
await context.route('**/*', route => {
  const url = new URL(route.request().url())
  if (['data:', 'blob:'].includes(url.protocol)) return route.fallback()
  if (![new URL(base).host, new URL(env.apiUrl).host].includes(url.host)) { egress.push(url.host); return route.abort() }
  return route.fallback()
})
const snap = async name => {
  await page.evaluate(async () => { window.scrollTo({top:0,left:0,behavior:'instant'}); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))) })
  await page.screenshot({ path: path.join(root, name + '.png'), fullPage: true })
}
const viewDate = async date => {
  await expect(page.getByTestId('booking-calendar')).toBeVisible({ timeout: 20000 })
  for (let attempt = 0; attempt < 12 && !await page.getByTestId('booking-date-' + date).count(); attempt++) {
    const firstDate = page.locator('[data-testid^="booking-date-"]').first()
    const previous = await firstDate.getAttribute('data-testid')
    await page.getByRole('button', { name: 'เดือนถัดไป', exact: true }).click()
    await expect(firstDate).not.toHaveAttribute('data-testid', previous)
    await expect(page.getByTestId('booking-calendar')).toBeVisible()
  }
  await expect(page.getByTestId('booking-date-' + date)).toBeEnabled({ timeout: 20000 })
}
const toggleRound = async date => {
  await viewDate(date)
  await page.getByTestId('booking-date-' + date).click()
  const slot = page.getByTestId(`booking-slot-${date}-${f.branch}-10:00`)
  await expect(slot).toBeEnabled({ timeout: 20000 }); await slot.click()
}
const reduceAndQuote = async () => {
  await page.getByRole('button', { name: 'แก้ไขวันเรียน', exact: true }).click()
  await expect(page.getByTestId('booking-calendar')).toBeVisible({ timeout: 20000 })
  await toggleRound(dates[1]); await toggleRound(dates[2])
  await page.getByRole('button', { name: 'ถัดไป', exact: true }).click()
  await expect(page.getByTestId('booking-edit-coupon-warning')).toBeVisible({ timeout: 20000 })
  await expect(page.getByTestId('booking-edit-total')).toHaveText('฿700')
  await expect(page.getByRole('button', { name: 'ยืนยันการแก้ไขและชำระต่อ', exact: true })).toBeDisabled()
}

let billId
try {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(base + '/dashboard/booking', { waitUntil: 'networkidle' })
  await page.getByText('เด็ก (กลุ่ม)', { exact: true }).first().click()
  await page.getByTestId('booking-next').click()
  await page.getByRole('button', { name: 'เปลี่ยนสาขา', exact: true }).click()
  const dialog = page.getByRole('dialog'), branchName = sql(`SELECT name FROM branches WHERE id=${q(f.branch)}`)
  for (const checkbox of await dialog.getByRole('checkbox').all()) await checkbox.uncheck()
  const search = dialog.getByRole('textbox', { name: 'ค้นหาสาขา', exact: true })
  if (await search.count()) await search.fill(branchName)
  await dialog.getByRole('checkbox', { name: new RegExp(branchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).check()
  await dialog.getByRole('button', { name: /^ใช้สาขาที่เลือก/ }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('กำลังเลือกวันเรียนของ:', { exact: false })).toBeVisible()
  for (const date of dates) await toggleRound(date)
  await expect(page.getByTestId('booking-step4-total')).toHaveText('฿1,875', { timeout: 20000 })
  await page.getByLabel('รหัสส่วนลด', { exact: true }).fill(coupon.code)
  await page.getByRole('button', { name: 'ใช้โค้ด', exact: true }).click()
  await expect(page.getByTestId('booking-step4-total')).toHaveText('฿1,375', { timeout: 20000 })
  await expect(page.getByRole('heading', { name: 'สรุปการจอง', exact: true })).toHaveCount(0)
  check(sql(`SELECT count(*) FROM progressive_coupon_reservations WHERE user_id=${q(actor.id)}`) === '0', 'Kids stage-2 fixed coupon preview computes1875−500=1375 without reserving or consuming')
  await snap('01-kids-stage2-fixed-mobile')
  let createRequests = 0
  const onRequest = request => { if (new URL(request.url()).pathname === '/api/booking-checkout' && request.method() === 'POST' && request.postDataJSON()?.action === 'create') createRequests++ }
  page.on('request', onRequest)
  await page.getByTestId('booking-confirm').click()
  await page.waitForURL(url => Boolean(url.searchParams.get('payment')), { timeout: 25000 })
  await expect(page.getByTestId('payment-countdown')).toBeVisible({ timeout: 25000 })
  page.off('request', onRequest); billId = new URL(page.url()).searchParams.get('payment')
  const original = state(billId)
  check(createRequests === 1 && Number(sql(`SELECT count(*) FROM bookings WHERE user_id=${q(actor.id)}`)) === 1, 'Kids confirms directly from stage2 into exactly one payment bill')
  check(original.sessions.length === 3 && Number(original.bill.total_price) === 1375 && original.hold.status === 'reserved' && original.uses === 0, 'Pending Kids bill retains all3 exact-learner rounds and reserved coupon')
  await expect(page.getByTestId('payment-booking-summary')).toContainText(childName)
  await expect(page.getByTestId('payment-booking-summary')).toContainText(coupon.code)
  await expect(page.getByTestId('payment-net-total')).toHaveText('฿1,375')
  await snap('02-kids-summary-payment-mobile')
  await reduceAndQuote()
  check(JSON.stringify(state(billId)) === JSON.stringify(original), 'Kids below-minimum preview proposes700 without persisting dates, total or coupon release')
  await snap('03-kids-below-min-warning-mobile')
  await page.getByRole('button', { name: 'ย้อนกลับไปแก้วัน', exact: true }).click()
  await page.getByRole('button', { name: 'กลับโดยไม่บันทึก', exact: true }).click()
  await expect(page.getByTestId('payment-countdown')).toBeVisible()
  check(JSON.stringify(state(billId)) === JSON.stringify(original), 'Canceling below-minimum edit preserves original1375 bill,3rounds,hold and deadline')
  await reduceAndQuote()
  const warning = page.getByTestId('booking-edit-coupon-warning'), save = page.getByRole('button', { name: 'ยืนยันการแก้ไขและชำระต่อ', exact: true })
  await expect(warning.getByRole('checkbox')).not.toBeChecked()
  await warning.getByRole('checkbox').check(); await expect(save).toBeEnabled()
  await snap('04-kids-release-acknowledged-mobile')
  await save.click(); await expect(page.getByTestId('payment-countdown')).toBeVisible({ timeout: 25000 })
  const edited = state(billId)
  check(edited.sessions.length === 1 && edited.sessions[0].date === dates[0] && edited.sessions[0].child_id === child && Number(edited.bill.total_price) === 700 && edited.hold.status === 'released' && edited.uses === 0, 'Acknowledged Kids edit atomically keeps1 exact round, releases hold and sets undiscounted700')
  check(edited.bill.id === original.bill.id && edited.bill.checkout_deadline === original.bill.checkout_deadline, 'Kids edit retains exact original bill and30-minute deadline')
  await expect(page.getByTestId('payment-net-total')).toHaveText('฿700')
  await expect(page.getByTestId('booking-coupon-' + billId)).toContainText('ไม่ใช้ส่วนลดแล้ว')
  await snap('05-kids-released-coupon-payment-mobile')
  await expect(page.getByTestId('payment-transfer-card')).toBeVisible({ timeout: 20000 })
  await page.getByLabel('รูปสลิปการโอนเงิน', { exact: true }).setInputFiles({ name: 'ux2-kids-local.png', mimeType: 'image/png', buffer: Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBXkAAAAASUVORK5CYII=', 'base64'), Buffer.from(randomUUID())]) })
  await expect(page.getByAltText('ภาพตัวอย่างสลิปที่เลือก ยังไม่ได้ส่ง')).toBeVisible()
  check(state(billId).hold.status === 'released' && state(billId).bill.status === 'pending_payment', 'Selecting replacement-total PNG preserves released coupon and pending payment')
  await page.getByRole('button', { name: /3\. ส่งสลิปยืนยันการชำระเงิน/ }).click()
  await expect(page.getByRole('heading', { name: 'ชำระเงินสำเร็จ', exact: true })).toBeVisible({ timeout: 30000 })
  const paid = state(billId)
  check(paid.bill.status === 'verified' && Number(paid.bill.total_price) === 700 && paid.hold.status === 'released' && paid.uses === 0, 'Real Local Kids PNG verifies full700 without consuming previously released coupon')
  check(paid.sessions.length === 1 && paid.sessions[0].child_id === child, 'Verified Kids payment retains the single exact-learner round')
  await snap('06-kids-full700-verified-mobile')
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Kids mobile390 has no horizontal overflow')
  check(errors.length === 0 && egress.length === 0, 'Kids flow has no browser exceptions or network outside isolated app/API')
  fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify({ pass: true, checks, actor: actor.id, child, billId, dates, coupon: coupon.code, target: run.target, base, binding, testDefinitionSha256: createHash('sha256').update(fs.readFileSync(import.meta.filename)).digest('hex'), errors, egress }, null, 2))
  console.log(JSON.stringify({ root, passed: checks.length }))
} catch (error) {
  await snap('failure').catch(() => {})
  fs.writeFileSync(path.join(root, 'failure.json'), JSON.stringify({ checks, error: String(error), stack: error.stack, actor: actor.id, billId, errors, egress, body: await page.locator('body').innerText().catch(() => null) }, null, 2)); throw error
} finally { await context.close(); await browser.close() }
