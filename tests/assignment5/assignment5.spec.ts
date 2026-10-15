import { test, expect, type APIRequestContext } from '@playwright/test'
import { createServerClient } from '@supabase/ssr'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { account, seed, snapshot, payload, login, password, type Account } from '../assignment-roster/fixtures'
import { localSql, holdLocalTransaction, sqlLiteral as q } from '../task10-regression/local-supabase'
import { lessonSourceEnvironment, verifyLessonSourceTarget } from '../../scripts/verify-lesson-source-test-target.mjs'

let owner: Account, head: Account, coach: Account, other: Account, outsider: Account
const contexts: APIRequestContext[] = []
async function api(a: Account, playwright: { request: typeof import('@playwright/test').request }) {
  const env = lessonSourceEnvironment(), cookies = new Map<string, string>()
  const c = createServerClient(env.apiUrl, env.publishableKey, { cookies: { getAll: () => [...cookies].map(([name, value]) => ({ name, value })), setAll: values => values.forEach(v => cookies.set(v.name, v.value)) } })
  expect((await c.auth.signInWithPassword({ email: a.email, password })).error).toBeNull()
  const context = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3163', extraHTTPHeaders: { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') } })
  contexts.push(context); return context
}
const counts = (slot: string) => localSql(`SELECT jsonb_build_object('audits',(SELECT count(*) FROM activity_logs WHERE entity_id=${q(slot)} AND action='save_coach_assignment_groups_v2'),'notices',(SELECT count(*) FROM notifications WHERE title='ได้รับมอบหมายรอบสอน'));`)
test.beforeAll(async () => {
  verifyLessonSourceTarget()
  const marker = JSON.parse(readFileSync(resolve(process.env.ASSIGNMENT5_BUILD_DIR!, '.next/assignment5-build.json'), 'utf8'))
  expect(marker.api).toBe(lessonSourceEnvironment().apiUrl)
  owner = await account('user', 'ผู้ปกครอง Assignment5'); head = await account('head_coach', 'หัวหน้า Assignment5')
  coach = await account('coach', 'โค้ช Assignment5'); other = await account('coach', 'โค้ชสำรอง Assignment5'); outsider = await account('head_coach', 'หัวหน้าต่างสาขา')
})
test.afterAll(async () => { for (const c of contexts) await c.dispose() })
test.beforeEach(async () => { head = await account('head_coach', 'หัวหน้า Assignment5 เฉพาะกรณี') })

test('real booking lock returns typed retry, no partial write, original request succeeds after release', async ({ playwright }) => {
  const f = seed(owner, [head, coach, other]), c = await api(head, playwright), expected = snapshot(f)
  const data = { scheduleSlotId: f.slot, branchId: f.branch, expectedGroups: expected, groups: payload(f, coach) }
  const before = counts(f.slot), held = await holdLocalTransaction(`SELECT id FROM bookings WHERE id=${q(f.booking)} FOR UPDATE;`, 'a5-api-booking')
  try {
    const response = await c.post('/api/coach/assignment-groups', { data })
    expect(response.status()).toBe(409); expect((await response.json()).code).toBe('COACH_ASSIGNMENT_RETRY')
    expect(snapshot(f)).toEqual(expected); expect(counts(f.slot)).toBe(before)
  } finally { await held.finish() }
  const saved = await c.post('/api/coach/assignment-groups', { data }); expect(saved.status()).toBe(200)
  expect(snapshot(f)[0].coach_id).toBe(coach.id)
  const after = counts(f.slot), replay = await c.post('/api/coach/assignment-groups', { data })
  expect(replay.status()).toBe(200); expect((await replay.json()).result.no_change).toBe(true); expect(counts(f.slot)).toBe(after)
})

