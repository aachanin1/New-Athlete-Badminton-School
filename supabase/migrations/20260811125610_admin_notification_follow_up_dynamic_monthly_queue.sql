-- Dynamic Bangkok-month customer follow-up queue.
-- The workspace is read-only. Ledger changes occur only inside the manual Send RPC.

create or replace function public.admin_notification_follow_up_workspace_v3(
  p_page integer default 1,
  p_page_size integer default 10,
  p_mode text default 'actionable',
  p_search text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_search text := lower(btrim(coalesce(p_search, '')));
  v_actionable integer := 0;
  v_sent_current_month integer := 0;
  v_filtered integer := 0;
  v_items jsonb := '[]'::jsonb;
begin
  if p_page < 1 then
    raise exception 'page must be positive' using errcode = '22023';
  end if;
  if p_page_size < 1 or p_page_size > 10 then
    raise exception 'page size must be between 1 and 10' using errcode = '22023';
  end if;
  if p_mode not in ('actionable', 'sent') then
    raise exception 'invalid workspace mode' using errcode = '22023';
  end if;
  if char_length(v_search) > 100 then
    raise exception 'search is too long' using errcode = '22023';
  end if;

  with
  clock as (
    select
      (
        extract(year from pg_catalog.timezone('Asia/Bangkok', pg_catalog.now()))::integer * 12
        + extract(month from pg_catalog.timezone('Asia/Bangkok', pg_catalog.now()))::integer
      ) as current_lesson_key,
      (
        pg_catalog.date_trunc('month', pg_catalog.timezone('Asia/Bangkok', pg_catalog.now()))
        at time zone 'Asia/Bangkok'
      ) as month_start,
      (
        (
          pg_catalog.date_trunc('month', pg_catalog.timezone('Asia/Bangkok', pg_catalog.now()))
          + interval '1 month'
        ) at time zone 'Asia/Bangkok'
      ) as next_month_start
  ),
  verified_history as (
    select
      history.user_id,
      count(*)::integer as attempt_count,
      count(*) filter (
        where history.sent_at >= clock.month_start
          and history.sent_at < clock.next_month_start
      )::integer as current_month_attempt_count,
      (array_agg(notification.created_at order by history.sent_at desc, history.id desc))[1] as latest_at,
      (array_agg(notification.is_read order by history.sent_at desc, history.id desc))[1] as latest_read
    from public.admin_notification_follow_up_items history
    join public.notifications notification
      on notification.id = history.notification_id
      and notification.user_id = history.user_id
      and notification.type = 'reminder'
      and notification.link_url = '/dashboard/booking'
      and notification.title = 'คิดถึงนะ กลับมาลงเรียนกันต่อได้เลย'
      and notification.message = 'เดือนนี้ยังไม่พบการจองของคุณ หากต้องการกลับมาเรียนสามารถเข้าแอปเพื่อเลือกวันเรียนได้ทันที'
    cross join clock
    where history.status = 'sent'
      and history.notification_id is not null
    group by history.user_id
  ),
  ambiguous_history as (
    select
      legacy_notification.user_id,
      count(*)::integer as legacy_count
    from public.notifications legacy_notification
    where legacy_notification.type = 'reminder'
      and legacy_notification.link_url = '/dashboard/booking'
      and not exists (
        select 1
        from public.admin_notification_follow_up_items verified_item
        where verified_item.notification_id = legacy_notification.id
      )
    group by legacy_notification.user_id
  ),
  previous_month_history as (
    select
      booking.user_id,
      max(booking.created_at) as latest_booking_at
    from public.bookings booking
    join public.profiles profile on profile.id = booking.user_id
    cross join clock
    where profile.role = 'user'
      and booking.status in ('paid', 'verified')
      and (booking.year * 12 + booking.month) = clock.current_lesson_key - 1
    group by booking.user_id
  ),
  actionable as (
    select
      history.user_id,
      history.latest_booking_at as sort_at
    from previous_month_history history
    cross join clock
    left join verified_history verified on verified.user_id = history.user_id
    where coalesce(verified.current_month_attempt_count, 0) = 0
      and not exists (
        select 1
        from public.bookings current_booking
        where current_booking.user_id = history.user_id
          and (current_booking.year * 12 + current_booking.month) = clock.current_lesson_key
          and current_booking.status in ('pending_payment', 'paid', 'verified')
          and (
            current_booking.status <> 'pending_payment'
            or (
              current_booking.expired_at is null
              and (current_booking.expires_at is null or current_booking.expires_at > pg_catalog.now())
            )
          )
      )
  ),
  sent_current_month as (
    select distinct on (history.user_id)
      history.user_id,
      history.sent_at as sort_at
    from public.admin_notification_follow_up_items history
    join public.notifications notification
      on notification.id = history.notification_id
      and notification.user_id = history.user_id
      and notification.type = 'reminder'
      and notification.link_url = '/dashboard/booking'
      and notification.title = 'คิดถึงนะ กลับมาลงเรียนกันต่อได้เลย'
      and notification.message = 'เดือนนี้ยังไม่พบการจองของคุณ หากต้องการกลับมาเรียนสามารถเข้าแอปเพื่อเลือกวันเรียนได้ทันที'
    cross join clock
    where history.status = 'sent'
      and history.sent_at >= clock.month_start
      and history.sent_at < clock.next_month_start
    order by history.user_id, history.sent_at desc, history.id desc
  ),
  base as (
    select actionable.user_id, actionable.sort_at
    from actionable
    where p_mode = 'actionable'
    union all
    select sent_current_month.user_id, sent_current_month.sort_at
    from sent_current_month
    where p_mode = 'sent'
  ),
  filtered as (
    select base.user_id, base.sort_at
    from base
    join public.profiles profile on profile.id = base.user_id
    where v_search = ''
      or pg_catalog.strpos(lower(coalesce(profile.full_name, '')), v_search) > 0
      or exists (
        select 1
        from public.bookings learner_booking
        left join public.children child on child.id = learner_booking.child_id
        where learner_booking.user_id = base.user_id
          and learner_booking.status in ('paid', 'verified')
          and (
            (
              learner_booking.learner_type = 'self'
              and pg_catalog.strpos(lower(coalesce(profile.full_name, '')), v_search) > 0
            )
            or (
              learner_booking.learner_type = 'child'
              and learner_booking.child_id is not null
              and (
                pg_catalog.strpos(lower(coalesce(child.full_name, '')), v_search) > 0
                or pg_catalog.strpos(lower(coalesce(child.nickname, '')), v_search) > 0
              )
            )
          )
      )
  ),
  ranked as (
    select
      filtered.*,
      row_number() over (order by filtered.sort_at desc, filtered.user_id)::integer as position
    from filtered
  ),
  paged as (
    select ranked.*
    from ranked
    where ranked.position > (p_page - 1) * p_page_size
      and ranked.position <= p_page * p_page_size
    order by ranked.position
  ),
  item_rows as (
    select
      paged.user_id,
      paged.position,
      profile.full_name as recipient_name,
      coalesce(learners.items, '[]'::jsonb) as learners,
      coalesce(courses.items, '[]'::jsonb) as course_names,
      latest_attendance.attended_date as last_attended_date,
      coalesce(verified.attempt_count, 0) as verified_attempt_count,
      verified.latest_at as latest_verified_at,
      verified.latest_read as latest_verified_read,
      coalesce(legacy.legacy_count, 0) as ambiguous_legacy_count
    from paged
    join public.profiles profile on profile.id = paged.user_id
    left join verified_history verified on verified.user_id = paged.user_id
    left join ambiguous_history legacy on legacy.user_id = paged.user_id
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
          where learner_booking.user_id = paged.user_id
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
          paged.user_id as id
        where exists (
          select 1
          from public.bookings self_booking
          where self_booking.user_id = paged.user_id
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
        where history_booking.user_id = paged.user_id
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
      where history_booking.user_id = paged.user_id
        and history_session.date <= pg_catalog.timezone('Asia/Bangkok', pg_catalog.now())::date
        and history_session.status not in ('walleted', 'rescheduled')
        and history_session.cancelled_at is null
    ) latest_attendance on true
  )
  select
    (select count(*)::integer from actionable),
    (select count(*)::integer from sent_current_month),
    (select count(*)::integer from filtered),
    (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', item.user_id,
          'user_id', item.user_id,
          'recipient_name', coalesce(nullif(item.recipient_name, ''), 'ไม่ทราบชื่อ'),
          'learners', item.learners,
          'course_names', item.course_names,
          'last_attended_date', item.last_attended_date,
          'position', item.position,
          'status', p_mode,
          'verified_attempt_count', item.verified_attempt_count,
          'latest_verified_at', item.latest_verified_at,
          'latest_verified_read', item.latest_verified_read,
          'ambiguous_legacy_count', item.ambiguous_legacy_count,
          'can_bulk', p_mode = 'actionable'
            and item.verified_attempt_count = 0
            and item.ambiguous_legacy_count = 0
        ) order by item.position
      ), '[]'::jsonb)
      from item_rows item
    )
  into v_actionable, v_sent_current_month, v_filtered, v_items;

  return jsonb_build_object(
    'mode', p_mode,
    'actionable_count', v_actionable,
    'sent_current_month_count', v_sent_current_month,
    'filtered_count', v_filtered,
    'page', p_page,
    'page_size', p_page_size,
    'total_pages', case when v_filtered = 0 then 0 else ceil(v_filtered::numeric / p_page_size)::integer end,
    'search', v_search,
    'items', v_items
  );
