create or replace function public.hubbing_message_direct_contact_type(message_text text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  normalized text := lower(coalesce(message_text, ''));
  candidate text;
  digits text;
begin
  if normalized = '' then
    return null;
  end if;

  if normalized ~* '[a-z0-9._%+\-]+[[:space:]]*(@|\[at\]|\(at\)|[[:space:]]at[[:space:]])[[:space:]]*[a-z0-9.-]+[[:space:]]*(\.|[[:space:]]dot[[:space:]]|\[dot\]|\(dot\))[[:space:]]*[a-z]{2,}' then
    return 'email';
  end if;

  if normalized ~* '(https?://|www\.|[a-z0-9-]+[[:space:]]*(\.|[[:space:]]dot[[:space:]]|\[dot\]|\(dot\))[[:space:]]*(ch|com|net|org|io|co|fr|de|it|li|me|app|dev|biz|info)($|[^a-z0-9]))' then
    return 'external_link';
  end if;

  for candidate in
    select match[1]
    from regexp_matches(normalized, '((\+|00|0)[0-9][0-9[:space:]()./-]{7,}[0-9])', 'g') as match
  loop
    digits := regexp_replace(candidate, '\D', '', 'g');
    if length(digits) between 9 and 15 then
      return 'phone_number';
    end if;
  end loop;

  return null;
end;
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

drop trigger if exists hubbing_validate_message_insert_on_messages on public.messages;

create trigger hubbing_validate_message_insert_on_messages
before insert on public.messages
for each row
execute function public.hubbing_validate_message_insert();
