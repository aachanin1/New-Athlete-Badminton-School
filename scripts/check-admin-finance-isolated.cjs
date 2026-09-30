// Dedicated Finance target only; no fallback credentials, shared target, or Production.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')
const { createClient } = require('@supabase/supabase-js')
const root = path.resolve(__dirname, '..')
const evidence = process.env.FINANCE_TEST_EVIDENCE
assert.ok(evidence && path.isAbsolute(evidence), 'explicit private evidence directory required')
const env = JSON.parse(fs.readFileSync(path.join(evidence, 'isolated-status.private.json'), 'utf8'))
assert.equal(env.API_URL, 'http://127.0.0.1:54121')
assert.equal(new URL(env.DB_URL).port, '54122')
const container = 'supabase_db_FinanceRead20260930'
const inspection = JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8' }))[0]
assert.equal(inspection.Config.Labels['com.supabase.cli.project'], 'FinanceRead20260930')
assert.equal(inspection.NetworkSettings.Ports['5432/tcp'][0].HostPort, '54122')
assert.equal(path.resolve(inspection.Config.Labels['com.supabase.cli.workdir']), path.resolve(evidence, 'isolated'))
const client = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const password = 'Finance-Only-UAT-2026!'
const result = { at: new Date().toISOString(), target: 'FinanceRead20260930', assertions: [] }
function sql(query) {
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'], { input: query, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).trim()
}
function check(name, action) { action(); result.assertions.push(name); console.log('PASS: ' + name) }
async function createUser(role) {
  const email = `finance-${role}@example.test`
  const existing = await client.auth.admin.listUsers()
  if (existing.error) throw existing.error
  const retained = existing.data.users.find(user => user.email === email)
  if (retained) return { id: retained.id, email }
  const r = await client.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Finance ${role}` } })
  if (r.error) throw r.error
  const update = await client.from('profiles').update({ role, full_name: `Finance ${role}` }).eq('id', r.data.user.id)
  if (update.error) throw update.error
  return { id: r.data.user.id, email }
}
async function seed() {
  assert.equal(sql('select count(*) from public.bookings;'), '0', 'fresh empty target required; never reset an existing UAT')
  const users = {}
  for (const role of ['super_admin', 'admin', 'user', 'coach']) users[role] = await createUser(role)
  fs.writeFileSync(path.join(evidence, 'uat-credentials.private.json'), JSON.stringify({ users, password }, null, 2))
  const actor = users.super_admin.id, payer = users.user.id
  sql(`BEGIN;
    INSERT INTO branches(id,name,slug) VALUES ('10000000-0000-4000-8000-000000000001','Finance Branch A','finance-a'),('10000000-0000-4000-8000-000000000002','Finance Branch B','finance-b');
    INSERT INTO course_types(id,name) VALUES ('20000000-0000-4000-8000-000000000001','kids_group'),('20000000-0000-4000-8000-000000000002','adult_group'),('20000000-0000-4000-8000-000000000003','private');
    INSERT INTO booking_pricing_scopes(id,user_id,course_type_id,lesson_year,lesson_month,currency) VALUES ('30000000-0000-4000-8000-000000000001','${payer}','20000000-0000-4000-8000-000000000001',2026,9,'THB'),('30000000-0000-4000-8000-000000000002','${payer}','20000000-0000-4000-8000-000000000001',2026,10,'THB');
    INSERT INTO bookings(id,user_id,branch_id,course_type_id,month,year,total_sessions,total_price,status,pricing_scope_id,entitlement_sessions,pricing_sequence,cumulative_sessions_before,cumulative_sessions_after,pricing_rate_snapshot,gross_price_snapshot,coupon_discount_snapshot,final_price_snapshot,pricing_revision)
      SELECT ('40000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'${payer}', CASE WHEN i%2=0 THEN '10000000-0000-4000-8000-000000000001'::uuid ELSE '10000000-0000-4000-8000-000000000002'::uuid END,'20000000-0000-4000-8000-000000000001',CASE WHEN i<=600 THEN 9 ELSE 10 END,2026,1,500,'verified',CASE WHEN i<=600 THEN '30000000-0000-4000-8000-000000000001'::uuid ELSE '30000000-0000-4000-8000-000000000002'::uuid END,1,i,i-1,i,500,500,0,500,1 FROM generate_series(1,690) i;
    INSERT INTO progressive_payment_batches(id,pricing_scope_id,user_id,status,currency,total_amount,member_count,member_set_fingerprint,pricing_scope_revision,prepare_idempotency_key,prepare_request_fingerprint,approved_at,approved_by)
      VALUES ('50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','${payer}','approved','THB',300000,600,'synthetic-finance-fixture-9',1,gen_random_uuid(),'synthetic-finance-fixture-9',now(),'${actor}'),('50000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','${payer}','approved','THB',45000,90,'synthetic-finance-fixture-10',1,gen_random_uuid(),'synthetic-finance-fixture-10',now(),'${actor}');
    INSERT INTO progressive_payment_allocations(payment_batch_id,booking_id,amount)
      SELECT CASE WHEN month=9 THEN '50000000-0000-4000-8000-000000000001'::uuid ELSE '50000000-0000-4000-8000-000000000002'::uuid END,id,500 FROM bookings;
    INSERT INTO bookings(id,user_id,branch_id,course_type_id,month,year,total_sessions,total_price,status)
      VALUES ('60000000-0000-4000-8000-000000000001','${payer}','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002',9,2026,2,1600,'verified'),
      ('60000000-0000-4000-8000-000000000002','${payer}','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003',10,2026,1,1200,'verified'),
      ('60000000-0000-4000-8000-000000000003','${payer}','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002',9,2026,1,800,'paid');
    INSERT INTO payments(booking_id,user_id,amount,status) VALUES
      ('60000000-0000-4000-8000-000000000001','${payer}',1600,'approved'),('60000000-0000-4000-8000-000000000002','${payer}',1200,'approved'),('60000000-0000-4000-8000-000000000003','${payer}',800,'pending'),('60000000-0000-4000-8000-000000000003','${payer}',50,'rejected');
    INSERT INTO finance_expenses(expense_date,category,description,amount,branch_id,created_by) VALUES ('2026-09-15','อื่นๆ','Synthetic September',1000,'10000000-0000-4000-8000-000000000001','${actor}'),('2026-10-15','อื่นๆ','Synthetic October',2000,'10000000-0000-4000-8000-000000000002','${actor}');
    INSERT INTO coach_weekly_teaching_summaries(coach_id,week_start,week_end,coach_employment_type,payable_amount,payable_hours,total_hours,closed_by) VALUES ('${users.coach.id}','2026-09-14','2026-09-20','part_time',3000,10,10,'${actor}'),('${users.coach.id}','2026-10-12','2026-10-18','part_time',4000,12,12,'${actor}');
    INSERT INTO system_settings(key,value) VALUES ('admin_menu_permissions','{"adminAllowedMenuKeys":["dashboard"]}') ON CONFLICT(key) DO UPDATE SET value=excluded.value;
    COMMIT;`)
  fs.writeFileSync(path.join(evidence, 'uat-credentials.private.json'), JSON.stringify({ users, password }, null, 2))
  fs.writeFileSync(path.join(root, '.env.local'), `NEXT_PUBLIC_SUPABASE_URL=${env.API_URL}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${env.ANON_KEY}\nSUPABASE_SERVICE_ROLE_KEY=${env.SERVICE_ROLE_KEY}\nPROGRESSIVE_PAYMENT_REVIEW_ENABLED=true\nSLIPOK_TEST_MODE=true\n`)
  check('isolated fixture: 690 approved allocations plus Legacy/expenses/closed summaries', () => assert.equal(sql("select count(*) from payment_ledger_allocations_v1 where source_kind='progressive' and status='approved';"), '690'))
}
async function reads() {
  const { loadProgressiveFinanceBookings } = await import('../src/lib/admin-finance-read.ts')
  const ledger = await client.from('payment_ledger_allocations_v1').select('*').eq('source_kind', 'progressive').eq('status', 'approved')
  if (ledger.error) throw ledger.error
  const ids = ledger.data.map(row => row.booking_id)
  const old = await client.from('bookings').select('id,total_price,month,year,total_sessions,branches(name),course_types(name),profiles!bookings_user_id_fkey(full_name,email)').in('id', ids)
  result.oldRead = { status: old.status, rows: old.data?.length, error: old.error?.message }
  const hydrated = await loadProgressiveFinanceBookings(client, ids)
  check('actual PostgREST hydration complete: 690 exact IDs', () => { assert.equal(hydrated.length, 690); assert.deepEqual(new Set(hydrated.map(row => row.id)), new Set(ids)) })
  result.sqlTotals = JSON.parse(sql(`select jsonb_object_agg(month,totals) from (select b.month, jsonb_build_object('revenue',sum(l.allocated_amount),'bookingValue',sum(b.total_price),'sessions',sum(b.total_sessions),'allocations',count(*)) totals from payment_ledger_allocations_v1 l join bookings b on b.id=l.booking_id where l.status='approved' group by b.month) s;`))
  check('independent SQL reconciles monthly Legacy + Progressive revenue', () => { assert.equal(result.sqlTotals['9'].revenue, 301600); assert.equal(result.sqlTotals['10'].revenue, 46200) })
  // Compare every serialized Finance prop with the original page. The original
  // baseline gets only a bounded transport shim, since its long URL fails.
  const ts = require('typescript'), vm = require('node:vm')
  const credentials = JSON.parse(fs.readFileSync(path.join(evidence, 'uat-credentials.private.json'), 'utf8'))
  const authenticated = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } })
  const signedIn = await authenticated.auth.signInWithPassword({ email: credentials.users.super_admin.email, password: credentials.password })
  if (signedIn.error) throw signedIn.error
  const originalService = { from(table) {
    if (table !== 'bookings') return client.from(table)
    return { select(columns) { return { async in(column, selectedIds) {
      const data = []
      for (let offset=0; offset<selectedIds.length; offset+=100) {
        const read = await client.from(table).select(columns).in(column, selectedIds.slice(offset,offset+100))
        if (read.error) return read
        data.push(...read.data)
      }
      return { data, error:null }
    } } } }
  } }
  async function pageProps(source, service) {
    const module = { exports: {} }
    const compiled = ts.transpileModule(source, { compilerOptions: { module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.ReactJSX, target:ts.ScriptTarget.ES2020 } }).outputText
    vm.runInNewContext(compiled, { module, exports:module.exports, require(name) {
      if(name==='@/lib/supabase/server') return { createClient:async()=>authenticated }
      if(name==='@/lib/auth/admin') return { getServiceRoleClient:()=>service }
      if(name==='@/lib/progressive-pricing-feature') return { isProgressivePaymentReviewEnabled:()=>true }
      if(name==='@/components/admin/finance-client') return { FinanceClient:'FinanceClient' }
      if(name==='@/lib/admin-finance-read') return { loadProgressiveFinanceBookings }
      if(name==='react/jsx-runtime') return require(name)
      throw new Error('Unexpected page dependency: '+name)
    } })
    return JSON.parse(JSON.stringify((await module.exports.default()).props))
  }
  const pagePath='src/app/(admin)/admin/finance/page.tsx'
  const original=execFileSync('git',['show','b312cda:'+pagePath],{cwd:root,encoding:'utf8'})
  const baseline=await pageProps(original,originalService)
  const corrected=await pageProps(fs.readFileSync(path.join(root,pagePath),'utf8'),client)
  check('all FinanceClient props equal original page with transport-only substitution',()=>assert.deepEqual(corrected,baseline))
  check('allocation cardinality, Legacy statuses and original money conversions preserved',()=>{
    assert.equal(corrected.payments.length,694)
    assert.equal(corrected.payments.filter(row=>row.status==='approved').reduce((sum,row)=>sum+row.amount,0),347800)
    assert.equal(corrected.payments.filter(row=>row.status==='pending').reduce((sum,row)=>sum+row.amount,0),800)
    assert.equal(corrected.payments.filter(row=>row.status==='rejected').reduce((sum,row)=>sum+row.amount,0),50)
    assert.equal(corrected.coachSummaries.reduce((sum,row)=>sum+row.payable_amount,0),7000)
    assert.equal(corrected.expenses.reduce((sum,row)=>sum+row.amount,0),3000)
  })
  const clientPath='src/components/admin/finance-client.tsx'
  check('financial formulas/UI remain byte-identical to the baseline',()=>assert.equal(fs.readFileSync(path.join(root,clientPath),'utf8').replace(/\r\n/g,'\n'),execFileSync('git',['show','b312cda:'+clientPath],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n')))
  result.propsHash=crypto.createHash('sha256').update(JSON.stringify(corrected)).digest('hex')
}
function fingerprint() {
  return sql(`select md5(string_agg(table_name||':'||digest,'|' order by table_name)) from (select 'bookings' table_name,md5(coalesce(jsonb_agg(to_jsonb(b) order by id)::text,'[]')) digest from bookings b union all select 'payments',md5(coalesce(jsonb_agg(to_jsonb(p) order by id)::text,'[]')) from payments p union all select 'allocations',md5(coalesce(jsonb_agg(to_jsonb(p) order by id)::text,'[]')) from progressive_payment_allocations p union all select 'expenses',md5(coalesce(jsonb_agg(to_jsonb(e) order by id)::text,'[]')) from finance_expenses e union all select 'summaries',md5(coalesce(jsonb_agg(to_jsonb(s) order by id)::text,'[]')) from coach_weekly_teaching_summaries s union all select 'settings',md5(coalesce(jsonb_agg(to_jsonb(s) order by id)::text,'[]')) from system_settings s) f;`)
}
async function ui() {
  const { chromium } = require('@playwright/test')
  const credentials = JSON.parse(fs.readFileSync(path.join(evidence, 'uat-credentials.private.json'), 'utf8'))
  const before = fingerprint(), browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  // A dedicated cookie hostname preserves other Owner localhost UAT sessions.
  const base = 'http://finance.localhost:3130'
  const errors = [], forbidden = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', r => { if (!['GET','HEAD'].includes(r.method()) && !r.url().includes('/auth/v1/token')) forbidden.push(r.method()+' '+r.url()) })
  async function login(role) {
    await page.context().clearCookies(); await page.goto(base+'/auth/login')
    await page.locator('input[type=email]').fill(credentials.users[role].email)
    await page.locator('input[type=password]').fill(credentials.password)
    await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
    await page.waitForURL(url => !url.pathname.startsWith('/auth'), { timeout: 30000 })
  }
  function card(label) { return page.locator('p').filter({ hasText: new RegExp('^'+label+'(?:$| )') }).first().locator('..') }
  async function expectTotals(revenue, coach, expenses, net) {
    assert.match(await card('เงินรับจริง').innerText(), new RegExp('฿'+revenue.toLocaleString('th-TH')))
    assert.match(await card('รายจ่ายโค้ช').innerText(), new RegExp('฿'+coach.toLocaleString('th-TH')))
    assert.match(await card('รายจ่ายอื่น').innerText(), new RegExp('฿'+expenses.toLocaleString('th-TH')))
    assert.match(await card('สุทธิ').innerText(), new RegExp('฿'+net.toLocaleString('th-TH')))
  }
  try {
    const anonymous = await page.goto(base+'/admin/finance'); assert.equal(new URL(page.url()).pathname, '/auth/login')
    check('anonymous Finance access remains blocked', () => assert.ok(anonymous.ok()))
    await login('super_admin'); await page.goto(base+'/admin/finance'); await page.getByText('เงินรับจริง', { exact: false }).first().waitFor()
    await expectTotals(301600,3000,1000,297600)
    check('Super Admin September actual UI reconciles revenue/coach/expenses/net', () => assert.ok(true))
    await page.screenshot({ path: path.join(evidence,'finance-desktop.png'),fullPage:true })
    await page.getByRole('button', { name: 'รายปี', exact: true }).click(); await expectTotals(347800,7000,3000,337800)
    check('annual UI reconciles all selected Legacy/Progressive totals', () => assert.ok(true))
    await page.getByRole('button', { name: 'รายเดือน', exact: true }).click()
    await page.getByRole('combobox').first().click(); await page.getByRole('option', { name:'ต.ค.', exact:true }).click(); await expectTotals(46200,4000,2000,40200)
    check('October switch preserves its own lesson-month totals', () => assert.ok(true))
    await page.getByRole('combobox').first().click(); await page.getByRole('option', { name:'ก.ย.', exact:true }).click(); await expectTotals(301600,3000,1000,297600)
    await page.reload(); await expectTotals(301600,3000,1000,297600)
    check('switch-back and reload remain complete', () => assert.ok(true))
    await page.setViewportSize({width:390,height:844}); await expectTotals(301600,3000,1000,297600)
    await page.screenshot({path:path.join(evidence,'finance-mobile.png'),fullPage:true})
    check('mobile Finance renders complete cards', () => assert.ok(true))
    await login('admin'); await page.goto(base+'/admin/finance'); check('Admin without Finance permission remains redirected', () => assert.equal(new URL(page.url()).pathname,'/admin'))
    await login('user'); await page.goto(base+'/admin/finance'); check('User remains redirected from Finance', () => assert.equal(new URL(page.url()).pathname,'/dashboard'))
    check('UI has no page errors or expense/business writes', () => {assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[])})
    check('UI leaves selected financial source rows unchanged', () => assert.equal(fingerprint(),before))
    result.before=before;result.after=fingerprint()
  } finally { await browser.close() }
}
;(async()=>{
  const mode=process.argv[2]
  if(mode==='seed') await seed()
  else if(mode==='reads') await reads()
  else if(mode==='ui') await ui()
  else throw new Error('explicit seed/reads/ui mode required')
  fs.writeFileSync(path.join(evidence,`isolated-${mode}.json`),JSON.stringify(result,null,2))
})().catch(error=>{console.error(error);process.exitCode=1})
