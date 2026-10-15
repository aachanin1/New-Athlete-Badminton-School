BEGIN;
SELECT pg_advisory_xact_lock(10,1);
CREATE TABLE public.assignment5_epoch(id boolean PRIMARY KEY DEFAULT true CHECK(id), epoch uuid NOT NULL DEFAULT gen_random_uuid());
INSERT INTO public.assignment5_epoch DEFAULT VALUES;
CREATE TABLE public.assignment5_events(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slot_id uuid NOT NULL, transaction_id bigint NOT NULL DEFAULT txid_current(),
  kind text NOT NULL, action text NOT NULL, before_row jsonb, after_row jsonb
);
CREATE INDEX ON public.assignment5_events(slot_id,transaction_id);
CREATE TABLE public.assignment5_receipts(
  actor_id uuid NOT NULL, request_id uuid NOT NULL, slot_id uuid NOT NULL,
  intent jsonb NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(actor_id,request_id)
);
CREATE TABLE public.assignment5_requests(
  actor_id uuid NOT NULL,request_id uuid NOT NULL,slot_id uuid NOT NULL,intent jsonb NOT NULL,
  deadline timestamptz NOT NULL DEFAULT clock_timestamp()+interval '20 seconds',attempts integer NOT NULL DEFAULT 0,
  PRIMARY KEY(actor_id,request_id)
);
ALTER TABLE public.assignment5_epoch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment5_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment5_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment5_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assignment5_epoch,public.assignment5_events,public.assignment5_receipts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.assignment5_events,public.assignment5_receipts TO service_role;
GRANT SELECT ON public.assignment5_epoch TO service_role;
GRANT USAGE ON SEQUENCE public.assignment5_events_id_seq TO service_role;
REVOKE ALL ON public.assignment5_requests FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.assignment5_requests TO service_role;

