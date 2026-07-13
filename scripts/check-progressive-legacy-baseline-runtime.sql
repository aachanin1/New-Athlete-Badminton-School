\set ON_ERROR_STOP on

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(p_condition boolean, p_message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ASSERTION_FAILED: %', p_message;
  END IF;
END;
$$;

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'option-a-runtime-1@example.invalid', '{"full_name":"Option A Runtime One"}'),
  ('10000000-0000-0000-0000-000000000002', 'option-a-runtime-2@example.invalid', '{"full_name":"Option A Runtime Two"}'),
  ('10000000-0000-0000-0000-000000000003', 'option-a-runtime-3@example.invalid', '{"full_name":"Option A Runtime Three"}'),
  ('10000000-0000-0000-0000-000000000004', 'option-a-runtime-4@example.invalid', '{"full_name":"Option A Runtime Four"}');

INSERT INTO public.branches (id, name, slug)
VALUES ('20000000-0000-0000-0000-000000000001', 'Option A Runtime Branch', 'option-a-runtime-branch');

INSERT INTO public.course_types (id, name, max_students, duration_hours)
VALUES ('30000000-0000-0000-0000-000000000001', 'kids_group', 20, 2);

INSERT INTO public.pricing_tiers (
  id, course_type_id, min_sessions, max_sessions, price_per_session, package_price, valid_from
)
VALUES
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 4, 625, 0, '2020-01-01'),
  ('31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 5, 10, 500, 0, '2020-01-01'),
  ('31000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 11, 15, 433, 0, '2020-01-01'),
  ('31000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 16, NULL, 406, 0, '2020-01-01');

INSERT INTO public.schedule_templates (
  id, branch_id, course_type_id, day_of_week, start_time, end_time, is_active
)
SELECT
  ('32000000-0000-0000-0000-' || lpad((day_number + 1)::text, 12, '0'))::uuid,
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  day_number,
  '09:00',
  '18:00',
  true
FROM generate_series(0, 6) AS day_number;

INSERT INTO public.children (id, parent_id, full_name)
VALUES
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Runtime Child One'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Runtime Child Two');

-- Two eligible Legacy bookings contribute 2 + 2 sessions. Their 2,500 total
-- historical price is deliberately different from the Progressive result.
INSERT INTO public.bookings (
  id, user_id, learner_type, child_id, branch_id, course_type_id, month, year,
  total_sessions, total_price, status, pricing_scope_id, created_at, expires_at
)
VALUES
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'child', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 7, 2030, 2, 1250, 'verified', NULL, '2029-01-01 00:00:01+00', NULL),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'child', '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 7, 2030, 2, 1250, 'paid', NULL, '2029-01-01 00:00:02+00', NULL),
  ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'child', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 7, 2030, 99, 99000, 'cancelled', NULL, '2029-01-01 00:00:03+00', NULL),
  ('50000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'child', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 7, 2030, 99, 99000, 'pending_payment', NULL, '2029-01-01 00:00:04+00', transaction_timestamp() - interval '1 minute');

-- Raw session descendants and a wallet record must not change purchased Legacy
-- entitlement. Three raw rows still contribute only total_sessions = 2.
INSERT INTO public.booking_sessions (
  id, booking_id, date, start_time, end_time, branch_id, child_id, status
)
VALUES
  ('51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '2030-07-01', '09:00', '11:00', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'walleted'),
  ('51000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', '2030-07-08', '09:00', '11:00', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'rescheduled'),
  ('51000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', '2030-07-15', '09:00', '11:00', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'scheduled');

UPDATE public.booking_sessions
SET rescheduled_from_id = '51000000-0000-0000-0000-000000000002'
WHERE id = '51000000-0000-0000-0000-000000000003';

INSERT INTO public.lesson_wallet_credits (
  id, user_id, booking_id, original_session_id, child_id, branch_id, course_type_id,
  original_date, original_start_time, original_end_time, status, expires_at
)
VALUES (
  '52000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '2030-07-01', '09:00', '11:00', 'active', '2030-07-31 23:59:59+00'
);

DO $$
DECLARE
  v_baseline integer;
  v_fingerprint text;
BEGIN
  SELECT baseline_sessions, baseline_fingerprint
  INTO v_baseline, v_fingerprint
  FROM public.progressive_legacy_baseline_v1(
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    2030, 7
  );
  PERFORM pg_temp.assert_true(v_baseline = 4, 'Legacy baseline must be 2 + 2, not raw session rows');
  PERFORM pg_temp.assert_true(v_fingerprint ~ '^[0-9a-f]{64}$', 'Legacy fingerprint must be SHA-256 hex');
END;
$$;

DO $$
DECLARE
  v_baseline integer;
  v_fingerprint text;
  v_sessions jsonb;
  v_result jsonb;
  v_replay jsonb;
  v_booking_id uuid;
  v_scope_id uuid;
  v_before_count integer;
BEGIN
  SELECT baseline_sessions, baseline_fingerprint
  INTO v_baseline, v_fingerprint
  FROM public.progressive_legacy_baseline_v1(
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001', 2030, 7
  );

  v_sessions := jsonb_build_array(
    jsonb_build_object('date','2030-07-22','start_time','10:00','end_time','12:00','branch_id','20000000-0000-0000-0000-000000000001','child_id','40000000-0000-0000-0000-000000000001'),
    jsonb_build_object('date','2030-07-23','start_time','10:00','end_time','12:00','branch_id','20000000-0000-0000-0000-000000000001','child_id','40000000-0000-0000-0000-000000000001'),
    jsonb_build_object('date','2030-07-24','start_time','10:00','end_time','12:00','branch_id','20000000-0000-0000-0000-000000000001','child_id','40000000-0000-0000-0000-000000000002'),
    jsonb_build_object('date','2030-07-25','start_time','10:00','end_time','12:00','branch_id','20000000-0000-0000-0000-000000000001','child_id','40000000-0000-0000-0000-000000000002')
  );

  v_result := public.create_progressive_booking_v1(
    '10000000-0000-0000-0000-000000000001', 'child', NULL,
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001', v_sessions, NULL,
    '60000000-0000-0000-0000-000000000001', 0, v_baseline, v_fingerprint
  );
  v_booking_id := (v_result ->> 'bookingId')::uuid;
  v_scope_id := (v_result ->> 'scopeId')::uuid;

  PERFORM pg_temp.assert_true((v_result ->> 'totalPrice')::numeric = 2000, 'Legacy 4 + new 4 must cost 2,000');
  PERFORM pg_temp.assert_true((SELECT legacy_baseline_sessions FROM public.booking_pricing_scopes WHERE id = v_scope_id) = 4, 'scope must store Legacy baseline 4');
  PERFORM pg_temp.assert_true((SELECT cumulative_sessions_before FROM public.bookings WHERE id = v_booking_id) = 4, 'new booking must start after Legacy baseline');
  PERFORM pg_temp.assert_true((SELECT cumulative_sessions_after FROM public.bookings WHERE id = v_booking_id) = 8, 'cumulative after must be 8');
  PERFORM pg_temp.assert_true((SELECT gross_price_snapshot FROM public.bookings WHERE id = v_booking_id) = 2000, 'gross snapshot must be 2,000');
  PERFORM pg_temp.assert_true((SELECT sum(total_price) FROM public.bookings WHERE id IN ('50000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002')) = 2500, 'Legacy 2,500 must remain historical evidence');
  PERFORM pg_temp.assert_true(NOT EXISTS (SELECT 1 FROM public.payments WHERE booking_id = v_booking_id), 'create must not create payment artifacts');

  v_replay := public.create_progressive_booking_v1(
    '10000000-0000-0000-0000-000000000001', 'child', NULL,
    '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001', v_sessions, NULL,
    '60000000-0000-0000-0000-000000000001', 0, v_baseline, v_fingerprint
  );
  PERFORM pg_temp.assert_true((v_replay ->> 'idempotentReplay')::boolean, 'same mutation must replay');
  PERFORM pg_temp.assert_true((v_replay ->> 'bookingId')::uuid = v_booking_id, 'replay must return original booking');

  BEGIN
    PERFORM public.create_progressive_booking_v1(
      '10000000-0000-0000-0000-000000000001', 'child', NULL,
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001', v_sessions, NULL,
      '60000000-0000-0000-0000-000000000001', 0, v_baseline + 1, v_fingerprint
    );
    RAISE EXCEPTION 'ASSERTION_FAILED: changed baseline with reused mutation id must fail';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    PERFORM pg_temp.assert_true(SQLERRM = 'PROGRESSIVE_IDEMPOTENCY_CONFLICT', 'changed replay must be idempotency conflict');
  END;

  SELECT count(*) INTO v_before_count FROM public.bookings WHERE pricing_scope_id = v_scope_id;
  BEGIN
    PERFORM public.create_progressive_booking_v1(
      '10000000-0000-0000-0000-000000000001', 'child', NULL,
      '20000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001', v_sessions, NULL,
      '60000000-0000-0000-0000-000000000002', 0, v_baseline, v_fingerprint
    );
    RAISE EXCEPTION 'ASSERTION_FAILED: stale scope revision must fail';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    PERFORM pg_temp.assert_true(SQLERRM = 'PROGRESSIVE_SCOPE_REVISION_CONFLICT', 'stale preview must report revision conflict');
  END;
  PERFORM pg_temp.assert_true((SELECT count(*) FROM public.bookings WHERE pricing_scope_id = v_scope_id) = v_before_count, 'stale failure must not partially write');
END;
$$;

-- The harness intentionally uses one transaction for cleanup, so now() is stable.
-- Give the first RPC booking an earlier timestamp to model separate real requests.
UPDATE public.bookings
SET created_at = transaction_timestamp() - interval '1 minute'
WHERE client_request_id = '60000000-0000-0000-0000-000000000001';

INSERT INTO public.coupons (
  id, code, discount_type, discount_value, min_purchase, max_uses,
  valid_from, valid_to, created_by, is_active
)
VALUES (
  '70000000-0000-0000-0000-000000000001', 'OPTIONA100', 'fixed', 100, 0, 10,
  '2020-01-01', '2035-12-31', '10000000-0000-0000-0000-000000000001', true
);

DO $$
DECLARE
  v_baseline integer;
  v_fingerprint text;
  v_sessions jsonb;
  v_updated_sessions jsonb;
  v_result jsonb;
  v_booking_id uuid;
  v_first_booking_id uuid;
  v_scope_id uuid;
BEGIN
  SELECT baseline_sessions, baseline_fingerprint INTO v_baseline, v_fingerprint
  FROM public.progressive_legacy_baseline_v1('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',2030,7);

  v_sessions := jsonb_build_array(
    jsonb_build_object('date','2030-07-26','start_time','12:00','end_time','14:00','branch_id','20000000-0000-0000-0000-000000000001','child_id','40000000-0000-0000-0000-000000000001'),
    jsonb_build_object('date','2030-07-27','start_time','12:00','end_time','14:00','branch_id','20000000-0000-0000-0000-000000000001','child_id','40000000-0000-0000-0000-000000000001'),
    jsonb_build_object('date','2030-07-28','start_time','12:00','end_time','14:00','branch_id','20000000-0000-0000-0000-000000000001','child_id','40000000-0000-0000-0000-000000000002'),
    jsonb_build_object('date','2030-07-29','start_time','12:00','end_time','14:00','branch_id','20000000-0000-0000-0000-000000000001','child_id','40000000-0000-0000-0000-000000000002')
  );

  v_result := public.create_progressive_booking_v1(
    '10000000-0000-0000-0000-000000000001','child',NULL,
    '20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',
    v_sessions,'70000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000003',1,v_baseline,v_fingerprint
  );
  v_booking_id := (v_result ->> 'bookingId')::uuid;
  v_scope_id := (v_result ->> 'scopeId')::uuid;
  SELECT id INTO v_first_booking_id FROM public.bookings WHERE pricing_scope_id=v_scope_id AND id<>v_booking_id;

  PERFORM pg_temp.assert_true((SELECT gross_price_snapshot FROM public.bookings WHERE id=v_booking_id)=1732, 'Legacy 4 + prior Progressive 4 + new 4 gross must be 1,732');
  PERFORM pg_temp.assert_true((SELECT total_price FROM public.bookings WHERE id=v_booking_id)=1632, 'fixed coupon must apply after 1,732 gross');
  PERFORM pg_temp.assert_true((SELECT coupon_discount_snapshot FROM public.bookings WHERE id=v_booking_id)=100, 'coupon discount snapshot must be 100');

  v_updated_sessions := v_sessions || jsonb_build_array(
    jsonb_build_object('date','2030-07-30','start_time','12:00','end_time','14:00','branch_id','20000000-0000-0000-0000-000000000001','child_id','40000000-0000-0000-0000-000000000001')
  );
  v_result := public.update_progressive_pending_booking_v1(
    '10000000-0000-0000-0000-000000000001',v_booking_id,
    '20000000-0000-0000-0000-000000000001',v_updated_sessions,
    '60000000-0000-0000-0000-000000000004',2
  );
  PERFORM pg_temp.assert_true((SELECT cumulative_sessions_before FROM public.bookings WHERE id=v_booking_id)=8, 'edit must retain Legacy + previous Progressive baseline');
  PERFORM pg_temp.assert_true((SELECT gross_price_snapshot FROM public.bookings WHERE id=v_booking_id)=2165, 'edited 5 sessions at cumulative 13 must gross 2,165');
  PERFORM pg_temp.assert_true((SELECT total_price FROM public.bookings WHERE id=v_booking_id)=2065, 'coupon must recalculate after edited gross');

  v_result := public.cancel_progressive_pending_booking_v1(
    '10000000-0000-0000-0000-000000000001',v_booking_id,
    '60000000-0000-0000-0000-000000000005',3
  );
  PERFORM pg_temp.assert_true((SELECT status::text FROM public.bookings WHERE id=v_booking_id)='cancelled', 'cancel must cancel only target Progressive booking');
  PERFORM pg_temp.assert_true((SELECT gross_price_snapshot FROM public.bookings WHERE id=v_first_booking_id)=2000, 'remaining Progressive booking must still price from Legacy baseline');
  PERFORM pg_temp.assert_true((SELECT status FROM public.progressive_coupon_reservations WHERE booking_id=v_booking_id)='released', 'cancel must release coupon reservation');

  UPDATE public.bookings SET status='cancelled' WHERE id='50000000-0000-0000-0000-000000000001';
  BEGIN
    PERFORM public.create_progressive_booking_v1(
      '10000000-0000-0000-0000-000000000001','child',NULL,
      '20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',
      v_sessions,NULL,'60000000-0000-0000-0000-000000000006',4,v_baseline,v_fingerprint
    );
    RAISE EXCEPTION 'ASSERTION_FAILED: changed Legacy set must fail closed';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    PERFORM pg_temp.assert_true(SQLERRM='PROGRESSIVE_LEGACY_BASELINE_DRIFT','changed Legacy set must report baseline drift');
  END;
  PERFORM pg_temp.assert_true(NOT EXISTS (SELECT 1 FROM public.bookings WHERE client_request_id='60000000-0000-0000-0000-000000000006'), 'drift failure must not partially write');

  BEGIN
    UPDATE public.booking_pricing_scopes SET legacy_baseline_sessions=5 WHERE id=v_scope_id;
    RAISE EXCEPTION 'ASSERTION_FAILED: stored baseline must be immutable';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    PERFORM pg_temp.assert_true(SQLERRM='PROGRESSIVE_LEGACY_BASELINE_DRIFT','immutable trigger must report baseline drift');
  END;
END;
$$;

-- A pre-compat scope can initialize lazily only when the authoritative Legacy set is empty.
INSERT INTO public.booking_pricing_scopes (
  id,user_id,course_type_id,lesson_year,lesson_month,currency,revision
)
VALUES
  ('80000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001',2030,7,'THB',1),
  ('80000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000001',2030,7,'THB',1);

INSERT INTO public.bookings (
  id,user_id,learner_type,branch_id,course_type_id,month,year,total_sessions,total_price,status,pricing_scope_id
)
VALUES (
  '81000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','self',
  '20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',7,2030,1,999,'verified',NULL
);

DO $$
DECLARE
  v_scope uuid;
  v_revision bigint;
BEGIN
  SELECT scope_id,new_revision INTO v_scope,v_revision
  FROM public.progressive_acquire_scope_v1(
    '10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001',2030,7,1
  );
  PERFORM pg_temp.assert_true(v_scope='80000000-0000-0000-0000-000000000001' AND v_revision=2,'empty pre-compat scope must initialize and advance');
  PERFORM pg_temp.assert_true((SELECT legacy_baseline_sessions FROM public.booking_pricing_scopes WHERE id=v_scope)=0,'empty pre-compat scope baseline must be zero');

  BEGIN
    PERFORM public.progressive_acquire_scope_v1(
      '10000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000001',2030,7,1
    );
    RAISE EXCEPTION 'ASSERTION_FAILED: pre-compat scope with Legacy rows must fail';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    PERFORM pg_temp.assert_true(SQLERRM='PROGRESSIVE_LEGACY_BASELINE_DRIFT','unsafe pre-compat scope must report drift');
  END;
END;
$$;

-- Progressive-only first entry starts from an authoritative zero baseline.
DO $$
DECLARE
  v_baseline integer;
  v_fingerprint text;
  v_result jsonb;
  v_batch_result jsonb;
  v_batch_id uuid;
  v_booking_id uuid;
  v_scope_id uuid;
  v_sessions jsonb;
BEGIN
  SELECT baseline_sessions,baseline_fingerprint INTO v_baseline,v_fingerprint
  FROM public.progressive_legacy_baseline_v1('10000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000001',2030,7);
  v_sessions := jsonb_build_array(
    jsonb_build_object('date','2030-07-02','start_time','14:00','end_time','16:00','branch_id','20000000-0000-0000-0000-000000000001'),
    jsonb_build_object('date','2030-07-03','start_time','14:00','end_time','16:00','branch_id','20000000-0000-0000-0000-000000000001'),
    jsonb_build_object('date','2030-07-04','start_time','14:00','end_time','16:00','branch_id','20000000-0000-0000-0000-000000000001'),
    jsonb_build_object('date','2030-07-05','start_time','14:00','end_time','16:00','branch_id','20000000-0000-0000-0000-000000000001')
  );
  v_result := public.create_progressive_booking_v1(
    '10000000-0000-0000-0000-000000000004','self',NULL,
    '20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',
    v_sessions,NULL,'60000000-0000-0000-0000-000000000010',0,v_baseline,v_fingerprint
  );
  v_booking_id := (v_result->>'bookingId')::uuid;
  v_scope_id := (v_result->>'scopeId')::uuid;
  PERFORM pg_temp.assert_true(v_baseline=0,'Progressive-only baseline must be zero');
  PERFORM pg_temp.assert_true((v_result->>'totalPrice')::numeric=2500,'no prior booking + new 4 must cost 2,500');

  v_batch_result := public.prepare_progressive_payment_batch_v1(
    '10000000-0000-0000-0000-000000000004',v_scope_id,ARRAY[v_booking_id],1,2500,
    '60000000-0000-0000-0000-000000000011'
  );
  v_batch_id := (v_batch_result->>'batchId')::uuid;
  PERFORM pg_temp.assert_true((v_batch_result->>'status')='prepared','stored Progressive booking must remain payment-preparable');
  PERFORM pg_temp.assert_true((SELECT locked_by_payment_batch_id FROM public.booking_pricing_scopes WHERE id=v_scope_id)=v_batch_id,'prepare must lock the exact scope');

  v_batch_result := public.cancel_progressive_prepared_batch_v1(
    v_batch_id,'10000000-0000-0000-0000-000000000004','runtime_entry_off_drain'
  );
  PERFORM pg_temp.assert_true((v_batch_result->>'status')='cancelled','prepared drain batch must cancel normally');
  PERFORM pg_temp.assert_true((SELECT locked_by_payment_batch_id IS NULL AND locked_at IS NULL FROM public.booking_pricing_scopes WHERE id=v_scope_id),'cancelled drain batch must unlock scope');
  PERFORM pg_temp.assert_true((SELECT status::text='pending_payment' AND total_price=2500 FROM public.bookings WHERE id=v_booking_id),'drain cancellation must preserve pending booking and price');
END;
$$;

SELECT pg_temp.assert_true(
  (public.progressive_pricing_writes_capability_v1() ->> 'version')::integer = 2,
  'capability version must be 2'
);

ROLLBACK;

SELECT 'PASS: progressive Legacy baseline runtime fixtures rolled back cleanly' AS result;
