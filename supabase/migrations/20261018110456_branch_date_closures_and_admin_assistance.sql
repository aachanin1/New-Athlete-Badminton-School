BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SELECT pg_advisory_xact_lock(10,1);
DO $guard$ BEGIN
  IF md5(replace(pg_get_functiondef('public.lesson_source_transition_v1(uuid,text,uuid,jsonb)'::regprocedure),E'\r\n',E'\n'))<>'c09872767a33fc6519fdef8a3d2b5814' THEN RAISE EXCEPTION 'BRANCH_CLOSURE_BASELINE_DRIFT_lesson_source_transition_v1'; END IF;
  IF md5(replace(pg_get_functiondef('public.task10_previous_wallet_store_v2(uuid,uuid,uuid)'::regprocedure),E'\r\n',E'\n'))<>'e99b48e8609627a6210bd05a18bd6f97' THEN RAISE EXCEPTION 'BRANCH_CLOSURE_BASELINE_DRIFT_task10_previous_wallet_store_v2'; END IF;
  IF md5(replace(pg_get_functiondef('public.lesson_source_previous_store_v1(uuid,uuid,uuid)'::regprocedure),E'\r\n',E'\n'))<>'28b555e9b683c1060485a19193a325bd' THEN RAISE EXCEPTION 'BRANCH_CLOSURE_BASELINE_DRIFT_lesson_source_previous_store_v1'; END IF;
  IF md5(replace(pg_get_functiondef('public.task10_family_makeup_state_v1(uuid,uuid,date)'::regprocedure),E'\r\n',E'\n'))<>'51cc0ae5d2080d92db2dbce4f3c01b8c' THEN RAISE EXCEPTION 'BRANCH_CLOSURE_BASELINE_DRIFT_task10_family_makeup_state_v1'; END IF;
  IF md5(replace(pg_get_functiondef('public.task10_target_slot_v1(uuid,uuid,uuid,date,time,time)'::regprocedure),E'\r\n',E'\n'))<>'2be67f110001b1931d63b0db4b1d2c1e' THEN RAISE EXCEPTION 'BRANCH_CLOSURE_BASELINE_DRIFT_task10_target_slot_v1'; END IF;
END $guard$;

-- Dated closures are admission rules, never cancellations or attendance.
CREATE TABLE public.branch_date_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  closure_date date NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 1000),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  updated_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(branch_id,closure_date)
);
ALTER TABLE public.branch_date_closures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.branch_date_closures FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT(id,branch_id,closure_date,reason,is_active,updated_at) ON public.branch_date_closures TO authenticated;
GRANT SELECT ON public.branch_date_closures TO service_role;
CREATE POLICY branch_date_closures_read ON public.branch_date_closures FOR SELECT TO authenticated
  USING (is_active OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role::text='super_admin'));

CREATE TABLE public.branch_date_closure_operations (
  actor_id uuid NOT NULL REFERENCES public.profiles(id), request_id uuid NOT NULL,
  fingerprint text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(actor_id,request_id)
);
ALTER TABLE public.branch_date_closure_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.branch_date_closure_operations FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.branch_date_assert_open_v1(p_branch_id uuid,p_date date) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  -- The exclusive closure writer never locks bookings/slots. Admission holds a
  -- shared key through commit, including callers using an older application.
  PERFORM pg_advisory_xact_lock_shared(hashtextextended('branch-date-closure-v1|'||p_branch_id::text||'|'||p_date::text,0));
  IF EXISTS(SELECT 1 FROM public.branch_date_closures WHERE branch_id=p_branch_id AND closure_date=p_date AND is_active)
    THEN RAISE EXCEPTION 'BRANCH_DATE_CLOSED'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.branch_date_assert_open_v1(uuid,date) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.branch_date_admission_guard_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.cancelled_at IS NOT NULL OR NEW.status::text IN ('cancelled','rescheduled','walleted') THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    PERFORM public.branch_date_assert_open_v1(NEW.branch_id,NEW.date);
  ELSIF ROW(NEW.branch_id,NEW.date,NEW.start_time,NEW.end_time,NEW.schedule_slot_id,NEW.booking_id,NEW.child_id)
    IS DISTINCT FROM ROW(OLD.branch_id,OLD.date,OLD.start_time,OLD.end_time,OLD.schedule_slot_id,OLD.booking_id,OLD.child_id)
    OR OLD.cancelled_at IS NOT NULL OR OLD.status::text IN ('cancelled','rescheduled','walleted') THEN
    PERFORM public.branch_date_assert_open_v1(NEW.branch_id,NEW.date);
  END IF;
  -- Attendance/status reconciliation of an existing name remains permitted.
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.branch_date_admission_guard_v1() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER branch_date_admission_guard BEFORE INSERT OR UPDATE ON public.booking_sessions
  FOR EACH ROW EXECUTE FUNCTION public.branch_date_admission_guard_v1();

