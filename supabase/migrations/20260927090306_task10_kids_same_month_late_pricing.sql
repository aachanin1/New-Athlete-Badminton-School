-- Forward-only catalog selection. No business rows, controls or prior evidence are rewritten.
-- The one-time operational cutover embeds these exact bytes in its bounded transaction.
CREATE OR REPLACE FUNCTION public.task10_booking_policy_quote_v1(p_user_id uuid,p_course_type_id uuid,p_lesson_month date,
  p_formula text,p_booking_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.task10_policy_activation%ROWTYPE; c public.task10_pricing_catalog_versions%ROWTYPE;
  e public.task10_booking_pricing_evidence%ROWTYPE; b public.bookings%ROWTYPE; v_now timestamptz; v_date date;
  v_regime text; v_kind text:='legacy_compatibility'; v_catalog jsonb; v_revision bigint:=0; v_fingerprint text;
  v_selection_rule text;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  PERFORM pg_advisory_xact_lock_shared(10,3);
  IF p_user_id IS NULL OR p_lesson_month IS NULL OR p_lesson_month<>date_trunc('month',p_lesson_month)::date
    OR p_formula IS NULL OR p_formula NOT IN ('legacy','progressive')
    OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user_id)
    OR NOT EXISTS(SELECT 1 FROM public.course_types WHERE id=p_course_type_id AND name::text='kids_group') THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
  SELECT * INTO a FROM public.task10_policy_activation WHERE singleton;
  v_now:=public.task10_clock_v1(); v_date:=(v_now AT TIME ZONE 'Asia/Bangkok')::date;
  IF p_booking_id IS NOT NULL THEN
    SELECT * INTO b FROM public.bookings WHERE id=p_booking_id AND user_id=p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'TASK10_UNAUTHORIZED'; END IF;
    IF b.course_type_id<>p_course_type_id OR make_date(b.year,b.month,1)<>p_lesson_month
      OR (CASE WHEN b.pricing_scope_id IS NULL THEN 'legacy' ELSE 'progressive' END)<>p_formula THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
    v_revision:=coalesce(b.pricing_revision,0);
    SELECT * INTO e FROM public.task10_booking_pricing_evidence WHERE booking_id=b.id;
    IF FOUND THEN
      SELECT * INTO c FROM public.task10_pricing_catalog_versions WHERE id=e.catalog_version_id;
      IF NOT FOUND OR c.fingerprint<>e.evidence->'catalog'->>'hash' THEN RAISE EXCEPTION 'TASK10_INVALID_PRICE_EVIDENCE'; END IF;
      v_date:=e.bangkok_date; v_kind:='booking_catalog';
      v_selection_rule:=e.evidence->>'selectionRuleVersion';
    ELSIF a.effective_at IS NOT NULL AND b.created_at>=a.effective_at THEN
      RAISE EXCEPTION 'TASK10_MISSING_PRICE_EVIDENCE';
    END IF;
  ELSIF a.effective_at IS NOT NULL THEN
    IF NOT a.pricing_enabled OR a.state<>'active' THEN RAISE EXCEPTION 'TASK10_PRICING_PAUSED'; END IF;
    v_regime:=CASE WHEN extract(day FROM v_date)>=16 AND p_lesson_month=date_trunc('month',v_date)::date THEN 'late' ELSE 'early' END;
    v_selection_rule:='kids_same_month_v2';
    SELECT v.* INTO c FROM public.task10_pricing_catalog_heads h JOIN public.task10_pricing_catalog_versions v ON v.id=h.version_id WHERE h.regime=v_regime;
    IF NOT FOUND THEN RAISE EXCEPTION 'TASK10_CATALOG_UNAVAILABLE'; END IF;
    v_kind:='booking_catalog';
  END IF;
  IF c.id IS NOT NULL THEN
    v_catalog:=jsonb_build_object('versionId',c.id,'regime',c.regime,'revision',c.revision,'hash',c.fingerprint,'tiers',c.tiers);
  END IF;
  -- concat_ws omits NULL: old evidence retains the exact original fingerprint contract.
  v_fingerprint:=encode(extensions.digest(concat_ws('|',v_kind,a.revision,p_lesson_month,p_formula,
    coalesce(p_booking_id::text,''),v_revision,v_date,coalesce(c.id::text,''),coalesce(c.fingerprint,''),v_selection_rule),'sha256'),'hex');
  RETURN jsonb_build_object('kind',v_kind,'activationRevision',a.revision,'serverTime',v_now,'bangkokDate',v_date,
    'lessonMonth',to_char(p_lesson_month,'YYYY-MM'),'formula',p_formula,'catalog',v_catalog,'calculationRevision',v_revision,'fingerprint',v_fingerprint)
    || CASE WHEN v_selection_rule IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('selectionRuleVersion',v_selection_rule) END;
END $$;
