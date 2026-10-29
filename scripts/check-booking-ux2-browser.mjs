import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { expect } from '@playwright/test'
import { run, env, sql, q, fixtures } from '../tests/booking-ux/runtime.mjs'
import { adminBrowser } from '../tests/booking-ux/browser.mjs'

// This harness writes only through the physically guarded booking disposable.
// The primary must start the exact Local build before executing it.
const base = process.env.BOOKING_UX2_BASE || 'http://127.0.0.1:3152'
assert.match(base, /^http:\/\/127\.0\.0\.1:315[0-3]$/)
const runtimeFile = process.env.BOOKING_UX2_RUNTIME || '.playwright/booking-ux-1/app-runtime.json'
const appRuntime = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'))
assert.equal(appRuntime.port, Number(new URL(base).port), 'Runtime metadata must identify the tested app listener')
assert.equal(appRuntime.api, env.apiUrl, 'App must use the guarded disposable API')
const binding = JSON.parse(fs.readFileSync(path.join(appRuntime.app, '.next/booking-ux-1-local-build.json'), 'utf8'))
assert.equal(binding.runId, run.runId)
assert.equal(binding.api, env.apiUrl)
assert.equal(binding.buildId, fs.readFileSync(path.join(appRuntime.app, '.next/BUILD_ID'), 'utf8').trim())
const sourceManifest = JSON.parse(fs.readFileSync(path.join(appRuntime.app, 'source-manifest.json'), 'utf8'))
for (const [file, digest] of Object.entries(sourceManifest.hashes)) {
  if (/^(src\/|public\/|supabase\/migrations\/|package(?:-lock)?\.json$|next\.config)/.test(file)) {
    assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'), digest, 'Built source differs: ' + file)
  }
}
const f = JSON.parse(fs.readFileSync(path.join(run.evidenceRoot, 'fixture.json'), 'utf8'))
const root = path.resolve('.playwright/booking-ux-2/browser-' + Date.now() + '-' + randomUUID().slice(0, 8))
fs.mkdirSync(root, { recursive: true })
const checks = [], errors = [], egress = [], sessions = [], actors = [], createdBills = []
const check = (condition, name) => { assert.ok(condition, name); checks.push(name); console.log(name) }
const read = statement => JSON.parse(sql(statement))
const amount = text => Number(text.replace(/[^\d.]/g, ''))
const state = id => read(`SELECT jsonb_build_object('bill',to_jsonb(b),'hold',(SELECT to_jsonb(r) FROM progressive_coupon_reservations r WHERE r.booking_id=b.id),'uses',(SELECT count(*) FROM coupon_usages WHERE booking_id=b.id),'units',(SELECT count(*) FROM booking_package_units WHERE booking_id=b.id),'sessions',(SELECT count(*) FROM booking_sessions WHERE booking_id=b.id AND status='scheduled')) FROM bookings b WHERE id=${q(id)}`)
const branchName = sql(`SELECT name FROM branches WHERE id=${q(f.branch)}`)
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const newActor = async label => { const actor = await fixtures.account('user', label); actors.push(actor); return actor }
const coupon = (type, value) => {
  const c = { id: randomUUID(), code: 'UX2UI' + randomUUID().slice(0, 8).toUpperCase() }
  sql(`INSERT INTO coupons(id,code,discount_type,discount_value,min_purchase,max_uses,created_by) VALUES(${q(c.id)},${q(c.code)},${q(type)},${value},0,1,${q(f.sa.id)})`)
  return c
}
const snap = async (page, name) => {
  await page.evaluate(() => window.scrollTo({top:0,left:0,behavior:'instant'}))
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await page.screenshot({ path: path.join(root, name + '.png'), fullPage: true })
}
const noOverflow = async page => {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal page overflow')
}
const open = async actor => {
  const b = await adminBrowser(base, actor); sessions.push(b)
  b.page.on('pageerror', error => errors.push(error.message))
  await b.context.route('**/*', route => {
    const url = new URL(route.request().url())
    if (['data:', 'blob:'].includes(url.protocol)) return route.fallback()
    if (![new URL(base).host, new URL(env.apiUrl).host].includes(url.host)) {
      egress.push(url.host); return route.abort()
    }
    return route.fallback()
  })
  return b
}
const choose = async (page, title, names) => {
  await page.getByRole('button', { name: 'เปลี่ยน' + title, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'เลือก' + title, exact: true })).toBeVisible()
  for (const checkbox of await dialog.getByRole('checkbox').all()) await checkbox.uncheck()
  const search = dialog.getByRole('textbox', { name: 'ค้นหา' + title, exact: true })
  for (const name of names) {
    if (await search.count()) await search.fill(name)
    await dialog.getByRole('checkbox', { name: new RegExp(escapeRegex(name)) }).check()
  }
  await dialog.getByRole('button', { name: new RegExp('^ใช้' + title + 'ที่เลือก') }).click()
  await expect(dialog).toHaveCount(0)
}
const stage2 = async (page, course, packageId, learners) => {
  await page.goto(base + '/dashboard/booking', { waitUntil: 'networkidle' })
  await page.getByText(course, { exact: true }).first().click()
  await page.getByTestId('package-' + packageId).click()
  await expect(page.getByTestId('booking-next')).toBeEnabled({ timeout: 20000 })
  await page.getByTestId('booking-next').click()
  if (learners) await choose(page, 'ผู้เรียน', learners)
  await choose(page, 'สาขา', [branchName])
  await expect(page.getByTestId('booking-checkout-total')).toBeVisible()
  await expect(page.getByTestId('booking-confirm')).toBeEnabled({ timeout: 20000 })
  await expect(page.getByRole('heading', { name: 'สรุปการจอง', exact: true })).toHaveCount(0)
  await expect(page.getByRole('list', { name: 'ขั้นตอนการจอง' }).getByRole('listitem')).toHaveCount(3)
}
const applyCoupon = async (page, actor, c, type, value) => {
  const gross = amount(await page.getByTestId('booking-step4-total').innerText())
  await page.getByLabel('รหัสส่วนลด', { exact: true }).fill(c.code)
  await page.getByRole('button', { name: 'ใช้โค้ด', exact: true }).click()
  const discount = type === 'percent' ? Math.round(gross * value / 100) : Math.min(gross, value)
  await expect(page.getByTestId('booking-step4-total')).toHaveText('฿' + (gross - discount).toLocaleString())
  await expect(page.getByTestId('booking-checkout-total')).toContainText('ราคาก่อนส่วนลด')
  await expect(page.getByTestId('booking-checkout-total')).toContainText(c.code)
  check(sql(`SELECT count(*) FROM progressive_coupon_reservations WHERE user_id=${q(actor.id)} AND coupon_id=${q(c.id)}`) === '0', type + ' coupon preview has no hold or consumption')
  check(sql(`SELECT count(*) FROM coupon_usages WHERE user_id=${q(actor.id)} AND coupon_id=${q(c.id)}`) === '0', type + ' coupon preview has no Legacy usage')
  return { gross, discount, net: gross - discount }
}
const confirm = async (page, actor, c, prices, zero = false) => {
  let creates = 0
  const count = request => { if (new URL(request.url()).pathname === '/api/booking-checkout' && request.method() === 'POST' && request.postDataJSON()?.action === 'create') creates++ }
  page.on('request', count)
  await page.getByTestId('booking-confirm').click()
  await page.waitForURL(url => Boolean(url.searchParams.get('payment')), { timeout: 25000 })
  const id = new URL(page.url()).searchParams.get('payment'); createdBills.push(id)
  if (zero) await expect(page.getByRole('heading', { name: 'ยืนยันการจองแล้ว', exact: true })).toBeVisible({ timeout: 25000 })
  else await expect(page.getByTestId('payment-countdown')).toBeVisible({ timeout: 25000 })
  page.off('request', count)
  check(creates === 1, 'One stage-2 confirmation creates one bill directly on payment page')
  await expect(page.getByTestId('booking-confirm')).toHaveCount(0)
  await expect(page.getByTestId('payment-booking-summary')).toContainText(c.code)
  await expect(page.getByTestId('payment-net-total')).toHaveText('฿' + prices.net.toLocaleString())
  const saved = state(id)
  check(Number(saved.bill.total_price) === prices.net && Number(saved.hold.discount_amount_snapshot) === prices.discount, 'Persisted total and coupon snapshot match stage-2 gross/discount/net')
  check(saved.hold.status === (zero ? 'consumed' : 'reserved') && saved.uses === 0, 'Coupon is ' + (zero ? 'consumed on explicit zero settlement' : 'reserved while unpaid'))
  check(Number(sql(`SELECT count(*) FROM bookings WHERE user_id=${q(actor.id)}`)) === 1, 'No intermediate or duplicate bill created')
  return id
}