end;
$$;

create or replace function public.admin_notification_follow_up_send_v3(
  p_actor_id uuid,
  p_request_key uuid,
  p_user_ids uuid[],
  p_page integer default 1,
  p_mode text default 'actionable',
  p_search text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_ids uuid[];
  v_existing public.admin_notification_follow_up_requests%rowtype;
  v_workspace jsonb;
  v_visible_count integer := 0;
  v_eligible_count integer := 0;
  v_blocked_count integer := 0;
  v_current_campaign_count integer := 0;
  v_campaign_id uuid;
  v_campaign_status text;
  v_batch_id uuid;
  v_batch_status text;
  v_next_sequence integer := 1;
  v_user_id uuid;
  v_item_id uuid;
  v_item_status text;
  v_notification_id uuid;
  v_result jsonb;
  v_month_start timestamptz := (
    pg_catalog.date_trunc('month', pg_catalog.timezone('Asia/Bangkok', pg_catalog.now()))
    at time zone 'Asia/Bangkok'
  );
  v_next_month_start timestamptz := (
    (
      pg_catalog.date_trunc('month', pg_catalog.timezone('Asia/Bangkok', pg_catalog.now()))
      + interval '1 month'
    ) at time zone 'Asia/Bangkok'
  );
  v_current_lesson_key integer := (
    extract(year from pg_catalog.timezone('Asia/Bangkok', pg_catalog.now()))::integer * 12
    + extract(month from pg_catalog.timezone('Asia/Bangkok', pg_catalog.now()))::integer
  );
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('admin_notification_follow_up_v3', 0));

  if not exists (
    select 1
    from public.profiles actor
    where actor.id = p_actor_id
      and actor.role in ('admin', 'super_admin')
  ) then
    raise exception 'admin authorization required' using errcode = '42501';
  end if;

  select array_agg(distinct requested_user_id order by requested_user_id)
  into v_user_ids
  from unnest(p_user_ids) requested_user_id;

  if cardinality(v_user_ids) is null
    or cardinality(v_user_ids) < 1
    or cardinality(v_user_ids) > 10
    or cardinality(v_user_ids) <> cardinality(p_user_ids)
  then
    raise exception 'recipient list must contain 1-10 unique users' using errcode = '22023';
  end if;
  if p_page < 1 then
    raise exception 'page must be positive' using errcode = '22023';
  end if;
  if p_mode <> 'actionable' then
    raise exception 'send requires actionable workspace mode' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_search, ''))) > 100 then
    raise exception 'search is too long' using errcode = '22023';
  end if;

  select request.*
  into v_existing
  from public.admin_notification_follow_up_requests request
  where request.request_key = p_request_key
  for update;

  if found then
    if v_existing.actor_id <> p_actor_id or v_existing.recipient_ids <> v_user_ids then
      raise exception 'idempotency key conflicts with another request' using errcode = '23505';
    end if;
    if v_existing.status <> 'completed' then
      raise exception 'request is still processing' using errcode = '40001';
    end if;
    return v_existing.result || jsonb_build_object('idempotent_replay', true);
  end if;

  v_workspace := public.admin_notification_follow_up_workspace_v3(p_page, 10, p_mode, p_search);
  select count(*)::integer
  into v_visible_count
  from jsonb_array_elements(v_workspace -> 'items') visible
  where (visible ->> 'user_id')::uuid = any(v_user_ids)
    and visible ->> 'status' = 'actionable';

  if v_visible_count <> cardinality(v_user_ids) then
    raise exception 'recipients must belong to the current visible actionable page' using errcode = '22023';
  end if;

  select count(*)::integer
  into v_eligible_count
  from public.profiles profile
  where profile.id = any(v_user_ids)
    and profile.role = 'user'
    and exists (
      select 1
      from public.bookings previous_booking
      where previous_booking.user_id = profile.id
        and previous_booking.status in ('paid', 'verified')
        and (previous_booking.year * 12 + previous_booking.month) = v_current_lesson_key - 1
    )
    and not exists (
      select 1
      from public.bookings current_booking
      where current_booking.user_id = profile.id
        and (current_booking.year * 12 + current_booking.month) = v_current_lesson_key
        and current_booking.status in ('pending_payment', 'paid', 'verified')
        and (
          current_booking.status <> 'pending_payment'
          or (
            current_booking.expired_at is null
            and (current_booking.expires_at is null or current_booking.expires_at > pg_catalog.now())
          )
        )
    )
    and not exists (
      select 1
      from public.admin_notification_follow_up_items sent_item
      join public.notifications sent_notification
        on sent_notification.id = sent_item.notification_id
        and sent_notification.user_id = sent_item.user_id
        and sent_notification.type = 'reminder'
        and sent_notification.link_url = '/dashboard/booking'
        and sent_notification.title = 'คิดถึงนะ กลับมาลงเรียนกันต่อได้เลย'
        and sent_notification.message = 'เดือนนี้ยังไม่พบการจองของคุณ หากต้องการกลับมาเรียนสามารถเข้าแอปเพื่อเลือกวันเรียนได้ทันที'
      where sent_item.user_id = profile.id
        and sent_item.status = 'sent'
        and sent_item.sent_at >= v_month_start
        and sent_item.sent_at < v_next_month_start
    );

  if v_eligible_count <> cardinality(v_user_ids) then
    raise exception 'recipient eligibility changed before confirmation' using errcode = '22023';
  end if;

  if cardinality(v_user_ids) > 1 then
    select count(*)::integer
    into v_blocked_count
    from unnest(v_user_ids) requested_user_id
    where exists (
      select 1
      from public.admin_notification_follow_up_items history
      join public.notifications verified_notification on verified_notification.id = history.notification_id
      where history.user_id = requested_user_id
        and history.status = 'sent'
        and history.notification_id is not null
        and verified_notification.user_id = requested_user_id
        and verified_notification.type = 'reminder'
        and verified_notification.link_url = '/dashboard/booking'
    )
    or exists (
      select 1
      from public.notifications legacy_notification
      where legacy_notification.user_id = requested_user_id
        and legacy_notification.type = 'reminder'
        and legacy_notification.link_url = '/dashboard/booking'
        and not exists (
          select 1
          from public.admin_notification_follow_up_items verified_item
          where verified_item.notification_id = legacy_notification.id
        )
    );

    if v_blocked_count > 0 then
      raise exception 'bulk recipients must not have prior verified or ambiguous legacy evidence' using errcode = '22023';
    end if;
  end if;

  select campaign.id, campaign.status
  into v_campaign_id, v_campaign_status
  from public.admin_notification_follow_up_campaigns campaign
  where campaign.status = 'active'
  order by campaign.started_at desc, campaign.id
  limit 1
  for update;

  if v_campaign_id is not null
    and (
      pg_catalog.timezone('Asia/Bangkok', (
        select campaign.started_at
        from public.admin_notification_follow_up_campaigns campaign
        where campaign.id = v_campaign_id
      )) < pg_catalog.timezone('Asia/Bangkok', v_month_start)
      or pg_catalog.timezone('Asia/Bangkok', (
        select campaign.started_at
        from public.admin_notification_follow_up_campaigns campaign
        where campaign.id = v_campaign_id
      )) >= pg_catalog.timezone('Asia/Bangkok', v_next_month_start)
    )
  then
    update public.admin_notification_follow_up_batches
    set status = 'completed', completed_at = pg_catalog.now()
    where campaign_id = v_campaign_id
      and status = 'active';

    update public.admin_notification_follow_up_campaigns
    set status = 'completed', completed_at = pg_catalog.now()
    where id = v_campaign_id
      and status = 'active';

    v_campaign_id := null;
    v_campaign_status := null;
  end if;

  if v_campaign_id is null then
    select count(*)::integer
    into v_current_campaign_count
    from public.admin_notification_follow_up_campaigns campaign
    where campaign.started_at >= v_month_start
      and campaign.started_at < v_next_month_start;

    if v_current_campaign_count > 1 then
      raise exception 'multiple Bangkok-month follow-up campaigns require review' using errcode = '23505';
    end if;

    select campaign.id, campaign.status
    into v_campaign_id, v_campaign_status
    from public.admin_notification_follow_up_campaigns campaign
    where campaign.started_at >= v_month_start
      and campaign.started_at < v_next_month_start
    order by campaign.started_at desc, campaign.id
    limit 1
    for update;

    if v_campaign_id is null then
      insert into public.admin_notification_follow_up_campaigns (started_by)
      values (p_actor_id)
      returning id, status into v_campaign_id, v_campaign_status;
    elsif v_campaign_status = 'completed' then
      update public.admin_notification_follow_up_campaigns
      set status = 'active', completed_at = null
      where id = v_campaign_id
      returning status into v_campaign_status;
    end if;
  end if;

  select batch.id, batch.status
  into v_batch_id, v_batch_status
  from public.admin_notification_follow_up_batches batch
  where batch.campaign_id = v_campaign_id
    and batch.status = 'active'
  order by batch.sequence_number desc, batch.id
  limit 1
  for update;

  if v_batch_id is null then
    select batch.id, batch.status, batch.sequence_number
    into v_batch_id, v_batch_status, v_next_sequence
    from public.admin_notification_follow_up_batches batch
    where batch.campaign_id = v_campaign_id
    order by batch.sequence_number desc, batch.id
    limit 1
    for update;

    if v_batch_id is null then
      v_next_sequence := 1;
      insert into public.admin_notification_follow_up_batches (
        campaign_id,
        sequence_number,
        created_by
      ) values (
        v_campaign_id,
        v_next_sequence,
        p_actor_id
      )
      returning id, status into v_batch_id, v_batch_status;
    elsif v_batch_status = 'completed' then
      update public.admin_notification_follow_up_batches
      set status = 'active', completed_at = null
      where id = v_batch_id
      returning status into v_batch_status;
    end if;
  end if;

  insert into public.admin_notification_follow_up_requests (
    request_key,
    batch_id,
    actor_id,
    recipient_ids
  ) values (
    p_request_key,
    v_batch_id,
    p_actor_id,
    v_user_ids
  );

  foreach v_user_id in array v_user_ids loop
    v_item_id := null;
    v_item_status := null;

    select item.id, item.status
    into v_item_id, v_item_status
    from public.admin_notification_follow_up_items item
    where item.batch_id = v_batch_id
      and item.user_id = v_user_id
    for update;

    if v_item_status = 'sent' then
      raise exception 'recipient already has a sent ledger item for this Bangkok month' using errcode = '23505';
    end if;

    if v_item_id is null then
      insert into public.admin_notification_follow_up_items (batch_id, user_id, position)
      select
        v_batch_id,
        v_user_id,
        coalesce(max(item.position), 0) + 1
      from public.admin_notification_follow_up_items item
      where item.batch_id = v_batch_id
      returning id into v_item_id;
    end if;

    insert into public.notifications (user_id, title, message, type, link_url)
    values (
      v_user_id,
      'คิดถึงนะ กลับมาลงเรียนกันต่อได้เลย',
      'เดือนนี้ยังไม่พบการจองของคุณ หากต้องการกลับมาเรียนสามารถเข้าแอปเพื่อเลือกวันเรียนได้ทันที',
      'reminder',
      '/dashboard/booking'
    )
    returning id into v_notification_id;

    update public.admin_notification_follow_up_items
    set
      status = 'sent',
      notification_id = v_notification_id,
      sent_by = p_actor_id,
      sent_at = pg_catalog.now()
    where id = v_item_id
      and status in ('pending', 'excluded');

    if not found then
      raise exception 'follow-up ledger item changed before send' using errcode = '40001';
    end if;
  end loop;

  v_result := jsonb_build_object(
    'sent_count', cardinality(v_user_ids),
    'idempotent_replay', false
  );

  update public.admin_notification_follow_up_requests
  set status = 'completed', result = v_result, completed_at = pg_catalog.now()
  where request_key = p_request_key;

  return v_result;
end;
$$;

revoke all on function public.admin_notification_follow_up_workspace_v3(integer, integer, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_notification_follow_up_send_v3(uuid, uuid, uuid[], integer, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.admin_notification_follow_up_workspace_v3(integer, integer, text, text)
  to service_role;
grant execute on function public.admin_notification_follow_up_send_v3(uuid, uuid, uuid[], integer, text, text)
  to service_role;
