import { test, expect, type APIRequestContext, type Page, type PlaywrightWorkerArgs } from '@playwright/test'
import { localSql, sqlLiteral as q } from '../task10-regression/local-supabase'
import { account, db, emptyGroup, seed, snapshot, api, login, save, type Account } from './fixtures'
import { getAssignmentGroupsSignature, getPersistedAssignmentGroupsSignature, projectActiveAssignmentGroups, reconcileAssignmentDraft } from '../../src/lib/coach-assignment-lifecycle'

let owner: Account, coach: Account, other: Account, head: Account
const contexts: APIRequestContext[] = []
test.beforeAll(async () => {
  localSql("INSERT INTO course_types(name,max_students,duration_hours) VALUES('kids_group',6,2) ON CONFLICT(name) DO NOTHING;")
  owner = await account('user', 'ผู้ปกครอง Roster'); coach = await account('coach', 'โค้ช Roster'); other = await account('coach', 'โค้ช Roster อีกคน')
})
test.beforeEach(async () => { head = await account('head_coach', 'หัวหน้า Roster') })
test.afterAll(async () => { for (const c of contexts) await c.dispose() })

for (const width of [390, 1366]) test(`empty old group and two new learners save through browser ${width}px`, async ({ page, playwright }, info) => {
  const f = seed(owner, [coach, other, head]); emptyGroup(f, coach)
  await page.setViewportSize({ width, height: 950 })
  await login(page, head, f)
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: `${coach.name} - โค้ช`, exact: true }).click()
  // The defect is in the page-derived expectedGroups, so exercising only RPC Save cannot detect it.
  const saveButton = page.getByRole('button', { name: 'บันทึก/ยืนยันการมอบหมาย', exact: true })
  const responsePromise = page.waitForResponse(r => r.url().endsWith('/api/coach/assignment-groups') && r.request().method() === 'POST')
  await saveButton.click()
  const response = await responsePromise
  expect(response.status()).toBe(200)
  const result = await response.json(); expect(result.success).toBe(true)
  expect(snapshot(f).flatMap((g: { student_session_ids: string[] }) => g.student_session_ids).sort()).toEqual([...f.ids].sort())
  expect(snapshot(f).every((g: { coach_id: string }) => g.coach_id === coach.id)).toBe(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'มีโค้ชครบแล้ว', exact: true }).last()).toBeDisabled()
  await expect(page.getByText('รายชื่อรอบเรียนบน Server เปลี่ยนระหว่าง', { exact: false })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('assignment-saved.png'), fullPage: true })
  const context = await api(head, playwright); contexts.push(context)
  const read = await context.get(`/api/coach/assignment-groups?scheduleSlotId=${f.slot}&branchId=${f.branch}`)
  expect(read.status()).toBe(200)
})

test('filtered baseline reproduces real conflict without writing, full baseline permits Save', async ({ playwright }) => {
  const f = seed(owner, [coach, other, head]); emptyGroup(f, coach)
  const context = await api(head, playwright); contexts.push(context)
  const before = snapshot(f)
  const rejected = await save(context, f, coach, [])
  expect(rejected.status()).toBe(409); expect((await rejected.json()).code).toBe('COACH_ASSIGNMENT_BASELINE_CONFLICT')
  expect(snapshot(f)).toEqual(before)
  expect((await save(context, f, coach, before)).status()).toBe(200)
})

async function openConflict(page: Page, playwright: PlaywrightWorkerArgs['playwright']) {
  const f = seed(owner, [coach, other, head])
  const context = await api(head, playwright); contexts.push(context)
  expect((await save(context, f, null)).status()).toBe(200)
  await login(page, head, f)
  await page.getByLabel('ชื่อกลุ่ม', { exact: true }).fill('ฉบับร่างที่เก็บไว้')
  const expected = snapshot(f)
  const next = [{ name: 'กลุ่มล่าสุดบน Server', coachId: null, levelMin: 0, levelMax: 0, sortOrder: 0, studentSessionIds: f.ids }]
  const changed = await context.post('/api/coach/assignment-groups', { data: { scheduleSlotId: f.slot, branchId: f.branch, groups: next, expectedGroups: expected } })
  expect(changed.status()).toBe(200)
  const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/coach/assignment-groups'))
  await page.getByRole('button', { name: 'บันทึก/ยืนยันการมอบหมาย', exact: true }).click()
  expect((await response).status()).toBe(409)
  await expect(page.getByRole('button', { name: 'ใช้รายชื่อปัจจุบัน', exact: true })).toBeVisible()
  await expect(page.getByLabel('ชื่อกลุ่ม', { exact: true })).toHaveValue('ฉบับร่างที่เก็บไว้')
  return { f, context }
}

