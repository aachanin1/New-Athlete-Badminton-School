import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { createServerClient } from '@supabase/ssr'
import { chromium } from '@playwright/test'
import { run, env, db, sql, q } from './runtime.mjs'

export const password = 'BillPolicyLocal!2026'
export const fixture = () => JSON.parse(fs.readFileSync(path.join(run.evidenceRoot, 'fixture.json'), 'utf8'))
export const read = input => JSON.parse(sql(input))
export const rpc = (name, args) => read(`SELECT public.${name}(${args});`)
export const hashFile = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')

export async function account(role = 'user', label = 'ทดสอบบิล Local') {
  const email = `bill-policy-${randomUUID()}@example.invalid`
  const user = await db.auth.admin.createUser({ email, password, email_confirm: true })
  assert.ifError(user.error)
  const id = user.data.user.id
  assert.ifError((await db.from('profiles').update({ role, full_name: label }).eq('id', id)).error)
  return { id, email }
}

export function session(f, course, date, childId = null, start = '10:00', branchId = f.branches[0]) {
  const day = new Date(date + 'T12:00:00+07:00').getUTCDay()
  const template = f.templates.find(t => t.course === course && t.day === day && t.start === start && t.branch === branchId)
  assert.ok(template, 'Missing canonical synthetic template for ' + [course, date, start, branchId].join('|'))
  return { date, startTime: start, endTime: template.end, branchId, childId, scheduleTemplateId: template.id }
}

export function kidsInput(f, actor, sessions, bookingId = null) {
  const [year, month] = sessions[0].date.split('-').map(Number), course = f.courses.kids_group
  const scope = read(`SELECT coalesce((SELECT to_jsonb(s) FROM booking_pricing_scopes s WHERE user_id=${q(actor.id)} AND course_type_id=${q(course)} AND lesson_year=${year} AND lesson_month=${month}),'null'::jsonb)`)
  const baseline = read(`SELECT to_jsonb(x) FROM progressive_legacy_baseline_v1(${q(actor.id)},${q(course)},${year},${month}) x`)
  const policy = rpc('task10_booking_policy_quote_v1', `${q(actor.id)},${q(course)},${q(`${year}-${String(month).padStart(2, '0')}-01`)},'progressive',${q(bookingId)}`)
  return { purchasePolicyVersion: 2, learnerType: 'child', childId: sessions.every(s => s.childId === sessions[0].childId) ? sessions[0].childId : null,
    participants: [...new Set(sessions.map(s => s.childId))], branchId: sessions[0].branchId, courseTypeId: course, month, year, totalSessions: sessions.length, sessions,
    expectedScopeRevision: scope?.revision || 0, expectedLegacyBaselineSessions: Number(baseline.baseline_sessions), expectedLegacyBaselineFingerprint: baseline.baseline_fingerprint, expectedPolicyFingerprint: policy.fingerprint }
}

export function singleInput(f, actor, course, sessions, participants = [null], bookingId = null) {
  const packageId = course === 'adult_group' ? 'adult-1' : 'private-1'
  const catalog = rpc('booking_ux_catalog_v1', ''), pack = catalog.find(p => p.id === packageId)
  const unique = new Set(sessions.map(s => JSON.stringify([s.date, s.startTime, s.endTime, s.branchId]))).size
  const quote = rpc('booking_bill_package_quote_v2', `${q(actor.id)},${q(f.courses[course])},${unique},${q(packageId)},${pack.revision},${q(bookingId)}`)
  const [year, month] = sessions[0].date.split('-').map(Number)
  return { purchasePolicyVersion: 2, packageId, packageRevision: pack.revision, participants, learnerType: participants.includes(null) ? 'self' : 'child', childId: participants.length === 1 ? participants[0] : null,
    branchId: sessions[0].branchId, courseTypeId: f.courses[course], month, year, totalSessions: unique, totalAmount: quote.grossPrice, expectedTotalPrice: quote.grossPrice, sessions }
}

