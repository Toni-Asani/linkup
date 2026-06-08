insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-realizations',
  'company-realizations',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.company_realizations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  uploader_user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  file_size bigint not null default 0,
  position integer not null default 0,
  status text not null default 'active' check (status in ('active', 'deleted')),
  moderation_status text not null default 'approved' check (moderation_status in ('approved', 'blocked', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists company_realizations_company_idx on public.company_realizations(company_id, status, moderation_status, position, created_at);

alter table public.company_realizations enable row level security;

drop policy if exists "Company realizations public select" on public.company_realizations;
drop policy if exists "Company realizations owner insert" on public.company_realizations;
drop policy if exists "Company realizations owner update" on public.company_realizations;
drop policy if exists "Company realizations owner delete" on public.company_realizations;

create policy "Company realizations public select" on public.company_realizations
for select using (
  status = 'active'
  and moderation_status = 'approved'
);

create policy "Company realizations owner insert" on public.company_realizations
for insert with check (
  uploader_user_id = auth.uid()
  and exists (
    select 1 from public.companies c
    where c.id = company_realizations.company_id
      and c.user_id = auth.uid()
  )
);

create policy "Company realizations owner update" on public.company_realizations
for update using (
  exists (
    select 1 from public.companies c
    where c.id = company_realizations.company_id
      and c.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.companies c
    where c.id = company_realizations.company_id
      and c.user_id = auth.uid()
  )
);

create policy "Company realizations owner delete" on public.company_realizations
for delete using (
  exists (
    select 1 from public.companies c
    where c.id = company_realizations.company_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "Company realizations public storage select" on storage.objects;
drop policy if exists "Company realizations owner storage insert" on storage.objects;
drop policy if exists "Company realizations owner storage update" on storage.objects;
drop policy if exists "Company realizations owner storage delete" on storage.objects;

create policy "Company realizations public storage select" on storage.objects
for select using (
  bucket_id = 'company-realizations'
  and exists (
    select 1 from public.company_realizations cr
    where cr.storage_path = storage.objects.name
      and cr.status = 'active'
      and cr.moderation_status = 'approved'
  )
);

create policy "Company realizations owner storage insert" on storage.objects
for insert with check (
  bucket_id = 'company-realizations'
  and exists (
    select 1 from public.companies c
    where c.id::text = (storage.foldername(name))[1]
      and c.user_id = auth.uid()
  )
);

create policy "Company realizations owner storage update" on storage.objects
for update using (
  bucket_id = 'company-realizations'
  and exists (
    select 1 from public.companies c
    where c.id::text = (storage.foldername(name))[1]
      and c.user_id = auth.uid()
  )
) with check (
  bucket_id = 'company-realizations'
  and exists (
    select 1 from public.companies c
    where c.id::text = (storage.foldername(name))[1]
      and c.user_id = auth.uid()
  )
);

create policy "Company realizations owner storage delete" on storage.objects
for delete using (
  bucket_id = 'company-realizations'
  and exists (
    select 1 from public.companies c
    where c.id::text = (storage.foldername(name))[1]
      and c.user_id = auth.uid()
  )
);
