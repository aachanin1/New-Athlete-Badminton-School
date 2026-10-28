const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript'), assert = require('node:assert/strict')
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
const originalResolve = Module._resolveFilename
Module._resolveFilename = function (id, ...args) { return originalResolve.call(this, id.startsWith('@/') ? path.resolve('src', id.slice(2)) : id, ...args) }
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, file)
const { BookingBillSummary } = require('../src/components/dashboard/booking-bill-summary.tsx')
const { bookingSummaryRounds } = require('../src/lib/booking-summary.ts')
const checks = [], check = (ok, name) => { assert.ok(ok, name); checks.push(name) }
const data = { userName: 'ผู้ปกครอง', learners: [{ id: 'a', nickname: 'น้องเหมือน', full_name: 'เด็ก เอ' }, { id: 'b', nickname: 'น้องเหมือน', full_name: 'เด็ก บี' }], branches: [{ id: 'x', name: 'สาขา เอ' }, { id: 'y', name: 'สาขา บี' }] }
const bill = { id: 'bill-b', branch_id: 'x', branches: { name: 'สาขาตั้งต้นที่ไม่ใช่รอบจริง' }, child_id: 'b', children: data.learners[1], total_sessions: 2, total_price: 866, course_types: { name: 'kids_group' } }
const row = (id, branch_id, date, child_id = 'b') => ({ id, booking_id: bill.id, branch_id, date, child_id, start_time: '10:00:00', end_time: '11:00:00', status: 'pending' })
const ss = [row('1', 'y', '2026-10-30'), row('2', 'x', '2026-10-31')]
const render = (b, sessions, d = data) => renderToStaticMarkup(React.createElement(BookingBillSummary, { bill: b, sessions, data: d, showPrice: true }))
let html = render(bill, ss)
check(html.includes('2 รอบ · 2 สาขา') && html.includes('สาขา เอ') && html.includes('สาขา บี'), 'Cross-branch bill describes actual two branches')
check(!html.includes('สาขาตั้งต้น') && html.indexOf('สาขา บี') < html.indexOf('30 ต.ค.'), 'Round remains under its actual branch, not the bill default')
check(html.includes('น้องเหมือน - เด็ก บี') && !html.includes('เด็ก เอ'), 'Same nickname still identifies exact child with full name')
check(html.includes('฿866') && !html.includes('฿433'), 'Original bill amount is retained without invented branch pricing')
html = render({ ...bill, id: 'other-bill', child_id: 'a', total_price: 500 }, [row('3', 'x', '2026-10-31', 'a')])
check(html.includes('booking-summary-other-bill') && html.includes('฿500') && html.includes('เด็ก เอ'), 'Other bill and learner stay separate')
html = render(bill, [row('1', 'missing', '2026-10-30')])
check(html.includes('ไม่มีข้อมูลชื่อสาขา') && !html.includes('สาขาตั้งต้น'), 'Missing branch name never falls back to misleading bill branch')
const pkg = { ...bill, total_sessions: 10, total_price: 8500, course_types: { name: 'private' }, package_snapshot: { quantity: 10, validity_months: 10 }, package_participants: [null, 'b'] }
const family = [row('f1', 'y', '2026-10-30', null), row('f2', 'y', '2026-10-30', 'b')]
html = render(pkg, family)
check(html.includes('แพ็กเกจ 10 ชั่วโมง') && html.includes('เลือกวันเรียนแล้ว 1 รอบ · 1 สาขา'), 'Family participants count as one shared round; package quantity stays ten')
check(html.includes('ผู้ปกครอง') && html.includes('เด็ก บี') && html.includes('฿8,500'), 'Family exact members and full package price retained')
html = render(pkg, [])
check(html.includes('ยังไม่ได้เลือกวันเรียน') && !html.includes('สาขา เอ') && !html.includes('สาขา บี'), 'Zero scheduled package shows no invented branch')
html = render({ ...pkg, package_snapshot: { quantity: 1, validity_months: 1 }, total_sessions: 1 }, family)
check(html.includes('ใช้ได้ภายในเดือนเรียนที่เลือก') && html.includes('1 รอบ · 1 สาขา'), 'Single-unit full schedule keeps month rule and Family unit')
const many = Array.from({ length: 20 }, (_, i) => row(String(i), 'y', '2026-11-' + String(i + 1).padStart(2, '0')))
html = render({ ...bill, total_sessions: 20 }, many)
check(html.includes('20 รอบ · 1 สาขา') && html.includes('ดูอีก 17 รอบในสาขานี้') && html.includes('<details'), 'Twenty rounds remain complete behind explicit expandable details')
check(bookingSummaryRounds(family, true).count === 1 && bookingSummaryRounds(ss, false).count === 2, 'Grouping preserves shared-unit versus independent-round counting')
const root = '.playwright/booking-ux-1/ux-two-20261022'; fs.mkdirSync(root, { recursive: true }); fs.writeFileSync(root + '/summary-checks.json', JSON.stringify({ passed: checks.length, checks }, null, 2)); console.log(JSON.stringify({ passed: checks.length }))
