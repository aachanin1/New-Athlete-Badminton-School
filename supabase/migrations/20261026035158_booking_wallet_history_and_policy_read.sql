BEGIN;
-- Presentation and the existing family facts use the same unchanged quota rule.
-- No settings, promotions, quota grants, historical repairs or writer changes.
CREATE FUNCTION public.task10_family_quota_policy_v1() RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('version','task10-quota-v1','unit',4,'cap',5)
$$;
CREATE FUNCTION public.task10_family_quota_v1(p_quantity numeric) RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT least((r->>'cap')::integer,floor(p_quantity/(r->>'unit')::numeric)::integer)
 FROM (SELECT public.task10_family_quota_policy_v1() r) s
$$;
DO $$ DECLARE d text; BEGIN
 d:=pg_get_functiondef('public.task10_family_makeup_facts_v1(uuid,date)'::regprocedure);
 IF position('v_quota:=least(5,floor((v_source->>''quantity'')::numeric/4)::integer);' IN d)=0 THEN
  RAISE EXCEPTION 'Unexpected family quota definition; review before replacing';
 END IF;
 d:=replace(d,'v_quota:=least(5,floor((v_source->>''quantity'')::numeric/4)::integer);',
  'v_quota:=public.task10_family_quota_v1((v_source->>''quantity'')::numeric);');
 EXECUTE d;
END $$;
-- The existing Admin browse projection must explain the same quota too.
DO $$ DECLARE d text;BEGIN
 d:=pg_get_functiondef('public.admin_makeup_browse_v1(uuid,date,text,text,uuid,text,integer)'::regprocedure);
 IF position('least(5,floor(coalesce(p.n,0)::numeric/4)::integer)' IN d)=0 THEN
  RAISE EXCEPTION 'Unexpected Admin quota projection; review before replacing';
 END IF;
 EXECUTE replace(d,'least(5,floor(coalesce(p.n,0)::numeric/4)::integer)','public.task10_family_quota_v1(coalesce(p.n,0)::numeric)');
END $$;
CREATE FUNCTION public.booking_ux_wallet_rules_v1(p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r jsonb; BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor) THEN RAISE EXCEPTION 'BOOKING_UX_FORBIDDEN';END IF;
 r:=public.task10_family_quota_policy_v1();
 RETURN jsonb_build_object('version',r->>'version','bands',(
  SELECT jsonb_agg(jsonb_build_object('min',n*(r->>'unit')::integer,
   'max',CASE WHEN n<(r->>'cap')::integer THEN (n+1)*(r->>'unit')::integer-1 END,
   'quota',public.task10_family_quota_v1(n*(r->>'unit')::integer)) ORDER BY n)
  FROM generate_series(0,(r->>'cap')::integer) n));
END $$;

CREATE INDEX booking_wallet_history_stored ON public.lesson_wallet_credits(user_id,stored_at DESC,id);
CREATE INDEX booking_wallet_history_redeemed ON public.lesson_wallet_credits(user_id,redeemed_at DESC,id) WHERE redeemed_at IS NOT NULL;
CREATE INDEX booking_wallet_history_expiry ON public.lesson_wallet_credits(user_id,expires_at,id);
CREATE INDEX booking_wallet_history_uses ON public.task10_family_makeup_uses(parent_id,created_at DESC,id);
CREATE INDEX booking_wallet_history_actors ON public.activity_logs(entity_id,action,created_at,id)
 WHERE action IN ('store_lesson_wallet_credit','redeem_lesson_wallet_credit','admin_lesson_assistance','attendance_gap_return_entitlement','package_unit_redeemed');

