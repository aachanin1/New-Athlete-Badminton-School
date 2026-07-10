-- Slice 2 remains inactive until the server-only feature flag is enabled after review.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

ALTER TABLE public.booking_sessions
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_client_request_id_unique
  ON public.bookings(user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_booking_sessions_progressive_capacity
  ON public.booking_sessions(schedule_slot_id, booking_id)
  WHERE cancelled_at IS NULL;

CREATE TABLE IF NOT EXISTS public.progressive_booking_mutation_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  client_request_id uuid NOT NULL,
  mutation_type text NOT NULL CHECK (mutation_type IN ('create', 'update', 'cancel')),
  request_fingerprint text NOT NULL,
  expected_scope_revision bigint NOT NULL CHECK (expected_scope_revision >= 0),
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT progressive_booking_mutation_receipts_request_unique
    UNIQUE (user_id, client_request_id)
);

COMMENT ON TABLE public.progressive_booking_mutation_receipts IS
  'Server-only idempotency receipts for feature-flagged progressive booking mutations.';

ALTER TABLE public.progressive_booking_mutation_receipts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.progressive_booking_mutation_receipts TO service_role;

CREATE OR REPLACE FUNCTION public.progressive_requested_sessions_v1(
  p_user_id uuid,
  p_course_type_id uuid,
  p_learner_type public.learner_type,
  p_booking_child_id uuid,
  p_booking_branch_id uuid,
  p_sessions jsonb
)
RETURNS TABLE (
  ordinal bigint,
  session_date date,
  session_start time,
  session_end time,
  branch_id uuid,
  child_id uuid,
  schedule_template_id uuid,
  lesson_year integer,
  lesson_month integer
)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
  v_ordinal bigint;
  v_date_text text;
  v_start_text text;
  v_end_text text;
  v_branch_text text;
  v_child_text text;
  v_template_text text;
  v_date date;
  v_start time;
  v_end time;
  v_branch uuid;
  v_child uuid;
  v_requested_template uuid;
  v_resolved_template uuid;
  v_first_year integer;
  v_first_month integer;
  v_identity text;
  v_identities text[] := ARRAY[]::text[];
  v_course_name text;