test('Save-first keeps Store atomic and retry retires learner once', async ({ playwright }) => {
  const f = seed(owner, [head, coach]), c = await api(owner, playwright)
  const held = await holdLocalTransaction(`SELECT save_coach_assignment_groups_v3(${q(f.slot)},${q(head.id)},${q(JSON.stringify(payload(f, coach)))}::jsonb,'[]');`, 'a5-save-first')
  try {
    const response = await c.post('/api/lesson-wallet', { data: { action: 'store', sessionId: f.ids[0] } })
    expect(response.status()).toBe(409); expect((await response.json()).code).toBe('LESSON_SOURCE_RETRY')
  } finally { await held.finish() }
  const response = await c.post('/api/lesson-wallet', { data: { action: 'store', sessionId: f.ids[0] } }); expect(response.status()).toBe(200)
  const proof = () => localSql(`SELECT (SELECT count(*) FROM lesson_wallet_credits WHERE booking_id=${q(f.booking)})||'|'||(SELECT count(*) FROM coach_assignment_group_students WHERE booking_session_id=${q(f.ids[0])});`)
  expect(proof()).toBe('1|0'); const replay = await c.post('/api/lesson-wallet', { data: { action: 'store', sessionId: f.ids[0] } }); expect(replay.status()).toBe(200); expect(proof()).toBe('1|0')
})

test('all returned transient SQL aborts are typed while unexpected errors remain failures', async ({ playwright }) => {
  const f = seed(owner, [head, coach]), c = await api(head, playwright)
  const original = localSql("SELECT pg_get_functiondef('save_coach_assignment_groups_v3(uuid,uuid,jsonb,jsonb)'::regprocedure);")
  try {
    for (const code of ['40P01', '40001', '55P03', '57014', 'XX000']) {
      localSql(`CREATE OR REPLACE FUNCTION public.save_coach_assignment_groups_v3(p_schedule_slot_id uuid,p_actor_id uuid,p_groups jsonb,p_expected_groups jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $$BEGIN RAISE EXCEPTION USING ERRCODE='${code}', MESSAGE='LOCAL_ASSIGNMENT5_INJECTED_ABORT';END$$;`)
      const response = await c.post('/api/coach/assignment-groups', { data: { scheduleSlotId: f.slot, branchId: f.branch, expectedGroups: [], groups: payload(f, coach) } })
      expect(response.status()).toBe(code === 'XX000' ? 500 : 409)
      if (code !== 'XX000') expect((await response.json()).code).toBe('COACH_ASSIGNMENT_RETRY')
      expect(snapshot(f)).toEqual([])
    }
  } finally { localSql(original) }
})

test('Store-first makes old Save retry and then rejects walleted learner without resurrection', async ({ playwright }) => {
  const f = seed(owner, [head, coach]), c = await api(head, playwright), expected = snapshot(f)
  const data = { scheduleSlotId: f.slot, branchId: f.branch, expectedGroups: expected, groups: payload(f, coach) }
  const held = await holdLocalTransaction(`SELECT lesson_source_transition_v1(${q(owner.id)},'store',${q(f.ids[0])},'{}');`, 'a5-store-first')
  try {
    const response = await c.post('/api/coach/assignment-groups', { data })
    expect(response.status()).toBe(409); expect((await response.json()).code).toBe('COACH_ASSIGNMENT_RETRY')
  } finally { await held.finish() }
  const stale = await c.post('/api/coach/assignment-groups', { data })
  expect(stale.status()).toBe(409); expect((await stale.json()).code).toBe('COACH_ASSIGNMENT_ROSTER_CONFLICT')
  expect(localSql(`SELECT count(*) FROM coach_assignment_group_students WHERE booking_session_id=${q(f.ids[0])};`)).toBe('0')
})

