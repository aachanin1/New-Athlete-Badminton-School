import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { TEST_ACCOUNT } from '../booking-regression/local-supabase'
import { concurrentLocalSql, createLocalAdmin, localSql, readTask10Fixture, setDisposableClock, setupTask10, sqlLiteral, task10MigrationHashes, uploadTask10Slip } from './local-supabase'

test.afterAll(async () => { await setupTask10() })

test('all controls Active: September25 server booking for October, payment, sibling Makeup and real expiry worker coexist', async ({ page }, testInfo) => {
  test.setTimeout(240_000)
  const f = readTask10Fixture(), client = createLocalAdmin(), sibling = randomUUID(), sourceBooking = randomUUID(), source = randomUUID()
  setDisposableClock('2026-09-25T10:00:00+07:00')
  // Synthetic historical purchase, before local cutover only. Every write uses
  // localSql's physical container/volume/Auth/REST/Storage identity guard.
  localSql(`BEGIN;
    INSERT INTO children(id,parent_id,full_name,nickname,date_of_birth) VALUES('${sibling}','${f.userId}','Readiness Sibling','Sibling','2016-01-01');
    INSERT INTO schedule_templates(branch_id,course_type_id,day_of_week,start_time,end_time,is_active)
      SELECT '${f.branchId}','${f.kidsCourseId}',d,'17:00','19:00',true FROM generate_series(0,6) d
      WHERE NOT EXISTS(SELECT 1 FROM schedule_templates WHERE branch_id='${f.branchId}' AND course_type_id='${f.kidsCourseId}' AND day_of_week=d AND start_time='17:00' AND end_time='19:00' AND is_active);
    INSERT INTO bookings(id,user_id,learner_type,child_id,branch_id,course_type_id,year,month,total_sessions,entitlement_sessions,total_price,status,created_at)
      VALUES('${sourceBooking}','${f.userId}','child','${f.mainChildId}','${f.branchId}','${f.kidsCourseId}',2026,9,20,20,10000,'verified','2026-09-01T00:00:00Z');
    INSERT INTO schedule_slots(template_id,branch_id,course_type_id,date,start_time,end_time,max_students,current_students,status)
      SELECT t.id,t.branch_id,t.course_type_id,d::date,t.start_time,t.end_time,6,0,'open' FROM generate_series('2026-09-01'::date,'2026-09-20'::date,interval '1 day') d
      JOIN schedule_templates t ON t.branch_id='${f.branchId}' AND t.course_type_id='${f.kidsCourseId}' AND t.day_of_week=extract(dow FROM d) AND t.start_time='17:00' AND t.end_time='19:00' AND t.is_active;
    INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup)
      SELECT CASE WHEN date='2026-09-01' THEN '${source}'::uuid ELSE gen_random_uuid() END,'${sourceBooking}',id,date,start_time,end_time,branch_id,'${f.mainChildId}',
        CASE WHEN date='2026-09-01' THEN 'absent'::session_status ELSE 'scheduled'::session_status END,false
      FROM schedule_slots WHERE branch_id='${f.branchId}' AND course_type_id='${f.kidsCourseId}' AND date BETWEEN '2026-09-01' AND '2026-09-20' AND start_time='17:00';
    INSERT INTO attendance(booking_session_id,student_id,student_type,coach_id,status) VALUES('${source}','${f.mainChildId}','child','${f.adminUserId}','absent'); COMMIT;`)
  const artifact = { sourceSha: 'a'.repeat(40), deploymentId: 'dpl_local_full_readiness', targetProjectRef: 'verified-local-disposable',
    migrationHashes: task10MigrationHashes(), productionPromotionConfirmed: true, healthChecksPassed: true }
  localSql(`SELECT task10_activate_v1('${f.adminUserId}',task10_activation_manifest_v1('${f.adminUserId}',${sqlLiteral(JSON.stringify(artifact))}::jsonb));`)
  const controls = () => JSON.parse(localSql(`SELECT jsonb_build_object('pricing',pricing_enabled,'makeup',makeup_enabled,'expiry',expiry_enabled,'cron',
    (SELECT active FROM cron.job WHERE jobname='task10-expire-unpaid-bookings-v1')) FROM task10_policy_activation;`))
  expect(controls()).toEqual({ pricing: true, makeup: true, expiry: true, cron: true })
  const worker = async () => {
    const result = JSON.parse(await concurrentLocalSql('SELECT task10_run_expiry_v1(50);'))
    expect(result.failures || []).toEqual([])
    expect(result.status).not.toBe('inactive')
    return result
  }
  await page.goto('/auth/login')
  await page.locator('#email').fill(TEST_ACCOUNT.email); await page.locator('#password').fill(TEST_ACCOUNT.password)
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click(); await page.waitForURL(/\/dashboard(?:\/|$)/)
  const ids: string[] = []
  for (const [index, child] of [f.mainChildId, sibling].entries()) {
    // Preserve real creation order instead of collapsing both bills onto the
    // same synthetic instant and allowing random UUID order to reverse them.
    setDisposableClock(`2026-09-25T10:00:0${index}+07:00`)
    const previewResponse = await page.request.post('/api/bookings/preview', { data: { courseTypeId: f.kidsCourseId, month: 10, year: 2026, totalSessions: 1 } })
    const quote = await previewResponse.json(); expect(previewResponse.status(), JSON.stringify(quote)).toBe(200)
    expect(quote.policy.catalog.regime).toBe('late')
    expect(quote.totalPrice).toBe(index === 0 ? 700 : 625)
    const template = localSql(`SELECT id FROM schedule_templates WHERE branch_id='${f.branchId}' AND course_type_id='${f.kidsCourseId}' AND day_of_week=extract(dow FROM date '2026-10-${10 + index}') AND start_time='17:00' AND end_time='19:00' AND is_active;`)
    const [response] = await Promise.all([page.request.post('/api/bookings', { data: {
      learnerType: 'child', childId: child, branchId: f.branchId, courseTypeId: f.kidsCourseId, month: 10, year: 2026,
      totalSessions: 1, totalAmount: quote.totalPrice, expectedTotalPrice: quote.totalPrice, clientRequestId: randomUUID(),
      expectedPolicyFingerprint: quote.policy.fingerprint, expectedScopeRevision: quote.expectedScopeRevision,
      expectedLegacyBaselineSessions: quote.legacyBaselineSessions, expectedLegacyBaselineFingerprint: quote.legacyBaselineFingerprint,
      sessions: [{ date: `2026-10-${10 + index}`, startTime: '17:00', endTime: '19:00', branchId: f.branchId, childId: child, scheduleTemplateId: template }],
    } }), worker()])
    const body = await response.json(); expect(response.status(), JSON.stringify(body)).toBe(200)
    ids.push(body.bookingId || body.data?.bookingId)
    expect(ids[index]).toMatch(/^[a-f0-9-]{36}$/)
  }
  const stored = await client.from('bookings').select('id,total_price,pricing_scope_id,status').in('id', ids).order('created_at').order('id')
  expect(stored.error).toBeNull(); expect(stored.data!.map(b => Number(b.total_price))).toEqual([700, 625])
  expect(localSql(`SELECT count(*) FROM task10_booking_pricing_evidence WHERE booking_id IN (${ids.map(sqlLiteral)}) AND bangkok_date='2026-09-25' AND lesson_month='2026-10-01' AND formula='progressive';`)).toBe('2')
  const scopeId = stored.data![0].pricing_scope_id
  const scope = await client.from('booking_pricing_scopes').select('revision').eq('id', scopeId).single()
  const prepared = await client.rpc('prepare_progressive_payment_batch_v2', { p_user_id: f.userId, p_pricing_scope_id: scopeId, p_booking_ids: ids,
    p_expected_scope_revision: scope.data!.revision, p_expected_total: 1325, p_idempotency_key: randomUUID() })
  expect(prepared.error).toBeNull(); const batch = prepared.data.batchId
  const slip = await uploadTask10Slip(f.userId, batch)
  const metadata = { storageBucket: 'progressive-payment-slips', storagePath: slip.storagePath, mimeType: 'image/png', sizeBytes: 104, sha256: slip.sha256 }
  expect((await client.rpc('record_progressive_payment_upload_v1', { p_batch_id: batch, p_user_id: f.userId, p_storage_bucket: metadata.storageBucket,
    p_storage_path: slip.storagePath, p_mime_type: 'image/png', p_size_bytes: 104, p_sha256: slip.sha256 })).error).toBeNull()
  const [submitted] = await Promise.all([client.rpc('submit_progressive_payment_batch_v1', { p_batch_id: batch, p_user_id: f.userId, p_slip_metadata: metadata, p_idempotency_key: randomUUID() }), worker()])
  expect(submitted.error).toBeNull()
  const [approved] = await Promise.all([client.rpc('approve_progressive_payment_batch_v1', { p_batch_id: batch, p_actor_id: f.adminUserId, p_idempotency_key: randomUUID() }), worker()])
  expect(approved.error).toBeNull()
  const state = await client.rpc('task10_family_makeup_state_v1', { p_actor_id: f.makeupAdminId, p_parent_id: f.userId, p_source_month: '2026-09-01' })
  expect(state.error).toBeNull(); expect(state.data).toMatchObject({ quota: 5, used: 0, remaining: 5, destinationPurchase: { quantity: 2 }, eligible: true })
  const template = localSql(`SELECT id FROM schedule_templates WHERE branch_id='${f.branchId}' AND course_type_id='${f.kidsCourseId}' AND day_of_week=extract(dow FROM date '2026-10-20') AND start_time='17:00' AND end_time='19:00' AND is_active;`)
  const consumeArgs = { p_actor_id: f.makeupAdminId, p_source_session_id: source, p_attending_child_id: sibling, p_template_id: template,
    p_branch_id: f.branchId, p_target_date: '2026-10-20', p_start_time: '17:00', p_end_time: '19:00', p_request_id: randomUUID() }
  const [used] = await Promise.all([client.rpc('task10_consume_family_makeup_v1', consumeArgs), worker()])
  expect(used.error).toBeNull(); expect(used.data).toMatchObject({ remaining: 4, data: { child_id: sibling, rescheduled_from_id: source } })
  expect((await client.rpc('task10_consume_family_makeup_v1', consumeArgs)).data).toEqual(used.data)
  localSql(`INSERT INTO schedule_templates(branch_id,course_type_id,day_of_week,start_time,end_time,is_active)
    SELECT '${f.branchId}','${f.adultCourseId}',extract(dow FROM date '2026-10-22'),'10:00','11:00',true
    WHERE NOT EXISTS(SELECT 1 FROM schedule_templates WHERE branch_id='${f.branchId}' AND course_type_id='${f.adultCourseId}'
      AND day_of_week=extract(dow FROM date '2026-10-22') AND start_time='10:00' AND end_time='11:00' AND is_active);`)
  const unpaid = await client.rpc('task10_write_legacy_booking_v1', { p_user_id: f.userId, p_action: 'create', p_request_id: randomUUID(),
    p_input: { learnerType: 'self', childId: null, branchId: f.branchId, courseTypeId: f.adultCourseId, year: 2026, month: 10,
      totalSessions: 1, totalAmount: 500, expectedTotalPrice: 500, sessions: [{ date: '2026-10-22', startTime: '10:00', endTime: '11:00', branchId: f.branchId, childId: null }] } })
  expect(unpaid.error).toBeNull()
  setDisposableClock('2026-10-23T10:00:00+07:00')
  await worker()
  expect(localSql(`SELECT status FROM bookings WHERE id='${unpaid.data.bookingId}';`)).toBe('cancelled')
  expect(localSql(`SELECT count(*) FROM task10_booking_cancellations WHERE booking_id='${unpaid.data.bookingId}';`)).toBe('1')
  expect(localSql(`SELECT status||':'||total_price FROM bookings WHERE id='${sourceBooking}';`)).toBe('verified:10000.00')
  expect((await client.from('bookings').select('status').in('id', ids)).data!.map(b => b.status)).toEqual(['verified', 'verified'])
  expect(localSql(`SELECT count(*) FROM task10_family_makeup_uses WHERE parent_id='${f.userId}';`)).toBe('1')
  expect(controls()).toEqual({ pricing: true, makeup: true, expiry: true, cron: true })
  await testInfo.attach('active-integration-backend', { body: Buffer.from(localSql(`SELECT jsonb_build_object('controls',(SELECT to_jsonb(a) FROM task10_policy_activation a),
    'bills',(SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM bookings b WHERE id IN (${ids.map(sqlLiteral)})),
    'uses',(SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM task10_family_makeup_uses u),'worker',(SELECT jsonb_agg(to_jsonb(w) ORDER BY started_at) FROM task10_worker_runs w));`)), contentType: 'application/json' })
})
