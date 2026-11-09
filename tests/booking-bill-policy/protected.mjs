import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { sql, q } from './runtime.mjs'
import { fixture, account, read, rpc, session, kidsInput, singleInput, create, bill, sessionsFor, financialSnapshot, authCookie, request, evidence } from './helpers.mjs'

const f = fixture(), checks = [], records = {}, date = n => f.dates.month + '-' + String(n).padStart(2, '0')
const check = (condition, label) => { assert.ok(condition, label); checks.push(label); console.log(label) }
const assertReject = (fn, regex) => assert.throws(fn, error => regex.test(String(error.stderr || error.message)))
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlAAAAABJRU5ErkJggg==', 'base64')
function coupon(type, value) {
  const id = randomUUID(), code = 'LOCAL' + randomUUID().slice(0, 8).toUpperCase()
  sql(`INSERT INTO coupons(id,code,discount_type,discount_value,created_by,valid_from,max_uses) VALUES(${q(id)},${q(code)},${q(type)},${value},${q(f.actors.sa.id)},'2020-01-01',NULL)`)
  return { id, code }
}
async function parentWithChildren(label) {
  const actor = await account('user', label), children = [randomUUID(),randomUUID()]
  sql(children.map((child, i) => `INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(child)},${q(actor.id)},${q(label + i)},${q('เด็ก ' + i)})`).join(';'))
  return { actor, children }
}
function editSet(actor, id, sessions, participants, expectedTotal, preview = false) {
  const token = sql(`SELECT booking_ux_set_token_v1(${q(actor.id)},ARRAY[${q(id)}]::uuid[])`)
  const input = { action: 'edit', token, bookingIds: [id], edits: [{ id, sessions, participants }], couponChanges: [{ bookingId: id, action: 'keep' }], expectedTotal }
  if (!preview) { const quote = rpc('booking_ux_edit_set_v1', `${q(actor.id)},${q(randomUUID())},${q(JSON.stringify(input))}::jsonb,true`); assert.equal(quote.total, expectedTotal); input.quoteToken = quote.quoteToken }
  return rpc('booking_ux_edit_set_v1', `${q(actor.id)},${q(randomUUID())},${q(JSON.stringify(input))}::jsonb,${preview}`)
}
function clock(timestamp) {
  return `CREATE OR REPLACE FUNCTION public.task10_clock_v1() RETURNS timestamptz LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $clock$ SELECT ${q(timestamp)}::timestamptz $clock$;`
}
async function payKidsPair(actor, ids, reject = false) {
  const cookie = await authCookie(actor), scope = read(`SELECT to_jsonb(s) FROM booking_pricing_scopes s WHERE id=${q(bill(ids[0]).pricing_scope_id)}`)
  const prepared = await request(cookie, '/api/progressive-payments/prepare', { pricingScopeId: scope.id, bookingIds: ids, expectedScopeRevision: scope.revision, idempotencyKey: randomUUID() })
  assert.equal(prepared.status, 200, JSON.stringify(prepared.result))
  const batchId = prepared.result.batch.batchId || prepared.result.batch.id, form = new FormData()
  form.set('batchId', batchId); form.set('file', new File([Buffer.concat([png,Buffer.from(randomUUID())])], 'kids-local.png', { type: 'image/png' }))
  const uploaded = await request(cookie, '/api/progressive-payments/upload', form)
  assert.equal(uploaded.status, 200, JSON.stringify(uploaded.result))
  if (reject) {
    const batch = read(`SELECT to_jsonb(b) FROM progressive_payment_batches b WHERE id=${q(batchId)}`)
    const metadata = { storageBucket: batch.slip_storage_bucket, storagePath: batch.slip_storage_path, mimeType: batch.slip_mime_type, sizeBytes: batch.slip_size_bytes, sha256: batch.slip_sha256 }
    rpc('submit_progressive_payment_batch_v1', `${q(batchId)},${q(actor.id)},${q(JSON.stringify(metadata))}::jsonb,${q(randomUUID())}`)
    rpc('reject_progressive_payment_batch_v1', `${q(batchId)},${q(f.actors.sa.id)},'Local synthetic review rejection',${q(randomUUID())}`)
  } else {
    const submitted = await request(cookie, '/api/progressive-payments/submit', { batchId, submitKey: randomUUID(), attemptKey: randomUUID() })
    assert.equal(submitted.status, 200, JSON.stringify(submitted.result)); assert.equal(submitted.result.batch.status, 'approved')
  }
  return batchId
}
try {
  const adult = await account('user', 'ตรวจชุดแก้ไขรายครั้ง'), initial = [1,2,3].map(n => session(f, 'adult_group', date(n)))
  const created = create(adult, singleInput(f, adult, 'adult_group', initial)), id = created.bookingId
  const original = { financial: financialSnapshot([id]), sessions: sessionsFor(id) }
  const preview = editSet(adult, id, initial.slice(0, 2), [null], 1200, true)
  check(preview.total === 1200, 'Group-set preview calculates new two-round quantity1200')
  assert.deepEqual({ financial: financialSnapshot([id]), sessions: sessionsFor(id) }, original)
  check(true, 'Group-set preview rolls back all bill/session/coupon effects')
  editSet(adult, id, initial.slice(0, 2), [null], 1200)
  check(bill(id).total_sessions === 2 && bill(id).total_price === 1200 && sessionsFor(id).filter(s => s.status === 'scheduled').length === 2, 'Actual group-set save removes Adult round and adjusts quantity/price')
  editSet(adult, id, [1,2,3,4].map(n => session(f, 'adult_group', date(n))), [null], 2400)
  check(bill(id).total_sessions === 4 && bill(id).total_price === 2400, 'Actual group-set save adds Adult rounds and adjusts quantity/price')
  assertReject(() => editSet(adult, id, [session(f, 'adult_group', f.dates.nextMonth + '-02')], [null], 600), /MONTH|TARGET/i)
  check(bill(id).total_sessions === 4 && bill(id).total_price === 2400, 'Group-set editor rejects moving per-session bill to another month without changing it')

  const family = await parentWithChildren('ตรวจแก้ครอบครัว'), members = [null,...family.children]
  const familyRounds = days => days.flatMap(n => members.map(child => session(f, 'private', date(n), child)))
  const familyBill = create(family.actor, singleInput(f, family.actor, 'private', familyRounds([1,2,3]), members)), familyId = familyBill.bookingId
  const shortened = singleInput(f, family.actor, 'private', familyRounds([1,2]), members, familyId)
  rpc('booking_ux_update_v1', `${q(family.actor.id)},${q(randomUUID())},${q(JSON.stringify({ ...shortened, bookingId: familyId }))}::jsonb`)
  check(bill(familyId).total_sessions === 2 && bill(familyId).total_price === 1800 && sessionsFor(familyId).filter(s => s.status === 'scheduled').length === 6, 'Family direct pending edit3→2 retains all3members and charges1800')
  editSet(family.actor, familyId, familyRounds([1,2,3,4]), members, 3600)
  check(bill(familyId).total_sessions === 4 && bill(familyId).total_price === 3600 && sessionsFor(familyId).filter(s => s.status === 'scheduled').length === 12, 'Family group-set edit2→4 retains all3members and charges3600')
  assertReject(() => editSet(family.actor, familyId, familyRounds([1,2]).filter(s => s.childId === null), members, 1800), /PARTICIPANT|FAMILY|LEARNER/)
  check(bill(familyId).total_sessions === 4, 'Partial Family round edit rejects atomically')

  const thresholdActor = await account('user', 'ตรวจรายครั้งสิบครั้ง'), tenSessions = Array.from({ length: 10 }, (_, i) => session(f, 'adult_group', date(i + 1)))
  const ten = create(thresholdActor, singleInput(f, thresholdActor, 'adult_group', tenSessions)), pack = rpc('booking_ux_catalog_v1', '').find(p => p.id === 'adult-10')
  const packInput = { purchasePolicyVersion: 2, packageId: pack.id, packageRevision: pack.revision, participants: [null], learnerType: 'self', childId: null, branchId: f.branches[0], courseTypeId: f.courses.adult_group, month: +f.dates.month.slice(5), year: +f.dates.month.slice(0, 4), totalSessions: 10, totalAmount: 5500, expectedTotalPrice: 5500, sessions: [] }
  const packageBill = create(thresholdActor, packInput)
  check(bill(ten.bookingId).total_sessions === 10 && bill(ten.bookingId).total_price === 6000 && bill(ten.bookingId).package_snapshot.purchaseMode === 'per_session' && bill(packageBill.bookingId).total_price === 5500 && bill(packageBill.bookingId).package_snapshot.purchaseMode === 'package', 'Actual ten singles6000 and explicit ten-course5500 remain distinct bills/modes')
  const thresholdCookie = await authCookie(thresholdActor), slip = new FormData()
  slip.set('file', new File([png], 'local-protected.png', { type: 'image/png' })); slip.set('bookingIds', JSON.stringify([ten.bookingId])); slip.set('expectedAmount', '6000'); slip.set('requestId', randomUUID())
  const payment = await request(thresholdCookie, '/api/verify-slip', slip)
  assert.equal(payment.status, 200, JSON.stringify(payment.result)); assert.equal(payment.result.verified, true)
  check(Number(sql(`SELECT sum(amount) FROM payments WHERE booking_id=${q(ten.bookingId)} AND status='approved'`)) === 6000 && sql(`SELECT count(*) FROM payments WHERE booking_id=${q(ten.bookingId)} AND status='approved'`) === '1' && sessionsFor(ten.bookingId).length === 10, 'Finance source rows record6000 once for10rounds; no per-round payment duplication')
  check(sql(`SELECT count(*) FROM booking_package_units WHERE booking_id=${q(ten.bookingId)}`) === '0', 'Ten singles do not issue zero-scheduled package units after actual payment')

  const couponResults = []
  for (const [type, value, expected] of [['fixed',100,1700],['percent',10,1620],['percent',100,0]]) {
    const actor = await account('user', 'ตรวจคูปอง ' + type + value), offer = coupon(type, value), input = singleInput(f, actor, 'adult_group', initial)
    input.coupon = offer; input.expectedTotalPrice = expected
    const result = create(actor, input), stored = bill(result.bookingId), hold = read(`SELECT to_jsonb(r) FROM progressive_coupon_reservations r WHERE booking_id=${q(result.bookingId)}`)
    assert.equal(stored.total_price, expected); assert.equal(hold.gross_price_snapshot, 1800); assert.equal(hold.discount_amount_snapshot, 1800 - expected)
    assert.equal(hold.status, expected === 0 ? 'consumed' : 'reserved')
    if (expected === 0) { assert.equal(stored.status, 'verified'); assert.equal(sql(`SELECT count(*) FROM payments WHERE booking_id=${q(result.bookingId)} AND amount=0 AND status='approved'`), '1') }
    couponResults.push({ actor, id: result.bookingId, expected })
  }
  check(true, 'Fixed/percent/net-zero single coupons preserve1800gross, exact net, and once-only reserve/consume')
  const makeup = await parentWithChildren('ตรวจยอดซื้อชดเชย'), makeupIds = []
  for (const days of [[1,2,3,4],[5,6,7,8]]) {
    const input = kidsInput(f, makeup.actor, days.map(n => session(f, 'kids_group', date(n), makeup.children[0])))
    const result = create(makeup.actor, input); assert.equal(bill(result.bookingId).total_price, 2500); makeupIds.push(result.bookingId)
  }
  const paidKidsBatch = await payKidsPair(makeup.actor, makeupIds)
  check(makeupIds.every(id => bill(id).status === 'verified') && Number(sql(`SELECT sum(amount) FROM progressive_payment_allocations WHERE payment_batch_id=${q(paidKidsBatch)}`)) === 5000 && sql(`SELECT count(*) FROM progressive_payment_allocations WHERE payment_batch_id=${q(paidKidsBatch)}`) === '2', 'Actual Kids4+4 batch receipt verifies both bills and allocates2500+2500 exactly once')
  const afterPaid = create(makeup.actor, kidsInput(f, makeup.actor, [session(f, 'kids_group', date(9), makeup.children[0])]))
  check(afterPaid.totalPrice === 700, 'K01 new single after actual verified4+4 batch starts at700')
  const facts = rpc('task10_family_makeup_facts_v1', `${q(makeup.actor.id)},${q(f.dates.month + '-01')}`)
  check(facts.sourcePurchase.quantity === 8 && facts.quota === 2, 'K06 actual batch-verified4+4 still contributes monthlyN8 and Makeup quota2; newpending1excluded')
  check(Number(sql(`SELECT sum(allocated_amount) FROM payment_ledger_allocations_v1 WHERE source_kind='progressive' AND status='approved' AND booking_id=ANY(ARRAY[${makeupIds.map(q)}]::uuid[])`)) === 5000, 'Finance approved ledger view reads5000 once across the eight Kids sessions')
  const rejectedActor = await parentWithChildren('ตรวจคืนสลิปสองบิล'), rejectedIds = []
  for (const days of [[1,2,3,4],[5,6,7,8]]) rejectedIds.push(create(rejectedActor.actor, kidsInput(f, rejectedActor.actor, days.map(n => session(f, 'kids_group', date(n), rejectedActor.children[0])))).bookingId)
  const rejectedBatch = await payKidsPair(rejectedActor.actor, rejectedIds, true)
  check(sql(`SELECT status FROM progressive_payment_batches WHERE id=${q(rejectedBatch)}`) === 'rejected' && rejectedIds.every(id => bill(id).total_price === 2500 && bill(id).status === 'pending_payment') && sql(`SELECT count(*) FROM progressive_payment_allocations WHERE payment_batch_id=${q(rejectedBatch)}`) === '0', 'Actual uploaded/submitted/rejected batch preserves per-bill2500 prices and creates no approved allocations')

  const expiry = await parentWithChildren('ตรวจหมดเวลารายบิล'), expA = create(expiry.actor, kidsInput(f, expiry.actor, [1,2,3,4].map(n => session(f, 'kids_group', date(n), expiry.children[0])))), expB = create(expiry.actor, kidsInput(f, expiry.actor, [5,6,7,8].map(n => session(f, 'kids_group', date(n), expiry.children[0]))))
  const at = new Date(Date.parse(bill(expA.bookingId).checkout_deadline) + 1).toISOString()
  const expiration = sql(`BEGIN;${clock(at)} SELECT task10_expire_booking_v1(${q(expA.bookingId)}) IS NOT NULL; DO $check$ BEGIN IF (SELECT status FROM bookings WHERE id=${q(expA.bookingId)})::text<>'cancelled' OR (SELECT total_price FROM bookings WHERE id=${q(expB.bookingId)})<>2500 THEN RAISE EXCEPTION 'Per-bill expiry changed sibling price';END IF;END $check$;ROLLBACK;`)
  check(expiration === 't' && bill(expA.bookingId).status === 'pending_payment', 'Expiry transaction cancels only due bill, preserves sibling2500, and clock fixture fully rolls back')

  sql('UPDATE booking_bill_policy_control SET enabled=false')
  const oldActor = await account('user', 'ตรวจคอร์สก่อนเปิดกฎ'), oldInput = { ...packInput }; delete oldInput.purchasePolicyVersion
  const old = create(oldActor, oldInput), oldBefore = financialSnapshot([old.bookingId])
  sql('UPDATE booking_bill_policy_control SET enabled=true')
  create(oldActor, singleInput(f, oldActor, 'adult_group', [session(f, 'adult_group', date(20))]))
  assert.deepEqual(financialSnapshot([old.bookingId]), oldBefore)
  check(!bill(old.bookingId).package_snapshot.policyVersion, 'Old course bill snapshot/payment/rights remain unchanged after policy activation and new single purchase')

  // Cutoff operators run with the exact Local function bodies except that
  // builtin time reads are replaced by the task clock inside this rolled-back
  // transaction. Real unchanged-clock Store/redeem is covered in http.mjs.
  const cutoffBill = couponResults.find(r => r.expected === 0), cutoffSession = sessionsFor(cutoffBill.id)[0]
  const shims = `DO $shim$ DECLARE r record;d text;BEGIN FOR r IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f' AND (prosrc LIKE '%interval ''48 hours''%' OR prosrc LIKE '%interval ''12 hours''%') LOOP d:=pg_get_functiondef(r.oid);d:=replace(replace(d,'clock_timestamp()','public.task10_clock_v1()'),'transaction_timestamp()','public.task10_clock_v1()');EXECUTE d;END LOOP;END $shim$;`
  const sourceStart = Date.parse(cutoffSession.date + 'T' + cutoffSession.start_time + '+07:00')
  for (const [remainingSeconds, pass] of [[48*3600+1,true],[48*3600,false],[48*3600-1,false]]) {
    const when = new Date(sourceStart - remainingSeconds * 1000).toISOString(), result = sql(`BEGIN;${clock(when)}${shims} DO $boundary$ DECLARE failed boolean:=false;BEGIN BEGIN PERFORM lesson_source_transition_v1(${q(cutoffBill.actor.id)},'store',${q(cutoffSession.id)},'{}'::jsonb);EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%NOT_STORABLE%' AND SQLERRM NOT LIKE '%CUTOFF%' THEN RAISE;END IF;failed:=true;END;IF failed=${pass} THEN RAISE EXCEPTION 'Unexpected Store boundary result';END IF;END $boundary$;SELECT 'ok';ROLLBACK;`)
    assert.equal(result, 'ok')
  }
  check(true, 'Deterministic clock-only Store boundary fixture: >48h passes, =48h and <48h reject')
  const target = session(f, 'adult_group', date(20)), payload = { targetDate: target.date, startTime: target.startTime, endTime: target.endTime, branchId: target.branchId, templateId: target.scheduleTemplateId }
  for (const [remainingSeconds, pass] of [[12*3600+1,true],[12*3600,true],[12*3600-1,false]]) {
    const when = new Date(sourceStart - remainingSeconds * 1000).toISOString(), result = sql(`BEGIN;${clock(when)}${shims} DO $boundary$ DECLARE failed boolean:=false;BEGIN BEGIN PERFORM lesson_source_transition_v1(${q(cutoffBill.actor.id)},'reschedule',${q(cutoffSession.id)},${q(JSON.stringify(payload))}::jsonb);EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RESCHEDULE%' AND SQLERRM NOT LIKE '%CUTOFF%' THEN RAISE;END IF;failed:=true;END;IF failed=${pass} THEN RAISE EXCEPTION 'Unexpected Reschedule boundary result';END IF;END $boundary$;SELECT 'ok';ROLLBACK;`)
    assert.equal(result, 'ok')
  }
  check(true, 'Deterministic clock-only Reschedule boundary fixture: >=12h passes, <12h rejects')

  Object.assign(records, { adult: id, family: familyId, tenSingles: ten.bookingId, explicitPackage: packageBill.bookingId, coupons: couponResults.map(r => ({ id: r.id, expected: r.expected })), monthlyKids: makeupIds, expiry: [expA.bookingId, expB.bookingId], oldPackage: old.bookingId })
  console.log(JSON.stringify({ passed: checks.length, evidence: evidence('protected-pass', { checks, records, cutoffFixture: 'Rolled-back replacement of time reads only; no Product cutoff operators changed.' }) }))
} catch (error) { sql('UPDATE booking_bill_policy_control SET enabled=true'); evidence('protected-failed', { checks, records, error: String(error), stderr: String(error.stderr || '') }); throw error }

