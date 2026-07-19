alter table public.companies
  add column if not exists service_tags jsonb not null default '[]'::jsonb;

alter table public.companies
  drop constraint if exists companies_service_tags_array_check;

alter table public.companies
  add constraint companies_service_tags_array_check
  check (
    jsonb_typeof(service_tags) = 'array'
    and jsonb_array_length(service_tags) <= 10
  );

create index if not exists companies_service_tags_gin_idx
  on public.companies using gin (service_tags);

comment on column public.companies.service_tags is
  'Up to 10 services offered by the company, used for B2B need matching.';
