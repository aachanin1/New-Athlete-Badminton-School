-- Option A compatibility: immutable Legacy entitlement baseline for Progressive Kids Group scopes.
-- This migration is additive at apply time. It does not update bookings, payments, ledger,
-- coupons, wallet, attendance, or accounting rows.

ALTER TABLE public.booking_pricing_scopes
  ADD COLUMN IF NOT EXISTS legacy_baseline_sessions integer,
  ADD COLUMN IF NOT EXISTS legacy_baseline_fingerprint text,
  ADD COLUMN IF NOT EXISTS legacy_baseline_initialized_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_pricing_scopes_legacy_baseline_check'
  ) THEN
    ALTER TABLE public.booking_pricing_scopes
      ADD CONSTRAINT booking_pricing_scopes_legacy_baseline_check
      CHECK (
        (
          legacy_baseline_sessions IS NULL
          AND legacy_baseline_fingerprint IS NULL
          AND legacy_baseline_initialized_at IS NULL
        )
        OR (
          legacy_baseline_sessions >= 0
          AND legacy_baseline_fingerprint ~ '^[0-9a-f]{64}$'
          AND legacy_baseline_initialized_at IS NOT NULL
        )
      );
  END IF;
END;
$$;

COMMENT ON COLUMN public.booking_pricing_scopes.legacy_baseline_sessions IS
  'Immutable purchased-session baseline from eligible Legacy Kids Group bookings when this Progressive scope is initialized.';
COMMENT ON COLUMN public.booking_pricing_scopes.legacy_baseline_fingerprint IS
  'Immutable SHA-256 fingerprint of the sorted eligible Legacy booking set; contains no monetary values.';
COMMENT ON COLUMN public.booking_pricing_scopes.legacy_baseline_initialized_at IS
  'Transaction timestamp when the immutable Legacy baseline was initialized under the scope advisory lock.';

CREATE OR REPLACE FUNCTION public.prevent_progressive_legacy_baseline_change_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.legacy_baseline_initialized_at IS NOT NULL
    AND (
      NEW.legacy_baseline_sessions IS DISTINCT FROM OLD.legacy_baseline_sessions
      OR NEW.legacy_baseline_fingerprint IS DISTINCT FROM OLD.legacy_baseline_fingerprint
      OR NEW.legacy_baseline_initialized_at IS DISTINCT FROM OLD.legacy_baseline_initialized_at
    )
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_LEGACY_BASELINE_DRIFT';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_prevent_progressive_legacy_baseline_change
  ON public.booking_pricing_scopes;
CREATE TRIGGER tr_prevent_progressive_legacy_baseline_change
BEFORE UPDATE OF legacy_baseline_sessions, legacy_baseline_fingerprint,
  legacy_baseline_initialized_at
ON public.booking_pricing_scopes
FOR EACH ROW
EXECUTE FUNCTION public.prevent_progressive_legacy_baseline_change_v1();

