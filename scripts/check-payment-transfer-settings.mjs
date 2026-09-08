import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const modules = new Map()
function load(file) {
  const absolute = path.resolve(root, file)
  if (modules.has(absolute)) return modules.get(absolute).exports
  const module = { exports: {} }
  modules.set(absolute, module)
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  new Function('require', 'module', 'exports', code)((id) => {
    if (id.startsWith('@/')) return load(`src/${id.slice(2)}.ts`)
    if (id.startsWith('.')) return load(`${path.resolve(path.dirname(absolute), id)}.ts`)
    return require(id)
  }, module, module.exports)
  return module.exports
}

const { normalizePaymentTransferSettings: normalize, validateTransferAccounts: validate,
  resolveBookingTransferAccounts: resolveCards, transferAccountNumber, transferAccountDetails,
  paymentTransferReadToken } = load('src/lib/payment-settings.ts')
assert.equal(typeof resolveCards, 'function', 'pre-fix: actual settings logic must resolve the payment booking set')
const { PAYMENT_TRANSFER_DEFAULT_ACCOUNTS: defaults, PAYMENT_TRANSFER_DEFAULT_BRANCHES: branches } =
  load('src/lib/payment-transfer-defaults.ts')
let passed = 0
function check(name, action) { action(); passed += 1; console.log(`PASS ${name}`) }
const legacy = { bankName: '', accountNumber: '0000000000', accountName: '',
  branchName: 'old bank branch is not a school branch', promptPay: '', instructions: 'TEST Mode' }
const saved = (accounts = defaults) => ({ ...legacy, version: 2, revision: 'test-revision', accounts })
const booking = (id, branchId, status = 'pending_payment') => ({ id, branch_id: branchId, status })
const session = (bookingId, branchId, extra = {}) => ({ booking_id: bookingId, branch_id: branchId, status: 'scheduled', ...extra })
const singleId = branches[0].id
const sharedIds = defaults[7].branchIds
const settings = normalize(saved(), branches)
const resolve = (ids, bookings, sessions = {}, config = settings) => resolveCards(config, branches, ids, bookings, sessions)

