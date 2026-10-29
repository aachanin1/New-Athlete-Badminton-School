BEGIN;
-- New checkout reservations share the existing account/quota fence. Historical
-- usages and reservations are retained byte-for-byte; no backfill or counters.
ALTER TABLE public.progressive_coupon_reservations
 ADD COLUMN settlement_version integer,
 ADD COLUMN min_purchase_snapshot numeric(12,2),
 ADD COLUMN coupon_code_snapshot text;
ALTER TABLE public.progressive_coupon_reservations DROP CONSTRAINT progressive_coupon_reservations_release_reason_check;
ALTER TABLE public.progressive_coupon_reservations ADD CONSTRAINT progressive_coupon_reservations_release_reason_check
 CHECK(release_reason IS NULL OR release_reason IN ('booking_cancelled','booking_expired','payment_rejected','booking_edited'));

CREATE FUNCTION public.booking_ux_coupon_terms_v2() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 SELECT 2,c.min_purchase,c.code INTO NEW.settlement_version,NEW.min_purchase_snapshot,NEW.coupon_code_snapshot FROM coupons c WHERE c.id=NEW.coupon_id;
 RETURN NEW;
END $$;
CREATE TRIGGER booking_ux_coupon_terms BEFORE INSERT ON public.progressive_coupon_reservations
 FOR EACH ROW EXECUTE FUNCTION public.booking_ux_coupon_terms_v2();

CREATE FUNCTION public.booking_ux_coupon_quote_v2(p_actor uuid,p_coupon uuid,p_course uuid,p_gross numeric,p_booking uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c coupons%ROWTYPE;r progressive_coupon_reservations%ROWTYPE;d numeric;f numeric;n bigint;today date:=(public.task10_clock_v1() AT TIME ZONE 'UTC')::date;
BEGIN
 IF p_actor IS NULL OR p_coupon IS NULL OR p_course IS NULL OR p_gross IS NULL OR p_gross<0 THEN RAISE EXCEPTION 'PROGRESSIVE_INVALID_REQUEST';END IF;
 IF p_booking IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM bookings WHERE id=p_booking AND user_id=p_actor AND course_type_id=p_course) THEN RAISE EXCEPTION 'BOOKING_UX_FORBIDDEN';END IF;
  SELECT * INTO r FROM progressive_coupon_reservations WHERE booking_id=p_booking AND user_id=p_actor AND coupon_id=p_coupon AND status='reserved';
 END IF;
 SELECT * INTO c FROM coupons WHERE id=p_coupon;
 IF NOT FOUND THEN RAISE EXCEPTION 'PROGRESSIVE_COUPON_NOT_FOUND';END IF;
 IF r.id IS NOT NULL THEN
  IF p_gross<coalesce(r.min_purchase_snapshot,0) THEN RAISE EXCEPTION 'PROGRESSIVE_COUPON_MIN_PURCHASE';END IF;
  SELECT discount_amount,final_price INTO d,f FROM calculate_progressive_coupon_discount_v1(p_gross,r.discount_type_snapshot,r.discount_value_snapshot);
 ELSE
  IF NOT c.is_active THEN RAISE EXCEPTION 'PROGRESSIVE_COUPON_INACTIVE';END IF;
  IF c.valid_from>today THEN RAISE EXCEPTION 'PROGRESSIVE_COUPON_NOT_STARTED';END IF;
  IF c.valid_to<today THEN RAISE EXCEPTION 'PROGRESSIVE_COUPON_EXPIRED';END IF;
  IF p_gross<coalesce(c.min_purchase,0) THEN RAISE EXCEPTION 'PROGRESSIVE_COUPON_MIN_PURCHASE';END IF;
  IF EXISTS(SELECT 1 FROM coupon_course_types WHERE coupon_id=c.id) AND NOT EXISTS(SELECT 1 FROM coupon_course_types WHERE coupon_id=c.id AND course_type_id=p_course) THEN RAISE EXCEPTION 'PROGRESSIVE_COUPON_COURSE_NOT_ALLOWED';END IF;
  IF EXISTS(SELECT 1 FROM coupon_usages WHERE coupon_id=c.id AND user_id=p_actor)
   OR EXISTS(SELECT 1 FROM progressive_coupon_reservations WHERE coupon_id=c.id AND user_id=p_actor AND status IN ('reserved','consumed')) THEN RAISE EXCEPTION 'PROGRESSIVE_COUPON_ALREADY_USED';END IF;
  SELECT greatest(coalesce(c.current_uses,0),(SELECT count(*) FROM coupon_usages WHERE coupon_id=c.id))
   +(SELECT count(*) FROM progressive_coupon_reservations WHERE coupon_id=c.id AND status IN ('reserved','consumed')) INTO n;
  IF c.max_uses IS NOT NULL AND n>=c.max_uses THEN RAISE EXCEPTION 'PROGRESSIVE_COUPON_MAX_USES';END IF;
  SELECT discount_amount,final_price INTO d,f FROM calculate_progressive_coupon_discount_v1(p_gross,c.discount_type,c.discount_value);
 END IF;
 RETURN jsonb_build_object('id',c.id,'code',coalesce(r.coupon_code_snapshot,c.code),'discount_type',coalesce(r.discount_type_snapshot,c.discount_type),'discount_value',coalesce(r.discount_value_snapshot,c.discount_value),'grossPrice',p_gross,'discountAmount',d,'totalPrice',f);
