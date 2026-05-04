alter table public.messages
  add column if not exists read_at timestamptz;

create index if not exists messages_match_sender_read_at_idx
  on public.messages (match_id, sender_id, read_at);
