// Dedicated disposable only. Never accepts a hosted URL or another task's data.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import ts from 'typescript'
import { loadProgressiveFinanceBookings, loadProgressiveFinanceAllocations, readCompleteFinanceRows, loadFinanceYears } from '../src/lib/admin-finance-read.ts'
import { getFinancePeriod, financePeriodDateRange } from '../src/lib/admin-finance-period.ts'

const require = createRequire(import.meta.url), root = process.cwd()
const evidence = process.env.FINANCE_PERIOD_EVIDENCE
assert.ok(evidence && path.isAbsolute(evidence), 'explicit evidence directory required')
const env = JSON.parse(fs.readFileSync(path.join(evidence, 'isolated-status.private.json'), 'utf8'))
const container = 'supabase_db_FinancePeriod20261102'
function identity() {
  assert.equal(env.API_URL, 'http://127.0.0.1:62501')
  assert.equal(new URL(env.DB_URL).port, '62502')
  const info = JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8' }))[0]
  assert.equal(info.Config.Labels['com.supabase.cli.project'], 'FinancePeriod20261102')
  assert.equal(path.resolve(info.Config.Labels['com.supabase.cli.workdir']), path.resolve(evidence, 'isolated'))
  assert.equal(info.NetworkSettings.Ports['5432/tcp'][0].HostPort, '62502')
}
identity()
const service = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } })
function sql(query) {
  identity()
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { input: query, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }).trim()
}
const q = value => `'${String(value).replaceAll("'", "''")}'`
const id = (prefix, n) => `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const result = { at: new Date().toISOString(), target: 'FinancePeriod20261102', assertions: [] }
function check(label, action) { action(); result.assertions.push(label); console.log('PASS: ' + label) }
function save(name, value) { fs.writeFileSync(path.join(evidence, name), JSON.stringify(value, null, 2)) }

async function seed() {
  assert.equal(sql('select count(*) from public.bookings;'), '0', 'fresh target only; never reset')
  const users = {}, password = 'Finance-Period-Only-2026!'
  const retained = fs.existsSync(path.join(evidence, 'credentials.private.json'))
    ? JSON.parse(fs.readFileSync(path.join(evidence, 'credentials.private.json'), 'utf8')).users : {}
  for (const role of ['super_admin', 'admin', 'user', 'coach']) {
    if (retained[role]) { users[role] = retained[role]; continue }
    const email = `finance-period-${role}@example.test`
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true })
    if (created.error) throw created.error
    const updated = await service.from('profiles').update({ role, full_name: `Finance Period ${role}` }).eq('id', created.data.user.id)
    if (updated.error) throw updated.error
    users[role] = { id: created.data.user.id, email }
  }
  save('credentials.private.json', { users, password })
  const actor = q(users.super_admin.id), payer = q(users.user.id)
  // Direct synthetic read fixtures only: suppress production writer triggers in
  // this transaction, never change a migration, policy or trigger definition.
  const lines = ['BEGIN; SET LOCAL session_replication_role=replica;']
  lines.push(`INSERT INTO branches(id,name,slug) VALUES (${q(id('1',1))},'Finance Period A','finance-period-a'),(${q(id('1',2))},'Finance Period B','finance-period-b');`)
  lines.push(`INSERT INTO course_types(id,name) VALUES (${q(id('2',1))},'kids_group'),(${q(id('2',2))},'adult_group'),(${q(id('2',3))},'private') ON CONFLICT DO NOTHING;`)
  const course = name => `(select id from course_types where name=${q(name)} limit 1)`
  for (const [n, year, month] of [[1,2026,11],[2,2026,10],[3,2025,11]]) {
    lines.push(`INSERT INTO booking_pricing_scopes(id,user_id,course_type_id,lesson_year,lesson_month,currency) VALUES (${q(id('3',n))},${payer},${course('kids_group')},${year},${month},'THB');`)
  }
  lines.push(`INSERT INTO bookings(id,user_id,branch_id,course_type_id,month,year,total_sessions,total_price,status,pricing_scope_id)
    SELECT ('40000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,${payer},${q(id('1',1))},${course('kids_group')},CASE WHEN i<=1201 THEN 11 WHEN i<=1311 THEN 10 ELSE 11 END,CASE WHEN i<=1311 THEN 2026 ELSE 2025 END,1,100+i%17,'verified',CASE WHEN i<=1201 THEN ${q(id('3',1))}::uuid WHEN i<=1311 THEN ${q(id('3',2))}::uuid ELSE ${q(id('3',3))}::uuid END FROM generate_series(1,1320) i;`)
  for (const n of [1,2,3]) {
    lines.push(`INSERT INTO progressive_payment_batches(id,pricing_scope_id,user_id,status,currency,total_amount,member_count,member_set_fingerprint,pricing_scope_revision,prepare_idempotency_key,prepare_request_fingerprint,prepared_expires_at,approved_at,approved_by)
      SELECT ${q(id('5',n))},${q(id('3',n))},${payer},'approved','THB',sum(total_price),count(*),'finance-period-fixture-${n}',1,gen_random_uuid(),'finance-period-fixture-${n}','2026-11-01','2026-11-01',${actor} FROM bookings WHERE pricing_scope_id=${q(id('3',n))};`)
    lines.push(`INSERT INTO progressive_payment_allocations(payment_batch_id,booking_id,amount) SELECT ${q(id('5',n))},id,total_price FROM bookings WHERE pricing_scope_id=${q(id('3',n))};`)
  }
  lines.push(`INSERT INTO bookings(id,user_id,branch_id,course_type_id,month,year,total_sessions,total_price,status)
    SELECT ('60000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,${payer},${q(id('1',2))},${course('adult_group')},11,2026,2,200+i%19,'verified' FROM generate_series(1,1201) i;`)
  lines.push(`INSERT INTO payments(booking_id,user_id,amount,status,created_at) SELECT id,user_id,total_price,'approved','2026-10-25' FROM bookings WHERE id::text LIKE '60000000%';`)
  const extras = [[1202,2026,11,0,'approved'],[1203,2026,11,800,'pending'],[1204,2026,11,50,'rejected'],[1205,2026,10,1600,'approved'],[1206,2025,11,4321,'approved']]
  for (const [n, year, month, amount, status] of extras) {
    lines.push(`INSERT INTO bookings(id,user_id,branch_id,course_type_id,month,year,total_sessions,total_price,status) VALUES (${q(id('6',n))},${payer},${q(id('1',2))},${course('private')},${month},${year},1,${amount},'${status==='approved'?'verified':'paid'}');`)
    lines.push(`INSERT INTO payments(booking_id,user_id,amount,status) VALUES (${q(id('6',n))},${payer},${amount},${q(status)});`)
  }
  lines.push(`INSERT INTO bookings(id,user_id,branch_id,course_type_id,month,year,total_sessions,total_price,status) VALUES (${q(id('6',1300))},${payer},${q(id('1',2))},${course('private')},11,2026,1,0,'verified');`)
  lines.push(`INSERT INTO finance_expenses(expense_date,category,amount,description,created_by) SELECT '2026-11-15','อื่นๆ',5+i%7,'Synthetic complete-period expense',${actor} FROM generate_series(1,1201) i;`)
  lines.push(`INSERT INTO finance_expenses(expense_date,category,amount,description,created_by) VALUES ('2026-10-15','อื่นๆ',3000,'Synthetic October',${actor}),('2025-11-15','อื่นๆ',200,'Synthetic previous year',${actor});`)
  lines.push(`INSERT INTO auth.users(id,email) SELECT ('70000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'synthetic-finance-coach-'||i||'@example.test' FROM generate_series(1,1201) i;`)
  lines.push(`INSERT INTO profiles(id,role,full_name,email) SELECT id,'coach','Synthetic Finance Coach '||row_number()over(order by id),email FROM auth.users WHERE id::text LIKE '70000000%';`)
  lines.push(`INSERT INTO coach_weekly_teaching_summaries(coach_id,week_start,week_end,coach_employment_type,payable_amount,payable_hours,total_hours,closed_by) SELECT id,'2026-11-02','2026-11-08','part_time',11,1,1,${actor} FROM profiles WHERE id::text LIKE '70000000%';`)
  lines.push(`INSERT INTO coach_weekly_teaching_summaries(coach_id,week_start,week_end,coach_employment_type,payable_amount,payable_hours,total_hours,closed_by) VALUES (${q(users.coach.id)},'2026-10-12','2026-10-18','part_time',2000,2,2,${actor}),(${q(users.coach.id)},'2025-11-03','2025-11-09','part_time',100,1,1,${actor});`)
  lines.push(`INSERT INTO system_settings(key,value) VALUES ('admin_menu_permissions','{"adminAllowedMenuKeys":["dashboard"]}') ON CONFLICT(key) DO UPDATE SET value=excluded.value; COMMIT;`)
  sql(lines.join('\n'))
  check('fresh current-schema fixture contains 1,320 Progressive allocations and >1,000 matching Legacy, expense and coach rows', () => {
    assert.equal(sql("select count(*) from payment_ledger_allocations_v1 where source_kind='progressive';"), '1320')
    assert.equal(sql("select count(*) from finance_expenses where expense_date='2026-11-15';"), '1201')
  })
}