test('accept current roster waits for successful fresh read and page then saves without looping', async ({ page, playwright }) => {
  const { f } = await openConflict(page, playwright)
  let reads = 0, release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/coach/assignment-groups?**', async route => { reads++; const response = await route.fetch(); await gate; await route.fulfill({ response }) })
  await page.getByRole('button', { name: 'ใช้รายชื่อปัจจุบัน', exact: true }).click()
  await expect(page.getByRole('button', { name: 'กำลังโหลดรายชื่อปัจจุบัน' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'บันทึก/ยืนยันการมอบหมาย', exact: true })).toBeDisabled()
  expect(reads).toBe(1); release()
  await expect(page.getByLabel('ชื่อกลุ่ม', { exact: true })).toHaveValue('กลุ่มล่าสุดบน Server')
  await expect(page.getByRole('button', { name: 'ใช้รายชื่อปัจจุบัน', exact: true })).toHaveCount(0)
  await page.getByLabel('ชื่อกลุ่ม', { exact: true }).fill('กลุ่มที่ตรวจแล้ว')
  const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/coach/assignment-groups'))
  await page.getByRole('button', { name: 'บันทึก/ยืนยันการมอบหมาย', exact: true }).click()
  expect((await response).status()).toBe(200)
  await page.reload(); await expect(page.getByLabel('ชื่อกลุ่ม', { exact: true })).toHaveValue('กลุ่มที่ตรวจแล้ว')
  expect(snapshot(f)[0].name).toBe('กลุ่มที่ตรวจแล้ว')
})

test('failed current read keeps draft and conflict; retry can accept complete data', async ({ page, playwright }) => {
  await openConflict(page, playwright)
  let fail = true
  await page.route('**/api/coach/assignment-groups?**', route => fail ? route.fulfill({ status: 503, json: { error: 'ทดสอบอ่านไม่สำเร็จ' } }) : route.continue())
  await page.getByRole('button', { name: 'ใช้รายชื่อปัจจุบัน', exact: true }).click()
  await expect(page.getByText('ทดสอบอ่านไม่สำเร็จ', { exact: true })).toBeVisible()
  await expect(page.getByLabel('ชื่อกลุ่ม', { exact: true })).toHaveValue('ฉบับร่างที่เก็บไว้')
  await expect(page.getByRole('button', { name: 'บันทึก/ยืนยันการมอบหมาย', exact: true })).toBeDisabled()
  fail = false
  await page.getByRole('button', { name: 'ใช้รายชื่อปัจจุบัน', exact: true }).click()
  await expect(page.getByLabel('ชื่อกลุ่ม', { exact: true })).toHaveValue('กลุ่มล่าสุดบน Server')
})

test('change after current read cannot clear guard with a different refreshed baseline', async ({ page, playwright }) => {
  const { f, context } = await openConflict(page, playwright)
  await page.route('**/api/coach/assignment-groups?**', async route => {
    const response = await route.fetch()
    const changed = await context.post('/api/coach/assignment-groups', { data: { scheduleSlotId: f.slot, branchId: f.branch, expectedGroups: snapshot(f), groups: [{ name: 'เปลี่ยนระหว่างโหลด', coachId: null, levelMin: 0, levelMax: 0, sortOrder: 0, studentSessionIds: f.ids }] } })
    expect(changed.status()).toBe(200)
    await route.fulfill({ response })
  })
  await page.getByRole('button', { name: 'ใช้รายชื่อปัจจุบัน', exact: true }).click()
  await expect(page.getByText('ข้อมูลเปลี่ยนระหว่างโหลด กรุณาใช้รายชื่อปัจจุบันอีกครั้ง', { exact: true })).toBeVisible()
  await expect(page.getByLabel('ชื่อกลุ่ม', { exact: true })).toHaveValue('ฉบับร่างที่เก็บไว้')
  await expect(page.getByRole('button', { name: 'บันทึก/ยืนยันการมอบหมาย', exact: true })).toBeDisabled()
})

