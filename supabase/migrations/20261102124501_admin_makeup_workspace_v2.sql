BEGIN;
SET LOCAL lock_timeout='5s';
SELECT pg_advisory_xact_lock(10,1);
CREATE TABLE public.admin_makeup_workspace_control(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),enabled boolean NOT NULL DEFAULT false);
INSERT INTO public.admin_makeup_workspace_control DEFAULT VALUES;
CREATE TABLE public.admin_makeup_grants_v2(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL REFERENCES public.profiles(id),request_id uuid NOT NULL,
 reference_session_id uuid NOT NULL REFERENCES public.booking_sessions(id),reference_month date NOT NULL,
 booking_id uuid NOT NULL REFERENCES public.bookings(id),reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 1000),
 participants jsonb NOT NULL, fingerprint text NOT NULL,result jsonb,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 revoked_at timestamptz,UNIQUE(actor_id,request_id));
ALTER TABLE public.booking_sessions ADD COLUMN admin_makeup_grant_id uuid REFERENCES public.admin_makeup_grants_v2(id);
CREATE INDEX admin_makeup_grant_sessions_idx ON public.booking_sessions(admin_makeup_grant_id) WHERE admin_makeup_grant_id IS NOT NULL;
CREATE INDEX admin_makeup_grant_reference_idx ON public.admin_makeup_grants_v2(booking_id,reference_month,created_at);
-- Page hydration reads current original sources and actual makeup destinations.
CREATE INDEX admin_makeup_original_lookup_v2 ON public.booking_sessions(booking_id,date,child_id) WHERE NOT is_makeup AND cancelled_at IS NULL;
CREATE INDEX admin_makeup_destination_lookup_v2 ON public.booking_sessions(booking_id,rescheduled_from_id) WHERE is_makeup;
ALTER TABLE public.admin_makeup_workspace_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_makeup_grants_v2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_makeup_workspace_control,public.admin_makeup_grants_v2 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.admin_makeup_workspace_control,public.admin_makeup_grants_v2 TO service_role;

-- Counts of ordinary rights must not include independently authorized additions.
DO $$ DECLARE d text; BEGIN
 d:=pg_get_functiondef('public.task10_family_makeup_facts_v1(uuid,date)'::regprocedure);
 IF position('AND makeup.is_makeup' IN d)=0 THEN RAISE EXCEPTION 'ADMIN_MAKEUP_FACTS_BASELINE_DRIFT';END IF;
 EXECUTE replace(d,'AND makeup.is_makeup','AND makeup.is_makeup AND makeup.admin_makeup_grant_id IS NULL');
 d:=pg_get_functiondef('public.admin_makeup_browse_v1(uuid,date,text,text,uuid,text,integer)'::regprocedure);
 IF position('WHERE is_makeup GROUP BY user_id' IN d)=0 THEN RAISE EXCEPTION 'ADMIN_MAKEUP_BROWSE_BASELINE_DRIFT';END IF;
 EXECUTE replace(d,'WHERE is_makeup GROUP BY user_id','WHERE is_makeup AND admin_makeup_grant_id IS NULL GROUP BY user_id');
END $$;

