-- Service-only durable tracking for the Admin customer follow-up recommendation queue.
-- This migration is additive: it does not create batches, items, notifications, or backfill data.

create table public.admin_notification_follow_up_campaigns (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active'
    check (status in ('active', 'completed')),
  started_by uuid not null references public.profiles(id) on delete restrict,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check (
    (status = 'active' and completed_at is null)
    or (status = 'completed' and completed_at is not null)
  )
);

create unique index admin_notification_follow_up_campaigns_one_active_idx
  on public.admin_notification_follow_up_campaigns ((status))
  where status = 'active';

create index admin_notification_follow_up_campaigns_started_by_idx
  on public.admin_notification_follow_up_campaigns (started_by);

create table public.admin_notification_follow_up_batches (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.admin_notification_follow_up_campaigns(id) on delete cascade,
  sequence_number integer not null check (sequence_number > 0),
  status text not null default 'active'
    check (status in ('active', 'completed')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (campaign_id, sequence_number),
  check (
    (status = 'active' and completed_at is null)
    or (status = 'completed' and completed_at is not null)
  )
);

create unique index admin_notification_follow_up_batches_one_active_idx
  on public.admin_notification_follow_up_batches ((status))
  where status = 'active';

create index admin_notification_follow_up_batches_campaign_idx
  on public.admin_notification_follow_up_batches (campaign_id, sequence_number desc);

create index admin_notification_follow_up_batches_created_by_idx
  on public.admin_notification_follow_up_batches (created_by);

create table public.admin_notification_follow_up_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.admin_notification_follow_up_batches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  position smallint not null check (position between 1 and 30),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'excluded')),
  notification_id uuid unique references public.notifications(id) on delete restrict,
  sent_by uuid references public.profiles(id) on delete restrict,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (batch_id, user_id),
  unique (batch_id, position),
  check (
    (status = 'pending' and notification_id is null and sent_by is null and sent_at is null)
    or (status = 'sent' and notification_id is not null and sent_by is not null and sent_at is not null)
    or (status = 'excluded' and notification_id is null and sent_at is null)
  )
);

create index admin_notification_follow_up_items_user_history_idx
  on public.admin_notification_follow_up_items (user_id, sent_at desc, id)
  where notification_id is not null;

create index admin_notification_follow_up_items_sent_by_idx
  on public.admin_notification_follow_up_items (sent_by)
  where sent_by is not null;

