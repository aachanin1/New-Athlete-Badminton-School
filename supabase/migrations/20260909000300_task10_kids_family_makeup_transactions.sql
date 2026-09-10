BEGIN;

CREATE FUNCTION public.task10_read_makeup_setting_v1(p_actor_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_setting public.system_settings%ROWTYPE; v_result jsonb;
BEGIN
  PERFORM public.task10_require_actor_v1(p_actor_id,'makeup');
  SELECT * INTO v_setting FROM public.system_settings WHERE key='kids_makeup_destination_minimum_sessions';
  SELECT result INTO v_result FROM public.task10_setting_revisions
    WHERE setting_id=v_setting.id AND revision=(v_setting.value->>'revision')::bigint AND new_value=v_setting.value;
  IF v_result IS NULL THEN RAISE EXCEPTION 'TASK10_SETTING_UNAVAILABLE'; END IF;
  RETURN v_result;
END $$;

CREATE FUNCTION public.task10_guard_makeup_setting_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF (TG_OP<>'INSERT' AND OLD.key='kids_makeup_destination_minimum_sessions')
    OR (TG_OP<>'DELETE' AND NEW.key='kids_makeup_destination_minimum_sessions') THEN
    IF TG_OP<>'UPDATE' OR NEW.id IS DISTINCT FROM OLD.id OR NEW.key IS DISTINCT FROM OLD.key
      OR current_user NOT IN ('postgres','supabase_admin')
      OR current_setting('task10.setting_write',true) IS DISTINCT FROM 'authorized' THEN
      RAISE EXCEPTION 'TASK10_GUARDED_SETTING';
    END IF;
    IF jsonb_typeof(NEW.value->'minimum')<>'number' OR (NEW.value->>'minimum')::numeric<1
      OR (NEW.value->>'minimum')::numeric<>trunc((NEW.value->>'minimum')::numeric)
      OR (NEW.value->>'revision')::bigint<>(OLD.value->>'revision')::bigint+1 THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER task10_makeup_setting_guard BEFORE INSERT OR UPDATE OR DELETE ON public.system_settings
FOR EACH ROW EXECUTE FUNCTION public.task10_guard_makeup_setting_v1();

CREATE FUNCTION public.task10_save_makeup_setting_v1(p_actor_id uuid,p_minimum numeric,p_expected_revision bigint,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_old public.system_settings%ROWTYPE; v_prior public.task10_setting_revisions%ROWTYPE;
  v_value jsonb; v_result jsonb; v_time timestamptz; v_fingerprint text;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  PERFORM pg_advisory_xact_lock(10,2);
  PERFORM public.task10_require_actor_v1(p_actor_id,'settings');
  IF p_minimum IS NULL OR p_minimum<1 OR p_minimum<>trunc(p_minimum) OR p_minimum::text IN ('NaN','Infinity','-Infinity')
    OR p_expected_revision IS NULL OR p_expected_revision<1 OR p_request_id IS NULL THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
  v_fingerprint:=encode(extensions.digest(concat_ws('|',p_actor_id,p_minimum,p_expected_revision),'sha256'),'hex');
  SELECT * INTO v_prior FROM public.task10_setting_revisions WHERE request_id=p_request_id;
  IF FOUND THEN
    IF v_prior.actor_id IS DISTINCT FROM p_actor_id OR v_prior.request_fingerprint IS DISTINCT FROM v_fingerprint THEN RAISE EXCEPTION 'TASK10_IDEMPOTENCY_CONFLICT'; END IF;
    RETURN v_prior.result;
  END IF;
  SELECT * INTO v_old FROM public.system_settings WHERE key='kids_makeup_destination_minimum_sessions' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TASK10_SETTING_UNAVAILABLE'; END IF;
  IF (v_old.value->>'revision')::bigint<>p_expected_revision THEN RAISE EXCEPTION 'TASK10_REVISION_CONFLICT'; END IF;
  v_time:=public.task10_clock_v1();
  v_value:=jsonb_build_object('minimum',p_minimum,'revision',p_expected_revision+1);
  v_result:=jsonb_build_object('id',v_old.id,'minimum',p_minimum,'revision',p_expected_revision+1,'updatedAt',v_time);
  PERFORM set_config('task10.setting_write','authorized',true);
  UPDATE public.system_settings SET value=v_value,updated_by=p_actor_id,updated_at=v_time WHERE id=v_old.id;
  PERFORM set_config('task10.setting_write','',true);
  INSERT INTO public.task10_setting_revisions(revision,setting_id,old_value,new_value,actor_id,request_id,request_fingerprint,result,created_at)
  VALUES(p_expected_revision+1,v_old.id,v_old.value,v_value,p_actor_id,p_request_id,v_fingerprint,v_result,v_time);
  INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details)
  VALUES(p_actor_id,'task10_makeup_minimum_saved','system_settings',v_old.id,jsonb_build_object('old',v_old.value,'new',v_value,'requestId',p_request_id));
  RETURN v_result;
END $$;

CREATE FUNCTION public.task10_lock_family_months_v1(p_parent_id uuid,p_months date[]) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE m date;
BEGIN
  IF p_parent_id IS NULL OR p_months IS NULL THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
  FOR m IN SELECT DISTINCT date_trunc('month',d)::date FROM unnest(p_months) d ORDER BY 1 LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('task10-family|'||p_parent_id::text||'|'||m::text,0));
  END LOOP;
