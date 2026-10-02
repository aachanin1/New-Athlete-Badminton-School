import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createLocalAdmin, localSql, readTask10Fixture, setDisposableClock, setupTask10 } from '../task10-regression/local-supabase'

test.beforeAll(async () => {
  test.setTimeout(300_000)
  await setupTask10()
  setDisposableClock('2031-10-01T10:00:00+07:00')
  localSql(`UPDATE task10_policy_activation SET state='active',revision=1,effective_at='2031-09-01T00:00:00Z',pricing_enabled=true,makeup_enabled=true,expiry_enabled=true WHERE singleton;
    INSERT INTO schedule_templates(branch_id,course_type_id,day_of_week,start_time,end_time,is_active)
    SELECT '${readTask10Fixture().branchId}','${readTask10Fixture().kidsCourseId}',d,'17:00','19:00',true FROM generate_series(0,6) d
    WHERE NOT EXISTS(SELECT 1 FROM schedule_templates WHERE branch_id='${readTask10Fixture().branchId}' AND course_type_id='${readTask10Fixture().kidsCourseId}' AND day_of_week=d AND start_time='17:00' AND end_time='19:00' AND is_active);`)
})

async function parent() {
  const client = createLocalAdmin(), child = randomUUID(), email = `pay-zero-${randomUUID()}@example.com`
  const created = await client.auth.admin.createUser({ email, password: 'LocalPayZero!2026', email_confirm: true })
  expect(created.error).toBeNull()
  const user = created.data.user!.id
  expect((await client.from('children').insert({ id: child, parent_id: user, full_name: 'ผู้เรียนทดสอบยอดศูนย์', date_of_birth: '2015-01-01' })).error).toBeNull()
  return { user, child, email }
}
async function coupon(type: 'percent' | 'fixed', value: number, maxUses = 10, validTo: string | null = null) {
  const id = randomUUID(), code = `ZERO-${id}`.toUpperCase(), f = readTask10Fixture()
  expect((await createLocalAdmin().from('coupons').insert({ id, code, discount_type: type, discount_value: value, max_uses: maxUses,
    current_uses: 0, is_active: true, valid_from: '2020-01-01', valid_to: validTo, created_by: f.adminUserId })).error).toBeNull()
  return { id, code }
}
function sessions(child: string, day = 20, count = 1) {
  return Array.from({ length: count }, (_, i) => ({ date: `2031-10-${day+i}`, start_time: '17:00', end_time: '19:00', branch_id: readTask10Fixture().branchId, child_id: child }))
}
let creationTick = 0
async function request(who: Awaited<ReturnType<typeof parent>>, couponId: string | null, day = 20, count = 1) {
  // The disposable clock must advance between sequential creations: production
  // orders by successful created_at then UUID, not by the caller's test order.
  setDisposableClock(new Date(Date.UTC(2031,9,1,3,0,++creationTick)).toISOString())
  const f = readTask10Fixture(), client = createLocalAdmin()
  const policy = await client.rpc('task10_booking_policy_quote_v1', { p_user_id: who.user, p_course_type_id: f.kidsCourseId, p_lesson_month: '2031-10-01', p_formula: 'progressive', p_booking_id: null })
  expect(policy.error).toBeNull()
  const baseline = await client.rpc('progressive_legacy_baseline_v1', { p_user_id: who.user, p_course_type_id: f.kidsCourseId, p_lesson_year: 2031, p_lesson_month: 10 })
  expect(baseline.error).toBeNull()
  const scope = await client.from('booking_pricing_scopes').select('revision').eq('user_id', who.user).eq('course_type_id', f.kidsCourseId).eq('lesson_year', 2031).eq('lesson_month', 10).maybeSingle()
  expect(scope.error).toBeNull()
  return { p_user_id: who.user, p_learner_type: 'child', p_child_id: who.child, p_branch_id: f.branchId, p_course_type_id: f.kidsCourseId,
    p_sessions: sessions(who.child, day, count), p_coupon_id: couponId, p_client_request_id: randomUUID(), p_expected_scope_revision: scope.data?.revision || 0,
    p_expected_legacy_baseline_sessions: baseline.data[0].baseline_sessions, p_expected_legacy_baseline_fingerprint: baseline.data[0].baseline_fingerprint,
    p_expected_policy_fingerprint: policy.data.fingerprint }
}
async function create(who: Awaited<ReturnType<typeof parent>>, couponId: string | null, day = 20, count = 1) {
  const args = await request(who, couponId, day, count)
  const result = await createLocalAdmin().rpc('task10_create_progressive_booking_v1', args)
  expect(result.error).toBeNull()
  return { args, result: result.data as { bookingId: string; scopeId: string; scopeRevision: number; totalPrice: number; expiresAt: string } }
}
function state(id: string) {
  return JSON.parse(localSql(`SELECT jsonb_build_object('booking',(SELECT to_jsonb(b) FROM bookings b WHERE id='${id}'),
    'reservation',(SELECT to_jsonb(r) FROM progressive_coupon_reservations r WHERE booking_id='${id}'),
    'payments',(SELECT count(*) FROM payments WHERE booking_id='${id}'),
    'allocations',(SELECT count(*) FROM progressive_payment_allocations WHERE booking_id='${id}'),
    'calculations',(SELECT jsonb_agg(to_jsonb(c) ORDER BY revision) FROM task10_booking_calculations c WHERE booking_id='${id}'),
    'zeroLogs',(SELECT count(*) FROM activity_logs WHERE entity_id='${id}' AND action='verify_zero_charge_booking'),
    'sessions',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM booking_sessions s WHERE booking_id='${id}'));`))
}

