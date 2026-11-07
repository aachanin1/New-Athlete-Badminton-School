BEGIN;

-- Attendance follow-up includes Makeup; entitlement eligibility is unchanged.
-- Keep the Review projection identical while avoiding row-estimate driven repeated scans.
-- Aggregate audit records once before matching the month; materialize scope counts once.
-- Compare the booking status as its native enum so PostgreSQL can use its statistics.
CREATE OR REPLACE FUNCTION public.admin_makeup_review_rows_v1(p_month date)
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
  WHERE b.status='verified' AND s.date>=p_month AND s.date<(p_month+interval '1 month')::date
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
  FROM public.activity_logs l
  WHERE l.entity_type='booking_sessions' AND l.action IN('attendance_gap_request_coach_review','attendance_gap_request_coach_evidence','attendance_gap_closed_no_action')
  GROUP BY l.entity_id
 ), attendance_counts AS MATERIALIZED(
  SELECT a.booking_session_id,count(*) count FROM public.attendance a
  WHERE a.booking_session_id IN(SELECT id FROM source UNION SELECT m.booking_session_id FROM public.coach_assignment_group_students m JOIN public.coach_assignment_groups g ON g.id=m.group_id WHERE g.schedule_slot_id IN(SELECT schedule_slot_id FROM source_slots)
   UNION SELECT s.id FROM public.booking_sessions s WHERE s.schedule_slot_id IN(SELECT schedule_slot_id FROM source_slots)) GROUP BY a.booking_session_id
 ), group_counts AS MATERIALIZED(
  SELECT m.group_id,sum(a.count) count FROM public.coach_assignment_group_students m JOIN public.coach_assignment_groups g ON g.id=m.group_id
   JOIN attendance_counts a ON a.booking_session_id=m.booking_session_id WHERE g.schedule_slot_id IN(SELECT schedule_slot_id FROM source_slots) GROUP BY m.group_id
 ), slot_counts AS MATERIALIZED(
  SELECT s.schedule_slot_id,sum(a.count) count FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id
   JOIN attendance_counts a ON a.booking_session_id=s.id WHERE s.schedule_slot_id IN(SELECT schedule_slot_id FROM source_slots)
    AND b.status='verified' AND s.status::text NOT IN('rescheduled','walleted') GROUP BY s.schedule_slot_id
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
   f.closed_at IS NULL AND f.attendance IS NULL
    AND f.status::text NOT IN('absent','completed','rescheduled','walleted')
    AND (f.date+coalesce(f.end_time,'00:00'::time)) AT TIME ZONE 'Asia/Bangkok'<statement_timestamp() gap,
   f.closed_at IS NULL AND f.schedule_slot_id IS NOT NULL AND f.coach_name IS NOT NULL
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
CREATE OR REPLACE FUNCTION public.admin_makeup_review_page_v1(
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
    OR p_status='coach_evidence' AND (r.schedule_slot_id IS NOT NULL AND r.coach_name IS NOT NULL AND NOT coalesce(r.coach_checkin_time IS NOT NULL AND nullif(r.coach_checkin_photo_url,'') IS NOT NULL AND r.coach_checkin_has_location,false)) OR p_status='coach_requested' AND r.coach_review_requested_count>0)
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
  'stats',jsonb_build_object('review',(SELECT count(*) FROM all_rows),'reviewNoCoach',(SELECT count(*) FROM all_rows WHERE coach_name IS NULL),'reviewCoachEvidence',(SELECT count(*) FROM all_rows WHERE schedule_slot_id IS NOT NULL AND coach_name IS NOT NULL AND NOT coalesce(coach_checkin_time IS NOT NULL AND nullif(coach_checkin_photo_url,'') IS NOT NULL AND coach_checkin_has_location,false))),
  'coaches',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',coalesce(nullif(full_name,''),nullif(email,''),'ไม่ทราบโค้ช'),'role',role) ORDER BY full_name) FROM public.profiles WHERE role::text IN('coach','head_coach')),'[]'),
  'detailFound',p_detail IS NULL OR EXISTS(SELECT 1 FROM page_groups WHERE group_key=p_detail),
  'scopeSessionIds',CASE WHEN p_scope IS NOT NULL THEN coalesce((SELECT jsonb_agg(id) FROM scope_ids),'[]') ELSE NULL END,
  'page',p_page,'pageSize',p_size,'complete',true) INTO v_result;
 RETURN v_result;
END;
$review_page$;
REVOKE ALL ON FUNCTION public.admin_makeup_review_page_v1(uuid,date,text,uuid,text,text,integer,integer,uuid,date,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_makeup_review_page_v1(uuid,date,text,uuid,text,text,integer,integer,uuid,date,text,uuid) TO service_role;


NOTIFY pgrst,'reload schema';
COMMIT;
