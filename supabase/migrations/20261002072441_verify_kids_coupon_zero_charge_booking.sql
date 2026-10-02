BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
-- Drain existing Task10 writers before replacing their function bodies.
SELECT pg_advisory_xact_lock(10,1);
DO $preflight$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('public.create_progressive_booking_v1(uuid,public.learner_type,uuid,uuid,uuid,jsonb,uuid,uuid,bigint,integer,text)','7176595035099bd36809ee32575ce388'),
    ('public.progressive_reprice_scope_v1(uuid,bigint,timestamptz,uuid)','a235cc456e350daa2491f8cb083934e0'),
    ('public.update_progressive_pending_booking_v1(uuid,uuid,uuid,jsonb,uuid,bigint)','338e9f2192e3dbf66f2742833b02a39d'),
    ('public.task10_write_legacy_booking_v1(uuid,text,uuid,jsonb)','838aa1c29d11c16298826827942d77ae')
  ) AS expected(signature,hash) LOOP
    IF md5(replace(pg_get_functiondef(to_regprocedure(r.signature)),chr(13)||chr(10),chr(10))) IS DISTINCT FROM r.hash THEN
      RAISE EXCEPTION 'PAY_ZERO_BASELINE_DRIFT: %',r.signature;
    END IF;
  END LOOP;
END $preflight$;
-- PAY-ZERO-1: only newly created / authoritatively repriced Kids coupon-zero
-- bills are finalized. This migration performs no business-data backfill.
-- Existing admission, policy, scope, slot and idempotency contracts stay intact.