for (const [label, type, value] of [['percent100', 'percent', 100], ['fixed700', 'fixed', 700], ['fixedAboveGross', 'fixed', 1000]] as const) {
  test(`Progressive ${label} verifies a zero bill and consumes one coupon without financial receipt`, async () => {
    const who = await parent(), c = await coupon(type, value), made = await create(who, c.id)
    const s = state(made.result.bookingId)
    expect(made.result.totalPrice).toBe(0)
    expect(s.booking.status).toBe('verified')
    expect(s.booking.gross_price_snapshot).toBe(700)
    expect(s.reservation.status).toBe('consumed')
    expect(s.payments).toBe(0); expect(s.allocations).toBe(0); expect(s.zeroLogs).toBe(1)
    expect(s.calculations).toHaveLength(1)
    expect(s.calculations[0].evidence).toMatchObject({ gross: 700, discount: 700, final: 0 })
    expect(s.sessions).toHaveLength(1); expect(s.sessions[0].child_id).toBe(who.child)
    const replay = await createLocalAdmin().rpc('task10_create_progressive_booking_v1', made.args)
    expect(replay.error).toBeNull(); expect(replay.data).toMatchObject({ bookingId: made.result.bookingId, idempotentReplay: true })
    expect(state(made.result.bookingId)).toEqual(s)
  })
}

test('positive remainder and full-price bill still require the complete positive payment scope', async () => {
  const who = await parent(), c = await coupon('fixed', 699)
  const a = await create(who, c.id), b = await create(who, null, 21)
  expect(a.result.totalPrice).toBe(1); expect(state(a.result.bookingId).booking.status).toBe('pending_payment')
  expect(b.result.totalPrice).toBe(625)
  const prepared = await createLocalAdmin().rpc('prepare_progressive_payment_batch_v2', {
    p_user_id: who.user, p_pricing_scope_id: b.result.scopeId, p_booking_ids: JSON.parse(localSql(`SELECT jsonb_agg(id ORDER BY created_at,id) FROM bookings WHERE pricing_scope_id='${b.result.scopeId}' AND status='pending_payment';`)),
    p_expected_scope_revision: b.result.scopeRevision, p_idempotency_key: randomUUID(), p_expected_total: 626,
  })
  expect(prepared.error).toBeNull(); expect(prepared.data.totalAmount).toBe(626)
})

test('mixed scope excludes the verified zero bill from payment and preserves its frozen evidence', async () => {
  const who = await parent(), c = await coupon('percent',100), a = await create(who,c.id), before = state(a.result.bookingId)
  const b = await create(who,null,21)
  expect(state(a.result.bookingId)).toEqual(before)
  const prepared = await createLocalAdmin().rpc('prepare_progressive_payment_batch_v2', {
    p_user_id: who.user,p_pricing_scope_id:b.result.scopeId,p_booking_ids:[b.result.bookingId],p_expected_scope_revision:b.result.scopeRevision,
    p_idempotency_key:randomUUID(),p_expected_total:625,
  })
  expect(prepared.error).toBeNull(); expect(prepared.data.bookingIds).toEqual([b.result.bookingId])
  expect(prepared.data.totalAmount).toBe(625); expect(state(a.result.bookingId)).toEqual(before)
})

