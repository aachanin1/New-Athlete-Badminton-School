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
  ('91000000-0000-0000-0000-000000000004', 'unlimited-cancelled@example.invalid', '{"full_name":"Cancelled Target"}');

INSERT INTO public.branches (id, name, slug)
VALUES ('92000000-0000-0000-0000-000000000001', 'Unlimited Runtime Branch', 'unlimited-runtime');

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

INSERT INTO public.schedule_slots (
  id, template_id, branch_id, course_type_id, date, start_time, end_time,
  max_students, current_students, status
)
VALUES
  ('94000000-0000-0000-0000-000000000001', '93200000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', '2030-07-01', '10:00', '12:00', 6, 6, 'full'),
  ('94000000-0000-0000-0000-000000000002', '93200000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', '2030-07-08', '10:00', '12:00', 6, 20, 'full'),
  ('94000000-0000-0000-0000-000000000003', '93200000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', '2030-07-15', '10:00', '12:00', 6, 0, 'cancelled');

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
  v_result jsonb;
  v_booking_id uuid;
  v_user2_booking_id uuid;
  v_sessions jsonb;
  v_before_count integer;
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

  PERFORM pg_temp.assert_true(
    NOT EXISTS (SELECT 1 FROM public.bookings WHERE user_id='91000000-0000-0000-0000-000000000004'),
    'failed safety requests must leave no partial booking'
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
