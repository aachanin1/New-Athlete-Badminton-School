-- Source-backed one-hour rights for newly returned multi-hour Private rounds.
-- Uses the existing atomic package-unit writer; creates no fictitious lessons,
-- payments, absent records, catalog changes or historical conversion.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='60s';
SELECT pg_advisory_xact_lock(10,1);

CREATE TABLE public.no_class_return_hour_units (
 unit_id uuid PRIMARY KEY REFERENCES public.booking_package_units(id),
 credit_id uuid NOT NULL REFERENCES public.lesson_wallet_credits(id),
 ordinal integer NOT NULL CHECK(ordinal BETWEEN 1 AND 24),
 request_id uuid NOT NULL REFERENCES public.admin_no_class_return_receipts(request_id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(credit_id,ordinal)
);
ALTER TABLE public.no_class_return_hour_units ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.no_class_return_hour_units FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.no_class_return_hour_units TO service_role;
CREATE TRIGGER no_class_return_hour_links_immutable BEFORE UPDATE OR DELETE ON public.no_class_return_hour_units
 FOR EACH ROW EXECUTE FUNCTION public.task10_immutable_evidence_v1();

CREATE FUNCTION public.no_class_return_issue_hours_v1(p_credit uuid,p_request uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c lesson_wallet_credits%ROWTYPE;r admin_no_class_return_receipts%ROWTYPE;
 n integer;amount numeric;people jsonb;offset_ordinal integer;u uuid;i integer;existing integer;
BEGIN
 SELECT * INTO r FROM admin_no_class_return_receipts WHERE request_id=p_request;
 IF NOT FOUND OR NOT(r.result->'credits' @> jsonb_build_array(jsonb_build_object('creditId',p_credit)))
 THEN RAISE EXCEPTION 'NO_CLASS_RETURN_HOUR_SOURCE';END IF;
 -- Return already owns these rows in this order. Replay takes the same order.
 PERFORM 1 FROM bookings WHERE id=(SELECT booking_id FROM lesson_wallet_credits WHERE id=p_credit) FOR UPDATE;
 SELECT * INTO c FROM lesson_wallet_credits WHERE id=p_credit FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM bookings b JOIN course_types ct ON ct.id=b.course_type_id
   WHERE b.id=c.booking_id AND b.user_id=c.user_id AND b.status::text='verified' AND ct.name::text='private')
 THEN RAISE EXCEPTION 'NO_CLASS_RETURN_HOUR_SOURCE';END IF;
 amount:=extract(epoch FROM c.original_end_time-c.original_start_time)/3600;
 IF amount<=1 THEN RETURN;END IF;
 IF amount<>trunc(amount) OR amount>24 THEN RAISE EXCEPTION 'NO_CLASS_RETURN_HOUR_DURATION';END IF;
 n:=amount::integer;
 SELECT count(*) INTO existing FROM no_class_return_hour_units WHERE credit_id=c.id;
 IF existing>0 THEN
  IF existing<>n OR c.status<>'redeemed' OR EXISTS(SELECT 1 FROM no_class_return_hour_units m
    JOIN booking_package_units u ON u.id=m.unit_id WHERE m.credit_id=c.id AND
    (m.request_id<>p_request OR u.booking_id<>c.booking_id OR u.expires_at<>c.expires_at))
  THEN RAISE EXCEPTION 'NO_CLASS_RETURN_HOUR_SOURCE';END IF;
  RETURN;
 END IF;
 IF c.status<>'active' OR c.redeemed_session_id IS NOT NULL OR c.expires_at<clock_timestamp()
 THEN RAISE EXCEPTION 'NO_CLASS_RETURN_HOUR_SOURCE';END IF;
 SELECT coalesce(jsonb_agg(child_id ORDER BY original_session_id),jsonb_build_array(c.child_id)) INTO people
 FROM lesson_wallet_credit_members WHERE credit_id=c.id;
 IF jsonb_array_length(people)<>coalesce(c.participant_count,1) OR
    (SELECT count(DISTINCT coalesce(x#>>'{}','self')) FROM jsonb_array_elements(people)x)<>jsonb_array_length(people)
 THEN RAISE EXCEPTION 'NO_CLASS_RETURN_HOUR_ROSTER';END IF;
 SELECT coalesce(max(ordinal),0) INTO offset_ordinal FROM booking_package_units WHERE booking_id=c.booking_id;
 FOR i IN 1..n LOOP
  INSERT INTO booking_package_units(booking_id,ordinal,participants,expires_at)
   VALUES(c.booking_id,offset_ordinal+i,people,c.expires_at) RETURNING id INTO u;
  INSERT INTO no_class_return_hour_units(unit_id,credit_id,ordinal,request_id) VALUES(u,c.id,i,p_request);
 END LOOP;
 -- The source credit is exchanged, not spent on a lesson. Mapped units carry
 -- its entire balance. Readers suppress this internal exchange in use history.
 PERFORM set_config('lesson_source.write','authorized',true);
 UPDATE lesson_wallet_credits SET status='redeemed' WHERE id=c.id;
 INSERT INTO activity_logs(user_id,action,entity_type,entity_id,details)
 VALUES(r.actor_id,'no_class_return_hour_units_issued','lesson_wallet_credits',c.id,
  jsonb_build_object('requestId',p_request,'hours',n,'expiresAt',c.expires_at,'participants',people));
END $$;
REVOKE ALL ON FUNCTION public.no_class_return_issue_hours_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.no_class_return_hour_unit_guard_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u booking_package_units%ROWTYPE;c lesson_wallet_credits%ROWTYPE;people jsonb;actual jsonb;ids uuid[];
BEGIN
 IF NOT EXISTS(SELECT 1 FROM no_class_return_hour_units WHERE unit_id=OLD.id) THEN
  IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;
 END IF;
 IF TG_OP='DELETE' OR ROW(NEW.booking_id,NEW.ordinal,NEW.participants,NEW.expires_at)
   IS DISTINCT FROM ROW(OLD.booking_id,OLD.ordinal,OLD.participants,OLD.expires_at)
   OR OLD.status<>'available' AND ROW(NEW.status,NEW.session_ids,NEW.redeemed_at)
     IS DISTINCT FROM ROW(OLD.status,OLD.session_ids,OLD.redeemed_at)
   OR OLD.status='available' AND NEW.status NOT IN ('available','redeemed','expired')
 THEN RAISE EXCEPTION 'NO_CLASS_RETURN_HOUR_IMMUTABLE';END IF;
 IF NEW.status='redeemed' THEN
  SELECT w.* INTO c FROM no_class_return_hour_units m JOIN lesson_wallet_credits w ON w.id=m.credit_id WHERE m.unit_id=NEW.id;
  SELECT jsonb_agg(x ORDER BY coalesce(x#>>'{}','self')) INTO people FROM jsonb_array_elements(OLD.participants)x;
  SELECT jsonb_agg(to_jsonb(s.child_id) ORDER BY coalesce(s.child_id::text,'self')),array_agg(s.id ORDER BY s.id)
  INTO actual,ids FROM booking_sessions s WHERE s.id=ANY(NEW.session_ids) AND s.booking_id=NEW.booking_id
    AND s.end_time-s.start_time=interval '1 hour' AND NOT s.is_makeup;
  IF actual IS DISTINCT FROM people OR cardinality(ids)<>cardinality(NEW.session_ids)
   OR cardinality(NEW.session_ids)<>(SELECT count(DISTINCT x) FROM unnest(NEW.session_ids)x)
   OR (SELECT count(DISTINCT ROW(s.schedule_slot_id,s.date,s.start_time,s.end_time,s.branch_id))
       FROM booking_sessions s WHERE s.id=ANY(NEW.session_ids))<>1
   OR EXISTS(SELECT 1 FROM booking_sessions s WHERE s.id=ANY(NEW.session_ids)
     AND (s.date+s.end_time) AT TIME ZONE 'Asia/Bangkok'>c.expires_at)
  THEN RAISE EXCEPTION 'NO_CLASS_RETURN_HOUR_ROSTER';END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.no_class_return_hour_unit_guard_v1() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER no_class_return_hour_unit_guard BEFORE UPDATE OR DELETE ON public.booking_package_units
 FOR EACH ROW EXECUTE FUNCTION public.no_class_return_hour_unit_guard_v1();

-- Follow actual reschedule ancestry to the original consumed hourly unit.
-- This provenance lets Store and later no-class returns retain exact expiry.
CREATE FUNCTION public.no_class_return_hour_credit_v1(p_session uuid) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ids uuid[];credits uuid[];s booking_sessions%ROWTYPE;u record;
BEGIN
 SELECT * INTO s FROM booking_sessions WHERE id=p_session;
 IF NOT FOUND THEN RETURN NULL;END IF;
 WITH RECURSIVE chain AS (
  SELECT id,booking_id,child_id,rescheduled_from_id,ARRAY[id] seen FROM booking_sessions WHERE id=p_session
  UNION ALL SELECT p.id,p.booking_id,p.child_id,p.rescheduled_from_id,c.seen||p.id
   FROM chain c JOIN booking_sessions p ON p.id=c.rescheduled_from_id
   WHERE p.booking_id=c.booking_id AND p.child_id IS NOT DISTINCT FROM c.child_id AND NOT(p.id=ANY(c.seen)) AND cardinality(c.seen)<65
 ) SELECT array_agg(id) INTO ids FROM chain;
 SELECT array_agg(DISTINCT m.credit_id) INTO credits FROM no_class_return_hour_units m
 JOIN booking_package_units pu ON pu.id=m.unit_id WHERE pu.booking_id=s.booking_id AND pu.session_ids&&ids;
 IF coalesce(cardinality(credits),0)=0 THEN RETURN NULL;END IF;
 IF cardinality(credits)<>1 THEN RAISE EXCEPTION 'NO_CLASS_RETURN_HOUR_SOURCE';END IF;
 SELECT pu.*,w.user_id,w.booking_id credit_booking,w.expires_at credit_expiry,w.status credit_status INTO u
 FROM no_class_return_hour_units m JOIN booking_package_units pu ON pu.id=m.unit_id
 JOIN lesson_wallet_credits w ON w.id=m.credit_id WHERE m.credit_id=credits[1] AND pu.session_ids&&ids;
 IF NOT FOUND OR u.status<>'redeemed' OR u.credit_status<>'redeemed' OR u.booking_id<>u.credit_booking
   OR u.expires_at<>u.credit_expiry OR s.end_time-s.start_time<>interval '1 hour'
   OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(u.participants)x WHERE (x#>>'{}')::uuid IS NOT DISTINCT FROM s.child_id)
 THEN RAISE EXCEPTION 'NO_CLASS_RETURN_HOUR_SOURCE';END IF;
 RETURN credits[1];
END $$;
REVOKE ALL ON FUNCTION public.no_class_return_hour_credit_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;

DO $$ BEGIN IF md5(replace(pg_get_functiondef('admin_no_class_return_v1(uuid,uuid,text,uuid,text,text,text)'::regprocedure),chr(13),''))<>'ef348a118ab046ba59b8fa3ee415c5f6' THEN RAISE EXCEPTION 'NO_CLASS_HOURLY_BASELINE_DRIFT admin_no_class_return_v1';END IF;END $$;
CREATE OR REPLACE FUNCTION public.admin_no_class_return_v1(p_actor uuid, p_anchor uuid, p_mode text, p_request uuid DEFAULT NULL::uuid, p_expected text DEFAULT NULL::text, p_reason text DEFAULT NULL::text, p_ip text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET lock_timeout TO '3s'
 SET "TimeZone" TO 'Asia/Bangkok'
AS $function$
DECLARE v_prior public.admin_no_class_return_receipts%ROWTYPE; v_preview jsonb; v_fp text; v_reason text:=nullif(trim(p_reason),'');
 v_ids uuid[]; v_assignments uuid[]; v_parent uuid; v_parents uuid[]; v_months date[]; v_unit jsonb; v_result jsonb;
 v_credits jsonb:='[]'; v_credit public.lesson_wallet_credits%ROWTYPE; v_id uuid; v_unit_ids uuid[]; v_at timestamptz;
BEGIN
 PERFORM public.task10_require_actor_v1(p_actor,'makeup');
 IF p_anchor IS NULL OR p_mode IS NULL OR p_mode NOT IN ('preview','commit','status') THEN RAISE EXCEPTION 'NO_CLASS_RETURN_INVALID_REQUEST';END IF;
 IF p_mode='preview' THEN RETURN public.admin_no_class_preview_v1(p_anchor);END IF;
 IF p_request IS NULL THEN RAISE EXCEPTION 'NO_CLASS_RETURN_INVALID_REQUEST';END IF;
 IF p_mode='status' THEN
  IF NOT pg_try_advisory_xact_lock(hashtextextended('no-class-return-request|'||p_request::text,0)) THEN
   RETURN jsonb_build_object('confirmed',false,'requestId',p_request,'pending',true,'definitive',false);END IF;
 ELSE
  IF v_reason IS NULL OR length(v_reason)>2000 OR p_expected IS NULL OR p_expected!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'NO_CLASS_RETURN_INVALID_REQUEST';END IF;
  -- Reserve the request before admission, so status also detects a queued commit.
  PERFORM pg_advisory_xact_lock(hashtextextended('no-class-return-request|'||p_request::text,0));
  -- Serialize new round returns with weekly close; source writers use parent v2 below.
  PERFORM pg_advisory_xact_lock(hashtextextended('no-class-return-payroll-admission-v1',0));
 END IF;
 v_fp:=encode(extensions.digest(jsonb_build_array(p_actor,p_anchor,p_expected,v_reason)::text,'sha256'),'hex');
 SELECT * INTO v_prior FROM public.admin_no_class_return_receipts WHERE request_id=p_request;
 IF FOUND THEN
  IF v_prior.actor_id IS DISTINCT FROM p_actor OR v_prior.anchor_id IS DISTINCT FROM p_anchor
   OR (p_mode='commit' AND v_prior.request_fingerprint<>v_fp) THEN RAISE EXCEPTION 'NO_CLASS_RETURN_REQUEST_MISMATCH';END IF;
  RETURN v_prior.result;
 END IF;
 IF p_mode='status' THEN RETURN jsonb_build_object('confirmed',false,'requestId',p_request,'definitive',true);END IF;
 PERFORM pg_advisory_xact_lock_shared(10,1);PERFORM pg_advisory_xact_lock_shared(10,2);
 v_preview:=public.admin_no_class_preview_v1(p_anchor);
 IF v_preview->>'scopeFingerprint'<>p_expected THEN RAISE EXCEPTION 'NO_CLASS_RETURN_SCOPE_CHANGED';END IF;
 IF NOT (v_preview->>'eligible')::boolean THEN RAISE EXCEPTION '%',v_preview->'blockers'->0->>'code';END IF;
 SELECT array_agg(x::uuid ORDER BY x) INTO v_ids FROM jsonb_array_elements_text(v_preview->'targetSessionIds')x;
 SELECT array_agg(DISTINCT b.user_id ORDER BY b.user_id) INTO v_parents FROM public.booking_sessions bs JOIN public.bookings b ON b.id=bs.booking_id WHERE bs.id=ANY(v_ids);
 -- Current source/attendance writers admit by parent (v2), ahead of month locks.
 FOREACH v_parent IN ARRAY v_parents LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('lesson-source-attendance-parent-v2|'||v_parent::text,0));
 END LOOP;
 FOREACH v_parent IN ARRAY v_parents LOOP
  SELECT array_agg(DISTINCT m ORDER BY m) INTO v_months FROM (
   SELECT date_trunc('month',s.date)::date AS m FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id WHERE s.id=ANY(v_ids) AND b.user_id=v_parent
   UNION SELECT (date_trunc('month',s.date)+interval '1 month')::date FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id WHERE s.id=ANY(v_ids) AND b.user_id=v_parent) months;
  PERFORM public.task10_lock_family_months_v1(v_parent,v_months);
  PERFORM pg_advisory_xact_lock(hashtextextended('lesson-source-parent|'||v_parent::text,0));
 END LOOP;
 PERFORM b.id FROM public.bookings b WHERE b.user_id=ANY(v_parents) ORDER BY b.id FOR UPDATE NOWAIT;
 PERFORM s.id FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id WHERE b.user_id=ANY(v_parents) ORDER BY s.id FOR UPDATE OF s NOWAIT;
 PERFORM c.id FROM public.lesson_wallet_credits c WHERE c.user_id=ANY(v_parents) ORDER BY c.id FOR UPDATE NOWAIT;
 PERFORM m.original_session_id FROM public.lesson_wallet_credit_members m JOIN public.lesson_wallet_credits c ON c.id=m.credit_id WHERE c.user_id=ANY(v_parents) ORDER BY m.credit_id,m.original_session_id FOR UPDATE OF m NOWAIT;
 PERFORM g.id FROM public.coach_assignment_groups g WHERE g.schedule_slot_id=(v_preview->>'scheduleSlotId')::uuid ORDER BY g.id FOR UPDATE NOWAIT;
 PERFORM ss.id FROM public.schedule_slots ss WHERE ss.id=(v_preview->>'scheduleSlotId')::uuid FOR UPDATE NOWAIT;
 PERFORM m.id FROM public.coach_assignment_group_students m JOIN public.coach_assignment_groups g ON g.id=m.group_id
  WHERE g.schedule_slot_id=(v_preview->>'scheduleSlotId')::uuid ORDER BY m.id FOR UPDATE OF m NOWAIT;
 v_preview:=public.admin_no_class_preview_v1(p_anchor);
 IF v_preview->>'scopeFingerprint'<>p_expected THEN RAISE EXCEPTION 'NO_CLASS_RETURN_SCOPE_CHANGED';END IF;
 IF NOT (v_preview->>'eligible')::boolean THEN RAISE EXCEPTION '%',v_preview->'blockers'->0->>'code';END IF;
 SELECT coalesce(array_agg(DISTINCT id ORDER BY id),'{}'::uuid[]) INTO v_assignments FROM (
  SELECT g.id FROM public.coach_assignment_groups g JOIN public.coach_assignment_group_students m ON m.group_id=g.id WHERE m.booking_session_id=ANY(v_ids)
  UNION SELECT ca.id FROM public.coach_assignments ca WHERE ca.schedule_slot_id=(v_preview->>'scheduleSlotId')::uuid
   AND ca.coach_id=(v_preview->>'coachId')::uuid AND NOT EXISTS(SELECT 1 FROM public.coach_assignment_groups g WHERE g.schedule_slot_id=ca.schedule_slot_id)) assignments;
 FOR v_unit IN SELECT value FROM jsonb_array_elements(v_preview->'units') ORDER BY value->>'unitId' LOOP
  v_result:=public.lesson_source_transition_v1(p_actor,'return_entitlement',(v_unit->>'unitId')::uuid,
   jsonb_build_object('reason',v_reason,'requestId',p_request,'ipAddress',p_ip));
  v_id:=coalesce((v_result->>'creditId')::uuid,(v_result->>'credit_id')::uuid);
  SELECT * INTO v_credit FROM public.lesson_wallet_credits WHERE id=v_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NO_CLASS_RETURN_INCOMPLETE';END IF;
  SELECT array_agg(x::uuid ORDER BY x) INTO v_unit_ids FROM jsonb_array_elements_text(v_unit->'sessionIds')x;
  IF v_credit.status<>'active' OR v_credit.expires_at IS DISTINCT FROM (v_unit->>'expiresAt')::timestamptz
   OR v_credit.original_session_id IS DISTINCT FROM (v_unit->>'unitId')::uuid
   OR coalesce(v_credit.participant_count,1)<>cardinality(v_unit_ids)
   OR (v_unit->>'unit'='hour' AND extract(epoch FROM (v_credit.original_end_time-v_credit.original_start_time))/3600 IS DISTINCT FROM (v_unit->>'amount')::numeric)
   OR (v_unit->>'unit'='session' AND (v_unit->>'amount')::numeric<>1) THEN RAISE EXCEPTION 'NO_CLASS_RETURN_INCOMPLETE';END IF;
  -- Kids' historical return helper does not retire assignment memberships.
  FOREACH v_id IN ARRAY v_unit_ids LOOP
   IF EXISTS(SELECT 1 FROM public.coach_assignment_group_students WHERE booking_session_id=v_id) THEN
    PERFORM public.retire_coach_assignment_membership_v1(v_id,p_actor,'wallet_store');END IF;
  END LOOP;
  v_credits:=v_credits||jsonb_build_array(v_unit||jsonb_build_object('creditId',v_credit.id));
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.booking_sessions WHERE id=ANY(v_ids) AND status::text<>'walleted')
  OR EXISTS(SELECT 1 FROM public.attendance WHERE booking_session_id=ANY(v_ids))
  OR EXISTS(SELECT 1 FROM public.coach_assignment_group_students WHERE booking_session_id=ANY(v_ids)) THEN RAISE EXCEPTION 'NO_CLASS_RETURN_INCOMPLETE';END IF;
 v_at:=clock_timestamp();
 v_result:=jsonb_build_object('confirmed',true,'requestId',p_request,'anchorId',p_anchor,'recordedAt',v_at,
  'targetSessionIds',v_ids,'targetCount',cardinality(v_ids),'credits',v_credits,'coachHours',0);
 INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details,ip_address)
  VALUES(p_actor,'attendance_gap_round_not_taught_returned','booking_sessions',p_anchor,
   v_result||jsonb_build_object('reason',v_reason,'scheduleSlotId',v_preview->'scheduleSlotId','coachId',v_preview->'coachId'),nullif(split_part(p_ip,',',1),'')::inet);
 INSERT INTO public.admin_no_class_return_receipts(request_id,actor_id,anchor_id,schedule_slot_id,coach_id,assignment_ids,request_fingerprint,scope_fingerprint,result,created_at)
  VALUES(p_request,p_actor,p_anchor,(v_preview->>'scheduleSlotId')::uuid,(v_preview->>'coachId')::uuid,v_assignments,v_fp,p_expected,v_result,v_at);
 FOR v_unit IN SELECT value FROM jsonb_array_elements(v_result->'credits') LOOP
  IF v_unit->>'unit'='hour' AND (v_unit->>'amount')::numeric>1 THEN
   PERFORM public.no_class_return_issue_hours_v1((v_unit->>'creditId')::uuid,p_request);
  END IF;
 END LOOP;
 RETURN v_result;
END $function$;

DO $$ BEGIN IF md5(replace(pg_get_functiondef('admin_no_class_preview_v1(uuid)'::regprocedure),chr(13),''))<>'4e2c6e36317309c03a7acda10ec23f1a' THEN RAISE EXCEPTION 'NO_CLASS_HOURLY_BASELINE_DRIFT admin_no_class_preview_v1';END IF;END $$;
CREATE OR REPLACE FUNCTION public.admin_no_class_preview_v1(p_anchor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE a record; s record; v_exact boolean; v_coach uuid; v_ids uuid[]; v_unit_ids uuid[]; v_actual_ids uuid[];
 v_seen uuid[]:='{}'; v_prior_ids uuid[]; v_prior public.lesson_wallet_credits%ROWTYPE; v_expiry timestamptz;
 v_units jsonb:='[]'; v_sessions jsonb:='[]'; v_blockers jsonb:='[]'; v_fingerprint text; v_unit uuid;
 v_amount numeric; v_member uuid; v_unit_json jsonb; v_hour_credit uuid; v_now timestamptz:=clock_timestamp(); v_scope_data jsonb;
BEGIN
 SELECT bs.*,b.user_id,b.status::text AS booking_status,b.course_type_id,c.name AS course_name,br.name AS branch_name,
  ss.date AS slot_date,ss.start_time AS slot_start,ss.end_time AS slot_end,ss.branch_id AS slot_branch,ss.course_type_id AS slot_course
 INTO a FROM public.booking_sessions bs JOIN public.bookings b ON b.id=bs.booking_id
 JOIN public.course_types c ON c.id=b.course_type_id LEFT JOIN public.branches br ON br.id=bs.branch_id
 LEFT JOIN public.schedule_slots ss ON ss.id=bs.schedule_slot_id WHERE bs.id=p_anchor;
 IF NOT FOUND OR a.schedule_slot_id IS NULL THEN RAISE EXCEPTION 'NO_CLASS_RETURN_NOT_FOUND';END IF;
 IF ROW(a.date,a.start_time,a.end_time,a.branch_id,a.course_type_id) IS DISTINCT FROM
    ROW(a.slot_date,a.slot_start,a.slot_end,a.slot_branch,a.slot_course) THEN RAISE EXCEPTION 'NO_CLASS_RETURN_AMBIGUOUS';END IF;
 IF a.course_name NOT IN ('kids_group','adult_group','private') THEN RAISE EXCEPTION 'NO_CLASS_RETURN_INELIGIBLE';END IF;
 v_exact:=EXISTS(SELECT 1 FROM public.coach_assignment_groups WHERE schedule_slot_id=a.schedule_slot_id);
 v_coach:=public.admin_no_class_coach_v1(p_anchor,a.schedule_slot_id,v_exact);
 SELECT coalesce(array_agg(bs.id ORDER BY bs.id),'{}'::uuid[]) INTO v_ids
  FROM public.booking_sessions bs JOIN public.bookings b ON b.id=bs.booking_id
  WHERE bs.schedule_slot_id=a.schedule_slot_id AND b.status::text='verified' AND bs.cancelled_at IS NULL
   AND bs.status::text IN ('scheduled','completed','absent')
   AND public.admin_no_class_coach_v1(bs.id,a.schedule_slot_id,v_exact) IS NOT DISTINCT FROM v_coach;
 IF NOT(p_anchor=ANY(v_ids)) OR cardinality(v_ids)=0 THEN
  v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','NO_CLASS_RETURN_ALREADY_USED','message','รอบนี้ถูกใช้หรือจัดการแล้ว กรุณาอ่านข้อมูลล่าสุด'));
 END IF;
 IF (a.date+a.end_time) AT TIME ZONE 'Asia/Bangkok'>=v_now THEN
  v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','NO_CLASS_RETURN_NOT_ENDED','message','ใช้ได้เฉพาะรอบที่เลยเวลาเรียนแล้ว'));
 END IF;
 IF EXISTS(SELECT 1 FROM public.attendance WHERE booking_session_id=ANY(v_ids)) THEN
  v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','NO_CLASS_RETURN_ATTENDANCE_EXISTS','message','รอบนี้มีการเช็คชื่อแล้ว ต้องตรวจผลเดิมก่อนคืนสิทธิ์'));
 END IF;
 IF EXISTS(SELECT 1 FROM public.activity_logs WHERE entity_id=ANY(v_ids) AND action='attendance_gap_closed_no_action') THEN
  v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','NO_CLASS_RETURN_CLOSED_REVIEW','message','รอบนี้มีการปิดเคสตรวจสอบแล้ว'));
 END IF;
 IF EXISTS(SELECT 1 FROM public.coach_weekly_teaching_summaries w
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(w.snapshot->'entries','[]'::jsonb)) e
  WHERE w.week_start<=a.date AND w.week_end>=a.date AND e->>'schedule_slot_id'=a.schedule_slot_id::text
   AND (w.coach_id IS NOT DISTINCT FROM v_coach OR jsonb_typeof(e->'session_ids') IS DISTINCT FROM 'array'
    OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(e->'session_ids') sid WHERE sid=ANY(v_ids::text[])))) THEN
  v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','NO_CLASS_RETURN_CLOSED_PAYROLL','message','พบสรุปชั่วโมงที่ปิดแล้วของรอบนี้ ต้องยืนยันขอบเขตและตรวจแก้สรุปก่อน'));
 END IF;
 FOR s IN SELECT bs.*,b.user_id,b.status::text AS booking_status FROM public.booking_sessions bs
  JOIN public.bookings b ON b.id=bs.booking_id WHERE bs.id=ANY(v_ids) ORDER BY bs.id
 LOOP
  IF s.id=ANY(v_seen) THEN CONTINUE;END IF;
  v_unit_ids:=ARRAY[s.id];
  IF a.course_name='private' THEN
   BEGIN v_unit_ids:=public.lesson_source_family_unit_sessions_v1(s.id);
   EXCEPTION WHEN OTHERS THEN
    v_unit_ids:=ARRAY[s.id];
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','NO_CLASS_RETURN_AMBIGUOUS','message','ยังตรวจหน่วยสิทธิ์ Private เดิมไม่ครบ'));
   END;
  END IF;
  IF NOT(v_unit_ids<@v_ids) THEN
   v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','NO_CLASS_RETURN_FAMILY_SCOPE','message','สมาชิก Family อยู่คนละกลุ่มหรือมีผลเรียนแล้ว ต้องตรวจทั้งหน่วยก่อนคืน'));
   SELECT array_agg(x ORDER BY x) INTO v_unit_ids FROM unnest(v_unit_ids)x WHERE x=ANY(v_ids);
  END IF;
  v_seen:=v_seen||v_unit_ids; v_unit:=v_unit_ids[1];
  IF EXISTS(SELECT 1 FROM public.booking_sessions bs WHERE bs.id=ANY(v_unit_ids) AND
   (bs.is_makeup OR bs.status::text<>'scheduled' OR bs.cancelled_at IS NOT NULL OR
    ROW(bs.date,bs.start_time,bs.end_time,bs.branch_id) IS DISTINCT FROM ROW(a.date,a.start_time,a.end_time,a.branch_id))) OR
   EXISTS(SELECT 1 FROM public.booking_sessions bs JOIN public.bookings b ON b.id=bs.booking_id
    WHERE bs.id=ANY(v_unit_ids) AND bs.child_id IS NOT NULL AND NOT EXISTS(
     SELECT 1 FROM public.children ch WHERE ch.id=bs.child_id AND ch.parent_id=b.user_id)) THEN
   v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','NO_CLASS_RETURN_INELIGIBLE','message','ต้องเป็นรอบปกติที่ยังไม่มีผลเช็คชื่อและระบุตัวผู้เรียนได้ครบ'));
  END IF;
  IF EXISTS(SELECT 1 FROM public.booking_sessions WHERE rescheduled_from_id=ANY(v_unit_ids)) OR
   EXISTS(SELECT 1 FROM public.lesson_wallet_credits WHERE original_session_id=ANY(v_unit_ids)) OR
   EXISTS(SELECT 1 FROM public.lesson_wallet_credit_members WHERE original_session_id=ANY(v_unit_ids)) THEN
   v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','NO_CLASS_RETURN_ALREADY_USED','message','สิทธิ์ต้นทางถูกใช้หรือคืนแล้ว'));
  END IF;
  SELECT array_agg(DISTINCT c.id ORDER BY c.id) INTO v_prior_ids FROM public.lesson_wallet_credits c
   WHERE c.redeemed_session_id=ANY(v_unit_ids) OR EXISTS(SELECT 1 FROM public.lesson_wallet_credit_members cm
    WHERE cm.credit_id=c.id AND cm.redeemed_session_id=ANY(v_unit_ids));
  v_prior:=NULL;
  v_expiry:=((date_trunc('month',s.date::timestamp)+interval '1 month') AT TIME ZONE 'Asia/Bangkok')-interval '1 millisecond';
  IF coalesce(cardinality(v_prior_ids),0)>1 THEN
   v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','NO_CLASS_RETURN_AMBIGUOUS','message','พบเครดิตต้นทางมากกว่าหนึ่งรายการ'));
  ELSIF cardinality(v_prior_ids)=1 THEN
   SELECT * INTO v_prior FROM public.lesson_wallet_credits WHERE id=v_prior_ids[1];
   SELECT array_agg(x ORDER BY x) INTO v_actual_ids FROM (
    SELECT v_prior.redeemed_session_id AS x WHERE v_prior.redeemed_session_id IS NOT NULL
    UNION SELECT cm.redeemed_session_id FROM public.lesson_wallet_credit_members cm
     WHERE cm.credit_id=v_prior.id AND cm.redeemed_session_id IS NOT NULL) actual;
   IF v_prior.status<>'redeemed' OR v_prior.user_id IS DISTINCT FROM s.user_id OR v_prior.booking_id IS DISTINCT FROM s.booking_id
    OR v_actual_ids IS DISTINCT FROM v_unit_ids OR coalesce(v_prior.participant_count,1)<>cardinality(v_unit_ids) THEN
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','NO_CLASS_RETURN_AMBIGUOUS','message','หลักฐานผู้รับและเครดิตต้นทางไม่ตรงกับหน่วยที่จะคืน'));
   END IF;
   -- Stored expiry alone does not prove the entitlement: verify the source owner,
   -- learner mapping and duration, including every Family member's generation.
   IF NOT EXISTS(SELECT 1 FROM public.booking_sessions os JOIN public.bookings ob ON ob.id=os.booking_id
     WHERE os.id=v_prior.original_session_id AND os.booking_id=v_prior.booking_id AND ob.user_id=v_prior.user_id
      AND ob.course_type_id=v_prior.course_type_id AND os.status::text='walleted'
      AND ROW(os.child_id,os.schedule_slot_id,os.date,os.start_time,os.end_time,os.branch_id) IS NOT DISTINCT FROM
       ROW(v_prior.child_id,v_prior.original_schedule_slot_id,v_prior.original_date,v_prior.original_start_time,v_prior.original_end_time,v_prior.branch_id))
    OR (v_prior.original_end_time-v_prior.original_start_time) IS DISTINCT FROM (s.end_time-s.start_time)
    OR v_prior.course_type_id IS DISTINCT FROM a.course_type_id
    OR (cardinality(v_unit_ids)>1 AND v_prior.entitlement_unit_type IS DISTINCT FROM 'family_private')
    OR EXISTS(SELECT 1 FROM public.lesson_wallet_credit_members cm
      LEFT JOIN public.booking_sessions os ON os.id=cm.original_session_id
      LEFT JOIN public.booking_sessions ns ON ns.id=cm.redeemed_session_id
      WHERE cm.credit_id=v_prior.id AND (os.id IS NULL OR ns.id IS NULL OR os.status::text<>'walleted'
       OR os.booking_id IS DISTINCT FROM v_prior.booking_id OR ns.booking_id IS DISTINCT FROM v_prior.booking_id
       OR ROW(os.child_id,os.schedule_slot_id,os.date,os.start_time,os.end_time,os.branch_id) IS DISTINCT FROM
          ROW(cm.child_id,cm.original_schedule_slot_id,cm.original_date,cm.original_start_time,cm.original_end_time,cm.branch_id)
       OR os.child_id IS DISTINCT FROM ns.child_id OR (os.end_time-os.start_time) IS DISTINCT FROM (ns.end_time-ns.start_time)))
    OR ((SELECT count(*) FROM public.lesson_wallet_credit_members WHERE credit_id=v_prior.id)>0 AND
       ((SELECT count(*) FROM public.lesson_wallet_credit_members WHERE credit_id=v_prior.id)<>cardinality(v_unit_ids)
        OR NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credit_members WHERE credit_id=v_prior.id AND original_session_id=v_prior.original_session_id)))
    OR (NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credit_members WHERE credit_id=v_prior.id)
       AND (cardinality(v_unit_ids)<>1 OR v_prior.child_id IS DISTINCT FROM s.child_id))
    OR (v_prior.root_credit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credits rc
      WHERE rc.id=v_prior.root_credit_id AND ROW(rc.user_id,rc.booking_id,rc.course_type_id,rc.expires_at)
       IS NOT DISTINCT FROM ROW(v_prior.user_id,v_prior.booking_id,v_prior.course_type_id,v_prior.expires_at))) THEN
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','NO_CLASS_RETURN_AMBIGUOUS','message','หลักฐานหน่วยเดิม ผู้เรียน หรือระยะเวลาไม่ตรงกัน ต้องตรวจต้นทางก่อนคืน'));
   END IF;
   IF a.course_name='kids_group' AND v_prior.expires_at IS DISTINCT FROM v_expiry THEN
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','NO_CLASS_RETURN_AMBIGUOUS','message','วันหมดอายุต้นทาง Kids ไม่ตรงกับกติกาเดิม ต้องตรวจสอบก่อน'));
   END IF;
   v_expiry:=v_prior.expires_at;
  END IF;
  v_hour_credit:=public.no_class_return_hour_credit_v1(s.id);
  IF v_hour_credit IS NOT NULL THEN
   IF cardinality(v_prior_ids)=1 AND v_expiry IS DISTINCT FROM (SELECT expires_at FROM lesson_wallet_credits WHERE id=v_hour_credit)
   THEN RAISE EXCEPTION 'NO_CLASS_RETURN_AMBIGUOUS';END IF;
   SELECT expires_at INTO v_expiry FROM lesson_wallet_credits WHERE id=v_hour_credit;
  END IF;
  IF v_expiry IS NULL OR v_expiry<v_now THEN
   v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','NO_CLASS_RETURN_EXPIRED','message','สิทธิ์ต้นทางหมดอายุแล้ว ไม่สามารถเริ่มอายุใหม่จากวันคืน'));
  END IF;
  v_amount:=CASE WHEN a.course_name='private' THEN extract(epoch FROM (s.end_time-s.start_time))/3600 ELSE 1 END;
  IF v_amount<=0 THEN RAISE EXCEPTION 'NO_CLASS_RETURN_AMBIGUOUS';END IF;
  IF a.course_name='private' AND v_amount>1 AND (v_amount<>trunc(v_amount) OR v_amount>24) THEN
   v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','NO_CLASS_RETURN_HOUR_DURATION','message','ต้องตรวจต้นทาง Private ที่ไม่ใช่จำนวนชั่วโมงเต็มก่อนคืนสิทธิ์'));
  END IF;
  v_unit_json:=jsonb_build_object('unitId',v_unit,'sessionIds',v_unit_ids,'amount',v_amount,
   'unit',CASE WHEN a.course_name='private' THEN 'hour' ELSE 'session' END,'expiresAt',v_expiry,
   'expirySource',CASE WHEN coalesce(cardinality(v_prior_ids),0)=1 OR v_hour_credit IS NOT NULL THEN 'stored_credit' ELSE 'original_month_end' END);
  v_units:=v_units||jsonb_build_array(v_unit_json);
  SELECT v_sessions||coalesce(jsonb_agg(jsonb_build_object('sessionId',bs.id,'unitId',v_unit,
   'learnerName',CASE WHEN bs.child_id IS NULL THEN coalesce(nullif(p.full_name,''),'ผู้เรียน') ELSE coalesce(nullif(ch.nickname,''),nullif(ch.full_name,''),'ผู้เรียน') END,
   'parentName',coalesce(nullif(p.full_name,''),'ผู้ปกครอง/เจ้าของสิทธิ์')) ORDER BY bs.id),'[]'::jsonb) INTO v_sessions
   FROM public.booking_sessions bs JOIN public.bookings b ON b.id=bs.booking_id LEFT JOIN public.profiles p ON p.id=b.user_id
   LEFT JOIN public.children ch ON ch.id=bs.child_id WHERE bs.id=ANY(v_unit_ids);
 END LOOP;
 -- Hash complete source evidence, not just rows currently visible in the queue.
 SELECT jsonb_build_array(
  (SELECT jsonb_agg(to_jsonb(bs)||jsonb_build_object('bookingStatus',b.status,'owner',b.user_id) ORDER BY bs.id)
   FROM public.booking_sessions bs JOIN public.bookings b ON b.id=bs.booking_id WHERE bs.id=ANY(v_ids)),
  (SELECT jsonb_agg(to_jsonb(g)||jsonb_build_object('members',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id)
    FROM public.coach_assignment_group_students m WHERE m.group_id=g.id)) ORDER BY g.id)
    FROM public.coach_assignment_groups g WHERE g.schedule_slot_id=a.schedule_slot_id),
  (SELECT jsonb_agg(to_jsonb(ca) ORDER BY ca.id) FROM public.coach_assignments ca WHERE ca.schedule_slot_id=a.schedule_slot_id),
  (SELECT jsonb_agg(to_jsonb(at) ORDER BY at.id) FROM public.attendance at WHERE at.booking_session_id=ANY(v_ids)),
  (SELECT jsonb_agg(to_jsonb(c)||jsonb_build_object('members',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.original_session_id)
    FROM public.lesson_wallet_credit_members m WHERE m.credit_id=c.id)) ORDER BY c.id) FROM public.lesson_wallet_credits c WHERE c.redeemed_session_id=ANY(v_ids)
    OR EXISTS(SELECT 1 FROM public.lesson_wallet_credit_members m WHERE m.credit_id=c.id AND m.redeemed_session_id=ANY(v_ids))),
  (SELECT jsonb_agg(jsonb_build_object('id',w.id,'updatedAt',w.updated_at,'snapshot',w.snapshot) ORDER BY w.id)
   FROM public.coach_weekly_teaching_summaries w WHERE w.week_start<=a.date AND w.week_end>=a.date AND EXISTS(
    SELECT 1 FROM jsonb_array_elements(coalesce(w.snapshot->'entries','[]'::jsonb)) e WHERE e->>'schedule_slot_id'=a.schedule_slot_id::text))
 ) INTO v_scope_data;
 v_fingerprint:=encode(extensions.digest(jsonb_build_array(a.schedule_slot_id,v_coach,v_ids,v_units,v_sessions,v_scope_data)::text,'sha256'),'hex');
 RETURN jsonb_build_object('eligible',jsonb_array_length(v_blockers)=0,'anchorId',p_anchor,'scopeFingerprint',v_fingerprint,
  'scheduleSlotId',a.schedule_slot_id,'coachId',v_coach,'coachName',(SELECT full_name FROM public.profiles WHERE id=v_coach),
  'branchName',a.branch_name,'courseType',a.course_name,'date',a.date,'startTime',a.start_time,'endTime',a.end_time,
  'sessions',v_sessions,'units',v_units,'targetSessionIds',v_ids,'targetCount',cardinality(v_ids),'blockers',v_blockers,'coachHours',0);