test('same replay raced twice creates only one booking and one consumed reservation', async () => {
  const who=await parent(), c=await coupon('percent',100), args=await request(who,c.id), client=createLocalAdmin()
  const results=await Promise.all([client.rpc('task10_create_progressive_booking_v1',args),client.rpc('task10_create_progressive_booking_v1',args)])
  results.forEach(r=>expect(r.error).toBeNull())
  expect(results[0].data.bookingId).toBe(results[1].data.bookingId)
  expect(results.filter(r=>r.data.idempotentReplay)).toHaveLength(1)
  expect(state(results[0].data.bookingId).zeroLogs).toBe(1)
  expect(localSql(`SELECT count(*) FROM bookings WHERE user_id='${who.user}';`)).toBe('1')
})

test('one-use coupon across two families succeeds once with no losing booking residue', async () => {
  const a=await parent(),b=await parent(),c=await coupon('percent',100,1),client=createLocalAdmin()
  const args=await Promise.all([request(a,c.id),request(b,c.id)])
  const results=await Promise.all(args.map(input=>client.rpc('task10_create_progressive_booking_v1',input)))
  expect(results.filter(r=>!r.error)).toHaveLength(1)
  expect(results.find(r=>r.error)?.error?.message).toContain('PROGRESSIVE_COUPON_MAX_USES')
  expect(localSql(`SELECT count(*) FROM bookings WHERE user_id IN ('${a.user}','${b.user}');`)).toBe('1')
  expect(localSql(`SELECT count(*) FROM progressive_coupon_reservations WHERE coupon_id='${c.id}' AND status='consumed';`)).toBe('1')
})

test('expired coupon cannot grant a zero-charge entitlement', async () => {
  const who=await parent(),c=await coupon('percent',100,10,'2020-01-02'),args=await request(who,c.id)
  const result=await createLocalAdmin().rpc('task10_create_progressive_booking_v1',args)
  expect(result.error?.message).toContain('PROGRESSIVE_COUPON_EXPIRED')
  expect(localSql(`SELECT count(*) FROM bookings WHERE user_id='${who.user}';`)).toBe('0')
})

test('verified zero bill retains rights past the slip deadline and cannot be cancelled as unpaid', async () => {
  const who=await parent(),c=await coupon('percent',100),made=await create(who,c.id),before=state(made.result.bookingId)
  setDisposableClock('2031-10-22T10:00:00+07:00')
  try {
    expect(localSql(`SELECT task10_booking_due_v1('${made.result.bookingId}');`)).toBe('f')
    const cancelled=await createLocalAdmin().rpc('cancel_progressive_pending_booking_v1', {p_user_id:who.user,p_booking_id:made.result.bookingId,p_client_request_id:randomUUID(),p_expected_scope_revision:made.result.scopeRevision})
    expect(cancelled.error?.message).toContain('PROGRESSIVE_BOOKING_NOT_PENDING')
    expect(state(made.result.bookingId)).toEqual(before)
  } finally { setDisposableClock('2031-10-01T10:00:00+07:00') }
})

test('Legacy coupon-zero follows final net amount and retains the existing no-payment convention', async () => {
  const who=await parent(),c=await coupon('fixed',700),f=readTask10Fixture(),client=createLocalAdmin()
  // Exercise the protected Legacy writer in its allowed pre-activation regime.
  localSql(`UPDATE task10_policy_activation SET state='never_activated',effective_at=NULL,pricing_enabled=false,makeup_enabled=false,expiry_enabled=false WHERE singleton;`)
  try {
    const args={p_user_id:who.user,p_action:'create',p_request_id:randomUUID(),p_input:{learnerType:'child',childId:who.child,branchId:f.branchId,courseTypeId:f.kidsCourseId,month:10,year:2031,totalSessions:1,totalAmount:700,expectedTotalPrice:0,
      sessions:[{date:'2031-10-20',startTime:'17:00',endTime:'19:00',branchId:f.branchId,childId:who.child}],coupon:{id:c.id,code:c.code}}}
    const result=await client.rpc('task10_write_legacy_booking_v1',args)
    expect(result.error).toBeNull(); expect(result.data).toMatchObject({totalPrice:0,status:'verified'})
    const replay=await client.rpc('task10_write_legacy_booking_v1',args)
    expect(replay.error).toBeNull();expect(replay.data.idempotentReplay).toBe(true)
    expect(localSql(`SELECT count(*) FROM coupon_usages WHERE booking_id='${result.data.bookingId}';`)).toBe('1')
    expect(localSql(`SELECT count(*) FROM payments WHERE booking_id='${result.data.bookingId}';`)).toBe('0')
  } finally { localSql(`UPDATE task10_policy_activation SET state='active',effective_at='2031-09-01T00:00:00Z',pricing_enabled=true,makeup_enabled=true,expiry_enabled=true WHERE singleton;`) }
})