CREATE FUNCTION public.admin_makeup_learner_name_v2(p_full text,p_nick text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE WHEN nullif(btrim(p_full),'') IS NULL THEN coalesce(nullif(btrim(p_nick),''),'ไม่ระบุชื่อผู้เรียน') WHEN nullif(btrim(p_nick),'') IS NULL OR lower(btrim(p_nick))=lower(btrim(p_full)) THEN btrim(p_full) ELSE btrim(p_nick)||' - '||btrim(p_full) END
$$;
CREATE FUNCTION public.admin_makeup_context_v2(p_actor uuid,p_reference uuid,p_month date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
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
   AND w.original_date>=p_month AND w.original_date<(p_month+interval '1 month')::date
   AND w.status='active' AND w.redeemed_session_id IS NULL AND w.expires_at>clock_timestamp() AND b.status::text='verified'
   AND (s.course<>'private' OR (SELECT array_agg(coalesce(x.child_id::text,'self') ORDER BY coalesce(x.child_id::text,'self')) FROM unnest(public.lesson_source_family_unit_sessions_v1(w.original_session_id)) am2_unit_id JOIN public.booking_sessions x ON x.id=am2_unit_id)=
    (SELECT array_agg(coalesce(x.child_id::text,'self') ORDER BY coalesce(x.child_id::text,'self')) FROM public.booking_sessions x WHERE x.id=ANY(ids))) ORDER BY w.id LOOP
   sources:=sources||jsonb_build_array(jsonb_build_object('sourceSessionId',r.original_session_id,'sourceDate',r.original_date,'kind','wallet','creditId',r.id,'expiresAt',r.expires_at,'durationMinutes',extract(epoch FROM r.original_end_time-r.original_start_time)/60));
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
END $$;

-- Browse can reuse the authoritative family state just computed by its catalog.
-- Opening a card and every writer still call the uncached three-argument entry.
DO $contextstate$ DECLARE d text;BEGIN
 d:=pg_get_functiondef('public.admin_makeup_context_v2(uuid,uuid,date)'::regprocedure);
 d:=replace(d,'public.admin_makeup_context_v2(','public.admin_makeup_context_state_v2(');
 d:=replace(d,' PERFORM public.task10_require_actor_v1(p_actor,''makeup'');','');
 d:=replace(d,'p_month date)','p_month date, p_state jsonb)');
 IF position('v:=public.task10_family_makeup_state_v1(p_actor,s.user_id,p_month);' IN d)=0 THEN RAISE EXCEPTION 'ADMIN_MAKEUP_CONTEXT_STATE_DRIFT';END IF;
 d:=replace(d,'v:=public.task10_family_makeup_state_v1(p_actor,s.user_id,p_month);','v:=coalesce(p_state,public.task10_family_makeup_state_v1(p_actor,s.user_id,p_month));');
 d:=replace(d,'  SELECT coalesce(jsonb_agg(m||', '  IF p_state IS NOT NULL THEN members:=p_state->''children'';ELSE SELECT coalesce(jsonb_agg(m||');
 d:=replace(d,'AND ch.parent_id=s.user_id;','AND ch.parent_id=s.user_id;END IF;');
 EXECUTE d;
END $contextstate$;

-- Keep the existing set-based Kids source/quota catalog for filtered totals.
-- Only the new catalog admits verified source-empty families and additions.
DO $catalog$ DECLARE d text;BEGIN
 d:=pg_get_functiondef('public.admin_makeup_browse_v1(uuid,date,text,text,uuid,text,integer)'::regprocedure);
 IF position('(source_count>0 OR used>0)' IN d)=0 OR position('SELECT f.*,coalesce(p.n,0)' IN d)=0 THEN RAISE EXCEPTION 'ADMIN_MAKEUP_CATALOG_BASELINE_DRIFT';END IF;
 d:=replace(d,'public.admin_makeup_browse_v1(','public.admin_makeup_catalog_v2(');
 d:=replace(d,'WHERE c.name::text=''kids_group'' AND s.date>=p_month AND s.date<v_next','WHERE c.name::text=''kids_group'' AND b.status::text=''verified'' AND NOT s.is_makeup AND s.date>=p_month AND s.date<v_next');
 d:=replace(d,'SELECT f.*,coalesce(p.n,0)','SELECT f.*,coalesce(ag.n,0) AS addition_count,coalesce(p.n,0)');
 d:=replace(d,'LEFT JOIN used u ON u.user_id=f.user_id','LEFT JOIN used u ON u.user_id=f.user_id LEFT JOIN (SELECT ab.user_id,count(*) n FROM public.admin_makeup_grants_v2 g JOIN public.bookings ab ON ab.id=g.booking_id JOIN public.course_types ac ON ac.id=ab.course_type_id WHERE ac.name::text=''kids_group'' AND g.reference_month=p_month GROUP BY ab.user_id) ag ON ag.user_id=f.user_id');
 d:=replace(d,'(source_count>0 OR used>0)','true');
 d:=replace(d,'p_status=''actionable'' AND v_policy.makeup_enabled AND v_now<v_end AND (remaining>0 OR approved_sources>0) AND source_count>0','p_status=''actionable'' AND v_policy.makeup_enabled AND ((v_now<v_end AND (remaining>0 OR approved_sources>0) AND source_count>0) OR (source_count=0 OR v_now>=v_end) AND (SELECT enabled FROM public.admin_makeup_workspace_control WHERE singleton))');
 d:=replace(d,'p_status=''makeup'' AND used>0','p_status=''makeup'' AND (used>0 OR addition_count>0)');
 EXECUTE d;
END $catalog$;

CREATE FUNCTION public.admin_makeup_workspace_v2(p_actor uuid,p_month date,p_course text,p_search text DEFAULT '',p_branch uuid DEFAULT NULL,p_status text DEFAULT 'all',p_page integer DEFAULT 1) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;catalog jsonb;all_page boolean;
BEGIN
 PERFORM public.task10_require_actor_v1(p_actor,'makeup');
 IF p_course NOT IN ('kids_group','adult_group','private') OR p_month IS NULL OR p_month<>date_trunc('month',p_month)::date OR p_page NOT BETWEEN 1 AND 10000 OR length(p_search)>200 OR p_status NOT IN ('all','actionable','makeup','expired') THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST';END IF;
 all_page:=p_status='all' OR p_course<>'kids_group' AND p_status='actionable' AND (SELECT enabled FROM public.admin_makeup_workspace_control WHERE singleton) AND EXISTS(SELECT 1 FROM public.task10_policy_activation WHERE singleton AND makeup_enabled);
 IF p_status='expired' AND clock_timestamp()<(p_month+interval '2 month') AT TIME ZONE 'Asia/Bangkok' THEN RETURN jsonb_build_object('cards','[]'::jsonb,'total',0,'page',p_page,'pageSize',10);END IF;
 IF p_course='kids_group' THEN
  catalog:=public.admin_makeup_catalog_v2(p_actor,p_month,p_course,p_search,p_branch,p_status,p_page);
  -- The catalog already computed authoritative source/quota facts in one set.
  -- Hydrate references, names and destinations for just that page in one query.
  WITH people AS MATERIALIZED (SELECT item,item->'state' st,(item->'state'->>'parentId')::uuid parent FROM jsonb_array_elements(catalog->'cards')item),
  refs AS MATERIALIZED (SELECT p.*,r.* FROM people p LEFT JOIN LATERAL (
   SELECT x.id,x.booking_id,x.branch_id,x.child_id,x.start_time,x.end_time,b.course_type_id,pr.full_name parent_name FROM public.booking_sessions x JOIN public.bookings b ON b.id=x.booking_id JOIN public.course_types c ON c.id=b.course_type_id JOIN public.profiles pr ON pr.id=b.user_id
   WHERE b.user_id=p.parent AND b.status::text='verified' AND c.name::text='kids_group' AND NOT x.is_makeup AND x.date>=p_month AND x.date<(p_month+interval '1 month')::date ORDER BY x.id LIMIT 1
  )r ON true),
  origins AS MATERIALIZED (SELECT x.id FROM public.booking_sessions x JOIN public.bookings b ON b.id=x.booking_id WHERE b.user_id IN (SELECT parent FROM people) AND x.date>=p_month AND x.date<(p_month+interval '1 month')::date),
  destinations AS MATERIALIZED (
   SELECT b.user_id,jsonb_agg(jsonb_build_object('id',x.id,'date',x.date,'startTime',x.start_time,'endTime',x.end_time,'branchName',br.name,'additional',x.admin_makeup_grant_id IS NOT NULL,'grantId',x.admin_makeup_grant_id,'cancelled',x.cancelled_at IS NOT NULL,'childId',x.child_id,'childName',public.admin_makeup_learner_name_v2(CASE WHEN x.child_id IS NULL THEN pr.full_name ELSE ch.full_name END,ch.nickname)) ORDER BY x.date,x.id) value
   FROM public.booking_sessions x JOIN public.bookings b ON b.id=x.booking_id JOIN public.course_types c ON c.id=b.course_type_id JOIN public.branches br ON br.id=x.branch_id JOIN public.profiles pr ON pr.id=b.user_id LEFT JOIN public.children ch ON ch.id=x.child_id LEFT JOIN public.admin_makeup_grants_v2 g ON g.id=x.admin_makeup_grant_id
   WHERE b.user_id IN (SELECT parent FROM people) AND c.name::text='kids_group' AND x.is_makeup AND (g.reference_month=p_month OR x.rescheduled_from_id IN (SELECT id FROM origins) OR EXISTS(SELECT 1 FROM public.task10_family_makeup_uses u WHERE u.destination_session_id=x.id AND u.parent_id=b.user_id AND u.source_month=p_month)) GROUP BY b.user_id
  ), config AS (SELECT public.task10_clock_v1() now_at,(SELECT enabled FROM public.admin_makeup_workspace_control WHERE singleton) enabled)
  SELECT jsonb_build_object('cards',coalesce(jsonb_agg(jsonb_build_object(
   'reference',r.id,'bookingId',r.booking_id,'parentId',r.parent,'course','kids_group','month',to_char(p_month,'YYYY-MM'),'durationMinutes',extract(epoch FROM r.end_time-r.start_time)/60,'parentName',r.parent_name,'branchIds',ARRAY[r.branch_id],
   'learners',coalesce((SELECT jsonb_agg(m ORDER BY m->>'id') FROM jsonb_array_elements(r.st->'children')m WHERE ((r.st->>'expiresAt')::timestamptz>cfg.now_at AND jsonb_array_length(r.st->'sources')>0) OR EXISTS(SELECT 1 FROM public.booking_sessions x JOIN public.bookings b ON b.id=x.booking_id WHERE b.user_id=r.parent AND b.course_type_id=r.course_type_id AND b.status::text='verified' AND NOT x.is_makeup AND x.child_id=(m->>'id')::uuid)),'[]'),
   'sources',CASE WHEN (r.st->>'expiresAt')::timestamptz>cfg.now_at THEN r.st->'sources' ELSE '[]'::jsonb END,'family',r.st,'destinations',coalesce(d.value,'[]'),
   'additionalAvailable',((r.st->>'expiresAt')::timestamptz<=cfg.now_at OR jsonb_array_length(r.st->'sources')=0) AND cfg.enabled AND (r.st->>'active')::boolean
  ) ORDER BY r.parent_name,r.parent),'[]'),'total',catalog->'total','page',p_page,'pageSize',10,'invalid',coalesce(bool_or(r.id IS NULL OR r.child_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.children ch WHERE ch.id=r.child_id AND ch.parent_id=r.parent) OR NOT(r.st ? 'sourceMonth') OR r.st->'sources' IS NULL OR r.st->'children' IS NULL),false)) INTO result FROM refs r LEFT JOIN destinations d ON d.user_id=r.parent CROSS JOIN config cfg;
  IF (result->>'invalid')::boolean THEN RAISE EXCEPTION 'TASK10_SOURCE_CONFLICT';END IF;
  RETURN result-'invalid';
 END IF;
 WITH scope AS MATERIALIZED (
 SELECT x.id,x.child_id,b.user_id,p.full_name,coalesce(ch.nickname,ch.full_name,p.full_name) learner_name,
 CASE WHEN p_course='kids_group' THEN b.user_id::text WHEN p_course='private' THEN b.id::text||':'||x.date||':'||x.start_time||':'||x.end_time||':'||x.branch_id||':'||coalesce(x.schedule_slot_id::text,'') ELSE b.user_id::text||':'||coalesce(x.child_id::text,'self') END identity
 FROM public.booking_sessions x JOIN public.bookings b ON b.id=x.booking_id JOIN public.course_types c ON c.id=b.course_type_id JOIN public.branches br ON br.id=x.branch_id
 JOIN public.profiles p ON p.id=b.user_id LEFT JOIN public.children ch ON ch.id=x.child_id AND ch.parent_id=b.user_id
 WHERE b.status::text='verified' AND c.name::text=p_course AND NOT x.is_makeup AND x.admin_makeup_grant_id IS NULL
 AND x.date>=p_month AND x.date<(p_month+interval '1 month')::date AND (p_branch IS NULL OR x.branch_id=p_branch)
 AND (p_search='' OR concat_ws(' ',p.full_name,ch.full_name,ch.nickname,br.name) ILIKE '%'||p_search||'%')
 ), units AS MATERIALIZED (SELECT DISTINCT ON(identity) identity,id,user_id,learner_name FROM scope ORDER BY identity,id),
 identities AS MATERIALIZED (SELECT CASE WHEN p_course='private' THEN u.user_id::text||':'||(SELECT string_agg(coalesce(z.child_id::text,'self'),',' ORDER BY coalesce(z.child_id::text,'self')) FROM unnest(public.lesson_source_family_unit_sessions_v1(u.id)) am2_unit_id JOIN public.booking_sessions z ON z.id=am2_unit_id) ELSE u.identity END identity,id,learner_name FROM units u),
 refs AS MATERIALIZED (SELECT DISTINCT ON(identity) identity,id,learner_name FROM identities ORDER BY identity,id),
 preselected AS MATERIALIZED (SELECT r.* FROM refs r WHERE p_status<>'makeup' OR EXISTS(SELECT 1 FROM public.booking_sessions d JOIN public.bookings db ON db.id=d.booking_id LEFT JOIN public.admin_makeup_grants_v2 g ON g.id=d.admin_makeup_grant_id LEFT JOIN public.booking_sessions origin ON origin.id=d.rescheduled_from_id WHERE db.user_id=(SELECT b.user_id FROM public.booking_sessions x JOIN public.bookings b ON b.id=x.booking_id WHERE x.id=r.id) AND db.course_type_id=(SELECT b.course_type_id FROM public.booking_sessions x JOIN public.bookings b ON b.id=x.booking_id WHERE x.id=r.id) AND d.is_makeup AND (g.reference_month=p_month OR origin.date>=p_month AND origin.date<(p_month+interval '1 month')::date))),
 paged AS MATERIALIZED (SELECT * FROM preselected ORDER BY learner_name,identity LIMIT CASE WHEN all_page THEN 10 END OFFSET CASE WHEN all_page THEN (p_page-1)*10 ELSE 0 END),
 cards AS MATERIALIZED (SELECT identity,learner_name,public.admin_makeup_context_state_v2(p_actor,id,p_month,NULL) card FROM paged),
 visible AS MATERIALIZED (SELECT * FROM cards WHERE all_page
  OR p_status='makeup' AND jsonb_array_length(card->'destinations')>0
  OR p_status='expired' AND jsonb_array_length(card->'sources')=0 AND (card->'family'->>'reason'='expired' OR clock_timestamp()>=(p_month+interval '2 month') AT TIME ZONE 'Asia/Bangkok')
  OR p_status='actionable' AND ((card->>'additionalAvailable')::boolean OR coalesce((card->'family'->>'eligible')::boolean,false) OR p_course<>'kids_group' AND jsonb_array_length(card->'sources')>0)),
 final_page AS (SELECT * FROM visible ORDER BY learner_name,identity LIMIT 10 OFFSET CASE WHEN all_page THEN 0 ELSE (p_page-1)*10 END)
 SELECT jsonb_build_object('cards',coalesce((SELECT jsonb_agg(card ORDER BY learner_name,identity) FROM final_page),'[]'),'total',CASE WHEN all_page THEN (SELECT count(*) FROM refs) ELSE (SELECT count(*) FROM visible) END,'page',p_page,'pageSize',10) INTO result;
 RETURN result;
END $$;

CREATE FUNCTION public.admin_makeup_busy_v2(p_actor uuid,p_parent uuid,p_children uuid[],p_month date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM public.task10_require_actor_v1(p_actor,'makeup');
 IF p_parent IS NULL OR p_children IS NULL OR p_month IS NULL OR p_month<>date_trunc('month',p_month)::date OR cardinality(p_children) NOT BETWEEN 1 AND 20
 OR EXISTS(SELECT 1 FROM unnest(p_children) x(id) WHERE x.id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.children ch WHERE ch.id=x.id AND ch.parent_id=p_parent)) THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('date',x.date,'start',x.start_time,'end',x.end_time,'childId',x.child_id)) FROM public.booking_sessions x JOIN public.bookings b ON b.id=x.booking_id
 WHERE b.user_id=p_parent AND b.status::text<>'cancelled' AND x.date>=p_month AND x.date<(p_month+interval '1 month')::date
 AND EXISTS(SELECT 1 FROM unnest(p_children) id WHERE id IS NOT DISTINCT FROM x.child_id)
 AND x.status::text NOT IN ('rescheduled','walleted','cancelled') AND x.cancelled_at IS NULL),'[]');
