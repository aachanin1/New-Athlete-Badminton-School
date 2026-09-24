-- Preserve valid redeemed Wallet history; reject duplicate roots only among eligible sources.
-- Existing canonical structure, identity, transition, quota and spent-source guards are unchanged.
BEGIN;

CREATE OR REPLACE FUNCTION public.task10_family_makeup_state_v1(p_actor_id uuid,p_parent_id uuid,p_source_month date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_policy public.task10_policy_activation%ROWTYPE; v_setting jsonb; v_source jsonb; v_destination jsonb;
  v_sources jsonb:='[]'; v_children jsonb; v_used integer; v_quota integer; v_remaining integer;
  v_month date:=date_trunc('month',p_source_month)::date; v_next date; v_end timestamptz; v_now timestamptz;
  s record; v_root uuid; v_roots uuid[]:='{}'; v_credit public.lesson_wallet_credits%ROWTYPE; v_kind text; v_credit_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  PERFORM pg_advisory_xact_lock_shared(10,2);
  PERFORM public.task10_require_actor_v1(p_actor_id,'makeup');
  IF p_parent_id IS NULL OR p_source_month IS NULL OR p_source_month<>v_month THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
  SELECT * INTO v_policy FROM public.task10_policy_activation WHERE singleton;
  IF v_policy.effective_at IS NULL THEN RETURN jsonb_build_object('active',false,'state',v_policy.state); END IF;
  v_next:=(v_month+interval '1 month')::date;
  PERFORM public.task10_lock_family_months_v1(p_parent_id,ARRAY[v_month,v_next]);
  v_now:=public.task10_clock_v1(); v_end:=(v_month+interval '2 month') AT TIME ZONE 'Asia/Bangkok';
  v_setting:=public.task10_read_makeup_setting_v1(p_actor_id);
  v_source:=public.task10_verified_purchase_v1(p_parent_id,v_month);
  v_destination:=public.task10_verified_purchase_v1(p_parent_id,v_next);
  v_quota:=least(5,floor((v_source->>'quantity')::numeric/4)::integer);
  SELECT count(DISTINCT root.id) INTO v_used FROM public.booking_sessions makeup
    JOIN public.bookings b ON b.id=makeup.booking_id JOIN public.course_types c ON c.id=b.course_type_id
    JOIN public.booking_sessions root ON root.id=public.task10_source_root_v1(makeup.id)
    WHERE b.user_id=p_parent_id AND c.name::text='kids_group' AND makeup.is_makeup
      AND root.date>=v_month AND root.date<v_next;
  v_remaining:=greatest(0,v_quota-v_used);
  FOR s IN SELECT bs.*,b.user_id,b.status::text AS booking_status FROM public.booking_sessions bs
    JOIN public.bookings b ON b.id=bs.booking_id JOIN public.course_types c ON c.id=b.course_type_id
    WHERE b.user_id=p_parent_id AND c.name::text='kids_group' AND b.status::text='verified'
      AND NOT bs.is_makeup AND bs.child_id IS NOT NULL AND bs.cancelled_at IS NULL
      AND bs.status::text IN ('absent','walleted') ORDER BY bs.id LOOP
    v_root:=public.task10_source_root_v1(s.id);
    IF NOT EXISTS(SELECT 1 FROM public.booking_sessions r WHERE r.id=v_root AND r.date>=v_month AND r.date<v_next) THEN CONTINUE; END IF;
    IF EXISTS(SELECT 1 FROM public.booking_sessions m WHERE m.booking_id=s.booking_id AND m.is_makeup
      AND public.task10_source_root_v1(m.id)=v_root) THEN CONTINUE; END IF;
    IF EXISTS(SELECT 1 FROM public.booking_sessions d WHERE d.booking_id=s.booking_id AND d.id<>s.id
      AND d.status::text NOT IN ('rescheduled','cancelled','walleted','absent') AND d.cancelled_at IS NULL
      AND public.task10_source_root_v1(d.id)=v_root) THEN CONTINUE; END IF;
    v_kind:=NULL; v_credit:=NULL;
    IF s.status::text='absent' THEN
      IF EXISTS(SELECT 1 FROM public.attendance a WHERE a.booking_session_id=s.id AND a.student_id=s.child_id AND a.status::text='absent')
        AND NOT EXISTS(SELECT 1 FROM public.attendance a WHERE a.booking_session_id=s.id AND a.student_id=s.child_id AND a.status::text IN ('present','late')) THEN v_kind:='absent'; END IF;
    ELSE
      SELECT count(*) INTO v_credit_count FROM public.lesson_wallet_credits w WHERE w.original_session_id=s.id
        AND w.user_id=p_parent_id AND w.booking_id=s.booking_id AND w.child_id=s.child_id
        AND w.status IN ('active','expired') AND w.redeemed_session_id IS NULL;
      IF v_credit_count>1 THEN RAISE EXCEPTION 'TASK10_AMBIGUOUS_SOURCE'; END IF;
      SELECT * INTO v_credit FROM public.lesson_wallet_credits w WHERE w.original_session_id=s.id AND w.user_id=p_parent_id
        AND w.booking_id=s.booking_id AND w.child_id=s.child_id AND w.status IN ('active','expired') AND w.redeemed_session_id IS NULL
        AND ((w.stored_at>=v_policy.effective_at AND w.expires_at>=w.stored_at)
          OR EXISTS(SELECT 1 FROM public.task10_wallet_transition_evidence t WHERE t.credit_id=w.id AND t.source_root_id=v_root))
        ORDER BY w.stored_at DESC LIMIT 1;
      IF FOUND AND NOT EXISTS(SELECT 1 FROM public.attendance a WHERE a.booking_session_id=s.id AND a.student_id=s.child_id) THEN v_kind:='wallet'; END IF;
    END IF;
    IF v_kind IS NOT NULL THEN
      IF v_root=ANY(v_roots) THEN RAISE EXCEPTION 'TASK10_AMBIGUOUS_SOURCE'; END IF;
      v_roots:=array_append(v_roots,v_root);
      v_sources:=v_sources||jsonb_build_array(jsonb_build_object('sourceSessionId',s.id,'rootId',v_root,'bookingId',s.booking_id,
        'sourceChildId',s.child_id,'sourceDate',s.date,'kind',v_kind,'creditId',v_credit.id));
    END IF;
  END LOOP;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',full_name) ORDER BY full_name,id),'[]') INTO v_children FROM public.children WHERE parent_id=p_parent_id;
  RETURN jsonb_build_object('active',v_policy.makeup_enabled,'state',v_policy.state,'parentId',p_parent_id,
    'sourceMonth',to_char(v_month,'YYYY-MM'),'destinationMonth',to_char(v_next,'YYYY-MM'),'expiresAt',v_end,
    'sourcePurchase',v_source,'destinationPurchase',v_destination,'minimum',v_setting,'quota',v_quota,'used',v_used,'remaining',v_remaining,
    'sources',v_sources,'children',v_children,'eligible',v_policy.makeup_enabled AND v_now<v_end AND v_remaining>0
      AND jsonb_array_length(v_sources)>0 AND (v_destination->>'quantity')::numeric>=(v_setting->>'minimum')::numeric,
    'reason',CASE WHEN NOT v_policy.makeup_enabled THEN 'paused' WHEN v_now>=v_end THEN 'expired'
      WHEN v_remaining=0 THEN 'quota_exhausted' WHEN jsonb_array_length(v_sources)=0 THEN 'no_source'
      WHEN (v_destination->>'quantity')::numeric<(v_setting->>'minimum')::numeric THEN 'destination_minimum' ELSE NULL END);
END $$;

COMMIT;
