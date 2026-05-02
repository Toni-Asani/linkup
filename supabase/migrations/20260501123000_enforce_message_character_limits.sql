create or replace function public.hubbing_message_character_limit(plan_name text)
returns integer
language sql
immutable
as $$
  select case lower(coalesce(plan_name, 'starter'))
    when 'premium' then 2000
    when 'basic' then 1000
    else 100
  end
$$;

create or replace function public.hubbing_validate_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  direct_contact_type text;
  sender_plan text;
  messages_sent_today integer;
  message_limit integer;
begin
  direct_contact_type := public.hubbing_message_direct_contact_type(new.content);
  if direct_contact_type is not null then
    raise exception 'Direct contact information is not allowed in Hubbing messages: %', direct_contact_type
      using errcode = '22023';
  end if;

  select lower(coalesce(s.plan, 'starter'))
    into sender_plan
  from public.companies c
  left join public.subscriptions s on s.user_id = c.user_id
  where c.id = new.sender_id
  limit 1;

  message_limit := public.hubbing_message_character_limit(sender_plan);
  if length(coalesce(new.content, '')) > message_limit then
    raise exception 'Message exceeds character limit for plan %', coalesce(sender_plan, 'starter')
      using errcode = '22023';
  end if;

  if coalesce(sender_plan, 'starter') = 'starter' then
    select count(*)
      into messages_sent_today
    from public.messages
    where sender_id = new.sender_id
      and created_at >= date_trunc('day', now());

    if messages_sent_today >= 5 then
      raise exception 'Starter daily message limit reached'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;
