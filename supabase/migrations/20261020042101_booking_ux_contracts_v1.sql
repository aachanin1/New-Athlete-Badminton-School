-- Owner-approved BOOKING-UX-1. Additive definitions; default OFF; no historical conversion.
BEGIN;
CREATE TABLE public.booking_ux_control(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),enabled boolean NOT NULL DEFAULT false);
INSERT INTO public.booking_ux_control DEFAULT VALUES;
CREATE TABLE public.booking_ux_packages(
 id text PRIMARY KEY, course text NOT NULL CHECK(course IN ('adult_group','private')),
 quantity integer NOT NULL CHECK(quantity>0), validity_months integer NOT NULL CHECK(validity_months BETWEEN 1 AND 120),
 revision bigint NOT NULL DEFAULT 1, updated_by uuid REFERENCES public.profiles(id),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(course,quantity));
INSERT INTO public.booking_ux_packages(id,course,quantity,validity_months) VALUES
 ('adult-1','adult_group',1,1),('adult-10','adult_group',10,10),('adult-16','adult_group',16,10),('private-1','private',1,1),('private-10','private',10,10);
CREATE TABLE public.booking_ux_requests(actor_id uuid NOT NULL REFERENCES public.profiles(id),request_id uuid NOT NULL,
 operation text NOT NULL,fingerprint text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(actor_id,request_id));
CREATE TABLE public.booking_package_units(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),booking_id uuid NOT NULL REFERENCES public.bookings(id),
 ordinal integer NOT NULL CHECK(ordinal>0),participants jsonb NOT NULL,status text NOT NULL DEFAULT 'available' CHECK(status IN ('available','redeemed')),
 expires_at timestamptz NOT NULL,session_ids uuid[],redeemed_at timestamptz,UNIQUE(booking_id,ordinal));
ALTER TABLE public.bookings ADD COLUMN checkout_version integer CHECK(checkout_version=1),ADD COLUMN checkout_deadline timestamptz,
 ADD COLUMN package_snapshot jsonb,ADD COLUMN package_participants jsonb;
CREATE INDEX booking_ux_pending_deadline ON public.bookings(checkout_deadline,id) WHERE checkout_version=1 AND status IN ('pending_payment','paid');
CREATE INDEX booking_package_available ON public.booking_package_units(booking_id,status);
ALTER TABLE public.booking_ux_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_ux_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_ux_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_package_units ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_ux_control,public.booking_ux_packages,public.booking_ux_requests,public.booking_package_units FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.booking_ux_control,public.booking_ux_packages,public.booking_ux_requests,public.booking_package_units TO service_role;
CREATE TRIGGER booking_ux_request_immutable BEFORE UPDATE OR DELETE ON public.booking_ux_requests FOR EACH ROW EXECUTE FUNCTION public.task10_immutable_evidence_v1();

CREATE FUNCTION public.booking_ux_catalog_v1() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('price',public.task10_legacy_price_v1(NULL,c.id,extract(month FROM now())::int,extract(year FROM now())::int,p.quantity,NULL)) ORDER BY p.course,p.quantity),'[]')
 FROM public.booking_ux_packages p JOIN public.course_types c ON c.name::text=p.course
$$;
CREATE FUNCTION public.booking_ux_set_duration_v1(p_actor uuid,p_id text,p_months integer,p_revision bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.booking_ux_packages%ROWTYPE;r jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND role::text='super_admin') THEN RAISE EXCEPTION 'BOOKING_UX_FORBIDDEN';END IF;
 IF p_months IS NULL OR p_months<1 OR p_months>120 THEN RAISE EXCEPTION 'BOOKING_UX_DURATION_INVALID';END IF;
 SELECT * INTO p FROM booking_ux_packages WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR p.quantity=1 OR p.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'BOOKING_UX_PACKAGE_CHANGED';END IF;
 UPDATE booking_ux_packages SET validity_months=p_months,revision=revision+1,updated_by=p_actor,updated_at=clock_timestamp() WHERE id=p_id RETURNING to_jsonb(booking_ux_packages.*) INTO r;
 INSERT INTO activity_logs(user_id,action,entity_type,details)VALUES(p_actor,'booking_package_duration_changed','booking_package',jsonb_build_object('before',to_jsonb(p),'after',r));
 RETURN r;
