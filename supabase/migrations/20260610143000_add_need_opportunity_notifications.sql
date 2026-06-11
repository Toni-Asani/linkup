alter table public.notifications
  add column if not exists opportunity_company_id uuid references public.companies(id) on delete cascade;

alter table public.notifications
  add column if not exists opportunity_need_key text;

alter table public.notifications
  add column if not exists opportunity_need_title text;

create index if not exists notifications_opportunity_company_id_idx
  on public.notifications(opportunity_company_id);

create table if not exists public.need_opportunity_notifications (
  id uuid primary key default gen_random_uuid(),
  source_company_id uuid not null references public.companies(id) on delete cascade,
  recipient_company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  need_key text not null default 'general',
  need_fingerprint text not null,
  notification_id uuid references public.notifications(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_company_id, recipient_company_id, need_key, need_fingerprint)
);

create index if not exists need_opportunity_notifications_user_idx
  on public.need_opportunity_notifications(user_id, created_at desc);

create index if not exists need_opportunity_notifications_source_idx
  on public.need_opportunity_notifications(source_company_id, created_at desc);

alter table public.need_opportunity_notifications enable row level security;

drop policy if exists "Need opportunity notifications recipient select" on public.need_opportunity_notifications;
create policy "Need opportunity notifications recipient select"
  on public.need_opportunity_notifications
  for select
  using (auth.uid() = user_id);
