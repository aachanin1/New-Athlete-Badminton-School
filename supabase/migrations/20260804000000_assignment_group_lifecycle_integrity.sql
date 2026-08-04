-- Assignment Group Lifecycle Integrity
-- Additive only: v1 remains available for the currently deployed source and rollback.
-- No function in this migration is invoked while the migration itself is applied.

create or replace function public.coach_assignment_slot_snapshot_v2(
  p_schedule_slot_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with slot_groups as (
    select
      group_row.id,
      group_row.name,
      group_row.coach_id,
      group_row.level_min,
      group_row.level_max,
      group_row.sort_order
    from public.coach_assignment_groups group_row
    where group_row.schedule_slot_id = p_schedule_slot_id
  )
  select jsonb_build_object(
    'schedule_slot_id', p_schedule_slot_id,
    'group_ids', coalesce((
      select jsonb_agg(group_row.id order by group_row.id)
      from slot_groups group_row
    ), '[]'::jsonb),
    'coach_ids', coalesce((
      select jsonb_agg(coach_row.coach_id order by coach_row.coach_id)
      from (
        select distinct group_row.coach_id
        from slot_groups group_row
        where group_row.coach_id is not null
      ) coach_row
    ), '[]'::jsonb),
    'membership_session_ids', coalesce((
      select jsonb_agg(member_row.booking_session_id order by member_row.booking_session_id)
      from public.coach_assignment_group_students member_row
      join slot_groups group_row on group_row.id = member_row.group_id
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', group_row.id,
          'name', group_row.name,
          'coach_id', group_row.coach_id,
          'level_min', group_row.level_min,
          'level_max', group_row.level_max,
          'sort_order', group_row.sort_order,
          'student_session_ids', coalesce((
            select jsonb_agg(member_row.booking_session_id order by member_row.booking_session_id)
            from public.coach_assignment_group_students member_row
            where member_row.group_id = group_row.id
          ), '[]'::jsonb)
        )
        order by group_row.sort_order, group_row.id
      )
      from slot_groups group_row
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.coach_assignment_slot_snapshot_v2(uuid) from public, anon, authenticated;
grant execute on function public.coach_assignment_slot_snapshot_v2(uuid) to service_role;

create or replace function public.save_coach_assignment_groups_v2(
  p_schedule_slot_id uuid,
  p_actor_id uuid,
  p_groups jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  slot_row public.schedule_slots%rowtype;
  group_payload jsonb;
  session_id_text text;
  inserted_group_id uuid;
  assigned_coach_ids uuid[] := '{}'::uuid[];
  submitted_session_ids uuid[] := '{}'::uuid[];
  authoritative_session_ids uuid[] := '{}'::uuid[];
  submitted_session_count integer := 0;
  submitted_unique_session_count integer := 0;
  group_index integer := 0;
  group_coach_id uuid;
  group_sort_order integer;
  session_row record;
  before_snapshot jsonb;
  after_snapshot jsonb;
  audit_id uuid;
  audit_created_at timestamptz;
begin
  if jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) = 0 then
    raise exception 'ต้องมีอย่างน้อย 1 กลุ่ม';
  end if;

  select * into slot_row
  from public.schedule_slots
  where id = p_schedule_slot_id
  for update;
  if slot_row.id is null then
    raise exception 'ไม่พบรอบเรียน';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_groups) payload
    where jsonb_typeof(coalesce(payload -> 'studentSessionIds', '[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(payload -> 'studentSessionIds', '[]'::jsonb)) = 0
  ) then
    raise exception 'ทุกกลุ่มต้องมีผู้เรียนอย่างน้อยหนึ่งคน';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_groups) payload
    where nullif(payload ->> 'coachId', '') is not null
    group by payload ->> 'coachId'
    having count(*) > 1
  ) then
    raise exception 'โค้ช 1 คนไม่สามารถรับผิดชอบหลายกลุ่มในรอบเวลาเดียวกันได้';
  end if;

  select count(*), count(distinct submitted_id.session_id)
  into submitted_session_count, submitted_unique_session_count
  from (
    select (session_value #>> '{}')::uuid as session_id
    from jsonb_array_elements(p_groups) group_value
    cross join lateral jsonb_array_elements(
      coalesce(group_value -> 'studentSessionIds', '[]'::jsonb)
    ) session_value
  ) submitted_id;

  if submitted_session_count <> submitted_unique_session_count then
    raise exception using
      errcode = 'P0001',
      message = 'COACH_ASSIGNMENT_DUPLICATE_MEMBERSHIP|duplicate_submitted_session';
  end if;

  select coalesce(array_agg(submitted_id.session_id order by submitted_id.session_id), '{}'::uuid[])
  into submitted_session_ids
  from (
    select distinct (session_value #>> '{}')::uuid as session_id
    from jsonb_array_elements(p_groups) group_value
    cross join lateral jsonb_array_elements(
      coalesce(group_value -> 'studentSessionIds', '[]'::jsonb)
    ) session_value
  ) submitted_id;

  perform 1
  from public.booking_sessions session_item
  where session_item.id = any(submitted_session_ids)
  order by session_item.id
  for update;

  perform 1
  from public.booking_sessions session_item
  join public.bookings booking_item on booking_item.id = session_item.booking_id
  where session_item.schedule_slot_id = p_schedule_slot_id
    and booking_item.status = 'verified'
    and session_item.status in ('scheduled', 'completed', 'absent')
  order by session_item.id
  for update of session_item, booking_item;

  select coalesce(array_agg(eligible.id order by eligible.id), '{}'::uuid[])
  into authoritative_session_ids
  from (
    select session_item.id
    from public.booking_sessions session_item
    join public.bookings booking_item on booking_item.id = session_item.booking_id
    where session_item.schedule_slot_id = p_schedule_slot_id
      and booking_item.status = 'verified'
      and session_item.status in ('scheduled', 'completed', 'absent')
  ) eligible;

  if exists (
    select 1
    from unnest(submitted_session_ids) submitted_id
    where not (submitted_id = any(authoritative_session_ids))
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'COACH_ASSIGNMENT_ROSTER_CONFLICT|submitted_session_ineligible';
  end if;

  if exists (
    select 1
    from unnest(authoritative_session_ids) eligible_id
    where not (eligible_id = any(submitted_session_ids))
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'COACH_ASSIGNMENT_ROSTER_CONFLICT|missing_current_eligible_session';
  end if;

  before_snapshot := public.coach_assignment_slot_snapshot_v2(p_schedule_slot_id);

  delete from public.coach_assignment_groups
  where schedule_slot_id = p_schedule_slot_id;
  delete from public.coach_assignments
  where schedule_slot_id = p_schedule_slot_id;

  for group_payload in select value from jsonb_array_elements(p_groups)
  loop
    group_coach_id := nullif(group_payload ->> 'coachId', '')::uuid;
    group_sort_order := coalesce(nullif(group_payload ->> 'sortOrder', '')::integer, group_index);

    insert into public.coach_assignment_groups (
      schedule_slot_id,
      coach_id,
      name,
      level_min,
      level_max,
      sort_order,
      notes,
      created_by
    ) values (
      p_schedule_slot_id,
      group_coach_id,
      coalesce(nullif(btrim(group_payload ->> 'name'), ''), concat('กลุ่ม ', group_index + 1)),
      nullif(group_payload ->> 'levelMin', '')::integer,
      nullif(group_payload ->> 'levelMax', '')::integer,
      group_sort_order,
      null,
      p_actor_id
    ) returning id into inserted_group_id;

    for session_id_text in
      select value #>> '{}'
      from jsonb_array_elements(coalesce(group_payload -> 'studentSessionIds', '[]'::jsonb))
    loop
      select
        session_item.id,
        session_item.child_id,
        booking_item.user_id
      into session_row
      from public.booking_sessions session_item
      join public.bookings booking_item on booking_item.id = session_item.booking_id
      where session_item.id = session_id_text::uuid;

      insert into public.coach_assignment_group_students (
        group_id,
        booking_session_id,
        student_id,
        student_type
      ) values (
        inserted_group_id,
        session_row.id,
        coalesce(session_row.child_id, session_row.user_id),
        (case when session_row.child_id is null then 'adult' else 'child' end)::public.student_type
      );
    end loop;

    if group_coach_id is not null and not (group_coach_id = any(assigned_coach_ids)) then
      assigned_coach_ids := array_append(assigned_coach_ids, group_coach_id);
    end if;
    group_index := group_index + 1;
  end loop;

  if cardinality(assigned_coach_ids) > 0 then
    insert into public.coach_assignments (coach_id, schedule_slot_id, assigned_by)
    select unnest(assigned_coach_ids), p_schedule_slot_id, p_actor_id
    on conflict (coach_id, schedule_slot_id) do nothing;
  end if;

  after_snapshot := public.coach_assignment_slot_snapshot_v2(p_schedule_slot_id);

  insert into public.activity_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    details
  ) values (
    p_actor_id,
    'save_coach_assignment_groups_v2',
    'coach_assignment_group',
    p_schedule_slot_id,
    jsonb_build_object(
      'scheduleSlotId', p_schedule_slot_id,
      'branchId', slot_row.branch_id,
      'lifecycleAction', 'save',
      'reason', 'assignment_save',
      'eligibleSessionIds', to_jsonb(authoritative_session_ids),
      'before', before_snapshot,
      'after', after_snapshot
    )
  ) returning id, created_at into audit_id, audit_created_at;

  return jsonb_build_object(
    'schedule_slot_id', p_schedule_slot_id,
    'eligible_session_ids', to_jsonb(authoritative_session_ids),
    'coach_ids', to_jsonb(assigned_coach_ids),
    'snapshot', after_snapshot,
    'audit', jsonb_build_object(
      'id', audit_id,
      'created_at', audit_created_at,
      'action', 'save_coach_assignment_groups_v2'
    )
  );
end;
$$;

revoke all on function public.save_coach_assignment_groups_v2(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_coach_assignment_groups_v2(uuid, uuid, jsonb) to service_role;

create or replace function public.retire_coach_assignment_membership_v1(
  p_booking_session_id uuid,
  p_actor_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  session_row public.booking_sessions%rowtype;
  target_slot_id uuid;
  before_snapshot jsonb;
  after_snapshot jsonb;
  removed_membership_ids uuid[] := '{}'::uuid[];
  removed_group_ids uuid[] := '{}'::uuid[];
  removed_count integer := 0;
  audit_id uuid;
  audit_created_at timestamptz;
begin
  if p_reason not in ('reschedule_out', 'wallet_store') then
    raise exception using
      errcode = '22023',
      message = 'COACH_ASSIGNMENT_RETIREMENT_REASON_INVALID';
  end if;

  select schedule_slot_id into target_slot_id
  from public.booking_sessions
  where id = p_booking_session_id;
  if target_slot_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'COACH_ASSIGNMENT_RETIREMENT_CONFLICT|session_or_slot_missing';
  end if;

  perform 1
  from public.schedule_slots
  where id = target_slot_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'COACH_ASSIGNMENT_RETIREMENT_CONFLICT|slot_missing';
  end if;

  select * into session_row
  from public.booking_sessions
  where id = p_booking_session_id
  for update;
  if session_row.id is null or session_row.schedule_slot_id is distinct from target_slot_id then
    raise exception using
      errcode = 'P0001',
      message = 'COACH_ASSIGNMENT_RETIREMENT_CONFLICT|session_or_slot_changed';
  end if;

  if p_reason = 'reschedule_out' and session_row.status <> 'rescheduled' then
    raise exception using
      errcode = 'P0001',
      message = 'COACH_ASSIGNMENT_RETIREMENT_CONFLICT|reschedule_status_stale';
  end if;
  if p_reason = 'wallet_store' and session_row.status <> 'walleted' then
    raise exception using
      errcode = 'P0001',
      message = 'COACH_ASSIGNMENT_RETIREMENT_CONFLICT|wallet_status_stale';
  end if;

  perform 1
  from public.coach_assignment_group_students member_row
  join public.coach_assignment_groups group_row on group_row.id = member_row.group_id
  where member_row.booking_session_id = p_booking_session_id
  order by group_row.id, member_row.id
  for update of member_row, group_row;

  before_snapshot := public.coach_assignment_slot_snapshot_v2(session_row.schedule_slot_id);

  with removed as (
    delete from public.coach_assignment_group_students member_row
    where member_row.booking_session_id = p_booking_session_id
    returning member_row.id, member_row.group_id
  )
  select
    coalesce(array_agg(removed.id order by removed.id), '{}'::uuid[]),
    coalesce(array_agg(distinct removed.group_id order by removed.group_id), '{}'::uuid[]),
    count(*)::integer
  into removed_membership_ids, removed_group_ids, removed_count
  from removed;

  after_snapshot := public.coach_assignment_slot_snapshot_v2(session_row.schedule_slot_id);

  insert into public.activity_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    details
  ) values (
    p_actor_id,
    'retire_coach_assignment_membership',
    'coach_assignment_group',
    session_row.schedule_slot_id,
    jsonb_build_object(
      'scheduleSlotId', session_row.schedule_slot_id,
      'bookingSessionId', p_booking_session_id,
      'lifecycleAction', 'retire_membership',
      'reason', p_reason,
      'removedMembershipIds', to_jsonb(removed_membership_ids),
      'removedGroupIds', to_jsonb(removed_group_ids),
      'removedCount', removed_count,
      'before', before_snapshot,
      'after', after_snapshot
    )
  ) returning id, created_at into audit_id, audit_created_at;

  return jsonb_build_object(
    'schedule_slot_id', session_row.schedule_slot_id,
    'booking_session_id', p_booking_session_id,
    'reason', p_reason,
    'removed_count', removed_count,
    'removed_membership_ids', to_jsonb(removed_membership_ids),
    'removed_group_ids', to_jsonb(removed_group_ids),
    'before', before_snapshot,
    'after', after_snapshot,
    'audit', jsonb_build_object(
      'id', audit_id,
      'created_at', audit_created_at,
      'action', 'retire_coach_assignment_membership'
    )
  );
end;
$$;

revoke all on function public.retire_coach_assignment_membership_v1(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.retire_coach_assignment_membership_v1(uuid, uuid, text) to service_role;