CREATE FUNCTION public.branch_date_closure_set_v1(p_actor_id uuid,p_branch_id uuid,p_date date,p_closed boolean,p_reason text,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_fp text;v_result jsonb;v_prior public.branch_date_closure_operations%ROWTYPE;v_row public.branch_date_closures%ROWTYPE;
BEGIN
  PERFORM public.task10_require_actor_v1(p_actor_id,'settings'); -- Super Admin only, same as recurring-template menu.
  IF p_branch_id IS NULL OR p_date IS NULL OR p_closed IS NULL OR p_request_id IS NULL
    OR nullif(btrim(p_reason),'') IS NULL OR length(p_reason)>1000 THEN RAISE EXCEPTION 'BRANCH_CLOSURE_INVALID_REQUEST'; END IF;
  v_fp:=encode(extensions.digest(jsonb_build_object('branch',p_branch_id,'date',p_date,'closed',p_closed,'reason',btrim(p_reason))::text,'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended('branch-closure-request-v1|'||p_actor_id::text||'|'||p_request_id::text,0));
  SELECT * INTO v_prior FROM public.branch_date_closure_operations WHERE actor_id=p_actor_id AND request_id=p_request_id;
  IF FOUND THEN
    IF v_prior.fingerprint<>v_fp THEN RAISE EXCEPTION 'BRANCH_CLOSURE_REPLAY_CONFLICT'; END IF;
    RETURN v_prior.result;
  END IF;
  IF p_closed AND p_date<(clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date THEN RAISE EXCEPTION 'BRANCH_CLOSURE_DATE_PAST'; END IF;
  PERFORM 1 FROM public.branches WHERE id=p_branch_id AND (is_active OR NOT p_closed);
  IF NOT FOUND THEN RAISE EXCEPTION 'BRANCH_CLOSURE_BRANCH_INVALID'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('branch-date-closure-v1|'||p_branch_id::text||'|'||p_date::text,0));
  IF p_closed THEN
    INSERT INTO public.branch_date_closures(branch_id,closure_date,reason,created_by,updated_by)
    VALUES(p_branch_id,p_date,btrim(p_reason),p_actor_id,p_actor_id)
    ON CONFLICT(branch_id,closure_date) DO UPDATE SET reason=EXCLUDED.reason,is_active=true,updated_by=p_actor_id,updated_at=clock_timestamp()
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.branch_date_closures SET is_active=false,reason=btrim(p_reason),updated_by=p_actor_id,updated_at=clock_timestamp()
    WHERE branch_id=p_branch_id AND closure_date=p_date RETURNING * INTO v_row;
    IF NOT FOUND THEN RAISE EXCEPTION 'BRANCH_CLOSURE_NOT_FOUND'; END IF;
  END IF;
  v_result:=jsonb_build_object('success',true,'closure',to_jsonb(v_row));
  INSERT INTO public.branch_date_closure_operations(actor_id,request_id,fingerprint,result) VALUES(p_actor_id,p_request_id,v_fp,v_result);
  INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details)
  VALUES(p_actor_id,CASE WHEN p_closed THEN 'branch_date_closed' ELSE 'branch_date_reopened' END,'branch_date_closures',v_row.id,
    jsonb_build_object('branchId',p_branch_id,'date',p_date,'reason',btrim(p_reason),'requestId',p_request_id,'existingBookingsUnchanged',true));
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.branch_date_closure_set_v1(uuid,uuid,date,boolean,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.branch_date_closure_set_v1(uuid,uuid,date,boolean,text,uuid) TO service_role;

-- Private rescheduling retains the entire source generation, not one participant.
CREATE FUNCTION public.admin_reschedule_family_v1(p_actor_id uuid,p_source uuid,p_ids uuid[],p_date date,p_start time,p_end time,p_branch uuid,p_template uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE s record;m record;v_slot uuid;v_new uuid;v_selected uuid;v_new_ids uuid[]:='{}';
BEGIN
  SELECT x.*,b.user_id,b.course_type_id INTO s FROM public.booking_sessions x JOIN public.bookings b ON b.id=x.booking_id WHERE x.id=p_source;
  IF EXISTS(SELECT 1 FROM public.booking_sessions WHERE id=ANY(p_ids) GROUP BY child_id HAVING count(*)>1) THEN RAISE EXCEPTION 'LESSON_SOURCE_IDENTITY_CONFLICT'; END IF;
  IF EXISTS(SELECT 1 FROM public.booking_sessions x WHERE x.id=ANY(p_ids) AND
    (x.status::text<>'scheduled' OR x.is_makeup OR x.cancelled_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM public.attendance WHERE booking_session_id=ANY(p_ids))
    OR date_trunc('month',p_date)<>date_trunc('month',s.date) THEN RAISE EXCEPTION 'LESSON_SOURCE_RESCHEDULE_INELIGIBLE'; END IF;
  IF p_end-p_start IS DISTINCT FROM s.end_time-s.start_time THEN RAISE EXCEPTION 'LESSON_SOURCE_PRIVATE_DURATION'; END IF;
  IF ROW(s.date,s.start_time,s.end_time,s.branch_id)=ROW(p_date,p_start,p_end,p_branch) THEN RAISE EXCEPTION 'LESSON_SOURCE_SAME_SLOT'; END IF;
  IF EXISTS(SELECT 1 FROM public.booking_sessions x JOIN public.bookings b ON b.id=x.booking_id
    WHERE b.user_id=s.user_id AND b.status::text<>'cancelled' AND x.cancelled_at IS NULL AND NOT(x.id=ANY(p_ids))
      AND x.date=p_date AND x.start_time<p_end AND x.end_time>p_start AND x.status::text NOT IN ('cancelled','walleted','rescheduled')
      AND EXISTS(SELECT 1 FROM public.booking_sessions member WHERE member.id=ANY(p_ids) AND member.child_id IS NOT DISTINCT FROM x.child_id))
    THEN RAISE EXCEPTION 'LESSON_SOURCE_TARGET_CONFLICT'; END IF;
  v_slot:=public.task10_target_slot_v1(s.course_type_id,p_template,p_branch,p_date,p_start,p_end);
  UPDATE public.booking_sessions SET status='rescheduled' WHERE id=ANY(p_ids);
  FOR m IN SELECT * FROM public.booking_sessions WHERE id=ANY(p_ids) ORDER BY id LOOP
    INSERT INTO public.booking_sessions(booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup,rescheduled_from_id)
    VALUES(m.booking_id,v_slot,p_date,p_start,p_end,p_branch,m.child_id,'scheduled',false,m.id) RETURNING id INTO v_new;
    v_new_ids:=array_append(v_new_ids,v_new);IF m.id=p_source THEN v_selected:=v_new;END IF;
    PERFORM public.retire_coach_assignment_membership_v1(m.id,p_actor_id,'reschedule_out');
  END LOOP;
  PERFORM public.progressive_refresh_slot_capacity_v1(ARRAY[s.schedule_slot_id,v_slot]);
  RETURN jsonb_build_object('sessionId',v_selected,'sessionIds',v_new_ids,'scheduleSlotId',v_slot,'participantCount',cardinality(p_ids));
END $$;
REVOKE ALL ON FUNCTION public.admin_reschedule_family_v1(uuid,uuid,uuid[],date,time,time,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;


CREATE FUNCTION public.task10_makeup_setting_facts_v1() RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE s public.system_settings%ROWTYPE;v jsonb;
BEGIN
  SELECT * INTO s FROM public.system_settings WHERE key='kids_makeup_destination_minimum_sessions';
  SELECT result INTO v FROM public.task10_setting_revisions WHERE setting_id=s.id AND revision=(s.value->>'revision')::bigint AND new_value=s.value;
  IF v IS NULL THEN RAISE EXCEPTION 'TASK10_SETTING_UNAVAILABLE'; END IF;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.task10_makeup_setting_facts_v1() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.task10_family_makeup_facts_v1(p_parent_id uuid, p_source_month date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_policy public.task10_policy_activation%ROWTYPE; v_setting jsonb; v_source jsonb; v_destination jsonb;
  v_sources jsonb:='[]'; v_children jsonb; v_used integer; v_quota integer; v_remaining integer;
  v_month date:=date_trunc('month',p_source_month)::date; v_next date; v_end timestamptz; v_now timestamptz;
  s record; v_root uuid; v_roots uuid[]:='{}'; v_credit public.lesson_wallet_credits%ROWTYPE; v_kind text; v_credit_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  PERFORM pg_advisory_xact_lock_shared(10,2);
  IF p_parent_id IS NULL OR p_source_month IS NULL OR p_source_month<>v_month THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
  SELECT * INTO v_policy FROM public.task10_policy_activation WHERE singleton;
  IF v_policy.effective_at IS NULL THEN RETURN jsonb_build_object('active',false,'state',v_policy.state); END IF;
  v_next:=(v_month+interval '1 month')::date;
  PERFORM public.task10_lock_family_months_v1(p_parent_id,ARRAY[v_month,v_next]);
  v_now:=public.task10_clock_v1(); v_end:=(v_month+interval '2 month') AT TIME ZONE 'Asia/Bangkok';
  v_setting:=public.task10_makeup_setting_facts_v1();
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
END $function$
;

CREATE OR REPLACE FUNCTION public.task10_family_makeup_state_v1(p_actor_id uuid,p_parent_id uuid,p_source_month date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v jsonb; v_eligible boolean;
BEGIN
  -- Facts retain D/M. This existing entry point is Admin-only; future Parent
  -- self-service must use its own owner/wallet-only/D>=M policy entry point.
  PERFORM public.task10_require_actor_v1(p_actor_id,'makeup');
  v:=public.task10_family_makeup_facts_v1(p_parent_id,p_source_month);
  IF NOT(v ? 'sourceMonth') THEN RETURN v;END IF;
  v_eligible:=(v->>'active')::boolean AND public.task10_clock_v1()<(v->>'expiresAt')::timestamptz
    AND (v->>'remaining')::integer>0 AND jsonb_array_length(v->'sources')>0;
  RETURN v||jsonb_build_object('eligible',v_eligible,'reason',CASE WHEN v->>'reason'='destination_minimum' THEN NULL ELSE v->>'reason' END,
    'policyActor','admin','destinationPurchaseRequired',false,'policyVersion','admin-assistance-v1');
END $$;

CREATE OR REPLACE FUNCTION public.admin_wallet_store_body_v1(p_user_id uuid, p_session_id uuid, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_selected record;
  v_unit_type text;
  v_representative_session_id uuid;
  v_participant_count integer;
  v_payment_count integer;
  v_payment_id uuid;
  v_verified_at timestamptz;
  v_tier_count integer;
  v_private_tier_min integer;
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
      AND session_item.id = ANY(public.lesson_source_family_unit_sessions_v1(p_session_id))
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
    IF v_selected.course_name = 'kids_group' THEN
      v_payment_id := NULL;
      v_tier_id := NULL;
      v_policy := 'same_month';
      v_started_at := v_selected.date::timestamp AT TIME ZONE 'Asia/Bangkok';
      v_expires_at :=
        (date_trunc('month', v_selected.date::timestamp) + interval '1 month')
          AT TIME ZONE 'Asia/Bangkok' - interval '1 millisecond';
      v_evidence := jsonb_build_object(
        'policy_type', v_policy,
        'evidence_source', 'verified_booking',
        'booking_status', v_selected.booking_status,
        'original_date', v_selected.date,
        'expires_at', v_expires_at
      );
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

      IF v_selected.course_name = 'private' THEN
        SELECT max(tier.min_sessions) INTO v_private_tier_min
        FROM public.pricing_tiers tier
        WHERE tier.course_type_id = v_selected.course_type_id
          AND tier.min_sessions <= v_selected.total_sessions
          AND tier.valid_from <= timezone('Asia/Bangkok', v_verified_at)::date
          AND (tier.valid_to IS NULL OR tier.valid_to >= timezone('Asia/Bangkok', v_verified_at)::date);

        IF v_private_tier_min IS NULL THEN
          RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_TIER_EVIDENCE_MISSING';
        END IF;

        SELECT count(*) INTO v_tier_count
        FROM public.pricing_tiers tier
        WHERE tier.course_type_id = v_selected.course_type_id
          AND tier.min_sessions = v_private_tier_min
          AND tier.valid_from <= timezone('Asia/Bangkok', v_verified_at)::date
          AND (tier.valid_to IS NULL OR tier.valid_to >= timezone('Asia/Bangkok', v_verified_at)::date);
      ELSE
        SELECT count(*) INTO v_tier_count
        FROM public.pricing_tiers tier
        WHERE tier.course_type_id = v_selected.course_type_id
          AND tier.min_sessions <= v_selected.total_sessions
          AND (tier.max_sessions IS NULL OR v_selected.total_sessions <= tier.max_sessions)
          AND tier.valid_from <= timezone('Asia/Bangkok', v_verified_at)::date
          AND (tier.valid_to IS NULL OR tier.valid_to >= timezone('Asia/Bangkok', v_verified_at)::date);
      END IF;

      IF v_tier_count = 0 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_TIER_EVIDENCE_MISSING';
      END IF;
      IF v_tier_count <> 1 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LESSON_WALLET_TIER_EVIDENCE_AMBIGUOUS';
      END IF;

      IF v_selected.course_name = 'private' THEN
        SELECT tier.* INTO v_tier
        FROM public.pricing_tiers tier
        WHERE tier.course_type_id = v_selected.course_type_id
          AND tier.min_sessions = v_private_tier_min
          AND tier.valid_from <= timezone('Asia/Bangkok', v_verified_at)::date
          AND (tier.valid_to IS NULL OR tier.valid_to >= timezone('Asia/Bangkok', v_verified_at)::date);
      ELSE
        SELECT tier.* INTO v_tier
        FROM public.pricing_tiers tier
        WHERE tier.course_type_id = v_selected.course_type_id
          AND tier.min_sessions <= v_selected.total_sessions
          AND (tier.max_sessions IS NULL OR v_selected.total_sessions <= tier.max_sessions)
          AND tier.valid_from <= timezone('Asia/Bangkok', v_verified_at)::date
          AND (tier.valid_to IS NULL OR tier.valid_to >= timezone('Asia/Bangkok', v_verified_at)::date);
      END IF;
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
  END IF;

  SELECT array_agg(DISTINCT group_row.coach_id) FILTER (WHERE group_row.coach_id IS NOT NULL)
  INTO v_assigned_coach_ids
  FROM public.coach_assignment_group_students membership
  JOIN public.coach_assignment_groups group_row ON group_row.id = membership.group_id
  JOIN wallet_store_members member ON member.id = membership.booking_session_id;

  IF v_expires_at IS NULL OR v_expires_at<clock_timestamp() THEN RAISE EXCEPTION 'LESSON_WALLET_ENTITLEMENT_EXPIRED'; END IF;
  IF EXISTS(SELECT 1 FROM wallet_store_members GROUP BY child_id HAVING count(*)>1) THEN RAISE EXCEPTION 'LESSON_SOURCE_IDENTITY_CONFLICT'; END IF;
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
$function$
;

CREATE OR REPLACE FUNCTION public.admin_wallet_store_v1(p_user_id uuid, p_session_id uuid, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    RETURN public.admin_wallet_store_body_v1(p_user_id,p_session_id,p_actor_id);
  END IF;
  v_guard:=public.task10_begin_source_v1(p_session_id,p_user_id);
  -- Admin timing exception; source, payment, expiry and attendance guards remain.
  v_result:=public.admin_wallet_store_body_v1(p_user_id,p_session_id,p_actor_id);
  PERFORM set_config('task10.source_write','',true);
  RETURN v_result;
END $function$
;

CREATE OR REPLACE FUNCTION public.lesson_source_transition_v1(p_actor_id uuid, p_operation text, p_id uuid, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  s record; v_credit public.lesson_wallet_credits%ROWTYPE; v_prior public.lesson_wallet_credits%ROWTYPE;
  v_source uuid; v_unit uuid; v_ids uuid[]; v_month date; v_root uuid; v_parent uuid;
  v_fp text; v_result jsonb; v_operation uuid; v_slot uuid; v_new uuid; v_credit_id uuid;
  v_retirement jsonb; v_member record; v_removed integer:=0; v_expiry timestamptz;
  v_date date; v_start time; v_end time; v_branch uuid; v_template uuid; v_reason text;
  v_now timestamptz; v_source_ids uuid[]; v_prior_ids uuid[]; v_count integer; v_had_assigned boolean;
  v_current_guard text:=current_setting('lesson_source.write',true);
  v_source_guard text:=current_setting('task10.source_write',true);
  v_admin boolean:=p_operation IN ('admin_reschedule','admin_store');
BEGIN
  IF v_admin THEN p_operation:=substring(p_operation from 7); END IF;
  IF p_actor_id IS NULL OR p_id IS NULL OR p_operation NOT IN ('reschedule','store','redeem','makeup','return_entitlement')
    OR jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION 'LESSON_SOURCE_INVALID_REQUEST'; END IF;
  PERFORM pg_advisory_xact_lock_shared(10,1);
  PERFORM pg_advisory_xact_lock_shared(10,2);
  IF v_admin OR p_operation IN ('makeup','return_entitlement') THEN
    PERFORM public.task10_require_actor_v1(p_actor_id,'makeup');
  END IF;
  IF p_operation='redeem' THEN
    SELECT * INTO v_credit FROM public.lesson_wallet_credits WHERE id=p_id;
    IF NOT FOUND OR v_credit.user_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'LESSON_SOURCE_NOT_FOUND'; END IF;
    v_source:=v_credit.original_session_id;
  ELSE v_source:=p_id; END IF;
  SELECT bs.*,b.user_id,b.course_type_id,b.status::text AS booking_status,c.name::text AS course_name INTO s
    FROM public.booking_sessions bs JOIN public.bookings b ON b.id=bs.booking_id JOIN public.course_types c ON c.id=b.course_type_id
    WHERE bs.id=v_source;
  IF NOT FOUND OR (NOT v_admin AND p_operation IN ('reschedule','store','redeem') AND s.user_id IS DISTINCT FROM p_actor_id)
    THEN RAISE EXCEPTION 'LESSON_SOURCE_NOT_FOUND'; END IF;
  v_parent:=s.user_id;
  -- Parent covers sibling quota and the whole Family unit, not unrelated families.
  PERFORM pg_advisory_xact_lock(hashtextextended('lesson-source-attendance-parent-v2|'||v_parent::text,0));
  v_root:=CASE WHEN s.course_name='kids_group' THEN public.task10_source_root_v1(v_source) ELSE v_source END;
  SELECT date_trunc('month',date)::date INTO v_month FROM public.booking_sessions WHERE id=v_root;
  -- Keep Task10 family-month ordering ahead of any booking/participant row.
  PERFORM public.task10_lock_family_months_v1(v_parent,ARRAY[v_month,(v_month+interval '1 month')::date]);
  -- Also serializes different Adult/Private sources sharing the old monthly quota.
  PERFORM pg_advisory_xact_lock(hashtextextended('lesson-source-parent|'||v_parent::text,0));
  PERFORM 1 FROM public.bookings WHERE user_id=v_parent ORDER BY id FOR UPDATE;
  PERFORM bs.id FROM public.booking_sessions bs JOIN public.bookings b ON b.id=bs.booking_id
    WHERE b.user_id=v_parent ORDER BY bs.id FOR UPDATE OF bs;
  PERFORM c.id FROM public.lesson_wallet_credits c WHERE c.user_id=v_parent ORDER BY c.id FOR UPDATE;
  PERFORM m.original_session_id FROM public.lesson_wallet_credit_members m JOIN public.lesson_wallet_credits c ON c.id=m.credit_id
    WHERE c.user_id=v_parent ORDER BY m.credit_id,m.original_session_id FOR UPDATE OF m;
  SELECT bs.*,b.user_id,b.course_type_id,b.status::text AS booking_status,c.name::text AS course_name INTO s
    FROM public.booking_sessions bs JOIN public.bookings b ON b.id=bs.booking_id JOIN public.course_types c ON c.id=b.course_type_id WHERE bs.id=v_source;
  IF s.user_id IS DISTINCT FROM v_parent OR (s.course_name='kids_group' AND public.task10_source_root_v1(v_source) IS DISTINCT FROM v_root)
    THEN RAISE EXCEPTION 'LESSON_SOURCE_CONFLICT'; END IF;
  IF s.course_name NOT IN ('kids_group','adult_group','private') THEN RAISE EXCEPTION 'LESSON_WALLET_COURSE_INVALID'; END IF;
  IF p_operation='redeem' AND (v_credit.booking_id IS DISTINCT FROM s.booking_id
    OR v_credit.course_type_id IS DISTINCT FROM s.course_type_id) THEN RAISE EXCEPTION 'LESSON_WALLET_CREDIT_STALE'; END IF;
  v_ids:=ARRAY[v_source];
  IF s.course_name='private' AND (p_operation IN ('store','return_entitlement') OR (v_admin AND p_operation='reschedule')) THEN
    SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.booking_sessions
      WHERE booking_id=s.booking_id AND date=s.date AND start_time=s.start_time AND end_time=s.end_time
      AND branch_id=s.branch_id AND schedule_slot_id=s.schedule_slot_id
      AND id=ANY(public.lesson_source_family_unit_sessions_v1(v_source));
  ELSIF p_operation='redeem' THEN
    SELECT * INTO v_credit FROM public.lesson_wallet_credits WHERE id=p_id;
    SELECT array_agg(original_session_id ORDER BY original_session_id) INTO v_ids FROM public.lesson_wallet_credit_members WHERE credit_id=p_id;
    v_ids:=coalesce(v_ids,ARRAY[v_source]);
  END IF;
  IF cardinality(v_ids) IS NULL OR cardinality(v_ids)=0 THEN RAISE EXCEPTION 'LESSON_SOURCE_CONFLICT'; END IF;
  v_unit:=CASE WHEN p_operation='redeem' THEN p_id ELSE v_ids[1] END;
  -- Normalize typed values so HH:MM and HH:MM:SS are the same request.
  IF p_operation IN ('reschedule','redeem','makeup') THEN
    v_date:=(p_payload->>'targetDate')::date; v_start:=(p_payload->>'startTime')::time;
    v_end:=(p_payload->>'endTime')::time; v_branch:=(p_payload->>'branchId')::uuid;
    v_template:=(p_payload->>'templateId')::uuid;
    IF v_date IS NULL OR v_start IS NULL OR v_end IS NULL OR v_branch IS NULL OR v_start>=v_end
      THEN RAISE EXCEPTION 'LESSON_SOURCE_INVALID_REQUEST'; END IF;
  END IF;
  v_reason:=nullif(trim(p_payload->>'reason'),'');
  IF p_payload ? 'bookingId' AND (p_payload->>'bookingId')::uuid IS DISTINCT FROM s.booking_id THEN RAISE EXCEPTION 'LESSON_SOURCE_CONFLICT'; END IF;
  IF p_operation='return_entitlement' AND v_reason IS NULL THEN RAISE EXCEPTION 'LESSON_SOURCE_INVALID_REQUEST'; END IF;
  -- Preserve the Admin API's established default to the exact source child.
  IF p_operation='makeup' AND s.course_name='kids_group' THEN
    p_payload:=p_payload||jsonb_build_object('attendingChildId',coalesce((p_payload->>'attendingChildId')::uuid,s.child_id));
  END IF;
  v_fp:=encode(extensions.digest(jsonb_build_object('date',v_date,'start',v_start,'end',v_end,'branch',v_branch,'template',v_template,
    'reason',v_reason,'attendingChildId',p_payload->>'attendingChildId','requestId',p_payload->>'requestId')::text,'sha256'),'hex');
  SELECT result INTO v_result FROM public.lesson_source_operations WHERE actor_id=p_actor_id AND operation=p_operation
    AND unit_id=v_unit AND request_fingerprint=v_fp;
  IF FOUND THEN RETURN v_result; END IF;
  IF (v_admin OR p_operation='makeup') AND (v_reason IS NULL OR length(v_reason)>1000) THEN RAISE EXCEPTION 'LESSON_SOURCE_REASON_REQUIRED'; END IF;
  IF v_admin AND nullif(p_payload->>'requestId','') IS NULL THEN RAISE EXCEPTION 'LESSON_SOURCE_INVALID_REQUEST'; END IF;
  IF v_admin OR p_operation='makeup' THEN
    p_payload:=p_payload||jsonb_build_object('policyActor','admin','policyVersion','admin-assistance-v1','reason',v_reason,
      'waivedRules',CASE WHEN p_operation='store' THEN jsonb_build_array('store_48h') WHEN p_operation='reschedule' THEN jsonb_build_array('reschedule_12h') ELSE CASE WHEN s.course_name='kids_group' THEN jsonb_build_array('destination_purchase') ELSE '[]'::jsonb END END);
  END IF;
  IF EXISTS(SELECT 1 FROM public.lesson_source_operations WHERE operation=p_operation AND unit_id=v_unit)
    THEN RAISE EXCEPTION 'LESSON_SOURCE_REPLAY_CONFLICT'; END IF;
  IF p_operation IN ('reschedule','redeem','makeup') AND (v_template IS NULL OR p_operation='redeem') THEN
    SELECT count(*),(array_agg(id ORDER BY id))[1] INTO v_count,v_template FROM public.schedule_templates
      WHERE course_type_id=s.course_type_id AND branch_id=v_branch AND day_of_week=extract(dow FROM v_date)
        AND start_time=v_start AND end_time=v_end AND is_active;
    IF v_count=0 THEN RAISE EXCEPTION 'LESSON_WALLET_TEMPLATE_NOT_FOUND'; END IF;
    IF v_count<>1 THEN RAISE EXCEPTION 'LESSON_WALLET_TEMPLATE_AMBIGUOUS'; END IF;
  END IF;
  -- Nested retirement/capacity helpers lock slots after participant rows. Claim
  -- every existing affected slot in one order without waiting, so a retrospective
  -- slot holder or an opposite-direction source transition cannot form a cycle.
  PERFORM ss.id FROM public.schedule_slots ss
    WHERE ss.id IN (SELECT schedule_slot_id FROM public.booking_sessions WHERE id=ANY(v_ids))
      OR (p_operation IN ('reschedule','redeem','makeup') AND ss.branch_id=v_branch
        AND ss.course_type_id=s.course_type_id AND ss.date=v_date AND ss.start_time=v_start)
    ORDER BY ss.id FOR UPDATE NOWAIT;
  v_now:=CASE WHEN s.course_name='kids_group' THEN public.task10_clock_v1() ELSE clock_timestamp() END;
  PERFORM a.id FROM public.attendance a WHERE a.booking_session_id=ANY(v_ids) ORDER BY a.id FOR UPDATE;
  IF s.booking_status<>'verified' OR EXISTS(SELECT 1 FROM public.booking_sessions WHERE id=ANY(v_ids) AND cancelled_at IS NOT NULL)
    THEN RAISE EXCEPTION 'LESSON_SOURCE_CONFLICT'; END IF;
  IF EXISTS(SELECT 1 FROM public.booking_sessions x WHERE x.id=ANY(v_ids) AND x.child_id IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM public.children c WHERE c.id=x.child_id AND c.parent_id=v_parent)) THEN RAISE EXCEPTION 'LESSON_SOURCE_IDENTITY_CONFLICT'; END IF;
  IF p_operation<>'redeem' AND EXISTS(SELECT 1 FROM public.booking_sessions WHERE rescheduled_from_id=ANY(v_ids))
    THEN RAISE EXCEPTION 'LESSON_SOURCE_ALREADY_USED'; END IF;
  IF p_operation IN ('reschedule','store','return_entitlement') AND (
    EXISTS(SELECT 1 FROM public.lesson_wallet_credits WHERE original_session_id=ANY(v_ids)) OR
    EXISTS(SELECT 1 FROM public.lesson_wallet_credit_members WHERE original_session_id=ANY(v_ids)))
    THEN RAISE EXCEPTION 'LESSON_SOURCE_ALREADY_USED'; END IF;
  IF p_operation='redeem' AND (v_credit.status<>'active' OR v_credit.expires_at<v_now
    OR EXISTS(SELECT 1 FROM public.booking_sessions WHERE id=ANY(v_ids) AND (status::text<>'walleted' OR is_makeup))
    OR EXISTS(SELECT 1 FROM public.booking_sessions WHERE rescheduled_from_id=ANY(v_ids)))
    THEN RAISE EXCEPTION 'LESSON_SOURCE_CREDIT_CONFLICT'; END IF;
  PERFORM set_config('lesson_source.write','authorized',true);

  IF v_admin AND EXISTS(SELECT 1 FROM public.booking_sessions x JOIN public.bookings b ON b.id=x.booking_id
    WHERE x.id=ANY(v_ids) AND x.child_id IS NULL AND (s.course_name='kids_group' OR b.learner_type::text='child')) THEN RAISE EXCEPTION 'LESSON_SOURCE_IDENTITY_CONFLICT'; END IF;
  IF v_admin AND s.course_name='kids_group' THEN PERFORM set_config('task10.source_write','authorized',true); END IF;
  IF p_operation='store' AND v_admin THEN
    v_result:=public.admin_wallet_store_v1(s.user_id,v_source,p_actor_id);
  ELSIF p_operation='store' THEN
    v_result:=public.lesson_source_previous_store_v1(p_actor_id,v_source,p_actor_id);
  ELSIF p_operation='redeem' THEN
    v_result:=public.lesson_source_previous_redeem_v1(p_actor_id,p_id,v_date,v_start,v_end,v_branch,v_template);
  ELSIF p_operation='reschedule' AND s.course_name='kids_group' AND NOT v_admin THEN
    v_result:=public.lesson_source_previous_kids_reschedule_v1(p_actor_id,v_source,v_date,v_start,v_end,v_branch,v_template);
  ELSIF v_admin AND p_operation='reschedule' AND s.course_name='private' THEN
    v_result:=public.admin_reschedule_family_v1(p_actor_id,v_source,v_ids,v_date,v_start,v_end,v_branch,v_template);
  ELSIF p_operation='return_entitlement' AND s.course_name='kids_group' THEN
    v_result:=public.lesson_source_previous_kids_return_v1(p_actor_id,v_source,v_reason);
  ELSIF p_operation='makeup' AND s.course_name='kids_group' AND public.task10_source_policy_established_v1() THEN
    v_result:=public.lesson_source_previous_kids_makeup_v1(p_actor_id,v_source,(p_payload->>'attendingChildId')::uuid,
      v_template,v_branch,v_date,v_start,v_end,(p_payload->>'requestId')::uuid);
  ELSIF p_operation='return_entitlement' THEN
    IF EXISTS(SELECT 1 FROM public.booking_sessions WHERE id=ANY(v_ids) AND
      (status::text IN ('walleted','rescheduled','cancelled') OR is_makeup OR schedule_slot_id IS NULL
       OR (date+end_time) AT TIME ZONE 'Asia/Bangkok'>=v_now))
      OR EXISTS(SELECT 1 FROM public.attendance WHERE booking_session_id=ANY(v_ids)) THEN RAISE EXCEPTION 'LESSON_SOURCE_RETURN_INELIGIBLE'; END IF;
    -- Admin's original same-month expiry is not the customer Store package policy.
    -- A redeemed descendant inherits its stored expiry and evidence, never a new age.
    SELECT array_agg(DISTINCT id) INTO v_prior_ids FROM public.lesson_wallet_credits c WHERE c.redeemed_session_id=ANY(v_ids)
      OR EXISTS(SELECT 1 FROM public.lesson_wallet_credit_members m WHERE m.credit_id=c.id AND m.redeemed_session_id=ANY(v_ids));
    IF cardinality(v_prior_ids)>1 THEN RAISE EXCEPTION 'LESSON_SOURCE_IDENTITY_CONFLICT'; END IF;
    v_expiry:=((date_trunc('month',s.date::timestamp)+interval '1 month') AT TIME ZONE 'Asia/Bangkok')-interval '1 millisecond';
    IF cardinality(v_prior_ids)=1 THEN
      SELECT * INTO v_prior FROM public.lesson_wallet_credits WHERE id=v_prior_ids[1];
      SELECT count(*) INTO v_count FROM unnest(v_ids) member_id WHERE member_id=v_prior.redeemed_session_id OR EXISTS(
        SELECT 1 FROM public.lesson_wallet_credit_members WHERE credit_id=v_prior.id AND redeemed_session_id=member_id);
      IF v_prior.status<>'redeemed' OR v_count<>cardinality(v_ids) THEN RAISE EXCEPTION 'LESSON_SOURCE_IDENTITY_CONFLICT'; END IF;
      v_expiry:=v_prior.expires_at;
    END IF;
    IF v_expiry<v_now THEN RAISE EXCEPTION 'LESSON_SOURCE_ENTITLEMENT_EXPIRED'; END IF;
    -- Preserve the existing exact-group-first / eligible Legacy audit evidence
    -- before retiring memberships. This is evidence, not a new assignment rule.
    SELECT CASE WHEN EXISTS(SELECT 1 FROM public.coach_assignment_groups WHERE schedule_slot_id=s.schedule_slot_id)
      THEN EXISTS(SELECT 1 FROM public.coach_assignment_groups g JOIN public.coach_assignment_group_students m ON m.group_id=g.id
        WHERE g.schedule_slot_id=s.schedule_slot_id AND g.coach_id IS NOT NULL AND m.booking_session_id=s.id)
      ELSE (s.rescheduled_from_id IS NULL OR EXISTS(SELECT 1 FROM public.lesson_wallet_credits WHERE redeemed_session_id=s.id))
        AND EXISTS(SELECT 1 FROM public.coach_assignments WHERE schedule_slot_id=s.schedule_slot_id AND coach_id IS NOT NULL)
      END INTO v_had_assigned;
    INSERT INTO public.lesson_wallet_credits(user_id,booking_id,original_session_id,child_id,branch_id,course_type_id,
      original_schedule_slot_id,original_date,original_start_time,original_end_time,status,expires_at,notes,
      entitlement_unit_type,participant_count,entitlement_policy,entitlement_started_at,entitlement_payment_id,
      entitlement_pricing_tier_id,entitlement_evidence,root_credit_id)
    SELECT s.user_id,s.booking_id,m.id,m.child_id,s.branch_id,s.course_type_id,s.schedule_slot_id,s.date,s.start_time,s.end_time,
      'active',v_expiry,'Returned by Admin attendance-gap review: '||v_reason,
      CASE WHEN s.course_name='private' THEN 'family_private' ELSE 'single' END,cardinality(v_ids),
      coalesce(v_prior.entitlement_policy,'same_month'),coalesce(v_prior.entitlement_started_at,s.date::timestamp AT TIME ZONE 'Asia/Bangkok'),
      v_prior.entitlement_payment_id,v_prior.entitlement_pricing_tier_id,v_prior.entitlement_evidence,coalesce(v_prior.root_credit_id,v_prior.id)
    FROM public.booking_sessions m WHERE m.id=v_ids[1] RETURNING id INTO v_credit_id;
    INSERT INTO public.lesson_wallet_credit_members(credit_id,original_session_id,child_id,original_schedule_slot_id,original_date,original_start_time,original_end_time,branch_id)
      SELECT v_credit_id,id,child_id,schedule_slot_id,date,start_time,end_time,branch_id FROM public.booking_sessions WHERE id=ANY(v_ids) ORDER BY id;
    UPDATE public.booking_sessions SET status='walleted' WHERE id=ANY(v_ids);
    FOR v_member IN SELECT unnest(v_ids) AS id LOOP
      PERFORM public.retire_coach_assignment_membership_v1(v_member.id,p_actor_id,'wallet_store');
    END LOOP;
    PERFORM public.progressive_refresh_slot_capacity_v1(ARRAY[s.schedule_slot_id]);
    v_result:=jsonb_build_object('success',true,'creditId',v_credit_id,'participantCount',cardinality(v_ids));
    INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details,ip_address) VALUES
      (p_actor_id,'attendance_gap_return_entitlement','booking_sessions',v_unit,v_result||jsonb_build_object('reason',v_reason,
        'participantSessionIds',v_ids,'scheduleSlotId',s.schedule_slot_id,'requestedSessionId',s.id,
        'hadAssignedCoach',v_had_assigned,'existingCreditId',NULL),nullif(split_part(p_payload->>'ipAddress',',',1),'')::inet);
    INSERT INTO public.notifications(user_id,title,message,type,link_url) VALUES(s.user_id,'คืนสิทธิ์วันเรียนเข้ากระเป๋าแล้ว',
      'Admin คืนสิทธิ์รอบ '||s.date::text||' '||s.start_time::text||'-'||s.end_time::text||' เข้ากระเป๋าวันเรียนแล้ว เหตุผล: '||v_reason,'schedule','/dashboard/lesson-wallet');
  ELSE
    IF s.is_makeup OR s.schedule_slot_id IS NULL THEN RAISE EXCEPTION 'LESSON_SOURCE_CONFLICT'; END IF;
    IF p_operation='reschedule' THEN
      IF s.status::text<>'scheduled' OR (NOT v_admin AND (s.date+s.start_time) AT TIME ZONE 'Asia/Bangkok'<v_now+interval '12 hours')
        OR date_trunc('month',v_date)<>date_trunc('month',s.date) OR EXISTS(SELECT 1 FROM public.attendance WHERE booking_session_id=s.id)
        THEN RAISE EXCEPTION 'LESSON_SOURCE_RESCHEDULE_INELIGIBLE'; END IF;
      IF ROW(s.date,s.start_time,s.end_time,s.branch_id)=ROW(v_date,v_start,v_end,v_branch) THEN RAISE EXCEPTION 'LESSON_SOURCE_SAME_SLOT'; END IF;
    ELSE
      IF NOT EXISTS(SELECT 1 FROM public.attendance a WHERE a.booking_session_id=s.id
        AND a.student_id=coalesce(s.child_id,s.user_id) AND a.status::text='absent') THEN RAISE EXCEPTION 'LESSON_SOURCE_ABSENCE_REQUIRED'; END IF;
      IF NOT(s.status::text='absent' OR (s.status::text='scheduled' AND (s.date+s.end_time) AT TIME ZONE 'Asia/Bangkok'<v_now))
        OR date_trunc('month',v_date)<>date_trunc('month',s.date)+interval '1 month'
        OR v_now>=(CASE WHEN s.course_name IN ('adult_group','private')
          THEN (date_trunc('month',s.date::timestamp)+interval '2 months') AT TIME ZONE 'Asia/Bangkok'
          ELSE (date_trunc('month',s.date)+interval '2 months') AT TIME ZONE 'Asia/Bangkok' END)
        OR EXISTS(SELECT 1 FROM public.attendance WHERE booking_session_id=s.id AND status::text IN ('present','late'))
        THEN RAISE EXCEPTION 'LESSON_SOURCE_MAKEUP_INELIGIBLE'; END IF;
      IF EXISTS(SELECT 1 FROM public.lesson_wallet_credits WHERE original_session_id=s.id)
        OR EXISTS(SELECT 1 FROM public.lesson_wallet_credit_members WHERE original_session_id=s.id) THEN RAISE EXCEPTION 'LESSON_SOURCE_ALREADY_USED'; END IF;
      SELECT array_agg(x.id ORDER BY x.id) INTO v_source_ids FROM public.booking_sessions x JOIN public.bookings b ON b.id=x.booking_id
        WHERE x.date>=date_trunc('month',s.date)::date AND x.date<(date_trunc('month',s.date)+interval '1 month')::date
          AND x.child_id IS NOT DISTINCT FROM s.child_id AND (s.child_id IS NOT NULL OR b.user_id=s.user_id);
      IF EXISTS(SELECT 1 FROM public.booking_sessions WHERE is_makeup AND rescheduled_from_id=ANY(v_source_ids))
        THEN RAISE EXCEPTION 'LESSON_SOURCE_QUOTA_CONFLICT'; END IF;
    END IF;
    -- Preserve the separate legacy overlap predicates. Task2 is not implemented.
    IF EXISTS(SELECT 1 FROM public.booking_sessions x JOIN public.bookings b ON b.id=x.booking_id
      WHERE b.user_id=s.user_id AND x.child_id IS NOT DISTINCT FROM s.child_id AND x.date=v_date AND x.start_time<v_end AND x.end_time>v_start
      AND x.status::text NOT IN ('rescheduled','walleted')
      AND (p_operation='makeup' OR (x.id<>s.id AND b.status::text<>'cancelled' AND x.cancelled_at IS NULL)))
      THEN RAISE EXCEPTION 'LESSON_SOURCE_TARGET_CONFLICT'; END IF;
    v_slot:=public.task10_target_slot_v1(s.course_type_id,v_template,v_branch,v_date,v_start,v_end);
    v_now:=clock_timestamp();
    IF (v_date+v_start) AT TIME ZONE 'Asia/Bangkok'<=v_now THEN RAISE EXCEPTION 'LESSON_SOURCE_TARGET_STARTED'; END IF;
    IF p_operation='reschedule' AND NOT v_admin AND (s.date+s.start_time) AT TIME ZONE 'Asia/Bangkok'<v_now+interval '12 hours'
      THEN RAISE EXCEPTION 'LESSON_SOURCE_RESCHEDULE_INELIGIBLE'; END IF;
    IF p_operation='reschedule' THEN UPDATE public.booking_sessions SET status='rescheduled' WHERE id=s.id; END IF;
    INSERT INTO public.booking_sessions(booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup,rescheduled_from_id)
      VALUES(s.booking_id,v_slot,v_date,v_start,v_end,v_branch,s.child_id,'scheduled',p_operation='makeup',s.id) RETURNING id INTO v_new;
    IF p_operation='reschedule' THEN
      v_retirement:=public.retire_coach_assignment_membership_v1(s.id,p_actor_id,'reschedule_out');
      v_result:=jsonb_build_object('sessionId',v_new,'scheduleSlotId',v_slot,'assignmentRetirement',v_retirement);
    ELSE
      -- The monthly set remains quota evidence; only this exact source is consumed.
      IF s.course_name='kids_group' THEN
        -- Inactive Kids compatibility is protected; its delegate/rules are unchanged.
        UPDATE public.booking_sessions SET status='absent' WHERE id=ANY(v_source_ids) AND status::text='scheduled';
      ELSE
        UPDATE public.booking_sessions SET status='absent' WHERE id=s.id AND status::text='scheduled';
      END IF;
      SELECT jsonb_build_object('success',true,'data',to_jsonb(x)) INTO v_result FROM public.booking_sessions x WHERE id=v_new;
      PERFORM public.lesson_source_notify_v1(ARRAY[s.user_id],'ได้รับวันชดเชยแล้ว',
        'Admin จัดวันชดเชยให้วันที่ '||v_date::text||' เวลา '||left(v_start::text,5)||'-'||left(v_end::text,5)||' เรียบร้อยแล้ว',
        '/dashboard/schedule','schedule',true);
    END IF;
    PERFORM public.progressive_refresh_slot_capacity_v1(ARRAY[s.schedule_slot_id,v_slot]);
  END IF;
  -- Delegate helpers may wait after transaction start. Validate real boundaries
  -- before final effects; a typed exception rolls the whole atomic unit back.
  IF s.course_name IN ('adult_group','private') AND p_operation IN ('store','redeem') THEN
    v_now:=clock_timestamp();
    IF p_operation='store' AND NOT v_admin AND EXISTS(SELECT 1 FROM public.booking_sessions x WHERE x.id=ANY(v_ids)
      AND (x.date+x.start_time) AT TIME ZONE 'Asia/Bangkok'<=v_now+interval '48 hours') THEN
      RAISE EXCEPTION 'LESSON_WALLET_UNIT_NOT_STORABLE';
    ELSIF p_operation='redeem' AND (v_date+v_start) AT TIME ZONE 'Asia/Bangkok'<=v_now THEN
      RAISE EXCEPTION 'LESSON_WALLET_TARGET_STARTED';
    END IF;
  END IF;
  -- Notification/audit completion is part of the same commit, not an HTTP retry side effect.
  v_result:=public.lesson_source_effects_v1(p_actor_id,p_operation,v_source,v_result,p_payload);
  IF v_admin OR p_operation='makeup' THEN
    INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details) VALUES(
      p_actor_id,'admin_lesson_assistance','booking_session',v_source,jsonb_build_object(
        'operation',p_operation,'reason',v_reason,'policyActor','admin','policyVersion','admin-assistance-v1',
        'waivedRules',p_payload->'waivedRules','sourceSessionIds',v_ids,'requestId',p_payload->>'requestId',
        'targetDate',v_date,'startTime',v_start,'endTime',v_end,'branchId',v_branch,'templateId',v_template,'result',v_result));
  END IF;
  INSERT INTO public.lesson_source_operations(actor_id,operation,unit_id,request_fingerprint,result)
    VALUES(p_actor_id,p_operation,v_unit,v_fp,v_result) RETURNING id INTO v_operation;
  PERFORM set_config('task10.source_write',coalesce(v_source_guard,''),true);
  PERFORM set_config('lesson_source.write',coalesce(v_current_guard,''),true);
  RETURN v_result;
END $function$
;

CREATE OR REPLACE FUNCTION public.task10_target_slot_v1(p_course_id uuid, p_template_id uuid, p_branch_id uuid, p_date date, p_start time without time zone, p_end time without time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_count integer; v_slot public.schedule_slots%ROWTYPE; v_max integer;
BEGIN
  PERFORM public.branch_date_assert_open_v1(p_branch_id,p_date);
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
END $function$
;

CREATE FUNCTION public.admin_consume_family_makeup_v1(p_actor_id uuid,p_source_session_id uuid,p_attending_child_id uuid,p_template_id uuid,p_branch_id uuid,p_target_date date,p_start_time time,p_end_time time,p_request_id uuid,p_reason text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.lesson_source_transition_v1(p_actor_id,'makeup',p_source_session_id,jsonb_build_object('targetDate',p_target_date,'startTime',p_start_time,'endTime',p_end_time,'branchId',p_branch_id,'templateId',p_template_id,'attendingChildId',p_attending_child_id,'requestId',p_request_id,'reason',p_reason))
$$;
REVOKE ALL ON FUNCTION public.admin_consume_family_makeup_v1(uuid,uuid,uuid,uuid,uuid,date,time,time,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_consume_family_makeup_v1(uuid,uuid,uuid,uuid,uuid,date,time,time,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.admin_wallet_store_body_v1(uuid,uuid,uuid),public.admin_wallet_store_v1(uuid,uuid,uuid),public.task10_family_makeup_facts_v1(uuid,date) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.admin_lesson_sessions_v1(p_actor_id uuid,p_month date,p_search text DEFAULT '',p_branch uuid DEFAULT NULL,p_course text DEFAULT NULL,p_page integer DEFAULT 1,p_session uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_items jsonb;v_total bigint;v_from date;v_to date;
BEGIN
  PERFORM public.task10_require_actor_v1(p_actor_id,'makeup');
  IF p_month IS NULL OR p_month<>date_trunc('month',p_month)::date OR p_page IS NULL OR p_page<1 OR p_page>100000 OR length(p_search)>200
    OR (p_course IS NOT NULL AND p_course NOT IN ('kids_group','adult_group','private')) THEN RAISE EXCEPTION 'LESSON_SOURCE_INVALID_REQUEST'; END IF;
  v_from:=greatest(p_month,(clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date);v_to:=(p_month+interval '1 month')::date;
  WITH candidates AS (
    SELECT s.id,s.booking_id,s.child_id,b.user_id,s.branch_id,s.schedule_slot_id,s.date,s.start_time,s.end_time,s.status::text,s.is_makeup,
      c.id AS course_type_id,c.name::text AS course_type,br.name AS branch_name,p.full_name AS parent_name,
      ch.full_name AS child_full_name,ch.nickname AS child_nickname,
      CASE WHEN s.child_id IS NOT NULL THEN ch.id IS NOT NULL ELSE c.name::text<>'kids_group' AND coalesce(b.learner_type::text,'self')<>'child' END AS identity_valid,
      EXISTS(SELECT 1 FROM public.attendance a WHERE a.booking_session_id=s.id) AS has_attendance,
      (SELECT jsonb_agg(jsonb_build_object('studentId',a.student_id,'status',a.status)) FROM public.attendance a
        WHERE a.booking_session_id=s.id AND a.student_id=coalesce(s.child_id,b.user_id)) AS attendance,
      EXISTS(SELECT 1 FROM public.branch_date_closures x WHERE x.branch_id=s.branch_id AND x.closure_date=s.date AND x.is_active) AS branch_closed
    FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id JOIN public.course_types c ON c.id=b.course_type_id
    JOIN public.branches br ON br.id=s.branch_id JOIN public.profiles p ON p.id=b.user_id LEFT JOIN public.children ch ON ch.id=s.child_id AND ch.parent_id=b.user_id
    WHERE b.status::text='verified' AND NOT s.is_makeup AND s.cancelled_at IS NULL
      AND ((p_session IS NOT NULL AND s.id=p_session) OR (p_session IS NULL AND s.status::text='scheduled' AND s.date>=v_from AND s.date<v_to))
      AND (p_branch IS NULL OR s.branch_id=p_branch) AND (p_course IS NULL OR c.name::text=p_course)
      AND (p_search='' OR concat_ws(' ',p.full_name,ch.full_name,ch.nickname,br.name) ILIKE '%'||p_search||'%')
  ), paged AS (SELECT * FROM candidates ORDER BY date,start_time,id LIMIT 40 OFFSET (p_page-1)*40)
  SELECT coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY date,start_time,id) FROM paged t),'[]'),(SELECT count(*) FROM candidates)
    INTO v_items,v_total;
  RETURN jsonb_build_object('items',v_items,'total',v_total,'page',p_page,'pageSize',40);
END $$;
REVOKE ALL ON FUNCTION public.admin_lesson_sessions_v1(uuid,date,text,uuid,text,integer,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_lesson_sessions_v1(uuid,date,text,uuid,text,integer,uuid) TO service_role;


NOTIFY pgrst,'reload schema';
COMMIT;