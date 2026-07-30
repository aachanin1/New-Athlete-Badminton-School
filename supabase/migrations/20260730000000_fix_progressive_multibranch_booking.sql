-- Allow one Progressive Kids Group booking to contain canonical sessions from
-- multiple branches. bookings.branch_id remains the caller-supplied primary
-- branch; every booking_sessions row retains its own validated branch and slot.
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
