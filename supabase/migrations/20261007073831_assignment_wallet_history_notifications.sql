-- Item8: additive audit fields and responsible-coach Store notice. No historical writes.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(10,1);
DO $guard$ BEGIN
 IF md5(replace(pg_get_functiondef('public.lesson_source_effects_v1(uuid,text,uuid,jsonb,jsonb)'::regprocedure),chr(13)||chr(10),chr(10)))<>'53112579eb8563b0620179a886f2d202' THEN RAISE EXCEPTION 'ASSIGNMENT8_EFFECTS_BASELINE_DRIFT'; END IF;
END $guard$;
CREATE OR REPLACE FUNCTION public.lesson_source_effects_v1(p_actor uuid,p_operation text,p_source uuid,p_result jsonb,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE s record; n record; c record; v_title text; v_message text; v_link text; v_unit text; v_old text; v_new text;
  v_recipients uuid[]; v_old_recipients uuid[]; v_target uuid; v_removed integer; v_warning boolean:=false;
  v_active uuid[]; v_assigned uuid[]; v_unassigned uuid[]; v_details jsonb; v_action text; v_entity uuid;
  v_notice record; v_names text; v_group_summary text; v_affected_coaches uuid[]; v_before jsonb;
  v_recipient_count integer:=0; v_inserted_count integer:=0; v_failures jsonb:='[]'::jsonb;
BEGIN
  IF p_operation NOT IN ('reschedule','store','redeem') THEN RETURN p_result; END IF;
  SELECT bs.*,b.user_id,coalesce(p.full_name,'ผู้ใช้') AS user_name,coalesce(br.name,'สาขาเดิม') AS branch_name
    INTO s FROM public.booking_sessions bs JOIN public.bookings b ON b.id=bs.booking_id
    LEFT JOIN public.profiles p ON p.id=b.user_id LEFT JOIN public.branches br ON br.id=bs.branch_id WHERE bs.id=p_source;
  IF p_operation='reschedule' THEN
    SELECT bs.*,coalesce(br.name,'สาขาใหม่') AS branch_name INTO n FROM public.booking_sessions bs
      LEFT JOIN public.branches br ON br.id=bs.branch_id WHERE bs.id=(p_result->>'sessionId')::uuid;
    v_old:=s.date::text||' '||left(s.start_time::text,5)||'-'||left(s.end_time::text,5)||' ที่ '||s.branch_name;
    v_new:=n.date::text||' '||left(n.start_time::text,5)||'-'||left(n.end_time::text,5)||' ที่ '||n.branch_name;
    v_removed:=coalesce((p_result->'assignmentRetirement'->>'removed_count')::integer,0);
    v_title:='Reschedule เปลี่ยนรายชื่อรอบสอน ต้องตรวจการมอบหมาย';
    v_message:=s.user_name||' เปลี่ยนรอบเรียนจาก '||v_old||' เป็น '||v_new||' นักเรียนในรอบใหม่ยังไม่ได้มอบหมายโค้ชอัตโนมัติ ต้องให้ Head Coach ตรวจและบันทึก/ยืนยันการมอบหมายก่อนเริ่มรอบ';
    SELECT array_agg(id) INTO v_recipients FROM public.profiles WHERE role::text IN ('admin','super_admin');
    v_warning:=coalesce(cardinality(v_recipients),0)=0;
    IF v_warning THEN v_failures:=v_failures||jsonb_build_array(jsonb_build_object('audience','admin','stage','recipient_empty','message','Required admin recipient set is empty')); END IF;
    v_recipient_count:=v_recipient_count+coalesce(cardinality(v_recipients),0);
    v_inserted_count:=v_inserted_count+public.lesson_source_notify_v1(v_recipients,v_title,v_message,'/admin/schedules','system',true);
    SELECT array_agg(DISTINCT cb.coach_id) INTO v_recipients FROM public.coach_branches cb JOIN public.profiles p ON p.id=cb.coach_id
      WHERE cb.branch_id=n.branch_id AND p.role::text='head_coach';
    v_warning:=v_warning OR coalesce(cardinality(v_recipients),0)=0;
    IF coalesce(cardinality(v_recipients),0)=0 THEN v_failures:=v_failures||jsonb_build_array(jsonb_build_object('audience','new_branch_head_coach','stage','recipient_empty','message','Required new_branch_head_coach recipient set is empty')); END IF;
    v_recipient_count:=v_recipient_count+coalesce(cardinality(v_recipients),0);
    v_inserted_count:=v_inserted_count+public.lesson_source_notify_v1(v_recipients,'มีนักเรียนย้ายเข้ารอบ ต้องตรวจและบันทึกการมอบหมาย',
      s.user_name||' ย้ายเข้ารอบ '||v_new||' โดยยังไม่ได้มอบหมายโค้ชอัตโนมัติ กรุณาตรวจกลุ่มและกดบันทึก/ยืนยันการมอบหมายก่อนเริ่มรอบ',
      '/coach/assign-groups?month='||left(n.date::text,7),'system',true);
    IF v_removed>0 THEN
      SELECT array_agg(DISTINCT cb.coach_id) INTO v_recipients FROM public.coach_branches cb JOIN public.profiles p ON p.id=cb.coach_id
        WHERE cb.branch_id=s.branch_id AND p.role::text='head_coach';
      v_warning:=v_warning OR coalesce(cardinality(v_recipients),0)=0;
      IF coalesce(cardinality(v_recipients),0)=0 THEN v_failures:=v_failures||jsonb_build_array(jsonb_build_object('audience','old_branch_head_coach','stage','recipient_empty','message','Required old_branch_head_coach recipient set is empty')); END IF;
      v_recipient_count:=v_recipient_count+coalesce(cardinality(v_recipients),0);
      v_inserted_count:=v_inserted_count+public.lesson_source_notify_v1(v_recipients,'รายชื่อรอบเดิมเปลี่ยน ต้องตรวจและบันทึกการมอบหมายใหม่',
        s.user_name||' ย้ายออกจากรอบ '||v_old||' ระบบถอดเฉพาะสมาชิกเดิมออกแล้ว กรุณาตรวจรายชื่อและกดบันทึก/ยืนยันการมอบหมายใหม่ โดยระบบไม่ได้มอบหมายหรือบันทึก attendance อัตโนมัติ',
        '/coach/assign-groups?month='||left(s.date::text,7),'system',true);
    END IF;
    v_action:='reschedule_booking_session'; v_entity:=s.id;
    v_details:=jsonb_build_object('newSessionId',n.id,'oldDate',s.date,'oldStartTime',s.start_time,'newDate',n.date,'newStartTime',n.start_time,
      'branchId',n.branch_id,'scheduleSlotId',n.schedule_slot_id,'removedExactMembershipCount',v_removed,
      'assignmentRetirementAuditId',p_result->'assignmentRetirement'->'audit'->'id','assignmentReviewRequired',true,'autoAssigned',false,
      'notificationDeliverySucceeded',NOT v_warning,'notificationRequiredAudienceCount',CASE WHEN v_removed>0 THEN 3 ELSE 2 END,
      'notificationRecipientCount',v_recipient_count,'notificationAttemptCount',v_recipient_count,
      'notificationSuccessfulRecipientCount',v_recipient_count,'notificationSkippedCount',v_recipient_count-v_inserted_count,
      'notificationFailedRecipientCount',0,'notificationAudienceFailureCount',jsonb_array_length(v_failures),
      'notificationFailureCount',jsonb_array_length(v_failures),'notificationFailures',v_failures);
    p_result:=p_result||jsonb_build_object('success',true,'warning',CASE WHEN v_warning THEN jsonb_build_object(
      'code','ASSIGNMENT_REVIEW_NOTIFICATION_FAILED','message','เปลี่ยนรอบสำเร็จแล้ว แต่การแจ้งเตือนผู้ตรวจการมอบหมายส่งไม่ครบ กรุณาตรวจหน้าจัดกลุ่มโค้ช') ELSE NULL END);
  ELSE
    SELECT * INTO c FROM public.lesson_wallet_credits WHERE id=(p_result->>'credit_id')::uuid;
    v_old:=public.lesson_source_slot_label_v1(c.original_date,c.original_start_time,c.original_end_time);
    v_unit:=CASE WHEN coalesce(c.participant_count,1)>1 OR (p_operation='store' AND c.entitlement_unit_type='family_private')
      THEN 'ทั้งครอบครัว '||coalesce(c.participant_count,1)::text||' คน' ELSE '1 สิทธิ์' END;
    v_entity:=c.id;
    IF p_operation='store' THEN
      v_action:='store_lesson_wallet_credit'; v_title:='ผู้เรียนเก็บรอบเรียนเข้ากระเป๋า';
      v_message:='ผู้เรียนเก็บรอบ '||v_old||' ('||v_unit||') เข้ากระเป๋าวันเรียน';
      SELECT array_agg(bs.id ORDER BY bs.id) INTO v_active FROM public.booking_sessions bs JOIN public.bookings b ON b.id=bs.booking_id
        WHERE bs.schedule_slot_id=s.schedule_slot_id AND bs.status::text IN ('scheduled','completed','absent') AND b.status::text IN ('pending_payment','paid','verified');
      SELECT array_agg(DISTINCT m.booking_session_id) INTO v_assigned FROM public.coach_assignment_group_students m
        JOIN public.coach_assignment_groups g ON g.id=m.group_id JOIN public.profiles coach ON coach.id=g.coach_id
        WHERE m.booking_session_id=ANY(v_active) AND coach.role::text IN ('coach','head_coach') AND g.name<>'ยังไม่จัดกลุ่ม';
      IF NOT EXISTS(SELECT 1 FROM public.coach_assignment_groups WHERE schedule_slot_id=s.schedule_slot_id) THEN
        SELECT array_agg(bs.id) INTO v_assigned FROM public.booking_sessions bs
          WHERE bs.id=ANY(v_active) AND (bs.rescheduled_from_id IS NULL OR bs.is_makeup OR EXISTS(
            SELECT 1 FROM public.lesson_wallet_credit_members cm WHERE cm.redeemed_session_id=bs.id))
          AND EXISTS(SELECT 1 FROM public.coach_assignments ca JOIN public.profiles p ON p.id=ca.coach_id
            WHERE ca.schedule_slot_id=s.schedule_slot_id AND p.role::text IN ('coach','head_coach'));
      END IF;
      SELECT array_agg(x) INTO v_unassigned FROM unnest(v_active) x WHERE NOT(x=ANY(coalesce(v_assigned,'{}'::uuid[])));
      v_details:=jsonb_build_object('policyType',c.entitlement_policy,'entitlementStartedAt',c.entitlement_started_at,'expiresAt',c.expires_at,
        'paymentId',coalesce(c.entitlement_payment_id::text,c.entitlement_evidence->>'payment_id'),
        'pricingTier',CASE WHEN coalesce(c.entitlement_pricing_tier_id::text,c.entitlement_evidence->>'pricing_tier_id') IS NULL THEN NULL ELSE
          jsonb_build_object('id',coalesce(c.entitlement_pricing_tier_id::text,c.entitlement_evidence->>'pricing_tier_id'),
            'min',coalesce((c.entitlement_evidence->>'pricing_tier_min')::numeric,0),
            'max',CASE WHEN c.entitlement_evidence->'pricing_tier_max'='null'::jsonb THEN NULL ELSE coalesce((c.entitlement_evidence->>'pricing_tier_max')::numeric,0) END,
            'unit',CASE WHEN c.entitlement_evidence->>'pricing_unit'='hour' THEN 'hour' ELSE 'session' END,
            'pricePerUnit',coalesce((c.entitlement_evidence->>'price_per_unit')::numeric,0),
            'packagePrice',coalesce((c.entitlement_evidence->>'package_price')::numeric,0),
            'validFrom',c.entitlement_evidence->>'tier_valid_from','validTo',c.entitlement_evidence->>'tier_valid_to') END,
        'entitlementEvidence',c.entitlement_evidence,'unitType',c.entitlement_unit_type,
        'participantCount',c.participant_count,'participantSessionIds',p_result->'participant_session_ids','removedAssignmentStudentIds',p_result->'removed_membership_ids',
        'scheduleSlotId',s.schedule_slot_id,'branchId',s.branch_id,'date',s.date,'startTime',s.start_time,'endTime',s.end_time,
        'postWalletAssignmentState',jsonb_build_object('activeSessionIds',coalesce(v_active,'{}'::uuid[]),'assignedSessionIds',coalesce(v_assigned,'{}'::uuid[]),
          'unassignedSessionIds',coalesce(v_unassigned,'{}'::uuid[]),'needsReview',coalesce(cardinality(v_unassigned),0)>0,'hasActiveLearners',coalesce(cardinality(v_active),0)>0));
      SELECT string_agg(coalesce(ch.nickname,ch.full_name,CASE WHEN bs.child_id IS NULL THEN p.full_name END,'ไม่พบชื่อผู้เรียน'),', ' ORDER BY bs.id)
        INTO v_names FROM public.booking_sessions bs JOIN public.bookings b ON b.id=bs.booking_id
        LEFT JOIN public.children ch ON ch.id=bs.child_id LEFT JOIN public.profiles p ON p.id=b.user_id
        WHERE bs.id IN (SELECT jsonb_array_elements_text(p_result->'participant_session_ids')::uuid);
      SELECT coalesce(array_agg(DISTINCT id),'{}'::uuid[]) INTO v_affected_coaches FROM (
        SELECT jsonb_array_elements_text(coalesce(p_result->'assigned_coach_ids','[]'::jsonb))::uuid AS id
        UNION SELECT ca.coach_id FROM public.coach_assignments ca WHERE ca.schedule_slot_id=s.schedule_slot_id
          AND (s.rescheduled_from_id IS NULL OR s.is_makeup OR EXISTS(
            SELECT 1 FROM public.lesson_wallet_credit_members cm WHERE cm.redeemed_session_id=s.id))
          AND NOT EXISTS(SELECT 1 FROM public.coach_assignment_groups WHERE schedule_slot_id=s.schedule_slot_id)
      ) responsible;
      SELECT coalesce(jsonb_agg(a.details ORDER BY a.id),'[]'::jsonb) INTO v_before FROM public.activity_logs a
        WHERE a.action='retire_coach_assignment_membership' AND a.user_id=p_actor AND a.created_at=transaction_timestamp()
          AND a.details->>'reason'='wallet_store'
          AND a.details->>'bookingSessionId' IN (SELECT jsonb_array_elements_text(p_result->'participant_session_ids'));
      SELECT string_agg(name||' เหลือ '||remaining::text||' คน',', ' ORDER BY name) INTO v_group_summary FROM (
        SELECT DISTINCT g->>'id' AS id,g->>'name' AS name,
          (SELECT count(*) FROM public.coach_assignment_group_students m WHERE m.group_id=(g->>'id')::uuid) AS remaining
        FROM jsonb_array_elements(v_before) a CROSS JOIN LATERAL jsonb_array_elements(a->'before'->'groups') g
        WHERE EXISTS(SELECT 1 FROM jsonb_array_elements_text(g->'student_session_ids') x
          WHERE x IN (SELECT jsonb_array_elements_text(p_result->'participant_session_ids')))
      ) affected_groups;
      v_message:=coalesce(v_names,'ผู้เรียน')||' เก็บรอบ '||v_old||' ที่ '||s.branch_name||' ('||v_unit||') เข้ากระเป๋าแล้ว'
        ||CASE WHEN v_group_summary IS NULL THEN '' ELSE ' · '||v_group_summary END
        ||' · รอบนี้เหลือผู้เรียน '||coalesce(cardinality(v_active),0)::text||' คน'
        ||CASE WHEN coalesce(cardinality(v_active),0)=0 THEN ' ไม่มีผู้เรียนเหลือในรอบ'
          WHEN coalesce(cardinality(v_unassigned),0)>0 THEN ' รอมอบหมายโค้ช '||cardinality(v_unassigned)::text||' คน'
          ELSE ' ผู้เรียนที่เหลือมีโค้ชรับผิดชอบครบ' END;
      FOR v_notice IN SELECT DISTINCT p.id,p.role::text AS role FROM public.profiles p
        WHERE p.role::text IN ('admin','super_admin')
          OR (p.id=ANY(v_affected_coaches) AND p.role::text IN ('coach','head_coach'))
          OR (coalesce(cardinality(v_unassigned),0)>0 AND p.role::text='head_coach'
            AND EXISTS(SELECT 1 FROM public.coach_branches cb WHERE cb.coach_id=p.id AND cb.branch_id=s.branch_id))
      LOOP
        v_link:=CASE WHEN v_notice.role IN ('admin','super_admin') THEN '/admin/schedules'
          WHEN v_notice.role='head_coach' THEN '/coach/assign-groups?month='||left(s.date::text,7)
          ELSE '/coach/notifications' END;
        v_inserted_count:=v_inserted_count+public.lesson_source_notify_v1(ARRAY[v_notice.id],v_title,v_message,v_link,'schedule',false);
        v_recipient_count:=v_recipient_count+1;
      END LOOP;
      v_details:=v_details||jsonb_build_object('responsibleCoachIdsBeforeStore',v_affected_coaches,
        'assignmentRetirements',v_before,'notificationRecipientCount',v_recipient_count,
        'notificationInsertedCount',v_inserted_count,'learnerNames',v_names);

    ELSE
      v_action:='redeem_lesson_wallet_credit'; v_title:='ผู้เรียนใช้วันเรียนจากกระเป๋า';
      v_new:=public.lesson_source_slot_label_v1((p_result->>'target_date')::date,(p_result->>'target_start_time')::time,(p_result->>'target_end_time')::time);
      v_message:='ผู้เรียนใช้สิทธิ์ '||v_unit||' จากกระเป๋ามาลงรอบ '||v_new;
      SELECT array_agg(DISTINCT cb.coach_id) INTO v_recipients FROM public.coach_branches cb JOIN public.profiles p ON p.id=cb.coach_id
        WHERE cb.branch_id=(p_result->>'branch_id')::uuid AND p.role::text='head_coach';
      PERFORM public.lesson_source_notify_v1(v_recipients,v_title,'ผู้เรียนใช้สิทธิ์ '||v_unit||' จากรอบ '||v_old||' มาลงรอบ '||v_new||' กรุณาจัดกลุ่ม/มอบหมายโค้ช',
        '/coach/assign-groups?month='||left(p_result->>'target_date',7),'schedule',false);
      v_details:=jsonb_build_object('originalSessionId',c.original_session_id,'newSessionIds',p_result->'session_ids','scheduleSlotId',p_result->'schedule_slot_id',
        'targetDate',p_result->'target_date','startTime',p_result->'target_start_time','branchId',p_result->'branch_id','participantCount',p_result->'participant_count');
    END IF;
    IF p_operation<>'store' THEN
      SELECT array_agg(id) INTO v_recipients FROM public.profiles WHERE role::text IN ('admin','super_admin');
      PERFORM public.lesson_source_notify_v1(v_recipients,v_title,v_message,'/admin/schedules','schedule',false);
    END IF;
  END IF;
  INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details,ip_address)
    VALUES(p_actor,v_action,CASE WHEN p_operation='reschedule' THEN 'booking_session' ELSE 'lesson_wallet_credits' END,v_entity,v_details,nullif(split_part(p_payload->>'ipAddress',',',1),'')::inet);
  RETURN p_result;