test('membership leaving between edits is removed from accepted draft and not restored by Save', async ({ page, playwright }) => {
  const { f } = await openConflict(page, playwright)
  // Use the actual Wallet transition; never emulate attendance or mutate production.
  const stored = await db().rpc('lesson_source_transition_v1', { p_actor_id: owner.id, p_operation: 'store', p_id: f.ids[0], p_payload: {} })
  expect(stored.error).toBeNull()
  await page.getByRole('button', { name: 'ใช้รายชื่อปัจจุบัน', exact: true }).click()
  await expect(page.getByLabel('ชื่อกลุ่ม', { exact: true })).toHaveValue('กลุ่มล่าสุดบน Server')
  await expect(page.getByRole('button', { name: 'ใช้รายชื่อปัจจุบัน', exact: true })).toHaveCount(0)
  await page.getByLabel('ชื่อกลุ่ม', { exact: true }).fill('กลุ่มเหลือหนึ่งคน')
  const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/coach/assignment-groups'))
  await page.getByRole('button', { name: 'บันทึก/ยืนยันการมอบหมาย', exact: true }).click()
  expect((await response).status()).toBe(200)
  expect(snapshot(f)[0].student_session_ids).toEqual([f.ids[1]])
})

test('multiple empty groups coexist with active group and roundtrip full expectedGroups', async ({ playwright }) => {
  const f = seed(owner, [coach, other, head]), context = await api(head, playwright); contexts.push(context)
  expect((await save(context, f, null)).status()).toBe(200)
  emptyGroup(f, coach); emptyGroup(f, other, 'กลุ่มว่างอีกกลุ่ม')
  const read = await context.get(`/api/coach/assignment-groups?scheduleSlotId=${f.slot}&branchId=${f.branch}`)
  expect(read.status()).toBe(200)
  const current = await read.json(); expect(current.canonicalGroups).toHaveLength(3); expect(current.rosterSessionIds.sort()).toEqual([...f.ids].sort())
  expect((await save(context, f, coach, current.canonicalGroups)).status()).toBe(200)
})

test('current read keeps role and branch gates', async ({ playwright }) => {
  const f = seed(owner, [coach, other, head])
  const denied = await account('head_coach', 'หัวหน้าอีกสาขา')
  for (const [a, status] of [[owner, 401], [coach, 401], [denied, 403]] as const) {
    const context = await api(a, playwright); contexts.push(context)
    expect((await context.get(`/api/coach/assignment-groups?scheduleSlotId=${f.slot}&branchId=${f.branch}`)).status()).toBe(status)
  }
})

test('full comparator preserves empty and inactive evidence while projection and coverage stay current', () => {
  const active = { name: 'กลุ่ม A', coachId: 'a', levelMin: 0, levelMax: 1, studentSessionIds: ['current', 'left'] }
  const empty = { ...active, name: 'กลุ่มว่าง', studentSessionIds: [] }
  expect(getAssignmentGroupsSignature([active, empty])).toBe(getAssignmentGroupsSignature([active]))
  expect(getPersistedAssignmentGroupsSignature([active, empty])).not.toBe(getPersistedAssignmentGroupsSignature([active]))
  expect(getPersistedAssignmentGroupsSignature([active, empty])).toBe(getPersistedAssignmentGroupsSignature([empty, { ...active, studentSessionIds: ['left', 'current'] }]))
  const projection = projectActiveAssignmentGroups([active, empty], ['current'])
  expect(projection).toEqual([{ ...active, studentSessionIds: ['current'] }])
  const reconciled = reconcileAssignmentDraft({ currentDraft: [{ ...active, name: 'ฉบับร่าง' }], previousServerDerivedDraft: [active], nextServerDerivedDraft: [active], previousPersistedGroups: [active], nextPersistedGroups: [active, empty] })
  expect(reconciled.needsRefreshReview).toBe(true); expect(reconciled.draft[0].name).toBe('ฉบับร่าง')
  const rosterChanged = reconcileAssignmentDraft({ currentDraft: [{ ...active, name: 'ฉบับร่าง' }], previousServerDerivedDraft: [active], nextServerDerivedDraft: projection, previousPersistedGroups: [active], nextPersistedGroups: [active] })
  expect(rosterChanged.needsRefreshReview).toBe(true)
})

