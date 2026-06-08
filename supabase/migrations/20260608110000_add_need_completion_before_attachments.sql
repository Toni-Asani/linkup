alter table public.need_completions
  add column if not exists before_attachment_ids uuid[] not null default '{}';
