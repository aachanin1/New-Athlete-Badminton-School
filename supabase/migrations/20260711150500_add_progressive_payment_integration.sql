-- Slice 4B: allowlisted progressive payment integration foundation.
-- Additive only. No legacy payment backfill and no remote activation.

ALTER TABLE public.progressive_payment_batches
  ADD COLUMN prepared_expires_at timestamptz,
  ADD COLUMN upload_recorded_at timestamptz,
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancellation_reason text,
  ADD COLUMN slip_retain_until timestamptz;

CREATE TABLE public.progressive_payment_retention_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  approved_months integer NOT NULL DEFAULT 84 CHECK (approved_months > 0),
  review_days integer NOT NULL DEFAULT 180 CHECK (review_days > 0),
  orphan_days integer NOT NULL DEFAULT 7 CHECK (orphan_days > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.progressive_payment_retention_config (
  singleton, approved_months, review_days, orphan_days
) VALUES (true, 84, 180, 7);

CREATE TABLE public.progressive_payment_verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_batch_id uuid NOT NULL REFERENCES public.progressive_payment_batches(id) ON DELETE RESTRICT,
  attempt_key uuid NOT NULL,
  request_fingerprint text NOT NULL,
  provider_mode text NOT NULL CHECK (provider_mode IN ('test', 'live')),
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'resolved')),
  decision text CHECK (decision IN ('approved', 'rejected', 'under_review')),
  sanitized_provider_reference text,
  sanitized_result_code text,
  verified_amount numeric(12, 2),
  result_fingerprint text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT progressive_payment_attempt_key_unique UNIQUE (payment_batch_id, attempt_key),
  CONSTRAINT progressive_payment_attempt_batch_unique UNIQUE (payment_batch_id),
  CONSTRAINT progressive_payment_attempt_resolution_check CHECK (
    (status = 'processing' AND decision IS NULL AND resolved_at IS NULL)
    OR (status = 'resolved' AND decision IS NOT NULL AND resolved_at IS NOT NULL AND result_fingerprint IS NOT NULL)
  )
);

CREATE INDEX progressive_payment_attempts_batch_created_idx
  ON public.progressive_payment_verification_attempts(payment_batch_id, created_at DESC);

ALTER TABLE public.progressive_payment_retention_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progressive_payment_verification_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.progressive_payment_retention_config FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.progressive_payment_verification_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.progressive_payment_retention_config TO service_role;
GRANT ALL ON TABLE public.progressive_payment_verification_attempts TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'progressive-payment-slips',
  'progressive-payment-slips',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE FUNCTION public.set_progressive_payment_lifecycle_metadata_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_retention public.progressive_payment_retention_config%ROWTYPE;
BEGIN
  SELECT config.* INTO v_retention
  FROM public.progressive_payment_retention_config config
  WHERE config.singleton;

  IF TG_OP = 'INSERT' THEN
    NEW.prepared_expires_at := coalesce(NEW.prepared_expires_at, transaction_timestamp() + interval '30 minutes');
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'prepared' AND NEW.status <> 'prepared'
    AND OLD.prepared_expires_at <= transaction_timestamp()
    AND NEW.status <> 'cancelled'
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_EXPIRED';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      NEW.slip_retain_until := transaction_timestamp() + make_interval(months => v_retention.approved_months);
    ELSIF NEW.status IN ('rejected', 'under_review') THEN
      NEW.slip_retain_until := transaction_timestamp() + make_interval(days => v_retention.review_days);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_progressive_payment_lifecycle_metadata
  BEFORE INSERT OR UPDATE ON public.progressive_payment_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_progressive_payment_lifecycle_metadata_v1();

UPDATE public.progressive_payment_batches
SET prepared_expires_at = created_at + interval '30 minutes'
WHERE prepared_expires_at IS NULL;

ALTER TABLE public.progressive_payment_batches
  ALTER COLUMN prepared_expires_at SET NOT NULL;

