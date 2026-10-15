import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { account, seed, login, snapshot } from '../assignment-roster/fixtures'
import { localSql as sql, sqlLiteral as q } from '../task10-regression/local-supabase'

for (const cancel of [false, true]) test(`prior pending preflight is single flight and ${cancel ? 'navigation aborts without a later write' : 'double click creates one new intent'}`, async ({ page }) => {
  const parent = await account('user', 'ผู้ปกครองรายการค้าง'), head = await account('head_coach', 'หัวหน้ารายการค้าง'), coach = await account('coach', 'โค้ชรายการค้าง'), f = seed(parent, [head, coach])
  await login(page, head, f)
  await page.getByLabel('ชื่อกลุ่ม', { exact: true }).fill('ร่างหลังตรวจคำขอ')
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: `${coach.name} - โค้ช`, exact: true }).click()
  const oldRequest = randomUUID(), context = await (await page.request.get(`/api/coach/assignment-groups?scheduleSlotId=${f.slot}&branchId=${f.branch}`)).json()
  await page.evaluate(({ actor, f, oldRequest, context, coach }) => {
    sessionStorage.setItem(`nasc:pending:v2:${actor}:save:${f.slot}`, JSON.stringify({ slotKey:f.slot,scheduleSlotId:f.slot,branchId:f.branch,requestId:oldRequest,
      draft:[{localId:'pending-draft',name:'ร่างหลังตรวจคำขอ',coachId:coach,levelMin:0,levelMax:0,sortOrder:0,studentSessionIds:f.ids}],baseline:[],baselineDraft:[],context:context.saveContext,serverSignatureAtSave:'[]',persistedSignatureAtSave:'[]' }))
  }, { actor:head.id,f,oldRequest,context,coach:coach.id })
  let release!: () => void, arrived!: () => void, preflights = 0, writes = 0, prepares = 0
  const ids = new Set<string>(), gate = new Promise<void>(resolve => { release = resolve }), seen = new Promise<void>(resolve => { arrived = resolve })
  await page.route('**/api/coach/assignment-groups?**', async route => {
    if (new URL(route.request().url()).searchParams.get('requestId') === oldRequest) { preflights++; arrived(); await gate }
    try { await route.continue() } catch { /* Navigation may have aborted the captured read. */ }
  })
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/api/coach/assignment-groups')) {
      const body = request.postDataJSON(); ids.add(body.requestId)
      if (body.prepare) prepares++; else writes++
    }
  })
  await page.getByRole('button', { name: 'บันทึก/ยืนยันการมอบหมาย', exact: true }).evaluate(element => { (element as HTMLButtonElement).click(); (element as HTMLButtonElement).click() })
  await seen
  await expect(page.getByLabel('ชื่อกลุ่ม', { exact: true })).toBeDisabled()
  expect(writes).toBe(0); expect(prepares).toBe(0)
  if (cancel) { await page.getByRole('link', { name:'หน้าหลัก',exact:true }).click(); await expect(page).toHaveURL(/\/coach$/) }
  release()
  if (cancel) {
    await page.waitForTimeout(1000)
    expect(writes).toBe(0); expect(prepares).toBe(0); expect(snapshot(f)).toEqual([])
  } else {
    await expect(page.getByText('บันทึกกลุ่มแล้ว', { exact: true }).last()).toBeVisible()
    expect(writes).toBe(1); expect(prepares).toBe(1); expect(ids.size).toBe(1)
    expect(sql(`SELECT count(*) FROM assignment5_receipts WHERE slot_id=${q(f.slot)};`)).toBe('1')
    expect(sql(`SELECT count(*) FROM notifications WHERE user_id=${q(coach.id)} AND title='ได้รับมอบหมายรอบสอน';`)).toBe('1')
  }
  expect(preflights).toBe(1)
})
