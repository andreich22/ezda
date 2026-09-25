-- User profile data lives in public, while identity remains owned by Supabase Auth.
create table if not exists public.profiles (
  id uuid primary key,
  username text not null unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Supabase production: keep the application profile tied to auth.users.
-- Local Docker does not install the auth schema, so the constraint/trigger are conditional.
do $$
begin
  if to_regclass('auth.users') is not null then
    if not exists (
      select 1 from pg_constraint
      where conname = 'profiles_id_fkey'
        and conrelid = 'public.profiles'::regclass
    ) then
      alter table public.profiles
        add constraint profiles_id_fkey
        foreign key (id) references auth.users(id) on delete cascade;
    end if;

    if to_regprocedure('auth.uid()') is not null then
      execute 'create policy "profiles are publicly readable" on public.profiles for select using (true)';
      execute 'create policy "users manage own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id)';
    end if;

    if not exists (
      select 1 from pg_trigger
      where tgname = 'on_auth_user_created'
        and tgrelid = 'auth.users'::regclass
    ) then
      execute $trigger$
        create function public.handle_new_user_profile()
        returns trigger
        language plpgsql
        security definer
        set search_path = ''
        as $fn$
        begin
          insert into public.profiles (id, username, display_name, avatar_url)
          values (
            new.id,
            coalesce(
              nullif(new.raw_user_meta_data ->> 'username', ''),
              'user_' || substr(replace(new.id::text, '-', ''), 1, 12)
            ),
            new.raw_user_meta_data ->> 'display_name',
            new.raw_user_meta_data ->> 'avatar_url'
          )
          on conflict (id) do nothing;
          return new;
        end;
        $fn$;
        create trigger on_auth_user_created
          after insert on auth.users
          for each row execute procedure public.handle_new_user_profile();
      $trigger$;
    end if;
  end if;
end $$;
