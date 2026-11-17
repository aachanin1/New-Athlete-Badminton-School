import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { chromium, expect } from '@playwright/test'

const base = process.env.SCHEDULE_PEOPLE_BASE || 'http://127.0.0.1:63611'
assert.equal(new URL(base).hostname, '127.0.0.1', 'component fixture must stay on loopback')
const output = path.resolve('.playwright/admin-schedule-people-count-1', `browser-${Date.now()}`)
fs.mkdirSync(output, { recursive: true })
const checks = [], errors = [], external = [], requests = []
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Bangkok', locale: 'th-TH', reducedMotion: 'reduce' })
await context.route('**/*', route => {
  if (new URL(route.request().url()).origin === base) return route.continue()
  external.push(route.request().url()); return route.abort()
})
const page = await context.newPage()
page.on('pageerror', e => errors.push(e.message))
page.on('response', res => { if (res.url().includes('/api/admin/schedules/')) requests.push({ url: res.url(), status: res.status() }) })
const day = date => page.getByTestId('admin-schedule-calendar-day-' + date)
async function expectCounts(date, learners, coaches, wallets) {
  await expect(day(date).getByTestId('calendar-learner-count')).toHaveText(String(learners))
  await expect(day(date).getByText(`โค้ช ${coaches} คน`, { exact: true })).toBeVisible()
  await expect(day(date).getByTestId('calendar-learner-dot')).toHaveCount(Math.min(learners, 10))
  if (wallets) await expect(day(date).getByTestId('calendar-wallet-count')).toHaveText(String(wallets))
  assert.doesNotMatch(await day(date).innerText(), /รอบ/)
}
async function expectTotals(learners, coaches, sessions) {
  const totals = page.getByTestId('admin-schedule-totals')
  await expect(totals.getByText('โค้ช', { exact: true }).locator('..').locator('p').last()).toHaveText(String(coaches))
  await expect(totals.getByText('ผู้เรียนในตาราง', { exact: true }).locator('..').locator('p').last()).toHaveText(String(learners))
  await expect(totals.getByText('รายการเรียนในตาราง', { exact: true }).locator('..').locator('p').last()).toHaveText(String(sessions))
}
async function noOverflow(label) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ' horizontal overflow')
  const boxes = await day('2026-11-16').locator('p').evaluateAll(nodes => nodes.map(n => ({ width: n.clientWidth, scroll: n.scrollWidth })))
  assert.ok(boxes.every(b => b.scroll <= b.width), label + ' calendar label overflow')
}
try {
  const response = await page.goto(base, { waitUntil: 'networkidle', timeout: 120000 })
  assert.equal(response.status(), 200)
  await expectTotals(4, 3, 4)
  await expectCounts('2026-11-16', 2, 1, 2)
  await expectCounts('2026-11-17', 0, 0, 1)
  await expect(page.getByTestId('admin-schedule-day-summary-2026-11-16')).toContainText('ผู้เรียน 2 คน')
  await expect(page.getByTestId('admin-schedule-day-summary-2026-11-16')).toContainText('โค้ช 1 คน')
  checks.push('month cards, day summaries, calendar numbers and dots exclude Wallet; duplicate coach counted once')
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await noOverflow('width ' + width)
    await page.screenshot({ path: path.join(output, `month-${width}.png`), fullPage: true })
  }
  checks.push('320/390/768/1440 layouts and calendar labels fit')
  await expect(page.getByTestId('admin-schedule-course-legend')).toContainText('เด็กกลุ่ม')
  await expect(page.getByTestId('admin-schedule-course-legend')).toContainText('ผู้ใหญ่กลุ่ม')
  await expect(page.getByTestId('admin-schedule-course-legend')).toContainText('Private')
  const palettes = [
    { date: '2026-11-16', group: 'group-a', course: 'kids', background: 'rgb(239, 246, 255)', border: 'rgb(59, 130, 246)', slot: 'slot-a' },
    { date: '2026-11-18', group: 'private-group', course: 'private', background: 'rgb(255, 247, 237)', border: 'rgb(249, 115, 22)', slot: 'slot-private' },
    { date: '2026-11-19', group: 'adult-group', course: 'adult', background: 'rgb(236, 253, 245)', border: 'rgb(16, 185, 129)', slot: 'slot-adult' },
  ]
  for (const palette of palettes) {
    await day(palette.date).click()
    const group = page.getByTestId('admin-schedule-group-' + palette.group)
    await expect(group).toBeVisible()
    await expect(group).toHaveCSS('background-color', palette.background)
    const round = page.getByTestId('admin-schedule-round-slot:' + palette.slot)
    await expect(round).toHaveCSS('border-left-color', palette.border)
    await round.screenshot({ path: path.join(output, `course-${palette.course}-desktop.png`) })
    if (palette.course === 'kids') {
      await expect(page.getByTestId('admin-schedule-wallet')).toHaveCSS('background-color', 'rgba(245, 243, 255, 0.5)')
      await expect(page.getByTestId('admin-schedule-wallet').getByText('อยู่ในกระเป๋า 2 รายการ', { exact: true })).toHaveCSS('color', 'rgb(91, 33, 182)')
    }
    await page.getByRole('button', { name: 'กลับภาพรวมเดือน', exact: true }).click()
  }
  checks.push('course group backgrounds and round accents match blue/green/orange legend; Wallet stays violet')
  await page.setViewportSize({ width: 390, height: 844 })
  await day('2026-11-16').click()
  await expect(page.getByTestId('admin-schedule-detail-people')).toHaveText('ผู้เรียน 2 คน • โค้ช 1 คน')
  await expect(page.getByText('active-a', { exact: true })).toBeVisible()
  await expect(page.getByText('wallet-a', { exact: true })).toBeVisible()
  await expect(page.getByText('wallet-b', { exact: true })).toBeVisible()
  await expect(page.getByText('ผู้เรียน 1 คน', { exact: true })).toHaveCount(2)
  await expect(page.getByText('ผู้เรียนมีโค้ชแล้ว 1 คน', { exact: true })).toHaveCount(2)
  await page.screenshot({ path: path.join(output, 'day-390.png'), fullPage: true })
  checks.push('selected day uses actual model response; round totals exclude Wallet, Wallet roster retained')
  await day('2026-11-17').click()
  await expect(page.getByText('wallet-a', { exact: true })).toBeVisible()
  await expect(page.getByTestId('admin-schedule-detail-people')).toHaveText('ผู้เรียน 0 คน • โค้ช 0 คน')
  await expect(page.getByText('ผู้เรียน 0 คน', { exact: true })).toBeVisible()
  checks.push('Wallet-only day still opens with zero active people and zero coaches')
  await page.getByRole('button', { name: 'กลับภาพรวมเดือน', exact: true }).click()
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: 'สาขาที่สอง', exact: true }).click()
  await expectTotals(2, 2, 2)
  await expectCounts('2026-11-18', 1, 1, 0)
  await page.getByRole('combobox').nth(1).click()
  await page.getByRole('option', { name: 'เด็กกลุ่ม', exact: true }).click()
  await expectTotals(0, 0, 0)
  checks.push('combined branch/course filters recompute all counts without leaking other assignments')
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: 'ทุกสาขา', exact: true }).click()
  await page.getByRole('combobox').nth(1).click()
  await page.getByRole('option', { name: 'ทุกคอร์ส', exact: true }).click()
  await page.getByPlaceholder('ค้นหาผู้เรียน ผู้ปกครอง โค้ช สาขา...').fill('wallet-a')
  await expectTotals(1, 1, 1)
  await expectCounts('2026-11-16', 1, 1, 2)
  await day('2026-11-16').click()
  await expect(page.getByTestId('admin-schedule-detail-people')).toHaveText('ผู้เรียน 1 คน • โค้ช 1 คน')
  await expect(page.getByText('wallet-a', { exact: true })).toBeVisible()
  await expect(page.getByText('active-b', { exact: true })).toHaveCount(0)
  checks.push('Wallet name search finds its round and consistently counts its full active roster')
  await page.getByPlaceholder('ค้นหาผู้เรียน ผู้ปกครอง โค้ช สาขา...').fill('ไม่มีข้อมูลนี้')
  await expectTotals(0, 0, 0)
  checks.push('no-match search returns zero counts')
  assert.equal(errors.length, 0, JSON.stringify(errors))
  assert.equal(external.length, 0, 'external requests blocked: ' + JSON.stringify(external))
  assert.ok(requests.some(r => r.url.includes('/day?') && r.status === 200))
  assert.ok(requests.some(r => r.url.includes('/search?') && r.status === 200))
  checks.push('no browser errors or external requests; day/search HTTP endpoints exercised')
  fs.writeFileSync(path.join(output, 'pass.json'), JSON.stringify({ checks, errors, external, requests, testSha256: createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'), fixture: 'synthetic component harness, not production auth/database acceptance' }, null, 2))
  console.log(JSON.stringify({ passed: checks.length, output }))
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true })
  fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ error: String(error), checks, errors, external, requests }, null, 2))
  throw error
} finally { await context.close(); await browser.close() }
