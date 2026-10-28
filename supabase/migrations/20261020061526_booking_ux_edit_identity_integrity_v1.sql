BEGIN;
-- Duration/deadline remain immutable. Participants may change only through the
-- authorized unpaid edit transaction before any accepted receipt or grant.
CREATE OR REPLACE FUNCTION public.booking_ux_bill_guard_v1() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v jsonb:=nullif(current_setting('booking_ux.create',true),'')::jsonb;
BEGIN
 IF TG_OP='INSERT' THEN
  IF (SELECT enabled FROM booking_ux_control WHERE singleton) AND v IS NULL THEN RAISE EXCEPTION 'BOOKING_UX_REFRESH_REQUIRED';END IF;
  IF v IS NOT NULL THEN
   NEW.checkout_version:=1;NEW.checkout_deadline:=public.task10_clock_v1()+interval '30 minutes';NEW.expires_at:=NEW.checkout_deadline;
   NEW.package_snapshot:=nullif(v->'package','null');NEW.package_participants:=v->'participants';
  END IF;
 ELSE
  IF ROW(NEW.checkout_version,NEW.checkout_deadline,NEW.package_snapshot) IS DISTINCT FROM ROW(OLD.checkout_version,OLD.checkout_deadline,OLD.package_snapshot) THEN RAISE EXCEPTION 'BOOKING_UX_IMMUTABLE_BILL';END IF;
  IF (NEW.package_participants IS DISTINCT FROM OLD.package_participants OR OLD.package_snapshot IS NOT NULL AND ROW(NEW.learner_type,NEW.child_id) IS DISTINCT FROM ROW(OLD.learner_type,OLD.child_id)) AND NOT(
    OLD.package_snapshot IS NOT NULL AND OLD.status::text='pending_payment' AND NEW.status::text='pending_payment'
    AND coalesce(nullif(current_setting('booking_ux.edit',true),''),'')=OLD.id::text AND NOT public.task10_has_accepted_receipt_v1(OLD.id)
    AND NOT EXISTS(SELECT 1 FROM booking_package_units WHERE booking_id=OLD.id))
    AND NOT(OLD.status::text='cancelled' AND NEW.status::text='cancelled' AND NEW.child_id IS NULL AND NEW.learner_type IS NOT DISTINCT FROM OLD.learner_type AND NEW.package_participants IS NOT DISTINCT FROM OLD.package_participants)
    THEN RAISE EXCEPTION 'BOOKING_UX_IMMUTABLE_BILL';END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.booking_ux_bill_guard_v1() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.booking_ux_update_v1(p_actor uuid,p_request uuid,p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b bookings%ROWTYPE;r jsonb;c text;n integer;s jsonb:=p_input->'sessions';members jsonb:=p_input->'participants';before_members jsonb;prior booking_ux_requests%ROWTYPE;fp text;
BEGIN
 IF p_actor IS NULL OR p_request IS NULL THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_REQUEST';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('booking-ux-request|'||p_actor||'|'||p_request,0));
 fp:=encode(extensions.digest(p_input::text,'sha256'),'hex');SELECT * INTO prior FROM booking_ux_requests WHERE actor_id=p_actor AND request_id=p_request;
 IF FOUND THEN IF prior.operation<>'update' OR prior.fingerprint<>fp THEN RAISE EXCEPTION 'BOOKING_UX_IDEMPOTENCY_CONFLICT';END IF;RETURN prior.result||jsonb_build_object('idempotentReplay',true);END IF;
 IF NOT(SELECT enabled FROM booking_ux_control WHERE singleton) THEN RAISE EXCEPTION 'BOOKING_UX_DISABLED';END IF;
 SELECT * INTO b FROM bookings WHERE id=(p_input->>'bookingId')::uuid AND user_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_UX_FORBIDDEN';END IF;
 IF b.package_snapshot IS NULL OR b.status::text<>'pending_payment' THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_REQUEST';END IF;
 IF (p_input->>'courseTypeId')::uuid IS DISTINCT FROM b.course_type_id THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_REQUEST';END IF;
 IF jsonb_typeof(members)IS DISTINCT FROM 'array' OR jsonb_array_length(members)NOT BETWEEN 1 AND 20
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(members)x WHERE x<>'null'::jsonb AND NOT EXISTS(SELECT 1 FROM children WHERE id=(x#>>'{}')::uuid AND parent_id=p_actor))
  OR (SELECT count(*)<>count(DISTINCT x) FROM jsonb_array_elements(members)x) THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_LEARNER';END IF;
 SELECT name::text INTO c FROM course_types WHERE id=b.course_type_id;
 IF c='adult_group' AND members<>'[null]'::jsonb THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_LEARNER';END IF;
 IF jsonb_typeof(s)IS DISTINCT FROM 'array' OR jsonb_array_length(s)>500 THEN RAISE EXCEPTION 'BOOKING_UX_TOO_MANY_ROUNDS';END IF;
 SELECT count(DISTINCT(x->>'date',x->>'startTime',x->>'endTime',x->>'branchId')) INTO n FROM jsonb_array_elements(s)x;
 IF n>b.total_sessions OR (b.total_sessions=1 AND n<>1) THEN RAISE EXCEPTION 'BOOKING_UX_PACKAGE_QUANTITY';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(s)x WHERE ((x->>'date')::date+(x->>'startTime')::time) AT TIME ZONE 'Asia/Bangkok'<=b.checkout_deadline) THEN RAISE EXCEPTION 'BOOKING_UX_START_WITHIN_PAYMENT_WINDOW';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(s)x WHERE NOT members@>jsonb_build_array(x->'childId'))
  OR EXISTS(SELECT 1 FROM (SELECT x->>'date',x->>'startTime',x->>'endTime',x->>'branchId',count(*)n,count(DISTINCT coalesce(x->>'childId','self'))d FROM jsonb_array_elements(s)x GROUP BY 1,2,3,4)t WHERE t.n<>jsonb_array_length(members) OR t.d<>jsonb_array_length(members)) THEN RAISE EXCEPTION 'BOOKING_UX_FAMILY_PARTICIPANTS';END IF;
 IF c='private' AND EXISTS(SELECT 1 FROM jsonb_array_elements(s)x WHERE (x->>'endTime')::time-(x->>'startTime')::time<>interval '1 hour') THEN RAISE EXCEPTION 'BOOKING_UX_UNIT_DURATION';END IF;
 PERFORM set_config('booking_ux.create',jsonb_build_object('package',b.package_snapshot,'participants',members)::text,true);
 r:=public.task10_write_legacy_booking_v1(p_actor,'update',p_request,p_input||jsonb_build_object('totalSessions',b.total_sessions,'learnerType',CASE WHEN members@>'[null]' THEN 'self' ELSE 'child' END,'childId',CASE WHEN jsonb_array_length(members)=1 THEN members->>0 END));
 -- The released writer has acquired the shared family/month and booking locks,
 -- rechecked receipt eligibility, and committed all row edits in this transaction.
 SELECT * INTO b FROM bookings WHERE id=(p_input->>'bookingId')::uuid AND user_id=p_actor;
 before_members:=b.package_participants;
 IF ROW(before_members,b.learner_type,b.child_id) IS DISTINCT FROM ROW(members,CASE WHEN members@>'[null]' THEN 'self'::learner_type ELSE 'child'::learner_type END,(CASE WHEN jsonb_array_length(members)=1 THEN members->>0 END)::uuid) THEN
  PERFORM set_config('booking_ux.edit',b.id::text,true);
  UPDATE bookings SET package_participants=members,learner_type=CASE WHEN members@>'[null]' THEN 'self'::learner_type ELSE 'child'::learner_type END,child_id=(CASE WHEN jsonb_array_length(members)=1 THEN members->>0 END)::uuid WHERE id=b.id;
  INSERT INTO activity_logs(user_id,action,entity_type,entity_id,details)VALUES(p_actor,'booking_package_participants_changed','booking',b.id,jsonb_build_object('before',before_members,'after',members,'requestId',p_request));
 END IF;
 PERFORM set_config('booking_ux.create','',true);PERFORM set_config('booking_ux.edit','',true);
 r:=r||jsonb_build_object('deadline',b.checkout_deadline);
 INSERT INTO booking_ux_requests(actor_id,request_id,operation,fingerprint,result)VALUES(p_actor,p_request,'update',fp,r);
 RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.booking_ux_update_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.booking_ux_update_v1(uuid,uuid,jsonb) TO service_role;

-- A real FK also protects a zero-round family purchase against deletion races.
CREATE TABLE public.booking_ux_package_learners(booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE RESTRICT,PRIMARY KEY(booking_id,child_id));
CREATE INDEX booking_ux_package_learners_child ON public.booking_ux_package_learners(child_id);
ALTER TABLE public.booking_ux_package_learners ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_ux_package_learners FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.booking_ux_package_learners TO service_role;
-- Only the new contract's derived references; no legacy financial/expiry row is
-- converted, and no right is granted. On first release this set is empty.
INSERT INTO public.booking_ux_package_learners(booking_id,child_id)
SELECT b.id,(x#>>'{}')::uuid FROM public.bookings b CROSS JOIN LATERAL jsonb_array_elements(b.package_participants)x
WHERE b.checkout_version=1 AND b.package_snapshot IS NOT NULL AND b.status::text<>'cancelled' AND x<>'null'::jsonb;
CREATE FUNCTION public.booking_ux_bind_learners_v1() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.package_snapshot IS NULL THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND NEW.package_participants IS NOT DISTINCT FROM OLD.package_participants AND (NEW.status::text='cancelled')=(OLD.status::text='cancelled') THEN RETURN NEW;END IF;
 DELETE FROM booking_ux_package_learners WHERE booking_id=NEW.id AND (NEW.status::text='cancelled' OR NOT NEW.package_participants@>jsonb_build_array(child_id));
 IF NEW.status::text<>'cancelled' THEN INSERT INTO booking_ux_package_learners(booking_id,child_id)SELECT NEW.id,(x#>>'{}')::uuid FROM jsonb_array_elements(NEW.package_participants)x WHERE x<>'null'::jsonb ON CONFLICT DO NOTHING;END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER booking_ux_bind_learners AFTER INSERT OR UPDATE OF package_participants,status ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.booking_ux_bind_learners_v1();
REVOKE ALL ON FUNCTION public.booking_ux_bind_learners_v1() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.booking_ux_preserve_learner_v1() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM booking_ux_package_learners WHERE child_id=OLD.id) THEN
  RAISE EXCEPTION 'ผู้เรียนนี้ยังถูกอ้างอิงในแพ็กเกจ จึงลบข้อมูลไม่ได้' USING DETAIL='BOOKING_UX_LEARNER_REFERENCED';
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER booking_ux_preserve_learner BEFORE DELETE ON public.children FOR EACH ROW EXECUTE FUNCTION public.booking_ux_preserve_learner_v1();
REVOKE ALL ON FUNCTION public.booking_ux_preserve_learner_v1() FROM PUBLIC,anon,authenticated,service_role;

-- The bounded row budget accommodates all twenty Family participants in a full
-- ten-hour package. The purchased-unit limit remains separate and authoritative.
DO $patch$ DECLARE d text:=pg_get_functiondef('public.booking_ux_create_v1(uuid,uuid,jsonb)'::regprocedure);a text:='IF jsonb_array_length(v_sessions)>100 THEN';
BEGIN IF position(a IN d)=0 THEN RAISE EXCEPTION 'BOOKING_UX_ROW_BUDGET_DRIFT';END IF;EXECUTE replace(d,a,'IF jsonb_array_length(v_sessions)>500 THEN');END $patch$;
DO $patch$ DECLARE d text:=pg_get_functiondef('public.task10_write_legacy_booking_v1(uuid,text,uuid,jsonb)'::regprocedure);a text:='IF p_action=''cancel'' THEN';
BEGIN IF position(a IN d)=0 THEN RAISE EXCEPTION 'BOOKING_UX_LEGACY_EDIT_DRIFT';END IF;EXECUTE replace(d,a,'IF p_action=''update'' AND v_old.package_snapshot IS NOT NULL AND nullif(current_setting(''booking_ux.create'',true),'''') IS NULL THEN RAISE EXCEPTION ''BOOKING_UX_REFRESH_REQUIRED'';END IF; '||a);END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
