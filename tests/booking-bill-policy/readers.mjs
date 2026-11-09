import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { expect } from '@playwright/test'
import { run, env, sql, q } from './runtime.mjs'
import { fixture, account, authCookie, browserSession, baseUrl, request, rpc, read, session, singleInput, create, bill, evidence, hashFile } from './helpers.mjs'

// Primary executes this suite serially: its temporary price changes use the
// authenticated Admin API and are restored in finally, including a failed run.
const f = fixture(), checks = [], records = {}, browsers = []
const output = path.join(run.outputDir, 'readers-' + Date.now() + '-' + randomUUID())
fs.mkdirSync(output, { recursive: true })
const app = new URL(baseUrl).port === '63311' ? JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'app-runtime.json'),'utf8')).app : path.join(run.evidenceRoot,'app-development')
assert.ok(path.resolve(app).startsWith(path.resolve(run.evidenceRoot)+path.sep))
const manifest = JSON.parse(fs.readFileSync(path.join(app, 'source-manifest.json'), 'utf8'))
const artifact = { baseUrl, app, manifestHash: hashFile(path.join(app, 'source-manifest.json')) }
assert.equal(manifest.runId, run.runId)
for (const [file, hash] of Object.entries(manifest.hashes).filter(([file])=>file.startsWith('src/')||file.startsWith('public/')||['package.json','package-lock.json','next.config.mjs','tsconfig.json','postcss.config.mjs','tailwind.config.ts','components.json'].includes(file))) {
  assert.equal(hashFile(file), hash, 'Synchronize reader Source before acceptance: ' + file)
  assert.equal(hashFile(path.join(app, file)), hash, 'Reader app differs from Source: ' + file)
}
const check = (condition, label) => { assert.ok(condition, label); checks.push(label); console.log(label) }
const day = n => f.dates.month + '-' + String(n).padStart(2, '0')
let originalPricing, pricingCookie, pricingDirty = false, pricingRestored = false, failure