END $function$;

DO $$ BEGIN IF md5(replace(pg_get_functiondef('admin_makeup_previous_transition_v1(uuid,text,uuid,jsonb)'::regprocedure),chr(13),''))<>'e37787ff16eefc9d96c1cfd060f1063f' THEN RAISE EXCEPTION 'NO_CLASS_HOURLY_BASELINE_DRIFT admin_makeup_previous_transition_v1';END IF;END $$;
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
    ELSIF public.no_class_return_hour_credit_v1(s.id) IS NOT NULL THEN
      SELECT * INTO v_prior FROM lesson_wallet_credits WHERE id=public.no_class_return_hour_credit_v1(s.id);
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
END $function$;

DO $$ BEGIN IF md5(replace(pg_get_functiondef('task10_previous_wallet_store_v2(uuid,uuid,uuid)'::regprocedure),chr(13),''))<>'1a87d59cbdb84f1acb645fc887bd38ab' THEN RAISE EXCEPTION 'NO_CLASS_HOURLY_BASELINE_DRIFT task10_previous_wallet_store_v2';END IF;END $$;
CREATE OR REPLACE FUNCTION public.task10_previous_wallet_store_v2(p_user_id uuid, p_session_id uuid, p_actor_id uuid)
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
    UNION
    SELECT mapped.id FROM (SELECT public.no_class_return_hour_credit_v1(member.id) id) mapped WHERE mapped.id IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credits direct_credit WHERE direct_credit.redeemed_session_id=member.id)
      AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credit_members direct_member WHERE direct_member.redeemed_session_id=member.id)
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
    UNION
    SELECT mapped.id FROM (SELECT public.no_class_return_hour_credit_v1(member.id) id) mapped WHERE mapped.id IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credits direct_credit WHERE direct_credit.redeemed_session_id=member.id)
      AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credit_members direct_member WHERE direct_member.redeemed_session_id=member.id)
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
          (date_trunc('month', timezone('Asia/Bangkok', v_verified_at)) + make_interval(months => coalesce((SELECT (package_snapshot->>'validity_months')::integer FROM public.bookings WHERE id=v_selected.booking_id),10)))
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
$function$;

