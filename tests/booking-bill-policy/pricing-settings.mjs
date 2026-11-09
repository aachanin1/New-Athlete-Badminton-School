import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { expect } from '@playwright/test'
import { run } from './runtime.mjs'
import { fixture, authCookie, browserSession, baseUrl, request, evidence, hashFile } from './helpers.mjs'

const f = fixture(), checks = [], sessions = [], browserErrors = []
const app = new URL(baseUrl).port === '63311' ? JSON.parse(fs.readFileSync(path.join(run.evidenceRoot, 'app-runtime.json'), 'utf8')).app : path.join(run.evidenceRoot, 'app-development')
assert.ok(path.resolve(app).startsWith(path.resolve(run.evidenceRoot) + path.sep))
const manifest = JSON.parse(fs.readFileSync(path.join(app, 'source-manifest.json'), 'utf8'))
assert.equal(manifest.runId, run.runId)
for (const [file, hash] of Object.entries(manifest.hashes).filter(([file]) => file.startsWith('src/') || file.startsWith('public/') || ['package.json','package-lock.json','next.config.mjs','tsconfig.json','postcss.config.mjs','tailwind.config.ts','components.json'].includes(file))) {
  assert.equal(hashFile(file), hash, 'Source differs from tested app: ' + file)
  assert.equal(hashFile(path.join(app, file)), hash, 'Frozen app changed: ' + file)
}
const artifact = { baseUrl, app, manifestHash: hashFile(path.join(app, 'source-manifest.json')) }
const directory = path.join(run.outputDir, 'pricing-settings-' + Date.now())
fs.mkdirSync(directory, { recursive: true })
const cookie = await authCookie(f.actors.sa), userCookie = await authCookie(f.actors.other)
const getPricing = async () => { const r = await request(cookie, '/api/admin/pricing'); assert.equal(r.status, 200); return r.result.data }
const normalize = s => s.tiers.map(t => ({ id: t.id, min: t.min_sessions, max: t.max_sessions, rate: Number(t.price_per_session), total: Number(t.package_price) })).sort((a,b) => a.id.localeCompare(b.id))
const original = await getPricing()
const catalog = (await request(cookie, '/api/booking-checkout?catalog=1')).result.packages
const check = label => { checks.push(label); console.log(label) }
const number = v => Number(v).toLocaleString('th-TH')
let restore = false