test('parent and different-branch head cannot save and new schema preserves execution grants', async ({ playwright }) => {
  const f = seed(owner, [head, coach])
  for (const a of [owner, outsider]) {
    const c = await api(a, playwright), r = await c.post('/api/coach/assignment-groups', { data: { scheduleSlotId: f.slot, branchId: f.branch, expectedGroups: [], groups: payload(f, coach) } })
    expect([401, 403]).toContain(r.status()); expect(snapshot(f)).toEqual([])
  }
  expect(localSql("SELECT has_function_privilege('anon','save_coach_assignment_groups_v2(uuid,uuid,jsonb)','EXECUTE') OR has_function_privilege('authenticated','save_coach_assignment_groups_v3(uuid,uuid,jsonb,jsonb)','EXECUTE');")).toBe('f')
})

test('busy coach/date reservation key returns retry before any assignment effect', async ({ playwright }) => {
  const f = seed(owner, [head, coach]), c = await api(head, playwright), before = counts(f.slot)
  const held = await holdLocalTransaction(`SELECT pg_advisory_xact_lock(hashtextextended(concat(${q(coach.id)},'|',${q(f.date)}),0));`, 'a5-coach-key')
  try {
    const response = await c.post('/api/coach/assignment-groups', { data: { scheduleSlotId: f.slot, branchId: f.branch, expectedGroups: [], groups: payload(f, coach) } })
    expect(response.status()).toBe(409); expect((await response.json()).code).toBe('COACH_ASSIGNMENT_RETRY')
    expect(snapshot(f)).toEqual([]); expect(counts(f.slot)).toBe(before)
  } finally { await held.finish() }
})

