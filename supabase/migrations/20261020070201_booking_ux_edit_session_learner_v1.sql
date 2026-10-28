BEGIN;
-- The package wrapper validates the complete owned participant set. Let the
-- released writer validate actual sessions against that set's new header while
-- keeping historical/unscoped editors on their original learner identity.
DO $patch$
DECLARE d text:=pg_get_functiondef('public.task10_write_legacy_booking_v1(uuid,text,uuid,jsonb)'::regprocedure);
 a text:='CASE WHEN p_action=''create'' THEN (p_input->>''learnerType'')';
 b text:='CASE WHEN p_action=''create'' THEN (p_input->>''childId'')';
 condition text:='CASE WHEN p_action=''create'' OR (p_action=''update'' AND v_old.package_snapshot IS NOT NULL AND nullif(current_setting(''booking_ux.create'',true),'''') IS NOT NULL) THEN ';
BEGIN
 IF position(a IN d)=0 OR position(b IN d)=0 THEN RAISE EXCEPTION 'BOOKING_UX_LEARNER_WRITER_DRIFT';END IF;
 d:=replace(d,a,condition||'(p_input->>''learnerType'')');
 d:=replace(d,b,condition||'(p_input->>''childId'')');
 EXECUTE d;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