async function inspect(page, snapshot) {
  for (const course of ['adult_group','private']) {
    const group = page.getByTestId('pricing-course-' + course)
    await expect(group).toHaveCSS('border-style', 'solid')
    const packs = catalog.filter(p => p.course === course)
    await expect(group).toContainText(packs.length + ' รูปแบบ')
    await expect(group.getByText('ช่วงราคา', { exact: true })).toHaveCount(0)
    await expect(group.getByText('เริ่มที่', { exact: true })).toHaveCount(0)
    await expect(group.getByText('ถึง (ว่าง = ไม่จำกัด)', { exact: true })).toHaveCount(0)
    await expect(group.getByText('ค่า DB Auto', { exact: true })).toHaveCount(0)
    for (const pack of packs) {
      const row = snapshot.tiers.filter(t => t.course_type_name === course && t.min_sessions <= pack.quantity).sort((a,b) => b.min_sessions-a.min_sessions)[0]
      const block = group.locator('[data-purchase-option="' + pack.id + '"]')
      const unit = course === 'private' ? 'ชั่วโมง' : 'ครั้ง'
      await expect(block.getByRole('spinbutton')).toHaveCount(1)
      await expect(block.getByRole('spinbutton')).toHaveValue(String(Number(row.price_per_session)))
      if (pack.quantity === 1) {
        await expect(block.getByText(course === 'private' ? 'รายชั่วโมง' : 'รายครั้ง', { exact: true })).toBeVisible()
        await expect(block.getByText(course === 'private' ? 'การคิดราคารายชั่วโมง' : 'การคิดราคารายครั้ง', { exact: true })).toBeVisible()
        await expect(block).toContainText('เลือกได้หลาย' + unit + 'ในบิลเดียว')
        await expect(block.getByTestId('pricing-total-' + pack.id)).toHaveText('จำนวนที่เลือก × ฿' + number(row.price_per_session) + '/' + unit)
        await expect(block).toContainText('เช่น 3 ' + unit + ' = ฿' + number(Math.round(Number(row.price_per_session)*300)/100))
        await expect(block).toContainText('ใช้ได้ภายในเดือนเรียนเดิม')
      } else {
        await expect(block.getByText('คอร์ส ' + pack.quantity + ' ' + unit, { exact: true })).toBeVisible()
        await expect(block.getByTestId('pricing-quantity-' + pack.id)).toHaveText(pack.quantity + ' ' + unit)
        await expect(block.getByText('ราคารวมคอร์ส', { exact: true })).toBeVisible()
        const expected = Math.round(row.min_sessions * Number(row.price_per_session))
        await expect(block.getByTestId('pricing-total-' + pack.id)).toHaveText('฿' + number(expected))
      }
    }
  }
  await expect(page.getByText(/ผู้ใช้ต้องเลือกเปลี่ยนเป็นคอร์สเอง/)).toBeVisible()
}
async function save(page) {
  const pending = page.waitForResponse(r => r.url().endsWith('/api/admin/pricing') && r.request().method() === 'PATCH')
  await page.getByRole('button', { name: 'บันทึกราคาค่าเรียน', exact: true }).click()
  const response = await pending, result = await response.json()
  assert.equal(response.status(), 200, JSON.stringify(result))
  assert.equal(result.success, true)
  const submitted = response.request().postDataJSON()
  assert.deepEqual(submitted.tiers.map(t => ({ id:t.id, min:t.min_sessions, max:t.max_sessions })).sort((a,b)=>a.id.localeCompare(b.id)), original.tiers.map(t=>({id:t.id,min:t.min_sessions,max:t.max_sessions})).sort((a,b)=>a.id.localeCompare(b.id)))
  return result.data
}
try {
  for (const [route, mobile] of [['/admin/settings/pricing',false],['/admin/settings?section=pricing',true]]) {
    const b = await browserSession(f.actors.sa, mobile); sessions.push(b)
    b.page.on('pageerror', error => browserErrors.push(error.message))
    b.page.on('response', response => {
      if (response.url().includes('/_next/static/') && response.status() >= 400) browserErrors.push('Asset ' + response.status() + ': ' + response.url())
    })
    await b.page.goto(baseUrl + route, { waitUntil:'networkidle' })
    await inspect(b.page, original)
    assert.ok(!await b.page.evaluate(() => document.documentElement.scrollWidth > innerWidth+1))
    await b.page.screenshot({path:path.join(directory,mobile?'mobile-options.png':'desktop-options.png'),fullPage:true})
    check('Both entry presentation: ' + route + ' has five actual purchase options, unit/formula/course totals and no range/DB controls; no overflow')
  }
  const page = sessions[0].page
  await save(page)
  assert.deepEqual(normalize(await getPricing()), normalize(original))
  check('Saving unchanged prices preserves every stored rate, range, total and row identity')
  restore = true
  for (const row of original.tiers) await page.getByTestId('pricing-tier-'+row.id).getByRole('spinbutton').fill(String(Number(row.price_per_session)+10))
  const changed = await save(page)
  await inspect(page, changed)
  for (const pack of catalog) {
    const row = changed.tiers.filter(t=>t.course_type_name===pack.course && t.min_sessions<=pack.quantity).sort((a,b)=>b.min_sessions-a.min_sessions)[0]
    const quantity = pack.quantity===1 ? 3 : pack.quantity
    const quote = await request(userCookie,'/api/bookings/preview',{courseTypeId:row.course_type_id,packageId:pack.id,packageRevision:pack.revision,totalSessions:quantity,month:+f.dates.month.slice(5),year:+f.dates.month.slice(0,4)})
    assert.equal(quote.status,200,JSON.stringify(quote.result))
    assert.equal(quote.result.grossPrice, pack.quantity===1 ? Math.round(Number(row.price_per_session)*300)/100 : Math.round(row.min_sessions*Number(row.price_per_session)))
  }
  check('Actual UI save updates all five unit rates; User quotes match three-unit single formulas and every course total while all ranges stay unchanged')
  await sessions[1].page.reload({waitUntil:'networkidle'})
  await inspect(sessions[1].page,changed)
  check('Second settings entry reads the price saved from the first entry')
  for(const row of original.tiers) await page.getByTestId('pricing-tier-'+row.id).getByRole('spinbutton').fill(String(Number(row.price_per_session)))
  await save(page)
  assert.deepEqual(normalize(await getPricing()),normalize(original));restore=false
  check('Original prices restored through the UI, preserving package totals and range fields')
  await page.route('**/api/booking-checkout?catalog=1',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"Local test unavailable"}'}))
  await page.getByRole('button',{name:'โหลดราคาล่าสุด',exact:true}).click()
  await expect(page.getByRole('button',{name:'บันทึกราคาค่าเรียน',exact:true})).toBeDisabled()
  assert.deepEqual(normalize(await getPricing()),normalize(original))
  check('A failed purchase-catalog reload blocks saving and preserves stored prices')
  assert.deepEqual(browserErrors, [], 'Browser errors or missing UI assets')
  console.log(JSON.stringify({passed:checks.length,evidence:evidence('pricing-settings-pass',{checks,artifact,screenshots:directory,sourceHashes:Object.fromEntries(['src/components/admin/pricing-settings-client.tsx','src/lib/admin-pricing-settings.ts','src/lib/admin-purchase-options.ts'].map(p=>[p,hashFile(p)]))})}))
} catch(error) { evidence('pricing-settings-failed',{checks,artifact,error:String(error),screenshots:directory});for(let i=0;i<sessions.length;i++)await sessions[i].page.screenshot({path:path.join(directory,'failure-'+i+'.png'),fullPage:true}).catch(()=>{});throw error }
finally {
  if(restore){const current=await getPricing();const r=await request(cookie,'/api/admin/pricing',{expected:current,tiers:original.tiers.map(t=>({id:t.id,min_sessions:t.min_sessions,max_sessions:t.max_sessions,price_per_session:t.price_per_session}))},{method:'PATCH'});assert.equal(r.status,200,JSON.stringify(r.result));assert.deepEqual(normalize(await getPricing()),normalize(original))}
  for(const b of sessions)await b.browser.close()
}