test('late current read after timeout cannot replace draft or clear guard', async ({ page, playwright }) => {
  await openConflict(page, playwright)
  await page.clock.install()
  let captured = false, release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/coach/assignment-groups?**', async route => {
    const response = await route.fetch(); captured = true; await gate
    await route.fulfill({ response }).catch(() => {})
  })
  await page.getByRole('button', { name: 'ใช้รายชื่อปัจจุบัน', exact: true }).click()
  await expect.poll(() => captured).toBe(true)
  await page.clock.fastForward(30_001)
  await expect(page.getByText('โหลดรายชื่อปัจจุบันไม่สำเร็จ กรุณาลองอีกครั้ง', { exact: true })).toBeVisible()
  release()
  await expect(page.getByLabel('ชื่อกลุ่ม', { exact: true })).toHaveValue('ฉบับร่างที่เก็บไว้')
  await expect(page.getByRole('button', { name: 'บันทึก/ยืนยันการมอบหมาย', exact: true })).toBeDisabled()
})

test('Save with lost response is read back and retry does not duplicate its audit', async ({ page, playwright }) => {
  const f = seed(owner, [coach, other, head]); emptyGroup(f, coach)
  await login(page, head, f)
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: `${coach.name} - โค้ช`, exact: true }).click()
  await page.route('**/api/coach/assignment-groups', async route => {
    const response = await route.fetch(); expect(response.status()).toBe(200); await route.abort()
  })
  await page.getByRole('button', { name: 'บันทึก/ยืนยันการมอบหมาย', exact: true }).click()
  await expect(page.getByText('ตรวจพบผลที่บันทึกแล้วบน Server กรุณาตรวจข้อมูลล่าสุดก่อนทำรายการต่อ', { exact: true })).toBeVisible()
  const after = snapshot(f)
  const count = () => localSql(`SELECT jsonb_build_object('audits',(SELECT count(*) FROM activity_logs WHERE entity_id=${q(f.slot)} AND action='save_coach_assignment_groups_v2'),'notices',(SELECT count(*) FROM notifications WHERE user_id=${q(coach.id)}));`)
  const before = count()
  const context = await api(head, playwright); contexts.push(context)
  const response = await context.post('/api/coach/assignment-groups', { data: { scheduleSlotId: f.slot, branchId: f.branch, expectedGroups: after, groups: after.map((g: { name: string; coach_id: string | null; level_min: number; level_max: number; student_session_ids: string[] }) => ({ name: g.name, coachId: g.coach_id, levelMin: g.level_min, levelMax: g.level_max, studentSessionIds: g.student_session_ids })) } })
  expect(response.status()).toBe(200); expect((await response.json()).result.no_change).toBe(true)
  expect(count()).toBe(before)
})

test('started round keeps both page and API assignment lock', async ({ page, playwright }) => {
  const date = localSql("SELECT (now() at time zone 'Asia/Bangkok')::date;")
  const f = seed(owner, [coach, other, head], 2, date, '00:00', '23:59')
  await login(page, head, f)
  await expect(page.getByRole('button', { name: 'บันทึก/ยืนยันการมอบหมาย', exact: true })).toBeDisabled()
  const before = snapshot(f), context = await api(head, playwright); contexts.push(context)
  const response = await save(context, f, coach)
  expect(response.status()).toBe(409); expect((await response.json()).error).toContain('เริ่มหรือเลยเวลาเรียนแล้ว')
  expect(snapshot(f)).toEqual(before)
})
