-- =============================================================================
-- TAF — Correção de permissões de sincronização (idempotente)
-- Cole no SQL Editor do Supabase e clique em Run.
-- Corrige: "Permissão negada na nuvem" na etapa Validando permissões.
-- =============================================================================

-- Helpers usados pelas policies RLS (SECURITY DEFINER evita falha ao ler lookups)
create or replace function public.is_boss(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and auth.uid() = owner;
$$;

create or replace function public.is_active_member_of(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    exists (
      select 1 from public.member_uid_lookup m
      where m.member_uid = auth.uid()
        and m.boss_uid = owner
        and m.ativo is distinct from false
    )
    or exists (
      select 1 from public.member_lookup m
      where m.email_key = lower(coalesce(auth.jwt() ->> 'email', ''))
        and m.boss_uid = owner
        and m.ativo = true
    )
  );
$$;

create or replace function public.can_access_owner(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_boss(owner) or public.is_active_member_of(owner);
$$;

grant execute on function public.is_boss(uuid) to authenticated, anon;
grant execute on function public.is_active_member_of(uuid) to authenticated, anon;
grant execute on function public.can_access_owner(uuid) to authenticated, anon;

-- Privileges nas tabelas de sync
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  public.member_lookup,
  public.member_uid_lookup,
  public.authorized_emails,
  public.cadastros,
  public.cadastro_rubricas,
  public.sessoes,
  public.sessao_rubricas,
  public.aplicadores,
  public.aplicador_senhas,
  public.pre_cadastros,
  public.team_wipe,
  public.team_e2e_meta
to authenticated;

-- database_registry (se existir)
do $$
begin
  if to_regclass('public.database_registry') is not null then
    execute 'grant select, insert on public.database_registry to authenticated';
  end if;
  if to_regclass('public.database_bank_number_seq') is not null
     or exists (select 1 from pg_class where relname = 'database_bank_number_seq') then
    execute 'grant usage, select on sequence public.database_bank_number_seq to authenticated';
  end if;
exception when others then
  raise notice 'grant database_registry: %', sqlerrm;
end $$;

-- Garante RLS ligado
alter table public.member_lookup enable row level security;
alter table public.member_uid_lookup enable row level security;
alter table public.authorized_emails enable row level security;
alter table public.cadastros enable row level security;
alter table public.cadastro_rubricas enable row level security;
alter table public.sessoes enable row level security;
alter table public.sessao_rubricas enable row level security;
alter table public.aplicadores enable row level security;
alter table public.aplicador_senhas enable row level security;
alter table public.pre_cadastros enable row level security;
alter table public.team_wipe enable row level security;
alter table public.team_e2e_meta enable row level security;

-- Policies essenciais de dados (chefe + membro)
drop policy if exists cadastros_access on public.cadastros;
create policy cadastros_access on public.cadastros
  for all to authenticated
  using (public.can_access_owner(owner_uid))
  with check (public.can_access_owner(owner_uid));

drop policy if exists sessoes_access on public.sessoes;
create policy sessoes_access on public.sessoes
  for all to authenticated
  using (public.can_access_owner(owner_uid))
  with check (public.can_access_owner(owner_uid));

drop policy if exists aplicadores_access on public.aplicadores;
create policy aplicadores_access on public.aplicadores
  for all to authenticated
  using (public.can_access_owner(owner_uid))
  with check (public.can_access_owner(owner_uid));

drop policy if exists pre_cadastros_access on public.pre_cadastros;
create policy pre_cadastros_access on public.pre_cadastros
  for all to authenticated
  using (public.can_access_owner(owner_uid))
  with check (public.can_access_owner(owner_uid));

drop policy if exists team_wipe_access on public.team_wipe;
create policy team_wipe_access on public.team_wipe
  for all to authenticated
  using (public.can_access_owner(owner_uid))
  with check (public.is_boss(owner_uid));

drop policy if exists team_e2e_meta_select on public.team_e2e_meta;
create policy team_e2e_meta_select on public.team_e2e_meta
  for select to authenticated
  using (public.can_access_owner(owner_uid));

drop policy if exists team_e2e_meta_insert on public.team_e2e_meta;
create policy team_e2e_meta_insert on public.team_e2e_meta
  for insert to authenticated
  with check (public.is_boss(owner_uid));

drop policy if exists team_e2e_meta_update on public.team_e2e_meta;
create policy team_e2e_meta_update on public.team_e2e_meta
  for update to authenticated
  using (public.is_boss(owner_uid))
  with check (public.is_boss(owner_uid));

drop policy if exists authorized_emails_boss on public.authorized_emails;
create policy authorized_emails_boss on public.authorized_emails
  for all to authenticated
  using (owner_uid = auth.uid())
  with check (owner_uid = auth.uid());

-- Recarrega o schema cache do PostgREST (Supabase)
notify pgrst, 'reload schema';
notify pgrst, 'reload config';
