-- BOOKING-BILL-POLICY-1: additive, forward-only pricing and purchase terms.
-- Activation is deliberately OFF. Existing bills keep their own evidence.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SELECT pg_advisory_xact_lock(10,1);

CREATE TABLE public.booking_bill_policy_control (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false
);
INSERT INTO public.booking_bill_policy_control DEFAULT VALUES;
ALTER TABLE public.booking_bill_policy_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_bill_policy_control FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.booking_bill_policy_control TO service_role;

CREATE FUNCTION public.booking_bill_per_session_v2(p_terms jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT coalesce(p_terms->>'policyVersion'='2' AND p_terms->>'purchaseMode'='per_session',false)
$$;
CREATE FUNCTION public.booking_bill_kids_per_bill_v2(p_booking uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM task10_booking_pricing_evidence e
  WHERE e.booking_id=p_booking AND e.evidence->>'pricingMode'='per_bill_v1')
$$;

-- All terms come from an exact current catalog row. The selected item quantity
-- is its catalog denomination; total_sessions records the purchased count.
CREATE FUNCTION public.booking_bill_package_terms_v2(p_actor uuid,p_course uuid,p_id text,p_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p booking_ux_packages%ROWTYPE;t pricing_tiers%ROWTYPE;c text;n integer;
 today date:=(public.task10_clock_v1() AT TIME ZONE 'UTC')::date;
BEGIN
 IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor) THEN RAISE EXCEPTION 'BOOKING_UX_FORBIDDEN';END IF;
 SELECT name::text INTO c FROM course_types WHERE id=p_course;
 IF c NOT IN ('adult_group','private') OR c IS NULL THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_REQUEST';END IF;
 SELECT * INTO p FROM booking_ux_packages WHERE id=p_id AND course=c FOR SHARE;
 IF NOT FOUND OR p.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'BOOKING_UX_PACKAGE_CHANGED';END IF;
 LOCK TABLE pricing_tiers IN SHARE MODE;
 SELECT count(*) INTO n FROM pricing_tiers WHERE course_type_id=p_course AND min_sessions=p.quantity
  AND (max_sessions IS NULL OR p.quantity<=max_sessions)
  AND (valid_from IS NULL OR valid_from<=today) AND (valid_to IS NULL OR valid_to>=today);
 IF n<>1 THEN RAISE EXCEPTION 'BOOKING_UX_PACKAGE_CHANGED';END IF;
 SELECT * INTO t FROM pricing_tiers WHERE course_type_id=p_course AND min_sessions=p.quantity
  AND (max_sessions IS NULL OR p.quantity<=max_sessions)
  AND (valid_from IS NULL OR valid_from<=today) AND (valid_to IS NULL OR valid_to>=today);
 RETURN (to_jsonb(p)-'updated_by'-'updated_at')||jsonb_build_object(
  'purchaseMode',CASE WHEN p.quantity=1 THEN 'per_session' ELSE 'package' END,'policyVersion',2,
  'price',CASE WHEN p.quantity=1 THEN t.price_per_session ELSE t.package_price END,
  'unitRate',t.price_per_session,'tierEvidence',to_jsonb(t),
  'unit',CASE WHEN c='private' THEN 'hour' ELSE 'session' END);
END $$;

CREATE FUNCTION public.booking_bill_package_quote_v2(p_actor uuid,p_course uuid,p_quantity integer,
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

-- Private pg_temp migration utility: every patch must match the expected source
-- boundary. It is never installed as a public callable mutation surface.
CREATE FUNCTION pg_temp.booking_bill_patch_v2(p_signature regprocedure,p_old text,p_new text,p_label text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE d text:=pg_get_functiondef(p_signature);
BEGIN
 IF position(p_old IN d)=0 THEN RAISE EXCEPTION 'BOOKING_BILL_SOURCE_DRIFT %',p_label;END IF;
 EXECUTE replace(d,p_old,p_new);
END $$;

-- Optional fields are omitted for old evidence, retaining its exact fingerprint.
SELECT pg_temp.booking_bill_patch_v2('public.task10_booking_policy_quote_v1(uuid,uuid,date,text,uuid)',
 'v_selection_rule text;','v_selection_rule text; v_pricing_mode text;','kids-policy-declare');
SELECT pg_temp.booking_bill_patch_v2('public.task10_booking_policy_quote_v1(uuid,uuid,date,text,uuid)',
 'v_selection_rule:=e.evidence->>''selectionRuleVersion'';',
 'v_selection_rule:=e.evidence->>''selectionRuleVersion''; v_pricing_mode:=e.evidence->>''pricingMode'';','kids-policy-existing');
SELECT pg_temp.booking_bill_patch_v2('public.task10_booking_policy_quote_v1(uuid,uuid,date,text,uuid)',
 'v_selection_rule:=''kids_same_month_v2'';',
 'v_selection_rule:=''kids_same_month_v2''; IF (SELECT enabled FROM booking_bill_policy_control WHERE singleton) THEN v_pricing_mode:=''per_bill_v1'';END IF;','kids-policy-new');
SELECT pg_temp.booking_bill_patch_v2('public.task10_booking_policy_quote_v1(uuid,uuid,date,text,uuid)',
 'coalesce(c.fingerprint,''''),v_selection_rule)',
 'coalesce(c.fingerprint,''''),v_selection_rule,v_pricing_mode)','kids-policy-fingerprint');
SELECT pg_temp.booking_bill_patch_v2('public.task10_booking_policy_quote_v1(uuid,uuid,date,text,uuid)',
 '|| CASE WHEN v_selection_rule IS NULL THEN ''{}''::jsonb ELSE jsonb_build_object(''selectionRuleVersion'',v_selection_rule) END;',
 '|| CASE WHEN v_selection_rule IS NULL THEN ''{}''::jsonb ELSE jsonb_build_object(''selectionRuleVersion'',v_selection_rule) END || CASE WHEN v_pricing_mode IS NULL THEN ''{}''::jsonb ELSE jsonb_build_object(''pricingMode'',v_pricing_mode) END;','kids-policy-output');

SELECT pg_temp.booking_bill_patch_v2('public.progressive_reprice_scope_v1(uuid,bigint,timestamptz,uuid)',
 'v_should_reprice boolean;','v_should_reprice boolean; v_per_bill boolean;','reprice-declare');
SELECT pg_temp.booking_bill_patch_v2('public.progressive_reprice_scope_v1(uuid,bigint,timestamptz,uuid)',
 'v_entitlement := coalesce(v_booking.entitlement_sessions, v_booking.total_sessions);',
 'v_per_bill:=public.booking_bill_kids_per_bill_v2(v_booking.id); v_entitlement := coalesce(v_booking.entitlement_sessions, v_booking.total_sessions);','reprice-mode');
SELECT pg_temp.booking_bill_patch_v2('public.progressive_reprice_scope_v1(uuid,bigint,timestamptz,uuid)',
 'public.task10_booking_tier_v1(v_booking.id,v_cumulative+v_entitlement)',
 'public.task10_booking_tier_v1(v_booking.id,CASE WHEN v_per_bill THEN v_entitlement ELSE v_cumulative+v_entitlement END)','reprice-tier');
SELECT pg_temp.booking_bill_patch_v2('public.progressive_reprice_scope_v1(uuid,bigint,timestamptz,uuid)',
 'cumulative_sessions_before = v_cumulative,','cumulative_sessions_before = CASE WHEN v_per_bill THEN 0 ELSE v_cumulative END,','reprice-before');
SELECT pg_temp.booking_bill_patch_v2('public.progressive_reprice_scope_v1(uuid,bigint,timestamptz,uuid)',
 'cumulative_sessions_after = v_cumulative + v_entitlement,','cumulative_sessions_after = CASE WHEN v_per_bill THEN v_entitlement ELSE v_cumulative + v_entitlement END,','reprice-after');
SELECT pg_temp.booking_bill_patch_v2('public.task10_record_scope_calculations_v1(uuid,bigint)',
 '''formula'',''progressive'');',
 '''formula'',''progressive'') || CASE WHEN public.booking_bill_kids_per_bill_v2(r.id) THEN jsonb_build_object(''pricingMode'',''per_bill_v1'') ELSE ''{}''::jsonb END;','calculation-mode');

-- Legacy writers read v2 immutable terms while preserving every old formula.
SELECT pg_temp.booking_bill_patch_v2('public.task10_legacy_price_v1(uuid,uuid,integer,integer,integer,uuid)',
 'v_paid numeric:=0;','v_paid numeric:=0; v_terms jsonb;','legacy-price-declare');
SELECT pg_temp.booking_bill_patch_v2('public.task10_legacy_price_v1(uuid,uuid,integer,integer,integer,uuid)',
 '-- A table SHARE lock also prevents a new effective-tier phantom during calculation.',
 $patch$
 IF v_name IN ('adult_group','private') THEN
  IF p_booking IS NOT NULL THEN SELECT package_snapshot INTO v_terms FROM bookings WHERE id=p_booking AND user_id=p_user AND course_type_id=p_course;
  ELSE v_terms:=nullif(current_setting('booking_ux.create',true),'')::jsonb->'package';END IF;
  IF v_terms->>'policyVersion'='2' THEN
   IF v_terms->>'course' IS DISTINCT FROM v_name OR (v_terms->>'unitRate')::numeric IS NULL THEN RAISE EXCEPTION 'BOOKING_UX_PACKAGE_CHANGED';END IF;
   RETURN CASE WHEN public.booking_bill_per_session_v2(v_terms) THEN round(p_quantity*(v_terms->>'unitRate')::numeric,2) ELSE (v_terms->>'price')::numeric END;
  END IF;
 END IF;
 -- A table SHARE lock also prevents a new effective-tier phantom during calculation.
 $patch$,'legacy-price-v2');

SELECT pg_temp.booking_bill_patch_v2('public.task10_write_legacy_booking_v1(uuid,text,uuid,jsonb)',
 'v_final:=greatest(0,v_gross-v_discount);',
 $patch$
 v_final:=greatest(0,v_gross-v_discount);
 IF nullif(current_setting('booking_ux.create',true),'')::jsonb->'package'->>'policyVersion'='2'
  AND ((p_input->>'totalAmount')::numeric IS DISTINCT FROM v_gross OR
   (coalesce(current_setting('booking_ux.set_edit',true),'')<>'true' AND (p_input->>'expectedTotalPrice')::numeric IS DISTINCT FROM v_final))
 THEN RAISE EXCEPTION 'TASK10_AMOUNT_CONFLICT';END IF;
 $patch$,'legacy-v2-exact-amount');

-- New checkout requests require the new intent after durable replay has won.
SELECT pg_temp.booking_bill_patch_v2('public.booking_ux_create_v1(uuid,uuid,jsonb)',
 'SELECT name::text INTO v_course FROM course_types WHERE id=(p_input->>''courseTypeId'')::uuid;',
 $patch$
 PERFORM pg_advisory_xact_lock_shared(10,1);
 IF (SELECT enabled FROM booking_bill_policy_control WHERE singleton) THEN
  IF p_input->>'purchasePolicyVersion' IS DISTINCT FROM '2' THEN RAISE EXCEPTION 'BOOKING_UX_REFRESH_REQUIRED';END IF;
 ELSIF p_input->>'purchasePolicyVersion'='2' THEN RAISE EXCEPTION 'BOOKING_BILL_POLICY_DISABLED';END IF;
 SELECT name::text INTO v_course FROM course_types WHERE id=(p_input->>'courseTypeId')::uuid;
 $patch$,'create-intent');
SELECT pg_temp.booking_bill_patch_v2('public.booking_ux_create_v1(uuid,uuid,jsonb)',
 'v_quantity:=v_package.quantity; IF v_quantity>1 THEN',
 'v_quantity:=v_package.quantity; IF (SELECT enabled FROM booking_bill_policy_control WHERE singleton) AND v_package.quantity=1 THEN v_quantity:=(p_input->>''totalSessions'')::integer;IF v_quantity IS NULL OR v_quantity NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION ''BOOKING_UX_PACKAGE_QUANTITY'';END IF;END IF; IF v_package.quantity>1 THEN','create-quantity');
SELECT pg_temp.booking_bill_patch_v2('public.booking_ux_create_v1(uuid,uuid,jsonb)',
 'IF v_count>v_quantity OR (v_quantity=1 AND v_count<>1) THEN',
 'IF v_count>v_quantity OR (v_package.quantity=1 AND v_count<>v_quantity) THEN','create-selected-count');
SELECT pg_temp.booking_bill_patch_v2('public.booking_ux_create_v1(uuid,uuid,jsonb)',
 'PERFORM set_config(''booking_ux.create'',jsonb_build_object(''package'',v_policy,''participants'',v_participants)::text,true);',
 $patch$
 IF (SELECT enabled FROM booking_bill_policy_control WHERE singleton) THEN
  v_policy:=public.booking_bill_package_terms_v2(p_actor,(p_input->>'courseTypeId')::uuid,v_package.id,v_package.revision)
    ||jsonb_build_object('lessonMonth',to_char(make_date((p_input->>'year')::integer,(p_input->>'month')::integer,1),'YYYY-MM'));
  IF public.booking_bill_per_session_v2(v_policy) AND EXISTS(SELECT 1 FROM jsonb_array_elements(v_sessions)x WHERE to_char((x->>'date')::date,'YYYY-MM')<>v_policy->>'lessonMonth') THEN RAISE EXCEPTION 'TASK10_TARGET_MONTH';END IF;
 END IF;
 PERFORM set_config('booking_ux.create',jsonb_build_object('package',v_policy,'participants',v_participants)::text,true);
 $patch$,'create-terms');

-- Only new explicit singles may vary quantity. All receipt, row/slot locks,
-- coupon, fixed-roster and started-session fences remain in the real writer.
SELECT pg_temp.booking_bill_patch_v2('public.booking_ux_update_v1(uuid,uuid,jsonb)',
 'IF n>b.total_sessions OR (b.total_sessions=1 AND n<>1) THEN',
 'IF (public.booking_bill_per_session_v2(b.package_snapshot) AND n<1) OR (NOT public.booking_bill_per_session_v2(b.package_snapshot) AND (n>b.total_sessions OR (b.total_sessions=1 AND n<>1))) THEN','update-count');
SELECT pg_temp.booking_bill_patch_v2('public.booking_ux_update_v1(uuid,uuid,jsonb)',
 'IF (b.package_snapshot->>''quantity'')::integer>1 THEN',
 $patch$
 IF public.booking_bill_per_session_v2(b.package_snapshot) THEN
  IF (p_input->>'month')::integer IS DISTINCT FROM b.month OR (p_input->>'year')::integer IS DISTINCT FROM b.year
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(s)x WHERE to_char((x->>'date')::date,'YYYY-MM') IS DISTINCT FROM b.package_snapshot->>'lessonMonth') THEN RAISE EXCEPTION 'TASK10_TARGET_MONTH';END IF;
 END IF;
 IF (b.package_snapshot->>'quantity')::integer>1 THEN
 $patch$,'update-month');
SELECT pg_temp.booking_bill_patch_v2('public.booking_ux_update_v1(uuid,uuid,jsonb)',
 '''totalSessions'',b.total_sessions,''learnerType''',
 '''totalSessions'',CASE WHEN public.booking_bill_per_session_v2(b.package_snapshot) THEN n ELSE b.total_sessions END,''learnerType''','update-total');

-- The multi-bill editor uses actual distinct time units for new singles,
-- including Private Family rows, and cannot move their source lesson month.
SELECT pg_temp.booking_bill_patch_v2('public.booking_ux_edit_set_v1(uuid,uuid,jsonb,boolean)',
 'CASE WHEN b.package_snapshot IS NULL THEN jsonb_array_length(ss) ELSE b.total_sessions END',
 'CASE WHEN public.booking_bill_per_session_v2(b.package_snapshot) THEN (SELECT count(DISTINCT(x->>''date'',x->>''startTime'',x->>''endTime'',x->>''branchId''))::int FROM jsonb_array_elements(ss)x) WHEN b.package_snapshot IS NULL THEN jsonb_array_length(ss) ELSE b.total_sessions END','editor-count');
SELECT pg_temp.booking_bill_patch_v2('public.booking_ux_edit_set_v1(uuid,uuid,jsonb,boolean)',
 'CASE WHEN b.package_snapshot IS NOT NULL AND jsonb_array_length(ss)>0 THEN',
 'CASE WHEN b.package_snapshot IS NOT NULL AND NOT public.booking_bill_per_session_v2(b.package_snapshot) AND jsonb_array_length(ss)>0 THEN','editor-month');

-- Defend quantity and same-month terms at the row boundary as well as the API.
SELECT pg_temp.booking_bill_patch_v2('public.booking_ux_bill_guard_v1()',
 'IF ROW(NEW.checkout_version,NEW.checkout_deadline,NEW.package_snapshot)',
 $patch$
 IF public.booking_bill_per_session_v2(OLD.package_snapshot) THEN
  IF ROW(NEW.year,NEW.month) IS DISTINCT FROM ROW(OLD.year,OLD.month) THEN RAISE EXCEPTION 'TASK10_TARGET_MONTH';END IF;
  IF NEW.total_sessions IS DISTINCT FROM OLD.total_sessions AND NOT(
    OLD.status::text='pending_payment' AND NEW.status::text='pending_payment'
    AND coalesce(nullif(current_setting('booking_ux.create',true),'')::jsonb->'package'=OLD.package_snapshot,false)
    AND NOT public.task10_has_accepted_receipt_v1(OLD.id)) THEN RAISE EXCEPTION 'BOOKING_UX_IMMUTABLE_BILL';END IF;
 END IF;
 IF ROW(NEW.checkout_version,NEW.checkout_deadline,NEW.package_snapshot)
 $patch$,'bill-quantity-fence');

-- All new singles are fully scheduled. No unassigned package entitlement may
-- be created even if a future writer omits a unit. Existing packages unchanged.
SELECT pg_temp.booking_bill_patch_v2('public.booking_ux_issue_units_v1()',
 'IF v_count>NEW.total_sessions THEN',
 'IF public.booking_bill_per_session_v2(NEW.package_snapshot) AND v_count<>NEW.total_sessions THEN RAISE EXCEPTION ''BOOKING_UX_PACKAGE_QUANTITY'';END IF; IF v_count>NEW.total_sessions THEN','issue-single-units');

-- Store uses captured forward-only terms for v2; old bills retain historical
-- payment-date tier lookup. Inherited credits always keep their stored expiry.
DO $patch$
DECLARE name text;d text;a text;b text;
BEGIN
 FOREACH name IN ARRAY ARRAY['task10_previous_wallet_store_v2','admin_wallet_store_body_v1'] LOOP
  SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname=name;
  a:='booking.total_sessions,';
  IF position(a IN d)=0 THEN RAISE EXCEPTION 'BOOKING_BILL_STORE_SELECT_DRIFT %',name;END IF;
  d:=replace(d,a,'booking.total_sessions, booking.package_snapshot,');
  a:=E'      IF v_selected.course_name = ''private'' THEN\n        SELECT max(tier.min_sessions)';
  b:=$body$
      IF v_selected.package_snapshot->>'policyVersion'='2' THEN
        v_tier:=jsonb_populate_record(NULL::public.pricing_tiers,v_selected.package_snapshot->'tierEvidence');
        IF v_tier.id IS NULL OR v_tier.course_type_id IS DISTINCT FROM v_selected.course_type_id
          OR (v_selected.package_snapshot->>'unitRate')::numeric IS DISTINCT FROM v_tier.price_per_session
          OR v_selected.package_snapshot->>'purchaseMode' NOT IN ('per_session','package') THEN RAISE EXCEPTION 'LESSON_WALLET_TIER_EVIDENCE_MISSING';END IF;
      ELSE
      IF v_selected.course_name = 'private' THEN
        SELECT max(tier.min_sessions)
  $body$;
  IF position(a IN d)=0 THEN RAISE EXCEPTION 'BOOKING_BILL_STORE_TIER_DRIFT %',name;END IF;
  d:=replace(d,a,b);
  a:='      v_tier_id := v_tier.id;';
  IF position(a IN d)=0 THEN RAISE EXCEPTION 'BOOKING_BILL_STORE_END_DRIFT %',name;END IF;
  d:=replace(d,a,'      END IF; '||a);
  a:='v_selected.total_sessions > 1';
  IF position(a IN d)=0 THEN RAISE EXCEPTION 'BOOKING_BILL_STORE_POLICY_DRIFT %',name;END IF;
  d:=replace(d,a,'v_selected.total_sessions > 1 AND NOT public.booking_bill_per_session_v2(v_selected.package_snapshot)');
  a:='''policy_type'', v_policy,';
  d:=replace(d,a,'''purchase_terms'', CASE WHEN v_selected.package_snapshot->>''policyVersion''=''2'' THEN v_selected.package_snapshot END, '||a);
  EXECUTE d;
 END LOOP;
END $patch$;

REVOKE ALL ON FUNCTION public.booking_bill_per_session_v2(jsonb),public.booking_bill_kids_per_bill_v2(uuid),
 public.booking_bill_package_terms_v2(uuid,uuid,text,bigint),public.booking_bill_package_quote_v2(uuid,uuid,integer,text,bigint,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.booking_bill_package_quote_v2(uuid,uuid,integer,text,bigint,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
