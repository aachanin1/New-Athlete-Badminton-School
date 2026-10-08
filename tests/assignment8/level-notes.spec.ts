import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { createServerClient } from '@supabase/ssr'
import { randomUUID } from 'node:crypto'
import { createLocalAdmin, getLocalSupabaseEnv } from '../booking-regression/local-supabase'
import { localSql, sqlLiteral as q } from '../task10-regression/local-supabase'
import { verifyLessonSourceTarget } from '../../scripts/verify-lesson-source-test-target.mjs'
import type { LevelAssessmentPage } from '../../src/types/level-assessment'

type Account = { id: string; email: string }
const password = 'Assignment8NotesLocal!2026'
const contexts: APIRequestContext[] = []
const db = () => createLocalAdmin()
let owner: Account, coach: Account, other: Account, head: Account, outsider: Account, admin: Account
let branch: string, group: string, children: string[], name: string
const longNote = 'หมายเหตุทดสอบ: เคลื่อนตัวและควบคุมทิศทางลูกได้ดีขึ้น '.repeat(12) + '\n\nฝึก backhand ต่อ และรักษาสมดุลเมื่อกลับกลางสนาม <b>ข้อความธรรมดา</b>'
async function account(role: string): Promise<Account> {
  const email = `a8-notes-${randomUUID()}@example.com`
  const result = await db().auth.admin.createUser({ email, password, email_confirm: true })
  expect(result.error).toBeNull()
  const id = result.data.user!.id
  expect((await db().from('profiles').update({ role, full_name: `ผู้ประเมิน-${role}` }).eq('id', id)).error).toBeNull()
  return { id, email }
}
async function api(actor: Account, request: { newContext: (options: object) => Promise<APIRequestContext> }) {
  const env = getLocalSupabaseEnv(), cookies = new Map<string, string>()
  const client = createServerClient(env.apiUrl, env.publishableKey, { cookies: {
    getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
    setAll: values => values.forEach(value => cookies.set(value.name, value.value)),
  } })
  expect((await client.auth.signInWithPassword({ email: actor.email, password })).error).toBeNull()
  const context = await request.newContext({ baseURL: 'http://127.0.0.1:3161', extraHTTPHeaders: { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; ') } })
  contexts.push(context)
  return context
}
async function login(page: Page, actor: Account) {
  await page.goto('/auth/login')
  await page.getByLabel('อีเมล', { exact: true }).fill(actor.email)
  await page.locator('input#password').fill(password)
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
  await expect(page).not.toHaveURL(/auth\/login/)
}
const endpoint = (id = children[0], type = 'child', before?: string) => `/api/coach/levels?${new URLSearchParams({ studentId: id, studentType: type, ...(before ? { before } : {}) })}`
const addNote = (id: string, note: string | null, level = 34) => localSql(`INSERT INTO student_levels(student_id,student_type,level,notes,updated_by) VALUES(${q(id)},'child',${level},${note === null ? 'NULL' : q(note)},${q(coach.id)});`)

test.beforeAll(async () => {
  verifyLessonSourceTarget()
  owner = await account('user'); coach = await account('coach'); other = await account('coach'); head = await account('head_coach'); outsider = await account('head_coach'); admin = await account('super_admin')
  const booking = randomUUID(), slot = randomUUID(), template = randomUUID()
  branch = randomUUID(); children = [randomUUID(), randomUUID()]; name = `นักเรียนหมายเหตุ-${randomUUID().slice(0,8)}`
  const course = localSql("SELECT id FROM course_types WHERE name='kids_group';")
  localSql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);SELECT set_config('task10.payment_write','authorized',true);
    INSERT INTO branches(id,name,slug) VALUES(${q(branch)},'สาขาหมายเหตุ',${q('notes-'+branch)});
    INSERT INTO coach_branches(coach_id,branch_id) VALUES(${q(coach.id)},${q(branch)}),(${q(other.id)},${q(branch)}),(${q(head.id)},${q(branch)});
    ${children.map(id => `INSERT INTO children(id,parent_id,full_name) VALUES(${q(id)},${q(owner.id)},${q(name)});`).join('\n')}
    INSERT INTO bookings(id,user_id,learner_type,child_id,branch_id,course_type_id,month,year,total_sessions,total_price,status) VALUES(${q(booking)},${q(owner.id)},'child',${q(children[0])},${q(branch)},${q(course)},10,2035,1,500,'verified');
    INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(template)},${q(branch)},${q(course)},1,'15:00','16:00',true);
    INSERT INTO schedule_slots(id,template_id,branch_id,course_type_id,date,start_time,end_time,status) VALUES(${q(slot)},${q(template)},${q(branch)},${q(course)},'2035-10-08','15:00','16:00','open');
    ${children.map(id => `INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status) VALUES(${q(randomUUID())},${q(booking)},${q(slot)},'2035-10-08','15:00','16:00',${q(branch)},${q(id)},'scheduled');`).join('\n')}
    COMMIT;`)
  const sessions = JSON.parse(localSql(`SELECT jsonb_agg(id) FROM booking_sessions WHERE booking_id=${q(booking)};`))
  const assigned = await db().rpc('save_coach_assignment_groups_v3', { p_schedule_slot_id: slot, p_actor_id: admin.id, p_groups: [{ name: 'กลุ่มหมายเหตุ', coachId: coach.id, levelMin: 0, levelMax: 0, sortOrder: 0, studentSessionIds: sessions }], p_expected_groups: [] })
  expect(assigned.error).toBeNull()
  group = localSql(`SELECT id FROM coach_assignment_groups WHERE schedule_slot_id=${q(slot)};`)
  const adultBooking = randomUUID(), adultSlot = randomUUID(), adultTemplate = randomUUID(), adultSession = randomUUID()
  const privateCourse = localSql("SELECT id FROM course_types WHERE name='private';")
  localSql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);SELECT set_config('task10.payment_write','authorized',true);
    INSERT INTO bookings(id,user_id,learner_type,branch_id,course_type_id,month,year,total_sessions,total_price,status) VALUES(${q(adultBooking)},${q(owner.id)},'self',${q(branch)},${q(privateCourse)},10,2035,1,500,'verified');
    INSERT INTO payments(booking_id,user_id,amount,status,verified_at) VALUES(${q(adultBooking)},${q(owner.id)},500,'approved',clock_timestamp());
    INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(adultTemplate)},${q(branch)},${q(privateCourse)},1,'17:00','18:00',true);
    INSERT INTO schedule_slots(id,template_id,branch_id,course_type_id,date,start_time,end_time,status) VALUES(${q(adultSlot)},${q(adultTemplate)},${q(branch)},${q(privateCourse)},'2035-10-08','17:00','18:00','open');
    INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,status) VALUES(${q(adultSession)},${q(adultBooking)},${q(adultSlot)},'2035-10-08','17:00','18:00',${q(branch)},'scheduled');COMMIT;`)
  expect((await db().rpc('save_coach_assignment_groups_v3', { p_schedule_slot_id:adultSlot,p_actor_id:admin.id,p_groups:[{ name:'ผู้ใหญ่',coachId:coach.id,levelMin:0,levelMax:0,sortOrder:0,studentSessionIds:[adultSession] }],p_expected_groups:[] })).error).toBeNull()
})
test.afterAll(async () => { for (const context of contexts) await context.dispose() })

