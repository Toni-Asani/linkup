alter table public.companies
  add column if not exists needs_updated_at timestamptz;

create index if not exists companies_needs_updated_at_idx
  on public.companies (needs_updated_at desc nulls last);