DO $$ BEGIN IF md5(replace(pg_get_functiondef('admin_wallet_store_body_v1(uuid,uuid,uuid)'::regprocedure),chr(13),''))<>'e2cb36da052067e6c920c7367ed6390b' THEN RAISE EXCEPTION 'NO_CLASS_HOURLY_BASELINE_DRIFT admin_wallet_store_body_v1';END IF;END $$;
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
    UNION
    SELECT mapped.id FROM (SELECT public.no_class_return_hour_credit_v1(member.id) id) mapped WHERE mapped.id IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credits direct_credit WHERE direct_credit.redeemed_session_id=member.id)
      AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credit_members direct_member WHERE direct_member.redeemed_session_id=member.id)
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
    UNION
    SELECT mapped.id FROM (SELECT public.no_class_return_hour_credit_v1(member.id) id) mapped WHERE mapped.id IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credits direct_credit WHERE direct_credit.redeemed_session_id=member.id)
      AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credit_members direct_member WHERE direct_member.redeemed_session_id=member.id)
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
          (date_trunc('month', timezone('Asia/Bangkok', v_verified_at)) + make_interval(months => coalesce((SELECT (package_snapshot->>'validity_months')::integer FROM public.bookings WHERE id=v_selected.booking_id),10)))
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
$function$;