END $$;

CREATE FUNCTION public.task10_source_root_v1(p_session_id uuid) RETURNS uuid
LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
DECLARE v_current uuid:=p_session_id; v_visited uuid[]:='{}'; v_session public.booking_sessions%ROWTYPE;
  v_booking uuid; v_child uuid; v_links uuid[];
BEGIN
  LOOP
    IF v_current IS NULL OR v_current=ANY(v_visited) THEN RAISE EXCEPTION 'TASK10_AMBIGUOUS_SOURCE'; END IF;
    v_visited:=array_append(v_visited,v_current);
    SELECT * INTO v_session FROM public.booking_sessions WHERE id=v_current;
    IF NOT FOUND OR (v_booking IS NOT NULL AND (v_booking<>v_session.booking_id
      OR (NOT v_session.is_makeup AND v_child IS DISTINCT FROM v_session.child_id))) THEN RAISE EXCEPTION 'TASK10_AMBIGUOUS_SOURCE'; END IF;
    IF v_booking IS NULL THEN v_booking:=v_session.booking_id; v_child:=v_session.child_id; END IF;
    SELECT array_agg(DISTINCT predecessor) FILTER(WHERE predecessor IS NOT NULL) INTO v_links FROM (
      SELECT v_session.rescheduled_from_id AS predecessor
      UNION SELECT original_session_id FROM public.lesson_wallet_credits WHERE redeemed_session_id=v_current
      UNION SELECT original_session_id FROM public.lesson_wallet_credit_members WHERE redeemed_session_id=v_current
    ) chain;
    IF coalesce(cardinality(v_links),0)=0 THEN RETURN v_current; END IF;
    IF cardinality(v_links)<>1 THEN RAISE EXCEPTION 'TASK10_AMBIGUOUS_SOURCE'; END IF;
    v_current:=v_links[1];
    -- A Makeup destination has its actual child; predecessor identity is retained
    -- separately, and the source chain from this point must be consistent.
    IF v_session.is_makeup THEN v_child:=NULL; SELECT child_id INTO v_child FROM public.booking_sessions WHERE id=v_current; END IF;
  END LOOP;
END $$;

