BEGIN;
-- Admin-only destination month permission. No changes to Parent APIs or source expiry.
DO $guard$ BEGIN IF md5(replace(pg_get_functiondef('lesson_source_previous_kids_makeup_v1(uuid,uuid,uuid,uuid,uuid,date,time without time zone,time without time zone,uuid)'::regprocedure),chr(13)||chr(10),chr(10)))<>'f0d9f09a7783838fc3ad01af3ec60ba2' THEN RAISE EXCEPTION 'ADMIN_MAKEUP_MONTH_BASELINE_DRIFT';END IF;END $guard$;
CREATE OR REPLACE FUNCTION public.lesson_source_previous_kids_makeup_v1(p_actor_id uuid, p_source_session_id uuid, p_attending_child_id uuid, p_template_id uuid, p_branch_id uuid, p_target_date date, p_start_time time without time zone, p_end_time time without time zone, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  PERFORM public.task10_lock_family_months_v1(v_parent,ARRAY[v_month,(v_month+interval '1 month')::date,date_trunc('month',p_target_date)::date]);
  v_state:=public.task10_family_makeup_state_v1(p_actor_id,v_parent,v_month);
  SELECT value INTO v_source FROM jsonb_array_elements(v_state->'sources') WHERE value->>'sourceSessionId'=p_source_session_id::text;
  IF coalesce((v_source->>'approvalAvailable')::boolean,false) AND (SELECT store_once_enabled FROM public.admin_makeup_credit_control WHERE singleton) THEN
   PERFORM public.admin_makeup_confirm_stored_source_v9(p_actor_id,p_source_session_id,p_request_id);
   v_state:=public.task10_family_makeup_state_v1(p_actor_id,v_parent,v_month);
  END IF;
  IF NOT (v_state->>'eligible')::boolean THEN RAISE EXCEPTION 'TASK10_MAKEUP_INELIGIBLE' USING DETAIL=v_state->>'reason'; END IF;
  SELECT value INTO v_source FROM jsonb_array_elements(v_state->'sources') WHERE value->>'sourceSessionId'=p_source_session_id::text;
  IF v_source IS NULL OR v_source->>'rootId'<>v_root::text THEN RAISE EXCEPTION 'TASK10_SOURCE_CONFLICT'; END IF;
  IF (v_state->>'remaining')::integer=0 AND NOT coalesce(v_source->'approval'->>'status'='approved' AND public.task10_clock_v1()<(v_source->'approval'->>'expiresAt')::timestamptz,false) THEN RAISE EXCEPTION 'TASK10_APPROVAL_REQUIRED';END IF;
  PERFORM 1 FROM public.children WHERE id=p_attending_child_id AND parent_id=v_parent FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TASK10_CHILD_NOT_IN_FAMILY'; END IF;
  -- Admin may place a still-eligible source in any future, not-started round.
  -- The existing source deadline, quota, exact-source and final clock checks remain.
  PERFORM 1 FROM public.bookings b WHERE b.id=(v_source->>'bookingId')::uuid FOR UPDATE;
  PERFORM 1 FROM public.booking_sessions s WHERE s.id IN (v_root,p_source_session_id) ORDER BY s.id FOR UPDATE;
  -- Attendance corrections can precede their session-status write-through.
  -- Lock the exact evidence and re-read eligibility after waiting for source rows.
  PERFORM a.id FROM public.attendance a WHERE a.booking_session_id IN (v_root,p_source_session_id) ORDER BY a.id FOR UPDATE;
  v_state:=public.task10_family_makeup_state_v1(p_actor_id,v_parent,v_month);
  IF NOT (v_state->>'eligible')::boolean THEN RAISE EXCEPTION 'TASK10_MAKEUP_INELIGIBLE' USING DETAIL=v_state->>'reason'; END IF;
  SELECT value INTO v_source FROM jsonb_array_elements(v_state->'sources') WHERE value->>'sourceSessionId'=p_source_session_id::text;
  IF v_source IS NULL OR v_source->>'rootId'<>v_root::text THEN RAISE EXCEPTION 'TASK10_SOURCE_CONFLICT'; END IF;
  IF (v_state->>'remaining')::integer=0 AND NOT coalesce(v_source->'approval'->>'status'='approved' AND public.task10_clock_v1()<(v_source->'approval'->>'expiresAt')::timestamptz,false) THEN RAISE EXCEPTION 'TASK10_APPROVAL_REQUIRED';END IF;
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
  v_result:=jsonb_build_object('success',true,'data',to_jsonb(v_session),'remaining',greatest(0,(v_state->>'remaining')::integer-1),'useMode',CASE WHEN (v_state->>'remaining')::integer>0 THEN 'normal' ELSE 'exception' END,
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
END $function$
;

DO $guard$ BEGIN IF md5(replace(pg_get_functiondef('admin_makeup_previous_transition_v1(uuid,text,uuid,jsonb)'::regprocedure),chr(13)||chr(10),chr(10)))<>'7c0a32ef5eaf32d400ec895e61234e26' THEN RAISE EXCEPTION 'ADMIN_MAKEUP_MONTH_BASELINE_DRIFT';END IF;END $guard$;
CREATE OR REPLACE FUNCTION public.admin_makeup_previous_transition_v1(p_actor_id uuid, p_operation text, p_id uuid, p_payload jsonb DEFAULT '{}'::jsonb)
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
  IF p_operation='makeup' THEN
    PERFORM public.task10_lock_family_months_v1(v_parent,ARRAY[v_month,(v_month+interval '1 month')::date,date_trunc('month',(p_payload->>'targetDate')::date)::date]);
  ELSE
    PERFORM public.task10_lock_family_months_v1(v_parent,ARRAY[v_month,(v_month+interval '1 month')::date]);
  END IF;
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
        -- Admin destination month is independent of the still-valid source deadline.
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

NOTIFY pgrst,'reload schema';
COMMIT;
