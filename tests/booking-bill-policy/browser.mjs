import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { expect } from '@playwright/test'
import { run, env, sql, q } from './runtime.mjs'
import { fixture, account, browserSession, baseUrl, evidence, bill, hashFile } from './helpers.mjs'

const f = fixture(), checks = [], records = [], dir = path.join(run.outputDir, 'browser-' + Date.now() + '-' + randomUUID())
fs.mkdirSync(dir, { recursive: true })
const app = new URL(baseUrl).port==='63311' ? JSON.parse(fs.readFileSync(path.join(run.evidenceRoot, 'app-runtime.json'), 'utf8')).app : path.join(run.evidenceRoot,'app-development')
assert.ok(path.resolve(app).startsWith(path.resolve(run.evidenceRoot)+path.sep))
const copied = JSON.parse(fs.readFileSync(path.join(app, 'source-manifest.json'), 'utf8'))
assert.equal(copied.runId, run.runId)
for (const [file, hash] of Object.entries(copied.hashes).filter(([file])=>file.startsWith('src/')||file.startsWith('public/')||['package.json','package-lock.json','next.config.mjs','tsconfig.json','postcss.config.mjs','tailwind.config.ts','components.json'].includes(file))) {
  assert.equal(hashFile(file), hash, 'Sync changed Source before browser acceptance: ' + file)
  assert.equal(hashFile(path.join(app, file)), hash, 'Task app differs from copied Source: ' + file)
}
const check = (condition, label) => { assert.ok(condition, label); checks.push(label); console.log(label) }
const day = n => f.dates.month + '-' + String(n).padStart(2, '0')
const sessions = []
async function openCourse(course, mobile = false, existingActor = null) {
  const actor = existingActor || await account('user', 'ตรวจหน้าจอ ' + course)
  if (course === 'kids_group' && !existingActor) sql(`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(randomUUID())},${q(actor.id)},'เด็กตรวจหน้าจอ','น้อง Local')`)
  const b = await browserSession(actor, mobile), errors = [], egress = []
  b.page.on('pageerror', error => errors.push(error.message))
  await b.context.route('**/*', route => {
    const url = new URL(route.request().url())
    if (['data:', 'blob:'].includes(url.protocol) || [new URL(baseUrl).host, new URL(env.apiUrl).host].includes(url.host)) return route.fallback()
    egress.push(url.host); return route.abort()
  })
  sessions.push({ ...b, errors, egress, actor })
  await b.page.goto(baseUrl + '/dashboard/booking', { waitUntil: 'networkidle' })
  const name = course === 'adult_group' ? 'ผู้ใหญ่ (กลุ่ม)' : course === 'kids_group' ? 'เด็ก (กลุ่ม)' : 'Private'
  await b.page.getByRole('button').filter({ has: b.page.getByRole('heading', { name, exact: true }) }).click()
  if (course !== 'kids_group') await b.page.getByTestId('package-' + (course === 'adult_group' ? 'adult' : 'private') + '-1').click()
  await b.page.getByTestId('booking-next').click()
  if (course !== 'adult_group') {
    await b.page.getByRole('button', { name: 'เปลี่ยนผู้เรียน', exact: true }).click()
    const dialog = b.page.getByRole('dialog'); await dialog.getByRole('checkbox').first().check()
    await dialog.getByRole('button', { name: /ใช้ผู้เรียนที่เลือก/ }).click()
  }
  await b.page.getByRole('button', { name: 'เปลี่ยนสาขา', exact: true }).click()
  const dialog = b.page.getByRole('dialog'); await dialog.getByRole('checkbox').first().check()
  await dialog.getByRole('button', { name: /ใช้สาขาที่เลือก/ }).click()
  for (let i = 0; i < 3 && !await b.page.getByTestId('booking-date-' + day(1)).count(); i++) await b.page.getByRole('button', { name: 'เดือนถัดไป', exact: true }).click()
  await expect(b.page.getByTestId('booking-date-' + day(1))).toBeVisible()
  return { ...b, actor, errors, egress }
}
async function pick(page, n, start = '10:00') {
  const slot = page.getByTestId(`booking-slot-${day(n)}-${f.branches[0]}-${start}`)
  if (!await slot.isVisible()) await page.getByTestId('booking-date-' + day(n)).click()
  await expect(slot).toBeEnabled(); await slot.click()
}
try {
  const adult = await openCourse('adult_group', true)
  for (let i = 1; i <= 3; i++) await pick(adult.page, i)
  await expect(adult.page.getByTestId('booking-step4-total')).toHaveText('฿1,800')
  check(await adult.page.getByTestId('booking-calendar').locator('button[aria-pressed="true"]').count() === 3, 'S01 mobile Adult picker retains3selected days and displays1800 before checkout')
  await adult.page.getByTestId(`remove-session-self-${day(3)}-10:00`).click()
  await expect(adult.page.getByTestId('booking-step4-total')).toHaveText('฿1,200')
  await pick(adult.page, 3)
  await expect(adult.page.getByTestId('booking-step4-total')).toHaveText('฿1,800')
  await adult.page.getByTestId('booking-confirm').click()
  await expect(adult.page.getByTestId('payment-net-total')).toHaveText('฿1,800', { timeout: 30000 })
  const adultId = sql(`SELECT id FROM bookings WHERE user_id=${q(adult.actor.id)} ORDER BY created_at DESC LIMIT 1`)
  check(sql(`SELECT count(*) FROM bookings WHERE user_id=${q(adult.actor.id)}`) === '1' && bill(adultId).total_sessions === 3, 'S01 actual mobile selection→confirm creates one bill for3rounds')
  await expect(adult.page.getByTestId('booking-summary-' + adultId)).toContainText('รายครั้ง')
  await adult.page.screenshot({ path: path.join(dir, 'adult-three-single-one-bill.png'), fullPage: true })
  records.push({ actor: adult.actor.id, bill: adultId })

  const rec = await openCourse('adult_group')
  for (let i = 1; i <= 7; i++) await pick(rec.page, i)
  await expect(rec.page.getByTestId('booking-package-recommendation')).toHaveCount(0)
  await pick(rec.page, 8)
  const suggestion = rec.page.getByTestId('booking-package-recommendation')
  await expect(suggestion).toBeVisible(); await expect(suggestion).toContainText('คอร์ส 10 ครั้ง')
  await expect(rec.page.getByTestId('booking-step4-total')).toHaveText('฿4,800')
  check(await rec.page.getByTestId('booking-calendar').locator('button[aria-pressed="true"]').count() === 8, 'R01 at8single rounds recommendation appears while price remains4800')
  await suggestion.getByRole('button', { name: 'เปลี่ยนเป็นคอร์ส 10 ครั้ง', exact: true }).click()
  await expect(rec.page.getByTestId('booking-step4-total')).toHaveText('฿5,500')
  check(await rec.page.getByTestId('booking-calendar').locator('button[aria-pressed="true"]').count() === 8, 'R02 explicit switch to10course preserves all8selected days and requotes5500')
  await rec.page.screenshot({ path: path.join(dir, 'adult-recommendation-explicit-switch.png'), fullPage: true })

  const privateUi = await openCourse('private', true)
  for (let i = 1; i <= 3; i++) await pick(privateUi.page, i)
  await expect(privateUi.page.getByTestId('booking-step4-total')).toHaveText('฿2,700')
  await privateUi.page.getByTestId('booking-confirm').click()
  await expect(privateUi.page.getByTestId('payment-net-total')).toHaveText('฿2,700', { timeout: 30000 })
  const privateId = sql(`SELECT id FROM bookings WHERE user_id=${q(privateUi.actor.id)} ORDER BY created_at DESC LIMIT 1`)
  check(bill(privateId).total_sessions === 3 && bill(privateId).total_price === 2700, 'S02 mobile Private3hours→checkout keeps2700 and3purchased hours')
  await expect(privateUi.page.getByTestId('booking-summary-' + privateId)).toContainText('ภายในเดือน')
  await privateUi.page.screenshot({ path: path.join(dir, 'private-three-single-hours.png'), fullPage: true })
  records.push({ actor: privateUi.actor.id, bill: privateId })

  const kidsFirst = await openCourse('kids_group')
  for (let i = 1; i <= 4; i++) await pick(kidsFirst.page, i)
  await expect(kidsFirst.page.getByTestId('booking-step4-total')).toHaveText('฿2,500')
  await expect(kidsFirst.page.getByTestId('kids-bill-pricing-note')).toContainText('เริ่มนับใหม่ทุกบิล')
  await kidsFirst.page.getByTestId('booking-confirm').click()
  await expect(kidsFirst.page.getByTestId('payment-net-total')).toHaveText('฿2,500', { timeout: 30000 })
  const kidsSecond = await openCourse('kids_group', true, kidsFirst.actor)
  for (let i = 5; i <= 8; i++) await pick(kidsSecond.page, i)
  await expect(kidsSecond.page.getByTestId('booking-step4-total')).toHaveText('฿2,500')
  await kidsSecond.page.getByTestId('booking-confirm').click()
  await expect(kidsSecond.page.getByTestId('payment-net-total')).toHaveText('฿5,000', { timeout: 30000 })
  const kidsBills = JSON.parse(sql(`SELECT jsonb_agg(jsonb_build_object('id',id,'quantity',total_sessions,'price',total_price) ORDER BY created_at) FROM bookings WHERE user_id=${q(kidsFirst.actor.id)}`))
  check(kidsBills.length === 2 && kidsBills.every(b => b.quantity === 4 && b.price === 2500), 'K01 actual Kids4+4 UI creates two2500 bills; payment batching adds to5000 without re-tiering')
  await kidsSecond.page.screenshot({ path: path.join(dir, 'kids-two-bills-four-plus-four.png'), fullPage: true })
  records.push({ actor: kidsFirst.actor.id, bills: kidsBills })
  for (const b of sessions) {
    const overflow = await b.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
    check(!overflow && b.errors.length === 0 && b.egress.length === 0, 'P02 browser has no horizontal overflow/page exceptions/external egress: ' + b.actor.id)
  }
  console.log(JSON.stringify({ passed: checks.length, screenshots: dir, evidence: evidence('browser-pass', { checks, records, screenshots: dir }) }))
} catch (error) {
  for (let i = 0; i < sessions.length; i++) await sessions[i].page.screenshot({ path: path.join(dir, 'failure-' + i + '.png'), fullPage: true }).catch(() => {})
  evidence('browser-failed', { checks, records, error: String(error), pages: sessions.map(b => ({ actor: b.actor.id, url: b.page.url(), errors: b.errors, egress: b.egress })), screenshots: dir })
  throw error
} finally { for (const b of sessions) { await b.context.close(); await b.browser.close() } }