END $$;
CREATE FUNCTION public.booking_ux_expiry_v1(p_booking uuid) RETURNS timestamptz LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN b.package_snapshot IS NOT NULL THEN
 (date_trunc('month',p.verified_at AT TIME ZONE 'Asia/Bangkok')+make_interval(months=>(b.package_snapshot->>'validity_months')::int)) AT TIME ZONE 'Asia/Bangkok'-interval '1 millisecond'
 END FROM bookings b JOIN payments p ON p.booking_id=b.id AND p.status::text='approved' AND p.verified_at IS NOT NULL
 WHERE b.id=p_booking AND (SELECT count(*) FROM payments x WHERE x.booking_id=b.id AND x.status::text='approved' AND x.verified_at IS NOT NULL)=1
$$;
CREATE FUNCTION public.booking_ux_bill_guard_v1() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v jsonb:=nullif(current_setting('booking_ux.create',true),'')::jsonb;
BEGIN
 IF TG_OP='INSERT' THEN
  IF (SELECT enabled FROM booking_ux_control WHERE singleton) AND v IS NULL THEN RAISE EXCEPTION 'BOOKING_UX_REFRESH_REQUIRED';END IF;
  IF v IS NOT NULL THEN
   NEW.checkout_version:=1;NEW.checkout_deadline:=public.task10_clock_v1()+interval '30 minutes';NEW.expires_at:=NEW.checkout_deadline;
   NEW.package_snapshot:=nullif(v->'package','null');NEW.package_participants:=v->'participants';
  END IF;
 ELSIF ROW(NEW.checkout_version,NEW.checkout_deadline,NEW.package_snapshot,NEW.package_participants) IS DISTINCT FROM ROW(OLD.checkout_version,OLD.checkout_deadline,OLD.package_snapshot,OLD.package_participants) THEN
  RAISE EXCEPTION 'BOOKING_UX_IMMUTABLE_BILL';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER zz_booking_ux_bill_guard BEFORE INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.booking_ux_bill_guard_v1();
CREATE FUNCTION public.booking_ux_issue_units_v1() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_count integer;v_expiry timestamptz;v_course text;
BEGIN
 IF NEW.status::text<>'verified' OR NEW.package_snapshot IS NULL THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND OLD.status::text='verified' THEN RETURN NEW;END IF;
 v_expiry:=public.booking_ux_expiry_v1(NEW.id);
 IF v_expiry IS NULL THEN RAISE EXCEPTION 'BOOKING_UX_PAYMENT_EVIDENCE_REQUIRED';END IF;
 SELECT c.name::text INTO v_course FROM course_types c WHERE c.id=NEW.course_type_id;
 IF EXISTS(SELECT 1 FROM booking_sessions s WHERE s.booking_id=NEW.id AND (s.date+s.end_time) AT TIME ZONE 'Asia/Bangkok'>v_expiry) THEN RAISE EXCEPTION 'BOOKING_UX_TARGET_AFTER_EXPIRY';END IF;
 SELECT count(DISTINCT (s.date,s.start_time,s.end_time,s.branch_id)) INTO v_count FROM booking_sessions s WHERE s.booking_id=NEW.id;
 IF v_count>NEW.total_sessions THEN RAISE EXCEPTION 'BOOKING_UX_PACKAGE_OVERDRAWN';END IF;
 INSERT INTO booking_package_units(booking_id,ordinal,participants,expires_at)
  SELECT NEW.id,i,NEW.package_participants,v_expiry FROM generate_series(1,NEW.total_sessions-v_count) i ON CONFLICT(booking_id,ordinal)DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER zz_booking_ux_issue_units AFTER UPDATE OF status ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.booking_ux_issue_units_v1();