test('Store readback requires ownership and atomic ledger evidence', async ({ playwright }) => {
  const f = seed(owner, [head, coach], 1), c = await api(owner, playwright), foreign = await api(outsider, playwright)
  const url = `/api/lesson-wallet?sessionId=${f.ids[0]}`
  expect((await (await c.get(url)).json()).confirmed).toBe(false)
  expect((await foreign.get(url)).status()).toBe(404)
  const anonymous = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3163' }); contexts.push(anonymous)
  expect((await anonymous.get(url)).status()).toBe(401)
  expect((await c.post('/api/lesson-wallet', { data: { action: 'store', sessionId: f.ids[0] } })).status()).toBe(200)
  const after = await c.get(url); expect(after.status()).toBe(200); expect((await after.json()).confirmed).toBe(true)
  expect((await foreign.get(url)).status()).toBe(404)
  expect(localSql("SELECT has_function_privilege('anon','lesson_wallet_store_confirmation_v1(uuid,uuid)','EXECUTE') OR has_function_privilege('authenticated','lesson_wallet_store_confirmation_v1(uuid,uuid)','EXECUTE') OR has_table_privilege('service_role','lesson_source_operations','SELECT');")).toBe('f')
  const helperProof = localSql(`SELECT lesson_wallet_store_confirmation_v1(${q(outsider.id)},${q(f.ids[0])});`)
  expect(helperProof).toBe('f')
  localSql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);UPDATE lesson_wallet_credits SET status='expired',expired_at=clock_timestamp() WHERE booking_id=${q(f.booking)};COMMIT;`)
  // Confirmation proves the past Store, not current eligibility or a revived right.
  expect((await (await c.get(url)).json()).confirmed).toBe(true)
  expect(localSql(`SELECT status FROM lesson_wallet_credits WHERE booking_id=${q(f.booking)};`)).toBe('expired')
})

for (const [failFirstRead, dropBeforeCommit] of [[false, false], [true, false], [false, true]]) test(`Parent Store response lost, readback ${dropBeforeCommit ? 'no prior request reached server' : failFirstRead ? 'temporarily unavailable' : 'confirms commit'}`, async ({ page }, info) => {
  const parent = await account('user', 'ผู้ปกครองตรวจผล Store')
  const date = localSql("SELECT ((now() at time zone 'Asia/Bangkok')::date+4)::text;")
  const f = seed(parent, [head, coach], 1, date)
  localSql(`BEGIN;SELECT set_config('task10.payment_write','authorized',true);UPDATE bookings SET month=${Number(date.slice(5,7))},year=${date.slice(0,4)} WHERE id=${q(f.booking)};COMMIT;`)
  await page.setViewportSize({ width: 390, height: 900 }); await page.goto('/auth/login')
  await page.getByLabel('อีเมล', { exact: true }).fill(parent.email); await page.locator('input#password').fill(password)
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click(); await expect(page).not.toHaveURL(/auth\/login/)
  await page.goto('/dashboard/schedule')
  if (Number(date.slice(5,7)) !== Number(localSql("SELECT to_char(now() at time zone 'Asia/Bangkok','MM');"))) await page.getByRole('button', { name: 'เดือนถัดไป', exact: true }).click()
  await page.getByRole('button', { name: `ดูตารางวันที่ ${date}`, exact: true }).click()
  await page.getByRole('button', { name: 'เก็บเข้ากระเป๋า', exact: true }).click()
  let posts = 0, reads = 0
  await page.route('**/api/lesson-wallet', async route => {
    posts++
    if (dropBeforeCommit && posts === 1) { await route.abort(); return }
    const response = await route.fetch(); expect(response.status()).toBe(200)
    if (dropBeforeCommit) await route.fulfill({ response }); else await route.abort()
  })
  if (failFirstRead) await page.route('**/api/lesson-wallet?**', async route => {
    reads++
    if (reads === 1) await route.fulfill({ status: 503, json: { error: 'Local read unavailable' } }); else await route.continue()
  })
  await page.getByRole('button', { name: 'ยืนยันเก็บเข้ากระเป๋า', exact: true }).click()
  await expect(page.getByText('เก็บเข้ากระเป๋าแล้ว', { exact: true }).last()).toBeVisible({ timeout: 25_000 })
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  expect(posts).toBe(dropBeforeCommit ? 2 : 1)
  expect(localSql(`SELECT count(*) FROM lesson_wallet_credits WHERE booking_id=${q(f.booking)};`)).toBe('1')
  await page.screenshot({ path: info.outputPath('store-confirmed-mobile.png'), fullPage: true })
})

for (const width of [390, 1366]) test(`browser ${width}px preserves draft on real retry and saves after release`, async ({ page }) => {
  const f = seed(owner, [head, coach]); await page.setViewportSize({ width, height: 900 }); await login(page, head, f)
  await page.getByLabel('ชื่อกลุ่ม', { exact: true }).fill('ร่างที่ต้องเก็บไว้')
  await page.getByRole('combobox').first().click(); await page.getByRole('option', { name: `${coach.name} - โค้ช`, exact: true }).click()
  const held = await holdLocalTransaction(`SELECT id FROM bookings WHERE id=${q(f.booking)} FOR UPDATE;`, 'a5-ui-retry')
  try {
    const firstAbort = page.waitForResponse(r => r.url().endsWith('/api/coach/assignment-groups') && r.request().method() === 'POST' && r.status() === 409)
    await page.getByRole('button', { name: 'บันทึก/ยืนยันการมอบหมาย', exact: true }).click()
    await firstAbort
    await expect(page.getByLabel('ชื่อกลุ่ม', { exact: true })).toHaveValue('ร่างที่ต้องเก็บไว้')
    await expect(page.getByRole('button', { name: 'กำลังบันทึก', exact: true })).toBeDisabled()
    expect(snapshot(f)).toEqual([])
    await page.screenshot({ path: test.info().outputPath(`retry-${width}.png`), fullPage: true })
  } finally { await held.finish() }
  await expect.poll(() => snapshot(f)[0]?.name).toBe('ร่างที่ต้องเก็บไว้')
  await page.reload(); await expect(page.getByLabel('ชื่อกลุ่ม', { exact: true })).toHaveValue('ร่างที่ต้องเก็บไว้')
  await expect(page.getByRole('button', { name: 'มีโค้ชครบแล้ว', exact: true }).last()).toBeDisabled()
  await expect(page.getByText('กำลังเปิดเมนู...', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: test.info().outputPath(`saved-${width}.png`), fullPage: true })
})
