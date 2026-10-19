import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { expect } from '@playwright/test'
import { run, sql, q, fixtures } from '../tests/admin-makeup-review/runtime.mjs'
import { adminBrowser, fixture as f } from '../tests/admin-makeup-review/browser.mjs'

const base = 'http://127.0.0.1:3148', root = path.join(run.outputDir, 'release-recovery-' + Date.now())
fs.mkdirSync(root)
let target = 3146
const proxy = http.createServer((req, res) => {
  const upstream = http.request({ hostname: '127.0.0.1', port: target, path: req.url, method: req.method, headers: req.headers }, response => {
    res.writeHead(response.statusCode, response.headers); response.pipe(res)
  })
  upstream.on('error', () => { res.writeHead(502); res.end('Owned Local target unavailable') })
  req.pipe(upstream)
})
await new Promise(resolve => proxy.listen(3148, '127.0.0.1', resolve))
const { browser, context, page } = await adminBrowser(base), checks = [], errors = [], egress = []
page.on('pageerror', e => errors.push(e.message))
await context.route('**/*', route => {
  const host = new URL(route.request().url()).host
  if (!['127.0.0.1:3148', '127.0.0.1:62101'].includes(host)) { egress.push(host); return route.abort() }
  return route.continue()
})
const label = 'ตรวจแผนปล่อย ' + randomUUID().slice(0, 8)
async function round(n) {
  const r = fixtures.fixture('kids_group', false, f.parent, f.past, '17:00', '18:00'), coach = await fixtures.account('coach', label + ' โค้ช ' + n), group = randomUUID()
  sql(`BEGIN;UPDATE branches SET name=${q(label + ' รอบ ' + n)} WHERE id=${q(r.branch)};
    INSERT INTO coach_assignment_groups(id,schedule_slot_id,coach_id,name,created_by) VALUES(${q(group)},${q(r.slot)},${q(coach.id)},${q(label)},${q(f.sa.id)});
    INSERT INTO coach_assignment_group_students(group_id,booking_session_id,student_id,student_type) VALUES(${q(group)},${q(r.ids[0])},${q(r.children[0])},'child');COMMIT;`)
  return r
}
const scopedCounts = ids => JSON.parse(sql(`SELECT jsonb_build_object('receipts',(SELECT count(*) FROM admin_makeup_review_requests WHERE result->>'anchorId'=ANY(ARRAY[${ids.map(q)}])),'audits',(SELECT count(*) FROM activity_logs WHERE entity_id::text=ANY(ARRAY[${ids.map(q)}])),'notifications',(SELECT count(*) FROM notifications WHERE user_id IN (SELECT g.coach_id FROM coach_assignment_groups g JOIN coach_assignment_group_students m ON m.group_id=g.id WHERE m.booking_session_id::text=ANY(ARRAY[${ids.map(q)}]))))`))
const open = async r => {
  await page.goto(base + '/admin/makeup?' + new URLSearchParams({ month: f.month, session: r.ids[0] }), { waitUntil: 'networkidle' })
  const card = page.getByTestId('makeup-review-group').filter({ has: page.getByTestId('review-session-' + r.ids[0]) })
  await expect(card).toBeVisible(); return card
}
const post = (api, body) => context.request.post(base + api, { data: body, headers: { Origin: base } })
try {
  const committed = await round(1), missing = await round(2), ids = [committed.ids[0], missing.ids[0]], initial = scopedCounts(ids)
  // Untagged stale clients must be rejected before even resolving a real session.
  for (const action of ['request_coach_review', 'request_coach_evidence']) {
    const response = await context.request.patch(base + '/api/admin/makeup', { data: { action, session_id: committed.ids[0], reason: label } })
    assert.equal(response.status(), 409); assert.equal((await response.json()).refreshRequired, true)
  }
  assert.deepEqual(scopedCounts(ids), initial); checks.push('Both legacy sends without deployment metadata reject before notification or audit')
  // Lose a real successful response while retaining the browser request registry.
  let lose = true
  await context.route('**/api/admin/makeup/review-request', async route => {
    if (lose && route.request().postDataJSON().readOnly !== true) {
      lose = false; const response = await route.fetch(); assert.equal(response.status(), 200); return route.abort()
    }
    return route.continue()
  })
  const card = await open(committed)
  await card.getByRole('button', { name: /^ส่งให้โค้ชตรวจสอบรอบนี้/ }).click()
  await expect(card.getByTestId('review-round-result')).toContainText('ยังยืนยันผลไม่ได้', { timeout: 30000 })
  await context.unroute('**/api/admin/makeup/review-request')
  const key = 'nasc-admin-review-round-v1:' + f.sa.id, refs = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), key)
  assert.equal(refs.length, 1); const ref = refs[0], afterCommit = scopedCounts(ids)
  assert.equal(afterCommit.receipts - initial.receipts, 1)
  checks.push('Primary release artifact commits one request while a lost response leaves the original browser reference')
  // An unknown request that never reached the server must also survive cutover.
  const missingRef = { requestId: randomUUID(), anchor: missing.ids[0], action: 'request_coach_review', month: f.month, slots: [missing.slot] }
  await page.evaluate(({ key, ref }) => { const refs = JSON.parse(sessionStorage.getItem(key)); refs.push(ref); sessionStorage.setItem(key, JSON.stringify(refs)) }, { key, ref: missingRef })
  target = 3147 // Real server artifact changes behind the same browser origin.
  await page.reload({ waitUntil: 'networkidle' })
  const panel = page.getByTestId('review-request-recovery')
  await expect(panel).toBeVisible(); await expect(panel.getByTestId('review-recovery-result')).toHaveCount(2)
  const first = panel.getByTestId('review-recovery-result').filter({ hasText: ref.requestId })
  await first.getByRole('button', { name: 'ตรวจผลคำขอเดิม' }).click()
  await expect(first).toContainText('สำเร็จ', { timeout: 30000 })
  const second = panel.getByTestId('review-recovery-result').filter({ hasText: missingRef.requestId })
  await second.getByRole('button', { name: 'ตรวจผลคำขอเดิม' }).click()
  await expect(second).toContainText('ยังไม่พบการส่ง', { timeout: 30000 })
  assert.deepEqual(scopedCounts(ids), afterCommit)
  checks.push('Same-origin recovery reload reads committed and missing outcomes without creating any receipt or audit')
  for (const readOnly of [false, undefined, 'true']) {
    const response = await post('/api/admin/makeup/review-request', { ...missingRef, requestId: randomUUID(), group: '', members: [missingRef.anchor], readOnly })
    assert.equal(response.status(), typeof readOnly === 'string' ? 400 : 409)
  }
  assert.deepEqual(scopedCounts(ids), afterCommit); checks.push('Recovery server blocks false, omitted and forged readOnly writes before side effects')
  await page.screenshot({ path: path.join(root, 'recovery-readback-real-app.png'), fullPage: false })
  await page.reload({ waitUntil: 'networkidle' }); await expect(page.getByTestId('review-request-recovery')).toContainText('ไม่มีคำขอค้าง')
  checks.push('Confirmed and definitively missing recovery references clear from this browser after explicit readback')
  // A different authorized actor cannot read another actor receipt.
  const other = await fixtures.account('super_admin', label + ' ผู้ตรวจอื่น'), session = await adminBrowser(base, other)
  try {
    const response = await session.context.request.post(base + '/api/admin/makeup/review-request', { headers: { Origin: base }, data: { ...ref, group: '', members: [ref.anchor], readOnly: true } })
    assert.equal(response.status(), 409)
  } finally { await session.context.close(); await session.browser.close() }
  checks.push('Another super-admin cannot recover a receipt belonging to the original actor')
  const stableCard = page.getByTestId('makeup-review-group').filter({ hasText: label + ' รอบ 1' })
  const detailButton = stableCard.getByRole('button', { name: 'ดูรายละเอียดรอบ', exact: true })
  if (await detailButton.count()) await detailButton.click()
  await stableCard.getByRole('button', { name: 'บันทึกย้อนหลังทั้งรอบ', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  assert.ok(await page.getByRole('dialog').getByRole('button', { name: 'บันทึก attendance ทั้งรอบ', exact: true }).isDisabled())
  await page.getByRole('dialog').getByRole('button', { name: 'ยกเลิก', exact: true }).click()
  await stableCard.getByRole('button', { name: 'ปิดเคสทั้งรอบ', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'ยกเลิก', exact: true }).click()
  assert.deepEqual(scopedCounts(ids), afterCommit)
  checks.push('Recovery retains attendance validation and the close confirmation dialog; cancel changes no business record')
  await page.getByRole('tab', { name: 'จัดการวันเรียน', exact: true }).click()
  await expect(page.getByRole('button', { name: 'เด็กกลุ่ม', exact: true }).first()).toBeVisible()
  await page.getByRole('tab', { name: 'เลือกวันชดเชย', exact: true }).click()
  await expect(page.getByRole('button', { name: 'เด็กกลุ่ม', exact: true }).first()).toBeVisible()
  checks.push('Stable recovery artifact retains both other Makeup tabs')
  assert.equal(errors.length, 0); assert.equal(egress.length, 0); checks.push('No browser exceptions or egress beyond owned Local app/API')
  const result = { runId: run.runId, root, checks, errors, egress, initial, afterCommit, final: scopedCounts(ids), sameOriginCutover: true }
  fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify(result, null, 2)); fs.writeFileSync(path.join(run.evidenceRoot, 'release-local-result.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify({ passed: checks.length, root }))
} catch (error) {
  fs.writeFileSync(path.join(root, 'failure.json'), JSON.stringify({ message: error.message, checks, errors, egress }, null, 2))
  await page.screenshot({ path: path.join(root, 'failure.png') }).catch(() => {}); throw error
} finally {
  await context.close(); await browser.close(); await new Promise(resolve => proxy.close(resolve))
}
