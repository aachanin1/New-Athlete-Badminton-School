BEGIN;
CREATE FUNCTION public.booking_ux_child_v1(p_actor uuid,p_request uuid,p_name text,p_nickname text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v booking_ux_requests%ROWTYPE;v_fp text;r jsonb;
BEGIN
 IF p_actor IS NULL OR p_request IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor) OR length(btrim(p_name))NOT BETWEEN 1 AND 200 OR length(p_nickname)>100 THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_LEARNER';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('booking-ux-request|'||p_actor||'|'||p_request,0));
 v_fp:=encode(extensions.digest(jsonb_build_array(p_name,p_nickname)::text,'sha256'),'hex');
 SELECT * INTO v FROM booking_ux_requests WHERE actor_id=p_actor AND request_id=p_request;
 IF FOUND THEN IF v.operation<>'child' OR v.fingerprint<>v_fp THEN RAISE EXCEPTION 'BOOKING_UX_IDEMPOTENCY_CONFLICT';END IF;RETURN v.result;END IF;
 INSERT INTO children(parent_id,full_name,nickname)VALUES(p_actor,btrim(p_name),nullif(btrim(p_nickname),''))RETURNING to_jsonb(children.*) INTO r;
 INSERT INTO booking_ux_requests(actor_id,request_id,operation,fingerprint,result)VALUES(p_actor,p_request,'child',v_fp,r);
 INSERT INTO activity_logs(user_id,action,entity_type,entity_id,details)VALUES(p_actor,'create_child','children',(r->>'id')::uuid,jsonb_build_object('requestId',p_request,'entry','booking'));
 RETURN r;
END $$;

CREATE FUNCTION public.booking_ux_parent_state_v1(p_actor uuid,p_month date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v jsonb;s jsonb;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor) THEN RAISE EXCEPTION 'BOOKING_UX_FORBIDDEN';END IF;
 v:=public.task10_family_makeup_facts_v1(p_actor,p_month);
 IF NOT(v?'sources') THEN RETURN v;END IF;
 SELECT coalesce(jsonb_agg(x),'[]') INTO s FROM jsonb_array_elements(v->'sources')x WHERE x->>'kind'='wallet'
  AND EXISTS(SELECT 1 FROM children c WHERE c.id=(x->>'sourceChildId')::uuid AND c.parent_id=p_actor);
 RETURN v||jsonb_build_object('sources',s,'eligible',coalesce((v->>'eligible')::boolean,false) AND jsonb_array_length(s)>0,'selfUseAvailable',CASE WHEN (v->>'eligible')::boolean THEN least(jsonb_array_length(s),(v->>'remaining')::integer) ELSE 0 END);
END $$;