END $$;

CREATE FUNCTION public.booking_ux_coupon_reprice_v2(p_booking uuid,p_gross numeric,p_revision bigint)
RETURNS TABLE(discount_amount numeric,final_price numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r progressive_coupon_reservations%ROWTYPE;w jsonb;allow_release jsonb:=coalesce(nullif(current_setting('booking_ux.release_coupon_ids',true),''),'[]')::jsonb;
BEGIN
 SELECT * INTO r FROM progressive_coupon_reservations WHERE booking_id=p_booking FOR UPDATE;
 IF NOT FOUND OR r.status='released' THEN discount_amount:=0;final_price:=round(p_gross,2);RETURN NEXT;RETURN;END IF;
 IF r.status<>'reserved' THEN RAISE EXCEPTION 'PROGRESSIVE_COUPON_STATE_CONFLICT';END IF;
 IF r.settlement_version=2 AND p_gross<coalesce(r.min_purchase_snapshot,0)
  AND (EXISTS(SELECT 1 FROM bookings WHERE id=p_booking AND pricing_scope_id IS NULL)
   OR coalesce(nullif(current_setting('booking_ux.edited_coupon_ids',true),''),'[]')::jsonb@>jsonb_build_array(p_booking::text)) THEN
  IF coalesce(current_setting('booking_ux.coupon_preview',true),'')<>'true' AND NOT allow_release@>jsonb_build_array(p_booking::text) THEN RAISE EXCEPTION 'BOOKING_UX_COUPON_ACK_REQUIRED';END IF;
  w:=jsonb_build_object('bookingId',p_booking,'code',r.coupon_code_snapshot,'message','ยอดใหม่ต่ำกว่ายอดขั้นต่ำของคูปอง กรุณายืนยันชำระตามยอดที่ไม่มีส่วนลด');
  PERFORM set_config('booking_ux.coupon_warnings',(coalesce(nullif(current_setting('booking_ux.coupon_warnings',true),''),'[]')::jsonb||jsonb_build_array(w))::text,true);
  UPDATE progressive_coupon_reservations SET status='released',released_at=public.task10_clock_v1(),release_reason='booking_edited' WHERE id=r.id;
  discount_amount:=0;final_price:=round(p_gross,2);RETURN NEXT;RETURN;
 END IF;
 SELECT c.discount_amount,c.final_price INTO discount_amount,final_price FROM calculate_progressive_coupon_discount_v1(p_gross,r.discount_type_snapshot,r.discount_value_snapshot)c;
 UPDATE progressive_coupon_reservations SET gross_price_snapshot=round(p_gross,2),discount_amount_snapshot=discount_amount,final_price_snapshot=final_price,pricing_revision=p_revision WHERE id=r.id;
 RETURN NEXT;
END $$;

-- Legacy (Adult/Private) new holds consume only with verified status. Updating
-- status and consuming/releasing the hold are one transaction, including retries.
CREATE FUNCTION public.booking_ux_coupon_status_v2() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r progressive_coupon_reservations%ROWTYPE;
BEGIN
 IF NEW.pricing_scope_id IS NOT NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW;END IF;
 SELECT * INTO r FROM progressive_coupon_reservations WHERE booking_id=NEW.id AND settlement_version=2 FOR UPDATE;
 IF NOT FOUND OR r.status='released' THEN RETURN NEW;END IF;
 IF NEW.status::text='verified' THEN
  IF r.status<>'reserved' OR NEW.total_price<>r.final_price_snapshot THEN RAISE EXCEPTION 'PROGRESSIVE_COUPON_STATE_CONFLICT';END IF;
  PERFORM public.consume_progressive_coupon_v1(NEW.id,NEW.user_id);
 ELSIF NEW.status::text='cancelled' AND r.status='reserved' THEN
  PERFORM public.release_progressive_coupon_v1(NEW.id,NEW.user_id,CASE WHEN public.task10_booking_due_v1(NEW.id) THEN 'booking_expired' ELSE 'booking_cancelled' END);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER booking_ux_coupon_status AFTER UPDATE OF status ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.booking_ux_coupon_status_v2();

-- Patch the registered writers at stable, checked boundaries. Existing complete
-- validators, transaction receipts, slot/Family locks and historical paths stay.
DO $patch$ DECLARE d text;a text;b text;
BEGIN
 SELECT pg_get_functiondef('public.task10_write_legacy_booking_v1(uuid,text,uuid,jsonb)'::regprocedure) INTO d;
 a:='v_coupon public.coupons%ROWTYPE;';IF position(a IN d)=0 THEN RAISE EXCEPTION 'COUPON_V2_LEGACY_DECL_DRIFT';END IF;
 d:=replace(d,a,a||' v_hold public.progressive_coupon_reservations%ROWTYPE;v_quote jsonb;');
 a:='v_discount:=CASE WHEN v_coupon.discount_type::text=''fixed'' THEN least(v_coupon.discount_value,v_gross)';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'COUPON_V2_LEGACY_QUOTE_DRIFT';END IF;
 d:=replace(d,a,'v_quote:=public.booking_ux_coupon_quote_v2(p_user_id,v_coupon.id,v_course,v_gross); '||a);
 a:='v_final:=greatest(0,v_gross-v_discount);';
 b:=$body$
 IF p_action='update' THEN
  SELECT * INTO v_hold FROM public.progressive_coupon_reservations WHERE booking_id=v_id AND settlement_version=2;
  IF FOUND THEN SELECT discount_amount,final_price INTO v_discount,v_final FROM public.booking_ux_coupon_reprice_v2(v_id,v_gross,coalesce(v_hold.pricing_revision,0)+1);
  ELSIF EXISTS(SELECT 1 FROM public.coupon_usages WHERE booking_id=v_id) THEN
   SELECT coalesce(sum(discount_amount),0) INTO v_discount FROM public.coupon_usages WHERE booking_id=v_id;
   IF v_gross IS DISTINCT FROM v_old.total_price+v_discount THEN RAISE EXCEPTION 'BOOKING_UX_LEGACY_COUPON_REVIEW_REQUIRED';END IF;
  END IF;
 END IF;
 v_final:=greatest(0,v_gross-v_discount);
 $body$;
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'COUPON_V2_LEGACY_PRICE_DRIFT';END IF;d:=replace(d,a,b);
 a:='IF (p_input->>''expectedTotalPrice'')::numeric IS NULL OR abs(v_final-(p_input->>''expectedTotalPrice'')::numeric)>1 THEN';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'COUPON_V2_LEGACY_EXPECTED_DRIFT';END IF;
 d:=replace(d,a,'IF coalesce(current_setting(''booking_ux.set_edit'',true),'''')<>''true'' AND ((p_input->>''expectedTotalPrice'')::numeric IS NULL OR abs(v_final-(p_input->>''expectedTotalPrice'')::numeric)>1) THEN');
 a:=$body$INSERT INTO public.coupon_usages(coupon_id,user_id,booking_id,discount_amount) VALUES(v_coupon.id,p_user_id,v_id,v_discount);
      UPDATE public.coupons SET current_uses=current_uses+1,is_active=CASE WHEN max_uses IS NOT NULL AND current_uses+1>=max_uses THEN false ELSE is_active END WHERE id=v_coupon.id;$body$;
 b:=$body$INSERT INTO public.progressive_coupon_reservations(coupon_id,user_id,booking_id,gross_price_snapshot,discount_type_snapshot,discount_value_snapshot,discount_amount_snapshot,final_price_snapshot,pricing_revision)
      VALUES(v_coupon.id,p_user_id,v_id,v_gross,v_coupon.discount_type,v_coupon.discount_value,v_discount,v_final,1);$body$;
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'COUPON_V2_LEGACY_RESERVE_DRIFT';END IF;d:=replace(d,a,b);EXECUTE d;

 SELECT pg_get_functiondef('public.booking_ux_create_v1(uuid,uuid,jsonb)'::regprocedure) INTO d;
 a:='IF NOT EXISTS(SELECT 1 FROM coupon_usages WHERE booking_id=(v_result->>''bookingId'')::uuid AND discount_amount>0) THEN';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'COUPON_V2_ZERO_DRIFT';END IF;
 d:=replace(d,a,'IF NOT EXISTS(SELECT 1 FROM progressive_coupon_reservations WHERE booking_id=(v_result->>''bookingId'')::uuid AND status=''reserved'' AND discount_amount_snapshot>0) THEN');EXECUTE d;

 SELECT pg_get_functiondef('public.recalculate_progressive_coupon_discount_v1(uuid,numeric,bigint)'::regprocedure) INTO d;
 a:='IF p_booking_id IS NULL';IF position(a IN d)=0 THEN RAISE EXCEPTION 'COUPON_V2_REPRICE_DRIFT';END IF;
 d:=replace(d,a,'IF EXISTS(SELECT 1 FROM public.progressive_coupon_reservations WHERE booking_id=p_booking_id AND settlement_version=2) THEN RETURN QUERY SELECT * FROM public.booking_ux_coupon_reprice_v2(p_booking_id,p_gross_price,p_pricing_revision);RETURN;END IF; '||a);EXECUTE d;

 SELECT pg_get_functiondef('public.booking_ux_edit_set_v1(uuid,uuid,jsonb,boolean)'::regprocedure) INTO d;
 a:='-- The preview executes';IF position(a IN d)=0 THEN RAISE EXCEPTION 'COUPON_V2_SET_BEGIN_DRIFT';END IF;
 d:=replace(d,a,$body$PERFORM set_config('booking_ux.set_edit','true',true);
 PERFORM set_config('booking_ux.coupon_preview',p_preview::text,true);
 PERFORM set_config('booking_ux.release_coupon_ids',coalesce(p_input->'releaseCouponBookingIds','[]')::text,true);
 PERFORM set_config('booking_ux.edited_coupon_ids',(CASE WHEN action='edit' THEN coalesce(p_input->'bookingIds','[]') ELSE '[]'::jsonb END)::text,true);
 PERFORM set_config('booking_ux.coupon_warnings','[]',true);
 -- The preview executes$body$);
 a:='IF p_preview THEN RAISE EXCEPTION USING ERRCODE=';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'COUPON_V2_SET_RESULT_DRIFT';END IF;
 d:=replace(d,a,$body$result:=result||jsonb_build_object('bills',(SELECT jsonb_agg(jsonb_build_object('id',bill_row.id,'total_price',bill_row.total_price,'coupon_code',coalesce(coupon_row.coupon_code_snapshot,history_coupon.code),'coupon_gross',CASE WHEN coupon_row.status IN ('reserved','consumed') THEN coupon_row.gross_price_snapshot ELSE bill_row.total_price+coalesce(history_coupon.discount,0) END,'coupon_discount',CASE WHEN coupon_row.status IN ('reserved','consumed') THEN coupon_row.discount_amount_snapshot ELSE coalesce(history_coupon.discount,0) END,'coupon_state',coupon_row.status) ORDER BY bill_row.id) FROM bookings bill_row LEFT JOIN progressive_coupon_reservations coupon_row ON coupon_row.booking_id=bill_row.id LEFT JOIN LATERAL (SELECT sum(u.discount_amount) discount,min(c.code) code FROM coupon_usages u JOIN coupons c ON c.id=u.coupon_id WHERE u.booking_id=bill_row.id) history_coupon ON true WHERE bill_row.id=ANY(ids)),
 'couponWarnings',coalesce(nullif(current_setting('booking_ux.coupon_warnings',true),''),'[]')::jsonb);
 IF NOT p_preview AND action='edit' AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(p_input->'releaseCouponBookingIds','[]'))x WHERE NOT (result->'couponWarnings')@>jsonb_build_array(jsonb_build_object('bookingId',x))) THEN RAISE EXCEPTION 'BOOKING_UX_COUPON_ACK_REQUIRED';END IF;
 IF p_preview THEN RAISE EXCEPTION USING ERRCODE=$body$);
 a:='IF NOT p_preview THEN'; -- reset transaction settings after subtransaction
 -- Use the final receipt boundary, not the acknowledgement branch above.
 b:='IF NOT p_preview THEN'||E'\n  INSERT INTO booking_ux_requests';
 IF position(b IN d)=0 THEN RAISE EXCEPTION 'COUPON_V2_SET_END_DRIFT';END IF;
 d:=replace(d,b,$body$PERFORM set_config('booking_ux.set_edit','',true);PERFORM set_config('booking_ux.coupon_preview','',true);PERFORM set_config('booking_ux.release_coupon_ids','',true);PERFORM set_config('booking_ux.edited_coupon_ids','',true);PERFORM set_config('booking_ux.coupon_warnings','',true);
 IF NOT p_preview THEN
  INSERT INTO booking_ux_requests$body$);EXECUTE d;
END $patch$;

-- An explicitly removed coupon is retained as history, not a payable member.
-- Every single-booking edit, including older callers, identifies its own edited
-- bill. Scope-only repricing from other creates/cancels retains issued terms.
DO $patch$ DECLARE d text;a text;BEGIN
 SELECT pg_get_functiondef('public.update_progressive_pending_booking_v1(uuid,uuid,uuid,jsonb,uuid,bigint)'::regprocedure) INTO d;
 a:='v_policy jsonb;';IF position(a IN d)=0 THEN RAISE EXCEPTION 'COUPON_V2_SINGLE_DECL_DRIFT';END IF;
 d:=replace(d,a,a||'v_coupon_edit_ids text;');
 a:=$body$v_changed := public.progressive_reprice_scope_v1(
    v_scope_id, v_revision, v_booking.created_at, p_booking_id
  );$body$;
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'COUPON_V2_SINGLE_REPRICE_DRIFT';END IF;
 d:=replace(d,a,$body$v_coupon_edit_ids:=coalesce(current_setting('booking_ux.edited_coupon_ids',true),'');
  PERFORM set_config('booking_ux.edited_coupon_ids',(coalesce(nullif(v_coupon_edit_ids,''),'[]')::jsonb||jsonb_build_array(p_booking_id::text))::text,true);
  $body$||a||$body$
  PERFORM set_config('booking_ux.edited_coupon_ids',v_coupon_edit_ids,true);$body$);EXECUTE d;
END $patch$;

-- An explicitly removed coupon is retained as history, not a payable member.
DO $patch$ DECLARE d text;a text;BEGIN
 SELECT pg_get_functiondef('public.validate_progressive_payment_prefix_v1(uuid,uuid,uuid[],uuid)'::regprocedure) INTO d;
 a:='WHERE reservation.booking_id = ANY(p_booking_ids)';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'COUPON_V2_PREFIX_DRIFT';END IF;
 d:=replace(d,a,a||' AND NOT (reservation.settlement_version=2 AND reservation.status=''released'' AND reservation.release_reason=''booking_edited'')');EXECUTE d;
 SELECT pg_get_functiondef('public.prepare_progressive_payment_batch_v1(uuid,uuid,uuid[],bigint,numeric,uuid)'::regprocedure) INTO d;
 a:='LEFT JOIN public.progressive_coupon_reservations reservation ON reservation.booking_id = booking.id';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'COUPON_V2_PREPARE_DRIFT';END IF;
 d:=replace(d,a,a||' AND reservation.status=''reserved''');EXECUTE d;
END $patch$;

-- A returned receipt is retryable on the same bill; its hold remains until a
-- terminal cancellation/expiry or verified settlement. Preserve old semantics
-- for reservations created before this migration.
DO $patch$ DECLARE d text;a text;BEGIN
 SELECT pg_get_functiondef('public.reject_progressive_payment_batch_v1(uuid,uuid,text,uuid)'::regprocedure) INTO d;
 a:='PERFORM public.release_progressive_coupon_v1(v_member.booking_id, v_batch.user_id, ''payment_rejected'');';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'COUPON_V2_RETURN_DRIFT';END IF;
 d:=replace(d,a,'IF NOT EXISTS(SELECT 1 FROM public.progressive_coupon_reservations WHERE booking_id=v_member.booking_id AND settlement_version=2) THEN '||a||' END IF;');EXECUTE d;
END $patch$;

DO $acl$ DECLARE r record;BEGIN
 FOR r IN SELECT oid::regprocedure::text signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('booking_ux_coupon_terms_v2','booking_ux_coupon_quote_v2','booking_ux_coupon_reprice_v2','booking_ux_coupon_status_v2') LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION '||r.signature||' FROM PUBLIC,anon,authenticated,service_role';
 END LOOP;
END $acl$;
GRANT EXECUTE ON FUNCTION public.booking_ux_coupon_quote_v2(uuid,uuid,uuid,numeric,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
