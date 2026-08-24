CREATE OR REPLACE FUNCTION public.lesson_wallet_store_v2(
  p_user_id uuid,
  p_session_id uuid,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_selected record;
  v_unit_type text;
  v_representative_session_id uuid;
  v_participant_count integer;
  v_payment_count integer;
  v_payment_id uuid;
  v_verified_at timestamptz;
  v_tier_count integer;
  v_tier record;
  v_tier_id uuid;
  v_prior_credit_count integer;
  v_prior_mapped_count integer;
  v_prior_credit record;
  v_policy text;
  v_started_at timestamptz;
  v_expires_at timestamptz;
  v_evidence jsonb;
  v_root_credit_id uuid;
  v_credit_id uuid;
  v_assigned_coach_ids uuid[];
  v_removed_membership_ids uuid[] := ARRAY[]::uuid[];
  v_retirement jsonb;
  v_member record;
BEGIN
  SELECT
    session_item.id,
    session_item.booking_id,
    session_item.schedule_slot_id,
    session_item.date,
    session_item.start_time,
    session_item.end_time,
    session_item.branch_id,
    session_item.child_id,
    session_item.status::text AS session_status,
    session_item.is_makeup,
    session_item.cancelled_at,
    booking.user_id,
    booking.course_type_id,
    booking.total_sessions,
    booking.status::text AS booking_status,
    course.name::text AS course_name
  INTO v_selected
  FROM public.booking_sessions session_item
  JOIN public.bookings booking ON booking.id = session_item.booking_id
  JOIN public.course_types course ON course.id = booking.course_type_id
  WHERE session_item.id = p_session_id
  FOR UPDATE OF session_item, booking;

  IF v_selected.id IS NULL OR v_selected.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_SESSION_NOT_FOUND';
  END IF;

  IF v_selected.schedule_slot_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_SOURCE_SLOT_INVALID';
  END IF;

  v_unit_type := CASE WHEN v_selected.course_name = 'private' THEN 'family_private' ELSE 'single' END;

  CREATE TEMP TABLE wallet_store_members ON COMMIT DROP AS
  SELECT
    session_item.id,
    session_item.child_id,
    session_item.schedule_slot_id,
    session_item.date,
    session_item.start_time,
    session_item.end_time,
    session_item.branch_id,
    session_item.status::text AS status,
    session_item.is_makeup,
    session_item.cancelled_at
  FROM public.booking_sessions session_item
  WHERE session_item.booking_id = v_selected.booking_id
    AND (
      v_unit_type = 'single'
      AND session_item.id = p_session_id
      OR
      v_unit_type = 'family_private'
      AND session_item.date = v_selected.date
      AND session_item.start_time = v_selected.start_time
      AND session_item.end_time = v_selected.end_time
      AND session_item.branch_id = v_selected.branch_id
      AND session_item.schedule_slot_id = v_selected.schedule_slot_id
    )
  ORDER BY session_item.id
  FOR UPDATE;

  SELECT count(*), (array_agg(id ORDER BY id))[1] INTO v_participant_count, v_representative_session_id
  FROM wallet_store_members;

  IF v_participant_count < 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_UNIT_EMPTY';
  END IF;

  IF v_selected.booking_status <> 'verified' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_BOOKING_NOT_VERIFIED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM wallet_store_members member
    LEFT JOIN public.schedule_slots slot_row ON slot_row.id = member.schedule_slot_id
    WHERE member.status <> 'scheduled'
      OR member.is_makeup
      OR member.cancelled_at IS NOT NULL
      OR member.schedule_slot_id IS NULL
      OR slot_row.id IS NULL
      OR slot_row.status::text = 'cancelled'
      OR slot_row.branch_id <> member.branch_id
      OR slot_row.course_type_id <> v_selected.course_type_id
      OR slot_row.date <> member.date
      OR slot_row.start_time <> member.start_time
      OR slot_row.end_time <> member.end_time
      OR make_timestamptz(
        extract(year FROM member.date)::integer,
        extract(month FROM member.date)::integer,
        extract(day FROM member.date)::integer,
        extract(hour FROM member.start_time)::integer,
        extract(minute FROM member.start_time)::integer,
        extract(second FROM member.start_time),
        'Asia/Bangkok'
      ) <= transaction_timestamp() + interval '48 hours'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_UNIT_NOT_STORABLE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM wallet_store_members member
    JOIN public.attendance attendance_row ON attendance_row.booking_session_id = member.id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_ATTENDANCE_EXISTS';
  END IF;

  SELECT
    count(DISTINCT prior.credit_id),
    count(prior.credit_id)
  INTO v_prior_credit_count, v_prior_mapped_count
  FROM wallet_store_members member
  LEFT JOIN LATERAL (
    SELECT credit.id AS credit_id
    FROM public.lesson_wallet_credits credit
    WHERE credit.redeemed_session_id = member.id
    UNION
    SELECT membership.credit_id
    FROM public.lesson_wallet_credit_members membership
    WHERE membership.redeemed_session_id = member.id
  ) prior ON true;

  IF v_prior_credit_count > 1 OR (v_prior_credit_count = 1 AND v_prior_mapped_count <> v_participant_count) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_REWALLET_CHAIN_AMBIGUOUS';
  END IF;

  IF v_prior_credit_count = 1 THEN
    SELECT credit.* INTO v_prior_credit
    FROM public.lesson_wallet_credits credit
    WHERE credit.id = (
      SELECT prior.credit_id
      FROM wallet_store_members member
      CROSS JOIN LATERAL (
        SELECT credit.id AS credit_id
        FROM public.lesson_wallet_credits credit
        WHERE credit.redeemed_session_id = member.id
        UNION
        SELECT membership.credit_id
        FROM public.lesson_wallet_credit_members membership
        WHERE membership.redeemed_session_id = member.id
      ) prior
      LIMIT 1
    )
    FOR UPDATE;

    IF v_prior_credit.status <> 'redeemed' OR v_prior_credit.expires_at < transaction_timestamp() THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_ENTITLEMENT_EXPIRED';
    END IF;

    v_policy := coalesce(v_prior_credit.entitlement_policy, 'same_month');
    v_started_at := v_prior_credit.entitlement_started_at;
    v_expires_at := v_prior_credit.expires_at;
    v_payment_id := v_prior_credit.entitlement_payment_id;
    v_tier_id := v_prior_credit.entitlement_pricing_tier_id;
    v_evidence := v_prior_credit.entitlement_evidence;
    v_root_credit_id := coalesce(v_prior_credit.root_credit_id, v_prior_credit.id);
  ELSE
    SELECT count(*), (array_agg(payment.id ORDER BY payment.id))[1], min(payment.verified_at)
    INTO v_payment_count, v_payment_id, v_verified_at
    FROM public.payments payment
    WHERE payment.booking_id = v_selected.booking_id
      AND payment.user_id = p_user_id
      AND payment.status::text = 'approved';

    IF v_payment_count = 0 OR v_verified_at IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_PAYMENT_EVIDENCE_MISSING';
    END IF;
    IF v_payment_count <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_PAYMENT_EVIDENCE_AMBIGUOUS';
    END IF;

    SELECT count(*) INTO v_tier_count
    FROM public.pricing_tiers tier
    WHERE tier.course_type_id = v_selected.course_type_id
      AND tier.min_sessions <= v_selected.total_sessions
      AND (tier.max_sessions IS NULL OR v_selected.total_sessions <= tier.max_sessions)
      AND tier.valid_from <= timezone('Asia/Bangkok', v_verified_at)::date
      AND (tier.valid_to IS NULL OR tier.valid_to >= timezone('Asia/Bangkok', v_verified_at)::date);

    IF v_tier_count = 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_TIER_EVIDENCE_MISSING';
    END IF;
    IF v_tier_count <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_TIER_EVIDENCE_AMBIGUOUS';
    END IF;

    SELECT tier.* INTO v_tier
    FROM public.pricing_tiers tier
    WHERE tier.course_type_id = v_selected.course_type_id
      AND tier.min_sessions <= v_selected.total_sessions
      AND (tier.max_sessions IS NULL OR v_selected.total_sessions <= tier.max_sessions)
      AND tier.valid_from <= timezone('Asia/Bangkok', v_verified_at)::date
      AND (tier.valid_to IS NULL OR tier.valid_to >= timezone('Asia/Bangkok', v_verified_at)::date);
    v_tier_id := v_tier.id;

    v_policy := CASE
      WHEN v_selected.course_name IN ('adult_group', 'private') AND v_selected.total_sessions > 1
        THEN 'ten_month_package'
      ELSE 'same_month'
    END;
    v_started_at := v_verified_at;
    v_expires_at := CASE
      WHEN v_policy = 'ten_month_package' THEN
        (date_trunc('month', timezone('Asia/Bangkok', v_verified_at)) + interval '10 months')
          AT TIME ZONE 'Asia/Bangkok' - interval '1 millisecond'
      ELSE
        (date_trunc('month', v_selected.date::timestamp) + interval '1 month')
          AT TIME ZONE 'Asia/Bangkok' - interval '1 millisecond'
    END;
    v_evidence := jsonb_build_object(
      'policy_type', v_policy,
      'payment_id', v_payment_id,
      'payment_verified_at', v_verified_at,
      'pricing_tier_id', v_tier.id,
      'pricing_tier_min', v_tier.min_sessions,
      'pricing_tier_max', v_tier.max_sessions,
      'pricing_unit', CASE WHEN v_selected.course_name = 'private' THEN 'hour' ELSE 'session' END,
      'price_per_unit', v_tier.price_per_session,
      'package_price', v_tier.package_price,
      'tier_valid_from', v_tier.valid_from,
      'tier_valid_to', v_tier.valid_to,
      'expires_at', v_expires_at
    );
  END IF;

  SELECT array_agg(DISTINCT group_row.coach_id) FILTER (WHERE group_row.coach_id IS NOT NULL)
  INTO v_assigned_coach_ids
  FROM public.coach_assignment_group_students membership
  JOIN public.coach_assignment_groups group_row ON group_row.id = membership.group_id
  JOIN wallet_store_members member ON member.id = membership.booking_session_id;

  INSERT INTO public.lesson_wallet_credits (
    user_id,
    booking_id,
    original_session_id,
    child_id,
    branch_id,
    course_type_id,
    original_schedule_slot_id,
    original_date,
    original_start_time,
    original_end_time,
    status,
    expires_at,
    notes,
    entitlement_unit_type,
    entitlement_policy,
    entitlement_started_at,
    entitlement_payment_id,
    entitlement_pricing_tier_id,
    entitlement_evidence,
    root_credit_id,
    participant_count
  )
  SELECT
    p_user_id,
    v_selected.booking_id,
    representative.id,
    representative.child_id,
    representative.branch_id,
    v_selected.course_type_id,
    representative.schedule_slot_id,
    representative.date,
    representative.start_time,
    representative.end_time,
    'active',
    v_expires_at,
    'Stored atomically by lesson_wallet_store_v2',
    v_unit_type,
    v_policy,
    v_started_at,
    v_payment_id,
    v_tier_id,
    v_evidence,
    v_root_credit_id,
    v_participant_count
  FROM wallet_store_members representative
  WHERE representative.id = v_representative_session_id
  RETURNING id INTO v_credit_id;

  INSERT INTO public.lesson_wallet_credit_members (
    credit_id,
    original_session_id,
    child_id,
    original_schedule_slot_id,
    original_date,
    original_start_time,
    original_end_time,
    branch_id
  )
  SELECT
    v_credit_id,
    member.id,
    member.child_id,
    member.schedule_slot_id,
    member.date,
    member.start_time,
    member.end_time,
    member.branch_id
  FROM wallet_store_members member;

  UPDATE public.booking_sessions session_item
  SET status = 'walleted'
  FROM wallet_store_members member
  WHERE session_item.id = member.id;

  FOR v_member IN SELECT id FROM wallet_store_members ORDER BY id LOOP
    SELECT public.retire_coach_assignment_membership_v1(
      v_member.id,
      p_actor_id,
      'wallet_store'
    ) INTO v_retirement;
    v_removed_membership_ids := v_removed_membership_ids || coalesce(
      ARRAY(SELECT jsonb_array_elements_text(coalesce(v_retirement->'removed_membership_ids', '[]'::jsonb))::uuid),
      ARRAY[]::uuid[]
    );
  END LOOP;

  PERFORM public.progressive_refresh_slot_capacity_v1(ARRAY[v_selected.schedule_slot_id]);

  RETURN jsonb_build_object(
    'credit_id', v_credit_id,
    'unit_type', v_unit_type,
    'policy_type', v_policy,
    'entitlement_started_at', v_started_at,
    'expires_at', v_expires_at,
    'participant_count', v_participant_count,
    'original_schedule_slot_id', v_selected.schedule_slot_id,
    'original_date', v_selected.date,
    'original_start_time', v_selected.start_time,
    'original_end_time', v_selected.end_time,
    'branch_id', v_selected.branch_id,
    'assigned_coach_ids', coalesce(to_jsonb(v_assigned_coach_ids), '[]'::jsonb),
    'removed_membership_ids', coalesce(to_jsonb(v_removed_membership_ids), '[]'::jsonb),
    'participant_session_ids', (
      SELECT coalesce(jsonb_agg(member.id ORDER BY member.id), '[]'::jsonb)
      FROM wallet_store_members member
    )
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_UNIT_STALE';
END;
$$;

REVOKE ALL ON FUNCTION public.lesson_wallet_store_v2(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lesson_wallet_store_v2(uuid, uuid, uuid) TO service_role;
