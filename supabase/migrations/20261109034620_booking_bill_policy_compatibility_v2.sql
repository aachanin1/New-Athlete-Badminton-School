-- Keep Admin-supported pricing threshold semantics and Private hour labels.
BEGIN;
SET LOCAL lock_timeout='5s';
SELECT pg_advisory_xact_lock(10,1);
CREATE OR REPLACE FUNCTION public.booking_bill_package_terms_v2(p_actor uuid,p_course uuid,p_id text,p_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p booking_ux_packages%ROWTYPE;t pricing_tiers%ROWTYPE;c text;n integer;chosen_min integer;
 today date:=(public.task10_clock_v1() AT TIME ZONE 'UTC')::date;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor) THEN RAISE EXCEPTION 'BOOKING_UX_FORBIDDEN';END IF;
 SELECT name::text INTO c FROM course_types WHERE id=p_course;
 IF c NOT IN ('adult_group','private') OR c IS NULL THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_REQUEST';END IF;
 SELECT * INTO p FROM booking_ux_packages WHERE id=p_id AND course=c FOR SHARE;
 IF NOT FOUND OR p.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'BOOKING_UX_PACKAGE_CHANGED';END IF;
 LOCK TABLE pricing_tiers IN SHARE MODE;
 SELECT max(min_sessions) INTO chosen_min FROM pricing_tiers WHERE course_type_id=p_course AND min_sessions<=p.quantity
  AND (valid_from IS NULL OR valid_from<=today) AND (valid_to IS NULL OR valid_to>=today);
 IF chosen_min IS NULL THEN RAISE EXCEPTION 'BOOKING_UX_PACKAGE_CHANGED';END IF;
 SELECT count(*) INTO n FROM pricing_tiers WHERE course_type_id=p_course AND min_sessions=chosen_min
  AND (valid_from IS NULL OR valid_from<=today) AND (valid_to IS NULL OR valid_to>=today);
 IF n<>1 THEN RAISE EXCEPTION 'BOOKING_UX_PACKAGE_CHANGED';END IF;
 SELECT * INTO t FROM pricing_tiers WHERE course_type_id=p_course AND min_sessions=chosen_min
  AND (valid_from IS NULL OR valid_from<=today) AND (valid_to IS NULL OR valid_to>=today);
 RETURN (to_jsonb(p)-'updated_by'-'updated_at')||jsonb_build_object(
  'purchaseMode',CASE WHEN p.quantity=1 THEN 'per_session' ELSE 'package' END,'policyVersion',2,
  'price',CASE WHEN t.min_sessions=1 THEN round(p.quantity*t.price_per_session,2) ELSE t.package_price END,
  'unitRate',t.price_per_session,'tierEvidence',to_jsonb(t),
  'unit',CASE WHEN c='private' THEN 'hour' ELSE 'session' END);
END $$;

