-- NO-CLASS-RETURN-1: source-backed whole-coach-round returns. No historical repair.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SELECT pg_advisory_xact_lock(10,1);

CREATE TABLE public.admin_no_class_return_receipts (
 request_id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES public.profiles(id),
 anchor_id uuid NOT NULL REFERENCES public.booking_sessions(id),
 schedule_slot_id uuid NOT NULL REFERENCES public.schedule_slots(id),
 coach_id uuid REFERENCES public.profiles(id), request_fingerprint text NOT NULL,
 assignment_ids uuid[] NOT NULL DEFAULT '{}',
 scope_fingerprint text NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX admin_no_class_return_coach_slot_idx ON public.admin_no_class_return_receipts(coach_id,schedule_slot_id) WHERE coach_id IS NOT NULL;
ALTER TABLE public.admin_no_class_return_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_no_class_return_receipts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.admin_no_class_return_receipts TO service_role;

-- Exact-model boundary matches coach schedule/payroll; names are never identity.
CREATE FUNCTION public.admin_no_class_coach_v1(p_session uuid,p_slot uuid,p_exact boolean)
RETURNS uuid LANGUAGE plpgsql STABLE SET search_path=public,pg_temp AS $$
DECLARE v_count integer; v_coach uuid;
BEGIN
 IF p_exact THEN
  SELECT count(*),(array_agg(g.coach_id ORDER BY g.id))[1] INTO v_count,v_coach
   FROM public.coach_assignment_group_students m JOIN public.coach_assignment_groups g ON g.id=m.group_id
   WHERE m.booking_session_id=p_session AND g.schedule_slot_id=p_slot;
  IF v_count>1 THEN RAISE EXCEPTION 'NO_CLASS_RETURN_AMBIGUOUS';END IF;
  RETURN v_coach;
 END IF;
 IF EXISTS(SELECT 1 FROM public.booking_sessions s WHERE s.id=p_session AND s.rescheduled_from_id IS NOT NULL AND NOT s.is_makeup
  AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credits c WHERE c.redeemed_session_id=s.id)
  AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credit_members m WHERE m.redeemed_session_id=s.id)) THEN RETURN NULL;END IF;
 SELECT count(DISTINCT coach_id),(array_agg(coach_id ORDER BY coach_id))[1] INTO v_count,v_coach
  FROM public.coach_assignments WHERE schedule_slot_id=p_slot;
 IF v_count>1 THEN RAISE EXCEPTION 'NO_CLASS_RETURN_AMBIGUOUS';END IF;
 RETURN v_coach;
END $$;

