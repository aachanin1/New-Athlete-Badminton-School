BEGIN;
-- Redeemed history must not reserve a calendar tuple forever. Exact source/member
-- uniqueness remains; only the currently active Family unit is exclusive.
DROP INDEX public.idx_lesson_wallet_family_private_unit;
CREATE UNIQUE INDEX idx_lesson_wallet_family_private_unit ON public.lesson_wallet_credits
  (booking_id,original_date,original_start_time,original_end_time,branch_id,original_schedule_slot_id)
  WHERE entitlement_unit_type='family_private' AND status='active';

CREATE FUNCTION public.lesson_source_guard_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_guard boolean:=true; v_booking uuid; v_payment boolean;
BEGIN
  IF current_user IN ('postgres','supabase_admin') AND current_setting('lesson_source.write',true)='authorized' THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
  END IF;
  v_payment:=current_user IN ('postgres','supabase_admin') AND current_setting('task10.source_write',true)='authorized'
    AND (current_setting('task10.payment_write',true)='authorized' OR current_setting('task10.booking_write',true)='authorized');
  IF TG_TABLE_NAME='booking_sessions' THEN
    IF TG_OP='INSERT' THEN
      -- New entitlement is created only by the existing Booking transaction.
      v_guard:=NEW.rescheduled_from_id IS NOT NULL OR NEW.is_makeup OR NEW.status::text IN ('walleted','rescheduled')
        OR NOT v_payment;
    ELSIF TG_OP='DELETE' THEN
      v_guard:=OLD.rescheduled_from_id IS NOT NULL OR OLD.is_makeup OR OLD.status::text IN ('walleted','rescheduled') OR NOT v_payment;
    ELSE
      v_guard:=ROW(NEW.booking_id,NEW.child_id,NEW.is_makeup,NEW.rescheduled_from_id,NEW.date,NEW.start_time,NEW.end_time,NEW.branch_id,NEW.schedule_slot_id)
        IS DISTINCT FROM ROW(OLD.booking_id,OLD.child_id,OLD.is_makeup,OLD.rescheduled_from_id,OLD.date,OLD.start_time,OLD.end_time,OLD.branch_id,OLD.schedule_slot_id)
        OR (NEW.status IS DISTINCT FROM OLD.status AND (NEW.status::text IN ('walleted','rescheduled') OR OLD.status::text IN ('walleted','rescheduled')))
        OR (OLD.cancelled_at IS NOT NULL AND NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at);
      -- Existing pending Booking edit/cancellation transactions remain authorized;
      -- they cannot repurpose lineage or reopen a spent source.
      IF v_payment AND OLD.rescheduled_from_id IS NULL AND NOT OLD.is_makeup AND OLD.status::text NOT IN ('walleted','rescheduled')
        AND NEW.rescheduled_from_id IS NULL AND NOT NEW.is_makeup AND NEW.status::text NOT IN ('walleted','rescheduled')
        AND EXISTS(SELECT 1 FROM public.bookings WHERE id=OLD.booking_id AND status::text IN ('pending_payment','cancelled')) THEN v_guard:=false; END IF;
    END IF;
  ELSIF TG_TABLE_NAME='lesson_wallet_credits' THEN
    -- Expiry may close an unchanged active credit, never reopen or extend it.
    IF TG_OP='UPDATE' THEN
      v_guard:=NOT(OLD.status='active' AND NEW.status='expired' AND NEW.expires_at<clock_timestamp()
        AND (to_jsonb(NEW)-'status'-'updated_at')=(to_jsonb(OLD)-'status'-'updated_at'));
    END IF;
  END IF;
  IF v_guard THEN RAISE EXCEPTION 'LESSON_SOURCE_GUARDED_WRITE'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.lesson_source_guard_v1() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER lesson_source_session_guard BEFORE INSERT OR UPDATE OR DELETE ON public.booking_sessions
  FOR EACH ROW EXECUTE FUNCTION public.lesson_source_guard_v1();
CREATE TRIGGER lesson_source_credit_guard BEFORE INSERT OR UPDATE OR DELETE ON public.lesson_wallet_credits
  FOR EACH ROW EXECUTE FUNCTION public.lesson_source_guard_v1();
CREATE TRIGGER lesson_source_member_guard BEFORE INSERT OR UPDATE OR DELETE ON public.lesson_wallet_credit_members
  FOR EACH ROW EXECUTE FUNCTION public.lesson_source_guard_v1();

-- Statement admission precedes Attendance UPDATE tuple/speculative upsert locks.
-- Existing retrospective RPCs may already hold slot/session/booking locks: never
-- wait here behind a transition that might need those rows. Abort the whole RPC
-- with a retryable conflict instead. Concurrent valid attendance shares this lock.
CREATE FUNCTION public.lesson_source_attendance_admission_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT pg_try_advisory_xact_lock_shared(hashtextextended('lesson-source-attendance-admission-v1',0)) THEN
    RAISE EXCEPTION USING ERRCODE='55P03', MESSAGE='LESSON_SOURCE_ATTENDANCE_RETRY';
  END IF;
  RETURN NULL;
END $$;

CREATE FUNCTION public.lesson_source_attendance_guard_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_booking uuid; s record;
BEGIN
  SELECT booking_id INTO v_booking FROM public.booking_sessions WHERE id=NEW.booking_session_id;
  -- No wait after an Attendance tuple is held. Normal Booking/cancellation and
  -- retrospective transactions have existing row orders outside this contract.
  PERFORM 1 FROM public.bookings WHERE id=v_booking FOR SHARE NOWAIT;
  PERFORM 1 FROM public.booking_sessions WHERE id=NEW.booking_session_id FOR SHARE NOWAIT;
  SELECT bs.*,b.user_id,b.status::text AS booking_status INTO s
    FROM public.booking_sessions bs JOIN public.bookings b ON b.id=bs.booking_id
    WHERE bs.id=NEW.booking_session_id;
  IF NOT FOUND OR s.booking_id IS DISTINCT FROM v_booking
    OR s.booking_status='cancelled' OR s.cancelled_at IS NOT NULL
    OR s.status::text IN ('walleted','rescheduled','cancelled') THEN
    RAISE EXCEPTION 'LESSON_SOURCE_ATTENDANCE_STALE';
  END IF;
  IF NEW.student_id IS DISTINCT FROM coalesce(s.child_id,s.user_id)
    OR NEW.student_type::text IS DISTINCT FROM (CASE WHEN s.child_id IS NULL THEN 'adult' ELSE 'child' END)
    OR (s.child_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.children WHERE id=s.child_id AND parent_id=s.user_id)) THEN
    RAISE EXCEPTION 'LESSON_SOURCE_ATTENDANCE_IDENTITY_CONFLICT';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.lesson_source_attendance_admission_v1(),public.lesson_source_attendance_guard_v1()
  FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER lesson_source_attendance_admission BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH STATEMENT EXECUTE FUNCTION public.lesson_source_attendance_admission_v1();
CREATE TRIGGER lesson_source_attendance_guard BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.lesson_source_attendance_guard_v1();
NOTIFY pgrst,'reload schema';
COMMIT;