CREATE FUNCTION public.task10_verified_purchase_v1(p_parent_id uuid,p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
DECLARE v_total bigint; v_evidence jsonb;
BEGIN
  IF EXISTS(SELECT 1 FROM public.bookings b JOIN public.course_types c ON c.id=b.course_type_id
    WHERE b.user_id=p_parent_id AND c.name::text='kids_group' AND b.status::text='verified'
      AND b.year=extract(year FROM p_month) AND b.month=extract(month FROM p_month)
      AND coalesce(b.entitlement_sessions,b.total_sessions,0)<=0) THEN RAISE EXCEPTION 'TASK10_INVALID_PURCHASE_EVIDENCE'; END IF;
  SELECT coalesce(sum(coalesce(b.entitlement_sessions,b.total_sessions)),0),coalesce(jsonb_agg(
    jsonb_build_object('bookingId',b.id,'quantity',coalesce(b.entitlement_sessions,b.total_sessions),'status',b.status)
    ORDER BY b.id),'[]'::jsonb) INTO v_total,v_evidence
  FROM public.bookings b JOIN public.course_types c ON c.id=b.course_type_id
  WHERE b.user_id=p_parent_id AND c.name::text='kids_group' AND b.status::text='verified'
    AND b.year=extract(year FROM p_month) AND b.month=extract(month FROM p_month);
  RETURN jsonb_build_object('quantity',v_total,'bookings',v_evidence,
    'pendingQuantity',(SELECT coalesce(sum(coalesce(b.entitlement_sessions,b.total_sessions)),0) FROM public.bookings b JOIN public.course_types c ON c.id=b.course_type_id
      WHERE b.user_id=p_parent_id AND c.name::text='kids_group' AND b.status::text='pending_payment' AND b.year=extract(year FROM p_month) AND b.month=extract(month FROM p_month)),
    'awaitingReviewQuantity',(SELECT coalesce(sum(coalesce(b.entitlement_sessions,b.total_sessions)),0) FROM public.bookings b JOIN public.course_types c ON c.id=b.course_type_id
      WHERE b.user_id=p_parent_id AND c.name::text='kids_group' AND b.status::text='paid' AND b.year=extract(year FROM p_month) AND b.month=extract(month FROM p_month)),
    'fingerprint',encode(extensions.digest(v_evidence::text,'sha256'),'hex'));
END $$;

CREATE FUNCTION public.task10_family_makeup_state_v1(p_actor_id uuid,p_parent_id uuid,p_source_month date) RETURNS jsonb
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
    IF v_root=ANY(v_roots) THEN RAISE EXCEPTION 'TASK10_AMBIGUOUS_SOURCE'; END IF;
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

CREATE FUNCTION public.task10_target_slot_v1(p_course_id uuid,p_template_id uuid,p_branch_id uuid,p_date date,p_start time,p_end time) RETURNS uuid
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_count integer; v_slot public.schedule_slots%ROWTYPE; v_max integer;
BEGIN
  IF p_start IS NULL OR p_end IS NULL OR p_start>=p_end OR p_date IS NULL
    OR (p_date+p_start) AT TIME ZONE 'Asia/Bangkok'<=public.task10_clock_v1() THEN RAISE EXCEPTION 'TASK10_TARGET_STARTED'; END IF;
  PERFORM 1 FROM public.schedule_templates t JOIN public.branches b ON b.id=t.branch_id
    WHERE t.id=p_template_id AND t.branch_id=p_branch_id AND t.course_type_id=p_course_id
      AND t.day_of_week=extract(dow FROM p_date) AND t.start_time=p_start AND t.end_time=p_end AND t.is_active AND b.is_active FOR SHARE OF t,b;
  IF NOT FOUND THEN RAISE EXCEPTION 'TASK10_INVALID_TEMPLATE'; END IF;
  SELECT count(*) INTO v_count FROM public.schedule_templates WHERE branch_id=p_branch_id AND course_type_id=p_course_id
    AND day_of_week=extract(dow FROM p_date) AND start_time=p_start AND end_time=p_end AND is_active;
  IF v_count<>1 THEN RAISE EXCEPTION 'TASK10_AMBIGUOUS_TEMPLATE'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(concat_ws('|',p_branch_id,p_course_id,p_date,p_start),0));
  SELECT max_students INTO v_max FROM public.course_types WHERE id=p_course_id;
  INSERT INTO public.schedule_slots(template_id,branch_id,course_type_id,date,start_time,end_time,max_students,current_students,status)
  VALUES(p_template_id,p_branch_id,p_course_id,p_date,p_start,p_end,v_max,0,'open') ON CONFLICT(branch_id,course_type_id,date,start_time) DO NOTHING;
  SELECT * INTO v_slot FROM public.schedule_slots WHERE branch_id=p_branch_id AND course_type_id=p_course_id AND date=p_date AND start_time=p_start FOR UPDATE;
  IF v_slot.end_time<>p_end OR v_slot.status::text='cancelled' THEN RAISE EXCEPTION 'TASK10_SLOT_CONFLICT'; END IF;
  IF v_slot.template_id IS NULL THEN UPDATE public.schedule_slots SET template_id=p_template_id WHERE id=v_slot.id AND template_id IS NULL;
  ELSIF v_slot.template_id<>p_template_id THEN RAISE EXCEPTION 'TASK10_SLOT_CONFLICT'; END IF;
  RETURN v_slot.id;
END $$;

