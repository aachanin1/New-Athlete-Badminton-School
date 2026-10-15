import { test, expect } from '@playwright/test'
import { account, seed, login, snapshot } from '../assignment-roster/fixtures'

test('Save confirms once even when browser session storage is unavailable', async ({ page }) => {
  const parent = await account('user', 'ผู้ปกครองพื้นที่จัดเก็บ'), head = await account('head_coach', 'หัวหน้าพื้นที่จัดเก็บ'), coach = await account('coach', 'โค้ชพื้นที่จัดเก็บ')
  const f = seed(parent, [head, coach])
  await page.addInitScript(() => Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Blocked by browser', 'SecurityError') } }))
  await login(page, head, f)
  await page.getByLabel('ชื่อกลุ่ม', { exact: true }).fill('บันทึกแม้พื้นที่จัดเก็บปิด')
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: `${coach.name} - โค้ช`, exact: true }).click()
  let writes = 0
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/api/coach/assignment-groups') && !request.postDataJSON()?.prepare) writes++
  })
  await page.getByRole('button', { name: 'บันทึก/ยืนยันการมอบหมาย', exact: true }).click()
  await expect(page.getByText('บันทึกกลุ่มแล้ว', { exact: true }).last()).toBeVisible()
  expect(writes).toBe(1)
  expect(snapshot(f)[0].name).toBe('บันทึกแม้พื้นที่จัดเก็บปิด')
})