export const create = (actor, input, requestId = randomUUID()) => rpc('booking_ux_create_v1', `${q(actor.id)},${q(requestId)},${q(JSON.stringify(input))}::jsonb`)
export const bill = id => read(`SELECT to_jsonb(b) FROM bookings b WHERE id=${q(id)}`)
export const sessionsFor = id => read(`SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.date,s.start_time,s.child_id),'[]') FROM booking_sessions s WHERE booking_id=${q(id)}`)
export const financialSnapshot = ids => read(`SELECT jsonb_build_object('bills',(SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM bookings b WHERE id=ANY(${q('{' + ids.join(',') + '}')}::uuid[])),'payments',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]') FROM payments p WHERE booking_id=ANY(${q('{' + ids.join(',') + '}')}::uuid[])),'credits',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]') FROM lesson_wallet_credits c WHERE booking_id=ANY(${q('{' + ids.join(',') + '}')}::uuid[])),'units',(SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.id),'[]') FROM booking_package_units u WHERE booking_id=ANY(${q('{' + ids.join(',') + '}')}::uuid[])))`)

export function evidence(label, data) {
  const definitions = fs.readdirSync('tests/booking-bill-policy').filter(n => n.endsWith('.mjs')).map(n => 'tests/booking-bill-policy/' + n)
  const source = ['scripts/verify-lesson-source-test-target.mjs', 'scripts/prepare-booking-bill-policy-local.mjs', 'scripts/dev-booking-bill-policy-local.mjs', 'supabase/migrations/20261109033007_booking_bill_policy_v2.sql',
    'src/lib/booking-purchase.ts', 'src/lib/booking-pricing-policy.ts', 'src/lib/progressive-booking-preview.ts', 'src/lib/booking-package-validity.ts', 'src/lib/lesson-wallet-entitlement.ts',
    'src/components/dashboard/booking-client.tsx', 'src/components/dashboard/booking-set-editor.tsx', 'src/components/dashboard/booking-bill-summary.tsx', 'src/components/dashboard/booking-payment-client.tsx', 'src/components/dashboard/booking-package-recommendation.tsx',
    'src/app/api/bookings/preview/route.ts', 'src/app/api/booking-checkout/route.ts', 'src/app/api/admin/makeup/store-preview/route.ts']
  const definitionFiles = Object.fromEntries([...definitions, ...source].map(file => [file, hashFile(file)]))
  const schema = read("SELECT jsonb_object_agg(proname,md5(pg_get_functiondef(oid))) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('booking_ux_create_v1','booking_ux_update_v1','booking_ux_edit_set_v1','progressive_reprice_scope_v1','booking_bill_package_quote_v2','task10_booking_policy_quote_v1','booking_ux_expiry_v1','task10_previous_wallet_store_v2','admin_wallet_store_body_v1')")
  const file = path.join(run.outputDir, label + '-' + Date.now() + '-' + randomUUID() + '.json')
  fs.writeFileSync(file, JSON.stringify({ runId: run.runId, at: new Date().toISOString(), target: run.target, definitionFiles, schema, ...data }, null, 2), { flag: 'wx' })
  return file
}

export const baseUrl = process.env.BOOKING_BILL_LOCAL_BASE || 'http://127.0.0.1:63310'
assert.ok(['http://127.0.0.1:63310','http://127.0.0.1:63311'].includes(new URL(baseUrl).origin), 'Only the task-owned apps are allowed')
export async function authCookie(actor) {
  const cookies = new Map()
  const auth = createServerClient(env.apiUrl, env.publishableKey, { cookies: { getAll: () => [...cookies].map(([name, value]) => ({ name, value })), setAll: values => values.forEach(v => cookies.set(v.name, v.value)) } })
  assert.ifError((await auth.auth.signInWithPassword({ email: actor.email, password })).error)
  return [...cookies].map(([name, value]) => name + '=' + value).join('; ')
}
export async function request(cookie, route, body, options = {}) {
  const response = await fetch(baseUrl + route, { ...options, method: options.method || (body ? 'POST' : 'GET'), headers: { Cookie: cookie, Origin: baseUrl, ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...options.headers }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) })
  const result = await response.json()
  return { status: response.status, result }
}
export async function browserSession(actor, mobile = false) {
  const cookie = await authCookie(actor), browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, timezoneId: 'Asia/Bangkok', locale: 'th-TH', extraHTTPHeaders: { Origin: baseUrl } })
  await context.addCookies(cookie.split('; ').map(item => { const separator = item.indexOf('='); return { name: item.slice(0, separator), value: item.slice(separator + 1), domain: '127.0.0.1', path: '/', sameSite: 'Lax' } }))
  context.setDefaultTimeout(15000); context.setDefaultNavigationTimeout(30000)
  return { browser, context, page: await context.newPage() }
}

