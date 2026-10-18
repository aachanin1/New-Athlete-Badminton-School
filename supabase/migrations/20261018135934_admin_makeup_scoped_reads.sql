BEGIN;
-- Additive, read-only and service-only. Existing mutation functions are untouched.
CREATE FUNCTION public.admin_makeup_lookup_v1(
 p_actor_id uuid,p_month date,p_course text,p_search text DEFAULT '',p_branch uuid DEFAULT NULL,
 p_page integer DEFAULT 1,p_mode text DEFAULT 'learners',p_user uuid DEFAULT NULL,p_child uuid DEFAULT NULL,p_booking uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_items jsonb;v_total bigint;v_size integer;v_from date;v_to date;
BEGIN
 PERFORM public.task10_require_actor_v1(p_actor_id,'makeup');
 IF p_month IS NULL OR p_month<>date_trunc('month',p_month)::date OR p_month>='9999-01-01' OR p_page IS NULL OR p_page<1 OR p_page>10000
  OR p_mode IS NULL OR p_mode NOT IN ('learners','sessions','families') OR p_course IS NULL OR p_course NOT IN ('kids_group','adult_group','private')
  OR p_search IS NULL OR length(p_search)>200 OR (p_mode IN ('learners','families') AND length(btrim(p_search))<2)
  OR (p_mode='sessions' AND (p_user IS NULL OR (p_course='kids_group' AND p_child IS NULL) OR (p_course='private' AND p_booking IS NULL)))
  OR (p_mode='families' AND p_course<>'kids_group') THEN RAISE EXCEPTION 'LESSON_SOURCE_INVALID_REQUEST'; END IF;
 v_size:=CASE WHEN p_mode='sessions' THEN 20 ELSE 10 END;
 v_from:=greatest(p_month,(clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date);v_to:=(p_month+interval '1 month')::date;
 IF p_mode='families' THEN
  WITH families AS (
   SELECT b.user_id,p.full_name AS parent_name,array_agg(DISTINCT b.branch_id) AS branch_ids,array_agg(DISTINCT br.name) AS branch_names
   FROM public.bookings b JOIN public.profiles p ON p.id=b.user_id JOIN public.course_types c ON c.id=b.course_type_id JOIN public.branches br ON br.id=b.branch_id
   WHERE b.status::text='verified' AND c.name::text='kids_group'
    AND ((b.year=extract(year FROM p_month) AND b.month=extract(month FROM p_month)) OR EXISTS(SELECT 1 FROM public.booking_sessions s WHERE s.booking_id=b.id AND s.date>=p_month AND s.date<v_to))
    AND (p_branch IS NULL OR b.branch_id=p_branch)
    AND (position(lower(btrim(p_search)) IN lower(coalesce(p.full_name,'')))>0 OR EXISTS(SELECT 1 FROM public.children ch WHERE ch.parent_id=b.user_id AND position(lower(btrim(p_search)) IN lower(concat_ws(' ',ch.full_name,ch.nickname)))>0))
   GROUP BY b.user_id,p.full_name
  ), page AS (SELECT * FROM families ORDER BY parent_name,user_id LIMIT v_size OFFSET (p_page-1)*v_size)
  SELECT coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY parent_name,user_id) FROM page x),'[]'),(SELECT count(*) FROM families) INTO v_items,v_total;
 ELSE
  WITH eligible AS MATERIALIZED (
   SELECT s.*,b.user_id,c.name::text AS course_type,p.full_name AS parent_name,br.name AS branch_name,ch.full_name AS child_full_name,ch.nickname AS child_nickname,
    CASE WHEN c.name::text='private' THEN b.id::text ELSE b.user_id::text||':'||coalesce(s.child_id::text,'self') END AS learner_key,
    CASE WHEN c.name::text='private' THEN b.id::text||':'||coalesce(s.schedule_slot_id::text,'')||':'||s.date::text||':'||s.start_time::text||':'||s.end_time::text ELSE s.id::text END AS unit_key,
    CASE WHEN s.child_id IS NOT NULL THEN ch.id IS NOT NULL ELSE c.name::text<>'kids_group' AND coalesce(b.learner_type::text,'self')<>'child' END AS identity_valid,
    CASE WHEN s.child_id IS NULL THEN coalesce(nullif(btrim(p.full_name),''),'ไม่ระบุชื่อผู้เรียน')
     WHEN nullif(btrim(ch.full_name),'') IS NULL THEN coalesce(nullif(btrim(ch.nickname),''),'ไม่ระบุชื่อผู้เรียน')
     WHEN nullif(btrim(ch.nickname),'') IS NULL OR lower(btrim(ch.nickname))=lower(btrim(ch.full_name)) THEN btrim(ch.full_name)
     ELSE btrim(ch.nickname)||' - '||btrim(ch.full_name) END AS learner_display_name
   FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id JOIN public.course_types c ON c.id=b.course_type_id
    JOIN public.profiles p ON p.id=b.user_id JOIN public.branches br ON br.id=s.branch_id LEFT JOIN public.children ch ON ch.id=s.child_id AND ch.parent_id=b.user_id
   WHERE b.status::text='verified' AND s.status::text='scheduled' AND NOT s.is_makeup AND s.cancelled_at IS NULL AND s.date>=v_from AND s.date<v_to
    AND c.name::text=p_course AND (p_branch IS NULL OR s.branch_id=p_branch)
    AND (p_mode<>'sessions' OR (b.user_id=p_user AND (p_course='private' AND b.id=p_booking OR p_course<>'private' AND s.child_id IS NOT DISTINCT FROM p_child)))
  ), people AS (
   SELECT learner_key,user_id,CASE WHEN p_course='private' THEN NULL::uuid ELSE child_id END child_id,
    CASE WHEN p_course='private' THEN booking_id ELSE NULL::uuid END booking_id,parent_name,
    string_agg(DISTINCT learner_display_name,' · ' ORDER BY learner_display_name)||CASE WHEN p_course='private' THEN ' · '||count(DISTINCT coalesce(child_id::text,'self:'||user_id::text))||' คน' ELSE '' END AS learner_name,
    array_agg(DISTINCT branch_id) AS branch_ids,array_agg(DISTINCT branch_name) AS branch_names,p_course AS course_type
   FROM eligible GROUP BY learner_key,user_id,CASE WHEN p_course='private' THEN NULL::uuid ELSE child_id END,CASE WHEN p_course='private' THEN booking_id ELSE NULL::uuid END,parent_name
   HAVING p_mode='sessions' OR bool_or(position(lower(btrim(p_search)) IN lower(concat_ws(' ',parent_name,child_full_name,child_nickname)))>0)
  ), people_page AS (SELECT * FROM people ORDER BY learner_name,learner_key LIMIT v_size OFFSET (p_page-1)*v_size),
  units AS (SELECT DISTINCT ON(unit_key) * FROM eligible ORDER BY unit_key,(child_id IS NULL) DESC,id),
  session_page AS (SELECT * FROM units ORDER BY date,start_time,id LIMIT v_size OFFSET (p_page-1)*v_size),
  session_rows AS (
   SELECT x.id,x.booking_id,x.child_id,x.user_id,x.branch_id,x.schedule_slot_id,x.date,x.start_time,x.end_time,x.status,x.is_makeup,x.course_type,x.parent_name,x.branch_name,x.child_full_name,x.child_nickname,
    (SELECT bool_and(e.identity_valid) FROM eligible e WHERE e.unit_key=x.unit_key) AS identity_valid,
    (SELECT string_agg(DISTINCT e.learner_display_name,' · ' ORDER BY e.learner_display_name)||CASE WHEN p_course='private' THEN ' · '||count(DISTINCT coalesce(e.child_id::text,'self:'||e.user_id::text))||' คน' ELSE '' END FROM eligible e WHERE e.unit_key=x.unit_key) AS learner_name,
    EXISTS(SELECT 1 FROM public.attendance a JOIN eligible e ON e.id=a.booking_session_id WHERE e.unit_key=x.unit_key) AS has_attendance,
    EXISTS(SELECT 1 FROM public.branch_date_closures d WHERE d.branch_id=x.branch_id AND d.closure_date=x.date AND d.is_active) AS branch_closed
   FROM session_page x
  ) SELECT CASE WHEN p_mode='learners' THEN coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY learner_name,learner_key) FROM people_page x),'[]') ELSE coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY date,start_time,id) FROM session_rows x),'[]') END,
   CASE WHEN p_mode='learners' THEN (SELECT count(*) FROM people) ELSE (SELECT count(*) FROM units) END INTO v_items,v_total;
 END IF;
 RETURN jsonb_build_object('items',v_items,'total',v_total,'page',p_page,'pageSize',v_size);
