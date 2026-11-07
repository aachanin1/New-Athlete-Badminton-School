BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(10,1);

-- Keep the July corruption guard; exempt only a committed, source-backed
-- cross-month Makeup destination. No bill, price or entitlement is rewritten.
DO $$ BEGIN
 IF md5(replace(pg_get_functiondef('public.progressive_assert_scope_membership_v1(uuid,uuid,uuid,integer,integer)'::regprocedure),chr(13),'')) <> '7a3250af85e3cd3f33c9ba6da54641ee' THEN
  RAISE EXCEPTION 'BOOKING_MAKEUP_SCOPE_BASELINE_DRIFT';
 END IF;
END $$;

CREATE FUNCTION public.progressive_proven_makeup_destination_v1(p_session_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=public,pg_temp AS $$
DECLARE v_use public.task10_family_makeup_uses%ROWTYPE; v_root uuid;
BEGIN
 SELECT u.* INTO v_use
 FROM public.task10_family_makeup_uses u
 JOIN public.booking_sessions destination ON destination.id=u.destination_session_id
 JOIN public.bookings source_bill ON source_bill.id=destination.booking_id
 JOIN public.course_types course ON course.id=source_bill.course_type_id AND course.name::text='kids_group'
 JOIN public.booking_pricing_scopes source_scope ON source_scope.id=source_bill.pricing_scope_id
 JOIN public.booking_sessions predecessor ON predecessor.id=u.source_session_id
 JOIN public.booking_sessions root ON root.id=u.source_root_id
 JOIN public.children attending ON attending.id=destination.child_id AND attending.parent_id=source_bill.user_id
 JOIN public.children original_child ON original_child.id=u.source_child_id AND original_child.parent_id=source_bill.user_id
 WHERE destination.id=p_session_id AND destination.is_makeup
   AND source_bill.status::text='verified'
   AND source_scope.user_id=source_bill.user_id AND source_scope.course_type_id=source_bill.course_type_id
   AND source_scope.lesson_year=source_bill.year AND source_scope.lesson_month=source_bill.month AND source_scope.currency='THB'
   AND u.parent_id=source_bill.user_id AND u.source_booking_id=source_bill.id
   AND u.attending_child_id=destination.child_id
   AND destination.rescheduled_from_id=u.source_session_id
   AND predecessor.booking_id=source_bill.id AND predecessor.child_id=u.source_child_id AND NOT predecessor.is_makeup
   AND root.booking_id=source_bill.id AND root.child_id=u.source_child_id AND NOT root.is_makeup
   AND u.source_month=make_date(source_bill.year,source_bill.month,1)
   AND date_trunc('month',root.date)::date=u.source_month;
 -- The accepted Admin writer may choose any future month (20261027064841).
 -- Its persisted decision is authoritative; do not reapply destination admission
 -- dates, current quota, expiry or current source availability to spent history.
 IF NOT FOUND THEN RETURN false; END IF;

 -- Reuse canonical lineage checks: missing, cyclic or competing predecessors
 -- must not turn a stored flag or an inconsistent receipt into an exception.
 BEGIN
  v_root:=public.task10_source_root_v1(p_session_id);
  IF v_root IS DISTINCT FROM v_use.source_root_id
    OR public.task10_source_root_v1(v_use.source_session_id) IS DISTINCT FROM v_root THEN RETURN false; END IF;
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='TASK10_AMBIGUOUS_SOURCE' THEN RETURN false; END IF;
  RAISE;
 END;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.progressive_proven_makeup_destination_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.progressive_assert_scope_membership_v1(
 p_scope_id uuid,p_user_id uuid,p_course_type_id uuid,p_lesson_year integer,p_lesson_month integer
) RETURNS void LANGUAGE plpgsql STABLE SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.booking_pricing_scopes scope
   WHERE scope.id=p_scope_id AND scope.user_id=p_user_id AND scope.course_type_id=p_course_type_id
     AND scope.lesson_year=p_lesson_year AND scope.lesson_month=p_lesson_month AND scope.currency='THB') THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PROGRESSIVE_BOOKING_CONFLICT';
 END IF;
 IF EXISTS(SELECT 1 FROM public.bookings booking
   WHERE booking.user_id=p_user_id AND booking.course_type_id=p_course_type_id
     AND booking.status::text IN ('pending_payment','paid','verified')
     AND (booking.status::text<>'pending_payment' OR booking.expires_at IS NULL OR booking.expires_at>transaction_timestamp())
     AND booking.pricing_scope_id IS NOT NULL AND booking.pricing_scope_id IS DISTINCT FROM p_scope_id
     AND ((booking.year=p_lesson_year AND booking.month=p_lesson_month)
       OR EXISTS(SELECT 1 FROM public.booking_sessions session
         WHERE session.booking_id=booking.id
           AND extract(year FROM session.date)::integer=p_lesson_year
           AND extract(month FROM session.date)::integer=p_lesson_month
           AND NOT public.progressive_proven_makeup_destination_v1(session.id)))) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PROGRESSIVE_BOOKING_CONFLICT';
 END IF;
END $$;

COMMIT;
