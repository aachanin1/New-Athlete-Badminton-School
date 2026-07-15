-- Normal teaching rounds have no fixed learner-capacity ceiling. Occupancy remains
-- informational; canonical slot, lifecycle, duplicate, overlap and locking guards remain.

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
    FROM requested earlier
    JOIN requested later
      ON earlier.ordinal < later.ordinal
      AND earlier.child_id IS NOT DISTINCT FROM later.child_id
      AND earlier.session_date = later.session_date
      AND earlier.session_start < later.session_end
      AND earlier.session_end > later.session_start
    LIMIT 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_DUPLICATE_SESSION';
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
      AND bs.start_time < r.session_end
      AND bs.end_time > r.session_start
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
      ELSE 'open'::public.slot_status
    END
  FROM counts
  WHERE ss.id = counts.slot_id;
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
    'legacyBaselineContract', 'immutable_scope_v1',
    'slotEntryPolicy', 'unlimited_learner_v1'
  );
$$;

REVOKE ALL ON FUNCTION public.progressive_lock_booking_slots_v1(
  uuid, uuid, public.learner_type, uuid, uuid, jsonb, uuid, uuid[]
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progressive_refresh_slot_capacity_v1(uuid[])
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progressive_pricing_writes_capability_v1()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.progressive_pricing_writes_capability_v1()
  TO service_role;
