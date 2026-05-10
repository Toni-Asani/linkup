alter table public.companies
  add column if not exists zefix_verification_status text not null default 'manual_pending',
  add column if not exists zefix_verified_at timestamptz,
  add column if not exists zefix_verified_name text,
  add column if not exists zefix_verified_source text,
  add column if not exists zefix_verified_payload jsonb;

do $$
begin
  alter table public.companies
    add constraint companies_zefix_verification_status_check
    check (zefix_verification_status in ('verified', 'manual_pending', 'manual_approved', 'rejected'));
exception
  when duplicate_object then null;
end $$;

update public.companies
set
  zefix_verification_status = 'manual_approved',
  zefix_verified_source = coalesce(zefix_verified_source, 'manual_existing'),
  zefix_verified_at = coalesce(zefix_verified_at, created_at, now())
where is_demo is not true
  and zefix_verification_status = 'manual_pending';

create or replace function public.hubbing_company_badges(p_company_ids uuid[])
returns table(company_id uuid, plan text, status text)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id as company_id,
    case
      when c.is_demo is true then null
      when c.is_suspended is true then null
      when coalesce(c.zefix_verification_status, 'manual_approved') not in ('verified', 'manual_approved') then null
      when lower(coalesce(s.status, '')) in ('active', 'trialing') then lower(coalesce(s.plan, 'starter'))
      else 'starter'
    end as plan,
    lower(coalesce(s.status, '')) as status
  from public.companies c
  left join public.subscriptions s on s.user_id = c.user_id
  where c.id = any(p_company_ids);
$$;

grant execute on function public.hubbing_company_badges(uuid[]) to anon, authenticated;
