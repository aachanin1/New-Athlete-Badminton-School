-- READ-ONLY. Run this exact query against Production before applying
-- 20260717070225_coach_assignment_conflict_guards.sql.
with active_exact_groups as (
  select
    group_row.id as group_id,
    group_row.coach_id,
    group_row.schedule_slot_id,
    group_row.name as group_name,
    slot_row.date,
    slot_row.start_time,
    slot_row.end_time,
    slot_row.branch_id,
    count(distinct member.booking_session_id)::integer as active_learner_count
  from public.coach_assignment_groups group_row
  join public.schedule_slots slot_row on slot_row.id = group_row.schedule_slot_id
  join public.coach_assignment_group_students member on member.group_id = group_row.id
  join public.booking_sessions session_row on session_row.id = member.booking_session_id
  join public.bookings booking_row on booking_row.id = session_row.booking_id
  where group_row.coach_id is not null
    and booking_row.status = 'verified'
    and session_row.status in ('scheduled', 'completed', 'absent')
    and session_row.schedule_slot_id = group_row.schedule_slot_id
  group by group_row.id, slot_row.id
), exact_conflicts as (
  select
    first_group.coach_id,
    first_group.group_id,
    second_group.group_id as conflicting_group_id,
    first_group.schedule_slot_id,
    second_group.schedule_slot_id as conflicting_schedule_slot_id,
    first_group.date as teaching_date,
    first_group.start_time,
    first_group.end_time,
    second_group.start_time as conflicting_start_time,
    second_group.end_time as conflicting_end_time,
    first_group.group_name,
    second_group.group_name as conflicting_group_name,
    first_group.active_learner_count,
    second_group.active_learner_count as conflicting_active_learner_count
  from active_exact_groups first_group
  join active_exact_groups second_group
    on second_group.coach_id = first_group.coach_id
   and second_group.group_id > first_group.group_id
   and second_group.date = first_group.date
   and first_group.start_time < second_group.end_time
   and second_group.start_time < first_group.end_time
), classified_conflicts as (
  select
    conflict_row.*,
    case
      when conflict_row.teaching_date >= (now() at time zone 'Asia/Bangkok')::date
        then 'blocking_current_or_future'
      else 'historical_report_only'
    end as migration_scope
  from exact_conflicts conflict_row
)
select jsonb_build_object(
  'bangkok_today', (now() at time zone 'Asia/Bangkok')::date,
  'active_exact_group_count', (select count(*) from active_exact_groups),
  'reservation_candidate_count', (
    select count(*)
    from active_exact_groups
    where date >= (now() at time zone 'Asia/Bangkok')::date
  ),
  'blocking_current_or_future_conflict_count', (
    select count(*) from classified_conflicts
    where migration_scope = 'blocking_current_or_future'
  ),
  'blocking_current_or_future_conflicts', coalesce((
    select jsonb_agg(to_jsonb(conflict_row) order by teaching_date, start_time, coach_id)
    from classified_conflicts conflict_row
    where migration_scope = 'blocking_current_or_future'
  ), '[]'::jsonb),
  'historical_report_only_conflict_count', (
    select count(*) from classified_conflicts
    where migration_scope = 'historical_report_only'
  ),
  'historical_report_only_conflicts', coalesce((
    select jsonb_agg(to_jsonb(conflict_row) order by teaching_date, start_time, coach_id)
    from classified_conflicts conflict_row
    where migration_scope = 'historical_report_only'
  ), '[]'::jsonb),
  'exact_groups_with_invalid_auto_name', coalesce((
    select jsonb_agg(to_jsonb(group_row) order by date, start_time, group_id)
    from active_exact_groups group_row
    where btrim(group_name) = 'ยังไม่จัดกลุ่ม'
       or group_name ~ '\s*\(\s*\d+\s*คน\s*\)\s*$'
  ), '[]'::jsonb)
) as coach_assignment_migration_preflight;
