BEGIN;
CREATE OR REPLACE FUNCTION public.booking_ux_expiry_v1(p_booking uuid) RETURNS timestamptz LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN b.package_snapshot IS NOT NULL THEN
   CASE WHEN (b.package_snapshot->>'quantity')::int=1 THEN (make_date(b.year,b.month,1)+interval '1 month') AT TIME ZONE 'Asia/Bangkok'-interval '1 millisecond'
   ELSE (date_trunc('month',p.verified_at AT TIME ZONE 'Asia/Bangkok')+make_interval(months=>(b.package_snapshot->>'validity_months')::int)) AT TIME ZONE 'Asia/Bangkok'-interval '1 millisecond' END
 END FROM bookings b JOIN payments p ON p.booking_id=b.id AND p.status::text='approved' AND p.verified_at IS NOT NULL
 WHERE b.id=p_booking AND (SELECT count(*) FROM payments x WHERE x.booking_id=b.id AND x.status::text='approved' AND x.verified_at IS NOT NULL)=1
$$;
CREATE OR REPLACE FUNCTION public.task10_booking_in_cohort_v1(p_booking_id uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT coalesce(b.checkout_version=1 OR a.effective_at IS NOT NULL AND (b.created_at>=a.effective_at OR EXISTS(SELECT 1 FROM task10_booking_expiry_cohort c WHERE c.booking_id=b.id)),false)
 FROM bookings b CROSS JOIN task10_policy_activation a WHERE b.id=p_booking_id
$$;
CREATE FUNCTION public.booking_ux_run_expiry_v1(p_limit integer DEFAULT 50) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b uuid;r jsonb;cancelled integer:=0;failures jsonb:='[]';started timestamptz:=clock_timestamp();
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_REQUEST';END IF;
 IF NOT pg_try_advisory_xact_lock(20,1) THEN RETURN jsonb_build_object('status','already_running');END IF;
 FOR b IN SELECT id FROM bookings WHERE checkout_version=1 AND status::text IN ('pending_payment','paid') AND public.task10_booking_due_v1(id) ORDER BY checkout_deadline,id LIMIT p_limit LOOP
  EXIT WHEN clock_timestamp()-started>interval '40 seconds';
  BEGIN
   PERFORM set_config('lock_timeout','250ms',true);r:=public.task10_expire_booking_v1(b);
   IF (r->>'cancelled')::boolean THEN cancelled:=cancelled+1;END IF;
  EXCEPTION WHEN OTHERS THEN failures:=failures||jsonb_build_array(jsonb_build_object('bookingId',b,'code',SQLSTATE,'reason',left(SQLERRM,160)));
  END;
 END LOOP;
 RETURN jsonb_build_object('cancelled',cancelled,'failures',failures,'finishedAt',clock_timestamp());
END $$;
REVOKE ALL ON FUNCTION public.booking_ux_run_expiry_v1(integer) FROM PUBLIC,anon,authenticated,service_role;
DO $job$ DECLARE j bigint;BEGIN
 IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='booking-ux-expire-new-bills-v1') THEN RAISE EXCEPTION 'BOOKING_UX_CRON_COLLISION';END IF;
 SELECT cron.schedule('booking-ux-expire-new-bills-v1','* * * * *','SET statement_timeout=''45s'';SELECT public.booking_ux_run_expiry_v1(50);') INTO j;
 PERFORM cron.alter_job(j,active:=false);
END $job$;
NOTIFY pgrst,'reload schema';
COMMIT;
