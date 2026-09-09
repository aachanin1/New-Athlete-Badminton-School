-- Task 10: inert evidence only. This file does not activate policy or repair data.
BEGIN;

CREATE TABLE public.task10_policy_activation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  state text NOT NULL DEFAULT 'never_activated' CHECK (state IN ('never_activated','active','paused')),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  effective_at timestamptz,
  pricing_enabled boolean NOT NULL DEFAULT false,
  makeup_enabled boolean NOT NULL DEFAULT false,
  expiry_enabled boolean NOT NULL DEFAULT false,
  artifact jsonb,
  CHECK ((state = 'never_activated' AND effective_at IS NULL AND NOT pricing_enabled AND NOT makeup_enabled AND NOT expiry_enabled)
    OR (state <> 'never_activated' AND effective_at IS NOT NULL)),
  CHECK (state <> 'paused' OR (NOT pricing_enabled AND NOT makeup_enabled AND NOT expiry_enabled))
);
INSERT INTO public.task10_policy_activation(singleton) VALUES (true);

CREATE TABLE public.task10_pricing_catalog_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regime text NOT NULL CHECK (regime IN ('early','late')),
  revision bigint NOT NULL CHECK (revision > 0),
  tiers jsonb NOT NULL CHECK (jsonb_typeof(tiers) = 'array'),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  actor_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(regime, revision), UNIQUE(id, regime)
);
CREATE TABLE public.task10_pricing_catalog_heads (
  regime text PRIMARY KEY CHECK (regime IN ('early','late')),
  version_id uuid NOT NULL,
  FOREIGN KEY (version_id, regime) REFERENCES public.task10_pricing_catalog_versions(id, regime)
);
CREATE TABLE public.task10_setting_revisions (
  revision bigint PRIMARY KEY CHECK (revision > 0),
  setting_id uuid NOT NULL REFERENCES public.system_settings(id),
  old_value jsonb,
  new_value jsonb NOT NULL,
  actor_id uuid REFERENCES public.profiles(id),
  request_id uuid UNIQUE,
  request_fingerprint text,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.task10_booking_pricing_evidence (
  booking_id uuid PRIMARY KEY REFERENCES public.bookings(id),
  activation_revision bigint NOT NULL,
  successful_created_at timestamptz NOT NULL,
  bangkok_date date NOT NULL,
  lesson_month date NOT NULL CHECK (extract(day FROM lesson_month) = 1),
  formula text NOT NULL CHECK (formula IN ('legacy','progressive')),
  catalog_version_id uuid NOT NULL REFERENCES public.task10_pricing_catalog_versions(id),
  evidence jsonb NOT NULL,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  CHECK (bangkok_date = (successful_created_at AT TIME ZONE 'Asia/Bangkok')::date)
);
CREATE TABLE public.task10_family_makeup_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES public.profiles(id),
  source_month date NOT NULL CHECK (extract(day FROM source_month) = 1),
  source_booking_id uuid NOT NULL REFERENCES public.bookings(id),
  source_root_id uuid NOT NULL UNIQUE REFERENCES public.booking_sessions(id),
  source_session_id uuid NOT NULL REFERENCES public.booking_sessions(id),
  source_child_id uuid NOT NULL REFERENCES public.children(id),
  attending_child_id uuid NOT NULL REFERENCES public.children(id),
  destination_session_id uuid NOT NULL UNIQUE REFERENCES public.booking_sessions(id),
  credit_id uuid REFERENCES public.lesson_wallet_credits(id),
  minimum_revision bigint NOT NULL REFERENCES public.task10_setting_revisions(revision),
  decision_evidence jsonb NOT NULL,
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  request_id uuid NOT NULL,
  request_fingerprint text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(actor_id, request_id)
);
CREATE TABLE public.task10_booking_calculations (
  booking_id uuid NOT NULL REFERENCES public.task10_booking_pricing_evidence(booking_id),
  revision bigint NOT NULL CHECK(revision>0),
  catalog_version_id uuid NOT NULL REFERENCES public.task10_pricing_catalog_versions(id),
  evidence jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(booking_id,revision)
);
CREATE INDEX task10_family_makeup_month_idx ON public.task10_family_makeup_uses(parent_id, source_month);
CREATE TABLE public.task10_source_mutations (
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  operation text NOT NULL CHECK (operation IN ('reschedule','return_entitlement')),
  source_session_id uuid NOT NULL REFERENCES public.booking_sessions(id),
  source_root_id uuid NOT NULL REFERENCES public.booking_sessions(id),
  request_fingerprint text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(actor_id, operation, source_session_id, request_fingerprint)
);
CREATE TABLE public.task10_wallet_transition_evidence (
  credit_id uuid PRIMARY KEY REFERENCES public.lesson_wallet_credits(id),
  source_month date NOT NULL,
  source_root_id uuid NOT NULL REFERENCES public.booking_sessions(id),
  effective_at timestamptz NOT NULL,
  original_expires_at timestamptz NOT NULL,
  evidence jsonb NOT NULL
);
CREATE TABLE public.task10_booking_expiry_cohort (
  booking_id uuid PRIMARY KEY REFERENCES public.bookings(id),
  effective_at timestamptz NOT NULL,
  deadline_at_cutover timestamptz NOT NULL,
  evidence jsonb NOT NULL
);
CREATE TABLE public.task10_accepted_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id),
  payment_id uuid REFERENCES public.payments(id),
  batch_id uuid REFERENCES public.progressive_payment_batches(id),
  storage_path text NOT NULL CHECK (length(storage_path) > 0),
  accepted_at timestamptz NOT NULL,
  deadline timestamptz,
  fingerprint text NOT NULL,
  evidence jsonb NOT NULL,
  request_id uuid NOT NULL,
  CHECK ((payment_id IS NOT NULL)::integer + (batch_id IS NOT NULL)::integer = 1),
  UNIQUE(booking_id, request_id)
);
CREATE INDEX task10_receipt_booking_time_idx ON public.task10_accepted_receipts(booking_id, accepted_at);
CREATE TABLE public.task10_booking_cancellations (
  booking_id uuid PRIMARY KEY REFERENCES public.bookings(id),
  cancelled_at timestamptz NOT NULL,
  deadline timestamptz,
  effective_at timestamptz,
  reason text NOT NULL CHECK (reason IN ('no_accepted_receipt_before_deadline','user_cancelled_pending','admin_payment_cancelled')),
  evidence jsonb NOT NULL,
  CHECK (reason <> 'no_accepted_receipt_before_deadline' OR (deadline IS NOT NULL AND effective_at IS NOT NULL))
);
CREATE TABLE public.task10_legacy_baseline_deltas (
  scope_id uuid NOT NULL REFERENCES public.booking_pricing_scopes(id),
  booking_id uuid NOT NULL REFERENCES public.task10_booking_cancellations(booking_id),
  revision bigint NOT NULL,
  entitlement_delta integer NOT NULL CHECK (entitlement_delta < 0),
  previous_fingerprint text NOT NULL,
  next_fingerprint text NOT NULL,
  evidence jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(scope_id, booking_id), UNIQUE(scope_id, revision)
);
CREATE TABLE public.task10_worker_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at timestamptz,
  attempted integer NOT NULL DEFAULT 0,
  cancelled integer NOT NULL DEFAULT 0,
  skipped jsonb NOT NULL DEFAULT '[]',
  failures jsonb NOT NULL DEFAULT '[]',
  oldest_due_at timestamptz,
  status text NOT NULL CHECK (status IN ('inactive','running','complete','failed'))
);

