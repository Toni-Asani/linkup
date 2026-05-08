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
      when c.is_demo is true or c.is_suspended is true then null
      when lower(coalesce(s.status, '')) in ('active', 'trialing') then lower(coalesce(s.plan, 'starter'))
      else 'starter'
    end as plan,
    lower(coalesce(s.status, '')) as status
  from public.companies c
  left join public.subscriptions s on s.user_id = c.user_id
  where c.id = any(p_company_ids);
$$;

grant execute on function public.hubbing_company_badges(uuid[]) to anon, authenticated;
