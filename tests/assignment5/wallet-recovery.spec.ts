import { test, expect, type Page } from '@playwright/test'
import { account, seed, password, type Account, type Fixture } from '../assignment-roster/fixtures'
import { localSql as sql, sqlLiteral as q } from '../task10-regression/local-supabase'

function futureFixture(owner: Account, days: number) {
  const date = sql(`SELECT ((now() at time zone 'Asia/Bangkok')::date+${days})::text;`)
  const f = seed(owner, [], 1, date)
  sql(`BEGIN;SELECT set_config('task10.payment_write','authorized',true);UPDATE bookings SET month=${Number(date.slice(5,7))},year=${date.slice(0,4)} WHERE id=${q(f.booking)};COMMIT;`)
  return f
}
async function parentLogin(page: Page, owner: Account) {
  await page.goto('/auth/login')
  await page.getByLabel('อีเมล', { exact: true }).fill(owner.email)
  await page.locator('input#password').fill(password)
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
  await expect(page).not.toHaveURL(/auth\/login/)
}
async function openStore(page: Page, f: Fixture) {
  if (Number(f.date.slice(5,7)) !== Number(sql("SELECT to_char(now() at time zone 'Asia/Bangkok','MM');"))) {
    await page.getByRole('button', { name: 'เดือนถัดไป', exact: true }).click()
  }
  await page.getByRole('button', { name: `ดูตารางวันที่ ${f.date}`, exact: true }).click()
  await page.getByRole('button', { name: 'เก็บเข้ากระเป๋า', exact: true }).first().click()
}

test('closing Store during a typed retry stops further foreground writes', async ({ page }) => {
  const owner = await account('user', 'ผู้ปกครองปิดหน้าต่าง'), f = futureFixture(owner, 4)
  await parentLogin(page, owner)
  await page.goto('/dashboard/schedule')
  await openStore(page, f)
  let posts = 0
  await page.route('**/api/lesson-wallet', async route => {
    posts++
    await route.fulfill({ status: 409, json: { code: 'LESSON_SOURCE_RETRY', error: 'temporary local contention' } })
  })
  await page.getByRole('button', { name: 'ยืนยันเก็บเข้ากระเป๋า', exact: true }).click()
  await expect.poll(() => posts).toBe(1)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('alertdialog')).toBeHidden()
  // The normal retry delay is 600 ms; crossing it proves cancellation stops it.
  await page.waitForTimeout(1000)
  expect(posts).toBe(1)
  expect(sql(`SELECT count(*) FROM lesson_wallet_credits WHERE booking_id=${q(f.booking)};`)).toBe('0')
})

test('late confirmation of Store A leaves the open Store B dialog intact', async ({ page }, info) => {
  const owner = await account('user', 'ผู้ปกครองสองรายการ'), a = futureFixture(owner, 4), b = futureFixture(owner, 5)
  sql(`SELECT lesson_source_transition_v1(${q(owner.id)},'store',${q(a.ids[0])},'{}');`)
  await parentLogin(page, owner)
  await page.addInitScript(({ actor, sessionId }) => {
    sessionStorage.setItem(`nasc:pending:v2:${actor}:store:${sessionId}`, JSON.stringify({ sessionId }))
  }, { actor: owner.id, sessionId: a.ids[0] })
  let release!: () => void, arrived!: () => void, posts = 0
  const gate = new Promise<void>(resolve => { release = resolve }), seen = new Promise<void>(resolve => { arrived = resolve })
  await page.route('**/api/lesson-wallet?**', async route => {
    if (new URL(route.request().url()).searchParams.get('sessionId') === a.ids[0]) { arrived(); await gate }
    await route.continue()
  })
  await page.route('**/api/lesson-wallet', async route => { posts++; await route.continue() })
  await page.goto('/dashboard/schedule')
  await seen
  await openStore(page, b)
  release()
  await expect(page.getByText('เก็บเข้ากระเป๋าแล้ว', { exact: true }).last()).toBeVisible()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await expect(page.getByRole('button', { name: 'ยืนยันเก็บเข้ากระเป๋า', exact: true })).toBeEnabled()
  expect(posts).toBe(0)
  expect(sql(`SELECT count(*) FROM lesson_wallet_credits WHERE booking_id=${q(b.booking)};`)).toBe('0')
  await page.screenshot({ path: info.outputPath('pending-a-confirmed-b-open.png'), fullPage: true })
})
