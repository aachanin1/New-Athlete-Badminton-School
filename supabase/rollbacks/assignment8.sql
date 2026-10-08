-- Apply only under separately approved recovery; retain all business rows and notices.
BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(10,1);
DO $guard$ BEGIN
 IF md5(replace(pg_get_functiondef('public.lesson_source_effects_v1(uuid,text,uuid,jsonb,jsonb)'::regprocedure),chr(13)||chr(10),chr(10))) NOT IN ('53112579eb8563b0620179a886f2d202','ed59d95f531639ac20116ed12a758cf3') THEN RAISE EXCEPTION 'ASSIGNMENT8_ROLLBACK_EFFECTS_DRIFT'; END IF;
 IF to_regprocedure('public.save_coach_assignment_groups_v3(uuid,uuid,jsonb,jsonb)') IS NOT NULL AND md5(replace(pg_get_functiondef('public.save_coach_assignment_groups_v3(uuid,uuid,jsonb,jsonb)'::regprocedure),chr(13)||chr(10),chr(10)))<>'b8a8bb347556fbd7dcd44d73a143f1ad' THEN RAISE EXCEPTION 'ASSIGNMENT8_ROLLBACK_SAVE_DRIFT'; END IF;
END $guard$;
CREATE OR REPLACE FUNCTION public.lesson_source_effects_v1(p_actor uuid,p_operation text,p_source uuid,p_result jsonb,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE s record; n record; c record; v_title text; v_message text; v_link text; v_unit text; v_old text; v_new text;
  v_recipients uuid[]; v_old_recipients uuid[]; v_target uuid; v_removed integer; v_warning boolean:=false;
  v_active uuid[]; v_assigned uuid[]; v_unassigned uuid[]; v_details jsonb; v_action text; v_entity uuid;
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
        JOIN public.coach_assignment_groups g ON g.id=m.group_id WHERE m.booking_session_id=ANY(v_active);
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
        'postWalletAssignmentState',jsonb_build_object('activeSessionIds',coalesce(v_active,'{}'::uuid[]),'assignedSessionIds',coalesce(v_assigned,'{}'::uuid[]),
          'unassignedSessionIds',coalesce(v_unassigned,'{}'::uuid[]),'needsReview',coalesce(cardinality(v_unassigned),0)>0,'hasActiveLearners',coalesce(cardinality(v_active),0)>0));
      IF coalesce(cardinality(v_unassigned),0)>0 THEN
        SELECT array_agg(DISTINCT id) INTO v_recipients FROM (
          SELECT cb.coach_id AS id FROM public.coach_branches cb JOIN public.profiles p ON p.id=cb.coach_id WHERE cb.branch_id=s.branch_id AND p.role::text='head_coach'
          UNION SELECT jsonb_array_elements_text(coalesce(p_result->'assigned_coach_ids','[]'::jsonb))::uuid) ids;
        PERFORM public.lesson_source_notify_v1(v_recipients,'ผู้เรียนถูกย้ายเข้ากระเป๋า ต้องตรวจกลุ่มสอน',
          'ผู้เรียนเก็บรอบ '||v_old||' ('||v_unit||') เข้ากระเป๋าแล้ว และยังมีผู้เรียนที่ต้องมอบหมายโค้ชในรอบนี้',
          '/coach/assign-groups?month='||left(s.date::text,7),'schedule',false);
      END IF;
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
    SELECT array_agg(id) INTO v_recipients FROM public.profiles WHERE role::text IN ('admin','super_admin');
    PERFORM public.lesson_source_notify_v1(v_recipients,v_title,v_message,'/admin/schedules','schedule',false);
  END IF;
  INSERT INTO public.activity_logs(user_id,action,entity_type,entity_id,details,ip_address)
    VALUES(p_actor,v_action,CASE WHEN p_operation='reschedule' THEN 'booking_session' ELSE 'lesson_wallet_credits' END,v_entity,v_details,nullif(split_part(p_payload->>'ipAddress',',',1),'')::inet);
  RETURN p_result;
END $$;

DROP FUNCTION IF EXISTS public.save_coach_assignment_groups_v3(uuid,uuid,jsonb,jsonb);
DROP FUNCTION IF EXISTS public.assignment8_group_signature_v1(jsonb);
NOTIFY pgrst,'reload schema'; COMMIT;