-- Append-only evidence: no revision row lock is introduced into old writers.
-- A transaction snapshot, rather than an allocated sequence ID, defines visibility.
CREATE FUNCTION public.assignment5_track_v1() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE b jsonb; a jsonb; ids uuid[]; sid uuid; original_id uuid; slot_ids uuid[];
BEGIN
  IF TG_OP<>'INSERT' THEN b:=to_jsonb(OLD); END IF;
  IF TG_OP<>'DELETE' THEN a:=to_jsonb(NEW); END IF;
  IF TG_TABLE_NAME='booking_sessions' THEN
    b:=CASE WHEN b IS NULL THEN NULL ELSE jsonb_build_object('id',b->'id','schedule_slot_id',b->'schedule_slot_id','status',b->'status','other',md5((b-'status'-'updated_at')::text)) END;
    a:=CASE WHEN a IS NULL THEN NULL ELSE jsonb_build_object('id',a->'id','schedule_slot_id',a->'schedule_slot_id','status',a->'status','other',md5((a-'status'-'updated_at')::text)) END;
  ELSIF TG_TABLE_NAME='schedule_slots' THEN
    SELECT jsonb_object_agg(key,value) INTO b FROM jsonb_each(b) WHERE key IN ('id','template_id','branch_id','course_type_id','date','start_time','end_time','status');
    SELECT jsonb_object_agg(key,value) INTO a FROM jsonb_each(a) WHERE key IN ('id','template_id','branch_id','course_type_id','date','start_time','end_time','status');
  ELSIF TG_TABLE_NAME='bookings' THEN
    b:=CASE WHEN b IS NULL THEN NULL ELSE jsonb_build_object('id',b->'id','fingerprint',md5((b-'updated_at')::text)) END;
    a:=CASE WHEN a IS NULL THEN NULL ELSE jsonb_build_object('id',a->'id','fingerprint',md5((a-'updated_at')::text)) END;
  ELSIF TG_TABLE_NAME='profiles' THEN
    b:=CASE WHEN b IS NULL THEN NULL ELSE jsonb_build_object('id',b->'id','role',b->'role') END;
    a:=CASE WHEN a IS NULL THEN NULL ELSE jsonb_build_object('id',a->'id','role',a->'role') END;
  END IF;
  IF TG_OP='UPDATE' AND b IS NOT DISTINCT FROM a THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='lesson_source_operations' THEN
    IF NEW.operation<>'store' THEN RETURN NEW; END IF;
    SELECT array_agg(original_session_id) INTO ids FROM public.lesson_wallet_credit_members WHERE credit_id=(NEW.result->>'credit_id')::uuid;
    FOR original_id IN SELECT unnest(ids) LOOP
      SELECT schedule_slot_id INTO sid FROM public.booking_sessions WHERE id=original_id;
      IF sid IS NOT NULL THEN INSERT INTO public.assignment5_events(slot_id,kind,action,after_row)
        VALUES(sid,'store','INSERT',jsonb_build_object('source',original_id,'actor',NEW.actor_id,'credit',NEW.result->>'credit_id')); END IF;
    END LOOP;
    RETURN NEW;
  ELSIF TG_TABLE_NAME='bookings' THEN
    SELECT array_agg(DISTINCT schedule_slot_id) INTO slot_ids FROM public.booking_sessions WHERE booking_id=coalesce(a->>'id',b->>'id')::uuid;
  ELSIF TG_TABLE_NAME IN ('profiles','coach_branches') THEN
    SELECT array_agg(DISTINCT ss.id) INTO slot_ids FROM public.schedule_slots ss WHERE
      ss.branch_id IN (SELECT branch_id FROM public.coach_branches WHERE coach_id IN ((a->>'id')::uuid,(b->>'id')::uuid))
      OR ss.branch_id IN ((a->>'branch_id')::uuid,(b->>'branch_id')::uuid)
      OR ss.id IN (SELECT schedule_slot_id FROM public.coach_assignment_groups WHERE coach_id IN ((a->>'id')::uuid,(b->>'id')::uuid));
  ELSIF TG_TABLE_NAME IN ('coach_assignment_group_students','attendance') THEN
    IF TG_TABLE_NAME='coach_assignment_group_students' THEN
      SELECT array_agg(DISTINCT schedule_slot_id) INTO slot_ids FROM public.coach_assignment_groups WHERE id IN ((a->>'group_id')::uuid,(b->>'group_id')::uuid);
    ELSE
      SELECT array_agg(DISTINCT schedule_slot_id) INTO slot_ids FROM public.booking_sessions WHERE id IN ((a->>'booking_session_id')::uuid,(b->>'booking_session_id')::uuid);
    END IF;
  ELSIF TG_TABLE_NAME='schedule_slots' THEN slot_ids:=ARRAY[(a->>'id')::uuid,(b->>'id')::uuid];
  ELSE slot_ids:=ARRAY[(a->>'schedule_slot_id')::uuid,(b->>'schedule_slot_id')::uuid];
  END IF;
  FOR sid IN SELECT DISTINCT unnest(slot_ids) LOOP
    IF sid IS NOT NULL THEN INSERT INTO public.assignment5_events(slot_id,kind,action,before_row,after_row) VALUES(sid,TG_TABLE_NAME,TG_OP,b,a); END IF;
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['booking_sessions','bookings','schedule_slots','coach_assignment_groups','coach_assignment_group_students','coach_assignments','attendance','coach_checkins','profiles','coach_branches'] LOOP
    EXECUTE format('CREATE TRIGGER assignment5_track AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.assignment5_track_v1()',t);
  END LOOP;
END $$;
CREATE TRIGGER assignment5_store_commit AFTER INSERT ON public.lesson_source_operations FOR EACH ROW EXECUTE FUNCTION public.assignment5_track_v1();
REVOKE ALL ON FUNCTION public.assignment5_track_v1() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.assignment5_context_v1(p_slot uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('epoch',(SELECT epoch FROM public.assignment5_epoch),
    'version',txid_current_snapshot()::text,'groups',public.coach_assignment_slot_snapshot_v2(p_slot)->'groups',
    'rosterSessionIds',(SELECT coalesce(jsonb_agg(s.id ORDER BY s.id),'[]'::jsonb) FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id
      WHERE s.schedule_slot_id=p_slot AND s.status::text IN ('scheduled','completed','absent') AND b.status::text='verified'));
$$;
REVOKE ALL ON FUNCTION public.assignment5_context_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assignment5_context_v1(uuid) TO service_role;

CREATE FUNCTION public.assignment5_admit_v1(p_actor uuid,p_slot uuid,p_request uuid,p_intent jsonb,p_attempt boolean) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r public.assignment5_requests%rowtype;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtextextended('assignment5-request:'||p_actor::text||':'||p_request::text,0)) THEN RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='COACH_ASSIGNMENT_RETRY'; END IF;
  IF NOT p_attempt THEN INSERT INTO public.assignment5_requests(actor_id,slot_id,request_id,intent) VALUES(p_actor,p_slot,p_request,p_intent) ON CONFLICT DO NOTHING; END IF;
  SELECT * INTO r FROM public.assignment5_requests WHERE actor_id=p_actor AND request_id=p_request FOR UPDATE;
  IF NOT FOUND OR r.slot_id<>p_slot OR r.intent IS DISTINCT FROM p_intent THEN RAISE EXCEPTION 'COACH_ASSIGNMENT_REQUEST_MISMATCH'; END IF;
  IF r.deadline<=clock_timestamp() OR r.attempts>=3 THEN RAISE EXCEPTION 'COACH_ASSIGNMENT_INTENT_EXPIRED'; END IF;
  IF p_attempt THEN UPDATE public.assignment5_requests SET attempts=attempts+1 WHERE actor_id=p_actor AND request_id=p_request; END IF;
  RETURN jsonb_build_object('admitted',true,'deadline',r.deadline);
