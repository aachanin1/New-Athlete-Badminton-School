-- Local-first exact coach assignment collision protection.
-- Historical groups are never repaired. Current/future exact groups are reserved
-- only after the separately runnable read-only preflight reports no blockers.

create extension if not exists btree_gist;

create table if not exists public.coach_assignment_exact_reservations (
  group_id uuid primary key references public.coach_assignment_groups(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  schedule_slot_id uuid not null references public.schedule_slots(id) on delete cascade,
  teaching_date date not null,
  teaching_time_range tstzrange not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_assignment_exact_reservations_no_overlap
    exclude using gist (
      coach_id with =,
      teaching_date with =,
      teaching_time_range with &&
    )
);

alter table public.coach_assignment_exact_reservations enable row level security;
revoke all on table public.coach_assignment_exact_reservations from anon, authenticated;
grant select, insert, update, delete on table public.coach_assignment_exact_reservations to service_role;

alter table public.coach_assignment_groups
  add constraint coach_assignment_exact_group_name_check
  check (
    coach_id is null
    or (
      btrim(name) <> ''
      and btrim(name) <> 'ยังไม่จัดกลุ่ม'
      and name !~ '\s*\(\s*\d+\s*คน\s*\)\s*$'
    )
  ) not valid;

create or replace function public.is_exact_coach_assignment_group_active_v1(p_group_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.coach_assignment_groups group_row
    join public.coach_assignment_group_students member on member.group_id = group_row.id
    join public.booking_sessions session_row on session_row.id = member.booking_session_id
    join public.bookings booking_row on booking_row.id = session_row.booking_id
    where group_row.id = p_group_id
      and group_row.coach_id is not null
      and booking_row.status = 'verified'
      and session_row.status in ('scheduled', 'completed', 'absent')
      and session_row.schedule_slot_id = group_row.schedule_slot_id
  );
$$;

create or replace function public.get_coach_assignment_conflicts_v1(
  p_coach_id uuid,
  p_schedule_slot_id uuid,
  p_exclude_group_ids uuid[] default '{}'::uuid[],
  p_replace_current_slot boolean default false
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  target_slot public.schedule_slots%rowtype;
  exact_rows jsonb;
  legacy_rows jsonb;
begin
  select * into target_slot
  from public.schedule_slots
  where id = p_schedule_slot_id;

  if target_slot.id is null then
    raise exception 'ไม่พบรอบเรียนที่ต้องการตรวจสอบ';
  end if;

  select coalesce(jsonb_agg(to_jsonb(conflict_row) order by conflict_row.date, conflict_row.start_time, conflict_row.group_id), '[]'::jsonb)
  into exact_rows
  from (
    select
      group_row.id as group_id,
      slot_row.id as schedule_slot_id,
      slot_row.date,
      slot_row.start_time,
      slot_row.end_time,
      branch_row.id as branch_id,
      branch_row.name as branch_name,
      course_row.name as course_name,
      group_row.name as group_name,
      count(distinct member.booking_session_id)::integer as active_learner_count
    from public.coach_assignment_groups group_row
    join public.schedule_slots slot_row on slot_row.id = group_row.schedule_slot_id
    join public.branches branch_row on branch_row.id = slot_row.branch_id
    left join public.course_types course_row on course_row.id = slot_row.course_type_id
    join public.coach_assignment_group_students member on member.group_id = group_row.id
    join public.booking_sessions session_row on session_row.id = member.booking_session_id
    join public.bookings booking_row on booking_row.id = session_row.booking_id
    where group_row.coach_id = p_coach_id
      and group_row.id <> all(coalesce(p_exclude_group_ids, '{}'::uuid[]))
      and not (p_replace_current_slot and group_row.schedule_slot_id = p_schedule_slot_id)
      and booking_row.status = 'verified'
      and session_row.status in ('scheduled', 'completed', 'absent')
      and session_row.schedule_slot_id = group_row.schedule_slot_id
      and slot_row.date = target_slot.date
      and slot_row.start_time < target_slot.end_time
      and target_slot.start_time < slot_row.end_time
    group by group_row.id, slot_row.id, branch_row.id, branch_row.name, course_row.name
  ) conflict_row;

  select coalesce(jsonb_agg(to_jsonb(legacy_row) order by legacy_row.date, legacy_row.start_time, legacy_row.assignment_id), '[]'::jsonb)
  into legacy_rows
  from (
    select
      legacy.id as assignment_id,
      slot_row.id as schedule_slot_id,
      slot_row.date,
      slot_row.start_time,
      slot_row.end_time,
      branch_row.id as branch_id,
      branch_row.name as branch_name,
      course_row.name as course_name
    from public.coach_assignments legacy
    join public.schedule_slots slot_row on slot_row.id = legacy.schedule_slot_id
    join public.branches branch_row on branch_row.id = slot_row.branch_id
    left join public.course_types course_row on course_row.id = slot_row.course_type_id
    where legacy.coach_id = p_coach_id
      and legacy.schedule_slot_id <> p_schedule_slot_id
      and slot_row.date = target_slot.date
      and slot_row.start_time < target_slot.end_time
      and target_slot.start_time < slot_row.end_time
      and not exists (
        select 1
        from public.coach_assignment_groups exact_group
        where exact_group.coach_id = p_coach_id
          and exact_group.schedule_slot_id = legacy.schedule_slot_id
          and public.is_exact_coach_assignment_group_active_v1(exact_group.id)
      )
  ) legacy_row;

  return jsonb_build_object(
    'exact_conflicts', exact_rows,
    'legacy_warnings', legacy_rows
  );
end;
$$;

revoke all on function public.get_coach_assignment_conflicts_v1(uuid, uuid, uuid[], boolean) from public, anon, authenticated;
grant execute on function public.get_coach_assignment_conflicts_v1(uuid, uuid, uuid[], boolean) to service_role;

create or replace function public.sync_coach_assignment_exact_reservation_v1(p_group_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  group_row public.coach_assignment_groups%rowtype;
  slot_row public.schedule_slots%rowtype;
  conflict_result jsonb;
  conflict_row jsonb;
begin
  select * into group_row from public.coach_assignment_groups where id = p_group_id;

  if group_row.id is null or not public.is_exact_coach_assignment_group_active_v1(p_group_id) then
    delete from public.coach_assignment_exact_reservations where group_id = p_group_id;
    return;
  end if;

  select * into slot_row from public.schedule_slots where id = group_row.schedule_slot_id;

  if slot_row.date < (now() at time zone 'Asia/Bangkok')::date then
    delete from public.coach_assignment_exact_reservations where group_id = p_group_id;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    concat(group_row.coach_id::text, '|', slot_row.date::text),
    0
  ));
  conflict_result := public.get_coach_assignment_conflicts_v1(
    group_row.coach_id,
    group_row.schedule_slot_id,
    array[group_row.id],
    false
  );
  conflict_row := conflict_result -> 'exact_conflicts' -> 0;

  if conflict_row is not null then
    raise exception using
      errcode = '23P01',
      message = concat(
        'COACH_ASSIGNMENT_CONFLICT|',
        conflict_row ->> 'date', '|',
        conflict_row ->> 'start_time', '|',
        conflict_row ->> 'end_time', '|',
        conflict_row ->> 'branch_name', '|',
        conflict_row ->> 'group_name', '|',
        conflict_row ->> 'group_id'
      );
  end if;

  insert into public.coach_assignment_exact_reservations (
    group_id, coach_id, schedule_slot_id, teaching_date, teaching_time_range, updated_at
  ) values (
    group_row.id,
    group_row.coach_id,
    group_row.schedule_slot_id,
    slot_row.date,
    tstzrange(
      (slot_row.date + slot_row.start_time) at time zone 'Asia/Bangkok',
      (slot_row.date + slot_row.end_time) at time zone 'Asia/Bangkok',
      '[)'
    ),
    now()
  )
  on conflict (group_id) do update set
    coach_id = excluded.coach_id,
    schedule_slot_id = excluded.schedule_slot_id,
    teaching_date = excluded.teaching_date,
    teaching_time_range = excluded.teaching_time_range,
    updated_at = now();
exception
  when exclusion_violation then
    raise exception using
      errcode = '23P01',
      message = 'COACH_ASSIGNMENT_CONFLICT|มีการมอบหมายโค้ชคนนี้ในช่วงเวลาทับกันจากคำสั่งพร้อมกัน';
end;
$$;

revoke all on function public.sync_coach_assignment_exact_reservation_v1(uuid) from public, anon, authenticated;
grant execute on function public.sync_coach_assignment_exact_reservation_v1(uuid) to service_role;

create or replace function public.enforce_coach_assignment_group_reservation_v1()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.sync_coach_assignment_exact_reservation_v1(new.id);
  return new;
end;
$$;

create or replace function public.enforce_coach_assignment_slot_reservations_v1()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  affected_group_id uuid;
begin
  for affected_group_id in
    select group_row.id
    from public.coach_assignment_groups group_row
    where group_row.schedule_slot_id = new.id
  loop
    perform public.sync_coach_assignment_exact_reservation_v1(affected_group_id);
  end loop;
  return new;
end;
$$;

create or replace function public.enforce_coach_assignment_session_reservations_v1()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  affected_group_id uuid;
begin
  for affected_group_id in
    select distinct member.group_id
    from public.coach_assignment_group_students member
    where member.booking_session_id = new.id
  loop
    perform public.sync_coach_assignment_exact_reservation_v1(affected_group_id);
  end loop;
  return new;
end;
$$;

create or replace function public.enforce_coach_assignment_booking_reservations_v1()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  affected_group_id uuid;
begin
  for affected_group_id in
    select distinct member.group_id
    from public.booking_sessions session_row
    join public.coach_assignment_group_students member
      on member.booking_session_id = session_row.id
    where session_row.booking_id = new.id
  loop
    perform public.sync_coach_assignment_exact_reservation_v1(affected_group_id);
  end loop;
  return new;
end;
$$;

create or replace function public.enforce_coach_assignment_member_reservation_v1()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_coach_assignment_exact_reservation_v1(old.group_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.group_id is distinct from new.group_id then
    perform public.sync_coach_assignment_exact_reservation_v1(old.group_id);
  end if;
  perform public.sync_coach_assignment_exact_reservation_v1(new.group_id);
  return new;
end;
$$;

drop trigger if exists enforce_coach_assignment_group_reservation_v1 on public.coach_assignment_groups;
create trigger enforce_coach_assignment_group_reservation_v1
after insert or update of coach_id, schedule_slot_id on public.coach_assignment_groups
for each row execute function public.enforce_coach_assignment_group_reservation_v1();

drop trigger if exists enforce_coach_assignment_member_reservation_v1 on public.coach_assignment_group_students;
create trigger enforce_coach_assignment_member_reservation_v1
after insert or update or delete on public.coach_assignment_group_students
for each row execute function public.enforce_coach_assignment_member_reservation_v1();

drop trigger if exists enforce_coach_assignment_slot_reservations_v1 on public.schedule_slots;
create trigger enforce_coach_assignment_slot_reservations_v1
after update of date, start_time, end_time on public.schedule_slots
for each row execute function public.enforce_coach_assignment_slot_reservations_v1();

drop trigger if exists enforce_coach_assignment_session_reservations_v1 on public.booking_sessions;
create trigger enforce_coach_assignment_session_reservations_v1
after update of status, booking_id, schedule_slot_id on public.booking_sessions
for each row execute function public.enforce_coach_assignment_session_reservations_v1();

drop trigger if exists enforce_coach_assignment_booking_reservations_v1 on public.bookings;
create trigger enforce_coach_assignment_booking_reservations_v1
after update of status on public.bookings
for each row execute function public.enforce_coach_assignment_booking_reservations_v1();

create or replace function public.preflight_coach_assignment_conflicts_v1()
returns table (
  coach_id uuid,
  group_id uuid,
  conflicting_group_id uuid,
  schedule_slot_id uuid,
  conflicting_schedule_slot_id uuid,
  teaching_date date,
  start_time time,
  end_time time,
  conflicting_start_time time,
  conflicting_end_time time
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    first_group.coach_id,
    first_group.id,
    second_group.id,
    first_slot.id,
    second_slot.id,
    first_slot.date,
    first_slot.start_time,
    first_slot.end_time,
    second_slot.start_time,
    second_slot.end_time
  from public.coach_assignment_groups first_group
  join public.schedule_slots first_slot on first_slot.id = first_group.schedule_slot_id
  join public.coach_assignment_groups second_group
    on second_group.coach_id = first_group.coach_id
   and second_group.id > first_group.id
  join public.schedule_slots second_slot on second_slot.id = second_group.schedule_slot_id
  where first_group.coach_id is not null
    and first_slot.date = second_slot.date
    and first_slot.date >= (now() at time zone 'Asia/Bangkok')::date
    and first_slot.start_time < second_slot.end_time
    and second_slot.start_time < first_slot.end_time
    and public.is_exact_coach_assignment_group_active_v1(first_group.id)
    and public.is_exact_coach_assignment_group_active_v1(second_group.id);
$$;

revoke all on function public.preflight_coach_assignment_conflicts_v1() from public, anon, authenticated;
grant execute on function public.preflight_coach_assignment_conflicts_v1() to service_role;

create or replace function public.backfill_coach_assignment_exact_reservations_v1()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  candidate_group_id uuid;
  protected_group_count integer := 0;
begin
  if exists (select 1 from public.preflight_coach_assignment_conflicts_v1()) then
    raise exception using
      errcode = '23P01',
      message = 'COACH_ASSIGNMENT_PREFLIGHT_CONFLICT|current_or_future_exact_conflicts_exist';
  end if;

  delete from public.coach_assignment_exact_reservations reservation
  where not exists (
    select 1
    from public.coach_assignment_groups group_row
    join public.schedule_slots slot_row on slot_row.id = group_row.schedule_slot_id
    where group_row.id = reservation.group_id
      and slot_row.date >= (now() at time zone 'Asia/Bangkok')::date
      and public.is_exact_coach_assignment_group_active_v1(group_row.id)
  );

  for candidate_group_id in
    select group_row.id
    from public.coach_assignment_groups group_row
    join public.schedule_slots slot_row on slot_row.id = group_row.schedule_slot_id
    where slot_row.date >= (now() at time zone 'Asia/Bangkok')::date
      and public.is_exact_coach_assignment_group_active_v1(group_row.id)
    order by slot_row.date, slot_row.start_time, group_row.id
  loop
    perform public.sync_coach_assignment_exact_reservation_v1(candidate_group_id);
    protected_group_count := protected_group_count + 1;
  end loop;

  return protected_group_count;
end;
$$;

revoke all on function public.backfill_coach_assignment_exact_reservations_v1() from public, anon, authenticated;
grant execute on function public.backfill_coach_assignment_exact_reservations_v1() to service_role;

do $$
begin
  if exists (select 1 from public.preflight_coach_assignment_conflicts_v1()) then
    raise exception using
      errcode = '23P01',
      message = 'COACH_ASSIGNMENT_PREFLIGHT_CONFLICT|run scripts/preflight-coach-assignment-conflicts.sql before applying';
  end if;

  perform public.backfill_coach_assignment_exact_reservations_v1();
end;
$$;

create or replace function public.save_coach_assignment_groups_v1(
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
  group_payload jsonb;
  session_id_text text;
  inserted_group_id uuid;
  inserted_groups jsonb := '[]'::jsonb;
  assigned_coach_ids uuid[] := '{}'::uuid[];
  group_index integer := 0;
  group_coach_id uuid;
  group_sort_order integer;
  session_row record;
begin
  if jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) = 0 then
    raise exception 'ต้องมีอย่างน้อย 1 กลุ่ม';
  end if;

  perform 1 from public.schedule_slots where id = p_schedule_slot_id for update;
  if not found then raise exception 'ไม่พบรอบเรียน'; end if;

  if exists (
    select 1
    from jsonb_array_elements(p_groups) payload
    where nullif(payload ->> 'coachId', '') is not null
    group by payload ->> 'coachId'
    having count(*) > 1
  ) then
    raise exception 'โค้ช 1 คนไม่สามารถรับผิดชอบหลายกลุ่มในรอบเวลาเดียวกันได้';
  end if;

  delete from public.coach_assignment_groups where schedule_slot_id = p_schedule_slot_id;
  delete from public.coach_assignments where schedule_slot_id = p_schedule_slot_id;

  for group_payload in select value from jsonb_array_elements(p_groups)
  loop
    group_coach_id := nullif(group_payload ->> 'coachId', '')::uuid;
    group_sort_order := coalesce(nullif(group_payload ->> 'sortOrder', '')::integer, group_index);

    insert into public.coach_assignment_groups (
      schedule_slot_id, coach_id, name, level_min, level_max, sort_order, notes, created_by
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
      select value #>> '{}' from jsonb_array_elements(coalesce(group_payload -> 'studentSessionIds', '[]'::jsonb))
    loop
      select
        session_item.id,
        session_item.child_id,
        booking_item.user_id,
        booking_item.status as booking_status
      into session_row
      from public.booking_sessions session_item
      join public.bookings booking_item on booking_item.id = session_item.booking_id
      where session_item.id = session_id_text::uuid
        and session_item.schedule_slot_id = p_schedule_slot_id;

      if session_row.id is null then
        raise exception 'พบผู้เรียนที่ไม่ได้อยู่ในรอบสอนนี้';
      end if;
      if session_row.booking_status <> 'verified' then
        raise exception 'การจองยังไม่ยืนยันการชำระเงิน';
      end if;

      insert into public.coach_assignment_group_students (
        group_id, booking_session_id, student_id, student_type
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

    inserted_groups := inserted_groups || jsonb_build_array(jsonb_build_object(
      'id', inserted_group_id,
      'sort_order', group_sort_order,
      'coach_id', group_coach_id
    ));
    group_index := group_index + 1;
  end loop;

  if cardinality(assigned_coach_ids) > 0 then
    insert into public.coach_assignments (coach_id, schedule_slot_id, assigned_by)
    select unnest(assigned_coach_ids), p_schedule_slot_id, p_actor_id
    on conflict (coach_id, schedule_slot_id) do nothing;
  end if;

  return jsonb_build_object(
    'groups', inserted_groups,
    'coach_ids', to_jsonb(assigned_coach_ids)
  );
end;
$$;

revoke all on function public.save_coach_assignment_groups_v1(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_coach_assignment_groups_v1(uuid, uuid, jsonb) to service_role;

create or replace function public.create_exact_coach_assignment_group_v1(
  p_schedule_slot_id uuid,
  p_coach_id uuid,
  p_name text,
  p_sort_order integer,
  p_notes text,
  p_actor_id uuid,
  p_booking_session_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  inserted_group_id uuid;
  session_id uuid;
  session_row record;
begin
  if p_coach_id is null or cardinality(coalesce(p_booking_session_ids, '{}'::uuid[])) = 0 then
    raise exception 'ต้องระบุโค้ชและผู้เรียนอย่างน้อยหนึ่งคน';
  end if;

  perform 1 from public.schedule_slots where id = p_schedule_slot_id for update;
  if not found then raise exception 'ไม่พบรอบเรียน'; end if;

  insert into public.coach_assignment_groups (
    schedule_slot_id, coach_id, name, level_min, level_max, sort_order, notes, created_by
  ) values (
    p_schedule_slot_id,
    p_coach_id,
    coalesce(nullif(btrim(p_name), ''), 'กลุ่มมอบหมายโดย Admin'),
    null,
    null,
    coalesce(p_sort_order, 999),
    p_notes,
    p_actor_id
  ) returning id into inserted_group_id;

  foreach session_id in array p_booking_session_ids
  loop
    select
      session_item.id,
      session_item.child_id,
      booking_item.user_id,
      booking_item.status as booking_status
    into session_row
    from public.booking_sessions session_item
    join public.bookings booking_item on booking_item.id = session_item.booking_id
    where session_item.id = session_id
      and session_item.schedule_slot_id = p_schedule_slot_id;

    if session_row.id is null then raise exception 'พบผู้เรียนที่ไม่ได้อยู่ในรอบสอนนี้'; end if;
    if session_row.booking_status <> 'verified' then raise exception 'การจองยังไม่ยืนยันการชำระเงิน'; end if;

    insert into public.coach_assignment_group_students (
      group_id, booking_session_id, student_id, student_type
    ) values (
      inserted_group_id,
      session_row.id,
      coalesce(session_row.child_id, session_row.user_id),
      (case when session_row.child_id is null then 'adult' else 'child' end)::public.student_type
    );
  end loop;

  return inserted_group_id;
end;
$$;

revoke all on function public.create_exact_coach_assignment_group_v1(uuid, uuid, text, integer, text, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.create_exact_coach_assignment_group_v1(uuid, uuid, text, integer, text, uuid, uuid[]) to service_role;
