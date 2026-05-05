do $$
begin
  if exists (
    select 1
    from (
      select regexp_replace(coalesce(zefix_uid, ''), '[^0-9]', '', 'g') as normalized_zefix
      from public.companies
      where nullif(regexp_replace(coalesce(zefix_uid, ''), '[^0-9]', '', 'g'), '') is not null
      group by normalized_zefix
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'Duplicate company IDE values already exist. Clean duplicates before enforcing uniqueness.';
  end if;
end $$;

create unique index if not exists companies_zefix_uid_normalized_key
on public.companies ((regexp_replace(coalesce(zefix_uid, ''), '[^0-9]', '', 'g')))
where nullif(regexp_replace(coalesce(zefix_uid, ''), '[^0-9]', '', 'g'), '') is not null;

create or replace function public.hubbing_company_ide_available(p_zefix text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.companies
    where regexp_replace(coalesce(zefix_uid, ''), '[^0-9]', '', 'g') =
      regexp_replace(coalesce(p_zefix, ''), '[^0-9]', '', 'g')
  );
$$;

revoke all on function public.hubbing_company_ide_available(text) from public;
grant execute on function public.hubbing_company_ide_available(text) to anon, authenticated;
