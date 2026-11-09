import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { sql, q, concurrentSql } from './runtime.mjs'
import { fixture, account, read, rpc, session, kidsInput, singleInput, create, bill, sessionsFor, financialSnapshot, evidence } from './helpers.mjs'

const f = fixture(), checks = []
const check = (condition, label) => { assert.ok(condition, label); checks.push(label); console.log(label) }
const date = day => f.dates.month + '-' + String(day).padStart(2, '0')
const records = {}
try {
  const parent = await account('user', 'ทดสอบ DB สูตรเด็ก'), child = randomUUID(), sibling = randomUUID()
  sql(`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(child)},${q(parent.id)},'เด็ก DB เอ','เอ'),(${q(sibling)},${q(parent.id)},'เด็ก DB บี','บี')`)
  // Deliberately create this synthetic old bill with the new control disabled,
  // then enable it. No historical/customer bill is rewritten or converted.
  sql('UPDATE booking_bill_policy_control SET enabled=false')
  const oldInput = kidsInput(f, parent, [1,2,3,4].map(day => session(f, 'kids_group', date(day), child)))
  delete oldInput.purchasePolicyVersion
  const old = create(parent, oldInput), oldBefore = financialSnapshot([old.bookingId])
  sql('UPDATE booking_bill_policy_control SET enabled=true')
  const aInput = kidsInput(f, parent, [5,6,7,8].map(day => session(f, 'kids_group', date(day), child)))
  const a = create(parent, aInput), one = create(parent, kidsInput(f, parent, [session(f, 'kids_group', date(9), child)]))
  const siblings = create(parent, kidsInput(f, parent, [child, sibling].flatMap(id => [10,11,12,13].map(day => session(f, 'kids_group', date(day), id)))))
  check(old.totalPrice === 2500 && a.totalPrice === 2500 && one.totalPrice === 700, 'K01 new Kids bills reset after active old/new purchases: 4=2500 and new1=700')
  check(siblings.totalPrice === 4000 && bill(siblings.bookingId).total_sessions === 8, 'K04 siblings combine only within one bill: A4+B4=8 at4000')
  check(rpc('task10_booking_policy_quote_v1', `${q(parent.id)},${q(f.courses.kids_group)},${q(f.dates.month + '-01')},'progressive',${q(a.bookingId)}`).pricingMode === 'per_bill_v1', 'New Kids bill stores the per-bill policy version')
  check(!rpc('task10_booking_policy_quote_v1', `${q(parent.id)},${q(f.courses.kids_group)},${q(f.dates.month + '-01')},'progressive',${q(old.bookingId)}`).pricingMode, 'Old bill retains its original cumulative policy')
  const unchanged = [one.bookingId, siblings.bookingId].map(bill), scopeRevision = kidsInput(f, parent, [session(f, 'kids_group', date(15), child)]).expectedScopeRevision
  rpc('cancel_progressive_pending_booking_v1', `${q(parent.id)},${q(a.bookingId)},${q(randomUUID())},${scopeRevision}`)
  check([one.bookingId, siblings.bookingId].every((id, index) => bill(id).total_price === unchanged[index].total_price), 'K05 cancelling another bill leaves new bill prices unchanged')
  assert.deepEqual(financialSnapshot([old.bookingId]), oldBefore)
  check(true, 'Old Kids bill/payment/rights evidence remains byte-equivalent')

  const adult = await account('user', 'ทดสอบ DB ผู้ใหญ่'), adultSessions = [1,2,3].map(day => session(f, 'adult_group', date(day)))
  const adultInput = singleInput(f, adult, 'adult_group', adultSessions), requestId = randomUUID(), adultBill = create(adult, adultInput, requestId)
  check(adultBill.totalPrice === 1800 && bill(adultBill.bookingId).total_sessions === 3 && sessionsFor(adultBill.bookingId).length === 3, 'S01 adult three single rounds create exactly one1800 bill with three rounds')
  check(bill(adultBill.bookingId).package_snapshot.purchaseMode === 'per_session' && bill(adultBill.bookingId).package_snapshot.quantity === 1, 'Per-session purchase is explicit while catalog unit stays1')
  check(create(adult, adultInput, requestId).bookingId === adultBill.bookingId, 'P03 replay of create returns the original bill')
  const removed = singleInput(f, adult, 'adult_group', adultSessions.slice(0, 2), [null], adultBill.bookingId)
  rpc('booking_ux_update_v1', `${q(adult.id)},${q(randomUUID())},${q(JSON.stringify({ ...removed, bookingId: adultBill.bookingId }))}::jsonb`)
  check(bill(adultBill.bookingId).total_sessions === 2 && bill(adultBill.bookingId).total_price === 1200, 'S01 removing pending round atomically reduces quantity and price')
  const added = singleInput(f, adult, 'adult_group', [1,2,3,4].map(day => session(f, 'adult_group', date(day))), [null], adultBill.bookingId)
  rpc('booking_ux_update_v1', `${q(adult.id)},${q(randomUUID())},${q(JSON.stringify({ ...added, bookingId: adultBill.bookingId }))}::jsonb`)
  check(bill(adultBill.bookingId).total_sessions === 4 && bill(adultBill.bookingId).total_price === 2400, 'S01 adding pending round atomically increases quantity and price')
  for (const [course, quantities, unitPrice] of [['adult_group',[9,10,11,15,16,17],600],['private',[9,10,11],900]]) {
    const pack = rpc('booking_ux_catalog_v1', '').find(p => p.id === (course === 'private' ? 'private-1' : 'adult-1'))
    for (const quantity of quantities) {
      const quote = rpc('booking_bill_package_quote_v2', `${q(adult.id)},${q(f.courses[course])},${quantity},${q(pack.id)},${pack.revision},NULL`)
      assert.equal(quote.grossPrice, quantity * unitPrice); assert.equal(quote.purchaseMode, 'per_session')
    }
  }
  check(true, 'S03 quantity10/16 thresholds never silently convert per-session quotes to packages')
  const family = await account('user', 'ทดสอบ DB ครอบครัว'), familyChild = randomUUID(), familyChild2 = randomUUID()
  sql(`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(familyChild)},${q(family.id)},'Private DB เอ','เอ'),(${q(familyChild2)},${q(family.id)},'Private DB บี','บี')`)
  const members = [null, familyChild, familyChild2], familySessions = [1,2,3].flatMap(day => members.map(id => session(f, 'private', date(day), id)))
  const familyBill = create(family, singleInput(f, family, 'private', familySessions, members))
  check(familyBill.totalPrice === 2700 && bill(familyBill.bookingId).total_sessions === 3 && sessionsFor(familyBill.bookingId).length === 9, 'S02 Family3hours costs2700 and retains all3 exact learner identities')
  const beforeInvalid = Number(sql(`SELECT count(*) FROM bookings WHERE user_id=${q(adult.id)}`))
  const mixed = singleInput(f, adult, 'adult_group', [session(f, 'adult_group', date(20)), session(f, 'adult_group', f.dates.nextMonth + '-01')])
  assert.throws(() => create(adult, mixed), /MONTH|month/i)
  assert.throws(() => create(adult, { ...singleInput(f, adult, 'adult_group', [session(f, 'adult_group', date(20))]), purchasePolicyVersion: 1 }), /POLICY|REFRESH|VERSION/i)
  assert.throws(() => create(adult, { ...singleInput(f, adult, 'adult_group', [session(f, 'adult_group', date(20))]), totalAmount: 1, expectedTotalPrice: 1 }), /AMOUNT|PRICE|CONFLICT/i)
  check(Number(sql(`SELECT count(*) FROM bookings WHERE user_id=${q(adult.id)}`)) === beforeInvalid, 'S04/P03 mixed month, stale writer and wrong amount reject without extra bills')
  const forbidden = singleInput(f, adult, 'adult_group', [session(f, 'adult_group', date(20))])
  assert.throws(() => create(adult, { ...forbidden, participants: [f.children[0]], learnerType: 'child', childId: f.children[0] }), /LEARNER|FORBIDDEN|UNAUTHORIZED/i)
  check(true, 'P03 another family learner cannot be injected into a per-session purchase')
  const concurrentInput = singleInput(f, adult, 'adult_group', [session(f, 'adult_group', date(21))]), concurrentKey = randomUUID()
  const statement = `SELECT booking_ux_create_v1(${q(adult.id)},${q(concurrentKey)},${q(JSON.stringify(concurrentInput))}::jsonb)`
  const outcomes = (await Promise.all([concurrentSql(statement), concurrentSql(statement)])).map(JSON.parse)
  check(outcomes[0].bookingId === outcomes[1].bookingId && outcomes.some(result => result.idempotentReplay), 'P03 concurrent same-key writes commit one per-session bill')
  const packs = rpc('booking_ux_catalog_v1', '')
  for (const [id, course, expectedPrice] of [['adult-10','adult_group',5500],['adult-16','adult_group',8000],['private-10','private',8000]]) {
    const pack = packs.find(p => p.id === id)
    const result = create(adult, { purchasePolicyVersion: 2, packageId: id, packageRevision: pack.revision, participants: [null], learnerType: 'self', childId: null, branchId: f.branches[0], courseTypeId: f.courses[course], month: +f.dates.month.slice(5), year: +f.dates.month.slice(0,4), totalSessions: pack.quantity, totalAmount: expectedPrice, expectedTotalPrice: expectedPrice, sessions: [] })
    assert.equal(result.totalPrice, expectedPrice); assert.equal(bill(result.bookingId).total_sessions, pack.quantity)
  }
  check(true, 'S06 existing packages still support full quantity with zero selected rounds')
  Object.assign(records, { old: old.bookingId, kidsNew: [one.bookingId, siblings.bookingId], adult: adultBill.bookingId, family: familyBill.bookingId, adultActor: adult, familyActor: family })
  console.log(JSON.stringify({ passed: checks.length, evidence: evidence('db-pass', { checks, records }) }))
} catch (error) {
  // Preserve activation even when a deliberately old-writer scenario fails.
  sql('UPDATE booking_bill_policy_control SET enabled=true')
  evidence('db-failed', { checks, records, error: String(error), stderr: String(error.stderr || '') })
  throw error
}

