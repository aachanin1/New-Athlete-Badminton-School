-- Current-step transitions, never a lifetime lock on a canonical root.
-- Install only in an explicitly authorized database. No backfill or control change.
BEGIN;

CREATE TABLE public.lesson_source_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  operation text NOT NULL CHECK (operation IN ('reschedule','store','redeem','makeup','return_entitlement')),
  unit_id uuid NOT NULL,
  request_fingerprint text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (actor_id,operation,unit_id,request_fingerprint)
);
ALTER TABLE public.lesson_source_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lesson_source_operations FROM PUBLIC,anon,authenticated,service_role;

-- Preserve all established Kids and historical entitlement calculations. Only the
-- shared entry below may call these bodies after acquiring its common locks.
ALTER FUNCTION public.lesson_wallet_store_v2(uuid,uuid,uuid) RENAME TO lesson_source_previous_store_v1;
ALTER FUNCTION public.lesson_wallet_redeem_v2(uuid,uuid,date,time,time,uuid,uuid) RENAME TO lesson_source_previous_redeem_v1;
ALTER FUNCTION public.task10_reschedule_kids_v1(uuid,uuid,date,time,time,uuid,uuid) RENAME TO lesson_source_previous_kids_reschedule_v1;
ALTER FUNCTION public.task10_return_kids_entitlement_v1(uuid,uuid,text) RENAME TO lesson_source_previous_kids_return_v1;
ALTER FUNCTION public.task10_consume_family_makeup_v1(uuid,uuid,uuid,uuid,uuid,date,time,time,uuid) RENAME TO lesson_source_previous_kids_makeup_v1;
REVOKE ALL ON FUNCTION public.lesson_source_previous_store_v1(uuid,uuid,uuid),
  public.lesson_source_previous_redeem_v1(uuid,uuid,date,time,time,uuid,uuid),
  public.lesson_source_previous_kids_reschedule_v1(uuid,uuid,date,time,time,uuid,uuid),
  public.lesson_source_previous_kids_return_v1(uuid,uuid,text),
  public.lesson_source_previous_kids_makeup_v1(uuid,uuid,uuid,uuid,uuid,date,time,time,uuid)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.lesson_source_transition_v1(p_actor_id uuid,p_operation text,p_id uuid,p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  s record; v_credit public.lesson_wallet_credits%ROWTYPE; v_prior public.lesson_wallet_credits%ROWTYPE;
  v_source uuid; v_unit uuid; v_ids uuid[]; v_month date; v_root uuid; v_parent uuid;
  v_fp text; v_result jsonb; v_operation uuid; v_slot uuid; v_new uuid; v_credit_id uuid;
  v_retirement jsonb; v_member record; v_removed integer:=0; v_expiry timestamptz;
  v_date date; v_start time; v_end time; v_branch uuid; v_template uuid; v_reason text;
  v_now timestamptz; v_source_ids uuid[]; v_prior_ids uuid[]; v_count integer; v_had_assigned boolean;
  v_current_guard text:=current_setting('lesson_source.write',true);
BEGIN
  IF p_actor_id IS NULL OR p_id IS NULL OR p_operation NOT IN ('reschedule','store','redeem','makeup','return_entitlement')
    OR jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION 'LESSON_SOURCE_INVALID_REQUEST'; END IF;
  -- Acquire before all policy, family, booking, session and attendance locks.
  -- Attendance takes the shared side BEFORE the executor locks UPDATE tuples.
  PERFORM pg_advisory_xact_lock(hashtextextended('lesson-source-attendance-admission-v1',0));
  PERFORM pg_advisory_xact_lock_shared(10,1);
  PERFORM pg_advisory_xact_lock_shared(10,2);
  IF p_operation IN ('makeup','return_entitlement') THEN
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
  IF NOT FOUND OR (p_operation IN ('reschedule','store','redeem') AND s.user_id IS DISTINCT FROM p_actor_id)
    THEN RAISE EXCEPTION 'LESSON_SOURCE_NOT_FOUND'; END IF;
  v_parent:=s.user_id;
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
  IF s.course_name='private' AND p_operation IN ('store','return_entitlement') THEN
    SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.booking_sessions
      WHERE booking_id=s.booking_id AND date=s.date AND start_time=s.start_time AND end_time=s.end_time
      AND branch_id=s.branch_id AND schedule_slot_id=s.schedule_slot_id;
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
  IF EXISTS(SELECT 1 FROM public.lesson_source_operations WHERE operation=p_operation AND unit_id=v_unit)
    THEN RAISE EXCEPTION 'LESSON_SOURCE_REPLAY_CONFLICT'; END IF;
  IF p_operation IN ('reschedule','redeem','makeup') AND (v_template IS NULL OR p_operation='redeem') THEN
    SELECT count(*),(array_agg(id ORDER BY id))[1] INTO v_count,v_template FROM public.schedule_templates
      WHERE course_type_id=s.course_type_id AND branch_id=v_branch AND day_of_week=extract(dow FROM v_date)
        AND start_time=v_start AND end_time=v_end AND is_active;
    IF v_count=0 THEN RAISE EXCEPTION 'LESSON_WALLET_TEMPLATE_NOT_FOUND'; END IF;
    IF v_count<>1 THEN RAISE EXCEPTION 'LESSON_WALLET_TEMPLATE_AMBIGUOUS'; END IF;
  END IF;
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

  IF p_operation='store' THEN
    v_result:=public.lesson_source_previous_store_v1(p_actor_id,v_source,p_actor_id);
  ELSIF p_operation='redeem' THEN
    v_result:=public.lesson_source_previous_redeem_v1(p_actor_id,p_id,v_date,v_start,v_end,v_branch,v_template);
  ELSIF p_operation='reschedule' AND s.course_name='kids_group' THEN
    v_result:=public.lesson_source_previous_kids_reschedule_v1(p_actor_id,v_source,v_date,v_start,v_end,v_branch,v_template);
  ELSIF p_operation='return_entitlement' AND s.course_name='kids_group' THEN
    v_result:=public.lesson_source_previous_kids_return_v1(p_actor_id,v_source,v_reason);
  ELSIF p_operation='makeup' AND s.course_name='kids_group' AND public.task10_source_policy_established_v1() THEN
    v_result:=public.lesson_source_previous_kids_makeup_v1(p_actor_id,v_source,(p_payload->>'attendingChildId')::uuid,
      v_template,v_branch,v_date,v_start,v_end,(p_payload->>'requestId')::uuid);
  ELSIF p_operation='return_entitlement' THEN
    IF EXISTS(SELECT 1 FROM public.booking_sessions WHERE id=ANY(v_ids) AND
      (status::text NOT IN ('scheduled','absent') OR is_makeup OR schedule_slot_id IS NULL
       OR (date+end_time) AT TIME ZONE 'Asia/Bangkok'>=v_now))
      OR EXISTS(SELECT 1 FROM public.attendance WHERE booking_session_id=ANY(v_ids)) THEN RAISE EXCEPTION 'LESSON_SOURCE_RETURN_INELIGIBLE'; END IF;
    -- Admin's original same-month expiry is not the customer Store package policy.
    -- A redeemed descendant inherits its stored expiry and evidence, never a new age.
    SELECT array_agg(DISTINCT id) INTO v_prior_ids FROM public.lesson_wallet_credits c WHERE c.redeemed_session_id=ANY(v_ids)
      OR EXISTS(SELECT 1 FROM public.lesson_wallet_credit_members m WHERE m.credit_id=c.id AND m.redeemed_session_id=ANY(v_ids));
    IF cardinality(v_prior_ids)>1 THEN RAISE EXCEPTION 'LESSON_SOURCE_IDENTITY_CONFLICT'; END IF;
    v_expiry:=((date_trunc('month',s.date)+interval '1 month') AT TIME ZONE 'Asia/Bangkok')-interval '1 millisecond';
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
      IF s.status::text<>'scheduled' OR (s.date+s.start_time) AT TIME ZONE 'Asia/Bangkok'<v_now+interval '12 hours'
        OR date_trunc('month',v_date)<>date_trunc('month',s.date) OR EXISTS(SELECT 1 FROM public.attendance WHERE booking_session_id=s.id)
        THEN RAISE EXCEPTION 'LESSON_SOURCE_RESCHEDULE_INELIGIBLE'; END IF;
      IF ROW(s.date,s.start_time,s.end_time,s.branch_id)=ROW(v_date,v_start,v_end,v_branch) THEN RAISE EXCEPTION 'LESSON_SOURCE_SAME_SLOT'; END IF;
    ELSE
      IF NOT(s.status::text='absent' OR (s.status::text='scheduled' AND (s.date+s.end_time) AT TIME ZONE 'Asia/Bangkok'<v_now))
        OR date_trunc('month',v_date)<>date_trunc('month',s.date)+interval '1 month'
        OR v_now>=(date_trunc('month',s.date)+interval '2 months') AT TIME ZONE 'Asia/Bangkok'
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
    IF p_operation='reschedule' AND (s.date+s.start_time) AT TIME ZONE 'Asia/Bangkok'<v_now+interval '12 hours'
      THEN RAISE EXCEPTION 'LESSON_SOURCE_RESCHEDULE_INELIGIBLE'; END IF;
    IF p_operation='reschedule' THEN UPDATE public.booking_sessions SET status='rescheduled' WHERE id=s.id; END IF;
    INSERT INTO public.booking_sessions(booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup,rescheduled_from_id)
      VALUES(s.booking_id,v_slot,v_date,v_start,v_end,v_branch,s.child_id,'scheduled',p_operation='makeup',s.id) RETURNING id INTO v_new;
    IF p_operation='reschedule' THEN
      v_retirement:=public.retire_coach_assignment_membership_v1(s.id,p_actor_id,'reschedule_out');
      v_result:=jsonb_build_object('sessionId',v_new,'scheduleSlotId',v_slot,'assignmentRetirement',v_retirement);
    ELSE
      -- Established fallback side effect is retained, not changed into attendance writes.
      UPDATE public.booking_sessions SET status='absent' WHERE id=ANY(v_source_ids) AND status::text='scheduled';
      SELECT jsonb_build_object('success',true,'data',to_jsonb(x)) INTO v_result FROM public.booking_sessions x WHERE id=v_new;
      PERFORM public.lesson_source_notify_v1(ARRAY[s.user_id],'ได้รับวันชดเชยแล้ว',
        'Admin จัดวันชดเชยให้วันที่ '||v_date::text||' เวลา '||left(v_start::text,5)||'-'||left(v_end::text,5)||' เรียบร้อยแล้ว',
        '/dashboard/schedule','schedule',true);
    END IF;
    PERFORM public.progressive_refresh_slot_capacity_v1(ARRAY[s.schedule_slot_id,v_slot]);
  END IF;
  -- Notification/audit completion is part of the same commit, not an HTTP retry side effect.
  v_result:=public.lesson_source_effects_v1(p_actor_id,p_operation,v_source,v_result,p_payload);
  INSERT INTO public.lesson_source_operations(actor_id,operation,unit_id,request_fingerprint,result)
    VALUES(p_actor_id,p_operation,v_unit,v_fp,v_result) RETURNING id INTO v_operation;
  PERFORM set_config('lesson_source.write',coalesce(v_current_guard,''),true);
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.lesson_source_transition_v1(uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.lesson_source_transition_v1(uuid,text,uuid,jsonb) TO service_role;

CREATE FUNCTION public.lesson_source_effects_v1(p_actor uuid,p_operation text,p_source uuid,p_result jsonb,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE s record; n record; c record; v_title text; v_message text; v_link text; v_unit text; v_old text; v_new text;
  v_recipients uuid[]; v_old_recipients uuid[]; v_target uuid; v_removed integer; v_warning boolean:=false;
  v_active uuid[]; v_assigned uuid[]; v_unassigned uuid[]; v_details jsonb; v_action text; v_entity uuid;
  v_recipient_count integer:=0; v_inserted_count integer:=0; v_failures jsonb:='[]'::jsonb;
BEGIN
  IF p_operation NOT IN ('reschedule','store','redeem') THEN RETURN p_result; END IF;
  SELECT bs.*,b.user_id,coalesce(p.full_name,'ผู้ใช้') AS user_name,coalesce(br.name,'สาขาเดิม') AS branch_name
    INTO s FROM public.booking_sessions bs JOIN public.bookings b ON b.id=bs.booking_id
    LEFT JOIN public.profiles p ON p.id=b.user_id LEFT JOIN public.branches br ON br.id=bs.branch_id WHERE bs.id=p_source;
  IF p_operation='reschedule' THEN
    SELECT bs.*,coalesce(br.name,'สาขาใหม่') AS branch_name INTO n FROM public.booking_sessions bs
      LEFT JOIN public.branches br ON br.id=bs.branch_id WHERE bs.id=(p_result->>'sessionId')::uuid;
    v_old:=s.date::text||' '||left(s.start_time::text,5)||'-'||left(s.end_time::text,5)||' ที่ '||s.branch_name;
    v_new:=n.date::text||' '||left(n.start_time::text,5)||'-'||left(n.end_time::text,5)||' ที่ '||n.branch_name;
    v_removed:=coalesce((p_result->'assignmentRetirement'->>'removed_count')::integer,0);
    v_title:='Reschedule เปลี่ยนรายชื่อรอบสอน ต้องตรวจการมอบหมาย';
    v_message:=s.user_name||' เปลี่ยนรอบเรียนจาก '||v_old||' เป็น '||v_new||' นักเรียนในรอบใหม่ยังไม่ได้มอบหมายโค้ชอัตโนมัติ ต้องให้ Head Coach ตรวจและบันทึก/ยืนยันการมอบหมายก่อนเริ่มรอบ';
    SELECT array_agg(id) INTO v_recipients FROM public.profiles WHERE role::text IN ('admin','super_admin');
    v_warning:=coalesce(cardinality(v_recipients),0)=0;
    IF v_warning THEN v_failures:=v_failures||jsonb_build_array(jsonb_build_object('audience','admin','stage','recipient_empty','message','Required admin recipient set is empty')); END IF;
    v_recipient_count:=v_recipient_count+coalesce(cardinality(v_recipients),0);
    v_inserted_count:=v_inserted_count+public.lesson_source_notify_v1(v_recipients,v_title,v_message,'/admin/schedules','system',true);
    SELECT array_agg(DISTINCT cb.coach_id) INTO v_recipients FROM public.coach_branches cb JOIN public.profiles p ON p.id=cb.coach_id
      WHERE cb.branch_id=n.branch_id AND p.role::text='head_coach';
    v_warning:=v_warning OR coalesce(cardinality(v_recipients),0)=0;
    IF coalesce(cardinality(v_recipients),0)=0 THEN v_failures:=v_failures||jsonb_build_array(jsonb_build_object('audience','new_branch_head_coach','stage','recipient_empty','message','Required new_branch_head_coach recipient set is empty')); END IF;
    v_recipient_count:=v_recipient_count+coalesce(cardinality(v_recipients),0);
    v_inserted_count:=v_inserted_count+public.lesson_source_notify_v1(v_recipients,'มีนักเรียนย้ายเข้ารอบ ต้องตรวจและบันทึกการมอบหมาย',
      s.user_name||' ย้ายเข้ารอบ '||v_new||' โดยยังไม่ได้มอบหมายโค้ชอัตโนมัติ กรุณาตรวจกลุ่มและกดบันทึก/ยืนยันการมอบหมายก่อนเริ่มรอบ',
      '/coach/assign-groups?month='||left(n.date::text,7),'system',true);
    IF v_removed>0 THEN
      SELECT array_agg(DISTINCT cb.coach_id) INTO v_recipients FROM public.coach_branches cb JOIN public.profiles p ON p.id=cb.coach_id
        WHERE cb.branch_id=s.branch_id AND p.role::text='head_coach';
      v_warning:=v_warning OR coalesce(cardinality(v_recipients),0)=0;
      IF coalesce(cardinality(v_recipients),0)=0 THEN v_failures:=v_failures||jsonb_build_array(jsonb_build_object('audience','old_branch_head_coach','stage','recipient_empty','message','Required old_branch_head_coach recipient set is empty')); END IF;
      v_recipient_count:=v_recipient_count+coalesce(cardinality(v_recipients),0);
      v_inserted_count:=v_inserted_count+public.lesson_source_notify_v1(v_recipients,'รายชื่อรอบเดิมเปลี่ยน ต้องตรวจและบันทึกการมอบหมายใหม่',
        s.user_name||' ย้ายออกจากรอบ '||v_old||' ระบบถอดเฉพาะสมาชิกเดิมออกแล้ว กรุณาตรวจรายชื่อและกดบันทึก/ยืนยันการมอบหมายใหม่ โดยระบบไม่ได้มอบหมายหรือบันทึก attendance อัตโนมัติ',
        '/coach/assign-groups?month='||left(s.date::text,7),'system',true);
    END IF;
    v_action:='reschedule_booking_session'; v_entity:=s.id;
    v_details:=jsonb_build_object('newSessionId',n.id,'oldDate',s.date,'oldStartTime',s.start_time,'newDate',n.date,'newStartTime',n.start_time,
      'branchId',n.branch_id,'scheduleSlotId',n.schedule_slot_id,'removedExactMembershipCount',v_removed,
      'assignmentRetirementAuditId',p_result->'assignmentRetirement'->'audit'->'id','assignmentReviewRequired',true,'autoAssigned',false,
      'notificationDeliverySucceeded',NOT v_warning,'notificationRequiredAudienceCount',CASE WHEN v_removed>0 THEN 3 ELSE 2 END,
      'notificationRecipientCount',v_recipient_count,'notificationAttemptCount',v_recipient_count,
      'notificationSuccessfulRecipientCount',v_recipient_count,'notificationSkippedCount',v_recipient_count-v_inserted_count,
      'notificationFailedRecipientCount',0,'notificationAudienceFailureCount',jsonb_array_length(v_failures),
      'notificationFailureCount',jsonb_array_length(v_failures),'notificationFailures',v_failures);
    p_result:=p_result||jsonb_build_object('success',true,'warning',CASE WHEN v_warning THEN jsonb_build_object(
      'code','ASSIGNMENT_REVIEW_NOTIFICATION_FAILED','message','เปลี่ยนรอบสำเร็จแล้ว แต่การแจ้งเตือนผู้ตรวจการมอบหมายส่งไม่ครบ กรุณาตรวจหน้าจัดกลุ่มโค้ช') ELSE NULL END);
  ELSE
    SELECT * INTO c FROM public.lesson_wallet_credits WHERE id=(p_result->>'credit_id')::uuid;
    v_old:=public.lesson_source_slot_label_v1(c.original_date,c.original_start_time,c.original_end_time);
    v_unit:=CASE WHEN coalesce(c.participant_count,1)>1 OR (p_operation='store' AND c.entitlement_unit_type='family_private')
      THEN 'ทั้งครอบครัว '||coalesce(c.participant_count,1)::text||' คน' ELSE '1 สิทธิ์' END;
    v_entity:=c.id;
    IF p_operation='store' THEN
      v_action:='store_lesson_wallet_credit'; v_title:='ผู้เรียนเก็บรอบเรียนเข้ากระเป๋า';
      v_message:='ผู้เรียนเก็บรอบ '||v_old||' ('||v_unit||') เข้ากระเป๋าวันเรียน';
      SELECT array_agg(bs.id ORDER BY bs.id) INTO v_active FROM public.booking_sessions bs JOIN public.bookings b ON b.id=bs.booking_id
        WHERE bs.schedule_slot_id=s.schedule_slot_id AND bs.status::text IN ('scheduled','completed','absent') AND b.status::text IN ('pending_payment','paid','verified');
      SELECT array_agg(DISTINCT m.booking_session_id) INTO v_assigned FROM public.coach_assignment_group_students m
        JOIN public.coach_assignment_groups g ON g.id=m.group_id WHERE m.booking_session_id=ANY(v_active);
      SELECT array_agg(x) INTO v_unassigned FROM unnest(v_active) x WHERE NOT(x=ANY(coalesce(v_assigned,'{}'::uuid[])));
      v_details:=jsonb_build_object('policyType',c.entitlement_policy,'entitlementStartedAt',c.entitlement_started_at,'expiresAt',c.expires_at,
        'paymentId',coalesce(c.entitlement_payment_id::text,c.entitlement_evidence->>'payment_id'),
        'pricingTier',CASE WHEN coalesce(c.entitlement_pricing_tier_id::text,c.entitlement_evidence->>'pricing_tier_id') IS NULL THEN NULL ELSE
          jsonb_build_object('id',coalesce(c.entitlement_pricing_tier_id::text,c.entitlement_evidence->>'pricing_tier_id'),
            'min',coalesce((c.entitlement_evidence->>'pricing_tier_min')::numeric,0),
            'max',CASE WHEN c.entitlement_evidence->'pricing_tier_max'='null'::jsonb THEN NULL ELSE coalesce((c.entitlement_evidence->>'pricing_tier_max')::numeric,0) END,
            'unit',CASE WHEN c.entitlement_evidence->>'pricing_unit'='hour' THEN 'hour' ELSE 'session' END,
            'pricePerUnit',coalesce((c.entitlement_evidence->>'price_per_unit')::numeric,0),
            'packagePrice',coalesce((c.entitlement_evidence->>'package_price')::numeric,0),
            'validFrom',c.entitlement_evidence->>'tier_valid_from','validTo',c.entitlement_evidence->>'tier_valid_to') END,
        'entitlementEvidence',c.entitlement_evidence,'unitType',c.entitlement_unit_type,
        'participantCount',c.participant_count,'participantSessionIds',p_result->'participant_session_ids','removedAssignmentStudentIds',p_result->'removed_membership_ids',
        'postWalletAssignmentState',jsonb_build_object('activeSessionIds',coalesce(v_active,'{}'::uuid[]),'assignedSessionIds',coalesce(v_assigned,'{}'::uuid[]),
          'unassignedSessionIds',coalesce(v_unassigned,'{}'::uuid[]),'needsReview',coalesce(cardinality(v_unassigned),0)>0,'hasActiveLearners',coalesce(cardinality(v_active),0)>0));
      IF coalesce(cardinality(v_unassigned),0)>0 THEN
        SELECT array_agg(DISTINCT id) INTO v_recipients FROM (
          SELECT cb.coach_id AS id FROM public.coach_branches cb JOIN public.profiles p ON p.id=cb.coach_id WHERE cb.branch_id=s.branch_id AND p.role::text='head_coach'
          UNION SELECT jsonb_array_elements_text(coalesce(p_result->'assigned_coach_ids','[]'::jsonb))::uuid) ids;
        PERFORM public.lesson_source_notify_v1(v_recipients,'ผู้เรียนถูกย้ายเข้ากระเป๋า ต้องตรวจกลุ่มสอน',
          'ผู้เรียนเก็บรอบ '||v_old||' ('||v_unit||') เข้ากระเป๋าแล้ว และยังมีผู้เรียนที่ต้องมอบหมายโค้ชในรอบนี้',
          '/coach/assign-groups?month='||left(s.date::text,7),'schedule',false);
      END IF;
    ELSE
      v_action:='redeem_lesson_wallet_credit'; v_title:='ผู้เรียนใช้วันเรียนจากกระเป๋า';
      v_new:=public.lesson_source_slot_label_v1((p_result->>'target_date')::date,(p_result->>'target_start_time')::time,(p_result->>'target_end_time')::time);
      v_message:='ผู้เรียนใช้สิทธิ์ '||v_unit||' จากกระเป๋ามาลงรอบ '||v_new;
      SELECT array_agg(DISTINCT cb.coach_id) INTO v_recipients FROM public.coach_branches cb JOIN public.profiles p ON p.id=cb.coach_id
        WHERE cb.branch_id=(p_result->>'branch_id')::uuid AND p.role::text='head_coach';
      PERFORM public.lesson_source_notify_v1(v_recipients,v_title,'ผู้เรียนใช้สิทธิ์ '||v_unit||' จากรอบ '||v_old||' มาลงรอบ '||v_new||' กรุณาจัดกลุ่ม/มอบหมายโค้ช',
        '/coach/assign-groups?month='||left(p_result->>'target_date',7),'schedule',false);
      v_details:=jsonb_build_object('originalSessionId',c.original_session_id,'newSessionIds',p_result->'session_ids','scheduleSlotId',p_result->'schedule_slot_id',
        'targetDate',p_result->'target_date','startTime',p_result->'target_start_time','branchId',p_result->'branch_id','participantCount',p_result->'participant_count');
    END IF;
    SELECT array_agg(id) INTO v_recipients FROM public.profiles WHERE role::text IN ('admin','super_admin');
    PERFORM public.lesson_source_notify_v1(v_recipients,v_title,v_message,'/admin/schedules','schedule',false);
  END IF;
  INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details,ip_address)
    VALUES(p_actor,v_action,CASE WHEN p_operation='reschedule' THEN 'booking_session' ELSE 'lesson_wallet_credits' END,v_entity,v_details,nullif(split_part(p_payload->>'ipAddress',',',1),'')::inet);
  RETURN p_result;
END $$;

CREATE FUNCTION public.lesson_source_slot_label_v1(p_date date,p_start time,p_end time) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT extract(day FROM p_date)::integer::text||' '||
    (ARRAY['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'])[extract(month FROM p_date)::integer]
    ||' '||right((extract(year FROM p_date)::integer+543)::text,2)||' '||left(p_start::text,5)||'-'||left(p_end::text,5)
$$;
CREATE FUNCTION public.lesson_source_notify_v1(p_recipients uuid[],p_title text,p_message text,p_link text,p_type text,p_once boolean) RETURNS integer
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_inserted integer;
BEGIN
  INSERT INTO public.notifications(user_id,title,message,type,link_url)
    SELECT DISTINCT u,p_title,p_message,p_type::public.notification_type,p_link FROM unnest(p_recipients) u
    WHERE NOT p_once OR NOT EXISTS(SELECT 1 FROM public.notifications n WHERE n.user_id=u AND n.title=p_title AND n.message=p_message AND n.link_url IS NOT DISTINCT FROM p_link);
  GET DIAGNOSTICS v_inserted=ROW_COUNT;
  RETURN v_inserted;
END $$;
REVOKE ALL ON FUNCTION public.lesson_source_effects_v1(uuid,text,uuid,jsonb,jsonb),public.lesson_source_slot_label_v1(date,time,time),
  public.lesson_source_notify_v1(uuid[],text,text,text,text,boolean) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.lesson_wallet_store_v2(p_user_id uuid,p_session_id uuid,p_actor_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'LESSON_SOURCE_UNAUTHORIZED'; END IF;
  RETURN public.lesson_source_transition_v1(p_actor_id,'store',p_session_id);
END $$;
CREATE FUNCTION public.lesson_wallet_redeem_v2(p_user_id uuid,p_credit_id uuid,p_target_date date,p_start_time time,p_end_time time,p_branch_id uuid,p_schedule_template_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.lesson_source_transition_v1(p_user_id,'redeem',p_credit_id,jsonb_build_object('targetDate',p_target_date,'startTime',p_start_time,'endTime',p_end_time,'branchId',p_branch_id,'templateId',p_schedule_template_id))
$$;
CREATE FUNCTION public.task10_reschedule_kids_v1(p_user_id uuid,p_session_id uuid,p_target_date date,p_start_time time,p_end_time time,p_branch_id uuid,p_template_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.lesson_source_transition_v1(p_user_id,'reschedule',p_session_id,jsonb_build_object('targetDate',p_target_date,'startTime',p_start_time,'endTime',p_end_time,'branchId',p_branch_id,'templateId',p_template_id))
$$;
CREATE FUNCTION public.task10_return_kids_entitlement_v1(p_actor_id uuid,p_session_id uuid,p_reason text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.lesson_source_transition_v1(p_actor_id,'return_entitlement',p_session_id,jsonb_build_object('reason',p_reason))
$$;
CREATE FUNCTION public.task10_consume_family_makeup_v1(p_actor_id uuid,p_source_session_id uuid,p_attending_child_id uuid,p_template_id uuid,p_branch_id uuid,p_target_date date,p_start_time time,p_end_time time,p_request_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.lesson_source_transition_v1(p_actor_id,'makeup',p_source_session_id,jsonb_build_object('targetDate',p_target_date,'startTime',p_start_time,'endTime',p_end_time,'branchId',p_branch_id,'templateId',p_template_id,'attendingChildId',p_attending_child_id,'requestId',p_request_id))
$$;
REVOKE ALL ON FUNCTION public.lesson_wallet_store_v2(uuid,uuid,uuid),public.lesson_wallet_redeem_v2(uuid,uuid,date,time,time,uuid,uuid),
 public.task10_reschedule_kids_v1(uuid,uuid,date,time,time,uuid,uuid),public.task10_return_kids_entitlement_v1(uuid,uuid,text),
 public.task10_consume_family_makeup_v1(uuid,uuid,uuid,uuid,uuid,date,time,time,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.lesson_wallet_store_v2(uuid,uuid,uuid),public.lesson_wallet_redeem_v2(uuid,uuid,date,time,time,uuid,uuid),
 public.task10_reschedule_kids_v1(uuid,uuid,date,time,time,uuid,uuid),public.task10_return_kids_entitlement_v1(uuid,uuid,text),
 public.task10_consume_family_makeup_v1(uuid,uuid,uuid,uuid,uuid,date,time,time,uuid) TO service_role;
COMMIT;
