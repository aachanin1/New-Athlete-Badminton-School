import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'
import { names } from './mock.mjs'

const base = process.env.PUBLIC_BRANCH_BASE || 'http://127.0.0.1:63511'
const local = new URL(base).hostname === '127.0.0.1'
const out = path.resolve(process.env.PUBLIC_BRANCH_OUTPUT || `.playwright/public-branches-1/check-${Date.now()}`)
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const errors = [], blocked = [], checks = []
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
await context.route('**/*', route => {
  const url = new URL(route.request().url())
  if (url.origin === new URL(base).origin || (local && url.origin === 'http://127.0.0.1:63501')) return route.continue()
  blocked.push(url.origin)
  return route.abort()
})
const page = await context.newPage()
page.on('pageerror', error => errors.push(error.message))
async function inspect(expected, label) {
  const response = await page.goto(base, { waitUntil: 'networkidle' })
  assert.equal(response.status(), 200)
  const section = page.locator('#branches')
  assert.deepEqual((await section.locator('span.font-medium').allTextContents()).sort(), [...expected].sort())
  const title = `${expected.length} สาขาในกรุงเทพฯ และปริมณฑล`
  if (expected.length) {
    assert.equal(await section.locator('h2').innerText(), title)
    assert.ok((await page.locator('#hero').innerText()).includes(title))
    await assertNoOverflow()
  } else {
    assert.equal(await section.locator('h2').innerText(), 'สาขาในกรุงเทพฯ และปริมณฑล')
    assert.equal(await section.getByRole('link', { name: 'ติดต่อสอบถาม' }).count(), 1)
  }
  assert.equal(await section.getByText('QA inactive branch', { exact: true }).count(), 0)
  assert.doesNotMatch(await page.locator('body').innerText(), /7 สาขาทั่วกรุงเทพ|0 สาขา/)
  assert.equal(await page.locator('meta[name="description"]').getAttribute('content'), 'โรงเรียนสอนแบดมินตัน New Athlete School — สอนแบดมินตันสำหรับเด็กและผู้ใหญ่ หลายสาขาในกรุงเทพฯ และปริมณฑล')
  await section.screenshot({ path: path.join(out, `${label}.png`) })
  checks.push({ id: label, names: expected, heading: await section.locator('h2').innerText() })
}
async function assertNoOverflow() {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow')
  for (const box of await page.locator('#branches span.font-medium').evaluateAll(elements => elements.map(e => { const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, width: innerWidth } }))) {
    assert.ok(box.left >= 0 && box.right <= box.width, 'Branch label outside viewport')
  }
}
async function fixture(mode) {
  assert.ok(local, 'Fixture writes are prohibited outside isolated localhost')
  const response = await fetch('http://127.0.0.1:63501/fixture', { method: 'POST', body: JSON.stringify({ mode }) })
  assert.ok(response.ok)
}
try {
  if (local) await fixture('twelve')
  await inspect(names, 'twelve-mobile')
  for (const width of [320, 591, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await assertNoOverflow()
    await page.locator('#branches').screenshot({ path: path.join(out, `width-${width}.png`) })
    checks.push({ id: `width-${width}`, noOverflow: true })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  // Public entry points remain usable without creating an account or booking.
  await page.locator('#hero').getByRole('button', { name: /เข้าใช้งาน|สมัครเรียน|สมัครสมาชิก/ }).click()
  await page.getByRole('dialog').waitFor()
  assert.ok(await page.getByRole('dialog').locator('input').count() > 0)
  await page.keyboard.press('Escape')
  checks.push({ id: 'auth-dialog', opened: true })
  const pricing = await page.locator('#pricing').innerText()
  assert.ok(pricing.includes(local ? 'ตรวจราคาล่าสุดในหน้าจองก่อนยืนยันรายการ' : '900'))
  assert.equal(await page.locator('#hero a[href="/ranking"]').count(), 1)
  checks.push({ id: 'pricing-ranking', retained: true })
  if (local) {
    await fixture('eleven'); await inspect(names.slice(0, 11), 'deactivated-on-next-request')
    await fixture('failure'); await inspect([], 'read-failure')
    await fixture('empty'); await inspect([], 'empty')
    await fixture('recovery'); await inspect(names, 'recovered-without-rebuild')
    const requests = await (await fetch('http://127.0.0.1:63501/requests')).json()
    assert.ok(requests.length >= 5)
    for (const request of requests) {
      assert.equal(request.method, 'GET'); assert.equal(request.query.select, 'id,name'); assert.equal(request.query.is_active, 'eq.true')
    }
    fs.writeFileSync(path.join(out, 'reference-requests.json'), JSON.stringify(requests, null, 2))
    checks.push({ id: 'minimal-read-active-only', requests: requests.length })
  }
  assert.deepEqual(errors, [])
  assert.deepEqual(blocked, [])
  const result = { at: new Date().toISOString(), base, local, checks, errors, blocked, writes: local ? 'isolated in-memory fixture only' : false }
  fs.writeFileSync(path.join(out, 'pass.json'), JSON.stringify(result, null, 2), { flag: 'wx' })
  console.log(JSON.stringify({ passed: true, checks: checks.length, out }))
} catch (error) {
  fs.writeFileSync(path.join(out, 'failed.json'), JSON.stringify({ at: new Date().toISOString(), error: error.stack, checks, errors, blocked }, null, 2), { flag: 'wx' })
  throw error
} finally {
  await browser.close()
}
