-- The Kids fallback-approval trigger must not resolve a Family Private lineage
-- through the single-learner Kids root function on a later re-wallet redemption.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(10,1);
DO $$ BEGIN
 IF md5(replace(pg_get_functiondef('public.admin_makeup_credit_close_v1()'::regprocedure),chr(13)||chr(10),chr(10)))<>'2fc244a0714df8bb76d6698eb6097e7b' THEN
  RAISE EXCEPTION 'NO_CLASS_RETURN_CREDIT_CLOSE_BASELINE_DRIFT';END IF;
END $$;
CREATE OR REPLACE FUNCTION public.admin_makeup_credit_close_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='lesson_wallet_credits' THEN
  IF NOT EXISTS(SELECT 1 FROM public.course_types WHERE id=NEW.course_type_id AND name::text='kids_group') THEN RETURN NEW;END IF;
  IF NEW.redeemed_session_id IS NOT NULL THEN
   UPDATE public.admin_makeup_credit_approvals SET status='consumed',closed_at=public.task10_clock_v1(),used_mode='wallet',destination_session_id=NEW.redeemed_session_id
    WHERE source_root_id=public.task10_source_root_v1(NEW.original_session_id) AND status='approved';
  END IF;
 ELSE
  UPDATE public.admin_makeup_credit_approvals SET status='consumed',closed_at=NEW.created_at,
   used_mode=CASE WHEN coalesce((NEW.decision_evidence->>'remaining')::integer,0)>0 THEN 'normal' ELSE 'exception' END,
   destination_session_id=NEW.destination_session_id WHERE source_root_id=NEW.source_root_id AND status='approved';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.admin_makeup_credit_close_v1() FROM PUBLIC,anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