END $$;

-- Compare business content, not recreated group IDs. Clients submit the exact
-- persisted baseline; the slot lock closes the check/write race with v2/Store.
CREATE FUNCTION public.assignment8_group_signature_v1(p_groups jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
  SELECT coalesce(jsonb_agg(value ORDER BY value::text),'[]'::jsonb) FROM (
    SELECT jsonb_build_object('name',btrim(g->>'name'),'coach',coalesce(g->>'coachId',g->>'coach_id'),
      'min',coalesce(g->'levelMin',g->'level_min'),'max',coalesce(g->'levelMax',g->'level_max'),
      'students',(SELECT jsonb_agg(id ORDER BY id) FROM jsonb_array_elements_text(coalesce(g->'studentSessionIds',g->'student_session_ids','[]'::jsonb)) id)) value
    FROM jsonb_array_elements(p_groups) g
  ) normalized
$$;
REVOKE ALL ON FUNCTION public.assignment8_group_signature_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.assignment8_group_signature_v1(jsonb) TO service_role;

CREATE FUNCTION public.save_coach_assignment_groups_v3(p_schedule_slot_id uuid,p_actor_id uuid,p_groups jsonb,p_expected_groups jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_snapshot jsonb; v_result jsonb; v_same boolean;
BEGIN
  IF jsonb_typeof(p_expected_groups) IS DISTINCT FROM 'array' OR jsonb_typeof(p_groups) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'COACH_ASSIGNMENT_INVALID_BASELINE'; END IF;
  IF jsonb_array_length(p_groups)=0 THEN RAISE EXCEPTION 'ต้องมีอย่างน้อย 1 กลุ่ม'; END IF;
  PERFORM pg_advisory_xact_lock_shared(10,1);
  PERFORM 1 FROM public.schedule_slots WHERE id=p_schedule_slot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ไม่พบรอบเรียน'; END IF;
  v_snapshot:=public.coach_assignment_slot_snapshot_v2(p_schedule_slot_id);
  v_same:=public.assignment8_group_signature_v1(v_snapshot->'groups')=public.assignment8_group_signature_v1(p_groups);
  IF NOT v_same AND public.assignment8_group_signature_v1(v_snapshot->'groups') IS DISTINCT FROM public.assignment8_group_signature_v1(p_expected_groups) THEN
    RAISE EXCEPTION 'COACH_ASSIGNMENT_BASELINE_CONFLICT';
  END IF;
  IF v_same AND v_snapshot->'membership_session_ids' = (SELECT coalesce(jsonb_agg(bs.id ORDER BY bs.id),'[]'::jsonb)
    FROM public.booking_sessions bs JOIN public.bookings b ON b.id=bs.booking_id
    WHERE bs.schedule_slot_id=p_schedule_slot_id AND bs.status::text IN ('scheduled','completed','absent')
      AND b.status::text='verified') THEN
    RETURN jsonb_build_object('schedule_slot_id',p_schedule_slot_id,'snapshot',v_snapshot,'no_change',true);
  END IF;
  v_result:=public.save_coach_assignment_groups_v2(p_schedule_slot_id,p_actor_id,p_groups);
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.save_coach_assignment_groups_v3(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_coach_assignment_groups_v3(uuid,uuid,jsonb,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
