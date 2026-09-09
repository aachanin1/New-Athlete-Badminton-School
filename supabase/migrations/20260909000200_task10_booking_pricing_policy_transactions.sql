BEGIN;

CREATE FUNCTION public.task10_policy_status_v1() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object('state',state,'revision',revision,'effectiveAt',effective_at,
    'pricingEnabled',pricing_enabled,'makeupEnabled',makeup_enabled,'expiryEnabled',expiry_enabled)
  FROM public.task10_policy_activation WHERE singleton
$$;
REVOKE ALL ON FUNCTION public.task10_policy_status_v1() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.task10_policy_status_v1() TO service_role;

CREATE FUNCTION public.task10_require_actor_v1(p_actor_id uuid, p_permission text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_role text; v_keys jsonb;
BEGIN
  -- RPCs are service-only; the web API derives this actor from auth.getUser().
  SELECT role::text INTO v_role FROM public.profiles WHERE id=p_actor_id;
  IF v_role='super_admin' THEN RETURN; END IF;
  IF p_permission='settings' OR v_role IS DISTINCT FROM 'admin' OR p_permission NOT IN ('makeup','payments') THEN
    RAISE EXCEPTION 'TASK10_UNAUTHORIZED';
  END IF;
  SELECT value->'adminAllowedMenuKeys' INTO v_keys FROM public.system_settings WHERE key='admin_menu_permissions';
  IF jsonb_typeof(v_keys)='array' AND NOT v_keys ? p_permission THEN RAISE EXCEPTION 'TASK10_UNAUTHORIZED'; END IF;
END $$;

CREATE FUNCTION public.task10_read_pricing_catalogs_v1(p_actor_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
  PERFORM public.task10_require_actor_v1(p_actor_id,'settings');
  SELECT jsonb_object_agg(v.regime,jsonb_build_object('versionId',v.id,'regime',v.regime,'revision',v.revision,'hash',v.fingerprint,'tiers',v.tiers))
  INTO v_result FROM public.task10_pricing_catalog_heads h JOIN public.task10_pricing_catalog_versions v ON v.id=h.version_id;
  RETURN jsonb_build_object('early',NULL,'late',NULL) || coalesce(v_result,'{}'::jsonb)
    || jsonb_build_object('active',(SELECT pricing_enabled FROM public.task10_policy_activation WHERE singleton));
END $$;

CREATE FUNCTION public.task10_save_pricing_catalog_v1(p_actor_id uuid,p_regime text,p_expected_revision bigint,p_tiers jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_old public.task10_pricing_catalog_versions%ROWTYPE; v_new public.task10_pricing_catalog_versions%ROWTYPE; v_tiers jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  PERFORM pg_advisory_xact_lock(10,3);
  PERFORM public.task10_require_actor_v1(p_actor_id,'settings');
  IF p_regime IS NULL OR p_regime NOT IN ('early','late') OR p_expected_revision IS NULL OR p_expected_revision<0
    OR NOT public.task10_tiers_valid_v1(p_tiers) THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
  SELECT v.* INTO v_old FROM public.task10_pricing_catalog_heads h JOIN public.task10_pricing_catalog_versions v ON v.id=h.version_id WHERE h.regime=p_regime;
  IF coalesce(v_old.revision,0)<>p_expected_revision THEN RAISE EXCEPTION 'TASK10_REVISION_CONFLICT'; END IF;
  SELECT jsonb_agg(jsonb_build_object('id',NULL,'minSessions',(r->>'minSessions')::integer,'maxSessions',(r->>'maxSessions')::integer,'ratePerSession',(r->>'ratePerSession')::numeric) ORDER BY (r->>'minSessions')::integer)
  INTO v_tiers FROM jsonb_array_elements(p_tiers) r;
  INSERT INTO public.task10_pricing_catalog_versions(regime,revision,tiers,fingerprint,actor_id)
  VALUES(p_regime,coalesce(v_old.revision,0)+1,v_tiers,encode(extensions.digest(v_tiers::text,'sha256'),'hex'),p_actor_id) RETURNING * INTO v_new;
  INSERT INTO public.task10_pricing_catalog_heads(regime,version_id) VALUES(p_regime,v_new.id)
  ON CONFLICT(regime) DO UPDATE SET version_id=excluded.version_id;
  INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details)
  VALUES(p_actor_id,'task10_kids_pricing_saved','task10_pricing_catalog',v_new.id,
    jsonb_build_object('regime',p_regime,'oldVersion',v_old.id,'newVersion',v_new.id,'revision',v_new.revision));
  RETURN jsonb_build_object('versionId',v_new.id,'regime',v_new.regime,'revision',v_new.revision,'hash',v_new.fingerprint,'tiers',v_new.tiers);
END $$;

REVOKE ALL ON FUNCTION public.task10_require_actor_v1(uuid,text),public.task10_read_pricing_catalogs_v1(uuid),
  public.task10_save_pricing_catalog_v1(uuid,text,bigint,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.task10_read_pricing_catalogs_v1(uuid),public.task10_save_pricing_catalog_v1(uuid,text,bigint,jsonb) TO service_role;
CREATE FUNCTION public.task10_booking_policy_quote_v1(p_user_id uuid,p_course_type_id uuid,p_lesson_month date,
  p_formula text,p_booking_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.task10_policy_activation%ROWTYPE; c public.task10_pricing_catalog_versions%ROWTYPE;
  e public.task10_booking_pricing_evidence%ROWTYPE; b public.bookings%ROWTYPE; v_now timestamptz; v_date date;
  v_regime text; v_kind text:='legacy_compatibility'; v_catalog jsonb; v_revision bigint:=0; v_fingerprint text;
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
    ELSIF a.effective_at IS NOT NULL AND b.created_at>=a.effective_at THEN
      RAISE EXCEPTION 'TASK10_MISSING_PRICE_EVIDENCE';
    END IF;
  ELSIF a.effective_at IS NOT NULL THEN
    IF NOT a.pricing_enabled OR a.state<>'active' THEN RAISE EXCEPTION 'TASK10_PRICING_PAUSED'; END IF;
    v_regime:=CASE WHEN extract(day FROM v_date)<=15 THEN 'early' ELSE 'late' END;
    SELECT v.* INTO c FROM public.task10_pricing_catalog_heads h JOIN public.task10_pricing_catalog_versions v ON v.id=h.version_id WHERE h.regime=v_regime;
    IF NOT FOUND THEN RAISE EXCEPTION 'TASK10_CATALOG_UNAVAILABLE'; END IF;
    v_kind:='booking_catalog';
  END IF;
  IF c.id IS NOT NULL THEN
    v_catalog:=jsonb_build_object('versionId',c.id,'regime',c.regime,'revision',c.revision,'hash',c.fingerprint,'tiers',c.tiers);
  END IF;
  v_fingerprint:=encode(extensions.digest(concat_ws('|',v_kind,a.revision,p_lesson_month,p_formula,
    coalesce(p_booking_id::text,''),v_revision,v_date,coalesce(c.id::text,''),coalesce(c.fingerprint,'')),'sha256'),'hex');
  RETURN jsonb_build_object('kind',v_kind,'activationRevision',a.revision,'serverTime',v_now,'bangkokDate',v_date,
    'lessonMonth',to_char(p_lesson_month,'YYYY-MM'),'formula',p_formula,'catalog',v_catalog,'calculationRevision',v_revision,'fingerprint',v_fingerprint);
END $$;

CREATE FUNCTION public.task10_effective_scope_baseline_v1(p_scope_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path=public,pg_temp AS $$
DECLARE s public.booking_pricing_scopes%ROWTYPE; d public.task10_legacy_baseline_deltas%ROWTYPE;
  v_sessions integer; v_fingerprint text; v_revision bigint:=0;
BEGIN
  SELECT * INTO s FROM public.booking_pricing_scopes WHERE id=p_scope_id;
  IF NOT FOUND OR s.legacy_baseline_initialized_at IS NULL THEN RAISE EXCEPTION 'PROGRESSIVE_LEGACY_BASELINE_DRIFT'; END IF;
  v_sessions:=s.legacy_baseline_sessions; v_fingerprint:=s.legacy_baseline_fingerprint;
  FOR d IN SELECT * FROM public.task10_legacy_baseline_deltas WHERE scope_id=p_scope_id ORDER BY revision LOOP
    IF d.revision<>v_revision+1 OR d.previous_fingerprint IS DISTINCT FROM v_fingerprint
      OR NOT EXISTS(SELECT 1 FROM public.task10_booking_cancellations WHERE booking_id=d.booking_id)
      THEN RAISE EXCEPTION 'PROGRESSIVE_LEGACY_BASELINE_DRIFT'; END IF;
    v_sessions:=v_sessions+d.entitlement_delta; v_fingerprint:=d.next_fingerprint; v_revision:=d.revision;
  END LOOP;
  IF v_sessions<0 OR v_sessions IS NULL OR v_fingerprint IS NULL THEN RAISE EXCEPTION 'PROGRESSIVE_LEGACY_BASELINE_DRIFT'; END IF;
  RETURN jsonb_build_object('sessions',v_sessions,'fingerprint',v_fingerprint,'deltaRevision',v_revision);
END $$;

CREATE FUNCTION public.task10_lock_pricing_scope_v1(p_user_id uuid,p_course_type_id uuid,p_year integer,p_month integer) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_scope uuid; v_batch uuid;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  PERFORM pg_advisory_xact_lock_shared(10,2);
  PERFORM pg_advisory_xact_lock_shared(10,3);
  IF p_user_id IS NULL OR p_course_type_id IS NULL OR p_year NOT BETWEEN 1 AND 9999 OR p_month NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
  -- M3 defines the family-key helper; no activation can precede all five files.
  PERFORM public.task10_lock_family_months_v1(p_user_id,ARRAY[make_date(p_year,p_month,1)]);
  PERFORM pg_advisory_xact_lock(hashtextextended(concat_ws('|',p_user_id,p_course_type_id,p_year,p_month,'THB'),0));
  SELECT id,locked_by_payment_batch_id INTO v_scope,v_batch FROM public.booking_pricing_scopes
    WHERE user_id=p_user_id AND course_type_id=p_course_type_id AND lesson_year=p_year AND lesson_month=p_month AND currency='THB' FOR UPDATE;
  IF v_batch IS NOT NULL THEN PERFORM 1 FROM public.progressive_payment_batches WHERE id=v_batch FOR UPDATE; END IF;
  PERFORM 1 FROM public.bookings WHERE user_id=p_user_id AND course_type_id=p_course_type_id AND year=p_year AND month=p_month ORDER BY id FOR UPDATE;
  PERFORM set_config('task10.booking_write','authorized',true);
  PERFORM set_config('task10.source_write','authorized',true);
END $$;

CREATE FUNCTION public.task10_guard_booking_write_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_kids boolean; v_changed boolean; q jsonb;
BEGIN
  IF NOT public.task10_source_policy_established_v1() THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
  END IF;
  IF TG_OP='INSERT' THEN
    SELECT name::text='kids_group' INTO v_kids FROM public.course_types WHERE id=NEW.course_type_id;
    v_changed:=true;
  ELSE
    SELECT name::text='kids_group' INTO v_kids FROM public.course_types WHERE id=OLD.course_type_id;
    v_changed:=TG_OP='DELETE';
    IF TG_OP='UPDATE' THEN
      v_changed:=ROW(NEW.user_id,NEW.course_type_id,NEW.year,NEW.month,NEW.status,NEW.total_sessions,NEW.entitlement_sessions,
        NEW.total_price,NEW.created_at,NEW.expires_at,NEW.pricing_scope_id,NEW.pricing_revision,NEW.pricing_rate_snapshot,NEW.final_price_snapshot)
        IS DISTINCT FROM ROW(OLD.user_id,OLD.course_type_id,OLD.year,OLD.month,OLD.status,OLD.total_sessions,OLD.entitlement_sessions,
        OLD.total_price,OLD.created_at,OLD.expires_at,OLD.pricing_scope_id,OLD.pricing_revision,OLD.pricing_rate_snapshot,OLD.final_price_snapshot);
      v_kids:=v_kids OR EXISTS(SELECT 1 FROM public.course_types WHERE id=NEW.course_type_id AND name::text='kids_group');
    END IF;
  END IF;
  IF v_kids AND v_changed THEN
    IF current_user NOT IN ('postgres','supabase_admin') OR current_setting('task10.booking_write',true) IS DISTINCT FROM 'authorized'
      THEN RAISE EXCEPTION 'TASK10_GUARDED_BOOKING'; END IF;
    IF TG_OP='INSERT' THEN
      q:=public.task10_booking_policy_quote_v1(NEW.user_id,NEW.course_type_id,make_date(NEW.year,NEW.month,1),
        CASE WHEN NEW.pricing_scope_id IS NULL THEN 'legacy' ELSE 'progressive' END,NULL);
      IF q->>'fingerprint' IS DISTINCT FROM current_setting('task10.expected_policy',true) THEN RAISE EXCEPTION 'TASK10_PREVIEW_CONFLICT'; END IF;
      NEW.created_at:=(q->>'serverTime')::timestamptz;
      PERFORM set_config('task10.insert_policy',q::text,true);
    ELSIF TG_OP='UPDATE' AND NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'TASK10_IMMUTABLE_PRICE_ORIGIN';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER task10_booking_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.task10_guard_booking_write_v1();

CREATE FUNCTION public.task10_capture_booking_policy_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE q jsonb;
BEGIN
  IF public.task10_source_policy_established_v1() AND EXISTS(SELECT 1 FROM public.course_types WHERE id=NEW.course_type_id AND name::text='kids_group') THEN
    q:=nullif(current_setting('task10.insert_policy',true),'')::jsonb;
    IF q IS NULL OR q->'catalog' IS NULL OR (q->>'serverTime')::timestamptz<>NEW.created_at THEN RAISE EXCEPTION 'TASK10_MISSING_PRICE_EVIDENCE'; END IF;
    INSERT INTO public.task10_booking_pricing_evidence(booking_id,activation_revision,successful_created_at,bangkok_date,lesson_month,formula,catalog_version_id,evidence,fingerprint)
    VALUES(NEW.id,(q->>'activationRevision')::bigint,NEW.created_at,(q->>'bangkokDate')::date,make_date(NEW.year,NEW.month,1),q->>'formula',
      (q->'catalog'->>'versionId')::uuid,q||jsonb_build_object('createdAt',NEW.created_at,'calculationRevision',coalesce(NEW.pricing_revision,1)),q->>'fingerprint');
    PERFORM set_config('task10.insert_policy','',true);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER task10_capture_booking_policy AFTER INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.task10_capture_booking_policy_v1();

CREATE FUNCTION public.task10_booking_tier_v1(p_booking_id uuid,p_cumulative integer)
RETURNS TABLE(id uuid,min_sessions integer,max_sessions integer,price_per_session numeric)
LANGUAGE plpgsql STABLE SET search_path=public,pg_temp AS $$
DECLARE b public.bookings%ROWTYPE; e public.task10_booking_pricing_evidence%ROWTYPE; v_count integer;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE bookings.id=p_booking_id;
  SELECT * INTO e FROM public.task10_booking_pricing_evidence WHERE booking_id=p_booking_id;
  IF FOUND THEN
    SELECT count(*) INTO v_count FROM jsonb_array_elements(e.evidence->'catalog'->'tiers') t
      WHERE p_cumulative>=(t->>'minSessions')::integer AND ((t->>'maxSessions') IS NULL OR p_cumulative<=(t->>'maxSessions')::integer);
    IF v_count<>1 THEN RAISE EXCEPTION 'TASK10_INVALID_PRICE_EVIDENCE'; END IF;
    RETURN QUERY SELECT (t->>'id')::uuid,(t->>'minSessions')::integer,(t->>'maxSessions')::integer,(t->>'ratePerSession')::numeric
      FROM jsonb_array_elements(e.evidence->'catalog'->'tiers') t
      WHERE p_cumulative>=(t->>'minSessions')::integer AND ((t->>'maxSessions') IS NULL OR p_cumulative<=(t->>'maxSessions')::integer);
  ELSE
    -- Explicit pre-activation compatibility; never invent a historical catalog.
    IF EXISTS(SELECT 1 FROM public.task10_policy_activation WHERE effective_at IS NOT NULL AND b.created_at>=effective_at)
      THEN RAISE EXCEPTION 'TASK10_MISSING_PRICE_EVIDENCE'; END IF;
    RETURN QUERY SELECT t.id,t.min_sessions,t.max_sessions,t.price_per_session::numeric FROM public.pricing_tiers t
      WHERE t.course_type_id=b.course_type_id AND t.valid_from<=current_date AND (t.valid_to IS NULL OR t.valid_to>=current_date)
        AND p_cumulative>=t.min_sessions AND (t.max_sessions IS NULL OR p_cumulative<=t.max_sessions)
      ORDER BY t.valid_from DESC,t.min_sessions DESC,t.id LIMIT 1;
  END IF;
END $$;

CREATE FUNCTION public.task10_guard_primary_kids_tiers_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF public.task10_source_policy_established_v1() AND EXISTS(SELECT 1 FROM public.course_types
    WHERE name::text='kids_group' AND (
      (TG_OP<>'INSERT' AND id=OLD.course_type_id) OR
      (TG_OP<>'DELETE' AND id=NEW.course_type_id))) THEN
    RAISE EXCEPTION 'TASK10_VERSIONED_CATALOG_REQUIRED';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER task10_primary_kids_tiers_guard BEFORE INSERT OR UPDATE OR DELETE ON public.pricing_tiers FOR EACH ROW EXECUTE FUNCTION public.task10_guard_primary_kids_tiers_v1();

REVOKE ALL ON FUNCTION public.task10_booking_policy_quote_v1(uuid,uuid,date,text,uuid),public.task10_effective_scope_baseline_v1(uuid),
  public.task10_lock_pricing_scope_v1(uuid,uuid,integer,integer),public.task10_guard_booking_write_v1(),public.task10_capture_booking_policy_v1(),
  public.task10_booking_tier_v1(uuid,integer),public.task10_guard_primary_kids_tiers_v1() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.task10_booking_policy_quote_v1(uuid,uuid,date,text,uuid),public.task10_effective_scope_baseline_v1(uuid) TO service_role;
CREATE FUNCTION public.task10_record_scope_calculations_v1(p_scope_id uuid,p_revision bigint) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r record; v_evidence jsonb;
BEGIN
  FOR r IN SELECT b.*,e.catalog_version_id,e.fingerprint FROM public.bookings b
    JOIN public.task10_booking_pricing_evidence e ON e.booking_id=b.id
    WHERE b.pricing_scope_id=p_scope_id AND b.pricing_revision=p_revision AND b.status::text='pending_payment' ORDER BY b.id LOOP
    v_evidence:=jsonb_build_object('policyFingerprint',r.fingerprint,'entitlement',coalesce(r.entitlement_sessions,r.total_sessions),
      'before',r.cumulative_sessions_before,'after',r.cumulative_sessions_after,'rate',r.pricing_rate_snapshot,
      'gross',r.gross_price_snapshot,'discount',r.coupon_discount_snapshot,'final',r.final_price_snapshot,'formula','progressive');
    IF EXISTS(SELECT 1 FROM public.task10_booking_calculations WHERE booking_id=r.id AND revision=p_revision AND evidence IS DISTINCT FROM v_evidence)
      THEN RAISE EXCEPTION 'TASK10_CALCULATION_CONFLICT'; END IF;
    INSERT INTO public.task10_booking_calculations(booking_id,revision,catalog_version_id,evidence)
      VALUES(r.id,p_revision,r.catalog_version_id,v_evidence) ON CONFLICT(booking_id,revision) DO NOTHING;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.task10_record_scope_calculations_v1(uuid,bigint) FROM PUBLIC,anon,authenticated,service_role;
-- Task10 overrides of existing Progressive transactions. Original guards are
-- retained; changes add prelocks, retained catalogs and append-only calculations.
CREATE OR REPLACE FUNCTION public.progressive_acquire_scope_v1(
  p_user_id uuid,
  p_course_type_id uuid,
  p_lesson_year integer,
  p_lesson_month integer,
  p_expected_scope_revision bigint
)
RETURNS TABLE (scope_id uuid, new_revision bigint)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scope public.booking_pricing_scopes%ROWTYPE;
  v_baseline_sessions integer;
  v_baseline_fingerprint text;
  v_effective jsonb;
BEGIN
  IF p_expected_scope_revision IS NULL OR p_expected_scope_revision < 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_user_id::text || '|' || p_course_type_id::text || '|' || p_lesson_year::text
      || '|' || p_lesson_month::text || '|THB',
    0
  ));

  SELECT baseline.baseline_sessions, baseline.baseline_fingerprint
  INTO v_baseline_sessions, v_baseline_fingerprint
  FROM public.progressive_legacy_baseline_v1(
    p_user_id, p_course_type_id, p_lesson_year, p_lesson_month
  ) baseline;

  SELECT scope.*
  INTO v_scope
  FROM public.booking_pricing_scopes scope
  WHERE scope.user_id = p_user_id
    AND scope.course_type_id = p_course_type_id
    AND scope.lesson_year = p_lesson_year
    AND scope.lesson_month = p_lesson_month
    AND scope.currency = 'THB'
  FOR UPDATE;

  IF NOT FOUND THEN
    IF p_expected_scope_revision <> 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_SCOPE_REVISION_CONFLICT';
    END IF;

    INSERT INTO public.booking_pricing_scopes (
      user_id, course_type_id, lesson_year, lesson_month, currency, revision,
      legacy_baseline_sessions, legacy_baseline_fingerprint,
      legacy_baseline_initialized_at
    ) VALUES (
      p_user_id, p_course_type_id, p_lesson_year, p_lesson_month, 'THB', 1,
      v_baseline_sessions, v_baseline_fingerprint, transaction_timestamp()
    )
    RETURNING id, revision INTO scope_id, new_revision;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_scope.locked_by_payment_batch_id IS NOT NULL OR v_scope.locked_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_SCOPE_LOCKED';
  END IF;

  IF v_scope.revision <> p_expected_scope_revision THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_SCOPE_REVISION_CONFLICT';
  END IF;

  IF v_scope.legacy_baseline_initialized_at IS NULL THEN
    -- Existing pre-compatibility Progressive scopes may initialize lazily only
    -- when the authoritative eligible Legacy set is empty.
    IF v_baseline_sessions <> 0
      OR v_baseline_fingerprint IS DISTINCT FROM
        encode(extensions.digest('', 'sha256'), 'hex')
    THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_LEGACY_BASELINE_DRIFT';
    END IF;

    UPDATE public.booking_pricing_scopes
    SET
      legacy_baseline_sessions = 0,
      legacy_baseline_fingerprint = v_baseline_fingerprint,
      legacy_baseline_initialized_at = transaction_timestamp(),
      revision = revision + 1
    WHERE id = v_scope.id
    RETURNING id, revision INTO scope_id, new_revision;
    RETURN NEXT;
    RETURN;
  END IF;

  v_effective := public.task10_effective_scope_baseline_v1(v_scope.id);
  IF (v_effective->>'sessions')::integer IS DISTINCT FROM v_baseline_sessions
    OR v_effective->>'fingerprint' IS DISTINCT FROM v_baseline_fingerprint
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_LEGACY_BASELINE_DRIFT';
  END IF;

  UPDATE public.booking_pricing_scopes
  SET revision = revision + 1
  WHERE id = v_scope.id
  RETURNING id, revision INTO scope_id, new_revision;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.progressive_reprice_scope_v1(
  p_scope_id uuid,
  p_new_revision bigint,
  p_start_created_at timestamptz DEFAULT NULL,
  p_start_booking_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scope public.booking_pricing_scopes%ROWTYPE;
  v_booking record;
  v_tier record;
  v_sequence integer := 0;
  v_cumulative integer;
  v_entitlement integer;
  v_gross numeric(12, 2);
  v_discount numeric(12, 2);
  v_final numeric(12, 2);
  v_should_reprice boolean;
  v_changes jsonb := '[]'::jsonb;
BEGIN
  SELECT scope.* INTO v_scope
  FROM public.booking_pricing_scopes scope
  WHERE scope.id = p_scope_id;

  IF NOT FOUND OR v_scope.legacy_baseline_initialized_at IS NULL
    OR v_scope.legacy_baseline_sessions IS NULL
    OR v_scope.legacy_baseline_fingerprint IS NULL
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_LEGACY_BASELINE_DRIFT';
  END IF;

  v_cumulative := (public.task10_effective_scope_baseline_v1(p_scope_id)->>'sessions')::integer;

  FOR v_booking IN
    SELECT booking.*
    FROM public.bookings booking
    WHERE booking.pricing_scope_id = p_scope_id
      AND booking.status::text IN ('pending_payment', 'paid', 'verified')
      AND (
        booking.status::text <> 'pending_payment'
        OR booking.expires_at IS NULL
        OR booking.expires_at > transaction_timestamp()
      )
    ORDER BY booking.created_at ASC, booking.id ASC
  LOOP
    v_entitlement := coalesce(v_booking.entitlement_sessions, v_booking.total_sessions);
    IF v_entitlement IS NULL OR v_entitlement <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
    END IF;

    v_sequence := v_sequence + 1;
    v_should_reprice := v_booking.status::text = 'pending_payment'
      AND (
        p_start_created_at IS NULL
        OR (v_booking.created_at, v_booking.id) >= (p_start_created_at, p_start_booking_id)
      );

    IF v_should_reprice THEN
      SELECT * INTO v_tier FROM public.task10_booking_tier_v1(v_booking.id,v_cumulative+v_entitlement);

      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_MISSING_TIER';
      END IF;

      v_gross := round((v_entitlement * v_tier.price_per_session)::numeric, 2);
      SELECT calculated.discount_amount, calculated.final_price
      INTO v_discount, v_final
      FROM public.recalculate_progressive_coupon_discount_v1(
        v_booking.id, v_gross, p_new_revision
      ) calculated;

      IF round(v_booking.total_price::numeric, 2) IS DISTINCT FROM v_final THEN
        v_changes := v_changes || jsonb_build_array(jsonb_build_object(
          'bookingId', v_booking.id,
          'oldPrice', round(v_booking.total_price::numeric, 2),
          'newPrice', v_final
        ));
      END IF;

      UPDATE public.bookings
      SET
        entitlement_sessions = v_entitlement,
        pricing_sequence = v_sequence,
        cumulative_sessions_before = v_cumulative,
        cumulative_sessions_after = v_cumulative + v_entitlement,
        pricing_tier_id_snapshot = v_tier.id,
        pricing_rate_snapshot = v_tier.price_per_session,
        gross_price_snapshot = v_gross,
        coupon_discount_snapshot = v_discount,
        final_price_snapshot = v_final,
        pricing_revision = p_new_revision,
        pricing_calculated_at = transaction_timestamp(),
        total_price = v_final
      WHERE id = v_booking.id
        AND pricing_scope_id = p_scope_id;
    END IF;

    v_cumulative := v_cumulative + v_entitlement;
  END LOOP;

  IF current_setting('task10.defer_calculation_record',true) IS DISTINCT FROM 'yes' THEN
    PERFORM public.task10_record_scope_calculations_v1(p_scope_id,p_new_revision);
  END IF;
  RETURN v_changes;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_progressive_booking_v1(
  p_user_id uuid,
  p_learner_type public.learner_type,
  p_child_id uuid,
  p_branch_id uuid,
  p_course_type_id uuid,
  p_sessions jsonb,
  p_coupon_id uuid,
  p_client_request_id uuid,
  p_expected_scope_revision bigint,
  p_expected_legacy_baseline_sessions integer,
  p_expected_legacy_baseline_fingerprint text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_receipt public.progressive_booking_mutation_receipts%ROWTYPE;
  v_scope public.booking_pricing_scopes%ROWTYPE;
  v_fingerprint text;
  v_effective jsonb;
  v_scope_id uuid;
  v_revision bigint;
  v_booking_id uuid := gen_random_uuid();
  v_booking_child_id uuid;
  v_lesson_year integer;
  v_lesson_month integer;
  v_session_count integer;
  v_expires_at timestamptz := public.task10_transaction_start_v1() + interval '14 days';
  v_changed jsonb;
  v_final numeric(12, 2);
  v_gross numeric(12, 2);
  v_coupon_result jsonb;
  v_slot_ids uuid[];
  v_result jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  IF public.task10_source_policy_established_v1() THEN
    SELECT min(requested.lesson_year),min(requested.lesson_month) INTO v_lesson_year,v_lesson_month
      FROM public.progressive_requested_sessions_v1(p_user_id,p_course_type_id,p_learner_type,p_child_id,p_branch_id,p_sessions) requested;
    PERFORM public.task10_lock_pricing_scope_v1(p_user_id,p_course_type_id,v_lesson_year,v_lesson_month);
  END IF;
  PERFORM set_config('task10.defer_calculation_record','yes',true);
  IF p_user_id IS NULL OR p_branch_id IS NULL OR p_course_type_id IS NULL
    OR p_client_request_id IS NULL OR p_expected_scope_revision IS NULL
    OR p_expected_scope_revision < 0
    OR p_expected_legacy_baseline_sessions IS NULL
    OR p_expected_legacy_baseline_sessions < 0
    OR p_expected_legacy_baseline_fingerprint IS NULL
    OR p_expected_legacy_baseline_fingerprint !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  v_fingerprint := md5(concat_ws('|',
    'create', p_user_id::text, p_learner_type::text, coalesce(p_child_id::text, ''),
    p_branch_id::text, p_course_type_id::text, coalesce(p_sessions::text, ''),
    coalesce(p_coupon_id::text, ''), p_expected_scope_revision::text,
    p_expected_legacy_baseline_sessions::text,
    p_expected_legacy_baseline_fingerprint
  ));

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'progressive-request|' || p_user_id::text || '|' || p_client_request_id::text, 0
  ));

  SELECT receipt.* INTO v_receipt
  FROM public.progressive_booking_mutation_receipts receipt
  WHERE receipt.user_id = p_user_id AND receipt.client_request_id = p_client_request_id;

  IF FOUND THEN
    IF v_receipt.mutation_type <> 'create' OR v_receipt.request_fingerprint <> v_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_IDEMPOTENCY_CONFLICT';
    END IF;
    PERFORM set_config('task10.defer_calculation_record','',true);
    RETURN jsonb_set(v_receipt.result, '{idempotentReplay}', 'true'::jsonb, true);
  END IF;

  SELECT min(requested.lesson_year), min(requested.lesson_month), count(*)::integer
  INTO v_lesson_year, v_lesson_month, v_session_count
  FROM public.progressive_requested_sessions_v1(
    p_user_id, p_course_type_id, p_learner_type, p_child_id, p_branch_id, p_sessions
  ) requested;

  IF v_session_count IS NULL OR v_session_count <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  IF public.task10_source_policy_established_v1() THEN
    PERFORM public.task10_assert_scope_current_v1(p_user_id,p_course_type_id,v_lesson_year,v_lesson_month);
  END IF;

  SELECT acquired.scope_id, acquired.new_revision
  INTO v_scope_id, v_revision
  FROM public.progressive_acquire_scope_v1(
    p_user_id, p_course_type_id, v_lesson_year, v_lesson_month,
    p_expected_scope_revision
  ) acquired;

  SELECT scope.* INTO v_scope
  FROM public.booking_pricing_scopes scope
  WHERE scope.id = v_scope_id;

  v_effective := public.task10_effective_scope_baseline_v1(v_scope_id);
  v_scope.legacy_baseline_sessions := (v_effective->>'sessions')::integer;
  v_scope.legacy_baseline_fingerprint := v_effective->>'fingerprint';
  IF v_scope.legacy_baseline_sessions IS DISTINCT FROM p_expected_legacy_baseline_sessions
    OR v_scope.legacy_baseline_fingerprint IS DISTINCT FROM p_expected_legacy_baseline_fingerprint
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_LEGACY_BASELINE_CONFLICT';
  END IF;

  PERFORM public.progressive_assert_scope_membership_v1(
    v_scope_id, p_user_id, p_course_type_id, v_lesson_year, v_lesson_month
  );

  -- Coupon and slot waits both precede the actual successful creation clock.
  -- Legacy transactions use this same coupon-before-slot dependency order.
  IF p_coupon_id IS NOT NULL THEN
    PERFORM 1 FROM public.coupons WHERE id=p_coupon_id FOR UPDATE;
  END IF;
  PERFORM public.progressive_lock_booking_slots_v1(
    p_user_id, p_course_type_id, p_learner_type, p_child_id, p_branch_id, p_sessions
  );

  SELECT CASE
    WHEN p_learner_type = 'self' THEN NULL
    WHEN p_child_id IS NOT NULL THEN p_child_id
    WHEN count(DISTINCT requested.child_id) = 1 THEN min(requested.child_id::text)::uuid
    ELSE NULL
  END INTO v_booking_child_id
  FROM public.progressive_requested_sessions_v1(
    p_user_id, p_course_type_id, p_learner_type, p_child_id, p_branch_id, p_sessions
  ) requested;

  INSERT INTO public.bookings (
    id, user_id, learner_type, child_id, branch_id, course_type_id, month, year,
    total_sessions, total_price, status, pricing_scope_id, entitlement_sessions,
    coupon_discount_snapshot, pricing_revision, expires_at, client_request_id
  ) VALUES (
    v_booking_id, p_user_id, p_learner_type, v_booking_child_id, p_branch_id,
    p_course_type_id, v_lesson_month, v_lesson_year, v_session_count, 0,
    'pending_payment', v_scope_id, v_session_count, 0, v_revision, v_expires_at,
    p_client_request_id
  );

  INSERT INTO public.booking_sessions (
    booking_id, schedule_slot_id, date, start_time, end_time, branch_id,
    child_id, status, is_makeup
  )
  SELECT
    v_booking_id, slot.id, requested.session_date, requested.session_start,
    requested.session_end, requested.branch_id, requested.child_id, 'scheduled', false
  FROM public.progressive_requested_sessions_v1(
    p_user_id, p_course_type_id, p_learner_type, p_child_id, p_branch_id, p_sessions
  ) requested
  JOIN public.schedule_slots slot
    ON slot.branch_id = requested.branch_id
    AND slot.course_type_id = p_course_type_id
    AND slot.date = requested.session_date
    AND slot.start_time = requested.session_start
    AND slot.end_time = requested.session_end
  ORDER BY requested.ordinal;

  SELECT array_agg(DISTINCT session.schedule_slot_id ORDER BY session.schedule_slot_id)
  INTO v_slot_ids
  FROM public.booking_sessions session
  WHERE session.booking_id = v_booking_id;

  v_changed := public.progressive_reprice_scope_v1(
    v_scope_id, v_revision, (SELECT created_at FROM public.bookings WHERE id=v_booking_id), v_booking_id
  );

  IF p_coupon_id IS NOT NULL THEN
    SELECT booking.gross_price_snapshot INTO v_gross
    FROM public.bookings booking WHERE booking.id = v_booking_id;
    v_coupon_result := public.reserve_progressive_coupon_v1(
      p_coupon_id, v_booking_id, p_user_id, p_course_type_id, v_gross, v_revision
    );
  END IF;

  SELECT booking.total_price INTO v_final
  FROM public.bookings booking WHERE booking.id = v_booking_id;
  IF p_coupon_id IS NOT NULL THEN
    v_changed := jsonb_build_array(jsonb_build_object(
      'bookingId', v_booking_id,
      'oldPrice', 0,
      'newPrice', v_final
    ));
  END IF;
  PERFORM public.progressive_refresh_slot_capacity_v1(v_slot_ids);

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    p_user_id, 'create_progressive_booking', 'booking', v_booking_id,
    jsonb_build_object(
      'scopeId', v_scope_id,
      'scopeRevision', v_revision,
      'entitlementSessions', v_session_count,
      'legacyBaselineSessions', v_scope.legacy_baseline_sessions,
      'totalPrice', v_final,
      'expiresAt', v_expires_at,
      'couponId', p_coupon_id,
      'couponReservationId', v_coupon_result ->> 'reservationId'
    )
  );

  v_result := jsonb_build_object(
    'ok', true,
    'mutation', 'create',
    'bookingId', v_booking_id,
    'scopeId', v_scope_id,
    'scopeRevision', v_revision,
    'totalPrice', v_final,
    'expiresAt', v_expires_at,
    'idempotentReplay', false,
    'changedBookings', v_changed
  );

  INSERT INTO public.progressive_booking_mutation_receipts (
    user_id, booking_id, client_request_id, mutation_type, request_fingerprint,
    expected_scope_revision, result
  ) VALUES (
    p_user_id, v_booking_id, p_client_request_id, 'create', v_fingerprint,
    p_expected_scope_revision, v_result
  );

  PERFORM set_config('task10.defer_calculation_record','',true);
  PERFORM public.task10_record_scope_calculations_v1(v_scope_id,v_revision);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_progressive_pending_booking_v1(
  p_user_id uuid,
  p_booking_id uuid,
  p_branch_id uuid,
  p_sessions jsonb,
  p_client_request_id uuid,
  p_expected_scope_revision bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_receipt public.progressive_booking_mutation_receipts%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_scope public.booking_pricing_scopes%ROWTYPE;
  v_fingerprint text;
  v_scope_id uuid;
  v_revision bigint;
  v_session_count integer;
  v_lesson_year integer;
  v_lesson_month integer;
  v_booking_child_id uuid;
  v_old_slot_ids uuid[];
  v_all_slot_ids uuid[];
  v_changed jsonb;
  v_final numeric(12, 2);
  v_result jsonb;
  v_policy jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  IF public.task10_source_policy_established_v1() THEN
    SELECT b.* INTO v_booking FROM public.bookings b WHERE b.id=p_booking_id AND b.user_id=p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'PROGRESSIVE_UNAUTHORIZED'; END IF;
    PERFORM public.task10_lock_pricing_scope_v1(p_user_id,v_booking.course_type_id,v_booking.year,v_booking.month);
  END IF;
  IF p_user_id IS NULL
    OR p_booking_id IS NULL
    OR p_branch_id IS NULL
    OR p_client_request_id IS NULL
    OR p_expected_scope_revision IS NULL
    OR p_expected_scope_revision < 1
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  v_fingerprint := md5(concat_ws('|',
    'update', p_user_id::text, p_booking_id::text, p_branch_id::text,
    coalesce(p_sessions::text, ''), p_expected_scope_revision::text
  ));

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'progressive-request|' || p_user_id::text || '|' || p_client_request_id::text,
    0
  ));

  SELECT receipt.*
  INTO v_receipt
  FROM public.progressive_booking_mutation_receipts receipt
  WHERE receipt.user_id = p_user_id
    AND receipt.client_request_id = p_client_request_id;

  IF FOUND THEN
    IF v_receipt.mutation_type <> 'update'
      OR v_receipt.booking_id IS DISTINCT FROM p_booking_id
      OR v_receipt.request_fingerprint <> v_fingerprint
    THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN jsonb_set(v_receipt.result, '{idempotentReplay}', 'true'::jsonb, true);
  END IF;

  SELECT b.*
  INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id AND b.user_id = p_user_id;

  IF NOT FOUND OR v_booking.pricing_scope_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_UNAUTHORIZED';
  END IF;

  IF public.task10_source_policy_established_v1() THEN
    PERFORM public.task10_assert_scope_current_v1(p_user_id,v_booking.course_type_id,v_booking.year,v_booking.month);
    v_policy:=public.task10_booking_policy_quote_v1(p_user_id,v_booking.course_type_id,make_date(v_booking.year,v_booking.month,1),'progressive',p_booking_id);
    IF v_policy->>'fingerprint' IS DISTINCT FROM current_setting('task10.expected_policy',true) THEN RAISE EXCEPTION 'TASK10_PREVIEW_CONFLICT'; END IF;
  END IF;

  SELECT s.*
  INTO v_scope
  FROM public.booking_pricing_scopes s
  WHERE s.id = v_booking.pricing_scope_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_RPC_UNAVAILABLE';
  END IF;

  SELECT acquired.scope_id, acquired.new_revision
  INTO v_scope_id, v_revision
  FROM public.progressive_acquire_scope_v1(
    p_user_id, v_booking.course_type_id, v_scope.lesson_year, v_scope.lesson_month,
    p_expected_scope_revision
  ) acquired;

  IF v_scope_id IS DISTINCT FROM v_booking.pricing_scope_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BOOKING_CONFLICT';
  END IF;

  PERFORM public.progressive_assert_scope_membership_v1(
    v_scope_id, p_user_id, v_booking.course_type_id, v_scope.lesson_year, v_scope.lesson_month
  );

  SELECT b.*
  INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id AND b.user_id = p_user_id
  FOR UPDATE;

  IF v_booking.status::text <> 'pending_payment' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BOOKING_NOT_PENDING';
  END IF;

  IF v_booking.expires_at IS NULL OR v_booking.expires_at <= transaction_timestamp() THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BOOKING_EXPIRED';
  END IF;

  IF EXISTS (SELECT 1 FROM public.payments payment WHERE payment.booking_id = p_booking_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_PAYMENT_EXISTS';
  END IF;

  IF EXISTS (SELECT 1 FROM public.coupon_usages usage WHERE usage.booking_id = p_booking_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_COUPON_NOT_READY';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.booking_sessions bs
    WHERE bs.booking_id = p_booking_id
      AND (bs.status::text <> 'scheduled' OR bs.cancelled_at IS NOT NULL)
  ) OR EXISTS (
    SELECT 1
    FROM public.attendance attendance
    JOIN public.booking_sessions bs ON bs.id = attendance.booking_session_id
    WHERE bs.booking_id = p_booking_id
  ) OR EXISTS (
    SELECT 1
    FROM public.booking_sessions later_session
    JOIN public.booking_sessions original_session
      ON original_session.id = later_session.rescheduled_from_id
    WHERE original_session.booking_id = p_booking_id
  ) OR EXISTS (
    SELECT 1
    FROM public.coach_assignment_group_students assigned
    JOIN public.booking_sessions bs ON bs.id = assigned.booking_session_id
    WHERE bs.booking_id = p_booking_id
  ) OR EXISTS (
    SELECT 1
    FROM public.lesson_wallet_credits wallet
    JOIN public.booking_sessions bs
      ON bs.id = wallet.original_session_id OR bs.id = wallet.redeemed_session_id
    WHERE bs.booking_id = p_booking_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BOOKING_CONFLICT';
  END IF;

  SELECT min(requested.lesson_year), min(requested.lesson_month), count(*)::integer
  INTO v_lesson_year, v_lesson_month, v_session_count
  FROM public.progressive_requested_sessions_v1(
    p_user_id, v_booking.course_type_id, v_booking.learner_type,
    v_booking.child_id, p_branch_id, p_sessions
  ) requested;

  IF v_lesson_year <> v_scope.lesson_year OR v_lesson_month <> v_scope.lesson_month THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_MULTI_MONTH_BOOKING';
  END IF;

  SELECT array_agg(DISTINCT bs.schedule_slot_id ORDER BY bs.schedule_slot_id)
  INTO v_old_slot_ids
  FROM public.booking_sessions bs
  WHERE bs.booking_id = p_booking_id;

  PERFORM public.progressive_lock_booking_slots_v1(
    p_user_id, v_booking.course_type_id, v_booking.learner_type,
    v_booking.child_id, p_branch_id, p_sessions, p_booking_id, v_old_slot_ids
  );

  SELECT CASE
    WHEN v_booking.learner_type = 'self' THEN NULL
    WHEN v_booking.child_id IS NOT NULL THEN v_booking.child_id
    WHEN count(DISTINCT requested.child_id) = 1 THEN min(requested.child_id::text)::uuid
    ELSE NULL
  END
  INTO v_booking_child_id
  FROM public.progressive_requested_sessions_v1(
    p_user_id, v_booking.course_type_id, v_booking.learner_type,
    v_booking.child_id, p_branch_id, p_sessions
  ) requested;

  DELETE FROM public.booking_sessions WHERE booking_id = p_booking_id;

  UPDATE public.bookings
  SET
    branch_id = p_branch_id,
    child_id = v_booking_child_id,
    total_sessions = v_session_count,
    entitlement_sessions = v_session_count
  WHERE id = p_booking_id;

  INSERT INTO public.booking_sessions (
    booking_id, schedule_slot_id, date, start_time, end_time, branch_id,
    child_id, status, is_makeup
  )
  SELECT
    p_booking_id,
    slot.id,
    requested.session_date,
    requested.session_start,
    requested.session_end,
    requested.branch_id,
    requested.child_id,
    'scheduled',
    false
  FROM public.progressive_requested_sessions_v1(
    p_user_id, v_booking.course_type_id, v_booking.learner_type,
    v_booking.child_id, p_branch_id, p_sessions
  ) requested
  JOIN public.schedule_slots slot
    ON slot.branch_id = requested.branch_id
    AND slot.course_type_id = v_booking.course_type_id
    AND slot.date = requested.session_date
    AND slot.start_time = requested.session_start
    AND slot.end_time = requested.session_end
  ORDER BY requested.ordinal;

  SELECT array_agg(DISTINCT slot_id ORDER BY slot_id)
  INTO v_all_slot_ids
  FROM (
    SELECT unnest(coalesce(v_old_slot_ids, ARRAY[]::uuid[])) AS slot_id
    UNION
    SELECT bs.schedule_slot_id FROM public.booking_sessions bs WHERE bs.booking_id = p_booking_id
  ) affected;

  v_changed := public.progressive_reprice_scope_v1(
    v_scope_id, v_revision, v_booking.created_at, p_booking_id
  );

  SELECT b.total_price
  INTO v_final
  FROM public.bookings b
  WHERE b.id = p_booking_id;

  PERFORM public.progressive_refresh_slot_capacity_v1(v_all_slot_ids);

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    p_user_id,
    'update_progressive_pending_booking',
    'booking',
    p_booking_id,
    jsonb_build_object(
      'scopeId', v_scope_id,
      'scopeRevision', v_revision,
      'entitlementSessions', v_session_count,
      'totalPrice', v_final,
      'expiresAtPreserved', v_booking.expires_at
    )
  );

  v_result := jsonb_build_object(
    'ok', true,
    'mutation', 'update',
    'bookingId', p_booking_id,
    'scopeId', v_scope_id,
    'scopeRevision', v_revision,
    'totalPrice', v_final,
    'expiresAt', v_booking.expires_at,
    'idempotentReplay', false,
    'changedBookings', v_changed
  );

  INSERT INTO public.progressive_booking_mutation_receipts (
    user_id, booking_id, client_request_id, mutation_type, request_fingerprint,
    expected_scope_revision, result
  ) VALUES (
    p_user_id, p_booking_id, p_client_request_id, 'update', v_fingerprint,
    p_expected_scope_revision, v_result
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_progressive_pending_booking_v1(
  p_user_id uuid,
  p_booking_id uuid,
  p_client_request_id uuid,
  p_expected_scope_revision bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_receipt public.progressive_booking_mutation_receipts%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_scope public.booking_pricing_scopes%ROWTYPE;
  v_fingerprint text;
  v_scope_id uuid;
  v_revision bigint;
  v_slot_ids uuid[];
  v_changed jsonb;
  v_coupon_release jsonb;
  v_result jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  IF public.task10_source_policy_established_v1() THEN
    SELECT b.* INTO v_booking FROM public.bookings b WHERE b.id=p_booking_id AND b.user_id=p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'PROGRESSIVE_UNAUTHORIZED'; END IF;
    PERFORM public.task10_lock_pricing_scope_v1(p_user_id,v_booking.course_type_id,v_booking.year,v_booking.month);
  END IF;
  IF p_user_id IS NULL OR p_booking_id IS NULL OR p_client_request_id IS NULL
    OR p_expected_scope_revision IS NULL OR p_expected_scope_revision < 1
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  v_fingerprint := md5(concat_ws('|',
    'cancel', p_user_id::text, p_booking_id::text, p_expected_scope_revision::text
  ));

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'progressive-request|' || p_user_id::text || '|' || p_client_request_id::text, 0
  ));

  SELECT receipt.* INTO v_receipt
  FROM public.progressive_booking_mutation_receipts receipt
  WHERE receipt.user_id = p_user_id AND receipt.client_request_id = p_client_request_id;

  IF FOUND THEN
    IF v_receipt.mutation_type <> 'cancel'
      OR v_receipt.booking_id IS DISTINCT FROM p_booking_id
      OR v_receipt.request_fingerprint <> v_fingerprint
    THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN jsonb_set(v_receipt.result, '{idempotentReplay}', 'true'::jsonb, true);
  END IF;

  SELECT b.* INTO v_booking
  FROM public.bookings b WHERE b.id = p_booking_id AND b.user_id = p_user_id;

  IF NOT FOUND OR v_booking.pricing_scope_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_UNAUTHORIZED';
  END IF;

  SELECT s.* INTO v_scope
  FROM public.booking_pricing_scopes s WHERE s.id = v_booking.pricing_scope_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_RPC_UNAVAILABLE';
  END IF;

  SELECT acquired.scope_id, acquired.new_revision
  INTO v_scope_id, v_revision
  FROM public.progressive_acquire_scope_v1(
    p_user_id, v_booking.course_type_id, v_scope.lesson_year, v_scope.lesson_month,
    p_expected_scope_revision
  ) acquired;

  IF v_scope_id IS DISTINCT FROM v_booking.pricing_scope_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BOOKING_CONFLICT';
  END IF;

  PERFORM public.progressive_assert_scope_membership_v1(
    v_scope_id, p_user_id, v_booking.course_type_id, v_scope.lesson_year, v_scope.lesson_month
  );

  SELECT b.* INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id AND b.user_id = p_user_id
  FOR UPDATE;

  IF v_booking.status::text <> 'pending_payment' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BOOKING_NOT_PENDING';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payments payment WHERE payment.booking_id = p_booking_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_PAYMENT_EXISTS';
  END IF;
  IF EXISTS (SELECT 1 FROM public.coupon_usages usage WHERE usage.booking_id = p_booking_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_COUPON_NOT_READY';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.booking_sessions bs
    WHERE bs.booking_id = p_booking_id
      AND (bs.status::text <> 'scheduled' OR bs.cancelled_at IS NOT NULL)
  ) OR EXISTS (
    SELECT 1 FROM public.attendance attendance
    JOIN public.booking_sessions bs ON bs.id = attendance.booking_session_id
    WHERE bs.booking_id = p_booking_id
  ) OR EXISTS (
    SELECT 1 FROM public.coach_assignment_group_students assigned
    JOIN public.booking_sessions bs ON bs.id = assigned.booking_session_id
    WHERE bs.booking_id = p_booking_id
  ) OR EXISTS (
    SELECT 1 FROM public.lesson_wallet_credits wallet
    JOIN public.booking_sessions bs
      ON bs.id = wallet.original_session_id OR bs.id = wallet.redeemed_session_id
    WHERE bs.booking_id = p_booking_id
  ) OR EXISTS (
    SELECT 1 FROM public.booking_sessions later_session
    JOIN public.booking_sessions original_session
      ON original_session.id = later_session.rescheduled_from_id
    WHERE original_session.booking_id = p_booking_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BOOKING_CONFLICT';
  END IF;

  SELECT array_agg(DISTINCT bs.schedule_slot_id ORDER BY bs.schedule_slot_id)
  INTO v_slot_ids FROM public.booking_sessions bs WHERE bs.booking_id = p_booking_id;

  PERFORM ss.id FROM public.schedule_slots ss
  WHERE ss.id = ANY(coalesce(v_slot_ids, ARRAY[]::uuid[]))
  ORDER BY ss.id FOR UPDATE;

  v_coupon_release := public.release_progressive_coupon_v1(
    p_booking_id, p_user_id, 'booking_cancelled'
  );

  UPDATE public.booking_sessions
  SET cancelled_at = transaction_timestamp()
  WHERE booking_id = p_booking_id AND status::text = 'scheduled' AND cancelled_at IS NULL;

  UPDATE public.bookings SET status = 'cancelled' WHERE id = p_booking_id;

  v_changed := public.progressive_reprice_scope_v1(
    v_scope_id, v_revision, v_booking.created_at, p_booking_id
  );

  PERFORM public.progressive_refresh_slot_capacity_v1(v_slot_ids);

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    p_user_id, 'cancel_progressive_pending_booking', 'booking', p_booking_id,
    jsonb_build_object(
      'scopeId', v_scope_id,
      'scopeRevision', v_revision,
      'cancelledAt', transaction_timestamp(),
      'softCancelledSessions', true,
      'couponRelease', v_coupon_release
    )
  );

  v_result := jsonb_build_object(
    'ok', true,
    'mutation', 'cancel',
    'bookingId', p_booking_id,
    'scopeId', v_scope_id,
    'scopeRevision', v_revision,
    'totalPrice', v_booking.total_price,
    'expiresAt', v_booking.expires_at,
    'idempotentReplay', false,
    'changedBookings', v_changed
  );

  INSERT INTO public.progressive_booking_mutation_receipts (
    user_id, booking_id, client_request_id, mutation_type, request_fingerprint,
    expected_scope_revision, result
  ) VALUES (
    p_user_id, p_booking_id, p_client_request_id, 'cancel', v_fingerprint,
    p_expected_scope_revision, v_result
  );

  RETURN v_result;
END;
$$;
CREATE FUNCTION public.task10_create_progressive_booking_v1(p_user_id uuid,p_learner_type public.learner_type,
  p_child_id uuid,p_branch_id uuid,p_course_type_id uuid,p_sessions jsonb,p_coupon_id uuid,p_client_request_id uuid,
  p_expected_scope_revision bigint,p_expected_legacy_baseline_sessions integer,p_expected_legacy_baseline_fingerprint text,
  p_expected_policy_fingerprint text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
  PERFORM set_config('task10.expected_policy',coalesce(p_expected_policy_fingerprint,''),true);
  v_result:=public.create_progressive_booking_v1(p_user_id,p_learner_type,p_child_id,p_branch_id,p_course_type_id,p_sessions,
    p_coupon_id,p_client_request_id,p_expected_scope_revision,p_expected_legacy_baseline_sessions,p_expected_legacy_baseline_fingerprint);
  PERFORM set_config('task10.expected_policy','',true);
  PERFORM set_config('task10.booking_write','',true);
  PERFORM set_config('task10.source_write','',true);
  RETURN v_result;
END $$;
CREATE FUNCTION public.task10_update_progressive_booking_v1(p_user_id uuid,p_booking_id uuid,p_branch_id uuid,p_sessions jsonb,
  p_client_request_id uuid,p_expected_scope_revision bigint,p_expected_policy_fingerprint text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
  PERFORM set_config('task10.expected_policy',coalesce(p_expected_policy_fingerprint,''),true);
  v_result:=public.update_progressive_pending_booking_v1(p_user_id,p_booking_id,p_branch_id,p_sessions,p_client_request_id,p_expected_scope_revision);
  PERFORM set_config('task10.expected_policy','',true);
  PERFORM set_config('task10.booking_write','',true);
  PERFORM set_config('task10.source_write','',true);
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.task10_create_progressive_booking_v1(uuid,public.learner_type,uuid,uuid,uuid,jsonb,uuid,uuid,bigint,integer,text,text),
  public.task10_update_progressive_booking_v1(uuid,uuid,uuid,jsonb,uuid,bigint,text),
  public.progressive_acquire_scope_v1(uuid,uuid,integer,integer,bigint),public.progressive_reprice_scope_v1(uuid,bigint,timestamptz,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.task10_create_progressive_booking_v1(uuid,public.learner_type,uuid,uuid,uuid,jsonb,uuid,uuid,bigint,integer,text,text),
  public.task10_update_progressive_booking_v1(uuid,uuid,uuid,jsonb,uuid,bigint,text) TO service_role;
COMMIT;