test('editing a pending two-session bill to one session finalizes the authoritative zero balance', async () => {
  const who=await parent(),c=await coupon('fixed',700),made=await create(who,c.id,20,2),f=readTask10Fixture(),client=createLocalAdmin()
  expect(made.result.totalPrice).toBe(550)
  const policy=await client.rpc('task10_booking_policy_quote_v1',{p_user_id:who.user,p_course_type_id:f.kidsCourseId,p_lesson_month:'2031-10-01',p_formula:'progressive',p_booking_id:made.result.bookingId})
  expect(policy.error).toBeNull()
  const args={p_user_id:who.user,p_booking_id:made.result.bookingId,p_branch_id:f.branchId,p_sessions:sessions(who.child),p_client_request_id:randomUUID(),
    p_expected_scope_revision:made.result.scopeRevision,p_expected_policy_fingerprint:policy.data.fingerprint}
  const result=await client.rpc('task10_update_progressive_booking_v1',args)
  expect(result.error).toBeNull();expect(result.data.totalPrice).toBe(0)
  const s=state(made.result.bookingId)
  expect(s.booking.status).toBe('verified');expect(s.booking.expires_at).toBe(made.result.expiresAt)
  expect(s.reservation.status).toBe('consumed');expect(s.sessions).toHaveLength(1);expect(s.calculations).toHaveLength(2)
  expect(s.calculations[1].evidence).toMatchObject({gross:700,discount:700,final:0})
  const replay=await client.rpc('task10_update_progressive_booking_v1',args)
  expect(replay.error).toBeNull();expect(replay.data.idempotentReplay).toBe(true);expect(state(made.result.bookingId)).toEqual(s)
})

test('downstream reprice can finalize a coupon-zero bill without rewriting an earlier settled bill', async () => {
  const who=await parent(),client=createLocalAdmin(),f=readTask10Fixture()
  const a=await create(who,null,10,5)
  setDisposableClock('2031-10-01T10:01:00+07:00')
  const c=await coupon('fixed',600),b=await create(who,c.id,25)
  expect(b.result.totalPrice).toBe(25)
  const policy=await client.rpc('task10_booking_policy_quote_v1',{p_user_id:who.user,p_course_type_id:f.kidsCourseId,p_lesson_month:'2031-10-01',p_formula:'progressive',p_booking_id:a.result.bookingId})
  const result=await client.rpc('task10_update_progressive_booking_v1',{p_user_id:who.user,p_booking_id:a.result.bookingId,p_branch_id:f.branchId,p_sessions:sessions(who.child,10,10),
    p_client_request_id:randomUUID(),p_expected_scope_revision:b.result.scopeRevision,p_expected_policy_fingerprint:policy.data.fingerprint})
  expect(result.error).toBeNull()
  const after=state(b.result.bookingId)
  expect(after.booking.status).toBe('verified');expect(after.booking.total_price).toBe(0);expect(after.reservation.status).toBe('consumed')
  expect(after.booking.expires_at).toBe(b.result.expiresAt);expect(after.payments).toBe(0)
  const frozen=state(b.result.bookingId)
  await create(who,null,26)
  expect(state(b.result.bookingId)).toEqual(frozen)
  setDisposableClock('2031-10-01T10:00:00+07:00')
})

test('zero-bill Kids Wallet and Makeup purchase evidence retain exact learner/session entitlement', async () => {
  const who=await parent(),c=await coupon('percent',100),made=await create(who,c.id,20,4),f=readTask10Fixture(),client=createLocalAdmin()
  const before=state(made.result.bookingId),session=before.sessions[0]
  const stored=await client.rpc('lesson_wallet_store_v2',{p_user_id:who.user,p_session_id:session.id,p_actor_id:who.user})
  expect(stored.error).toBeNull()
  expect(localSql(`SELECT child_id FROM lesson_wallet_credit_members WHERE original_session_id='${session.id}';`)).toBe(who.child)
  expect(localSql(`SELECT entitlement_sessions FROM bookings WHERE id='${made.result.bookingId}';`)).toBe('4')
  const makeup=await client.rpc('task10_family_makeup_state_v1',{p_actor_id:f.makeupAdminId,p_parent_id:who.user,p_source_month:'2031-10-01'})
  expect(makeup.error).toBeNull()
  expect(localSql(`SELECT task10_verified_purchase_v1('${who.user}','2031-10-01')->>'quantity';`)).toBe('4')
  expect(localSql(`SELECT count(*) FROM payments WHERE booking_id='${made.result.bookingId}';`)).toBe('0')
})

