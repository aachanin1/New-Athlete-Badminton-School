BEGIN;

-- Only a committed on-time receipt for this exact bill preserves correction.
-- The original deadline, cancellation, prices and entitlement writers stay intact.
CREATE OR REPLACE FUNCTION public.booking_ux_assert_new_receipt_window_v1(p_booking uuid)
RETURNS void LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.bookings WHERE id=p_booking AND checkout_version=1
    AND (checkout_deadline IS NULL OR checkout_deadline<=public.task10_clock_v1())
    AND NOT public.task10_has_accepted_receipt_v1(id)) THEN
    RAISE EXCEPTION 'TASK10_BOOKING_DEADLINE';
  END IF;
END $$;

-- Reuse the existing durable review receipts, keeping each explicit check's result.
-- A lease prevents parallel provider calls and permits recovery after a dead request.
CREATE FUNCTION public.booking_ux_claim_legacy_slip_check_v1(p_user uuid,p_receipt uuid,p_check uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ids uuid[]; r record; prior jsonb; token uuid:=gen_random_uuid(); t timestamptz:=clock_timestamp(); fingerprint text;
BEGIN
  IF p_user IS NULL OR p_receipt IS NULL OR p_check IS NULL THEN RAISE EXCEPTION 'TASK10_INVALID_RECEIPT';END IF;
  SELECT array_agg(DISTINCT b.id ORDER BY b.id) INTO ids FROM task10_accepted_receipts a JOIN bookings b ON b.id=a.booking_id
    WHERE a.request_id=p_receipt AND a.payment_id IS NOT NULL AND b.user_id=p_user;
  IF ids IS NULL THEN RAISE EXCEPTION 'TASK10_INVALID_RECEIPT';END IF;
  PERFORM task10_lock_booking_set_v1(ids);
  IF EXISTS(SELECT 1 FROM bookings WHERE id=ANY(ids) AND status::text='cancelled') THEN RAISE EXCEPTION 'TASK10_BOOKING_CANCELLED';END IF;
  IF NOT EXISTS(SELECT 1 FROM bookings WHERE id=ANY(ids) AND status::text<>'verified') THEN
    RETURN jsonb_build_object('claimed',false,'verified',true);END IF;
  FOR r IN SELECT a.payment_id,b.id,b.status,p.status AS payment_status FROM task10_accepted_receipts a
    JOIN bookings b ON b.id=a.booking_id JOIN payments p ON p.id=a.payment_id
    WHERE a.request_id=p_receipt AND b.id=ANY(ids) ORDER BY b.id FOR UPDATE OF p LOOP
    SELECT result INTO prior FROM task10_payment_review_receipts WHERE payment_id=r.payment_id AND request_id=p_check;
    IF FOUND AND (prior->>'kind'<>'booking_ux_slip_check' OR prior->>'receiptRequestId'<>p_receipt::text) THEN
      RAISE EXCEPTION 'TASK10_IDEMPOTENCY_CONFLICT';END IF;
    IF FOUND AND prior->>'status'='resolved' THEN RETURN jsonb_build_object('claimed',false,'result',prior);END IF;
    IF r.status::text<>'paid' OR r.payment_status::text<>'pending' OR EXISTS(
      SELECT 1 FROM payments newer WHERE newer.booking_id=r.id AND newer.id<>r.payment_id AND newer.created_at>(SELECT created_at FROM payments WHERE id=r.payment_id))
      THEN RAISE EXCEPTION 'TASK10_PAYMENT_REVIEW_CONFLICT';END IF;
    IF EXISTS(SELECT 1 FROM task10_payment_review_receipts WHERE payment_id=r.payment_id AND result->>'kind'='booking_ux_slip_check'
      AND result->>'status'='checking' AND (result->>'leaseUntil')::timestamptz>t) THEN
      RETURN jsonb_build_object('claimed',false,'checking',true);END IF;
  END LOOP;
  fingerprint:=encode(extensions.digest(concat_ws('|','booking_ux_slip_check',p_user,p_receipt,p_check),'sha256'),'hex');
  FOR r IN SELECT a.payment_id FROM task10_accepted_receipts a WHERE a.request_id=p_receipt AND a.booking_id=ANY(ids) LOOP
    INSERT INTO task10_payment_review_receipts(payment_id,request_id,actor_id,fingerprint,result,created_at)
      VALUES(r.payment_id,p_check,p_user,fingerprint,jsonb_build_object('kind','booking_ux_slip_check','status','checking',
        'receiptRequestId',p_receipt,'claimToken',token,'leaseUntil',t+interval '40 seconds'),t)
      ON CONFLICT(payment_id,request_id) DO UPDATE SET result=excluded.result;
  END LOOP;
  RETURN jsonb_build_object('claimed',true,'claimToken',token);
END $$;

CREATE FUNCTION public.booking_ux_resolve_legacy_slip_check_v1(p_user uuid,p_receipt uuid,p_check uuid,p_token uuid,p_decision text,p_notes text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE ids uuid[]; r record; prior jsonb; t timestamptz; changed integer:=0; next_status text;
BEGIN
  IF p_decision IS NULL OR p_decision NOT IN ('approved','rejected','under_review') OR p_notes IS NULL OR length(p_notes)>3000 THEN
    RAISE EXCEPTION 'TASK10_INVALID_RECEIPT';END IF;
  SELECT array_agg(DISTINCT b.id ORDER BY b.id) INTO ids FROM task10_accepted_receipts a JOIN bookings b ON b.id=a.booking_id
    WHERE a.request_id=p_receipt AND a.payment_id IS NOT NULL AND b.user_id=p_user;
  IF ids IS NULL THEN RAISE EXCEPTION 'TASK10_INVALID_RECEIPT';END IF;
  PERFORM task10_lock_booking_set_v1(ids);t:=task10_clock_v1();
  next_status:=CASE p_decision WHEN 'approved' THEN 'verified' WHEN 'rejected' THEN 'pending_payment' ELSE 'paid' END;
  FOR r IN SELECT a.payment_id,b.id,b.status,p.status AS payment_status FROM task10_accepted_receipts a
    JOIN bookings b ON b.id=a.booking_id JOIN payments p ON p.id=a.payment_id
    WHERE a.request_id=p_receipt AND b.id=ANY(ids) ORDER BY b.id FOR UPDATE OF p LOOP
    IF r.status::text='cancelled' THEN RAISE EXCEPTION 'TASK10_BOOKING_CANCELLED';END IF;
    SELECT result INTO prior FROM task10_payment_review_receipts WHERE payment_id=r.payment_id AND request_id=p_check AND actor_id=p_user;
    IF NOT FOUND OR prior->>'kind'<>'booking_ux_slip_check' OR prior->>'receiptRequestId'<>p_receipt::text
      OR prior->>'claimToken' IS DISTINCT FROM p_token::text THEN RAISE EXCEPTION 'TASK10_PAYMENT_REVIEW_CONFLICT';END IF;
    IF prior->>'status'='resolved' THEN
      IF prior->>'decision' IS DISTINCT FROM p_decision OR prior->>'notes' IS DISTINCT FROM p_notes THEN RAISE EXCEPTION 'TASK10_IDEMPOTENCY_CONFLICT';END IF;
      CONTINUE;
    END IF;
    IF r.status::text<>'paid' OR r.payment_status::text<>'pending' OR EXISTS(
      SELECT 1 FROM task10_payment_review_receipts c WHERE c.payment_id=r.payment_id AND c.request_id<>p_check
      AND c.result->>'kind'='booking_ux_slip_check' AND (c.result->>'leaseUntil')::timestamptz>(prior->>'leaseUntil')::timestamptz)
      THEN RAISE EXCEPTION 'TASK10_PAYMENT_REVIEW_CONFLICT';END IF;
    UPDATE payments SET status=CASE p_decision WHEN 'approved' THEN 'approved'::payment_status WHEN 'rejected' THEN 'rejected'::payment_status ELSE 'pending'::payment_status END,
      verified_at=CASE WHEN p_decision='approved' THEN t ELSE NULL END,notes=p_notes WHERE id=r.payment_id;
    UPDATE bookings SET status=next_status::booking_status WHERE id=r.id;
    UPDATE task10_payment_review_receipts SET result=prior||jsonb_build_object('status','resolved','decision',p_decision,'notes',p_notes)
      WHERE payment_id=r.payment_id AND request_id=p_check;
    INSERT INTO activity_logs(user_id,action,entity_type,entity_id,details) VALUES(p_user,'booking_slip_checked','payment',r.payment_id,
      jsonb_build_object('bookingId',r.id,'receiptRequestId',p_receipt,'checkRequestId',p_check,'decision',p_decision));
    changed:=changed+1;
  END LOOP;
  IF changed>0 THEN
    INSERT INTO notifications(user_id,title,message,type,link_url) VALUES(p_user,
      CASE p_decision WHEN 'approved' THEN 'ชำระเงินสำเร็จ' WHEN 'rejected' THEN 'กรุณาแก้สลิป' ELSE 'ตรวจสลิปยังไม่สำเร็จ' END,
      CASE p_decision WHEN 'approved' THEN 'ยืนยันรายการแล้ว ดูตารางเรียนหรือกระเป๋าได้' WHEN 'rejected' THEN 'ดูเหตุผลและส่งสลิปใหม่ในรายการเดิมได้ โดยไม่ต้องโอนซ้ำ'
        ELSE 'ลองตรวจสลิปเดิมอีกครั้งในหน้าชำระเงิน โดยไม่ต้องโอนซ้ำ' END,'payment','/dashboard/booking?payment='||ids[1]);
  END IF;
  RETURN jsonb_build_object('success',true,'bookingStatus',next_status);
END $$;

REVOKE ALL ON FUNCTION public.booking_ux_claim_legacy_slip_check_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.booking_ux_resolve_legacy_slip_check_v1(uuid,uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.booking_ux_claim_legacy_slip_check_v1(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.booking_ux_resolve_legacy_slip_check_v1(uuid,uuid,uuid,uuid,text,text) TO service_role;

-- Keep all prior attempts. An explicit new key may retry only an unresolved
-- provider outcome, never a rejected/approved slip or a fresh bill payment.
ALTER TABLE public.progressive_payment_verification_attempts DROP CONSTRAINT progressive_payment_attempt_batch_unique;
CREATE UNIQUE INDEX booking_ux_progressive_one_processing_check ON public.progressive_payment_verification_attempts(payment_batch_id) WHERE status='processing';
CREATE OR REPLACE FUNCTION public.record_progressive_verification_attempt_v1(p_batch_id uuid,p_attempt_key uuid,p_provider_mode text,p_request_fingerprint text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b progressive_payment_batches%ROWTYPE; a progressive_payment_verification_attempts%ROWTYPE;
  latest progressive_payment_verification_attempts%ROWTYPE; verify boolean:=false; ready timestamptz;
BEGIN
  PERFORM task10_begin_payment_batch_v1(p_batch_id);
  IF p_attempt_key IS NULL OR p_provider_mode NOT IN ('test','live') OR coalesce(trim(p_request_fingerprint),'')='' THEN
    RAISE EXCEPTION 'PROGRESSIVE_INVALID_REQUEST';END IF;
  SELECT * INTO b FROM progressive_payment_batches WHERE id=p_batch_id FOR UPDATE;
  IF NOT FOUND OR b.status NOT IN ('submitted','under_review') THEN RAISE EXCEPTION 'PROGRESSIVE_BATCH_NOT_REVIEWABLE';END IF;
  SELECT * INTO a FROM progressive_payment_verification_attempts WHERE payment_batch_id=p_batch_id AND attempt_key=p_attempt_key;
  IF FOUND THEN
    IF a.provider_mode IS DISTINCT FROM p_provider_mode OR a.request_fingerprint IS DISTINCT FROM p_request_fingerprint THEN
      RAISE EXCEPTION 'PROGRESSIVE_IDEMPOTENCY_CONFLICT';END IF;
  ELSE
    SELECT * INTO latest FROM progressive_payment_verification_attempts WHERE payment_batch_id=p_batch_id ORDER BY created_at DESC,id DESC LIMIT 1;
    IF FOUND THEN
      IF latest.provider_mode IS DISTINCT FROM p_provider_mode OR latest.request_fingerprint IS DISTINCT FROM p_request_fingerprint THEN
        RAISE EXCEPTION 'PROGRESSIVE_IDEMPOTENCY_CONFLICT';END IF;
      ready:=CASE WHEN latest.status='processing' THEN latest.created_at+interval '40 seconds'
        WHEN latest.sanitized_result_code='SLIPOK_1009' THEN latest.resolved_at+interval '15 minutes' ELSE latest.resolved_at+interval '3 seconds' END;
      IF (latest.status='resolved' AND (latest.decision<>'under_review' OR b.status<>'under_review')) THEN
        RETURN jsonb_build_object('ok',true,'attemptId',latest.id,'status',latest.status,'decision',latest.decision,'shouldVerify',false,
          'providerReference',latest.sanitized_provider_reference,'resultCode',latest.sanitized_result_code,'verifiedAmount',latest.verified_amount);
      END IF;
      IF ready>clock_timestamp() THEN
        RETURN jsonb_build_object('ok',true,'attemptId',latest.id,'status','processing','decision',NULL,'shouldVerify',false,'retryAfter',ready);
      END IF;
      IF latest.status='processing' THEN
        UPDATE progressive_payment_verification_attempts SET status='resolved',decision='under_review',sanitized_result_code='SLIPOK_TIMEOUT',
          result_fingerprint=md5('expired-check|'||id::text),resolved_at=clock_timestamp() WHERE id=latest.id;
      END IF;
    END IF;
    INSERT INTO progressive_payment_verification_attempts(payment_batch_id,attempt_key,request_fingerprint,provider_mode)
      VALUES(p_batch_id,p_attempt_key,p_request_fingerprint,p_provider_mode) RETURNING * INTO a;
    verify:=true;
  END IF;
  RETURN jsonb_build_object('ok',true,'attemptId',a.id,'status',a.status,'decision',a.decision,'shouldVerify',verify,
    'providerReference',a.sanitized_provider_reference,'resultCode',a.sanitized_result_code,'verifiedAmount',a.verified_amount,'idempotentReplay',NOT verify);
END $$;

-- A delayed provider response must never finalize a superseded attempt.
DO $patch$
DECLARE definition text;anchor text:='IF v_attempt.status = ''resolved'' THEN';
BEGIN
  SELECT pg_get_functiondef('public.resolve_progressive_verification_attempt_v1(uuid,text,text,text,numeric)'::regprocedure) INTO definition;
  IF (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'BOOKING_UX_RESOLVE_PATCH_MISMATCH';END IF;
  EXECUTE replace(definition,anchor,'IF EXISTS(SELECT 1 FROM public.progressive_payment_verification_attempts newer WHERE newer.payment_batch_id=v_attempt.payment_batch_id AND newer.id<>v_attempt.id AND (newer.created_at,newer.id)>(v_attempt.created_at,v_attempt.id)) THEN RAISE EXCEPTION ''PROGRESSIVE_IDEMPOTENCY_CONFLICT''; END IF; '||anchor);
END $patch$;

NOTIFY pgrst,'reload schema';
COMMIT;
