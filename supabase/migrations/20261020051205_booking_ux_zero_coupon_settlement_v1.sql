BEGIN;
-- A fully discounted package has an explicit zero-baht coupon settlement.
-- No transfer, slip, provider verification or invented positive payment.
DO $patch$ DECLARE d text:=pg_get_functiondef('public.booking_ux_create_v1(uuid,uuid,jsonb)'::regprocedure);a text;b text;
BEGIN
 a:='PERFORM set_config(''booking_ux.create'','''',true);';
 b:=$body$
 IF v_course<>'kids_group' AND EXISTS(SELECT 1 FROM bookings WHERE id=(v_result->>'bookingId')::uuid AND total_price=0 AND status::text='pending_payment') THEN
   IF NOT EXISTS(SELECT 1 FROM coupon_usages WHERE booking_id=(v_result->>'bookingId')::uuid AND discount_amount>0) THEN RAISE EXCEPTION 'BOOKING_UX_ZERO_COUPON_EVIDENCE_REQUIRED';END IF;
   PERFORM set_config('task10.payment_write','authorized',true);
   INSERT INTO payments(booking_id,user_id,amount,method,status,verified_at,notes)
     VALUES((v_result->>'bookingId')::uuid,p_actor,0,'coupon','approved',public.task10_clock_v1(),'Zero charge: fully settled by coupon; no money transfer or slip');
   UPDATE bookings SET status='verified' WHERE id=(v_result->>'bookingId')::uuid;
   INSERT INTO activity_logs(user_id,action,entity_type,entity_id,details) VALUES(p_actor,'verify_zero_charge_booking','booking',(v_result->>'bookingId')::uuid,jsonb_build_object('requestId',p_request,'settlementKind','coupon_zero_charge','totalPrice',0));
   v_result:=v_result||jsonb_build_object('status','verified');
 END IF;
 PERFORM set_config('booking_ux.create','',true);
 $body$;
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'BOOKING_UX_ZERO_SETTLEMENT_BASELINE_DRIFT';END IF;EXECUTE replace(d,a,b);
END $patch$;
CREATE OR REPLACE FUNCTION public.booking_ux_catalog_v1() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg((to_jsonb(p)-'updated_by'-'updated_at')||jsonb_build_object('price',public.task10_legacy_price_v1(NULL,c.id,extract(month FROM now() AT TIME ZONE 'Asia/Bangkok')::int,extract(year FROM now() AT TIME ZONE 'Asia/Bangkok')::int,p.quantity,NULL)) ORDER BY p.course,p.quantity),'[]')
 FROM public.booking_ux_packages p JOIN public.course_types c ON c.name::text=p.course
$$;
REVOKE ALL ON FUNCTION public.booking_ux_catalog_v1() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.booking_ux_catalog_v1() TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
