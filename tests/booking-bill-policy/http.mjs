import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { sql, q } from './runtime.mjs'
import { fixture, account, authCookie, request, session, bill, sessionsFor, read, evidence } from './helpers.mjs'

const f = fixture(), checks = [], records = {}
const check = (condition, label) => { assert.ok(condition, label); checks.push(label); console.log(label) }
const day = n => f.dates.month + '-' + String(n).padStart(2, '0')
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlAAAAABJRU5ErkJggg==', 'base64')
async function successful(cookie, route, body, options) {
  const result = await request(cookie, route, body, options)
  assert.equal(result.status, 200, route + ': ' + JSON.stringify(result.result))
  return result.result
}
async function purchase(cookie, course, sessions, members = [null]) {
  const catalogs = await successful(cookie, '/api/booking-checkout?catalog=1'), id = (course === 'adult_group' ? 'adult' : 'private') + '-1', pack = catalogs.packages.find(p => p.id === id)
  const quantity = new Set(sessions.map(s => JSON.stringify([s.date,s.startTime,s.endTime,s.branchId]))).size
  const [year, month] = sessions[0].date.split('-').map(Number)
  const quote = await successful(cookie, '/api/bookings/preview', { purchasePolicyVersion: 2, courseTypeId: f.courses[course], packageId: id, packageRevision: pack.revision, totalSessions: quantity, month, year })
  const input = { purchasePolicyVersion: 2, packageId: id, packageRevision: pack.revision, participants: members, learnerType: members.includes(null) ? 'self' : 'child', childId: members.length === 1 ? members[0] : null, branchId: sessions[0].branchId, courseTypeId: f.courses[course], month, year, totalSessions: quantity, totalAmount: quote.grossPrice, expectedTotalPrice: quote.totalPrice, sessions }
  const result = await successful(cookie, '/api/booking-checkout', { action: 'create', requestId: randomUUID(), input })
  return { result, quote, input }
}
async function pay(cookie, bookingId, amount, requestId = randomUUID()) {
  const form = new FormData(); form.set('file', new File([png], 'local-test-slip.png', { type: 'image/png' })); form.set('bookingIds', JSON.stringify([bookingId])); form.set('expectedAmount', String(amount)); form.set('requestId', requestId)
  return successful(cookie, '/api/verify-slip', form)
}
try {
  const actor = await account('user', 'ทดสอบ API ผู้ใหญ่'), cookie = await authCookie(actor), adminCookie = await authCookie(f.actors.sa)
  const adult = await purchase(cookie, 'adult_group', [1,2,3].map(n => session(f, 'adult_group', day(n))))
  const id = adult.result.bookingId
  check(adult.quote.grossPrice === 1800 && bill(id).total_price === 1800 && bill(id).total_sessions === 3, 'S01 real authenticated preview→create stores one1800 bill with3rounds')
  const detail = await successful(cookie, '/api/booking-checkout?bookingId=' + id)
  check(detail.bookings.length === 1 && detail.bookings[0].total_sessions === 3 && detail.bookings[0].package_snapshot.purchaseMode === 'per_session', 'P02 checkout reader preserves one-bill boundary and explicit per-session mode')
  const receipt = randomUUID(), paid = await pay(cookie, id, 1800, receipt)
  check(paid.verified === true && bill(id).status === 'verified', 'P01 one authenticated slip confirms the three-round bill in shared TEST MODE')
  await pay(cookie, id, 1800, receipt)
  check(sql(`SELECT count(*) FROM payments WHERE booking_id=${q(id)} AND status='approved'`) === '1', 'P03 replayed slip retains one approved payment')
  check(sql(`SELECT count(*) FROM booking_package_units WHERE booking_id=${q(id)}`) === '0', 'S04 paid multi-single bill issues no unscheduled package rights')
  const sources = sessionsFor(id), expectedExpiry = new Date(Date.parse(f.dates.nextMonth + '-01T00:00:00+07:00') - 1).toISOString()
  const preview = await successful(adminCookie, '/api/admin/makeup/store-preview?session=' + sources[0].id)
  check(preview.eligible === true && new Date(preview.expiresAt).toISOString() === expectedExpiry, 'S05 Admin preview reports the original lesson-month expiry for multiple singles')
  const stored = await successful(cookie, '/api/lesson-wallet', { action: 'store', sessionId: sources[0].id })
  const credit = read(`SELECT to_jsonb(c) FROM lesson_wallet_credits c WHERE id=${q(stored.creditId)}`)
  check(credit.entitlement_policy === 'same_month' && new Date(credit.expires_at).toISOString() === expectedExpiry, 'S05 User Store actual credit agrees with Admin preview and lesson-month expiry')
  const nextTarget = session(f, 'adult_group', f.dates.nextMonth + '-05')
  const rejected = await request(cookie, '/api/lesson-wallet', { action: 'redeem', creditId: stored.creditId, targetDate: nextTarget.date, startTime: nextTarget.startTime, endTime: nextTarget.endTime, branchId: nextTarget.branchId, scheduleTemplateId: nextTarget.scheduleTemplateId })
  check(rejected.status >= 400 && sql(`SELECT status FROM lesson_wallet_credits WHERE id=${q(stored.creditId)}`) === 'active', 'S05 cross-month redeem rejects without spending the stored single right')
  const target = session(f, 'adult_group', day(20))
  const redeemed = await successful(cookie, '/api/lesson-wallet', { action: 'redeem', creditId: stored.creditId, targetDate: target.date, startTime: target.startTime, endTime: target.endTime, branchId: target.branchId, scheduleTemplateId: target.scheduleTemplateId })
  const restored = await successful(cookie, '/api/lesson-wallet', { action: 'store', sessionId: redeemed.sessionId })
  const restoredCredit = read(`SELECT to_jsonb(c) FROM lesson_wallet_credits c WHERE id=${q(restored.creditId)}`)
  check(new Date(restoredCredit.expires_at).toISOString() === expectedExpiry, 'S05 redeem→Store keeps the inherited month-end expiry')
  const adminStored = await successful(adminCookie, '/api/admin/makeup/lessons', { session_id: sources[1].id, operation: 'store', request_id: randomUUID(), reason: 'ทดสอบ Local เก็บรายครั้งหลายรอบ', store_policy: 'admin-store-once-v1' })
  check(adminStored.success === true && sql(`SELECT count(*) FROM lesson_wallet_credits WHERE booking_id=${q(id)} AND entitlement_policy<>'same_month'`) === '0', 'S05 Admin Store actual mutation also retains same-month policy')
  const after = await successful(cookie, '/api/booking-checkout?bookingId=' + id)
  check(after.bookings[0].total_price === 1800 && Number(sql(`SELECT sum(amount) FROM payments WHERE booking_id=${q(id)} AND status='approved'`)) === 1800, 'P02 money remains1800 after Store/redeem operations')

  const familyActor = await account('user', 'ทดสอบ API Private'), familyCookie = await authCookie(familyActor), children = [randomUUID(),randomUUID()]
  sql(children.map((child,i) => `INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(child)},${q(familyActor.id)},${q('เด็ก API ' + i)},${q('เด็ก ' + i)})`).join(';'))
  const members = [null,...children], family = await purchase(familyCookie, 'private', [4,5,6].flatMap(n => members.map(child => session(f, 'private', day(n), child))), members)
  await pay(familyCookie, family.result.bookingId, 2700)
  const familySources = sessionsFor(family.result.bookingId), familyStored = await successful(familyCookie, '/api/lesson-wallet', { action: 'store', sessionId: familySources[0].id })
  check(family.quote.grossPrice === 2700 && familyStored.participantCount === 3 && sql(`SELECT count(*) FROM booking_sessions WHERE booking_id=${q(family.result.bookingId)} AND status='walleted'`) === '3', 'S02/S05 Family Private3hours pays2700; Store moves all3 exact participants as one right')
  check(sql(`SELECT entitlement_policy FROM lesson_wallet_credits WHERE id=${q(familyStored.creditId)}`) === 'same_month', 'Private multiple-single Family right keeps same-month policy')
  const foreign = await request(cookie, '/api/booking-checkout?bookingId=' + family.result.bookingId)
  check(foreign.status === 404, 'P03 another authenticated account cannot read the Family bill')
  const editPaid = await request(cookie, '/api/bookings', { ...adult.input, bookingId: id, clientRequestId: randomUUID() }, { method: 'PUT' })
  check(editPaid.status >= 400 && bill(id).total_price === 1800, 'P01 paid bill cannot be repriced through the pending editor')
  Object.assign(records, { adult: id, family: family.result.bookingId, adultActor: actor, familyActor, restoredCredit: restored.creditId })
  console.log(JSON.stringify({ passed: checks.length, evidence: evidence('http-pass', { checks, records }) }))
} catch (error) { evidence('http-failed', { checks, records, error: String(error), stderr: String(error.stderr || '') }); throw error }

