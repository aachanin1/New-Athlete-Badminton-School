BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='40s';
SELECT pg_advisory_xact_lock(10,1);

-- One current reservation per bill remains compatible with older payment
-- writers. Explicit user changes append complete before/after evidence; no
-- historical usage, reservation or counter is deleted/backfilled.
CREATE TABLE public.booking_ux_coupon_changes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 booking_id uuid NOT NULL REFERENCES public.bookings(id),
 actor_id uuid NOT NULL REFERENCES public.profiles(id),
 request_id uuid NOT NULL,
 before_state jsonb,
 after_state jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.booking_ux_coupon_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_ux_coupon_changes FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX booking_ux_coupon_changes_bill ON public.booking_ux_coupon_changes(booking_id,created_at);

CREATE FUNCTION public.booking_ux_coupon_choice_v3(p_actor uuid,p_booking uuid,p_choice jsonb,p_after boolean,p_request uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b bookings%ROWTYPE;r progressive_coupon_reservations%ROWTYPE;c coupons%ROWTYPE;
 before_row jsonb;z jsonb;choice text:=coalesce(p_choice->>'action','keep');previous_write text;
BEGIN
 IF choice NOT IN ('keep','remove','apply') THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_REQUEST';END IF;
 -- The outer set command already validates every original bill. A keep can
 -- have reached coupon-zero settlement during its authoritative repricing.
 IF choice='keep' THEN RETURN;END IF;
 SELECT * INTO b FROM bookings WHERE id=p_booking AND user_id=p_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_UX_SET_CHANGED';END IF;
 SELECT * INTO r FROM progressive_coupon_reservations WHERE booking_id=b.id FOR UPDATE;
 IF p_after AND choice='apply' AND b.status::text='verified' AND b.total_price=0 AND r.status='consumed'
  AND EXISTS(SELECT 1 FROM coupons WHERE id=r.coupon_id AND code=upper(trim(p_choice->>'code'))) THEN RETURN;END IF;
 IF b.status::text<>'pending_payment' OR public.task10_booking_due_v1(b.id)
  OR public.task10_has_accepted_receipt_v1(b.id) THEN RAISE EXCEPTION 'BOOKING_UX_SET_CHANGED';END IF;
 IF EXISTS(SELECT 1 FROM coupon_usages WHERE booking_id=b.id)
  OR (r.id IS NOT NULL AND (r.settlement_version IS DISTINCT FROM 2 OR r.status='consumed'))
 THEN RAISE EXCEPTION 'BOOKING_UX_LEGACY_COUPON_REVIEW_REQUIRED';END IF;
 IF choice='apply' THEN
  IF length(coalesce(p_choice->>'code','')) NOT BETWEEN 1 AND 128 THEN RAISE EXCEPTION 'PROGRESSIVE_COUPON_NOT_FOUND';END IF;
  SELECT * INTO c FROM coupons WHERE code=upper(trim(p_choice->>'code')) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROGRESSIVE_COUPON_NOT_FOUND';END IF;
  -- Keeping the same still-held code preserves the bill's issued terms.
  IF r.status='reserved' AND r.coupon_id=c.id THEN RETURN;END IF;
 END IF;
 IF NOT p_after THEN
  IF r.status='reserved' THEN
   before_row:=to_jsonb(r);
   UPDATE progressive_coupon_reservations SET status='released',released_at=public.task10_clock_v1(),release_reason='booking_edited'
    WHERE id=r.id RETURNING * INTO r;
   INSERT INTO booking_ux_coupon_changes(booking_id,actor_id,request_id,before_state,after_state)
    VALUES(b.id,p_actor,p_request,before_row,to_jsonb(r));
  END IF;
  RETURN;
 END IF;
 IF choice='remove' THEN RETURN;END IF;
 -- All real session validators/pricing writers ran first. With the previous
 -- reservation released, this is a NEW acquisition using the actual new gross.
 -- Never pass p_booking here: an own-hold quote would skip fresh quota/validity.
 z:=public.booking_ux_coupon_quote_v2(p_actor,c.id,b.course_type_id,b.total_price,NULL);
 before_row:=CASE WHEN r.id IS NOT NULL THEN to_jsonb(r) END;
 IF r.id IS NULL THEN
  INSERT INTO progressive_coupon_reservations(coupon_id,user_id,booking_id,gross_price_snapshot,discount_type_snapshot,discount_value_snapshot,discount_amount_snapshot,final_price_snapshot,pricing_revision)
   VALUES(c.id,p_actor,b.id,b.total_price,c.discount_type,c.discount_value,(z->>'discountAmount')::numeric,(z->>'totalPrice')::numeric,coalesce(b.pricing_revision,1)) RETURNING * INTO r;
 ELSE
  UPDATE progressive_coupon_reservations SET coupon_id=c.id,status='reserved',reserved_at=public.task10_clock_v1(),consumed_at=NULL,released_at=NULL,release_reason=NULL,
   gross_price_snapshot=b.total_price,discount_type_snapshot=c.discount_type,discount_value_snapshot=c.discount_value,
   discount_amount_snapshot=(z->>'discountAmount')::numeric,final_price_snapshot=(z->>'totalPrice')::numeric,
   pricing_revision=coalesce(b.pricing_revision,1),settlement_version=2,min_purchase_snapshot=c.min_purchase,coupon_code_snapshot=c.code
   WHERE id=r.id RETURNING * INTO r;
 END IF;
 INSERT INTO booking_ux_coupon_changes(booking_id,actor_id,request_id,before_state,after_state)
  VALUES(b.id,p_actor,p_request,before_row,to_jsonb(r));
 previous_write:=current_setting('task10.booking_write',true);
 PERFORM set_config('task10.booking_write','authorized',true);
 IF b.pricing_scope_id IS NOT NULL THEN
  UPDATE bookings SET gross_price_snapshot=r.gross_price_snapshot,coupon_discount_snapshot=r.discount_amount_snapshot,
   final_price_snapshot=r.final_price_snapshot,total_price=r.final_price_snapshot WHERE id=b.id;
 ELSE UPDATE bookings SET total_price=r.final_price_snapshot WHERE id=b.id;END IF;
 PERFORM set_config('task10.booking_write',coalesce(previous_write,''),true);
END $$;
REVOKE ALL ON FUNCTION public.booking_ux_coupon_choice_v3(uuid,uuid,jsonb,boolean,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.booking_ux_coupon_zero_edit_v3(p_actor uuid,p_booking uuid,p_request uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b bookings%ROWTYPE;previous_write text;previous_payment text;
BEGIN
 SELECT * INTO b FROM bookings WHERE id=p_booking AND user_id=p_actor FOR UPDATE;
 IF NOT FOUND OR b.status::text<>'pending_payment' OR b.total_price<>0 THEN RETURN;END IF;
 IF public.task10_booking_due_v1(b.id) OR public.task10_has_accepted_receipt_v1(b.id) THEN RAISE EXCEPTION 'BOOKING_UX_SET_CHANGED';END IF;
 IF NOT EXISTS(SELECT 1 FROM progressive_coupon_reservations WHERE booking_id=b.id AND status='reserved' AND discount_amount_snapshot>0 AND final_price_snapshot=0) THEN RETURN;END IF;
 previous_write:=current_setting('task10.booking_write',true);previous_payment:=current_setting('task10.payment_write',true);
 PERFORM set_config('task10.booking_write','authorized',true);PERFORM set_config('task10.payment_write','authorized',true);
 IF b.pricing_scope_id IS NOT NULL THEN PERFORM public.verify_progressive_zero_charge_booking_v1(b.id,p_actor);
 ELSE
  INSERT INTO payments(booking_id,user_id,amount,method,status,verified_at,notes)
   VALUES(b.id,p_actor,0,'coupon','approved',public.task10_clock_v1(),'Zero charge: fully settled by coupon; no money transfer or slip');
  UPDATE bookings SET status='verified' WHERE id=b.id;
  INSERT INTO activity_logs(user_id,action,entity_type,entity_id,details)
   VALUES(p_actor,'verify_zero_charge_booking','booking',b.id,jsonb_build_object('requestId',p_request,'settlementKind','coupon_zero_charge','totalPrice',0));
 END IF;
 PERFORM set_config('task10.booking_write',coalesce(previous_write,''),true);PERFORM set_config('task10.payment_write',coalesce(previous_payment,''),true);
END $$;
REVOKE ALL ON FUNCTION public.booking_ux_coupon_zero_edit_v3(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

DO $patch$
DECLARE d text;a text;b text;
BEGIN
 -- A set may change several bills. Preserve append-only calculation evidence:
 -- defer both intermediate recording and zero settlement until every selected
 -- bill has its final coupon. All older writers retain their existing behavior.
 SELECT pg_get_functiondef('public.task10_record_scope_calculations_v1(uuid,bigint)'::regprocedure) INTO d;
 a:='BEGIN';IF position(a IN d)=0 THEN RAISE EXCEPTION 'COUPON_EDIT_V3_RECORD_DRIFT';END IF;
 d:=replace(d,a,a||E'\n IF current_setting(''booking_ux.defer_coupon_final'',true)=''yes'' THEN RETURN;END IF;');EXECUTE d;
 SELECT pg_get_functiondef('public.verify_progressive_zero_charge_booking_v1(uuid,uuid)'::regprocedure) INTO d;
 a:='BEGIN';IF position(a IN d)=0 THEN RAISE EXCEPTION 'COUPON_EDIT_V3_ZERO_DRIFT';END IF;
 d:=replace(d,a,a||E'\n IF current_setting(''booking_ux.defer_coupon_final'',true)=''yes'' THEN RETURN false;END IF;');EXECUTE d;
 SELECT pg_get_functiondef('public.booking_ux_edit_set_v1(uuid,uuid,jsonb,boolean)'::regprocedure) INTO d;
 a:='result jsonb;prior';IF position(a IN d)=0 THEN RAISE EXCEPTION 'COUPON_EDIT_V3_DECL_DRIFT';END IF;
 d:=replace(d,a,'coupon_change jsonb;coupon_terms jsonb;quote_token text;prior_defer text;result jsonb;prior');
 a:='PERFORM set_config(''booking_ux.set_edit'',''true'',true);';
 b:=$body$
 IF p_input ? 'couponChanges' THEN
  IF action<>'edit' OR jsonb_typeof(p_input->'couponChanges') IS DISTINCT FROM 'array'
   OR jsonb_array_length(p_input->'couponChanges')<>cardinality(ids)
   OR (SELECT count(DISTINCT x->>'bookingId') FROM jsonb_array_elements(p_input->'couponChanges')x)<>cardinality(ids)
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_input->'couponChanges')x WHERE coalesce(x->>'action','') NOT IN ('keep','remove','apply') OR NOT coalesce((x->>'bookingId')::uuid=ANY(ids),false))
  THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_REQUEST';END IF;
 END IF;
 prior_defer:=current_setting('booking_ux.defer_coupon_final',true);
 IF p_input ? 'couponChanges' THEN PERFORM set_config('booking_ux.defer_coupon_final','yes',true);END IF;
 -- Match scope -> bill -> coupon order. Lock ALL involved codes in one stable
 -- order before a reservation changes, including swaps between two bills.
 PERFORM c.id FROM coupons c WHERE c.id IN
  (SELECT coupon_id FROM progressive_coupon_reservations WHERE booking_id=ANY(ids))
  OR c.code IN(SELECT upper(trim(x->>'code')) FROM jsonb_array_elements(coalesce(p_input->'couponChanges','[]'))x WHERE x->>'action'='apply')
 ORDER BY c.id FOR UPDATE;
 PERFORM set_config('booking_ux.set_edit','true',true);
 $body$;
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'COUPON_EDIT_V3_BEGIN_DRIFT';END IF;d:=replace(d,a,b);
 a:='FOR b IN SELECT * FROM bookings WHERE id=ANY(ids) ORDER BY created_at,id LOOP';
 b:=$body$
 IF p_input ? 'couponChanges' THEN
  FOR coupon_change IN SELECT x FROM jsonb_array_elements(p_input->'couponChanges')x ORDER BY x->>'bookingId' LOOP
   PERFORM public.booking_ux_coupon_choice_v3(p_actor,(coupon_change->>'bookingId')::uuid,coupon_change,false,p_request);
  END LOOP;
 END IF;
 FOR b IN SELECT * FROM bookings WHERE id=ANY(ids) ORDER BY created_at,id LOOP
 $body$;
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'COUPON_EDIT_V3_LOOP_DRIFT';END IF;d:=replace(d,a,b);
 a:='SELECT coalesce(sum(total_price) FILTER(WHERE status::text<>''cancelled''),0) INTO total';
 b:=$body$
 IF p_input ? 'couponChanges' THEN
  FOR coupon_change IN SELECT x FROM jsonb_array_elements(p_input->'couponChanges')x ORDER BY x->>'bookingId' LOOP
   PERFORM public.booking_ux_coupon_choice_v3(p_actor,(coupon_change->>'bookingId')::uuid,coupon_change,true,p_request);
  END LOOP;
  PERFORM set_config('booking_ux.defer_coupon_final',coalesce(prior_defer,''),true);
  FOR r IN SELECT DISTINCT pricing_scope_id,pricing_revision FROM bookings
   WHERE id=ANY(ids) AND pricing_scope_id IS NOT NULL AND status::text='pending_payment' LOOP
   PERFORM public.task10_record_scope_calculations_v1(r.pricing_scope_id,r.pricing_revision);
  END LOOP;
  FOR b IN SELECT * FROM bookings WHERE id=ANY(ids) ORDER BY id LOOP
   PERFORM public.booking_ux_coupon_zero_edit_v3(p_actor,b.id,p_request);
  END LOOP;
 END IF;
 SELECT coalesce(sum(total_price) FILTER(WHERE status::text<>'cancelled'),0) INTO total
 $body$;
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'COUPON_EDIT_V3_AFTER_DRIFT';END IF;d:=replace(d,a,b);
 a:='IF p_preview THEN RAISE EXCEPTION USING ERRCODE=';
 b:=$body$
 SELECT coalesce(jsonb_agg(jsonb_build_object('booking',booking_id,'coupon',coupon_id,'code',coupon_code_snapshot,
  'type',discount_type_snapshot,'value',discount_value_snapshot,'minimum',min_purchase_snapshot,'revision',pricing_revision,'state',status) ORDER BY booking_id),'[]')
 INTO coupon_terms FROM progressive_coupon_reservations WHERE booking_id=ANY(ids);
 quote_token:=encode(extensions.digest(jsonb_build_object('input',p_input-'expectedTotal'-'quoteToken','bills',result->'bills','total',total,'terms',coupon_terms)::text,'sha256'),'hex');
 result:=result||jsonb_build_object('quoteToken',quote_token);
 IF NOT p_preview AND p_input ? 'couponChanges' AND (jsonb_array_length(result->'couponWarnings')>0 OR p_input->>'quoteToken' IS DISTINCT FROM quote_token) THEN RAISE EXCEPTION 'BOOKING_UX_QUOTE_CHANGED';END IF;
 IF p_preview THEN RAISE EXCEPTION USING ERRCODE=
 $body$;
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'COUPON_EDIT_V3_QUOTE_DRIFT';END IF;d:=replace(d,a,b);
 EXECUTE d;
 -- Preview deliberately rolls back its inner setting changes too.
 SELECT pg_get_functiondef('public.booking_ux_edit_set_v1(uuid,uuid,jsonb,boolean)'::regprocedure) INTO d;
 a:='PERFORM set_config(''booking_ux.set_edit'','''',true);';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'COUPON_EDIT_V3_RESTORE_DRIFT';END IF;
 d:=replace(d,a,'PERFORM set_config(''booking_ux.defer_coupon_final'',coalesce(prior_defer,''''),true);'||a);EXECUTE d;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