create table public.admin_notification_follow_up_requests (
  request_key uuid primary key,
  batch_id uuid not null references public.admin_notification_follow_up_batches(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  recipient_ids uuid[] not null,
  status text not null default 'processing'
    check (status in ('processing', 'completed')),
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (cardinality(recipient_ids) between 1 and 10),
  check (
    (status = 'processing' and completed_at is null and result is null)
    or (status = 'completed' and completed_at is not null and result is not null)
  )
);

create index admin_notification_follow_up_requests_batch_idx
  on public.admin_notification_follow_up_requests (batch_id, created_at desc);

create index admin_notification_follow_up_requests_actor_idx
  on public.admin_notification_follow_up_requests (actor_id, created_at desc);

create index if not exists idx_booking_sessions_rescheduled_from
  on public.booking_sessions (rescheduled_from_id)
  where rescheduled_from_id is not null;

create index if not exists idx_attendance_exact_learner_latest
  on public.attendance (booking_session_id, student_id, checked_at desc, id desc);

create index if not exists idx_bookings_notification_follow_up_history
  on public.bookings (user_id, year desc, month desc, created_at desc)
  where status in ('paid', 'verified');

create index if not exists idx_bookings_notification_current_active
  on public.bookings (year, month, user_id, status, expires_at)
  where status in ('pending_payment', 'paid', 'verified');

create index if not exists idx_notifications_recommendation_legacy_evidence
  on public.notifications (user_id, created_at desc, id)
  where type = 'reminder' and link_url = '/dashboard/booking';

alter table public.admin_notification_follow_up_campaigns enable row level security;
alter table public.admin_notification_follow_up_batches enable row level security;
alter table public.admin_notification_follow_up_items enable row level security;
alter table public.admin_notification_follow_up_requests enable row level security;

revoke all on table public.admin_notification_follow_up_campaigns from public, anon, authenticated;
revoke all on table public.admin_notification_follow_up_batches from public, anon, authenticated;
revoke all on table public.admin_notification_follow_up_items from public, anon, authenticated;
revoke all on table public.admin_notification_follow_up_requests from public, anon, authenticated;
revoke all on table public.admin_notification_follow_up_campaigns from service_role;
revoke all on table public.admin_notification_follow_up_batches from service_role;
revoke all on table public.admin_notification_follow_up_items from service_role;
revoke all on table public.admin_notification_follow_up_requests from service_role;

grant select, insert, update on table public.admin_notification_follow_up_campaigns to service_role;
grant select, insert, update on table public.admin_notification_follow_up_batches to service_role;
grant select, insert, update on table public.admin_notification_follow_up_items to service_role;
grant select, insert, update on table public.admin_notification_follow_up_requests to service_role;

create or replace function public.admin_notification_follow_up_is_eligible_v1(p_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  with current_lesson as (
    select
      extract(year from timezone('Asia/Bangkok', now()))::integer as lesson_year,
      extract(month from timezone('Asia/Bangkok', now()))::integer as lesson_month
  )
  select
    exists (
      select 1
      from public.bookings history
      cross join current_lesson current
      where history.user_id = p_user_id
        and history.status in ('paid', 'verified')
        and (history.year * 12 + history.month) < (current.lesson_year * 12 + current.lesson_month)
    )
    and not exists (
      select 1
      from public.bookings active_booking
      cross join current_lesson current
      where active_booking.user_id = p_user_id
        and active_booking.year = current.lesson_year
        and active_booking.month = current.lesson_month
        and active_booking.status in ('pending_payment', 'paid', 'verified')
        and (
          active_booking.status <> 'pending_payment'
          or (
            active_booking.expired_at is null
            and (active_booking.expires_at is null or active_booking.expires_at > now())
          )
        )
    );
$$;

create or replace function public.admin_notification_follow_up_candidates_v1(p_campaign_id uuid default null)
returns table (
  user_id uuid,
  latest_lesson_key integer,
  latest_booking_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with current_lesson as (
    select
      extract(year from timezone('Asia/Bangkok', now()))::integer as lesson_year,
      extract(month from timezone('Asia/Bangkok', now()))::integer as lesson_month
  )
  select
    booking.user_id,
    max(booking.year * 12 + booking.month)::integer as latest_lesson_key,
    max(booking.created_at) as latest_booking_at
  from public.bookings booking
  join public.profiles profile on profile.id = booking.user_id
  cross join current_lesson current
  where profile.role = 'user'
    and booking.status in ('paid', 'verified')
    and (booking.year * 12 + booking.month) < (current.lesson_year * 12 + current.lesson_month)
    and public.admin_notification_follow_up_is_eligible_v1(booking.user_id)
    and (
      p_campaign_id is null
      or not exists (
        select 1
        from public.admin_notification_follow_up_items campaign_item
        join public.admin_notification_follow_up_batches campaign_batch
          on campaign_batch.id = campaign_item.batch_id
        where campaign_batch.campaign_id = p_campaign_id
          and campaign_item.user_id = booking.user_id
      )
    )
  group by booking.user_id
  order by latest_lesson_key desc, latest_booking_at desc, booking.user_id;
$$;

create or replace function public.admin_notification_follow_up_start_batch_v1(p_actor_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_batch_id uuid;
  v_batch_status text;
  v_sequence integer;
  v_candidate_count integer;
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
    insert into public.admin_notification_follow_up_campaigns (started_by)
    values (p_actor_id)
    returning id into v_campaign_id;
  end if;

  select batch.id, batch.status
  into v_batch_id, v_batch_status
  from public.admin_notification_follow_up_batches batch
  where batch.campaign_id = v_campaign_id
  order by batch.sequence_number desc
  limit 1
  for update;

  if v_batch_status = 'active' then
    return jsonb_build_object('batch_id', v_batch_id, 'reused', true);
  end if;

  select count(*)::integer
  into v_candidate_count
  from public.admin_notification_follow_up_candidates_v1(v_campaign_id);

  if v_candidate_count = 0 then
    update public.admin_notification_follow_up_campaigns
    set status = 'completed', completed_at = now()
    where id = v_campaign_id;
    return jsonb_build_object('batch_id', null, 'campaign_complete', true);
  end if;

  select coalesce(max(batch.sequence_number), 0) + 1
  into v_sequence
  from public.admin_notification_follow_up_batches batch
  where batch.campaign_id = v_campaign_id;

  insert into public.admin_notification_follow_up_batches (
    campaign_id,
    sequence_number,
    created_by
  ) values (
    v_campaign_id,
    v_sequence,
    p_actor_id
  )
  returning id into v_batch_id;

  insert into public.admin_notification_follow_up_items (batch_id, user_id, position)
  select
    v_batch_id,
    candidate.user_id,
    row_number() over (
      order by candidate.latest_lesson_key desc, candidate.latest_booking_at desc, candidate.user_id
    )::smallint
  from public.admin_notification_follow_up_candidates_v1(v_campaign_id) candidate
  order by candidate.latest_lesson_key desc, candidate.latest_booking_at desc, candidate.user_id
  limit 30;

  return jsonb_build_object('batch_id', v_batch_id, 'reused', false);
end;
$$;

create or replace function public.admin_notification_follow_up_workspace_v1()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_campaign_status text;
  v_batch_id uuid;
  v_batch_status text;
  v_available integer := 0;
  v_current integer := 0;
  v_waiting integer := 0;
  v_processed integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_state text := 'not_started';
begin
  select campaign.id, campaign.status
  into v_campaign_id, v_campaign_status
  from public.admin_notification_follow_up_campaigns campaign
  where campaign.status = 'active'
  order by campaign.started_at desc, campaign.id
  limit 1;

  if v_campaign_id is null then
    select count(*)::integer
    into v_available
    from public.admin_notification_follow_up_candidates_v1(null);

    return jsonb_build_object(
      'state', 'not_started',
      'total_remaining', v_available,
      'current_count', 0,
      'waiting_count', v_available,
      'processed_count', 0,
      'available_total', v_available,
      'can_start', v_available > 0,
      'can_load_next', false,
      'items', '[]'::jsonb
    );
  end if;

  select batch.id, batch.status
  into v_batch_id, v_batch_status
  from public.admin_notification_follow_up_batches batch
  where batch.campaign_id = v_campaign_id
  order by batch.sequence_number desc
  limit 1;

  select count(*)::integer
  into v_waiting
  from public.admin_notification_follow_up_candidates_v1(v_campaign_id);

  if v_batch_id is not null then
    select
      count(*) filter (where item.status = 'pending')::integer,
      count(*) filter (where item.status in ('sent', 'excluded'))::integer
    into v_current, v_processed
    from public.admin_notification_follow_up_items item
    where item.batch_id = v_batch_id;

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', item.id,
        'user_id', item.user_id,
        'recipient_name', coalesce(nullif(profile.full_name, ''), 'ไม่ทราบชื่อ'),
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
      ) order by item.position
    ), '[]'::jsonb)
    into v_items
    from public.admin_notification_follow_up_items item
    join public.profiles profile on profile.id = item.user_id
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
    ) legacy on true
    where item.batch_id = v_batch_id;
  end if;

  if v_campaign_status = 'completed' then
    v_state := 'campaign_complete';
  elsif v_batch_status = 'active' then
    v_state := 'active';
  elsif v_batch_status = 'completed' and v_waiting > 0 then
    v_state := 'batch_complete';
  elsif v_batch_status = 'completed' then
    v_state := 'campaign_complete';
  else
    v_state := 'active';
  end if;

  v_available := v_current + v_waiting;
  return jsonb_build_object(
    'state', v_state,
    'total_remaining', v_available,
    'current_count', v_current,
    'waiting_count', v_waiting,
    'processed_count', v_processed,
    'available_total', v_available,
    'can_start', false,
    'can_load_next', v_state = 'batch_complete',
    'items', v_items
  );