DO $$ BEGIN IF md5(replace(pg_get_functiondef('booking_ux_wallet_inventory_v1(uuid,text,uuid[])'::regprocedure),chr(13),''))<>'d92ccb67a45de73448f140c3ec2d409c' THEN RAISE EXCEPTION 'NO_CLASS_HOURLY_BASELINE_DRIFT booking_ux_wallet_inventory_v1';END IF;END $$;
CREATE OR REPLACE FUNCTION public.booking_ux_wallet_inventory_v1(p_actor uuid, p_group text DEFAULT NULL::text, p_selected uuid[] DEFAULT '{}'::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_now timestamptz:=public.task10_clock_v1();v_previous date;v_makeup jsonb;v_result jsonb;
BEGIN
  IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor) THEN RAISE EXCEPTION 'BOOKING_UX_FORBIDDEN';END IF;
  IF p_group IS NOT NULL AND p_group!~'^[a-f0-9]{32}$' OR p_selected IS NULL OR cardinality(p_selected)>32
    OR cardinality(p_selected)<>(SELECT count(DISTINCT x) FROM unnest(p_selected)x) THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_REQUEST';END IF;
  v_previous:=(date_trunc('month',v_now AT TIME ZONE 'Asia/Bangkok')-interval '1 month')::date;
  SELECT coalesce(jsonb_agg(state ORDER BY month),'[]') INTO v_makeup FROM (
    SELECT m.month,public.booking_ux_parent_state_v1(p_actor,m.month) AS state FROM (
      SELECT DISTINCT date_trunc('month',c.original_date)::date AS month
      FROM lesson_wallet_credits c JOIN course_types ct ON ct.id=c.course_type_id
      WHERE c.user_id=p_actor AND ct.name::text='kids_group' AND c.status IN ('active','expired')
        AND (c.expires_at>v_now OR c.original_date>=v_previous)
        AND (date_trunc('month',c.original_date)+interval '2 months') AT TIME ZONE 'Asia/Bangkok'>v_now
    )m
  )s WHERE jsonb_typeof(state->'sources')='array';

  WITH makeup_sources AS MATERIALIZED (
    SELECT (s.value->>'creditId')::uuid AS credit_id,m.value->>'sourceMonth' AS makeup_month,
      m.value->>'destinationMonth' AS destination_month,coalesce((m.value->>'eligible')::boolean,false) AS makeup_eligible
    FROM jsonb_array_elements(v_makeup)m CROSS JOIN LATERAL jsonb_array_elements(m.value->'sources')s
    WHERE s.value->>'creditId' IS NOT NULL
  ), credits AS MATERIALIZED (
    SELECT c.*,ct.name::text AS course,
      coalesce((SELECT jsonb_agg(cm.child_id ORDER BY cm.original_session_id) FROM lesson_wallet_credit_members cm WHERE cm.credit_id=c.id),jsonb_build_array(c.child_id)) AS people,
      m.makeup_month,m.destination_month,coalesce(m.makeup_eligible,false) AS makeup_eligible
    FROM lesson_wallet_credits c JOIN course_types ct ON ct.id=c.course_type_id
    LEFT JOIN makeup_sources m ON m.credit_id=c.id
    WHERE c.user_id=p_actor AND c.status IN ('active','expired') AND c.redeemed_session_id IS NULL
      AND (c.expires_at>v_now OR c.original_date>=v_previous)
      AND NOT EXISTS(SELECT 1 FROM task10_family_makeup_uses u WHERE u.parent_id=p_actor AND
        (u.credit_id=c.id OR u.source_session_id=c.original_session_id OR u.source_root_id=c.original_session_id))
  ), raw AS (
    SELECT c.id,c.booking_id,'wallet'::text AS kind,c.course,c.people,c.expires_at,c.entitlement_policy AS policy,
      CASE WHEN c.entitlement_policy='same_month' THEN to_char(c.original_date,'YYYY-MM') END AS original_month,
      c.original_date,NULL::integer AS validity_months,(c.status='active' AND c.expires_at>v_now) AS normal,
      c.makeup_month,c.destination_month,c.makeup_eligible,
      CASE WHEN c.course='private' THEN extract(epoch FROM c.original_end_time-c.original_start_time)/3600 ELSE 1 END AS quantity,false AS fixed_participants,NULL::uuid AS return_credit
    FROM credits c
    UNION ALL
    SELECT u.id,u.booking_id,'package',ct.name::text,u.participants,u.expires_at,
      coalesce(rc.entitlement_policy,'package:'||(b.package_snapshot->>'validity_months')),
      CASE WHEN rc.entitlement_policy='same_month' THEN to_char(rc.original_date,'YYYY-MM') END,rc.original_date,
      CASE WHEN hm.unit_id IS NULL THEN (b.package_snapshot->>'validity_months')::integer END,true,NULL,NULL,false,1,
      hm.unit_id IS NOT NULL,rc.id
    FROM bookings b JOIN booking_package_units u ON u.booking_id=b.id JOIN course_types ct ON ct.id=b.course_type_id
    LEFT JOIN no_class_return_hour_units hm ON hm.unit_id=u.id LEFT JOIN lesson_wallet_credits rc ON rc.id=hm.credit_id
    WHERE b.user_id=p_actor AND u.status='available' AND u.expires_at>v_now AND (hm.unit_id IS NULL OR (b.status::text='verified' AND rc.status='redeemed' AND rc.expires_at=u.expires_at))
  ), keyed AS MATERIALIZED (
    SELECT r.*,md5((jsonb_build_array(kind,course,
      (SELECT jsonb_agg(coalesce(x.value#>>'{}','self') ORDER BY coalesce(x.value#>>'{}','self')) FROM jsonb_array_elements(people)x),
      floor(extract(epoch FROM expires_at)*1000),policy,coalesce(original_month,''),
      CASE WHEN makeup_eligible THEN jsonb_build_array(makeup_month,destination_month) END,
      normal,makeup_month)||CASE WHEN quantity<>1 THEN jsonb_build_array(quantity) ELSE '[]'::jsonb END||CASE WHEN fixed_participants THEN jsonb_build_array('no-class-return-hours') ELSE '[]'::jsonb END)::text) AS group_id
    FROM raw r WHERE normal OR makeup_month IS NOT NULL
  ), counts AS (
    SELECT group_id,count(*) AS total FROM keyed GROUP BY group_id
  ), representative AS (
    SELECT DISTINCT ON(group_id) * FROM keyed ORDER BY group_id,expires_at,id
  ), wanted AS (
    SELECT * FROM keyed WHERE p_group IS NULL OR group_id=p_group ORDER BY expires_at,id LIMIT 32
  ), selected AS (
    SELECT * FROM keyed WHERE id=ANY(p_selected)
  ), member_rows AS (
    SELECT DISTINCT ON(id) * FROM (SELECT * FROM wanted UNION ALL SELECT * FROM selected)s ORDER BY id
  ), payload_rows AS (
    SELECT 'representative'::text AS role,r.* FROM representative r
    UNION ALL SELECT 'member',r.* FROM member_rows r
  ), payload AS (
    SELECT role,group_id,expires_at,course,kind,id,jsonb_build_object('id',id,'bookingId',booking_id,'kind',kind,'course',course,
      'participants',people,'expires',expires_at,'policy',policy,'originalMonth',original_month,'originalDate',original_date,
      'validityMonths',validity_months,'normal',normal,'makeupMonth',makeup_month,'groupId',group_id,'quantity',quantity,'fixedParticipants',fixed_participants,'returnCreditId',return_credit) AS source
    FROM payload_rows
  ) SELECT jsonb_build_object('serverNow',v_now,'makeup',v_makeup,'groups',(
      SELECT coalesce(jsonb_agg(jsonb_build_object('key',p.group_id,'total',c.total,'source',p.source) ORDER BY p.expires_at,p.kind,p.course,p.group_id),'[]')
      FROM payload p JOIN counts c ON c.group_id=p.group_id WHERE p.role='representative'),
    'sources',(SELECT coalesce(jsonb_agg(source ORDER BY expires_at,id),'[]') FROM payload WHERE role='member')) INTO v_result;
  RETURN v_result;
END $function$;

DO $$ BEGIN IF md5(replace(pg_get_functiondef('admin_makeup_context_v2(uuid,uuid,date)'::regprocedure),chr(13),''))<>'72a9ad219f692228a5c85115025bf59a' THEN RAISE EXCEPTION 'NO_CLASS_HOURLY_BASELINE_DRIFT admin_makeup_context_v2';END IF;END $$;
CREATE OR REPLACE FUNCTION public.admin_makeup_context_v2(p_actor uuid, p_reference uuid, p_month date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE s record; v jsonb;members jsonb;sources jsonb:='[]';destinations jsonb;ids uuid[];r record;used boolean;deadline timestamptz;
BEGIN
 PERFORM public.task10_require_actor_v1(p_actor,'makeup');
 IF p_month IS NULL OR p_month<>date_trunc('month',p_month)::date THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST';END IF;
 SELECT x.*,b.user_id,b.course_type_id,b.status::text booking_status,c.name::text course,p.full_name parent_name INTO s FROM public.booking_sessions x
 JOIN public.bookings b ON b.id=x.booking_id JOIN public.course_types c ON c.id=b.course_type_id JOIN public.profiles p ON p.id=b.user_id WHERE x.id=p_reference;
 IF NOT FOUND OR s.booking_status<>'verified' OR s.is_makeup OR s.admin_makeup_grant_id IS NOT NULL
 OR s.course NOT IN ('kids_group','adult_group','private') OR s.date<p_month OR s.date>=(p_month+interval '1 month')::date
 OR s.child_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.children WHERE id=s.child_id AND parent_id=s.user_id)
 THEN RAISE EXCEPTION 'TASK10_SOURCE_CONFLICT';END IF;
 ids:=CASE WHEN s.course='private' THEN public.lesson_source_family_unit_sessions_v1(s.id) ELSE ARRAY[s.id] END;
 IF s.course='adult_group' AND s.child_id IS NULL THEN members:=jsonb_build_array(jsonb_build_object('id','self','childId',NULL,'name',public.admin_makeup_learner_name_v2(s.parent_name,NULL)));
 ELSIF s.course<>'kids_group' THEN
 SELECT jsonb_agg(jsonb_build_object('id',coalesce(x.child_id::text,'self'),'childId',x.child_id,'name',public.admin_makeup_learner_name_v2(CASE WHEN x.child_id IS NULL THEN p.full_name ELSE ch.full_name END,ch.nickname)) ORDER BY x.child_id NULLS FIRST)
 INTO members FROM public.booking_sessions x JOIN public.profiles p ON p.id=s.user_id LEFT JOIN public.children ch ON ch.id=x.child_id AND ch.parent_id=s.user_id WHERE x.id=ANY(ids);
 END IF;
 IF s.course='kids_group' THEN
  v:=public.task10_family_makeup_state_v1(p_actor,s.user_id,p_month);
  IF NOT(v ? 'sourceMonth') THEN RAISE EXCEPTION 'TASK10_MAKEUP_PAUSED';END IF;
  SELECT coalesce(jsonb_agg(m||jsonb_build_object('name',public.admin_makeup_learner_name_v2(ch.full_name,ch.nickname))),'[]') INTO members FROM jsonb_array_elements(v->'children')m JOIN public.children ch ON ch.id=(m->>'id')::uuid AND ch.parent_id=s.user_id;
  IF (v->>'expiresAt')::timestamptz>public.task10_clock_v1() THEN sources:=v->'sources';END IF;
 ELSE
  deadline:=(p_month+interval '2 month') AT TIME ZONE 'Asia/Bangkok';

  FOR r IN SELECT w.* FROM public.lesson_wallet_credits w JOIN public.bookings b ON b.id=w.booking_id JOIN public.course_types c ON c.id=b.course_type_id
   WHERE w.user_id=s.user_id AND c.name::text=s.course AND (s.course='private' OR w.child_id IS NOT DISTINCT FROM s.child_id)
   -- Wallet eligibility uses its stored expiry, independently of p_month.
   AND w.status='active' AND w.redeemed_session_id IS NULL AND w.expires_at>clock_timestamp() AND b.status::text='verified'
   AND (s.course<>'private' OR (SELECT array_agg(coalesce(x.child_id::text,'self') ORDER BY coalesce(x.child_id::text,'self')) FROM unnest(public.lesson_source_family_unit_sessions_v1(w.original_session_id)) am2_unit_id JOIN public.booking_sessions x ON x.id=am2_unit_id)=
    (SELECT array_agg(coalesce(x.child_id::text,'self') ORDER BY coalesce(x.child_id::text,'self')) FROM public.booking_sessions x WHERE x.id=ANY(ids))) ORDER BY w.id LOOP
   sources:=sources||jsonb_build_array(jsonb_build_object('sourceSessionId',r.original_session_id,'sourceDate',r.original_date,'kind','wallet','creditId',r.id,'expiresAt',r.expires_at,'durationMinutes',extract(epoch FROM r.original_end_time-r.original_start_time)/60));
  END LOOP;
  FOR r IN SELECT u.id unit_id,u.expires_at,w.id credit_id,w.original_session_id,w.original_date
   FROM no_class_return_hour_units hm JOIN booking_package_units u ON u.id=hm.unit_id
   JOIN lesson_wallet_credits w ON w.id=hm.credit_id JOIN bookings b ON b.id=u.booking_id
   WHERE s.course='private' AND w.user_id=s.user_id AND b.status::text='verified' AND w.status='redeemed'
     AND u.status='available' AND u.expires_at>clock_timestamp() AND u.expires_at=w.expires_at
     AND w.original_date>=p_month AND w.original_date<(p_month+interval '1 month')::date
     AND (SELECT array_agg(coalesce(j#>>'{}','self') ORDER BY coalesce(j#>>'{}','self')) FROM jsonb_array_elements(u.participants)j)=
       (SELECT array_agg(coalesce(x.child_id::text,'self') ORDER BY coalesce(x.child_id::text,'self')) FROM booking_sessions x WHERE x.id=ANY(ids))
   ORDER BY u.id LOOP
    sources:=sources||jsonb_build_array(jsonb_build_object('sourceSessionId',r.unit_id,'referenceSessionId',r.original_session_id,
      'sourceDate',r.original_date,'kind','wallet','creditId',r.credit_id,'packageUnitId',r.unit_id,'expiresAt',r.expires_at,'durationMinutes',60));
  END LOOP;
  IF clock_timestamp()<deadline THEN
   FOR r IN SELECT x.* FROM public.booking_sessions x JOIN public.bookings b ON b.id=x.booking_id JOIN public.course_types c ON c.id=b.course_type_id
    WHERE b.user_id=s.user_id AND b.status::text='verified' AND c.name::text=s.course AND (s.course='private' OR x.child_id IS NOT DISTINCT FROM s.child_id)
    AND x.date>=p_month AND x.date<(p_month+interval '1 month')::date AND NOT x.is_makeup AND x.cancelled_at IS NULL
    AND x.status::text IN ('absent','scheduled') AND (x.date+x.end_time) AT TIME ZONE 'Asia/Bangkok'<clock_timestamp()
    AND EXISTS(SELECT 1 FROM public.attendance a WHERE a.booking_session_id=x.id AND a.student_id=coalesce(x.child_id,s.user_id) AND a.status::text='absent')
    AND NOT EXISTS(SELECT 1 FROM public.attendance a WHERE a.booking_session_id=x.id AND a.status::text IN ('present','late'))
    AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credits w WHERE w.original_session_id=x.id)
    AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credit_members w WHERE w.original_session_id=x.id)
    AND (s.course<>'private' OR (SELECT array_agg(coalesce(z.child_id::text,'self') ORDER BY coalesce(z.child_id::text,'self')) FROM unnest(public.lesson_source_family_unit_sessions_v1(x.id)) am2_unit_id JOIN public.booking_sessions z ON z.id=am2_unit_id)=
     (SELECT array_agg(coalesce(z.child_id::text,'self') ORDER BY coalesce(z.child_id::text,'self')) FROM public.booking_sessions z WHERE z.id=ANY(ids)))
    AND NOT EXISTS(SELECT 1 FROM public.booking_sessions z JOIN public.bookings zb ON zb.id=z.booking_id JOIN public.booking_sessions d ON d.rescheduled_from_id=z.id AND d.is_makeup
     WHERE zb.user_id=s.user_id AND z.child_id IS NOT DISTINCT FROM x.child_id AND z.date>=p_month AND z.date<(p_month+interval '1 month')::date)
    ORDER BY x.id LOOP
     sources:=sources||jsonb_build_array(jsonb_build_object('sourceSessionId',r.id,'sourceChildId',r.child_id,'sourceDate',r.date,'kind','absent','creditId',NULL,'expiresAt',deadline));
   END LOOP;
  END IF;
 END IF;
 IF s.course='kids_group' AND jsonb_array_length(sources)=0 THEN
  SELECT coalesce(jsonb_agg(m),'[]') INTO members FROM jsonb_array_elements(members)m WHERE EXISTS(SELECT 1 FROM public.booking_sessions x JOIN public.bookings b ON b.id=x.booking_id WHERE b.user_id=s.user_id AND b.course_type_id=s.course_type_id AND b.status::text='verified' AND NOT x.is_makeup AND x.child_id=(m->>'id')::uuid);
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id,'date',x.date,'startTime',x.start_time,'endTime',x.end_time,'branchName',br.name,'additional',x.admin_makeup_grant_id IS NOT NULL,'grantId',x.admin_makeup_grant_id,'cancelled',x.cancelled_at IS NOT NULL,'childId',x.child_id,'childName',public.admin_makeup_learner_name_v2(CASE WHEN x.child_id IS NULL THEN p.full_name ELSE ch.full_name END,ch.nickname)) ORDER BY x.date,x.id),'[]') INTO destinations
 FROM public.booking_sessions x JOIN public.bookings b ON b.id=x.booking_id JOIN public.branches br ON br.id=x.branch_id JOIN public.profiles p ON p.id=b.user_id
 LEFT JOIN public.children ch ON ch.id=x.child_id LEFT JOIN public.admin_makeup_grants_v2 g ON g.id=x.admin_makeup_grant_id
 WHERE b.user_id=s.user_id AND b.course_type_id=s.course_type_id AND x.is_makeup AND
  (g.reference_month=p_month AND (s.course='kids_group' OR s.course='adult_group' AND x.child_id IS NOT DISTINCT FROM s.child_id
   OR s.course='private' AND (SELECT array_agg(coalesce(j#>>'{}','self') ORDER BY coalesce(j#>>'{}','self')) FROM jsonb_array_elements(g.participants)j)=
     (SELECT array_agg(coalesce(z.child_id::text,'self') ORDER BY coalesce(z.child_id::text,'self')) FROM public.booking_sessions z WHERE z.id=ANY(ids))) OR s.course='kids_group' AND EXISTS(SELECT 1 FROM public.task10_family_makeup_uses u WHERE u.destination_session_id=x.id AND u.parent_id=s.user_id AND u.source_month=p_month) OR x.rescheduled_from_id IN
   (SELECT z.id FROM public.booking_sessions z JOIN public.bookings zb ON zb.id=z.booking_id WHERE zb.user_id=s.user_id AND z.date>=p_month AND z.date<(p_month+interval '1 month')::date AND (s.course='kids_group' OR s.course='adult_group' AND z.child_id IS NOT DISTINCT FROM s.child_id OR s.course='private' AND (SELECT array_agg(coalesce(m.child_id::text,'self') ORDER BY coalesce(m.child_id::text,'self')) FROM unnest(public.lesson_source_family_unit_sessions_v1(z.id)) am2_unit_id JOIN public.booking_sessions m ON m.id=am2_unit_id)=(SELECT array_agg(coalesce(m.child_id::text,'self') ORDER BY coalesce(m.child_id::text,'self')) FROM public.booking_sessions m WHERE m.id=ANY(ids)))));
 RETURN jsonb_build_object('reference',s.id,'bookingId',s.booking_id,'parentId',s.user_id,'course',s.course,'month',to_char(p_month,'YYYY-MM'),'durationMinutes',extract(epoch FROM s.end_time-s.start_time)/60,
 'parentName',s.parent_name,'branchIds',ARRAY[s.branch_id],'learners',members,'sources',sources,'family',v,
 'destinations',destinations,'additionalAvailable',jsonb_array_length(sources)=0 AND (SELECT enabled FROM public.admin_makeup_workspace_control WHERE singleton) AND EXISTS(SELECT 1 FROM public.task10_policy_activation WHERE singleton AND makeup_enabled));
END $function$;

DO $$ BEGIN IF md5(replace(pg_get_functiondef('admin_makeup_use_v2(uuid,uuid,date,uuid,uuid,jsonb)'::regprocedure),chr(13),''))<>'3ca037773bdf08993eaaa798b840b938' THEN RAISE EXCEPTION 'NO_CLASS_HOURLY_BASELINE_DRIFT admin_makeup_use_v2';END IF;END $$;
CREATE OR REPLACE FUNCTION public.admin_makeup_use_v2(p_actor uuid, p_reference uuid, p_month date, p_source uuid, p_request uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v jsonb;src jsonb;r jsonb;fp text;prior record;
BEGIN
 PERFORM public.task10_require_actor_v1(p_actor,'makeup');
 IF p_request IS NULL OR length(btrim(coalesce(p_payload->>'reason',''))) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST';END IF;
 fp:=md5(jsonb_build_array(p_reference,p_month,p_source,p_payload)::text);
 PERFORM pg_advisory_xact_lock(hashtextextended('admin-makeup-use|'||p_actor||'|'||p_request,0));
 SELECT * INTO prior FROM public.admin_makeup_actions_v2 WHERE actor_id=p_actor AND request_id=p_request;
 IF FOUND THEN IF prior.fingerprint<>fp THEN RAISE EXCEPTION 'TASK10_IDEMPOTENCY_CONFLICT';END IF;RETURN prior.result;END IF;
 v:=public.admin_makeup_context_v2(p_actor,p_reference,p_month);
 IF v->>'course'='kids_group' THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST';END IF;
 SELECT value INTO src FROM jsonb_array_elements(v->'sources') WHERE value->>'sourceSessionId'=p_source::text;
 IF src IS NULL THEN RAISE EXCEPTION 'TASK10_SOURCE_CONFLICT';END IF;
 -- Preserve the existing owner/whole-unit Wallet writer. This entry explicitly
 -- authorizes Admin first; the core enforces the real owner's entitlement.
 IF src ? 'packageUnitId' THEN
  r:=public.booking_ux_redeem_many_v3((v->>'parentId')::uuid,p_request,jsonb_build_array(jsonb_build_object(
   'id',(src->>'packageUnitId')::uuid,'kind','package','date',p_payload->>'targetDate','start',p_payload->>'startTime',
   'end',p_payload->>'endTime','branchId',p_payload->>'branchId','templateId',p_payload->>'templateId','requestId',p_request)));
 ELSE
 r:=public.lesson_source_transition_v1(CASE WHEN src->>'kind'='wallet' THEN (v->>'parentId')::uuid ELSE p_actor END,
  CASE WHEN src->>'kind'='wallet' THEN 'redeem' ELSE 'makeup' END,
  CASE WHEN src->>'kind'='wallet' THEN (src->>'creditId')::uuid ELSE p_source END,p_payload||jsonb_build_object('requestId',p_request));
 END IF;
 r:=jsonb_build_object('success',true,'result',r);
 INSERT INTO public.admin_makeup_actions_v2 VALUES(p_actor,p_request,fp,r);
 INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details) VALUES(p_actor,'admin_makeup_source_used',CASE WHEN src ? 'packageUnitId' THEN 'booking_package_units' ELSE 'booking_sessions' END,p_source,jsonb_build_object('requestId',p_request,'reason',p_payload->>'reason','result',r));
 RETURN r;
END $function$;

DO $$ BEGIN IF md5(replace(pg_get_functiondef('booking_ux_wallet_history_v1(uuid,date,text,integer)'::regprocedure),chr(13),''))<>'df407242d0b96ec53c0ecca954127bdf' THEN RAISE EXCEPTION 'NO_CLASS_HOURLY_BASELINE_DRIFT booking_ux_wallet_history_v1';END IF;END $$;
CREATE OR REPLACE FUNCTION public.booking_ux_wallet_history_v1(p_actor uuid, p_month date, p_course text, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_start timestamptz;v_end timestamptz;v_now timestamptz:=clock_timestamp();v_rows jsonb;v_more boolean;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor) THEN RAISE EXCEPTION 'BOOKING_UX_FORBIDDEN';END IF;
 IF p_month IS NULL OR p_month<>date_trunc('month',p_month)::date OR p_course NOT IN ('kids_group','adult_group','private')
  OR p_course IS NULL OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 100000 THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_REQUEST';END IF;
 v_start:=p_month AT TIME ZONE 'Asia/Bangkok';v_end:=(p_month+interval '1 month') AT TIME ZONE 'Asia/Bangkok';
 WITH monthly_uses AS MATERIALIZED (
  SELECT u.* FROM task10_family_makeup_uses u WHERE parent_id=p_actor AND created_at>=v_start AND created_at<v_end
 ), candidate_ids AS (
  SELECT id FROM lesson_wallet_credits WHERE user_id=p_actor AND stored_at>=v_start AND stored_at<v_end
  UNION SELECT id FROM lesson_wallet_credits WHERE user_id=p_actor AND redeemed_at>=v_start AND redeemed_at<v_end
  UNION SELECT id FROM lesson_wallet_credits WHERE user_id=p_actor AND expires_at>=v_start AND expires_at<v_end AND expires_at<=v_now
  UNION SELECT m.credit_id FROM no_class_return_hour_units m JOIN booking_package_units u ON u.id=m.unit_id
   JOIN lesson_wallet_credits w ON w.id=m.credit_id WHERE w.user_id=p_actor AND u.redeemed_at>=v_start AND u.redeemed_at<v_end
  UNION SELECT c.id FROM monthly_uses u JOIN lesson_wallet_credits c ON c.user_id=p_actor AND
   (c.id=u.credit_id OR c.original_session_id=u.source_session_id OR c.original_session_id=u.source_root_id)
 ), credits AS MATERIALIZED (
  SELECT c.*,ct.name::text AS course,h.total hour_total,h.used hour_used,h.remaining hour_remaining,h.used_at hour_used_at,h.last_used_at hour_last_used_at
   FROM candidate_ids ids JOIN lesson_wallet_credits c ON c.id=ids.id JOIN course_types ct ON ct.id=c.course_type_id
   LEFT JOIN LATERAL(SELECT count(*) total,count(*) FILTER(WHERE u.status='redeemed') used,
    count(*) FILTER(WHERE u.status='available' AND u.expires_at>v_now) remaining,
    max(u.redeemed_at) FILTER(WHERE u.redeemed_at>=v_start AND u.redeemed_at<v_end) used_at,max(u.redeemed_at) last_used_at
    FROM no_class_return_hour_units m JOIN booking_package_units u ON u.id=m.unit_id WHERE m.credit_id=c.id)h ON true
   WHERE c.user_id=p_actor AND ct.name::text=p_course
 ), credit_events AS (
  SELECT c.*,u.actor_id AS use_actor,u.destination_session_id,
   coalesce(c.hour_last_used_at,u.created_at,c.redeemed_at) AS used_at,
   (CASE WHEN c.hour_total>0 THEN c.hour_used=c.hour_total ELSE u.id IS NOT NULL OR c.status='redeemed' OR c.redeemed_session_id IS NOT NULL END) AS spent,
   greatest(CASE WHEN c.stored_at>=v_start AND c.stored_at<v_end THEN c.stored_at END,
    CASE WHEN coalesce(c.hour_used_at,u.created_at,c.redeemed_at)>=v_start AND coalesce(c.hour_used_at,u.created_at,c.redeemed_at)<v_end THEN coalesce(c.hour_used_at,u.created_at,c.redeemed_at) END,
    CASE WHEN u.id IS NULL AND (c.status<>'redeemed' OR c.hour_total>0 AND c.hour_used<c.hour_total) AND c.redeemed_session_id IS NULL AND c.expires_at>=v_start AND c.expires_at<v_end AND c.expires_at<=v_now THEN c.expires_at END) AS event_at
  FROM credits c LEFT JOIN LATERAL (
   SELECT u.* FROM task10_family_makeup_uses u WHERE u.parent_id=p_actor AND
    (u.credit_id=c.id OR u.source_session_id=c.original_session_id OR u.source_root_id=c.original_session_id)
   ORDER BY (u.credit_id=c.id) DESC,u.created_at,u.id LIMIT 1
  )u ON true
 ), unit_events AS (
  SELECT u.*,b.user_id FROM booking_package_units u JOIN bookings b ON b.id=u.booking_id JOIN course_types ct ON ct.id=b.course_type_id
  WHERE b.user_id=p_actor AND ct.name::text=p_course AND NOT EXISTS(SELECT 1 FROM no_class_return_hour_units m WHERE m.unit_id=u.id) AND
   (u.redeemed_at>=v_start AND u.redeemed_at<v_end OR u.status IN ('available','expired') AND u.expires_at>=v_start AND u.expires_at<v_end AND u.expires_at<=v_now)
 ), ordered AS (
  SELECT c.id,'wallet'::text AS kind,c.event_at AS at FROM credit_events c WHERE c.event_at IS NOT NULL
  UNION ALL SELECT u.id,'package',coalesce(u.redeemed_at,u.expires_at) FROM unit_events u
 ), page AS MATERIALIZED (SELECT * FROM ordered ORDER BY at DESC,kind,id LIMIT 21 OFFSET p_offset),
 selected AS (SELECT * FROM page ORDER BY at DESC,kind,id LIMIT 20),
 enriched AS (
  SELECT p.at,p.kind,p.id,jsonb_build_object('id',c.id,'kind','wallet','at',p.at,
   'participants',coalesce(cm.people,jsonb_build_array(c.child_id)),
   'status',CASE WHEN c.spent THEN 'redeemed' WHEN c.expires_at>v_now AND (c.status='active' OR c.hour_total>0) THEN 'stored'
    WHEN c.course='kids_group' AND c.entitlement_policy='same_month' AND v_now<(date_trunc('month',c.original_date)+interval '2 month') AT TIME ZONE 'Asia/Bangkok' THEN 'normal_expired' ELSE 'expired' END,
   'originalDate',c.original_date,'originalStart',c.original_start_time,'originalEnd',c.original_end_time,
   'storedAt',c.stored_at,'usedAt',c.used_at,'expiresAt',c.expires_at,'hourTotal',c.hour_total,'hourUsed',c.hour_used,'hourRemaining',c.hour_remaining,
   'storedBy',CASE WHEN sa.user_id=p_actor THEN 'parent' WHEN sa.action IN ('admin_lesson_assistance','attendance_gap_return_entitlement') OR sap.role::text IN ('admin','super_admin') THEN 'admin' ELSE 'unknown' END,
   'usedBy',CASE WHEN coalesce(c.use_actor,ua.user_id)=p_actor THEN 'parent' WHEN c.use_actor IS NOT NULL OR uap.role::text IN ('admin','super_admin') OR ua.action IN ('admin_lesson_assistance','admin_makeup_source_used') THEN 'admin' ELSE 'unknown' END,
   'destinations',coalesce(ds.items,'[]'::jsonb)) AS row
  FROM selected p JOIN credit_events c ON p.kind='wallet' AND p.id=c.id
  LEFT JOIN LATERAL (SELECT jsonb_agg(child_id ORDER BY original_session_id) people FROM lesson_wallet_credit_members WHERE credit_id=c.id)cm ON true
  LEFT JOIN LATERAL (
   SELECT a.* FROM activity_logs a WHERE
    a.action='store_lesson_wallet_credit' AND a.entity_id=c.id OR
    a.action='admin_lesson_assistance' AND a.details->>'operation'='store' AND a.entity_id=c.original_session_id AND
     (a.details->'result'->>'credit_id'=c.id::text OR a.details->'result'->>'creditId'=c.id::text) OR
    a.action='attendance_gap_return_entitlement' AND a.details->>'creditId'=c.id::text
   ORDER BY (a.action IN ('admin_lesson_assistance','attendance_gap_return_entitlement')) DESC,a.created_at,a.id LIMIT 1
  )sa ON true LEFT JOIN profiles sap ON sap.id=sa.user_id
  LEFT JOIN LATERAL (
   SELECT a.* FROM activity_logs a WHERE a.action='redeem_lesson_wallet_credit' AND a.entity_id=c.id OR EXISTS(
    SELECT 1 FROM no_class_return_hour_units hm WHERE hm.credit_id=c.id
      AND hm.unit_id=(SELECT last_m.unit_id FROM no_class_return_hour_units last_m JOIN booking_package_units last_u ON last_u.id=last_m.unit_id
        WHERE last_m.credit_id=c.id AND last_u.status='redeemed' AND last_u.redeemed_at IS NOT NULL
        ORDER BY last_u.redeemed_at DESC,last_m.unit_id DESC LIMIT 1) AND
      (a.action='package_unit_redeemed' AND a.details->>'unitId'=hm.unit_id::text OR a.action='admin_makeup_source_used' AND a.entity_id=hm.unit_id))
   ORDER BY CASE WHEN c.hour_total>0 THEN a.action='admin_makeup_source_used' ELSE false END DESC,
     CASE WHEN c.hour_total>0 THEN a.created_at END DESC,a.created_at,a.id LIMIT 1
  )ua ON true LEFT JOIN profiles uap ON uap.id=ua.user_id
  LEFT JOIN LATERAL (
   SELECT jsonb_agg(jsonb_build_object('date',s.date,'start',s.start_time,'end',s.end_time,'childId',s.child_id,'branchName',br.name,'cancelled',s.cancelled_at IS NOT NULL OR s.status::text='cancelled') ORDER BY s.child_id NULLS FIRST,s.id)items
   FROM booking_sessions s JOIN bookings b ON b.id=s.booking_id JOIN branches br ON br.id=s.branch_id
   WHERE b.user_id=p_actor AND (s.id=coalesce(c.destination_session_id,c.redeemed_session_id) OR
    EXISTS(SELECT 1 FROM lesson_wallet_credit_members cm WHERE cm.credit_id=c.id AND cm.redeemed_session_id=s.id) OR
    EXISTS(SELECT 1 FROM no_class_return_hour_units hm JOIN booking_package_units hu ON hu.id=hm.unit_id WHERE hm.credit_id=c.id AND s.id=ANY(hu.session_ids)))
  )ds ON true
  UNION ALL
  SELECT p.at,p.kind,p.id,jsonb_build_object('id',u.id,'kind','package','at',p.at,'participants',u.participants,
   'status',CASE WHEN u.status='redeemed' THEN 'redeemed' ELSE 'expired' END,'storedAt',NULL,'storedBy','unknown',
   'usedAt',u.redeemed_at,'usedBy',CASE WHEN a.user_id=p_actor THEN 'parent' WHEN ap.role::text IN ('admin','super_admin') THEN 'admin' ELSE 'unknown' END,
   'expiresAt',u.expires_at,'destinations',coalesce(ds.items,'[]'::jsonb))
  FROM selected p JOIN unit_events u ON p.kind='package' AND u.id=p.id
  LEFT JOIN LATERAL (SELECT a.* FROM activity_logs a WHERE a.action='package_unit_redeemed' AND a.entity_id=u.booking_id AND a.details->>'unitId'=u.id::text ORDER BY a.created_at,a.id LIMIT 1)a ON true
  LEFT JOIN profiles ap ON ap.id=a.user_id
  LEFT JOIN LATERAL (
   SELECT jsonb_agg(jsonb_build_object('date',s.date,'start',s.start_time,'end',s.end_time,'childId',s.child_id,'branchName',br.name,'cancelled',s.cancelled_at IS NOT NULL OR s.status::text='cancelled') ORDER BY s.child_id NULLS FIRST,s.id) items
   FROM booking_sessions s JOIN bookings b ON b.id=s.booking_id JOIN branches br ON br.id=s.branch_id WHERE b.user_id=p_actor AND s.id=ANY(u.session_ids)
  )ds ON true
 ) SELECT coalesce(jsonb_agg(row ORDER BY at DESC,kind,id),'[]'),(SELECT count(*)>20 FROM page) INTO v_rows,v_more FROM enriched;
 RETURN jsonb_build_object('month',to_char(p_month,'YYYY-MM'),'course',p_course,'rows',v_rows,'nextOffset',CASE WHEN v_more THEN p_offset+20 END);
END $function$;

DO $$ BEGIN IF md5(replace(pg_get_functiondef('admin_makeup_history_ledger_v3(uuid,date,uuid,text,uuid,text,integer,uuid)'::regprocedure),chr(13),''))<>'3468a5f7118fa39c995daf2a8f0f2715' THEN RAISE EXCEPTION 'NO_CLASS_HOURLY_BASELINE_DRIFT admin_makeup_history_ledger_v3';END IF;END $$;
CREATE OR REPLACE FUNCTION public.admin_makeup_history_ledger_v3(p_actor uuid, p_month date, p_user uuid, p_course text, p_child uuid DEFAULT NULL::uuid, p_kind text DEFAULT 'all'::text, p_page integer DEFAULT 1, p_reference uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_result jsonb;v_context jsonb;v_roster text[];v_reference uuid:=p_reference;v_balance jsonb;
BEGIN
 PERFORM public.task10_require_actor_v1(p_actor,'makeup');
 IF p_month IS NULL OR p_month<>date_trunc('month',p_month)::date OR p_month>='9999-01-01' OR p_user IS NULL
  OR p_course IS NULL OR p_course NOT IN ('kids_group','adult_group','private') OR p_kind IS NULL OR p_kind NOT IN ('all','wallet','absent','use')
  OR p_page IS NULL OR p_page<1 OR p_page>10000 OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user)
  OR p_child IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.children WHERE id=p_child AND parent_id=p_user) THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;

 -- A reference selects identity/current rules, never a history month boundary.
 IF v_reference IS NULL THEN
  SELECT x.id INTO v_reference FROM public.booking_sessions x JOIN public.bookings b ON b.id=x.booking_id
   JOIN public.course_types c ON c.id=b.course_type_id
  WHERE b.user_id=p_user AND b.status::text='verified' AND c.name::text=p_course AND NOT x.is_makeup
   AND x.admin_makeup_grant_id IS NULL AND x.date>=p_month AND x.date<(p_month+interval '1 month')::date
   AND (p_course='kids_group' AND p_child IS NULL OR x.child_id IS NOT DISTINCT FROM p_child)
  ORDER BY x.date,x.id LIMIT 1;
 END IF;
 IF v_reference IS NOT NULL THEN
  BEGIN
   v_context:=public.admin_makeup_context_v2(p_actor,v_reference,p_month);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
   -- A paused Kids policy must not hide historical evidence or imply zero rights.
   IF p_course='kids_group' AND SQLERRM='TASK10_MAKEUP_PAUSED' THEN v_context:=NULL;ELSE RAISE;END IF;
  END;
 END IF;
 IF v_context IS NOT NULL THEN
  IF v_context->>'parentId' IS DISTINCT FROM p_user::text OR v_context->>'course' IS DISTINCT FROM p_course
   OR p_course<>'kids_group' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_context->'learners')m WHERE (m->>'childId')::uuid IS NOT DISTINCT FROM p_child)
   THEN RAISE EXCEPTION 'TASK10_SOURCE_CONFLICT';END IF;
  SELECT array_agg(coalesce(m->>'childId','self') ORDER BY coalesce(m->>'childId','self')) INTO v_roster FROM jsonb_array_elements(v_context->'learners')m;
  -- Reuse the accepted Admin eligibility reader. Private credit duration counts once,
  -- independently of the number of family participants; no mutation or new formula.
  SELECT jsonb_build_object('walletQuantity',coalesce(sum(CASE WHEN p_course='private' THEN (j->>'durationMinutes')::numeric/60 ELSE 1 END) FILTER(WHERE j->>'kind'='wallet'),0),
   'walletSourceCount',count(*) FILTER(WHERE j->>'kind'='wallet'),'absentSourceCount',count(*) FILTER(WHERE j->>'kind'='absent'),
   'unit',CASE WHEN p_course='private' THEN 'ชั่วโมง' ELSE 'ครั้ง' END,
   'sources',coalesce(jsonb_agg(jsonb_build_object('creditId',j->>'creditId','date',x.date,'startTime',x.start_time,'endTime',x.end_time,'branchName',br.name,
    'quantity',CASE WHEN p_course='private' THEN (j->>'durationMinutes')::numeric/60 ELSE 1 END,
    'expiresAt',coalesce(j->>'expiresAt',w.expires_at::text)) ORDER BY x.date,x.start_time,x.id) FILTER(WHERE j->>'kind'='wallet'),'[]'))
  INTO v_balance FROM jsonb_array_elements(v_context->'sources')j
   JOIN public.booking_sessions x ON x.id=coalesce(j->>'referenceSessionId',j->>'sourceSessionId')::uuid JOIN public.branches br ON br.id=x.branch_id
   LEFT JOIN public.lesson_wallet_credits w ON w.id=(j->>'creditId')::uuid;
 END IF;
 WITH possible AS MATERIALIZED (
  SELECT x.id FROM public.booking_sessions x JOIN public.bookings b ON b.id=x.booking_id JOIN public.course_types c ON c.id=b.course_type_id
  WHERE p_course='private' AND v_roster IS NOT NULL AND b.user_id=p_user AND b.status::text='verified' AND c.name::text='private' AND NOT x.is_makeup
 ), unit_ids AS MATERIALIZED (SELECT DISTINCT public.lesson_source_family_unit_sessions_v1(id) ids FROM possible),
 private_scope AS MATERIALIZED (
  SELECT unnest(ids) id FROM unit_ids WHERE (SELECT array_agg(coalesce(m.child_id::text,'self') ORDER BY coalesce(m.child_id::text,'self')) FROM public.booking_sessions m WHERE m.id=ANY(ids))=v_roster
 ), scope_bookings AS MATERIALIZED (

  SELECT b.id,b.user_id,c.name::text AS course_type FROM public.bookings b JOIN public.course_types c ON c.id=b.course_type_id
  WHERE b.user_id=p_user AND c.name::text=p_course AND EXISTS(SELECT 1 FROM public.booking_sessions s WHERE s.booking_id=b.id
   AND NOT s.is_makeup
   AND (p_course='private' AND v_roster IS NOT NULL AND s.id IN (SELECT id FROM private_scope)
    OR (p_course<>'private' OR v_roster IS NULL) AND (p_course='kids_group' AND p_child IS NULL OR s.child_id IS NOT DISTINCT FROM p_child)))
 ), rooted AS MATERIALIZED (
  SELECT s.*,b.user_id,b.course_type,public.admin_makeup_history_root_v3(s.id) AS root_id FROM public.booking_sessions s JOIN scope_bookings b ON b.id=s.booking_id
 ), selected_roots AS MATERIALIZED (
  SELECT DISTINCT root_id FROM rooted WHERE NOT is_makeup
   AND (p_course='private' AND v_roster IS NOT NULL AND id IN (SELECT id FROM private_scope)
    OR (p_course<>'private' OR v_roster IS NULL) AND (p_course='kids_group' AND p_child IS NULL OR child_id IS NOT DISTINCT FROM p_child))
 ), related AS MATERIALIZED (SELECT r.* FROM rooted r JOIN selected_roots s ON s.root_id=r.root_id), credits AS MATERIALIZED (
  SELECT w.* FROM public.lesson_wallet_credits w WHERE w.user_id=p_user AND
   (EXISTS(SELECT 1 FROM related r WHERE r.id=w.original_session_id) OR EXISTS(SELECT 1 FROM public.lesson_wallet_credit_members cm JOIN related r ON r.id=cm.original_session_id WHERE cm.credit_id=w.id))
 ), events AS MATERIALIZED (
  SELECT 'store:'||w.id::text AS id,'wallet'::text AS kind,
   CASE WHEN a.action='attendance_gap_return_entitlement' THEN 'คืนสิทธิ์เข้ากระเป๋า' ELSE 'เก็บเข้ากระเป๋า' END AS title,
   w.stored_at AS at,'เก็บเมื่อ'::text AS time_label,w.original_session_id AS source_id,w.redeemed_session_id AS destination_id,a.user_id AS actor_id,
   CASE WHEN a.action IN ('admin_lesson_assistance','attendance_gap_return_entitlement') THEN a.details->>'reason' END AS reason,
   CASE WHEN EXISTS(SELECT 1 FROM no_class_return_hour_units hm WHERE hm.credit_id=w.id) THEN
     'คืนเป็นสิทธิ์รายชั่วโมง · คงเหลือ '||(SELECT count(*) FROM no_class_return_hour_units hm JOIN booking_package_units hu ON hu.id=hm.unit_id WHERE hm.credit_id=w.id AND hu.status='available' AND hu.expires_at>clock_timestamp())||' ชั่วโมง'
    WHEN EXISTS(SELECT 1 FROM public.task10_family_makeup_uses u WHERE u.credit_id=w.id) THEN 'ใช้เป็นต้นทางชดเชยแล้ว'
    WHEN w.redeemed_session_id IS NOT NULL THEN 'ใช้กระเป๋าตามปกติแล้ว' WHEN w.status='expired' OR w.expires_at<=clock_timestamp() THEN 'หมดอายุกระเป๋าปกติ' ELSE 'เก็บในกระเป๋า' END AS status,
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
   CASE WHEN a.action IN ('admin_lesson_assistance','admin_makeup_source_used') THEN a.details->>'reason' END,'ไม่หักโควตาชดเชย',w.expires_at,w.id
  FROM credits w JOIN public.booking_sessions d ON d.id=w.redeemed_session_id AND NOT d.is_makeup LEFT JOIN LATERAL (
   SELECT a.* FROM public.activity_logs a WHERE (a.action='redeem_lesson_wallet_credit' AND a.entity_id=w.id OR a.action='admin_makeup_source_used' AND a.entity_id=w.original_session_id)
   ORDER BY (a.action='admin_makeup_source_used') DESC,a.created_at,a.id LIMIT 1
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
   ORDER BY (a.action='admin_makeup_source_used') DESC,a.created_at,a.id LIMIT 1
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
   JOIN selected_roots r ON r.root_id=g.source_root_id WHERE g.parent_id=p_user
    AND NOT EXISTS(SELECT 1 FROM public.admin_makeup_store_requests r WHERE r.actor_id=d.actor_id AND r.request_id=d.request_id
     AND r.result->'approval'->>'approvalId'=g.id::text AND r.result->>'storePolicy'='admin-store-once-v1')

  UNION ALL
  SELECT 'additional:'||g.id::text,'use','ชดเชยเพิ่มเติมโดย Admin',g.created_at,'จัดเพิ่มเติมเมื่อ',g.reference_session_id,(g.result->'data'->>'id')::uuid,g.actor_id,g.reason,
   CASE WHEN g.revoked_at IS NULL THEN 'ชดเชยเพิ่มเติม · ไม่หักโควตาปกติ' ELSE 'ยกเลิกชดเชยเพิ่มเติมแล้ว' END,NULL::timestamptz,NULL::uuid
  FROM public.admin_makeup_grants_v2 g JOIN public.bookings gb ON gb.id=g.booking_id JOIN public.course_types gc ON gc.id=gb.course_type_id
  WHERE gb.user_id=p_user AND gc.name::text=p_course
   AND (p_course='private' AND v_roster IS NOT NULL AND (SELECT array_agg(coalesce(m#>>'{}','self') ORDER BY coalesce(m#>>'{}','self')) FROM jsonb_array_elements(g.participants)m)=v_roster
    OR (p_course<>'private' OR v_roster IS NULL) AND (p_course='kids_group' AND p_child IS NULL OR EXISTS(SELECT 1 FROM jsonb_array_elements(g.participants)m WHERE (m#>>'{}')::uuid IS NOT DISTINCT FROM p_child)))
  UNION ALL
  SELECT 'hour-use:'||hu.id::text,'use','ใช้สิทธิ์คืนรายชั่วโมง',hu.redeemed_at,'ใช้กระเป๋าเมื่อ',w.original_session_id,
    hu.session_ids[1],a.user_id,CASE WHEN a.action='admin_makeup_source_used' THEN a.details->>'reason' END,
    'ใช้ 1 ชั่วโมง · ไม่หักโควตาชดเชย',hu.expires_at,w.id
  FROM no_class_return_hour_units hm JOIN booking_package_units hu ON hu.id=hm.unit_id JOIN credits w ON w.id=hm.credit_id
   LEFT JOIN LATERAL(SELECT a.* FROM activity_logs a WHERE
    a.action='package_unit_redeemed' AND a.details->>'unitId'=hu.id::text OR a.action='admin_makeup_source_used' AND a.entity_id=hu.id
    ORDER BY (a.action='admin_makeup_source_used') DESC,a.created_at,a.id LIMIT 1)a ON true
  WHERE hu.status='redeemed' AND cardinality(hu.session_ids)>0
  ), filtered AS MATERIALIZED (SELECT * FROM events WHERE p_kind='all' OR kind=p_kind), page AS MATERIALIZED (
  SELECT * FROM filtered ORDER BY at DESC NULLS LAST,id LIMIT 20 OFFSET (p_page-1)*20
 ), enriched AS (
  SELECT e.*,jsonb_build_object('id',e.id,'kind',e.kind,'title',e.title,'at',e.at,'timeLabel',e.time_label,'actor',p.full_name,'reason',e.reason,'status',e.status,'walletExpiresAt',e.wallet_expires_at,
   'walletQuantity',CASE WHEN e.id LIKE 'hour-use:%' THEN 1 WHEN e.id LIKE 'redeem:%' THEN CASE WHEN p_course='private' THEN extract(epoch FROM wc.original_end_time-wc.original_start_time)/3600 ELSE 1 END END,
   'learnerFullName',CASE WHEN d.id IS NOT NULL THEN CASE WHEN d.child_id IS NULL THEN owner.full_name ELSE dc.full_name END ELSE CASE WHEN s.child_id IS NULL THEN owner.full_name ELSE sc.full_name END END,
   'learnerNickname',CASE WHEN d.id IS NOT NULL THEN dc.nickname ELSE sc.nickname END,
   'source',jsonb_build_object('referenceOnly',e.id LIKE 'additional:%','id',s.id,'date',s.date,'startTime',s.start_time,'endTime',s.end_time,'branchName',sb.name,'courseType',b.course_type),
   'destination',CASE WHEN d.id IS NOT NULL THEN jsonb_build_object('id',d.id,'date',d.date,'startTime',d.start_time,'endTime',d.end_time,'branchName',db.name,'isMakeup',d.is_makeup) END,
   'participants',coalesce((SELECT jsonb_agg(jsonb_build_object('childId',cm.child_id,'fullName',CASE WHEN cm.child_id IS NULL THEN owner.full_name ELSE ch.full_name END,'nickname',ch.nickname) ORDER BY cm.original_session_id)
    FROM public.lesson_wallet_credit_members cm LEFT JOIN public.children ch ON ch.id=cm.child_id AND ch.parent_id=p_user WHERE cm.credit_id=e.credit_id),'[]')) AS event
  FROM page e LEFT JOIN public.lesson_wallet_credits wc ON wc.id=e.credit_id JOIN public.booking_sessions s ON s.id=e.source_id JOIN scope_bookings b ON b.id=s.booking_id JOIN public.profiles owner ON owner.id=p_user
   JOIN public.branches sb ON sb.id=s.branch_id LEFT JOIN public.profiles p ON p.id=e.actor_id LEFT JOIN public.children sc ON sc.id=s.child_id AND sc.parent_id=p_user
   LEFT JOIN public.booking_sessions d ON d.id=e.destination_id LEFT JOIN public.branches db ON db.id=d.branch_id LEFT JOIN public.children dc ON dc.id=d.child_id AND dc.parent_id=p_user
 ) SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(event ORDER BY at DESC NULLS LAST,id) FROM enriched),'[]'),'total',(SELECT count(*) FROM filtered),
  'counts',jsonb_build_object('all',(SELECT count(*) FROM events),'wallet',(SELECT count(*) FROM events WHERE kind='wallet'),'absent',(SELECT count(*) FROM events WHERE kind='absent'),'use',(SELECT count(*) FROM events WHERE kind='use')),
  'page',p_page,'pageSize',20) INTO v_result;
 RETURN v_result||jsonb_build_object('historyScope','all_months','balance',v_balance,'summary',v_context->'family');
END $function$;

CREATE FUNCTION public.admin_no_class_return_hourly_v1(p_actor uuid,p_anchor uuid,p_mode text DEFAULT 'preview',p_request uuid DEFAULT NULL,p_expected text DEFAULT NULL,p_reason text DEFAULT NULL,p_ip text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.admin_no_class_return_v1(p_actor,p_anchor,p_mode,p_request,p_expected,p_reason,p_ip)
$$;
REVOKE ALL ON FUNCTION public.admin_no_class_return_hourly_v1(uuid,uuid,text,uuid,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_no_class_return_hourly_v1(uuid,uuid,text,uuid,text,text,text) TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