test('assessment history keyset retains microseconds and equal-time rows across new inserts', async ({ playwright }) => {
  const ids = Array.from({ length: 21 }, () => randomUUID()).sort().reverse()
  localSql(ids.map((id, index) => `INSERT INTO student_levels(id,student_id,student_type,level,notes,updated_by,created_at) VALUES(${q(id)},${q(children[0])},'child',34,${q('ประวัติเดิม '+index)},${q(coach.id)},'2001-01-01T00:00:00.123456Z');`).join('\n'))
  localSql(`INSERT INTO student_levels(student_id,student_type,level,notes,updated_by,created_at) VALUES(${q(children[0])},'adult',70,'คนละประเภท',${q(coach.id)},'2002-01-01');`)
  const request = await api(coach, playwright.request)
  expect((await (await request.get(endpoint(children[1]))).json()).items).toEqual([])
  expect((await request.post('/api/coach/levels',{data:{studentId:owner.id,studentType:'adult',level:33,notes:'หมายเหตุผู้ใหญ่'}})).status()).toBe(200)
  expect((await (await request.get(endpoint(owner.id,'adult'))).json()).items[0].notes).toBe('หมายเหตุผู้ใหญ่')
  const first = await request.get(endpoint()); expect(first.status()).toBe(200); expect(first.headers()['cache-control']).toContain('no-store')
  const page1 = await first.json() as LevelAssessmentPage; expect(page1.items.map(item => item.id)).toEqual(ids.slice(0,10))
  addNote(children[0], 'รายการใหม่ระหว่างเปิดประวัติ')
  const page2 = await (await request.get(endpoint(children[0], 'child', page1.nextCursor!))).json() as LevelAssessmentPage
  const page3 = await (await request.get(endpoint(children[0], 'child', page2.nextCursor!))).json() as LevelAssessmentPage
  expect([...page1.items, ...page2.items, ...page3.items].map(item => item.id)).toEqual(ids)
  expect(page3.nextCursor).toBeNull()
  expect((await request.get(endpoint(children[1], 'child', page1.nextCursor!))).status()).toBe(400)
  expect((await request.get(endpoint(children[0], 'child', 'invalid'))).status()).toBe(400)
  expect((await (await request.get(endpoint())).json()).items[0].notes).toBe('รายการใหม่ระหว่างเปิดประวัติ')
})

