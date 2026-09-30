import { test, expect, type APIRequest, type APIRequestContext, type Page } from '@playwright/test'
import { createServerClient } from '@supabase/ssr'
import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createLocalAdmin, getLocalSupabaseEnv } from '../booking-regression/local-supabase'
import { localSql, holdLocalTransaction, sqlLiteral } from '../task10-regression/local-supabase'
import { lessonSourceRun, verifyLessonSourceTarget, lessonSourceFetch } from '../../scripts/verify-lesson-source-test-target.mjs'
import { loadProgressiveFinanceBookings } from '../../src/lib/admin-finance-read'

type Account = { id: string; email: string }
type Fixture = { owner: Account; booking: string; branch: string; course: string; slot: string; ids: string[]; children: (string | null)[]; date: string }
const password = 'IsolatedSet1Only!20260930'
let actor: Account, coach: Account, owner: Account, adminApi: APIRequestContext
const contexts: APIRequestContext[] = []
const q = sqlLiteral
const db = () => createLocalAdmin()
async function account(role: 'user' | 'super_admin' | 'coach', label = 'Set1 isolated') {
  const email = `set1-${randomUUID()}@example.com`
  const created = await db().auth.admin.createUser({ email, password, email_confirm: true })
  expect(created.error).toBeNull()
  const id = created.data.user!.id
  expect((await db().from('profiles').update({ role, full_name: label }).eq('id', id)).error).toBeNull()
  return { id, email }
}
async function api(a: Account, playwright: { request: APIRequest }, baseURL: string) {
  const env = getLocalSupabaseEnv(), cookies = new Map<string, string>()
  const auth = createServerClient(env.apiUrl, env.publishableKey, { global: { fetch: lessonSourceFetch }, cookies: { getAll: () => [...cookies].map(([name, value]) => ({ name, value })), setAll: values => values.forEach(v => cookies.set(v.name, v.value)) } })
  expect((await auth.auth.signInWithPassword({ email: a.email, password })).error).toBeNull()
  const context = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Connection: 'close', Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') } })
  contexts.push(context)
  return context
}
function seed(family = false, future = false, parent = owner): Fixture {
  verifyLessonSourceTarget()
  const [booking, branch, template, slot] = Array.from({ length: 4 }, () => randomUUID())
  const course = localSql(`SELECT id FROM course_types WHERE name=${q(family ? 'private' : 'adult_group')};`)
  const date = localSql(future ? "SELECT (clock_timestamp() AT TIME ZONE 'Asia/Bangkok'+interval '4 days')::date;" : "SELECT CASE WHEN extract(day FROM clock_timestamp() AT TIME ZONE 'Asia/Bangkok')>1 THEN (clock_timestamp() AT TIME ZONE 'Asia/Bangkok'-interval '1 day')::date ELSE (clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date END;")
  const children = family ? [null, randomUUID(), randomUUID()] : [null]
  const ids = children.map(() => randomUUID())
  localSql(`BEGIN; SELECT set_config('lesson_source.write','authorized',true); SELECT set_config('task10.source_write','authorized',true);
    SELECT set_config('task10.payment_write','authorized',true);
    INSERT INTO branches(id,name,slug) VALUES('${branch}','Set1 isolated ${branch}','set1-${branch}');
    ${children.filter(Boolean).map((id, index) => `INSERT INTO children(id,parent_id,full_name) VALUES('${id}','${parent.id}','Set1 participant ${index + 1}');`).join('\n')}
    INSERT INTO bookings(id,user_id,learner_type,branch_id,course_type_id,month,year,total_sessions,total_price,status)
      VALUES('${booking}','${parent.id}','self','${branch}','${course}',extract(month FROM date '${date}'),extract(year FROM date '${date}'),1,500,'verified');
    INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active)
      VALUES('${template}','${branch}','${course}',extract(dow FROM date '${date}'),'00:00','01:00',true);
    INSERT INTO schedule_slots(id,template_id,branch_id,course_type_id,date,start_time,end_time,max_students,current_students,status)
      VALUES('${slot}','${template}','${branch}','${course}','${date}','00:00','01:00',1,${ids.length},'open');
    ${ids.map((id, i) => `INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup)
      VALUES('${id}','${booking}','${slot}','${date}','00:00','01:00','${branch}',${children[i] ? q(children[i]!) : 'NULL'},'scheduled',false);`).join('\n')}
    INSERT INTO payments(booking_id,user_id,amount,status,verified_at) VALUES('${booking}','${parent.id}',500,'approved',clock_timestamp());
    INSERT INTO pricing_tiers(course_type_id,min_sessions,max_sessions,price_per_session,package_price,valid_from)
      SELECT '${course}',1,1,500,500,'2020-01-01' WHERE NOT EXISTS(SELECT 1 FROM pricing_tiers WHERE course_type_id='${course}'); COMMIT;`)
  return { owner: parent, booking, branch, course, slot, ids, children, date }
}
function destination(f: Fixture, makeup = false, offset = 1) {
  if (![1, 2, 3].includes(offset)) throw new Error('Unexpected synthetic destination offset')
  const targetDate = makeup ? localSql(`SELECT (date_trunc('month',date '${f.date}')+interval '1 month 3 days')::date;`) : localSql(`SELECT ('${f.date}'::date+${offset})::date;`)
  const template = randomUUID()
  localSql(`INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active)
    VALUES('${template}','${f.branch}','${f.course}',extract(dow FROM date '${targetDate}'),'12:00','13:00',true);`)
  return { targetDate, startTime: '12:00', endTime: '13:00', branchId: f.branch, scheduleTemplateId: template }
}
const financial = () => localSql(`BEGIN READ ONLY; SELECT md5(jsonb_build_object(
  'bookings',(SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM bookings b),
  'payments',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM payments p),
  'allocations',(SELECT jsonb_agg(to_jsonb(a) ORDER BY payment_batch_id,booking_id) FROM progressive_payment_allocations a),
  'expenses',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM finance_expenses e),
  'payroll',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM coach_weekly_teaching_summaries p),
  'coupons',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM coupon_usages c))::text); COMMIT;`)
