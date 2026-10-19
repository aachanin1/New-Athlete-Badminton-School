import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { expect } from '@playwright/test'
import { run, sql, q } from '../tests/admin-makeup-review/runtime.mjs'
import { adminBrowser, fixture as f } from '../tests/admin-makeup-review/browser.mjs'
const base = 'http://127.0.0.1:3144', root = path.join(run.outputDir, 'baseline-' + Date.now()); fs.mkdirSync(root)
const { browser, context, page } = await adminBrowser(base), timings = [], requests = [], snapshots = [], started = performance.now()
const url = query => '/api/admin/makeup/queue?' + new URLSearchParams({ month: f.month, mode: 'review', pageSize: '50', ...query })
async function get(query) { const start = performance.now(), r = await context.request.get(base + url(query)); assert.equal(r.status(), 200, await r.text()); const text = await r.text(); return { data: JSON.parse(text), ms: performance.now() - start, bytes: Buffer.byteLength(text) } }
const before = JSON.parse(sql("SELECT jsonb_build_object('audit',coalesce((SELECT jsonb_agg(id) FROM activity_logs),'[]'),'notification',coalesce((SELECT jsonb_agg(id) FROM notifications),'[]'))"))
try {
 for (let i = 0; i < 11; i++) { const r = await get({ search: 'ตรวจต่อเนื่อง', pageSize: '25' }); assert.equal(r.data.total, 20); timings.push({ ms: r.ms, bytes: r.bytes }) }
 const full = (await get({})).data
 for (const group of full.groups) { const details = (await get({ group: group.key })).data; snapshots.push({ key: group.key, sessions: details.sessions }) }
 fs.writeFileSync(path.join(root, 'read-model.json'), JSON.stringify({ ...full, fullGroups: snapshots }, null, 2))
 // Capture all normal reads before any synthetic send changes audit counts.
 const flowStart = performance.now(); let writeRequests = 0
 for (const round of f.rounds) {
  const summary = (await get({ branch: round.branch })).data, group = summary.groups[0]
  const detail = (await get({ branch: round.branch, group: group.key })).data
  for (const session of detail.sessions) {
   const r = await context.request.patch(base + '/api/admin/makeup', { data: { session_id: session.id, action: 'request_coach_review', reason: 'ทดสอบ Local baseline ทั้งรอบ' } }); assert.equal(r.status(), 200, await r.text()); writeRequests++
  }
  await get({ branch: round.branch })
 }
 const flow = { rounds: 20, learners: 100, browserEquivalentDetailOpens: 20, writeRequests, queueReads: 60, totalMs: performance.now() - flowStart }
 // Actual browser reproduction on two real rounds; no API interception.
 page.on('request', r => { if (new URL(r.url()).origin === base) requests.push({ method: r.method(), pathname: new URL(r.url()).pathname }) })
 await page.goto(base + `/admin/makeup?month=${f.month}&session=${f.rounds[0].ids[0]}`, { waitUntil: 'networkidle' })
 await expect(page.getByTestId('makeup-review-group').first()).toBeVisible({ timeout: 30000 })
 const summary = page.locator('[data-review-summary]').first(); await summary.getByRole('button', { name: 'ดูรายละเอียดรอบ', exact: true }).click()
 await expect(page.getByTestId('makeup-review-group')).toHaveCount(2)
 await page.screenshot({ path: path.join(root, 'before-send-real-app.png'), fullPage: true })
 await page.getByTestId('makeup-review-group').first().getByRole('button', { name: /^ส่งให้โค้ชตรวจสอบรอบนี้/ }).click()
 await expect(page.getByTestId('makeup-review-group')).toHaveCount(1, { timeout: 30000 }) // deep link reopens its target only
 await page.screenshot({ path: path.join(root, 'after-send-collapsed-real-app.png'), fullPage: true })
 const result = { runId: run.runId, root, build: fs.readFileSync(path.join(run.evidenceRoot, 'app-baseline/.next/BUILD_ID'), 'utf8').trim(), timings, flow, snapshots: snapshots.length, requestTrace: requests, reproduced: 'Two opened rounds become one deep-linked round after send; other details discarded', elapsedMs: performance.now() - started }
 fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify(result, null, 2)); fs.writeFileSync(path.join(run.evidenceRoot, 'baseline-result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify({ baseline: true, snapshots: snapshots.length, flow }))
} finally {
 // Restore only newly inserted synthetic audit/notification rows; no business row repair.
 sql(`DELETE FROM activity_logs WHERE NOT(id=ANY(ARRAY[${before.audit.map(q).join(',')}]::uuid[]));DELETE FROM notifications WHERE NOT(id=ANY(ARRAY[${before.notification.map(q).join(',')}]::uuid[]));`)
 await browser.close()
}