test('assessment reads preserve current role, exact learner and branch gates', async ({ playwright }) => {
  for (const actor of [coach, head, admin]) expect((await (await api(actor, playwright.request)).get(endpoint())).status()).toBe(200)
  for (const actor of [other, outsider]) expect((await (await api(actor, playwright.request)).get(endpoint())).status()).toBe(403)
  expect((await (await api(owner, playwright.request)).get(endpoint())).status()).toBe(401)
  const anonymous = await playwright.request.newContext({ baseURL:'http://127.0.0.1:3161' })
  try { expect((await anonymous.get(endpoint())).status()).toBe(401) } finally { await anonymous.dispose() }
  const request = await api(coach, playwright.request)
  expect((await request.get(endpoint(children[0], 'adult'))).status()).toBe(403)
  expect((await request.get(endpoint('bad-id'))).status()).toBe(400)
  localSql(`UPDATE coach_assignment_groups SET coach_id=${q(other.id)} WHERE id=${q(group)};`)
  try { expect((await request.get(endpoint())).status()).toBe(403) } finally { localSql(`UPDATE coach_assignment_groups SET coach_id=${q(coach.id)} WHERE id=${q(group)};`) }
})

test('same-Level new and blank notes append without replacing old assessments', async ({ playwright, page }) => {
  const request = await api(coach, playwright.request)
  const before = localSql(`SELECT md5(jsonb_agg(to_jsonb(s) ORDER BY id)::text) FROM student_levels s WHERE student_id=${q(children[0])};`)
  const ids = JSON.parse(localSql(`SELECT jsonb_agg(id) FROM student_levels WHERE student_id=${q(children[0])};`)) as string[]
  expect((await request.post('/api/coach/levels', { data:{ studentId:children[0],studentType:'child',level:34,notes:longNote } })).status()).toBe(200)
  expect((await request.post('/api/coach/levels', { data:{ studentId:children[0],studentType:'child',level:34,notes:'  ' } })).status()).toBe(200)
  expect(localSql(`SELECT md5(jsonb_agg(to_jsonb(s) ORDER BY id)::text) FROM student_levels s WHERE id IN(${ids.map(q).join(',')});`)).toBe(before)
  const latest = (await (await request.get(endpoint())).json()).items
  expect(latest[0]).toMatchObject({ level:34,notes:null,evaluatedBy:'ผู้ประเมิน-coach' })
  expect(latest[1].notes).toBe(longNote)
  const count = localSql(`SELECT count(*) FROM student_levels WHERE student_id=${q(children[0])};`)
  expect((await request.post('/api/coach/levels', { data:{ studentId:children[0],studentType:'child',level:34,notes:{ text:'invalid' } } })).status()).toBe(400)
  expect(localSql(`SELECT count(*) FROM student_levels WHERE student_id=${q(children[0])};`)).toBe(count)
  await login(page,coach);await page.goto('/coach/levels')
  await page.getByPlaceholder('ค้นหาชื่อนักเรียนหรือผู้ปกครอง...').fill(name)
  await page.locator(`[data-student-key="child:${children[0]}"]`).getByRole('button',{name:'กรอก LV',exact:true}).click()
  await expect(page.getByRole('dialog').getByText('ไม่ได้ระบุหมายเหตุในการประเมินครั้งนี้',{exact:true})).toBeVisible()
  await page.getByRole('dialog').locator('summary').click()
  await expect(page.getByRole('dialog').getByText(longNote,{exact:true})).toBeVisible()
})

test('history database read failure returns503 and restores after retry', async ({ playwright }) => {
  const request = await api(coach, playwright.request)
  localSql('REVOKE SELECT ON student_levels FROM authenticated;')
  try { expect((await request.get(endpoint())).status()).toBe(503) } finally { localSql('GRANT SELECT ON student_levels TO authenticated;') }
  expect((await request.get(endpoint())).status()).toBe(200)
})

