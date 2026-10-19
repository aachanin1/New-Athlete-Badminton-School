BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(10,1);SELECT pg_advisory_xact_lock(10,2);
-- Installs disabled. Only this task's physically guarded Local acceptance enables it.
ALTER TABLE public.admin_makeup_credit_control ADD COLUMN store_once_enabled boolean NOT NULL DEFAULT false;

CREATE FUNCTION public.admin_makeup_store_once_ready_v1(p_actor uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM public.task10_require_actor_v1(p_actor,'makeup');
 RETURN public.admin_makeup_credit_ready_v1(p_actor) AND EXISTS(SELECT 1 FROM public.admin_makeup_credit_control WHERE singleton AND store_once_enabled);
END $$;
REVOKE ALL ON FUNCTION public.admin_makeup_store_once_ready_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_makeup_store_once_ready_v1(uuid) TO service_role;

CREATE FUNCTION public.admin_makeup_store_once_preview_v1(p_actor uuid,p_source uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_root uuid;v_kids boolean;v_fresh boolean;v_booking uuid;
BEGIN
 PERFORM public.task10_require_actor_v1(p_actor,'makeup');
 v_root:=public.task10_source_root_v1(p_source);
 SELECT c.name='kids_group',b.id INTO v_kids,v_booking FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id JOIN public.course_types c ON c.id=b.course_type_id WHERE s.id=p_source;
 v_fresh:=coalesce(v_kids,false) AND NOT EXISTS(SELECT 1 FROM public.admin_makeup_credit_approvals WHERE source_root_id=v_root)
  AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credits w WHERE w.booking_id=v_booking AND w.redeemed_session_id IS NOT NULL AND public.task10_source_root_v1(w.original_session_id)=v_root);
 RETURN jsonb_build_object('ready',public.admin_makeup_store_once_ready_v1(p_actor),'confirmCredit',v_fresh,
  'active',EXISTS(SELECT 1 FROM public.task10_policy_activation WHERE singleton AND effective_at IS NOT NULL AND makeup_enabled));
END $$;
REVOKE ALL ON FUNCTION public.admin_makeup_store_once_preview_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_makeup_store_once_preview_v1(uuid,uuid) TO service_role;

-- Existing immutable Store proof supplies the original reason. The deciding
-- actor remains the Admin confirming the destination, not the historical storer.
CREATE FUNCTION public.admin_makeup_confirm_stored_source_v9(p_actor uuid,p_source uuid,p_request uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_credit uuid;v_reason text;
BEGIN
 PERFORM public.task10_require_actor_v1(p_actor,'makeup');
 IF NOT public.admin_makeup_store_once_ready_v1(p_actor) THEN RAISE EXCEPTION 'TASK10_UNAVAILABLE';END IF;
 SELECT w.id,a.details->>'reason' INTO v_credit,v_reason FROM public.lesson_wallet_credits w
 JOIN public.lesson_source_operations o ON o.unit_id=p_source AND o.operation='store' AND o.result->>'credit_id'=w.id::text
 JOIN public.activity_logs a ON a.user_id=o.actor_id AND a.entity_id=p_source AND a.action='admin_lesson_assistance'
  AND a.details->>'operation'='store' AND a.details->>'policyActor'='admin'
 WHERE w.original_session_id=p_source AND public.admin_makeup_credit_store_proof_v1(p_source,w.id)
 AND o.request_fingerprint=encode(extensions.digest(jsonb_build_object('date',a.details->'targetDate','start',a.details->'startTime','end',a.details->'endTime',
 'branch',a.details->'branchId','template',a.details->'templateId','reason',a.details->>'reason','attendingChildId',NULL::text,'requestId',a.details->>'requestId')::text,'sha256'),'hex')
 ORDER BY a.created_at,a.id LIMIT 1;
 IF v_credit IS NULL THEN RAISE EXCEPTION 'TASK10_APPROVAL_INELIGIBLE';END IF;
 PERFORM public.admin_makeup_credit_decide_v1(p_actor,v_credit,'approve',v_reason,p_request,false);
END $$;
REVOKE ALL ON FUNCTION public.admin_makeup_confirm_stored_source_v9(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
DO $guard$ BEGIN IF md5(replace(pg_get_functiondef('lesson_source_transition_v1(uuid,text,uuid,jsonb)'::regprocedure),chr(13)||chr(10),chr(10)))<>'15729e39dfedd4b6258d92a538b6d8a5' THEN RAISE EXCEPTION 'ADMIN_STORE_ONCE_BASELINE_DRIFT';END IF;END $guard$;
CREATE OR REPLACE FUNCTION public.lesson_source_transition_v1(p_actor_id uuid, p_operation text, p_id uuid, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_fp text;v_prior public.admin_makeup_store_requests%ROWTYPE;v_result jsonb;v_decision jsonb;v_request uuid;v_approve boolean;v_once boolean;v_preview jsonb;
BEGIN
 IF p_operation IS DISTINCT FROM 'admin_store' THEN
  IF p_payload ? 'approveCredit' OR p_payload ? 'readOnly' THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST';END IF;
  RETURN public.admin_makeup_previous_transition_v1(p_actor_id,p_operation,p_id,p_payload);
 END IF;
 PERFORM public.task10_require_actor_v1(p_actor_id,'makeup');
 IF p_payload IS NULL OR p_id IS NULL OR nullif(p_payload->>'requestId','') IS NULL THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST';END IF;
 v_request:=(p_payload->>'requestId')::uuid;
 IF p_payload ? 'approveCredit' AND jsonb_typeof(p_payload->'approveCredit')<>'boolean' THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST';END IF;
 v_approve:=coalesce((p_payload->>'approveCredit')::boolean,false);
 v_fp:=encode(extensions.digest(jsonb_build_array(p_id,p_payload-'readOnly')::text,'sha256'),'hex');
 PERFORM pg_advisory_xact_lock_shared(10,1);PERFORM pg_advisory_xact_lock_shared(10,2);
 PERFORM pg_advisory_xact_lock(hashtextextended('admin-store-request|'||p_actor_id::text||'|'||v_request::text,0));
 IF v_approve THEN PERFORM pg_advisory_xact_lock(hashtextextended('admin-credit-request|'||p_actor_id::text||'|'||v_request::text,0));END IF;
 SELECT * INTO v_prior FROM public.admin_makeup_store_requests WHERE actor_id=p_actor_id AND request_id=v_request;
 IF FOUND THEN
  IF v_prior.request_fingerprint<>v_fp THEN RAISE EXCEPTION 'TASK10_IDEMPOTENCY_CONFLICT';END IF;
  RETURN v_prior.result;
 END IF;
 IF coalesce((p_payload->>'readOnly')::boolean,false) THEN RETURN jsonb_build_object('confirmed',false);END IF;
 v_once:=p_payload->>'storePolicy'='admin-store-once-v1';
 IF coalesce(v_once,false) THEN
  IF p_payload ? 'approveCredit' THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST';END IF;
  v_preview:=public.admin_makeup_store_once_preview_v1(p_actor_id,p_id);
  IF NOT (v_preview->>'ready')::boolean THEN RAISE EXCEPTION 'TASK10_UNAVAILABLE';END IF;
  v_approve:=(v_preview->>'confirmCredit')::boolean;
 ELSIF EXISTS(SELECT 1 FROM public.admin_makeup_credit_control WHERE singleton AND store_once_enabled) OR p_payload ? 'storePolicy' THEN
  RAISE EXCEPTION 'TASK10_STORE_REFRESH_REQUIRED';
 END IF;
 IF v_approve AND NOT EXISTS(SELECT 1 FROM public.admin_makeup_credit_control WHERE singleton AND enabled) THEN RAISE EXCEPTION 'TASK10_APPROVAL_DISABLED';END IF;
 IF v_approve AND EXISTS(SELECT 1 FROM public.activity_logs WHERE user_id=p_actor_id AND entity_id=p_id AND action='admin_lesson_assistance'
  AND details->>'operation'='store' AND details->>'requestId'=v_request::text) THEN RAISE EXCEPTION 'TASK10_APPROVAL_CONFLICT';END IF;
 v_result:=public.admin_makeup_previous_transition_v1(p_actor_id,p_operation,p_id,p_payload-'approveCredit'-'readOnly');
 IF v_approve THEN
  v_decision:=public.admin_makeup_credit_decide_v1(p_actor_id,(v_result->>'credit_id')::uuid,'approve',p_payload->>'reason',v_request,false);
  v_result:=v_result||jsonb_build_object('approval',v_decision);
 END IF;
 IF coalesce(v_once,false) THEN v_result:=v_result||jsonb_build_object('storePolicy','admin-store-once-v1');
 END IF;
 INSERT INTO public.admin_makeup_store_requests(actor_id,request_id,source_session_id,request_fingerprint,result) VALUES(p_actor_id,v_request,p_id,v_fp,v_result);
 RETURN v_result;
END $function$
;

DO $guard$ BEGIN IF md5(replace(pg_get_functiondef('task10_family_makeup_state_v1(uuid,uuid,date)'::regprocedure),chr(13)||chr(10),chr(10)))<>'668e25a76284093c54b60151c40fa287' THEN RAISE EXCEPTION 'ADMIN_STORE_ONCE_BASELINE_DRIFT';END IF;END $guard$;
CREATE OR REPLACE FUNCTION public.task10_family_makeup_state_v1(p_actor_id uuid, p_parent_id uuid, p_source_month date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v jsonb; v_eligible boolean; v_sources jsonb;v_approved integer;v_used integer;v_available integer;
BEGIN
  -- Facts retain D/M. This existing entry point is Admin-only; future Parent
  -- self-service must use its own owner/wallet-only/D>=M policy entry point.
  PERFORM public.task10_require_actor_v1(p_actor_id,'makeup');
  v:=public.task10_family_makeup_facts_v1(p_parent_id,p_source_month);
  IF NOT(v ? 'sourceMonth') THEN RETURN v;END IF;
  SELECT coalesce(jsonb_agg(s.value||jsonb_build_object('approval',CASE WHEN g.id IS NOT NULL THEN jsonb_build_object('id',g.id,'status',g.status,'expiresAt',g.expires_at) END,
    'approvalAvailable',(SELECT enabled FROM public.admin_makeup_credit_control WHERE singleton) AND s.value->>'kind'='wallet' AND g.id IS NULL
     AND NOT EXISTS(SELECT 1 FROM public.admin_makeup_credit_approvals prior WHERE prior.source_root_id=(s.value->>'rootId')::uuid)
     AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credits prior WHERE prior.booking_id=(s.value->>'bookingId')::uuid AND prior.redeemed_session_id IS NOT NULL AND public.task10_source_root_v1(prior.original_session_id)=(s.value->>'rootId')::uuid)
     AND (v->>'active')::boolean AND public.task10_clock_v1()<(v->>'expiresAt')::timestamptz
     AND public.admin_makeup_credit_store_proof_v1((s.value->>'sourceSessionId')::uuid,(s.value->>'creditId')::uuid)) ORDER BY s.value->>'sourceSessionId'),'[]'),
    count(*) FILTER(WHERE g.status='approved' AND public.task10_clock_v1()<g.expires_at AND (SELECT enabled FROM public.admin_makeup_credit_control WHERE singleton))
  INTO v_sources,v_approved FROM jsonb_array_elements(v->'sources') s(value)
   LEFT JOIN public.admin_makeup_credit_approvals g ON g.credit_id=(s.value->>'creditId')::uuid AND g.source_session_id=(s.value->>'sourceSessionId')::uuid;
  SELECT count(*) INTO v_used FROM public.admin_makeup_credit_approvals WHERE parent_id=p_parent_id AND source_month=p_source_month AND used_mode='exception';
  SELECT count(*) INTO v_available FROM jsonb_array_elements(v_sources) s WHERE (s->>'approvalAvailable')::boolean AND (SELECT store_once_enabled FROM public.admin_makeup_credit_control WHERE singleton);
  v:=v||jsonb_build_object('sources',v_sources,'approvedSources',v_approved,'storedReadySources',v_available,'storeOnceEnabled',(SELECT store_once_enabled FROM public.admin_makeup_credit_control WHERE singleton),'exceptionUsed',v_used,'creditApprovalsEnabled',(SELECT enabled FROM public.admin_makeup_credit_control WHERE singleton));
  v_eligible:=(v->>'active')::boolean AND public.task10_clock_v1()<(v->>'expiresAt')::timestamptz
    AND ((v->>'remaining')::integer>0 OR v_approved>0 OR v_available>0) AND jsonb_array_length(v->'sources')>0;
  RETURN v||jsonb_build_object('eligible',v_eligible,'reason',CASE WHEN v_eligible OR v->>'reason'='destination_minimum' THEN NULL ELSE v->>'reason' END,
    'policyActor','admin','destinationPurchaseRequired',false,'policyVersion','admin-assistance-v1');
END $function$
;

DO $guard$ BEGIN IF md5(replace(pg_get_functiondef('lesson_source_previous_kids_makeup_v1(uuid,uuid,uuid,uuid,uuid,date,time without time zone,time without time zone,uuid)'::regprocedure),chr(13)||chr(10),chr(10)))<>'f1a1eba02559f324d164ee041e5f9d9e' THEN RAISE EXCEPTION 'ADMIN_STORE_ONCE_BASELINE_DRIFT';END IF;END $guard$;
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

DO $guard$ BEGIN IF md5(replace(pg_get_functiondef('admin_makeup_browse_v1(uuid,date,text,text,uuid,text,integer)'::regprocedure),chr(13)||chr(10),chr(10)))<>'38ea7fbc589669ae55a48b96cff84356' THEN RAISE EXCEPTION 'ADMIN_STORE_ONCE_BASELINE_DRIFT';END IF;END $guard$;
CREATE OR REPLACE FUNCTION public.admin_makeup_browse_v1(p_actor uuid, p_month date, p_course text, p_search text DEFAULT ''::text, p_branch uuid DEFAULT NULL::uuid, p_status text DEFAULT 'all'::text, p_page integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_policy public.task10_policy_activation%ROWTYPE;v_now timestamptz;v_next date;v_end timestamptz;v_setting jsonb;v_result jsonb;
BEGIN
 PERFORM public.task10_require_actor_v1(p_actor,'makeup');
 IF p_month IS NULL OR p_month<>date_trunc('month',p_month)::date OR p_month>='9999-01-01'
  OR p_course IS NULL OR p_course NOT IN ('kids_group','adult_group','private')
  OR p_search IS NULL OR length(p_search)>200 OR p_status IS NULL OR p_status NOT IN ('all','actionable','makeup','expired')
  OR p_page IS NULL OR p_page<1 OR p_page>10000 THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
 PERFORM pg_advisory_xact_lock_shared(10,1);PERFORM pg_advisory_xact_lock_shared(10,2);
 SELECT * INTO v_policy FROM public.task10_policy_activation WHERE singleton;
 v_next:=(p_month+interval '1 month')::date;v_end:=(p_month+interval '2 months') AT TIME ZONE 'Asia/Bangkok';v_now:=public.task10_clock_v1();
 IF p_course='kids_group' AND v_policy.effective_at IS NOT NULL THEN
  v_setting:=public.task10_makeup_setting_facts_v1();
  WITH family_scope AS MATERIALIZED (
   SELECT b.user_id,p.full_name AS parent_name,array_agg(DISTINCT s.branch_id) AS branch_ids,array_agg(DISTINCT br.name) AS branch_names
   FROM public.bookings b JOIN public.course_types c ON c.id=b.course_type_id JOIN public.profiles p ON p.id=b.user_id
    JOIN public.booking_sessions s ON s.booking_id=b.id JOIN public.branches br ON br.id=s.branch_id
   WHERE c.name::text='kids_group' AND s.date>=p_month AND s.date<v_next
   GROUP BY b.user_id,p.full_name
   HAVING (p_branch IS NULL OR bool_or(s.branch_id=p_branch)) AND (btrim(p_search)='' OR
    position(lower(btrim(p_search)) IN lower(coalesce(p.full_name,'')))>0 OR
    bool_or(position(lower(btrim(p_search)) IN lower(br.name))>0) OR EXISTS(SELECT 1 FROM public.children ch WHERE ch.parent_id=b.user_id
     AND position(lower(btrim(p_search)) IN lower(concat_ws(' ',ch.full_name,ch.nickname)))>0))
  ), scope_bookings AS MATERIALIZED (
   SELECT b.* FROM public.bookings b JOIN public.course_types c ON c.id=b.course_type_id JOIN family_scope f ON f.user_id=b.user_id
   WHERE c.name::text='kids_group' AND EXISTS(SELECT 1 FROM public.booking_sessions x WHERE x.booking_id=b.id AND x.date>=p_month AND x.date<v_next)
  ), rooted AS MATERIALIZED (
   SELECT s.*,b.user_id,b.status::text AS booking_status,public.task10_source_root_v1(s.id) AS root_id
   FROM public.booking_sessions s JOIN scope_bookings b ON b.id=s.booking_id
  ), month_rows AS MATERIALIZED (
   SELECT r.* FROM rooted r JOIN public.booking_sessions root ON root.id=r.root_id WHERE root.date>=p_month AND root.date<v_next
  ), used AS (
   SELECT user_id,count(DISTINCT root_id)::integer AS n FROM month_rows WHERE is_makeup GROUP BY user_id
  ), purchase AS (
   SELECT b.user_id,
    coalesce(sum(coalesce(b.entitlement_sessions,b.total_sessions)) FILTER(WHERE b.status::text='verified'),0)::integer AS n,
    coalesce(sum(coalesce(b.entitlement_sessions,b.total_sessions)) FILTER(WHERE b.status::text='pending_payment'),0)::integer AS pending,
    coalesce(sum(coalesce(b.entitlement_sessions,b.total_sessions)) FILTER(WHERE b.status::text='paid'),0)::integer AS reviewing,
    bool_or(b.status::text='verified' AND coalesce(b.entitlement_sessions,b.total_sessions,0)<=0) AS invalid
   FROM public.bookings b JOIN public.course_types c ON c.id=b.course_type_id JOIN family_scope f ON f.user_id=b.user_id
   WHERE c.name::text='kids_group' AND b.year=extract(year FROM p_month) AND b.month=extract(month FROM p_month) GROUP BY b.user_id
  ), candidates AS MATERIALIZED (
   SELECT s.*,w.credit_count,w.credit_id,CASE WHEN s.status::text='absent' AND EXISTS(SELECT 1 FROM public.attendance a
     WHERE a.booking_session_id=s.id AND a.student_id=s.child_id AND a.status::text='absent') AND NOT EXISTS(SELECT 1 FROM public.attendance a
     WHERE a.booking_session_id=s.id AND a.student_id=s.child_id AND a.status::text IN ('present','late')) THEN 'absent'
    WHEN s.status::text='walleted' AND w.credit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.attendance a
     WHERE a.booking_session_id=s.id AND a.student_id=s.child_id) THEN 'wallet' END AS kind
   FROM month_rows s LEFT JOIN LATERAL (
    SELECT count(*) AS credit_count,(array_agg(w.id ORDER BY w.stored_at DESC,w.id) FILTER(WHERE
     (w.stored_at>=v_policy.effective_at AND w.expires_at>=w.stored_at) OR EXISTS(SELECT 1 FROM public.task10_wallet_transition_evidence t
      WHERE t.credit_id=w.id AND t.source_root_id=s.root_id)))[1] AS credit_id
    FROM public.lesson_wallet_credits w WHERE w.original_session_id=s.id AND w.user_id=s.user_id AND w.booking_id=s.booking_id
     AND w.child_id=s.child_id AND w.status IN ('active','expired') AND w.redeemed_session_id IS NULL
   ) w ON s.status::text='walleted'
   WHERE s.booking_status='verified' AND NOT s.is_makeup AND s.child_id IS NOT NULL AND s.cancelled_at IS NULL AND s.status::text IN ('absent','walleted')
    AND NOT EXISTS(SELECT 1 FROM rooted m WHERE m.booking_id=s.booking_id AND m.is_makeup AND m.root_id=s.root_id)
    AND NOT EXISTS(SELECT 1 FROM rooted d WHERE d.booking_id=s.booking_id AND d.id<>s.id AND d.root_id=s.root_id
     AND d.status::text NOT IN ('rescheduled','cancelled','walleted','absent') AND d.cancelled_at IS NULL)
  ), sources AS MATERIALIZED (SELECT * FROM candidates WHERE kind IS NOT NULL), facts AS MATERIALIZED (
   SELECT f.*,coalesce(p.n,0) AS n,coalesce(p.pending,0) AS pending,coalesce(p.reviewing,0) AS reviewing,
    least(5,floor(coalesce(p.n,0)::numeric/4)::integer) AS quota,coalesce(u.n,0) AS used,
    greatest(0,least(5,floor(coalesce(p.n,0)::numeric/4)::integer)-coalesce(u.n,0)) AS remaining,
    (SELECT count(*) FROM sources s WHERE s.user_id=f.user_id)::integer AS source_count,
    (SELECT count(*) FROM sources s LEFT JOIN public.admin_makeup_credit_approvals g ON g.credit_id=s.credit_id AND g.source_session_id=s.id WHERE s.user_id=f.user_id AND v_now<v_end AND (SELECT enabled FROM public.admin_makeup_credit_control WHERE singleton)
      AND (g.status='approved' AND v_now<g.expires_at OR g.id IS NULL AND s.kind='wallet' AND (SELECT store_once_enabled FROM public.admin_makeup_credit_control WHERE singleton)
       AND NOT EXISTS(SELECT 1 FROM public.admin_makeup_credit_approvals prior WHERE prior.source_root_id=s.root_id)
       AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credits prior WHERE prior.booking_id=s.booking_id AND prior.redeemed_session_id IS NOT NULL AND public.task10_source_root_v1(prior.original_session_id)=s.root_id)
       AND public.admin_makeup_credit_store_proof_v1(s.id,s.credit_id)))::integer AS approved_sources,
    (SELECT count(*) FROM public.admin_makeup_credit_approvals g WHERE g.parent_id=f.user_id AND g.source_month=p_month AND g.used_mode='exception')::integer AS exception_used
   FROM family_scope f LEFT JOIN purchase p ON p.user_id=f.user_id LEFT JOIN used u ON u.user_id=f.user_id
  ), visible AS MATERIALIZED (
   SELECT * FROM facts WHERE (source_count>0 OR used>0) AND
    (p_status='all' OR p_status='actionable' AND v_policy.makeup_enabled AND v_now<v_end AND (remaining>0 OR approved_sources>0) AND source_count>0
     OR p_status='makeup' AND used>0 OR p_status='expired' AND v_now>=v_end)
  ), page AS MATERIALIZED (SELECT * FROM visible ORDER BY parent_name,user_id LIMIT 10 OFFSET (p_page-1)*10), cards AS (
   SELECT p.parent_name,p.user_id,jsonb_build_object('parentName',coalesce(p.parent_name,'ไม่พบชื่อผู้ปกครอง'),'branchIds',p.branch_ids,'branchNames',p.branch_names,
    'state',jsonb_build_object('active',v_policy.makeup_enabled,'state',v_policy.state,'parentId',p.user_id,'sourceMonth',to_char(p_month,'YYYY-MM'),
     'destinationMonth',to_char(v_next,'YYYY-MM'),'expiresAt',v_end,'sourcePurchase',jsonb_build_object('quantity',p.n,'pendingQuantity',p.pending,'awaitingReviewQuantity',p.reviewing),
     'destinationPurchase',public.task10_verified_purchase_v1(p.user_id,v_next),'minimum',v_setting,'quota',p.quota,'used',p.used,'remaining',p.remaining,
     'policyActor','admin','destinationPurchaseRequired',false,'policyVersion','admin-assistance-v1','approvedSources',p.approved_sources,'exceptionUsed',p.exception_used,'creditApprovalsEnabled',(SELECT enabled FROM public.admin_makeup_credit_control WHERE singleton),'storeOnceEnabled',(SELECT store_once_enabled FROM public.admin_makeup_credit_control WHERE singleton),
     'eligible',v_policy.makeup_enabled AND v_now<v_end AND (p.remaining>0 OR p.approved_sources>0) AND p.source_count>0,
     'reason',CASE WHEN NOT v_policy.makeup_enabled THEN 'paused' WHEN v_now>=v_end THEN 'expired' WHEN p.remaining=0 AND p.approved_sources=0 THEN 'quota_exhausted' WHEN p.source_count=0 THEN 'no_source' ELSE NULL END,
     'sources',coalesce((SELECT jsonb_agg(jsonb_build_object('sourceSessionId',s.id,'rootId',s.root_id,'bookingId',s.booking_id,'sourceChildId',s.child_id,'sourceDate',s.date,'kind',s.kind,'creditId',s.credit_id,
      'approval',(SELECT jsonb_build_object('id',g.id,'status',g.status,'expiresAt',g.expires_at) FROM public.admin_makeup_credit_approvals g WHERE g.credit_id=s.credit_id AND g.source_session_id=s.id),
      'approvalAvailable',(SELECT enabled FROM public.admin_makeup_credit_control WHERE singleton) AND s.kind='wallet' AND v_policy.makeup_enabled AND v_now<v_end AND NOT EXISTS(SELECT 1 FROM public.admin_makeup_credit_approvals g WHERE g.source_root_id=s.root_id)
       AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credits prior WHERE prior.booking_id=s.booking_id AND prior.redeemed_session_id IS NOT NULL AND public.task10_source_root_v1(prior.original_session_id)=s.root_id)
       AND public.admin_makeup_credit_store_proof_v1(s.id,s.credit_id)) ORDER BY s.id) FROM sources s WHERE s.user_id=p.user_id),'[]'),
     'children',coalesce((SELECT jsonb_agg(jsonb_build_object('id',ch.id,'name',CASE WHEN nullif(btrim(ch.full_name),'') IS NULL THEN coalesce(nullif(btrim(ch.nickname),''),'ไม่ระบุชื่อผู้เรียน') WHEN nullif(btrim(ch.nickname),'') IS NULL OR lower(btrim(ch.nickname))=lower(btrim(ch.full_name)) THEN btrim(ch.full_name) ELSE btrim(ch.nickname)||' - '||btrim(ch.full_name) END) ORDER BY ch.full_name,ch.id) FROM public.children ch WHERE ch.parent_id=p.user_id),'[]'),
     'destinations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'childId',d.child_id,'childName',CASE WHEN nullif(btrim(ch.full_name),'') IS NULL THEN coalesce(nullif(btrim(ch.nickname),''),'ไม่ระบุชื่อผู้เรียน') WHEN nullif(btrim(ch.nickname),'') IS NULL OR lower(btrim(ch.nickname))=lower(btrim(ch.full_name)) THEN btrim(ch.full_name) ELSE btrim(ch.nickname)||' - '||btrim(ch.full_name) END,'date',d.date,'startTime',d.start_time,'endTime',d.end_time,'branchName',br.name) ORDER BY d.date,d.id) FROM month_rows d JOIN public.branches br ON br.id=d.branch_id LEFT JOIN public.children ch ON ch.id=d.child_id AND ch.parent_id=p.user_id WHERE d.user_id=p.user_id AND d.is_makeup),'[]')
    )) AS card FROM page p
  ) SELECT jsonb_build_object('cards',coalesce((SELECT jsonb_agg(card ORDER BY parent_name,user_id) FROM cards),'[]'),'total',(SELECT count(*) FROM visible),
   'invalidPurchase',EXISTS(SELECT 1 FROM purchase WHERE invalid),'ambiguous',EXISTS(SELECT 1 FROM candidates WHERE credit_count>1)
    OR EXISTS(SELECT 1 FROM sources GROUP BY user_id,root_id HAVING count(*)>1)) INTO v_result;
  IF (v_result->>'invalidPurchase')::boolean THEN RAISE EXCEPTION 'TASK10_INVALID_PURCHASE_EVIDENCE'; END IF;
  IF (v_result->>'ambiguous')::boolean THEN RAISE EXCEPTION 'TASK10_AMBIGUOUS_SOURCE'; END IF;
  RETURN (v_result-'invalidPurchase'-'ambiguous')||jsonb_build_object('page',p_page,'pageSize',10);
 END IF;

 -- Legacy identities share their one-use monthly guard across course categories.
 -- Attendance is exact; a cached lifecycle alone never creates a usable source.
 WITH source AS MATERIALIZED (
  SELECT s.*,b.user_id,c.name::text AS course_type,coalesce(nullif(btrim(p.full_name),''),'ไม่พบชื่อผู้ปกครอง') AS user_name,br.name AS branch_name,
   CASE WHEN s.child_id IS NOT NULL THEN 'child:'||s.child_id::text ELSE 'self:'||b.user_id::text END AS identity,
   CASE WHEN s.child_id IS NULL THEN coalesce(nullif(btrim(p.full_name),''),'ไม่ระบุชื่อผู้เรียน') WHEN nullif(btrim(ch.full_name),'') IS NULL THEN coalesce(nullif(btrim(ch.nickname),''),'ไม่ระบุชื่อผู้เรียน') WHEN nullif(btrim(ch.nickname),'') IS NULL OR lower(btrim(ch.nickname))=lower(btrim(ch.full_name)) THEN btrim(ch.full_name) ELSE btrim(ch.nickname)||' - '||btrim(ch.full_name) END AS learner_name,
   EXISTS(SELECT 1 FROM public.booking_sessions origin JOIN public.bookings ob ON ob.id=origin.booking_id JOIN public.booking_sessions dest ON dest.rescheduled_from_id=origin.id AND dest.is_makeup
    WHERE origin.date>=p_month AND origin.date<v_next AND origin.child_id IS NOT DISTINCT FROM s.child_id AND (s.child_id IS NOT NULL OR ob.user_id=b.user_id)) AS makeup_month_used
  FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id JOIN public.course_types c ON c.id=b.course_type_id
   JOIN public.profiles p ON p.id=b.user_id JOIN public.branches br ON br.id=s.branch_id LEFT JOIN public.children ch ON ch.id=s.child_id AND ch.parent_id=b.user_id
  WHERE c.name::text=p_course AND b.status::text='verified' AND NOT s.is_makeup AND s.cancelled_at IS NULL
   AND s.date>=p_month AND s.date<v_next AND (s.child_id IS NULL AND coalesce(b.learner_type::text,'self')<>'child' OR ch.id IS NOT NULL)
   AND (s.status::text='absent' OR s.status::text='scheduled' AND (s.date+s.end_time) AT TIME ZONE 'Asia/Bangkok'<v_now)
   AND EXISTS(SELECT 1 FROM public.attendance a WHERE a.booking_session_id=s.id AND a.student_id=coalesce(s.child_id,b.user_id) AND a.status::text='absent')
   AND NOT EXISTS(SELECT 1 FROM public.attendance a WHERE a.booking_session_id=s.id AND a.status::text IN ('present','late'))
   AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credits w WHERE w.original_session_id=s.id)
   AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credit_members w WHERE w.original_session_id=s.id)
 ), people AS MATERIALIZED (
  SELECT identity,min(learner_name) AS learner_name,bool_or(makeup_month_used) AS used FROM source
  GROUP BY identity HAVING (p_branch IS NULL OR bool_or(branch_id=p_branch)) AND
   (btrim(p_search)='' OR bool_or(position(lower(btrim(p_search)) IN lower(concat_ws(' ',learner_name,user_name,branch_name)))>0))
 ), visible AS MATERIALIZED (
  SELECT * FROM people WHERE p_status='all' OR p_status='makeup' AND used OR p_status='actionable' AND NOT used AND v_now<v_end OR p_status='expired' AND NOT used AND v_now>=v_end
 ), page AS MATERIALIZED (SELECT * FROM visible ORDER BY learner_name,identity LIMIT 10 OFFSET (p_page-1)*10), chosen AS MATERIALIZED (SELECT s.* FROM source s JOIN page p ON p.identity=s.identity)
 SELECT jsonb_build_object('sessions',coalesce((SELECT jsonb_agg(to_jsonb(s)||jsonb_build_object('attendance_status','absent','attendance_scope_count',1) ORDER BY s.learner_name,s.identity,s.date,s.id) FROM chosen s),'[]'),
  'linkedSessions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'booking_id',d.booking_id,'child_id',d.child_id,'user_id',b.user_id,'branch_id',d.branch_id,'branch_name',br.name,'rescheduled_from_id',d.rescheduled_from_id,'date',d.date,'start_time',d.start_time,'end_time',d.end_time,'status',d.status,'is_makeup',d.is_makeup,'learner_name',s.learner_name,'user_name',s.user_name,'course_type',s.course_type) ORDER BY d.id)
   FROM chosen s JOIN public.booking_sessions d ON d.rescheduled_from_id=s.id AND d.is_makeup JOIN public.bookings b ON b.id=d.booking_id JOIN public.branches br ON br.id=d.branch_id),'[]'),
  'coaches','[]'::jsonb,'total',(SELECT count(*) FROM visible),'page',p_page,'pageSize',10) INTO v_result;
 RETURN v_result;
