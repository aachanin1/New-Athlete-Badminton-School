BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='40s';
SELECT pg_advisory_xact_lock(10,1);

-- An explicit owned unpaid edit may add learners using the SAME bill and the
-- normal multi-child Kids / atomic Family Private pricing semantics. It never
-- replaces an original learner or extends the original payment window.
CREATE FUNCTION public.booking_ux_edit_learners_v4(p_actor uuid,p_booking uuid,p_edit jsonb,p_request uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b bookings%ROWTYPE;c text;members jsonb;original_members jsonb;s jsonb:=p_edit->'sessions';prior_write text;
BEGIN
 IF NOT p_edit ? 'participants' THEN RETURN;END IF;
 SELECT * INTO b FROM bookings WHERE id=p_booking AND user_id=p_actor FOR UPDATE;
 IF NOT FOUND OR b.status::text<>'pending_payment' OR public.task10_booking_due_v1(b.id)
  OR public.task10_has_accepted_receipt_v1(b.id) THEN RAISE EXCEPTION 'BOOKING_UX_SET_CHANGED';END IF;
 SELECT name::text INTO c FROM course_types WHERE id=b.course_type_id;
 IF jsonb_typeof(p_edit->'participants') IS DISTINCT FROM 'array' OR jsonb_typeof(s) IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_edit->'participants') NOT BETWEEN 1 AND (CASE WHEN c='kids_group' THEN 500 ELSE 20 END)
 THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_LEARNER';END IF;
 SELECT jsonb_agg(CASE WHEN x='null'::jsonb THEN 'null'::jsonb ELSE to_jsonb((x#>>'{}')::uuid) END) INTO members
  FROM jsonb_array_elements(p_edit->'participants')x;
 IF (SELECT count(*)<>count(DISTINCT x) FROM jsonb_array_elements(members)x) THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_LEARNER';END IF;
 IF c='adult_group' THEN
  IF members<>'[null]'::jsonb THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_LEARNER';END IF;RETURN;
 END IF;
 IF c NOT IN ('kids_group','private') OR c='private' AND b.package_snapshot IS NULL THEN RAISE EXCEPTION 'BOOKING_UX_REFRESH_REQUIRED';END IF;
 IF c='kids_group' AND (b.learner_type::text<>'child' OR members@>'[null]'::jsonb) THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_LEARNER';END IF;
 -- Ownership is rechecked while SHARE row locks also protect against a
 -- concurrent child deletion/reparent before its session/FK references exist.
 PERFORM ch.id FROM children ch WHERE ch.id IN(SELECT (x#>>'{}')::uuid FROM jsonb_array_elements(members)x WHERE x<>'null'::jsonb)
  AND ch.parent_id=p_actor ORDER BY ch.id FOR SHARE;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(members)x WHERE x<>'null'::jsonb
  AND NOT EXISTS(SELECT 1 FROM children ch WHERE ch.id=(x#>>'{}')::uuid AND ch.parent_id=p_actor)) THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_LEARNER';END IF;
 IF c='private' THEN original_members:=b.package_participants;
 ELSE
  SELECT coalesce(jsonb_agg(DISTINCT to_jsonb(child_id)) FILTER(WHERE child_id IS NOT NULL),'[]') INTO original_members
   FROM booking_sessions WHERE booking_id=b.id AND status::text NOT IN ('cancelled','walleted','rescheduled');
  IF b.child_id IS NOT NULL AND NOT original_members@>jsonb_build_array(b.child_id) THEN original_members:=original_members||jsonb_build_array(b.child_id);END IF;
 END IF;
 IF original_members IS NULL OR NOT members@>original_members THEN RAISE EXCEPTION 'BOOKING_UX_LEARNER_ADDITION_ONLY';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(s)x WHERE NOT members@>jsonb_build_array((x->>'childId')::uuid)) THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_LEARNER';END IF;
 IF c='kids_group' AND EXISTS(SELECT 1 FROM jsonb_array_elements(members)m WHERE NOT EXISTS
  (SELECT 1 FROM jsonb_array_elements(s)x WHERE (x->>'childId')::uuid=(m#>>'{}')::uuid)) THEN RAISE EXCEPTION 'BOOKING_UX_LEARNER_ROUND_REQUIRED';END IF;
 IF c='kids_group' THEN
  -- The released Kids writer already validates/prices multiple children when
  -- its summary child_id is NULL, and derives the final single/multi summary.
  -- Change only that summary after outer original-set validation, inside the
  -- preview subtransaction. Per-session learner IDs remain exact.
  IF jsonb_array_length(members)>1 AND b.child_id IS NOT NULL THEN
   prior_write:=current_setting('task10.booking_write',true);PERFORM set_config('task10.booking_write','authorized',true);
   UPDATE bookings SET child_id=NULL WHERE id=b.id;
   PERFORM set_config('task10.booking_write',coalesce(prior_write,''),true);
  END IF;
 END IF;
 IF NOT original_members@>members THEN
  INSERT INTO activity_logs(user_id,action,entity_type,entity_id,details)
   VALUES(p_actor,'booking_edit_learners_added','booking',b.id,jsonb_build_object('before',original_members,'after',members,'requestId',p_request));
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.booking_ux_edit_learners_v4(uuid,uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;

DO $patch$
DECLARE d text;a text;b text;
BEGIN
 SELECT pg_get_functiondef('public.booking_ux_edit_set_v1(uuid,uuid,jsonb,boolean)'::regprocedure) INTO d;
 a:='IF p_input ? ''couponChanges'' THEN';
 b:=$body$
 -- New identity input must use the v3 intent/quote/finalization contract even
 -- if it does not change a coupon. Old clients with no participants keep their
 -- old path; a crafted new caller cannot skip quote or deferred zero guards.
 IF action='edit' AND EXISTS(SELECT 1 FROM jsonb_array_elements(p_input->'edits')x WHERE x ? 'participants')
  AND NOT p_input ? 'couponChanges' THEN RAISE EXCEPTION 'BOOKING_UX_REFRESH_REQUIRED';END IF;
 IF p_input ? 'couponChanges' THEN
 $body$;
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'LEARNER_EDIT_V4_INTENT_DRIFT';END IF;
 -- Only the first validation boundary, not each later coupon loop.
 d:=overlay(d placing b from position(a IN d) for length(a));
 a:='FOR b IN SELECT * FROM bookings WHERE id=ANY(ids) ORDER BY created_at,id LOOP';
 b:=$body$
 IF action='edit' THEN
  FOR item IN SELECT x FROM jsonb_array_elements(p_input->'edits')x ORDER BY x->>'id' LOOP
   PERFORM public.booking_ux_edit_learners_v4(p_actor,(item->>'id')::uuid,item,p_request);
  END LOOP;
 END IF;
 FOR b IN SELECT * FROM bookings WHERE id=ANY(ids) ORDER BY created_at,id LOOP
 $body$;
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'LEARNER_EDIT_V4_TRANSACTION_DRIFT';END IF;d:=replace(d,a,b);
 a:='''participants'',b.package_participants';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'LEARNER_EDIT_V4_PRIVATE_DRIFT';END IF;
 d:=replace(d,a,'''participants'',coalesce(item->''participants'',b.package_participants)');
 a:='''coupon_state'',coupon_row.status)';
 b:=$body$'coupon_state',coupon_row.status,'total_sessions',bill_row.total_sessions,'entitlement_sessions',bill_row.entitlement_sessions,
  'participants',coalesce(bill_row.package_participants,(SELECT jsonb_agg(DISTINCT to_jsonb(s.child_id) ORDER BY to_jsonb(s.child_id)) FROM booking_sessions s WHERE s.booking_id=bill_row.id AND s.status::text NOT IN ('cancelled','walleted','rescheduled')),jsonb_build_array(bill_row.child_id)))$body$;
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'LEARNER_EDIT_V4_RESULT_DRIFT';END IF;d:=replace(d,a,b);
 EXECUTE d;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
