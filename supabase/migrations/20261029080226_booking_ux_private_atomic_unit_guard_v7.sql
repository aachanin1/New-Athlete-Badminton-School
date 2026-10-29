BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='40s';
SELECT pg_advisory_xact_lock(10,1);

-- Actual attendees can differ between purchased hours. Never let the legacy
-- same-bill/hour Family resolver merge two different atomic hour lineages.
-- Deferred evaluation sees the unit.session_ids written after member inserts.
CREATE FUNCTION public.booking_ux_private_unit_guard_v7() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE s public.booking_sessions%ROWTYPE;v_keys integer;v_broken boolean;v_package boolean;
BEGIN
 IF TG_OP='UPDATE' AND
   ROW(OLD.booking_id,OLD.date,OLD.start_time,OLD.end_time,OLD.branch_id,OLD.schedule_slot_id,OLD.rescheduled_from_id)
     IS NOT DISTINCT FROM
   ROW(NEW.booking_id,NEW.date,NEW.start_time,NEW.end_time,NEW.branch_id,NEW.schedule_slot_id,NEW.rescheduled_from_id)
   AND (OLD.status::text NOT IN ('rescheduled','walleted','cancelled') AND OLD.cancelled_at IS NULL)
     IS NOT DISTINCT FROM
       (NEW.status::text NOT IN ('rescheduled','walleted','cancelled') AND NEW.cancelled_at IS NULL)
 THEN RETURN NEW;END IF;
 -- A deferred NEW tuple can already have been moved/stored again in this TX.
 SELECT * INTO s FROM public.booking_sessions WHERE id=NEW.id;
 IF NOT FOUND OR s.status::text IN ('rescheduled','walleted','cancelled') OR s.cancelled_at IS NOT NULL THEN RETURN NEW;END IF;
 BEGIN
   PERFORM 1 FROM public.bookings b JOIN public.course_types c ON c.id=b.course_type_id
     WHERE b.id=s.booking_id AND b.status::text<>'cancelled' AND c.name::text='private'
     FOR UPDATE OF b NOWAIT;
   IF NOT FOUND THEN RETURN NEW;END IF;
 EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'BOOKING_UX_PRIVATE_HOUR_BUSY';END;
 IF (SELECT count(*) FROM public.booking_sessions x WHERE x.booking_id=s.booking_id
     AND ROW(x.date,x.start_time,x.end_time,x.branch_id,x.schedule_slot_id)
       IS NOT DISTINCT FROM ROW(s.date,s.start_time,s.end_time,s.branch_id,s.schedule_slot_id)
     AND x.status::text NOT IN ('rescheduled','walleted','cancelled') AND x.cancelled_at IS NULL)<2
 THEN RETURN NEW;END IF;
 WITH RECURSIVE ancestry AS (
   SELECT x.id member_id,x.id,x.rescheduled_from_id,x.date,x.start_time,x.end_time,x.branch_id,x.schedule_slot_id,
     ARRAY[x.id] seen,0 depth
   FROM public.booking_sessions x WHERE x.booking_id=s.booking_id
     AND ROW(x.date,x.start_time,x.end_time,x.branch_id,x.schedule_slot_id)
       IS NOT DISTINCT FROM ROW(s.date,s.start_time,s.end_time,s.branch_id,s.schedule_slot_id)
     AND x.status::text NOT IN ('rescheduled','walleted','cancelled') AND x.cancelled_at IS NULL
   UNION ALL
   SELECT a.member_id,p.id,p.rescheduled_from_id,p.date,p.start_time,p.end_time,p.branch_id,p.schedule_slot_id,
     a.seen||p.id,a.depth+1
   FROM ancestry a JOIN public.booking_sessions p ON p.id=a.rescheduled_from_id AND p.booking_id=s.booking_id
   WHERE a.depth<64 AND NOT(p.id=ANY(a.seen))
 ), roots AS (
   SELECT DISTINCT ON(member_id) * FROM ancestry ORDER BY member_id,depth DESC
 ), keys AS (
   SELECT r.*,u.n unit_count,coalesce(u.unit_key,
     jsonb_build_array('initial',r.date,r.start_time,r.end_time,r.branch_id,r.schedule_slot_id)::text) unit_key
   FROM roots r LEFT JOIN LATERAL (
     SELECT count(*) n,min('package:'||p.id::text) unit_key FROM public.booking_package_units p
     WHERE p.booking_id=s.booking_id AND r.id=ANY(p.session_ids)
   )u ON true
 )
 SELECT count(DISTINCT unit_key),coalesce(bool_or(rescheduled_from_id IS NOT NULL OR unit_count>1),false)
    ,coalesce(bool_or(unit_count>0),false) INTO v_keys,v_broken,v_package FROM keys;
 IF v_broken THEN RAISE EXCEPTION 'BOOKING_UX_PRIVATE_UNIT_LINEAGE';END IF;
 -- Initial-only legacy cohorts keep existing Family semantics. The new
 -- variable-roster state always involves a purchased remaining-unit root.
 IF v_keys>1 AND v_package THEN RAISE EXCEPTION 'BOOKING_UX_PRIVATE_HOUR_OVERLAP';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.booking_ux_private_unit_guard_v7() FROM PUBLIC,anon,authenticated,service_role;
CREATE CONSTRAINT TRIGGER booking_ux_private_unit_guard
 AFTER INSERT OR UPDATE ON public.booking_sessions
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.booking_ux_private_unit_guard_v7();

-- A new UI must not silently use a schema without the atomic-unit invariant.
CREATE FUNCTION public.booking_ux_redeem_many_v3(p_actor uuid,p_request uuid,p_picks jsonb)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.booking_ux_redeem_many_v1(p_actor,p_request,p_picks)
$$;
REVOKE ALL ON FUNCTION public.booking_ux_redeem_many_v3(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.booking_ux_redeem_many_v3(uuid,uuid,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
