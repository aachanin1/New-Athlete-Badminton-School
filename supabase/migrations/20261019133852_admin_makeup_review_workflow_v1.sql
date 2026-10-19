BEGIN;

-- Review-only read projection. The existing month reader and business writers
-- remain compatible. Internal functions and receipts are never client APIs.
CREATE FUNCTION public.admin_makeup_review_rows_v1(p_month date)
RETURNS TABLE (
 id uuid,booking_id uuid,child_id uuid,user_id uuid,branch_id uuid,schedule_slot_id uuid,rescheduled_from_id uuid,
 date date,start_time time,end_time time,status text,attendance_status text,attendance_scope_count bigint,
 user_name text,learner_name text,branch_name text,course_type text,is_makeup boolean,
 group_id uuid,group_name text,coach_id uuid,coach_name text,coach_checkin_time timestamptz,coach_checkin_photo_url text,
 coach_checkin_has_location boolean,review_closed_at timestamptz,review_closed_reason text,
 coach_review_requested_count bigint,coach_review_requested_at timestamptz,coach_evidence_requested_count bigint,coach_evidence_requested_at timestamptz,
 group_key text,needs_attendance boolean,needs_evidence boolean
) LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $review_rows$
 WITH source AS MATERIALIZED (
  SELECT s.*,b.user_id,c.name::text course_type,coalesce(nullif(p.full_name,''),'ไม่ทราบ') user_name,
   coalesce(nullif(br.name,''),'ไม่ทราบ') branch_name,
   CASE WHEN s.child_id IS NULL THEN coalesce(nullif(p.full_name,''),'ไม่ทราบ')
    WHEN nullif(btrim(ch.full_name),'') IS NULL THEN coalesce(nullif(btrim(ch.nickname),''),'ไม่ระบุชื่อผู้เรียน')
    WHEN nullif(btrim(ch.nickname),'') IS NULL OR lower(btrim(ch.nickname))=lower(btrim(ch.full_name)) THEN btrim(ch.full_name)
    ELSE btrim(ch.nickname)||' - '||btrim(ch.full_name) END learner_name
  FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id
   LEFT JOIN public.course_types c ON c.id=b.course_type_id LEFT JOIN public.profiles p ON p.id=b.user_id
   LEFT JOIN public.branches br ON br.id=s.branch_id LEFT JOIN public.children ch ON ch.id=s.child_id
  WHERE b.status::text='verified' AND s.date>=p_month AND s.date<(p_month+interval '1 month')::date
   AND ((s.status::text=ANY(CASE WHEN EXISTS(SELECT 1 FROM public.task10_policy_activation WHERE effective_at IS NOT NULL)
      THEN ARRAY['absent','scheduled','completed','walleted'] ELSE ARRAY['absent','scheduled','completed'] END)
       AND s.date<=(statement_timestamp() AT TIME ZONE 'Asia/Bangkok')::date)
    OR s.rescheduled_from_id IS NOT NULL
    OR (s.status::text='walleted' AND NOT s.is_makeup AND c.name::text='kids_group'
     AND s.date>(statement_timestamp() AT TIME ZONE 'Asia/Bangkok')::date
     AND EXISTS(SELECT 1 FROM public.task10_policy_activation WHERE effective_at IS NOT NULL)))
 ), source_slots AS (SELECT DISTINCT s.schedule_slot_id FROM source s WHERE s.schedule_slot_id IS NOT NULL),
 assignment AS MATERIALIZED (
  SELECT DISTINCT ON(m.booking_session_id) m.booking_session_id,g.id group_id,g.name group_name,g.coach_id,
   coalesce(nullif(p.full_name,''),nullif(p.email,'')) coach_name
  FROM public.coach_assignment_groups g JOIN public.coach_assignment_group_students m ON m.group_id=g.id
   LEFT JOIN public.profiles p ON p.id=g.coach_id JOIN source s ON s.id=m.booking_session_id
  WHERE g.schedule_slot_id IN(SELECT schedule_slot_id FROM source_slots)
  ORDER BY m.booking_session_id,g.id DESC
 ), audits AS MATERIALIZED (
  SELECT l.entity_id,
   count(*) FILTER(WHERE l.action='attendance_gap_request_coach_review') review_count,
   max(l.created_at) FILTER(WHERE l.action='attendance_gap_request_coach_review') review_at,
   count(*) FILTER(WHERE l.action='attendance_gap_request_coach_evidence') evidence_count,
   max(l.created_at) FILTER(WHERE l.action='attendance_gap_request_coach_evidence') evidence_at,
   max(l.created_at) FILTER(WHERE l.action='attendance_gap_closed_no_action') closed_at,
   (array_agg(l.details->>'reason' ORDER BY l.created_at DESC,l.id DESC) FILTER(WHERE l.action='attendance_gap_closed_no_action'))[1] closed_reason
  FROM public.activity_logs l JOIN source s ON s.id=l.entity_id
  WHERE l.entity_type='booking_sessions' AND l.action IN('attendance_gap_request_coach_review','attendance_gap_request_coach_evidence','attendance_gap_closed_no_action')
  GROUP BY l.entity_id
 ), attendance_counts AS MATERIALIZED(
  SELECT a.booking_session_id,count(*) count FROM public.attendance a
  WHERE a.booking_session_id IN(SELECT id FROM source UNION SELECT m.booking_session_id FROM public.coach_assignment_group_students m JOIN public.coach_assignment_groups g ON g.id=m.group_id WHERE g.schedule_slot_id IN(SELECT schedule_slot_id FROM source_slots)
   UNION SELECT s.id FROM public.booking_sessions s WHERE s.schedule_slot_id IN(SELECT schedule_slot_id FROM source_slots)) GROUP BY a.booking_session_id
 ), group_counts AS(
  SELECT m.group_id,sum(a.count) count FROM public.coach_assignment_group_students m JOIN public.coach_assignment_groups g ON g.id=m.group_id
   JOIN attendance_counts a ON a.booking_session_id=m.booking_session_id WHERE g.schedule_slot_id IN(SELECT schedule_slot_id FROM source_slots) GROUP BY m.group_id
 ), slot_counts AS(
  SELECT s.schedule_slot_id,sum(a.count) count FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id
   JOIN attendance_counts a ON a.booking_session_id=s.id WHERE s.schedule_slot_id IN(SELECT schedule_slot_id FROM source_slots)
    AND b.status::text='verified' AND s.status::text NOT IN('rescheduled','walleted') GROUP BY s.schedule_slot_id
 ), facts AS MATERIALIZED (
  SELECT s.*,a.group_id,a.group_name,a.coach_id,a.coach_name,
   CASE WHEN exact_att.id IS NOT NULL THEN exact_att.status::text
    WHEN latest_att.student_id IS NULL OR coalesce(s.child_id,s.user_id) IS NULL THEN latest_att.status::text END attendance,
   ck.checkin_time,ck.photo_url,ck.location_lat IS NOT NULL AND ck.location_lng IS NOT NULL location_ok,
   l.review_count,l.review_at,l.evidence_count,l.evidence_at,l.closed_at,l.closed_reason,
   coalesce(CASE WHEN a.group_id IS NOT NULL THEN gc.count WHEN s.schedule_slot_id IS NOT NULL THEN sc.count ELSE ac.count END,0)::bigint scope_count
  FROM source s LEFT JOIN assignment a ON a.booking_session_id=s.id LEFT JOIN audits l ON l.entity_id=s.id
   LEFT JOIN group_counts gc ON gc.group_id=a.group_id LEFT JOIN slot_counts sc ON sc.schedule_slot_id=s.schedule_slot_id LEFT JOIN attendance_counts ac ON ac.booking_session_id=s.id
   LEFT JOIN LATERAL(SELECT ar.id,ar.status FROM public.attendance ar WHERE ar.booking_session_id=s.id
     AND ar.student_id=coalesce(s.child_id,s.user_id) ORDER BY ar.checked_at DESC NULLS LAST,ar.id DESC LIMIT 1) exact_att ON true
   LEFT JOIN LATERAL(SELECT ar.student_id,ar.status FROM public.attendance ar WHERE ar.booking_session_id=s.id
     ORDER BY ar.checked_at DESC NULLS LAST,ar.id DESC LIMIT 1) latest_att ON true
   LEFT JOIN LATERAL(SELECT c.checkin_time,c.photo_url,c.location_lat,c.location_lng FROM public.coach_checkins c
     WHERE c.schedule_slot_id=s.schedule_slot_id AND c.coach_id=a.coach_id ORDER BY c.checkin_time DESC,c.id LIMIT 1) ck ON true
 ), classified AS (
  SELECT f.*,
   f.closed_at IS NULL AND NOT coalesce(f.is_makeup,false) AND f.attendance IS NULL
    AND f.status::text NOT IN('absent','completed','rescheduled','walleted')
    AND (f.date+coalesce(f.end_time,'00:00'::time)) AT TIME ZONE 'Asia/Bangkok'<statement_timestamp() gap,
   f.closed_at IS NULL AND NOT coalesce(f.is_makeup,false) AND f.schedule_slot_id IS NOT NULL AND f.coach_name IS NOT NULL
    AND f.attendance IN('present','late','absent')
    AND NOT(coalesce(f.checkin_time IS NOT NULL AND nullif(f.photo_url,'') IS NOT NULL AND f.location_ok,false)) evidence
  FROM facts f
 )
 SELECT f.id,f.booking_id,f.child_id,f.user_id,f.branch_id,f.schedule_slot_id,f.rescheduled_from_id,
  f.date,f.start_time,f.end_time,f.status::text,f.attendance,f.scope_count,f.user_name,f.learner_name,f.branch_name,coalesce(f.course_type,''),coalesce(f.is_makeup,false),
  f.group_id,f.group_name,f.coach_id,f.coach_name,f.checkin_time,f.photo_url,f.location_ok,f.closed_at,f.closed_reason,
  coalesce(f.review_count,0),f.review_at,coalesce(f.evidence_count,0),f.evidence_at,
  concat_ws('|',f.date::text,f.start_time::text,f.end_time::text,f.branch_name,coalesce(nullif(f.course_type,''),'course'),coalesce(f.coach_name,'no-coach')),
  f.gap,coalesce(f.evidence,false)
 FROM classified f WHERE f.gap OR f.evidence;