CREATE OR REPLACE FUNCTION public.booking_bill_package_quote_v2(p_actor uuid,p_course uuid,p_quantity integer,
 p_package_id text,p_package_revision bigint,p_booking uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE terms jsonb;b bookings%ROWTYPE;t pricing_tiers%ROWTYPE;c text;gross numeric;old_bill boolean:=false;
 today date:=(public.task10_clock_v1() AT TIME ZONE 'UTC')::date;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(10,1);
 IF p_quantity IS NULL OR p_quantity<1 OR p_quantity>500 THEN RAISE EXCEPTION 'BOOKING_UX_PACKAGE_QUANTITY';END IF;
 SELECT name::text INTO c FROM course_types WHERE id=p_course;
 IF c IS NULL OR c NOT IN ('adult_group','private') THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_REQUEST';END IF;
 IF p_booking IS NOT NULL THEN
  SELECT * INTO b FROM bookings WHERE id=p_booking AND user_id=p_actor AND course_type_id=p_course;
  IF NOT FOUND OR b.package_snapshot IS NULL THEN RAISE EXCEPTION 'BOOKING_UX_FORBIDDEN';END IF;
  terms:=b.package_snapshot;
  IF p_package_id IS DISTINCT FROM terms->>'id' THEN RAISE EXCEPTION 'BOOKING_UX_PACKAGE_CHANGED';END IF;
  old_bill:=terms->>'policyVersion' IS DISTINCT FROM '2';
  IF NOT public.booking_bill_per_session_v2(terms) AND p_quantity<>b.total_sessions THEN RAISE EXCEPTION 'BOOKING_UX_PACKAGE_QUANTITY';END IF;
 ELSE
  IF NOT coalesce((SELECT enabled FROM booking_bill_policy_control WHERE singleton),false) THEN RAISE EXCEPTION 'BOOKING_BILL_POLICY_DISABLED';END IF;
  terms:=public.booking_bill_package_terms_v2(p_actor,p_course,p_package_id,p_package_revision);
  IF NOT public.booking_bill_per_session_v2(terms) AND p_quantity<>(terms->>'quantity')::int THEN RAISE EXCEPTION 'BOOKING_UX_PACKAGE_QUANTITY';END IF;
 END IF;
 IF old_bill THEN
  gross:=public.task10_legacy_price_v1(p_actor,p_course,b.month,b.year,p_quantity,b.id);
  SELECT * INTO t FROM pricing_tiers WHERE course_type_id=p_course AND min_sessions<=p_quantity
   AND (valid_from IS NULL OR valid_from<=today) AND (valid_to IS NULL OR valid_to>=today)
   ORDER BY min_sessions DESC,id LIMIT 1;
  IF t.id IS NULL THEN RAISE EXCEPTION 'BOOKING_UX_PACKAGE_CHANGED';END IF;
 ELSE
  t:=jsonb_populate_record(NULL::public.pricing_tiers,terms->'tierEvidence');
  IF t.id IS NULL OR t.course_type_id<>p_course OR (terms->>'unitRate')::numeric IS NULL THEN RAISE EXCEPTION 'BOOKING_UX_PACKAGE_CHANGED';END IF;
  gross:=CASE WHEN public.booking_bill_per_session_v2(terms) THEN round(p_quantity*(terms->>'unitRate')::numeric,2) ELSE (terms->>'price')::numeric END;
 END IF;
 RETURN jsonb_build_object('mode','legacy','grossPrice',gross,'totalPrice',gross,'discountAmount',0,
  'existingSessions',0,'existingPaid',0,'totalSessionsAfter',p_quantity,
  'purchaseMode',coalesce(terms->>'purchaseMode',CASE WHEN (terms->>'quantity')::int=1 THEN 'per_session' ELSE 'package' END),
  'purchasePolicyVersion',CASE WHEN NOT old_bill THEN 2 END,
  'selectedTier',jsonb_build_object('id',t.id,'minSessions',t.min_sessions,'maxSessions',t.max_sessions,
   'pricePerSession',t.price_per_session,'packagePrice',t.package_price,'unit',CASE WHEN c='private' THEN 'hour' ELSE 'session' END));
END $$;

DO $patch$
DECLARE d text:=pg_get_functiondef('public.task10_write_legacy_booking_v1(uuid,text,uuid,jsonb)'::regprocedure);a text;b text;
BEGIN
 a:='''สร้างการจอง ''||v_quantity||'' ครั้ง ยอดชำระ ฿''||v_final';
 b:='''สร้างการจอง ''||v_quantity||CASE WHEN v_name=''private'' THEN '' ชั่วโมง ยอดชำระ ฿'' ELSE '' ครั้ง ยอดชำระ ฿'' END||v_final';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'BOOKING_BILL_NOTIFICATION_DRIFT';END IF;d:=replace(d,a,b);
 a:='''สร้างการจองใหม่ ''||v_quantity||'' ครั้ง ยอดชำระ ฿''||v_final';
 b:='''สร้างการจองใหม่ ''||v_quantity||CASE WHEN v_name=''private'' THEN '' ชั่วโมง ยอดชำระ ฿'' ELSE '' ครั้ง ยอดชำระ ฿'' END||v_final';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'BOOKING_BILL_ADMIN_NOTIFICATION_DRIFT';END IF;d:=replace(d,a,b);
 EXECUTE d;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