async function authenticated() {
  const creds = JSON.parse(fs.readFileSync(path.join(evidence, 'credentials.private.json'), 'utf8'))
  const client = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } })
  const login = await client.auth.signInWithPassword({ email: creds.users.super_admin.email, password: creds.password })
  if (login.error) throw login.error
  return client
}
async function props(params, source, client, overrides = {}) {
  const module = { exports: {} }
  const compiled = ts.transpileModule(source, { compilerOptions: { module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.ReactJSX, target:ts.ScriptTarget.ES2020 } }).outputText
  vm.runInNewContext(compiled, { module, exports:module.exports, URLSearchParams, Date, require(name) {
    if(name==='@/lib/supabase/server') return { createClient:async()=>client }
    if(name==='@/lib/auth/admin') return { getServiceRoleClient:()=>service, requireAdminPageAccess:async()=>({supabase:client}), requireAdminMenuAccess:async()=>({ok:true}) }
    if(name==='@/lib/progressive-pricing-feature') return { isProgressivePaymentReviewEnabled:()=>true }
    if(name==='@/components/admin/finance-client') return { FinanceClient:'FinanceClient' }
    if(name==='@/lib/admin-finance-read') return { loadProgressiveFinanceBookings, loadProgressiveFinanceAllocations, readCompleteFinanceRows, loadFinanceYears, ...overrides }
    if(name==='@/lib/admin-finance-period') return { getFinancePeriod, financePeriodDateRange }
    if(name==='next/navigation') return { redirect:target=>{throw new Error('redirect: '+target)} }
    if(name==='react/jsx-runtime') return require(name)
    throw new Error('Unexpected page dependency: '+name)
  } })
  return JSON.parse(JSON.stringify((await module.exports.default({ searchParams: Promise.resolve(params) })).props))
}
function totals(props) {
  const approved = props.payments.filter(p=>p.status==='approved')
  const bookingValues = new Map(approved.map(p=>[p.booking_id,p.booking_net_value]))
  return { revenue:approved.reduce((s,p)=>s+p.amount,0), approvedCount:new Set(approved.map(p=>p.transaction_id)).size,
    allocations:approved.length, bookingValue:[...bookingValues.values()].reduce((s,v)=>s+v,0),
    pending:props.payments.filter(p=>p.status==='pending').reduce((s,p)=>s+p.amount,0),
    rejected:props.payments.filter(p=>p.status==='rejected').length,
    coach:props.coachSummaries.reduce((s,p)=>s+p.payable_amount,0), expenses:props.expenses.reduce((s,p)=>s+p.amount,0) }
}
function expected(period) {
  const month = period.mode==='month' ? `and b.month=${period.month}` : ''
  const range = financePeriodDateRange(period)
  return JSON.parse(sql(`select jsonb_build_object(
    'revenue',(select coalesce(sum(l.allocated_amount),0) from payment_ledger_allocations_v1 l join bookings b on b.id=l.booking_id where l.status='approved' and b.year=${period.year} ${month}),
    'approvedCount',(select count(distinct (l.source_kind,l.source_id)) from payment_ledger_allocations_v1 l join bookings b on b.id=l.booking_id where l.status='approved' and b.year=${period.year} ${month}),
    'allocations',(select count(*) from payment_ledger_allocations_v1 l join bookings b on b.id=l.booking_id where l.status='approved' and b.year=${period.year} ${month}),
    'bookingValue',(select coalesce(sum(total_price),0) from bookings b where b.year=${period.year} ${month} and exists(select 1 from payment_ledger_allocations_v1 l where l.booking_id=b.id and l.status='approved')),
    'pending',(select coalesce(sum(p.amount),0) from payments p join bookings b on b.id=p.booking_id where p.status='pending' and b.year=${period.year} ${month}),
    'rejected',(select count(*) from payments p join bookings b on b.id=p.booking_id where p.status='rejected' and b.year=${period.year} ${month}),
    'coach',(select coalesce(sum(payable_amount),0) from coach_weekly_teaching_summaries where week_start>=${q(range.start)} and week_start<${q(range.end)}),
    'expenses',(select coalesce(sum(amount),0) from finance_expenses where expense_date>=${q(range.start)} and expense_date<${q(range.end)}));`))
}
function fingerprint() {
  return sql(`select md5(string_agg(n||':'||h,'|' order by n)) from (
    select 'bookings' n,md5(jsonb_agg(to_jsonb(b) order by id)::text) h from bookings b union all
    select 'payments',md5(jsonb_agg(to_jsonb(p) order by id)::text) from payments p union all
    select 'allocations',md5(jsonb_agg(to_jsonb(p) order by payment_batch_id,booking_id)::text) from progressive_payment_allocations p union all
    select 'batches',md5(jsonb_agg(to_jsonb(p) order by id)::text) from progressive_payment_batches p union all
    select 'expenses',md5(jsonb_agg(to_jsonb(e) order by id)::text) from finance_expenses e union all
    select 'summaries',md5(jsonb_agg(to_jsonb(s) order by id)::text) from coach_weekly_teaching_summaries s union all
    select 'settings',md5(jsonb_agg(to_jsonb(s) order by id)::text) from system_settings s) t;`)
}
async function reads() {
  const client = await authenticated(), before = fingerprint()
  const source = fs.readFileSync(path.join(root,'src/app/(admin)/admin/finance/page.tsx'),'utf8')
  result.periods = {}
  for (const period of [{mode:'month',month:11,year:2026},{mode:'month',month:10,year:2026},{mode:'month',month:11,year:2025},{mode:'year',month:11,year:2026},{mode:'month',month:12,year:2026}]) {
    const actual = await props(Object.fromEntries(Object.entries(period).map(([k,v])=>[k,String(v)])),source,client)
    const key = `${period.mode}-${period.year}-${period.month}`, calculated = totals(actual), independent = expected(period)
    check(`${key}: actual selected-period Finance props equal independent SQL for money, counts, booking value and both costs`,()=>assert.deepEqual(calculated,independent))
    check(`${key}: no other lesson month/year serialized`,()=>assert.ok(actual.payments.every(p=>p.booking_year===period.year&&(period.mode==='year'||p.booking_month===period.month))))
    assert.ok(actual.availableYears.includes(2025)&&actual.availableYears.includes(2026))
    result.periods[key] = independent
  }
  const oldSource = execFileSync('git',['show','HEAD:src/app/(admin)/admin/finance/page.tsx'],{encoding:'utf8'})
  const old = await props({},oldSource,client)
  const oldNovember = {...old,payments:old.payments.filter(p=>p.booking_month===11&&p.booking_year===2026)}
  result.oldNovemberRevenue = totals(oldNovember).revenue
  check('original capped page undercounts the same >1,000-row physical fixture; corrected page matches SQL',()=>assert.ok(result.oldNovemberRevenue<result.periods['month-2026-11'].revenue))
  const originalClient = execFileSync('git',['show','HEAD:src/components/admin/finance-client.tsx'],{encoding:'utf8'}).replaceAll('\r\n','\n')
  const currentClient = fs.readFileSync(path.join(root,'src/components/admin/finance-client.tsx'),'utf8').replaceAll('\r\n','\n')
  const calculation = text=>text.slice(text.indexOf('  const filteredPayments ='),text.indexOf('  const years =')>=0?text.indexOf('  const years ='):text.indexOf('  const maxMonthlyValue =')).trim()
  check('all existing financial filters, formulas, batch deduplication and expense mutations preserved',()=> {
    assert.equal(calculation(currentClient),calculation(originalClient))
    const mutations=text=>text.slice(text.indexOf('  const handleCreateExpense'),text.indexOf('\n  return (',text.indexOf('  const handleCreateExpense')))
    assert.equal(mutations(currentClient),mutations(originalClient))
  })
  check('read harness leaves financial fixture unchanged',()=>assert.equal(fingerprint(),before))
  result.fingerprint = before
}