CREATE OR REPLACE FUNCTION public.progressive_legacy_baseline_v1(
  p_user_id uuid,
  p_course_type_id uuid,
  p_lesson_year integer,
  p_lesson_month integer
)
RETURNS TABLE (baseline_sessions integer, baseline_fingerprint text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_user_id IS NULL OR p_course_type_id IS NULL
    OR p_lesson_year IS NULL OR p_lesson_year < 2024
    OR p_lesson_month IS NULL OR p_lesson_month NOT BETWEEN 1 AND 12
    OR NOT EXISTS (
      SELECT 1 FROM public.course_types course
      WHERE course.id = p_course_type_id AND course.name::text = 'kids_group'
    )
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  RETURN QUERY
  WITH eligible AS (
    SELECT
      booking.id,
      booking.status::text AS status,
      booking.total_sessions,
      booking.expires_at
    FROM public.bookings booking
    WHERE booking.user_id = p_user_id
      AND booking.course_type_id = p_course_type_id
      AND booking.year = p_lesson_year
      AND booking.month = p_lesson_month
      AND booking.pricing_scope_id IS NULL
      AND booking.status::text IN ('pending_payment', 'paid', 'verified')
      AND (
        booking.status::text <> 'pending_payment'
        OR booking.expires_at IS NULL
        OR booking.expires_at > transaction_timestamp()
      )
  ), serialized AS (
    SELECT
      coalesce(sum(eligible.total_sessions), 0)::integer AS sessions,
      coalesce(string_agg(
        eligible.id::text || '|' || eligible.status || '|'
          || eligible.total_sessions::text || '|'
          || coalesce(
            to_char(eligible.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
            'null'
          ),
        E'\n' ORDER BY eligible.id
      ), '') AS fingerprint_input
    FROM eligible
  )
  SELECT
    serialized.sessions,
    encode(extensions.digest(serialized.fingerprint_input, 'sha256'), 'hex')
  FROM serialized;
END;
$$;

CREATE OR REPLACE FUNCTION public.progressive_acquire_scope_v1(
  p_user_id uuid,
  p_course_type_id uuid,
  p_lesson_year integer,
  p_lesson_month integer,
  p_expected_scope_revision bigint
)
RETURNS TABLE (scope_id uuid, new_revision bigint)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scope public.booking_pricing_scopes%ROWTYPE;
  v_baseline_sessions integer;
  v_baseline_fingerprint text;
BEGIN
  IF p_expected_scope_revision IS NULL OR p_expected_scope_revision < 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_user_id::text || '|' || p_course_type_id::text || '|' || p_lesson_year::text
      || '|' || p_lesson_month::text || '|THB',
    0
  ));

  SELECT baseline.baseline_sessions, baseline.baseline_fingerprint
  INTO v_baseline_sessions, v_baseline_fingerprint
  FROM public.progressive_legacy_baseline_v1(
    p_user_id, p_course_type_id, p_lesson_year, p_lesson_month
  ) baseline;

  SELECT scope.*
  INTO v_scope
  FROM public.booking_pricing_scopes scope
  WHERE scope.user_id = p_user_id
    AND scope.course_type_id = p_course_type_id
    AND scope.lesson_year = p_lesson_year
    AND scope.lesson_month = p_lesson_month
    AND scope.currency = 'THB'
  FOR UPDATE;

  IF NOT FOUND THEN
    IF p_expected_scope_revision <> 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_SCOPE_REVISION_CONFLICT';
    END IF;

    INSERT INTO public.booking_pricing_scopes (
      user_id, course_type_id, lesson_year, lesson_month, currency, revision,
      legacy_baseline_sessions, legacy_baseline_fingerprint,
      legacy_baseline_initialized_at
    ) VALUES (
      p_user_id, p_course_type_id, p_lesson_year, p_lesson_month, 'THB', 1,
      v_baseline_sessions, v_baseline_fingerprint, transaction_timestamp()
    )
    RETURNING id, revision INTO scope_id, new_revision;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_scope.locked_by_payment_batch_id IS NOT NULL OR v_scope.locked_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_SCOPE_LOCKED';
  END IF;

  IF v_scope.revision <> p_expected_scope_revision THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_SCOPE_REVISION_CONFLICT';
  END IF;

  IF v_scope.legacy_baseline_initialized_at IS NULL THEN
    -- Existing pre-compatibility Progressive scopes may initialize lazily only
    -- when the authoritative eligible Legacy set is empty.
    IF v_baseline_sessions <> 0
      OR v_baseline_fingerprint IS DISTINCT FROM
        encode(extensions.digest('', 'sha256'), 'hex')
    THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_LEGACY_BASELINE_DRIFT';
    END IF;

    UPDATE public.booking_pricing_scopes
    SET
      legacy_baseline_sessions = 0,
      legacy_baseline_fingerprint = v_baseline_fingerprint,
      legacy_baseline_initialized_at = transaction_timestamp(),
      revision = revision + 1
    WHERE id = v_scope.id
    RETURNING id, revision INTO scope_id, new_revision;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_scope.legacy_baseline_sessions IS DISTINCT FROM v_baseline_sessions
    OR v_scope.legacy_baseline_fingerprint IS DISTINCT FROM v_baseline_fingerprint
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_LEGACY_BASELINE_DRIFT';
  END IF;

  UPDATE public.booking_pricing_scopes
  SET revision = revision + 1
  WHERE id = v_scope.id
  RETURNING id, revision INTO scope_id, new_revision;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.progressive_assert_scope_membership_v1(
  p_scope_id uuid,
  p_user_id uuid,
  p_course_type_id uuid,
  p_lesson_year integer,
  p_lesson_month integer
)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.booking_pricing_scopes scope
    WHERE scope.id = p_scope_id
      AND scope.user_id = p_user_id
      AND scope.course_type_id = p_course_type_id
      AND scope.lesson_year = p_lesson_year
      AND scope.lesson_month = p_lesson_month
      AND scope.currency = 'THB'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BOOKING_CONFLICT';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bookings booking
    WHERE booking.user_id = p_user_id
      AND booking.course_type_id = p_course_type_id
      AND booking.status::text IN ('pending_payment', 'paid', 'verified')
      AND (
        booking.status::text <> 'pending_payment'
        OR booking.expires_at IS NULL
        OR booking.expires_at > transaction_timestamp()
      )
      AND booking.pricing_scope_id IS NOT NULL
      AND booking.pricing_scope_id IS DISTINCT FROM p_scope_id
      AND (
        (booking.year = p_lesson_year AND booking.month = p_lesson_month)
        OR EXISTS (
          SELECT 1 FROM public.booking_sessions session
          WHERE session.booking_id = booking.id
            AND extract(year FROM session.date)::integer = p_lesson_year
            AND extract(month FROM session.date)::integer = p_lesson_month
        )
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BOOKING_CONFLICT';
  END IF;
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

  v_cumulative := v_scope.legacy_baseline_sessions;

  FOR v_booking IN
    SELECT booking.*
    FROM public.bookings booking
    WHERE booking.pricing_scope_id = p_scope_id
      AND booking.status::text IN ('pending_payment', 'paid', 'verified')
      AND (
        booking.status::text <> 'pending_payment'
        OR booking.expires_at IS NULL
        OR booking.expires_at > transaction_timestamp()
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
      WHERE id = v_booking.id
        AND pricing_scope_id = p_scope_id;
    END IF;

    v_cumulative := v_cumulative + v_entitlement;
  END LOOP;

  RETURN v_changes;
END;
$$;

DROP FUNCTION IF EXISTS public.create_progressive_booking_v1(
  uuid, public.learner_type, uuid, uuid, uuid, jsonb, uuid, uuid, bigint
);

CREATE FUNCTION public.create_progressive_booking_v1(
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
    p_user_id, p_course_type_id, v_lesson_year, v_lesson_month,
    p_expected_scope_revision
  ) acquired;

  SELECT scope.* INTO v_scope
  FROM public.booking_pricing_scopes scope
  WHERE scope.id = v_scope_id;

  IF v_scope.legacy_baseline_sessions IS DISTINCT FROM p_expected_legacy_baseline_sessions
    OR v_scope.legacy_baseline_fingerprint IS DISTINCT FROM p_expected_legacy_baseline_fingerprint
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_LEGACY_BASELINE_CONFLICT';
  END IF;

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

  SELECT array_agg(DISTINCT session.schedule_slot_id ORDER BY session.schedule_slot_id)
  INTO v_slot_ids
  FROM public.booking_sessions session
  WHERE session.booking_id = v_booking_id;

  v_changed := public.progressive_reprice_scope_v1(
    v_scope_id, v_revision, transaction_timestamp(), v_booking_id
  );

  IF p_coupon_id IS NOT NULL THEN
    SELECT booking.gross_price_snapshot INTO v_gross
    FROM public.bookings booking WHERE booking.id = v_booking_id;
    v_coupon_result := public.reserve_progressive_coupon_v1(
      p_coupon_id, v_booking_id, p_user_id, p_course_type_id, v_gross, v_revision
    );
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

CREATE OR REPLACE FUNCTION public.progressive_pricing_writes_capability_v1()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'ready',
      to_regprocedure('public.progressive_legacy_baseline_v1(uuid,uuid,integer,integer)') IS NOT NULL
      AND to_regprocedure('public.create_progressive_booking_v1(uuid,learner_type,uuid,uuid,uuid,jsonb,uuid,uuid,bigint,integer,text)') IS NOT NULL
      AND to_regprocedure('public.update_progressive_pending_booking_v1(uuid,uuid,uuid,jsonb,uuid,bigint)') IS NOT NULL
      AND to_regprocedure('public.cancel_progressive_pending_booking_v1(uuid,uuid,uuid,bigint)') IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'booking_pricing_scopes'
          AND column_name = 'legacy_baseline_sessions'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'booking_pricing_scopes'
          AND column_name = 'legacy_baseline_fingerprint'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'booking_pricing_scopes'
          AND column_name = 'legacy_baseline_initialized_at'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bookings'
          AND column_name = 'client_request_id'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'booking_sessions'
          AND column_name = 'cancelled_at'
      ),
    'version', 2,
    'legacyBaselineContract', 'immutable_scope_v1'
  );
$$;

REVOKE ALL ON FUNCTION public.prevent_progressive_legacy_baseline_change_v1()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progressive_legacy_baseline_v1(uuid, uuid, integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progressive_acquire_scope_v1(uuid, uuid, integer, integer, bigint)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progressive_assert_scope_membership_v1(uuid, uuid, uuid, integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progressive_reprice_scope_v1(uuid, bigint, timestamptz, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_progressive_booking_v1(
  uuid, public.learner_type, uuid, uuid, uuid, jsonb, uuid, uuid, bigint, integer, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progressive_pricing_writes_capability_v1()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.progressive_legacy_baseline_v1(uuid, uuid, integer, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.create_progressive_booking_v1(
  uuid, public.learner_type, uuid, uuid, uuid, jsonb, uuid, uuid, bigint, integer, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.progressive_pricing_writes_capability_v1()
  TO service_role;
