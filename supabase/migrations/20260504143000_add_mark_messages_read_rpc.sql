create or replace function public.mark_match_messages_read(p_match_id uuid)
returns setof public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_company_id uuid;
  read_at_value timestamptz := now();
begin
  select c.id
    into viewer_company_id
  from public.companies c
  where c.user_id = auth.uid()
  limit 1;

  if viewer_company_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.matches m
    where m.id = p_match_id
      and (m.company_a = viewer_company_id or m.company_b = viewer_company_id)
  ) then
    return;
  end if;

  return query
  update public.messages msg
    set read_at = coalesce(msg.read_at, read_at_value)
  where msg.match_id = p_match_id
    and msg.sender_id <> viewer_company_id
    and msg.read_at is null
    and coalesce(msg.deleted_for_all, false) = false
  returning msg.*;
end;
$$;

revoke all on function public.mark_match_messages_read(uuid) from public;
grant execute on function public.mark_match_messages_read(uuid) to authenticated;