CREATE FUNCTION public.task10_clock_v1() RETURNS timestamptz LANGUAGE sql VOLATILE
SET search_path = pg_catalog AS $$ SELECT clock_timestamp() $$;
-- Preserve the existing Progressive TTL's transaction-start origin. Keeping
-- this separate from successful creation time also permits deterministic local
-- clock fixtures without accepting a caller-supplied Production timestamp.
CREATE FUNCTION public.task10_transaction_start_v1() RETURNS timestamptz LANGUAGE sql STABLE
SET search_path = pg_catalog AS $$ SELECT transaction_timestamp() $$;

-- Invoker triggers need only this public boolean, never the private artifact or
-- activation manifest. Actual policy mutations remain inaccessible through REST.
CREATE FUNCTION public.task10_source_policy_established_v1() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.task10_policy_activation WHERE effective_at IS NOT NULL)
$$;
REVOKE ALL ON FUNCTION public.task10_source_policy_established_v1() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.task10_source_policy_established_v1() TO anon,authenticated,service_role;

CREATE FUNCTION public.task10_tiers_valid_v1(p_tiers jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE r jsonb; v_expected numeric := 1; v_min numeric; v_max numeric; v_rate numeric; v_last boolean := false;
BEGIN
  IF p_tiers IS NULL OR jsonb_typeof(p_tiers) <> 'array' OR jsonb_array_length(p_tiers) = 0 THEN RETURN false; END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(p_tiers) ORDER BY (value->>'minSessions')::numeric LOOP
    IF jsonb_typeof(r->'minSessions') <> 'number' OR jsonb_typeof(r->'ratePerSession') <> 'number'
      OR NOT r ? 'maxSessions' OR (r->'maxSessions' <> 'null'::jsonb AND jsonb_typeof(r->'maxSessions') <> 'number') THEN RETURN false; END IF;
    v_min := (r->>'minSessions')::numeric; v_max := (r->>'maxSessions')::numeric; v_rate := (r->>'ratePerSession')::numeric;
    IF v_last OR v_min IS NULL OR v_min <> trunc(v_min) OR v_min <> v_expected OR v_rate IS NULL
      OR v_rate < 0 OR v_rate <> round(v_rate,2) OR (v_max IS NOT NULL AND (v_max < v_min OR v_max <> trunc(v_max))) THEN RETURN false; END IF;
    v_last := v_max IS NULL; v_expected := v_max + 1;
  END LOOP;
  RETURN v_last;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $$;
ALTER TABLE public.task10_pricing_catalog_versions ADD CHECK (public.task10_tiers_valid_v1(tiers));

CREATE FUNCTION public.task10_immutable_evidence_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TASK10_IMMUTABLE_EVIDENCE'; END $$;

-- Evidence tables have no REST mutation grants, including service_role. Mutations
-- use narrowly granted, fixed-search-path RPCs; triggers reject rewriting history.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['task10_policy_activation','task10_pricing_catalog_versions','task10_pricing_catalog_heads',
    'task10_setting_revisions','task10_booking_pricing_evidence','task10_booking_calculations','task10_family_makeup_uses','task10_source_mutations',
    'task10_wallet_transition_evidence','task10_booking_expiry_cohort','task10_accepted_receipts',
    'task10_booking_cancellations','task10_legacy_baseline_deltas','task10_worker_runs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated, service_role', t);
    EXECUTE format('GRANT SELECT ON public.%I TO service_role', t);
    IF t NOT IN ('task10_policy_activation','task10_pricing_catalog_heads','task10_worker_runs') THEN
      EXECUTE format('CREATE TRIGGER task10_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.task10_immutable_evidence_v1()', t);
    END IF;
  END LOOP;
END $$;

-- Seed only a genuinely absent minimum. An existing malformed/ambiguous setting
-- fails migration rather than overwriting the Owner's prior saved value.
DO $$
DECLARE s public.system_settings%ROWTYPE; v_min numeric;
BEGIN
  SELECT * INTO s FROM public.system_settings WHERE key='kids_makeup_destination_minimum_sessions' FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.system_settings(key,value) VALUES ('kids_makeup_destination_minimum_sessions','{"minimum":2,"revision":1}') RETURNING * INTO s;
  END IF;
  v_min := (s.value->>'minimum')::numeric;
  IF v_min IS NULL OR v_min < 1 OR v_min <> trunc(v_min) OR s.value->>'revision' IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'TASK10_INVALID_SETTING_BOOTSTRAP';
  END IF;
  INSERT INTO public.task10_setting_revisions(revision,setting_id,new_value,result)
  VALUES (1,s.id,s.value,jsonb_build_object('id',s.id,'minimum',v_min,'revision',1,'updatedAt',s.updated_at));
END $$;

-- Early bootstrap retains the authoritative existing rates. A fresh empty test
-- database has no Kids course/tiers: leave early unready until explicit bootstrap.
CREATE FUNCTION public.task10_bootstrap_catalogs_v1() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_tiers jsonb; v_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(10,1);
  IF EXISTS(SELECT 1 FROM public.task10_policy_activation WHERE effective_at IS NOT NULL) THEN RAISE EXCEPTION 'TASK10_ALREADY_ACTIVATED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.task10_pricing_catalog_heads WHERE regime='late') THEN
    v_tiers := '[{"id":null,"minSessions":1,"maxSessions":1,"ratePerSession":700},{"id":null,"minSessions":2,"maxSessions":3,"ratePerSession":625},{"id":null,"minSessions":4,"maxSessions":5,"ratePerSession":500},{"id":null,"minSessions":6,"maxSessions":7,"ratePerSession":433},{"id":null,"minSessions":8,"maxSessions":9,"ratePerSession":406},{"id":null,"minSessions":10,"maxSessions":null,"ratePerSession":350}]';
    INSERT INTO public.task10_pricing_catalog_versions(regime,revision,tiers,fingerprint) VALUES ('late',1,v_tiers,encode(extensions.digest(v_tiers::text,'sha256'),'hex')) RETURNING id INTO v_id;
    INSERT INTO public.task10_pricing_catalog_heads VALUES ('late',v_id);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.task10_pricing_catalog_heads WHERE regime='early') THEN
    SELECT jsonb_agg(jsonb_build_object('id',t.id,'minSessions',t.min_sessions,'maxSessions',t.max_sessions,'ratePerSession',t.price_per_session) ORDER BY t.min_sessions)
    INTO v_tiers FROM public.pricing_tiers t JOIN public.course_types c ON c.id=t.course_type_id
    WHERE c.name::text='kids_group' AND t.valid_from <= (public.task10_clock_v1() AT TIME ZONE 'Asia/Bangkok')::date
      AND (t.valid_to IS NULL OR t.valid_to >= (public.task10_clock_v1() AT TIME ZONE 'Asia/Bangkok')::date);
    IF v_tiers IS NOT NULL THEN
      IF NOT public.task10_tiers_valid_v1(v_tiers) THEN RAISE EXCEPTION 'TASK10_AMBIGUOUS_INITIAL_TIERS'; END IF;
      INSERT INTO public.task10_pricing_catalog_versions(regime,revision,tiers,fingerprint) VALUES ('early',1,v_tiers,encode(extensions.digest(v_tiers::text,'sha256'),'hex')) RETURNING id INTO v_id;
      INSERT INTO public.task10_pricing_catalog_heads VALUES ('early',v_id);
    END IF;
  END IF;
END $$;
SELECT public.task10_bootstrap_catalogs_v1();
REVOKE ALL ON FUNCTION public.task10_bootstrap_catalogs_v1() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.task10_clock_v1(), public.task10_transaction_start_v1(), public.task10_tiers_valid_v1(jsonb), public.task10_immutable_evidence_v1() FROM PUBLIC,anon,authenticated;

COMMIT;