CREATE FUNCTION public.booking_ux_create_v1(p_actor uuid,p_request uuid,p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_prior booking_ux_requests%ROWTYPE;v_fp text;v_result jsonb;v_package booking_ux_packages%ROWTYPE;
 v_course text;v_participants jsonb;v_sessions jsonb:=p_input->'sessions';v_quantity integer;v_count integer;v_deadline timestamptz;v_policy jsonb;r jsonb;
BEGIN
 IF NOT (SELECT enabled FROM booking_ux_control WHERE singleton) THEN RAISE EXCEPTION 'BOOKING_UX_DISABLED';END IF;
 IF p_actor IS NULL OR p_request IS NULL OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor) OR jsonb_typeof(v_sessions)IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_REQUEST';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('booking-ux-request|'||p_actor||'|'||p_request,0));
 v_fp:=encode(extensions.digest(p_input::text,'sha256'),'hex');SELECT * INTO v_prior FROM booking_ux_requests WHERE actor_id=p_actor AND request_id=p_request;
 IF FOUND THEN IF v_prior.operation<>'create' OR v_prior.fingerprint<>v_fp THEN RAISE EXCEPTION 'BOOKING_UX_IDEMPOTENCY_CONFLICT';END IF;RETURN v_prior.result||'{"idempotentReplay":true}';END IF;
 SELECT name::text INTO v_course FROM course_types WHERE id=(p_input->>'courseTypeId')::uuid;
 v_deadline:=public.task10_clock_v1()+interval '30 minutes';
 IF jsonb_array_length(v_sessions)>100 THEN RAISE EXCEPTION 'BOOKING_UX_TOO_MANY_ROUNDS';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_sessions)x WHERE ((x->>'date')::date+(x->>'startTime')::time) AT TIME ZONE 'Asia/Bangkok'<=v_deadline) THEN RAISE EXCEPTION 'BOOKING_UX_START_WITHIN_PAYMENT_WINDOW';END IF;
 IF v_course='kids_group' THEN
  IF jsonb_array_length(v_sessions)=0 THEN RAISE EXCEPTION 'BOOKING_UX_SELECT_ROUND';END IF;
  PERFORM set_config('booking_ux.create','{}',true);
  SELECT jsonb_agg(jsonb_build_object('date',x->>'date','start_time',x->>'startTime','end_time',x->>'endTime','branch_id',x->>'branchId','child_id',x->>'childId','schedule_template_id',x->>'scheduleTemplateId')) INTO r FROM jsonb_array_elements(v_sessions)x;
  v_result:=public.task10_create_progressive_booking_v1(p_actor,(p_input->>'learnerType')::learner_type,(p_input->>'childId')::uuid,(p_input->>'branchId')::uuid,(p_input->>'courseTypeId')::uuid,
   r,(p_input->'coupon'->>'id')::uuid,p_request,(p_input->>'expectedScopeRevision')::bigint,(p_input->>'expectedLegacyBaselineSessions')::int,p_input->>'expectedLegacyBaselineFingerprint',p_input->>'expectedPolicyFingerprint');
 ELSE
  SELECT * INTO v_package FROM booking_ux_packages WHERE id=p_input->>'packageId' AND course=v_course FOR SHARE;
  IF NOT FOUND OR v_package.revision IS DISTINCT FROM (p_input->>'packageRevision')::bigint THEN RAISE EXCEPTION 'BOOKING_UX_PACKAGE_CHANGED';END IF;
  v_quantity:=v_package.quantity;
  v_participants:=p_input->'participants';
  IF jsonb_typeof(v_participants)IS DISTINCT FROM 'array' OR jsonb_array_length(v_participants)=0 OR jsonb_array_length(v_participants)>20
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_participants)x WHERE x<>'null'::jsonb AND NOT EXISTS(SELECT 1 FROM children WHERE id=(x#>>'{}')::uuid AND parent_id=p_actor))
   OR (SELECT count(*)<>count(DISTINCT x) FROM jsonb_array_elements(v_participants)x) THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_LEARNER';END IF;
  IF v_course='adult_group' AND v_participants<>'[null]'::jsonb THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_LEARNER';END IF;
  SELECT count(DISTINCT (x->>'date',x->>'startTime',x->>'endTime',x->>'branchId')) INTO v_count FROM jsonb_array_elements(v_sessions)x;
  IF v_count>v_quantity OR (v_quantity=1 AND v_count<>1) THEN RAISE EXCEPTION 'BOOKING_UX_PACKAGE_QUANTITY';END IF;
  IF v_course='private' AND EXISTS(SELECT 1 FROM jsonb_array_elements(v_sessions)x WHERE (x->>'endTime')::time-(x->>'startTime')::time<>interval '1 hour') THEN RAISE EXCEPTION 'BOOKING_UX_UNIT_DURATION';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_sessions)x WHERE NOT v_participants@>jsonb_build_array(x->'childId'))
   OR EXISTS(SELECT 1 FROM (SELECT x->>'date',x->>'startTime',x->>'endTime',x->>'branchId',count(*)n,count(DISTINCT coalesce(x->>'childId','self'))d FROM jsonb_array_elements(v_sessions)x GROUP BY 1,2,3,4)t WHERE t.n<>jsonb_array_length(v_participants) OR t.d<>jsonb_array_length(v_participants)) THEN RAISE EXCEPTION 'BOOKING_UX_FAMILY_PARTICIPANTS';END IF;
  v_policy:=to_jsonb(v_package)||jsonb_build_object('unit',CASE WHEN v_course='private' THEN 'hour' ELSE 'session' END);
  PERFORM set_config('booking_ux.create',jsonb_build_object('package',v_policy,'participants',v_participants)::text,true);
  v_result:=public.task10_write_legacy_booking_v1(p_actor,'create',p_request,p_input||jsonb_build_object('totalSessions',v_quantity,'learnerType',CASE WHEN v_participants@>'[null]' THEN 'self' ELSE 'child' END,'childId',CASE WHEN jsonb_array_length(v_participants)=1 THEN v_participants->>0 END));
 END IF;
 PERFORM set_config('booking_ux.create','',true);
 v_result:=v_result||jsonb_build_object('success',true,'deadline',public.task10_booking_deadline_v1((v_result->>'bookingId')::uuid));
 INSERT INTO booking_ux_requests(actor_id,request_id,operation,fingerprint,result)VALUES(p_actor,p_request,'create',v_fp,v_result);
 RETURN v_result;
