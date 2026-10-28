BEGIN;
DO $patch$
DECLARE definition text;anchor text:='IF changed>0 THEN';
BEGIN
 SELECT pg_get_functiondef('public.booking_ux_resolve_legacy_slip_check_v1(uuid,uuid,uuid,uuid,text,text)'::regprocedure) INTO definition;
 IF (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'BOOKING_UX_NOTIFICATION_PATCH_MISMATCH';END IF;
 EXECUTE replace(definition,anchor,anchor||E'\n    IF p_decision=''approved'' THEN\n      INSERT INTO public.notifications(user_id,title,message,type,link_url)\n        SELECT id,''SlipOK ยืนยันการชำระเงินแล้ว'',cardinality(ids)||'' รายการ • ยอด ''||(SELECT sum(total_price) FROM public.bookings WHERE id=ANY(ids))||'' บาท'',''payment'',''/admin/payments''\n        FROM public.profiles WHERE role::text IN (''admin'',''super_admin'');\n    END IF;');
END $patch$;
COMMIT;
