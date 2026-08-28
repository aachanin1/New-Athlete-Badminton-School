-- Permanent schedule-slot/template provenance protection.
-- This migration intentionally performs no historical slot backfill and contains
-- no customer-specific identifiers.

DO $constraint$
DECLARE
  v_constraint_name text;
  v_constraint_count integer;
BEGIN
  SELECT min(constraint_row.conname), count(*)
  INTO v_constraint_name, v_constraint_count
  FROM pg_catalog.pg_constraint constraint_row
  WHERE constraint_row.conrelid = 'public.schedule_slots'::regclass
    AND constraint_row.confrelid = 'public.schedule_templates'::regclass
    AND constraint_row.contype = 'f'
    AND constraint_row.conkey = ARRAY[
      (
        SELECT attribute.attnum
        FROM pg_catalog.pg_attribute attribute
        WHERE attribute.attrelid = 'public.schedule_slots'::regclass
          AND attribute.attname = 'template_id'
          AND NOT attribute.attisdropped
      )
    ]::smallint[];

  IF v_constraint_count <> 1 OR v_constraint_name IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'SCHEDULE_SLOT_TEMPLATE_FK_NOT_UNIQUE';
  END IF;

  EXECUTE format(
    'ALTER TABLE public.schedule_slots DROP CONSTRAINT %I',
    v_constraint_name
  );
  EXECUTE format(
    'ALTER TABLE public.schedule_slots ADD CONSTRAINT %I FOREIGN KEY (template_id) REFERENCES public.schedule_templates(id) ON DELETE RESTRICT',
    v_constraint_name
  );
END
$constraint$;