CREATE FUNCTION public.booking_ux_wallet_history_v1(p_actor uuid,p_month date,p_course text,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
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
  UNION SELECT c.id FROM monthly_uses u JOIN lesson_wallet_credits c ON c.user_id=p_actor AND
   (c.id=u.credit_id OR c.original_session_id=u.source_session_id OR c.original_session_id=u.source_root_id)
 ), credits AS MATERIALIZED (
  SELECT c.*,ct.name::text AS course FROM candidate_ids ids JOIN lesson_wallet_credits c ON c.id=ids.id
   JOIN course_types ct ON ct.id=c.course_type_id WHERE c.user_id=p_actor AND ct.name::text=p_course
 ), credit_events AS (
  SELECT c.*,u.actor_id AS use_actor,u.destination_session_id,
   coalesce(u.created_at,c.redeemed_at) AS used_at,
   (u.id IS NOT NULL OR c.status='redeemed' OR c.redeemed_session_id IS NOT NULL) AS spent,
   greatest(CASE WHEN c.stored_at>=v_start AND c.stored_at<v_end THEN c.stored_at END,
    CASE WHEN coalesce(u.created_at,c.redeemed_at)>=v_start AND coalesce(u.created_at,c.redeemed_at)<v_end THEN coalesce(u.created_at,c.redeemed_at) END,
    CASE WHEN u.id IS NULL AND c.status<>'redeemed' AND c.redeemed_session_id IS NULL AND c.expires_at>=v_start AND c.expires_at<v_end AND c.expires_at<=v_now THEN c.expires_at END) AS event_at
  FROM credits c LEFT JOIN LATERAL (
   SELECT u.* FROM task10_family_makeup_uses u WHERE u.parent_id=p_actor AND
    (u.credit_id=c.id OR u.source_session_id=c.original_session_id OR u.source_root_id=c.original_session_id)
   ORDER BY (u.credit_id=c.id) DESC,u.created_at,u.id LIMIT 1
  )u ON true
 ), unit_events AS (
  SELECT u.*,b.user_id FROM booking_package_units u JOIN bookings b ON b.id=u.booking_id JOIN course_types ct ON ct.id=b.course_type_id
  WHERE b.user_id=p_actor AND ct.name::text=p_course AND
   (u.redeemed_at>=v_start AND u.redeemed_at<v_end OR u.status IN ('available','expired') AND u.expires_at>=v_start AND u.expires_at<v_end AND u.expires_at<=v_now)
 ), ordered AS (
  SELECT c.id,'wallet'::text AS kind,c.event_at AS at FROM credit_events c WHERE c.event_at IS NOT NULL
  UNION ALL SELECT u.id,'package',coalesce(u.redeemed_at,u.expires_at) FROM unit_events u
 ), page AS MATERIALIZED (SELECT * FROM ordered ORDER BY at DESC,kind,id LIMIT 21 OFFSET p_offset),
 selected AS (SELECT * FROM page ORDER BY at DESC,kind,id LIMIT 20),
 enriched AS (
  SELECT p.at,p.kind,p.id,jsonb_build_object('id',c.id,'kind','wallet','at',p.at,
   'participants',coalesce(cm.people,jsonb_build_array(c.child_id)),
   'status',CASE WHEN c.spent THEN 'redeemed' WHEN c.expires_at>v_now AND c.status='active' THEN 'stored'
    WHEN c.course='kids_group' AND c.entitlement_policy='same_month' AND v_now<(date_trunc('month',c.original_date)+interval '2 month') AT TIME ZONE 'Asia/Bangkok' THEN 'normal_expired' ELSE 'expired' END,
   'originalDate',c.original_date,'originalStart',c.original_start_time,'originalEnd',c.original_end_time,
   'storedAt',c.stored_at,'usedAt',c.used_at,'expiresAt',c.expires_at,
   'storedBy',CASE WHEN sa.user_id=p_actor THEN 'parent' WHEN sa.action IN ('admin_lesson_assistance','attendance_gap_return_entitlement') OR sap.role::text IN ('admin','super_admin') THEN 'admin' ELSE 'unknown' END,
   'usedBy',CASE WHEN coalesce(c.use_actor,ua.user_id)=p_actor THEN 'parent' WHEN c.use_actor IS NOT NULL OR uap.role::text IN ('admin','super_admin') OR ua.action='admin_lesson_assistance' THEN 'admin' ELSE 'unknown' END,
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
   SELECT a.* FROM activity_logs a WHERE a.action='redeem_lesson_wallet_credit' AND a.entity_id=c.id
   ORDER BY a.created_at,a.id LIMIT 1
  )ua ON true LEFT JOIN profiles uap ON uap.id=ua.user_id
  LEFT JOIN LATERAL (
   SELECT jsonb_agg(jsonb_build_object('date',s.date,'start',s.start_time,'end',s.end_time,'childId',s.child_id,'branchName',br.name,'cancelled',s.cancelled_at IS NOT NULL OR s.status::text='cancelled') ORDER BY s.child_id NULLS FIRST,s.id)items
   FROM booking_sessions s JOIN bookings b ON b.id=s.booking_id JOIN branches br ON br.id=s.branch_id
   WHERE b.user_id=p_actor AND (s.id=coalesce(c.destination_session_id,c.redeemed_session_id) OR
    EXISTS(SELECT 1 FROM lesson_wallet_credit_members cm WHERE cm.credit_id=c.id AND cm.redeemed_session_id=s.id))
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
END $$;

REVOKE ALL ON FUNCTION public.task10_family_quota_policy_v1(),public.task10_family_quota_v1(numeric),public.booking_ux_wallet_rules_v1(uuid),public.booking_ux_wallet_history_v1(uuid,date,text,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.booking_ux_wallet_rules_v1(uuid),public.booking_ux_wallet_history_v1(uuid,date,text,integer) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
