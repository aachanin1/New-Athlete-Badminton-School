BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='40s';
SELECT pg_advisory_xact_lock(10,1);

-- Actual attendees are selected for an unused Private package hour. Preserve
-- the paid bill's issued roster and every other hour; never backfill old uses.
CREATE FUNCTION public.booking_ux_private_attendees_v6(p_actor uuid,p_members jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE members jsonb;
BEGIN
 IF p_actor IS NULL OR jsonb_typeof(p_members) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_LEARNER';END IF;
 IF jsonb_array_length(p_members) NOT BETWEEN 1 AND 20 OR EXISTS
  (SELECT 1 FROM jsonb_array_elements(p_members)x WHERE jsonb_typeof(x) NOT IN ('string','null')) THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_LEARNER';END IF;
 BEGIN
  SELECT jsonb_agg(CASE WHEN x='null'::jsonb THEN 'null'::jsonb ELSE to_jsonb((x#>>'{}')::uuid) END ORDER BY n)
   INTO members FROM jsonb_array_elements(p_members) WITH ORDINALITY t(x,n);
 EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_LEARNER';END;
 IF (SELECT count(*)<>count(DISTINCT x) FROM jsonb_array_elements(members)x) THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_LEARNER';END IF;
 -- Stable SHARE locks also protect against child deletion/reparent until all
 -- exact session rows and the protected package reference have been inserted.
 PERFORM c.id FROM children c WHERE c.id IN(SELECT (x#>>'{}')::uuid FROM jsonb_array_elements(members)x WHERE x<>'null'::jsonb)
  AND c.parent_id=p_actor ORDER BY c.id FOR SHARE;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(members)x WHERE x<>'null'::jsonb
  AND NOT EXISTS(SELECT 1 FROM children c WHERE c.id=(x#>>'{}')::uuid AND c.parent_id=p_actor)) THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_LEARNER';END IF;
 RETURN members;
END $$;
REVOKE ALL ON FUNCTION public.booking_ux_private_attendees_v6(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

DO $patch$
DECLARE d text;a text;b text;
BEGIN
 SELECT pg_get_functiondef('public.booking_ux_redeem_many_v1(uuid,uuid,jsonb)'::regprocedure) INTO d;
 a:='IF p_actor IS NULL OR p_request IS NULL OR jsonb_typeof(p_picks)';
 b:='PERFORM pg_advisory_xact_lock_shared(10,1); IF p_actor IS NULL OR p_request IS NULL OR jsonb_typeof(p_picks)';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'PRIVATE_USE_V6_LOCK_DRIFT';END IF;d:=replace(d,a,b);
 a:='member jsonb;v_child uuid;';b:='member jsonb;v_child uuid;v_members jsonb;';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'PRIVATE_USE_V6_DECLARE_DRIFT';END IF;d:=replace(d,a,b);
 a:='FOR member IN SELECT x FROM jsonb_array_elements(u.participants)x ORDER BY x::text LOOP';
 b:=$body$
   IF p ? 'participants' AND v_course<>'private' THEN RAISE EXCEPTION 'BOOKING_UX_INVALID_LEARNER';END IF;
   v_members:=u.participants;
   IF v_course='private' THEN v_members:=public.booking_ux_private_attendees_v6(p_actor,CASE WHEN p ? 'participants' THEN p->'participants' ELSE u.participants END);END IF;
   FOR member IN SELECT x FROM jsonb_array_elements(v_members)x ORDER BY x::text LOOP
 $body$;
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'PRIVATE_USE_V6_MEMBERS_DRIFT';END IF;d:=replace(d,a,b);
 a:='UPDATE booking_package_units SET status=''redeemed'',redeemed_at=clock_timestamp(),session_ids=v_sessions WHERE id=u.id;';
 b:=$body$
   IF v_course='private' THEN
    INSERT INTO booking_ux_package_learners(booking_id,child_id)
     SELECT b.id,(x#>>'{}')::uuid FROM jsonb_array_elements(v_members)x WHERE x<>'null'::jsonb ON CONFLICT DO NOTHING;
   END IF;
   UPDATE booking_package_units SET status='redeemed',redeemed_at=clock_timestamp(),session_ids=v_sessions,participants=v_members WHERE id=u.id;
 $body$;
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'PRIVATE_USE_V6_UNIT_DRIFT';END IF;d:=replace(d,a,b);
 a:='''unitId'',u.id,''sessionIds'',v_sessions,''requestId'',p_request)';
 b:='''unitId'',u.id,''sessionIds'',v_sessions,''requestId'',p_request,''issuedParticipants'',u.participants,''attendingParticipants'',v_members,''participantCount'',jsonb_array_length(v_members))';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'PRIVATE_USE_V6_AUDIT_DRIFT';END IF;d:=replace(d,a,b);
 a:='ELSIF p->>''kind''=''wallet'' THEN';b:='ELSIF p->>''kind''=''wallet'' THEN IF p ? ''participants'' THEN RAISE EXCEPTION ''BOOKING_UX_INVALID_LEARNER'';END IF;';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'PRIVATE_USE_V6_CREDIT_DRIFT';END IF;d:=replace(d,a,b);
 EXECUTE d;
END $patch$;

-- Capability boundary: a new application against an old schema cannot silently
-- spend the issued roster while ignoring requested attendees. Existing API
-- writers on this schema still use the patched v1; no-field old clients work.
CREATE FUNCTION public.booking_ux_redeem_many_v2(p_actor uuid,p_request uuid,p_picks jsonb)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.booking_ux_redeem_many_v1(p_actor,p_request,p_picks)
$$;
REVOKE ALL ON FUNCTION public.booking_ux_redeem_many_v2(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.booking_ux_redeem_many_v2(uuid,uuid,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
