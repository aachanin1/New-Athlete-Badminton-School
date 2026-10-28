BEGIN;

-- One snapshot/read or atomic Adult/Private save. Existing price readers and
-- historical rows retain their UTC-date and formula contracts.
CREATE OR REPLACE FUNCTION public.admin_current_pricing_v1(
  p_actor uuid, p_as_of date DEFAULT NULL,
  p_expected jsonb DEFAULT NULL, p_tiers jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, pg_temp
SET lock_timeout = '2s'
AS $$
DECLARE
  v_write boolean := p_as_of IS NOT NULL OR p_expected IS NOT NULL OR p_tiers IS NOT NULL;
  v_date date; v_current jsonb; v_expected jsonb; v_after jsonb;
  v_count integer; v_changed integer; v_audit uuid;
BEGIN
  IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor AND role::text='super_admin') THEN
    RAISE EXCEPTION 'ADMIN_PRICING_FORBIDDEN';
  END IF;
  IF v_write THEN
    IF p_as_of IS NULL OR jsonb_typeof(p_expected) IS DISTINCT FROM 'array'
      OR jsonb_typeof(p_tiers) IS DISTINCT FROM 'array'
      OR jsonb_array_length(p_tiers) NOT BETWEEN 1 AND 100
      OR jsonb_array_length(p_expected) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'ADMIN_PRICING_RELOAD_REQUIRED';
    END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_tiers) x WHERE
      jsonb_typeof(x) IS DISTINCT FROM 'object' OR
      x - ARRAY['id','min_sessions','max_sessions','price_per_session']::text[] <> '{}'::jsonb OR
      jsonb_typeof(x->'id') IS DISTINCT FROM 'string' OR
      jsonb_typeof(x->'min_sessions') IS DISTINCT FROM 'number' OR
      NOT(x ? 'max_sessions') OR jsonb_typeof(x->'max_sessions') NOT IN ('number','null') OR
      jsonb_typeof(x->'price_per_session') IS DISTINCT FROM 'number') THEN
      RAISE EXCEPTION 'ADMIN_PRICING_INVALID';
    END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_tiers) x WHERE
      (x->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR
      (x->>'min_sessions')::numeric <> trunc((x->>'min_sessions')::numeric) OR
      (x->>'min_sessions')::numeric < 1 OR
      (x->>'max_sessions')::numeric <> trunc((x->>'max_sessions')::numeric) OR
      (x->>'max_sessions')::numeric < (x->>'min_sessions')::numeric OR
      (x->>'price_per_session')::numeric < 0) OR
      (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_tiers)x) <> jsonb_array_length(p_tiers) THEN
      RAISE EXCEPTION 'ADMIN_PRICING_INVALID';
    END IF;
    -- Conflicts with legacy row writes and the existing pricing SHARE reader.
    -- All validation, updates and audit below share this short transaction.
    LOCK TABLE public.pricing_tiers IN SHARE ROW EXCLUSIVE MODE;
  END IF;
  v_date := (clock_timestamp() AT TIME ZONE 'UTC')::date;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'course_type_id',t.course_type_id,'course_type_name',c.name,
    'min_sessions',t.min_sessions,'max_sessions',t.max_sessions,
    'price_per_session',t.price_per_session,'package_price',t.package_price,
    'valid_from',t.valid_from,'valid_to',t.valid_to) ORDER BY t.id),'[]'::jsonb)
  INTO v_current FROM public.pricing_tiers t JOIN public.course_types c ON c.id=t.course_type_id
  WHERE c.name::text IN ('adult_group','private')
    AND t.valid_from<=v_date AND (t.valid_to IS NULL OR t.valid_to>=v_date);
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_current)x WHERE x->>'course_type_name'='adult_group')
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_current)x WHERE x->>'course_type_name'='private') THEN
    RAISE EXCEPTION 'ADMIN_PRICING_CURRENT_MISSING';
  END IF;
  IF NOT v_write THEN RETURN jsonb_build_object('asOfDate',v_date,'tiers',v_current); END IF;
  SELECT jsonb_agg(x ORDER BY x->>'id') INTO v_expected FROM jsonb_array_elements(p_expected)x;
  IF p_as_of<>v_date OR v_expected IS DISTINCT FROM v_current
    OR (SELECT jsonb_agg(x->>'id' ORDER BY x->>'id') FROM jsonb_array_elements(p_tiers)x)
      IS DISTINCT FROM (SELECT jsonb_agg(x->>'id' ORDER BY x->>'id') FROM jsonb_array_elements(v_current)x) THEN
    RAISE EXCEPTION 'ADMIN_PRICING_CONFLICT';
  END IF;
  SELECT count(*) INTO v_count FROM jsonb_to_recordset(p_tiers)
    AS x(id uuid,min_sessions integer,max_sessions integer,price_per_session numeric);
  WITH changes AS (
    UPDATE public.pricing_tiers t SET min_sessions=x.min_sessions,max_sessions=x.max_sessions,
      price_per_session=x.price_per_session,package_price=round(x.min_sessions*x.price_per_session)
    FROM jsonb_to_recordset(p_tiers) AS x(id uuid,min_sessions integer,max_sessions integer,price_per_session numeric)
    WHERE t.id=x.id AND (t.min_sessions,t.max_sessions,t.price_per_session,t.package_price)
      IS DISTINCT FROM (x.min_sessions,x.max_sessions,x.price_per_session,round(x.min_sessions*x.price_per_session))
    RETURNING t.id
  ) SELECT count(*) INTO v_changed FROM changes;
  SELECT jsonb_agg(jsonb_build_object(
    'id',t.id,'course_type_id',t.course_type_id,'course_type_name',c.name,
    'min_sessions',t.min_sessions,'max_sessions',t.max_sessions,
    'price_per_session',t.price_per_session,'package_price',t.package_price,
    'valid_from',t.valid_from,'valid_to',t.valid_to) ORDER BY t.id)
  INTO v_after FROM public.pricing_tiers t JOIN public.course_types c ON c.id=t.course_type_id
  WHERE t.id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(v_current)x);
  IF v_changed>0 THEN
    INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details)
    VALUES(p_actor,'pricing_updated','pricing_tiers',NULL,jsonb_build_object(
      'scope','pricing_settings','before',v_current,'after',v_after,'count',v_changed,'asOfDate',v_date,'packagePriceMode','auto'))
    RETURNING id INTO v_audit;
  END IF;
  RETURN jsonb_build_object('asOfDate',v_date,'tiers',v_after,'changed',v_changed,'auditId',v_audit);
END $$;
REVOKE ALL ON FUNCTION public.admin_current_pricing_v1(uuid,date,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_current_pricing_v1(uuid,date,jsonb,jsonb) TO service_role;
COMMIT;
