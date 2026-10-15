-- Save shares booking/session rows with atomic lesson-source transitions.
-- Lock booking rows first; never wait while holding the slot/session prefix.
BEGIN;
SELECT pg_advisory_xact_lock(10,1);
DO $migration$
DECLARE
  definition text;
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
  IF md5(definition) <> '5f52ede54032ae4fdd70743854e82b6b' THEN
    RAISE EXCEPTION 'ASSIGNMENT5_SAVE_BASELINE_DRIFT';
  END IF;
  IF strpos(definition,old_prefix)=0 OR strpos(definition,'for update of session_item, booking_item;')=0 THEN
    RAISE EXCEPTION 'ASSIGNMENT5_SAVE_LOCK_PREFIX_MISSING';
  END IF;
  definition := replace(definition,old_prefix,new_prefix);
  definition := replace(definition,'for update of session_item, booking_item;','for update of session_item, booking_item nowait;');
  EXECUTE definition;
END $migration$;
-- Keep the private operation ledger unreadable to API roles. Expose only this
-- source-bound boolean to the server's service role, with ownership rechecked.
CREATE FUNCTION public.lesson_wallet_store_confirmation_v1(p_actor_id uuid,p_session_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $confirmation$
  SELECT EXISTS (
    SELECT 1 FROM public.booking_sessions source
    JOIN public.bookings booking ON booking.id=source.booking_id
    JOIN public.lesson_wallet_credit_members member ON member.original_session_id=source.id
    JOIN public.lesson_wallet_credits credit ON credit.id=member.credit_id AND credit.user_id=booking.user_id
    JOIN public.lesson_source_operations operation ON operation.actor_id=booking.user_id
      AND operation.operation='store' AND operation.result->>'credit_id'=credit.id::text
    WHERE source.id=p_session_id AND booking.user_id=p_actor_id
  );
$confirmation$;
REVOKE ALL ON FUNCTION public.lesson_wallet_store_confirmation_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.lesson_wallet_store_confirmation_v1(uuid,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