test('internal zero finalizer and direct status writes remain inaccessible to service/API callers', async () => {
  const who=await parent(),c=await coupon('fixed',699),made=await create(who,c.id),client=createLocalAdmin(),before=state(made.result.bookingId)
  const direct=await client.rpc('verify_progressive_zero_charge_booking_v1',{p_booking_id:made.result.bookingId,p_user_id:who.user})
  expect(direct.error?.code).toBe('42501')
  const update=await client.from('bookings').update({status:'verified'}).eq('id',made.result.bookingId)
  expect(update.error?.message).toMatch(/GUARDED/)
  expect(state(made.result.bookingId)).toEqual(before)
})

test('failed consumption rolls back booking, sessions, calculation, coupon and audit together', async () => {
  const who=await parent(),c=await coupon('percent',100),args=await request(who,c.id)
  localSql(`CREATE FUNCTION public.pay_zero_test_fail_consume() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PAY_ZERO_SYNTHETIC_FAILURE'; END $$;
    CREATE TRIGGER pay_zero_test_fail_consume BEFORE UPDATE ON progressive_coupon_reservations FOR EACH ROW WHEN (NEW.status='consumed') EXECUTE FUNCTION public.pay_zero_test_fail_consume();`)
  try {
    const result=await createLocalAdmin().rpc('task10_create_progressive_booking_v1',args)
    expect(result.error?.message).toContain('PAY_ZERO_SYNTHETIC_FAILURE')
    const residue=JSON.parse(localSql(`SELECT jsonb_build_object('bookings',(SELECT count(*) FROM bookings WHERE user_id='${who.user}'),
      'reservations',(SELECT count(*) FROM progressive_coupon_reservations WHERE coupon_id='${c.id}'),
      'receipts',(SELECT count(*) FROM progressive_booking_mutation_receipts WHERE user_id='${who.user}'),
      'logs',(SELECT count(*) FROM activity_logs WHERE user_id='${who.user}'),'payments',(SELECT count(*) FROM payments WHERE user_id='${who.user}'));`))
    expect(residue).toEqual({bookings:0,reservations:0,receipts:0,logs:0,payments:0})
  } finally { localSql('DROP TRIGGER pay_zero_test_fail_consume ON progressive_coupon_reservations; DROP FUNCTION public.pay_zero_test_fail_consume();') }
})

