import { test, expect } from '@playwright/test'
import { createServerClient } from '@supabase/ssr'
import { randomUUID } from 'node:crypto'
import { account, seed, payload, password, snapshot } from '../assignment-roster/fixtures'
import { localSql as sql, sqlLiteral as q } from '../task10-regression/local-supabase'
import { lessonSourceEnvironment } from '../../scripts/verify-lesson-source-test-target.mjs'

test('new Save rolls back assignment and receipt with failed notice, then same intent completes once', async ({ playwright }) => {
  const parent = await account('user', 'ผู้ปกครองแจ้งเตือน'), head = await account('head_coach', 'หัวหน้าแจ้งเตือน'), coach = await account('coach', 'โค้ชแจ้งเตือน'), f = seed(parent, [head, coach])
  const env = lessonSourceEnvironment(), cookies = new Map<string, string>()
  const auth = createServerClient(env.apiUrl, env.publishableKey, { cookies: { getAll: () => [...cookies].map(([name,value]) => ({name,value})), setAll: rows => rows.forEach(r => cookies.set(r.name,r.value)) } })
  expect((await auth.auth.signInWithPassword({email:head.email,password})).error).toBeNull()
  const c = await playwright.request.newContext({baseURL:'http://127.0.0.1:3163',extraHTTPHeaders:{Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; ')}})
  try {
    const context = await (await c.get(`/api/coach/assignment-groups?scheduleSlotId=${f.slot}&branchId=${f.branch}`)).json()
    const data = {scheduleSlotId:f.slot,branchId:f.branch,groups:payload(f,coach),expectedGroups:context.canonicalGroups,saveContext:context.saveContext,requestId:randomUUID(),deadline:new Date(Date.now()+20_000).toISOString()}
    expect((await c.post('/api/coach/assignment-groups',{data:{...data,prepare:true}})).status()).toBe(200)
    sql(`CREATE FUNCTION assignment5_reject_notice() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.user_id=${q(coach.id)}::uuid AND NEW.title='ได้รับมอบหมายรอบสอน' THEN RAISE EXCEPTION 'ASSIGNMENT5_INJECTED_NOTICE_FAILURE'; END IF; RETURN NEW;END$$;CREATE TRIGGER assignment5_reject_notice BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION assignment5_reject_notice();`)
    try {
      expect((await c.post('/api/coach/assignment-groups',{data})).status()).toBe(500)
      expect(snapshot(f)).toEqual([])
      expect(sql(`SELECT count(*) FROM assignment5_receipts WHERE request_id=${q(data.requestId)};`)).toBe('0')
      expect(sql(`SELECT count(*) FROM activity_logs WHERE entity_id=${q(f.slot)} AND action='save_coach_assignment_groups_v2';`)).toBe('0')
    } finally { sql('DROP TRIGGER assignment5_reject_notice ON notifications;DROP FUNCTION assignment5_reject_notice();') }
    expect((await c.post('/api/coach/assignment-groups',{data})).status()).toBe(200)
    expect((await c.post('/api/coach/assignment-groups',{data})).status()).toBe(200)
    expect(snapshot(f)[0].coach_id).toBe(coach.id)
    expect(sql(`SELECT count(*) FROM notifications WHERE user_id=${q(coach.id)} AND title='ได้รับมอบหมายรอบสอน';`)).toBe('1')
    expect(sql(`SELECT count(*) FROM assignment5_receipts WHERE request_id=${q(data.requestId)};`)).toBe('1')
  } finally { await c.dispose() }
})
