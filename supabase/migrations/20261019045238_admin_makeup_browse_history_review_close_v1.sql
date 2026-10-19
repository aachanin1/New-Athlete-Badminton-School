BEGIN;

-- Additive Admin reads. No entitlement mutation or Parent entry point changes.
CREATE FUNCTION public.admin_makeup_browse_v1(
 p_actor uuid,p_month date,p_course text,p_search text DEFAULT '',p_branch uuid DEFAULT NULL,
 p_status text DEFAULT 'all',p_page integer DEFAULT 1
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
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
    (SELECT count(*) FROM sources s WHERE s.user_id=f.user_id)::integer AS source_count
   FROM family_scope f LEFT JOIN purchase p ON p.user_id=f.user_id LEFT JOIN used u ON u.user_id=f.user_id
  ), visible AS MATERIALIZED (
   SELECT * FROM facts WHERE (source_count>0 OR used>0) AND
    (p_status='all' OR p_status='actionable' AND v_policy.makeup_enabled AND v_now<v_end AND remaining>0 AND source_count>0
     OR p_status='makeup' AND used>0 OR p_status='expired' AND v_now>=v_end)
  ), page AS MATERIALIZED (SELECT * FROM visible ORDER BY parent_name,user_id LIMIT 10 OFFSET (p_page-1)*10), cards AS (
   SELECT p.parent_name,p.user_id,jsonb_build_object('parentName',coalesce(p.parent_name,'ไม่พบชื่อผู้ปกครอง'),'branchIds',p.branch_ids,'branchNames',p.branch_names,
    'state',jsonb_build_object('active',v_policy.makeup_enabled,'state',v_policy.state,'parentId',p.user_id,'sourceMonth',to_char(p_month,'YYYY-MM'),
     'destinationMonth',to_char(v_next,'YYYY-MM'),'expiresAt',v_end,'sourcePurchase',jsonb_build_object('quantity',p.n,'pendingQuantity',p.pending,'awaitingReviewQuantity',p.reviewing),
     'destinationPurchase',public.task10_verified_purchase_v1(p.user_id,v_next),'minimum',v_setting,'quota',p.quota,'used',p.used,'remaining',p.remaining,
     'policyActor','admin','destinationPurchaseRequired',false,'policyVersion','admin-assistance-v1',
     'eligible',v_policy.makeup_enabled AND v_now<v_end AND p.remaining>0 AND p.source_count>0,
     'reason',CASE WHEN NOT v_policy.makeup_enabled THEN 'paused' WHEN v_now>=v_end THEN 'expired' WHEN p.remaining=0 THEN 'quota_exhausted' WHEN p.source_count=0 THEN 'no_source' ELSE NULL END,
     'sources',coalesce((SELECT jsonb_agg(jsonb_build_object('sourceSessionId',s.id,'rootId',s.root_id,'bookingId',s.booking_id,'sourceChildId',s.child_id,'sourceDate',s.date,'kind',s.kind,'creditId',s.credit_id) ORDER BY s.id) FROM sources s WHERE s.user_id=p.user_id),'[]'),
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
END $$;
REVOKE ALL ON FUNCTION public.admin_makeup_browse_v1(uuid,date,text,text,uuid,text,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_makeup_browse_v1(uuid,date,text,text,uuid,text,integer) TO service_role;

-- One durable audit per request; retries and readback use the same identity.
-- Both new and compatible old clients retain the existing close action/effect.
CREATE FUNCTION public.admin_close_makeup_review_v1(p_actor uuid,p_session uuid,p_reason text,p_request uuid,p_read_only boolean DEFAULT false,p_ip text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.booking_sessions%ROWTYPE;a public.activity_logs%ROWTYPE;
BEGIN
 PERFORM public.task10_require_actor_v1(p_actor,'makeup');
 IF p_session IS NULL OR p_request IS NULL OR p_reason IS NULL OR btrim(p_reason)='' OR length(p_reason)>1000 OR p_read_only IS NULL THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('admin-review-close-request-v1|'||p_request::text,0));
 SELECT * INTO a FROM public.activity_logs WHERE id=p_request;
 IF FOUND THEN
  IF a.user_id IS DISTINCT FROM p_actor OR a.entity_id IS DISTINCT FROM p_session OR a.action<>'attendance_gap_closed_no_action' OR a.details->>'reason' IS DISTINCT FROM btrim(p_reason) THEN RAISE EXCEPTION 'TASK10_IDEMPOTENCY_CONFLICT'; END IF;
  RETURN jsonb_build_object('confirmed',true,'sessionId',p_session,'requestId',p_request,'auditId',a.id,'closedAt',a.created_at);
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('admin-review-close-session-v1|'||p_session::text,0));
 SELECT * INTO a FROM public.activity_logs WHERE entity_id=p_session AND action='attendance_gap_closed_no_action' ORDER BY created_at DESC,id DESC LIMIT 1;
 IF FOUND THEN RETURN jsonb_build_object('confirmed',true,'sessionId',p_session,'requestId',p_request,'auditId',a.id,'closedAt',a.created_at); END IF;
 IF p_read_only THEN RETURN jsonb_build_object('confirmed',false,'sessionId',p_session,'requestId',p_request); END IF;
 SELECT * INTO s FROM public.booking_sessions WHERE id=p_session FOR UPDATE;
 IF NOT FOUND OR s.is_makeup OR (s.date+s.end_time) AT TIME ZONE 'Asia/Bangkok'>=clock_timestamp() THEN RAISE EXCEPTION 'ADMIN_REVIEW_CLOSE_INELIGIBLE'; END IF;
 INSERT INTO public.activity_logs(id,user_id,action,entity_type,entity_id,details,ip_address)
 VALUES(p_request,p_actor,'attendance_gap_closed_no_action','booking_sessions',s.id,
  jsonb_build_object('reason',btrim(p_reason),'scheduleSlotId',s.schedule_slot_id,'requestId',p_request),nullif(split_part(p_ip,',',1),'')::inet) RETURNING * INTO a;
 RETURN jsonb_build_object('confirmed',true,'sessionId',s.id,'requestId',p_request,'auditId',a.id,'closedAt',a.created_at);
END $$;
REVOKE ALL ON FUNCTION public.admin_close_makeup_review_v1(uuid,uuid,text,uuid,boolean,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_close_makeup_review_v1(uuid,uuid,text,uuid,boolean,text) TO service_role;

-- History uses exact identity + source-month lineage, including consumed sources.
-- Missing operation timestamps remain NULL; lesson dates never stand in for them.
CREATE FUNCTION public.admin_makeup_history_v1(p_actor uuid,p_month date,p_user uuid,p_course text,p_child uuid DEFAULT NULL,p_kind text DEFAULT 'all',p_page integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.admin_makeup_history_v1(uuid,date,uuid,text,uuid,text,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_makeup_history_v1(uuid,date,uuid,text,uuid,text,integer) TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