end;
$$;

create or replace function public.admin_notification_follow_up_send_v1(
  p_actor_id uuid,
  p_request_key uuid,
  p_user_ids uuid[]
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
  v_member_count integer;
  v_blocked_count integer;
  v_pending_count integer;
  v_waiting_count integer;
  v_user_id uuid;
  v_notification_id uuid;
  v_notification_ids uuid[] := array[]::uuid[];
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
  order by batch.sequence_number desc
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

    v_notification_ids := array_append(v_notification_ids, v_notification_id);
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

    select count(*)::integer
    into v_waiting_count
    from public.admin_notification_follow_up_candidates_v1(v_campaign_id);

    if v_waiting_count = 0 then
      update public.admin_notification_follow_up_campaigns
      set status = 'completed', completed_at = now()
      where id = v_campaign_id;
    end if;
  end if;

  v_result := jsonb_build_object(
    'sent_count', cardinality(v_user_ids),
    'notification_ids', to_jsonb(v_notification_ids),
    'idempotent_replay', false
  );

  update public.admin_notification_follow_up_requests
  set status = 'completed', result = v_result, completed_at = now()
  where request_key = p_request_key;

  return v_result;
end;
$$;

revoke all on function public.admin_notification_follow_up_is_eligible_v1(uuid) from public, anon, authenticated;
revoke all on function public.admin_notification_follow_up_candidates_v1(uuid) from public, anon, authenticated;
revoke all on function public.admin_notification_follow_up_start_batch_v1(uuid) from public, anon, authenticated;
revoke all on function public.admin_notification_follow_up_workspace_v1() from public, anon, authenticated;
revoke all on function public.admin_notification_follow_up_send_v1(uuid, uuid, uuid[]) from public, anon, authenticated;

grant execute on function public.admin_notification_follow_up_is_eligible_v1(uuid) to service_role;
grant execute on function public.admin_notification_follow_up_candidates_v1(uuid) to service_role;
grant execute on function public.admin_notification_follow_up_start_batch_v1(uuid) to service_role;
grant execute on function public.admin_notification_follow_up_workspace_v1() to service_role;
grant execute on function public.admin_notification_follow_up_send_v1(uuid, uuid, uuid[]) to service_role;