END $$;
REVOKE ALL ON FUNCTION public.admin_makeup_lookup_v1(uuid,date,text,text,uuid,integer,text,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_makeup_lookup_v1(uuid,date,text,text,uuid,integer,text,uuid,uuid,uuid) TO service_role;
CREATE FUNCTION public.admin_branch_closure_overview_v1(p_actor_id uuid,p_month date,p_branch uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor_id AND role::text='super_admin') THEN RAISE EXCEPTION 'TASK10_UNAUTHORIZED'; END IF;
 IF p_month IS NULL OR p_month<>date_trunc('month',p_month)::date OR p_month>='9999-01-01' THEN RAISE EXCEPTION 'BRANCH_CLOSURE_INVALID_REQUEST'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(d)||jsonb_build_object('branch_name',(SELECT name FROM public.branches WHERE id=d.branch_id),'impact_count',(
  SELECT count(*) FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id
  WHERE s.branch_id=d.branch_id AND s.date=d.closure_date AND s.cancelled_at IS NULL AND s.status::text IN ('scheduled','completed','absent') AND b.status::text<>'cancelled'
 )) ORDER BY d.closure_date,d.branch_id,d.id) FROM public.branch_date_closures d WHERE d.is_active AND d.closure_date>=p_month AND d.closure_date<(p_month+interval '1 month')::date AND (p_branch IS NULL OR d.branch_id=p_branch)),'[]');
END $$;
REVOKE ALL ON FUNCTION public.admin_branch_closure_overview_v1(uuid,date,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_branch_closure_overview_v1(uuid,date,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