CREATE FUNCTION public.booking_ux_redeem_many_v1(p_actor uuid,p_request uuid,p_picks jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE prior booking_ux_requests%ROWTYPE;v_fp text;p jsonb;u booking_package_units%ROWTYPE;b bookings%ROWTYPE;
 v_date date;v_start time;v_end time;v_branch uuid;v_template uuid;v_slot uuid;v_session uuid;v_sessions uuid[];v_ids uuid[]:='{}';
 member jsonb;v_child uuid;v_course text;v_result jsonb;v_credit lesson_wallet_credits%ROWTYPE;r jsonb;
BEGIN
 IF NOT(SELECT enabled FROM booking_ux_control WHERE singleton) THEN RAISE EXCEPTION 'BOOKING_UX_DISABLED';END IF;
 IF p_actor IS NULL OR p_request IS NULL OR jsonb_typeof(p_picks)IS DISTINCT FROM 'array' OR jsonb_array_length(p_picks)NOT BETWEEN 1 AND 32 THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_REQUEST';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('booking-ux-request|'||p_actor||'|'||p_request,0));
 v_fp:=encode(extensions.digest(p_picks::text,'sha256'),'hex');SELECT * INTO prior FROM booking_ux_requests WHERE actor_id=p_actor AND request_id=p_request;
 IF FOUND THEN IF prior.operation<>'redeem' OR prior.fingerprint<>v_fp THEN RAISE EXCEPTION 'BOOKING_UX_IDEMPOTENCY_CONFLICT';END IF;RETURN prior.result;END IF;
 -- Family-month locks first, shared with Admin/booking/payment/attendance writers.
 FOR p IN SELECT x FROM jsonb_array_elements(p_picks)x ORDER BY x->>'id' LOOP
  IF p->>'kind'='package' THEN SELECT bk.* INTO b FROM bookings bk JOIN booking_package_units x ON x.booking_id=bk.id WHERE x.id=(p->>'id')::uuid;
  ELSE SELECT bk.* INTO b FROM bookings bk JOIN lesson_wallet_credits x ON x.booking_id=bk.id WHERE x.id=(p->>'id')::uuid;END IF;
  IF NOT FOUND OR b.user_id IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'BOOKING_UX_FORBIDDEN';END IF;
  PERFORM public.task10_lock_family_months_v1(p_actor,ARRAY[make_date(b.year,b.month,1),date_trunc('month',(p->>'date')::date)::date]);
 END LOOP;
 FOR p IN SELECT x FROM jsonb_array_elements(p_picks)x ORDER BY x->>'id' LOOP
  v_date:=(p->>'date')::date;v_start:=(p->>'start')::time;v_end:=(p->>'end')::time;v_branch:=(p->>'branchId')::uuid;v_template:=(p->>'templateId')::uuid;
  IF v_date IS NULL OR v_start IS NULL OR v_end IS NULL OR v_end<=v_start OR (v_date+v_start) AT TIME ZONE 'Asia/Bangkok'<=public.task10_clock_v1() THEN RAISE EXCEPTION 'BOOKING_UX_TARGET_INVALID';END IF;
  IF p->>'kind'='package' THEN
   SELECT bk.* INTO b FROM bookings bk JOIN booking_package_units x ON x.booking_id=bk.id WHERE x.id=(p->>'id')::uuid FOR UPDATE OF bk;
   SELECT * INTO u FROM booking_package_units WHERE id=(p->>'id')::uuid FOR UPDATE;
   IF u.status<>'available' OR b.user_id<>p_actor OR b.status::text<>'verified' OR u.expires_at<public.task10_clock_v1() OR (v_date+v_end) AT TIME ZONE 'Asia/Bangkok'>u.expires_at THEN RAISE EXCEPTION 'BOOKING_UX_ENTITLEMENT_UNAVAILABLE';END IF;
   SELECT name::text INTO v_course FROM course_types WHERE id=b.course_type_id;
   IF v_course='private' AND v_end-v_start<>interval '1 hour' THEN RAISE EXCEPTION 'BOOKING_UX_UNIT_DURATION';END IF;
   IF (b.package_snapshot->>'quantity')::int=1 AND date_trunc('month',v_date)::date<>make_date(b.year,b.month,1) THEN RAISE EXCEPTION 'BOOKING_UX_TARGET_MONTH';END IF;
   v_slot:=public.task10_target_slot_v1(b.course_type_id,v_template,v_branch,v_date,v_start,v_end);v_sessions:='{}';
   FOR member IN SELECT x FROM jsonb_array_elements(u.participants)x ORDER BY x::text LOOP
    v_child:=(member#>>'{}')::uuid;
    IF v_child IS NOT NULL AND NOT EXISTS(SELECT 1 FROM children WHERE id=v_child AND parent_id=p_actor) THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_LEARNER';END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('task10-learner|'||coalesce(v_child,p_actor)::text||'|'||v_date::text,0));
    IF EXISTS(SELECT 1 FROM booking_sessions s JOIN bookings bk ON bk.id=s.booking_id WHERE bk.user_id=p_actor AND bk.status::text IN ('pending_payment','paid','verified')
      AND s.child_id IS NOT DISTINCT FROM v_child AND s.date=v_date AND s.start_time<v_end AND s.end_time>v_start AND s.status::text NOT IN ('rescheduled','walleted','cancelled') AND s.cancelled_at IS NULL)THEN RAISE EXCEPTION 'TASK10_DUPLICATE_SESSION';END IF;
    PERFORM set_config('lesson_source.write','authorized',true);PERFORM set_config('task10.source_write','authorized',true);
    INSERT INTO booking_sessions(booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup)
      VALUES(b.id,v_slot,v_date,v_start,v_end,v_branch,v_child,'scheduled',false)RETURNING id INTO v_session;
    v_sessions:=array_append(v_sessions,v_session);v_ids:=array_append(v_ids,v_session);
   END LOOP;
   UPDATE booking_package_units SET status='redeemed',redeemed_at=clock_timestamp(),session_ids=v_sessions WHERE id=u.id;
   INSERT INTO activity_logs(user_id,action,entity_type,entity_id,details)VALUES(p_actor,'package_unit_redeemed','booking',b.id,jsonb_build_object('unitId',u.id,'sessionIds',v_sessions,'requestId',p_request));
   INSERT INTO notifications(user_id,title,message,type,link_url)VALUES(p_actor,'เลือกวันเรียนแล้ว','ใช้สิทธิแพ็กเกจวันที่ '||v_date::text||' เวลา '||v_start::text,'schedule','/dashboard/schedule');
  ELSIF p->>'kind'='wallet' THEN
   SELECT * INTO v_credit FROM lesson_wallet_credits WHERE id=(p->>'id')::uuid;
   IF v_credit.user_id IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'BOOKING_UX_FORBIDDEN';END IF;
   SELECT name::text INTO v_course FROM course_types WHERE id=v_credit.course_type_id;
   IF v_course='kids_group' AND date_trunc('month',v_date)<>date_trunc('month',v_credit.original_date) THEN
    r:=public.booking_ux_parent_consume_v1(p_actor,v_credit.original_session_id,v_credit.child_id,v_template,v_branch,v_date,v_start,v_end,(p->>'requestId')::uuid);
    v_session:=(r->'data'->>'id')::uuid;v_ids:=array_append(v_ids,v_session);
   ELSE
    r:=public.lesson_source_transition_v1(p_actor,'redeem',v_credit.id,jsonb_build_object('targetDate',v_date,'startTime',v_start,'endTime',v_end,'branchId',v_branch,'templateId',v_template));
    SELECT array_agg(x::uuid) INTO v_sessions FROM jsonb_array_elements_text(r->'session_ids')x;v_ids:=v_ids||coalesce(v_sessions,ARRAY[]::uuid[]);
   END IF;
  ELSE RAISE EXCEPTION 'BOOKING_UX_INVALID_REQUEST';END IF;
 END LOOP;
 v_result:=jsonb_build_object('success',true,'sessionIds',v_ids,'used',jsonb_array_length(p_picks));
 INSERT INTO booking_ux_requests(actor_id,request_id,operation,fingerprint,result)VALUES(p_actor,p_request,'redeem',v_fp,v_result);
 RETURN v_result;
END $$;

DO $acl$ DECLARE r record;BEGIN
 FOR r IN SELECT oid::regprocedure::text signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('booking_ux_child_v1','booking_ux_parent_state_v1','booking_ux_redeem_many_v1') LOOP
 EXECUTE 'REVOKE ALL ON FUNCTION '||r.signature||' FROM PUBLIC,anon,authenticated,service_role';EXECUTE 'GRANT EXECUTE ON FUNCTION '||r.signature||' TO service_role';END LOOP;
END $acl$;
CREATE OR REPLACE FUNCTION public.booking_ux_parent_consume_v1(p_actor_id uuid, p_source_session_id uuid, p_attending_child_id uuid, p_template_id uuid, p_branch_id uuid, p_target_date date, p_start_time time without time zone, p_end_time time without time zone, p_request_id uuid)
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
  IF NOT(SELECT enabled FROM booking_ux_control WHERE singleton) THEN RAISE EXCEPTION 'BOOKING_UX_DISABLED';END IF;
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
  IF v_parent IS DISTINCT FROM p_actor_id OR NOT EXISTS(SELECT 1 FROM booking_sessions WHERE id=p_source_session_id AND child_id=p_attending_child_id) THEN RAISE EXCEPTION 'BOOKING_UX_FORBIDDEN';END IF;
  v_state:=public.booking_ux_parent_state_v1(p_actor_id,v_month);
  SELECT value INTO v_source FROM jsonb_array_elements(v_state->'sources') WHERE value->>'sourceSessionId'=p_source_session_id::text;
  IF NOT (v_state->>'eligible')::boolean THEN RAISE EXCEPTION 'TASK10_MAKEUP_INELIGIBLE' USING DETAIL=v_state->>'reason'; END IF;
  SELECT value INTO v_source FROM jsonb_array_elements(v_state->'sources') WHERE value->>'sourceSessionId'=p_source_session_id::text;
  IF v_source IS NULL OR v_source->>'kind'<>'wallet' OR v_source->>'sourceChildId'<>p_attending_child_id::text OR v_source->>'rootId'<>v_root::text THEN RAISE EXCEPTION 'TASK10_SOURCE_CONFLICT'; END IF;
  IF (v_state->>'remaining')::integer<=0 THEN RAISE EXCEPTION 'TASK10_APPROVAL_REQUIRED';END IF;
  PERFORM 1 FROM public.children WHERE id=p_attending_child_id AND parent_id=v_parent FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TASK10_CHILD_NOT_IN_FAMILY'; END IF;
  IF date_trunc('month',p_target_date)::date<>(v_month+interval '1 month')::date THEN RAISE EXCEPTION 'TASK10_TARGET_MONTH'; END IF;
  PERFORM 1 FROM public.bookings b WHERE b.id=(v_source->>'bookingId')::uuid FOR UPDATE;
  PERFORM 1 FROM public.booking_sessions s WHERE s.id IN (v_root,p_source_session_id) ORDER BY s.id FOR UPDATE;
  -- Attendance corrections can precede their session-status write-through.
  -- Lock the exact evidence and re-read eligibility after waiting for source rows.
  PERFORM a.id FROM public.attendance a WHERE a.booking_session_id IN (v_root,p_source_session_id) ORDER BY a.id FOR UPDATE;
  v_state:=public.booking_ux_parent_state_v1(p_actor_id,v_month);
  IF NOT (v_state->>'eligible')::boolean THEN RAISE EXCEPTION 'TASK10_MAKEUP_INELIGIBLE' USING DETAIL=v_state->>'reason'; END IF;
  SELECT value INTO v_source FROM jsonb_array_elements(v_state->'sources') WHERE value->>'sourceSessionId'=p_source_session_id::text;
  IF v_source IS NULL OR v_source->>'kind'<>'wallet' OR v_source->>'sourceChildId'<>p_attending_child_id::text OR v_source->>'rootId'<>v_root::text THEN RAISE EXCEPTION 'TASK10_SOURCE_CONFLICT'; END IF;
  IF (v_state->>'remaining')::integer<=0 THEN RAISE EXCEPTION 'TASK10_APPROVAL_REQUIRED';END IF;
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
  VALUES(v_parent,'ได้รับวันชดเชยแล้ว','ใช้กระเป๋าเรียนวันที่ '||p_target_date::text||' เวลา '||p_start_time::text||' เรียบร้อยแล้ว','schedule','/dashboard/schedule');
  PERFORM public.progressive_refresh_slot_capacity_v1(ARRAY[v_slot]);
  PERFORM set_config('lesson_source.write','authorized',true);
  UPDATE lesson_wallet_credits SET status='redeemed',redeemed_session_id=v_session.id,redeemed_at=v_now WHERE id=(v_source->>'creditId')::uuid;
  RETURN v_result;
END $function$;
REVOKE ALL ON FUNCTION public.booking_ux_parent_consume_v1(uuid,uuid,uuid,uuid,uuid,date,time,time,uuid) FROM PUBLIC,anon,authenticated,service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
