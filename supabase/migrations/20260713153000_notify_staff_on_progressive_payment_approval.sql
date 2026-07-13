-- Notify operational staff when a Progressive payment batch is approved.
-- The notification is part of the existing atomic first-approval transition so
-- an idempotent approval replay cannot create duplicate recipient rows.

CREATE OR REPLACE FUNCTION public.approve_progressive_payment_batch_v1(
  p_batch_id uuid,
  p_actor_id uuid,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch public.progressive_payment_batches%ROWTYPE;
  v_scope public.booking_pricing_scopes%ROWTYPE;
  v_fingerprint text;
  v_member record;
  v_count integer;
  v_allocation_total numeric(12, 2);
  v_new_revision bigint;
BEGIN
  IF p_batch_id IS NULL OR p_actor_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;
  v_fingerprint := md5(concat_ws('|', 'approve', p_batch_id::text, p_actor_id::text));
  PERFORM pg_advisory_xact_lock(hashtextextended('progressive-payment-batch|' || p_batch_id::text, 0));
  SELECT batch.* INTO v_batch FROM public.progressive_payment_batches batch
  WHERE batch.id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_NOT_FOUND';
  END IF;
  IF v_batch.status = 'approved' THEN
    IF v_batch.decision_idempotency_key IS DISTINCT FROM p_idempotency_key
      OR v_batch.decision_request_fingerprint IS DISTINCT FROM v_fingerprint
    THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN public.progressive_payment_batch_result_v1(p_batch_id, true);
  END IF;
  IF v_batch.status = 'rejected' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_ALREADY_TERMINAL';
  END IF;
  IF v_batch.status NOT IN ('submitted', 'under_review') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_NOT_REVIEWABLE';
  END IF;

  v_scope := public.lock_progressive_payment_scope_v1(v_batch.pricing_scope_id);
  IF v_batch.user_id IS DISTINCT FROM v_scope.user_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_USER_MISMATCH';
  END IF;
  IF v_batch.currency IS DISTINCT FROM v_scope.currency THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_CURRENCY_MISMATCH';
  END IF;
  IF v_scope.locked_by_payment_batch_id IS DISTINCT FROM p_batch_id
    OR v_scope.revision IS DISTINCT FROM v_batch.pricing_scope_revision
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_SCOPE_REVISION_CONFLICT';
  END IF;
  PERFORM public.assert_progressive_payment_batch_members_v1(p_batch_id);

  SELECT count(*) INTO v_count FROM public.progressive_payment_batch_bookings member
  WHERE member.payment_batch_id = p_batch_id;
  UPDATE public.bookings booking SET status = 'verified'
  FROM public.progressive_payment_batch_bookings member
  WHERE member.payment_batch_id = p_batch_id AND member.booking_id = booking.id
    AND booking.status::text = 'pending_payment';
  IF NOT FOUND OR (SELECT count(*) FROM public.bookings booking
    JOIN public.progressive_payment_batch_bookings member ON member.booking_id = booking.id
    WHERE member.payment_batch_id = p_batch_id AND booking.status::text = 'verified') <> v_count
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_FINGERPRINT_CONFLICT';
  END IF;

  FOR v_member IN
    SELECT member.booking_id FROM public.progressive_payment_batch_bookings member
    WHERE member.payment_batch_id = p_batch_id AND member.coupon_reservation_id IS NOT NULL
    ORDER BY member.sequence_snapshot
  LOOP
    PERFORM public.consume_progressive_coupon_v1(v_member.booking_id, v_batch.user_id);
  END LOOP;

  INSERT INTO public.progressive_payment_allocations (payment_batch_id, booking_id, amount)
  SELECT member.payment_batch_id, member.booking_id, member.amount_snapshot
  FROM public.progressive_payment_batch_bookings member
  WHERE member.payment_batch_id = p_batch_id
  ON CONFLICT (payment_batch_id, booking_id) DO NOTHING;

  SELECT round(sum(allocation.amount)::numeric, 2) INTO v_allocation_total
  FROM public.progressive_payment_allocations allocation
  WHERE allocation.payment_batch_id = p_batch_id;
  IF v_allocation_total IS DISTINCT FROM v_batch.total_amount THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_AMOUNT_MISMATCH';
  END IF;

  UPDATE public.progressive_payment_batches
  SET status = 'approved', approved_at = transaction_timestamp(), approved_by = p_actor_id,
    decision_idempotency_key = p_idempotency_key, decision_request_fingerprint = v_fingerprint
  WHERE id = p_batch_id;
  UPDATE public.progressive_payment_batch_bookings SET active = false WHERE payment_batch_id = p_batch_id;
  UPDATE public.booking_pricing_scopes
  SET locked_by_payment_batch_id = NULL, locked_at = NULL, revision = revision + 1
  WHERE id = v_batch.pricing_scope_id
  RETURNING revision INTO v_new_revision;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (p_actor_id, 'progressive_payment_batch_approved', 'progressive_payment_batch', p_batch_id,
    jsonb_build_object('scopeId', v_batch.pricing_scope_id, 'totalAmount', v_batch.total_amount,
      'scopeRevision', v_new_revision, 'bookingCount', v_count));

  INSERT INTO public.notifications (user_id, title, message, type, link_url)
  VALUES (v_batch.user_id, 'ยืนยันการชำระเงินแล้ว',
    'ระบบยืนยันการชำระเงินแบบหลายรายการเรียบร้อยแล้ว', 'payment', '/dashboard/history');

  INSERT INTO public.notifications (user_id, title, message, type, link_url)
  SELECT profile.id, 'ยืนยันการชำระเงินแล้ว',
    'มีรายการชำระเงินแบบ Progressive ที่ยืนยันแล้ว กรุณาตรวจสอบที่หน้าการชำระเงิน',
    'payment', '/admin/payments'
  FROM public.profiles profile
  WHERE profile.role IN ('admin', 'super_admin');

  RETURN public.progressive_payment_batch_result_v1(p_batch_id, false);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_progressive_payment_batch_v1(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_progressive_payment_batch_v1(uuid, uuid, uuid)
  TO service_role;
