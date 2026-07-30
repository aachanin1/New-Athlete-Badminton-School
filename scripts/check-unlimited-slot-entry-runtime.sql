\set ON_ERROR_STOP on

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(p_condition boolean, p_message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ASSERTION_FAILED: %', p_message;
  END IF;
END;
$$;

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  ('91000000-0000-0000-0000-000000000001', 'unlimited-occupancy@example.invalid', '{"full_name":"Occupancy Fixture"}'),
  ('91000000-0000-0000-0000-000000000002', 'unlimited-new@example.invalid', '{"full_name":"New Learner"}'),
  ('91000000-0000-0000-0000-000000000003', 'unlimited-new-20@example.invalid', '{"full_name":"Learner Twenty One"}'),
  ('91000000-0000-0000-0000-000000000004', 'unlimited-cancelled@example.invalid', '{"full_name":"Cancelled Target"}'),
  ('91000000-0000-0000-0000-000000000005', 'multibranch-progressive@example.invalid', '{"full_name":"Multi Branch Parent"}');

INSERT INTO public.branches (id, name, slug)
VALUES
  ('92000000-0000-0000-0000-000000000001', 'Unlimited Runtime Branch', 'unlimited-runtime'),
  ('92000000-0000-0000-0000-000000000002', 'Multi Branch Runtime Branch', 'multibranch-runtime');

INSERT INTO public.course_types (id, name, max_students, duration_hours)
VALUES ('93000000-0000-0000-0000-000000000001', 'kids_group', 6, 2);

INSERT INTO public.pricing_tiers (id, course_type_id, min_sessions, max_sessions, price_per_session, package_price, valid_from)
VALUES
  ('93100000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', 1, 1, 700, 700, '2020-01-01'),
  ('93100000-0000-0000-0000-000000000002', '93000000-0000-0000-0000-000000000001', 2, 6, 625, 2500, '2020-01-01'),
  ('93100000-0000-0000-0000-000000000003', '93000000-0000-0000-0000-000000000001', 7, NULL, 500, 4000, '2020-01-01');

INSERT INTO public.schedule_templates (id, branch_id, course_type_id, day_of_week, start_time, end_time, is_active)
SELECT
  ('93200000-0000-0000-0000-' || lpad((day_number + 1)::text, 12, '0'))::uuid,
  '92000000-0000-0000-0000-000000000001',
  '93000000-0000-0000-0000-000000000001',
  day_number, '09:00', '18:00', true
FROM generate_series(0, 6) AS day_number;

INSERT INTO public.schedule_templates (id, branch_id, course_type_id, day_of_week, start_time, end_time, is_active)
SELECT
  ('93300000-0000-0000-0000-' || lpad((day_number + 1)::text, 12, '0'))::uuid,
  '92000000-0000-0000-0000-000000000002',
  '93000000-0000-0000-0000-000000000001',
  day_number, '09:00', '18:00', true
FROM generate_series(0, 6) AS day_number;

INSERT INTO public.schedule_templates (
  id, branch_id, course_type_id, day_of_week, start_time, end_time, is_active
)
VALUES (
  '93300000-0000-0000-0000-000000000099',
  '92000000-0000-0000-0000-000000000002',
  '93000000-0000-0000-0000-000000000001',
  extract(dow FROM date '2030-08-01')::integer,
  '14:00', '16:00', false
);

INSERT INTO public.schedule_slots (
  id, template_id, branch_id, course_type_id, date, start_time, end_time,
  max_students, current_students, status
)
VALUES
  ('94000000-0000-0000-0000-000000000001', '93200000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', '2030-07-01', '10:00', '12:00', 6, 6, 'full'),
  ('94000000-0000-0000-0000-000000000002', '93200000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', '2030-07-08', '10:00', '12:00', 6, 20, 'full'),
  ('94000000-0000-0000-0000-000000000003', '93200000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', '2030-07-15', '10:00', '12:00', 6, 0, 'cancelled');

INSERT INTO public.schedule_slots (
  id, template_id, branch_id, course_type_id, date, start_time, end_time,
  max_students, current_students, status
)
SELECT
  (
    CASE WHEN branch_number = 1 THEN '94100000-0000-0000-0000-' ELSE '94200000-0000-0000-0000-' END
      || lpad((day_offset + 1)::text, 12, '0')
  )::uuid,
  (
    CASE WHEN branch_number = 1 THEN '93200000-0000-0000-0000-' ELSE '93300000-0000-0000-0000-' END
      || lpad((extract(dow FROM date '2030-08-01' + day_offset)::integer + 1)::text, 12, '0')
  )::uuid,
  (
    CASE WHEN branch_number = 1
      THEN '92000000-0000-0000-0000-000000000001'
      ELSE '92000000-0000-0000-0000-000000000002'
    END
  )::uuid,
  '93000000-0000-0000-0000-000000000001',
  date '2030-08-01' + day_offset,
  '14:00', '16:00', 6, 0, 'open'
FROM generate_series(0, 8) AS day_offset
CROSS JOIN generate_series(1, 2) AS branch_number;

INSERT INTO public.children (id, parent_id, full_name, nickname, date_of_birth)
VALUES
  ('91500000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000005', 'Multi Branch Child', 'Multi', '2016-01-01'),
  ('91500000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001', 'Other Parent Child', 'Other', '2016-01-02');

INSERT INTO public.bookings (
  id, user_id, learner_type, branch_id, course_type_id, month, year,
  total_sessions, total_price, status
)
VALUES
  ('95000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'self', '92000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', 7, 2030, 26, 0, 'verified');

INSERT INTO public.booking_sessions (
  booking_id, schedule_slot_id, date, start_time, end_time, branch_id, status
)
SELECT '95000000-0000-0000-0000-000000000001'::uuid, '94000000-0000-0000-0000-000000000001'::uuid, '2030-07-01'::date, '10:00'::time, '12:00'::time, '92000000-0000-0000-0000-000000000001'::uuid, 'scheduled'::public.session_status
FROM generate_series(1, 6)
UNION ALL
SELECT '95000000-0000-0000-0000-000000000001'::uuid, '94000000-0000-0000-0000-000000000002'::uuid, '2030-07-08'::date, '10:00'::time, '12:00'::time, '92000000-0000-0000-0000-000000000001'::uuid, 'scheduled'::public.session_status
FROM generate_series(1, 20);

DO $$
DECLARE
  v_baseline integer;
  v_fingerprint text;
  v_sessions jsonb;
  v_edit_sessions jsonb;
  v_result jsonb;
  v_replay jsonb;
  v_booking_id uuid;
BEGIN
  SELECT baseline_sessions, baseline_fingerprint
  INTO v_baseline, v_fingerprint
  FROM public.progressive_legacy_baseline_v1(
    '91000000-0000-0000-0000-000000000005',
    '93000000-0000-0000-0000-000000000001',
    2030,
    8
  );

  SELECT jsonb_agg(jsonb_build_object(
    'date', to_char(date '2030-08-01' + day_offset, 'YYYY-MM-DD'),
    'start_time', '14:00',
    'end_time', '16:00',
    'branch_id', CASE WHEN day_offset % 2 = 0
      THEN '92000000-0000-0000-0000-000000000001'
      ELSE '92000000-0000-0000-0000-000000000002'
    END,
    'child_id', '91500000-0000-0000-0000-000000000001',
    'schedule_template_id', (
      CASE WHEN day_offset % 2 = 0
        THEN '93200000-0000-0000-0000-'
        ELSE '93300000-0000-0000-0000-'
      END
      || lpad((extract(dow FROM date '2030-08-01' + day_offset)::integer + 1)::text, 12, '0')
    )
  ) ORDER BY day_offset)
  INTO v_sessions
  FROM generate_series(0, 8) AS day_offset;

  v_result := public.create_progressive_booking_v1(
    '91000000-0000-0000-0000-000000000005',
    'child',
    '91500000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000001',
    v_sessions,
    NULL,
    '96000000-0000-0000-0000-000000000101',
    0,
    v_baseline,
    v_fingerprint
  );
  v_booking_id := (v_result ->> 'bookingId')::uuid;

  PERFORM pg_temp.assert_true(v_booking_id IS NOT NULL, 'multi-branch create must return a booking');
  PERFORM pg_temp.assert_true((v_result ->> 'totalPrice')::numeric = 4500, '9-session baseline-0 create must cost 4,500');
  PERFORM pg_temp.assert_true(
    (SELECT branch_id FROM public.bookings WHERE id = v_booking_id)
      = '92000000-0000-0000-0000-000000000001',
    'booking primary branch must remain the submitted booking branch'
  );
  PERFORM pg_temp.assert_true(
    (SELECT count(*) FROM public.booking_sessions WHERE booking_id = v_booking_id) = 9,
    'multi-branch create must persist all nine sessions'
  );
  PERFORM pg_temp.assert_true(
    (SELECT count(DISTINCT branch_id) FROM public.booking_sessions WHERE booking_id = v_booking_id) = 2,
    'multi-branch create must persist both session branches'
  );
  PERFORM pg_temp.assert_true(
    NOT EXISTS (
      SELECT 1
      FROM public.booking_sessions session
      LEFT JOIN public.schedule_slots slot ON slot.id = session.schedule_slot_id
      LEFT JOIN public.schedule_templates template ON template.id = slot.template_id
      WHERE session.booking_id = v_booking_id
        AND (
          slot.id IS NULL
          OR slot.branch_id IS DISTINCT FROM session.branch_id
          OR slot.course_type_id IS DISTINCT FROM '93000000-0000-0000-0000-000000000001'
          OR slot.date IS DISTINCT FROM session.date
          OR slot.start_time IS DISTINCT FROM session.start_time
          OR slot.end_time IS DISTINCT FROM session.end_time
          OR template.id IS NULL
          OR template.branch_id IS DISTINCT FROM session.branch_id
          OR template.is_active IS DISTINCT FROM true
        )
    ),
    'multi-branch create must retain canonical slot/template linkage per session'
  );

  v_replay := public.create_progressive_booking_v1(
    '91000000-0000-0000-0000-000000000005',
    'child',
    '91500000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000001',
    v_sessions,
    NULL,
    '96000000-0000-0000-0000-000000000101',
    0,
    v_baseline,
    v_fingerprint
  );
  PERFORM pg_temp.assert_true((v_replay ->> 'idempotentReplay')::boolean, 'multi-branch create replay must be idempotent');
  PERFORM pg_temp.assert_true(
    (SELECT count(*) FROM public.bookings WHERE user_id = '91000000-0000-0000-0000-000000000005') = 1,
    'multi-branch create replay must not duplicate the booking'
  );

  SELECT jsonb_agg(jsonb_build_object(
    'date', to_char(date '2030-08-01' + day_offset, 'YYYY-MM-DD'),
    'start_time', '14:00',
    'end_time', '16:00',
    'branch_id', CASE WHEN day_offset % 2 = 0
      THEN '92000000-0000-0000-0000-000000000002'
      ELSE '92000000-0000-0000-0000-000000000001'
    END,
    'child_id', '91500000-0000-0000-0000-000000000001',
    'schedule_template_id', (
      CASE WHEN day_offset % 2 = 0
        THEN '93300000-0000-0000-0000-'
        ELSE '93200000-0000-0000-0000-'
      END
      || lpad((extract(dow FROM date '2030-08-01' + day_offset)::integer + 1)::text, 12, '0')
    )
  ) ORDER BY day_offset)
  INTO v_edit_sessions
  FROM generate_series(0, 8) AS day_offset;

  v_result := public.update_progressive_pending_booking_v1(
    '91000000-0000-0000-0000-000000000005',
    v_booking_id,
    '92000000-0000-0000-0000-000000000001',
    v_edit_sessions,
    '96000000-0000-0000-0000-000000000102',
    1
  );
  PERFORM pg_temp.assert_true((v_result ->> 'bookingId')::uuid = v_booking_id, 'multi-branch pending edit must preserve booking id');
  PERFORM pg_temp.assert_true((v_result ->> 'totalPrice')::numeric = 4500, '9-session pending edit must stay at 4,500');
  PERFORM pg_temp.assert_true((v_result ->> 'scopeRevision')::integer = 2, 'multi-branch pending edit must advance scope revision once');
  PERFORM pg_temp.assert_true(
    (SELECT count(DISTINCT branch_id) FROM public.booking_sessions WHERE booking_id = v_booking_id) = 2,
    'multi-branch pending edit must retain both session branches'
  );
  PERFORM pg_temp.assert_true(
    NOT EXISTS (
      SELECT 1
      FROM public.booking_sessions session
      LEFT JOIN public.schedule_slots slot ON slot.id = session.schedule_slot_id
      LEFT JOIN public.schedule_templates template ON template.id = slot.template_id
      WHERE session.booking_id = v_booking_id
        AND (
          slot.id IS NULL
          OR slot.branch_id IS DISTINCT FROM session.branch_id
          OR slot.date IS DISTINCT FROM session.date
          OR slot.start_time IS DISTINCT FROM session.start_time
          OR slot.end_time IS DISTINCT FROM session.end_time
          OR template.id IS NULL
          OR template.branch_id IS DISTINCT FROM session.branch_id
          OR template.is_active IS DISTINCT FROM true
        )
    ),
    'multi-branch pending edit must retain canonical slot/template linkage per session'
  );

  v_replay := public.update_progressive_pending_booking_v1(
    '91000000-0000-0000-0000-000000000005',
    v_booking_id,
    '92000000-0000-0000-0000-000000000001',
    v_edit_sessions,
    '96000000-0000-0000-0000-000000000102',
    1
  );
  PERFORM pg_temp.assert_true((v_replay ->> 'idempotentReplay')::boolean, 'multi-branch edit replay must be idempotent');
  PERFORM pg_temp.assert_true(
    (SELECT count(*) FROM public.booking_sessions WHERE booking_id = v_booking_id) = 9,
    'multi-branch edit replay must not duplicate sessions'
  );
END;
$$;

DO $$
DECLARE
  v_baseline integer;
  v_fingerprint text;
  v_result jsonb;
  v_booking_id uuid;
  v_user2_booking_id uuid;
  v_sessions jsonb;
  v_before_count integer;
  v_failure_artifacts_before jsonb;
  v_failure_artifacts_after jsonb;
BEGIN
  SELECT baseline_sessions, baseline_fingerprint INTO v_baseline, v_fingerprint
  FROM public.progressive_legacy_baseline_v1(
    '91000000-0000-0000-0000-000000000002', '93000000-0000-0000-0000-000000000001', 2030, 7
  );

  v_sessions := jsonb_build_array(jsonb_build_object(
    'date','2030-07-01','start_time','10:00','end_time','12:00',
    'branch_id','92000000-0000-0000-0000-000000000001'
  ));
  v_result := public.create_progressive_booking_v1(
    '91000000-0000-0000-0000-000000000002','self',NULL,
    '92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001',
    v_sessions,NULL,'96000000-0000-0000-0000-000000000001',0,v_baseline,v_fingerprint
  );
  v_booking_id := (v_result->>'bookingId')::uuid;
  v_user2_booking_id := v_booking_id;
  PERFORM pg_temp.assert_true(v_booking_id IS NOT NULL, '6 existing + learner 7 must succeed');
  PERFORM pg_temp.assert_true((SELECT current_students FROM public.schedule_slots WHERE id='94000000-0000-0000-0000-000000000001')=7, 'occupancy 7 must remain informational');
  PERFORM pg_temp.assert_true((SELECT status::text FROM public.schedule_slots WHERE id='94000000-0000-0000-0000-000000000001')='open', 'historical full must normalize to open');

  v_sessions := jsonb_build_array(jsonb_build_object(
    'date','2030-07-08','start_time','10:00','end_time','12:00',
    'branch_id','92000000-0000-0000-0000-000000000001'
  ));
  SELECT baseline_sessions, baseline_fingerprint INTO v_baseline, v_fingerprint
  FROM public.progressive_legacy_baseline_v1(
    '91000000-0000-0000-0000-000000000003', '93000000-0000-0000-0000-000000000001', 2030, 7
  );
  v_result := public.create_progressive_booking_v1(
    '91000000-0000-0000-0000-000000000003','self',NULL,
    '92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001',
    v_sessions,NULL,'96000000-0000-0000-0000-000000000005',0,v_baseline,v_fingerprint
  );
  PERFORM pg_temp.assert_true((v_result->>'bookingId')::uuid IS NOT NULL, '20 existing + learner 21 new booking must succeed');
  PERFORM pg_temp.assert_true((SELECT current_students FROM public.schedule_slots WHERE id='94000000-0000-0000-0000-000000000002')=21, 'new booking must raise informational occupancy to 21');

  v_result := public.update_progressive_pending_booking_v1(
    '91000000-0000-0000-0000-000000000002',v_user2_booking_id,
    '92000000-0000-0000-0000-000000000001',v_sessions,
    '96000000-0000-0000-0000-000000000002',1
  );
  PERFORM pg_temp.assert_true((v_result->>'bookingId')::uuid=v_user2_booking_id, 'pending edit above old capacity must succeed');
  PERFORM pg_temp.assert_true((SELECT current_students FROM public.schedule_slots WHERE id='94000000-0000-0000-0000-000000000002')=22, 'pending edit must remain valid above 21 learners');

  SELECT jsonb_build_object(
    'bookings', (SELECT count(*) FROM public.bookings),
    'bookingSessions', (SELECT count(*) FROM public.booking_sessions),
    'scheduleSlots', (SELECT count(*) FROM public.schedule_slots),
    'pricingScopes', (SELECT count(*) FROM public.booking_pricing_scopes),
    'mutationReceipts', (SELECT count(*) FROM public.progressive_booking_mutation_receipts),
    'couponReservations', (SELECT count(*) FROM public.progressive_coupon_reservations),
    'couponUsages', (SELECT count(*) FROM public.coupon_usages),
    'paymentBatches', (SELECT count(*) FROM public.progressive_payment_batches),
    'paymentBatchMembers', (SELECT count(*) FROM public.progressive_payment_batch_bookings),
    'verificationAttempts', (SELECT count(*) FROM public.progressive_payment_verification_attempts),
    'paymentAllocations', (SELECT count(*) FROM public.progressive_payment_allocations),
    'payments', (SELECT count(*) FROM public.payments),
    'ledger', (SELECT count(*) FROM public.payment_ledger_allocations_v1),
    'finance', (SELECT count(*) FROM public.finance_expenses),
    'activityLogs', (SELECT count(*) FROM public.activity_logs)
  ) INTO v_failure_artifacts_before;

  SELECT count(*) INTO v_before_count FROM public.bookings WHERE user_id='91000000-0000-0000-0000-000000000002';
  BEGIN
    PERFORM public.create_progressive_booking_v1(
      '91000000-0000-0000-0000-000000000002','self',NULL,
      '92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001',
      jsonb_build_array(jsonb_build_object('date','2030-07-08','start_time','11:00','end_time','13:00','branch_id','92000000-0000-0000-0000-000000000001')),
      NULL,'96000000-0000-0000-0000-000000000003',2,v_baseline,v_fingerprint
    );
    RAISE EXCEPTION 'ASSERTION_FAILED: overlapping learner time must fail';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    PERFORM pg_temp.assert_true(SQLERRM='PROGRESSIVE_DUPLICATE_SESSION','overlap must use typed duplicate conflict');
  END;
  PERFORM pg_temp.assert_true((SELECT count(*) FROM public.bookings WHERE user_id='91000000-0000-0000-0000-000000000002')=v_before_count, 'overlap failure must leave no partial booking');

  BEGIN
    PERFORM public.create_progressive_booking_v1(
      '91000000-0000-0000-0000-000000000004','self',NULL,
      '92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001',
      jsonb_build_array(jsonb_build_object('date','2030-07-15','start_time','10:00','end_time','12:00','branch_id','92000000-0000-0000-0000-000000000001')),
      NULL,'96000000-0000-0000-0000-000000000004',0,0,
      (SELECT baseline_fingerprint FROM public.progressive_legacy_baseline_v1('91000000-0000-0000-0000-000000000004','93000000-0000-0000-0000-000000000001',2030,7))
    );
    RAISE EXCEPTION 'ASSERTION_FAILED: cancelled slot must fail';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    PERFORM pg_temp.assert_true(SQLERRM='PROGRESSIVE_BOOKING_CONFLICT','cancelled slot must remain blocked');
  END;

  SELECT baseline_sessions, baseline_fingerprint INTO v_baseline, v_fingerprint
  FROM public.progressive_legacy_baseline_v1(
    '91000000-0000-0000-0000-000000000004', '93000000-0000-0000-0000-000000000001', 2030, 7
  );

  BEGIN
    PERFORM public.create_progressive_booking_v1(
      '91000000-0000-0000-0000-000000000004','self',NULL,
      '92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001',
      jsonb_build_array(
        jsonb_build_object('date','2030-07-22','start_time','10:00','end_time','12:00','branch_id','92000000-0000-0000-0000-000000000001'),
        jsonb_build_object('date','2030-07-22','start_time','11:00','end_time','13:00','branch_id','92000000-0000-0000-0000-000000000001')
      ),
      NULL,'96000000-0000-0000-0000-000000000006',0,v_baseline,v_fingerprint
    );
    RAISE EXCEPTION 'ASSERTION_FAILED: overlapping sessions within one request must fail';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    PERFORM pg_temp.assert_true(SQLERRM='PROGRESSIVE_DUPLICATE_SESSION','request-internal overlap must use typed duplicate conflict');
  END;

  BEGIN
    PERFORM public.create_progressive_booking_v1(
      '91000000-0000-0000-0000-000000000004','self',NULL,
      '92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001',
      jsonb_build_array(jsonb_build_object(
        'date','2030-07-29','start_time','10:00','end_time','12:00',
        'branch_id','92000000-0000-0000-0000-000000000001',
        'schedule_template_id','ffffffff-ffff-4fff-8fff-ffffffffffff'
      )),
      NULL,'96000000-0000-0000-0000-000000000007',0,v_baseline,v_fingerprint
    );
    RAISE EXCEPTION 'ASSERTION_FAILED: invalid schedule template must fail';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    PERFORM pg_temp.assert_true(SQLERRM='PROGRESSIVE_INVALID_REQUEST','invalid schedule template must remain blocked');
  END;

  SELECT baseline_sessions, baseline_fingerprint INTO v_baseline, v_fingerprint
  FROM public.progressive_legacy_baseline_v1(
    '91000000-0000-0000-0000-000000000004', '93000000-0000-0000-0000-000000000001',
    extract(year FROM current_date - 1)::integer, extract(month FROM current_date - 1)::integer
  );
  BEGIN
    PERFORM public.create_progressive_booking_v1(
      '91000000-0000-0000-0000-000000000004','self',NULL,
      '92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001',
      jsonb_build_array(jsonb_build_object(
        'date',to_char(current_date - 1,'YYYY-MM-DD'),'start_time','10:00','end_time','12:00',
        'branch_id','92000000-0000-0000-0000-000000000001'
      )),
      NULL,'96000000-0000-0000-0000-000000000008',0,v_baseline,v_fingerprint
    );
    RAISE EXCEPTION 'ASSERTION_FAILED: past or started target must fail';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    PERFORM pg_temp.assert_true(SQLERRM='PROGRESSIVE_INVALID_REQUEST','past or started target must remain blocked');
  END;

  SELECT baseline_sessions, baseline_fingerprint INTO v_baseline, v_fingerprint
  FROM public.progressive_legacy_baseline_v1(
    '91000000-0000-0000-0000-000000000004',
    '93000000-0000-0000-0000-000000000001',
    2030,
    8
  );

  BEGIN
    PERFORM public.create_progressive_booking_v1(
      '91000000-0000-0000-0000-000000000004','self',NULL,
      '92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001',
      jsonb_build_array(jsonb_build_object(
        'date','2030-08-01','start_time','14:00','end_time','16:00',
        'branch_id','92000000-0000-0000-0000-000000000002',
        'schedule_template_id',(
          '93200000-0000-0000-0000-'
          || lpad((extract(dow FROM date '2030-08-01')::integer + 1)::text, 12, '0')
        )
      )),
      NULL,'96000000-0000-0000-0000-000000000109',0,v_baseline,v_fingerprint
    );
    RAISE EXCEPTION 'ASSERTION_FAILED: cross-branch schedule template hint must fail';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    PERFORM pg_temp.assert_true(SQLERRM='PROGRESSIVE_INVALID_REQUEST','cross-branch schedule template hint must remain blocked');
  END;

  BEGIN
    PERFORM public.create_progressive_booking_v1(
      '91000000-0000-0000-0000-000000000004','self',NULL,
      '92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001',
      jsonb_build_array(jsonb_build_object(
        'date','2030-08-01','start_time','14:00','end_time','16:00',
        'branch_id','92000000-0000-0000-0000-000000000002',
        'schedule_template_id','93300000-0000-0000-0000-000000000099'
      )),
      NULL,'96000000-0000-0000-0000-000000000110',0,v_baseline,v_fingerprint
    );
    RAISE EXCEPTION 'ASSERTION_FAILED: inactive schedule template hint must fail';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    PERFORM pg_temp.assert_true(SQLERRM='PROGRESSIVE_INVALID_REQUEST','inactive schedule template hint must remain blocked');
  END;

  BEGIN
    PERFORM public.create_progressive_booking_v1(
      '91000000-0000-0000-0000-000000000004','self',NULL,
      '92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001',
      jsonb_build_array(
        jsonb_build_object(
          'date','2030-08-31','start_time','14:00','end_time','16:00',
          'branch_id','92000000-0000-0000-0000-000000000001'
        ),
        jsonb_build_object(
          'date','2030-09-01','start_time','14:00','end_time','16:00',
          'branch_id','92000000-0000-0000-0000-000000000002'
        )
      ),
      NULL,'96000000-0000-0000-0000-000000000111',0,v_baseline,v_fingerprint
    );
    RAISE EXCEPTION 'ASSERTION_FAILED: multi-month multi-branch request must fail';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    PERFORM pg_temp.assert_true(SQLERRM='PROGRESSIVE_MULTI_MONTH_BOOKING','multi-month request must retain typed rejection');
  END;

  BEGIN
    PERFORM public.create_progressive_booking_v1(
      '91000000-0000-0000-0000-000000000004','child',
      '91500000-0000-0000-0000-000000000002',
      '92000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001',
      jsonb_build_array(jsonb_build_object(
        'date','2030-08-10','start_time','14:00','end_time','16:00',
        'branch_id','92000000-0000-0000-0000-000000000001',
        'child_id','91500000-0000-0000-0000-000000000002'
      )),
      NULL,'96000000-0000-0000-0000-000000000112',0,v_baseline,v_fingerprint
    );
    RAISE EXCEPTION 'ASSERTION_FAILED: unauthorized child must fail';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    PERFORM pg_temp.assert_true(SQLERRM='PROGRESSIVE_UNAUTHORIZED','unauthorized child must retain typed rejection');
  END;

  PERFORM pg_temp.assert_true(
    NOT EXISTS (SELECT 1 FROM public.bookings WHERE user_id='91000000-0000-0000-0000-000000000004'),
    'failed safety requests must leave no partial booking'
  );

  SELECT jsonb_build_object(
    'bookings', (SELECT count(*) FROM public.bookings),
    'bookingSessions', (SELECT count(*) FROM public.booking_sessions),
    'scheduleSlots', (SELECT count(*) FROM public.schedule_slots),
    'pricingScopes', (SELECT count(*) FROM public.booking_pricing_scopes),
    'mutationReceipts', (SELECT count(*) FROM public.progressive_booking_mutation_receipts),
    'couponReservations', (SELECT count(*) FROM public.progressive_coupon_reservations),
    'couponUsages', (SELECT count(*) FROM public.coupon_usages),
    'paymentBatches', (SELECT count(*) FROM public.progressive_payment_batches),
    'paymentBatchMembers', (SELECT count(*) FROM public.progressive_payment_batch_bookings),
    'verificationAttempts', (SELECT count(*) FROM public.progressive_payment_verification_attempts),
    'paymentAllocations', (SELECT count(*) FROM public.progressive_payment_allocations),
    'payments', (SELECT count(*) FROM public.payments),
    'ledger', (SELECT count(*) FROM public.payment_ledger_allocations_v1),
    'finance', (SELECT count(*) FROM public.finance_expenses),
    'activityLogs', (SELECT count(*) FROM public.activity_logs)
  ) INTO v_failure_artifacts_after;
  PERFORM pg_temp.assert_true(
    v_failure_artifacts_after = v_failure_artifacts_before,
    'failed requests must leave no partial booking/session/scope/receipt/coupon/payment/allocation/ledger/finance artifacts'
  );
END;
$$;

SELECT pg_temp.assert_true(
  public.progressive_pricing_writes_capability_v1()->>'slotEntryPolicy'='unlimited_learner_v1',
  'capability must advertise unlimited learner policy'
);

ROLLBACK;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.bookings WHERE id::text LIKE '95%') THEN
    RAISE EXCEPTION 'ASSERTION_FAILED: rollback must leave no fixture bookings';
  END IF;
END;
$$;

SELECT 'PASS: unlimited slot entry runtime fixtures rolled back cleanly' AS result;
