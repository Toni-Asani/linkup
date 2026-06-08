insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'need-completion-photos',
  'need-completion-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.need_completions (
  id uuid primary key default gen_random_uuid(),
  client_company_id uuid not null references public.companies(id) on delete cascade,
  provider_company_id uuid references public.companies(id) on delete set null,
  provider_external boolean not null default false,
  provider_name text,
  provider_city text,
  need_key text not null default 'general',
  need_label text,
  need_title text not null,
  client_note text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'declined', 'external_declared')),
  show_on_provider_profile boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint need_completions_provider_target_check check (
    (provider_external = true and provider_company_id is null and provider_name is not null)
    or
    (provider_external = false and provider_company_id is not null)
  )
);

create index if not exists need_completions_client_idx on public.need_completions(client_company_id, created_at desc);
create index if not exists need_completions_provider_idx on public.need_completions(provider_company_id, status, created_at desc);
create index if not exists need_completions_public_idx on public.need_completions(status, created_at desc);

create table if not exists public.need_completion_photos (
  id uuid primary key default gen_random_uuid(),
  completion_id uuid not null references public.need_completions(id) on delete cascade,
  uploader_company_id uuid not null references public.companies(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  file_size bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists need_completion_photos_completion_idx on public.need_completion_photos(completion_id);

alter table public.notifications
  alter column match_id drop not null;

alter table public.notifications
  add column if not exists need_completion_id uuid references public.need_completions(id) on delete cascade;

create index if not exists notifications_need_completion_id_idx on public.notifications(need_completion_id);

alter table public.need_completions enable row level security;
alter table public.need_completion_photos enable row level security;

drop policy if exists "Need completions involved or public select" on public.need_completions;
drop policy if exists "Need completions client insert" on public.need_completions;
drop policy if exists "Need completions involved update" on public.need_completions;
drop policy if exists "Need completions involved delete" on public.need_completions;

create policy "Need completions involved or public select" on public.need_completions
for select using (
  (
    auth.uid() is not null
    and status in ('confirmed', 'external_declared')
  )
  or exists (
    select 1 from public.companies c
    where c.id = need_completions.client_company_id
      and c.user_id = auth.uid()
  )
  or exists (
    select 1 from public.companies c
    where c.id = need_completions.provider_company_id
      and c.user_id = auth.uid()
  )
);

create policy "Need completions client insert" on public.need_completions
for insert with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.companies c
    where c.id = need_completions.client_company_id
      and c.user_id = auth.uid()
  )
);

create policy "Need completions involved update" on public.need_completions
for update using (
  exists (
    select 1 from public.companies c
    where c.id = need_completions.client_company_id
      and c.user_id = auth.uid()
  )
  or exists (
    select 1 from public.companies c
    where c.id = need_completions.provider_company_id
      and c.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.companies c
    where c.id = need_completions.client_company_id
      and c.user_id = auth.uid()
  )
  or exists (
    select 1 from public.companies c
    where c.id = need_completions.provider_company_id
      and c.user_id = auth.uid()
  )
);

create policy "Need completions involved delete" on public.need_completions
for delete using (
  exists (
    select 1 from public.companies c
    where c.id = need_completions.client_company_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "Need completion photos involved or public select" on public.need_completion_photos;
drop policy if exists "Need completion photos client insert" on public.need_completion_photos;
drop policy if exists "Need completion photos owner delete" on public.need_completion_photos;

create policy "Need completion photos involved or public select" on public.need_completion_photos
for select using (
  exists (
    select 1 from public.need_completions nc
    where nc.id = need_completion_photos.completion_id
      and (
        (auth.uid() is not null and nc.status in ('confirmed', 'external_declared'))
        or exists (
          select 1 from public.companies c
          where c.id = nc.client_company_id
            and c.user_id = auth.uid()
        )
        or exists (
          select 1 from public.companies c
          where c.id = nc.provider_company_id
            and c.user_id = auth.uid()
        )
      )
  )
);

create policy "Need completion photos client insert" on public.need_completion_photos
for insert with check (
  exists (
    select 1 from public.need_completions nc
    join public.companies c on c.id = nc.client_company_id
    where nc.id = need_completion_photos.completion_id
      and c.user_id = auth.uid()
      and need_completion_photos.uploader_company_id = nc.client_company_id
  )
);

create policy "Need completion photos owner delete" on public.need_completion_photos
for delete using (
  exists (
    select 1 from public.need_completions nc
    join public.companies c on c.id = nc.client_company_id
    where nc.id = need_completion_photos.completion_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists "Need completion photo storage involved select" on storage.objects;
drop policy if exists "Need completion photo storage client insert" on storage.objects;
drop policy if exists "Need completion photo storage client delete" on storage.objects;

create policy "Need completion photo storage involved select" on storage.objects
for select using (
  bucket_id = 'need-completion-photos'
  and exists (
    select 1 from public.need_completion_photos ncp
    join public.need_completions nc on nc.id = ncp.completion_id
    where ncp.storage_path = storage.objects.name
      and (
        (auth.uid() is not null and nc.status in ('confirmed', 'external_declared'))
        or exists (
          select 1 from public.companies c
          where c.id = nc.client_company_id
            and c.user_id = auth.uid()
        )
        or exists (
          select 1 from public.companies c
          where c.id = nc.provider_company_id
            and c.user_id = auth.uid()
        )
      )
  )
);

create policy "Need completion photo storage client insert" on storage.objects
for insert with check (
  bucket_id = 'need-completion-photos'
  and exists (
    select 1 from public.companies c
    where c.id::text = (storage.foldername(name))[1]
      and c.user_id = auth.uid()
  )
);

create policy "Need completion photo storage client delete" on storage.objects
for delete using (
  bucket_id = 'need-completion-photos'
  and exists (
    select 1 from public.companies c
    where c.id::text = (storage.foldername(name))[1]
      and c.user_id = auth.uid()
  )
);
