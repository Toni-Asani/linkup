-- Owners and named providers always retain access to their own completion records.
-- Other companies need an active Basic or Premium subscription to view closed needs.

drop policy if exists "Need completions involved or public select" on public.need_completions;
create policy "Need completions involved or paid select" on public.need_completions
for select using (
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
  or (
    status in ('confirmed', 'external_declared')
    and exists (
      select 1 from public.subscriptions s
      where s.user_id = auth.uid()
        and lower(coalesce(s.plan, 'starter')) in ('basic', 'premium')
        and lower(coalesce(s.status, '')) in ('active', 'trialing')
    )
  )
);

drop policy if exists "Need completion photos involved or public select" on public.need_completion_photos;
create policy "Need completion photos involved or paid select" on public.need_completion_photos
for select using (
  exists (
    select 1 from public.need_completions nc
    where nc.id = need_completion_photos.completion_id
  )
);

drop policy if exists "Need completion photo storage involved select" on storage.objects;
create policy "Need completion photo storage involved or paid select" on storage.objects
for select using (
  bucket_id = 'need-completion-photos'
  and exists (
    select 1
    from public.need_completion_photos ncp
    where ncp.storage_path = storage.objects.name
  )
);
