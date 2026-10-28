BEGIN;
CREATE INDEX booking_ux_recent_verified ON public.bookings(user_id,course_type_id,created_at DESC) WHERE status='verified';
CREATE FUNCTION public.booking_ux_previous_v1(p_actor uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('course',c.name,'branchId',b.branch_id,'quantity',b.total_sessions,'packageId',b.package_snapshot->>'id',
 'participants',coalesce(b.package_participants,(SELECT jsonb_agg(DISTINCT s.child_id)FROM booking_sessions s WHERE s.booking_id=b.id),'[]'::jsonb))),'[]')
 FROM (SELECT DISTINCT ON(course_type_id)* FROM bookings WHERE user_id=p_actor AND status='verified' ORDER BY course_type_id,created_at DESC,id DESC)b JOIN course_types c ON c.id=b.course_type_id
$$;
CREATE FUNCTION public.booking_ux_pending_summary_v1(p_actor uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('count',count(*),'amount',coalesce(sum(b.total_price),0),'deadline',min(public.task10_booking_deadline_v1(b.id)))
 FROM bookings b WHERE user_id=p_actor AND status::text IN ('pending_payment','paid') AND NOT public.task10_booking_due_v1(b.id)
$$;
CREATE FUNCTION public.booking_ux_update_v1(p_actor uuid,p_request uuid,p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b bookings%ROWTYPE;r jsonb;c text;n integer;s jsonb:=p_input->'sessions';
BEGIN
 IF NOT(SELECT enabled FROM booking_ux_control WHERE singleton) THEN RAISE EXCEPTION 'BOOKING_UX_DISABLED';END IF;
 SELECT * INTO b FROM bookings WHERE id=(p_input->>'bookingId')::uuid AND user_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_UX_FORBIDDEN';END IF;
 IF b.package_snapshot IS NULL THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_REQUEST';END IF;
 IF (p_input->>'courseTypeId')::uuid IS DISTINCT FROM b.course_type_id OR p_input->'participants' IS DISTINCT FROM b.package_participants THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_LEARNER';END IF;
 IF jsonb_typeof(s)IS DISTINCT FROM 'array' OR jsonb_array_length(s)>100 THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_REQUEST';END IF;
 SELECT count(DISTINCT(x->>'date',x->>'startTime',x->>'endTime',x->>'branchId')) INTO n FROM jsonb_array_elements(s)x;
 IF n>b.total_sessions OR (b.total_sessions=1 AND n<>1) THEN RAISE EXCEPTION 'BOOKING_UX_PACKAGE_QUANTITY';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(s)x WHERE ((x->>'date')::date+(x->>'startTime')::time) AT TIME ZONE 'Asia/Bangkok'<=b.checkout_deadline) THEN RAISE EXCEPTION 'BOOKING_UX_START_WITHIN_PAYMENT_WINDOW';END IF;
 SELECT name::text INTO c FROM course_types WHERE id=b.course_type_id;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(s)x WHERE NOT b.package_participants@>jsonb_build_array(x->'childId'))
  OR EXISTS(SELECT 1 FROM (SELECT x->>'date',x->>'startTime',x->>'endTime',x->>'branchId',count(*)n,count(DISTINCT coalesce(x->>'childId','self'))d FROM jsonb_array_elements(s)x GROUP BY 1,2,3,4)t WHERE t.n<>jsonb_array_length(b.package_participants) OR t.d<>jsonb_array_length(b.package_participants)) THEN RAISE EXCEPTION 'BOOKING_UX_FAMILY_PARTICIPANTS';END IF;
 IF c='private' AND EXISTS(SELECT 1 FROM jsonb_array_elements(s)x WHERE (x->>'endTime')::time-(x->>'startTime')::time<>interval '1 hour') THEN RAISE EXCEPTION 'BOOKING_UX_UNIT_DURATION';END IF;
 PERFORM set_config('booking_ux.create',jsonb_build_object('package',b.package_snapshot,'participants',b.package_participants)::text,true);
 r:=public.task10_write_legacy_booking_v1(p_actor,'update',p_request,p_input||jsonb_build_object('totalSessions',b.total_sessions));
 PERFORM set_config('booking_ux.create','',true);
 RETURN r;
END $$;

-- Defend the actual successful insert time after any aggregate lock wait.
DO $patch$ DECLARE d text:=pg_get_functiondef('public.booking_ux_create_v1(uuid,uuid,jsonb)'::regprocedure);a text;b text;
BEGIN
 a:='v_policy:=to_jsonb(v_package)||';b:='v_policy:=(to_jsonb(v_package)-''updated_by''-''updated_at'')||';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'BOOKING_UX_CREATE_BASELINE_DRIFT';END IF;d:=replace(d,a,b);
 a:='PERFORM set_config(''booking_ux.create'','''',true);';
 b:='IF EXISTS(SELECT 1 FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id WHERE b.id=(v_result->>''bookingId'')::uuid AND (s.date+s.start_time) AT TIME ZONE ''Asia/Bangkok''<=b.checkout_deadline) THEN RAISE EXCEPTION ''BOOKING_UX_START_WITHIN_PAYMENT_WINDOW'';END IF; '||a;
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'BOOKING_UX_CREATE_TIME_DRIFT';END IF;d:=replace(d,a,b);EXECUTE d;
END $patch$;

REVOKE ALL ON FUNCTION public.booking_ux_previous_v1(uuid),public.booking_ux_pending_summary_v1(uuid),public.booking_ux_update_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.booking_ux_previous_v1(uuid),public.booking_ux_pending_summary_v1(uuid),public.booking_ux_update_v1(uuid,uuid,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
