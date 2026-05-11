create table if not exists public.user_session_locks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text not null,
  device_label text,
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '35 minutes',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_session_locks enable row level security;

drop policy if exists "Users can read their own session lock" on public.user_session_locks;
create policy "Users can read their own session lock"
  on public.user_session_locks
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own session lock" on public.user_session_locks;
create policy "Users can insert their own session lock"
  on public.user_session_locks
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own session lock" on public.user_session_locks;
create policy "Users can update their own session lock"
  on public.user_session_locks
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own session lock" on public.user_session_locks;
create policy "Users can delete their own session lock"
  on public.user_session_locks
  for delete
  using (auth.uid() = user_id);

create or replace function public.hubbing_acquire_session_lock(
  p_token text,
  p_device_label text default null,
  p_ttl_minutes integer default 35
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.user_session_locks%rowtype;
  v_ttl interval := make_interval(mins => greatest(5, least(coalesce(p_ttl_minutes, 35), 180)));
begin
  if v_user_id is null then
    return jsonb_build_object('acquired', false, 'reason', 'not_authenticated');
  end if;

  select *
    into v_existing
    from public.user_session_locks
    where user_id = v_user_id
    for update;

  if found and v_existing.expires_at > now() and v_existing.token <> p_token then
    return jsonb_build_object(
      'acquired', false,
      'reason', 'already_open',
      'device_label', v_existing.device_label,
      'expires_at', v_existing.expires_at
    );
  end if;

  insert into public.user_session_locks (
    user_id,
    token,
    device_label,
    last_seen_at,
    expires_at,
    updated_at
  )
  values (
    v_user_id,
    p_token,
    p_device_label,
    now(),
    now() + v_ttl,
    now()
  )
  on conflict (user_id) do update
    set token = excluded.token,
        device_label = excluded.device_label,
        last_seen_at = excluded.last_seen_at,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at;

  return jsonb_build_object('acquired', true, 'expires_at', now() + v_ttl);
end;
$$;

create or replace function public.hubbing_refresh_session_lock(
  p_token text,
  p_ttl_minutes integer default 35
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.user_session_locks%rowtype;
  v_ttl interval := make_interval(mins => greatest(5, least(coalesce(p_ttl_minutes, 35), 180)));
begin
  if v_user_id is null then
    return jsonb_build_object('active', false, 'reason', 'not_authenticated');
  end if;

  select *
    into v_existing
    from public.user_session_locks
    where user_id = v_user_id
    for update;

  if not found then
    return jsonb_build_object('active', false, 'reason', 'missing_lock');
  end if;

  if v_existing.token <> p_token then
    return jsonb_build_object('active', false, 'reason', 'replaced_by_other_device');
  end if;

  update public.user_session_locks
    set last_seen_at = now(),
        expires_at = now() + v_ttl,
        updated_at = now()
    where user_id = v_user_id
      and token = p_token;

  return jsonb_build_object('active', true, 'expires_at', now() + v_ttl);
end;
$$;

create or replace function public.hubbing_release_session_lock(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.user_session_locks
  where user_id = auth.uid()
    and token = p_token;
$$;

grant execute on function public.hubbing_acquire_session_lock(text, text, integer) to authenticated;
grant execute on function public.hubbing_refresh_session_lock(text, integer) to authenticated;
grant execute on function public.hubbing_release_session_lock(text) to authenticated;