END $$;

-- Legacy absent Makeup retains its existing, stricter overlap predicate.
-- Availability must explain those historical conflicts rather than offer them.
DO $legacybusy$ DECLARE d text;BEGIN
 d:=pg_get_functiondef('public.admin_makeup_busy_v2(uuid,uuid,uuid[],date)'::regprocedure);
 d:=replace(d,'public.admin_makeup_busy_v2(','public.admin_makeup_busy_legacy_v2(');
 d:=replace(d,'b.status::text<>''cancelled''','true');
 d:=replace(d,'''rescheduled'',''walleted'',''cancelled''','''rescheduled'',''walleted''');
 d:=replace(d,'AND x.cancelled_at IS NULL','');
 d:=replace(d,'''childId'',x.child_id','''childId'',x.child_id,''cancelled'',x.cancelled_at IS NOT NULL OR b.status::text=''cancelled''');
 EXECUTE d;
END $legacybusy$;

CREATE FUNCTION public.admin_makeup_grant_v2(p_actor uuid,p_reference uuid,p_month date,p_child uuid,p_template uuid,p_date date,p_request uuid,p_reason text,p_target jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s record;t record;v jsonb;g public.admin_makeup_grants_v2%ROWTYPE;fp text;member jsonb;children uuid[];dest uuid;slot uuid;first_id uuid;ids uuid[]:='{}';
BEGIN
 PERFORM public.task10_require_actor_v1(p_actor,'makeup');
 IF p_request IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST';END IF;
 fp:=md5((jsonb_build_array(p_reference,p_month,p_child,p_template,p_date,p_reason)||CASE WHEN p_target IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('branchId',(p_target->>'branchId')::uuid,'startTime',(p_target->>'startTime')::time,'endTime',(p_target->>'endTime')::time)) END)::text);
 PERFORM pg_advisory_xact_lock(hashtextextended('admin-makeup-grant|'||p_actor||'|'||p_request,0));
 SELECT * INTO g FROM public.admin_makeup_grants_v2 WHERE actor_id=p_actor AND request_id=p_request;
 IF FOUND THEN IF g.fingerprint<>fp THEN RAISE EXCEPTION 'TASK10_IDEMPOTENCY_CONFLICT';END IF;RETURN g.result;END IF;
 IF NOT(SELECT enabled FROM public.admin_makeup_workspace_control WHERE singleton) THEN RAISE EXCEPTION 'TASK10_MAKEUP_PAUSED';END IF;
 SELECT x.*,b.user_id,b.course_type_id,c.name::text course INTO s FROM public.booking_sessions x JOIN public.bookings b ON b.id=x.booking_id JOIN public.course_types c ON c.id=b.course_type_id WHERE x.id=p_reference;
 IF NOT FOUND THEN RAISE EXCEPTION 'TASK10_SOURCE_CONFLICT';END IF;
 PERFORM pg_advisory_xact_lock_shared(10,1);PERFORM pg_advisory_xact_lock_shared(10,2);
 PERFORM 1 FROM public.admin_makeup_workspace_control WHERE singleton AND enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TASK10_MAKEUP_PAUSED';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('lesson-source-attendance-parent-v2|'||s.user_id,0));
 PERFORM public.task10_lock_family_months_v1(s.user_id,ARRAY[p_month,(p_month+interval '1 month')::date,date_trunc('month',p_date)::date]);
 PERFORM pg_advisory_xact_lock(hashtextextended('lesson-source-parent|'||s.user_id,0));
 PERFORM 1 FROM public.bookings WHERE user_id=s.user_id ORDER BY id FOR UPDATE;
 v:=public.admin_makeup_context_v2(p_actor,p_reference,p_month);
 IF jsonb_array_length(v->'sources')<>0 THEN RAISE EXCEPTION 'TASK10_SOURCE_CONFLICT';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.task10_policy_activation WHERE singleton AND makeup_enabled) THEN RAISE EXCEPTION 'TASK10_MAKEUP_PAUSED';END IF;
 IF s.course='kids_group' THEN
  -- A no-source addition requires this actual learner's verified purchase history.
  IF p_child IS NULL OR NOT EXISTS(SELECT 1 FROM public.booking_sessions x JOIN public.bookings b ON b.id=x.booking_id
   WHERE b.user_id=s.user_id AND b.course_type_id=s.course_type_id AND b.status::text='verified' AND NOT x.is_makeup AND x.child_id=p_child) THEN RAISE EXCEPTION 'TASK10_CHILD_NOT_IN_FAMILY';END IF;
  children:=ARRAY[p_child];
 ELSE SELECT array_agg((m->>'childId')::uuid ORDER BY m->>'id') INTO children FROM jsonb_array_elements(v->'learners')m;END IF;
 IF cardinality(children) IS NULL OR cardinality(children) NOT BETWEEN 1 AND 20 OR cardinality(children)<>(SELECT count(DISTINCT coalesce(id::text,'self')) FROM unnest(children)id)
 OR EXISTS(SELECT 1 FROM unnest(children)x(id) WHERE x.id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.children ch WHERE ch.id=x.id AND ch.parent_id=s.user_id)) THEN RAISE EXCEPTION 'LESSON_SOURCE_IDENTITY_CONFLICT';END IF;
 FOR member IN SELECT jsonb_build_object('id',coalesce(id::text,s.user_id::text),'child',id) FROM unnest(children)id ORDER BY coalesce(id::text,s.user_id::text) LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('task10-learner|'||(member->>'id')||'|'||p_date,0));
 END LOOP;
 SELECT * INTO t FROM public.schedule_templates WHERE id=p_template AND is_active AND course_type_id=s.course_type_id FOR SHARE;
 IF NOT FOUND OR p_target IS NOT NULL AND ROW(t.branch_id,t.start_time,t.end_time) IS DISTINCT FROM ROW((p_target->>'branchId')::uuid,(p_target->>'startTime')::time,(p_target->>'endTime')::time) THEN RAISE EXCEPTION 'TASK10_INVALID_TEMPLATE';END IF;
 IF (p_date+t.start_time) AT TIME ZONE 'Asia/Bangkok'<=clock_timestamp() THEN RAISE EXCEPTION 'TASK10_TARGET_STARTED';END IF;
 IF s.course='private' AND t.end_time-t.start_time<>s.end_time-s.start_time THEN RAISE EXCEPTION 'LESSON_SOURCE_PRIVATE_DURATION';END IF;
 IF EXISTS(SELECT 1 FROM public.booking_sessions x JOIN public.bookings b ON b.id=x.booking_id WHERE b.user_id=s.user_id AND b.status::text<>'cancelled' AND x.date=p_date
 AND EXISTS(SELECT 1 FROM unnest(children)id WHERE id IS NOT DISTINCT FROM x.child_id) AND x.start_time<t.end_time AND x.end_time>t.start_time
 AND x.status::text NOT IN ('rescheduled','walleted','cancelled') AND x.cancelled_at IS NULL) THEN RAISE EXCEPTION 'TASK10_LEARNER_OVERLAP';END IF;
 slot:=public.task10_target_slot_v1(s.course_type_id,t.id,t.branch_id,p_date,t.start_time,t.end_time);
 IF (p_date+t.start_time) AT TIME ZONE 'Asia/Bangkok'<=clock_timestamp() THEN RAISE EXCEPTION 'TASK10_TARGET_STARTED';END IF;
 INSERT INTO public.admin_makeup_grants_v2(actor_id,request_id,reference_session_id,reference_month,booking_id,reason,participants,fingerprint)
 VALUES(p_actor,p_request,p_reference,p_month,s.booking_id,btrim(p_reason),to_jsonb(children),fp) RETURNING * INTO g;
 PERFORM set_config('lesson_source.write','authorized',true);PERFORM set_config('task10.source_write','authorized',true);PERFORM set_config('admin_makeup.grant_write','authorized',true);
 FOREACH dest IN ARRAY children LOOP
  INSERT INTO public.booking_sessions(booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup,admin_makeup_grant_id)
  VALUES(s.booking_id,slot,p_date,t.start_time,t.end_time,t.branch_id,dest,'scheduled',true,g.id) RETURNING id INTO first_id;ids:=array_append(ids,first_id);
 END LOOP;
 UPDATE public.admin_makeup_grants_v2 SET result=jsonb_build_object('success',true,'data',jsonb_build_object('id',ids[1]),'sessionIds',ids,'grantId',g.id,'additional',true) WHERE id=g.id RETURNING * INTO g;
 INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details) VALUES(p_actor,'admin_makeup_additional','booking_sessions',ids[1],jsonb_build_object('grantId',g.id,'reason',btrim(p_reason),'requestId',p_request,'sessionIds',ids));
 INSERT INTO public.notifications(user_id,title,message,type,link_url) VALUES(s.user_id,'ได้รับวันชดเชยแล้ว','Admin จัดวันชดเชยวันที่ '||p_date||' เรียบร้อยแล้ว','schedule','/dashboard/schedule');
 PERFORM public.progressive_refresh_slot_capacity_v1(ARRAY[slot]);
 PERFORM set_config('lesson_source.write','',true);PERFORM set_config('task10.source_write','',true);PERFORM set_config('admin_makeup.grant_write','',true);
 RETURN g.result;
END $$;

-- User attendance remains usable, but an addition cannot be transformed into a purchased credit.
CREATE FUNCTION public.admin_makeup_grant_guard_v2() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.admin_makeup_grant_id IS NOT NULL OR TG_OP='UPDATE' AND OLD.admin_makeup_grant_id IS NOT NULL THEN
  IF current_user IN ('postgres','supabase_admin') AND current_setting('admin_makeup.grant_write',true)='authorized' THEN RETURN NEW;END IF;
  IF TG_OP='INSERT' OR ROW(NEW.booking_id,NEW.child_id,NEW.admin_makeup_grant_id,NEW.rescheduled_from_id,NEW.is_makeup,NEW.date,NEW.start_time,NEW.end_time,NEW.branch_id,NEW.schedule_slot_id,NEW.cancelled_at)
   IS DISTINCT FROM ROW(OLD.booking_id,OLD.child_id,OLD.admin_makeup_grant_id,OLD.rescheduled_from_id,OLD.is_makeup,OLD.date,OLD.start_time,OLD.end_time,OLD.branch_id,OLD.schedule_slot_id,OLD.cancelled_at)
   OR NEW.status::text IN ('walleted','rescheduled','cancelled') THEN RAISE EXCEPTION 'ADMIN_MAKEUP_ADDITION_PROTECTED';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER admin_makeup_addition_guard BEFORE INSERT OR UPDATE ON public.booking_sessions FOR EACH ROW EXECUTE FUNCTION public.admin_makeup_grant_guard_v2();
CREATE TABLE public.admin_makeup_actions_v2(actor_id uuid NOT NULL REFERENCES public.profiles(id),request_id uuid NOT NULL,fingerprint text NOT NULL,result jsonb NOT NULL,PRIMARY KEY(actor_id,request_id));
CREATE TABLE public.admin_makeup_requests_v2(actor_id uuid NOT NULL REFERENCES public.profiles(id),request_id uuid NOT NULL,payload jsonb NOT NULL,fingerprint text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(actor_id,request_id));
ALTER TABLE public.admin_makeup_requests_v2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_makeup_requests_v2 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.admin_makeup_requests_v2 TO service_role;
ALTER TABLE public.admin_makeup_actions_v2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_makeup_actions_v2 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.admin_makeup_actions_v2 TO service_role;
CREATE FUNCTION public.admin_makeup_use_v2(p_actor uuid,p_reference uuid,p_month date,p_source uuid,p_request uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
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
 r:=public.lesson_source_transition_v1(CASE WHEN src->>'kind'='wallet' THEN (v->>'parentId')::uuid ELSE p_actor END,
  CASE WHEN src->>'kind'='wallet' THEN 'redeem' ELSE 'makeup' END,
  CASE WHEN src->>'kind'='wallet' THEN (src->>'creditId')::uuid ELSE p_source END,p_payload||jsonb_build_object('requestId',p_request));
 r:=jsonb_build_object('success',true,'result',r);
 INSERT INTO public.admin_makeup_actions_v2 VALUES(p_actor,p_request,fp,r);
 INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details) VALUES(p_actor,'admin_makeup_source_used','booking_sessions',p_source,jsonb_build_object('requestId',p_request,'reason',p_payload->>'reason','result',r));
 RETURN r;
END $$;
-- Extend the existing paginated history at its event CTE, retaining the same
-- ordering/counts and identifying the historical lesson as reference only.
DO $history$ DECLARE d text;marker text:=' ), filtered AS MATERIALIZED';addition text;BEGIN
 d:=pg_get_functiondef('public.admin_makeup_history_v1(uuid,date,uuid,text,uuid,text,integer)'::regprocedure);
 IF position(marker IN d)=0 THEN RAISE EXCEPTION 'ADMIN_MAKEUP_HISTORY_BASELINE_DRIFT';END IF;
 addition:=$union$
  UNION ALL
  SELECT 'additional:'||g.id::text,'use','ชดเชยเพิ่มเติมโดย Admin',g.created_at,'จัดเพิ่มเติมเมื่อ',g.reference_session_id,(g.result->'data'->>'id')::uuid,g.actor_id,g.reason,
   CASE WHEN g.revoked_at IS NULL THEN 'ชดเชยเพิ่มเติม · ไม่หักโควตาปกติ' ELSE 'ยกเลิกชดเชยเพิ่มเติมแล้ว' END,NULL::timestamptz,NULL::uuid
  FROM public.admin_makeup_grants_v2 g JOIN public.bookings gb ON gb.id=g.booking_id JOIN public.course_types gc ON gc.id=gb.course_type_id
  WHERE gb.user_id=p_user AND gc.name::text=p_course AND g.reference_month=p_month
   AND (p_course='kids_group' AND p_child IS NULL OR EXISTS(SELECT 1 FROM public.booking_sessions gd WHERE gd.admin_makeup_grant_id=g.id AND gd.child_id IS NOT DISTINCT FROM p_child))
 $union$;
 d:=replace(d,marker,addition||marker);
 d:=replace(d,'''source'',jsonb_build_object(','''source'',jsonb_build_object(''referenceOnly'',e.id LIKE ''additional:%'',');
 d:=replace(d,'a.action=''redeem_lesson_wallet_credit'' AND a.entity_id=w.id','(a.action=''redeem_lesson_wallet_credit'' AND a.entity_id=w.id OR a.action=''admin_makeup_source_used'' AND a.entity_id=w.original_session_id)');
 d:=replace(d,'CASE WHEN a.action=''admin_lesson_assistance'' THEN a.details->>''reason'' END,''ไม่หักโควตาชดเชย''','CASE WHEN a.action IN (''admin_lesson_assistance'',''admin_makeup_source_used'') THEN a.details->>''reason'' END,''ไม่หักโควตาชดเชย''');
 d:=replace(d,'ORDER BY a.created_at,a.id LIMIT 1','ORDER BY (a.action=''admin_makeup_source_used'') DESC,a.created_at,a.id LIMIT 1');
 EXECUTE d;
END $history$;

-- The common Private card is one original roster. Read every member's legacy
-- absence events together with Wallet/grant events, with one global page/count.
-- Historical callers of history_v1 retain their original learner scope.
DO $workspacehistory$ DECLARE d text;BEGIN
 d:=pg_get_functiondef('public.admin_makeup_history_v1(uuid,date,uuid,text,uuid,text,integer)'::regprocedure);
 d:=replace(d,'public.admin_makeup_history_v1(','public.admin_makeup_workspace_history_v2(');
 d:=replace(d,'p_page integer DEFAULT 1)','p_page integer DEFAULT 1, p_reference uuid DEFAULT NULL::uuid)');
 d:=replace(d,'DECLARE v_result jsonb;','DECLARE v_result jsonb;v_context jsonb;v_roster text[];');
 d:=replace(d,' WITH scope_bookings AS MATERIALIZED (',$scope$
 v_context:=public.admin_makeup_context_v2(p_actor,p_reference,p_month);
 IF p_course<>'private' OR v_context->>'parentId'<>p_user::text OR v_context->>'course'<>'private' THEN RAISE EXCEPTION 'TASK10_SOURCE_CONFLICT';END IF;
 SELECT array_agg(coalesce(m->>'childId','self') ORDER BY coalesce(m->>'childId','self')) INTO v_roster FROM jsonb_array_elements(v_context->'learners')m;
 WITH possible AS MATERIALIZED (
  SELECT DISTINCT ON(x.booking_id,x.date,x.start_time,x.end_time,x.branch_id,x.schedule_slot_id) x.id
  FROM public.booking_sessions x JOIN public.bookings b ON b.id=x.booking_id JOIN public.course_types c ON c.id=b.course_type_id
  WHERE b.user_id=p_user AND b.status::text='verified' AND c.name::text='private' AND NOT x.is_makeup AND x.date>=p_month AND x.date<(p_month+interval '1 month')::date
 ), unit_ids AS MATERIALIZED (SELECT public.lesson_source_family_unit_sessions_v1(id) ids FROM possible),
 private_scope AS MATERIALIZED (
  SELECT unnest(ids) id FROM unit_ids WHERE (SELECT array_agg(coalesce(m.child_id::text,'self') ORDER BY coalesce(m.child_id::text,'self')) FROM public.booking_sessions m WHERE m.id=ANY(ids))=v_roster
 ), scope_bookings AS MATERIALIZED (
$scope$);
 IF position('private_scope AS MATERIALIZED' IN d)=0 THEN RAISE EXCEPTION 'ADMIN_MAKEUP_HISTORY_SCOPE_DRIFT';END IF;
 d:=replace(d,'(p_course=''kids_group'' AND p_child IS NULL AND s.child_id IS NOT NULL OR s.child_id IS NOT DISTINCT FROM p_child)','s.id IN (SELECT id FROM private_scope)');
 d:=replace(d,'(p_course=''kids_group'' AND p_child IS NULL AND child_id IS NOT NULL OR child_id IS NOT DISTINCT FROM p_child)','id IN (SELECT id FROM private_scope)');
 d:=replace(d,'(p_course=''kids_group'' AND p_child IS NULL OR EXISTS(SELECT 1 FROM public.booking_sessions gd WHERE gd.admin_makeup_grant_id=g.id AND gd.child_id IS NOT DISTINCT FROM p_child))','(SELECT array_agg(coalesce(m#>>''{}'',''self'') ORDER BY coalesce(m#>>''{}'',''self'')) FROM jsonb_array_elements(g.participants)m)=v_roster');
 EXECUTE d;
END $workspacehistory$;
CREATE FUNCTION public.admin_makeup_revoke_v2(p_actor uuid,p_grant uuid,p_request uuid,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE g public.admin_makeup_grants_v2%ROWTYPE;r jsonb;fp text;prior record;v_parent uuid;v_slots uuid[];
BEGIN
 PERFORM public.task10_require_actor_v1(p_actor,'makeup');
 IF p_request IS NULL OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST';END IF;
 fp:=md5(jsonb_build_array(p_grant,p_reason)::text);
 PERFORM pg_advisory_xact_lock(hashtextextended('admin-makeup-revoke|'||p_actor||'|'||p_request,0));
 SELECT * INTO prior FROM public.admin_makeup_actions_v2 WHERE actor_id=p_actor AND request_id=p_request;
 IF FOUND THEN IF prior.fingerprint<>fp THEN RAISE EXCEPTION 'TASK10_IDEMPOTENCY_CONFLICT';END IF;RETURN prior.result;END IF;
 SELECT b.user_id INTO v_parent FROM public.admin_makeup_grants_v2 ag JOIN public.bookings b ON b.id=ag.booking_id WHERE ag.id=p_grant;
 IF NOT FOUND THEN RAISE EXCEPTION 'TASK10_SOURCE_CONFLICT';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('lesson-source-attendance-parent-v2|'||v_parent,0));
 SELECT * INTO g FROM public.admin_makeup_grants_v2 WHERE id=p_grant FOR UPDATE;
 IF NOT FOUND OR g.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'TASK10_SOURCE_CONFLICT';END IF;
 PERFORM 1 FROM public.booking_sessions WHERE admin_makeup_grant_id=g.id ORDER BY id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.booking_sessions x WHERE x.admin_makeup_grant_id=g.id AND ((x.date+x.start_time) AT TIME ZONE 'Asia/Bangkok'<=clock_timestamp() OR EXISTS(SELECT 1 FROM public.attendance a WHERE a.booking_session_id=x.id))) THEN RAISE EXCEPTION 'TASK10_TARGET_STARTED';END IF;
 PERFORM set_config('admin_makeup.grant_write','authorized',true);PERFORM set_config('lesson_source.write','authorized',true);PERFORM set_config('task10.source_write','authorized',true);
 UPDATE public.booking_sessions SET cancelled_at=clock_timestamp() WHERE admin_makeup_grant_id=g.id;
 UPDATE public.admin_makeup_grants_v2 SET revoked_at=clock_timestamp() WHERE id=g.id;
 SELECT array_agg(DISTINCT schedule_slot_id) INTO v_slots FROM public.booking_sessions WHERE admin_makeup_grant_id=g.id;
 PERFORM public.progressive_refresh_slot_capacity_v1(v_slots);
 r:=jsonb_build_object('success',true,'grantId',g.id,'revoked',true);
 INSERT INTO public.admin_makeup_actions_v2 VALUES(p_actor,p_request,fp,r);
 INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details) VALUES(p_actor,'admin_makeup_addition_revoked','booking_sessions',(g.result->'data'->>'id')::uuid,jsonb_build_object('grantId',g.id,'reason',p_reason,'requestId',p_request));
 PERFORM set_config('admin_makeup.grant_write','',true);PERFORM set_config('lesson_source.write','',true);PERFORM set_config('task10.source_write','',true);
 RETURN r;
END $$;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT proname,oid::regprocedure sig FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('admin_makeup_context_v2','admin_makeup_context_state_v2','admin_makeup_workspace_history_v2','admin_makeup_workspace_v2','admin_makeup_busy_v2','admin_makeup_busy_legacy_v2','admin_makeup_grant_v2','admin_makeup_use_v2','admin_makeup_revoke_v2','admin_makeup_catalog_v2') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',r.sig);IF r.proname<>'admin_makeup_context_state_v2' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',r.sig);END IF;END LOOP;END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