check('eight exact Owner accounts / twelve branches / confirmed aliases', () => {
  assert.equal(defaults.length, 8); assert.equal(branches.length, 12)
  assert.equal(new Set(defaults.flatMap(a => a.branchIds)).size, 12)
  assert.equal(branches.find(b => b.slug === 'east-ville').id, '919ce092-f257-46cb-9858-35cc223371b7')
  assert.equal(branches.find(b => b.slug === 'ratchaphruek-talingchan').id, '58495e7e-7f2b-4fe4-af54-4f810b502a5d')
  const original = fs.readFileSync(path.join(root, 'DEVELOPMENT_TODO.md'), 'utf8')
    .split('## 2026-09-07 — Branch payment accounts Parking Lot registration')[1]
    .split('### PM design proposals')[0]
  for (const a of defaults) assert(original.includes(`| ${a.bankName} | \`${a.accountNumber}\` | ${a.accountName} |`))
})
check('leading zeros and digits-only copy', () => {
  assert.equal(transferAccountNumber(defaults[3].accountNumber), '0451466865')
  assert.equal(transferAccountNumber(defaults[6].accountNumber), '0970043956')
  assert.equal(transferAccountNumber(' 001-23 456 '), '00123456')
})
check('absent and legacy use defaults without mutating the original', () => {
  const before = JSON.stringify(legacy)
  for (const raw of [undefined, null, {}, legacy]) {
    const normalized = normalize(raw, branches)
    assert.equal(normalized.source, 'defaults'); assert.equal(normalized.accounts.length, 8)
  }
  assert.equal(JSON.stringify(legacy), before)
})
check('saved collection is authoritative, including empty and removed accounts', () => {
  assert.equal(settings.source, 'saved')
  assert.equal(normalize(saved([]), branches).accounts.length, 0)
  assert.equal(normalize(saved([defaults[0]]), branches).accounts.length, 1)
})
check('invalid new collection never resurrects defaults', () => {
  for (const raw of [saved(null), { version: 2 }, { accounts: [] }, { version: 3, accounts: defaults },
    saved([{ ...defaults[0], accountNumber: 123 }]), { broken: true }, [], 'bad']) {
    const normalized = normalize(raw, branches)
    assert.equal(normalized.source, 'invalid'); assert.equal(normalized.accounts.length, 0)
    assert(normalized.error)
  }
})
check('validate required fields, bank, duplicate IDs and exact existing branch IDs', () => {
  for (const accounts of [[{ ...defaults[0], accountName: '' }], [{ ...defaults[0], bankName: '' }],
    [{ ...defaults[0], branchIds: [] }], [{ ...defaults[0], branchIds: ['missing'] }],
    [{ ...defaults[0], accountNumber: '123ABC' }], [defaults[0], defaults[0]]]) {
    assert(validate(accounts, branches).error)
  }
})
check('one branch cannot be assigned to different accounts', () => {
  assert(validate([defaults[0], { ...defaults[1], branchIds: [singleId] }], branches).error)
})
check('same real bank/number with conflicting recipient evidence fails closed', () => {
  assert(validate([defaults[0], { ...defaults[0], id: 'duplicate', accountName: 'Different', branchIds: [branches[1].id] }], branches).error)
})
check('missing/duplicate roster evidence fails closed', () => {
  assert.equal(normalize(saved(), branches.slice(1)).source, 'invalid')
  assert.equal(normalize(saved(), [...branches, branches[0]]).source, 'invalid')
})
check('single Legacy booking without session rows uses its exact header branch', () => {
  const result = resolve(['a'], [booking('a', singleId)])
  assert.equal(result.cards.length, 1); assert.equal(result.issues.length, 0)
  assert.deepEqual(result.cards[0].branches.map(b => b.id), [singleId])
})
check('one booking with multiple session branches uses all sessions, excludes header-only branch', () => {
  const result = resolve(['a'], [booking('a', branches[0].id)], {
    a: [session('a', sharedIds[0]), session('a', sharedIds[1])],
  })
  assert.equal(result.cards.length, 1)
  assert.deepEqual(result.cards[0].branches.map(b => b.id).sort(), sharedIds.slice(0, 2).sort())
})
check('combined / resumed batch IDs filter every member and exclude unrelated booking', () => {
  const result = resolve(['a', 'b'], [booking('a', singleId), booking('b', sharedIds[0]), booking('outside', branches[2].id)], {
    a: [session('a', singleId)], b: [session('b', sharedIds[0])], outside: [session('outside', branches[2].id)],
  })
  assert.equal(result.cards.length, 2)
  assert(!result.cards.some(c => c.branchIds.includes(branches[2].id)))
})
check('same bank and holder with different account numbers remain separate', () => {
  const accounts = [defaults[0], { ...defaults[1], accountName: defaults[0].accountName }]
  const result = resolve(['a', 'b'], [booking('a', singleId), booking('b', defaults[1].branchIds[0])], {}, normalize(saved(accounts), branches))
  assert.equal(result.cards.length, 2)
})
check('same bank and digits merge despite display formatting, only relevant branches shown', () => {
  const accounts = [defaults[0], { ...defaults[0], id: 'shared-copy', accountNumber: '136-2694923', branchIds: [branches[1].id] }]
  const result = resolve(['a', 'b'], [booking('a', singleId), booking('b', branches[1].id)], {}, normalize(saved(accounts), branches))
  assert.equal(result.cards.length, 1); assert.equal(result.cards[0].branches.length, 2)
})
check('cancelled/expired bookings, old reschedule and cancelled/makeup sessions are excluded', () => {
  const result = resolve(['a', 'cancelled', 'expired'], [booking('a', singleId), booking('cancelled', branches[1].id, 'cancelled'), booking('expired', branches[2].id, 'expired')], {
    a: [session('a', singleId), session('a', branches[1].id, { status: 'rescheduled' }),
      session('a', branches[2].id, { status: 'cancelled' }), session('a', branches[3].id, { is_makeup: true })],
  })
  assert.equal(result.cards.length, 1); assert.equal(result.cards[0].branches.length, 1)
  assert(result.issues.length)
})
check('missing branch/session evidence is explicit and never substitutes another account', () => {
  for (const sessions of [{ a: [session('a', null)] }, { a: [session('a', 'missing')] }, { a: [session('a', singleId, { status: 'rescheduled' })] }]) {
    const result = resolve(['a'], [booking('a', singleId)], sessions)
    assert.equal(result.cards.length, 0); assert(result.issues.length)
  }
  assert(resolve(['unknown'], []).issues.length)
})
check('removed and empty accounts produce explicit missing-account messages', () => {
  const result = resolve(['a'], [booking('a', singleId)], {}, normalize(saved([]), branches))
  assert.equal(result.cards.length, 0); assert(result.issues.length)
})
check('read token is order-independent for objects and changes for every actual value edit', () => {
  assert.equal(paymentTransferReadToken({ a: 1, b: 2 }), paymentTransferReadToken({ b: 2, a: 1 }))
  assert.notEqual(paymentTransferReadToken(saved()), paymentTransferReadToken(saved([])))
  assert.notEqual(paymentTransferReadToken(legacy), paymentTransferReadToken({ ...legacy, instructions: 'changed' }))
})
check('copy full details uses the same card and omits unrelated branches and repeated total', () => {
  const card = resolve(['a'], [booking('a', sharedIds[0])]).cards[0]
  const text = transferAccountDetails(card)
  assert(text.includes('2752356176')); assert(text.includes('กุสุมา วิริยะวัฒนาพงศ์'))
  assert(text.includes(card.branches[0].name)); assert(!text.includes('ยอด'))
  assert(!text.includes(branches.find(b => b.id === sharedIds[1]).name))
})
console.log(`Payment transfer settings checks passed: ${passed}`)