END $$;
REVOKE ALL ON FUNCTION public.assignment5_admit_v1(uuid,uuid,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assignment5_admit_v1(uuid,uuid,uuid,jsonb,boolean) TO service_role;

CREATE FUNCTION public.assignment5_status_v1(p_actor uuid,p_slot uuid,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r public.assignment5_receipts%rowtype; admitted boolean;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtextextended('assignment5-request:'||p_actor::text||':'||p_request::text,0)) THEN RETURN jsonb_build_object('confirmed',false,'pending',true,'admitted',true,'inFlight',true); END IF;
  SELECT * INTO r FROM public.assignment5_receipts WHERE actor_id=p_actor AND request_id=p_request AND slot_id=p_slot;
  IF FOUND THEN RETURN jsonb_build_object('confirmed',true,'result',r.result); END IF;
  SELECT EXISTS(SELECT 1 FROM public.assignment5_requests WHERE actor_id=p_actor AND request_id=p_request AND slot_id=p_slot AND deadline>clock_timestamp()) INTO admitted;
  RETURN jsonb_build_object('confirmed',false,'pending',admitted,'admitted',admitted);
END $$;
REVOKE ALL ON FUNCTION public.assignment5_status_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assignment5_status_v1(uuid,uuid,uuid) TO service_role;

CREATE FUNCTION public.assignment5_save_v1(p_actor uuid,p_slot uuid,p_request uuid,p_intent jsonb,p_groups jsonb,p_context jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE receipt public.assignment5_receipts%rowtype; slot public.schedule_slots%rowtype;
  current_context jsonb; expected_groups jsonb; trimmed jsonb; draft_group jsonb; member_ids jsonb;
  removed uuid[]; active uuid[]; submitted uuid[]; e record; answer jsonb; saved jsonb; coach record;
  deadline timestamptz; lower_level integer; upper_level integer; notice_message text;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtextextended('assignment5-request:'||p_actor::text||':'||p_request::text,0)) THEN
    RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='COACH_ASSIGNMENT_RETRY'; END IF;
  SELECT * INTO receipt FROM public.assignment5_receipts WHERE actor_id=p_actor AND request_id=p_request;
  IF FOUND THEN
    IF receipt.slot_id<>p_slot OR receipt.intent IS DISTINCT FROM p_intent THEN RAISE EXCEPTION 'COACH_ASSIGNMENT_REQUEST_MISMATCH'; END IF;
    RETURN receipt.result||jsonb_build_object('replayed',true);
  END IF;
  SELECT r.deadline INTO deadline FROM public.assignment5_requests r WHERE r.actor_id=p_actor AND r.request_id=p_request AND r.slot_id=p_slot AND r.intent=p_intent;
  IF deadline IS NULL OR deadline<=clock_timestamp() THEN RAISE EXCEPTION 'COACH_ASSIGNMENT_INTENT_EXPIRED'; END IF;
  PERFORM pg_advisory_xact_lock_shared(10,1);
  SELECT * INTO slot FROM public.schedule_slots WHERE id=p_slot FOR UPDATE NOWAIT;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_actor AND
    (p.role::text IN ('admin','super_admin') OR (p.role::text='head_coach' AND EXISTS(SELECT 1 FROM public.coach_branches WHERE coach_id=p_actor AND branch_id=slot.branch_id)))) THEN
    RAISE EXCEPTION 'COACH_ASSIGNMENT_FORBIDDEN'; END IF;
  IF (slot.date+slot.start_time) AT TIME ZONE 'Asia/Bangkok'<=clock_timestamp() THEN RAISE EXCEPTION 'COACH_ASSIGNMENT_STARTED'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=p_actor OR id IN (SELECT nullif(value->>'coachId','')::uuid FROM jsonb_array_elements(p_groups)) ORDER BY id FOR SHARE NOWAIT;
  PERFORM 1 FROM public.coach_branches WHERE branch_id=slot.branch_id ORDER BY coach_id FOR SHARE NOWAIT;
  IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_actor AND
    (p.role::text IN ('admin','super_admin') OR (p.role::text='head_coach' AND EXISTS(SELECT 1 FROM public.coach_branches WHERE coach_id=p_actor AND branch_id=slot.branch_id)))) THEN RAISE EXCEPTION 'COACH_ASSIGNMENT_FORBIDDEN'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_groups) g WHERE g->>'coachId' IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.profiles p JOIN public.coach_branches cb ON cb.coach_id=p.id WHERE p.id=(g->>'coachId')::uuid AND cb.branch_id=slot.branch_id AND p.role::text IN ('coach','head_coach'))) THEN RAISE EXCEPTION 'COACH_ASSIGNMENT_FORBIDDEN'; END IF;
  IF p_context->>'epoch' IS DISTINCT FROM (SELECT epoch::text FROM public.assignment5_epoch) THEN RAISE EXCEPTION 'COACH_ASSIGNMENT_BASELINE_CONFLICT'; END IF;
  IF public.assignment8_group_signature_v1(p_intent->'expectedGroups') IS DISTINCT FROM public.assignment8_group_signature_v1(p_context->'groups') THEN RAISE EXCEPTION 'COACH_ASSIGNMENT_BASELINE_CONFLICT'; END IF;
  SELECT array_agg(x::uuid ORDER BY x::uuid) INTO submitted FROM jsonb_array_elements_text(p_context->'rosterSessionIds') x;
  IF submitted IS DISTINCT FROM (SELECT array_agg(x::uuid ORDER BY x::uuid) FROM jsonb_array_elements(p_groups) g CROSS JOIN LATERAL jsonb_array_elements_text(g->'studentSessionIds') x)
    THEN RAISE EXCEPTION 'COACH_ASSIGNMENT_ROSTER_CONFLICT'; END IF;
  PERFORM 1 FROM public.bookings b WHERE b.id IN (SELECT s.booking_id FROM public.booking_sessions s WHERE s.schedule_slot_id=p_slot OR s.id=ANY(submitted)) ORDER BY b.id FOR UPDATE NOWAIT;
  PERFORM 1 FROM public.booking_sessions s WHERE s.schedule_slot_id=p_slot OR s.id=ANY(submitted) ORDER BY s.id FOR UPDATE NOWAIT;
  PERFORM 1 FROM public.coach_assignment_groups WHERE schedule_slot_id=p_slot ORDER BY id FOR UPDATE NOWAIT;
  PERFORM 1 FROM public.coach_assignment_group_students WHERE group_id IN (SELECT id FROM public.coach_assignment_groups WHERE schedule_slot_id=p_slot) ORDER BY id FOR UPDATE NOWAIT;
  PERFORM 1 FROM public.coach_assignments WHERE schedule_slot_id=p_slot ORDER BY id FOR UPDATE NOWAIT;
  PERFORM 1 FROM public.coach_checkins WHERE schedule_slot_id=p_slot ORDER BY id FOR UPDATE NOWAIT;
  PERFORM 1 FROM public.attendance WHERE booking_session_id IN (SELECT id FROM public.booking_sessions WHERE schedule_slot_id=p_slot) ORDER BY id FOR UPDATE NOWAIT;
  current_context:=public.assignment5_context_v1(p_slot);
  SELECT array_agg(x::uuid ORDER BY x::uuid) INTO active FROM jsonb_array_elements_text(current_context->'rosterSessionIds') x;
  SELECT coalesce(array_agg(x),'{}'::uuid[]) INTO removed FROM unnest(submitted) x WHERE NOT x=ANY(coalesce(active,'{}'::uuid[]));
  IF EXISTS(SELECT 1 FROM unnest(active) x WHERE NOT x=ANY(coalesce(submitted,'{}'::uuid[]))) THEN RAISE EXCEPTION 'COACH_ASSIGNMENT_ROSTER_CONFLICT'; END IF;
  -- Every changed row must be an exact Store effect, with a committed receipt in
  -- the same transaction. Even ABA/extra writes inside a Store transaction reject.
  FOR e IN SELECT * FROM public.assignment5_events WHERE slot_id=p_slot AND NOT txid_visible_in_snapshot(transaction_id,(p_context->>'version')::txid_snapshot) LOOP
    IF e.kind='store' THEN
      IF NOT (e.after_row->>'source')::uuid=ANY(removed) THEN RAISE EXCEPTION 'COACH_ASSIGNMENT_ROSTER_CONFLICT'; END IF;
    ELSIF e.kind='booking_sessions' AND e.action='UPDATE' AND e.before_row->>'status'='scheduled' AND e.after_row->>'status'='walleted'
      AND (e.before_row-'status')=(e.after_row-'status') AND (e.before_row->>'id')::uuid=ANY(removed) THEN NULL;
    ELSIF e.kind='coach_assignment_group_students' AND e.action='DELETE' AND (e.before_row->>'booking_session_id')::uuid=ANY(removed) THEN NULL;
    ELSIF e.kind='schedule_slots' AND e.action='UPDATE' AND e.before_row->>'status'='full' AND e.after_row->>'status'='open'
      AND (e.before_row-'status')=(e.after_row-'status') AND (e.before_row->>'id')::uuid=p_slot
      AND EXISTS(SELECT 1 FROM public.assignment5_events sc WHERE sc.slot_id=p_slot AND sc.transaction_id=e.transaction_id AND sc.kind='store'
        AND (sc.after_row->>'source')::uuid=ANY(removed)) THEN NULL;
    ELSE RAISE EXCEPTION 'COACH_ASSIGNMENT_BASELINE_CONFLICT'; END IF;
    IF e.kind NOT IN ('store','schedule_slots') AND NOT EXISTS(SELECT 1 FROM public.assignment5_events sc WHERE sc.slot_id=p_slot AND sc.transaction_id=e.transaction_id AND sc.kind='store'
      AND (sc.after_row->>'source')::uuid=coalesce((e.before_row->>'booking_session_id')::uuid,(e.before_row->>'id')::uuid)) THEN
      RAISE EXCEPTION 'COACH_ASSIGNMENT_BASELINE_CONFLICT'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM unnest(removed) r WHERE NOT EXISTS(
    SELECT 1 FROM public.assignment5_events ev JOIN public.lesson_wallet_credit_members cm ON cm.original_session_id=r
      JOIN public.lesson_wallet_credits c ON c.id=cm.credit_id JOIN public.bookings b ON b.id=c.booking_id
    WHERE ev.slot_id=p_slot AND ev.kind='store' AND (ev.after_row->>'source')::uuid=r AND (ev.after_row->>'credit')::uuid=c.id
      AND (ev.after_row->>'actor')::uuid=b.user_id AND cm.original_schedule_slot_id=p_slot
      AND NOT txid_visible_in_snapshot(ev.transaction_id,(p_context->>'version')::txid_snapshot))) THEN RAISE EXCEPTION 'COACH_ASSIGNMENT_ROSTER_CONFLICT'; END IF;
  SELECT coalesce(jsonb_agg(g||jsonb_build_object('student_session_ids',(SELECT coalesce(jsonb_agg(x ORDER BY x),'[]'::jsonb)
      FROM jsonb_array_elements_text(g->'student_session_ids') x WHERE NOT x::uuid=ANY(removed))) ORDER BY ord),'[]'::jsonb)
    INTO expected_groups FROM jsonb_array_elements(p_context->'groups') WITH ORDINALITY t(g,ord);
  IF public.assignment8_group_signature_v1(expected_groups) IS DISTINCT FROM public.assignment8_group_signature_v1(current_context->'groups') THEN RAISE EXCEPTION 'COACH_ASSIGNMENT_BASELINE_CONFLICT'; END IF;
  trimmed:='[]'::jsonb;
  FOR draft_group IN SELECT value FROM jsonb_array_elements(p_groups) LOOP
    SELECT coalesce(jsonb_agg(x ORDER BY x),'[]'::jsonb) INTO member_ids FROM jsonb_array_elements_text(draft_group->'studentSessionIds') x WHERE NOT x::uuid=ANY(removed);
    IF jsonb_array_length(member_ids)>0 THEN
      SELECT min(coalesce(l.level,0)),max(coalesce(l.level,0)) INTO lower_level,upper_level FROM public.booking_sessions s JOIN public.bookings b ON b.id=s.booking_id
        LEFT JOIN LATERAL (SELECT level FROM public.student_levels WHERE student_id=coalesce(s.child_id,b.user_id) AND student_type::text=CASE WHEN s.child_id IS NULL THEN 'adult' ELSE 'child' END ORDER BY created_at DESC LIMIT 1) l ON true
        WHERE s.id IN (SELECT x::uuid FROM jsonb_array_elements_text(member_ids) x);
      trimmed:=trimmed||jsonb_build_array(draft_group||jsonb_build_object('studentSessionIds',member_ids,'levelMin',lower_level,'levelMax',upper_level,'sortOrder',jsonb_array_length(trimmed)));
    END IF;
  END LOOP;
  IF deadline<=clock_timestamp() THEN RAISE EXCEPTION 'COACH_ASSIGNMENT_INTENT_EXPIRED'; END IF;
  IF jsonb_array_length(trimmed)=0 THEN
    IF coalesce(cardinality(active),0)>0 OR cardinality(removed)=0 THEN RAISE EXCEPTION 'COACH_ASSIGNMENT_ROSTER_CONFLICT'; END IF;
    saved:=jsonb_build_object('snapshot',public.coach_assignment_slot_snapshot_v2(p_slot),'no_change',true,'no_assignment_needed',true);
  ELSE saved:=public.save_coach_assignment_groups_v3(p_slot,p_actor,trimmed,current_context->'groups'); END IF;
  -- Notifications and receipt are in the same commit as the assignment. The
  -- slot lock serializes duplicate checks for every request concerning this slot.
  IF NOT coalesce((saved->>'no_change')::boolean,false) THEN
    FOR coach IN SELECT value->>'coach_id' AS id,count(*) AS groups,sum(jsonb_array_length(value->'student_session_ids')) AS students
      FROM jsonb_array_elements(saved->'snapshot'->'groups') WHERE value->>'coach_id' IS NOT NULL GROUP BY value->>'coach_id' LOOP
      notice_message:='คุณได้รับมอบหมายให้สอน '||to_char(slot.date,'DD/MM/')||(extract(year FROM slot.date)::integer+543)::text||' เวลา '||left(slot.start_time::text,5)||'-'||left(slot.end_time::text,5)
        ||' · '||(SELECT name FROM public.branches WHERE id=slot.branch_id)||' จำนวน '||coach.groups||' กลุ่ม ผู้เรียน '||coach.students||' คน กรุณาเช็คอินก่อนสอนและเช็คชื่อให้ครบ';
      INSERT INTO public.notifications(user_id,title,message,type,link_url)
        SELECT coach.id::uuid,'ได้รับมอบหมายรอบสอน',notice_message,'schedule'::public.notification_type,'/coach/today?date='||slot.date::text
        WHERE NOT EXISTS(SELECT 1 FROM public.notifications n WHERE n.user_id=coach.id::uuid AND n.title='ได้รับมอบหมายรอบสอน' AND n.message=notice_message AND n.link_url='/coach/today?date='||slot.date::text);
    END LOOP;
  END IF;
  answer:=saved||jsonb_build_object('removedSessionIds',to_jsonb(removed),'requestId',p_request);
  IF deadline<=clock_timestamp() OR (slot.date+slot.start_time) AT TIME ZONE 'Asia/Bangkok'<=clock_timestamp() THEN RAISE EXCEPTION 'COACH_ASSIGNMENT_INTENT_EXPIRED'; END IF;
  INSERT INTO public.assignment5_receipts(actor_id,request_id,slot_id,intent,result) VALUES(p_actor,p_request,p_slot,p_intent,answer);
  RETURN answer;
END $$;
REVOKE ALL ON FUNCTION public.assignment5_save_v1(uuid,uuid,uuid,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assignment5_save_v1(uuid,uuid,uuid,jsonb,jsonb,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
