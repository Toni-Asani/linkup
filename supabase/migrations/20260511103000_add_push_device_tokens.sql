create table if not exists public.push_device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null default 'ios',
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (token)
);

create index if not exists push_device_tokens_user_enabled_idx
  on public.push_device_tokens (user_id, enabled);

alter table public.push_device_tokens enable row level security;

drop policy if exists "Users can read their own push tokens" on public.push_device_tokens;
create policy "Users can read their own push tokens"
  on public.push_device_tokens
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own push tokens" on public.push_device_tokens;
create policy "Users can insert their own push tokens"
  on public.push_device_tokens
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own push tokens" on public.push_device_tokens;
create policy "Users can update their own push tokens"
  on public.push_device_tokens
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own push tokens" on public.push_device_tokens;
create policy "Users can delete their own push tokens"
  on public.push_device_tokens
  for delete
  using (auth.uid() = user_id);