for (const width of [1366,390]) test(`Coach notes ${width}px are lazy, retryable, complete and retained after save/login`, async ({ page, browser }, info) => {
  addNote(children[0], longNote); addNote(children[1], 'คนชื่อซ้ำอีกคน')
  await page.setViewportSize({ width,height:900 }); await login(page, coach); await page.goto('/coach/levels')
  await page.getByPlaceholder('ค้นหาชื่อนักเรียนหรือผู้ปกครอง...').fill(name)
  let historyRequests = 0
  page.on('request', request => { if (request.method()==='GET' && request.url().includes('/api/coach/levels?')) historyRequests++ })
  await page.locator(`[data-student-key="child:${children[0]}"]`).getByRole('button', { name:'กรอก LV',exact:true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(longNote,{exact:true})).toBeVisible(); expect(historyRequests).toBe(0)
  await page.route('**/api/coach/levels?**', route => route.fulfill({ status:503,contentType:'application/json',body:JSON.stringify({ error:'ยังอ่านประวัติไม่ได้' }) }))
  await dialog.locator('summary').click(); await expect(dialog.getByRole('alert')).toContainText('ยังอ่านประวัติไม่ได้')
  await page.unroute('**/api/coach/levels?**'); await dialog.getByRole('button',{name:'ลองโหลดประวัติอีกครั้ง'}).click()
  await expect(dialog.locator('[data-assessment-id]')).toHaveCount(10)
  await dialog.getByRole('button',{name:'โหลดประวัติเพิ่มเติม'}).click(); await expect(dialog.locator('[data-assessment-id]')).toHaveCount(20)
  await dialog.locator('summary').click()
  await dialog.getByLabel('หมายเหตุสำหรับการประเมินครั้งนี้').fill('บันทึกจากหน้าจอ '+width)
  const saved = page.waitForRequest(request => request.method()==='POST' && request.url().endsWith('/api/coach/levels'))
  await dialog.getByRole('button',{name:'บันทึกการประเมิน',exact:true}).click(); expect((await saved).postDataJSON().studentId).toBe(children[0])
  await expect(dialog).toBeHidden()
  const freshContext = await browser.newContext({ viewport:{width,height:900},locale:'th-TH',timezoneId:'Asia/Bangkok' })
  try {
    const fresh = await freshContext.newPage(); await login(fresh,coach); await fresh.goto('/coach/levels'); await fresh.getByPlaceholder('ค้นหาชื่อนักเรียนหรือผู้ปกครอง...').fill(name)
    await fresh.locator(`[data-student-key="child:${children[0]}"]`).getByRole('button',{name:'กรอก LV',exact:true}).click()
    await expect(fresh.getByRole('dialog').getByText('บันทึกจากหน้าจอ '+width,{exact:true})).toBeVisible()
    expect(await fresh.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await fresh.screenshot({path:info.outputPath('coach-notes.png'),fullPage:true})
  } finally { await freshContext.close() }
})

for (const width of [1366,390]) test(`Ranking notes ${width}px remain one line and open selected text without resizing rows`, async ({ page: desktopPage, browser }, info) => {
  const mobile = width === 390 ? await browser.newContext({ viewport:{width,height:900},isMobile:true,hasTouch:true,locale:'th-TH',timezoneId:'Asia/Bangkok' }) : null
  const page = mobile ? await mobile.newPage() : desktopPage
  try {
  addNote(children[0],longNote); addNote(children[1],'ดี',33)
  await page.setViewportSize({width,height:900}); await page.goto('/ranking'); await page.getByPlaceholder('ค้นหาชื่อนักเรียน / ชื่อเล่น / สาขา / Level').fill(name)
  const triggers = page.getByRole('button',{name:'อ่านหมายเหตุเพิ่มเติมของ'+name,exact:true})
  await expect(triggers).toHaveCount(1)
  const trigger = triggers.first(), row = page.locator(`[data-ranking-student-key="kid:${children[0]}"]`)
  const before = await row.boundingBox()
  await trigger.click(); const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(longNote,{exact:true})).toBeVisible(); expect(await dialog.locator('b').count()).toBe(0)
  expect((await row.boundingBox())!.height).toBe(before!.height)
  await page.screenshot({path:info.outputPath('ranking-note-dialog.png'),fullPage:true})
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:info.outputPath('ranking-note-list.png'),fullPage:true})
  } finally { await mobile?.close() }
})
