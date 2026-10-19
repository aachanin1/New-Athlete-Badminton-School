BEGIN;

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


NOTIFY pgrst,'reload schema';
COMMIT;
