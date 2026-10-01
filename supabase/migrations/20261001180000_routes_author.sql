-- Bind saved routes to the authenticated Supabase user.
-- Keep author_id nullable so existing routes created before user ownership remain readable.
alter table public.routes
  add column if not exists author_id uuid;

-- Supabase production has auth.users; local Docker does not.
do $$
begin
  if to_regclass('auth.users') is not null then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'routes_author_id_fkey'
        and conrelid = 'public.routes'::regclass
    ) then
      alter table public.routes
        add constraint routes_author_id_fkey
        foreign key (author_id) references auth.users(id) on delete cascade;
    end if;
  end if;
end $$;

create index if not exists routes_author_id_idx
  on public.routes(author_id);