CREATE FUNCTION public.admin_no_class_preview_v1(p_anchor uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE a record; s record; v_exact boolean; v_coach uuid; v_ids uuid[]; v_unit_ids uuid[]; v_actual_ids uuid[];
 v_seen uuid[]:='{}'; v_prior_ids uuid[]; v_prior public.lesson_wallet_credits%ROWTYPE; v_expiry timestamptz;
 v_units jsonb:='[]'; v_sessions jsonb:='[]'; v_blockers jsonb:='[]'; v_fingerprint text; v_unit uuid;
 v_amount numeric; v_member uuid; v_unit_json jsonb; v_now timestamptz:=clock_timestamp(); v_scope_data jsonb;
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
  IF v_expiry IS NULL OR v_expiry<v_now THEN
   v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','NO_CLASS_RETURN_EXPIRED','message','สิทธิ์ต้นทางหมดอายุแล้ว ไม่สามารถเริ่มอายุใหม่จากวันคืน'));
  END IF;
  v_amount:=CASE WHEN a.course_name='private' THEN extract(epoch FROM (s.end_time-s.start_time))/3600 ELSE 1 END;
  IF v_amount<=0 THEN RAISE EXCEPTION 'NO_CLASS_RETURN_AMBIGUOUS';END IF;
  v_unit_json:=jsonb_build_object('unitId',v_unit,'sessionIds',v_unit_ids,'amount',v_amount,
   'unit',CASE WHEN a.course_name='private' THEN 'hour' ELSE 'session' END,'expiresAt',v_expiry,
   'expirySource',CASE WHEN coalesce(cardinality(v_prior_ids),0)=1 THEN 'stored_credit' ELSE 'original_month_end' END);
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
END $$;

CREATE FUNCTION public.admin_no_class_return_v1(p_actor uuid,p_anchor uuid,p_mode text,p_request uuid DEFAULT NULL,
 p_expected text DEFAULT NULL,p_reason text DEFAULT NULL,p_ip text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='3s' SET timezone='Asia/Bangkok' AS $$
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
 RETURN v_result;
END $$;

-- This fence covers the existing API and older weekly-summary writers too.
-- A close racing a return must not commit a previously read teaching snapshot.
CREATE FUNCTION public.admin_no_class_payroll_fence_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_entry jsonb; v_ids uuid[]; v_actual uuid[]; v_slot uuid; v_exact boolean;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('no-class-return-payroll-admission-v1',0));
 IF EXISTS(SELECT 1 FROM public.admin_no_class_return_receipts r
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(NEW.snapshot->'entries','[]'::jsonb)) e
  WHERE e->>'schedule_slot_id'=r.schedule_slot_id::text AND
   (r.coach_id=NEW.coach_id OR e->>'assignment_id'=ANY(r.assignment_ids::text[])
    OR jsonb_typeof(e->'session_ids') IS DISTINCT FROM 'array'
    OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(e->'session_ids') sid WHERE sid IN
     (SELECT jsonb_array_elements_text(r.result->'targetSessionIds'))))) THEN
  RAISE EXCEPTION 'NO_CLASS_RETURN_SCOPE_CHANGED: teaching round was returned; refresh the weekly summary';
 END IF;
 -- New app snapshots carry the exact eligible source IDs, and the write validates
 -- them again. Old app snapshots remain compatible but cannot prove unrelated
 -- historical learner scope when an Admin later attempts a round return.
 FOR v_entry IN SELECT value FROM jsonb_array_elements(coalesce(NEW.snapshot->'entries','[]'::jsonb)) ORDER BY value->>'schedule_slot_id' LOOP
  IF v_entry ? 'session_ids' THEN
   IF jsonb_typeof(v_entry->'session_ids') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'NO_CLASS_RETURN_SCOPE_CHANGED';END IF;
   v_slot:=(v_entry->>'schedule_slot_id')::uuid;
   PERFORM id FROM public.schedule_slots WHERE id=v_slot FOR SHARE NOWAIT;
   v_exact:=EXISTS(SELECT 1 FROM public.coach_assignment_groups WHERE schedule_slot_id=v_slot);
   SELECT coalesce(array_agg(x::uuid ORDER BY x::uuid),'{}'::uuid[]) INTO v_ids FROM jsonb_array_elements_text(v_entry->'session_ids') x;
   SELECT coalesce(array_agg(bs.id ORDER BY bs.id),'{}'::uuid[]) INTO v_actual FROM public.booking_sessions bs JOIN public.bookings b ON b.id=bs.booking_id
    WHERE bs.schedule_slot_id=v_slot AND b.status::text='verified' AND bs.cancelled_at IS NULL
     AND bs.status::text IN ('scheduled','completed','absent')
     AND public.admin_no_class_coach_v1(bs.id,v_slot,v_exact)=NEW.coach_id;
   IF v_ids IS DISTINCT FROM v_actual OR cardinality(v_ids)<>coalesce((v_entry->>'student_count')::integer,-1) THEN
    RAISE EXCEPTION 'NO_CLASS_RETURN_SCOPE_CHANGED: teaching learners changed; refresh the weekly summary';END IF;
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER admin_no_class_payroll_fence BEFORE INSERT OR UPDATE ON public.coach_weekly_teaching_summaries
 FOR EACH ROW EXECUTE FUNCTION public.admin_no_class_payroll_fence_v1();

REVOKE ALL ON FUNCTION public.admin_no_class_coach_v1(uuid,uuid,boolean),public.admin_no_class_preview_v1(uuid),
 public.admin_no_class_payroll_fence_v1(),public.admin_no_class_return_v1(uuid,uuid,text,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_no_class_coach_v1(uuid,uuid,boolean),public.admin_no_class_preview_v1(uuid),public.admin_no_class_payroll_fence_v1() FROM service_role;
GRANT EXECUTE ON FUNCTION public.admin_no_class_return_v1(uuid,uuid,text,uuid,text,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
