BEGIN;

-- Pure calculation: no catalog/history scans and no entitlement writes.
CREATE FUNCTION public.booking_ux_expected_package_expiry_v1(p_months integer,p_reference timestamptz)
RETURNS timestamptz LANGUAGE sql IMMUTABLE STRICT SET search_path=public,pg_temp AS $$
 SELECT (date_trunc('month',p_reference AT TIME ZONE 'Asia/Bangkok')+make_interval(months=>p_months)) AT TIME ZONE 'Asia/Bangkok'-interval '1 millisecond'
$$;

CREATE FUNCTION public.booking_ux_assert_package_dates_v1(p_sessions jsonb,p_months integer,p_reference timestamptz)
RETURNS void LANGUAGE plpgsql IMMUTABLE STRICT SET search_path=public,pg_temp AS $$
BEGIN
 IF p_months NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'BOOKING_UX_DURATION_INVALID';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_sessions)x
   WHERE ((x->>'date')::date+(x->>'endTime')::time) AT TIME ZONE 'Asia/Bangkok'>public.booking_ux_expected_package_expiry_v1(p_months,p_reference))
 THEN RAISE EXCEPTION 'BOOKING_UX_TARGET_AFTER_EXPIRY';END IF;
END $$;
REVOKE ALL ON FUNCTION public.booking_ux_expected_package_expiry_v1(integer,timestamptz),public.booking_ux_assert_package_dates_v1(jsonb,integer,timestamptz) FROM PUBLIC,anon,authenticated,service_role;

DO $patch$
DECLARE d text;a text;b text;
BEGIN
 d:=pg_get_functiondef('public.booking_ux_create_v1(uuid,uuid,jsonb)'::regprocedure);
 a:='v_quantity:=v_package.quantity;';
 b:=a||' IF v_quantity>1 THEN PERFORM public.booking_ux_assert_package_dates_v1(v_sessions,v_package.validity_months,public.task10_clock_v1());END IF;';
 IF position(a IN d)=0 OR position('booking_ux_assert_package_dates_v1' IN d)>0 THEN RAISE EXCEPTION 'BOOKING_UX_CREATE_EXPIRY_BASELINE_DRIFT';END IF;
 EXECUTE replace(d,a,b);

 d:=pg_get_functiondef('public.booking_ux_update_v1(uuid,uuid,jsonb)'::regprocedure);
 a:='PERFORM set_config(''booking_ux.create'',jsonb_build_object(''package'',b.package_snapshot,''participants'',members)::text,true);';
 b:='IF (b.package_snapshot->>''quantity'')::integer>1 THEN PERFORM public.booking_ux_assert_package_dates_v1(s,(b.package_snapshot->>''validity_months'')::integer,public.task10_clock_v1());END IF; '||a;
 IF position(a IN d)=0 OR position('booking_ux_assert_package_dates_v1' IN d)>0 THEN RAISE EXCEPTION 'BOOKING_UX_UPDATE_EXPIRY_BASELINE_DRIFT';END IF;
 EXECUTE replace(d,a,b);

 -- Existing pending bills and old tabs must pass the same guard before receipt
 -- acceptance. Keep durable receipt replay and shared booking-set locks first.
 d:=pg_get_functiondef('public.task10_accept_legacy_slip_v1(uuid,uuid[],text,text,text,numeric,uuid)'::regprocedure);
 a:='v_time:=public.task10_clock_v1();';
 b:=a||$guard$
    IF b.package_snapshot IS NOT NULL AND (b.package_snapshot->>'quantity')::integer>1 AND EXISTS(
      SELECT 1 FROM public.booking_sessions s WHERE s.booking_id=b.id AND s.status::text NOT IN ('cancelled','walleted','rescheduled')
      AND (s.date+s.end_time) AT TIME ZONE 'Asia/Bangkok'>public.booking_ux_expected_package_expiry_v1((b.package_snapshot->>'validity_months')::integer,v_time))
    THEN RAISE EXCEPTION 'BOOKING_UX_TARGET_AFTER_EXPIRY';END IF;
 $guard$;
 IF position(a IN d)=0 OR position('booking_ux_expected_package_expiry_v1' IN d)>0 THEN RAISE EXCEPTION 'BOOKING_UX_RECEIPT_EXPIRY_BASELINE_DRIFT';END IF;
 EXECUTE replace(d,a,b);
END $patch$;

NOTIFY pgrst,'reload schema';
COMMIT;
