-- Slice 3 remains inactive until both server-only Progressive feature flags are enabled.
CREATE TABLE IF NOT EXISTS public.coupon_course_types (
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  course_type_id uuid NOT NULL REFERENCES public.course_types(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (coupon_id, course_type_id)
);

CREATE TABLE IF NOT EXISTS public.progressive_coupon_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE RESTRICT,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'consumed', 'released')),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  released_at timestamptz,
  release_reason text
    CHECK (release_reason IS NULL OR release_reason IN ('booking_cancelled', 'booking_expired', 'payment_rejected')),
  gross_price_snapshot numeric(12, 2) NOT NULL CHECK (gross_price_snapshot >= 0),
  discount_type_snapshot public.discount_type NOT NULL,
  discount_value_snapshot numeric(10, 2) NOT NULL CHECK (discount_value_snapshot > 0),
  discount_amount_snapshot numeric(12, 2) NOT NULL CHECK (discount_amount_snapshot >= 0),
  final_price_snapshot numeric(12, 2) NOT NULL CHECK (final_price_snapshot >= 0),
  pricing_revision bigint NOT NULL CHECK (pricing_revision >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT progressive_coupon_reservations_booking_unique UNIQUE (booking_id),
  CONSTRAINT progressive_coupon_reservations_state_check CHECK (
    (status = 'reserved' AND consumed_at IS NULL AND released_at IS NULL AND release_reason IS NULL)
    OR (status = 'consumed' AND consumed_at IS NOT NULL AND released_at IS NULL AND release_reason IS NULL)
    OR (status = 'released' AND consumed_at IS NULL AND released_at IS NOT NULL AND release_reason IS NOT NULL)
  ),
  CONSTRAINT progressive_coupon_reservations_amount_check CHECK (
    discount_amount_snapshot <= gross_price_snapshot
    AND final_price_snapshot = round(greatest(0, gross_price_snapshot - discount_amount_snapshot), 2)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_progressive_coupon_active_user
  ON public.progressive_coupon_reservations(coupon_id, user_id)
  WHERE status IN ('reserved', 'consumed');

CREATE INDEX IF NOT EXISTS idx_progressive_coupon_quota
  ON public.progressive_coupon_reservations(coupon_id, status);

CREATE INDEX IF NOT EXISTS idx_progressive_coupon_booking_status
  ON public.progressive_coupon_reservations(booking_id, status);

CREATE OR REPLACE TRIGGER tr_progressive_coupon_reservations_updated_at
  BEFORE UPDATE ON public.progressive_coupon_reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.coupon_course_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progressive_coupon_reservations ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.coupon_course_types TO service_role;
GRANT ALL ON TABLE public.progressive_coupon_reservations TO service_role;

CREATE OR REPLACE FUNCTION public.calculate_progressive_coupon_discount_v1(
  p_gross_price numeric,
  p_discount_type public.discount_type,
  p_discount_value numeric
)
RETURNS TABLE (discount_amount numeric, final_price numeric)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gross numeric(12, 2);
  v_discount numeric(12, 2);
BEGIN
  IF p_gross_price IS NULL OR p_gross_price < 0
    OR p_discount_value IS NULL OR p_discount_value <= 0
    OR (p_discount_type = 'percent' AND p_discount_value > 100)
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  v_gross := round(p_gross_price, 2);
  v_discount := CASE p_discount_type
    WHEN 'fixed' THEN round(p_discount_value, 2)
    WHEN 'percent' THEN round((v_gross * p_discount_value) / 100, 0)
    ELSE 0
  END;
  v_discount := round(least(v_gross, greatest(0, v_discount)), 2);

  discount_amount := v_discount;
  final_price := round(greatest(0, v_gross - v_discount), 2);
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_progressive_coupon_v1(
  p_coupon_id uuid,
  p_booking_id uuid,
  p_user_id uuid,
  p_course_type_id uuid,
  p_gross_price numeric,
  p_pricing_revision bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_coupon public.coupons%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_existing public.progressive_coupon_reservations%ROWTYPE;
  v_legacy_uses bigint;
  v_progressive_uses bigint;
  v_discount numeric(12, 2);
  v_final numeric(12, 2);
BEGIN
  IF p_coupon_id IS NULL OR p_booking_id IS NULL OR p_user_id IS NULL
    OR p_course_type_id IS NULL OR p_gross_price IS NULL OR p_gross_price < 0
    OR p_pricing_revision IS NULL OR p_pricing_revision < 1
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  SELECT coupon.* INTO v_coupon
  FROM public.coupons coupon
  WHERE coupon.id = p_coupon_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_COUPON_NOT_FOUND';
  END IF;
  IF NOT v_coupon.is_active THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_COUPON_INACTIVE';
  END IF;
  IF v_coupon.valid_from > current_date THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_COUPON_NOT_STARTED';
  END IF;
  IF v_coupon.valid_to IS NOT NULL AND v_coupon.valid_to < current_date THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_COUPON_EXPIRED';
  END IF;
  IF v_coupon.min_purchase IS NOT NULL AND p_gross_price < v_coupon.min_purchase THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_COUPON_MIN_PURCHASE';
  END IF;

  SELECT booking.* INTO v_booking
  FROM public.bookings booking
  WHERE booking.id = p_booking_id AND booking.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_booking.course_type_id IS DISTINCT FROM p_course_type_id
    OR v_booking.status::text <> 'pending_payment'
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_UNAUTHORIZED';
  END IF;

  SELECT reservation.* INTO v_existing
  FROM public.progressive_coupon_reservations reservation
  WHERE reservation.booking_id = p_booking_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.coupon_id IS DISTINCT FROM p_coupon_id OR v_existing.user_id IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_COUPON_STACK_NOT_ALLOWED';
    END IF;
    IF v_existing.status <> 'reserved' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_COUPON_STATE_CONFLICT';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.coupon_course_types WHERE coupon_id = p_coupon_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.coupon_course_types
      WHERE coupon_id = p_coupon_id AND course_type_id = p_course_type_id
    )
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_COUPON_COURSE_NOT_ALLOWED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.progressive_coupon_reservations reservation
    WHERE reservation.coupon_id = p_coupon_id
      AND reservation.user_id = p_user_id
      AND reservation.booking_id <> p_booking_id
      AND reservation.status IN ('reserved', 'consumed')
  ) OR EXISTS (
    SELECT 1 FROM public.coupon_usages usage
    WHERE usage.coupon_id = p_coupon_id AND usage.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_COUPON_ALREADY_USED';
  END IF;

  SELECT count(*) INTO v_legacy_uses
  FROM public.coupon_usages usage
  WHERE usage.coupon_id = p_coupon_id;

  SELECT count(*) INTO v_progressive_uses
  FROM public.progressive_coupon_reservations reservation
  WHERE reservation.coupon_id = p_coupon_id
    AND reservation.status IN ('reserved', 'consumed')
    AND reservation.booking_id <> p_booking_id;

  IF v_coupon.max_uses IS NOT NULL
    AND greatest(v_coupon.current_uses, v_legacy_uses) + v_progressive_uses >= v_coupon.max_uses
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_COUPON_MAX_USES';
  END IF;

  SELECT calculated.discount_amount, calculated.final_price
  INTO v_discount, v_final
  FROM public.calculate_progressive_coupon_discount_v1(
    p_gross_price, v_coupon.discount_type, v_coupon.discount_value
  ) calculated;

  RETURN jsonb_build_object(
    'couponId', v_coupon.id,
    'discountType', v_coupon.discount_type,
    'discountValue', round(v_coupon.discount_value, 2),
    'grossPrice', round(p_gross_price, 2),
    'discountAmount', v_discount,
    'finalPrice', v_final,
    'pricingRevision', p_pricing_revision
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_progressive_coupon_v1(
  p_coupon_id uuid,
  p_booking_id uuid,
  p_user_id uuid,
  p_course_type_id uuid,
  p_gross_price numeric,
  p_pricing_revision bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.progressive_coupon_reservations%ROWTYPE;
  v_validation jsonb;
  v_reservation public.progressive_coupon_reservations%ROWTYPE;
BEGIN
  SELECT reservation.* INTO v_existing
  FROM public.progressive_coupon_reservations reservation
  WHERE reservation.booking_id = p_booking_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.coupon_id IS DISTINCT FROM p_coupon_id OR v_existing.user_id IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_COUPON_STACK_NOT_ALLOWED';
    END IF;
    IF v_existing.status <> 'reserved' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_COUPON_STATE_CONFLICT';
    END IF;
    RETURN jsonb_build_object(
      'reservationId', v_existing.id,
      'status', v_existing.status,
      'discountAmount', v_existing.discount_amount_snapshot,
      'finalPrice', v_existing.final_price_snapshot,
      'idempotentReplay', true
    );
  END IF;

  v_validation := public.validate_progressive_coupon_v1(
    p_coupon_id, p_booking_id, p_user_id, p_course_type_id,
    p_gross_price, p_pricing_revision
  );

  INSERT INTO public.progressive_coupon_reservations (
    coupon_id, booking_id, user_id, status, gross_price_snapshot,
    discount_type_snapshot, discount_value_snapshot, discount_amount_snapshot,
    final_price_snapshot, pricing_revision
  ) VALUES (
    p_coupon_id, p_booking_id, p_user_id, 'reserved',
    (v_validation ->> 'grossPrice')::numeric,
    (v_validation ->> 'discountType')::public.discount_type,
    (v_validation ->> 'discountValue')::numeric,
    (v_validation ->> 'discountAmount')::numeric,
    (v_validation ->> 'finalPrice')::numeric,
    p_pricing_revision
  ) RETURNING * INTO v_reservation;

  UPDATE public.bookings
  SET
    gross_price_snapshot = v_reservation.gross_price_snapshot,
    coupon_discount_snapshot = v_reservation.discount_amount_snapshot,
    final_price_snapshot = v_reservation.final_price_snapshot,
    total_price = v_reservation.final_price_snapshot
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'reservationId', v_reservation.id,
    'status', v_reservation.status,
    'discountAmount', v_reservation.discount_amount_snapshot,
    'finalPrice', v_reservation.final_price_snapshot,
    'idempotentReplay', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_progressive_coupon_discount_v1(
  p_booking_id uuid,
  p_gross_price numeric,
  p_pricing_revision bigint
)
RETURNS TABLE (discount_amount numeric, final_price numeric)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reservation public.progressive_coupon_reservations%ROWTYPE;
BEGIN
  IF p_booking_id IS NULL OR p_gross_price IS NULL OR p_gross_price < 0
    OR p_pricing_revision IS NULL OR p_pricing_revision < 1
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  SELECT reservation.* INTO v_reservation
  FROM public.progressive_coupon_reservations reservation
  WHERE reservation.booking_id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND OR v_reservation.status = 'released' THEN
    discount_amount := 0;
    final_price := round(p_gross_price, 2);
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_reservation.status <> 'reserved' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_COUPON_STATE_CONFLICT';
  END IF;

  SELECT calculated.discount_amount, calculated.final_price
  INTO discount_amount, final_price
  FROM public.calculate_progressive_coupon_discount_v1(
    p_gross_price,
    v_reservation.discount_type_snapshot,
    v_reservation.discount_value_snapshot
  ) calculated;

  UPDATE public.progressive_coupon_reservations
  SET
    gross_price_snapshot = round(p_gross_price, 2),
    discount_amount_snapshot = discount_amount,
    final_price_snapshot = final_price,
    pricing_revision = p_pricing_revision
  WHERE id = v_reservation.id;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_progressive_coupon_v1(
  p_booking_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reservation public.progressive_coupon_reservations%ROWTYPE;
  v_booking_status text;
BEGIN
  SELECT reservation.* INTO v_reservation
  FROM public.progressive_coupon_reservations reservation
  WHERE reservation.booking_id = p_booking_id AND reservation.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_COUPON_RESERVATION_NOT_FOUND';
  END IF;

  PERFORM coupon.id FROM public.coupons coupon
  WHERE coupon.id = v_reservation.coupon_id FOR UPDATE;

  SELECT booking.status::text INTO v_booking_status
  FROM public.bookings booking
  WHERE booking.id = p_booking_id AND booking.user_id = p_user_id
  FOR UPDATE;

  IF v_reservation.status = 'released' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_COUPON_STATE_CONFLICT';
  END IF;
  IF v_booking_status IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BOOKING_NOT_PENDING';
  END IF;
  IF v_reservation.status = 'consumed' THEN
    RETURN jsonb_build_object('reservationId', v_reservation.id, 'status', 'consumed', 'idempotentReplay', true);
  END IF;

  UPDATE public.progressive_coupon_reservations
  SET status = 'consumed', consumed_at = transaction_timestamp()
  WHERE id = v_reservation.id;

  RETURN jsonb_build_object('reservationId', v_reservation.id, 'status', 'consumed', 'idempotentReplay', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_progressive_coupon_v1(
  p_booking_id uuid,
  p_user_id uuid,
  p_release_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reservation public.progressive_coupon_reservations%ROWTYPE;
BEGIN
  IF p_release_reason IS NULL OR p_release_reason NOT IN ('booking_cancelled', 'booking_expired', 'payment_rejected') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  SELECT reservation.* INTO v_reservation
  FROM public.progressive_coupon_reservations reservation
  WHERE reservation.booking_id = p_booking_id AND reservation.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('released', false, 'status', null, 'idempotentReplay', true);
  END IF;

  PERFORM coupon.id FROM public.coupons coupon
  WHERE coupon.id = v_reservation.coupon_id FOR UPDATE;

  IF v_reservation.status = 'consumed' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_COUPON_STATE_CONFLICT';
  END IF;
  IF v_reservation.status = 'released' THEN
    IF v_reservation.release_reason IS DISTINCT FROM p_release_reason THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_COUPON_STATE_CONFLICT';
    END IF;
    RETURN jsonb_build_object('released', true, 'status', 'released', 'releaseReason', v_reservation.release_reason, 'idempotentReplay', true);
  END IF;

  UPDATE public.progressive_coupon_reservations
  SET
    status = 'released',
    released_at = transaction_timestamp(),
    release_reason = p_release_reason
  WHERE id = v_reservation.id;

  RETURN jsonb_build_object('released', true, 'status', 'released', 'releaseReason', p_release_reason, 'idempotentReplay', false);
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
  v_booking record;
  v_tier record;
  v_sequence integer := 0;
  v_cumulative integer := 0;
  v_entitlement integer;
  v_gross numeric(12, 2);
  v_discount numeric(12, 2);
  v_final numeric(12, 2);
  v_should_reprice boolean;
  v_changes jsonb := '[]'::jsonb;
BEGIN
  FOR v_booking IN
    SELECT b.*
    FROM public.bookings b
    WHERE b.pricing_scope_id = p_scope_id
      AND b.status::text IN ('pending_payment', 'paid', 'verified')
      AND (b.status::text <> 'pending_payment' OR b.expires_at IS NULL OR b.expires_at > transaction_timestamp())
    ORDER BY b.created_at ASC, b.id ASC
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
      SELECT tier.id, tier.min_sessions, tier.max_sessions, tier.price_per_session
      INTO v_tier
      FROM public.pricing_tiers tier
      WHERE tier.course_type_id = v_booking.course_type_id
        AND tier.valid_from <= current_date
        AND (tier.valid_to IS NULL OR tier.valid_to >= current_date)
        AND v_cumulative + v_entitlement >= tier.min_sessions
        AND (tier.max_sessions IS NULL OR v_cumulative + v_entitlement <= tier.max_sessions)
      ORDER BY tier.valid_from DESC, tier.min_sessions DESC, tier.id ASC
      LIMIT 1;

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
      WHERE id = v_booking.id;
    END IF;

    v_cumulative := v_cumulative + v_entitlement;
  END LOOP;

  RETURN v_changes;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_progressive_booking_v1(
  p_user_id uuid,
  p_learner_type public.learner_type,
  p_child_id uuid,
  p_branch_id uuid,
  p_course_type_id uuid,
  p_sessions jsonb,
  p_coupon_id uuid,
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
  v_fingerprint text;
  v_scope_id uuid;
  v_revision bigint;
  v_booking_id uuid := gen_random_uuid();
  v_booking_child_id uuid;
  v_lesson_year integer;
  v_lesson_month integer;
  v_session_count integer;
  v_expires_at timestamptz := transaction_timestamp() + interval '14 days';
  v_changed jsonb;
  v_final numeric(12, 2);
  v_gross numeric(12, 2);
  v_coupon_result jsonb;
  v_slot_ids uuid[];
  v_result jsonb;
BEGIN
  IF p_user_id IS NULL OR p_branch_id IS NULL OR p_course_type_id IS NULL
    OR p_client_request_id IS NULL OR p_expected_scope_revision IS NULL
    OR p_expected_scope_revision < 0
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  v_fingerprint := md5(concat_ws('|',
    'create', p_user_id::text, p_learner_type::text, coalesce(p_child_id::text, ''),
    p_branch_id::text, p_course_type_id::text, coalesce(p_sessions::text, ''),
    coalesce(p_coupon_id::text, ''), p_expected_scope_revision::text
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

  SELECT acquired.scope_id, acquired.new_revision
  INTO v_scope_id, v_revision
  FROM public.progressive_acquire_scope_v1(
    p_user_id, p_course_type_id, v_lesson_year, v_lesson_month, p_expected_scope_revision
  ) acquired;

  PERFORM public.progressive_assert_scope_membership_v1(
    v_scope_id, p_user_id, p_course_type_id, v_lesson_year, v_lesson_month
  );

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

  SELECT array_agg(DISTINCT bs.schedule_slot_id ORDER BY bs.schedule_slot_id)
  INTO v_slot_ids FROM public.booking_sessions bs WHERE bs.booking_id = v_booking_id;

  v_changed := public.progressive_reprice_scope_v1(
    v_scope_id, v_revision, transaction_timestamp(), v_booking_id
  );

  IF p_coupon_id IS NOT NULL THEN
    SELECT b.gross_price_snapshot INTO v_gross
    FROM public.bookings b WHERE b.id = v_booking_id;
    v_coupon_result := public.reserve_progressive_coupon_v1(
      p_coupon_id, v_booking_id, p_user_id, p_course_type_id, v_gross, v_revision
    );
  END IF;

  SELECT b.total_price INTO v_final FROM public.bookings b WHERE b.id = v_booking_id;
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

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_progressive_pending_booking_v1(
  p_user_id uuid,
  p_booking_id uuid,
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
  v_slot_ids uuid[];
  v_changed jsonb;
  v_coupon_release jsonb;
  v_result jsonb;
BEGIN
  IF p_user_id IS NULL OR p_booking_id IS NULL OR p_client_request_id IS NULL
    OR p_expected_scope_revision IS NULL OR p_expected_scope_revision < 1
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  v_fingerprint := md5(concat_ws('|',
    'cancel', p_user_id::text, p_booking_id::text, p_expected_scope_revision::text
  ));

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'progressive-request|' || p_user_id::text || '|' || p_client_request_id::text, 0
  ));

  SELECT receipt.* INTO v_receipt
  FROM public.progressive_booking_mutation_receipts receipt
  WHERE receipt.user_id = p_user_id AND receipt.client_request_id = p_client_request_id;

  IF FOUND THEN
    IF v_receipt.mutation_type <> 'cancel'
      OR v_receipt.booking_id IS DISTINCT FROM p_booking_id
      OR v_receipt.request_fingerprint <> v_fingerprint
    THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN jsonb_set(v_receipt.result, '{idempotentReplay}', 'true'::jsonb, true);
  END IF;

  SELECT b.* INTO v_booking
  FROM public.bookings b WHERE b.id = p_booking_id AND b.user_id = p_user_id;

  IF NOT FOUND OR v_booking.pricing_scope_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_UNAUTHORIZED';
  END IF;

  SELECT s.* INTO v_scope
  FROM public.booking_pricing_scopes s WHERE s.id = v_booking.pricing_scope_id;

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

  SELECT b.* INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id AND b.user_id = p_user_id
  FOR UPDATE;

  IF v_booking.status::text <> 'pending_payment' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BOOKING_NOT_PENDING';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payments payment WHERE payment.booking_id = p_booking_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_PAYMENT_EXISTS';
  END IF;
  IF EXISTS (SELECT 1 FROM public.coupon_usages usage WHERE usage.booking_id = p_booking_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_COUPON_NOT_READY';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.booking_sessions bs
    WHERE bs.booking_id = p_booking_id
      AND (bs.status::text <> 'scheduled' OR bs.cancelled_at IS NOT NULL)
  ) OR EXISTS (
    SELECT 1 FROM public.attendance attendance
    JOIN public.booking_sessions bs ON bs.id = attendance.booking_session_id
    WHERE bs.booking_id = p_booking_id
  ) OR EXISTS (
    SELECT 1 FROM public.coach_assignment_group_students assigned
    JOIN public.booking_sessions bs ON bs.id = assigned.booking_session_id
    WHERE bs.booking_id = p_booking_id
  ) OR EXISTS (
    SELECT 1 FROM public.lesson_wallet_credits wallet
    JOIN public.booking_sessions bs
      ON bs.id = wallet.original_session_id OR bs.id = wallet.redeemed_session_id
    WHERE bs.booking_id = p_booking_id
  ) OR EXISTS (
    SELECT 1 FROM public.booking_sessions later_session
    JOIN public.booking_sessions original_session
      ON original_session.id = later_session.rescheduled_from_id
    WHERE original_session.booking_id = p_booking_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BOOKING_CONFLICT';
  END IF;

  SELECT array_agg(DISTINCT bs.schedule_slot_id ORDER BY bs.schedule_slot_id)
  INTO v_slot_ids FROM public.booking_sessions bs WHERE bs.booking_id = p_booking_id;

  PERFORM ss.id FROM public.schedule_slots ss
  WHERE ss.id = ANY(coalesce(v_slot_ids, ARRAY[]::uuid[]))
  ORDER BY ss.id FOR UPDATE;

  v_coupon_release := public.release_progressive_coupon_v1(
    p_booking_id, p_user_id, 'booking_cancelled'
  );

  UPDATE public.booking_sessions
  SET cancelled_at = transaction_timestamp()
  WHERE booking_id = p_booking_id AND status::text = 'scheduled' AND cancelled_at IS NULL;

  UPDATE public.bookings SET status = 'cancelled' WHERE id = p_booking_id;

  v_changed := public.progressive_reprice_scope_v1(
    v_scope_id, v_revision, v_booking.created_at, p_booking_id
  );

  PERFORM public.progressive_refresh_slot_capacity_v1(v_slot_ids);

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    p_user_id, 'cancel_progressive_pending_booking', 'booking', p_booking_id,
    jsonb_build_object(
      'scopeId', v_scope_id,
      'scopeRevision', v_revision,
      'cancelledAt', transaction_timestamp(),
      'softCancelledSessions', true,
      'couponRelease', v_coupon_release
    )
  );

  v_result := jsonb_build_object(
    'ok', true,
    'mutation', 'cancel',
    'bookingId', p_booking_id,
    'scopeId', v_scope_id,
    'scopeRevision', v_revision,
    'totalPrice', v_booking.total_price,
    'expiresAt', v_booking.expires_at,
    'idempotentReplay', false,
    'changedBookings', v_changed
  );

  INSERT INTO public.progressive_booking_mutation_receipts (
    user_id, booking_id, client_request_id, mutation_type, request_fingerprint,
    expected_scope_revision, result
  ) VALUES (
    p_user_id, p_booking_id, p_client_request_id, 'cancel', v_fingerprint,
    p_expected_scope_revision, v_result
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.progressive_coupon_lifecycle_capability_v1()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'ready',
      to_regclass('public.progressive_coupon_reservations') IS NOT NULL
      AND to_regclass('public.coupon_course_types') IS NOT NULL
      AND to_regprocedure('public.validate_progressive_coupon_v1(uuid,uuid,uuid,uuid,numeric,bigint)') IS NOT NULL
      AND to_regprocedure('public.reserve_progressive_coupon_v1(uuid,uuid,uuid,uuid,numeric,bigint)') IS NOT NULL
      AND to_regprocedure('public.recalculate_progressive_coupon_discount_v1(uuid,numeric,bigint)') IS NOT NULL
      AND to_regprocedure('public.consume_progressive_coupon_v1(uuid,uuid)') IS NOT NULL
      AND to_regprocedure('public.release_progressive_coupon_v1(uuid,uuid,text)') IS NOT NULL,
    'version', 1
  );
$$;

REVOKE ALL ON FUNCTION public.calculate_progressive_coupon_discount_v1(numeric, public.discount_type, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_progressive_coupon_v1(uuid, uuid, uuid, uuid, numeric, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_progressive_coupon_v1(uuid, uuid, uuid, uuid, numeric, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_progressive_coupon_discount_v1(uuid, numeric, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_progressive_coupon_v1(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_progressive_coupon_v1(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progressive_coupon_lifecycle_capability_v1() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.calculate_progressive_coupon_discount_v1(numeric, public.discount_type, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_progressive_coupon_v1(uuid, uuid, uuid, uuid, numeric, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_progressive_coupon_v1(uuid, uuid, uuid, uuid, numeric, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_progressive_coupon_discount_v1(uuid, numeric, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_progressive_coupon_v1(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_progressive_coupon_v1(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.progressive_coupon_lifecycle_capability_v1() TO service_role;
