BEGIN;
-- Transient provider claims are separate from immutable payment evidence.
-- Existing historical review receipts and their immutability trigger are untouched.
CREATE TABLE public.booking_ux_legacy_slip_checks(
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  fingerprint text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY(payment_id,request_id)
);
ALTER TABLE public.booking_ux_legacy_slip_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_ux_legacy_slip_checks FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.booking_ux_claim_legacy_slip_check_v1(p_user uuid,p_receipt uuid,p_check uuid)
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
    SELECT result INTO prior FROM booking_ux_legacy_slip_checks WHERE payment_id=r.payment_id AND request_id=p_check;
    IF FOUND AND (prior->>'kind'<>'booking_ux_slip_check' OR prior->>'receiptRequestId'<>p_receipt::text) THEN
      RAISE EXCEPTION 'TASK10_IDEMPOTENCY_CONFLICT';END IF;
    IF FOUND AND prior->>'status'='resolved' THEN RETURN jsonb_build_object('claimed',false,'result',prior);END IF;
    IF r.status::text<>'paid' OR r.payment_status::text<>'pending' OR EXISTS(
      SELECT 1 FROM payments newer WHERE newer.booking_id=r.id AND newer.id<>r.payment_id AND newer.created_at>(SELECT created_at FROM payments WHERE id=r.payment_id))
      THEN RAISE EXCEPTION 'TASK10_PAYMENT_REVIEW_CONFLICT';END IF;
    IF EXISTS(SELECT 1 FROM booking_ux_legacy_slip_checks WHERE payment_id=r.payment_id AND result->>'kind'='booking_ux_slip_check'
      AND result->>'status'='checking' AND (result->>'leaseUntil')::timestamptz>t) THEN
      RETURN jsonb_build_object('claimed',false,'checking',true);END IF;
  END LOOP;
  fingerprint:=encode(extensions.digest(concat_ws('|','booking_ux_slip_check',p_user,p_receipt,p_check),'sha256'),'hex');
  FOR r IN SELECT a.payment_id FROM task10_accepted_receipts a WHERE a.request_id=p_receipt AND a.booking_id=ANY(ids) LOOP
    INSERT INTO booking_ux_legacy_slip_checks(payment_id,request_id,actor_id,fingerprint,result,created_at)
      VALUES(r.payment_id,p_check,p_user,fingerprint,jsonb_build_object('kind','booking_ux_slip_check','status','checking',
        'receiptRequestId',p_receipt,'claimToken',token,'leaseUntil',t+interval '40 seconds'),t)
      ON CONFLICT(payment_id,request_id) DO UPDATE SET result=excluded.result;
  END LOOP;
  RETURN jsonb_build_object('claimed',true,'claimToken',token);
END $$;

CREATE OR REPLACE FUNCTION public.booking_ux_resolve_legacy_slip_check_v1(p_user uuid,p_receipt uuid,p_check uuid,p_token uuid,p_decision text,p_notes text)
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
    SELECT result INTO prior FROM booking_ux_legacy_slip_checks WHERE payment_id=r.payment_id AND request_id=p_check AND actor_id=p_user;
    IF NOT FOUND OR prior->>'kind'<>'booking_ux_slip_check' OR prior->>'receiptRequestId'<>p_receipt::text
      OR prior->>'claimToken' IS DISTINCT FROM p_token::text THEN RAISE EXCEPTION 'TASK10_PAYMENT_REVIEW_CONFLICT';END IF;
    IF prior->>'status'='resolved' THEN
      IF prior->>'decision' IS DISTINCT FROM p_decision OR prior->>'notes' IS DISTINCT FROM p_notes THEN RAISE EXCEPTION 'TASK10_IDEMPOTENCY_CONFLICT';END IF;
      CONTINUE;
    END IF;
    IF r.status::text<>'paid' OR r.payment_status::text<>'pending' OR EXISTS(
      SELECT 1 FROM booking_ux_legacy_slip_checks c WHERE c.payment_id=r.payment_id AND c.request_id<>p_check
      AND c.result->>'kind'='booking_ux_slip_check' AND (c.result->>'leaseUntil')::timestamptz>(prior->>'leaseUntil')::timestamptz)
      THEN RAISE EXCEPTION 'TASK10_PAYMENT_REVIEW_CONFLICT';END IF;
    UPDATE payments SET status=CASE p_decision WHEN 'approved' THEN 'approved'::payment_status WHEN 'rejected' THEN 'rejected'::payment_status ELSE 'pending'::payment_status END,
      verified_at=CASE WHEN p_decision='approved' THEN t ELSE NULL END,notes=p_notes WHERE id=r.payment_id;
    UPDATE bookings SET status=next_status::booking_status WHERE id=r.id;
    UPDATE booking_ux_legacy_slip_checks SET result=prior||jsonb_build_object('status','resolved','decision',p_decision,'notes',p_notes)
      WHERE payment_id=r.payment_id AND request_id=p_check;
    INSERT INTO task10_payment_review_receipts(payment_id,request_id,actor_id,fingerprint,result,created_at)
      SELECT payment_id,request_id,actor_id,fingerprint,result,t FROM booking_ux_legacy_slip_checks
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


NOTIFY pgrst,'reload schema';
COMMIT;