$review_rows$;
REVOKE ALL ON FUNCTION public.admin_makeup_review_rows_v1(date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_makeup_review_rows_v1(date) TO service_role;

CREATE FUNCTION public.admin_makeup_review_page_v1(
 p_actor uuid,p_month date,p_search text DEFAULT '',p_branch uuid DEFAULT NULL,p_course text DEFAULT 'all',p_status text DEFAULT 'all',
 p_page integer DEFAULT 1,p_size integer DEFAULT 15,p_target uuid DEFAULT NULL,p_date date DEFAULT NULL,p_detail text DEFAULT NULL,p_scope uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $review_page$
DECLARE v_result jsonb;
BEGIN
 PERFORM public.task10_require_actor_v1(p_actor,'makeup');
 IF p_month IS NULL OR p_month<>date_trunc('month',p_month)::date OR p_month>='9999-01-01'
  OR p_search IS NULL OR length(p_search)>200 OR p_course IS NULL OR p_course NOT IN('all','kids_group','adult_group','private')
  OR p_status IS NULL OR p_status NOT IN('all','no_coach','waiting_attendance','coach_evidence','coach_requested')
  OR p_page IS NULL OR p_page<1 OR p_page>10000 OR p_size IS NULL OR p_size NOT IN(15,25,50)
  OR length(coalesce(p_detail,''))>2000 THEN RAISE EXCEPTION 'ADMIN_REVIEW_INVALID_REQUEST';END IF;
 IF p_scope IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.booking_sessions WHERE id=p_scope AND date>=p_month AND date<(p_month+interval '1 month')::date) THEN RAISE EXCEPTION 'ADMIN_REVIEW_SCOPE_CHANGED';END IF;
 WITH all_rows AS MATERIALIZED(SELECT * FROM public.admin_makeup_review_rows_v1(p_month)),
 scoped AS MATERIALIZED(SELECT * FROM all_rows r WHERE (p_branch IS NULL OR r.branch_id=p_branch) AND (p_course='all' OR r.course_type=p_course)),
 matched AS (
  SELECT DISTINCT r.group_key FROM scoped r WHERE
   (p_status='all' OR p_status='no_coach' AND r.coach_name IS NULL OR p_status='waiting_attendance' AND r.needs_attendance
    OR p_status='coach_evidence' AND r.needs_evidence OR p_status='coach_requested' AND r.coach_review_requested_count>0)
   AND (btrim(p_search)='' OR EXISTS(SELECT 1 FROM unnest(ARRAY[r.learner_name,r.user_name,coalesce(r.coach_name,''),r.branch_name,r.course_type,
    (ARRAY['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'])[extract(dow FROM r.date)::integer+1]||' '||extract(day FROM r.date)::integer::text||' '||
    (ARRAY['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'])[extract(month FROM r.date)::integer]||' '||right((extract(year FROM r.date)::integer+543)::text,2)
   ]) word WHERE position(lower(btrim(p_search)) IN lower(word))>0))
 ), round_groups AS MATERIALIZED(
  SELECT r.group_key,count(*) count,min(r.date) date,min(r.start_time) start_time,min(r.id::text) first_id,
   bool_or(CASE WHEN p_target IS NOT NULL THEN r.id=p_target ELSE p_date IS NOT NULL AND r.date=p_date END) target
  FROM scoped r JOIN matched m USING(group_key) GROUP BY r.group_key
 ), page_groups AS MATERIALIZED(
  SELECT * FROM round_groups ORDER BY target DESC,date DESC,start_time DESC,first_id LIMIT p_size OFFSET (p_page-1)*p_size
 ), scope_source AS (SELECT s.*,b.course_type_id FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id WHERE s.id=p_scope),
 scope_ids AS MATERIALIZED(
  SELECT s.id FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id CROSS JOIN scope_source anchor
  WHERE s.date=anchor.date AND s.start_time=anchor.start_time AND s.end_time=anchor.end_time AND s.branch_id=anchor.branch_id AND b.course_type_id IS NOT DISTINCT FROM anchor.course_type_id
 ), selected AS MATERIALIZED(
  SELECT r.* FROM scoped r JOIN matched m USING(group_key)
  WHERE CASE WHEN p_scope IS NOT NULL THEN r.id IN(SELECT id FROM scope_ids)
   ELSE r.group_key IN(SELECT group_key FROM page_groups WHERE p_detail IS NULL OR group_key=p_detail) END
 ), payload AS (
  SELECT (to_jsonb(r)-ARRAY['group_key','needs_attendance','needs_evidence'])||jsonb_build_object('same_slot_coach_groups',coalesce((
   SELECT jsonb_agg(jsonb_build_object('groupId',g.id,'groupName',coalesce(nullif(g.name,''),'ไม่ระบุชื่อกลุ่ม'),'coachId',g.coach_id,
     'coachName',coalesce(nullif(p.full_name,''),nullif(p.email,''),'ไม่ทราบโค้ช'),'sessionCount',(SELECT count(*) FROM public.coach_assignment_group_students m WHERE m.group_id=g.id)) ORDER BY coalesce(nullif(p.full_name,''),nullif(p.email,''),'ไม่ทราบโค้ช'),g.name,g.id)
   FROM public.coach_assignment_groups g LEFT JOIN public.profiles p ON p.id=g.coach_id
   WHERE g.schedule_slot_id=r.schedule_slot_id AND g.id IS DISTINCT FROM r.group_id AND g.coach_id IS NOT NULL
    AND EXISTS(SELECT 1 FROM public.coach_assignment_group_students m JOIN public.booking_sessions bs ON bs.id=m.booking_session_id JOIN public.bookings b ON b.id=bs.booking_id WHERE m.group_id=g.id AND b.status::text='verified' AND bs.status::text NOT IN('rescheduled','walleted'))
    AND NOT EXISTS(SELECT 1 FROM public.coach_assignment_group_students m JOIN public.booking_sessions bs ON bs.id=m.booking_session_id JOIN public.bookings b ON b.id=bs.booking_id
     WHERE m.group_id=g.id AND b.status::text='verified' AND bs.status::text NOT IN('rescheduled','walleted')
      AND (bs.schedule_slot_id IS DISTINCT FROM r.schedule_slot_id OR bs.date<>r.date OR bs.start_time<>r.start_time OR bs.end_time<>r.end_time OR bs.branch_id<>r.branch_id OR b.course_type_id IS DISTINCT FROM(SELECT course_type_id FROM public.bookings WHERE id=r.booking_id)))
  ),'[]'::jsonb)) item,r.group_key,r.id FROM selected r
 )
 SELECT jsonb_build_object('sessions',coalesce((SELECT jsonb_agg(item ORDER BY group_key,id) FROM payload),'[]'),
  'groups',coalesce((SELECT jsonb_agg(jsonb_build_object('key',group_key,'count',count) ORDER BY target DESC,date DESC,start_time DESC,first_id) FROM page_groups),'[]'),
  'total',(SELECT count(*) FROM round_groups),'sessionTotal',coalesce((SELECT sum(count) FROM round_groups),0),
  'stats',jsonb_build_object('review',(SELECT count(*) FROM all_rows),'reviewNoCoach',(SELECT count(*) FROM all_rows WHERE coach_name IS NULL),'reviewCoachEvidence',(SELECT count(*) FROM all_rows WHERE needs_evidence)),
  'coaches',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',coalesce(nullif(full_name,''),nullif(email,''),'ไม่ทราบโค้ช'),'role',role) ORDER BY full_name) FROM public.profiles WHERE role::text IN('coach','head_coach')),'[]'),
  'detailFound',p_detail IS NULL OR EXISTS(SELECT 1 FROM page_groups WHERE group_key=p_detail),
  'scopeSessionIds',CASE WHEN p_scope IS NOT NULL THEN coalesce((SELECT jsonb_agg(id) FROM scope_ids),'[]') ELSE NULL END,
  'page',p_page,'pageSize',p_size,'complete',true) INTO v_result;
 RETURN v_result;
END;
$review_page$;
REVOKE ALL ON FUNCTION public.admin_makeup_review_page_v1(uuid,date,text,uuid,text,text,integer,integer,uuid,date,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_makeup_review_page_v1(uuid,date,text,uuid,text,text,integer,integer,uuid,date,text,uuid) TO service_role;

CREATE TABLE public.admin_makeup_review_requests (
 request_id uuid PRIMARY KEY,actor_id uuid NOT NULL,fingerprint text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.admin_makeup_review_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_makeup_review_requests FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.admin_makeup_request_review_round_v1(
 p_actor uuid,p_anchor uuid,p_group text,p_action text,p_members uuid[],p_request uuid,p_read_only boolean DEFAULT false,p_ip text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $request_round$
DECLARE v_prior public.admin_makeup_review_requests%ROWTYPE;v_fp text;v_members uuid[];v_current uuid[];v_targets uuid[];
 v_month date;v_result jsonb;v_at timestamptz;v_coaches uuid[];v_slots uuid[];v_bookings uuid[];v_row record;v_coach uuid;v_slot uuid;
 v_notifications integer:=0;v_audits integer:=0;v_reason text;v_date date;v_start time;v_end time;v_session uuid;
BEGIN
 PERFORM public.task10_require_actor_v1(p_actor,'makeup');
 IF p_anchor IS NULL OR p_group IS NULL OR length(p_group)>2000 OR p_action IS NULL OR p_action NOT IN('request_coach_review','request_coach_evidence')
  OR p_request IS NULL OR p_members IS NULL OR cardinality(p_members)<1 OR cardinality(p_members)>10000 OR array_position(p_members,NULL) IS NOT NULL THEN RAISE EXCEPTION 'ADMIN_REVIEW_INVALID_REQUEST';END IF;
 SELECT array_agg(DISTINCT x ORDER BY x) INTO v_members FROM unnest(p_members)x;
 IF cardinality(v_members)<>cardinality(p_members) THEN RAISE EXCEPTION 'ADMIN_REVIEW_INVALID_REQUEST';END IF;
 v_fp:=md5(jsonb_build_array(p_actor,p_anchor,p_group,p_action,v_members)::text);
 IF p_read_only THEN
  IF NOT pg_try_advisory_xact_lock(hashtextextended('admin-review-request-v1|'||p_request::text,0)) THEN
   RETURN jsonb_build_object('confirmed',false,'pending',true,'definitive',false,'requestId',p_request);END IF;
 ELSE PERFORM pg_advisory_xact_lock_shared(10,1);PERFORM pg_advisory_xact_lock_shared(10,2);
  PERFORM pg_advisory_xact_lock(hashtextextended('admin-review-request-v1|'||p_request::text,0));END IF;
 SELECT * INTO v_prior FROM public.admin_makeup_review_requests WHERE request_id=p_request;
 IF FOUND THEN
  IF v_prior.actor_id<>p_actor OR (NOT p_read_only AND v_prior.fingerprint<>v_fp) THEN RAISE EXCEPTION 'ADMIN_REVIEW_REQUEST_MISMATCH';END IF;
  RETURN v_prior.result||jsonb_build_object('idempotentReplay',true);
 END IF;
 IF p_read_only THEN RETURN jsonb_build_object('confirmed',false,'pending',false,'definitive',true,'requestId',p_request);END IF;
 SELECT date_trunc('month',s.date)::date,s.date,s.start_time,s.end_time INTO v_month,v_date,v_start,v_end FROM public.booking_sessions s WHERE s.id=p_anchor;
 IF v_month IS NULL THEN RAISE EXCEPTION 'ADMIN_REVIEW_SCOPE_CHANGED';END IF;
 -- Match the complete displayed round before locking, then recheck after locks.
 SELECT array_agg(id ORDER BY id),array_agg(DISTINCT schedule_slot_id),array_agg(DISTINCT booking_id)
  INTO v_current,v_slots,v_bookings FROM public.admin_makeup_review_rows_v1(v_month) WHERE group_key=p_group;
 IF v_current IS DISTINCT FROM v_members OR NOT(p_anchor=ANY(v_current)) OR array_position(v_slots,NULL) IS NOT NULL THEN RAISE EXCEPTION 'ADMIN_REVIEW_SCOPE_CHANGED';END IF;
 FOREACH v_session IN ARRAY v_members LOOP
  IF NOT pg_try_advisory_xact_lock(hashtextextended('admin-review-close-session-v1|'||v_session::text,0)) THEN RAISE EXCEPTION 'ADMIN_REVIEW_BUSY';END IF;
 END LOOP;
 -- Follow participant-before-slot ordering of existing assignment/attendance writers.
 -- NOWAIT prevents a reverse-writer lock cycle from waiting or committing stale scope.
 PERFORM b.id FROM public.bookings b WHERE b.id=ANY(v_bookings) ORDER BY b.id FOR UPDATE NOWAIT;
 PERFORM s.id FROM public.booking_sessions s WHERE s.schedule_slot_id=ANY(v_slots) ORDER BY s.id FOR UPDATE NOWAIT;
 PERFORM g.id FROM public.coach_assignment_groups g WHERE g.schedule_slot_id=ANY(v_slots) ORDER BY g.id FOR UPDATE NOWAIT;
 PERFORM s.id FROM public.schedule_slots s WHERE s.id=ANY(v_slots) ORDER BY s.id FOR UPDATE NOWAIT;
 PERFORM m.id FROM public.coach_assignment_group_students m JOIN public.coach_assignment_groups g ON g.id=m.group_id WHERE g.schedule_slot_id=ANY(v_slots) ORDER BY m.id FOR UPDATE OF m NOWAIT;
 SELECT array_agg(id ORDER BY id),array_agg(id ORDER BY id) FILTER(WHERE CASE WHEN p_action='request_coach_review' THEN needs_attendance ELSE needs_evidence END)
  INTO v_current,v_targets FROM public.admin_makeup_review_rows_v1(v_month) WHERE group_key=p_group;
 IF v_current IS DISTINCT FROM v_members OR coalesce(cardinality(v_targets),0)=0 THEN RAISE EXCEPTION 'ADMIN_REVIEW_SCOPE_CHANGED';END IF;
 -- Exact memberships are the authoritative recipients; do not fall back to an
 -- unrelated slot coach when an exact model exists (same rule as the old route).
 IF EXISTS(SELECT 1 FROM unnest(v_targets)t(id) WHERE NOT EXISTS(
   SELECT 1 FROM public.coach_assignment_group_students m JOIN public.coach_assignment_groups g ON g.id=m.group_id
    JOIN public.booking_sessions s ON s.id=m.booking_session_id
   WHERE m.booking_session_id=t.id AND g.schedule_slot_id=s.schedule_slot_id AND g.coach_id IS NOT NULL)) THEN RAISE EXCEPTION 'ADMIN_REVIEW_NO_COACH';END IF;
 v_at:=clock_timestamp();
 v_reason:=CASE WHEN p_action='request_coach_review' THEN 'ส่งตรวจสอบย้อนหลังทั้งรอบ ' ELSE 'ขอหลักฐาน selfie/GPS ย้อนหลังสำหรับรอบ ' END
  ||v_date::text||' '||left(v_start::text,5)||'–'||left(v_end::text,5)||' ('||cardinality(v_targets)||' คน)';
 FOR v_row IN
  SELECT DISTINCT g.coach_id,s.schedule_slot_id,s.date,s.start_time,s.end_time FROM public.coach_assignment_group_students m
   JOIN public.coach_assignment_groups g ON g.id=m.group_id JOIN public.booking_sessions s ON s.id=m.booking_session_id
  WHERE m.booking_session_id=ANY(v_targets) AND g.schedule_slot_id=s.schedule_slot_id AND g.coach_id IS NOT NULL
  ORDER BY g.coach_id,s.schedule_slot_id
 LOOP
  INSERT INTO public.notifications(user_id,title,message,type,link_url) VALUES(v_row.coach_id,
   CASE WHEN p_action='request_coach_review' THEN 'ตรวจสอบการเช็คชื่อย้อนหลัง' ELSE 'ขอหลักฐานเช็คอินย้อนหลัง' END,
   'Admin ส่งรอบ '||v_row.date::text||' '||left(v_row.start_time::text,5)||'–'||left(v_row.end_time::text,5)||' กลับให้ตรวจสอบ: '||v_reason,'schedule',
   CASE WHEN p_action='request_coach_review' THEN '/coach/attendance?date=' ELSE '/coach/checkin?date=' END||v_row.date::text||'&slot='||v_row.schedule_slot_id::text);
  v_notifications:=v_notifications+1;
 END LOOP;
 SELECT array_agg(DISTINCT g.coach_id ORDER BY g.coach_id) INTO v_coaches FROM public.coach_assignment_groups g JOIN public.coach_assignment_group_students m ON m.group_id=g.id
  JOIN public.booking_sessions s ON s.id=m.booking_session_id WHERE m.booking_session_id=ANY(v_targets) AND g.schedule_slot_id=s.schedule_slot_id AND g.coach_id IS NOT NULL;
 INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details,ip_address,created_at)
  SELECT p_actor,CASE WHEN p_action='request_coach_review' THEN 'attendance_gap_request_coach_review' ELSE 'attendance_gap_request_coach_evidence' END,
   'booking_sessions',s.id,jsonb_build_object('reason',v_reason,'scheduleSlotId',s.schedule_slot_id,'notifiedCoachIds',(
     SELECT jsonb_agg(DISTINCT g.coach_id) FROM public.coach_assignment_groups g JOIN public.coach_assignment_group_students m ON m.group_id=g.id
      WHERE m.booking_session_id=s.id AND g.schedule_slot_id=s.schedule_slot_id AND g.coach_id IS NOT NULL),
     'attendanceAlreadyRecorded',p_action='request_coach_evidence','requestId',p_request,'groupKey',p_group),nullif(split_part(p_ip,',',1),'')::inet,v_at
  FROM public.booking_sessions s WHERE s.id=ANY(v_targets);
 GET DIAGNOSTICS v_audits=ROW_COUNT;
 IF v_audits<>cardinality(v_targets) OR v_notifications=0 THEN RAISE EXCEPTION 'ADMIN_REVIEW_INCOMPLETE';END IF;
 v_result:=jsonb_build_object('confirmed',true,'requestId',p_request,'anchorId',p_anchor,'action',p_action,'targetSessionIds',v_targets,
  'targetCount',cardinality(v_targets),'notificationCount',v_notifications,'coachIds',v_coaches,'recordedAt',v_at,'idempotentReplay',false);
 INSERT INTO public.admin_makeup_review_requests(request_id,actor_id,fingerprint,result,created_at) VALUES(p_request,p_actor,v_fp,v_result,v_at);
 RETURN v_result;
END;
$request_round$;
REVOKE ALL ON FUNCTION public.admin_makeup_request_review_round_v1(uuid,uuid,text,text,uuid[],uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_makeup_request_review_round_v1(uuid,uuid,text,text,uuid[],uuid,boolean,text) TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