let currentPage, adult, privateBill, zeroBill
try {
  adult = await newActor('ตรวจรับ UX2 ผู้ใหญ่')
  const a = await open(adult); currentPage = a.page
  await a.page.setViewportSize({ width: 390, height: 844 })
  await stage2(a.page, 'ผู้ใหญ่ (กลุ่ม)', 'adult-10')
  const percent = coupon('percent', 10), prices = await applyCoupon(a.page, adult, percent, 'percent', 10)
  await noOverflow(a.page); await snap(a.page, '01-stage2-percent-mobile')
  const adultBill = await confirm(a.page, adult, percent, prices), original = state(adultBill)
  check(original.sessions === 0 && original.units === 0, 'Zero-round Adult package grants no rights while unpaid')
  await snap(a.page, '02-payment-summary-mobile')
  const editDate = sql("SELECT ((clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date+3)::text")
  const selectEditorRound = async () => {
    await a.page.getByRole('button', { name: 'แก้ไขวันเรียน', exact: true }).click()
    await expect(a.page.getByTestId('booking-calendar')).toBeVisible()
    for (let attempt = 0; attempt < 12 && !await a.page.getByTestId('booking-date-' + editDate).count(); attempt++) {
      const firstDate = a.page.locator('[data-testid^="booking-date-"]').first()
      const previous = await firstDate.getAttribute('data-testid')
      await a.page.getByRole('button', { name: 'เดือนถัดไป', exact: true }).click()
      await expect(firstDate).not.toHaveAttribute('data-testid', previous)
    }
    await a.page.getByTestId('booking-date-' + editDate).click()
    await a.page.getByTestId(`booking-slot-${editDate}-${f.branch}-10:00`).click()
  }
  await selectEditorRound()
  await a.page.getByRole('button', { name: 'กลับโดยไม่บันทึก', exact: true }).click()
  await expect(a.page.getByTestId('payment-countdown')).toBeVisible()
  check(state(adultBill).sessions === 0 && state(adultBill).bill.checkout_deadline === original.bill.checkout_deadline, 'Canceling edit preserves original zero rounds and deadline')
  await selectEditorRound()
  await a.page.getByRole('button', { name: 'ถัดไป', exact: true }).click()
  await expect(a.page.getByTestId('booking-edit-total')).toHaveText('฿' + prices.net.toLocaleString())
  await expect(a.page.getByTestId('booking-edit-summary')).toContainText(percent.code)
  await a.page.setViewportSize({ width: 1280, height: 900 }); await snap(a.page, '03-edit-percent-preview-desktop')
  await a.page.getByRole('button', { name: 'ยืนยันการแก้ไขและชำระต่อ', exact: true }).click()
  await expect(a.page.getByTestId('payment-countdown')).toBeVisible({ timeout: 25000 })
  const edited = state(adultBill)
  check(edited.sessions === 1 && edited.hold.status === 'reserved' && Number(edited.bill.total_price) === prices.net && edited.bill.checkout_deadline === original.bill.checkout_deadline, 'Saving a round retains percent discount, same bill and original deadline')
  await a.page.setViewportSize({ width: 390, height: 844 })
  await expect(a.page.getByTestId('payment-transfer-card')).toBeVisible({ timeout: 20000 })
  await a.page.getByLabel('รูปสลิปการโอนเงิน', { exact: true }).setInputFiles({ name: 'ux2-local.png', mimeType: 'image/png', buffer: Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBXkAAAAASUVORK5CYII=', 'base64'), Buffer.from(randomUUID())]) })
  await expect(a.page.getByAltText('ภาพตัวอย่างสลิปที่เลือก ยังไม่ได้ส่ง')).toBeVisible()
  check(state(adultBill).hold.status === 'reserved' && state(adultBill).units === 0, 'Selecting a PNG does not consume coupon or grant rights')
  await snap(a.page, '04-selected-slip-mobile')
  await a.page.getByRole('button', { name: /3\. ส่งสลิปยืนยันการชำระเงิน/ }).click()
  await expect(a.page.getByRole('heading', { name: 'ชำระเงินสำเร็จ', exact: true })).toBeVisible({ timeout: 30000 })
  check(state(adultBill).hold.status === 'consumed' && state(adultBill).units === 9 && state(adultBill).bill.status === 'verified', 'Real Local PNG upload verifies payment, consumes once and grants nine remaining package units')
  await a.page.reload({ waitUntil: 'networkidle' })
  check(state(adultBill).units === 9 && state(adultBill).hold.status === 'consumed', 'Reload does not duplicate consumption or rights')
  await snap(a.page, '05-payment-success-mobile')

  const family = await newActor('ตรวจรับ UX2 ครอบครัว'), child = randomUUID(), childName = 'ผู้เรียนสมมติ UX2 ครอบครัว'
  sql(`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(child)},${q(family.id)},${q(childName)},'น้อง UX2')`)
  const p = await open(family); currentPage = p.page
  const parentName = sql(`SELECT full_name FROM profiles WHERE id=${q(family.id)}`)
  await p.page.setViewportSize({ width: 390, height: 844 })
  await stage2(p.page, 'Private', 'private-10', [parentName, childName])
  const fixed = coupon('fixed', 500), fixedPrices = await applyCoupon(p.page, family, fixed, 'fixed', 500)
  await snap(p.page, '06-private-family-fixed-stage2')
  privateBill = await confirm(p.page, family, fixed, fixedPrices)
  await expect(p.page.getByTestId('payment-booking-summary')).toContainText(parentName)
  await expect(p.page.getByTestId('payment-booking-summary')).toContainText(childName)
  check(state(privateBill).bill.package_participants.length === 2 && state(privateBill).sessions === 0 && state(privateBill).units === 0, 'Unpaid zero-round Private preserves complete Family and no rights')
  await snap(p.page, '07-private-family-payment-mobile')
  await p.page.setViewportSize({ width: 320, height: 800 }); await noOverflow(p.page); await snap(p.page, '08-private-payment-320')
  await p.page.setViewportSize({ width: 1280, height: 900 }); await snap(p.page, '09-private-payment-desktop')

  const zeroActor = await newActor('ตรวจรับ UX2 คูปองเต็มจำนวน'), z = await open(zeroActor); currentPage = z.page
  await z.page.setViewportSize({ width: 390, height: 844 }); await stage2(z.page, 'ผู้ใหญ่ (กลุ่ม)', 'adult-10')
  const zero = coupon('percent', 100), zeroPrices = await applyCoupon(z.page, zeroActor, zero, 'percent', 100)
  await expect(z.page.getByTestId('booking-confirm')).toHaveText('ยืนยันการจอง 0 บาท')
  await snap(z.page, '10-zero-coupon-stage2')
  zeroBill = await confirm(z.page, zeroActor, zero, zeroPrices, true)
  check(state(zeroBill).units === 10 && state(zeroBill).bill.status === 'verified', 'Explicit zero-charge confirmation consumes once and grants ten rights without money/slip')
  await expect(z.page.getByLabel('รูปสลิปการโอนเงิน')).toHaveCount(0); await snap(z.page, '11-zero-confirmed-mobile')

  // Presentation fixture only: actual React payment cards and assets, read-only
  // intercepted response data. It proves rendering/copy/fallback, not live routing.
  const presentationBefore = state(privateBill), bankPage = await open(family); currentPage = bankPage.page
  const bankBranches = ['SCB', 'กรุงศรี', 'ธ.กรุงเทพ', 'TTB'].map((bankName, i) => ({ id: randomUUID(), name: 'สาขาสมมติโลโก้ ' + (i + 1), slug: 'ux2-bank-' + i, is_active: true, bankName }))
  const bankAccounts = bankBranches.map((branch, i) => ({ id: 'ux2-card-' + i, bankName: branch.bankName, accountNumber: '123-4-56789-' + i, accountName: 'บัญชีสมมติสำหรับตรวจการแสดงผล', branchIds: [branch.id] }))
  const value = { version: 2, accounts: bankAccounts }
  const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v ?? null
  await bankPage.context.route('**/rest/v1/system_settings*', async route => { const response = await route.fetch(); await route.fulfill({ response, json: { value } }) })
  await bankPage.context.route('**/rest/v1/branches*', async route => { const response = await route.fetch(); await route.fulfill({ response, json: bankBranches }) })
  await bankPage.page.route('**/api/booking-checkout?*', async route => {
    assert.equal(route.request().method(), 'GET')
    const response = await route.fetch(), data = await response.json()
    data.transferSettings = { version: 2, accounts: bankAccounts, source: 'saved', error: null, readToken: JSON.stringify(canonical(value)) }
    data.branches = bankBranches
    data.bookings = data.bookings.map(b => ({ ...b, branch_id: bankBranches[0].id }))
    data.sessions = bankBranches.map((branch, i) => ({ id: randomUUID(), booking_id: privateBill, branch_id: branch.id, child_id: null, date: editDate, start_time: String(10 + i).padStart(2, '0') + ':00', end_time: String(11 + i).padStart(2, '0') + ':00', status: 'scheduled', children: null }))
    await route.fulfill({ response, json: data })
  })
  await bankPage.context.route('**/*', route => {
    if (route.request().method() !== 'GET' && [new URL(base).host, new URL(env.apiUrl).host].includes(new URL(route.request().url()).host)) throw Error('Presentation fixture attempted a mutation')
    return route.fallback()
  })
  await bankPage.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base })
  await bankPage.page.setViewportSize({ width: 390, height: 844 })
  await bankPage.page.goto(base + '/dashboard/booking?payment=' + privateBill, { waitUntil: 'networkidle' })
  await expect(bankPage.page.getByTestId('payment-transfer-card')).toHaveCount(4, { timeout: 20000 })
  for (const id of ['scb', 'bay', 'bbl', 'ttb']) {
    const identity = bankPage.page.locator('[data-testid="payment-bank-identity"][data-bank-id="' + id + '"]')
    await expect(identity).toBeVisible()
    await expect.poll(() => identity.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true)
  }
  for (const [i, card] of (await bankPage.page.getByTestId('payment-transfer-card').all()).entries()) {
    await card.getByRole('button', { name: /^คัดลอกเลขบัญชี/ }).click()
    assert.equal(await bankPage.page.evaluate(() => navigator.clipboard.readText()), bankAccounts[i].accountNumber.replace(/\D/g, ''))
  }
  check(true, 'Presentation fixture: all four actual bank assets render and every copy action returns digits only')
  await noOverflow(bankPage.page); await snap(bankPage.page, '12-all-banks-presentation-mobile')
  await bankPage.page.setViewportSize({ width: 1280, height: 900 }); await snap(bankPage.page, '13-all-banks-presentation-desktop')
  await bankPage.page.setViewportSize({ width: 320, height: 800 }); await noOverflow(bankPage.page); await snap(bankPage.page, '14-all-banks-presentation-320')
  await bankPage.page.route(url => url.pathname.endsWith('/banks/scb.svg') || url.searchParams.get('url') === '/banks/scb.svg', route => route.abort())
  await bankPage.page.reload({ waitUntil: 'networkidle' })
  const failed = bankPage.page.locator('[data-testid="payment-bank-identity"][data-bank-id="scb"]')
  await expect(failed.locator('img')).toHaveCount(0, { timeout: 15000 })
  await expect(failed.locator('svg')).toBeVisible(); await expect(failed).toContainText('ธนาคารไทยพาณิชย์')
  await snap(bankPage.page, '15-bank-image-error-fallback')
  check(JSON.stringify(state(privateBill)) === JSON.stringify(presentationBefore), 'Presentation fixture and image failure change no persisted bill/coupon/rights data')
  check(errors.length === 0 && egress.length === 0, 'No browser exceptions or network egress outside the physically isolated app/API')
  fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify({ pass: true, checks, actors: actors.map(a => a.id), createdBills, base, target: run.target, binding, presentationFixture: 'Read-only intercepted API/REST data; actual rendered components/assets; no routing/financial assertion inferred', testDefinitionSha256: createHash('sha256').update(fs.readFileSync(import.meta.filename)).digest('hex'), errors, egress }, null, 2))
  console.log(JSON.stringify({ root, passed: checks.length }))
} catch (error) {
  await currentPage?.screenshot({ path: path.join(root, 'failure.png'), fullPage: true }).catch(() => {})
  fs.writeFileSync(path.join(root, 'failure.json'), JSON.stringify({ checks, error: String(error), stack: error.stack, errors, egress, createdBills, body: await currentPage?.locator('body').innerText().catch(() => null) }, null, 2))
  throw error
} finally {
  for (const session of sessions) { await session.context.close(); await session.browser.close() }
}
