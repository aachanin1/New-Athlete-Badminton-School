BEGIN;
CREATE OR REPLACE FUNCTION public.booking_ux_pending_summary_v1(p_actor uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('count',count(*),'amount',coalesce(sum(b.total_price),0),
  'deadline',min(public.task10_booking_deadline_v1(b.id)) FILTER(WHERE NOT public.task10_has_accepted_receipt_v1(b.id)))
 FROM bookings b WHERE user_id=p_actor AND status::text IN ('pending_payment','paid') AND NOT public.task10_booking_due_v1(b.id)
$$;
REVOKE ALL ON FUNCTION public.booking_ux_pending_summary_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.booking_ux_pending_summary_v1(uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