function state(f: Fixture) {
  return JSON.parse(localSql(`SELECT jsonb_build_object('credits',(SELECT count(*) FROM lesson_wallet_credits WHERE booking_id='${f.booking}'),
    'members',(SELECT count(*) FROM lesson_wallet_credit_members m JOIN lesson_wallet_credits c ON c.id=m.credit_id WHERE c.booking_id='${f.booking}'),
    'attendance',(SELECT count(*) FROM attendance a JOIN booking_sessions s ON s.id=a.booking_session_id WHERE s.booking_id='${f.booking}'),
    'descendants',(SELECT count(*) FROM booking_sessions WHERE rescheduled_from_id=ANY(ARRAY[${f.ids.map(q).join(',')}]::uuid[])),
    'operations',(SELECT count(*) FROM lesson_source_operations WHERE unit_id=ANY(ARRAY[${f.ids.map(q).join(',')}]::uuid[])));`))
}
async function login(page: Page, a: Account) {
  await page.goto('/auth/login')
  await page.locator('#email').fill(a.email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
  await page.waitForURL(a.id === owner.id ? /\/dashboard/ : /\/admin/)
}
test.beforeAll(async ({ playwright, baseURL }) => {
  localSql(`CREATE OR REPLACE FUNCTION public.task10_clock_v1() RETURNS timestamptz LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $$ SELECT clock_timestamp() $$;
    CREATE OR REPLACE FUNCTION public.task10_transaction_start_v1() RETURNS timestamptz LANGUAGE sql STABLE SET search_path=pg_catalog AS $$ SELECT transaction_timestamp() $$;`)
  actor = await account('super_admin', 'Set1 Super Admin')
  coach = await account('coach', 'Set1 Coach')
  owner = await account('user', 'Set1 Family Parent')
  adminApi = await api(actor, playwright, baseURL!)
  writeFileSync(resolve(lessonSourceRun().outputDir, `uat-accounts-${randomUUID()}.private.json`), JSON.stringify({ actor, coach, owner, password }, null, 2), { flag: 'wx' })
})
test.afterAll(async ({ playwright, baseURL }) => {
  if (process.env.LESSON_SOURCE_RETAIN_FIXTURE) {
    // Only the final owned disposable run retains fresh, unused Owner UAT rights.
    const reschedule = seed(false, true), familyStore = seed(true, true), familyRedeem = seed(true, true)
    const returned = seed(true), makeup = seed(), attendance = seed(false, false, await account('user', 'Set1 independent learner'))
    const userApi = await api(owner, playwright, baseURL!)
    const response = await userApi.post('/api/lesson-wallet', { data: { action: 'store', sessionId: familyRedeem.ids[0] } })
    expect(response.status()).toBe(200)
    const stored = await response.json()
    // Independent target dates preserve cross-course overlap protection during UAT.
    const targets = { reschedule: destination(reschedule), familyStore: destination(familyStore, false, 2), familyRedeem: destination(familyRedeem, false, 3), makeup: destination(makeup, true) }
    const uatCoach = await account('coach', 'Set1 UAT Coach')
    localSql(`INSERT INTO coach_assignments(coach_id,schedule_slot_id,assigned_by) VALUES('${uatCoach.id}','${attendance.slot}','${actor.id}');
      INSERT INTO coach_checkins(coach_id,schedule_slot_id,branch_id,photo_url,location_lat,location_lng) VALUES('${uatCoach.id}','${attendance.slot}','${attendance.branch}','http://127.0.0.1/synthetic-checkin.png',13,100);`)
    for (const [name, fixture] of Object.entries({ reschedule, familyStore, familyRedeem, returned, makeup, attendance })) localSql(`UPDATE branches SET name=${q('Set1 UAT ' + name)} WHERE id='${fixture.branch}';`)
    writeFileSync(resolve(process.env.LESSON_SOURCE_OUTPUT_DIR!, 'owner-uat.private.json'), JSON.stringify({ at: new Date().toISOString(), actor, owner, coach: uatCoach, password, fixtures: { reschedule, familyStore, familyRedeem, returned, makeup, attendance }, targets, familyRedeemCredit: stored, financialHash: financial() }, null, 2), { flag: 'wx' })
  }
  for (const context of contexts) await context.dispose()
})

for (const concurrency of [1, 2, 5, 10]) {
  test(`Mixed independent families: ${concurrency} actual API requests`, async ({ playwright, baseURL }, info) => {
    test.setTimeout(300_000)
    const prepared = []
    for (let i = 0; i < concurrency; i++) {
      const operation = ['return', 'attendance', 'reschedule', 'store', 'redeem', 'makeup'][i % 6]
      const parent = await account('user'), f = seed(false, ['store', 'redeem', 'reschedule'].includes(operation), parent)
      const userApi = ['store', 'redeem', 'reschedule'].includes(operation) ? await api(parent, playwright, baseURL!) : adminApi
      const target = ['reschedule', 'redeem', 'makeup'].includes(operation) ? destination(f, operation === 'makeup') : null
      let creditId = ''
      if (operation === 'redeem') { const stored = await userApi.post('/api/lesson-wallet', { data: { action: 'store', sessionId: f.ids[0] } }); expect(stored.status()).toBe(200); creditId = (await stored.json()).creditId }
      const request = () => operation === 'return' ? adminApi.patch('/api/admin/makeup', { data: { action: 'return_entitlement', session_id: f.ids[0], reason: 'Mixed isolated acceptance' } })
        : operation === 'attendance' ? adminApi.post('/api/coach/attendance', { data: { bookingSessionId: f.ids[0], studentId: parent.id, studentType: 'adult', status: 'present' } })
          : operation === 'makeup' ? adminApi.post('/api/admin/makeup', { data: { booking_id: f.booking, original_session_id: f.ids[0], makeup_date: target!.targetDate, start_time: target!.startTime, end_time: target!.endTime, branch_id: f.branch } })
            : operation === 'reschedule' ? userApi.post('/api/reschedule', { data: { sessionId: f.ids[0], ...target } })
              : userApi.post('/api/lesson-wallet', { data: operation === 'store' ? { action: 'store', sessionId: f.ids[0] } : { action: 'redeem', creditId, ...target } })
      prepared.push({ operation, f, request })
    }
    const before = financial(), source = prepared.filter(p => p.operation !== 'attendance')
    const barrier = await holdLocalTransaction(source.map(p => `SELECT pg_advisory_xact_lock(hashtextextended('lesson-source-attendance-parent-v2|${p.f.owner.id}',0));`).join('\n'), `mixed-${randomUUID()}`)
    const start = Date.now(), pending = prepared.map(async p => { const began = Date.now(), response = await p.request(); return { operation: p.operation, status: response.status(), elapsedMs: Date.now() - began, body: await response.json(), fixture: p.f } })
    let observed = 0
    try { await expect.poll(() => { observed = Number(localSql("SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%lesson_source_transition_v1%' AND pid<>pg_backend_pid();")); return observed }).toBe(source.length) } finally { await barrier.finish() }
    const results = await Promise.all(pending)
    await info.attach('mixed-api-db-evidence', { body: JSON.stringify({ concurrency, observedSourceWaiters: observed, elapsedMs: Date.now() - start, results: results.map(r => ({ ...r, state: state(r.fixture) })) }, null, 2), contentType: 'application/json' })
    expect(results.map(r => r.status)).toEqual(prepared.map(() => 200))
    for (const result of results) {
      const actual = state(result.fixture)
      expect(actual.attendance).toBe(result.operation === 'attendance' ? 1 : 0)
      expect(actual.credits).toBe(['return', 'store', 'redeem'].includes(result.operation) ? 1 : 0)
      expect(actual.descendants).toBe(['reschedule', 'redeem', 'makeup'].includes(result.operation) ? 1 : 0)
    }
    expect(financial()).toBe(before)
  })
  test(`Same Family source: ${concurrency} contenders commit one complete unit`, async ({}, info) => {
    const f = seed(true), before = financial()
    const held = await holdLocalTransaction(`SELECT pg_advisory_xact_lock(hashtextextended('lesson-source-attendance-parent-v2|${owner.id}',0));`, `same-${randomUUID()}`)
    const pending = Array.from({ length: concurrency }, (_, i) => adminApi.patch('/api/admin/makeup', { data: { action: 'return_entitlement', session_id: f.ids[i % 3], reason: `Distinct contender ${i}` } }))
    try { await expect.poll(() => Number(localSql("SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%lesson_source_transition_v1%' AND pid<>pg_backend_pid();"))).toBe(concurrency) } finally { await held.finish() }
    const results = await Promise.all(pending), statuses = results.map(r => r.status())
    await info.attach('same-source-results', { body: JSON.stringify({ concurrency, statuses, state: state(f), bodies: await Promise.all(results.map(r => r.json())) }), contentType: 'application/json' })
    expect(statuses.filter(s => s === 200)).toHaveLength(1)
    expect(statuses.filter(s => s === 409)).toHaveLength(concurrency - 1)
    expect(state(f)).toMatchObject({ credits: 1, members: 3, attendance: 0, descendants: 0, operations: 1 })
    expect(localSql(`SELECT count(*) FROM lesson_wallet_credit_members m JOIN booking_sessions s ON s.id=m.original_session_id WHERE s.booking_id='${f.booking}' AND m.child_id IS NOT DISTINCT FROM s.child_id;`)).toBe('3')
    expect(financial()).toBe(before)
  })
  test(`Same family distinct sources: ${concurrency} requests serialize without losing entitlement`, async ({}, info) => {
    const fixtures = Array.from({ length: concurrency }, () => seed()), before = financial()
    const held = await holdLocalTransaction(`SELECT pg_advisory_xact_lock(hashtextextended('lesson-source-attendance-parent-v2|${owner.id}',0));`, `family-${randomUUID()}`)
    const pending = fixtures.map(f => adminApi.patch('/api/admin/makeup', { data: { action: 'return_entitlement', session_id: f.ids[0], reason: 'Distinct family sources' } }))
    try { await expect.poll(() => Number(localSql("SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%lesson_source_transition_v1%' AND pid<>pg_backend_pid();"))).toBe(concurrency) } finally { await held.finish() }
    const results = await Promise.all(pending)
    expect(results.map(r => r.status())).toEqual(fixtures.map(() => 200))
    for (const f of fixtures) expect(state(f)).toMatchObject({ credits: 1, members: 1, attendance: 0, operations: 1 })
    expect(financial()).toBe(before)
    await info.attach('same-family-distinct-results', { body: JSON.stringify({ concurrency, statuses: results.map(r => r.status()), states: fixtures.map(state) }), contentType: 'application/json' })
  })
}

test('Shared slot: retrospective holds B while source A conflicts safely and unrelated C succeeds', async ({}, info) => {
  const a = seed(), b = seed(false, false, await account('user')), c = seed(false, false, await account('user'))
  localSql(`BEGIN; SELECT set_config('lesson_source.write','authorized',true); SELECT set_config('task10.source_write','authorized',true);
    UPDATE bookings SET branch_id='${a.branch}' WHERE id='${b.booking}';
    UPDATE booking_sessions SET branch_id='${a.branch}',schedule_slot_id='${a.slot}' WHERE id='${b.ids[0]}'; COMMIT;`)
  const before = financial(), aBefore = state(a)
  const held = await holdLocalTransaction(`SELECT public.admin_apply_retrospective_assignment_transition_v1('mark_attendance','${a.slot}','${actor.id}','${coach.id}',ARRAY['${b.ids[0]}']::uuid[],NULL,'Shared slot acceptance',${q(JSON.stringify({ [b.ids[0]]: 'present' }))}::jsonb,NULL);`, `shared-slot-${randomUUID()}`)
  try {
    const responses = await Promise.all([
      adminApi.patch('/api/admin/makeup', { data: { action: 'return_entitlement', session_id: a.ids[0], reason: 'Shared slot acceptance' } }),
      adminApi.post('/api/coach/attendance', { data: { bookingSessionId: c.ids[0], studentId: c.owner.id, studentType: 'adult', status: 'present' } }),
    ])
    expect(responses.map(r => r.status())).toEqual([409, 200])
    expect(await responses[0].json()).toMatchObject({ code: 'LESSON_SOURCE_RETRY' })
    expect(state(a)).toEqual(aBefore)
  } finally { await held.finish() }
  expect(state(b).attendance).toBe(1); expect(state(c).attendance).toBe(1)
  const retry = await adminApi.patch('/api/admin/makeup', { data: { action: 'return_entitlement', session_id: a.ids[0], reason: 'Shared slot acceptance' } })
  expect(retry.status()).toBe(200); expect(state(a).credits).toBe(1)
  expect(financial()).toBe(before)
  await info.attach('shared-slot-reconciliation', { body: JSON.stringify({ a: state(a), b: state(b), c: state(c), rejectedBeforeWrite: true, explicitRetryPassed: true }), contentType: 'application/json' })
})

test('Opposite slot directions: two families cannot form a source-slot lock cycle', async ({ playwright, baseURL }, info) => {
  const a = seed(false, true, await account('user')), b = seed(false, true, await account('user'))
  const bApi = await api(b.owner, playwright, baseURL!)
  const templateA = localSql(`SELECT template_id FROM schedule_slots WHERE id='${a.slot}';`)
  const templateB = localSql(`SELECT template_id FROM schedule_slots WHERE id='${b.slot}';`)
  const aTarget = { targetDate: b.date, startTime: '00:00', endTime: '01:00', branchId: b.branch, templateId: templateB }
  const bTarget = { targetDate: a.date, startTime: '00:00', endTime: '01:00', branchId: a.branch, scheduleTemplateId: templateA }
  const before = financial(), beforeB = state(b)
  const held = await holdLocalTransaction(`SELECT lesson_source_transition_v1('${a.owner.id}','reschedule','${a.ids[0]}',${q(JSON.stringify(aTarget))}::jsonb);`, `opposite-${randomUUID()}`)
  try {
    const response = await bApi.post('/api/reschedule', { data: { sessionId: b.ids[0], ...bTarget } })
    expect(response.status()).toBe(409); expect(await response.json()).toMatchObject({ code: 'LESSON_SOURCE_RETRY' })
    expect(state(b)).toEqual(beforeB)
  } finally { await held.finish() }
  expect((await bApi.post('/api/reschedule', { data: { sessionId: b.ids[0], ...bTarget } })).status()).toBe(200)
  expect(state(a).descendants).toBe(1); expect(state(b).descendants).toBe(1)
  expect(financial()).toBe(before)
  await info.attach('opposite-slot-reconciliation', { body: JSON.stringify({ a: state(a), b: state(b), explicitRetryPassed: true }), contentType: 'application/json' })
})

test('UI: Family wallet and Admin source/attendance screens reload truthfully', async ({ page, playwright, baseURL }, info) => {
  const f = seed(true, true), userApi = await api(owner, playwright, baseURL!)
  const before = financial()
  const stored = await userApi.post('/api/lesson-wallet', { data: { action: 'store', sessionId: f.ids[1] } })
  expect(stored.status()).toBe(200)
  expect(state(f)).toMatchObject({ credits: 1, members: 3 })
  await login(page, owner)
  await page.goto('/dashboard/lesson-wallet')
  await expect(page.locator('body')).toContainText('Set1 participant 1')
  await expect(page.locator('body')).toContainText('Set1 participant 2')
  await page.reload()
  await expect(page.locator('body')).toContainText('Set1 participant 1')
  await info.attach('family-wallet-ui', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  const target = destination(f), redeemed = await userApi.post('/api/lesson-wallet', { data: { action: 'redeem', creditId: (await stored.json()).creditId, ...target } })
  expect(redeemed.status()).toBe(200)
  expect(state(f).descendants).toBe(3)
  await page.goto('/dashboard/schedule')
  await expect(page.getByRole('heading', { name: /ตารางเรียน/ }).first()).toBeVisible()
  await page.context().clearCookies()
  await login(page, actor)
  await page.goto('/admin/makeup')
  await expect(page.getByRole('tab').first()).toBeVisible()
  await page.reload()
  await expect(page.getByRole('tab').first()).toBeVisible()
  await info.attach('admin-makeup-ui', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  expect(financial()).toBe(before)
})

test('Finance retained baseline: 690 exact Progressive bills reconcile and month/year/reload UI loads', async ({ page }, info) => {
  const payer = await account('user'), branch = randomUUID(), scope = randomUUID(), batch = randomUUID()
  const course = localSql("SELECT id FROM course_types WHERE name='kids_group';")
  const month = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', month: 'numeric' }).format(new Date())
  const year = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric' }).format(new Date())
  localSql(`BEGIN; SELECT set_config('task10.booking_write','authorized',true); SELECT set_config('task10.payment_write','authorized',true); SELECT set_config('task10.source_write','authorized',true);
    -- Synthetic historical approved bills have no invented Task10 origin evidence.
    -- Preserve and restore the exact disposable policy within this transaction.
    SELECT pg_advisory_xact_lock(10,1);
    CREATE TEMP TABLE lesson_source_finance_fixture_policy ON COMMIT DROP AS SELECT * FROM task10_policy_activation;
    UPDATE task10_policy_activation SET state='never_activated',effective_at=NULL,pricing_enabled=false,makeup_enabled=false,expiry_enabled=false;
    INSERT INTO branches(id,name,slug) VALUES('${branch}','Set1 Finance fixture','set1-finance-${branch}');
    INSERT INTO booking_pricing_scopes(id,user_id,course_type_id,lesson_year,lesson_month,currency) VALUES('${scope}','${payer.id}','${course}',${year},${month},'THB');
    INSERT INTO bookings(id,user_id,branch_id,course_type_id,month,year,total_sessions,total_price,status,pricing_scope_id,entitlement_sessions,pricing_sequence,cumulative_sessions_before,cumulative_sessions_after,pricing_rate_snapshot,gross_price_snapshot,coupon_discount_snapshot,final_price_snapshot,pricing_revision)
      SELECT gen_random_uuid(),'${payer.id}','${branch}','${course}',${month},${year},1,500,'verified','${scope}',1,i,i-1,i,500,500,0,500,1 FROM generate_series(1,690) i;
    INSERT INTO progressive_payment_batches(id,pricing_scope_id,user_id,status,currency,total_amount,member_count,member_set_fingerprint,pricing_scope_revision,prepare_idempotency_key,prepare_request_fingerprint,approved_at,approved_by)
      VALUES('${batch}','${scope}','${payer.id}','approved','THB',345000,690,'set1-finance-fixture',1,gen_random_uuid(),'set1-finance-fixture',now(),'${actor.id}');
    INSERT INTO progressive_payment_allocations(payment_batch_id,booking_id,amount) SELECT '${batch}',id,500 FROM bookings WHERE pricing_scope_id='${scope}';
    UPDATE task10_policy_activation a SET state=p.state,effective_at=p.effective_at,pricing_enabled=p.pricing_enabled,makeup_enabled=p.makeup_enabled,expiry_enabled=p.expiry_enabled FROM lesson_source_finance_fixture_policy p;
    DO $fixture$ BEGIN IF (SELECT to_jsonb(a) FROM task10_policy_activation a) IS DISTINCT FROM (SELECT to_jsonb(p) FROM lesson_source_finance_fixture_policy p) THEN RAISE EXCEPTION 'FIXTURE_POLICY_DRIFT'; END IF; END $fixture$;
    COMMIT;`)
  const ledger = await db().from('payment_ledger_allocations_v1').select('booking_id,allocated_amount').eq('source_kind', 'progressive').eq('status', 'approved').eq('user_id', payer.id)
  expect(ledger.error).toBeNull(); expect(ledger.data).toHaveLength(690)
  const hydrated = await loadProgressiveFinanceBookings(db(), ledger.data!.map(r => r.booking_id))
  expect(hydrated).toHaveLength(690)
  expect(new Set(hydrated.map(r => r.id))).toEqual(new Set(ledger.data!.map(r => r.booking_id)))
  expect(Number(localSql(`SELECT sum(allocated_amount) FROM payment_ledger_allocations_v1 WHERE user_id='${payer.id}' AND status='approved';`))).toBe(345000)
  const expectedYearRevenue = Number(localSql(`SELECT coalesce(sum(l.allocated_amount),0) FROM payment_ledger_allocations_v1 l JOIN bookings b ON b.id=l.booking_id WHERE b.year=${year} AND l.status='approved';`))
  const expectedMonthRevenue = Number(localSql(`SELECT coalesce(sum(l.allocated_amount),0) FROM payment_ledger_allocations_v1 l JOIN bookings b ON b.id=l.booking_id WHERE b.year=${year} AND b.month=${month} AND l.status='approved';`))
  const costs = JSON.parse(localSql(`SELECT jsonb_build_object('month',(SELECT coalesce(sum(amount),0) FROM finance_expenses WHERE extract(year FROM expense_date)=${year} AND extract(month FROM expense_date)=${month})+(SELECT coalesce(sum(payable_amount),0) FROM coach_weekly_teaching_summaries WHERE status='closed' AND extract(year FROM week_start)=${year} AND extract(month FROM week_start)=${month}),'year',(SELECT coalesce(sum(amount),0) FROM finance_expenses WHERE extract(year FROM expense_date)=${year})+(SELECT coalesce(sum(payable_amount),0) FROM coach_weekly_teaching_summaries WHERE status='closed' AND extract(year FROM week_start)=${year}));`))
  const before = financial()
  await login(page, actor)
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto('/admin/finance')
  await expect(page.getByRole('heading', { name: 'รายรับ-รายจ่าย' })).toBeVisible()
  await expect(page.getByText(/^เงินรับจริง /).locator('..')).toContainText(`฿${expectedMonthRevenue.toLocaleString('en-US')}`)
  await expect(page.getByText('สุทธิ', { exact: true }).locator('..')).toContainText(`฿${(expectedMonthRevenue - costs.month).toLocaleString('en-US')}`)
  await expect(page.locator('body')).not.toContainText('This page couldn’t load')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'รายรับ-รายจ่าย' })).toBeVisible()
  await page.getByRole('button', { name: 'รายปี', exact: true }).click()
  await expect(page.getByText(/^เงินรับจริง /).locator('..')).toContainText(`฿${expectedYearRevenue.toLocaleString('en-US')}`)
  await expect(page.getByText('สุทธิ', { exact: true }).locator('..')).toContainText(`฿${(expectedYearRevenue - costs.year).toLocaleString('en-US')}`)
  await page.getByRole('button', { name: 'รายเดือน', exact: true }).click()
  await page.getByRole('combobox').first().click()
  await page.getByRole('option').first().click()
  await page.reload()
  expect(errors).toEqual([])
  expect(financial()).toBe(before)
  await info.attach('finance-retained-baseline', { body: JSON.stringify({ progressiveBills: hydrated.length, isolatedProgressiveRevenue: 345000, expectedMonthRevenue, expectedYearRevenue, costs, browserErrors: errors }), contentType: 'application/json' })
  await info.attach('finance-ui', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
})
