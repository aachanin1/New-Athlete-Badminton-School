BEGIN;

-- A returned slip may be corrected only inside a new checkout's original window.
-- Historic on-time receipts still protect review/finalization; replay skips this
-- guard only after the exact stored request and fingerprint have been checked.
CREATE FUNCTION public.booking_ux_assert_new_receipt_window_v1(p_booking uuid)
RETURNS void LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.bookings WHERE id=p_booking AND checkout_version=1
    AND (checkout_deadline IS NULL OR checkout_deadline<=public.task10_clock_v1())) THEN
    RAISE EXCEPTION 'TASK10_BOOKING_DEADLINE';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.booking_ux_assert_new_receipt_window_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;

DO $patch$
DECLARE definition text; anchor text;
BEGIN
  SELECT pg_get_functiondef('public.task10_accept_legacy_slip_v1(uuid,uuid[],text,text,text,numeric,uuid)'::regprocedure) INTO definition;
  anchor:='PERFORM public.task10_assert_receipt_window_v1(b.id);';
  IF (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
    OR position('booking_ux_assert_new_receipt_window_v1' IN definition)>0 THEN
    RAISE EXCEPTION 'BOOKING_UX_LEGACY_RECEIPT_PATCH_MISMATCH';
  END IF;
  EXECUTE replace(definition,anchor,'PERFORM public.booking_ux_assert_new_receipt_window_v1(b.id); '||anchor);

  SELECT pg_get_functiondef('public.task10_record_batch_receipts_v1(uuid,text,text)'::regprocedure) INTO definition;
  anchor:='INSERT INTO public.task10_accepted_receipts(booking_id,batch_id,storage_path,accepted_at,deadline,fingerprint,evidence,request_id)';
  IF (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
    OR position('booking_ux_assert_new_receipt_window_v1' IN definition)>0 THEN
    RAISE EXCEPTION 'BOOKING_UX_BATCH_RECEIPT_PATCH_MISMATCH';
  END IF;
  EXECUTE replace(definition,anchor,'PERFORM public.booking_ux_assert_new_receipt_window_v1(m.booking_id); '||anchor);
END $patch$;

NOTIFY pgrst,'reload schema';
COMMIT;
