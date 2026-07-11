-- Slice 4A is an additive, server-only payment batch foundation.
-- It remains inactive until all required server feature flags are enabled.

CREATE TABLE public.progressive_payment_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_scope_id uuid NOT NULL REFERENCES public.booking_pricing_scopes(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'submitted', 'under_review', 'approved', 'rejected', 'cancelled')),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  total_amount numeric(12, 2) NOT NULL CHECK (total_amount > 0),
  member_count integer NOT NULL CHECK (member_count > 0),
  member_set_fingerprint text NOT NULL,
  pricing_scope_revision bigint NOT NULL CHECK (pricing_scope_revision >= 1),
  prepare_idempotency_key uuid NOT NULL,
  prepare_request_fingerprint text NOT NULL,
  submit_idempotency_key uuid,
  submit_request_fingerprint text,
  decision_idempotency_key uuid,
  decision_request_fingerprint text,
  slip_storage_bucket text,
  slip_storage_path text,
  slip_mime_type text,
  slip_size_bytes bigint CHECK (slip_size_bytes IS NULL OR slip_size_bytes > 0),
  slip_sha256 text CHECK (slip_sha256 IS NULL OR slip_sha256 ~ '^[0-9a-f]{64}$'),
  slipok_transaction_ref text,
  slipok_response_code text,
  submitted_at timestamptz,
  under_review_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT progressive_payment_batches_prepare_key_unique UNIQUE (user_id, prepare_idempotency_key),
  CONSTRAINT progressive_payment_batches_terminal_state_check CHECK (
    (status = 'approved' AND approved_at IS NOT NULL AND approved_by IS NOT NULL AND rejected_at IS NULL AND rejection_reason IS NULL)
    OR (status = 'rejected' AND rejected_at IS NOT NULL AND rejected_by IS NOT NULL AND rejection_reason IS NOT NULL AND approved_at IS NULL)
    OR (status NOT IN ('approved', 'rejected') AND approved_at IS NULL AND rejected_at IS NULL AND rejection_reason IS NULL)
  )
);

CREATE TABLE public.progressive_payment_batch_bookings (
  payment_batch_id uuid NOT NULL REFERENCES public.progressive_payment_batches(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  sequence_snapshot integer NOT NULL CHECK (sequence_snapshot > 0),
  amount_snapshot numeric(12, 2) NOT NULL CHECK (amount_snapshot >= 0),
  coupon_reservation_id uuid REFERENCES public.progressive_coupon_reservations(id) ON DELETE RESTRICT,
  member_fingerprint text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (payment_batch_id, booking_id),
  CONSTRAINT progressive_payment_batch_sequence_unique UNIQUE (payment_batch_id, sequence_snapshot)
);

CREATE TABLE public.progressive_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_batch_id uuid NOT NULL REFERENCES public.progressive_payment_batches(id) ON DELETE RESTRICT,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT progressive_payment_allocations_batch_booking_unique UNIQUE (payment_batch_id, booking_id)
);

ALTER TABLE public.booking_pricing_scopes
  ADD CONSTRAINT booking_pricing_scopes_payment_batch_fkey
  FOREIGN KEY (locked_by_payment_batch_id)
  REFERENCES public.progressive_payment_batches(id)
  ON DELETE RESTRICT;

CREATE UNIQUE INDEX progressive_payment_batch_bookings_active_booking_unique
  ON public.progressive_payment_batch_bookings(booking_id)
  WHERE active;

CREATE UNIQUE INDEX progressive_payment_batches_slip_sha256_unique
  ON public.progressive_payment_batches(slip_sha256)
  WHERE slip_sha256 IS NOT NULL;

CREATE UNIQUE INDEX progressive_payment_batches_slipok_ref_unique
  ON public.progressive_payment_batches(slipok_transaction_ref)
  WHERE slipok_transaction_ref IS NOT NULL;

CREATE INDEX progressive_payment_batches_scope_status_idx
  ON public.progressive_payment_batches(pricing_scope_id, status, created_at);

