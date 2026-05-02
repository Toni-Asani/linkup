do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.subscriptions'::regclass
      and conname = 'subscriptions_user_id_key'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_user_id_key unique (user_id);
  end if;
end;
$$;