async function successful(cookie, route, body, options) {
  const response = await request(cookie, route, body, options)
  assert.equal(response.status, 200, route + ': ' + JSON.stringify(response.result))
  return response.result
}
async function browser(actor, mobile = false) {
  const b = await browserSession(actor, mobile), errors = []
  b.page.on('pageerror', error => errors.push(error.message))
  await b.context.route('**/*', route => {
    const url = new URL(route.request().url())
    if (['data:', 'blob:'].includes(url.protocol) || [new URL(baseUrl).host, new URL(env.apiUrl).host].includes(url.host)) return route.fallback()
    return route.abort()
  })
  const owned = { ...b, actor, errors }; browsers.push(owned); return owned
}
async function chooseAdult(actor) {
  const b = await browser(actor)
  await b.page.goto(baseUrl + '/dashboard/booking', { waitUntil: 'networkidle' })
  const course = b.page.getByRole('button').filter({ has: b.page.getByRole('heading', { name: 'ผู้ใหญ่ (กลุ่ม)', exact: true }) })
  await course.click(); await expect(course).toHaveAttribute('aria-pressed', 'true')
  await b.page.getByTestId('package-adult-1').click()
  await expect(b.page.getByTestId('package-adult-1')).toHaveAttribute('aria-pressed', 'true')
  await b.page.getByTestId('booking-next').click()
  await b.page.getByRole('button', { name: 'เปลี่ยนสาขา', exact: true }).click()
  const dialog = b.page.getByRole('dialog'); await dialog.getByRole('checkbox').first().check()
  await dialog.getByRole('button', { name: /ใช้สาขาที่เลือก/ }).click()
  for (let i = 0; i < 3 && !await b.page.getByTestId('booking-date-' + day(1)).count(); i++) await b.page.getByRole('button', { name: 'เดือนถัดไป', exact: true }).click()
  await expect(b.page.getByTestId('booking-date-' + day(1))).toBeVisible()
  return b
}
async function pick(page, date, start = '10:00') {
  const slot = page.getByTestId(`booking-slot-${date}-${f.branches[0]}-${start}`)
  if (!await slot.isVisible()) await page.getByTestId('booking-date-' + date).click()
  await expect(slot).toBeEnabled(); await slot.click()
}
const tierInput = row => ({ id: row.id, min_sessions: row.min_sessions, max_sessions: row.max_sessions, price_per_session: Number(row.price_per_session) })
async function pricing() { return (await successful(pricingCookie, '/api/admin/pricing')).data }
async function patchPricing(expected, tiers) {
  // A lost response may follow a committed save, so restoration is required
  // from the first attempted write rather than only after HTTP success.
  pricingDirty = true
  const result = await successful(pricingCookie, '/api/admin/pricing', { expected, tiers }, { method: 'PATCH' })
  return result.data
}
async function assertPublicPrices(page, label) {
  const packages = rpc('booking_ux_catalog_v1', '')
  const kids = read("SELECT v.tiers FROM task10_pricing_catalog_heads h JOIN task10_pricing_catalog_versions v ON v.id=h.version_id WHERE h.regime='early'")
  await page.goto(baseUrl + '/', { waitUntil: 'networkidle' })
  const kidsRows = page.getByTestId('public-kids-prices')
  await expect(kidsRows).toContainText('เริ่มเรทใหม่ทุกบิล')
  for (const tier of kids) {
    const range = tier.minSessions === tier.maxSessions ? String(tier.minSessions) : tier.maxSessions === null ? tier.minSessions + '+' : tier.minSessions + '–' + tier.maxSessions
    const row = kidsRows.locator('div').filter({ has: page.locator('span').filter({ hasText: new RegExp('^' + range.replace(/[+]/g, '\\+') + ' ครั้งในบิล$') }) })
    await expect(row).toContainText(Number(tier.ratePerSession).toLocaleString() + ' บาท/ครั้ง')
  }
  for (const course of ['adult_group', 'private']) {
    const rows = page.getByTestId('public-' + course + '-prices')
    for (const pack of packages.filter(p => p.course === course)) {
      const title = pack.quantity === 1 ? course === 'private' ? 'รายชั่วโมง' : 'รายครั้ง' : pack.quantity + (course === 'private' ? ' ชั่วโมง' : ' ครั้ง')
      const row = rows.locator('div').filter({ has: page.getByText(title, { exact: true }) })
      await expect(row).toContainText(Number(pack.price).toLocaleString() + ' บาท')
    }
    await expect(rows).toContainText('ใช้ได้ภายในเดือนเรียนเดิม')
  }
  check(true, label + ': all public Kids ranges and Adult/Private package rows equal current DB catalogs')
}
async function assertAdminPrices(page, snapshot, label) {
  for (const route of ['/admin/settings/pricing', '/admin/settings?section=pricing']) {
    await page.goto(baseUrl + route, { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: 'ตั้งค่าราคาค่าเรียน', exact: true })).toBeVisible()
    for (const row of snapshot.tiers) {
      const block = page.getByTestId('pricing-tier-' + row.id)
      await expect(block.getByRole('spinbutton', { name: row.course_type_name + ' ' + row.id + ' ราคา', exact: true })).toHaveValue(String(Number(row.price_per_session)))
      await expect(block.getByRole('spinbutton')).toHaveCount(1)
    }
    await expect(page.getByText(/บิลใหม่เริ่มนับเรทจากจำนวนครั้งในบิลนั้น รวมพี่น้องเฉพาะบิลเดียวกัน/).first()).toBeVisible()
  }
  check(true, label + ': both Admin pricing URLs load identical current prices, purchase options and per-bill Kids wording')
}