CREATE INDEX progressive_payment_allocations_booking_idx
  ON public.progressive_payment_allocations(booking_id);

CREATE TRIGGER tr_progressive_payment_batches_updated_at
  BEFORE UPDATE ON public.progressive_payment_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.progressive_payment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progressive_payment_batch_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progressive_payment_allocations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.progressive_payment_batches FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.progressive_payment_batch_bookings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.progressive_payment_allocations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.progressive_payment_batches TO service_role;
GRANT ALL ON TABLE public.progressive_payment_batch_bookings TO service_role;
GRANT ALL ON TABLE public.progressive_payment_allocations TO service_role;

CREATE FUNCTION public.lock_progressive_payment_scope_v1(p_pricing_scope_id uuid)
RETURNS public.booking_pricing_scopes
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scope public.booking_pricing_scopes%ROWTYPE;
BEGIN
  IF p_pricing_scope_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('progressive-payment-scope|' || p_pricing_scope_id::text, 0));
  SELECT scope.* INTO v_scope
  FROM public.booking_pricing_scopes scope
  WHERE scope.id = p_pricing_scope_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_UNAUTHORIZED';
  END IF;
  RETURN v_scope;
END;
$$;

CREATE FUNCTION public.progressive_payment_member_fingerprint_v1(p_booking_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT md5(concat_ws('|',
    booking.id::text,
    booking.user_id::text,
    coalesce(booking.pricing_scope_id::text, ''),
    booking.status::text,
    round(booking.total_price::numeric, 2)::text,
    coalesce(booking.final_price_snapshot::text, ''),
    coalesce(booking.pricing_revision::text, ''),
    coalesce(booking.expires_at::text, ''),
    coalesce(reservation.id::text, ''),
    coalesce(reservation.status, ''),
    coalesce(reservation.final_price_snapshot::text, '')
  ))
  FROM public.bookings booking
  LEFT JOIN public.progressive_coupon_reservations reservation
    ON reservation.booking_id = booking.id
  WHERE booking.id = p_booking_id;
$$;

CREATE FUNCTION public.validate_progressive_payment_prefix_v1(
  p_pricing_scope_id uuid,
  p_user_id uuid,
  p_booking_ids uuid[],
  p_current_batch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scope public.booking_pricing_scopes%ROWTYPE;
  v_pending_ids uuid[];
  v_selected_count integer;
  v_total numeric(12, 2);
  v_currency text;
BEGIN
  IF p_pricing_scope_id IS NULL OR p_user_id IS NULL OR p_booking_ids IS NULL
    OR cardinality(p_booking_ids) = 0
    OR cardinality(p_booking_ids) <> (SELECT count(DISTINCT id) FROM unnest(p_booking_ids) selected(id))
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  v_scope := public.lock_progressive_payment_scope_v1(p_pricing_scope_id);
  IF v_scope.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_USER_MISMATCH';
  END IF;
  v_currency := v_scope.currency;

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

  v_selected_count := cardinality(p_booking_ids);
  IF coalesce(cardinality(v_pending_ids), 0) < v_selected_count
    OR v_pending_ids[1:v_selected_count] IS DISTINCT FROM p_booking_ids
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_PAYMENT_PREFIX_REQUIRED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings booking
    WHERE booking.id = ANY(p_booking_ids)
      AND (booking.user_id IS DISTINCT FROM p_user_id OR booking.pricing_scope_id IS DISTINCT FROM p_pricing_scope_id)
  ) OR (SELECT count(*) FROM public.bookings booking WHERE booking.id = ANY(p_booking_ids)) <> v_selected_count THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_UNAUTHORIZED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings booking
    WHERE booking.pricing_scope_id = p_pricing_scope_id
      AND booking.status::text = 'pending_payment'
      AND booking.expires_at IS NOT NULL
      AND booking.expires_at <= transaction_timestamp()
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BOOKING_EXPIRED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.progressive_payment_batch_bookings member
    WHERE member.booking_id = ANY(p_booking_ids)
      AND member.active
      AND (p_current_batch_id IS NULL OR member.payment_batch_id <> p_current_batch_id)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_SCOPE_LOCKED';
  END IF;

  IF EXISTS (SELECT 1 FROM public.payments payment WHERE payment.booking_id = ANY(p_booking_ids)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_PAYMENT_EXISTS';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.booking_sessions session
    WHERE session.booking_id = ANY(p_booking_ids)
      AND (
        EXISTS (SELECT 1 FROM public.attendance attendance WHERE attendance.booking_session_id = session.id)
        OR EXISTS (SELECT 1 FROM public.lesson_wallet_credits wallet WHERE wallet.booking_id = session.booking_id)
        OR (session.date + session.start_time) <= timezone('Asia/Bangkok', transaction_timestamp())
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BOOKING_NOT_PENDING';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.progressive_coupon_reservations reservation
    JOIN public.bookings booking ON booking.id = reservation.booking_id
    WHERE reservation.booking_id = ANY(p_booking_ids)
      AND (
        reservation.status <> 'reserved'
        OR reservation.user_id IS DISTINCT FROM p_user_id
        OR reservation.final_price_snapshot IS DISTINCT FROM round(booking.total_price::numeric, 2)
        OR reservation.pricing_revision IS DISTINCT FROM booking.pricing_revision
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_COUPON_STATE_CONFLICT';
  END IF;

  SELECT round(sum(booking.total_price)::numeric, 2)
  INTO v_total
  FROM public.bookings booking
  WHERE booking.id = ANY(p_booking_ids);

  IF v_total IS NULL OR v_total <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_AMOUNT_MISMATCH';
  END IF;

  RETURN jsonb_build_object(
    'scopeId', p_pricing_scope_id,
    'userId', p_user_id,
    'currency', v_currency,
    'totalAmount', v_total,
    'bookingIds', to_jsonb(p_booking_ids)
  );
END;
$$;

CREATE FUNCTION public.progressive_payment_batch_result_v1(
  p_batch_id uuid,
  p_idempotent_replay boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'ok', true,
    'batchId', batch.id,
    'status', batch.status,
    'scopeId', batch.pricing_scope_id,
    'scopeRevision', scope.revision,
    'totalAmount', batch.total_amount,
    'bookingIds', coalesce((
      SELECT jsonb_agg(member.booking_id ORDER BY member.sequence_snapshot)
      FROM public.progressive_payment_batch_bookings member
      WHERE member.payment_batch_id = batch.id
    ), '[]'::jsonb),
    'idempotentReplay', p_idempotent_replay
  )
  FROM public.progressive_payment_batches batch
  JOIN public.booking_pricing_scopes scope ON scope.id = batch.pricing_scope_id
  WHERE batch.id = p_batch_id;
$$;

CREATE FUNCTION public.assert_progressive_payment_batch_members_v1(p_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch public.progressive_payment_batches%ROWTYPE;
  v_count integer;
  v_set_fingerprint text;
  v_total numeric(12, 2);
BEGIN
  SELECT batch.* INTO v_batch FROM public.progressive_payment_batches batch
  WHERE batch.id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_NOT_FOUND';
  END IF;

  SELECT count(*)::integer,
    md5(coalesce(string_agg(member.booking_id::text, ',' ORDER BY member.sequence_snapshot), '')),
    round(coalesce(sum(member.amount_snapshot), 0)::numeric, 2)
  INTO v_count, v_set_fingerprint, v_total
  FROM public.progressive_payment_batch_bookings member
  WHERE member.payment_batch_id = p_batch_id;

  IF v_count IS DISTINCT FROM v_batch.member_count
    OR v_set_fingerprint IS DISTINCT FROM v_batch.member_set_fingerprint
    OR v_total IS DISTINCT FROM v_batch.total_amount
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_FINGERPRINT_CONFLICT';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.progressive_payment_batch_bookings member
    LEFT JOIN public.bookings booking ON booking.id = member.booking_id
    WHERE member.payment_batch_id = p_batch_id
      AND (
        booking.id IS NULL
        OR booking.status::text <> 'pending_payment'
        OR public.progressive_payment_member_fingerprint_v1(member.booking_id) IS DISTINCT FROM member.member_fingerprint
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_FINGERPRINT_CONFLICT';
  END IF;
END;
$$;

CREATE FUNCTION public.prepare_progressive_payment_batch_v1(
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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scope public.booking_pricing_scopes%ROWTYPE;
  v_existing public.progressive_payment_batches%ROWTYPE;
  v_validation jsonb;
  v_fingerprint text;
  v_batch_id uuid := gen_random_uuid();
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
  PERFORM pg_advisory_xact_lock(hashtextextended('progressive-payment-request|' || p_user_id::text || '|' || p_idempotency_key::text, 0));

  SELECT batch.* INTO v_existing
  FROM public.progressive_payment_batches batch
  WHERE batch.user_id = p_user_id AND batch.prepare_idempotency_key = p_idempotency_key
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

  v_validation := public.validate_progressive_payment_prefix_v1(
    p_pricing_scope_id, p_user_id, p_booking_ids, NULL
  );
  v_total := (v_validation ->> 'totalAmount')::numeric;
  IF p_expected_total IS NOT NULL AND round(p_expected_total::numeric, 2) IS DISTINCT FROM v_total THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_AMOUNT_MISMATCH';
  END IF;

  INSERT INTO public.progressive_payment_batches (
    id, pricing_scope_id, user_id, status, currency, total_amount, member_count, member_set_fingerprint,
    pricing_scope_revision, prepare_idempotency_key, prepare_request_fingerprint
  ) VALUES (
    v_batch_id, p_pricing_scope_id, p_user_id, 'prepared', v_scope.currency, v_total,
    cardinality(p_booking_ids), md5(array_to_string(p_booking_ids, ',')),
    v_scope.revision, p_idempotency_key, v_fingerprint
  );

  INSERT INTO public.progressive_payment_batch_bookings (
    payment_batch_id, booking_id, sequence_snapshot, amount_snapshot,
    coupon_reservation_id, member_fingerprint
  )
  SELECT
    v_batch_id, selected.booking_id, selected.ordinality::integer,
    round(booking.total_price::numeric, 2), reservation.id,
    public.progressive_payment_member_fingerprint_v1(booking.id)
  FROM unnest(p_booking_ids) WITH ORDINALITY selected(booking_id, ordinality)
  JOIN public.bookings booking ON booking.id = selected.booking_id
  LEFT JOIN public.progressive_coupon_reservations reservation ON reservation.booking_id = booking.id
  ORDER BY selected.ordinality;

  UPDATE public.booking_pricing_scopes
  SET locked_by_payment_batch_id = v_batch_id, locked_at = transaction_timestamp()
  WHERE id = p_pricing_scope_id;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (p_user_id, 'progressive_payment_batch_prepared', 'progressive_payment_batch', v_batch_id,
    jsonb_build_object('scopeId', p_pricing_scope_id, 'bookingIds', to_jsonb(p_booking_ids),
      'totalAmount', v_total, 'scopeRevision', v_scope.revision));

  RETURN public.progressive_payment_batch_result_v1(v_batch_id, false);
END;
$$;

CREATE FUNCTION public.submit_progressive_payment_batch_v1(
  p_batch_id uuid,
  p_user_id uuid,
  p_slip_metadata jsonb,
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
  v_bucket text;
  v_path text;
  v_mime text;
  v_size bigint;
  v_sha text;
  v_ref text;
  v_code text;
BEGIN
  IF p_batch_id IS NULL OR p_user_id IS NULL OR p_idempotency_key IS NULL
    OR p_slip_metadata IS NULL OR jsonb_typeof(p_slip_metadata) <> 'object'
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('progressive-payment-batch|' || p_batch_id::text, 0));
  SELECT batch.* INTO v_batch FROM public.progressive_payment_batches batch
  WHERE batch.id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_NOT_FOUND';
  END IF;
  IF v_batch.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_UNAUTHORIZED';
  END IF;

  v_bucket := left(trim(p_slip_metadata ->> 'storageBucket'), 100);
  v_path := left(trim(p_slip_metadata ->> 'storagePath'), 500);
  v_mime := left(trim(p_slip_metadata ->> 'mimeType'), 100);
  v_sha := lower(trim(p_slip_metadata ->> 'sha256'));
  v_ref := nullif(left(trim(p_slip_metadata ->> 'slipokTransactionRef'), 200), '');
  v_code := nullif(left(trim(p_slip_metadata ->> 'slipokResponseCode'), 100), '');
  IF coalesce(p_slip_metadata ->> 'sizeBytes', '') !~ '^[1-9][0-9]*$' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;
  v_size := (p_slip_metadata ->> 'sizeBytes')::bigint;
  IF coalesce(v_bucket, '') = '' OR coalesce(v_path, '') = '' OR coalesce(v_mime, '') = ''
    OR v_sha !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;
  v_fingerprint := md5(concat_ws('|', 'submit', p_batch_id::text, p_user_id::text,
    v_bucket, v_path, v_mime, v_size::text, v_sha, coalesce(v_ref, ''), coalesce(v_code, '')));

  IF v_batch.status IN ('submitted', 'under_review') THEN
    IF v_batch.submit_idempotency_key IS DISTINCT FROM p_idempotency_key
      OR v_batch.submit_request_fingerprint IS DISTINCT FROM v_fingerprint
    THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN public.progressive_payment_batch_result_v1(p_batch_id, true);
  END IF;
  IF v_batch.status <> 'prepared' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_NOT_SUBMITTABLE';
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

  UPDATE public.progressive_payment_batches
  SET status = 'submitted', submit_idempotency_key = p_idempotency_key,
    submit_request_fingerprint = v_fingerprint, slip_storage_bucket = v_bucket,
    slip_storage_path = v_path, slip_mime_type = v_mime, slip_size_bytes = v_size,
    slip_sha256 = v_sha, slipok_transaction_ref = v_ref,
    slipok_response_code = v_code, submitted_at = transaction_timestamp()
  WHERE id = p_batch_id;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (p_user_id, 'progressive_payment_batch_submitted', 'progressive_payment_batch', p_batch_id,
    jsonb_build_object('scopeId', v_batch.pricing_scope_id, 'totalAmount', v_batch.total_amount,
      'slipSha256', v_sha, 'storageBucket', v_bucket, 'storagePath', v_path));

  RETURN public.progressive_payment_batch_result_v1(p_batch_id, false);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_IDEMPOTENCY_CONFLICT';
END;
$$;

CREATE FUNCTION public.approve_progressive_payment_batch_v1(
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

  RETURN public.progressive_payment_batch_result_v1(p_batch_id, false);
END;
$$;

CREATE FUNCTION public.reject_progressive_payment_batch_v1(
  p_batch_id uuid,
  p_actor_id uuid,
  p_rejection_reason text,
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
  v_reason text;
  v_new_revision bigint;
  v_changes jsonb;
BEGIN
  v_reason := left(trim(coalesce(p_rejection_reason, '')), 1000);
  IF p_batch_id IS NULL OR p_actor_id IS NULL OR p_idempotency_key IS NULL OR v_reason = '' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;
  v_fingerprint := md5(concat_ws('|', 'reject', p_batch_id::text, p_actor_id::text, v_reason));
  PERFORM pg_advisory_xact_lock(hashtextextended('progressive-payment-batch|' || p_batch_id::text, 0));
  SELECT batch.* INTO v_batch FROM public.progressive_payment_batches batch
  WHERE batch.id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_NOT_FOUND';
  END IF;
  IF v_batch.status = 'rejected' THEN
    IF v_batch.decision_idempotency_key IS DISTINCT FROM p_idempotency_key
      OR v_batch.decision_request_fingerprint IS DISTINCT FROM v_fingerprint
    THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN public.progressive_payment_batch_result_v1(p_batch_id, true);
  END IF;
  IF v_batch.status = 'approved' THEN
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

  FOR v_member IN
    SELECT member.booking_id FROM public.progressive_payment_batch_bookings member
    WHERE member.payment_batch_id = p_batch_id AND member.coupon_reservation_id IS NOT NULL
    ORDER BY member.sequence_snapshot
  LOOP
    PERFORM public.release_progressive_coupon_v1(v_member.booking_id, v_batch.user_id, 'payment_rejected');
  END LOOP;

  UPDATE public.booking_pricing_scopes
  SET locked_by_payment_batch_id = NULL, locked_at = NULL, revision = revision + 1
  WHERE id = v_batch.pricing_scope_id
  RETURNING revision INTO v_new_revision;
  v_changes := public.progressive_reprice_scope_v1(v_batch.pricing_scope_id, v_new_revision, NULL, NULL);

  UPDATE public.progressive_payment_batches
  SET status = 'rejected', rejected_at = transaction_timestamp(), rejected_by = p_actor_id,
    rejection_reason = v_reason, decision_idempotency_key = p_idempotency_key,
    decision_request_fingerprint = v_fingerprint
  WHERE id = p_batch_id;
  UPDATE public.progressive_payment_batch_bookings SET active = false WHERE payment_batch_id = p_batch_id;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (p_actor_id, 'progressive_payment_batch_rejected', 'progressive_payment_batch', p_batch_id,
    jsonb_build_object('scopeId', v_batch.pricing_scope_id, 'reason', v_reason,
      'scopeRevision', v_new_revision, 'repricedBookings', v_changes));
  INSERT INTO public.notifications (user_id, title, message, type, link_url)
  VALUES (v_batch.user_id, 'กรุณาแนบสลิปใหม่',
    'สลิปแบบหลายรายการถูกส่งกลับ กรุณาตรวจสอบยอดและแนบใหม่', 'payment', '/dashboard/history');

  RETURN public.progressive_payment_batch_result_v1(p_batch_id, false);
END;
$$;

CREATE FUNCTION public.progressive_payment_batch_capability_v1()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'ready',
      to_regclass('public.progressive_payment_batches') IS NOT NULL
      AND to_regclass('public.progressive_payment_batch_bookings') IS NOT NULL
      AND to_regclass('public.progressive_payment_allocations') IS NOT NULL
      AND to_regprocedure('public.prepare_progressive_payment_batch_v1(uuid,uuid,uuid[],bigint,numeric,uuid)') IS NOT NULL
      AND to_regprocedure('public.submit_progressive_payment_batch_v1(uuid,uuid,jsonb,uuid)') IS NOT NULL
      AND to_regprocedure('public.approve_progressive_payment_batch_v1(uuid,uuid,uuid)') IS NOT NULL
      AND to_regprocedure('public.reject_progressive_payment_batch_v1(uuid,uuid,text,uuid)') IS NOT NULL,
    'version', 1,
    'legacyPaymentModel', 'batch_authority_with_allocations'
  );
$$;

REVOKE ALL ON FUNCTION public.lock_progressive_payment_scope_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progressive_payment_member_fingerprint_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_progressive_payment_prefix_v1(uuid, uuid, uuid[], uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progressive_payment_batch_result_v1(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_progressive_payment_batch_members_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_progressive_payment_batch_v1(uuid, uuid, uuid[], bigint, numeric, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_progressive_payment_batch_v1(uuid, uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_progressive_payment_batch_v1(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_progressive_payment_batch_v1(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progressive_payment_batch_capability_v1() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.prepare_progressive_payment_batch_v1(uuid, uuid, uuid[], bigint, numeric, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_progressive_payment_batch_v1(uuid, uuid, jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_progressive_payment_batch_v1(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_progressive_payment_batch_v1(uuid, uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.progressive_payment_batch_capability_v1() TO service_role;
