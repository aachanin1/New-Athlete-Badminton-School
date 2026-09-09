-- Inert scheduler and explicit, database-owner-only cutover controls.
-- Applying this file never sets effective_at, enables a control, or cancels a bill.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE public.task10_activation_events (
  revision bigint PRIMARY KEY, actor_id uuid NOT NULL REFERENCES public.profiles(id),
  state text NOT NULL CHECK(state IN ('active','paused')), effective_at timestamptz NOT NULL,
  manifest jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.task10_activation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.task10_activation_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.task10_activation_events TO service_role;
CREATE TRIGGER task10_immutable BEFORE UPDATE OR DELETE ON public.task10_activation_events
  FOR EACH ROW EXECUTE FUNCTION public.task10_immutable_evidence_v1();

CREATE FUNCTION public.task10_run_expiry_v1(p_limit integer DEFAULT 50) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_run uuid; v_started timestamptz:=clock_timestamp(); v_ids uuid[]; v_ready uuid[]:='{}'; v_keys text[]:='{}';
  r record; b uuid; v_key text; v_result jsonb; v_attempted integer:=0; v_cancelled integer:=0; v_skipped jsonb:='[]'; v_failures jsonb:='[]'; v_timed_out boolean:=false;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'TASK10_INVALID_REQUEST'; END IF;
  PERFORM pg_advisory_xact_lock_shared(10,1); PERFORM pg_advisory_xact_lock_shared(10,2); PERFORM pg_advisory_xact_lock_shared(10,3);
  IF NOT pg_try_advisory_xact_lock(10,4) THEN RETURN jsonb_build_object('status','already_running'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.task10_policy_activation WHERE state='active' AND expiry_enabled) THEN
    INSERT INTO public.task10_worker_runs(status,finished_at) VALUES('inactive',clock_timestamp()) RETURNING id INTO v_run;
    RETURN jsonb_build_object('runId',v_run,'status','inactive','cancelled',0);
  END IF;
  SELECT array_agg(id ORDER BY deadline,id) INTO v_ids FROM (
    SELECT id,public.task10_booking_deadline_v1(id) AS deadline FROM public.bookings
      WHERE status::text IN ('pending_payment','paid') AND public.task10_booking_due_v1(id)
      ORDER BY public.task10_booking_deadline_v1(id),id LIMIT p_limit) due;
  INSERT INTO public.task10_worker_runs(status,oldest_due_at) VALUES('running',
    (SELECT min(public.task10_booking_deadline_v1(id)) FROM unnest(v_ids) id)) RETURNING id INTO v_run;
  -- Acquire every candidate family key first, without waiting. No successful
  -- attempt holds a pricing/batch row while requesting a new family key later.
  FOR r IN SELECT DISTINCT user_id,make_date(year,month,1) AS month FROM public.bookings WHERE id=ANY(v_ids) ORDER BY 1,2 LOOP
    v_key:='task10-family|'||r.user_id::text||'|'||r.month::text;
    IF pg_try_advisory_xact_lock(hashtextextended(v_key,0)) THEN v_keys:=array_append(v_keys,v_key); END IF;
  END LOOP;
  FOR r IN SELECT id,user_id,year,month FROM public.bookings WHERE id=ANY(v_ids) ORDER BY user_id,year,month,id LOOP
    v_key:='task10-family|'||r.user_id::text||'|'||make_date(r.year,r.month,1)::text;
    IF v_key=ANY(v_keys) THEN v_ready:=array_append(v_ready,r.id);
    ELSE v_skipped:=v_skipped||jsonb_build_array(jsonb_build_object('bookingId',r.id,'reason','family_busy')); END IF;
  END LOOP;
  FOREACH b IN ARRAY v_ready LOOP
    IF clock_timestamp()-v_started>interval '40 seconds' THEN v_skipped:=v_skipped||jsonb_build_array(jsonb_build_object('bookingId',b,'reason','run_budget')); CONTINUE; END IF;
    v_attempted:=v_attempted+1;
    BEGIN
      PERFORM set_config('lock_timeout','250ms',true);
      v_result:=public.task10_expire_booking_v1(b);
      IF (v_result->>'cancelled')::boolean THEN v_cancelled:=v_cancelled+1; END IF;
    EXCEPTION WHEN lock_not_available OR deadlock_detected THEN
      v_skipped:=v_skipped||jsonb_build_array(jsonb_build_object('bookingId',b,'reason','lock_busy','sqlstate',SQLSTATE));
    WHEN query_canceled THEN
      v_timed_out:=true; v_failures:=v_failures||jsonb_build_array(jsonb_build_object('bookingId',b,'reason','query_timeout')); EXIT;
    WHEN OTHERS THEN
      v_failures:=v_failures||jsonb_build_array(jsonb_build_object('bookingId',b,'sqlstate',SQLSTATE,'reason',left(SQLERRM,240)));
    END;
  END LOOP;
  UPDATE public.task10_worker_runs SET finished_at=clock_timestamp(),attempted=v_attempted,cancelled=v_cancelled,
    skipped=v_skipped,failures=v_failures,status=CASE WHEN v_timed_out OR jsonb_array_length(v_failures)>0 THEN 'failed' ELSE 'complete' END WHERE id=v_run;
  RETURN jsonb_build_object('runId',v_run,'attempted',v_attempted,'cancelled',v_cancelled,'skipped',v_skipped,'failures',v_failures);
END $$;

DO $$
DECLARE v_job bigint;
BEGIN
  IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='task10-expire-unpaid-bookings-v1') THEN RAISE EXCEPTION 'TASK10_SCHEDULER_COLLISION'; END IF;
  SELECT cron.schedule('task10-expire-unpaid-bookings-v1','* * * * *',
    'SET statement_timeout = ''45s''; SELECT public.task10_run_expiry_v1(50);') INTO v_job;
  PERFORM cron.alter_job(v_job,active:=false);