END $function$
;

DO $guard$ BEGIN IF md5(replace(pg_get_functiondef('admin_makeup_history_v1(uuid,date,uuid,text,uuid,text,integer)'::regprocedure),chr(13)||chr(10),chr(10)))<>'5db6da1da11bb41e76ad4ab80e777176' THEN RAISE EXCEPTION 'ADMIN_STORE_ONCE_BASELINE_DRIFT';END IF;END $guard$;
CREATE OR REPLACE FUNCTION public.admin_makeup_history_v1(p_actor uuid, p_month date, p_user uuid, p_course text, p_child uuid DEFAULT NULL::uuid, p_kind text DEFAULT 'all'::text, p_page integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_result jsonb;
BEGIN
 PERFORM public.task10_require_actor_v1(p_actor,'makeup');
 IF p_month IS NULL OR p_month<>date_trunc('month',p_month)::date OR p_month>='9999-01-01' OR p_user IS NULL
  OR p_course IS NULL OR p_course NOT IN ('kids_group','adult_group','private') OR p_kind IS NULL OR p_kind NOT IN ('all','wallet','absent','use')
  OR p_page IS NULL OR p_page<1 OR p_page>10000 OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user)
  OR p_child IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.children WHERE id=p_child AND parent_id=p_user) THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
 WITH scope_bookings AS MATERIALIZED (
  SELECT b.id,b.user_id,c.name::text AS course_type FROM public.bookings b JOIN public.course_types c ON c.id=b.course_type_id
  WHERE b.user_id=p_user AND c.name::text=p_course AND EXISTS(SELECT 1 FROM public.booking_sessions s WHERE s.booking_id=b.id
   AND NOT s.is_makeup AND s.date>=p_month AND s.date<(p_month+interval '1 month')::date
   AND (p_course='kids_group' AND p_child IS NULL AND s.child_id IS NOT NULL OR s.child_id IS NOT DISTINCT FROM p_child))
 ), rooted AS MATERIALIZED (
  SELECT s.*,b.user_id,b.course_type,public.task10_source_root_v1(s.id) AS root_id FROM public.booking_sessions s JOIN scope_bookings b ON b.id=s.booking_id
 ), selected_roots AS MATERIALIZED (
  SELECT DISTINCT root_id FROM rooted WHERE NOT is_makeup AND date>=p_month AND date<(p_month+interval '1 month')::date
   AND (p_course='kids_group' AND p_child IS NULL AND child_id IS NOT NULL OR child_id IS NOT DISTINCT FROM p_child)
 ), related AS MATERIALIZED (SELECT r.* FROM rooted r JOIN selected_roots s ON s.root_id=r.root_id), credits AS MATERIALIZED (
  SELECT w.* FROM public.lesson_wallet_credits w WHERE w.user_id=p_user AND
   (EXISTS(SELECT 1 FROM related r WHERE r.id=w.original_session_id) OR EXISTS(SELECT 1 FROM public.lesson_wallet_credit_members cm JOIN related r ON r.id=cm.original_session_id WHERE cm.credit_id=w.id))
 ), events AS MATERIALIZED (
  SELECT 'store:'||w.id::text AS id,'wallet'::text AS kind,
   CASE WHEN a.action='attendance_gap_return_entitlement' THEN 'คืนสิทธิ์เข้ากระเป๋า' ELSE 'เก็บเข้ากระเป๋า' END AS title,
   w.stored_at AS at,'เก็บเมื่อ'::text AS time_label,w.original_session_id AS source_id,NULL::uuid AS destination_id,a.user_id AS actor_id,
   CASE WHEN a.action IN ('admin_lesson_assistance','attendance_gap_return_entitlement') THEN a.details->>'reason' END AS reason,
   CASE WHEN EXISTS(SELECT 1 FROM public.task10_family_makeup_uses u WHERE u.credit_id=w.id) THEN 'ใช้เป็นต้นทางชดเชยแล้ว'
    WHEN w.redeemed_session_id IS NOT NULL THEN 'ใช้กระเป๋าตามปกติแล้ว' WHEN w.status='expired' THEN 'หมดอายุกระเป๋าปกติ' ELSE 'เก็บในกระเป๋า' END AS status,
   w.expires_at AS wallet_expires_at,w.id AS credit_id
  FROM credits w LEFT JOIN LATERAL (
   SELECT a.* FROM public.activity_logs a WHERE
    a.action='store_lesson_wallet_credit' AND a.entity_id=w.id OR
    a.action='admin_lesson_assistance' AND a.details->>'operation'='store' AND (a.details->'result'->>'credit_id'=w.id::text OR a.details->'result'->>'creditId'=w.id::text) OR
    a.action='attendance_gap_return_entitlement' AND a.details->>'creditId'=w.id::text
   ORDER BY (a.action IN ('admin_lesson_assistance','attendance_gap_return_entitlement')) DESC,a.created_at,a.id LIMIT 1
  ) a ON true
  UNION ALL
  SELECT 'redeem:'||w.id::text,'use','ใช้กระเป๋าเรียนตามปกติ',w.redeemed_at,'ใช้กระเป๋าเมื่อ',w.original_session_id,w.redeemed_session_id,a.user_id,
   CASE WHEN a.action='admin_lesson_assistance' THEN a.details->>'reason' END,'ไม่หักโควตาชดเชย',w.expires_at,w.id
  FROM credits w JOIN public.booking_sessions d ON d.id=w.redeemed_session_id AND NOT d.is_makeup LEFT JOIN LATERAL (
   SELECT a.* FROM public.activity_logs a WHERE a.action='redeem_lesson_wallet_credit' AND a.entity_id=w.id
   ORDER BY a.created_at,a.id LIMIT 1
  ) a ON true
  UNION ALL
  SELECT 'attendance:'||a.id::text,'absent','ขาดเรียน',a.checked_at,'บันทึกเช็คชื่อล่าสุด',r.id,NULL::uuid,NULL::uuid,NULL::text,
   CASE WHEN EXISTS(SELECT 1 FROM related d WHERE d.rescheduled_from_id=r.id AND d.is_makeup) THEN 'ใช้เป็นต้นทางชดเชยแล้ว' ELSE 'มีหลักฐานขาดเรียน' END,NULL::timestamptz,NULL::uuid
  FROM related r JOIN LATERAL (SELECT * FROM public.attendance a WHERE a.booking_session_id=r.id AND a.student_id=coalesce(r.child_id,p_user)
   ORDER BY a.checked_at DESC NULLS LAST,a.id DESC LIMIT 1) a ON a.status::text='absent' WHERE NOT r.is_makeup
  UNION ALL
  SELECT 'makeup:'||d.id::text,'use','จัดวันชดเชยแล้ว',coalesce(u.created_at,a.created_at),'จัดชดเชยเมื่อ',d.rescheduled_from_id,d.id,coalesce(u.actor_id,a.user_id),a.details->>'reason',
   CASE WHEN d.cancelled_at IS NOT NULL OR d.status::text='cancelled' THEN 'รายการชดเชยถูกยกเลิก' ELSE 'จัดชดเชยแล้ว' END,NULL::timestamptz,NULL::uuid
  FROM related d LEFT JOIN public.task10_family_makeup_uses u ON u.destination_session_id=d.id LEFT JOIN LATERAL (
   SELECT a.* FROM public.activity_logs a WHERE a.action='admin_lesson_assistance' AND a.details->>'operation'='makeup'
    AND (a.details->'result'->'data'->>'id'=d.id::text OR u.request_id IS NOT NULL AND a.details->>'requestId'=u.request_id::text AND a.entity_id=d.rescheduled_from_id)
   ORDER BY a.created_at,a.id LIMIT 1
  ) a ON true WHERE d.is_makeup AND d.rescheduled_from_id IS NOT NULL
  UNION ALL
  SELECT 'move:'||d.id::text,'use','ย้ายวัน / รอบเรียน',a.created_at,'ย้ายเมื่อ',d.rescheduled_from_id,d.id,a.user_id,
   CASE WHEN a.action='admin_lesson_assistance' THEN a.details->>'reason' END,'ย้ายโดยใช้สิทธิ์เดิม',NULL::timestamptz,NULL::uuid
  FROM related d LEFT JOIN LATERAL (
   SELECT a.* FROM public.activity_logs a WHERE
    a.action='reschedule_booking_session' AND a.entity_id=d.rescheduled_from_id AND a.details->>'newSessionId'=d.id::text OR
    a.action='admin_lesson_assistance' AND a.details->>'operation'='reschedule' AND a.entity_id=d.rescheduled_from_id
     AND (a.details->'result'->>'sessionId'=d.id::text OR a.details->'result'->'sessionIds' ? d.id::text)
   ORDER BY (a.action='admin_lesson_assistance') DESC,a.created_at,a.id LIMIT 1
  ) a ON true WHERE NOT d.is_makeup AND d.rescheduled_from_id IS NOT NULL
   AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credits w WHERE w.redeemed_session_id=d.id)
   AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credit_members cm WHERE cm.redeemed_session_id=d.id)
  UNION ALL
  SELECT 'cancel:'||r.id::text,'use','ยกเลิกรอบเรียน',r.cancelled_at,'ยกเลิกเมื่อ',r.id,NULL::uuid,NULL::uuid,NULL::text,'ยกเลิกรอบแล้ว',NULL::timestamptz,NULL::uuid
  FROM related r WHERE r.cancelled_at IS NOT NULL
 UNION ALL
  SELECT 'approval:'||d.id::text,'wallet',CASE WHEN d.operation='approve' THEN 'ยืนยันใช้เครดิตจากการเก็บ' ELSE 'เพิกถอนการยืนยันกรณีพิเศษ' END,
   d.created_at,'บันทึกภายใน Admin เมื่อ',g.source_session_id,NULL::uuid,d.actor_id,d.reason,
   CASE WHEN d.operation='revoke' THEN 'เพิกถอนแล้ว' WHEN g.status='consumed' THEN 'ใช้ต้นทางแล้ว' WHEN public.task10_clock_v1()>=g.expires_at THEN 'หมดอายุชดเชยแล้ว' ELSE 'ยืนยันแล้ว รอเลือกวัน' END,NULL::timestamptz,g.credit_id
  FROM public.admin_makeup_credit_approvals g JOIN public.admin_makeup_credit_decisions d ON d.approval_id=g.id
   JOIN selected_roots r ON r.root_id=g.source_root_id WHERE g.parent_id=p_user AND g.source_month=p_month
    AND NOT EXISTS(SELECT 1 FROM public.admin_makeup_store_requests r WHERE r.actor_id=d.actor_id AND r.request_id=d.request_id
     AND r.result->'approval'->>'approvalId'=g.id::text AND r.result->>'storePolicy'='admin-store-once-v1')
 ), filtered AS MATERIALIZED (SELECT * FROM events WHERE p_kind='all' OR kind=p_kind), page AS MATERIALIZED (
  SELECT * FROM filtered ORDER BY at DESC NULLS LAST,id LIMIT 20 OFFSET (p_page-1)*20
 ), enriched AS (
  SELECT e.*,jsonb_build_object('id',e.id,'kind',e.kind,'title',e.title,'at',e.at,'timeLabel',e.time_label,'actor',p.full_name,'reason',e.reason,'status',e.status,'walletExpiresAt',e.wallet_expires_at,
   'learnerFullName',CASE WHEN d.id IS NOT NULL THEN CASE WHEN d.child_id IS NULL THEN owner.full_name ELSE dc.full_name END ELSE CASE WHEN s.child_id IS NULL THEN owner.full_name ELSE sc.full_name END END,
   'learnerNickname',CASE WHEN d.id IS NOT NULL THEN dc.nickname ELSE sc.nickname END,
   'source',jsonb_build_object('id',s.id,'date',s.date,'startTime',s.start_time,'endTime',s.end_time,'branchName',sb.name,'courseType',b.course_type),
   'destination',CASE WHEN d.id IS NOT NULL THEN jsonb_build_object('id',d.id,'date',d.date,'startTime',d.start_time,'endTime',d.end_time,'branchName',db.name,'isMakeup',d.is_makeup) END,
   'participants',coalesce((SELECT jsonb_agg(jsonb_build_object('childId',cm.child_id,'fullName',CASE WHEN cm.child_id IS NULL THEN owner.full_name ELSE ch.full_name END,'nickname',ch.nickname) ORDER BY cm.original_session_id)
    FROM public.lesson_wallet_credit_members cm LEFT JOIN public.children ch ON ch.id=cm.child_id AND ch.parent_id=p_user WHERE cm.credit_id=e.credit_id),'[]')) AS event
  FROM page e JOIN public.booking_sessions s ON s.id=e.source_id JOIN scope_bookings b ON b.id=s.booking_id JOIN public.profiles owner ON owner.id=p_user
   JOIN public.branches sb ON sb.id=s.branch_id LEFT JOIN public.profiles p ON p.id=e.actor_id LEFT JOIN public.children sc ON sc.id=s.child_id AND sc.parent_id=p_user
   LEFT JOIN public.booking_sessions d ON d.id=e.destination_id LEFT JOIN public.branches db ON db.id=d.branch_id LEFT JOIN public.children dc ON dc.id=d.child_id AND dc.parent_id=p_user
 ) SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(event ORDER BY at DESC NULLS LAST,id) FROM enriched),'[]'),'total',(SELECT count(*) FROM filtered),
  'counts',jsonb_build_object('all',(SELECT count(*) FROM events),'wallet',(SELECT count(*) FROM events WHERE kind='wallet'),'absent',(SELECT count(*) FROM events WHERE kind='absent'),'use',(SELECT count(*) FROM events WHERE kind='use')),
  'page',p_page,'pageSize',20) INTO v_result;
 RETURN v_result;
END $function$
;
UPDATE public.admin_makeup_credit_control SET writer_hash=md5(pg_get_functiondef('public.lesson_source_transition_v1(uuid,text,uuid,jsonb)'::regprocedure)) WHERE singleton;
NOTIFY pgrst,'reload schema';COMMIT;