try {
  // Two separate single bills from consecutive lesson months share one payment
  // set. The editor must offer both months without moving either bill's month.
  const bulkActor = await account('user', 'ตรวจแก้รวมข้ามเดือน'), dec = create(bulkActor, singleInput(f, bulkActor, 'adult_group', [session(f, 'adult_group', day(1))])), janDate = f.dates.nextMonth + '-01'
  const jan = create(bulkActor, singleInput(f, bulkActor, 'adult_group', [session(f, 'adult_group', janDate)]))
  const bulk = await browser(bulkActor, true)
  await bulk.page.goto(baseUrl + '/dashboard/payments?legacy=' + [dec.bookingId, jan.bookingId].join(','), { waitUntil: 'networkidle' })
  await expect(bulk.page.getByTestId('payment-net-total')).toHaveText('฿1,200')
  await bulk.page.getByRole('button', { name: /แก้ไขวันเรียน/ }).click()
  const editor = bulk.page.getByTestId('booking-stage2-editor'); await expect(editor).toBeVisible()
  if (!await editor.getByTestId('booking-date-' + day(1)).count()) {
    await expect(editor.getByRole('button', { name: 'เดือนก่อนหน้า', exact: true })).toBeEnabled()
    await editor.getByRole('button', { name: 'เดือนก่อนหน้า', exact: true }).click()
  }
  await expect(editor.getByTestId('booking-date-' + day(1))).toHaveAttribute('aria-pressed', 'true')
  await expect(editor.getByRole('button', { name: 'เดือนถัดไป', exact: true })).toBeEnabled()
  await editor.getByRole('button', { name: 'เดือนถัดไป', exact: true }).click()
  await expect(editor.getByTestId('booking-date-' + janDate)).toHaveAttribute('aria-pressed', 'true')
  await pick(bulk.page, f.dates.nextMonth + '-02')
  await expect(bulk.page.getByTestId('booking-edit-total')).toHaveText('฿1,800', { timeout: 25000 })
  await bulk.page.getByTestId('booking-edit-save').click()
  await expect(bulk.page.getByTestId('payment-net-total')).toHaveText('฿1,800', { timeout: 25000 })
  const decBill = bill(dec.bookingId), janBill = bill(jan.bookingId)
  check(decBill.total_sessions === 1 && decBill.total_price === 600 && decBill.month === +f.dates.month.slice(5) && janBill.total_sessions === 2 && janBill.total_price === 1200 && janBill.month === +f.dates.nextMonth.slice(5), 'Actual bulk editor navigates Dec/Jan union and saves only the January single bill to2rounds/1200')
  await bulk.page.screenshot({ path: path.join(output, 'bulk-two-month-editor-saved.png'), fullPage: true })
  records.bulk = { actor: bulkActor.id, december: dec.bookingId, january: jan.bookingId }

  // A paid Family bill from the actual HTTP acceptance run contains three
  // hours with three participants; the first hour has been stored atomically.
  const prior = fs.readdirSync(run.outputDir).filter(name => /^http-pass-.*\.json$/.test(name)).sort((a, b) => fs.statSync(path.join(run.outputDir, b)).mtimeMs - fs.statSync(path.join(run.outputDir, a)).mtimeMs).map(name => JSON.parse(fs.readFileSync(path.join(run.outputDir, name), 'utf8'))).find(value => value.records?.familyActor?.email && value.records?.family)
  assert.ok(prior, 'A passing real HTTP Family receipt fixture is required')
  const familyId = prior.records.family, familyBill = bill(familyId), familyActor = prior.records.familyActor
  assert.equal(familyBill.total_sessions, 3); assert.equal(familyBill.total_price, 2700); assert.equal(familyBill.status, 'verified')
  const activeHours = Number(sql(`SELECT count(DISTINCT(date,start_time,end_time,branch_id)) FROM booking_sessions WHERE booking_id=${q(familyId)} AND status IN ('scheduled','completed','absent') AND cancelled_at IS NULL`))
  const walletHours = Number(sql(`SELECT count(DISTINCT(date,start_time,end_time,branch_id)) FROM booking_sessions WHERE booking_id=${q(familyId)} AND status='walleted' AND cancelled_at IS NULL`))
  const history = await browser(familyActor, true)
  await history.page.goto(baseUrl + '/dashboard/history?orders=' + familyId, { waitUntil: 'networkidle' })
  const card = history.page.getByTestId('history-booking-' + familyId)
  await expect(card).toContainText('3 ชั่วโมง'); await expect(card).toContainText('฿2,700')
  await card.getByRole('button', { name: 'ดูรายละเอียด', exact: true }).click()
  const detail = history.page.getByRole('dialog')
  await expect(detail).toContainText('จำนวนที่ชำระ: 3 ชั่วโมง')
  await expect(detail).toContainText(`รอบเรียนที่ยังใช้งานได้: ${activeHours}/3 ชั่วโมง`)
  if (walletHours) await expect(detail).toContainText(`อยู่ในกระเป๋า รอเลือกวันใหม่: ${walletHours} ชั่วโมง`)
  await expect(detail).not.toContainText('9/3')
  check(true, 'Family history card/detail use exact atomic-hour totals rather than participant-row totals')
  await history.page.screenshot({ path: path.join(output, 'family-three-hour-history.png'), fullPage: true })
  const admin = await browser(f.actors.sa)
  await admin.page.goto(baseUrl + '/admin/payments?month=' + f.dates.month, { waitUntil: 'networkidle' })
  await admin.page.getByPlaceholder('ค้นหาชื่อ, อีเมล, สาขา, payment id, booking id...').fill(familyId)
  const row = admin.page.getByRole('button', { name: 'รายละเอียด', exact: true }).first().locator('xpath=../..')
  await expect(row).toContainText('3 ชั่วโมง'); await expect(row).toContainText('฿2,700')
  check(true, 'Admin Payments exact Family bill search displays3hours and2700 once')
  await admin.page.screenshot({ path: path.join(output, 'admin-family-three-hour-payment.png'), fullPage: true })
  records.family = { id: familyId, activeHours, walletHours, httpEvidence: prior.at }

  pricingCookie = await authCookie(f.actors.sa); originalPricing = await pricing()
  assert.equal(Number(originalPricing.tiers.find(r => r.course_type_name === 'adult_group' && r.min_sessions === 1).price_per_session), 600)
  const publicReader = await browser(f.actors.other)
  await assertPublicPrices(publicReader.page, 'Baseline')
  await assertAdminPrices(admin.page, originalPricing, 'Baseline')

  const comparisonActor = await account('user', 'ตรวจเปรียบเทียบราคาค้าง'), comparison = await chooseAdult(comparisonActor)
  for (let n = 1; n <= 8; n++) await pick(comparison.page, day(n))
  const suggestion = comparison.page.getByTestId('booking-package-recommendation')
  await expect(comparison.page.getByTestId('booking-step4-total')).toHaveText('฿4,800')
  await expect(suggestion).toContainText('฿5,500'); await expect(suggestion).toContainText('เพิ่มอีก ฿700')
  await comparison.page.screenshot({ path: path.join(output, 'comparison-before-price-change.png'), fullPage: true })
  const newPricing = await patchPricing(originalPricing, originalPricing.tiers.map(row => ({ ...tierInput(row), price_per_session: row.course_type_name === 'adult_group' && row.min_sessions === 1 ? 700 : row.course_type_name === 'adult_group' && row.min_sessions === 10 ? 560 : Number(row.price_per_session) })))
  await comparison.page.getByTestId(`remove-session-self-${day(8)}-10:00`).click()
  await expect(comparison.page.getByTestId('booking-step4-total')).toHaveText('฿4,900')
  await pick(comparison.page, day(8))
  await expect(comparison.page.getByTestId('booking-step4-total')).toHaveText('฿5,600')
  await expect(suggestion).toContainText('รายครั้งที่เลือก 8 ครั้ง · ฿5,600')
  await expect(suggestion).toContainText('คอร์ส 10 ครั้ง · ฿5,600'); await expect(suggestion).toContainText('ราคาเท่ากัน')
  await expect(suggestion).not.toContainText('4,800'); await expect(suggestion).not.toContainText('เพิ่มอีก ฿700')
  check(true, 'An existing booking tab requotes singles700 and course5600 after Admin save; recommendation compares current5600/5600')
  await comparison.page.screenshot({ path: path.join(output, 'comparison-after-price-change.png'), fullPage: true })
  await assertPublicPrices(publicReader.page, 'Changed prices')
  await assertAdminPrices(admin.page, newPricing, 'Changed prices')

  const rangePricing = await patchPricing(await pricing(), (await pricing()).tiers.map(row => ({ ...tierInput(row), min_sessions: row.course_type_name === 'adult_group' && row.min_sessions === 10 ? 8 : row.min_sessions })))
  const packageCatalog = rpc('booking_ux_catalog_v1', ''), adult10 = packageCatalog.find(pack => pack.id === 'adult-10'), rangeActor = await account('user', 'ตรวจช่วงเรทคอร์ส')
  const rangeQuote = rpc('booking_bill_package_quote_v2', `${q(rangeActor.id)},${q(f.courses.adult_group)},10,'adult-10',${adult10.revision},NULL`)
  const rangeBill = create(rangeActor, { purchasePolicyVersion: 2, packageId: adult10.id, packageRevision: adult10.revision, participants: [null], learnerType: 'self', childId: null, branchId: f.branches[0], courseTypeId: f.courses.adult_group, month: +f.dates.month.slice(5), year: +f.dates.month.slice(0, 4), totalSessions: 10, totalAmount: adult10.price, expectedTotalPrice: adult10.price, sessions: [] })
  check(rangePricing.tiers.some(row => row.course_type_name === 'adult_group' && row.min_sessions === 8 && row.max_sessions === 10) && rangeQuote.grossPrice === adult10.price && bill(rangeBill.bookingId).total_sessions === 10 && bill(rangeBill.bookingId).total_price === adult10.price, 'Admin range10→8–10 still quotes/creates the explicit10course using the greatest eligible threshold and current catalog amount')
  records.priceChange = { comparisonActor: comparisonActor.id, oldSingle: 600, newSingle: 700, comparedCourse: 5600, rangePackage: rangeBill.bookingId, rangePackagePrice: adult10.price }
} catch (error) { failure = error }
finally {
  if (pricingDirty && originalPricing && pricingCookie) {
    try {
      const current = await pricing(), originals = new Map(originalPricing.tiers.map(row => [row.id, row]))
      await patchPricing(current, current.tiers.map(row => { assert.ok(originals.has(row.id), 'Unexpected pricing row; refuse guessed restore'); return tierInput(originals.get(row.id)) }))
      const restored = await pricing()
      const normalize = snapshot => snapshot.tiers.map(row => ({ id: row.id, min: row.min_sessions, max: row.max_sessions, unit: Number(row.price_per_session), package: Number(row.package_price) })).sort((a, b) => a.id.localeCompare(b.id))
      assert.deepEqual(normalize(restored), normalize(originalPricing)); pricingRestored = true
      check(true, 'All temporary Admin pricing/range changes restored through the authenticated atomic API')
    } catch (error) { failure = failure ? new AggregateError([failure, error], 'Reader acceptance failed and pricing restoration also failed') : error }
  }
  if (failure) for (let i = 0; i < browsers.length; i++) await browsers[i].page.screenshot({ path: path.join(output, 'failure-' + i + '.png'), fullPage: true }).catch(() => {})
  for (const b of browsers) { await b.context.close(); await b.browser.close() }
}
const readerSourceHashes = Object.fromEntries(['tests/booking-bill-policy/readers.mjs','src/components/shared/public-pricing-rows.tsx','src/lib/public-booking-prices.ts','src/components/dashboard/history-client.tsx','src/components/admin/payments-client.tsx','src/components/admin/pricing-settings-client.tsx'].map(file => [file, hashFile(file)]))
if (failure) { evidence('readers-failed', { checks, artifact, records, error: String(failure), pricingRestored, screenshots: output, readerSourceHashes }); throw failure }
console.log(JSON.stringify({ passed: checks.length, evidence: evidence('readers-pass', { checks, artifact, records, pricingRestored, screenshots: output, readerSourceHashes }) }))