END $$;

CREATE FUNCTION public.task10_activation_manifest_v1(p_actor_id uuid,p_artifact jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_now timestamptz; v_policy jsonb; v_catalogs jsonb; v_minimum jsonb; v_credits jsonb:='[]'; v_usage jsonb:='[]';
  v_books jsonb:='[]'; v_excluded jsonb:='[]'; v_receipts jsonb; v_data jsonb; w record; v_booking public.bookings%ROWTYPE; m record;
  v_root uuid; v_month date; v_deadline timestamptz; v_reason text;
BEGIN
  PERFORM pg_advisory_xact_lock_shared(10,1); PERFORM pg_advisory_xact_lock_shared(10,2); PERFORM pg_advisory_xact_lock_shared(10,3);
  PERFORM public.task10_require_actor_v1(p_actor_id,'settings');
  IF coalesce(p_artifact->>'sourceSha','') !~ '^[a-f0-9]{40}$' OR coalesce(p_artifact->>'deploymentId','') NOT LIKE 'dpl_%'
    OR coalesce(p_artifact->>'targetProjectRef','')='' OR jsonb_typeof(p_artifact->'migrationHashes') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_artifact->'migrationHashes')<>5 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_artifact->'migrationHashes') h WHERE h !~ '^[a-f0-9]{64}$')
    THEN RAISE EXCEPTION 'TASK10_INVALID_ARTIFACT_MANIFEST'; END IF;
  v_now:=public.task10_clock_v1(); v_policy:=public.task10_policy_status_v1();
  v_catalogs:=public.task10_read_pricing_catalogs_v1(p_actor_id); v_minimum:=public.task10_read_makeup_setting_v1(p_actor_id);
  FOR w IN SELECT c.* FROM public.lesson_wallet_credits c JOIN public.course_types ct ON ct.id=c.course_type_id
    WHERE ct.name::text='kids_group' AND c.status='active' AND c.redeemed_session_id IS NULL AND c.expires_at>v_now ORDER BY c.id LOOP
    BEGIN
      v_root:=public.task10_source_root_v1(w.original_session_id);
      SELECT date_trunc('month',date)::date INTO v_month FROM public.booking_sessions WHERE id=v_root;
      IF NOT EXISTS(SELECT 1 FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id
        WHERE s.id=w.original_session_id AND s.booking_id=w.booking_id AND s.child_id=w.child_id AND s.status::text='walleted'
          AND NOT s.is_makeup AND s.cancelled_at IS NULL AND b.user_id=w.user_id AND b.status::text='verified') THEN RAISE EXCEPTION 'TASK10_INVALID_WALLET_EVIDENCE'; END IF;
      IF EXISTS(SELECT 1 FROM public.booking_sessions s WHERE s.booking_id=w.booking_id AND s.is_makeup
        AND public.task10_source_root_v1(s.id)=v_root) THEN RAISE EXCEPTION 'TASK10_SOURCE_ALREADY_USED'; END IF;
      v_credits:=v_credits||jsonb_build_array(jsonb_build_object('creditId',w.id,'sourceRootId',v_root,'sourceMonth',v_month,
        'originalExpiresAt',w.expires_at,'evidence',to_jsonb(w)));
    EXCEPTION WHEN OTHERS THEN
      v_excluded:=v_excluded||jsonb_build_array(jsonb_build_object('creditId',w.id,'reason',left(SQLERRM,200)));
    END;
  END LOOP;
  FOR m IN SELECT s.id,s.booking_id FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id
    JOIN public.course_types c ON c.id=b.course_type_id WHERE c.name::text='kids_group' AND s.is_makeup ORDER BY s.id LOOP
    BEGIN
      v_root:=public.task10_source_root_v1(m.id);
      v_usage:=v_usage||jsonb_build_array(jsonb_build_object('sessionId',m.id,'sourceRootId',v_root));
    EXCEPTION WHEN OTHERS THEN
      v_excluded:=v_excluded||jsonb_build_array(jsonb_build_object('sessionId',m.id,'reason',left(SQLERRM,200)));
    END;
  END LOOP;
  FOR v_booking IN SELECT * FROM public.bookings WHERE status::text IN ('pending_payment','paid') ORDER BY id LOOP
    v_deadline:=public.task10_booking_deadline_v1(v_booking.id); v_reason:=NULL; v_receipts:='[]';
    IF v_deadline IS NULL THEN v_reason:='ambiguous_deadline'; ELSIF v_deadline<=v_now THEN v_reason:='already_overdue'; END IF;
    IF v_reason IS NULL THEN
      IF v_booking.pricing_scope_id IS NULL THEN
        SELECT coalesce(jsonb_agg(jsonb_build_object('paymentId',p.id,'storagePath',o.name,'acceptedAt',p.created_at,
          'amount',p.amount,'requestId',md5('cutover-payment|'||p.id::text)::uuid) ORDER BY p.id),'[]') INTO v_receipts
          FROM public.payments p JOIN storage.objects o ON o.bucket_id='payment-slips'
            AND o.name=split_part(p.slip_image_url,'/storage/v1/object/public/payment-slips/',2)
          WHERE p.booking_id=v_booking.id AND p.user_id=v_booking.user_id AND p.created_at<v_deadline
            AND left(o.name,length(v_booking.user_id::text)+1)=v_booking.user_id::text||'/';
      ELSE
        SELECT coalesce(jsonb_agg(jsonb_build_object('batchId',batch.id,'storagePath',batch.slip_storage_path,'acceptedAt',batch.upload_recorded_at,
          'sha256',batch.slip_sha256,'memberFingerprint',member.member_fingerprint,'amount',member.amount_snapshot,
          'requestId',md5('cutover-batch|'||batch.id::text||'|'||v_booking.id::text)::uuid) ORDER BY batch.id),'[]') INTO v_receipts
          FROM public.progressive_payment_batch_bookings member JOIN public.progressive_payment_batches batch ON batch.id=member.payment_batch_id
          JOIN storage.objects o ON o.bucket_id=batch.slip_storage_bucket AND o.name=batch.slip_storage_path
          WHERE member.booking_id=v_booking.id AND batch.user_id=v_booking.user_id AND batch.upload_recorded_at<v_deadline
            AND batch.slip_storage_bucket='progressive-payment-slips' AND batch.slip_sha256 ~ '^[a-f0-9]{64}$';
      END IF;
      IF jsonb_array_length(v_receipts)=0 AND (v_booking.status::text='paid' OR EXISTS(SELECT 1 FROM public.progressive_payment_batch_bookings member
        JOIN public.progressive_payment_batches batch ON batch.id=member.payment_batch_id WHERE member.booking_id=v_booking.id AND batch.status IN ('submitted','under_review'))) THEN v_reason:='ambiguous_receipt'; END IF;
    END IF;
    IF v_reason IS NOT NULL THEN v_excluded:=v_excluded||jsonb_build_array(jsonb_build_object('bookingId',v_booking.id,'reason',v_reason,'deadline',v_deadline));
    ELSE v_books:=v_books||jsonb_build_array(jsonb_build_object('bookingId',v_booking.id,'deadline',v_deadline,'receipts',v_receipts,'booking',to_jsonb(v_booking))); END IF;
  END LOOP;
  v_data:=jsonb_build_object('artifact',p_artifact,'policy',v_policy,'catalogs',v_catalogs,'minimum',v_minimum,'credits',v_credits,'priorUsage',v_usage,
    'bookings',v_books,'excluded',v_excluded);
  RETURN v_data||jsonb_build_object('observedAt',v_now,'fingerprint',encode(extensions.digest(v_data::text,'sha256'),'hex'));