CREATE FUNCTION public.verify_progressive_zero_charge_booking_v1(p_booking_id uuid,p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE b public.bookings%ROWTYPE; r public.progressive_coupon_reservations%ROWTYPE;
BEGIN
  -- Internal only, under the existing writer's transaction and scope locks.
  IF current_user NOT IN ('postgres','supabase_admin') THEN RAISE EXCEPTION 'PROGRESSIVE_UNAUTHORIZED'; END IF;
  SELECT * INTO b FROM public.bookings WHERE id=p_booking_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROGRESSIVE_UNAUTHORIZED'; END IF;
  IF b.status::text<>'pending_payment' OR b.total_price IS DISTINCT FROM 0::numeric THEN RETURN false; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.course_types WHERE id=b.course_type_id AND name::text='kids_group')
    OR b.pricing_scope_id IS NULL OR b.final_price_snapshot IS DISTINCT FROM 0::numeric
    OR b.gross_price_snapshot IS NULL OR b.gross_price_snapshot<=0
    OR b.coupon_discount_snapshot IS DISTINCT FROM b.gross_price_snapshot
    OR public.task10_booking_due_v1(b.id)
    OR EXISTS(SELECT 1 FROM public.payments WHERE booking_id=b.id)
    OR EXISTS(SELECT 1 FROM public.progressive_payment_batch_bookings WHERE booking_id=b.id AND active)
  THEN RAISE EXCEPTION 'PROGRESSIVE_COUPON_STATE_CONFLICT'; END IF;

  SELECT * INTO r FROM public.progressive_coupon_reservations WHERE booking_id=b.id AND user_id=b.user_id FOR UPDATE;
  IF NOT FOUND OR r.status<>'reserved' OR r.final_price_snapshot IS DISTINCT FROM b.final_price_snapshot
    OR r.gross_price_snapshot IS DISTINCT FROM b.gross_price_snapshot
    OR r.discount_amount_snapshot IS DISTINCT FROM b.coupon_discount_snapshot
    OR r.pricing_revision IS DISTINCT FROM b.pricing_revision
  THEN RAISE EXCEPTION 'PROGRESSIVE_COUPON_STATE_CONFLICT'; END IF;

  -- Record the final calculation while it is still pending; settled snapshots
  -- are then frozen by the existing reprice predicate. No fake payment/receipt.
  PERFORM public.task10_record_scope_calculations_v1(b.pricing_scope_id,b.pricing_revision);
  UPDATE public.bookings SET status='verified' WHERE id=b.id;
  -- reserved and consumed both occupy quota. This transition changes no coupon
  -- quota/counter and acquires no new coupon lock after the caller's slot locks.
  -- The reservation is already protected by this scope/row lock; competing
  -- release/consume attempts recheck its terminal state under that same lock.
  UPDATE public.progressive_coupon_reservations SET status='consumed',consumed_at=transaction_timestamp() WHERE id=r.id;
  INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details)
    VALUES(b.user_id,'verify_zero_charge_booking','booking',b.id,jsonb_build_object(
      'scopeId',b.pricing_scope_id,'scopeRevision',b.pricing_revision,'couponReservationId',r.id,
      'grossPrice',b.gross_price_snapshot,'discountAmount',b.coupon_discount_snapshot,'totalPrice',0,'settlementKind','coupon_zero_charge'));
  INSERT INTO public.notifications(user_id,title,message,type,link_url)
    VALUES(b.user_id,'ยืนยันการจองแล้ว','ยอดสุทธิ 0 บาท ไม่ต้องชำระเงินหรือแนบสลิป ตารางเรียนพร้อมใช้งาน','schedule','/dashboard/history');
  INSERT INTO public.notifications(user_id,title,message,type,link_url)
    SELECT id,'ยืนยันการจองยอด 0 บาทแล้ว','รายการใช้คูปองครบยอดได้รับการยืนยันแล้ว ไม่มีเงินโอน','schedule','/admin/notifications'
    FROM public.profiles WHERE role::text IN ('admin','super_admin');
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.verify_progressive_zero_charge_booking_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.create_progressive_booking_v1(
  p_user_id uuid,
  p_learner_type public.learner_type,
  p_child_id uuid,
  p_branch_id uuid,
  p_course_type_id uuid,
  p_sessions jsonb,
  p_coupon_id uuid,
  p_client_request_id uuid,
  p_expected_scope_revision bigint,
  p_expected_legacy_baseline_sessions integer,
  p_expected_legacy_baseline_fingerprint text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_receipt public.progressive_booking_mutation_receipts%ROWTYPE;
  v_scope public.booking_pricing_scopes%ROWTYPE;
  v_fingerprint text;
  v_effective jsonb;
  v_scope_id uuid;
  v_revision bigint;
  v_booking_id uuid := gen_random_uuid();
  v_booking_child_id uuid;
  v_lesson_year integer;
  v_lesson_month integer;
  v_session_count integer;
  v_expires_at timestamptz := public.task10_transaction_start_v1() + interval '14 days';
  v_changed jsonb;
  v_final numeric(12, 2);
  v_gross numeric(12, 2);
  v_coupon_result jsonb;
  v_slot_ids uuid[];
  v_result jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  IF public.task10_source_policy_established_v1() THEN
    SELECT min(requested.lesson_year),min(requested.lesson_month) INTO v_lesson_year,v_lesson_month
      FROM public.progressive_requested_sessions_v1(p_user_id,p_course_type_id,p_learner_type,p_child_id,p_branch_id,p_sessions) requested;
    PERFORM public.task10_lock_pricing_scope_v1(p_user_id,p_course_type_id,v_lesson_year,v_lesson_month);
  END IF;
  PERFORM set_config('task10.defer_calculation_record','yes',true);
  IF p_user_id IS NULL OR p_branch_id IS NULL OR p_course_type_id IS NULL
    OR p_client_request_id IS NULL OR p_expected_scope_revision IS NULL
    OR p_expected_scope_revision < 0
    OR p_expected_legacy_baseline_sessions IS NULL
    OR p_expected_legacy_baseline_sessions < 0
    OR p_expected_legacy_baseline_fingerprint IS NULL
    OR p_expected_legacy_baseline_fingerprint !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  v_fingerprint := md5(concat_ws('|',
    'create', p_user_id::text, p_learner_type::text, coalesce(p_child_id::text, ''),
    p_branch_id::text, p_course_type_id::text, coalesce(p_sessions::text, ''),
    coalesce(p_coupon_id::text, ''), p_expected_scope_revision::text,
    p_expected_legacy_baseline_sessions::text,
    p_expected_legacy_baseline_fingerprint
  ));

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'progressive-request|' || p_user_id::text || '|' || p_client_request_id::text, 0
  ));

  SELECT receipt.* INTO v_receipt
  FROM public.progressive_booking_mutation_receipts receipt
  WHERE receipt.user_id = p_user_id AND receipt.client_request_id = p_client_request_id;

  IF FOUND THEN
    IF v_receipt.mutation_type <> 'create' OR v_receipt.request_fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_IDEMPOTENCY_CONFLICT';
    END IF;
    PERFORM set_config('task10.defer_calculation_record','',true);
    RETURN jsonb_set(v_receipt.result, '{idempotentReplay}', 'true'::jsonb, true);
  END IF;

  SELECT min(requested.lesson_year), min(requested.lesson_month), count(*)::integer
  INTO v_lesson_year, v_lesson_month, v_session_count
  FROM public.progressive_requested_sessions_v1(
    p_user_id, p_course_type_id, p_learner_type, p_child_id, p_branch_id, p_sessions
  ) requested;

  IF v_session_count IS NULL OR v_session_count <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  IF public.task10_source_policy_established_v1() THEN
    PERFORM public.task10_assert_scope_current_v1(p_user_id,p_course_type_id,v_lesson_year,v_lesson_month);
  END IF;

  SELECT acquired.scope_id, acquired.new_revision
  INTO v_scope_id, v_revision
  FROM public.progressive_acquire_scope_v1(
    p_user_id, p_course_type_id, v_lesson_year, v_lesson_month,
    p_expected_scope_revision
  ) acquired;

  SELECT scope.* INTO v_scope
  FROM public.booking_pricing_scopes scope
  WHERE scope.id = v_scope_id;

  v_effective := public.task10_effective_scope_baseline_v1(v_scope_id);
  v_scope.legacy_baseline_sessions := (v_effective->>'sessions')::integer;
  v_scope.legacy_baseline_fingerprint := v_effective->>'fingerprint';
  IF v_scope.legacy_baseline_sessions IS DISTINCT FROM p_expected_legacy_baseline_sessions
    OR v_scope.legacy_baseline_fingerprint IS DISTINCT FROM p_expected_legacy_baseline_fingerprint
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_LEGACY_BASELINE_CONFLICT';
  END IF;

  PERFORM public.progressive_assert_scope_membership_v1(
    v_scope_id, p_user_id, p_course_type_id, v_lesson_year, v_lesson_month
  );

  -- Coupon and slot waits both precede the actual successful creation clock.
  -- Legacy transactions use this same coupon-before-slot dependency order.
  IF p_coupon_id IS NOT NULL THEN
    PERFORM 1 FROM public.coupons WHERE id=p_coupon_id FOR UPDATE;
  END IF;
  PERFORM public.progressive_lock_booking_slots_v1(
    p_user_id, p_course_type_id, p_learner_type, p_child_id, p_branch_id, p_sessions
  );

  SELECT CASE
    WHEN p_learner_type = 'self' THEN NULL
    WHEN p_child_id IS NOT NULL THEN p_child_id
    WHEN count(DISTINCT requested.child_id) = 1 THEN min(requested.child_id::text)::uuid
    ELSE NULL
  END INTO v_booking_child_id
  FROM public.progressive_requested_sessions_v1(
    p_user_id, p_course_type_id, p_learner_type, p_child_id, p_branch_id, p_sessions
  ) requested;

  INSERT INTO public.bookings (
    id, user_id, learner_type, child_id, branch_id, course_type_id, month, year,
    total_sessions, total_price, status, pricing_scope_id, entitlement_sessions,
    coupon_discount_snapshot, pricing_revision, expires_at, client_request_id
  ) VALUES (
    v_booking_id, p_user_id, p_learner_type, v_booking_child_id, p_branch_id,
    p_course_type_id, v_lesson_month, v_lesson_year, v_session_count, 0,
    'pending_payment', v_scope_id, v_session_count, 0, v_revision, v_expires_at,
    p_client_request_id
  );

  INSERT INTO public.booking_sessions (
    booking_id, schedule_slot_id, date, start_time, end_time, branch_id,
    child_id, status, is_makeup
  )
  SELECT
    v_booking_id, slot.id, requested.session_date, requested.session_start,
    requested.session_end, requested.branch_id, requested.child_id, 'scheduled', false
  FROM public.progressive_requested_sessions_v1(
    p_user_id, p_course_type_id, p_learner_type, p_child_id, p_branch_id, p_sessions
  ) requested
  JOIN public.schedule_slots slot
    ON slot.branch_id = requested.branch_id
    AND slot.course_type_id = p_course_type_id
    AND slot.date = requested.session_date
    AND slot.start_time = requested.session_start
    AND slot.end_time = requested.session_end
  ORDER BY requested.ordinal;

  SELECT array_agg(DISTINCT session.schedule_slot_id ORDER BY session.schedule_slot_id)
  INTO v_slot_ids
  FROM public.booking_sessions session
  WHERE session.booking_id = v_booking_id;

  v_changed := public.progressive_reprice_scope_v1(
    v_scope_id, v_revision, (SELECT created_at FROM public.bookings WHERE id=v_booking_id), v_booking_id
  );

  IF p_coupon_id IS NOT NULL THEN
    SELECT booking.gross_price_snapshot INTO v_gross
    FROM public.bookings booking WHERE booking.id = v_booking_id;
    v_coupon_result := public.reserve_progressive_coupon_v1(
      p_coupon_id, v_booking_id, p_user_id, p_course_type_id, v_gross, v_revision
    );
  END IF;

  IF p_coupon_id IS NOT NULL THEN
    PERFORM public.verify_progressive_zero_charge_booking_v1(v_booking_id,p_user_id);
  END IF;

  SELECT booking.total_price INTO v_final
  FROM public.bookings booking WHERE booking.id = v_booking_id;
  IF p_coupon_id IS NOT NULL THEN
    v_changed := jsonb_build_array(jsonb_build_object(
      'bookingId', v_booking_id,
      'oldPrice', 0,
      'newPrice', v_final
    ));
  END IF;
  PERFORM public.progressive_refresh_slot_capacity_v1(v_slot_ids);

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    p_user_id, 'create_progressive_booking', 'booking', v_booking_id,
    jsonb_build_object(
      'scopeId', v_scope_id,
      'scopeRevision', v_revision,
      'entitlementSessions', v_session_count,
      'legacyBaselineSessions', v_scope.legacy_baseline_sessions,
      'totalPrice', v_final,
      'expiresAt', v_expires_at,
      'couponId', p_coupon_id,
      'couponReservationId', v_coupon_result ->> 'reservationId'
    )
  );

  v_result := jsonb_build_object(
    'ok', true,
    'mutation', 'create',
    'bookingId', v_booking_id,
    'scopeId', v_scope_id,
    'scopeRevision', v_revision,
    'totalPrice', v_final,
    'status', (SELECT status::text FROM public.bookings WHERE id=v_booking_id),
    'expiresAt', v_expires_at,
    'idempotentReplay', false,
    'changedBookings', v_changed
  );

  INSERT INTO public.progressive_booking_mutation_receipts (
    user_id, booking_id, client_request_id, mutation_type, request_fingerprint,
    expected_scope_revision, result
  ) VALUES (
    p_user_id, v_booking_id, p_client_request_id, 'create', v_fingerprint,
    p_expected_scope_revision, v_result
  );

  PERFORM set_config('task10.defer_calculation_record','',true);
  PERFORM public.task10_record_scope_calculations_v1(v_scope_id,v_revision);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.progressive_reprice_scope_v1(
  p_scope_id uuid,
  p_new_revision bigint,
  p_start_created_at timestamptz DEFAULT NULL,
  p_start_booking_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scope public.booking_pricing_scopes%ROWTYPE;
  v_booking record;
  v_tier record;
  v_sequence integer := 0;
  v_cumulative integer;
  v_entitlement integer;
  v_gross numeric(12, 2);
  v_discount numeric(12, 2);
  v_final numeric(12, 2);
  v_should_reprice boolean;
  v_changes jsonb := '[]'::jsonb;
BEGIN
  SELECT scope.* INTO v_scope
  FROM public.booking_pricing_scopes scope
  WHERE scope.id = p_scope_id;

  IF NOT FOUND OR v_scope.legacy_baseline_initialized_at IS NULL
    OR v_scope.legacy_baseline_sessions IS NULL
    OR v_scope.legacy_baseline_fingerprint IS NULL
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_LEGACY_BASELINE_DRIFT';
  END IF;

  v_cumulative := (public.task10_effective_scope_baseline_v1(p_scope_id)->>'sessions')::integer;

  FOR v_booking IN
    SELECT booking.*
    FROM public.bookings booking
    WHERE booking.pricing_scope_id = p_scope_id
      AND booking.status::text IN ('pending_payment', 'paid', 'verified')
      AND (
        public.task10_pending_pricing_active_v1(booking.id)
      )
    ORDER BY booking.created_at ASC, booking.id ASC
  LOOP
    v_entitlement := coalesce(v_booking.entitlement_sessions, v_booking.total_sessions);
    IF v_entitlement IS NULL OR v_entitlement <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
    END IF;

    v_sequence := v_sequence + 1;
    v_should_reprice := v_booking.status::text = 'pending_payment'
      AND (
        p_start_created_at IS NULL
        OR (v_booking.created_at, v_booking.id) >= (p_start_created_at, p_start_booking_id)
      );

    IF v_should_reprice THEN
      SELECT * INTO v_tier FROM public.task10_booking_tier_v1(v_booking.id,v_cumulative+v_entitlement);

      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_MISSING_TIER';
      END IF;

      v_gross := round((v_entitlement * v_tier.price_per_session)::numeric, 2);
      SELECT calculated.discount_amount, calculated.final_price
      INTO v_discount, v_final
      FROM public.recalculate_progressive_coupon_discount_v1(
        v_booking.id, v_gross, p_new_revision
      ) calculated;

      IF round(v_booking.total_price::numeric, 2) IS DISTINCT FROM v_final THEN
        v_changes := v_changes || jsonb_build_array(jsonb_build_object(
          'bookingId', v_booking.id,
          'oldPrice', round(v_booking.total_price::numeric, 2),
          'newPrice', v_final
        ));
      END IF;

      UPDATE public.bookings
      SET
        entitlement_sessions = v_entitlement,
        pricing_sequence = v_sequence,
        cumulative_sessions_before = v_cumulative,
        cumulative_sessions_after = v_cumulative + v_entitlement,
        pricing_tier_id_snapshot = v_tier.id,
        pricing_rate_snapshot = v_tier.price_per_session,
        gross_price_snapshot = v_gross,
        coupon_discount_snapshot = v_discount,
        final_price_snapshot = v_final,
        pricing_revision = p_new_revision,
        pricing_calculated_at = transaction_timestamp(),
        total_price = v_final
      WHERE id = v_booking.id
        AND pricing_scope_id = p_scope_id;
      IF v_final=0 AND v_discount>0 THEN
        PERFORM public.verify_progressive_zero_charge_booking_v1(v_booking.id,v_booking.user_id);
      END IF;
    END IF;

    v_cumulative := v_cumulative + v_entitlement;
  END LOOP;

  IF current_setting('task10.defer_calculation_record',true) IS DISTINCT FROM 'yes' THEN
    PERFORM public.task10_record_scope_calculations_v1(p_scope_id,p_new_revision);
  END IF;
  RETURN v_changes;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_progressive_pending_booking_v1(
  p_user_id uuid,
  p_booking_id uuid,
  p_branch_id uuid,
  p_sessions jsonb,
  p_client_request_id uuid,
  p_expected_scope_revision bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_receipt public.progressive_booking_mutation_receipts%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_scope public.booking_pricing_scopes%ROWTYPE;
  v_fingerprint text;
  v_scope_id uuid;
  v_revision bigint;
  v_session_count integer;
  v_lesson_year integer;
  v_lesson_month integer;
  v_booking_child_id uuid;
  v_old_slot_ids uuid[];
  v_all_slot_ids uuid[];
  v_changed jsonb;
  v_final numeric(12, 2);
  v_result jsonb;
  v_policy jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  IF public.task10_source_policy_established_v1() THEN
    SELECT b.* INTO v_booking FROM public.bookings b WHERE b.id=p_booking_id AND b.user_id=p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'PROGRESSIVE_UNAUTHORIZED'; END IF;
    PERFORM public.task10_lock_pricing_scope_v1(p_user_id,v_booking.course_type_id,v_booking.year,v_booking.month);
  END IF;
  IF p_user_id IS NULL
    OR p_booking_id IS NULL
    OR p_branch_id IS NULL
    OR p_client_request_id IS NULL
    OR p_expected_scope_revision IS NULL
    OR p_expected_scope_revision < 1
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  v_fingerprint := md5(concat_ws('|',
    'update', p_user_id::text, p_booking_id::text, p_branch_id::text,
    coalesce(p_sessions::text, ''), p_expected_scope_revision::text
  ));

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'progressive-request|' || p_user_id::text || '|' || p_client_request_id::text,
    0
  ));

  SELECT receipt.*
  INTO v_receipt
  FROM public.progressive_booking_mutation_receipts receipt
  WHERE receipt.user_id = p_user_id
    AND receipt.client_request_id = p_client_request_id;

  IF FOUND THEN
    IF v_receipt.mutation_type <> 'update'
      OR v_receipt.booking_id IS DISTINCT FROM p_booking_id
      OR v_receipt.request_fingerprint <> v_fingerprint
    THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN jsonb_set(v_receipt.result, '{idempotentReplay}', 'true'::jsonb, true);
  END IF;

  SELECT b.*
  INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id AND b.user_id = p_user_id;

  IF NOT FOUND OR v_booking.pricing_scope_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_UNAUTHORIZED';
  END IF;

  IF public.task10_source_policy_established_v1() THEN
    PERFORM public.task10_assert_scope_current_v1(p_user_id,v_booking.course_type_id,v_booking.year,v_booking.month);
    v_policy:=public.task10_booking_policy_quote_v1(p_user_id,v_booking.course_type_id,make_date(v_booking.year,v_booking.month,1),'progressive',p_booking_id);
    IF v_policy->>'fingerprint' IS DISTINCT FROM current_setting('task10.expected_policy',true) THEN RAISE EXCEPTION 'TASK10_PREVIEW_CONFLICT'; END IF;
  END IF;

  SELECT s.*
  INTO v_scope
  FROM public.booking_pricing_scopes s
  WHERE s.id = v_booking.pricing_scope_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_RPC_UNAVAILABLE';
  END IF;

  SELECT acquired.scope_id, acquired.new_revision
  INTO v_scope_id, v_revision
  FROM public.progressive_acquire_scope_v1(
    p_user_id, v_booking.course_type_id, v_scope.lesson_year, v_scope.lesson_month,
    p_expected_scope_revision
  ) acquired;

  IF v_scope_id IS DISTINCT FROM v_booking.pricing_scope_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BOOKING_CONFLICT';
  END IF;

  PERFORM public.progressive_assert_scope_membership_v1(
    v_scope_id, p_user_id, v_booking.course_type_id, v_scope.lesson_year, v_scope.lesson_month
  );

  SELECT b.*
  INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id AND b.user_id = p_user_id
  FOR UPDATE;

  IF v_booking.status::text <> 'pending_payment' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BOOKING_NOT_PENDING';
  END IF;

  IF v_booking.expires_at IS NULL OR v_booking.expires_at <= transaction_timestamp() THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BOOKING_EXPIRED';
  END IF;

  IF EXISTS (SELECT 1 FROM public.payments payment WHERE payment.booking_id = p_booking_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_PAYMENT_EXISTS';
  END IF;

  IF EXISTS (SELECT 1 FROM public.coupon_usages usage WHERE usage.booking_id = p_booking_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_COUPON_NOT_READY';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.booking_sessions bs
    WHERE bs.booking_id = p_booking_id
      AND (bs.status::text <> 'scheduled' OR bs.cancelled_at IS NOT NULL)
  ) OR EXISTS (
    SELECT 1
    FROM public.attendance attendance
    JOIN public.booking_sessions bs ON bs.id = attendance.booking_session_id
    WHERE bs.booking_id = p_booking_id
  ) OR EXISTS (
    SELECT 1
    FROM public.booking_sessions later_session
    JOIN public.booking_sessions original_session
      ON original_session.id = later_session.rescheduled_from_id
    WHERE original_session.booking_id = p_booking_id
  ) OR EXISTS (
    SELECT 1
    FROM public.coach_assignment_group_students assigned
    JOIN public.booking_sessions bs ON bs.id = assigned.booking_session_id
    WHERE bs.booking_id = p_booking_id
  ) OR EXISTS (
    SELECT 1
    FROM public.lesson_wallet_credits wallet
    JOIN public.booking_sessions bs
      ON bs.id = wallet.original_session_id OR bs.id = wallet.redeemed_session_id
    WHERE bs.booking_id = p_booking_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BOOKING_CONFLICT';
  END IF;

  SELECT min(requested.lesson_year), min(requested.lesson_month), count(*)::integer
  INTO v_lesson_year, v_lesson_month, v_session_count
  FROM public.progressive_requested_sessions_v1(
    p_user_id, v_booking.course_type_id, v_booking.learner_type,
    v_booking.child_id, p_branch_id, p_sessions
  ) requested;

  IF v_lesson_year <> v_scope.lesson_year OR v_lesson_month <> v_scope.lesson_month THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_MULTI_MONTH_BOOKING';
  END IF;

  SELECT array_agg(DISTINCT bs.schedule_slot_id ORDER BY bs.schedule_slot_id)
  INTO v_old_slot_ids
  FROM public.booking_sessions bs
  WHERE bs.booking_id = p_booking_id;

  PERFORM public.progressive_lock_booking_slots_v1(
    p_user_id, v_booking.course_type_id, v_booking.learner_type,
    v_booking.child_id, p_branch_id, p_sessions, p_booking_id, v_old_slot_ids
  );

  SELECT CASE
    WHEN v_booking.learner_type = 'self' THEN NULL
    WHEN v_booking.child_id IS NOT NULL THEN v_booking.child_id
    WHEN count(DISTINCT requested.child_id) = 1 THEN min(requested.child_id::text)::uuid
    ELSE NULL
  END
  INTO v_booking_child_id
  FROM public.progressive_requested_sessions_v1(
    p_user_id, v_booking.course_type_id, v_booking.learner_type,
    v_booking.child_id, p_branch_id, p_sessions
  ) requested;

  DELETE FROM public.booking_sessions WHERE booking_id = p_booking_id;

  UPDATE public.bookings
  SET
    branch_id = p_branch_id,
    child_id = v_booking_child_id,
    total_sessions = v_session_count,
    entitlement_sessions = v_session_count
  WHERE id = p_booking_id;

  INSERT INTO public.booking_sessions (
    booking_id, schedule_slot_id, date, start_time, end_time, branch_id,
    child_id, status, is_makeup
  )
  SELECT
    p_booking_id,
    slot.id,
    requested.session_date,
    requested.session_start,
    requested.session_end,
    requested.branch_id,
    requested.child_id,
    'scheduled',
    false
  FROM public.progressive_requested_sessions_v1(
    p_user_id, v_booking.course_type_id, v_booking.learner_type,
    v_booking.child_id, p_branch_id, p_sessions
  ) requested
  JOIN public.schedule_slots slot
    ON slot.branch_id = requested.branch_id
    AND slot.course_type_id = v_booking.course_type_id
    AND slot.date = requested.session_date
    AND slot.start_time = requested.session_start
    AND slot.end_time = requested.session_end
  ORDER BY requested.ordinal;

  SELECT array_agg(DISTINCT slot_id ORDER BY slot_id)
  INTO v_all_slot_ids
  FROM (
    SELECT unnest(coalesce(v_old_slot_ids, ARRAY[]::uuid[])) AS slot_id
    UNION
    SELECT bs.schedule_slot_id FROM public.booking_sessions bs WHERE bs.booking_id = p_booking_id
  ) affected;

  v_changed := public.progressive_reprice_scope_v1(
    v_scope_id, v_revision, v_booking.created_at, p_booking_id
  );

  SELECT b.total_price
  INTO v_final
  FROM public.bookings b
  WHERE b.id = p_booking_id;

  PERFORM public.progressive_refresh_slot_capacity_v1(v_all_slot_ids);

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    p_user_id,
    'update_progressive_pending_booking',
    'booking',
    p_booking_id,
    jsonb_build_object(
      'scopeId', v_scope_id,
      'scopeRevision', v_revision,
      'entitlementSessions', v_session_count,
      'totalPrice', v_final,
      'expiresAtPreserved', v_booking.expires_at
    )
  );

  v_result := jsonb_build_object(
    'ok', true,
    'mutation', 'update',
    'bookingId', p_booking_id,
    'scopeId', v_scope_id,
    'scopeRevision', v_revision,
    'totalPrice', v_final,
    'status', (SELECT status::text FROM public.bookings WHERE id=p_booking_id),
    'expiresAt', v_booking.expires_at,
    'idempotentReplay', false,
    'changedBookings', v_changed
  );

  INSERT INTO public.progressive_booking_mutation_receipts (
    user_id, booking_id, client_request_id, mutation_type, request_fingerprint,
    expected_scope_revision, result
  ) VALUES (
    p_user_id, p_booking_id, p_client_request_id, 'update', v_fingerprint,
    p_expected_scope_revision, v_result
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.task10_write_legacy_booking_v1(p_user_id uuid,p_action text,p_request_id uuid,p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_old public.bookings%ROWTYPE; v_book public.bookings%ROWTYPE; v_prior public.task10_legacy_booking_mutations%ROWTYPE;
  v_id uuid:=(p_input->>'bookingId')::uuid; v_course uuid:=(p_input->>'courseTypeId')::uuid; v_branch uuid:=(p_input->>'branchId')::uuid;
  v_month integer:=(p_input->>'month')::integer; v_year integer:=(p_input->>'year')::integer; v_quantity integer:=(p_input->>'totalSessions')::integer;
  v_learner public.learner_type; v_child uuid; v_name text; v_scopes jsonb; v_sessions jsonb:=p_input->'sessions'; v_fingerprint text;
  v_gross numeric; v_discount numeric:=0; v_final numeric; v_coupon public.coupons%ROWTYPE; v_policy jsonb;
  v_date date; v_start time; v_end time; v_template uuid; v_slot uuid; v_slots uuid[]; v_count integer; r jsonb; v_result jsonb; v_active boolean;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  PERFORM pg_advisory_xact_lock_shared(10,2);
  PERFORM pg_advisory_xact_lock_shared(10,3);
  IF p_user_id IS NULL OR p_request_id IS NULL OR p_action IS NULL OR p_action NOT IN ('create','update','cancel')
    OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user_id) THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
  -- One user's replay key precedes its family locks; all Legacy requests use it.
  PERFORM pg_advisory_xact_lock(hashtextextended('task10-legacy-request|'||p_user_id::text||'|'||p_request_id::text,0));
  v_fingerprint:=encode(extensions.digest(concat_ws('|',p_action,p_input::text),'sha256'),'hex');
  SELECT * INTO v_prior FROM public.task10_legacy_booking_mutations WHERE user_id=p_user_id AND request_id=p_request_id;
  IF FOUND THEN
    IF v_prior.fingerprint<>v_fingerprint THEN RAISE EXCEPTION 'TASK10_IDEMPOTENCY_CONFLICT'; END IF;
    RETURN v_prior.result||jsonb_build_object('idempotentReplay',true);
  END IF;
  IF p_action<>'create' THEN
    SELECT * INTO v_old FROM public.bookings WHERE id=v_id AND user_id=p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'TASK10_UNAUTHORIZED'; END IF;
    IF v_old.pricing_scope_id IS NOT NULL THEN RAISE EXCEPTION 'TASK10_BOOKING_STATE_CONFLICT'; END IF;
    IF p_action='cancel' THEN v_course:=v_old.course_type_id;v_year:=v_old.year;v_month:=v_old.month; END IF;
  END IF;
  v_scopes:=jsonb_build_array(jsonb_build_object('user_id',p_user_id,'course_type_id',v_course,'year',v_year,'month',v_month));
  IF p_action<>'create' THEN v_scopes:=v_scopes||jsonb_build_array(jsonb_build_object('user_id',p_user_id,'course_type_id',v_old.course_type_id,'year',v_old.year,'month',v_old.month)); END IF;
  PERFORM public.task10_lock_scopes_v1(v_scopes);
  IF p_action<>'create' THEN
    SELECT * INTO v_old FROM public.bookings WHERE id=v_id AND user_id=p_user_id;
    IF v_old.status::text<>'pending_payment' OR v_old.course_type_id<>v_course THEN RAISE EXCEPTION 'TASK10_BOOKING_STATE_CONFLICT'; END IF;
    IF public.task10_booking_due_v1(v_id) THEN RAISE EXCEPTION 'TASK10_BOOKING_DEADLINE'; END IF;
  END IF;
  v_active:=public.task10_source_policy_established_v1();
  IF p_action='cancel' THEN
    PERFORM public.task10_cancel_legacy_booking_v1(v_id,p_user_id,'user_cancelled_pending');
    v_result:=jsonb_build_object('success',true,'bookingId',v_id,'status','cancelled');
  ELSE
    SELECT name::text INTO v_name FROM public.course_types WHERE id=v_course;
    IF v_name IS NULL OR jsonb_typeof(v_sessions) IS DISTINCT FROM 'array' OR jsonb_array_length(v_sessions)=0
      OR v_quantity IS NULL OR v_quantity<1 OR v_branch IS NULL OR NOT EXISTS(SELECT 1 FROM public.branches WHERE id=v_branch AND is_active)
      THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
    IF v_active AND p_action='create' AND v_name='kids_group' THEN RAISE EXCEPTION 'TASK10_PROGRESSIVE_ENTRY_REQUIRED'; END IF;
    IF v_active THEN PERFORM public.task10_assert_scope_current_v1(p_user_id,v_course,v_year,v_month); END IF;
    v_learner:=CASE WHEN p_action='create' THEN (p_input->>'learnerType')::public.learner_type ELSE v_old.learner_type END;
    v_child:=CASE WHEN p_action='create' THEN (p_input->>'childId')::uuid ELSE v_old.child_id END;
    IF v_learner IS NULL OR (v_child IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.children WHERE id=v_child AND parent_id=p_user_id)) THEN RAISE EXCEPTION 'TASK10_UNAUTHORIZED'; END IF;
    IF p_action='update' AND EXISTS(SELECT 1 FROM public.bookings b JOIN public.booking_pricing_scopes sc ON sc.user_id=b.user_id AND sc.course_type_id=b.course_type_id
      AND sc.lesson_year=b.year AND sc.lesson_month=b.month WHERE b.id=v_id AND sc.legacy_baseline_initialized_at IS NOT NULL
      AND ROW(b.total_sessions,b.year,b.month) IS DISTINCT FROM ROW(v_quantity,v_year,v_month)) THEN RAISE EXCEPTION 'PROGRESSIVE_LEGACY_BASELINE_DRIFT'; END IF;
    IF p_action='update' AND (EXISTS(SELECT 1 FROM public.payments WHERE booking_id=v_id AND status::text IN ('pending','approved'))
      OR EXISTS(SELECT 1 FROM public.booking_sessions s LEFT JOIN public.attendance a ON a.booking_session_id=s.id
        WHERE s.booking_id=v_id AND (s.status::text<>'scheduled' OR s.is_makeup OR a.id IS NOT NULL))) THEN RAISE EXCEPTION 'TASK10_BOOKING_STATE_CONFLICT'; END IF;
    IF v_name='private' THEN
      SELECT count(DISTINCT (x->>'date',x->>'startTime',x->>'endTime',x->>'branchId')) INTO v_count FROM jsonb_array_elements(v_sessions) x;
      IF EXISTS(SELECT 1 FROM (SELECT coalesce(x->>'childId','self') AS learner,count(*) AS n FROM jsonb_array_elements(v_sessions) x GROUP BY 1) participants WHERE n<>v_count)
        THEN RAISE EXCEPTION 'TASK10_FAMILY_PARTICIPANTS_CONFLICT'; END IF;
    ELSE v_count:=jsonb_array_length(v_sessions); END IF;
    IF v_count<>v_quantity THEN RAISE EXCEPTION 'TASK10_INVALID_QUANTITY'; END IF;
    -- Read the same tier/package formulas as pricing.ts, after all aggregate locks.
    v_gross:=public.task10_legacy_price_v1(p_user_id,v_course,v_month,v_year,v_quantity,CASE WHEN p_action='update' THEN v_id ELSE NULL END);
    IF (p_input->>'totalAmount')::numeric IS NULL OR abs(v_gross-(p_input->>'totalAmount')::numeric)>1 THEN RAISE EXCEPTION 'TASK10_AMOUNT_CONFLICT'; END IF;
    IF p_action='create' AND v_gross>0 AND (p_input->'coupon'->>'id' IS NOT NULL OR nullif(trim(p_input->'coupon'->>'code'),'') IS NOT NULL) THEN
      SELECT * INTO v_coupon FROM public.coupons WHERE (p_input->'coupon'->>'id' IS NULL OR id=(p_input->'coupon'->>'id')::uuid)
        AND (nullif(trim(p_input->'coupon'->>'code'),'') IS NULL OR code=upper(trim(p_input->'coupon'->>'code'))) FOR UPDATE;
      IF NOT FOUND OR NOT v_coupon.is_active OR (v_coupon.valid_from IS NOT NULL AND v_coupon.valid_from>(public.task10_clock_v1() AT TIME ZONE 'UTC')::date)
        OR (v_coupon.valid_to IS NOT NULL AND v_coupon.valid_to<(public.task10_clock_v1() AT TIME ZONE 'UTC')::date)
        OR (v_coupon.max_uses IS NOT NULL AND v_coupon.current_uses>=v_coupon.max_uses) OR v_gross<coalesce(v_coupon.min_purchase,0)
        OR EXISTS(SELECT 1 FROM public.coupon_usages WHERE coupon_id=v_coupon.id AND user_id=p_user_id) THEN RAISE EXCEPTION 'TASK10_COUPON_CONFLICT'; END IF;
      v_discount:=CASE WHEN v_coupon.discount_type::text='fixed' THEN least(v_coupon.discount_value,v_gross)
        WHEN v_coupon.discount_type::text='percent' THEN round(v_gross*v_coupon.discount_value/100) ELSE 0 END;
    END IF;
    v_final:=greatest(0,v_gross-v_discount);
    IF (p_input->>'expectedTotalPrice')::numeric IS NULL OR abs(v_final-(p_input->>'expectedTotalPrice')::numeric)>1 THEN RAISE EXCEPTION 'TASK10_AMOUNT_CONFLICT'; END IF;
    IF p_action='create' THEN
      INSERT INTO public.bookings(user_id,learner_type,child_id,branch_id,course_type_id,month,year,total_sessions,total_price,status)
        VALUES(p_user_id,v_learner,v_child,v_branch,v_course,v_month,v_year,v_quantity,v_final,
          CASE WHEN v_name='kids_group' AND v_final=0 THEN 'verified'::public.booking_status ELSE 'pending_payment'::public.booking_status END) RETURNING * INTO v_book;
      v_id:=v_book.id;
    ELSE
      SELECT array_agg(DISTINCT schedule_slot_id ORDER BY schedule_slot_id) INTO v_slots FROM public.booking_sessions WHERE booking_id=v_id;
      DELETE FROM public.booking_sessions WHERE booking_id=v_id;
      UPDATE public.bookings SET branch_id=v_branch,month=v_month,year=v_year,total_sessions=v_quantity,total_price=v_final,
        status=CASE WHEN v_name='kids_group' AND v_final=0 THEN 'verified'::public.booking_status ELSE 'pending_payment'::public.booking_status END
        WHERE id=v_id RETURNING * INTO v_book;
    END IF;
    FOR r IN SELECT x FROM jsonb_array_elements(v_sessions) x ORDER BY x->>'branchId',x->>'date',x->>'startTime',x->>'childId' LOOP
      v_date:=(r->>'date')::date; v_start:=(r->>'startTime')::time;v_end:=(r->>'endTime')::time;
      IF extract(year FROM v_date)<>v_year OR extract(month FROM v_date)<>v_month OR (v_learner::text='child' AND r->>'childId' IS NULL)
        OR (v_learner::text='child' AND v_child IS NOT NULL AND v_child<>(r->>'childId')::uuid)
        OR (r->>'childId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.children WHERE id=(r->>'childId')::uuid AND parent_id=p_user_id)) THEN RAISE EXCEPTION 'TASK10_INVALID_LEARNER'; END IF;
      -- Earlier inserts in this same transaction also enforce duplicate/overlap.
      IF EXISTS(SELECT 1 FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id WHERE b.user_id=p_user_id
        AND b.status::text IN ('pending_payment','paid','verified') AND s.status::text IN ('scheduled','completed','absent') AND s.cancelled_at IS NULL
        AND s.child_id IS NOT DISTINCT FROM (r->>'childId')::uuid AND s.date=v_date AND s.start_time<v_end AND s.end_time>v_start)
        THEN RAISE EXCEPTION 'TASK10_DUPLICATE_SESSION'; END IF;
      SELECT id INTO v_template FROM public.schedule_templates WHERE branch_id=(r->>'branchId')::uuid AND course_type_id=v_course
        AND day_of_week=extract(dow FROM v_date) AND start_time=v_start AND end_time=v_end AND is_active
        AND (r->>'scheduleTemplateId' IS NULL OR id=(r->>'scheduleTemplateId')::uuid) ORDER BY id LIMIT 1;
      v_slot:=public.task10_target_slot_v1(v_course,v_template,(r->>'branchId')::uuid,v_date,v_start,v_end);
      INSERT INTO public.booking_sessions(booking_id,date,start_time,end_time,branch_id,child_id,schedule_slot_id,status,is_makeup)
        VALUES(v_id,v_date,v_start,v_end,(r->>'branchId')::uuid,(r->>'childId')::uuid,v_slot,'scheduled',false);
      v_slots:=array_append(v_slots,v_slot);
    END LOOP;
    IF v_coupon.id IS NOT NULL THEN
      INSERT INTO public.coupon_usages(coupon_id,user_id,booking_id,discount_amount) VALUES(v_coupon.id,p_user_id,v_id,v_discount);
      UPDATE public.coupons SET current_uses=current_uses+1,is_active=CASE WHEN max_uses IS NOT NULL AND current_uses+1>=max_uses THEN false ELSE is_active END WHERE id=v_coupon.id;
    END IF;
    PERFORM public.progressive_refresh_slot_capacity_v1(v_slots);
    IF v_name='kids_group' AND v_final=0 THEN
      INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details)
        VALUES(p_user_id,'verify_zero_charge_booking','booking',v_id,jsonb_build_object(
          'grossPrice',v_gross,'discountAmount',v_discount,'totalPrice',v_final,'settlementKind',
          CASE WHEN v_discount>0 THEN 'coupon_zero_charge' ELSE 'legacy_zero_charge' END,'requestId',p_request_id));
    END IF;
    v_result:=jsonb_build_object('success',true,'bookingId',v_id,'totalPrice',v_final,'status',v_book.status);
    IF p_action='create' THEN
      INSERT INTO public.notifications(user_id,title,message,type,link_url) VALUES(p_user_id,
        CASE WHEN v_book.status::text='verified' THEN 'สร้างการจองสำเร็จ' ELSE 'สร้างการจองแล้ว รอแนบสลิป' END,
        'สร้างการจอง '||v_quantity||' ครั้ง ยอดชำระ ฿'||v_final,'payment','/dashboard/history');
      INSERT INTO public.notifications(user_id,title,message,type,link_url)
        SELECT id,'มีการจองใหม่','สร้างการจองใหม่ '||v_quantity||' ครั้ง ยอดชำระ ฿'||v_final,'schedule','/admin/notifications'
        FROM public.profiles WHERE role::text IN ('admin','super_admin');
    END IF;
  END IF;
  INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details)
    VALUES(p_user_id,CASE p_action WHEN 'create' THEN 'create_booking' WHEN 'update' THEN 'update_pending_booking_sessions' ELSE 'cancel_pending_booking' END,'booking',v_id,
      v_result||jsonb_build_object('requestId',p_request_id,'settledStatuses',jsonb_build_array('paid','verified')));
  INSERT INTO public.task10_legacy_booking_mutations(user_id,request_id,fingerprint,booking_id,result) VALUES(p_user_id,p_request_id,v_fingerprint,v_id,v_result);
  RETURN v_result;
END $$;

NOTIFY pgrst,'reload schema';
COMMIT;