CREATE OR REPLACE FUNCTION public.lesson_wallet_redeem_v2(
  p_user_id uuid,
  p_credit_id uuid,
  p_target_date date,
  p_start_time time,
  p_end_time time,
  p_branch_id uuid,
  p_schedule_template_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_credit record;
  v_template record;
  v_schedule_slot record;
  v_course_max_students integer;
  v_participant_count integer;
  v_inserted_count integer;
  v_representative_new_session_id uuid;
  v_active_template_match_count integer;
BEGIN
  SELECT credit.*, course.name::text AS course_name
  INTO v_credit
  FROM public.lesson_wallet_credits credit
  JOIN public.course_types course ON course.id = credit.course_type_id
  WHERE credit.id = p_credit_id
  FOR UPDATE OF credit;

  IF v_credit.id IS NULL OR v_credit.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_CREDIT_NOT_FOUND';
  END IF;
  IF v_credit.status <> 'active' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_CREDIT_STALE';
  END IF;
  IF v_credit.expires_at < transaction_timestamp() THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_ENTITLEMENT_EXPIRED';
  END IF;
  IF p_start_time >= p_end_time THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_TEMPLATE_NOT_FOUND';
  END IF;

  IF coalesce(v_credit.entitlement_policy, 'same_month') = 'same_month'
    AND date_trunc('month', p_target_date::timestamp) <> date_trunc('month', v_credit.original_date::timestamp)
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_SAME_MONTH_REQUIRED';
  END IF;

  IF make_timestamptz(
    extract(year FROM p_target_date)::integer,
    extract(month FROM p_target_date)::integer,
    extract(day FROM p_target_date)::integer,
    extract(hour FROM p_start_time)::integer,
    extract(minute FROM p_start_time)::integer,
    extract(second FROM p_start_time),
    'Asia/Bangkok'
  ) <= transaction_timestamp() THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_TARGET_STARTED';
  END IF;

  IF make_timestamptz(
    extract(year FROM p_target_date)::integer,
    extract(month FROM p_target_date)::integer,
    extract(day FROM p_target_date)::integer,
    extract(hour FROM p_start_time)::integer,
    extract(minute FROM p_start_time)::integer,
    extract(second FROM p_start_time),
    'Asia/Bangkok'
  ) > v_credit.expires_at THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_TARGET_AFTER_EXPIRY';
  END IF;

  SELECT template.id, template.branch_id, template.course_type_id,
    template.start_time, template.end_time, template.day_of_week, template.is_active
  INTO v_template
  FROM public.schedule_templates template
  WHERE template.id = p_schedule_template_id
    AND template.branch_id = p_branch_id
    AND template.course_type_id = v_credit.course_type_id
    AND template.day_of_week = extract(dow FROM p_target_date)::integer
    AND template.start_time = p_start_time
    AND template.end_time = p_end_time
    AND template.is_active = true;

  IF v_template.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_TEMPLATE_NOT_FOUND';
  END IF;

  SELECT count(*)
  INTO v_active_template_match_count
  FROM public.schedule_templates template
  WHERE template.branch_id = p_branch_id
    AND template.course_type_id = v_credit.course_type_id
    AND template.day_of_week = extract(dow FROM p_target_date)::integer
    AND template.start_time = p_start_time
    AND template.end_time = p_end_time
    AND template.is_active = true;

  IF v_active_template_match_count <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_TEMPLATE_AMBIGUOUS';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    concat_ws('|', p_branch_id, v_credit.course_type_id, p_target_date, p_start_time),
    0
  ));

  SELECT max_students INTO v_course_max_students
  FROM public.course_types
  WHERE id = v_credit.course_type_id;

  INSERT INTO public.schedule_slots (
    template_id, branch_id, course_type_id, date, start_time, end_time,
    max_students, current_students, status
  )
  VALUES (
    p_schedule_template_id, p_branch_id, v_credit.course_type_id, p_target_date,
    p_start_time, p_end_time, v_course_max_students, 0, 'open'
  )
  ON CONFLICT (branch_id, course_type_id, date, start_time) DO NOTHING;

  SELECT slot_row.* INTO v_schedule_slot
  FROM public.schedule_slots slot_row
  WHERE slot_row.branch_id = p_branch_id
    AND slot_row.course_type_id = v_credit.course_type_id
    AND slot_row.date = p_target_date
    AND slot_row.start_time = p_start_time
  FOR UPDATE;

  IF v_schedule_slot.id IS NOT NULL AND v_schedule_slot.template_id IS NULL THEN
    UPDATE public.schedule_slots slot_row
    SET template_id = p_schedule_template_id
    WHERE slot_row.id = v_schedule_slot.id
      AND slot_row.template_id IS NULL;

    SELECT slot_row.* INTO v_schedule_slot
    FROM public.schedule_slots slot_row
    WHERE slot_row.id = v_schedule_slot.id
    FOR UPDATE;
  END IF;

  IF v_schedule_slot.id IS NULL
    OR v_schedule_slot.template_id IS DISTINCT FROM p_schedule_template_id
    OR v_schedule_slot.end_time IS DISTINCT FROM p_end_time
    OR v_schedule_slot.status::text NOT IN ('open', 'full')
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_TARGET_UNAVAILABLE';
  END IF;

  CREATE TEMP TABLE wallet_redeem_members ON COMMIT DROP AS
  SELECT
    membership.original_session_id,
    membership.child_id
  FROM public.lesson_wallet_credit_members membership
  WHERE membership.credit_id = v_credit.id
  ORDER BY membership.original_session_id;

  GET DIAGNOSTICS v_participant_count = ROW_COUNT;
  IF v_participant_count = 0 THEN
    INSERT INTO wallet_redeem_members (original_session_id, child_id)
    VALUES (v_credit.original_session_id, v_credit.child_id);
    v_participant_count := 1;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM wallet_redeem_members member
    JOIN public.booking_sessions existing_session
      ON existing_session.date = p_target_date
      AND existing_session.start_time < p_end_time
      AND existing_session.end_time > p_start_time
      AND existing_session.child_id IS NOT DISTINCT FROM member.child_id
      AND existing_session.cancelled_at IS NULL
      AND existing_session.status::text IN ('scheduled', 'completed', 'absent')
    JOIN public.bookings existing_booking ON existing_booking.id = existing_session.booking_id
    WHERE existing_booking.user_id = p_user_id
      AND existing_booking.status::text IN ('pending_payment', 'paid', 'verified')
      AND (
        existing_booking.status::text <> 'pending_payment'
        OR existing_booking.expires_at IS NULL
        OR existing_booking.expires_at > transaction_timestamp()
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_TARGET_CONFLICT';
  END IF;

  CREATE TEMP TABLE wallet_inserted_sessions (
    id uuid PRIMARY KEY,
    original_session_id uuid NOT NULL UNIQUE
  ) ON COMMIT DROP;

  WITH inserted AS (
    INSERT INTO public.booking_sessions (
      booking_id,
      schedule_slot_id,
      date,
      start_time,
      end_time,
      branch_id,
      child_id,
      status,
      rescheduled_from_id,
      is_makeup
    )
    SELECT
      v_credit.booking_id,
      v_schedule_slot.id,
      p_target_date,
      p_start_time,
      p_end_time,
      p_branch_id,
      member.child_id,
      'scheduled',
      member.original_session_id,
      false
    FROM wallet_redeem_members member
    ORDER BY member.original_session_id
    RETURNING id, rescheduled_from_id
  )
  INSERT INTO wallet_inserted_sessions (id, original_session_id)
  SELECT id, rescheduled_from_id
  FROM inserted;

  SELECT count(*), (array_agg(id ORDER BY id))[1] INTO v_inserted_count, v_representative_new_session_id
  FROM wallet_inserted_sessions;
  IF v_inserted_count <> v_participant_count THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_PARTICIPANT_MOVE_INCOMPLETE';
  END IF;

  UPDATE public.lesson_wallet_credit_members membership
  SET
    redeemed_session_id = inserted.id,
    redeemed_at = transaction_timestamp()
  FROM wallet_inserted_sessions inserted
  WHERE membership.credit_id = v_credit.id
    AND membership.original_session_id = inserted.original_session_id;

  UPDATE public.lesson_wallet_credits
  SET
    status = 'redeemed',
    redeemed_session_id = v_representative_new_session_id,
    redeemed_at = transaction_timestamp()
  WHERE id = v_credit.id
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_CREDIT_STALE';
  END IF;

  PERFORM public.progressive_refresh_slot_capacity_v1(ARRAY[v_schedule_slot.id]);

  RETURN jsonb_build_object(
    'credit_id', v_credit.id,
    'schedule_slot_id', v_schedule_slot.id,
    'participant_count', v_participant_count,
    'session_ids', (
      SELECT jsonb_agg(inserted.id ORDER BY inserted.original_session_id)
      FROM wallet_inserted_sessions inserted
    ),
    'representative_session_id', v_representative_new_session_id,
    'original_date', v_credit.original_date,
    'original_start_time', v_credit.original_start_time,
    'original_end_time', v_credit.original_end_time,
    'target_date', p_target_date,
    'target_start_time', p_start_time,
    'target_end_time', p_end_time,
    'branch_id', p_branch_id
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_TARGET_CONFLICT';
END;
$$;

REVOKE ALL ON FUNCTION public.lesson_wallet_store_v2(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lesson_wallet_redeem_v2(uuid, uuid, date, time, time, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lesson_wallet_store_v2(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.lesson_wallet_redeem_v2(uuid, uuid, date, time, time, uuid, uuid) TO service_role;