CREATE FUNCTION public.task10_consume_family_makeup_v1(p_actor_id uuid,p_source_session_id uuid,p_attending_child_id uuid,
  p_template_id uuid,p_branch_id uuid,p_target_date date,p_start_time time,p_end_time time,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_policy public.task10_policy_activation%ROWTYPE; v_prior public.task10_family_makeup_uses%ROWTYPE;
  v_selected record; v_source jsonb; v_state jsonb; v_root uuid; v_month date; v_parent uuid; v_slot uuid;
  v_fingerprint text; v_session public.booking_sessions%ROWTYPE; v_result jsonb; v_now timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  PERFORM pg_advisory_xact_lock_shared(10,2);
  PERFORM public.task10_require_actor_v1(p_actor_id,'makeup');
  IF p_request_id IS NULL OR p_source_session_id IS NULL OR p_attending_child_id IS NULL THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
  v_fingerprint:=encode(extensions.digest(concat_ws('|',p_actor_id,p_source_session_id,p_attending_child_id,p_template_id,p_branch_id,p_target_date,p_start_time,p_end_time),'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended('task10-request|'||p_actor_id::text||'|'||p_request_id::text,0));
  SELECT * INTO v_prior FROM public.task10_family_makeup_uses WHERE actor_id=p_actor_id AND request_id=p_request_id;
  IF FOUND THEN
    IF v_prior.request_fingerprint<>v_fingerprint THEN RAISE EXCEPTION 'TASK10_IDEMPOTENCY_CONFLICT'; END IF;
    RETURN v_prior.result;
  END IF;
  SELECT * INTO v_policy FROM public.task10_policy_activation WHERE singleton;
  IF v_policy.effective_at IS NULL OR NOT v_policy.makeup_enabled THEN RAISE EXCEPTION 'TASK10_MAKEUP_PAUSED'; END IF;
  v_root:=public.task10_source_root_v1(p_source_session_id);
  SELECT date_trunc('month',s.date)::date,b.user_id INTO v_month,v_parent
    FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id WHERE s.id=v_root;
  v_state:=public.task10_family_makeup_state_v1(p_actor_id,v_parent,v_month);
  IF NOT (v_state->>'eligible')::boolean THEN RAISE EXCEPTION 'TASK10_MAKEUP_INELIGIBLE' USING DETAIL=v_state->>'reason'; END IF;
  SELECT value INTO v_source FROM jsonb_array_elements(v_state->'sources') WHERE value->>'sourceSessionId'=p_source_session_id::text;
  IF v_source IS NULL OR v_source->>'rootId'<>v_root::text THEN RAISE EXCEPTION 'TASK10_SOURCE_CONFLICT'; END IF;
  PERFORM 1 FROM public.children WHERE id=p_attending_child_id AND parent_id=v_parent FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TASK10_CHILD_NOT_IN_FAMILY'; END IF;
  IF date_trunc('month',p_target_date)::date<>(v_month+interval '1 month')::date THEN RAISE EXCEPTION 'TASK10_TARGET_MONTH'; END IF;
  PERFORM 1 FROM public.bookings b WHERE b.id=(v_source->>'bookingId')::uuid FOR UPDATE;
  PERFORM 1 FROM public.booking_sessions s WHERE s.id IN (v_root,p_source_session_id) ORDER BY s.id FOR UPDATE;
  -- Attendance corrections can precede their session-status write-through.
  -- Lock the exact evidence and re-read eligibility after waiting for source rows.
  PERFORM a.id FROM public.attendance a WHERE a.booking_session_id IN (v_root,p_source_session_id) ORDER BY a.id FOR UPDATE;
  v_state:=public.task10_family_makeup_state_v1(p_actor_id,v_parent,v_month);
  IF NOT (v_state->>'eligible')::boolean THEN RAISE EXCEPTION 'TASK10_MAKEUP_INELIGIBLE' USING DETAIL=v_state->>'reason'; END IF;
  SELECT value INTO v_source FROM jsonb_array_elements(v_state->'sources') WHERE value->>'sourceSessionId'=p_source_session_id::text;
  IF v_source IS NULL OR v_source->>'rootId'<>v_root::text THEN RAISE EXCEPTION 'TASK10_SOURCE_CONFLICT'; END IF;
  SELECT s.*,b.course_type_id INTO v_selected FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id WHERE s.id=p_source_session_id;
  IF public.task10_source_root_v1(p_source_session_id)<>v_root THEN RAISE EXCEPTION 'TASK10_SOURCE_CONFLICT'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('task10-learner|'||p_attending_child_id::text||'|'||p_target_date::text,0));
  IF EXISTS(SELECT 1 FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id
    WHERE b.user_id=v_parent AND b.status::text<>'cancelled' AND s.child_id=p_attending_child_id AND s.date=p_target_date
      AND s.start_time<p_end_time AND s.end_time>p_start_time AND s.status::text NOT IN ('rescheduled','walleted','cancelled') AND s.cancelled_at IS NULL) THEN RAISE EXCEPTION 'TASK10_LEARNER_OVERLAP'; END IF;
  v_slot:=public.task10_target_slot_v1(v_selected.course_type_id,p_template_id,p_branch_id,p_target_date,p_start_time,p_end_time);
  v_now:=public.task10_clock_v1();
  IF v_now>=(v_month+interval '2 month') AT TIME ZONE 'Asia/Bangkok'
    OR (p_target_date+p_start_time) AT TIME ZONE 'Asia/Bangkok'<=v_now THEN RAISE EXCEPTION 'TASK10_TARGET_STARTED'; END IF;
  PERFORM set_config('task10.source_write','authorized',true);
  INSERT INTO public.booking_sessions(booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup,rescheduled_from_id)
  VALUES(v_selected.booking_id,v_slot,p_target_date,p_start_time,p_end_time,p_branch_id,p_attending_child_id,'scheduled',true,p_source_session_id) RETURNING * INTO v_session;
  v_result:=jsonb_build_object('success',true,'data',to_jsonb(v_session),'remaining',(v_state->>'remaining')::integer-1,
    'minimum',v_state->'minimum','destinationPurchase',v_state->'destinationPurchase');
  INSERT INTO public.task10_family_makeup_uses(parent_id,source_month,source_booking_id,source_root_id,source_session_id,source_child_id,
    attending_child_id,destination_session_id,credit_id,minimum_revision,decision_evidence,actor_id,request_id,request_fingerprint,result,created_at)
  VALUES(v_parent,v_month,v_selected.booking_id,v_root,p_source_session_id,v_selected.child_id,p_attending_child_id,v_session.id,
    (v_source->>'creditId')::uuid,(v_state->'minimum'->>'revision')::bigint,v_state,p_actor_id,p_request_id,v_fingerprint,v_result,v_now);
  INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details)
  VALUES(p_actor_id,'task10_family_makeup_consumed','booking_sessions',v_session.id,jsonb_build_object('sourceRootId',v_root,'sourceChildId',v_selected.child_id,'attendingChildId',p_attending_child_id,'evidence',v_state));
  INSERT INTO public.notifications(user_id,title,message,type,link_url)
  VALUES(v_parent,'ได้รับวันชดเชยแล้ว','Admin จัดวันชดเชยให้วันที่ '||p_target_date::text||' เวลา '||p_start_time::text||' เรียบร้อยแล้ว','schedule','/dashboard/schedule');
  PERFORM public.progressive_refresh_slot_capacity_v1(ARRAY[v_slot]);
  PERFORM set_config('task10.source_write','',true);
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.task10_target_slot_v1(uuid,uuid,uuid,date,time,time),
  public.task10_consume_family_makeup_v1(uuid,uuid,uuid,uuid,uuid,date,time,time,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.task10_consume_family_makeup_v1(uuid,uuid,uuid,uuid,uuid,date,time,time,uuid) TO service_role;

REVOKE ALL ON FUNCTION public.task10_lock_family_months_v1(uuid,date[]),public.task10_source_root_v1(uuid),
  public.task10_verified_purchase_v1(uuid,date),public.task10_family_makeup_state_v1(uuid,uuid,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.task10_family_makeup_state_v1(uuid,uuid,date) TO service_role;

REVOKE ALL ON FUNCTION public.task10_read_makeup_setting_v1(uuid),public.task10_guard_makeup_setting_v1(),
  public.task10_save_makeup_setting_v1(uuid,numeric,bigint,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.task10_read_makeup_setting_v1(uuid),public.task10_save_makeup_setting_v1(uuid,numeric,bigint,uuid) TO service_role;
-- All source operations acquire the same family-month keys before booking/source
-- row locks. Existing Wallet bodies remain intact for Adult/Private, including
-- Family Private participants, historical evidence and exact 48-hour boundary.
CREATE FUNCTION public.task10_begin_source_v1(p_session_id uuid,p_user_id uuid DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_root uuid; v_parent uuid; v_booking uuid; v_month date; v_course text;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  PERFORM pg_advisory_xact_lock_shared(10,2);
  SELECT b.user_id,b.id,c.name::text INTO v_parent,v_booking,v_course FROM public.booking_sessions s
    JOIN public.bookings b ON b.id=s.booking_id JOIN public.course_types c ON c.id=b.course_type_id WHERE s.id=p_session_id;
  IF v_course IS DISTINCT FROM 'kids_group' THEN RETURN false; END IF;
  IF p_user_id IS NOT NULL AND v_parent IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'TASK10_UNAUTHORIZED'; END IF;
  v_root:=public.task10_source_root_v1(p_session_id);
  SELECT date_trunc('month',date)::date INTO v_month FROM public.booking_sessions WHERE id=v_root;
  PERFORM public.task10_lock_family_months_v1(v_parent,ARRAY[v_month,(v_month+interval '1 month')::date]);
  PERFORM 1 FROM public.bookings WHERE id=v_booking FOR UPDATE;
  PERFORM 1 FROM public.booking_sessions WHERE booking_id=v_booking ORDER BY id FOR UPDATE;
  PERFORM a.id FROM public.attendance a WHERE a.booking_session_id IN (v_root,p_session_id) ORDER BY a.id FOR UPDATE;
  IF public.task10_source_root_v1(p_session_id)<>v_root THEN RAISE EXCEPTION 'TASK10_SOURCE_CONFLICT'; END IF;
  IF EXISTS(SELECT 1 FROM public.booking_sessions m WHERE m.booking_id=v_booking AND m.is_makeup
    AND public.task10_source_root_v1(m.id)=v_root) THEN RAISE EXCEPTION 'TASK10_SOURCE_ALREADY_USED'; END IF;
  PERFORM set_config('task10.source_write','authorized',true);
  RETURN true;
END $$;

ALTER FUNCTION public.lesson_wallet_store_v2(uuid,uuid,uuid) RENAME TO task10_previous_wallet_store_v2;
CREATE FUNCTION public.lesson_wallet_store_v2(p_user_id uuid,p_session_id uuid,p_actor_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_guard boolean; v_result jsonb;
BEGIN
  -- Serialize the state decision and the entire legacy operation with activation.
  -- effective_at retains the guards after pause; disabled flags alone do not.
  PERFORM pg_advisory_xact_lock_shared(10,1);
  -- Family callers must lock the common booking before any selected participant.
  -- This lock correction applies to both policy paths without lineage guards.
  PERFORM 1 FROM public.bookings b JOIN public.booking_sessions s ON s.booking_id=b.id
    JOIN public.course_types c ON c.id=b.course_type_id
    WHERE s.id=p_session_id AND b.user_id=p_user_id AND c.name::text='private'
    FOR UPDATE OF b;
  IF NOT public.task10_source_policy_established_v1() THEN
    RETURN public.task10_previous_wallet_store_v2(p_user_id,p_session_id,p_actor_id);
  END IF;
  v_guard:=public.task10_begin_source_v1(p_session_id,p_user_id);
  IF v_guard AND EXISTS(SELECT 1 FROM public.booking_sessions WHERE id=p_session_id
    AND (date+start_time) AT TIME ZONE 'Asia/Bangkok'<=public.task10_clock_v1()+interval '48 hours') THEN
    RAISE EXCEPTION 'LESSON_WALLET_UNIT_NOT_STORABLE';
  END IF;
  v_result:=public.task10_previous_wallet_store_v2(p_user_id,p_session_id,p_actor_id);
  PERFORM set_config('task10.source_write','',true);
  RETURN v_result;
END $$;
ALTER FUNCTION public.lesson_wallet_redeem_v2(uuid,uuid,date,time,time,uuid,uuid) RENAME TO task10_previous_wallet_redeem_v2;
CREATE FUNCTION public.lesson_wallet_redeem_v2(p_user_id uuid,p_credit_id uuid,p_target_date date,p_start_time time,
  p_end_time time,p_branch_id uuid,p_schedule_template_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_source uuid; v_guard boolean; v_result jsonb;
BEGIN
  -- Decide before reading lineage or applying any additional Task10 time guard.
  PERFORM pg_advisory_xact_lock_shared(10,1);
  IF NOT public.task10_source_policy_established_v1() THEN
    RETURN public.task10_previous_wallet_redeem_v2(p_user_id,p_credit_id,p_target_date,p_start_time,p_end_time,p_branch_id,p_schedule_template_id);
  END IF;
  SELECT original_session_id INTO v_source FROM public.lesson_wallet_credits WHERE id=p_credit_id;
  v_guard:=public.task10_begin_source_v1(v_source,p_user_id);
  IF v_guard AND EXISTS(SELECT 1 FROM public.lesson_wallet_credits WHERE id=p_credit_id
    AND expires_at<public.task10_clock_v1()) THEN RAISE EXCEPTION 'LESSON_WALLET_ENTITLEMENT_EXPIRED'; END IF;
  v_result:=public.task10_previous_wallet_redeem_v2(p_user_id,p_credit_id,p_target_date,p_start_time,p_end_time,p_branch_id,p_schedule_template_id);
  PERFORM set_config('task10.source_write','',true);
  RETURN v_result;
END $$;

CREATE FUNCTION public.task10_reschedule_kids_v1(p_user_id uuid,p_session_id uuid,p_target_date date,p_start_time time,
  p_end_time time,p_branch_id uuid,p_template_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s record; v_root uuid; v_slot uuid; v_new uuid; v_retirement jsonb; v_result jsonb; v_fingerprint text; v_now timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  PERFORM pg_advisory_xact_lock_shared(10,2);
  v_fingerprint:=encode(extensions.digest(concat_ws('|',p_target_date,p_start_time,p_end_time,p_branch_id,p_template_id),'sha256'),'hex');
  SELECT result INTO v_result FROM public.task10_source_mutations WHERE actor_id=p_user_id AND operation='reschedule'
    AND source_session_id=p_session_id AND request_fingerprint=v_fingerprint;
  IF FOUND THEN RETURN v_result; END IF;
  IF NOT public.task10_begin_source_v1(p_session_id,p_user_id) THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
  -- A concurrent retry must read the committed result after the family lock.
  SELECT result INTO v_result FROM public.task10_source_mutations WHERE actor_id=p_user_id AND operation='reschedule'
    AND source_session_id=p_session_id AND request_fingerprint=v_fingerprint;
  IF FOUND THEN RETURN v_result; END IF;
  SELECT bs.*,b.user_id,b.status::text AS booking_status,b.course_type_id INTO s FROM public.booking_sessions bs
    JOIN public.bookings b ON b.id=bs.booking_id WHERE bs.id=p_session_id;
  v_now:=public.task10_clock_v1();
  IF s.booking_status<>'verified' OR s.status::text<>'scheduled' OR s.is_makeup OR s.cancelled_at IS NOT NULL
    OR s.child_id IS NULL OR s.schedule_slot_id IS NULL THEN RAISE EXCEPTION 'TASK10_SOURCE_CONFLICT'; END IF;
  -- Owner-confirmed existing >=12-hour rule: exactly12 is allowed.
  IF (s.date+s.start_time) AT TIME ZONE 'Asia/Bangkok'<v_now+interval '12 hours' THEN RAISE EXCEPTION 'TASK10_RESCHEDULE_CUTOFF'; END IF;
  IF date_trunc('month',p_target_date)<>date_trunc('month',s.date) THEN RAISE EXCEPTION 'TASK10_TARGET_MONTH'; END IF;
  IF s.date=p_target_date AND s.start_time=p_start_time AND s.end_time=p_end_time AND s.branch_id=p_branch_id THEN RAISE EXCEPTION 'TASK10_SAME_SLOT'; END IF;
  IF EXISTS(SELECT 1 FROM public.attendance WHERE booking_session_id=s.id) THEN RAISE EXCEPTION 'TASK10_ATTENDANCE_EXISTS'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('task10-learner|'||s.child_id::text||'|'||p_target_date::text,0));
  IF EXISTS(SELECT 1 FROM public.booking_sessions x JOIN public.bookings b ON b.id=x.booking_id WHERE b.user_id=p_user_id
    AND b.status::text IN ('pending_payment','paid','verified') AND (b.status::text<>'pending_payment' OR b.expires_at IS NULL OR b.expires_at>v_now)
    AND x.id<>s.id AND x.child_id=s.child_id AND x.date=p_target_date AND x.start_time<p_end_time AND x.end_time>p_start_time
    AND x.cancelled_at IS NULL AND x.status::text IN ('scheduled','completed','absent')) THEN RAISE EXCEPTION 'TASK10_LEARNER_OVERLAP'; END IF;
  v_slot:=public.task10_target_slot_v1(s.course_type_id,p_template_id,p_branch_id,p_target_date,p_start_time,p_end_time);
  IF (s.date+s.start_time) AT TIME ZONE 'Asia/Bangkok'<public.task10_clock_v1()+interval '12 hours' THEN RAISE EXCEPTION 'TASK10_RESCHEDULE_CUTOFF'; END IF;
  v_root:=public.task10_source_root_v1(p_session_id);
  UPDATE public.booking_sessions SET status='rescheduled' WHERE id=p_session_id;
  INSERT INTO public.booking_sessions(booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,rescheduled_from_id,is_makeup)
    VALUES(s.booking_id,v_slot,p_target_date,p_start_time,p_end_time,p_branch_id,s.child_id,'scheduled',s.id,false) RETURNING id INTO v_new;
  v_retirement:=public.retire_coach_assignment_membership_v1(s.id,p_user_id,'reschedule_out');
  PERFORM public.progressive_refresh_slot_capacity_v1(ARRAY[s.schedule_slot_id,v_slot]);
  v_result:=jsonb_build_object('sessionId',v_new,'scheduleSlotId',v_slot,'assignmentRetirement',v_retirement);
  INSERT INTO public.task10_source_mutations(actor_id,operation,source_session_id,source_root_id,request_fingerprint,result)
    VALUES(p_user_id,'reschedule',s.id,v_root,v_fingerprint,v_result);
  INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details)
    VALUES(p_user_id,'task10_reschedule_committed','booking_sessions',s.id,v_result||jsonb_build_object('sourceRootId',v_root));
  PERFORM set_config('task10.source_write','',true);
  RETURN v_result;
END $$;

CREATE FUNCTION public.task10_return_kids_entitlement_v1(p_actor_id uuid,p_session_id uuid,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s record; v_root uuid; v_result jsonb; v_fingerprint text; v_credit uuid; v_count integer; v_expiry timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  PERFORM pg_advisory_xact_lock_shared(10,2);
  PERFORM public.task10_require_actor_v1(p_actor_id,'makeup');
  IF nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
  v_fingerprint:=encode(extensions.digest(p_reason,'sha256'),'hex');
  SELECT result INTO v_result FROM public.task10_source_mutations WHERE actor_id=p_actor_id AND operation='return_entitlement'
    AND source_session_id=p_session_id AND request_fingerprint=v_fingerprint;
  IF FOUND THEN RETURN v_result; END IF;
  IF NOT public.task10_begin_source_v1(p_session_id) THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
  SELECT result INTO v_result FROM public.task10_source_mutations WHERE actor_id=p_actor_id AND operation='return_entitlement'
    AND source_session_id=p_session_id AND request_fingerprint=v_fingerprint;
  IF FOUND THEN RETURN v_result; END IF;
  SELECT bs.*,b.user_id,b.status::text AS booking_status,b.course_type_id INTO s FROM public.booking_sessions bs
    JOIN public.bookings b ON b.id=bs.booking_id WHERE bs.id=p_session_id;
  IF s.booking_status<>'verified' OR s.is_makeup OR s.cancelled_at IS NOT NULL OR s.child_id IS NULL
    OR s.schedule_slot_id IS NULL OR s.status::text NOT IN ('scheduled','absent','walleted')
    OR (s.date+s.end_time) AT TIME ZONE 'Asia/Bangkok'>=public.task10_clock_v1() THEN RAISE EXCEPTION 'TASK10_SOURCE_CONFLICT'; END IF;
  IF EXISTS(SELECT 1 FROM public.attendance WHERE booking_session_id=s.id) THEN RAISE EXCEPTION 'TASK10_ATTENDANCE_EXISTS'; END IF;
  v_root:=public.task10_source_root_v1(s.id);
  SELECT count(*),(array_agg(id ORDER BY id))[1] INTO v_count,v_credit FROM public.lesson_wallet_credits WHERE original_session_id=s.id;
  IF v_count>1 THEN RAISE EXCEPTION 'TASK10_AMBIGUOUS_SOURCE'; END IF;
  IF v_count=1 AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credits WHERE id=v_credit AND status='active' AND redeemed_session_id IS NULL)
    THEN RAISE EXCEPTION 'TASK10_SOURCE_CONFLICT'; END IF;
  v_expiry:=((date_trunc('month',s.date)+interval '1 month') AT TIME ZONE 'Asia/Bangkok')-interval '1 millisecond';
  IF v_count=0 THEN
    INSERT INTO public.lesson_wallet_credits(user_id,booking_id,original_session_id,child_id,branch_id,course_type_id,
      original_schedule_slot_id,original_date,original_start_time,original_end_time,status,expires_at,notes)
    VALUES(s.user_id,s.booking_id,s.id,s.child_id,s.branch_id,s.course_type_id,s.schedule_slot_id,s.date,s.start_time,s.end_time,
      'active',v_expiry,'Returned by Admin attendance-gap review: '||p_reason) RETURNING id INTO v_credit;
  END IF;
  UPDATE public.booking_sessions SET status='walleted' WHERE id=s.id;
  v_result:=jsonb_build_object('success',true,'creditId',v_credit,'sourceRootId',v_root);
  INSERT INTO public.task10_source_mutations(actor_id,operation,source_session_id,source_root_id,request_fingerprint,result)
    VALUES(p_actor_id,'return_entitlement',s.id,v_root,v_fingerprint,v_result);
  INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details)
    VALUES(p_actor_id,'attendance_gap_return_entitlement','booking_sessions',s.id,v_result||jsonb_build_object('reason',p_reason));
  INSERT INTO public.notifications(user_id,title,message,type,link_url)
    VALUES(s.user_id,'คืนสิทธิ์วันเรียนเข้ากระเป๋าแล้ว','Admin คืนสิทธิ์รอบ '||s.date::text||' เหตุผล: '||p_reason,'schedule','/dashboard/lesson-wallet');
  PERFORM set_config('task10.source_write','',true);
  RETURN v_result;
END $$;

CREATE FUNCTION public.task10_guard_source_write_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_booking uuid; v_guard boolean:=false;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  IF NOT public.task10_source_policy_established_v1() THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
  END IF;
  IF TG_TABLE_NAME='booking_sessions' THEN
    IF TG_OP='INSERT' THEN v_booking:=NEW.booking_id; v_guard:=true;
    ELSIF TG_OP='DELETE' THEN v_booking:=OLD.booking_id; v_guard:=true;
    ELSE
      v_booking:=OLD.booking_id;
      v_guard:=ROW(NEW.booking_id,NEW.child_id,NEW.is_makeup,NEW.rescheduled_from_id,NEW.date,NEW.start_time,NEW.end_time,NEW.branch_id,NEW.schedule_slot_id,NEW.cancelled_at)
        IS DISTINCT FROM ROW(OLD.booking_id,OLD.child_id,OLD.is_makeup,OLD.rescheduled_from_id,OLD.date,OLD.start_time,OLD.end_time,OLD.branch_id,OLD.schedule_slot_id,OLD.cancelled_at)
        OR (NEW.status IS DISTINCT FROM OLD.status AND (NEW.status::text IN ('walleted','rescheduled','cancelled') OR OLD.status::text IN ('walleted','rescheduled','cancelled')));
    END IF;
  ELSE
    IF TG_OP='INSERT' THEN v_booking:=NEW.booking_id; v_guard:=true;
    ELSIF TG_OP='DELETE' THEN v_booking:=OLD.booking_id; v_guard:=true;
    ELSE v_booking:=OLD.booking_id;
      v_guard:=ROW(NEW.booking_id,NEW.original_session_id,NEW.child_id,NEW.user_id,NEW.expires_at,NEW.redeemed_session_id,NEW.redeemed_at)
        IS DISTINCT FROM ROW(OLD.booking_id,OLD.original_session_id,OLD.child_id,OLD.user_id,OLD.expires_at,OLD.redeemed_session_id,OLD.redeemed_at)
        OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status<>'expired');
    END IF;
  END IF;
  IF v_guard AND EXISTS(SELECT 1 FROM public.bookings b JOIN public.course_types c ON c.id=b.course_type_id
    WHERE b.id=v_booking AND c.name::text='kids_group') AND (current_user NOT IN ('postgres','supabase_admin')
      OR current_setting('task10.source_write',true) IS DISTINCT FROM 'authorized') THEN RAISE EXCEPTION 'TASK10_GUARDED_SOURCE'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER task10_source_guard BEFORE INSERT OR UPDATE OR DELETE ON public.booking_sessions FOR EACH ROW EXECUTE FUNCTION public.task10_guard_source_write_v1();
CREATE TRIGGER task10_wallet_source_guard BEFORE INSERT OR UPDATE OR DELETE ON public.lesson_wallet_credits FOR EACH ROW EXECUTE FUNCTION public.task10_guard_source_write_v1();

REVOKE ALL ON FUNCTION public.task10_begin_source_v1(uuid,uuid),public.task10_guard_source_write_v1(),
  public.task10_previous_wallet_store_v2(uuid,uuid,uuid),public.task10_previous_wallet_redeem_v2(uuid,uuid,date,time,time,uuid,uuid),
  public.lesson_wallet_store_v2(uuid,uuid,uuid),public.lesson_wallet_redeem_v2(uuid,uuid,date,time,time,uuid,uuid),
  public.task10_reschedule_kids_v1(uuid,uuid,date,time,time,uuid,uuid),public.task10_return_kids_entitlement_v1(uuid,uuid,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.lesson_wallet_store_v2(uuid,uuid,uuid),public.lesson_wallet_redeem_v2(uuid,uuid,date,time,time,uuid,uuid),
  public.task10_reschedule_kids_v1(uuid,uuid,date,time,time,uuid,uuid),public.task10_return_kids_entitlement_v1(uuid,uuid,text) TO service_role;
COMMIT;
