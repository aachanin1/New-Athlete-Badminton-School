BEGIN;
-- Existing old clients must refresh; controlled rollback keeps read/payment/use
-- of already issued rights available while new checkout is paused.
CREATE FUNCTION public.booking_ux_notification_link_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF nullif(current_setting('booking_ux.create',true),'') IS NOT NULL AND NEW.link_url='/dashboard/history' THEN NEW.link_url:='/dashboard/payments';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER booking_ux_notification_link BEFORE INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.booking_ux_notification_link_v1();
REVOKE ALL ON FUNCTION public.booking_ux_notification_link_v1() FROM PUBLIC,anon,authenticated,service_role;
DO $patch$ DECLARE d text;a text;b text;
BEGIN
 d:=pg_get_functiondef('public.booking_ux_create_v1(uuid,uuid,jsonb)'::regprocedure);
 a:='IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_sessions)x WHERE (x->>''endTime'')::time-(x->>''startTime'')::time<>interval ''1 hour'')';
 b:='IF v_course=''private'' AND EXISTS(SELECT 1 FROM jsonb_array_elements(v_sessions)x WHERE (x->>''endTime'')::time-(x->>''startTime'')::time<>interval ''1 hour'')';
 IF position(b IN d)=0 THEN IF position(a IN d)=0 THEN RAISE EXCEPTION 'BOOKING_UX_DURATION_BASELINE_DRIFT';END IF;EXECUTE replace(d,a,b);END IF;
 d:=pg_get_functiondef('public.booking_ux_redeem_many_v1(uuid,uuid,jsonb)'::regprocedure);
 a:='IF NOT(SELECT enabled FROM booking_ux_control WHERE singleton) THEN RAISE EXCEPTION ''BOOKING_UX_DISABLED'';END IF;';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'BOOKING_UX_REDEEM_BASELINE_DRIFT';END IF;d:=replace(d,a,'');
 a:='UPDATE booking_package_units SET status=''redeemed''';b:='PERFORM public.progressive_refresh_slot_capacity_v1(ARRAY[v_slot]); UPDATE booking_package_units SET status=''redeemed''';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'BOOKING_UX_PACKAGE_REFRESH_DRIFT';END IF;d:=replace(d,a,b);
 a:='v_session:=(r->''data''->>''id'')::uuid;v_ids:=array_append(v_ids,v_session);';
 b:='v_session:=(r->''data''->>''id'')::uuid; PERFORM public.lesson_source_effects_v1(p_actor,''redeem'',v_credit.original_session_id,jsonb_build_object(''credit_id'',v_credit.id,''session_ids'',jsonb_build_array(v_session),''schedule_slot_id'',r->''data''->''schedule_slot_id'',''target_date'',v_date,''target_start_time'',v_start,''target_end_time'',v_end,''branch_id'',v_branch,''participant_count'',1),''{}''::jsonb);v_ids:=array_append(v_ids,v_session);';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'BOOKING_UX_PARENT_EFFECTS_DRIFT';END IF;d:=replace(d,a,b);EXECUTE d;
 d:=pg_get_functiondef('public.booking_ux_parent_consume_v1(uuid,uuid,uuid,uuid,uuid,date,time,time,uuid)'::regprocedure);
 a:='IF NOT(SELECT enabled FROM booking_ux_control WHERE singleton) THEN RAISE EXCEPTION ''BOOKING_UX_DISABLED'';END IF;';
 IF position(a IN d)>0 THEN EXECUTE replace(d,a,'');END IF;
 d:=pg_get_functiondef('public.booking_ux_parent_consume_v1(uuid,uuid,uuid,uuid,uuid,date,time,time,uuid)'::regprocedure);
 a:='PERFORM set_config(''task10.source_write'',''authorized'',true);';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'BOOKING_UX_PARENT_WRITE_DRIFT';END IF;
 EXECUTE replace(d,a,'PERFORM set_config(''lesson_source.write'',''authorized'',true); '||a);
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