END $$;

-- All existing payment guards and workers resolve the same new-bill deadline.
CREATE OR REPLACE FUNCTION public.task10_booking_deadline_v1(p_booking_id uuid) RETURNS timestamptz
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN b.checkout_version=1 THEN b.checkout_deadline ELSE least(b.expires_at,(SELECT min((s.date+s.start_time) AT TIME ZONE 'Asia/Bangkok') FROM booking_sessions s WHERE s.booking_id=b.id AND s.cancelled_at IS NULL AND s.status::text NOT IN ('rescheduled','walleted'))) END FROM bookings b WHERE b.id=p_booking_id
$$;

-- Audited minimal augmentation of the existing atomic Legacy writer. Its locks,
-- authoritative pricing, coupon, target validation and mutation ledger remain.
DO $patch$
DECLARE d text:=pg_get_functiondef('public.task10_write_legacy_booking_v1(uuid,text,uuid,jsonb)'::regprocedure);a text;b text;
BEGIN
 a:='jsonb_array_length(v_sessions)=0';b:='(jsonb_array_length(v_sessions)=0 AND nullif(current_setting(''booking_ux.create'',true),'''') IS NULL)';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'BOOKING_UX_LEGACY_BASELINE_DRIFT';END IF;d:=replace(d,a,b);
 a:='IF v_count<>v_quantity THEN';b:='IF v_count<>v_quantity AND nullif(current_setting(''booking_ux.create'',true),'''') IS NULL THEN';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'BOOKING_UX_LEGACY_QUANTITY_DRIFT';END IF;d:=replace(d,a,b);
 EXECUTE d;
END $patch$;

-- New package bills retain their duration snapshot through either User or Admin
-- Store. Old bills continue through the unmodified historical-tier evidence path.
DO $patch$
DECLARE n text;d text;a text;
BEGIN
 FOREACH n IN ARRAY ARRAY['task10_previous_wallet_store_v2','admin_wallet_store_body_v1'] LOOP
  SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=n;
  a:='(date_trunc(''month'', timezone(''Asia/Bangkok'', v_verified_at)) + interval ''10 months'')';
  IF position(a IN d)=0 THEN RAISE EXCEPTION 'BOOKING_UX_STORE_BASELINE_DRIFT %',n;END IF;
  d:=replace(d,a,'(date_trunc(''month'', timezone(''Asia/Bangkok'', v_verified_at)) + make_interval(months => coalesce((SELECT (package_snapshot->>''validity_months'')::integer FROM public.bookings WHERE id=v_selected.booking_id),10)))');
  EXECUTE d;
 END LOOP;
END $patch$;

DO $acl$
DECLARE r record;
BEGIN
 FOR r IN SELECT oid::regprocedure::text AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'booking_ux_%' LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION '||r.signature||' FROM PUBLIC,anon,authenticated,service_role';
 END LOOP;
END $acl$;
GRANT EXECUTE ON FUNCTION public.booking_ux_catalog_v1(),public.booking_ux_create_v1(uuid,uuid,jsonb),public.booking_ux_set_duration_v1(uuid,text,integer,bigint) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
