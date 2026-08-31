-- Permanent Admin retrospective coach-assignment integrity.
-- Additive only: existing v1/v2 assignment functions remain available for the
-- currently active application and rollback artifacts. This migration performs
-- no customer-data DML when applied.

alter table public.coach_assignment_groups
  add column if not exists admin_retrospective_preserved_name boolean not null default false;

alter table public.coach_assignment_groups
  drop constraint if exists coach_assignment_exact_group_name_check;

alter table public.coach_assignment_groups
  add constraint coach_assignment_exact_group_name_check
  check (
    coach_id is null
    or admin_retrospective_preserved_name
    or (
      btrim(name) <> ''
      and btrim(name) <> 'ยังไม่จัดกลุ่ม'
      and name !~ '\s*\(\s*\d+\s*คน\s*\)\s*$'
    )
  );

create or replace function public.admin_apply_retrospective_assignment_transition_v1(
  p_operation text,
  p_schedule_slot_id uuid,
  p_actor_id uuid,
  p_coach_id uuid,
  p_booking_session_ids uuid[],
  p_target_group_id uuid default null,
  p_reason text default null,
  p_attendance_by_session_id jsonb default '{}'::jsonb,
  p_test_fail_stage text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  slot_row public.schedule_slots%rowtype;
  actor_role text;
  coach_role text;
  target_session_ids uuid[] := '{}'::uuid[];
  submitted_count integer := 0;
  unique_count integer := 0;
  locked_session_count integer := 0;
  target_membership_count integer := 0;
  target_group_ids uuid[] := '{}'::uuid[];
  candidate_group_id uuid;
  source_group_id uuid;
  result_group_id uuid;
  candidate_group public.coach_assignment_groups%rowtype;
  source_group public.coach_assignment_groups%rowtype;
  move_target_group public.coach_assignment_groups%rowtype;
  session_row record;
  attendance_row public.attendance%rowtype;
  attendance_count integer;
  desired_attendance public.attendance_status;
  desired_session_status public.session_status;
  before_snapshot jsonb;
  after_snapshot jsonb;
  conflict_result jsonb;
  conflict_row jsonb;
  legacy_warnings jsonb := '[]'::jsonb;
  affected_old_coach_ids uuid[] := '{}'::uuid[];
  activity_id uuid;
  activity_created_at timestamptz;
  changed boolean := false;
  assignment_changed boolean := false;
  attendance_changed boolean := false;
  status_changed boolean := false;
  legacy_changed boolean := false;
  inserted_count integer := 0;
  deleted_count integer := 0;
  default_group_name text;
begin
  if p_operation not in (
    'assign_coach_to_round',
    'resolve_unassigned_round',
    'mark_attendance',
    'replace_coach_for_past_round',
    'move_learner_to_existing_coach_group'
  ) then
    raise exception using
      errcode = '22023',
      message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|unsupported_operation';
  end if;

  if p_schedule_slot_id is null or p_actor_id is null or p_coach_id is null then
    raise exception using
      errcode = '22023',
      message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|required_identity_missing';
  end if;

  select profile.role into actor_role
  from public.profiles profile
  where profile.id = p_actor_id;
  if actor_role is null or actor_role not in ('admin', 'super_admin') then
    raise exception using
      errcode = '42501',
      message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|actor_not_admin';
  end if;

  select profile.role into coach_role
  from public.profiles profile
  where profile.id = p_coach_id;
  if coach_role is null or coach_role not in ('coach', 'head_coach') then
    raise exception using
      errcode = '22023',
      message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|coach_invalid';
  end if;

  select count(*), count(distinct session_id),
    coalesce(array_agg(distinct session_id order by session_id), '{}'::uuid[])
  into submitted_count, unique_count, target_session_ids
  from unnest(coalesce(p_booking_session_ids, '{}'::uuid[])) session_id;

  if submitted_count = 0 then
    raise exception using
      errcode = '22023',
      message = 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT|target_roster_empty';
  end if;
  if submitted_count <> unique_count then
    raise exception using
      errcode = '23505',
      message = 'ADMIN_RETRO_ASSIGNMENT_DUPLICATE|duplicate_submitted_session';
  end if;
  if p_operation = 'mark_attendance' and unique_count <> 1 then
    raise exception using
      errcode = '22023',
      message = 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT|mark_attendance_requires_one_session';
  end if;
  if p_operation = 'move_learner_to_existing_coach_group' and p_target_group_id is null then
    raise exception using
      errcode = '22023',
      message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|move_target_group_missing';
  end if;
  if p_operation <> 'move_learner_to_existing_coach_group' and p_target_group_id is not null then
    raise exception using
      errcode = '22023',
      message = 'ADMIN_RETRO_ASSIGNMENT_STALE_STATE|unexpected_target_group';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    concat('admin-retrospective-assignment|', p_schedule_slot_id::text),
    0
  ));

  select * into slot_row
  from public.schedule_slots
  where id = p_schedule_slot_id
  for update;
  if slot_row.id is null then
    raise exception using
      errcode = 'P0001',
      message = 'ADMIN_RETRO_ASSIGNMENT_STALE_STATE|schedule_slot_missing';
  end if;

  perform 1
  from public.booking_sessions session_item
  where session_item.id = any(target_session_ids)
  order by session_item.id
  for update;
  get diagnostics locked_session_count = row_count;
  if locked_session_count <> unique_count then
    raise exception using
      errcode = 'P0001',
      message = 'ADMIN_RETRO_ASSIGNMENT_STALE_STATE|submitted_session_missing';
  end if;

  perform 1
  from public.bookings booking_item
  where booking_item.id in (
    select session_item.booking_id
    from public.booking_sessions session_item
    where session_item.id = any(target_session_ids)
  )
  order by booking_item.id
  for update;

  for session_row in
    select
      session_item.*,
      booking_item.user_id as booking_user_id,
      booking_item.branch_id as booking_branch_id,
      booking_item.course_type_id as booking_course_type_id,
      booking_item.status as booking_status,
      coalesce(session_item.child_id, booking_item.user_id) as expected_student_id,
      case when session_item.child_id is null then 'adult' else 'child' end as expected_student_type
    from public.booking_sessions session_item
    join public.bookings booking_item on booking_item.id = session_item.booking_id
    where session_item.id = any(target_session_ids)
    order by session_item.id
  loop
    if session_row.schedule_slot_id is distinct from p_schedule_slot_id
      or session_row.branch_id is distinct from slot_row.branch_id
      or session_row.booking_branch_id is distinct from slot_row.branch_id
      or session_row.booking_course_type_id is distinct from slot_row.course_type_id
      or session_row.date is distinct from slot_row.date
      or session_row.start_time is distinct from slot_row.start_time
      or session_row.end_time is distinct from slot_row.end_time then
      raise exception using
        errcode = 'P0001',
        message = 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT|slot_branch_course_or_time_mismatch';
    end if;
    if session_row.expected_student_id is null then
      raise exception using
        errcode = 'P0001',
        message = 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT|learner_identity_missing';
    end if;
    if session_row.booking_status <> 'verified' then
      raise exception using
        errcode = 'P0001',
        message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|booking_not_verified';
    end if;
    if session_row.is_makeup then
      raise exception using
        errcode = 'P0001',
        message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|makeup_session_ineligible';
    end if;
    if session_row.status not in ('scheduled', 'completed', 'absent') then
      raise exception using
        errcode = 'P0001',
        message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|session_status_ineligible';
    end if;
  end loop;

  if p_operation in (
    'assign_coach_to_round',
    'resolve_unassigned_round',
    'mark_attendance',
    'replace_coach_for_past_round'
  ) and ((slot_row.date + slot_row.end_time) at time zone 'Asia/Bangkok') >= now() then
    raise exception using
      errcode = 'P0001',
      message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|round_not_ended';
  end if;

  if p_operation in ('resolve_unassigned_round', 'mark_attendance') then
    if jsonb_typeof(coalesce(p_attendance_by_session_id, '{}'::jsonb)) <> 'object'
      or (select count(*) from jsonb_object_keys(coalesce(p_attendance_by_session_id, '{}'::jsonb))) <> unique_count
      or exists (
        select 1
        from jsonb_object_keys(coalesce(p_attendance_by_session_id, '{}'::jsonb)) attendance_key
        where attendance_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      )
      or exists (
        select 1
        from jsonb_object_keys(coalesce(p_attendance_by_session_id, '{}'::jsonb)) attendance_key
        where attendance_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          and not (attendance_key::uuid = any(target_session_ids))
      )
      or exists (
        select 1
        from unnest(target_session_ids) target_id
        where coalesce(p_attendance_by_session_id ->> target_id::text, '') not in ('present', 'late', 'absent')
      ) then
      raise exception using
        errcode = '22023',
        message = 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT|attendance_roster_or_status_invalid';
    end if;
  elsif coalesce(p_attendance_by_session_id, '{}'::jsonb) <> '{}'::jsonb then
    raise exception using
      errcode = '22023',
      message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|attendance_not_allowed_for_operation';
  end if;

  perform 1
  from public.coach_assignment_groups group_item
  where group_item.schedule_slot_id = p_schedule_slot_id
  order by group_item.id
  for update;

  perform 1
  from public.coach_assignment_group_students member_item
  join public.coach_assignment_groups group_item on group_item.id = member_item.group_id
  where group_item.schedule_slot_id = p_schedule_slot_id
  order by member_item.id
  for update of member_item;

  if exists (
    select 1
    from public.coach_assignment_group_students member_item
    join public.coach_assignment_groups group_item on group_item.id = member_item.group_id
    join public.booking_sessions session_item on session_item.id = member_item.booking_session_id
    join public.bookings booking_item on booking_item.id = session_item.booking_id
    where member_item.booking_session_id = any(target_session_ids)
      and (
        group_item.schedule_slot_id is distinct from p_schedule_slot_id
        or member_item.student_id is distinct from coalesce(session_item.child_id, booking_item.user_id)
        or member_item.student_type::text is distinct from case when session_item.child_id is null then 'adult' else 'child' end
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT|membership_identity_mismatch';
  end if;

  select count(*),
    coalesce(array_agg(distinct member_item.group_id order by member_item.group_id), '{}'::uuid[])
  into target_membership_count, target_group_ids
  from public.coach_assignment_group_students member_item
  where member_item.booking_session_id = any(target_session_ids);

  if p_operation = 'move_learner_to_existing_coach_group' then
    select * into move_target_group
    from public.coach_assignment_groups group_item
    where group_item.id = p_target_group_id;
    if move_target_group.id is null
      or move_target_group.schedule_slot_id is distinct from p_schedule_slot_id
      or move_target_group.coach_id is distinct from p_coach_id then
      raise exception using
        errcode = 'P0001',
        message = 'ADMIN_RETRO_ASSIGNMENT_STALE_STATE|move_target_group_changed';
    end if;

    if not exists (
      select 1 from public.coach_assignment_group_students member_item
      where member_item.group_id = move_target_group.id
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|move_target_group_empty';
    end if;

    if exists (
      select 1
      from public.attendance attendance_item
      join public.booking_sessions session_item on session_item.id = attendance_item.booking_session_id
      join public.bookings booking_item on booking_item.id = session_item.booking_id
      where attendance_item.booking_session_id = any(target_session_ids)
        and attendance_item.student_id = coalesce(session_item.child_id, booking_item.user_id)
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|move_attendance_exists';
    end if;

    if exists (
      select 1
      from public.coach_assignment_group_students member_item
      join public.booking_sessions session_item on session_item.id = member_item.booking_session_id
      join public.bookings booking_item on booking_item.id = session_item.booking_id
      where member_item.group_id = move_target_group.id
        and (
          session_item.schedule_slot_id is distinct from p_schedule_slot_id
          or session_item.branch_id is distinct from slot_row.branch_id
          or booking_item.course_type_id is distinct from slot_row.course_type_id
          or booking_item.status <> 'verified'
          or session_item.is_makeup
          or session_item.status not in ('scheduled', 'completed', 'absent')
          or member_item.student_id is distinct from coalesce(session_item.child_id, booking_item.user_id)
        )
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT|move_target_group_invalid';
    end if;

    if target_membership_count = unique_count
      and cardinality(target_group_ids) = 1
      and target_group_ids[1] = move_target_group.id then
      result_group_id := move_target_group.id;
    elsif target_membership_count = 0 then
      result_group_id := move_target_group.id;
    elsif target_membership_count = unique_count and cardinality(target_group_ids) = 1 then
      source_group_id := target_group_ids[1];
      select * into source_group
      from public.coach_assignment_groups group_item
      where group_item.id = source_group_id;
      if source_group.schedule_slot_id is distinct from p_schedule_slot_id
        or source_group.id = move_target_group.id then
        raise exception using
          errcode = 'P0001',
          message = 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT|invalid_source_group';
      end if;
      result_group_id := move_target_group.id;
    else
      raise exception using
        errcode = 'P0001',
        message = 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT|target_spans_or_partially_matches_groups';
    end if;
  else
    if target_membership_count = 0 then
      candidate_group_id := null;
    elsif target_membership_count <> unique_count or cardinality(target_group_ids) <> 1 then
      raise exception using
        errcode = 'P0001',
        message = 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT|target_spans_or_partially_matches_groups';
    else
      candidate_group_id := target_group_ids[1];
      select * into candidate_group
      from public.coach_assignment_groups group_item
      where group_item.id = candidate_group_id;
      if candidate_group.schedule_slot_id is distinct from p_schedule_slot_id
        or (select count(*) from public.coach_assignment_group_students member_item where member_item.group_id = candidate_group_id) <> unique_count
        or exists (
          select 1 from public.coach_assignment_group_students member_item
          where member_item.group_id = candidate_group_id
            and not (member_item.booking_session_id = any(target_session_ids))
        ) then
        raise exception using
          errcode = 'P0001',
          message = 'ADMIN_RETRO_ASSIGNMENT_ROSTER_CONFLICT|partial_target_group';
      end if;

      if p_operation in ('assign_coach_to_round', 'resolve_unassigned_round', 'mark_attendance')
        and candidate_group.coach_id is not null
        and candidate_group.coach_id is distinct from p_coach_id then
        raise exception using
          errcode = 'P0001',
          message = 'ADMIN_RETRO_ASSIGNMENT_LIFECYCLE_CONFLICT|assigned_target_requires_replace';
      end if;
    end if;
    result_group_id := candidate_group_id;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    concat(p_coach_id::text, '|', slot_row.date::text),
    0
  ));
  conflict_result := public.get_coach_assignment_conflicts_v1(
    p_coach_id,
    p_schedule_slot_id,
    case
      when p_operation = 'move_learner_to_existing_coach_group' and source_group_id is not null
        then array[move_target_group.id, source_group_id]
      when p_operation = 'move_learner_to_existing_coach_group'
        then array[move_target_group.id]
      when candidate_group_id is not null
        then array[candidate_group_id]
      else '{}'::uuid[]
    end,
    false
  );
  conflict_row := conflict_result -> 'exact_conflicts' -> 0;
  legacy_warnings := coalesce(conflict_result -> 'legacy_warnings', '[]'::jsonb);
  if conflict_row is not null then
    raise exception using
      errcode = '23P01',
      message = concat(
        'ADMIN_RETRO_ASSIGNMENT_COACH_CONFLICT|',
        conflict_row ->> 'date', '|',
        conflict_row ->> 'start_time', '|',
        conflict_row ->> 'end_time', '|',
        conflict_row ->> 'branch_name', '|',
        conflict_row ->> 'group_name', '|',
        conflict_row ->> 'group_id'
      );
  end if;

  if p_operation in ('resolve_unassigned_round', 'mark_attendance') then
    perform 1
    from public.attendance attendance_item
    join public.booking_sessions session_item on session_item.id = attendance_item.booking_session_id
    join public.bookings booking_item on booking_item.id = session_item.booking_id
    where attendance_item.booking_session_id = any(target_session_ids)
      and attendance_item.student_id = coalesce(session_item.child_id, booking_item.user_id)
    order by attendance_item.booking_session_id, attendance_item.student_id, attendance_item.id
    for update of attendance_item;
  end if;

  select jsonb_build_object(
    'groups', coalesce((
      select jsonb_agg(to_jsonb(group_item) order by group_item.id)
      from public.coach_assignment_groups group_item
      where group_item.schedule_slot_id = p_schedule_slot_id
    ), '[]'::jsonb),
    'memberships', coalesce((
      select jsonb_agg(to_jsonb(member_item) order by member_item.id)
      from public.coach_assignment_group_students member_item
      join public.coach_assignment_groups group_item on group_item.id = member_item.group_id
      where group_item.schedule_slot_id = p_schedule_slot_id
    ), '[]'::jsonb),
    'legacyAssignments', coalesce((
      select jsonb_agg(to_jsonb(legacy_item) order by legacy_item.id)
      from public.coach_assignments legacy_item
      where legacy_item.schedule_slot_id = p_schedule_slot_id
    ), '[]'::jsonb),
    'exactReservations', coalesce((
      select jsonb_agg(to_jsonb(reservation_item) order by reservation_item.group_id)
      from public.coach_assignment_exact_reservations reservation_item
      where reservation_item.schedule_slot_id = p_schedule_slot_id
    ), '[]'::jsonb),
    'attendance', coalesce((
      select jsonb_agg(to_jsonb(attendance_item) order by attendance_item.booking_session_id, attendance_item.student_id, attendance_item.id)
      from public.attendance attendance_item
      where attendance_item.booking_session_id = any(target_session_ids)
    ), '[]'::jsonb),
    'sessionStatuses', coalesce((
      select jsonb_agg(jsonb_build_object('id', session_item.id, 'status', session_item.status) order by session_item.id)
      from public.booking_sessions session_item
      where session_item.id = any(target_session_ids)
    ), '[]'::jsonb)
  ) into before_snapshot;

  if p_operation = 'move_learner_to_existing_coach_group' then
    if target_membership_count = 0 then
      insert into public.coach_assignment_group_students (
        group_id, booking_session_id, student_id, student_type
      )
      select
        move_target_group.id,
        session_item.id,
        coalesce(session_item.child_id, booking_item.user_id),
        (case when session_item.child_id is null then 'adult' else 'child' end)::public.student_type
      from public.booking_sessions session_item
      join public.bookings booking_item on booking_item.id = session_item.booking_id
      where session_item.id = any(target_session_ids)
      order by session_item.id;
      assignment_changed := true;
    elsif source_group_id is not null then
      if source_group.coach_id is not null then
        affected_old_coach_ids := array_append(affected_old_coach_ids, source_group.coach_id);
      end if;
      update public.coach_assignment_group_students member_item
      set group_id = move_target_group.id
      where member_item.group_id = source_group_id
        and member_item.booking_session_id = any(target_session_ids);
      if not exists (select 1 from public.coach_assignment_group_students member_item where member_item.group_id = source_group_id) then
        delete from public.coach_assignment_groups group_item where group_item.id = source_group_id;
      end if;
      assignment_changed := true;
    end if;
  elsif candidate_group_id is null then
    default_group_name := case p_operation
      when 'replace_coach_for_past_round' then 'เปลี่ยนโค้ชย้อนหลังโดย Admin'
      when 'resolve_unassigned_round' then 'บันทึกย้อนหลังทั้งรอบโดย Admin'
      when 'mark_attendance' then 'บันทึกย้อนหลังโดย Admin'
      else 'มอบหมายโค้ชย้อนหลังทั้งรอบโดย Admin'
    end;
    insert into public.coach_assignment_groups (
      schedule_slot_id, coach_id, name, level_min, level_max, sort_order, notes, created_by
    ) values (
      p_schedule_slot_id,
      p_coach_id,
      default_group_name,
      null,
      null,
      999,
      nullif(btrim(coalesce(p_reason, '')), ''),
      p_actor_id
    ) returning id into result_group_id;
    assignment_changed := true;

    if p_test_fail_stage = 'after_group_write' then
      raise exception 'ADMIN_RETRO_ASSIGNMENT_TEST_FAILURE|after_group_write';
    end if;

    insert into public.coach_assignment_group_students (
      group_id, booking_session_id, student_id, student_type
    )
    select
      result_group_id,
      session_item.id,
      coalesce(session_item.child_id, booking_item.user_id),
      (case when session_item.child_id is null then 'adult' else 'child' end)::public.student_type
    from public.booking_sessions session_item
    join public.bookings booking_item on booking_item.id = session_item.booking_id
    where session_item.id = any(target_session_ids)
    order by session_item.id;
  else
    result_group_id := candidate_group_id;
    if candidate_group.coach_id is distinct from p_coach_id then
      if candidate_group.coach_id is not null then
        affected_old_coach_ids := array_append(affected_old_coach_ids, candidate_group.coach_id);
      end if;
      update public.coach_assignment_groups group_item
      set
        coach_id = p_coach_id,
        admin_retrospective_preserved_name = case
          when btrim(group_item.name) = ''
            or btrim(group_item.name) = 'ยังไม่จัดกลุ่ม'
            or group_item.name ~ '\s*\(\s*\d+\s*คน\s*\)\s*$'
            then true
          else group_item.admin_retrospective_preserved_name
        end
      where group_item.id = candidate_group_id;
      assignment_changed := true;
    end if;
  end if;

  if p_test_fail_stage = 'after_membership_write' then
    raise exception 'ADMIN_RETRO_ASSIGNMENT_TEST_FAILURE|after_membership_write';
  end if;

  insert into public.coach_assignments (coach_id, schedule_slot_id, assigned_by)
  values (p_coach_id, p_schedule_slot_id, p_actor_id)
  on conflict (coach_id, schedule_slot_id) do nothing;
  get diagnostics inserted_count = row_count;
  legacy_changed := inserted_count > 0;

  if cardinality(affected_old_coach_ids) > 0 then
    delete from public.coach_assignments legacy_item
    where legacy_item.schedule_slot_id = p_schedule_slot_id
      and legacy_item.coach_id = any(affected_old_coach_ids)
      and not exists (
        select 1
        from public.coach_assignment_groups group_item
        join public.coach_assignment_group_students member_item on member_item.group_id = group_item.id
        where group_item.schedule_slot_id = p_schedule_slot_id
          and group_item.coach_id = legacy_item.coach_id
      );
    get diagnostics deleted_count = row_count;
    legacy_changed := legacy_changed or deleted_count > 0;
  end if;

  if p_test_fail_stage = 'after_legacy_write' then
    raise exception 'ADMIN_RETRO_ASSIGNMENT_TEST_FAILURE|after_legacy_write';
  end if;

  if p_test_fail_stage = 'after_reservation_sync' then
    raise exception 'ADMIN_RETRO_ASSIGNMENT_TEST_FAILURE|after_reservation_sync';
  end if;

  if p_operation in ('resolve_unassigned_round', 'mark_attendance') then
    for session_row in
      select
        session_item.*,
        booking_item.user_id as booking_user_id,
        coalesce(session_item.child_id, booking_item.user_id) as expected_student_id,
        case when session_item.child_id is null then 'adult' else 'child' end as expected_student_type
      from public.booking_sessions session_item
      join public.bookings booking_item on booking_item.id = session_item.booking_id
      where session_item.id = any(target_session_ids)
      order by session_item.id
    loop
      desired_attendance := (p_attendance_by_session_id ->> session_row.id::text)::public.attendance_status;
      desired_session_status := case
        when desired_attendance = 'absent' then 'absent'::public.session_status
        else 'completed'::public.session_status
      end;

      select count(*) into attendance_count
      from public.attendance attendance_item
      where attendance_item.booking_session_id = session_row.id
        and attendance_item.student_id = session_row.expected_student_id;
      if attendance_count > 1 then
        raise exception using
          errcode = '23505',
          message = 'ADMIN_RETRO_ASSIGNMENT_DUPLICATE|multiple_exact_attendance_rows';
      end if;

      select * into attendance_row
      from public.attendance attendance_item
      where attendance_item.booking_session_id = session_row.id
        and attendance_item.student_id = session_row.expected_student_id
      order by attendance_item.checked_at desc, attendance_item.id
      limit 1;

      if attendance_row.id is null then
        insert into public.attendance (
          booking_session_id, student_id, student_type, coach_id, status, checked_at
        ) values (
          session_row.id,
          session_row.expected_student_id,
          session_row.expected_student_type::public.student_type,
          p_coach_id,
          desired_attendance,
          now()
        );
        attendance_changed := true;
      elsif attendance_row.status is distinct from desired_attendance
        or attendance_row.coach_id is distinct from p_coach_id
        or attendance_row.student_type::text is distinct from session_row.expected_student_type then
        update public.attendance attendance_item
        set
          student_type = session_row.expected_student_type::public.student_type,
          coach_id = p_coach_id,
          status = desired_attendance,
          checked_at = now()
        where attendance_item.id = attendance_row.id;
        attendance_changed := true;
      end if;

      if session_row.status is distinct from desired_session_status then
        update public.booking_sessions session_item
        set status = desired_session_status
        where session_item.id = session_row.id;
        status_changed := true;
      end if;
      attendance_row := null;
    end loop;
  end if;

  if p_test_fail_stage = 'after_attendance_write' then
    raise exception 'ADMIN_RETRO_ASSIGNMENT_TEST_FAILURE|after_attendance_write';
  end if;
  if p_test_fail_stage = 'after_session_status_write' then
    raise exception 'ADMIN_RETRO_ASSIGNMENT_TEST_FAILURE|after_session_status_write';
  end if;

  changed := assignment_changed or legacy_changed or attendance_changed or status_changed;

  select jsonb_build_object(
    'groups', coalesce((
      select jsonb_agg(to_jsonb(group_item) order by group_item.id)
      from public.coach_assignment_groups group_item
      where group_item.schedule_slot_id = p_schedule_slot_id
    ), '[]'::jsonb),
    'memberships', coalesce((
      select jsonb_agg(to_jsonb(member_item) order by member_item.id)
      from public.coach_assignment_group_students member_item
      join public.coach_assignment_groups group_item on group_item.id = member_item.group_id
      where group_item.schedule_slot_id = p_schedule_slot_id
    ), '[]'::jsonb),
    'legacyAssignments', coalesce((
      select jsonb_agg(to_jsonb(legacy_item) order by legacy_item.id)
      from public.coach_assignments legacy_item
      where legacy_item.schedule_slot_id = p_schedule_slot_id
    ), '[]'::jsonb),
    'exactReservations', coalesce((
      select jsonb_agg(to_jsonb(reservation_item) order by reservation_item.group_id)
      from public.coach_assignment_exact_reservations reservation_item
      where reservation_item.schedule_slot_id = p_schedule_slot_id
    ), '[]'::jsonb),
    'attendance', coalesce((
      select jsonb_agg(to_jsonb(attendance_item) order by attendance_item.booking_session_id, attendance_item.student_id, attendance_item.id)
      from public.attendance attendance_item
      where attendance_item.booking_session_id = any(target_session_ids)
    ), '[]'::jsonb),
    'sessionStatuses', coalesce((
      select jsonb_agg(jsonb_build_object('id', session_item.id, 'status', session_item.status) order by session_item.id)
      from public.booking_sessions session_item
      where session_item.id = any(target_session_ids)
    ), '[]'::jsonb)
  ) into after_snapshot;

  if changed then
    insert into public.activity_logs (
      user_id, action, entity_type, entity_id, details
    ) values (
      p_actor_id,
      concat('admin_retrospective_assignment_', p_operation),
      'schedule_slots',
      p_schedule_slot_id,
      jsonb_build_object(
        'operation', p_operation,
        'reason', nullif(btrim(coalesce(p_reason, '')), ''),
        'scheduleSlotId', p_schedule_slot_id,
        'groupId', result_group_id,
        'sourceGroupId', source_group_id,
        'targetSessionIds', to_jsonb(target_session_ids),
        'coachId', p_coach_id,
        'assignmentChanged', assignment_changed,
        'legacyChanged', legacy_changed,
        'attendanceChanged', attendance_changed,
        'sessionStatusChanged', status_changed,
        'before', before_snapshot,
        'after', after_snapshot
      )
    ) returning id, created_at into activity_id, activity_created_at;
  end if;

  if p_test_fail_stage = 'after_activity_write' then
    raise exception 'ADMIN_RETRO_ASSIGNMENT_TEST_FAILURE|after_activity_write';
  end if;

  return jsonb_build_object(
    'changed', changed,
    'idempotentReplay', not changed,
    'operation', p_operation,
    'scheduleSlotId', p_schedule_slot_id,
    'groupId', result_group_id,
    'targetSessionIds', to_jsonb(target_session_ids),
    'before', before_snapshot,
    'after', after_snapshot,
    'warnings', legacy_warnings,
    'audit', case
      when activity_id is null then null
      else jsonb_build_object(
        'id', activity_id,
        'createdAt', activity_created_at,
        'action', concat('admin_retrospective_assignment_', p_operation),
        'assignmentChanged', assignment_changed,
        'legacyChanged', legacy_changed,
        'attendanceChanged', attendance_changed,
        'sessionStatusChanged', status_changed
      )
    end
  );
exception
  when unique_violation then
    raise exception using
      errcode = '23505',
      message = 'ADMIN_RETRO_ASSIGNMENT_DUPLICATE|concurrent_unique_conflict';
  when exclusion_violation then
    raise exception using
      errcode = '23P01',
      message = 'ADMIN_RETRO_ASSIGNMENT_COACH_CONFLICT|concurrent_overlap';
  when foreign_key_violation then
    raise exception using
      errcode = 'P0001',
      message = 'ADMIN_RETRO_ASSIGNMENT_STALE_STATE|concurrent_reference_change';
end;
$$;

revoke all on function public.admin_apply_retrospective_assignment_transition_v1(
  text, uuid, uuid, uuid, uuid[], uuid, text, jsonb, text
) from public, anon, authenticated;
grant execute on function public.admin_apply_retrospective_assignment_transition_v1(
  text, uuid, uuid, uuid, uuid[], uuid, text, jsonb, text
) to service_role;
