create table if not exists public.test_subscription_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.test_subscription_users enable row level security;

drop policy if exists "Test subscription users can read their own access" on public.test_subscription_users;

create policy "Test subscription users can read their own access"
on public.test_subscription_users
for select
to authenticated
using (user_id = auth.uid() and enabled = true);

create or replace function public.hubbing_set_test_subscription_plan(plan_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_plan text := lower(coalesce(plan_name, ''));
  has_test_access boolean;
  period_end timestamptz := now() + interval '30 days';
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if requested_plan not in ('starter', 'basic', 'premium') then
    raise exception 'Invalid subscription plan: %', plan_name
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.test_subscription_users
    where user_id = auth.uid()
      and enabled = true
  ) into has_test_access;

  if not has_test_access then
    raise exception 'Test subscription switching is not enabled for this account'
      using errcode = '42501';
  end if;

  insert into public.subscriptions (
    user_id,
    plan,
    status,
    is_founder,
    current_period_ends_at
  )
  values (
    auth.uid(),
    requested_plan,
    'active',
    false,
    period_end
  )
  on conflict (user_id) do update
  set plan = excluded.plan,
      status = excluded.status,
      is_founder = excluded.is_founder,
      current_period_ends_at = excluded.current_period_ends_at;

  return jsonb_build_object(
    'plan', requested_plan,
    'status', 'active',
    'current_period_ends_at', period_end
  );
end;
$$;

grant execute on function public.hubbing_set_test_subscription_plan(text) to authenticated;
