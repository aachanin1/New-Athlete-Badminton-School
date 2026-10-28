BEGIN;
DO $patch$
DECLARE d text:=pg_get_functiondef('public.booking_ux_edit_set_v1(uuid,uuid,jsonb,boolean)'::regprocedure);a text;b text;
BEGIN
 a:='sub uuid;';b:='sub uuid;edit_month integer;edit_year integer;';IF position(a IN d)=0 THEN RAISE EXCEPTION 'SET_EDIT_BASELINE_DRIFT';END IF;d:=replace(d,a,b);
 a:='PERFORM public.task10_lock_scopes_v1(scopes);';
 b:=$body$
 IF action='edit' THEN
  IF jsonb_typeof(p_input->'edits') IS DISTINCT FROM 'array' OR jsonb_array_length(p_input->'edits')>100 THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_REQUEST';END IF;
  IF (SELECT coalesce(sum(jsonb_array_length(x->'sessions')),0) FROM jsonb_array_elements(p_input->'edits')x)>2000 THEN RAISE EXCEPTION 'BOOKING_UX_TOO_MANY_ROUNDS';END IF;
  FOR b IN SELECT * FROM bookings WHERE id=ANY(ids) AND package_snapshot IS NOT NULL LOOP
   SELECT x->'sessions' INTO ss FROM jsonb_array_elements(p_input->'edits')x WHERE (x->>'id')::uuid=b.id;
   IF jsonb_array_length(ss)>0 THEN scopes:=scopes||jsonb_build_array(jsonb_build_object('user_id',p_actor,'course_type_id',b.course_type_id,'year',extract(year FROM (ss->0->>'date')::date),'month',extract(month FROM (ss->0->>'date')::date)));END IF;
  END LOOP;
 END IF;
 PERFORM public.task10_lock_scopes_v1(scopes);
 $body$;
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'SET_EDIT_SCOPE_DRIFT';END IF;d:=replace(d,a,b);
 a:='IF EXISTS(SELECT 1 FROM jsonb_array_elements(ss)x WHERE extract(month FROM (x->>''date'')::date)<>b.month OR extract(year FROM (x->>''date'')::date)<>b.year)';
 b:='edit_month:=CASE WHEN b.package_snapshot IS NOT NULL AND jsonb_array_length(ss)>0 THEN extract(month FROM (ss->0->>''date'')::date)::int ELSE b.month END;edit_year:=CASE WHEN b.package_snapshot IS NOT NULL AND jsonb_array_length(ss)>0 THEN extract(year FROM (ss->0->>''date'')::date)::int ELSE b.year END; IF EXISTS(SELECT 1 FROM jsonb_array_elements(ss)x WHERE extract(month FROM (x->>''date'')::date)<>edit_month OR extract(year FROM (x->>''date'')::date)<>edit_year)';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'SET_EDIT_MONTH_DRIFT';END IF;d:=replace(d,a,b);
 d:=replace(d,'gross:=public.task10_legacy_price_v1(p_actor,b.course_type_id,b.month,b.year,','gross:=public.task10_legacy_price_v1(p_actor,b.course_type_id,edit_month,edit_year,');
 d:=replace(d,'''month'',b.month,''year'',b.year,''sessions'',ss','''month'',edit_month,''year'',edit_year,''sessions'',ss');
 EXECUTE d;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
