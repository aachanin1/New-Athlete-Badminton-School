-- Task10 lifecycle transactions. Definitions only: no activation or historical writes.
BEGIN;

CREATE TABLE public.task10_payment_review_receipts (
  payment_id uuid NOT NULL REFERENCES public.payments(id), request_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES public.profiles(id), fingerprint text NOT NULL,
  result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(payment_id,request_id)
);
ALTER TABLE public.task10_payment_review_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.task10_payment_review_receipts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.task10_payment_review_receipts TO service_role;
CREATE TRIGGER task10_immutable BEFORE UPDATE OR DELETE ON public.task10_payment_review_receipts
  FOR EACH ROW EXECUTE FUNCTION public.task10_immutable_evidence_v1();

CREATE FUNCTION public.task10_booking_deadline_v1(p_booking_id uuid) RETURNS timestamptz
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  SELECT least(b.expires_at,(SELECT min((s.date+s.start_time) AT TIME ZONE 'Asia/Bangkok')
    FROM public.booking_sessions s WHERE s.booking_id=b.id AND s.cancelled_at IS NULL
      AND s.status::text NOT IN ('rescheduled','walleted')))
  FROM public.bookings b WHERE b.id=p_booking_id
$$;

CREATE FUNCTION public.task10_booking_in_cohort_v1(p_booking_id uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  SELECT coalesce(a.effective_at IS NOT NULL AND (b.created_at>=a.effective_at OR EXISTS(
    SELECT 1 FROM public.task10_booking_expiry_cohort c WHERE c.booking_id=b.id)),false)
  FROM public.bookings b CROSS JOIN public.task10_policy_activation a WHERE b.id=p_booking_id
$$;

CREATE FUNCTION public.task10_has_accepted_receipt_v1(p_booking_id uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.task10_accepted_receipts r WHERE r.booking_id=p_booking_id
    AND (r.deadline IS NULL OR r.accepted_at<r.deadline))
$$;

CREATE FUNCTION public.task10_booking_due_v1(p_booking_id uuid) RETURNS boolean
LANGUAGE sql VOLATILE SET search_path=public,pg_temp AS $$
  SELECT coalesce(b.status::text IN ('pending_payment','paid') AND public.task10_booking_in_cohort_v1(b.id)
    AND public.task10_booking_deadline_v1(b.id)<=public.task10_clock_v1()
    AND NOT public.task10_has_accepted_receipt_v1(b.id),false)
  FROM public.bookings b WHERE b.id=p_booking_id
$$;

CREATE FUNCTION public.task10_payment_projection_v1(p_booking_ids uuid[]) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('bookingId',b.id,'status',b.status,
    'inCohort',public.task10_booking_in_cohort_v1(b.id),'deadline',public.task10_booking_deadline_v1(b.id),
    'acceptedReceipt',public.task10_has_accepted_receipt_v1(b.id),'due',public.task10_booking_due_v1(b.id),
    'cancelledAt',c.cancelled_at,'cancellationReason',c.reason,'originalExpiresAt',b.expires_at) ORDER BY b.id),'[]'::jsonb)
  FROM public.bookings b LEFT JOIN public.task10_booking_cancellations c ON c.booking_id=b.id WHERE b.id=ANY(p_booking_ids)
$$;

-- All family keys precede every pricing key. All pricing keys precede batch and
-- booking rows, including multi-booking Legacy uploads spanning lesson months.
CREATE FUNCTION public.task10_lock_scopes_v1(p_scopes jsonb) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r record;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  PERFORM pg_advisory_xact_lock_shared(10,2);
  PERFORM pg_advisory_xact_lock_shared(10,3);
  IF jsonb_typeof(p_scopes) IS DISTINCT FROM 'array' OR EXISTS(SELECT 1 FROM jsonb_to_recordset(p_scopes)
    AS s(user_id uuid,course_type_id uuid,year integer,month integer)
    WHERE user_id IS NULL OR course_type_id IS NULL OR year IS NULL OR year NOT BETWEEN 1 AND 9999 OR month IS NULL OR month NOT BETWEEN 1 AND 12)
    THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
  FOR r IN SELECT DISTINCT user_id,make_date(year,month,1) AS month FROM jsonb_to_recordset(p_scopes)
    AS s(user_id uuid,course_type_id uuid,year integer,month integer) ORDER BY 1,2 LOOP
    PERFORM public.task10_lock_family_months_v1(r.user_id,ARRAY[r.month]);
  END LOOP;
  FOR r IN SELECT DISTINCT user_id,course_type_id,year,month FROM jsonb_to_recordset(p_scopes)
    AS s(user_id uuid,course_type_id uuid,year integer,month integer) ORDER BY 1,2,3,4 LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(concat_ws('|',r.user_id,r.course_type_id,r.year,r.month,'THB'),0));
  END LOOP;
  PERFORM sc.id FROM public.booking_pricing_scopes sc WHERE EXISTS(SELECT 1 FROM jsonb_to_recordset(p_scopes)
    AS s(user_id uuid,course_type_id uuid,year integer,month integer)
    WHERE sc.user_id=s.user_id AND sc.course_type_id=s.course_type_id AND sc.lesson_year=s.year AND sc.lesson_month=s.month)
    ORDER BY sc.id FOR UPDATE;
  FOR r IN SELECT batch.id FROM public.progressive_payment_batches batch JOIN public.booking_pricing_scopes sc ON sc.id=batch.pricing_scope_id
    WHERE EXISTS(SELECT 1 FROM jsonb_to_recordset(p_scopes) AS s(user_id uuid,course_type_id uuid,year integer,month integer)
      WHERE sc.user_id=s.user_id AND sc.course_type_id=s.course_type_id AND sc.lesson_year=s.year AND sc.lesson_month=s.month)
    ORDER BY batch.id LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('progressive-payment-batch|'||r.id::text,0));
    PERFORM 1 FROM public.progressive_payment_batches WHERE id=r.id FOR UPDATE;
  END LOOP;
  PERFORM b.id FROM public.bookings b WHERE EXISTS(SELECT 1 FROM jsonb_to_recordset(p_scopes)
    AS s(user_id uuid,course_type_id uuid,year integer,month integer)
    WHERE b.user_id=s.user_id AND b.course_type_id=s.course_type_id AND b.year=s.year AND b.month=s.month) ORDER BY b.id FOR UPDATE;
  PERFORM bs.id FROM public.booking_sessions bs JOIN public.bookings b ON b.id=bs.booking_id WHERE EXISTS(SELECT 1 FROM jsonb_to_recordset(p_scopes)
    AS s(user_id uuid,course_type_id uuid,year integer,month integer)
    WHERE b.user_id=s.user_id AND b.course_type_id=s.course_type_id AND b.year=s.year AND b.month=s.month) ORDER BY bs.id FOR UPDATE OF bs;
  PERFORM set_config('task10.booking_write','authorized',true);
  PERFORM set_config('task10.source_write','authorized',true);
  PERFORM set_config('task10.payment_write','authorized',true);
END $$;

CREATE OR REPLACE FUNCTION public.task10_lock_pricing_scope_v1(p_user_id uuid,p_course_type_id uuid,p_year integer,p_month integer) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  PERFORM public.task10_lock_scopes_v1(jsonb_build_array(jsonb_build_object('user_id',p_user_id,'course_type_id',p_course_type_id,'year',p_year,'month',p_month)));
END $$;

CREATE FUNCTION public.task10_lock_booking_set_v1(p_booking_ids uuid[]) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_scopes jsonb;
BEGIN
  IF p_booking_ids IS NULL OR cardinality(p_booking_ids)=0 OR cardinality(p_booking_ids)<>(SELECT count(DISTINCT id) FROM unnest(p_booking_ids) id)
    OR cardinality(p_booking_ids)<>(SELECT count(*) FROM public.bookings WHERE id=ANY(p_booking_ids)) THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
  SELECT jsonb_agg(s) INTO v_scopes FROM(SELECT DISTINCT user_id,course_type_id,year,month FROM public.bookings WHERE id=ANY(p_booking_ids)) s;
  PERFORM public.task10_lock_scopes_v1(v_scopes);
END $$;

