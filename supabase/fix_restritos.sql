-- =============================================================================
-- TAF — Tabela restritos / dispensas (idempotente)
-- Cole no SQL Editor do Supabase e clique em Run.
-- Sincroniza dispensas com E2E (mesmo padrão de cadastros/aplicadores).
-- =============================================================================

create table if not exists public.restritos (
  id text not null,
  owner_uid uuid not null,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0,
  deleted boolean not null default false,
  primary key (owner_uid, id)
);

create index if not exists idx_restritos_owner_updated
  on public.restritos (owner_uid, updated_at);

alter table public.restritos replica identity full;

alter table public.restritos enable row level security;

grant select, insert, update, delete on public.restritos to authenticated;

drop policy if exists restritos_access on public.restritos;
create policy restritos_access on public.restritos
  for all to authenticated
  using (public.can_access_owner(owner_uid))
  with check (public.can_access_owner(owner_uid));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'restritos'
    ) then
      execute 'alter publication supabase_realtime add table public.restritos';
    end if;
  end if;
end $$;
