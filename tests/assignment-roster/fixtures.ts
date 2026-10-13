import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { createServerClient } from '@supabase/ssr'
import { randomUUID } from 'node:crypto'
import { createLocalAdmin, getLocalSupabaseEnv } from '../booking-regression/local-supabase'
import { localSql, sqlLiteral as q } from '../task10-regression/local-supabase'
import { verifyLessonSourceTarget } from '../../scripts/verify-lesson-source-test-target.mjs'

export const db = () => createLocalAdmin()
export const password = 'RosterLocal!2026'
export type Account = { id: string; email: string; name: string }
let fixtureDay = 1
export async function account(role: string, name: string): Promise<Account> {
  verifyLessonSourceTarget()
  const email = `roster-${randomUUID()}@example.com`
  const result = await db().auth.admin.createUser({ email, password, email_confirm: true })
  expect(result.error).toBeNull()
  const id = result.data.user!.id
  expect((await db().from('profiles').update({ role, full_name: name }).eq('id', id)).error).toBeNull()
  return { id, email, name }
}
export function seed(owner: Account, coaches: Account[], count = 2, date = new Date(Date.UTC(2031, 10, ++fixtureDay)).toISOString().slice(0, 10), startTime = '15:00', endTime = '16:00') {
  verifyLessonSourceTarget()
  const [booking, branch, slot, template] = Array.from({ length: 4 }, () => randomUUID())
  const ids = Array.from({ length: count }, () => randomUUID()), children = ids.map(() => randomUUID())
  const course = localSql("SELECT id FROM course_types WHERE name='kids_group';")
  localSql(`BEGIN; SELECT set_config('lesson_source.write','authorized',true); SELECT set_config('task10.source_write','authorized',true);
    INSERT INTO branches(id,name,slug) VALUES(${q(branch)},'สาขา Roster ทดสอบ',${q('roster-' + branch)});
    ${coaches.map(c => `INSERT INTO coach_branches(coach_id,branch_id) VALUES(${q(c.id)},${q(branch)});`).join('\n')}
    ${children.map((id, i) => `INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(id)},${q(owner.id)},'เด็ก Roster ${i + 1}','เด็ก Roster ${i + 1}');`).join('\n')}
    INSERT INTO bookings(id,user_id,learner_type,child_id,branch_id,course_type_id,month,year,total_sessions,total_price,status)
      VALUES(${q(booking)},${q(owner.id)},'child',${q(children[0])},${q(branch)},${q(course)},11,2031,1,500,'verified');
    INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES(${q(template)},${q(branch)},${q(course)},extract(dow FROM date '${date}'),${q(startTime)},${q(endTime)},true);
    INSERT INTO schedule_slots(id,template_id,branch_id,course_type_id,date,start_time,end_time,status) VALUES(${q(slot)},${q(template)},${q(branch)},${q(course)},'${date}',${q(startTime)},${q(endTime)},'open');
    ${ids.map((id, i) => `INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup) VALUES(${q(id)},${q(booking)},${q(slot)},'${date}',${q(startTime)},${q(endTime)},${q(branch)},${q(children[i])},'scheduled',false);`).join('\n')}
    COMMIT;`)
  return { booking, branch, slot, template, ids, children, date }
}
export type Fixture = ReturnType<typeof seed>
export function emptyGroup(f: Fixture, coach: Account, name = 'ชุดพื้นฐานเดิม') {
  localSql(`INSERT INTO coach_assignment_groups(id,schedule_slot_id,coach_id,name,sort_order,created_by) VALUES(${q(randomUUID())},${q(f.slot)},${q(coach.id)},${q(name)},0,${q(coach.id)});`)
}
export const snapshot = (f: Fixture) => JSON.parse(localSql(`SELECT coach_assignment_slot_snapshot_v2(${q(f.slot)})->'groups';`))
export async function api(a: Account, playwright: { request: typeof import('@playwright/test').request }): Promise<APIRequestContext> {
  const env = getLocalSupabaseEnv(), cookies = new Map<string, string>()
  const client = createServerClient(env.apiUrl, env.publishableKey, { cookies: { getAll: () => [...cookies].map(([name, value]) => ({ name, value })), setAll: values => values.forEach(v => cookies.set(v.name, v.value)) } })
  expect((await client.auth.signInWithPassword({ email: a.email, password })).error).toBeNull()
  return playwright.request.newContext({ baseURL: 'http://127.0.0.1:3162', extraHTTPHeaders: { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') } })
}
export async function login(page: Page, a: Account, f: Fixture) {
  await page.goto('/auth/login')
  await page.getByLabel('อีเมล', { exact: true }).fill(a.email)
  await page.locator('input#password').fill(password)
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
  await expect(page).not.toHaveURL(/auth\/login/)
  await page.goto(`/coach/assign-groups?month=${f.date.slice(0, 7)}`)
}
export const payload = (f: Fixture, coach: Account | null, ids = f.ids) => [{ name: 'ชุดพื้นฐาน', coachId: coach?.id || null, levelMin: 0, levelMax: 0, sortOrder: 0, studentSessionIds: ids }]
export async function save(context: APIRequestContext, f: Fixture, coach: Account | null, expected = snapshot(f), ids = f.ids) {
  return context.post('/api/coach/assignment-groups', { data: { scheduleSlotId: f.slot, branchId: f.branch, expectedGroups: expected, groups: payload(f, coach, ids) } })
}
