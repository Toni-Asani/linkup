insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'need-attachments',
  'need-attachments',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.need_attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  uploader_user_id uuid not null references auth.users(id) on delete cascade,
  need_key text not null default 'general',
  need_label text,
  file_name text not null,
  file_type text not null check (file_type in ('image', 'pdf')),
  mime_type text,
  file_size bigint not null default 0,
  storage_path text not null unique,
  visibility text not null default 'need' check (visibility in ('need', 'private')),
  status text not null default 'active' check (status in ('active', 'deleted')),
  moderation_status text not null default 'approved' check (moderation_status in ('approved', 'blocked', 'pending')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists need_attachments_company_id_idx on public.need_attachments(company_id);
create index if not exists need_attachments_need_key_idx on public.need_attachments(company_id, need_key);
create index if not exists need_attachments_public_idx on public.need_attachments(company_id, status, moderation_status, visibility);

create table if not exists public.need_attachment_reports (
  id uuid primary key default gen_random_uuid(),
  attachment_id uuid not null references public.need_attachments(id) on delete cascade,
  reporter_company_id uuid not null references public.companies(id) on delete cascade,
  reported_company_id uuid not null references public.companies(id) on delete cascade,
  reason text not null,
  comment text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists need_attachment_reports_attachment_id_idx on public.need_attachment_reports(attachment_id);
create index if not exists need_attachment_reports_reporter_idx on public.need_attachment_reports(reporter_company_id);

alter table public.need_attachments enable row level security;
alter table public.need_attachment_reports enable row level security;

drop policy if exists "Need attachments owner select" on public.need_attachments;
drop policy if exists "Need attachments public need select" on public.need_attachments;
drop policy if exists "Need attachments owner insert" on public.need_attachments;
drop policy if exists "Need attachments owner update" on public.need_attachments;
drop policy if exists "Need attachments owner delete" on public.need_attachments;

create policy "Need attachments owner select" on public.need_attachments
for select using (
  exists (
    select 1 from public.companies c
    where c.id = need_attachments.company_id
      and c.user_id = auth.uid()
  )
);

create policy "Need attachments public need select" on public.need_attachments
for select using (
  auth.uid() is not null
  and visibility = 'need'
  and status = 'active'
  and moderation_status = 'approved'
);

create policy "Need attachments owner insert" on public.need_attachments
for insert with check (
  uploader_user_id = auth.uid()
  and exists (
    select 1 from public.companies c
    where c.id = need_attachments.company_id
      and c.user_id = auth.uid()
  )
);

create policy "Need attachments owner update" on public.need_attachments
for update using (
  exists (
    select 1 from public.companies c
    where c.id = need_attachments.company_id
      and c.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.companies c
    where c.id = need_attachments.company_id
      and c.user_id = auth.uid()
  )
);

create policy "Need attachments owner delete" on public.need_attachments
for delete using (
  exists (
    select 1 from public.companies c
    where c.id = need_attachments.company_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "Need attachment reports owner select" on public.need_attachment_reports;
drop policy if exists "Need attachment reports reporter insert" on public.need_attachment_reports;

create policy "Need attachment reports owner select" on public.need_attachment_reports
for select using (
  exists (
    select 1 from public.companies c
    where c.id = need_attachment_reports.reporter_company_id
      and c.user_id = auth.uid()
  )
);

create policy "Need attachment reports reporter insert" on public.need_attachment_reports
for insert with check (
  exists (
    select 1 from public.companies c
    where c.id = need_attachment_reports.reporter_company_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "Need attachment owner storage select" on storage.objects;
drop policy if exists "Need attachment public storage select" on storage.objects;
drop policy if exists "Need attachment owner storage insert" on storage.objects;
drop policy if exists "Need attachment owner storage update" on storage.objects;
drop policy if exists "Need attachment owner storage delete" on storage.objects;

create policy "Need attachment owner storage select" on storage.objects
for select using (
  bucket_id = 'need-attachments'
  and exists (
    select 1 from public.companies c
    where c.id::text = (storage.foldername(name))[1]
      and c.user_id = auth.uid()
  )
);

create policy "Need attachment public storage select" on storage.objects
for select using (
  bucket_id = 'need-attachments'
  and auth.uid() is not null
  and exists (
    select 1 from public.need_attachments na
    where na.storage_path = storage.objects.name
      and na.visibility = 'need'
      and na.status = 'active'
      and na.moderation_status = 'approved'
  )
);

create policy "Need attachment owner storage insert" on storage.objects
for insert with check (
  bucket_id = 'need-attachments'
  and exists (
    select 1 from public.companies c
    where c.id::text = (storage.foldername(name))[1]
      and c.user_id = auth.uid()
  )
);

create policy "Need attachment owner storage update" on storage.objects
for update using (
  bucket_id = 'need-attachments'
  and exists (
    select 1 from public.companies c
    where c.id::text = (storage.foldername(name))[1]
      and c.user_id = auth.uid()
  )
) with check (
  bucket_id = 'need-attachments'
  and exists (
    select 1 from public.companies c
    where c.id::text = (storage.foldername(name))[1]
      and c.user_id = auth.uid()
  )
);

create policy "Need attachment owner storage delete" on storage.objects
for delete using (
  bucket_id = 'need-attachments'
  and exists (
    select 1 from public.companies c
    where c.id::text = (storage.foldername(name))[1]
      and c.user_id = auth.uid()
  )
);