async function ui() {
  const { chromium } = require('@playwright/test'), creds = JSON.parse(fs.readFileSync(path.join(evidence,'credentials.private.json'),'utf8'))
  const base='http://finance-period.localhost:3132', before=fingerprint(), browser=await chromium.launch({headless:true})
  const page=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[]
  let expectedError=false
  page.on('pageerror',error=>{if(!expectedError)errors.push(error.message)})
  const card=label=>page.locator('p').filter({hasText:new RegExp('^'+label+'(?:$| )')}).first().locator('..')
  async function expectTotals(key) {
    const t=expected(key), format=n=>n.toLocaleString('th-TH')
    for(const [label,n] of [['เงินรับจริง',t.revenue],['รายจ่ายโค้ช',t.coach],['รายจ่ายอื่น',t.expenses],['สุทธิ',t.revenue-t.coach-t.expenses]]) {
      await require('@playwright/test').expect(card(label)).toContainText('฿'+format(n),{timeout:30000})
    }
    await require('@playwright/test').expect(card('รับเงินแล้ว')).toContainText(String(t.approvedCount))
  }
  async function login(role) {
    await page.context().clearCookies(); await page.goto(base+'/auth/login')
    await page.locator('input[type=email]').fill(creds.users[role].email)
    await page.locator('input[type=password]').fill(creds.password)
    await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click()
    await page.waitForURL(url=>!url.pathname.startsWith('/auth'),{timeout:30000})
  }
  const nov={mode:'month',month:11,year:2026}, oct={...nov,month:10}, old={...nov,year:2025}
  try {
    await page.goto(base+'/admin/finance?month=11&year=2026'); assert.equal(new URL(page.url()).pathname,'/auth/login')
    check('actual anonymous route blocked before financial reads',()=>assert.ok(true))
    await login('super_admin'); await page.goto(base+'/admin/finance?month=11&year=2026')
    await expectTotals(nov); await page.screenshot({path:path.join(evidence,'finance-period-desktop.png')})
    check('actual November UI >1,000 records matches SQL money and distinct receipts',()=>assert.ok(true))
    await page.getByLabel('เดือนรายงาน').click(); await page.getByRole('option',{name:'ต.ค.',exact:true}).click()
    await page.waitForURL(url=>url.searchParams.get('month')==='10'); await expectTotals(oct)
    check('month selector fetches new server period and updates URL',()=>assert.ok(true))
    await page.reload(); await expectTotals(oct); await page.goBack(); await expectTotals(nov); await page.goForward(); await expectTotals(oct)
    check('reload/back/forward keep labels, data and period aligned',()=>assert.ok(true))
    await page.getByRole('button',{name:'รายปี',exact:true}).click(); await page.waitForURL(url=>url.searchParams.get('mode')==='year'); await expectTotals({...nov,mode:'year'})
    check('annual report complete and reconciled',()=>assert.ok(true))
    await page.getByRole('button',{name:'รายเดือน',exact:true}).click(); await page.waitForURL(url=>url.searchParams.get('mode')==='month')
    await page.getByLabel('เดือนรายงาน').click(); await page.getByRole('option',{name:'พ.ย.',exact:true}).click(); await expectTotals(nov)
    await page.getByLabel('ปีรายงาน').click(); await page.getByRole('option',{name:'2568',exact:true}).click(); await page.waitForURL(url=>url.searchParams.get('year')==='2025'); await expectTotals(old)
    check('previous year includes its own payments/coach/expenses',()=>assert.ok(true))
    await page.setViewportSize({width:390,height:844}); await expectTotals(old); await page.screenshot({path:path.join(evidence,'finance-period-mobile.png')})
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth))
    check('mobile cards and selectors remain usable without horizontal overflow',()=>assert.ok(true))
    expectedError=true
    assert.equal(sql("select has_table_privilege('authenticated','public.finance_expenses','SELECT');"),'t')
    try {
      sql('REVOKE SELECT ON public.finance_expenses FROM authenticated;')
      await page.reload()
      await page.getByRole('alert').filter({hasText:'โหลดรายรับ–รายจ่ายไม่สำเร็จ'}).waitFor()
      assert.equal(await page.getByText(/^เงินรับจริง /).count(),0)
      check('actual read failure shows error instead of a partial or zero financial report',()=>assert.ok(true))
    } finally { sql('GRANT SELECT ON public.finance_expenses TO authenticated;') }
    await page.getByRole('button',{name:'ลองใหม่',exact:true}).click(); await expectTotals(old)
    expectedError=false
    check('retry re-fetches the selected report and recovers to exact SQL totals',()=>assert.ok(true))
    await login('admin'); await page.goto(base+'/admin/finance?month=11&year=2026'); assert.equal(new URL(page.url()).pathname,'/admin')
    check('Admin without Finance permission denied',()=>assert.ok(true))
    await login('user'); await page.goto(base+'/admin/finance?month=11&year=2026'); assert.equal(new URL(page.url()).pathname,'/dashboard')
    check('ordinary User Finance access denied',()=>assert.ok(true))
    check('browser renders without page errors',()=>assert.deepEqual(errors,[]))
    check('browser read/navigation changes no financial rows or settings',()=>assert.equal(fingerprint(),before))
  } finally { await browser.close() }
}

try {
  const action=process.argv[2]
  if(action==='seed') await seed()
  else if(action==='reads') await reads()
  else if(action==='ui') await ui()
  else throw new Error('Expected seed, reads or ui')
  save(`${action}-results.json`, result)
} catch(error) { save(`${process.argv[2]}-failure-${randomUUID()}.json`,{...result,error:String(error),stack:error.stack}); throw error }
