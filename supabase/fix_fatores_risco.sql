-- =============================================================================
-- TAF — Tabela fatores_risco (idempotente)
-- Cole no SQL Editor do Supabase e clique em Run.
-- Sincroniza fatores de risco com E2E (mesmo padrão de restritos/cadastros).
-- =============================================================================

create table if not exists public.fatores_risco (
  id text not null,
  owner_uid uuid not null,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0,
  deleted boolean not null default false,
  primary key (owner_uid, id)
);

create index if not exists idx_fatores_risco_owner_updated
  on public.fatores_risco (owner_uid, updated_at);

alter table public.fatores_risco replica identity full;

alter table public.fatores_risco enable row level security;

grant select, insert, update, delete on public.fatores_risco to authenticated;

drop policy if exists fatores_risco_access on public.fatores_risco;
create policy fatores_risco_access on public.fatores_risco
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
        and tablename = 'fatores_risco'
    ) then
      execute 'alter publication supabase_realtime add table public.fatores_risco';
    end if;
  end if;
end $$;
