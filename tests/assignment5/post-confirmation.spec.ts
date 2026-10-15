import { test, expect } from '@playwright/test'
import { account, seed, login, payload, snapshot } from '../assignment-roster/fixtures'
import { localSql as sql, sqlLiteral as q } from '../task10-regression/local-supabase'

test('post-confirmation reads preserve newer draft and require review when another editor saves', async ({ page }) => {
  const parent = await account('user', 'ผู้ปกครองหลังยืนยัน'), head = await account('head_coach', 'หัวหน้าหลังยืนยัน'), coach = await account('coach', 'โค้ชหลังยืนยัน'), f = seed(parent, [head, coach])
  await login(page, head, f)
  await page.getByLabel('ชื่อกลุ่ม', { exact: true }).fill('บันทึกครั้งแรก')
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: `${coach.name} - โค้ช`, exact: true }).click()
  let writes = 0
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/coach/assignment-groups') && !request.postDataJSON()?.prepare) writes++ })
  await page.getByRole('button', { name: 'บันทึก/ยืนยันการมอบหมาย', exact: true }).click()
  await expect(page.getByText('บันทึกกลุ่มแล้ว', { exact: true }).last()).toBeVisible()
  await page.getByLabel('ชื่อกลุ่ม', { exact: true }).fill('ร่างที่กำลังแก้ต่อ')
  sql(`SELECT save_coach_assignment_groups_v2(${q(f.slot)},${q(head.id)},${q(JSON.stringify([{...payload(f,coach)[0],name:'งานหัวหน้าอีกคน'}]))});`)
  await expect(page.getByRole('button', { name: 'ใช้รายชื่อปัจจุบัน', exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByLabel('ชื่อกลุ่ม', { exact: true })).toHaveValue('ร่างที่กำลังแก้ต่อ')
  expect(snapshot(f)[0].name).toBe('งานหัวหน้าอีกคน')
  expect(writes).toBe(1)
})
