BEGIN;
CREATE FUNCTION public.booking_ux_set_token_v1(p_actor uuid,p_ids uuid[]) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT md5(coalesce(jsonb_agg(jsonb_build_object('bill',to_jsonb(b),'revision',sc.revision,'sessions',
  (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM booking_sessions s WHERE s.booking_id=b.id)) ORDER BY b.id)::text,''))
 FROM bookings b LEFT JOIN booking_pricing_scopes sc ON sc.id=b.pricing_scope_id WHERE b.user_id=p_actor AND b.id=ANY(p_ids)
$$;
CREATE FUNCTION public.booking_ux_edit_set_v1(p_actor uuid,p_request uuid,p_input jsonb,p_preview boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ids uuid[];b bookings%ROWTYPE;item jsonb;ss jsonb;norm jsonb;payload jsonb;policy jsonb;revision bigint;
 result jsonb;prior booking_ux_requests%ROWTYPE;fp text;scope uuid;scopes jsonb;gross numeric;total numeric;action text:=p_input->>'action';r record;sub uuid;
BEGIN
 IF p_actor IS NULL OR p_request IS NULL OR action IS NULL OR action NOT IN ('edit','cancel') OR jsonb_typeof(p_input->'bookingIds') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_REQUEST';END IF;
 SELECT array_agg(value::uuid ORDER BY value::uuid) INTO ids FROM jsonb_array_elements_text(p_input->'bookingIds');
 IF coalesce(cardinality(ids),0) NOT BETWEEN 1 AND 100 OR cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids)x) THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_REQUEST';END IF;
 PERFORM pg_advisory_xact_lock_shared(10,1);PERFORM pg_advisory_xact_lock_shared(10,2);PERFORM pg_advisory_xact_lock_shared(10,3);
 PERFORM pg_advisory_xact_lock(hashtextextended('booking-ux-set|'||p_actor::text||'|'||p_request::text,0));
 fp:=md5(p_input::text);
 SELECT * INTO prior FROM booking_ux_requests WHERE actor_id=p_actor AND request_id=p_request;
 IF FOUND THEN IF prior.operation<>'set' OR prior.fingerprint<>fp THEN RAISE EXCEPTION 'BOOKING_UX_IDEMPOTENCY_CONFLICT';END IF;RETURN prior.result||jsonb_build_object('idempotentReplay',true);END IF;
 IF NOT(SELECT enabled FROM booking_ux_control WHERE singleton) THEN RAISE EXCEPTION 'BOOKING_UX_DISABLED';END IF;
 IF (SELECT count(*) FROM bookings WHERE id=ANY(ids) AND user_id=p_actor)<>cardinality(ids) THEN RAISE EXCEPTION 'BOOKING_UX_FORBIDDEN';END IF;
 SELECT jsonb_agg(jsonb_build_object('user_id',user_id,'course_type_id',course_type_id,'year',year,'month',month)) INTO scopes FROM bookings WHERE id=ANY(ids);
 PERFORM public.task10_lock_scopes_v1(scopes);
 FOR b IN SELECT * FROM bookings WHERE id=ANY(ids) ORDER BY id FOR UPDATE LOOP
  IF b.status::text<>'pending_payment' OR public.task10_booking_due_v1(b.id) OR public.task10_has_accepted_receipt_v1(b.id) THEN RAISE EXCEPTION 'BOOKING_UX_SET_CHANGED';END IF;
  IF b.pricing_scope_id IS NOT NULL THEN
   IF scope IS NOT NULL AND scope<>b.pricing_scope_id THEN RAISE EXCEPTION 'BOOKING_UX_SET_CHANGED';END IF;scope:=b.pricing_scope_id;
   IF EXISTS(SELECT 1 FROM bookings WHERE pricing_scope_id=scope AND status::text='pending_payment' AND NOT id=ANY(ids)) THEN RAISE EXCEPTION 'BOOKING_UX_SET_CHANGED';END IF;
  END IF;
 END LOOP;
 IF scope IS NOT NULL AND EXISTS(SELECT 1 FROM bookings WHERE id=ANY(ids) AND pricing_scope_id IS DISTINCT FROM scope) THEN RAISE EXCEPTION 'BOOKING_UX_SET_CHANGED';END IF;
 IF public.booking_ux_set_token_v1(p_actor,ids) IS DISTINCT FROM p_input->>'token' THEN RAISE EXCEPTION 'BOOKING_UX_SET_CHANGED';END IF;
 IF action='edit' AND (jsonb_typeof(p_input->'edits') IS DISTINCT FROM 'array' OR jsonb_array_length(p_input->'edits')<>cardinality(ids)
  OR (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_input->'edits')x)<>cardinality(ids)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_input->'edits')x WHERE NOT (x->>'id')::uuid=ANY(ids))) THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_REQUEST';END IF;
 -- The preview executes the real validators/writers inside a subtransaction.
 -- Its deliberate exception rolls back every edit, receipt, log and slot effect.
 BEGIN
  FOR r IN SELECT id FROM progressive_payment_batches WHERE user_id=p_actor AND pricing_scope_id=scope AND status='prepared' ORDER BY id LOOP
   PERFORM public.cancel_progressive_prepared_batch_v1(r.id,p_actor,'booking_set_edited');
  END LOOP;
  FOR b IN SELECT * FROM bookings WHERE id=ANY(ids) ORDER BY created_at,id LOOP
   sub:=md5(p_request::text||b.id::text)::uuid;
   IF action='cancel' THEN
    IF b.pricing_scope_id IS NOT NULL THEN
     SELECT s.revision INTO revision FROM booking_pricing_scopes s WHERE id=b.pricing_scope_id;
     PERFORM public.cancel_progressive_pending_booking_v1(p_actor,b.id,sub,revision);
    ELSE PERFORM public.task10_write_legacy_booking_v1(p_actor,'cancel',sub,jsonb_build_object('bookingId',b.id));END IF;
   ELSE
    SELECT x INTO item FROM jsonb_array_elements(p_input->'edits')x WHERE (x->>'id')::uuid=b.id;
    ss:=item->'sessions';
    IF jsonb_typeof(ss) IS DISTINCT FROM 'array' OR jsonb_array_length(ss)>500 THEN RAISE EXCEPTION 'BOOKING_UX_TOO_MANY_ROUNDS';END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(ss)x WHERE ((x->>'date')::date+(x->>'startTime')::time) AT TIME ZONE 'Asia/Bangkok'<=public.task10_booking_deadline_v1(b.id)) THEN RAISE EXCEPTION 'BOOKING_UX_START_WITHIN_PAYMENT_WINDOW';END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(ss)x WHERE extract(month FROM (x->>'date')::date)<>b.month OR extract(year FROM (x->>'date')::date)<>b.year) THEN RAISE EXCEPTION 'TASK10_TARGET_MONTH';END IF;
    IF b.pricing_scope_id IS NOT NULL THEN
     SELECT coalesce(jsonb_agg(jsonb_build_object('date',x->>'date','start_time',x->>'startTime','end_time',x->>'endTime','branch_id',x->>'branchId','child_id',x->'childId','schedule_template_id',x->'scheduleTemplateId')),'[]') INTO norm FROM jsonb_array_elements(ss)x;
     SELECT s.revision INTO revision FROM booking_pricing_scopes s WHERE id=b.pricing_scope_id;
     policy:=public.task10_booking_policy_quote_v1(p_actor,b.course_type_id,make_date(b.year,b.month,1),'progressive',b.id);
     PERFORM public.task10_update_progressive_booking_v1(p_actor,b.id,coalesce((ss->0->>'branchId')::uuid,b.branch_id),norm,sub,revision,policy->>'fingerprint');
    ELSE
     gross:=public.task10_legacy_price_v1(p_actor,b.course_type_id,b.month,b.year,CASE WHEN b.package_snapshot IS NULL THEN jsonb_array_length(ss) ELSE b.total_sessions END,b.id);
     payload:=jsonb_build_object('bookingId',b.id,'courseTypeId',b.course_type_id,'branchId',coalesce((ss->0->>'branchId')::uuid,b.branch_id),'month',b.month,'year',b.year,'sessions',ss,'totalSessions',CASE WHEN b.package_snapshot IS NULL THEN jsonb_array_length(ss) ELSE b.total_sessions END,'totalAmount',gross,'expectedTotalPrice',gross,'participants',b.package_participants);
     IF b.package_snapshot IS NOT NULL THEN PERFORM public.booking_ux_update_v1(p_actor,sub,payload);
     ELSE PERFORM public.task10_write_legacy_booking_v1(p_actor,'update',sub,payload);END IF;
    END IF;
   END IF;
  END LOOP;
  SELECT coalesce(sum(total_price) FILTER(WHERE status::text<>'cancelled'),0) INTO total FROM bookings WHERE id=ANY(ids);
  result:=jsonb_build_object('success',true,'total',total,'bookingIds',to_jsonb(ids),'preview',p_preview);
  IF p_preview THEN RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='booking set preview rollback';END IF;
  IF action='edit' AND (p_input->>'expectedTotal' IS NULL OR total<>(p_input->>'expectedTotal')::numeric) THEN RAISE EXCEPTION 'TASK10_AMOUNT_CONFLICT';END IF;
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
 IF NOT p_preview THEN
  INSERT INTO booking_ux_requests(actor_id,request_id,operation,fingerprint,result) VALUES(p_actor,p_request,'set',fp,result);
  INSERT INTO activity_logs(user_id,action,entity_type,entity_id,details) VALUES(p_actor,'booking_payment_set_'||action,'booking',ids[1],jsonb_build_object('bookingIds',ids,'requestId',p_request));
 END IF;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.booking_ux_pending_summary_v1(p_actor uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 WITH sets AS (
  SELECT coalesce(b.pricing_scope_id,b.id) id, sum(b.total_price) amount,
   bool_or(public.task10_has_accepted_receipt_v1(b.id) OR b.status::text='paid') received,
   min(public.task10_booking_deadline_v1(b.id)) deadline
  FROM bookings b WHERE user_id=p_actor AND status::text IN ('pending_payment','paid') AND NOT public.task10_booking_due_v1(b.id)
  GROUP BY coalesce(b.pricing_scope_id,b.id)
 ) SELECT jsonb_build_object('count',count(*) FILTER(WHERE NOT received),'amount',coalesce(sum(amount) FILTER(WHERE NOT received),0),'deadline',min(deadline) FILTER(WHERE NOT received),'received',count(*) FILTER(WHERE received),'serverNow',public.task10_clock_v1()) FROM sets
$$;
REVOKE ALL ON FUNCTION public.booking_ux_set_token_v1(uuid,uuid[]),public.booking_ux_edit_set_v1(uuid,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.booking_ux_set_token_v1(uuid,uuid[]),public.booking_ux_edit_set_v1(uuid,uuid,jsonb,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