for (const [label,type,value] of [['percent100','percent',100],['fixed700','fixed',700],['positiveRemainder','fixed',699]] as const) {
  test(`browser booking ${label} follows server settlement through history`, async ({page},testInfo) => {
    test.skip(process.env.PAY_ZERO_UI!=='true','Requires the isolated production-mode app')
    test.setTimeout(180_000)
    const errors:string[]=[]
    page.on('pageerror',error=>errors.push(error.message))
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
    const who=await parent(),c=await coupon(type,value),f=readTask10Fixture(),date='2031-10-20'
    await page.goto('/auth/login')
    await page.locator('#email').fill(who.email);await page.locator('#password').fill('LocalPayZero!2026')
    await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await page.waitForURL(/\/dashboard(?:\/|$)/)
    await page.addInitScript(({key,draft})=>sessionStorage.setItem(key,JSON.stringify(draft)),{
      key:`nabs:booking-draft:v2:${who.user}:new`,draft:{version:2,step:'summary',courseType:'kids_group',learnerType:'child',selectedChildIds:[who.child],
        privateSelfAttend:false,selectedBranchIds:[f.branchId],calMonth:9,calYear:2031,sessionsMap:{[who.child]:[{date,dayOfWeek:1,start:'17:00',end:'19:00',branchId:f.branchId}]},
        activeChildTab:who.child,clientRequestId:randomUUID(),updatedAt:Date.now()},
    })
    await page.goto('/dashboard/booking?month=2031-10')
    await expect(page.getByTestId('booking-step5-total')).toHaveText('฿700')
    await page.getByPlaceholder('กรอกรหัสคูปอง').fill(c.code);await page.getByRole('button',{name:'ใช้คูปอง',exact:true}).click()
    const zero=value!==699
    await expect(page.getByTestId('booking-step5-total')).toHaveText(zero?'฿0':'฿1')
    if(zero)await expect(page.getByText('ไม่ต้องแนบสลิปสำหรับรายการนี้')).toBeVisible()
    const posted=page.waitForResponse(r=>r.url().endsWith('/api/bookings')&&r.request().method()==='POST')
    await page.getByTestId('booking-confirm').click()
    const response=await posted,result=await response.json()
    expect(response.status(),JSON.stringify(result)).toBe(200)
    expect(result.status).toBe(zero?'verified':'pending_payment')
    await page.waitForURL(/\/dashboard\/history/)
    const card=page.getByTestId(`history-booking-${result.bookingId}`)
    await expect(card).toBeVisible()
    if(zero){
      await expect(card.getByText('ยืนยันแล้ว — ไม่ต้องชำระเงิน',{exact:true})).toBeVisible()
      await expect(page.getByRole('button',{name:/ชำระทั้งหมด/})).toHaveCount(0)
      await card.getByRole('button',{name:'ดูรายละเอียด'}).click()
      await expect(page.getByRole('dialog').getByText('ยืนยันแล้ว — ไม่ต้องชำระเงิน ยอดสุทธิ 0 บาท ไม่ต้องแนบสลิป')).toBeVisible()
      await expect(page.getByRole('dialog').getByRole('button',{name:/แนบสลิป|ชำระ/})).toHaveCount(0)
      const s=state(result.bookingId)
      expect(s.booking.status).toBe('verified');expect(s.reservation.status).toBe('consumed');expect(s.payments).toBe(0)
    }else{
      await expect(card.getByText('รอแนบสลิป',{exact:true})).toBeVisible()
      await page.getByRole('button',{name:/ชำระทั้งหมด/}).click()
      await page.locator('#slip-upload').setInputFiles({name:'synthetic-positive-slip.png',mimeType:'image/png',
        buffer:Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1cAAAAASUVORK5CYII=','base64'),Buffer.from(randomUUID())])})
      const submitted=page.waitForResponse(r=>r.url().endsWith('/api/progressive-payments/submit')&&r.request().method()==='POST')
      await page.getByTestId('payment-slip-submit').click()
      const receipt=await submitted,body=await receipt.json()
      expect(receipt.status(),JSON.stringify(body)).toBe(200);expect(body.batch.status).toBe('approved')
      const s=state(result.bookingId);expect(s.booking.status).toBe('verified');expect(s.reservation.status).toBe('consumed');expect(s.zeroLogs).toBe(0)
      expect(localSql(`SELECT sum(amount) FROM progressive_payment_allocations WHERE booking_id='${result.bookingId}';`)).toBe('1.00')
    }
    await page.screenshot({path:testInfo.outputPath(`${label}-history.png`),fullPage:true})
    expect(errors).toEqual([])
  })
}

test('local rollback and forward reapply preserve all successful booking and financial data',async()=>{
  const snapshot=()=>localSql(`SELECT md5(jsonb_build_object('bookings',(SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM bookings b),
    'sessions',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM booking_sessions s),'coupons',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM coupons c),
    'reservations',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM progressive_coupon_reservations r),
    'calculations',(SELECT jsonb_agg(to_jsonb(c) ORDER BY booking_id,revision) FROM task10_booking_calculations c),
    'payments',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM payments p),'allocations',(SELECT jsonb_agg(to_jsonb(a) ORDER BY booking_id) FROM progressive_payment_allocations a),
    'wallet',(SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM lesson_wallet_credits w),'logs',(SELECT jsonb_agg(to_jsonb(l) ORDER BY id) FROM activity_logs l))::text);`)
  const before=snapshot()
  const forward=readFileSync(resolve('supabase/migrations/20261002072441_verify_kids_coupon_zero_charge_booking.sql'),'utf8')
  try {
    localSql(readFileSync(resolve('supabase/rollbacks/pay-zero-1.sql'),'utf8'))
    expect(snapshot()).toBe(before)
    expect(localSql(`SELECT to_regprocedure('public.verify_progressive_zero_charge_booking_v1(uuid,uuid)') IS NULL;`)).toBe('t')
  }finally{localSql(forward)}
  expect(snapshot()).toBe(before)
})