// Supplemental real-component UI coverage while Docker is unavailable. Only
// navigation and the read provider are substituted. This is NOT DB/API evidence;
// real persistence, authorization and concurrency remain in History E2E.
if (process.argv.includes('--ui')) await checkComponents()

async function checkComponents() {
  const dir = path.join(root, '.playwright/branch-payment-accounts/components')
  fs.mkdirSync(dir, { recursive: true })
  const put = (name, content) => fs.writeFileSync(path.join(dir, name), content)
  put('loader.cjs', `module.exports=function(s){return require(${JSON.stringify(require.resolve('typescript'))}).transpileModule(s,{compilerOptions:{module:99,target:7,jsx:4,esModuleInterop:true},fileName:this.resourcePath}).outputText}`)
  put('navigation.js', 'export const useRouter=()=>({push(){},replace(){},refresh(){},prefetch(){}});export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);')
  put('link.jsx', "import React from 'react';export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}")
  put('image.jsx', "import React from 'react';export default function Image({fill,priority,unoptimized,...props}){return <img {...props}/>}")
  put('supabase.js', `export function createClient(){return {from(table){const q=new Proxy({}, {get(_,key){if(key==='then')return resolve=>Promise.resolve({data:table==='system_settings'?{value:window.transferRaw}:window.transferBranches,error:window.readFailure?{message:'fixture read failure'}:null}).then(resolve);if(['insert','update','delete','upsert','rpc'].includes(key))throw Error('Read fixture refuses writes');return ()=>q}});return q}}}`)
  put('entry.tsx', `
import React from 'react';import {createRoot} from 'react-dom/client';
import {HistoryClient} from '@/components/dashboard/history-client';
import {PaymentSettingsClient} from '@/components/admin/payment-settings-client';
import {PaymentTransferInstructions} from '@/components/payments/payment-transfer-card';
import {PAYMENT_TRANSFER_DEFAULT_BRANCHES as branches,PAYMENT_TRANSFER_DEFAULT_ACCOUNTS as accounts} from '@/lib/payment-transfer-defaults';
import {normalizePaymentTransferSettings} from '@/lib/payment-settings';
const raw=${JSON.stringify(legacy)};
window.transferRaw=raw;window.transferBranches=branches;window.transferAccounts=accounts;
const settings=normalizePaymentTransferSettings(raw,branches);
const make=(id,branch)=>({id,user_id:'local-user',learner_type:'self',child_id:null,branch_id:branch.id,course_type_id:'local-course',month:9,year:2027,total_sessions:2,total_price:125,status:'pending_payment',pricing_scope_id:null,pricing_revision:null,created_at:'2026-09-01T10:00:00Z',branches:{name:branch.name},course_types:{name:'kids_group'}});
const bookings=[make('a',branches[0]),make('b',branches[7])];
const sessions={a:[{id:'a1',booking_id:'a',branch_id:branches[3].id,status:'scheduled',is_makeup:false,date:'2027-09-20',start_time:'17:00',end_time:'19:00',branches:branches[3]}],b:[7,8].map(i=>({id:'b'+i,booking_id:'b',branch_id:branches[i].id,status:'scheduled',is_makeup:false,date:'2027-09-21',start_time:'17:00',end_time:'19:00',branches:branches[i]}))};
const surface=location.pathname;
const node=surface==='/admin'?<PaymentSettingsClient settings={settings} branches={branches}/>:surface==='/submitted'?<PaymentTransferInstructions settings={settings} branches={branches} bookings={bookings} payBookingIds={['a','b']} bookingSessionsMap={sessions} submitted={true}/>:<HistoryClient bookings={bookings} payments={[]} userId="local-user" bookingSessionsMap={sessions} paymentTransferSettings={settings} paymentBranches={branches}/>;
createRoot(document.getElementById('root')).render(<main className="p-4">{node}</main>);
`)
  const { webpack } = require('next/dist/compiled/webpack/webpack')
  await new Promise((resolve, reject) => webpack({ mode: 'development', target: 'web', devtool: false,
    entry: path.join(dir, 'entry.tsx'), output: { path: dir, filename: 'bundle.js' },
    resolve: { extensions: ['.tsx', '.ts', '.jsx', '.js'], alias: {
      'next/navigation$': path.join(dir, 'navigation.js'), 'next/link$': path.join(dir, 'link.jsx'),
      'next/image$': path.join(dir, 'image.jsx'), '@/lib/supabase/client$': path.join(dir, 'supabase.js'), '@': path.join(root, 'src'),
    } }, module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: path.join(dir, 'loader.cjs') }] },
  }, (error, stats) => error || stats.hasErrors() ? reject(error || Error(stats.toString({ all: false, errors: true }))) : resolve()))
  execFileSync(process.execPath, [require.resolve('tailwindcss/lib/cli.js'), '-i', 'src/app/globals.css', '-o', path.join(dir, 'style.css')], { cwd: root, stdio: 'pipe' })
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return }
    const file = req.url === '/bundle.js' ? 'bundle.js' : req.url === '/style.css' ? 'style.css' : null
    res.setHeader('Content-Type', file === 'bundle.js' ? 'text/javascript' : file ? 'text/css' : 'text/html; charset=utf-8')
    res.end(file ? fs.readFileSync(path.join(dir, file)) : '<!doctype html><html lang="th"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/bundle.js"></script></html>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const { chromium, expect } = require('@playwright/test')
  let browser
  const results = []
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true })
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] })
    for (const width of [320, 390, 1440]) {
      const page = await context.newPage()
      page.setDefaultTimeout(15000)
      await page.setViewportSize({ width, height: 800 })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
      await page.route('**/*', route => route.request().url().startsWith(base + '/') && route.request().method() === 'GET' ? route.continue() : route.abort())
      await page.goto(base + '/history')
      await page.getByRole('button', { name: /ชำระเงินรวม/ }).click()
      await expect(page.getByTestId('payment-transfer-card')).toHaveCount(2)
      await expect(page.getByTestId('payment-transfer-instructions')).toContainText('เลือกโอนยอดทั้งหมดเข้าบัญชีใดบัญชีหนึ่งด้านล่าง แล้วแนบสลิป 1 ใบ')
      const bay = page.locator('[data-account-id="bay-theparak"]')
      const shared = page.locator('[data-account-id="ttb-shared"]')
      await expect(shared.getByTestId('payment-transfer-branches')).toHaveText('สุวรรณภูมิ · รัชดา')
      await expect(page.getByTestId('payment-transfer-instructions')).not.toContainText('แจ้งวัฒนะ')
      await expect(page.getByTestId('payment-slip-total')).toHaveCount(1)
      const total = await page.getByTestId('payment-slip-total').textContent()
      for (const details of [false, true]) {
        await bay.getByRole('button', { name: details ? 'คัดลอกข้อมูลทั้งหมด' : 'คัดลอกเลขบัญชี', exact: true }).click()
        await expect(bay.getByRole('status')).toHaveText('คัดลอกแล้ว')
        const copied = await page.evaluate(() => navigator.clipboard.readText())
        if (!details) assert.equal(copied, '0451466865')
        else { assert(copied.includes('มณี พรรัตนพิทักษ์')); assert(copied.includes('เทพารักษ์')); assert(!copied.includes('สุวรรณภูมิ')) }
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      await expect(page.getByTestId('payment-slip-submit')).toBeInViewport()
      await page.screenshot({ path: path.join(dir, `history-${width}.png`), fullPage: true })
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('denied') } } }))
      await bay.getByRole('button', { name: 'คัดลอกเลขบัญชี', exact: true }).click()
      await expect(bay.getByLabel('ข้อความสำหรับคัดลอกด้วยตนเอง')).toHaveValue('0451466865')
      await expect(bay.getByRole('status')).not.toHaveText('คัดลอกแล้ว')
      await page.evaluate(() => { window.transferRaw={version:2,revision:'changed',accounts:[]}; window.dispatchEvent(new Event('focus')) })
      await expect(page.getByTestId('payment-transfer-changed')).toBeVisible()
      await expect(page.getByTestId('payment-transfer-card')).toHaveCount(0)
      await page.getByRole('button', { name: 'แสดงบัญชีรับเงินล่าสุด' }).click()
      await expect(page.getByTestId('payment-transfer-instructions')).toContainText('ยังไม่มีบัญชีรับเงิน')
      assert.equal(await page.getByTestId('payment-slip-total').textContent(), total)
      await page.goto(base + '/submitted')
      await expect(page.getByTestId('payment-transfer-submitted')).toBeVisible()
      await expect(page.getByTestId('payment-transfer-card')).toHaveCount(0)
      await expect(page.getByTestId('payment-transfer-instructions')).toHaveCount(0)
      await page.goto(base + '/admin')
      await expect(page.getByTestId('payment-settings-account')).toHaveCount(8)
      await page.locator('#transfer-recipient').fill('แบบร่างทดสอบ')
      await page.route('**/api/admin/payment-settings', route => route.fulfill({ status: 503, json: { error: 'บันทึกล้มเหลวทดสอบ' } }))
      await page.getByTestId('payment-settings-save').click()
      await expect(page.getByRole('alert')).toContainText('บันทึกล้มเหลวทดสอบ')
      await expect(page.locator('#transfer-recipient')).toHaveValue('แบบร่างทดสอบ')
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      await page.screenshot({ path: path.join(dir, `admin-${width}.png`), fullPage: true })
      // Browser reports the deliberately returned 503; all other console errors fail.
      assert.deepEqual(errors.filter(error => !/Failed to load resource:.*503/.test(error)), [])
      results.push({ width, legacyCombinedCards: 2, copySuccessAndFailure: true, changeAcknowledgement: true, noRepeatedTransfer: true, adminDraft: true, overflow: false })
      await page.close()
    }
    const evidence = { kind: 'Actual components, isolated read/transport fixtures; NOT DB persistence or Next hydration evidence',
      testedAt: new Date().toISOString(), accountDefaultsSha256: createHash('sha256').update(paymentTransferReadToken(defaults)).digest('hex'), results }
    put('result.json', JSON.stringify(evidence, null, 2))
    console.log(JSON.stringify(evidence, null, 2))
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
}
