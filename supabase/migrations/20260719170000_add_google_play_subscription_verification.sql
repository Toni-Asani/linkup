alter table public.subscriptions
  add column if not exists provider text,
  add column if not exists provider_product_id text,
  add column if not exists provider_verified_at timestamptz;

create table if not exists public.google_play_subscriptions (
  purchase_token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null check (product_id in ('hubbing_basic_monthly', 'hubbing_premium_monthly')),
  plan text not null check (plan in ('basic', 'premium')),
  subscription_state text not null,
  status text not null,
  expiry_time timestamptz,
  auto_renewing boolean not null default false,
  linked_purchase_token text,
  obfuscated_account_id text,
  latest_order_id text,
  is_test_purchase boolean not null default false,
  last_notification_type integer,
  last_event_time timestamptz,
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists google_play_subscriptions_user_id_idx
  on public.google_play_subscriptions (user_id);

create index if not exists google_play_subscriptions_linked_token_idx
  on public.google_play_subscriptions (linked_purchase_token)
  where linked_purchase_token is not null;

alter table public.google_play_subscriptions enable row level security;

comment on table public.google_play_subscriptions is
  'Private Google Play purchase-token ledger. Accessible only with the service role.';

create table if not exists public.google_play_rtdn_events (
  message_id text primary key,
  notification_type integer,
  purchase_token text,
  event_time timestamptz,
  processed_at timestamptz not null default now()
);

alter table public.google_play_rtdn_events enable row level security;

comment on table public.google_play_rtdn_events is
  'Private idempotency ledger for Google Play real-time developer notifications.';