CREATE FUNCTION public.record_progressive_payment_upload_v1(
  p_batch_id uuid,
  p_user_id uuid,
  p_storage_bucket text,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes bigint,
  p_sha256 text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch public.progressive_payment_batches%ROWTYPE;
  v_expected_prefix text;
BEGIN
  IF p_batch_id IS NULL OR p_user_id IS NULL OR p_storage_bucket <> 'progressive-payment-slips'
    OR p_size_bytes IS NULL OR p_size_bytes < 1 OR p_size_bytes > 5242880
    OR p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp')
    OR lower(coalesce(p_sha256, '')) !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  v_expected_prefix := p_user_id::text || '/batches/' || p_batch_id::text || '/';
  IF p_storage_path IS NULL OR left(p_storage_path, length(v_expected_prefix)) <> v_expected_prefix
    OR p_storage_path !~ ('/' || lower(p_sha256) || '[.](jpg|png|webp)$')
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('progressive-payment-batch|' || p_batch_id::text, 0));
  SELECT batch.* INTO v_batch
  FROM public.progressive_payment_batches batch
  WHERE batch.id = p_batch_id
  FOR UPDATE;

  IF NOT FOUND OR v_batch.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_UNAUTHORIZED';
  END IF;
  IF v_batch.status <> 'prepared' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_NOT_SUBMITTABLE';
  END IF;
  IF v_batch.prepared_expires_at <= transaction_timestamp() THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_EXPIRED';
  END IF;

  UPDATE public.progressive_payment_batches
  SET slip_storage_bucket = p_storage_bucket,
      slip_storage_path = p_storage_path,
      slip_mime_type = p_mime_type,
      slip_size_bytes = p_size_bytes,
      slip_sha256 = lower(p_sha256),
      upload_recorded_at = transaction_timestamp()
  WHERE id = p_batch_id;

  RETURN public.progressive_payment_batch_result_v1(p_batch_id, v_batch.slip_sha256 = lower(p_sha256));
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_PAYMENT_EXISTS';
END;
$$;

CREATE FUNCTION public.cancel_progressive_prepared_batch_v1(
  p_batch_id uuid,
  p_user_id uuid,
  p_reason text DEFAULT 'user_cancelled'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch public.progressive_payment_batches%ROWTYPE;
BEGIN
  IF p_batch_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('progressive-payment-batch|' || p_batch_id::text, 0));
  SELECT batch.* INTO v_batch FROM public.progressive_payment_batches batch
  WHERE batch.id = p_batch_id FOR UPDATE;

  IF NOT FOUND OR v_batch.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_UNAUTHORIZED';
  END IF;
  IF v_batch.status = 'cancelled' THEN
    RETURN public.progressive_payment_batch_result_v1(p_batch_id, true);
  END IF;
  IF v_batch.status <> 'prepared' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_NOT_SUBMITTABLE';
  END IF;

  UPDATE public.progressive_payment_batches
  SET status = 'cancelled', cancelled_at = transaction_timestamp(),
      cancellation_reason = left(coalesce(nullif(trim(p_reason), ''), 'user_cancelled'), 200)
  WHERE id = p_batch_id;
  UPDATE public.progressive_payment_batch_bookings SET active = false WHERE payment_batch_id = p_batch_id;
  UPDATE public.booking_pricing_scopes
  SET locked_by_payment_batch_id = NULL, locked_at = NULL, revision = revision + 1
  WHERE id = v_batch.pricing_scope_id AND locked_by_payment_batch_id = p_batch_id;

  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (p_user_id, 'progressive_payment_batch_cancelled', 'progressive_payment_batch', p_batch_id,
    jsonb_build_object('reason', coalesce(nullif(trim(p_reason), ''), 'user_cancelled')));

  RETURN public.progressive_payment_batch_result_v1(p_batch_id, false);
END;
$$;

