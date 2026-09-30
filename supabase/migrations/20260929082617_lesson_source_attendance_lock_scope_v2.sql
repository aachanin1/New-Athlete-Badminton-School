-- Parent-scoped Attendance/source coordination; no data rewrite, control or policy change.
BEGIN;

CREATE OR REPLACE FUNCTION public.lesson_source_transition_v1(p_actor_id uuid,p_operation text,p_id uuid,p_payload jsonb DEFAULT '{}'::jsonb)
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
      (status::text IN ('walleted','rescheduled','cancelled') OR is_makeup OR schedule_slot_id IS NULL
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

-- Row admission has OLD/NEW identities; statement-level admission cannot know them.
CREATE OR REPLACE FUNCTION public.lesson_source_attendance_admission_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_ids uuid[]; v_parent uuid; v_before jsonb; v_after jsonb;
BEGIN
  v_ids:=CASE WHEN TG_OP='UPDATE' THEN ARRAY[OLD.booking_session_id,NEW.booking_session_id] ELSE ARRAY[NEW.booking_session_id] END;
  SELECT jsonb_agg(jsonb_build_array(s.id,s.booking_id,b.user_id) ORDER BY s.id) INTO v_before
    FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id WHERE s.id=ANY(v_ids);
  -- UPDATE/upsert may already own Attendance tuples. Never wait on a parent or
  -- referenced row, including when a later row switches parent in a multi-row DML.
  FOR v_parent IN SELECT DISTINCT b.user_id FROM public.booking_sessions s
    JOIN public.bookings b ON b.id=s.booking_id WHERE s.id=ANY(v_ids) ORDER BY b.user_id
  LOOP
    IF NOT pg_try_advisory_xact_lock(hashtextextended('lesson-source-attendance-parent-v2|'||v_parent::text,0)) THEN
      RAISE EXCEPTION USING ERRCODE='55P03', MESSAGE='LESSON_SOURCE_ATTENDANCE_RETRY';
    END IF;
  END LOOP;
  PERFORM b.id FROM public.bookings b WHERE b.id IN
    (SELECT booking_id FROM public.booking_sessions WHERE id=ANY(v_ids)) ORDER BY b.id FOR SHARE NOWAIT;
  PERFORM s.id FROM public.booking_sessions s WHERE s.id=ANY(v_ids) ORDER BY s.id FOR SHARE NOWAIT;
  SELECT jsonb_agg(jsonb_build_array(s.id,s.booking_id,b.user_id) ORDER BY s.id) INTO v_after
    FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id WHERE s.id=ANY(v_ids);
  IF v_before IS DISTINCT FROM v_after THEN
    RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='LESSON_SOURCE_ATTENDANCE_RETRY';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.lesson_source_attendance_guard_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s record;
BEGIN
  -- Alphabetical trigger order runs admission first. All referenced booking/session
  -- rows and both OLD/NEW parent admissions remain held through transaction end.
  SELECT bs.*,b.user_id,b.status::text AS booking_status INTO s
    FROM public.booking_sessions bs JOIN public.bookings b ON b.id=bs.booking_id
    WHERE bs.id=NEW.booking_session_id;
  IF NOT FOUND OR s.booking_status='cancelled' OR s.cancelled_at IS NOT NULL
    OR s.status::text IN ('walleted','rescheduled','cancelled') THEN
    RAISE EXCEPTION 'LESSON_SOURCE_ATTENDANCE_STALE';
  END IF;
  IF NEW.student_id IS DISTINCT FROM coalesce(s.child_id,s.user_id)
    OR NEW.student_type::text IS DISTINCT FROM (CASE WHEN s.child_id IS NULL THEN 'adult' ELSE 'child' END)
    OR (s.child_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.children WHERE id=s.child_id AND parent_id=s.user_id)) THEN
    RAISE EXCEPTION 'LESSON_SOURCE_ATTENDANCE_IDENTITY_CONFLICT';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER lesson_source_attendance_admission ON public.attendance;
CREATE TRIGGER lesson_source_attendance_admission BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.lesson_source_attendance_admission_v1();
REVOKE ALL ON FUNCTION public.lesson_source_attendance_admission_v1(),public.lesson_source_attendance_guard_v1()
  FROM PUBLIC,anon,authenticated,service_role;

