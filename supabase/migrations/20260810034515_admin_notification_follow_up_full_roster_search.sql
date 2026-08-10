-- Full-roster v2 contract for the service-only Admin customer follow-up workspace.
-- This migration changes schema/functions/grants only. It does not create a campaign,
-- reconcile tracking rows, create requests, or insert notifications.

alter table public.admin_notification_follow_up_items
  drop constraint admin_notification_follow_up_items_position_check;

alter table public.admin_notification_follow_up_items
  alter column position type integer;

alter table public.admin_notification_follow_up_items
  add constraint admin_notification_follow_up_items_position_check
  check (position > 0);

create or replace function public.admin_notification_follow_up_manifest_sha256_v2(p_batch_id uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select encode(
    extensions.digest(
      concat_ws(
        '|',
        'campaign',
        campaign.id::text,
        campaign.started_by::text,
        to_char(campaign.started_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
        campaign.status,
        'batch',
        batch.id::text,
        batch.campaign_id::text,
        batch.created_by::text,
        to_char(batch.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
        batch.sequence_number::text,
        batch.status,
        'items',
        coalesce((
          select string_agg(
            concat_ws(
              ':',
              item.id::text,
              item.user_id::text,
              item.batch_id::text,
              item.position::text,
              item.status,
              coalesce(item.notification_id::text, 'null'),
              coalesce(item.sent_by::text, 'null'),
              coalesce(to_char(item.sent_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'), 'null'),
              to_char(item.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
            ),
            ',' order by item.position, item.id
          )
          from public.admin_notification_follow_up_items item
          where item.batch_id = batch.id
        ), '')
      ),
      'sha256'
    ),
    'hex'
  )
  from public.admin_notification_follow_up_batches batch
  join public.admin_notification_follow_up_campaigns campaign
    on campaign.id = batch.campaign_id
  where batch.id = p_batch_id;
$$;

create or replace function public.admin_notification_follow_up_start_v2(p_actor_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_batch_id uuid;
  v_candidate_count integer;
  v_candidate_user_ids uuid[] := '{}'::uuid[];
begin
  perform pg_advisory_xact_lock(hashtextextended('admin_notification_follow_up_v1', 0));

  if not exists (
    select 1
    from public.profiles actor
    where actor.id = p_actor_id
      and actor.role in ('admin', 'super_admin')
  ) then
    raise exception 'admin authorization required' using errcode = '42501';
  end if;

  select campaign.id
  into v_campaign_id
  from public.admin_notification_follow_up_campaigns campaign
  where campaign.status = 'active'
  order by campaign.started_at desc, campaign.id
  limit 1
  for update;

  if v_campaign_id is not null then
    select batch.id
    into v_batch_id
    from public.admin_notification_follow_up_batches batch
    where batch.campaign_id = v_campaign_id
      and batch.status = 'active'
    order by batch.sequence_number desc, batch.id
    limit 1
    for update;

    if v_batch_id is null then
      raise exception 'active campaign has no active batch' using errcode = 'P0002';
    end if;

    return jsonb_build_object(
      'reused', true,
      'inserted_count', 0,
      'roster_count', (
        select count(*)::integer
        from public.admin_notification_follow_up_items item
        where item.batch_id = v_batch_id
      )
    );
  end if;

  select coalesce(
    array_agg(
      candidate.user_id
      order by candidate.latest_lesson_key desc, candidate.latest_booking_at desc, candidate.user_id
    ),
    '{}'::uuid[]
  )
  into v_candidate_user_ids
  from public.admin_notification_follow_up_candidates_v1(null) candidate;

  v_candidate_count := cardinality(v_candidate_user_ids);

  if v_candidate_count = 0 then
    return jsonb_build_object('reused', false, 'inserted_count', 0, 'roster_count', 0);
  end if;

  insert into public.admin_notification_follow_up_campaigns (started_by)
  values (p_actor_id)
  returning id into v_campaign_id;

  insert into public.admin_notification_follow_up_batches (
    campaign_id,
    sequence_number,
    created_by
  ) values (
    v_campaign_id,
    1,
    p_actor_id
  )
  returning id into v_batch_id;

  insert into public.admin_notification_follow_up_items (batch_id, user_id, position)
  select
    v_batch_id,
    planned.user_id,
    planned.position::integer
  from unnest(v_candidate_user_ids) with ordinality as planned(user_id, position)
  order by planned.position;

  return jsonb_build_object(
    'reused', false,
    'inserted_count', v_candidate_count,
    'roster_count', v_candidate_count
  );
end;
$$;

create or replace function public.admin_notification_follow_up_sync_v2(p_actor_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_batch_id uuid;
  v_max_position integer;
  v_excluded_count integer := 0;
  v_inserted_count integer := 0;
  v_pending_count integer := 0;
  v_plan_sha256 text;
  v_exclude_item_ids uuid[] := '{}'::uuid[];
  v_insert_user_ids uuid[] := '{}'::uuid[];
  v_insert_positions integer[] := '{}'::integer[];
begin
  perform pg_advisory_xact_lock(hashtextextended('admin_notification_follow_up_v1', 0));

  if not exists (
    select 1
    from public.profiles actor
    where actor.id = p_actor_id
      and actor.role in ('admin', 'super_admin')
  ) then
    raise exception 'admin authorization required' using errcode = '42501';
  end if;

  select campaign.id
  into v_campaign_id
  from public.admin_notification_follow_up_campaigns campaign
  where campaign.status = 'active'
  order by campaign.started_at desc, campaign.id
  limit 1
  for update;

  if v_campaign_id is null then
    raise exception 'no active follow-up campaign' using errcode = 'P0002';
  end if;

  select batch.id
  into v_batch_id
  from public.admin_notification_follow_up_batches batch
  where batch.campaign_id = v_campaign_id
    and batch.status = 'active'
  order by batch.sequence_number desc, batch.id
  limit 1
  for update;

  if v_batch_id is null then
    raise exception 'no active follow-up batch' using errcode = 'P0002';
  end if;

  perform 1
  from public.admin_notification_follow_up_items item
  where item.batch_id = v_batch_id
  order by item.id
  for update;

  select coalesce(max(item.position), 0)
  into v_max_position
  from public.admin_notification_follow_up_items item
  where item.batch_id = v_batch_id;

  select coalesce(array_agg(item.id order by item.id), '{}'::uuid[])
  into v_exclude_item_ids
  from public.admin_notification_follow_up_items item
  where item.batch_id = v_batch_id
    and item.status = 'pending'
    and not public.admin_notification_follow_up_is_eligible_v1(item.user_id);

  with missing as (
    select
      candidate.user_id,
      v_max_position + row_number() over (
        order by candidate.latest_lesson_key desc, candidate.latest_booking_at desc, candidate.user_id
      )::integer as position
    from public.admin_notification_follow_up_candidates_v1(v_campaign_id) candidate
  )
  select
    coalesce(array_agg(missing.user_id order by missing.position), '{}'::uuid[]),
    coalesce(array_agg(missing.position order by missing.position), '{}'::integer[])
  into v_insert_user_ids, v_insert_positions
  from missing;

  select encode(
    extensions.digest(
      concat_ws(
        '|',
        'exclude',
        coalesce((select string_agg(item_id::text, ',' order by item_id) from unnest(v_exclude_item_ids) item_id), ''),
        'insert',
        coalesce((
          select string_agg(
            v_insert_user_ids[array_position]::text || ':' || v_insert_positions[array_position]::text,
            ',' order by array_position
          )
          from generate_subscripts(v_insert_user_ids, 1) array_position
        ), '')
      ),
      'sha256'
    ),
    'hex'
  )
  into v_plan_sha256;

  update public.admin_notification_follow_up_items item
  set status = 'excluded'
  where item.id = any(v_exclude_item_ids)
    and item.batch_id = v_batch_id
    and item.status = 'pending';
  get diagnostics v_excluded_count = row_count;

  insert into public.admin_notification_follow_up_items (batch_id, user_id, position)
  select
    v_batch_id,
    planned.user_id,
    planned.position
  from unnest(v_insert_user_ids, v_insert_positions) as planned(user_id, position)
  order by planned.position;
  get diagnostics v_inserted_count = row_count;

  select count(*)::integer
  into v_pending_count
  from public.admin_notification_follow_up_items item
  where item.batch_id = v_batch_id
    and item.status = 'pending';

  return jsonb_build_object(
    'excluded_count', v_excluded_count,
    'inserted_count', v_inserted_count,
    'pending_count', v_pending_count,
    'roster_count', (
      select count(*)::integer
      from public.admin_notification_follow_up_items item
      where item.batch_id = v_batch_id
    ),
    'plan_sha256', v_plan_sha256
  );
end;
$$;

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

create or replace function public.admin_notification_follow_up_send_v2(
  p_actor_id uuid,
  p_request_key uuid,
  p_user_ids uuid[],
  p_page integer default 1,
  p_status text default 'all',
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
  v_campaign_id uuid;
  v_batch_id uuid;
  v_workspace jsonb;
  v_visible_count integer;
  v_member_count integer;
  v_blocked_count integer;
  v_pending_count integer;
  v_user_id uuid;
  v_notification_id uuid;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('admin_notification_follow_up_v1', 0));

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

  if p_status not in ('all', 'pending') then
    raise exception 'send requires the all or pending roster filter' using errcode = '22023';
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
    return v_existing.result;
  end if;

  select campaign.id
  into v_campaign_id
  from public.admin_notification_follow_up_campaigns campaign
  where campaign.status = 'active'
  order by campaign.started_at desc, campaign.id
  limit 1
  for update;

  if v_campaign_id is null then
    raise exception 'no active follow-up campaign' using errcode = 'P0002';
  end if;

  select batch.id
  into v_batch_id
  from public.admin_notification_follow_up_batches batch
  where batch.campaign_id = v_campaign_id
    and batch.status = 'active'
  order by batch.sequence_number desc, batch.id
  limit 1
  for update;

  if v_batch_id is null then
    raise exception 'no active follow-up batch' using errcode = 'P0002';
  end if;

  perform 1
  from public.admin_notification_follow_up_items item
  where item.batch_id = v_batch_id
    and item.user_id = any(v_user_ids)
  order by item.user_id
  for update;

  v_workspace := public.admin_notification_follow_up_workspace_v2(p_page, 10, p_status, p_search);
  select count(*)::integer
  into v_visible_count
  from jsonb_array_elements(v_workspace -> 'items') visible
  where (visible ->> 'user_id')::uuid = any(v_user_ids);

  if v_visible_count <> cardinality(v_user_ids) then
    raise exception 'recipients must belong to the current visible roster page' using errcode = '22023';
  end if;

  select count(*)::integer
  into v_member_count
  from public.admin_notification_follow_up_items item
  where item.batch_id = v_batch_id
    and item.user_id = any(v_user_ids)
    and item.status = 'pending'
    and public.admin_notification_follow_up_is_eligible_v1(item.user_id);

  if v_member_count <> cardinality(v_user_ids) then
    raise exception 'recipient is not an eligible pending member of the active batch' using errcode = '22023';
  end if;

  if cardinality(v_user_ids) > 1 then
    select count(*)::integer
    into v_blocked_count
    from unnest(v_user_ids) requested_user_id
    where exists (
      select 1
      from public.admin_notification_follow_up_items history
      where history.user_id = requested_user_id
        and history.notification_id is not null
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
      sent_at = now()
    where batch_id = v_batch_id
      and user_id = v_user_id
      and status = 'pending';
  end loop;

  select count(*)::integer
  into v_pending_count
  from public.admin_notification_follow_up_items item
  where item.batch_id = v_batch_id
    and item.status = 'pending';

  if v_pending_count = 0 then
    update public.admin_notification_follow_up_batches
    set status = 'completed', completed_at = now()
    where id = v_batch_id;

    update public.admin_notification_follow_up_campaigns
    set status = 'completed', completed_at = now()
    where id = v_campaign_id;
  end if;

  v_result := jsonb_build_object(
    'sent_count', cardinality(v_user_ids),
    'idempotent_replay', false
  );

  update public.admin_notification_follow_up_requests
  set status = 'completed', result = v_result, completed_at = now()
  where request_key = p_request_key;

  return v_result;
end;
$$;

create or replace function public.admin_notification_follow_up_reconcile_v2(
  p_actor_id uuid,
  p_expected_manifest_sha256 text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_batch_id uuid;
  v_before_manifest_sha256 text;
  v_after_manifest_sha256 text;
  v_plan_sha256 text;
  v_original_item_ids uuid[];
  v_original_positions integer[];
  v_exclude_item_ids uuid[] := '{}'::uuid[];
  v_insert_user_ids uuid[] := '{}'::uuid[];
  v_insert_positions integer[] := '{}'::integer[];
  v_excluded_count integer := 0;
  v_inserted_count integer := 0;
  v_item_count integer := 0;
  v_pending_count integer := 0;
  v_sent_count integer := 0;
  v_excluded_total integer := 0;
  v_request_count integer := 0;
  v_linked_notification_count integer := 0;
  v_eligible_count integer := 0;
  v_missing_count integer := 0;
  v_unexpected_pending integer := 0;
  v_duplicate_users integer := 0;
  v_duplicate_positions integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('admin_notification_follow_up_v1', 0));

  if not exists (
    select 1
    from public.profiles actor
    where actor.id = p_actor_id
      and actor.role in ('admin', 'super_admin')
  ) then
    raise exception 'admin authorization required' using errcode = '42501';
  end if;

  if p_expected_manifest_sha256 is null
    or p_expected_manifest_sha256 !~ '^[0-9a-f]{64}$'
  then
    raise exception 'expected manifest SHA-256 is required' using errcode = '22023';
  end if;

  if (select count(*) from public.admin_notification_follow_up_campaigns where status = 'active') <> 1 then
    raise exception 'precondition failed: expected exactly one active campaign' using errcode = '22023';
  end if;

  select campaign.id
  into v_campaign_id
  from public.admin_notification_follow_up_campaigns campaign
  where campaign.status = 'active'
  for update;

  if (select count(*) from public.admin_notification_follow_up_batches where campaign_id = v_campaign_id and status = 'active') <> 1 then
    raise exception 'precondition failed: expected exactly one active batch' using errcode = '22023';
  end if;

  select batch.id
  into v_batch_id
  from public.admin_notification_follow_up_batches batch
  where batch.campaign_id = v_campaign_id
    and batch.status = 'active'
  for update;

  perform 1
  from public.admin_notification_follow_up_items item
  where item.batch_id = v_batch_id
  order by item.id
  for update;

  select
    array_agg(item.id order by item.position, item.id),
    array_agg(item.position order by item.position, item.id)
  into v_original_item_ids, v_original_positions
  from public.admin_notification_follow_up_items item
  where item.batch_id = v_batch_id;

  v_before_manifest_sha256 := public.admin_notification_follow_up_manifest_sha256_v2(v_batch_id);
  if v_before_manifest_sha256 is distinct from p_expected_manifest_sha256 then
    raise exception 'precondition failed: manifest mismatch' using errcode = '22023';
  end if;

  select
    count(*)::integer,
    count(*) filter (where item.status = 'pending')::integer,
    count(*) filter (where item.status = 'sent')::integer,
    count(*) filter (where item.status = 'excluded')::integer
  into v_item_count, v_pending_count, v_sent_count, v_excluded_total
  from public.admin_notification_follow_up_items item
  where item.batch_id = v_batch_id;

  select count(*)::integer
  into v_request_count
  from public.admin_notification_follow_up_requests;

  select count(*)::integer
  into v_linked_notification_count
  from public.admin_notification_follow_up_items item
  join public.notifications notification on notification.id = item.notification_id
  where item.batch_id = v_batch_id;

  select count(*)::integer
  into v_duplicate_users
  from (
    select item.user_id
    from public.admin_notification_follow_up_items item
    where item.batch_id = v_batch_id
    group by item.user_id
    having count(*) > 1
  ) duplicates;

  select count(*)::integer
  into v_duplicate_positions
  from (
    select item.position
    from public.admin_notification_follow_up_items item
    where item.batch_id = v_batch_id
    group by item.position
    having count(*) > 1
  ) duplicates;

  if v_item_count <> 30
    or v_pending_count <> 30
    or v_sent_count <> 0
    or v_excluded_total <> 0
    or v_request_count <> 0
    or v_linked_notification_count <> 0
    or v_duplicate_users <> 0
    or v_duplicate_positions <> 0
    or v_original_positions <> array(select generate_series(1, 30))
    or exists (
      select 1
      from public.admin_notification_follow_up_items item
      where item.batch_id = v_batch_id
        and (item.notification_id is not null or item.sent_by is not null or item.sent_at is not null)
    )
  then
    raise exception 'precondition failed: exact 30-row transition state not found' using errcode = '22023';
  end if;

  select coalesce(array_agg(item.id order by item.id), '{}'::uuid[])
  into v_exclude_item_ids
  from public.admin_notification_follow_up_items item
  where item.batch_id = v_batch_id
    and item.status = 'pending'
    and not public.admin_notification_follow_up_is_eligible_v1(item.user_id);

  with missing as (
    select
      candidate.user_id,
      30 + row_number() over (
        order by candidate.latest_lesson_key desc, candidate.latest_booking_at desc, candidate.user_id
      )::integer as position
    from public.admin_notification_follow_up_candidates_v1(v_campaign_id) candidate
  )
  select
    coalesce(array_agg(missing.user_id order by missing.position), '{}'::uuid[]),
    coalesce(array_agg(missing.position order by missing.position), '{}'::integer[])
  into v_insert_user_ids, v_insert_positions
  from missing;

  select encode(
    extensions.digest(
      concat_ws(
        '|',
        'exclude',
        coalesce((select string_agg(item_id::text, ',' order by item_id) from unnest(v_exclude_item_ids) item_id), ''),
        'insert',
        coalesce((
          select string_agg(
            v_insert_user_ids[array_position]::text || ':' || v_insert_positions[array_position]::text,
            ',' order by array_position
          )
          from generate_subscripts(v_insert_user_ids, 1) array_position
        ), '')
      ),
      'sha256'
    ),
    'hex'
  )
  into v_plan_sha256;

  update public.admin_notification_follow_up_items item
  set status = 'excluded'
  where item.id = any(v_exclude_item_ids)
    and item.batch_id = v_batch_id
    and item.status = 'pending';
  get diagnostics v_excluded_count = row_count;

  insert into public.admin_notification_follow_up_items (batch_id, user_id, position)
  select
    v_batch_id,
    planned.user_id,
    planned.position
  from unnest(v_insert_user_ids, v_insert_positions) as planned(user_id, position)
  order by planned.position;
  get diagnostics v_inserted_count = row_count;

  select
    count(*)::integer,
    count(*) filter (where item.status = 'pending')::integer,
    count(*) filter (where item.status = 'sent')::integer,
    count(*) filter (where item.status = 'excluded')::integer
  into v_item_count, v_pending_count, v_sent_count, v_excluded_total
  from public.admin_notification_follow_up_items item
  where item.batch_id = v_batch_id;

  select count(*)::integer
  into v_eligible_count
  from public.admin_notification_follow_up_candidates_v1(null);

  select count(*)::integer
  into v_request_count
  from public.admin_notification_follow_up_requests;

  select count(*)::integer
  into v_linked_notification_count
  from public.admin_notification_follow_up_items item
  join public.notifications notification on notification.id = item.notification_id
  where item.batch_id = v_batch_id;

  select count(*)::integer
  into v_missing_count
  from public.admin_notification_follow_up_candidates_v1(v_campaign_id);

  select count(*)::integer
  into v_unexpected_pending
  from public.admin_notification_follow_up_items item
  where item.batch_id = v_batch_id
    and item.status = 'pending'
    and not public.admin_notification_follow_up_is_eligible_v1(item.user_id);

  select count(*)::integer
  into v_duplicate_users
  from (
    select item.user_id
    from public.admin_notification_follow_up_items item
    where item.batch_id = v_batch_id
    group by item.user_id
    having count(*) > 1
  ) duplicates;

  select count(*)::integer
  into v_duplicate_positions
  from (
    select item.position
    from public.admin_notification_follow_up_items item
    where item.batch_id = v_batch_id
    group by item.position
    having count(*) > 1
  ) duplicates;

  if v_sent_count <> 0
    or v_request_count <> 0
    or v_linked_notification_count <> 0
    or v_missing_count <> 0
    or v_unexpected_pending <> 0
    or v_duplicate_users <> 0
    or v_duplicate_positions <> 0
    or (select array_agg(item.id order by item.position, item.id)
        from public.admin_notification_follow_up_items item
        where item.batch_id = v_batch_id and item.position between 1 and 30) <> v_original_item_ids
    or (select array_agg(item.position order by item.position, item.id)
        from public.admin_notification_follow_up_items item
        where item.batch_id = v_batch_id and item.position between 1 and 30) <> v_original_positions
    or exists (
      select 1
      from public.admin_notification_follow_up_items item
      where item.batch_id = v_batch_id
        and item.position between 1 and 30
        and (item.notification_id is not null or item.sent_by is not null or item.sent_at is not null)
    )
    or (v_pending_count > 0 and (
      (select campaign.status from public.admin_notification_follow_up_campaigns campaign where campaign.id = v_campaign_id) <> 'active'
      or (select batch.status from public.admin_notification_follow_up_batches batch where batch.id = v_batch_id) <> 'active'
    ))
  then
    raise exception 'postcondition failed: reconciliation invariants did not hold' using errcode = '22023';
  end if;

  v_after_manifest_sha256 := public.admin_notification_follow_up_manifest_sha256_v2(v_batch_id);

  return jsonb_build_object(
    'before_manifest_sha256', v_before_manifest_sha256,
    'after_manifest_sha256', v_after_manifest_sha256,
    'plan_sha256', v_plan_sha256,
    'original_rows_preserved', 30,
    'inserted_count', v_inserted_count,
    'excluded_count', v_excluded_count,
    'item_count', v_item_count,
    'pending_count', v_pending_count,
    'sent_count', v_sent_count,
    'excluded_total', v_excluded_total,
    'eligible_count', v_eligible_count,
    'missing_eligible_count', v_missing_count,
    'unexpected_pending_count', v_unexpected_pending,
    'request_count', v_request_count,
    'linked_notification_count', v_linked_notification_count,
    'duplicate_user_count', v_duplicate_users,
    'duplicate_position_count', v_duplicate_positions,
    'position_min', (select min(item.position) from public.admin_notification_follow_up_items item where item.batch_id = v_batch_id),
    'position_max', (select max(item.position) from public.admin_notification_follow_up_items item where item.batch_id = v_batch_id),
    'positions_continuous', (
      select coalesce(
        min(item.position) = 1
          and max(item.position)::bigint = count(*)
          and count(distinct item.position) = count(*),
        true
      )
      from public.admin_notification_follow_up_items item
      where item.batch_id = v_batch_id
    )
  );
end;
$$;

-- Mutating v1 entry points are intentionally retired before any v2 reconciliation.
revoke execute on function public.admin_notification_follow_up_start_batch_v1(uuid)
  from service_role;
revoke execute on function public.admin_notification_follow_up_send_v1(uuid, uuid, uuid[])
  from service_role;

revoke all on function public.admin_notification_follow_up_manifest_sha256_v2(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_notification_follow_up_start_v2(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_notification_follow_up_sync_v2(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_notification_follow_up_workspace_v2(integer, integer, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_notification_follow_up_send_v2(uuid, uuid, uuid[], integer, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_notification_follow_up_reconcile_v2(uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function public.admin_notification_follow_up_manifest_sha256_v2(uuid)
  to service_role;
grant execute on function public.admin_notification_follow_up_start_v2(uuid)
  to service_role;
grant execute on function public.admin_notification_follow_up_sync_v2(uuid)
  to service_role;
grant execute on function public.admin_notification_follow_up_workspace_v2(integer, integer, text, text)
  to service_role;
grant execute on function public.admin_notification_follow_up_send_v2(uuid, uuid, uuid[], integer, text, text)
  to service_role;
grant execute on function public.admin_notification_follow_up_reconcile_v2(uuid, text)
  to service_role;

alter table public.admin_notification_follow_up_campaigns enable row level security;
alter table public.admin_notification_follow_up_batches enable row level security;
alter table public.admin_notification_follow_up_items enable row level security;
alter table public.admin_notification_follow_up_requests enable row level security;