BEGIN
  IF p_user_id IS NULL OR p_course_type_id IS NULL OR p_booking_branch_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  SELECT ct.name::text
  INTO v_course_name
  FROM public.course_types ct
  WHERE ct.id = p_course_type_id;

  IF v_course_name IS DISTINCT FROM 'kids_group' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  IF jsonb_typeof(p_sessions) IS DISTINCT FROM 'array' OR jsonb_array_length(p_sessions) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  FOR v_item, v_ordinal IN
    SELECT item.value, item.ordinality
    FROM jsonb_array_elements(p_sessions) WITH ORDINALITY AS item(value, ordinality)
  LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
    END IF;

    v_date_text := v_item ->> 'date';
    v_start_text := v_item ->> 'start_time';
    v_end_text := v_item ->> 'end_time';
    v_branch_text := v_item ->> 'branch_id';
    v_child_text := NULLIF(v_item ->> 'child_id', '');
    v_template_text := NULLIF(v_item ->> 'schedule_template_id', '');

    IF v_date_text !~ '^\d{4}-\d{2}-\d{2}$'
      OR v_start_text !~ '^\d{2}:\d{2}(:\d{2})?$'
      OR v_end_text !~ '^\d{2}:\d{2}(:\d{2})?$'
      OR v_branch_text IS NULL
    THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
    END IF;

    BEGIN
      v_date := v_date_text::date;
      v_start := v_start_text::time;
      v_end := v_end_text::time;
      v_branch := v_branch_text::uuid;
      v_child := CASE WHEN v_child_text IS NULL THEN NULL ELSE v_child_text::uuid END;
      v_requested_template := CASE WHEN v_template_text IS NULL THEN NULL ELSE v_template_text::uuid END;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
    END;

    IF to_char(v_date, 'YYYY-MM-DD') <> v_date_text OR v_start >= v_end THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
    END IF;

    IF v_branch <> p_booking_branch_id THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
    END IF;

    IF p_learner_type = 'self' AND v_child IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
    END IF;

    IF p_learner_type = 'child' AND v_child IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
    END IF;

    IF p_booking_child_id IS NOT NULL AND v_child IS DISTINCT FROM p_booking_child_id THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
    END IF;

    IF v_child IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.children c
      WHERE c.id = v_child AND c.parent_id = p_user_id
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_UNAUTHORIZED';
    END IF;

    IF (v_date + v_start) <= timezone('Asia/Bangkok', transaction_timestamp()) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
    END IF;

    SELECT st.id
    INTO v_resolved_template
    FROM public.schedule_templates st
    WHERE st.branch_id = v_branch
      AND st.course_type_id = p_course_type_id
      AND st.day_of_week = extract(dow FROM v_date)::integer
      AND st.is_active = true
      AND st.start_time <= v_start
      AND st.end_time >= v_end
      AND (v_requested_template IS NULL OR st.id = v_requested_template)
    ORDER BY st.start_time DESC, st.end_time ASC, st.id ASC
    LIMIT 1;

    IF v_resolved_template IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
    END IF;

    IF v_first_year IS NULL THEN
      v_first_year := extract(year FROM v_date)::integer;
      v_first_month := extract(month FROM v_date)::integer;
    ELSIF v_first_year <> extract(year FROM v_date)::integer
      OR v_first_month <> extract(month FROM v_date)::integer
    THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_MULTI_MONTH_BOOKING';
    END IF;

    v_identity := coalesce(v_child::text, 'self') || '|' || v_date::text || '|'
      || v_start::text || '|' || v_end::text;
    IF v_identity = ANY(v_identities) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_DUPLICATE_SESSION';
    END IF;
    v_identities := array_append(v_identities, v_identity);

    ordinal := v_ordinal;
    session_date := v_date;
    session_start := v_start;
    session_end := v_end;
    branch_id := v_branch;
    child_id := v_child;
    schedule_template_id := v_resolved_template;
    lesson_year := v_first_year;
    lesson_month := v_first_month;
    RETURN NEXT;
  END LOOP;
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
BEGIN
  IF p_expected_scope_revision IS NULL OR p_expected_scope_revision < 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_user_id::text || '|' || p_course_type_id::text || '|' || p_lesson_year::text
      || '|' || p_lesson_month::text || '|THB',
    0
  ));

  SELECT s.*
  INTO v_scope
  FROM public.booking_pricing_scopes s
  WHERE s.user_id = p_user_id
    AND s.course_type_id = p_course_type_id
    AND s.lesson_year = p_lesson_year
    AND s.lesson_month = p_lesson_month
    AND s.currency = 'THB'
  FOR UPDATE;

  IF NOT FOUND THEN
    IF p_expected_scope_revision <> 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_SCOPE_REVISION_CONFLICT';
    END IF;

    INSERT INTO public.booking_pricing_scopes (
      user_id, course_type_id, lesson_year, lesson_month, currency, revision
    ) VALUES (
      p_user_id, p_course_type_id, p_lesson_year, p_lesson_month, 'THB', 1
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

  UPDATE public.booking_pricing_scopes
  SET revision = revision + 1
  WHERE id = v_scope.id
  RETURNING id, revision INTO scope_id, new_revision;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.progressive_lock_booking_slots_v1(
  p_user_id uuid,
  p_course_type_id uuid,
  p_learner_type public.learner_type,
  p_booking_child_id uuid,
  p_booking_branch_id uuid,
  p_sessions jsonb,
  p_exclude_booking_id uuid DEFAULT NULL,
  p_additional_slot_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_capacity_conflict uuid;
  v_invalid_slot uuid;
  v_slot_ids uuid[];
BEGIN
  WITH requested AS (
    SELECT *
    FROM public.progressive_requested_sessions_v1(
      p_user_id, p_course_type_id, p_learner_type, p_booking_child_id,
      p_booking_branch_id, p_sessions
    )
  ), unique_slots AS (
    SELECT DISTINCT branch_id, session_date, session_start, session_end, schedule_template_id
    FROM requested
  )
  INSERT INTO public.schedule_slots (
    template_id, branch_id, course_type_id, date, start_time, end_time,
    max_students, current_students, status
  )
  SELECT
    requested.schedule_template_id,
    requested.branch_id,
    p_course_type_id,
    requested.session_date,
    requested.session_start,
    requested.session_end,
    course.max_students,
    0,
    'open'
  FROM unique_slots requested
  JOIN public.course_types course ON course.id = p_course_type_id
  ORDER BY requested.branch_id, requested.session_date, requested.session_start
  ON CONFLICT (branch_id, course_type_id, date, start_time) DO NOTHING;

  WITH requested AS (
    SELECT *
    FROM public.progressive_requested_sessions_v1(
      p_user_id, p_course_type_id, p_learner_type, p_booking_child_id,
      p_booking_branch_id, p_sessions
    )
  ), slot_ids AS (
    SELECT ss.id
    FROM requested r
    JOIN public.schedule_slots ss
      ON ss.branch_id = r.branch_id
      AND ss.course_type_id = p_course_type_id
      AND ss.date = r.session_date
      AND ss.start_time = r.session_start
    UNION
    SELECT unnest(coalesce(p_additional_slot_ids, ARRAY[]::uuid[]))
  )
  SELECT array_agg(id ORDER BY id)
  INTO v_slot_ids
  FROM slot_ids;

  PERFORM ss.id
  FROM public.schedule_slots ss
  WHERE ss.id = ANY(coalesce(v_slot_ids, ARRAY[]::uuid[]))
  ORDER BY ss.id
  FOR UPDATE;

  SELECT ss.id
  INTO v_invalid_slot
  FROM public.schedule_slots ss
  WHERE ss.id = ANY(coalesce(v_slot_ids, ARRAY[]::uuid[]))
    AND ss.status = 'cancelled'
  ORDER BY ss.id
  LIMIT 1;

  IF v_invalid_slot IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BOOKING_CONFLICT';
  END IF;

  IF EXISTS (
    WITH requested AS (
      SELECT *
      FROM public.progressive_requested_sessions_v1(
        p_user_id, p_course_type_id, p_learner_type, p_booking_child_id,
        p_booking_branch_id, p_sessions
      )
    )
    SELECT 1
    FROM requested r
    JOIN public.booking_sessions bs
      ON bs.date = r.session_date
      AND bs.start_time = r.session_start
      AND bs.end_time = r.session_end
      AND bs.child_id IS NOT DISTINCT FROM r.child_id
      AND bs.cancelled_at IS NULL
      AND bs.status::text IN ('scheduled', 'completed', 'absent')
    JOIN public.bookings b ON b.id = bs.booking_id
    WHERE b.user_id = p_user_id
      AND b.status::text IN ('pending_payment', 'paid', 'verified')
      AND (b.status::text <> 'pending_payment' OR b.expires_at IS NULL OR b.expires_at > transaction_timestamp())
      AND (p_exclude_booking_id IS NULL OR b.id <> p_exclude_booking_id)
    LIMIT 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_DUPLICATE_SESSION';
  END IF;

  WITH requested AS (
    SELECT *
    FROM public.progressive_requested_sessions_v1(
      p_user_id, p_course_type_id, p_learner_type, p_booking_child_id,
      p_booking_branch_id, p_sessions
    )
  ), requested_by_slot AS (
    SELECT ss.id AS slot_id, count(*)::integer AS requested_count
    FROM requested r
    JOIN public.schedule_slots ss
      ON ss.branch_id = r.branch_id
      AND ss.course_type_id = p_course_type_id
      AND ss.date = r.session_date
      AND ss.start_time = r.session_start
    WHERE ss.end_time = r.session_end
    GROUP BY ss.id
  ), existing_by_slot AS (
    SELECT bs.schedule_slot_id AS slot_id, count(*)::integer AS existing_count
    FROM public.booking_sessions bs
    JOIN public.bookings b ON b.id = bs.booking_id
    JOIN requested_by_slot requested ON requested.slot_id = bs.schedule_slot_id
    WHERE bs.cancelled_at IS NULL
      AND bs.status::text IN ('scheduled', 'completed', 'absent')
      AND b.status::text IN ('pending_payment', 'paid', 'verified')
      AND (b.status::text <> 'pending_payment' OR b.expires_at IS NULL OR b.expires_at > transaction_timestamp())
      AND (p_exclude_booking_id IS NULL OR b.id <> p_exclude_booking_id)
    GROUP BY bs.schedule_slot_id
  )
  SELECT ss.id
  INTO v_capacity_conflict
  FROM requested_by_slot requested
  JOIN public.schedule_slots ss ON ss.id = requested.slot_id
  LEFT JOIN existing_by_slot existing ON existing.slot_id = requested.slot_id
  WHERE coalesce(existing.existing_count, 0) + requested.requested_count > ss.max_students
  ORDER BY ss.id
  LIMIT 1;

  IF v_capacity_conflict IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_CAPACITY_EXCEEDED';
  END IF;

  IF EXISTS (
    WITH requested AS (
      SELECT *
      FROM public.progressive_requested_sessions_v1(
        p_user_id, p_course_type_id, p_learner_type, p_booking_child_id,
        p_booking_branch_id, p_sessions
      )
    )
    SELECT 1
    FROM requested r
    JOIN public.schedule_slots ss
      ON ss.branch_id = r.branch_id
      AND ss.course_type_id = p_course_type_id
      AND ss.date = r.session_date
      AND ss.start_time = r.session_start
    WHERE ss.end_time <> r.session_end
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BOOKING_CONFLICT';
  END IF;
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
  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.user_id = p_user_id
      AND b.course_type_id = p_course_type_id
      AND b.status::text IN ('pending_payment', 'paid', 'verified')
      AND (b.status::text <> 'pending_payment' OR b.expires_at IS NULL OR b.expires_at > transaction_timestamp())
      AND b.pricing_scope_id IS DISTINCT FROM p_scope_id
      AND (
        (b.year = p_lesson_year AND b.month = p_lesson_month)
        OR EXISTS (
          SELECT 1
          FROM public.booking_sessions bs
          WHERE bs.booking_id = b.id
            AND extract(year FROM bs.date)::integer = p_lesson_year
            AND extract(month FROM bs.date)::integer = p_lesson_month
        )
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_LEGACY_SCOPE_NOT_READY';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.progressive_refresh_slot_capacity_v1(p_slot_ids uuid[])
RETURNS void
LANGUAGE sql
SET search_path = public, pg_temp
AS $$
  WITH counts AS (
    SELECT
      requested.slot_id,
      count(bs.id) FILTER (
        WHERE bs.cancelled_at IS NULL
          AND bs.status::text IN ('scheduled', 'completed', 'absent')
          AND b.status::text IN ('pending_payment', 'paid', 'verified')
          AND (b.status::text <> 'pending_payment' OR b.expires_at IS NULL OR b.expires_at > transaction_timestamp())
      )::integer AS active_count
    FROM unnest(coalesce(p_slot_ids, ARRAY[]::uuid[])) AS requested(slot_id)
    LEFT JOIN public.booking_sessions bs ON bs.schedule_slot_id = requested.slot_id
    LEFT JOIN public.bookings b ON b.id = bs.booking_id
    GROUP BY requested.slot_id
  )
  UPDATE public.schedule_slots ss
  SET
    current_students = counts.active_count,
    status = CASE
      WHEN ss.status = 'cancelled' THEN ss.status
      WHEN counts.active_count >= ss.max_students THEN 'full'::public.slot_status
      ELSE 'open'::public.slot_status
    END
  FROM counts
  WHERE ss.id = counts.slot_id;
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
      SELECT
        tier.id,
        tier.min_sessions,
        tier.max_sessions,
        tier.price_per_session
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
      v_discount := round(coalesce(v_booking.coupon_discount_snapshot, 0)::numeric, 2);
      v_final := greatest(0, round(v_gross - v_discount, 2));

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
  v_slot_ids uuid[];
  v_result jsonb;
BEGIN
  IF p_user_id IS NULL
    OR p_branch_id IS NULL
    OR p_course_type_id IS NULL
    OR p_client_request_id IS NULL
    OR p_expected_scope_revision IS NULL
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
    'progressive-request|' || p_user_id::text || '|' || p_client_request_id::text,
    0
  ));

  SELECT receipt.*
  INTO v_receipt
  FROM public.progressive_booking_mutation_receipts receipt
  WHERE receipt.user_id = p_user_id
    AND receipt.client_request_id = p_client_request_id;

  IF FOUND THEN
    IF v_receipt.mutation_type <> 'create' OR v_receipt.request_fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN jsonb_set(v_receipt.result, '{idempotentReplay}', 'true'::jsonb, true);
  END IF;

  IF p_coupon_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_COUPON_NOT_READY';
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
  END
  INTO v_booking_child_id
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
    v_booking_id,
    slot.id,
    requested.session_date,
    requested.session_start,
    requested.session_end,
    requested.branch_id,
    requested.child_id,
    'scheduled',
    false
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
  INTO v_slot_ids
  FROM public.booking_sessions bs
  WHERE bs.booking_id = v_booking_id;

  v_changed := public.progressive_reprice_scope_v1(
    v_scope_id, v_revision, transaction_timestamp(), v_booking_id
  );

  SELECT b.total_price
  INTO v_final
  FROM public.bookings b
  WHERE b.id = v_booking_id;

  PERFORM public.progressive_refresh_slot_capacity_v1(v_slot_ids);

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    p_user_id,
    'create_progressive_booking',
    'booking',
    v_booking_id,
    jsonb_build_object(
      'scopeId', v_scope_id,
      'scopeRevision', v_revision,
      'entitlementSessions', v_session_count,
      'totalPrice', v_final,
      'expiresAt', v_expires_at
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
BEGIN
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
  v_result jsonb;
BEGIN
  IF p_user_id IS NULL
    OR p_booking_id IS NULL
    OR p_client_request_id IS NULL
    OR p_expected_scope_revision IS NULL
    OR p_expected_scope_revision < 1
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  v_fingerprint := md5(concat_ws('|',
    'cancel', p_user_id::text, p_booking_id::text, p_expected_scope_revision::text
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
    IF v_receipt.mutation_type <> 'cancel'
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
    SELECT 1
    FROM public.attendance attendance
    JOIN public.booking_sessions bs ON bs.id = attendance.booking_session_id
    WHERE bs.booking_id = p_booking_id
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
  ) OR EXISTS (
    SELECT 1
    FROM public.booking_sessions later_session
    JOIN public.booking_sessions original_session
      ON original_session.id = later_session.rescheduled_from_id
    WHERE original_session.booking_id = p_booking_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BOOKING_CONFLICT';
  END IF;

  SELECT array_agg(DISTINCT bs.schedule_slot_id ORDER BY bs.schedule_slot_id)
  INTO v_slot_ids
  FROM public.booking_sessions bs
  WHERE bs.booking_id = p_booking_id;

  PERFORM ss.id
  FROM public.schedule_slots ss
  WHERE ss.id = ANY(coalesce(v_slot_ids, ARRAY[]::uuid[]))
  ORDER BY ss.id
  FOR UPDATE;

  UPDATE public.booking_sessions
  SET cancelled_at = transaction_timestamp()
  WHERE booking_id = p_booking_id
    AND status::text = 'scheduled'
    AND cancelled_at IS NULL;

  UPDATE public.bookings
  SET status = 'cancelled'
  WHERE id = p_booking_id;

  v_changed := public.progressive_reprice_scope_v1(
    v_scope_id, v_revision, v_booking.created_at, p_booking_id
  );

  PERFORM public.progressive_refresh_slot_capacity_v1(v_slot_ids);

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    p_user_id,
    'cancel_progressive_pending_booking',
    'booking',
    p_booking_id,
    jsonb_build_object(
      'scopeId', v_scope_id,
      'scopeRevision', v_revision,
      'cancelledAt', transaction_timestamp(),
      'softCancelledSessions', true
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

CREATE OR REPLACE FUNCTION public.progressive_pricing_writes_capability_v1()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'ready',
      to_regprocedure('public.create_progressive_booking_v1(uuid,learner_type,uuid,uuid,uuid,jsonb,uuid,uuid,bigint)') IS NOT NULL
      AND to_regprocedure('public.update_progressive_pending_booking_v1(uuid,uuid,uuid,jsonb,uuid,bigint)') IS NOT NULL
      AND to_regprocedure('public.cancel_progressive_pending_booking_v1(uuid,uuid,uuid,bigint)') IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'client_request_id'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'booking_sessions' AND column_name = 'cancelled_at'
      ),
    'version', 1
  );
$$;

REVOKE ALL ON FUNCTION public.progressive_requested_sessions_v1(uuid, uuid, public.learner_type, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progressive_acquire_scope_v1(uuid, uuid, integer, integer, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progressive_lock_booking_slots_v1(uuid, uuid, public.learner_type, uuid, uuid, jsonb, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progressive_assert_scope_membership_v1(uuid, uuid, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progressive_refresh_slot_capacity_v1(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progressive_reprice_scope_v1(uuid, bigint, timestamptz, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_progressive_booking_v1(uuid, public.learner_type, uuid, uuid, uuid, jsonb, uuid, uuid, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_progressive_pending_booking_v1(uuid, uuid, uuid, jsonb, uuid, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_progressive_pending_booking_v1(uuid, uuid, uuid, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progressive_pricing_writes_capability_v1() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_progressive_booking_v1(uuid, public.learner_type, uuid, uuid, uuid, jsonb, uuid, uuid, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_progressive_pending_booking_v1(uuid, uuid, uuid, jsonb, uuid, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_progressive_pending_booking_v1(uuid, uuid, uuid, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.progressive_pricing_writes_capability_v1() TO service_role;