create or replace function public.admin_apply_retrospective_assignment_transition_v1(
  p_operation text,
  p_schedule_slot_id uuid,
  p_actor_id uuid,
  p_coach_id uuid,
  p_booking_session_ids uuid[],
  p_target_group_id uuid default null,
  p_reason text default null,
  p_attendance_by_session_id jsonb default '{}'::jsonb,
  p_test_fail_stage text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  slot_row public.schedule_slots%rowtype;
  actor_role text;
  coach_role text;
  target_session_ids uuid[] := '{}'::uuid[];
  submitted_count integer := 0;
  unique_count integer := 0;
  locked_session_count integer := 0;
  target_membership_count integer := 0;
  target_group_ids uuid[] := '{}'::uuid[];
  candidate_group_id uuid;
  source_group_id uuid;
  result_group_id uuid;
  candidate_group public.coach_assignment_groups%rowtype;
  source_group public.coach_assignment_groups%rowtype;
  move_target_group public.coach_assignment_groups%rowtype;
  session_row record;
  attendance_row public.attendance%rowtype;
  attendance_count integer;
  desired_attendance public.attendance_status;
  desired_session_status public.session_status;
  before_snapshot jsonb;
  after_snapshot jsonb;
  conflict_result jsonb;
  conflict_row jsonb;
  legacy_warnings jsonb := '[]'::jsonb;
  affected_old_coach_ids uuid[] := '{}'::uuid[];
  activity_id uuid;
  activity_created_at timestamptz;
  changed boolean := false;
  assignment_changed boolean := false;
  attendance_changed boolean := false;
  status_changed boolean := false;
  legacy_changed boolean := false;
  inserted_count integer := 0;
  deleted_count integer := 0;
  default_group_name text;
  admission_parent uuid;
  admission_identity jsonb;
  locked_admission_identity jsonb;
begin
  if p_operation not in (
    'assign_coach_to_round',
    'resolve_unassigned_round',
    'mark_attendance',
    'replace_coach_for_past_round',
    'move_learner_to_existing_coach_group'
  ) then
    raise exception using
      errcode = '22023',
      message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|unsupported_operation';
  end if;

  if p_schedule_slot_id is null or p_actor_id is null or p_coach_id is null then
    raise exception using
      errcode = '22023',
      message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|required_identity_missing';
  end if;

  select profile.role into actor_role
  from public.profiles profile
  where profile.id = p_actor_id;
  if actor_role is null or actor_role not in ('admin', 'super_admin') then
    raise exception using
      errcode = '42501',
      message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|actor_not_admin';
  end if;

  select profile.role into coach_role
  from public.profiles profile
  where profile.id = p_coach_id;
  if coach_role is null or coach_role not in ('coach', 'head_coach') then
    raise exception using
      errcode = '22023',
      message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|coach_invalid';
  end if;

  select count(*), count(distinct session_id),
    coalesce(array_agg(distinct session_id order by session_id), '{}'::uuid[])
  into submitted_count, unique_count, target_session_ids
  from unnest(coalesce(p_booking_session_ids, '{}'::uuid[])) session_id;

  if submitted_count = 0 then
    raise exception using
      errcode = '22023',
      message = 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT|target_roster_empty';
  end if;
  if submitted_count <> unique_count then
    raise exception using
      errcode = '23505',
      message = 'ADMIN_RETRO_ASSIGNMENT_DUPLICATE|duplicate_submitted_session';
  end if;
  if p_operation = 'mark_attendance' and unique_count <> 1 then
    raise exception using
      errcode = '22023',
      message = 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT|mark_attendance_requires_one_session';
  end if;
  if p_operation = 'move_learner_to_existing_coach_group' and p_target_group_id is null then
    raise exception using
      errcode = '22023',
      message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|move_target_group_missing';
  end if;
  if p_operation <> 'move_learner_to_existing_coach_group' and p_target_group_id is not null then
    raise exception using
      errcode = '22023',
      message = 'ADMIN_RETRO_ASSIGNMENT_STALE_STATE|unexpected_target_group';
  end if;

  -- This RPC already holds slot/session/booking rows when it writes Attendance.
  -- Admit every submitted parent first; TRY also handles callers holding rows. Exclusive admission also prevents
  -- opposite Attendance tuple orders within one family.
  select jsonb_agg(jsonb_build_array(s.id,s.booking_id,b.user_id) order by s.id)
    into admission_identity from public.booking_sessions s
    join public.bookings b on b.id=s.booking_id where s.id=any(target_session_ids);
  for admission_parent in
    select distinct b.user_id from public.booking_sessions s
      join public.bookings b on b.id=s.booking_id where s.id=any(target_session_ids) order by b.user_id
  loop
    if not pg_try_advisory_xact_lock(hashtextextended('lesson-source-attendance-parent-v2|'||admission_parent::text,0)) then
      raise exception using errcode='55P03',message='LESSON_SOURCE_ATTENDANCE_RETRY';
    end if;
  end loop;

  perform pg_advisory_xact_lock(hashtextextended(
    concat('admin-retrospective-assignment|', p_schedule_slot_id::text),
    0
  ));

  select * into slot_row
  from public.schedule_slots
  where id = p_schedule_slot_id
  for update;
  if slot_row.id is null then
    raise exception using
      errcode = 'P0001',
      message = 'ADMIN_RETRO_ASSIGNMENT_STALE_STATE|schedule_slot_missing';
  end if;

  perform 1
  from public.booking_sessions session_item
  where session_item.id = any(target_session_ids)
  order by session_item.id
  for update;
  get diagnostics locked_session_count = row_count;
  if locked_session_count <> unique_count then
    raise exception using
      errcode = 'P0001',
      message = 'ADMIN_RETRO_ASSIGNMENT_STALE_STATE|submitted_session_missing';
  end if;

  perform 1
  from public.bookings booking_item
  where booking_item.id in (
    select session_item.booking_id
    from public.booking_sessions session_item
    where session_item.id = any(target_session_ids)
  )
  order by booking_item.id
  for update;

  select jsonb_agg(jsonb_build_array(s.id,s.booking_id,b.user_id) order by s.id)
    into locked_admission_identity from public.booking_sessions s
    join public.bookings b on b.id=s.booking_id where s.id=any(target_session_ids);
  if locked_admission_identity is distinct from admission_identity then
    raise exception using errcode='40001',message='LESSON_SOURCE_ATTENDANCE_RETRY';
  end if;

  for session_row in
    select
      session_item.*,
      booking_item.user_id as booking_user_id,
      booking_item.branch_id as booking_branch_id,
      booking_item.course_type_id as booking_course_type_id,
      booking_item.status as booking_status,
      coalesce(session_item.child_id, booking_item.user_id) as expected_student_id,
      case when session_item.child_id is null then 'adult' else 'child' end as expected_student_type
    from public.booking_sessions session_item
    join public.bookings booking_item on booking_item.id = session_item.booking_id
    where session_item.id = any(target_session_ids)
    order by session_item.id
  loop
    if session_row.schedule_slot_id is distinct from p_schedule_slot_id
      or session_row.branch_id is distinct from slot_row.branch_id
      or session_row.booking_branch_id is distinct from slot_row.branch_id
      or session_row.booking_course_type_id is distinct from slot_row.course_type_id
      or session_row.date is distinct from slot_row.date
      or session_row.start_time is distinct from slot_row.start_time
      or session_row.end_time is distinct from slot_row.end_time then
      raise exception using
        errcode = 'P0001',
        message = 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT|slot_branch_course_or_time_mismatch';
    end if;
    if session_row.expected_student_id is null then
      raise exception using
        errcode = 'P0001',
        message = 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT|learner_identity_missing';
    end if;
    if session_row.booking_status <> 'verified' then
      raise exception using
        errcode = 'P0001',
        message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|booking_not_verified';
    end if;
    if session_row.is_makeup then
      raise exception using
        errcode = 'P0001',
        message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|makeup_session_ineligible';
    end if;
    if session_row.status not in ('scheduled', 'completed', 'absent') then
      raise exception using
        errcode = 'P0001',
        message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|session_status_ineligible';
    end if;
  end loop;

  if p_operation in (
    'assign_coach_to_round',
    'resolve_unassigned_round',
    'mark_attendance',
    'replace_coach_for_past_round'
  ) and ((slot_row.date + slot_row.end_time) at time zone 'Asia/Bangkok') >= now() then
    raise exception using
      errcode = 'P0001',
      message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|round_not_ended';
  end if;

  if p_operation in ('resolve_unassigned_round', 'mark_attendance') then
    if jsonb_typeof(coalesce(p_attendance_by_session_id, '{}'::jsonb)) <> 'object'
      or (select count(*) from jsonb_object_keys(coalesce(p_attendance_by_session_id, '{}'::jsonb))) <> unique_count
      or exists (
        select 1
        from jsonb_object_keys(coalesce(p_attendance_by_session_id, '{}'::jsonb)) attendance_key
        where attendance_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      )
      or exists (
        select 1
        from jsonb_object_keys(coalesce(p_attendance_by_session_id, '{}'::jsonb)) attendance_key
        where attendance_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          and not (attendance_key::uuid = any(target_session_ids))
      )
      or exists (
        select 1
        from unnest(target_session_ids) target_id
        where coalesce(p_attendance_by_session_id ->> target_id::text, '') not in ('present', 'late', 'absent')
      ) then
      raise exception using
        errcode = '22023',
        message = 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT|attendance_roster_or_status_invalid';
    end if;
  elsif coalesce(p_attendance_by_session_id, '{}'::jsonb) <> '{}'::jsonb then
    raise exception using
      errcode = '22023',
      message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|attendance_not_allowed_for_operation';
  end if;

  perform 1
  from public.coach_assignment_groups group_item
  where group_item.schedule_slot_id = p_schedule_slot_id
  order by group_item.id
  for update;

  perform 1
  from public.coach_assignment_group_students member_item
  join public.coach_assignment_groups group_item on group_item.id = member_item.group_id
  where group_item.schedule_slot_id = p_schedule_slot_id
  order by member_item.id
  for update of member_item;

  if exists (
    select 1
    from public.coach_assignment_group_students member_item
    join public.coach_assignment_groups group_item on group_item.id = member_item.group_id
    join public.booking_sessions session_item on session_item.id = member_item.booking_session_id
    join public.bookings booking_item on booking_item.id = session_item.booking_id
    where member_item.booking_session_id = any(target_session_ids)
      and (
        group_item.schedule_slot_id is distinct from p_schedule_slot_id
        or member_item.student_id is distinct from coalesce(session_item.child_id, booking_item.user_id)
        or member_item.student_type::text is distinct from case when session_item.child_id is null then 'adult' else 'child' end
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT|membership_identity_mismatch';
  end if;

  select count(*),
    coalesce(array_agg(distinct member_item.group_id order by member_item.group_id), '{}'::uuid[])
  into target_membership_count, target_group_ids
  from public.coach_assignment_group_students member_item
  where member_item.booking_session_id = any(target_session_ids);

  if p_operation = 'move_learner_to_existing_coach_group' then
    select * into move_target_group
    from public.coach_assignment_groups group_item
    where group_item.id = p_target_group_id;
    if move_target_group.id is null
      or move_target_group.schedule_slot_id is distinct from p_schedule_slot_id
      or move_target_group.coach_id is distinct from p_coach_id then
      raise exception using
        errcode = 'P0001',
        message = 'ADMIN_RETRO_ASSIGNMENT_STALE_STATE|move_target_group_changed';
    end if;

    if not exists (
      select 1 from public.coach_assignment_group_students member_item
      where member_item.group_id = move_target_group.id
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|move_target_group_empty';
    end if;

    if exists (
      select 1
      from public.attendance attendance_item
      join public.booking_sessions session_item on session_item.id = attendance_item.booking_session_id
      join public.bookings booking_item on booking_item.id = session_item.booking_id
      where attendance_item.booking_session_id = any(target_session_ids)
        and attendance_item.student_id = coalesce(session_item.child_id, booking_item.user_id)
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|move_attendance_exists';
    end if;

    if exists (
      select 1
      from public.coach_assignment_group_students member_item
      join public.booking_sessions session_item on session_item.id = member_item.booking_session_id
      join public.bookings booking_item on booking_item.id = session_item.booking_id
      where member_item.group_id = move_target_group.id
        and (
          session_item.schedule_slot_id is distinct from p_schedule_slot_id
          or session_item.branch_id is distinct from slot_row.branch_id
          or booking_item.course_type_id is distinct from slot_row.course_type_id
          or booking_item.status <> 'verified'
          or session_item.is_makeup
          or session_item.status not in ('scheduled', 'completed', 'absent')
          or member_item.student_id is distinct from coalesce(session_item.child_id, booking_item.user_id)
        )
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT|move_target_group_invalid';
    end if;

    if target_membership_count = unique_count
      and cardinality(target_group_ids) = 1
      and target_group_ids[1] = move_target_group.id then
      result_group_id := move_target_group.id;
    elsif target_membership_count = 0 then
      result_group_id := move_target_group.id;
    elsif target_membership_count = unique_count and cardinality(target_group_ids) = 1 then
      source_group_id := target_group_ids[1];
      select * into source_group
      from public.coach_assignment_groups group_item
      where group_item.id = source_group_id;
      if source_group.schedule_slot_id is distinct from p_schedule_slot_id
        or source_group.id = move_target_group.id then
        raise exception using
          errcode = 'P0001',
          message = 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT|invalid_source_group';
      end if;
      result_group_id := move_target_group.id;
    else
      raise exception using
        errcode = 'P0001',
        message = 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT|target_spans_or_partially_matches_groups';
    end if;
  else
    if target_membership_count = 0 then
      candidate_group_id := null;
    elsif target_membership_count <> unique_count or cardinality(target_group_ids) <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT|target_spans_or_partially_matches_groups';
    else
      candidate_group_id := target_group_ids[1];
      select * into candidate_group
      from public.coach_assignment_groups group_item
      where group_item.id = candidate_group_id;
      if candidate_group.schedule_slot_id is distinct from p_schedule_slot_id
        or (select count(*) from public.coach_assignment_group_students member_item where member_item.group_id = candidate_group_id) <> unique_count
        or exists (
          select 1 from public.coach_assignment_group_students member_item
          where member_item.group_id = candidate_group_id
            and not (member_item.booking_session_id = any(target_session_ids))
        ) then
        raise exception using
          errcode = 'P0001',
          message = 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT|partial_target_group';
      end if;

      if p_operation in ('assign_coach_to_round', 'resolve_unassigned_round', 'mark_attendance')
        and candidate_group.coach_id is not null
        and candidate_group.coach_id is distinct from p_coach_id then
        raise exception using
          errcode = 'P0001',
          message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|assigned_target_requires_replace';
      end if;
    end if;
    result_group_id := candidate_group_id;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    concat(p_coach_id::text, '|', slot_row.date::text),
    0
  ));
  conflict_result := public.get_coach_assignment_conflicts_v1(
    p_coach_id,
    p_schedule_slot_id,
    case
      when p_operation = 'move_learner_to_existing_coach_group' and source_group_id is not null
        then array[move_target_group.id, source_group_id]
      when p_operation = 'move_learner_to_existing_coach_group'
        then array[move_target_group.id]
      when candidate_group_id is not null
        then array[candidate_group_id]
      else '{}'::uuid[]
    end,
    false
  );
  conflict_row := conflict_result -> 'exact_conflicts' -> 0;
  legacy_warnings := coalesce(conflict_result -> 'legacy_warnings', '[]'::jsonb);
  if conflict_row is not null then
    raise exception using
      errcode = '23P01',
      message = concat(
        'ADMIN_RETRO_ASSIGNMENT_COACH_CONFLICT|',
        conflict_row ->> 'date', '|',
        conflict_row ->> 'start_time', '|',
        conflict_row ->> 'end_time', '|',
        conflict_row ->> 'branch_name', '|',
        conflict_row ->> 'group_name', '|',
        conflict_row ->> 'group_id'
      );
  end if;

  if p_operation in ('resolve_unassigned_round', 'mark_attendance') then
    perform 1
    from public.attendance attendance_item
    join public.booking_sessions session_item on session_item.id = attendance_item.booking_session_id
    join public.bookings booking_item on booking_item.id = session_item.booking_id
    where attendance_item.booking_session_id = any(target_session_ids)
      and attendance_item.student_id = coalesce(session_item.child_id, booking_item.user_id)
    order by attendance_item.booking_session_id, attendance_item.student_id, attendance_item.id
    for update of attendance_item;
  end if;

  select jsonb_build_object(
    'groups', coalesce((
      select jsonb_agg(to_jsonb(group_item) order by group_item.id)
      from public.coach_assignment_groups group_item
      where group_item.schedule_slot_id = p_schedule_slot_id
    ), '[]'::jsonb),
    'memberships', coalesce((
      select jsonb_agg(to_jsonb(member_item) order by member_item.id)
      from public.coach_assignment_group_students member_item
      join public.coach_assignment_groups group_item on group_item.id = member_item.group_id
      where group_item.schedule_slot_id = p_schedule_slot_id
    ), '[]'::jsonb),
    'legacyAssignments', coalesce((
      select jsonb_agg(to_jsonb(legacy_item) order by legacy_item.id)
      from public.coach_assignments legacy_item
      where legacy_item.schedule_slot_id = p_schedule_slot_id
    ), '[]'::jsonb),
    'exactReservations', coalesce((
      select jsonb_agg(to_jsonb(reservation_item) order by reservation_item.group_id)
      from public.coach_assignment_exact_reservations reservation_item
      where reservation_item.schedule_slot_id = p_schedule_slot_id
    ), '[]'::jsonb),
    'attendance', coalesce((
      select jsonb_agg(to_jsonb(attendance_item) order by attendance_item.booking_session_id, attendance_item.student_id, attendance_item.id)
      from public.attendance attendance_item
      where attendance_item.booking_session_id = any(target_session_ids)
    ), '[]'::jsonb),
    'sessionStatuses', coalesce((
      select jsonb_agg(jsonb_build_object('id', session_item.id, 'status', session_item.status) order by session_item.id)
      from public.booking_sessions session_item
      where session_item.id = any(target_session_ids)
    ), '[]'::jsonb)
  ) into before_snapshot;

  if p_operation = 'move_learner_to_existing_coach_group' then
    if target_membership_count = 0 then
      insert into public.coach_assignment_group_students (
        group_id, booking_session_id, student_id, student_type
      )
      select
        move_target_group.id,
        session_item.id,
        coalesce(session_item.child_id, booking_item.user_id),
        (case when session_item.child_id is null then 'adult' else 'child' end)::public.student_type
      from public.booking_sessions session_item
      join public.bookings booking_item on booking_item.id = session_item.booking_id
      where session_item.id = any(target_session_ids)
      order by session_item.id;
      assignment_changed := true;
    elsif source_group_id is not null then
      if source_group.coach_id is not null then
        affected_old_coach_ids := array_append(affected_old_coach_ids, source_group.coach_id);
      end if;
      update public.coach_assignment_group_students member_item
      set group_id = move_target_group.id
      where member_item.group_id = source_group_id
        and member_item.booking_session_id = any(target_session_ids);
      if not exists (select 1 from public.coach_assignment_group_students member_item where member_item.group_id = source_group_id) then
        delete from public.coach_assignment_groups group_item where group_item.id = source_group_id;
      end if;
      assignment_changed := true;
    end if;
  elsif candidate_group_id is null then
    default_group_name := case p_operation
      when 'replace_coach_for_past_round' then 'เปลี่ยนโค้ชย้อนหลังโดย Admin'
      when 'resolve_unassigned_round' then 'บันทึกย้อนหลังทั้งรอบโดย Admin'
      when 'mark_attendance' then 'บันทึกย้อนหลังโดย Admin'
      else 'มอบหมายโค้ชย้อนหลังทั้งรอบโดย Admin'
    end;
    insert into public.coach_assignment_groups (
      schedule_slot_id, coach_id, name, level_min, level_max, sort_order, notes, created_by
    ) values (
      p_schedule_slot_id,
      p_coach_id,
      default_group_name,
      null,
      null,
      999,
      nullif(btrim(coalesce(p_reason, '')), ''),
      p_actor_id
    ) returning id into result_group_id;
    assignment_changed := true;

    if p_test_fail_stage = 'after_group_write' then
      raise exception 'ADMIN_RETRO_ASSIGNMENT_TEST_FAILURE|after_group_write';
    end if;

    insert into public.coach_assignment_group_students (
      group_id, booking_session_id, student_id, student_type
    )
    select
      result_group_id,
      session_item.id,
      coalesce(session_item.child_id, booking_item.user_id),
      (case when session_item.child_id is null then 'adult' else 'child' end)::public.student_type
    from public.booking_sessions session_item
    join public.bookings booking_item on booking_item.id = session_item.booking_id
    where session_item.id = any(target_session_ids)
    order by session_item.id;
  else
    result_group_id := candidate_group_id;
    if candidate_group.coach_id is distinct from p_coach_id then
      if candidate_group.coach_id is not null then
        affected_old_coach_ids := array_append(affected_old_coach_ids, candidate_group.coach_id);
      end if;
      update public.coach_assignment_groups group_item
      set
        coach_id = p_coach_id,
        admin_retrospective_preserved_name = case
          when btrim(group_item.name) = ''
            or btrim(group_item.name) = 'ยังไม่จัดกลุ่ม'
            or group_item.name ~ '\s*\(\s*\d+\s*คน\s*\)\s*$'
            then true
          else group_item.admin_retrospective_preserved_name
        end
      where group_item.id = candidate_group_id;
      assignment_changed := true;
    end if;
  end if;

  if p_test_fail_stage = 'after_membership_write' then
    raise exception 'ADMIN_RETRO_ASSIGNMENT_TEST_FAILURE|after_membership_write';
  end if;

  insert into public.coach_assignments (coach_id, schedule_slot_id, assigned_by)
  values (p_coach_id, p_schedule_slot_id, p_actor_id)
  on conflict (coach_id, schedule_slot_id) do nothing;
  get diagnostics inserted_count = row_count;
  legacy_changed := inserted_count > 0;

  if cardinality(affected_old_coach_ids) > 0 then
    delete from public.coach_assignments legacy_item
    where legacy_item.schedule_slot_id = p_schedule_slot_id
      and legacy_item.coach_id = any(affected_old_coach_ids)
      and not exists (
        select 1
        from public.coach_assignment_groups group_item
        join public.coach_assignment_group_students member_item on member_item.group_id = group_item.id
        where group_item.schedule_slot_id = p_schedule_slot_id
          and group_item.coach_id = legacy_item.coach_id
      );
    get diagnostics deleted_count = row_count;
    legacy_changed := legacy_changed or deleted_count > 0;
  end if;

  if p_test_fail_stage = 'after_legacy_write' then
    raise exception 'ADMIN_RETRO_ASSIGNMENT_TEST_FAILURE|after_legacy_write';
  end if;

  if p_test_fail_stage = 'after_reservation_sync' then
    raise exception 'ADMIN_RETRO_ASSIGNMENT_TEST_FAILURE|after_reservation_sync';
  end if;

  if p_operation in ('resolve_unassigned_round', 'mark_attendance') then
    for session_row in
      select
        session_item.*,
        booking_item.user_id as booking_user_id,
        coalesce(session_item.child_id, booking_item.user_id) as expected_student_id,
        case when session_item.child_id is null then 'adult' else 'child' end as expected_student_type
      from public.booking_sessions session_item
      join public.bookings booking_item on booking_item.id = session_item.booking_id
      where session_item.id = any(target_session_ids)
      order by session_item.id
    loop
      desired_attendance := (p_attendance_by_session_id ->> session_row.id::text)::public.attendance_status;
      desired_session_status := case
        when desired_attendance = 'absent' then 'absent'::public.session_status
        else 'completed'::public.session_status
      end;

      select count(*) into attendance_count
      from public.attendance attendance_item
      where attendance_item.booking_session_id = session_row.id
        and attendance_item.student_id = session_row.expected_student_id;
      if attendance_count > 1 then
        raise exception using
          errcode = '23505',
          message = 'ADMIN_RETRO_ASSIGNMENT_DUPLICATE|multiple_exact_attendance_rows';
      end if;

      select * into attendance_row
      from public.attendance attendance_item
      where attendance_item.booking_session_id = session_row.id
        and attendance_item.student_id = session_row.expected_student_id
      order by attendance_item.checked_at desc, attendance_item.id
      limit 1;

      if attendance_row.id is null then
        insert into public.attendance (
          booking_session_id, student_id, student_type, coach_id, status, checked_at
        ) values (
          session_row.id,
          session_row.expected_student_id,
          session_row.expected_student_type::public.student_type,
          p_coach_id,
          desired_attendance,
          now()
        );
        attendance_changed := true;
      elsif attendance_row.status is distinct from desired_attendance
        or attendance_row.coach_id is distinct from p_coach_id
        or attendance_row.student_type::text is distinct from session_row.expected_student_type then
        update public.attendance attendance_item
        set
          student_type = session_row.expected_student_type::public.student_type,
          coach_id = p_coach_id,
          status = desired_attendance,
          checked_at = now()
        where attendance_item.id = attendance_row.id;
        attendance_changed := true;
      end if;

      if session_row.status is distinct from desired_session_status then
        update public.booking_sessions session_item
        set status = desired_session_status
        where session_item.id = session_row.id;
        status_changed := true;
      end if;
      attendance_row := null;
    end loop;
  end if;

  if p_test_fail_stage = 'after_attendance_write' then
    raise exception 'ADMIN_RETRO_ASSIGNMENT_TEST_FAILURE|after_attendance_write';
  end if;
  if p_test_fail_stage = 'after_session_status_write' then
    raise exception 'ADMIN_RETRO_ASSIGNMENT_TEST_FAILURE|after_session_status_write';
  end if;

  changed := assignment_changed or legacy_changed or attendance_changed or status_changed;

  select jsonb_build_object(
    'groups', coalesce((
      select jsonb_agg(to_jsonb(group_item) order by group_item.id)
      from public.coach_assignment_groups group_item
      where group_item.schedule_slot_id = p_schedule_slot_id
    ), '[]'::jsonb),
    'memberships', coalesce((
      select jsonb_agg(to_jsonb(member_item) order by member_item.id)
      from public.coach_assignment_group_students member_item
      join public.coach_assignment_groups group_item on group_item.id = member_item.group_id
      where group_item.schedule_slot_id = p_schedule_slot_id
    ), '[]'::jsonb),
    'legacyAssignments', coalesce((
      select jsonb_agg(to_jsonb(legacy_item) order by legacy_item.id)
      from public.coach_assignments legacy_item
      where legacy_item.schedule_slot_id = p_schedule_slot_id
    ), '[]'::jsonb),
    'exactReservations', coalesce((
      select jsonb_agg(to_jsonb(reservation_item) order by reservation_item.group_id)
      from public.coach_assignment_exact_reservations reservation_item
      where reservation_item.schedule_slot_id = p_schedule_slot_id
    ), '[]'::jsonb),
    'attendance', coalesce((
      select jsonb_agg(to_jsonb(attendance_item) order by attendance_item.booking_session_id, attendance_item.student_id, attendance_item.id)
      from public.attendance attendance_item
      where attendance_item.booking_session_id = any(target_session_ids)
    ), '[]'::jsonb),
    'sessionStatuses', coalesce((
      select jsonb_agg(jsonb_build_object('id', session_item.id, 'status', session_item.status) order by session_item.id)
      from public.booking_sessions session_item
      where session_item.id = any(target_session_ids)
    ), '[]'::jsonb)
  ) into after_snapshot;

  if changed then
    insert into public.activity_logs (
      user_id, action, entity_type, entity_id, details
    ) values (
      p_actor_id,
      concat('admin_retrospective_assignment_', p_operation),
      'schedule_slots',
      p_schedule_slot_id,
      jsonb_build_object(
        'operation', p_operation,
        'reason', nullif(btrim(coalesce(p_reason, '')), ''),
        'scheduleSlotId', p_schedule_slot_id,
        'groupId', result_group_id,
        'sourceGroupId', source_group_id,
        'targetSessionIds', to_jsonb(target_session_ids),
        'coachId', p_coach_id,
        'assignmentChanged', assignment_changed,
        'legacyChanged', legacy_changed,
        'attendanceChanged', attendance_changed,
        'sessionStatusChanged', status_changed,
        'before', before_snapshot,
        'after', after_snapshot
      )
    ) returning id, created_at into activity_id, activity_created_at;
  end if;

  if p_test_fail_stage = 'after_activity_write' then
    raise exception 'ADMIN_RETRO_ASSIGNMENT_TEST_FAILURE|after_activity_write';
  end if;

  return jsonb_build_object(
    'changed', changed,
    'idempotentReplay', not changed,
    'operation', p_operation,
    'scheduleSlotId', p_schedule_slot_id,
    'groupId', result_group_id,
    'targetSessionIds', to_jsonb(target_session_ids),
    'before', before_snapshot,
    'after', after_snapshot,
    'warnings', legacy_warnings,
    'audit', case
      when activity_id is null then null
      else jsonb_build_object(
        'id', activity_id,
        'createdAt', activity_created_at,
        'action', concat('admin_retrospective_assignment_', p_operation),
        'assignmentChanged', assignment_changed,
        'legacyChanged', legacy_changed,
        'attendanceChanged', attendance_changed,
        'sessionStatusChanged', status_changed
      )
    end
  );
exception
  when unique_violation then
    raise exception using
      errcode = '23505',
      message = 'ADMIN_RETRO_ASSIGNMENT_DUPLICATE|concurrent_unique_conflict';
  when exclusion_violation then
    raise exception using
      errcode = '23P01',
      message = 'ADMIN_RETRO_ASSIGNMENT_COACH_CONFLICT|concurrent_overlap';
  when foreign_key_violation then
    raise exception using
      errcode = 'P0001',
      message = 'ADMIN_RETRO_ASSIGNMENT_STALE_STATE|concurrent_reference_change';
end;
$$;


NOTIFY pgrst,'reload schema';
COMMIT;
