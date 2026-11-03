-- Family Wallet representative points at the unit; the member edge identifies
-- the individual learner. Preserve the existing shared writer/root functions.
CREATE OR REPLACE FUNCTION public.admin_makeup_history_root_v3(p_session_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_current uuid:=p_session_id; v_visited uuid[]:='{}'; v_session public.booking_sessions%ROWTYPE;
  v_booking uuid; v_child uuid; v_links uuid[];
BEGIN
  LOOP
    IF v_current IS NULL OR v_current=ANY(v_visited) THEN RAISE EXCEPTION 'TASK10_AMBIGUOUS_SOURCE'; END IF;
    v_visited:=array_append(v_visited,v_current);
    SELECT * INTO v_session FROM public.booking_sessions WHERE id=v_current;
    IF NOT FOUND OR (v_booking IS NOT NULL AND (v_booking<>v_session.booking_id
      OR (NOT v_session.is_makeup AND v_child IS DISTINCT FROM v_session.child_id))) THEN RAISE EXCEPTION 'TASK10_AMBIGUOUS_SOURCE'; END IF;
    IF v_booking IS NULL THEN v_booking:=v_session.booking_id; v_child:=v_session.child_id; END IF;
    SELECT array_agg(DISTINCT predecessor) FILTER(WHERE predecessor IS NOT NULL) INTO v_links FROM (
      SELECT v_session.rescheduled_from_id AS predecessor
      UNION SELECT w.original_session_id FROM public.lesson_wallet_credits w WHERE w.redeemed_session_id=v_current
       AND NOT EXISTS(SELECT 1 FROM public.lesson_wallet_credit_members m WHERE m.credit_id=w.id AND m.redeemed_session_id=v_current)
      UNION SELECT original_session_id FROM public.lesson_wallet_credit_members WHERE redeemed_session_id=v_current
    ) chain;
    IF coalesce(cardinality(v_links),0)=0 THEN RETURN v_current; END IF;
    IF cardinality(v_links)<>1 THEN RAISE EXCEPTION 'TASK10_AMBIGUOUS_SOURCE'; END IF;
    v_current:=v_links[1];
    -- A Makeup destination has its actual child; predecessor identity is retained
    -- separately, and the source chain from this point must be consistent.
    IF v_session.is_makeup THEN v_child:=NULL; SELECT child_id INTO v_child FROM public.booking_sessions WHERE id=v_current; END IF;
  END LOOP;
END $function$;
REVOKE ALL ON FUNCTION public.admin_makeup_history_root_v3(uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Admin-only read model: current eligible balance is separate from all-month events.
-- Existing User/read/write functions and all stored rows are preserved.
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
   JOIN public.booking_sessions x ON x.id=(j->>'sourceSessionId')::uuid JOIN public.branches br ON br.id=x.branch_id
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
   CASE WHEN EXISTS(SELECT 1 FROM public.task10_family_makeup_uses u WHERE u.credit_id=w.id) THEN 'ใช้เป็นต้นทางชดเชยแล้ว'
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
  ), filtered AS MATERIALIZED (SELECT * FROM events WHERE p_kind='all' OR kind=p_kind), page AS MATERIALIZED (
  SELECT * FROM filtered ORDER BY at DESC NULLS LAST,id LIMIT 20 OFFSET (p_page-1)*20
 ), enriched AS (
  SELECT e.*,jsonb_build_object('id',e.id,'kind',e.kind,'title',e.title,'at',e.at,'timeLabel',e.time_label,'actor',p.full_name,'reason',e.reason,'status',e.status,'walletExpiresAt',e.wallet_expires_at,
   'walletQuantity',CASE WHEN e.id LIKE 'redeem:%' THEN CASE WHEN p_course='private' THEN extract(epoch FROM wc.original_end_time-wc.original_start_time)/3600 ELSE 1 END END,
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
REVOKE ALL ON FUNCTION public.admin_makeup_history_ledger_v3(uuid,date,uuid,text,uuid,text,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_makeup_history_ledger_v3(uuid,date,uuid,text,uuid,text,integer,uuid) TO service_role;
