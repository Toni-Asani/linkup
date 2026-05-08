alter table public.companies
  add column if not exists is_demo boolean not null default false;

create index if not exists companies_is_demo_idx
  on public.companies (is_demo);
