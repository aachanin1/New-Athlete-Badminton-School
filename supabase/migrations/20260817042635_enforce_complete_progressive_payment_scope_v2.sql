-- Progressive Payment v2 keeps every v1 contract available for rollback while
-- requiring the exact, complete ordered pending-payment set for new prepares.
-- This migration is function/grant only: it performs no row backfill or DML.

CREATE FUNCTION public.validate_progressive_payment_complete_scope_v2(
  p_pricing_scope_id uuid,
  p_user_id uuid,
  p_booking_ids uuid[],
  p_current_batch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_scope public.booking_pricing_scopes%ROWTYPE;
  v_pending_ids uuid[];
BEGIN
  IF p_pricing_scope_id IS NULL OR p_user_id IS NULL OR p_booking_ids IS NULL
    OR cardinality(p_booking_ids) = 0
    OR cardinality(p_booking_ids) <> (
      SELECT count(DISTINCT selected.id)
      FROM unnest(p_booking_ids) selected(id)
    )
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  v_scope := public.lock_progressive_payment_scope_v1(p_pricing_scope_id);
  IF v_scope.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_USER_MISMATCH';
  END IF;

  PERFORM booking.id
  FROM public.bookings booking
  WHERE booking.pricing_scope_id = p_pricing_scope_id
    AND booking.status::text = 'pending_payment'
  ORDER BY booking.created_at, booking.id
  FOR UPDATE;

  SELECT array_agg(booking.id ORDER BY booking.created_at, booking.id)
  INTO v_pending_ids
  FROM public.bookings booking
  WHERE booking.pricing_scope_id = p_pricing_scope_id
    AND booking.status::text = 'pending_payment';

  IF v_pending_ids IS DISTINCT FROM p_booking_ids THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_PAYMENT_PREFIX_REQUIRED';
  END IF;

  RETURN public.validate_progressive_payment_prefix_v1(
    p_pricing_scope_id,
    p_user_id,
    p_booking_ids,
    p_current_batch_id
  );
END;
$$;

CREATE FUNCTION public.prepare_progressive_payment_batch_v2(
  p_user_id uuid,
  p_pricing_scope_id uuid,
  p_booking_ids uuid[],
  p_expected_scope_revision bigint,
  p_expected_total numeric DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_scope public.booking_pricing_scopes%ROWTYPE;
  v_existing public.progressive_payment_batches%ROWTYPE;
  v_validation jsonb;
  v_fingerprint text;
  v_total numeric(12, 2);
BEGIN
  IF p_user_id IS NULL OR p_pricing_scope_id IS NULL OR p_expected_scope_revision IS NULL
    OR p_expected_scope_revision < 1 OR p_idempotency_key IS NULL
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  v_fingerprint := md5(concat_ws('|', 'prepare', p_user_id::text, p_pricing_scope_id::text,
    coalesce(array_to_string(p_booking_ids, ','), ''), p_expected_scope_revision::text,
    coalesce(round(p_expected_total::numeric, 2)::text, '')));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'progressive-payment-request|' || p_user_id::text || '|' || p_idempotency_key::text,
    0
  ));

  SELECT batch.* INTO v_existing
  FROM public.progressive_payment_batches batch
  WHERE batch.user_id = p_user_id
    AND batch.prepare_idempotency_key = p_idempotency_key
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.prepare_request_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN public.progressive_payment_batch_result_v1(v_existing.id, true);
  END IF;

  v_scope := public.lock_progressive_payment_scope_v1(p_pricing_scope_id);
  IF v_scope.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_USER_MISMATCH';
  END IF;
  IF v_scope.locked_by_payment_batch_id IS NOT NULL OR v_scope.locked_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_SCOPE_LOCKED';
  END IF;
  IF v_scope.revision IS DISTINCT FROM p_expected_scope_revision THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_SCOPE_REVISION_CONFLICT';
  END IF;

  v_validation := public.validate_progressive_payment_complete_scope_v2(
    p_pricing_scope_id,
    p_user_id,
    p_booking_ids,
    NULL
  );
  v_total := (v_validation ->> 'totalAmount')::numeric;
  IF p_expected_total IS NOT NULL
    AND round(p_expected_total::numeric, 2) IS DISTINCT FROM v_total
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_AMOUNT_MISMATCH';
  END IF;

  RETURN public.prepare_progressive_payment_batch_v1(
    p_user_id,
    p_pricing_scope_id,
    p_booking_ids,
    p_expected_scope_revision,
    p_expected_total,
    p_idempotency_key
  );
END;
$$;

CREATE FUNCTION public.progressive_payment_batch_capability_v2()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'ready',
      to_regclass('public.progressive_payment_batches') IS NOT NULL
      AND to_regclass('public.progressive_payment_batch_bookings') IS NOT NULL
      AND to_regclass('public.progressive_payment_allocations') IS NOT NULL
      AND to_regprocedure('public.prepare_progressive_payment_batch_v1(uuid,uuid,uuid[],bigint,numeric,uuid)') IS NOT NULL
      AND to_regprocedure('public.prepare_progressive_payment_batch_v2(uuid,uuid,uuid[],bigint,numeric,uuid)') IS NOT NULL
      AND to_regprocedure('public.validate_progressive_payment_complete_scope_v2(uuid,uuid,uuid[],uuid)') IS NOT NULL
      AND to_regprocedure('public.submit_progressive_payment_batch_v1(uuid,uuid,jsonb,uuid)') IS NOT NULL
      AND to_regprocedure('public.approve_progressive_payment_batch_v1(uuid,uuid,uuid)') IS NOT NULL
      AND to_regprocedure('public.reject_progressive_payment_batch_v1(uuid,uuid,text,uuid)') IS NOT NULL,
    'version', 2,
    'legacyPaymentModel', 'batch_authority_with_allocations',
    'batchSelectionPolicy', 'all_pending_scope_v1'
  );
$$;

REVOKE ALL ON FUNCTION public.validate_progressive_payment_complete_scope_v2(uuid, uuid, uuid[], uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_progressive_payment_batch_v2(uuid, uuid, uuid[], bigint, numeric, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progressive_payment_batch_capability_v2()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.prepare_progressive_payment_batch_v2(uuid, uuid, uuid[], bigint, numeric, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.progressive_payment_batch_capability_v2()
  TO service_role;
