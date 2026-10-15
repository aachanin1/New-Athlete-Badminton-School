-- Restore the exact old function body; no business-row rollback.
BEGIN;
SELECT pg_advisory_xact_lock(10,1);
DO $rollback$
DECLARE definition text;
  old_prefix text := $old$  perform 1
  from public.booking_sessions session_item
  where session_item.id = any(submitted_session_ids)
  order by session_item.id
  for update;$old$;
  new_prefix text := $new$  -- Reservation triggers use one coach/date advisory key. Claim every key
  -- without waiting before row locks/mutations, regardless of payload order.
  for group_coach_id in
    select distinct proposed.coach_id
    from (
      select nullif(value->>'coachId','')::uuid as coach_id
      from jsonb_array_elements(p_groups)
      union
      select coach_id from public.coach_assignment_groups
      where schedule_slot_id = p_schedule_slot_id
    ) proposed
    where proposed.coach_id is not null
    order by proposed.coach_id
  loop
    if not pg_try_advisory_xact_lock(hashtextextended(concat(group_coach_id::text,'|',slot_row.date::text),0)) then
      raise exception using errcode='55P03', message='COACH_ASSIGNMENT_RETRY';
    end if;
  end loop;

  -- Match lesson-source's booking-before-session order. NOWAIT also protects
  -- against writers that already hold other parent sessions or the slot.
  perform 1
  from public.bookings booking_item
  where booking_item.id in (
    select session_item.booking_id
    from public.booking_sessions session_item
    where session_item.id = any(submitted_session_ids)
       or session_item.schedule_slot_id = p_schedule_slot_id
  )
  order by booking_item.id
  for update of booking_item nowait;

  perform 1
  from public.booking_sessions session_item
  where session_item.id = any(submitted_session_ids)
  order by session_item.id
  for update nowait;$new$;
BEGIN
  definition := replace(pg_get_functiondef('public.save_coach_assignment_groups_v2(uuid,uuid,jsonb)'::regprocedure),E'\r\n',E'\n');
  IF md5(definition) <> '31ea453513ca5121b687237de4fc07e4' THEN RAISE EXCEPTION 'ASSIGNMENT5_ROLLBACK_BASELINE_DRIFT'; END IF;
  IF md5(replace(pg_get_functiondef('public.lesson_wallet_store_confirmation_v1(uuid,uuid)'::regprocedure),E'\r\n',E'\n')) <> 'b49dd6ffae771926a988c6f34f5dc3b1' THEN RAISE EXCEPTION 'ASSIGNMENT5_ROLLBACK_HELPER_DRIFT'; END IF;
  definition := replace(definition,new_prefix,old_prefix);
  definition := replace(definition,'for update of session_item, booking_item nowait;','for update of session_item, booking_item;');
  IF md5(definition) <> '5f52ede54032ae4fdd70743854e82b6b' THEN RAISE EXCEPTION 'ASSIGNMENT5_ROLLBACK_BODY_DRIFT'; END IF;
  EXECUTE definition;
  DROP FUNCTION public.lesson_wallet_store_confirmation_v1(uuid,uuid);
END $rollback$;
NOTIFY pgrst,'reload schema';
COMMIT;