CREATE FUNCTION public.expire_progressive_prepared_batch_v1(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch public.progressive_payment_batches%ROWTYPE;
BEGIN
  SELECT batch.* INTO v_batch FROM public.progressive_payment_batches batch
  WHERE batch.id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_NOT_FOUND';
  END IF;
  IF v_batch.status <> 'prepared' OR v_batch.prepared_expires_at > transaction_timestamp() THEN
    RETURN public.progressive_payment_batch_result_v1(p_batch_id, true);
  END IF;
  RETURN public.cancel_progressive_prepared_batch_v1(p_batch_id, v_batch.user_id, 'prepared_expired');
END;
$$;

CREATE FUNCTION public.mark_progressive_batch_under_review_v1(
  p_batch_id uuid,
  p_result_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch public.progressive_payment_batches%ROWTYPE;
BEGIN
  SELECT batch.* INTO v_batch FROM public.progressive_payment_batches batch
  WHERE batch.id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_NOT_FOUND';
  END IF;
  IF v_batch.status = 'under_review' THEN
    RETURN public.progressive_payment_batch_result_v1(p_batch_id, true);
  END IF;
  IF v_batch.status <> 'submitted' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_NOT_REVIEWABLE';
  END IF;
  UPDATE public.progressive_payment_batches
  SET status = 'under_review', under_review_at = transaction_timestamp(),
      slipok_response_code = left(coalesce(nullif(trim(p_result_code), ''), 'AMBIGUOUS'), 100)
  WHERE id = p_batch_id;
  RETURN public.progressive_payment_batch_result_v1(p_batch_id, false);
END;
$$;

CREATE FUNCTION public.record_progressive_verification_attempt_v1(
  p_batch_id uuid,
  p_attempt_key uuid,
  p_provider_mode text,
  p_request_fingerprint text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch public.progressive_payment_batches%ROWTYPE;
  v_attempt public.progressive_payment_verification_attempts%ROWTYPE;
  v_replay boolean := false;
BEGIN
  IF p_attempt_key IS NULL OR p_provider_mode NOT IN ('test', 'live')
    OR coalesce(trim(p_request_fingerprint), '') = '' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;
  SELECT batch.* INTO v_batch FROM public.progressive_payment_batches batch
  WHERE batch.id = p_batch_id FOR UPDATE;
  IF NOT FOUND OR v_batch.status NOT IN ('submitted', 'under_review') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_NOT_REVIEWABLE';
  END IF;
  SELECT attempt.* INTO v_attempt
  FROM public.progressive_payment_verification_attempts attempt
  WHERE attempt.payment_batch_id = p_batch_id;
  IF FOUND THEN
    v_replay := true;
    IF v_attempt.provider_mode IS DISTINCT FROM p_provider_mode
      OR v_attempt.request_fingerprint IS DISTINCT FROM p_request_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_IDEMPOTENCY_CONFLICT';
    END IF;
  ELSE
    INSERT INTO public.progressive_payment_verification_attempts (
      payment_batch_id, attempt_key, request_fingerprint, provider_mode
    ) VALUES (p_batch_id, p_attempt_key, p_request_fingerprint, p_provider_mode)
    RETURNING * INTO v_attempt;
  END IF;
  RETURN jsonb_build_object('ok', true, 'attemptId', v_attempt.id, 'status', v_attempt.status,
    'decision', v_attempt.decision, 'providerMode', v_attempt.provider_mode,
    'providerReference', v_attempt.sanitized_provider_reference,
    'resultCode', v_attempt.sanitized_result_code, 'verifiedAmount', v_attempt.verified_amount,
    'idempotentReplay', v_replay);
END;
$$;

CREATE FUNCTION public.resolve_progressive_verification_attempt_v1(
  p_attempt_id uuid,
  p_decision text,
  p_provider_reference text,
  p_result_code text,
  p_verified_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_attempt public.progressive_payment_verification_attempts%ROWTYPE;
  v_fingerprint text;
BEGIN
  IF p_attempt_id IS NULL OR p_decision NOT IN ('approved', 'rejected', 'under_review')
    OR coalesce(trim(p_result_code), '') = '' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;
  v_fingerprint := md5(concat_ws('|', p_decision, coalesce(trim(p_provider_reference), ''),
    trim(p_result_code), coalesce(round(p_verified_amount, 2)::text, '')));
  SELECT attempt.* INTO v_attempt
  FROM public.progressive_payment_verification_attempts attempt
  WHERE attempt.id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_NOT_FOUND';
  END IF;
  IF v_attempt.status = 'resolved' THEN
    IF v_attempt.result_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_IDEMPOTENCY_CONFLICT';
    END IF;
  ELSE
    UPDATE public.progressive_payment_verification_attempts
    SET status = 'resolved', decision = p_decision,
        sanitized_provider_reference = nullif(left(trim(p_provider_reference), 200), ''),
        sanitized_result_code = left(trim(p_result_code), 100),
        verified_amount = CASE WHEN p_verified_amount IS NULL THEN NULL ELSE round(p_verified_amount, 2) END,
        result_fingerprint = v_fingerprint, resolved_at = transaction_timestamp()
    WHERE id = p_attempt_id RETURNING * INTO v_attempt;
    UPDATE public.progressive_payment_batches
    SET slipok_transaction_ref = nullif(left(trim(p_provider_reference), 200), ''),
        slipok_response_code = left(trim(p_result_code), 100)
    WHERE id = v_attempt.payment_batch_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'attemptId', v_attempt.id, 'batchId', v_attempt.payment_batch_id,
    'status', v_attempt.status, 'decision', v_attempt.decision,
    'providerReference', v_attempt.sanitized_provider_reference,
    'resultCode', v_attempt.sanitized_result_code, 'verifiedAmount', v_attempt.verified_amount);
END;
$$;

CREATE FUNCTION public.get_progressive_payment_batch_status_v1(p_batch_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'ok', true, 'batchId', batch.id, 'userId', batch.user_id, 'status', batch.status,
    'scopeId', batch.pricing_scope_id, 'scopeRevision', scope.revision,
    'currency', batch.currency, 'totalAmount', batch.total_amount,
    'bookingIds', coalesce((SELECT jsonb_agg(member.booking_id ORDER BY member.sequence_snapshot)
      FROM public.progressive_payment_batch_bookings member WHERE member.payment_batch_id = batch.id), '[]'::jsonb),
    'preparedExpiresAt', batch.prepared_expires_at, 'submittedAt', batch.submitted_at,
    'underReviewAt', batch.under_review_at, 'approvedAt', batch.approved_at,
    'rejectedAt', batch.rejected_at, 'cancelledAt', batch.cancelled_at,
    'rejectionReason', batch.rejection_reason, 'slipStorageBucket', batch.slip_storage_bucket,
    'slipStoragePath', batch.slip_storage_path, 'slipMimeType', batch.slip_mime_type,
    'slipSizeBytes', batch.slip_size_bytes, 'slipSha256', batch.slip_sha256
  )
  FROM public.progressive_payment_batches batch
  JOIN public.booking_pricing_scopes scope ON scope.id = batch.pricing_scope_id
  WHERE batch.id = p_batch_id;
$$;

CREATE VIEW public.payment_review_queue_v1
WITH (security_invoker = true)
AS
SELECT
  'legacy'::text AS source_kind,
  payment.id AS source_id,
  payment.user_id,
  payment.status::text AS status,
  payment.created_at AS submitted_at,
  payment.verified_at AS decided_at,
  payment.amount::numeric(12,2) AS total_amount,
  1::integer AS booking_count,
  booking.course_type_id,
  booking.month AS lesson_month,
  booking.year AS lesson_year,
  NULL::text AS slip_storage_bucket,
  payment.slip_image_url AS slip_storage_path
FROM public.payments payment
JOIN public.bookings booking ON booking.id = payment.booking_id
UNION ALL
SELECT
  'progressive'::text,
  batch.id,
  batch.user_id,
  batch.status,
  coalesce(batch.submitted_at, batch.created_at),
  coalesce(batch.approved_at, batch.rejected_at),
  batch.total_amount,
  batch.member_count,
  scope.course_type_id,
  scope.lesson_month,
  scope.lesson_year,
  batch.slip_storage_bucket,
  batch.slip_storage_path
FROM public.progressive_payment_batches batch
JOIN public.booking_pricing_scopes scope ON scope.id = batch.pricing_scope_id;

CREATE VIEW public.payment_ledger_allocations_v1
WITH (security_invoker = true)
AS
SELECT
  'legacy'::text AS source_kind,
  payment.id AS source_id,
  payment.booking_id,
  payment.user_id,
  payment.status::text AS status,
  payment.amount::numeric(12,2) AS allocated_amount,
  payment.created_at,
  payment.verified_at AS approved_at
FROM public.payments payment
UNION ALL
SELECT
  'progressive'::text,
  allocation.payment_batch_id,
  allocation.booking_id,
  batch.user_id,
  batch.status,
  allocation.amount,
  allocation.created_at,
  batch.approved_at
FROM public.progressive_payment_allocations allocation
JOIN public.progressive_payment_batches batch ON batch.id = allocation.payment_batch_id;

REVOKE ALL ON TABLE public.payment_review_queue_v1 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.payment_ledger_allocations_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.payment_review_queue_v1 TO service_role;
GRANT SELECT ON TABLE public.payment_ledger_allocations_v1 TO service_role;

CREATE FUNCTION public.progressive_payment_integration_capability_v1()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'ready',
      to_regclass('public.progressive_payment_verification_attempts') IS NOT NULL
      AND to_regclass('public.payment_review_queue_v1') IS NOT NULL
      AND to_regclass('public.payment_ledger_allocations_v1') IS NOT NULL
      AND to_regprocedure('public.cancel_progressive_prepared_batch_v1(uuid,uuid,text)') IS NOT NULL
      AND to_regprocedure('public.record_progressive_verification_attempt_v1(uuid,uuid,text,text)') IS NOT NULL,
    'version', 1,
    'preparedTtlMinutes', 30,
    'storageBucket', 'progressive-payment-slips'
  );
$$;

REVOKE ALL ON FUNCTION public.set_progressive_payment_lifecycle_metadata_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_progressive_payment_upload_v1(uuid, uuid, text, text, text, bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_progressive_prepared_batch_v1(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_progressive_prepared_batch_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_progressive_batch_under_review_v1(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_progressive_verification_attempt_v1(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_progressive_verification_attempt_v1(uuid, text, text, text, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_progressive_payment_batch_status_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progressive_payment_integration_capability_v1() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_progressive_payment_upload_v1(uuid, uuid, text, text, text, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_progressive_prepared_batch_v1(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_progressive_prepared_batch_v1(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_progressive_batch_under_review_v1(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_progressive_verification_attempt_v1(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_progressive_verification_attempt_v1(uuid, text, text, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_progressive_payment_batch_status_v1(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.progressive_payment_integration_capability_v1() TO service_role;