END $$;

CREATE FUNCTION public.task10_activate_v1(p_actor_id uuid,p_expected_manifest jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actual jsonb; v_time timestamptz; c jsonb; b jsonb; r jsonb; v_revision bigint; v_job bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(10,1); PERFORM pg_advisory_xact_lock(10,2); PERFORM pg_advisory_xact_lock(10,3);
  PERFORM public.task10_require_actor_v1(p_actor_id,'settings');
  IF NOT EXISTS(SELECT 1 FROM public.task10_policy_activation WHERE state='never_activated' AND effective_at IS NULL) THEN RAISE EXCEPTION 'TASK10_ALREADY_ACTIVATED'; END IF;
  IF p_expected_manifest->'artifact'->>'productionPromotionConfirmed' IS DISTINCT FROM 'true'
    OR p_expected_manifest->'artifact'->>'healthChecksPassed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'TASK10_RELEASE_GATE_REQUIRED'; END IF;
  -- Only a database owner can execute this operation. The operator must verify
  -- project binding, exact artifact and Owner authority externally; these fields
  -- record that evidence and are never treated as authorization from a web client.
  v_actual:=public.task10_activation_manifest_v1(p_actor_id,p_expected_manifest->'artifact');
  IF v_actual->>'fingerprint' IS DISTINCT FROM p_expected_manifest->>'fingerprint' THEN RAISE EXCEPTION 'TASK10_MANIFEST_CHANGED'; END IF;
  v_time:=(v_actual->>'observedAt')::timestamptz;
  FOR c IN SELECT value FROM jsonb_array_elements(v_actual->'credits') LOOP
    INSERT INTO public.task10_wallet_transition_evidence(credit_id,source_month,source_root_id,effective_at,original_expires_at,evidence)
      VALUES((c->>'creditId')::uuid,(c->>'sourceMonth')::date,(c->>'sourceRootId')::uuid,v_time,(c->>'originalExpiresAt')::timestamptz,c->'evidence');
  END LOOP;
  FOR b IN SELECT value FROM jsonb_array_elements(v_actual->'bookings') LOOP
    INSERT INTO public.task10_booking_expiry_cohort(booking_id,effective_at,deadline_at_cutover,evidence)
      VALUES((b->>'bookingId')::uuid,v_time,(b->>'deadline')::timestamptz,b->'booking');
    FOR r IN SELECT value FROM jsonb_array_elements(b->'receipts') LOOP
      INSERT INTO public.task10_accepted_receipts(booking_id,payment_id,batch_id,storage_path,accepted_at,deadline,fingerprint,evidence,request_id)
        VALUES((b->>'bookingId')::uuid,(r->>'paymentId')::uuid,(r->>'batchId')::uuid,r->>'storagePath',(r->>'acceptedAt')::timestamptz,
          (b->>'deadline')::timestamptz,encode(extensions.digest(r::text,'sha256'),'hex'),r,(r->>'requestId')::uuid);
    END LOOP;
  END LOOP;
  UPDATE public.task10_policy_activation SET state='active',revision=revision+1,effective_at=v_time,pricing_enabled=true,makeup_enabled=true,expiry_enabled=true,
    artifact=v_actual->'artifact' RETURNING revision INTO v_revision;
  SELECT jobid INTO v_job FROM cron.job WHERE jobname='task10-expire-unpaid-bookings-v1';
  IF v_job IS NULL THEN RAISE EXCEPTION 'TASK10_SCHEDULER_MISSING'; END IF;
  PERFORM cron.alter_job(v_job,active:=true);
  INSERT INTO public.task10_activation_events(revision,actor_id,state,effective_at,manifest) VALUES(v_revision,p_actor_id,'active',v_time,v_actual);
  RETURN public.task10_policy_status_v1();
END $$;

CREATE FUNCTION public.task10_pause_v1(p_actor_id uuid,p_expected_revision bigint,p_pause boolean,p_release_evidence jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.task10_policy_activation%ROWTYPE; v_job bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(10,1); PERFORM pg_advisory_xact_lock(10,2); PERFORM pg_advisory_xact_lock(10,3);
  PERFORM public.task10_require_actor_v1(p_actor_id,'settings'); SELECT * INTO a FROM public.task10_policy_activation FOR UPDATE;
  IF a.effective_at IS NULL OR a.revision IS DISTINCT FROM p_expected_revision OR p_pause IS NULL THEN RAISE EXCEPTION 'TASK10_REVISION_CONFLICT'; END IF;
  IF coalesce(p_release_evidence->>'sourceSha','') !~ '^[a-f0-9]{40}$' OR coalesce(p_release_evidence->>'deploymentId','') NOT LIKE 'dpl_%' THEN RAISE EXCEPTION 'TASK10_INVALID_ARTIFACT_MANIFEST'; END IF;
  IF NOT p_pause AND (p_release_evidence->>'productionPromotionConfirmed' IS DISTINCT FROM 'true' OR p_release_evidence->>'healthChecksPassed' IS DISTINCT FROM 'true') THEN RAISE EXCEPTION 'TASK10_RELEASE_GATE_REQUIRED'; END IF;
  UPDATE public.task10_policy_activation SET state=CASE WHEN p_pause THEN 'paused' ELSE 'active' END,revision=revision+1,
    pricing_enabled=NOT p_pause,makeup_enabled=NOT p_pause,expiry_enabled=NOT p_pause RETURNING * INTO a;
  SELECT jobid INTO v_job FROM cron.job WHERE jobname='task10-expire-unpaid-bookings-v1';
  IF v_job IS NULL THEN RAISE EXCEPTION 'TASK10_SCHEDULER_MISSING'; END IF;
  PERFORM cron.alter_job(v_job,active:=NOT p_pause);
  INSERT INTO public.task10_activation_events(revision,actor_id,state,effective_at,manifest) VALUES(a.revision,p_actor_id,a.state,a.effective_at,p_release_evidence);
  RETURN public.task10_policy_status_v1();
END $$;

REVOKE ALL ON FUNCTION public.task10_run_expiry_v1(integer),public.task10_activation_manifest_v1(uuid,jsonb),public.task10_activate_v1(uuid,jsonb),
  public.task10_pause_v1(uuid,bigint,boolean,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.task10_activation_manifest_v1(uuid,jsonb) TO service_role;
COMMIT;
