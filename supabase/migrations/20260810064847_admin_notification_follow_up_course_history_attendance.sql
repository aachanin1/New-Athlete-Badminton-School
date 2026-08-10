create or replace function public.admin_notification_follow_up_workspace_v2(
  p_page integer default 1,
  p_page_size integer default 10,
  p_status text default 'all',
  p_search text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_batch_id uuid;
  v_search text := lower(btrim(coalesce(p_search, '')));
  v_total integer := 0;
  v_pending integer := 0;
  v_sent integer := 0;
  v_excluded integer := 0;
  v_filtered integer := 0;
  v_eligible integer := 0;
  v_missing integer := 0;
  v_items jsonb := '[]'::jsonb;
begin
  if p_page < 1 then
    raise exception 'page must be positive' using errcode = '22023';
  end if;
  if p_page_size < 1 or p_page_size > 10 then
    raise exception 'page size must be between 1 and 10' using errcode = '22023';
  end if;
  if p_status not in ('all', 'pending', 'sent', 'excluded') then
    raise exception 'invalid status filter' using errcode = '22023';
  end if;
  if char_length(v_search) > 100 then
    raise exception 'search is too long' using errcode = '22023';
  end if;

  select campaign.id
  into v_campaign_id
  from public.admin_notification_follow_up_campaigns campaign
  where campaign.status = 'active'
  order by campaign.started_at desc, campaign.id
  limit 1;

  select count(*)::integer
  into v_eligible
  from public.admin_notification_follow_up_candidates_v1(null);

  if v_campaign_id is null then
    return jsonb_build_object(
      'state', 'not_started',
      'total_count', 0,
      'pending_count', 0,
      'sent_count', 0,
      'excluded_count', 0,
      'filtered_count', 0,
      'eligible_total', v_eligible,
      'missing_eligible_count', v_eligible,
      'page', p_page,
      'page_size', p_page_size,
      'total_pages', 0,
      'status_filter', p_status,
      'search', v_search,
      'can_start', v_eligible > 0,
      'can_sync', false,
      'items', '[]'::jsonb
    );
  end if;

  select batch.id
  into v_batch_id
  from public.admin_notification_follow_up_batches batch
  where batch.campaign_id = v_campaign_id
    and batch.status = 'active'
  order by batch.sequence_number desc, batch.id
  limit 1;

  if v_batch_id is null then
    return jsonb_build_object(
      'state', 'campaign_complete',
      'total_count', 0,
      'pending_count', 0,
      'sent_count', 0,
      'excluded_count', 0,
      'filtered_count', 0,
      'eligible_total', v_eligible,
      'missing_eligible_count', v_eligible,
      'page', p_page,
      'page_size', p_page_size,
      'total_pages', 0,
      'status_filter', p_status,
      'search', v_search,
      'can_start', false,
      'can_sync', false,
      'items', '[]'::jsonb
    );
  end if;

  select
    count(*)::integer,
    count(*) filter (where item.status = 'pending')::integer,
    count(*) filter (where item.status = 'sent')::integer,
    count(*) filter (where item.status = 'excluded')::integer
  into v_total, v_pending, v_sent, v_excluded
  from public.admin_notification_follow_up_items item
  where item.batch_id = v_batch_id;

  select count(*)::integer
  into v_missing
  from public.admin_notification_follow_up_candidates_v1(v_campaign_id);

  with filtered as (
    select item.id
    from public.admin_notification_follow_up_items item
    join public.profiles profile on profile.id = item.user_id
    where item.batch_id = v_batch_id
      and (p_status = 'all' or item.status = p_status)
      and (
        v_search = ''
        or strpos(lower(coalesce(profile.full_name, '')), v_search) > 0
        or exists (
          select 1
          from public.bookings learner_booking
          left join public.children child on child.id = learner_booking.child_id
          where learner_booking.user_id = item.user_id
            and learner_booking.status in ('paid', 'verified')
            and (
              (learner_booking.learner_type = 'self' and strpos(lower(coalesce(profile.full_name, '')), v_search) > 0)
              or (
                learner_booking.learner_type = 'child'
                and learner_booking.child_id is not null
                and (
                  strpos(lower(coalesce(child.full_name, '')), v_search) > 0
                  or strpos(lower(coalesce(child.nickname, '')), v_search) > 0
                )
              )
            )
        )
      )
  )
  select count(*)::integer into v_filtered from filtered;

  with filtered as (
    select item.*
    from public.admin_notification_follow_up_items item
    join public.profiles profile on profile.id = item.user_id
    where item.batch_id = v_batch_id
      and (p_status = 'all' or item.status = p_status)
      and (
        v_search = ''
        or strpos(lower(coalesce(profile.full_name, '')), v_search) > 0
        or exists (
          select 1
          from public.bookings learner_booking
          left join public.children child on child.id = learner_booking.child_id
          where learner_booking.user_id = item.user_id
            and learner_booking.status in ('paid', 'verified')
            and (
              (learner_booking.learner_type = 'self' and strpos(lower(coalesce(profile.full_name, '')), v_search) > 0)
              or (
                learner_booking.learner_type = 'child'
                and learner_booking.child_id is not null
                and (
                  strpos(lower(coalesce(child.full_name, '')), v_search) > 0
                  or strpos(lower(coalesce(child.nickname, '')), v_search) > 0
                )
              )
            )
        )
      )
    order by item.position, item.id
    limit p_page_size
    offset (p_page - 1) * p_page_size
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', item.id,
      'user_id', item.user_id,
      'recipient_name', coalesce(nullif(profile.full_name, ''), 'ไม่ทราบชื่อ'),
      'learners', coalesce(learners.items, '[]'::jsonb),
      'course_names', coalesce(courses.items, '[]'::jsonb),
      'last_attended_date', latest_attendance.attended_date,
      'position', item.position,
      'status', item.status,
      'is_currently_eligible', public.admin_notification_follow_up_is_eligible_v1(item.user_id),
      'verified_attempt_count', coalesce(verified.attempt_count, 0),
      'latest_verified_at', verified.latest_at,
      'latest_verified_read', verified.latest_read,
      'ambiguous_legacy_count', coalesce(legacy.legacy_count, 0),
      'can_bulk', item.status = 'pending'
        and public.admin_notification_follow_up_is_eligible_v1(item.user_id)
        and coalesce(verified.attempt_count, 0) = 0
        and coalesce(legacy.legacy_count, 0) = 0
    ) order by item.position, item.id
  ), '[]'::jsonb)
  into v_items
  from filtered item
  join public.profiles profile on profile.id = item.user_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'learner_type', learner.learner_type,
        'full_name', learner.full_name,
        'nickname', learner.nickname
      ) order by learner.sort_order, learner.full_name, learner.nickname
    ) as items
    from (
      select child_learner.*
      from (
        select distinct on (child.id)
          1 as sort_order,
          'child'::text as learner_type,
          child.full_name,
          child.nickname,
          child.id
        from public.bookings learner_booking
        join public.children child on child.id = learner_booking.child_id
        where learner_booking.user_id = item.user_id
          and learner_booking.status in ('paid', 'verified')
          and learner_booking.learner_type = 'child'
        order by child.id, child.full_name, child.nickname
      ) child_learner
      union all
      select
        2 as sort_order,
        'self'::text as learner_type,
        coalesce(nullif(profile.full_name, ''), 'ไม่ทราบชื่อ') as full_name,
        null::text as nickname,
        item.user_id as id
      where exists (
        select 1
        from public.bookings self_booking
        where self_booking.user_id = item.user_id
          and self_booking.status in ('paid', 'verified')
          and self_booking.learner_type = 'self'
      )
    ) learner
  ) learners on true
  left join lateral (
    select jsonb_agg(course_history.course_name order by course_history.sort_order) as items
    from (
      select
        history_course.name as course_name,
        min(case history_course.name
          when 'kids_group' then 1
          when 'adult_group' then 2
          when 'private' then 3
        end) as sort_order
      from public.bookings history_booking
      join public.course_types history_course on history_course.id = history_booking.course_type_id
      where history_booking.user_id = item.user_id
        and history_booking.status in ('paid', 'verified')
        and history_course.name in ('kids_group', 'adult_group', 'private')
      group by history_course.name
    ) course_history
  ) courses on true
  left join lateral (
    select max(history_session.date)::text as attended_date
    from public.bookings history_booking
    join public.booking_sessions history_session on history_session.booking_id = history_booking.id
    join public.attendance history_attendance
      on history_attendance.booking_session_id = history_session.id
      and history_attendance.student_id = coalesce(history_session.child_id, history_booking.user_id)
      and history_attendance.status in ('present', 'late')
    where history_booking.user_id = item.user_id
      and history_session.date <= pg_catalog.timezone('Asia/Bangkok', pg_catalog.now())::date
      and history_session.status not in ('walleted', 'rescheduled')
      and history_session.cancelled_at is null
  ) latest_attendance on true
  left join lateral (
    select
      count(*)::integer as attempt_count,
      (array_agg(notification.created_at order by history.sent_at desc, history.id desc))[1] as latest_at,
      (array_agg(notification.is_read order by history.sent_at desc, history.id desc))[1] as latest_read
    from public.admin_notification_follow_up_items history
    join public.notifications notification on notification.id = history.notification_id
    where history.user_id = item.user_id
      and history.notification_id is not null
  ) verified on true
  left join lateral (
    select count(*)::integer as legacy_count
    from public.notifications legacy_notification
    where legacy_notification.user_id = item.user_id
      and legacy_notification.type = 'reminder'
      and legacy_notification.link_url = '/dashboard/booking'
      and not exists (
        select 1
        from public.admin_notification_follow_up_items verified_item
        where verified_item.notification_id = legacy_notification.id
      )
  ) legacy on true;

  return jsonb_build_object(
    'state', 'active',
    'total_count', v_total,
    'pending_count', v_pending,
    'sent_count', v_sent,
    'excluded_count', v_excluded,
    'filtered_count', v_filtered,
    'eligible_total', v_eligible,
    'missing_eligible_count', v_missing,
    'page', p_page,
    'page_size', p_page_size,
    'total_pages', case when v_filtered = 0 then 0 else ceil(v_filtered::numeric / p_page_size)::integer end,
    'status_filter', p_status,
    'search', v_search,
    'can_start', false,
    'can_sync', true,
    'items', v_items
  );
end;
$$;

revoke all on function public.admin_notification_follow_up_workspace_v2(integer, integer, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_notification_follow_up_workspace_v2(integer, integer, text, text)
  to service_role;