CREATE FUNCTION public.task10_begin_payment_batch_v1(p_batch_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE s public.booking_pricing_scopes%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  IF NOT public.task10_source_policy_established_v1() THEN RETURN; END IF;
  SELECT sc.* INTO s FROM public.booking_pricing_scopes sc JOIN public.progressive_payment_batches b ON b.pricing_scope_id=sc.id WHERE b.id=p_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROGRESSIVE_BATCH_NOT_FOUND'; END IF;
  PERFORM public.task10_lock_pricing_scope_v1(s.user_id,s.course_type_id,s.lesson_year,s.lesson_month);
END $$;

CREATE FUNCTION public.task10_assert_receipt_window_v1(p_booking_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE b public.bookings%ROWTYPE; d timestamptz;
BEGIN
  SELECT * INTO b FROM public.bookings WHERE id=p_booking_id;
  IF NOT FOUND OR b.status::text='cancelled' THEN RAISE EXCEPTION 'TASK10_BOOKING_CANCELLED'; END IF;
  IF public.task10_booking_in_cohort_v1(b.id) AND NOT public.task10_has_accepted_receipt_v1(b.id) THEN
    d:=public.task10_booking_deadline_v1(b.id);
    IF d IS NULL THEN RAISE EXCEPTION 'TASK10_INVALID_DEADLINE'; END IF;
    IF d<=public.task10_clock_v1() THEN RAISE EXCEPTION 'TASK10_BOOKING_DEADLINE'; END IF;
  END IF;
END $$;

CREATE FUNCTION public.task10_begin_payment_scope_v1(p_scope_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE s public.booking_pricing_scopes%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  IF NOT public.task10_source_policy_established_v1() THEN RETURN; END IF;
  SELECT * INTO s FROM public.booking_pricing_scopes WHERE id=p_scope_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROGRESSIVE_UNAUTHORIZED'; END IF;
  PERFORM public.task10_lock_pricing_scope_v1(s.user_id,s.course_type_id,s.lesson_year,s.lesson_month);
END $$;

CREATE FUNCTION public.task10_assert_scope_current_v1(p_user_id uuid,p_course_type_id uuid,p_year integer,p_month integer) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.bookings WHERE user_id=p_user_id AND course_type_id=p_course_type_id AND year=p_year AND month=p_month
    AND public.task10_booking_due_v1(id)) THEN RAISE EXCEPTION 'TASK10_BOOKING_DEADLINE'; END IF;
END $$;

CREATE FUNCTION public.task10_guard_payment_lifecycle_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  IF NOT public.task10_source_policy_established_v1() THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
  END IF;
  IF TG_TABLE_NAME='bookings' THEN
    IF TG_OP='INSERT' THEN
      IF current_user NOT IN ('postgres','supabase_admin') OR current_setting('task10.payment_write',true) IS DISTINCT FROM 'authorized'
        THEN RAISE EXCEPTION 'TASK10_GUARDED_PAYMENT_LIFECYCLE'; END IF;
      -- Non-Kids creation also belongs to the actual post-lock expiry cohort.
      IF NOT EXISTS(SELECT 1 FROM public.course_types WHERE id=NEW.course_type_id AND name::text='kids_group') THEN NEW.created_at:=public.task10_clock_v1(); END IF;
      RETURN NEW;
    END IF;
    IF TG_OP='UPDATE' AND OLD.status::text='cancelled' AND NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'TASK10_BOOKING_CANCELLED'; END IF;
    IF TG_OP='UPDATE' AND ROW(NEW.status,NEW.user_id,NEW.course_type_id,NEW.year,NEW.month,NEW.total_sessions,NEW.entitlement_sessions,
      NEW.total_price,NEW.expires_at,NEW.created_at,NEW.pricing_scope_id) IS NOT DISTINCT FROM ROW(OLD.status,OLD.user_id,OLD.course_type_id,
      OLD.year,OLD.month,OLD.total_sessions,OLD.entitlement_sessions,OLD.total_price,OLD.expires_at,OLD.created_at,OLD.pricing_scope_id) THEN RETURN NEW; END IF;
  END IF;
  IF current_user NOT IN ('postgres','supabase_admin') OR current_setting('task10.payment_write',true) IS DISTINCT FROM 'authorized' THEN
    RAISE EXCEPTION 'TASK10_GUARDED_PAYMENT_LIFECYCLE';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER task10_payment_booking_guard BEFORE INSERT OR UPDATE OR DELETE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.task10_guard_payment_lifecycle_v1();
CREATE TRIGGER task10_payment_row_guard BEFORE INSERT OR UPDATE OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.task10_guard_payment_lifecycle_v1();
CREATE TRIGGER task10_payment_batch_guard BEFORE INSERT OR UPDATE OR DELETE ON public.progressive_payment_batches FOR EACH ROW EXECUTE FUNCTION public.task10_guard_payment_lifecycle_v1();
CREATE TRIGGER task10_payment_member_guard BEFORE INSERT OR UPDATE OR DELETE ON public.progressive_payment_batch_bookings FOR EACH ROW EXECUTE FUNCTION public.task10_guard_payment_lifecycle_v1();
CREATE TRIGGER task10_payment_allocation_guard BEFORE INSERT OR UPDATE OR DELETE ON public.progressive_payment_allocations FOR EACH ROW EXECUTE FUNCTION public.task10_guard_payment_lifecycle_v1();

-- Pending/awaiting-review session structure determines the payment deadline.
-- Attendance status alone and verified Adult/Private source operations retain their contracts.
CREATE FUNCTION public.task10_guard_pending_session_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_ids uuid[]; v_changed boolean:=true;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  IF NOT public.task10_source_policy_established_v1() THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
  END IF;
  IF TG_OP='INSERT' THEN v_ids:=ARRAY[NEW.booking_id];
  ELSIF TG_OP='DELETE' THEN v_ids:=ARRAY[OLD.booking_id];
  ELSE v_ids:=ARRAY[OLD.booking_id,NEW.booking_id];
    v_changed:=ROW(NEW.booking_id,NEW.date,NEW.start_time,NEW.end_time,NEW.schedule_slot_id,NEW.branch_id,NEW.child_id,NEW.cancelled_at,NEW.is_makeup,NEW.rescheduled_from_id)
      IS DISTINCT FROM ROW(OLD.booking_id,OLD.date,OLD.start_time,OLD.end_time,OLD.schedule_slot_id,OLD.branch_id,OLD.child_id,OLD.cancelled_at,OLD.is_makeup,OLD.rescheduled_from_id)
      OR (NEW.status IS DISTINCT FROM OLD.status AND (NEW.status::text IN ('walleted','rescheduled') OR OLD.status::text IN ('walleted','rescheduled')));
  END IF;
  IF v_changed AND EXISTS(SELECT 1 FROM public.bookings WHERE id=ANY(v_ids) AND status::text IN ('pending_payment','paid'))
    AND (current_user NOT IN ('postgres','supabase_admin') OR current_setting('task10.source_write',true) IS DISTINCT FROM 'authorized')
    THEN RAISE EXCEPTION 'TASK10_GUARDED_PAYMENT_LIFECYCLE'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER task10_pending_session_guard BEFORE INSERT OR UPDATE OR DELETE ON public.booking_sessions
  FOR EACH ROW EXECUTE FUNCTION public.task10_guard_pending_session_v1();
REVOKE ALL ON FUNCTION public.task10_guard_pending_session_v1() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.task10_accept_legacy_slip_v1(p_user_id uuid,p_booking_ids uuid[],p_storage_path text,p_public_url text,p_sha256 text,p_expected_amount numeric,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b public.bookings%ROWTYPE; r public.task10_accepted_receipts%ROWTYPE; v_payment uuid; v_fingerprint text; v_time timestamptz; v_result jsonb:='[]';
BEGIN
  PERFORM public.task10_lock_booking_set_v1(p_booking_ids);
  IF p_user_id IS NULL OR p_request_id IS NULL OR p_sha256 !~ '^[a-f0-9]{64}$' OR p_public_url IS NULL
    OR left(p_storage_path,length(p_user_id::text)+1)<>p_user_id::text||'/' OR NOT EXISTS(
      SELECT 1 FROM storage.objects WHERE bucket_id='payment-slips' AND name=p_storage_path)
    OR EXISTS(SELECT 1 FROM public.bookings WHERE id=ANY(p_booking_ids) AND (user_id<>p_user_id OR pricing_scope_id IS NOT NULL))
    THEN RAISE EXCEPTION 'TASK10_INVALID_RECEIPT'; END IF;
  v_fingerprint:=encode(extensions.digest(concat_ws('|',p_user_id,p_storage_path,p_sha256,p_expected_amount,
    (SELECT string_agg(id::text,',' ORDER BY id) FROM unnest(p_booking_ids) id)),'sha256'),'hex');
  IF (SELECT sum(total_price) FROM public.bookings WHERE id=ANY(p_booking_ids)) IS DISTINCT FROM p_expected_amount THEN RAISE EXCEPTION 'TASK10_AMOUNT_CONFLICT'; END IF;
  FOR b IN SELECT * FROM public.bookings WHERE id=ANY(p_booking_ids) ORDER BY id LOOP
    SELECT * INTO r FROM public.task10_accepted_receipts WHERE booking_id=b.id AND request_id=p_request_id;
    IF FOUND THEN
      IF r.fingerprint IS DISTINCT FROM v_fingerprint THEN RAISE EXCEPTION 'TASK10_IDEMPOTENCY_CONFLICT'; END IF;
      v_result:=v_result||jsonb_build_array(jsonb_build_object('bookingId',b.id,'paymentId',r.payment_id)); CONTINUE;
    END IF;
    PERFORM public.task10_assert_receipt_window_v1(b.id);
    IF b.status::text<>'pending_payment' THEN RAISE EXCEPTION 'TASK10_BOOKING_STATE_CONFLICT'; END IF;
    v_time:=public.task10_clock_v1();
    INSERT INTO public.payments(booking_id,user_id,amount,method,slip_image_url,status,notes,created_at)
      VALUES(b.id,p_user_id,b.total_price,'transfer',p_public_url,'pending','รับสลิปแล้ว รอตรวจสอบ',v_time) RETURNING id INTO v_payment;
    INSERT INTO public.task10_accepted_receipts(booking_id,payment_id,storage_path,accepted_at,deadline,fingerprint,evidence,request_id)
      VALUES(b.id,v_payment,p_storage_path,v_time,public.task10_booking_deadline_v1(b.id),v_fingerprint,
        jsonb_build_object('bucket','payment-slips','sha256',p_sha256,'amount',b.total_price,'bookingStatus',b.status),p_request_id);
    UPDATE public.bookings SET status='paid' WHERE id=b.id;
    v_result:=v_result||jsonb_build_array(jsonb_build_object('bookingId',b.id,'paymentId',v_payment));
  END LOOP;
  RETURN jsonb_build_object('success',true,'payments',v_result);
END $$;

CREATE FUNCTION public.task10_legacy_receipt_request_v1(p_user_id uuid,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
  IF EXISTS(SELECT 1 FROM public.task10_accepted_receipts r JOIN public.bookings b ON b.id=r.booking_id
    WHERE r.request_id=p_request_id AND b.user_id=p_user_id AND b.status::text='cancelled') THEN RAISE EXCEPTION 'TASK10_BOOKING_CANCELLED'; END IF;
  SELECT jsonb_build_object('found',true,'bookingIds',jsonb_agg(b.id ORDER BY b.id),'storagePath',min(r.storage_path),
    'sha256',min(r.evidence->>'sha256'),'totalAmount',sum((r.evidence->>'amount')::numeric),
    'finalized',bool_and(p.status::text='approved' AND b.status::text='verified'),'notes',string_agg(DISTINCT p.notes,E'\n')) INTO v_result
    FROM public.task10_accepted_receipts r JOIN public.bookings b ON b.id=r.booking_id JOIN public.payments p ON p.id=r.payment_id
    WHERE r.request_id=p_request_id AND b.user_id=p_user_id HAVING count(*)>0;
  RETURN coalesce(v_result,jsonb_build_object('found',false));
END $$;
REVOKE ALL ON FUNCTION public.task10_legacy_receipt_request_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.task10_legacy_receipt_request_v1(uuid,uuid) TO service_role;

CREATE FUNCTION public.task10_finalize_legacy_slip_v1(p_user_id uuid,p_request_id uuid,p_approved boolean,p_notes text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_ids uuid[]; r record; v_time timestamptz; v_changed integer:=0; v_total numeric;
BEGIN
  SELECT array_agg(DISTINCT b.id ORDER BY b.id) INTO v_ids FROM public.task10_accepted_receipts a JOIN public.bookings b ON b.id=a.booking_id
    WHERE a.request_id=p_request_id AND a.payment_id IS NOT NULL AND b.user_id=p_user_id;
  IF v_ids IS NULL THEN RAISE EXCEPTION 'TASK10_INVALID_RECEIPT'; END IF;
  PERFORM public.task10_lock_booking_set_v1(v_ids); v_time:=public.task10_clock_v1();
  FOR r IN SELECT a.payment_id,b.id,b.status,p.status AS payment_status FROM public.task10_accepted_receipts a
    JOIN public.bookings b ON b.id=a.booking_id JOIN public.payments p ON p.id=a.payment_id
    WHERE a.request_id=p_request_id AND b.id=ANY(v_ids) ORDER BY b.id FOR UPDATE OF p LOOP
    IF r.status::text='cancelled' THEN RAISE EXCEPTION 'TASK10_BOOKING_CANCELLED'; END IF;
    IF EXISTS(SELECT 1 FROM public.task10_payment_review_receipts WHERE payment_id=r.payment_id AND request_id=p_request_id) THEN
      IF NOT EXISTS(SELECT 1 FROM public.task10_payment_review_receipts WHERE payment_id=r.payment_id AND request_id=p_request_id
        AND actor_id=p_user_id AND result->>'kind'='legacy_slip_finalize' AND (result->>'approved')::boolean=p_approved)
        THEN RAISE EXCEPTION 'TASK10_PAYMENT_REVIEW_CONFLICT'; END IF;
      CONTINUE;
    END IF;
    IF r.payment_status::text<>'pending' THEN
      IF r.payment_status::text='approved' AND p_approved AND r.status::text='verified' THEN CONTINUE; END IF;
      RAISE EXCEPTION 'TASK10_PAYMENT_REVIEW_CONFLICT';
    END IF;
    UPDATE public.payments SET status=CASE WHEN p_approved THEN 'approved'::public.payment_status ELSE 'pending'::public.payment_status END,
      verified_at=CASE WHEN p_approved THEN v_time ELSE NULL END,notes=p_notes WHERE id=r.payment_id;
    UPDATE public.bookings SET status=CASE WHEN p_approved THEN 'verified'::public.booking_status ELSE 'paid'::public.booking_status END WHERE id=r.id;
    INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details) VALUES(p_user_id,'task10_slip_finalized','payment',r.payment_id,
      jsonb_build_object('bookingId',r.id,'approved',p_approved,'requestId',p_request_id));
    INSERT INTO public.task10_payment_review_receipts(payment_id,request_id,actor_id,fingerprint,result,created_at)
      VALUES(r.payment_id,p_request_id,p_user_id,encode(extensions.digest(concat_ws('|','legacy_slip_finalize',p_user_id,p_request_id,p_approved),'sha256'),'hex'),
        jsonb_build_object('kind','legacy_slip_finalize','approved',p_approved,'notes',p_notes),v_time);
    v_changed:=v_changed+1;
  END LOOP;
  IF v_changed>0 THEN
    SELECT sum(total_price) INTO v_total FROM public.bookings WHERE id=ANY(v_ids);
    INSERT INTO public.notifications(user_id,title,message,type,link_url)
      SELECT id,CASE WHEN p_approved THEN 'SlipOK ยืนยันการชำระเงินแล้ว' ELSE 'มีสลิปรอตรวจสอบ' END,
        cardinality(v_ids)||' รายการ • ยอด '||v_total||' บาท','payment','/admin/payments' FROM public.profiles WHERE role::text IN ('admin','super_admin');
    INSERT INTO public.notifications(user_id,title,message,type,link_url) VALUES(p_user_id,
      CASE WHEN p_approved THEN 'ชำระเงินสำเร็จ' ELSE 'ส่งสลิปแล้ว รอตรวจสอบ' END,
      CASE WHEN p_approved THEN 'ระบบยืนยันสลิปของคุณแล้วสำหรับ '||cardinality(v_ids)||' รายการ'
        ELSE 'ระบบรับสลิปของคุณแล้ว หาก SlipOK ยังไม่ยืนยันอัตโนมัติ แอดมินจะตรวจสอบต่อ' END,'payment','/dashboard/history');
  END IF;
  RETURN jsonb_build_object('success',true,'bookingStatus',CASE WHEN p_approved THEN 'verified' ELSE 'paid' END);
END $$;

CREATE FUNCTION public.task10_review_legacy_payment_v1(p_actor_id uuid,p_payment_id uuid,p_action text,p_notes text,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.payments%ROWTYPE; b public.bookings%ROWTYPE; v_prior public.task10_payment_review_receipts%ROWTYPE;
  v_fingerprint text; v_payment_status public.payment_status; v_booking_status public.booking_status; v_time timestamptz; v_note text; v_result jsonb; v_slots uuid[];
BEGIN
  PERFORM public.task10_require_actor_v1(p_actor_id,'payments');
  IF p_request_id IS NULL OR p_action IS NULL OR p_action NOT IN ('approve','send_back','cancel') THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
  SELECT * INTO p FROM public.payments WHERE id=p_payment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'TASK10_INVALID_RECEIPT'; END IF;
  PERFORM public.task10_lock_booking_set_v1(ARRAY[p.booking_id]);
  v_fingerprint:=encode(extensions.digest(concat_ws('|',p_actor_id,p_payment_id,p_action,coalesce(p_notes,'')),'sha256'),'hex');
  SELECT * INTO v_prior FROM public.task10_payment_review_receipts WHERE payment_id=p_payment_id AND request_id=p_request_id;
  IF FOUND THEN
    IF v_prior.actor_id IS DISTINCT FROM p_actor_id OR v_prior.fingerprint IS DISTINCT FROM v_fingerprint THEN RAISE EXCEPTION 'TASK10_IDEMPOTENCY_CONFLICT'; END IF;
    RETURN v_prior.result;
  END IF;
  SELECT * INTO p FROM public.payments WHERE id=p_payment_id FOR UPDATE;
  SELECT * INTO b FROM public.bookings WHERE id=p.booking_id;
  IF p.status::text<>'pending' OR b.status::text NOT IN ('pending_payment','paid') OR b.pricing_scope_id IS NOT NULL THEN RAISE EXCEPTION 'TASK10_PAYMENT_REVIEW_CONFLICT'; END IF;
  IF public.task10_booking_due_v1(b.id) THEN RAISE EXCEPTION 'TASK10_BOOKING_DEADLINE'; END IF;
  v_time:=public.task10_clock_v1();
  v_payment_status:=CASE WHEN p_action='approve' THEN 'approved' ELSE 'rejected' END;
  v_booking_status:=CASE WHEN p_action='approve' THEN 'verified' WHEN p_action='cancel' THEN 'cancelled' ELSE 'pending_payment' END;
  v_note:=coalesce(nullif(trim(p_notes),''),CASE WHEN p_action='approve' THEN 'Admin manual approval' WHEN p_action='cancel' THEN 'Admin rejected and cancelled booking' ELSE 'Admin returned payment for slip re-upload' END);
  UPDATE public.payments SET status=v_payment_status,verified_by=p_actor_id,verified_at=v_time,
    notes=concat_ws(E'\n',p.notes,'[Admin payment review: '||p_action||'] '||v_note) WHERE id=p.id;
  IF p_action='cancel' THEN
    PERFORM public.task10_cancel_legacy_booking_v1(b.id,p_actor_id,'admin_payment_cancelled');
  ELSE UPDATE public.bookings SET status=v_booking_status WHERE id=b.id; END IF;
  INSERT INTO public.notifications(user_id,title,message,type,link_url) VALUES(b.user_id,
    CASE WHEN p_action='approve' THEN 'ยืนยันการชำระเงินแล้ว' WHEN p_action='cancel' THEN 'การจองถูกยกเลิก' ELSE 'กรุณาแนบสลิปใหม่' END,
    CASE WHEN p_action='approve' THEN 'ผู้ดูแลยืนยันการชำระเงินของคุณเรียบร้อยแล้ว' ELSE v_note END,'payment','/dashboard/history');
  INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details) VALUES(p_actor_id,'admin_payment_'||p_action,'payment',p.id,
    jsonb_build_object('bookingId',b.id,'paymentStatus',v_payment_status,'bookingStatus',v_booking_status,'notes',p_notes));
  v_result:=jsonb_build_object('success',true,'status',v_payment_status,'bookingStatus',v_booking_status);
  INSERT INTO public.task10_payment_review_receipts(payment_id,request_id,actor_id,fingerprint,result,created_at)
    VALUES(p.id,p_request_id,p_actor_id,v_fingerprint,v_result,v_time);
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.task10_review_legacy_payment_v1(uuid,uuid,text,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.task10_review_legacy_payment_v1(uuid,uuid,text,text,uuid) TO service_role;

CREATE FUNCTION public.task10_record_batch_receipts_v1(p_batch_id uuid,p_path text,p_sha text) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE b public.progressive_payment_batches%ROWTYPE; m record; v_time timestamptz; v_request uuid; v_fingerprint text; r public.task10_accepted_receipts%ROWTYPE;
BEGIN
  IF NOT public.task10_source_policy_established_v1() THEN RETURN; END IF;
  SELECT * INTO b FROM public.progressive_payment_batches WHERE id=p_batch_id;
  IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='progressive-payment-slips' AND name=p_path) THEN RAISE EXCEPTION 'TASK10_INVALID_RECEIPT'; END IF;
  PERFORM public.assert_progressive_payment_batch_members_v1(p_batch_id);
  v_request:=md5(concat_ws('|',p_batch_id,p_path,p_sha))::uuid;
  FOR m IN SELECT * FROM public.progressive_payment_batch_bookings WHERE payment_batch_id=p_batch_id ORDER BY booking_id LOOP
    PERFORM public.task10_assert_receipt_window_v1(m.booking_id);
    v_time:=public.task10_clock_v1();
    v_fingerprint:=encode(extensions.digest(concat_ws('|',p_batch_id,m.booking_id,m.member_fingerprint,m.amount_snapshot,p_path,p_sha),'sha256'),'hex');
    SELECT * INTO r FROM public.task10_accepted_receipts WHERE booking_id=m.booking_id AND request_id=v_request;
    IF FOUND THEN
      IF r.fingerprint IS DISTINCT FROM v_fingerprint THEN RAISE EXCEPTION 'TASK10_RECEIPT_FINGERPRINT_CONFLICT'; END IF;
      CONTINUE;
    END IF;
    INSERT INTO public.task10_accepted_receipts(booking_id,batch_id,storage_path,accepted_at,deadline,fingerprint,evidence,request_id)
      VALUES(m.booking_id,p_batch_id,p_path,v_time,public.task10_booking_deadline_v1(m.booking_id),v_fingerprint,
        jsonb_build_object('bucket','progressive-payment-slips','sha256',p_sha,'amount',m.amount_snapshot,'memberFingerprint',m.member_fingerprint),v_request);
  END LOOP;
END $$;

CREATE FUNCTION public.task10_assert_batch_receipts_v1(p_batch_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE b public.progressive_payment_batches%ROWTYPE;
BEGIN
  IF NOT public.task10_source_policy_established_v1() THEN RETURN; END IF;
  SELECT * INTO b FROM public.progressive_payment_batches WHERE id=p_batch_id;
  IF EXISTS(SELECT 1 FROM public.progressive_payment_batch_bookings m JOIN public.bookings book ON book.id=m.booking_id
    WHERE m.payment_batch_id=p_batch_id AND (book.status::text='cancelled' OR NOT EXISTS(
      SELECT 1 FROM public.task10_accepted_receipts r WHERE r.booking_id=m.booking_id AND r.batch_id=p_batch_id
        AND r.storage_path=b.slip_storage_path AND r.evidence->>'sha256'=b.slip_sha256
        AND r.evidence->>'memberFingerprint'=m.member_fingerprint
        AND (r.evidence->>'amount')::numeric=m.amount_snapshot))) THEN RAISE EXCEPTION 'TASK10_RECEIPT_FINGERPRINT_CONFLICT'; END IF;
END $$;

CREATE FUNCTION public.task10_pending_pricing_active_v1(p_booking_id uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  SELECT b.status::text<>'pending_payment' OR b.expires_at IS NULL OR b.expires_at>transaction_timestamp()
    OR (public.task10_source_policy_established_v1() AND public.task10_booking_in_cohort_v1(b.id))
  FROM public.bookings b WHERE b.id=p_booking_id
$$;

-- Cancellation deltas attest only an exact physical cancellation. Overdue cohort
-- members remain in the frozen comparison until that transaction commits; API
-- quotes/prepares reject a due scope instead of exposing an intermediate price.
CREATE FUNCTION public.task10_expire_booking_v1(p_booking_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b public.bookings%ROWTYPE; a public.task10_policy_activation%ROWTYPE; sc public.booking_pricing_scopes%ROWTYPE;
  v_deadline timestamptz; v_time timestamptz; v_effective jsonb; v_before record; v_after record; v_slots uuid[]; v_revision bigint; v_changes jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  SELECT * INTO a FROM public.task10_policy_activation;
  IF a.state<>'active' OR NOT a.expiry_enabled THEN RETURN jsonb_build_object('cancelled',false,'reason','inactive'); END IF;
  PERFORM public.task10_lock_booking_set_v1(ARRAY[p_booking_id]);
  SELECT * INTO b FROM public.bookings WHERE id=p_booking_id;
  IF NOT public.task10_booking_due_v1(b.id) THEN RETURN jsonb_build_object('cancelled',false,'reason','not_due_or_receipt'); END IF;
  v_deadline:=public.task10_booking_deadline_v1(b.id); v_time:=public.task10_clock_v1();
  SELECT * INTO sc FROM public.booking_pricing_scopes WHERE user_id=b.user_id AND course_type_id=b.course_type_id AND lesson_year=b.year AND lesson_month=b.month;
  IF b.pricing_scope_id IS NULL AND sc.legacy_baseline_initialized_at IS NOT NULL THEN
    v_effective:=public.task10_effective_scope_baseline_v1(sc.id);
    SELECT * INTO v_before FROM public.progressive_legacy_baseline_v1(b.user_id,b.course_type_id,b.year,b.month);
    IF (v_effective->>'sessions')::integer IS DISTINCT FROM v_before.baseline_sessions
      OR v_effective->>'fingerprint' IS DISTINCT FROM v_before.baseline_fingerprint THEN RAISE EXCEPTION 'PROGRESSIVE_LEGACY_BASELINE_DRIFT'; END IF;
  END IF;
  IF sc.locked_by_payment_batch_id IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM public.progressive_payment_batches WHERE id=sc.locked_by_payment_batch_id AND status<>'prepared') THEN RAISE EXCEPTION 'TASK10_BATCH_REVIEW_CONFLICT'; END IF;
    PERFORM public.cancel_progressive_prepared_batch_v1(sc.locked_by_payment_batch_id,b.user_id,'task10_booking_deadline');
  END IF;
  -- Recheck immediately before the winning write, after all applicable locks.
  IF NOT public.task10_booking_due_v1(b.id) THEN RETURN jsonb_build_object('cancelled',false,'reason','receipt_won'); END IF;
  SELECT array_agg(DISTINCT schedule_slot_id ORDER BY schedule_slot_id) INTO v_slots FROM public.booking_sessions WHERE booking_id=b.id AND schedule_slot_id IS NOT NULL;
  INSERT INTO public.task10_booking_cancellations(booking_id,cancelled_at,deadline,effective_at,reason,evidence)
    VALUES(b.id,v_time,v_deadline,a.effective_at,'no_accepted_receipt_before_deadline',jsonb_build_object('bookingBefore',to_jsonb(b),
      'sessionIds',(SELECT jsonb_agg(id ORDER BY id) FROM public.booking_sessions WHERE booking_id=b.id),'receiptCheckedAt',public.task10_clock_v1()));
  UPDATE public.bookings SET status='cancelled' WHERE id=b.id;
  UPDATE public.booking_sessions SET cancelled_at=coalesce(cancelled_at,v_time) WHERE booking_id=b.id;
  IF b.pricing_scope_id IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM public.progressive_coupon_reservations WHERE booking_id=b.id AND status='reserved') THEN
      PERFORM public.release_progressive_coupon_v1(b.id,b.user_id,'booking_expired');
    END IF;
  ELSIF sc.legacy_baseline_initialized_at IS NOT NULL THEN
    SELECT * INTO v_after FROM public.progressive_legacy_baseline_v1(b.user_id,b.course_type_id,b.year,b.month);
    IF v_before.baseline_sessions-v_after.baseline_sessions IS DISTINCT FROM b.total_sessions THEN RAISE EXCEPTION 'PROGRESSIVE_LEGACY_BASELINE_DRIFT'; END IF;
    INSERT INTO public.task10_legacy_baseline_deltas(scope_id,booking_id,revision,entitlement_delta,previous_fingerprint,next_fingerprint,evidence)
      VALUES(sc.id,b.id,(v_effective->>'deltaRevision')::bigint+1,-b.total_sessions,v_before.baseline_fingerprint,v_after.baseline_fingerprint,
        jsonb_build_object('cancellationAt',v_time,'beforeQuantity',v_before.baseline_sessions,'afterQuantity',v_after.baseline_sessions));
  END IF;
  IF sc.id IS NOT NULL THEN
    UPDATE public.booking_pricing_scopes SET revision=revision+1 WHERE id=sc.id RETURNING revision INTO v_revision;
    v_changes:=public.progressive_reprice_scope_v1(sc.id,v_revision,NULL,NULL);
  END IF;
  PERFORM public.progressive_refresh_slot_capacity_v1(v_slots);
  INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details) VALUES(b.user_id,'task10_unpaid_booking_expired','booking',b.id,
    jsonb_build_object('deadline',v_deadline,'cancelledAt',v_time,'scopeRevision',v_revision,'repricedBookings',v_changes));
  RETURN jsonb_build_object('cancelled',true,'bookingId',b.id,'deadline',v_deadline,'cancelledAt',v_time);
END $$;

REVOKE ALL ON FUNCTION public.task10_record_batch_receipts_v1(uuid,text,text),public.task10_assert_batch_receipts_v1(uuid),
  public.task10_pending_pricing_active_v1(uuid),public.task10_expire_booking_v1(uuid),public.task10_begin_payment_scope_v1(uuid),
  public.task10_assert_scope_current_v1(uuid,uuid,integer,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.task10_expire_booking_v1(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.task10_clock_v1(),public.task10_transaction_start_v1() TO service_role;

REVOKE ALL ON FUNCTION public.task10_booking_deadline_v1(uuid),public.task10_booking_in_cohort_v1(uuid),public.task10_has_accepted_receipt_v1(uuid),
  public.task10_booking_due_v1(uuid),public.task10_payment_projection_v1(uuid[]),public.task10_lock_scopes_v1(jsonb),public.task10_lock_booking_set_v1(uuid[]),
  public.task10_begin_payment_batch_v1(uuid),public.task10_assert_receipt_window_v1(uuid),public.task10_guard_payment_lifecycle_v1(),
  public.task10_accept_legacy_slip_v1(uuid,uuid[],text,text,text,numeric,uuid),public.task10_finalize_legacy_slip_v1(uuid,uuid,boolean,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.task10_payment_projection_v1(uuid[]),public.task10_accept_legacy_slip_v1(uuid,uuid[],text,text,text,numeric,uuid),
  public.task10_finalize_legacy_slip_v1(uuid,uuid,boolean,text) TO service_role;

-- Existing public contracts retain original authorization and idempotent results.
CREATE OR REPLACE FUNCTION public.lock_progressive_payment_scope_v1(p_pricing_scope_id uuid)
RETURNS public.booking_pricing_scopes
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scope public.booking_pricing_scopes%ROWTYPE;
BEGIN
  PERFORM public.task10_begin_payment_scope_v1(p_pricing_scope_id);
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

CREATE OR REPLACE FUNCTION public.validate_progressive_payment_prefix_v1(
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
  PERFORM public.task10_begin_payment_scope_v1(p_pricing_scope_id);
  IF p_pricing_scope_id IS NULL OR p_user_id IS NULL OR p_booking_ids IS NULL
    OR cardinality(p_booking_ids) = 0
    OR cardinality(p_booking_ids) <> (SELECT count(DISTINCT id) FROM unnest(p_booking_ids) selected(id))
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  IF EXISTS(SELECT 1 FROM public.bookings WHERE pricing_scope_id=p_pricing_scope_id AND public.task10_booking_due_v1(id)) THEN RAISE EXCEPTION 'TASK10_BOOKING_DEADLINE'; END IF;
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
      AND booking.expires_at <= public.task10_clock_v1()
      AND NOT (public.task10_booking_in_cohort_v1(booking.id) AND public.task10_has_accepted_receipt_v1(booking.id))
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
        OR ((session.date + session.start_time) <= timezone('Asia/Bangkok', public.task10_clock_v1()) AND NOT (public.task10_booking_in_cohort_v1(session.booking_id) AND public.task10_has_accepted_receipt_v1(session.booking_id)))
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

CREATE OR REPLACE FUNCTION public.validate_progressive_payment_complete_scope_v2(
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
  PERFORM public.task10_begin_payment_scope_v1(p_pricing_scope_id);
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

CREATE OR REPLACE FUNCTION public.prepare_progressive_payment_batch_v1(
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
  PERFORM public.task10_begin_payment_scope_v1(p_pricing_scope_id);
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

CREATE OR REPLACE FUNCTION public.prepare_progressive_payment_batch_v2(
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
  PERFORM public.task10_begin_payment_scope_v1(p_pricing_scope_id);
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

CREATE OR REPLACE FUNCTION public.record_progressive_payment_upload_v1(
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
  PERFORM public.task10_begin_payment_batch_v1(p_batch_id);
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
  IF v_batch.prepared_expires_at <= public.task10_clock_v1() THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_EXPIRED';
  END IF;

  PERFORM public.task10_record_batch_receipts_v1(p_batch_id,p_storage_path,lower(p_sha256));
  UPDATE public.progressive_payment_batches
  SET slip_storage_bucket = p_storage_bucket,
      slip_storage_path = p_storage_path,
      slip_mime_type = p_mime_type,
      slip_size_bytes = p_size_bytes,
      slip_sha256 = lower(p_sha256),
      upload_recorded_at = public.task10_clock_v1()
  WHERE id = p_batch_id;

  RETURN public.progressive_payment_batch_result_v1(p_batch_id, v_batch.slip_sha256 = lower(p_sha256));
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_PAYMENT_EXISTS';
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_progressive_payment_batch_v1(
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
  PERFORM public.task10_begin_payment_batch_v1(p_batch_id);
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
  PERFORM public.task10_assert_batch_receipts_v1(p_batch_id);

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
  PERFORM public.task10_begin_payment_batch_v1(p_batch_id);
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
  PERFORM public.task10_assert_batch_receipts_v1(p_batch_id);

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

CREATE OR REPLACE FUNCTION public.reject_progressive_payment_batch_v1(
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
  PERFORM public.task10_begin_payment_batch_v1(p_batch_id);
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
  PERFORM public.task10_assert_batch_receipts_v1(p_batch_id);

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

CREATE OR REPLACE FUNCTION public.cancel_progressive_prepared_batch_v1(
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
  PERFORM public.task10_begin_payment_batch_v1(p_batch_id);
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

CREATE OR REPLACE FUNCTION public.expire_progressive_prepared_batch_v1(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch public.progressive_payment_batches%ROWTYPE;
BEGIN
  PERFORM public.task10_begin_payment_batch_v1(p_batch_id);
  SELECT batch.* INTO v_batch FROM public.progressive_payment_batches batch
  WHERE batch.id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_BATCH_NOT_FOUND';
  END IF;
  IF v_batch.status <> 'prepared' OR v_batch.prepared_expires_at > public.task10_clock_v1() THEN
    RETURN public.progressive_payment_batch_result_v1(p_batch_id, true);
  END IF;
  RETURN public.cancel_progressive_prepared_batch_v1(p_batch_id, v_batch.user_id, 'prepared_expired');
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_progressive_batch_under_review_v1(
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
  PERFORM public.task10_begin_payment_batch_v1(p_batch_id);
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

CREATE OR REPLACE FUNCTION public.record_progressive_verification_attempt_v1(
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
  PERFORM public.task10_begin_payment_batch_v1(p_batch_id);
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

CREATE OR REPLACE FUNCTION public.resolve_progressive_verification_attempt_v1(
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
  PERFORM public.task10_begin_payment_batch_v1((SELECT payment_batch_id FROM public.progressive_payment_verification_attempts WHERE id=p_attempt_id));
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

CREATE OR REPLACE FUNCTION public.set_progressive_payment_lifecycle_metadata_v1()
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
    NEW.prepared_expires_at := coalesce(NEW.prepared_expires_at, public.task10_transaction_start_v1() + interval '30 minutes');
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'prepared' AND NEW.status <> 'prepared'
    AND OLD.prepared_expires_at <= public.task10_clock_v1()
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

-- Direct dependency of receipt/review and cancellation: retain the status tokens
-- already hashed by a frozen Legacy baseline across *proven*, entitlement-neutral
-- lifecycle transitions. Original baseline fields are never rewritten. Unknown
-- status changes or any quantity/expiry/identity drift still fail closed; only a
-- physical cancellation may append an entitlement delta.
CREATE TABLE public.task10_legacy_status_evidence (
  scope_id uuid NOT NULL REFERENCES public.booking_pricing_scopes(id),
  booking_id uuid NOT NULL REFERENCES public.bookings(id), revision bigint NOT NULL CHECK(revision>=1),
  before_status text NOT NULL CHECK(before_status IN ('pending_payment','paid','verified')),
  after_status text NOT NULL CHECK(after_status IN ('pending_payment','paid','verified')),
  identity_evidence jsonb NOT NULL, effective_baseline_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL, PRIMARY KEY(scope_id,booking_id,revision), CHECK(before_status<>after_status)
);
ALTER TABLE public.task10_legacy_status_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.task10_legacy_status_evidence FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.task10_legacy_status_evidence TO service_role;
CREATE TRIGGER task10_immutable BEFORE UPDATE OR DELETE ON public.task10_legacy_status_evidence
  FOR EACH ROW EXECUTE FUNCTION public.task10_immutable_evidence_v1();

CREATE FUNCTION public.task10_legacy_identity_v1(p_booking public.bookings) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp SET timezone='UTC' AS $$
  SELECT jsonb_build_object('userId',p_booking.user_id,'courseId',p_booking.course_type_id,'year',p_booking.year,'month',p_booking.month,
    'quantity',p_booking.total_sessions,'expiry',p_booking.expires_at,'createdAt',p_booking.created_at,'pricingScopeId',p_booking.pricing_scope_id)
$$;
CREATE FUNCTION public.task10_legacy_baseline_status_v1(p_booking public.bookings) RETURNS text
LANGUAGE plpgsql STABLE SET search_path=public,pg_temp AS $$
DECLARE v_scope uuid; v_first text; v_previous text; v_revision bigint:=0; e public.task10_legacy_status_evidence%ROWTYPE;
BEGIN
  SELECT id INTO v_scope FROM public.booking_pricing_scopes WHERE user_id=p_booking.user_id AND course_type_id=p_booking.course_type_id
    AND lesson_year=p_booking.year AND lesson_month=p_booking.month AND legacy_baseline_initialized_at IS NOT NULL;
  FOR e IN SELECT * FROM public.task10_legacy_status_evidence WHERE scope_id=v_scope AND booking_id=p_booking.id ORDER BY revision LOOP
    IF e.revision<>v_revision+1 OR (v_previous IS NOT NULL AND v_previous<>e.before_status)
      OR e.identity_evidence IS DISTINCT FROM public.task10_legacy_identity_v1(p_booking) THEN RAISE EXCEPTION 'PROGRESSIVE_LEGACY_BASELINE_DRIFT'; END IF;
    v_first:=coalesce(v_first,e.before_status);v_previous:=e.after_status;v_revision:=e.revision;
  END LOOP;
  IF v_previous IS NOT NULL AND v_previous IS DISTINCT FROM p_booking.status::text THEN RAISE EXCEPTION 'PROGRESSIVE_LEGACY_BASELINE_DRIFT'; END IF;
  RETURN coalesce(v_first,p_booking.status::text);
END $$;

CREATE FUNCTION public.task10_record_legacy_status_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_scope public.booking_pricing_scopes%ROWTYPE; v_effective jsonb; v_actual record; v_revision bigint;
BEGIN
  IF NOT public.task10_source_policy_established_v1() OR OLD.pricing_scope_id IS NOT NULL OR NEW.pricing_scope_id IS NOT NULL
    OR OLD.status IS NOT DISTINCT FROM NEW.status OR OLD.status::text NOT IN ('pending_payment','paid','verified')
    OR NEW.status::text NOT IN ('pending_payment','paid','verified') THEN RETURN NEW; END IF;
  SELECT * INTO v_scope FROM public.booking_pricing_scopes WHERE user_id=OLD.user_id AND course_type_id=OLD.course_type_id
    AND lesson_year=OLD.year AND lesson_month=OLD.month AND legacy_baseline_initialized_at IS NOT NULL;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF current_user NOT IN ('postgres','supabase_admin') OR current_setting('task10.payment_write',true) IS DISTINCT FROM 'authorized'
    OR public.task10_legacy_identity_v1(OLD) IS DISTINCT FROM public.task10_legacy_identity_v1(NEW)
    OR NOT public.task10_pending_pricing_active_v1(OLD.id) THEN RAISE EXCEPTION 'PROGRESSIVE_LEGACY_BASELINE_DRIFT'; END IF;
  v_effective:=public.task10_effective_scope_baseline_v1(v_scope.id);
  SELECT * INTO v_actual FROM public.progressive_legacy_baseline_v1(OLD.user_id,OLD.course_type_id,OLD.year,OLD.month);
  IF (v_effective->>'sessions')::integer IS DISTINCT FROM v_actual.baseline_sessions
    OR v_effective->>'fingerprint' IS DISTINCT FROM v_actual.baseline_fingerprint THEN RAISE EXCEPTION 'PROGRESSIVE_LEGACY_BASELINE_DRIFT'; END IF;
  SELECT coalesce(max(revision),0)+1 INTO v_revision FROM public.task10_legacy_status_evidence WHERE scope_id=v_scope.id AND booking_id=OLD.id;
  INSERT INTO public.task10_legacy_status_evidence(scope_id,booking_id,revision,before_status,after_status,identity_evidence,effective_baseline_fingerprint,created_at)
    VALUES(v_scope.id,OLD.id,v_revision,OLD.status::text,NEW.status::text,public.task10_legacy_identity_v1(OLD),v_actual.baseline_fingerprint,public.task10_clock_v1());
  RETURN NEW;
END $$;
CREATE TRIGGER task10_record_legacy_status BEFORE UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.task10_record_legacy_status_v1();
REVOKE ALL ON FUNCTION public.task10_legacy_identity_v1(public.bookings),public.task10_legacy_baseline_status_v1(public.bookings),
  public.task10_record_legacy_status_v1() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.progressive_legacy_baseline_v1(
  p_user_id uuid,
  p_course_type_id uuid,
  p_lesson_year integer,
  p_lesson_month integer
)
RETURNS TABLE (baseline_sessions integer, baseline_fingerprint text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_user_id IS NULL OR p_course_type_id IS NULL
    OR p_lesson_year IS NULL OR p_lesson_year < 2024
    OR p_lesson_month IS NULL OR p_lesson_month NOT BETWEEN 1 AND 12
    OR NOT EXISTS (
      SELECT 1 FROM public.course_types course
      WHERE course.id = p_course_type_id AND course.name::text = 'kids_group'
    )
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
  END IF;

  RETURN QUERY
  WITH eligible AS (
    SELECT
      booking.id,
      public.task10_legacy_baseline_status_v1(booking) AS status,
      booking.total_sessions,
      booking.expires_at
    FROM public.bookings booking
    WHERE booking.user_id = p_user_id
      AND booking.course_type_id = p_course_type_id
      AND booking.year = p_lesson_year
      AND booking.month = p_lesson_month
      AND booking.pricing_scope_id IS NULL
      AND booking.status::text IN ('pending_payment', 'paid', 'verified')
      AND (
        public.task10_pending_pricing_active_v1(booking.id)
      )
  ), serialized AS (
    SELECT
      coalesce(sum(eligible.total_sessions), 0)::integer AS sessions,
      coalesce(string_agg(
        eligible.id::text || '|' || eligible.status || '|'
          || eligible.total_sessions::text || '|'
          || coalesce(
            to_char(eligible.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
            'null'
          ),
        E'\n' ORDER BY eligible.id
      ), '') AS fingerprint_input
    FROM eligible
  )
  SELECT
    serialized.sessions,
    encode(extensions.digest(serialized.fingerprint_input, 'sha256'), 'hex')
  FROM serialized;
END;
$$;

CREATE OR REPLACE FUNCTION public.progressive_reprice_scope_v1(
  p_scope_id uuid,
  p_new_revision bigint,
  p_start_created_at timestamptz DEFAULT NULL,
  p_start_booking_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scope public.booking_pricing_scopes%ROWTYPE;
  v_booking record;
  v_tier record;
  v_sequence integer := 0;
  v_cumulative integer;
  v_entitlement integer;
  v_gross numeric(12, 2);
  v_discount numeric(12, 2);
  v_final numeric(12, 2);
  v_should_reprice boolean;
  v_changes jsonb := '[]'::jsonb;
BEGIN
  SELECT scope.* INTO v_scope
  FROM public.booking_pricing_scopes scope
  WHERE scope.id = p_scope_id;

  IF NOT FOUND OR v_scope.legacy_baseline_initialized_at IS NULL
    OR v_scope.legacy_baseline_sessions IS NULL
    OR v_scope.legacy_baseline_fingerprint IS NULL
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_LEGACY_BASELINE_DRIFT';
  END IF;

  v_cumulative := (public.task10_effective_scope_baseline_v1(p_scope_id)->>'sessions')::integer;

  FOR v_booking IN
    SELECT booking.*
    FROM public.bookings booking
    WHERE booking.pricing_scope_id = p_scope_id
      AND booking.status::text IN ('pending_payment', 'paid', 'verified')
      AND (
        public.task10_pending_pricing_active_v1(booking.id)
      )
    ORDER BY booking.created_at ASC, booking.id ASC
  LOOP
    v_entitlement := coalesce(v_booking.entitlement_sessions, v_booking.total_sessions);
    IF v_entitlement IS NULL OR v_entitlement <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_INVALID_REQUEST';
    END IF;

    v_sequence := v_sequence + 1;
    v_should_reprice := v_booking.status::text = 'pending_payment'
      AND (
        p_start_created_at IS NULL
        OR (v_booking.created_at, v_booking.id) >= (p_start_created_at, p_start_booking_id)
      );

    IF v_should_reprice THEN
      SELECT * INTO v_tier FROM public.task10_booking_tier_v1(v_booking.id,v_cumulative+v_entitlement);

      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROGRESSIVE_MISSING_TIER';
      END IF;

      v_gross := round((v_entitlement * v_tier.price_per_session)::numeric, 2);
      SELECT calculated.discount_amount, calculated.final_price
      INTO v_discount, v_final
      FROM public.recalculate_progressive_coupon_discount_v1(
        v_booking.id, v_gross, p_new_revision
      ) calculated;

      IF round(v_booking.total_price::numeric, 2) IS DISTINCT FROM v_final THEN
        v_changes := v_changes || jsonb_build_array(jsonb_build_object(
          'bookingId', v_booking.id,
          'oldPrice', round(v_booking.total_price::numeric, 2),
          'newPrice', v_final
        ));
      END IF;

      UPDATE public.bookings
      SET
        entitlement_sessions = v_entitlement,
        pricing_sequence = v_sequence,
        cumulative_sessions_before = v_cumulative,
        cumulative_sessions_after = v_cumulative + v_entitlement,
        pricing_tier_id_snapshot = v_tier.id,
        pricing_rate_snapshot = v_tier.price_per_session,
        gross_price_snapshot = v_gross,
        coupon_discount_snapshot = v_discount,
        final_price_snapshot = v_final,
        pricing_revision = p_new_revision,
        pricing_calculated_at = transaction_timestamp(),
        total_price = v_final
      WHERE id = v_booking.id
        AND pricing_scope_id = p_scope_id;
    END IF;

    v_cumulative := v_cumulative + v_entitlement;
  END LOOP;

  IF current_setting('task10.defer_calculation_record',true) IS DISTINCT FROM 'yes' THEN
    PERFORM public.task10_record_scope_calculations_v1(p_scope_id,p_new_revision);
  END IF;
  RETURN v_changes;
END;
$$;

CREATE OR REPLACE FUNCTION public.progressive_payment_member_fingerprint_v1(p_booking_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN evidence.booking_id IS NULL THEN md5(concat_ws('|',
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
  )) ELSE encode(extensions.digest(md5(concat_ws('|',
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
  )) || '|' || evidence.fingerprint || '|' || evidence.evidence::text,'sha256'),'hex') END
  FROM public.bookings booking
  LEFT JOIN public.task10_booking_pricing_evidence evidence ON evidence.booking_id=booking.id
  LEFT JOIN public.progressive_coupon_reservations reservation
    ON reservation.booking_id = booking.id
  WHERE booking.id = p_booking_id;
$$;
-- Existing Legacy writes enter one transaction even before cutover. Compatibility
-- keeps its original price/coupon rules; the activation lock spans the whole write.
CREATE TABLE public.task10_legacy_booking_mutations (
  user_id uuid NOT NULL REFERENCES public.profiles(id), request_id uuid NOT NULL,
  fingerprint text NOT NULL, booking_id uuid NOT NULL REFERENCES public.bookings(id), result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(user_id,request_id)
);
ALTER TABLE public.task10_legacy_booking_mutations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.task10_legacy_booking_mutations FROM anon,authenticated,service_role;
GRANT SELECT ON public.task10_legacy_booking_mutations TO service_role;
CREATE TRIGGER task10_legacy_booking_mutations_immutable BEFORE UPDATE OR DELETE ON public.task10_legacy_booking_mutations
  FOR EACH ROW EXECUTE FUNCTION public.task10_immutable_evidence_v1();

CREATE FUNCTION public.task10_legacy_price_v1(p_user uuid,p_course uuid,p_month integer,p_year integer,p_quantity integer,p_booking uuid DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_name text; v_tiers jsonb; v_tier jsonb; v_policy jsonb; v_quantity integer:=p_quantity; v_paid numeric:=0;
  v_day date:=(public.task10_clock_v1() AT TIME ZONE 'UTC')::date;
BEGIN
  SELECT name::text INTO v_name FROM public.course_types WHERE id=p_course;
  IF v_name IS NULL OR p_quantity IS NULL OR p_quantity<1 THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
  -- A table SHARE lock also prevents a new effective-tier phantom during calculation.
  LOCK TABLE public.pricing_tiers IN SHARE MODE;
  SELECT jsonb_agg(jsonb_build_object('min',min_sessions,'max',max_sessions,'rate',price_per_session,'package',package_price)
    ORDER BY min_sessions,id) INTO v_tiers FROM public.pricing_tiers WHERE course_type_id=p_course
    AND (valid_from IS NULL OR valid_from<=v_day) AND (valid_to IS NULL OR valid_to>=v_day);
  IF v_name='kids_group' THEN
    v_policy:=public.task10_booking_policy_quote_v1(p_user,p_course,make_date(p_year,p_month,1),'legacy',p_booking);
    IF v_policy->'catalog' IS NOT NULL AND v_policy->'catalog'<>'null'::jsonb THEN
      SELECT jsonb_agg(jsonb_build_object('min',(x->>'minSessions')::integer,'max',(x->>'maxSessions')::integer,'rate',(x->>'ratePerSession')::numeric)
        ORDER BY (x->>'minSessions')::integer) INTO v_tiers FROM jsonb_array_elements(v_policy->'catalog'->'tiers') x;
    END IF;
    SELECT p_quantity+coalesce(sum(total_sessions),0),coalesce(sum(total_price),0) INTO v_quantity,v_paid FROM public.bookings
      WHERE user_id=p_user AND course_type_id=p_course AND month=p_month AND year=p_year AND status::text IN ('paid','verified')
        AND (p_booking IS NULL OR id<>p_booking);
    v_tiers:=coalesce(v_tiers,'[{"min":1,"max":1,"rate":700},{"min":2,"max":6,"rate":625},{"min":7,"max":10,"rate":500},{"min":11,"max":14,"rate":433},{"min":15,"max":18,"rate":406},{"min":19,"max":null,"rate":350}]'::jsonb);
    SELECT x INTO v_tier FROM jsonb_array_elements(v_tiers) x WHERE (x->>'min')::integer<=v_quantity
      AND (x->>'max' IS NULL OR (x->>'max')::integer>=v_quantity) LIMIT 1;
    v_tier:=coalesce(v_tier,v_tiers->(jsonb_array_length(v_tiers)-1));
    RETURN greatest(0,round(v_quantity*(v_tier->>'rate')::numeric)-greatest(0,round(v_paid)));
  END IF;
  IF v_name='adult_group' THEN
    v_tiers:=coalesce(v_tiers,'[{"min":1,"rate":600,"package":600},{"min":10,"rate":550,"package":5500},{"min":16,"rate":500,"package":8000}]'::jsonb);
  ELSIF v_name='private' THEN
    v_tiers:=coalesce(v_tiers,'[{"min":1,"rate":900,"package":900},{"min":10,"rate":800,"package":8000}]'::jsonb);
  ELSE RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
  SELECT x INTO v_tier FROM jsonb_array_elements(v_tiers) x WHERE (x->>'min')::integer<=v_quantity ORDER BY (x->>'min')::integer DESC LIMIT 1;
  v_tier:=coalesce(v_tier,v_tiers->0);
  RETURN CASE WHEN (v_tier->>'min')::integer=1 THEN round(v_quantity*(v_tier->>'rate')::numeric) ELSE (v_tier->>'package')::numeric END;
END $$;

CREATE FUNCTION public.task10_cancel_legacy_booking_v1(p_booking uuid,p_actor uuid,p_reason text) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_book public.bookings%ROWTYPE; v_scope public.booking_pricing_scopes%ROWTYPE; v_effective jsonb;
  v_before record; v_after record; v_slots uuid[]; v_time timestamptz; v_revision bigint;
BEGIN
  IF p_reason NOT IN ('user_cancelled_pending','admin_payment_cancelled') THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
  PERFORM public.task10_lock_booking_set_v1(ARRAY[p_booking]);
  SELECT * INTO v_book FROM public.bookings WHERE id=p_booking;
  IF v_book.pricing_scope_id IS NOT NULL OR v_book.status::text NOT IN ('pending_payment','paid') THEN RAISE EXCEPTION 'TASK10_BOOKING_STATE_CONFLICT'; END IF;
  SELECT * INTO v_scope FROM public.booking_pricing_scopes WHERE user_id=v_book.user_id AND course_type_id=v_book.course_type_id
    AND lesson_year=v_book.year AND lesson_month=v_book.month;
  IF v_scope.legacy_baseline_initialized_at IS NOT NULL THEN
    v_effective:=public.task10_effective_scope_baseline_v1(v_scope.id);
    SELECT * INTO v_before FROM public.progressive_legacy_baseline_v1(v_book.user_id,v_book.course_type_id,v_book.year,v_book.month);
    IF (v_effective->>'sessions')::integer IS DISTINCT FROM v_before.baseline_sessions OR v_effective->>'fingerprint' IS DISTINCT FROM v_before.baseline_fingerprint
      THEN RAISE EXCEPTION 'PROGRESSIVE_LEGACY_BASELINE_DRIFT'; END IF;
  END IF;
  IF v_scope.locked_by_payment_batch_id IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM public.progressive_payment_batches WHERE id=v_scope.locked_by_payment_batch_id AND status<>'prepared') THEN RAISE EXCEPTION 'TASK10_BATCH_REVIEW_CONFLICT'; END IF;
    PERFORM public.cancel_progressive_prepared_batch_v1(v_scope.locked_by_payment_batch_id,v_book.user_id,'legacy_booking_cancelled');
  END IF;
  v_time:=public.task10_clock_v1();
  SELECT array_agg(DISTINCT schedule_slot_id ORDER BY schedule_slot_id) INTO v_slots FROM public.booking_sessions WHERE booking_id=p_booking AND schedule_slot_id IS NOT NULL;
  INSERT INTO public.task10_booking_cancellations(booking_id,cancelled_at,deadline,effective_at,reason,evidence)
    VALUES(p_booking,v_time,public.task10_booking_deadline_v1(p_booking),(SELECT effective_at FROM public.task10_policy_activation),p_reason,
      jsonb_build_object('actorId',p_actor,'bookingBefore',to_jsonb(v_book),'sessionIds',(SELECT jsonb_agg(id ORDER BY id) FROM public.booking_sessions WHERE booking_id=p_booking)));
  UPDATE public.bookings SET status='cancelled' WHERE id=p_booking;
  UPDATE public.booking_sessions SET cancelled_at=coalesce(cancelled_at,v_time) WHERE booking_id=p_booking;
  IF v_scope.legacy_baseline_initialized_at IS NOT NULL THEN
    SELECT * INTO v_after FROM public.progressive_legacy_baseline_v1(v_book.user_id,v_book.course_type_id,v_book.year,v_book.month);
    IF v_before.baseline_sessions<>v_after.baseline_sessions THEN
      IF v_before.baseline_sessions-v_after.baseline_sessions<>v_book.total_sessions THEN RAISE EXCEPTION 'PROGRESSIVE_LEGACY_BASELINE_DRIFT'; END IF;
      INSERT INTO public.task10_legacy_baseline_deltas(scope_id,booking_id,revision,entitlement_delta,previous_fingerprint,next_fingerprint,evidence)
        VALUES(v_scope.id,p_booking,(v_effective->>'deltaRevision')::bigint+1,-v_book.total_sessions,v_before.baseline_fingerprint,v_after.baseline_fingerprint,
          jsonb_build_object('cancellationAt',v_time,'reason',p_reason,'beforeQuantity',v_before.baseline_sessions,'afterQuantity',v_after.baseline_sessions));
    ELSIF v_before.baseline_fingerprint IS DISTINCT FROM v_after.baseline_fingerprint THEN RAISE EXCEPTION 'PROGRESSIVE_LEGACY_BASELINE_DRIFT'; END IF;
  END IF;
  IF v_scope.id IS NOT NULL THEN
    UPDATE public.booking_pricing_scopes SET revision=revision+1 WHERE id=v_scope.id RETURNING revision INTO v_revision;
    PERFORM public.progressive_reprice_scope_v1(v_scope.id,v_revision,NULL,NULL);
  END IF;
  PERFORM public.progressive_refresh_slot_capacity_v1(v_slots);
END $$;

CREATE FUNCTION public.task10_write_legacy_booking_v1(p_user_id uuid,p_action text,p_request_id uuid,p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_old public.bookings%ROWTYPE; v_book public.bookings%ROWTYPE; v_prior public.task10_legacy_booking_mutations%ROWTYPE;
  v_id uuid:=(p_input->>'bookingId')::uuid; v_course uuid:=(p_input->>'courseTypeId')::uuid; v_branch uuid:=(p_input->>'branchId')::uuid;
  v_month integer:=(p_input->>'month')::integer; v_year integer:=(p_input->>'year')::integer; v_quantity integer:=(p_input->>'totalSessions')::integer;
  v_learner public.learner_type; v_child uuid; v_name text; v_scopes jsonb; v_sessions jsonb:=p_input->'sessions'; v_fingerprint text;
  v_gross numeric; v_discount numeric:=0; v_final numeric; v_coupon public.coupons%ROWTYPE; v_policy jsonb;
  v_date date; v_start time; v_end time; v_template uuid; v_slot uuid; v_slots uuid[]; v_count integer; r jsonb; v_result jsonb; v_active boolean;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1);
  PERFORM pg_advisory_xact_lock_shared(10,2);
  PERFORM pg_advisory_xact_lock_shared(10,3);
  IF p_user_id IS NULL OR p_request_id IS NULL OR p_action IS NULL OR p_action NOT IN ('create','update','cancel')
    OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user_id) THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
  -- One user's replay key precedes its family locks; all Legacy requests use it.
  PERFORM pg_advisory_xact_lock(hashtextextended('task10-legacy-request|'||p_user_id::text||'|'||p_request_id::text,0));
  v_fingerprint:=encode(extensions.digest(concat_ws('|',p_action,p_input::text),'sha256'),'hex');
  SELECT * INTO v_prior FROM public.task10_legacy_booking_mutations WHERE user_id=p_user_id AND request_id=p_request_id;
  IF FOUND THEN
    IF v_prior.fingerprint<>v_fingerprint THEN RAISE EXCEPTION 'TASK10_IDEMPOTENCY_CONFLICT'; END IF;
    RETURN v_prior.result||jsonb_build_object('idempotentReplay',true);
  END IF;
  IF p_action<>'create' THEN
    SELECT * INTO v_old FROM public.bookings WHERE id=v_id AND user_id=p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'TASK10_UNAUTHORIZED'; END IF;
    IF v_old.pricing_scope_id IS NOT NULL THEN RAISE EXCEPTION 'TASK10_BOOKING_STATE_CONFLICT'; END IF;
    IF p_action='cancel' THEN v_course:=v_old.course_type_id;v_year:=v_old.year;v_month:=v_old.month; END IF;
  END IF;
  v_scopes:=jsonb_build_array(jsonb_build_object('user_id',p_user_id,'course_type_id',v_course,'year',v_year,'month',v_month));
  IF p_action<>'create' THEN v_scopes:=v_scopes||jsonb_build_array(jsonb_build_object('user_id',p_user_id,'course_type_id',v_old.course_type_id,'year',v_old.year,'month',v_old.month)); END IF;
  PERFORM public.task10_lock_scopes_v1(v_scopes);
  IF p_action<>'create' THEN
    SELECT * INTO v_old FROM public.bookings WHERE id=v_id AND user_id=p_user_id;
    IF v_old.status::text<>'pending_payment' OR v_old.course_type_id<>v_course THEN RAISE EXCEPTION 'TASK10_BOOKING_STATE_CONFLICT'; END IF;
    IF public.task10_booking_due_v1(v_id) THEN RAISE EXCEPTION 'TASK10_BOOKING_DEADLINE'; END IF;
  END IF;
  v_active:=public.task10_source_policy_established_v1();
  IF p_action='cancel' THEN
    PERFORM public.task10_cancel_legacy_booking_v1(v_id,p_user_id,'user_cancelled_pending');
    v_result:=jsonb_build_object('success',true,'bookingId',v_id,'status','cancelled');
  ELSE
    SELECT name::text INTO v_name FROM public.course_types WHERE id=v_course;
    IF v_name IS NULL OR jsonb_typeof(v_sessions) IS DISTINCT FROM 'array' OR jsonb_array_length(v_sessions)=0
      OR v_quantity IS NULL OR v_quantity<1 OR v_branch IS NULL OR NOT EXISTS(SELECT 1 FROM public.branches WHERE id=v_branch AND is_active)
      THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
    IF v_active AND p_action='create' AND v_name='kids_group' THEN RAISE EXCEPTION 'TASK10_PROGRESSIVE_ENTRY_REQUIRED'; END IF;
    IF v_active THEN PERFORM public.task10_assert_scope_current_v1(p_user_id,v_course,v_year,v_month); END IF;
    v_learner:=CASE WHEN p_action='create' THEN (p_input->>'learnerType')::public.learner_type ELSE v_old.learner_type END;
    v_child:=CASE WHEN p_action='create' THEN (p_input->>'childId')::uuid ELSE v_old.child_id END;
    IF v_learner IS NULL OR (v_child IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.children WHERE id=v_child AND parent_id=p_user_id)) THEN RAISE EXCEPTION 'TASK10_UNAUTHORIZED'; END IF;
    IF p_action='update' AND EXISTS(SELECT 1 FROM public.bookings b JOIN public.booking_pricing_scopes sc ON sc.user_id=b.user_id AND sc.course_type_id=b.course_type_id
      AND sc.lesson_year=b.year AND sc.lesson_month=b.month WHERE b.id=v_id AND sc.legacy_baseline_initialized_at IS NOT NULL
      AND ROW(b.total_sessions,b.year,b.month) IS DISTINCT FROM ROW(v_quantity,v_year,v_month)) THEN RAISE EXCEPTION 'PROGRESSIVE_LEGACY_BASELINE_DRIFT'; END IF;
    IF p_action='update' AND (EXISTS(SELECT 1 FROM public.payments WHERE booking_id=v_id AND status::text IN ('pending','approved'))
      OR EXISTS(SELECT 1 FROM public.booking_sessions s LEFT JOIN public.attendance a ON a.booking_session_id=s.id
        WHERE s.booking_id=v_id AND (s.status::text<>'scheduled' OR s.is_makeup OR a.id IS NOT NULL))) THEN RAISE EXCEPTION 'TASK10_BOOKING_STATE_CONFLICT'; END IF;
    IF v_name='private' THEN
      SELECT count(DISTINCT (x->>'date',x->>'startTime',x->>'endTime',x->>'branchId')) INTO v_count FROM jsonb_array_elements(v_sessions) x;
      IF EXISTS(SELECT 1 FROM (SELECT coalesce(x->>'childId','self') AS learner,count(*) AS n FROM jsonb_array_elements(v_sessions) x GROUP BY 1) participants WHERE n<>v_count)
        THEN RAISE EXCEPTION 'TASK10_FAMILY_PARTICIPANTS_CONFLICT'; END IF;
    ELSE v_count:=jsonb_array_length(v_sessions); END IF;
    IF v_count<>v_quantity THEN RAISE EXCEPTION 'TASK10_INVALID_QUANTITY'; END IF;
    -- Read the same tier/package formulas as pricing.ts, after all aggregate locks.
    v_gross:=public.task10_legacy_price_v1(p_user_id,v_course,v_month,v_year,v_quantity,CASE WHEN p_action='update' THEN v_id ELSE NULL END);
    IF (p_input->>'totalAmount')::numeric IS NULL OR abs(v_gross-(p_input->>'totalAmount')::numeric)>1 THEN RAISE EXCEPTION 'TASK10_AMOUNT_CONFLICT'; END IF;
    IF p_action='create' AND v_gross>0 AND (p_input->'coupon'->>'id' IS NOT NULL OR nullif(trim(p_input->'coupon'->>'code'),'') IS NOT NULL) THEN
      SELECT * INTO v_coupon FROM public.coupons WHERE (p_input->'coupon'->>'id' IS NULL OR id=(p_input->'coupon'->>'id')::uuid)
        AND (nullif(trim(p_input->'coupon'->>'code'),'') IS NULL OR code=upper(trim(p_input->'coupon'->>'code'))) FOR UPDATE;
      IF NOT FOUND OR NOT v_coupon.is_active OR (v_coupon.valid_from IS NOT NULL AND v_coupon.valid_from>(public.task10_clock_v1() AT TIME ZONE 'UTC')::date)
        OR (v_coupon.valid_to IS NOT NULL AND v_coupon.valid_to<(public.task10_clock_v1() AT TIME ZONE 'UTC')::date)
        OR (v_coupon.max_uses IS NOT NULL AND v_coupon.current_uses>=v_coupon.max_uses) OR v_gross<coalesce(v_coupon.min_purchase,0)
        OR EXISTS(SELECT 1 FROM public.coupon_usages WHERE coupon_id=v_coupon.id AND user_id=p_user_id) THEN RAISE EXCEPTION 'TASK10_COUPON_CONFLICT'; END IF;
      v_discount:=CASE WHEN v_coupon.discount_type::text='fixed' THEN least(v_coupon.discount_value,v_gross)
        WHEN v_coupon.discount_type::text='percent' THEN round(v_gross*v_coupon.discount_value/100) ELSE 0 END;
    END IF;
    v_final:=greatest(0,v_gross-v_discount);
    IF (p_input->>'expectedTotalPrice')::numeric IS NULL OR abs(v_final-(p_input->>'expectedTotalPrice')::numeric)>1 THEN RAISE EXCEPTION 'TASK10_AMOUNT_CONFLICT'; END IF;
    IF p_action='create' THEN
      INSERT INTO public.bookings(user_id,learner_type,child_id,branch_id,course_type_id,month,year,total_sessions,total_price,status)
        VALUES(p_user_id,v_learner,v_child,v_branch,v_course,v_month,v_year,v_quantity,v_final,
          CASE WHEN v_name='kids_group' AND v_gross=0 THEN 'verified'::public.booking_status ELSE 'pending_payment'::public.booking_status END) RETURNING * INTO v_book;
      v_id:=v_book.id;
    ELSE
      SELECT array_agg(DISTINCT schedule_slot_id ORDER BY schedule_slot_id) INTO v_slots FROM public.booking_sessions WHERE booking_id=v_id;
      DELETE FROM public.booking_sessions WHERE booking_id=v_id;
      UPDATE public.bookings SET branch_id=v_branch,month=v_month,year=v_year,total_sessions=v_quantity,total_price=v_final,
        status=CASE WHEN v_name='kids_group' AND v_gross=0 THEN 'verified'::public.booking_status ELSE 'pending_payment'::public.booking_status END
        WHERE id=v_id RETURNING * INTO v_book;
    END IF;
    FOR r IN SELECT x FROM jsonb_array_elements(v_sessions) x ORDER BY x->>'branchId',x->>'date',x->>'startTime',x->>'childId' LOOP
      v_date:=(r->>'date')::date; v_start:=(r->>'startTime')::time;v_end:=(r->>'endTime')::time;
      IF extract(year FROM v_date)<>v_year OR extract(month FROM v_date)<>v_month OR (v_learner::text='child' AND r->>'childId' IS NULL)
        OR (v_learner::text='child' AND v_child IS NOT NULL AND v_child<>(r->>'childId')::uuid)
        OR (r->>'childId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.children WHERE id=(r->>'childId')::uuid AND parent_id=p_user_id)) THEN RAISE EXCEPTION 'TASK10_INVALID_LEARNER'; END IF;
      -- Earlier inserts in this same transaction also enforce duplicate/overlap.
      IF EXISTS(SELECT 1 FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id WHERE b.user_id=p_user_id
        AND b.status::text IN ('pending_payment','paid','verified') AND s.status::text IN ('scheduled','completed','absent') AND s.cancelled_at IS NULL
        AND s.child_id IS NOT DISTINCT FROM (r->>'childId')::uuid AND s.date=v_date AND s.start_time<v_end AND s.end_time>v_start)
        THEN RAISE EXCEPTION 'TASK10_DUPLICATE_SESSION'; END IF;
      SELECT id INTO v_template FROM public.schedule_templates WHERE branch_id=(r->>'branchId')::uuid AND course_type_id=v_course
        AND day_of_week=extract(dow FROM v_date) AND start_time=v_start AND end_time=v_end AND is_active
        AND (r->>'scheduleTemplateId' IS NULL OR id=(r->>'scheduleTemplateId')::uuid) ORDER BY id LIMIT 1;
      v_slot:=public.task10_target_slot_v1(v_course,v_template,(r->>'branchId')::uuid,v_date,v_start,v_end);
      INSERT INTO public.booking_sessions(booking_id,date,start_time,end_time,branch_id,child_id,schedule_slot_id,status,is_makeup)
        VALUES(v_id,v_date,v_start,v_end,(r->>'branchId')::uuid,(r->>'childId')::uuid,v_slot,'scheduled',false);
      v_slots:=array_append(v_slots,v_slot);
    END LOOP;
    IF v_coupon.id IS NOT NULL THEN
      INSERT INTO public.coupon_usages(coupon_id,user_id,booking_id,discount_amount) VALUES(v_coupon.id,p_user_id,v_id,v_discount);
      UPDATE public.coupons SET current_uses=current_uses+1,is_active=CASE WHEN max_uses IS NOT NULL AND current_uses+1>=max_uses THEN false ELSE is_active END WHERE id=v_coupon.id;
    END IF;
    PERFORM public.progressive_refresh_slot_capacity_v1(v_slots);
    v_result:=jsonb_build_object('success',true,'bookingId',v_id,'totalPrice',v_final,'status',v_book.status);
    IF p_action='create' THEN
      INSERT INTO public.notifications(user_id,title,message,type,link_url) VALUES(p_user_id,
        CASE WHEN v_book.status::text='verified' THEN 'สร้างการจองสำเร็จ' ELSE 'สร้างการจองแล้ว รอแนบสลิป' END,
        'สร้างการจอง '||v_quantity||' ครั้ง ยอดชำระ ฿'||v_final,'payment','/dashboard/history');
      INSERT INTO public.notifications(user_id,title,message,type,link_url)
        SELECT id,'มีการจองใหม่','สร้างการจองใหม่ '||v_quantity||' ครั้ง ยอดชำระ ฿'||v_final,'schedule','/admin/notifications'
        FROM public.profiles WHERE role::text IN ('admin','super_admin');
    END IF;
  END IF;
  INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details)
    VALUES(p_user_id,CASE p_action WHEN 'create' THEN 'create_booking' WHEN 'update' THEN 'update_pending_booking_sessions' ELSE 'cancel_pending_booking' END,'booking',v_id,
      v_result||jsonb_build_object('requestId',p_request_id,'settledStatuses',jsonb_build_array('paid','verified')));
  INSERT INTO public.task10_legacy_booking_mutations(user_id,request_id,fingerprint,booking_id,result) VALUES(p_user_id,p_request_id,v_fingerprint,v_id,v_result);
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.task10_legacy_price_v1(uuid,uuid,integer,integer,integer,uuid),
  public.task10_cancel_legacy_booking_v1(uuid,uuid,text),public.task10_write_legacy_booking_v1(uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.task10_write_legacy_booking_v1(uuid,text,uuid,jsonb) TO service_role;

COMMIT;
