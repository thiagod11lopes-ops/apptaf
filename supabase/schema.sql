-- TAF App — schema Supabase (substitui Firestore)
-- Execute no SQL Editor do projeto Supabase.
-- Ordem: tabelas primeiro, depois funções e policies.
-- Painel admin de e-mails: também execute admin_directory.sql.

-- Lookups de membros autorizados
create table if not exists public.member_lookup (
  email_key text primary key,
  email text not null,
  boss_uid uuid not null,
  ativo boolean not null default true,
  member_uid uuid,
  last_login_at timestamptz,
  criado_em timestamptz default now()
);

create table if not exists public.member_uid_lookup (
  member_uid uuid primary key,
  boss_uid uuid not null,
  ativo boolean not null default true,
  email text not null,
  last_login_at timestamptz
);

-- E-mails autorizados (lista do chefe)
create table if not exists public.authorized_emails (
  id text not null,
  owner_uid uuid not null,
  email text not null,
  ativo boolean not null default true,
  criado_em timestamptz default now(),
  primary key (owner_uid, id)
);

-- Entidades de negócio (documento JSON)
create table if not exists public.cadastros (
  id text not null,
  owner_uid uuid not null,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0,
  deleted boolean not null default false,
  primary key (owner_uid, id)
);

create table if not exists public.cadastro_rubricas (
  id text not null,
  owner_uid uuid not null,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0,
  primary key (owner_uid, id)
);

create table if not exists public.sessoes (
  id text not null,
  owner_uid uuid not null,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0,
  deleted boolean not null default false,
  primary key (owner_uid, id)
);

create table if not exists public.sessao_rubricas (
  id text not null,
  owner_uid uuid not null,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0,
  primary key (owner_uid, id)
);

create table if not exists public.aplicadores (
  id text not null,
  owner_uid uuid not null,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0,
  deleted boolean not null default false,
  primary key (owner_uid, id)
);

create table if not exists public.aplicador_senhas (
  id text not null,
  owner_uid uuid not null,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0,
  primary key (owner_uid, id)
);

create table if not exists public.pre_cadastros (
  id text not null,
  owner_uid uuid not null,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint not null default 0,
  deleted boolean not null default false,
  primary key (owner_uid, id)
);

create table if not exists public.team_wipe (
  owner_uid uuid primary key,
  wiped_at bigint not null,
  wiped_at_server timestamptz default now()
);

-- Metadados da chave de criptografia E2E da equipe (chefe cria; membros leem para desbloquear)
create table if not exists public.team_e2e_meta (
  owner_uid uuid primary key,
  salt_b64 text not null,
  wrapped_key_b64 text not null,
  key_version int not null default 1,
  updated_at timestamptz default now()
);

-- Índices
create index if not exists idx_cadastros_owner_updated on public.cadastros (owner_uid, updated_at);
create index if not exists idx_sessoes_owner_updated on public.sessoes (owner_uid, updated_at);
create index if not exists idx_aplicadores_owner_updated on public.aplicadores (owner_uid, updated_at);
create index if not exists idx_pre_cadastros_owner_updated on public.pre_cadastros (owner_uid, updated_at);
create index if not exists idx_member_lookup_boss on public.member_lookup (boss_uid);
create index if not exists idx_member_uid_lookup_boss on public.member_uid_lookup (boss_uid);

-- Helpers de autorização (chefe ou membro ativo) — após as tabelas
create or replace function public.is_boss(owner uuid)
returns boolean
language sql
stable
as $$
  select auth.uid() is not null and auth.uid() = owner;
$$;

create or replace function public.is_active_member_of(owner uuid)
returns boolean
language sql
stable
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
as $$
  select public.is_boss(owner) or public.is_active_member_of(owner);
$$;

-- Privileges for Data API (necessário quando "Automatically expose new tables" está off)
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
grant execute on function public.is_boss(uuid) to authenticated;
grant execute on function public.is_active_member_of(uuid) to authenticated;
grant execute on function public.can_access_owner(uuid) to authenticated;

-- RLS
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

-- member_lookup
drop policy if exists member_lookup_select on public.member_lookup;
create policy member_lookup_select on public.member_lookup
  for select to authenticated
  using (
    email_key = lower(coalesce(auth.jwt() ->> 'email', ''))
    or boss_uid = auth.uid()
  );

drop policy if exists member_lookup_insert on public.member_lookup;
create policy member_lookup_insert on public.member_lookup
  for insert to authenticated
  with check (boss_uid = auth.uid());

drop policy if exists member_lookup_update on public.member_lookup;
create policy member_lookup_update on public.member_lookup
  for update to authenticated
  using (
    boss_uid = auth.uid()
    or email_key = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (
    boss_uid = auth.uid()
    or (
      email_key = lower(coalesce(auth.jwt() ->> 'email', ''))
      and boss_uid = (select m.boss_uid from public.member_lookup m where m.email_key = member_lookup.email_key)
    )
  );

drop policy if exists member_lookup_delete on public.member_lookup;
create policy member_lookup_delete on public.member_lookup
  for delete to authenticated
  using (boss_uid = auth.uid());

-- member_uid_lookup
drop policy if exists member_uid_lookup_select on public.member_uid_lookup;
create policy member_uid_lookup_select on public.member_uid_lookup
  for select to authenticated
  using (member_uid = auth.uid() or boss_uid = auth.uid());

drop policy if exists member_uid_lookup_upsert on public.member_uid_lookup;
create policy member_uid_lookup_upsert on public.member_uid_lookup
  for all to authenticated
  using (member_uid = auth.uid() or boss_uid = auth.uid())
  with check (member_uid = auth.uid() or boss_uid = auth.uid());

-- authorized_emails: só chefe
drop policy if exists authorized_emails_boss on public.authorized_emails;
create policy authorized_emails_boss on public.authorized_emails
  for all to authenticated
  using (owner_uid = auth.uid())
  with check (owner_uid = auth.uid());

-- Dados compartilhados (chefe + membros)
drop policy if exists cadastros_access on public.cadastros;
create policy cadastros_access on public.cadastros
  for all to authenticated
  using (public.can_access_owner(owner_uid))
  with check (public.can_access_owner(owner_uid));

drop policy if exists cadastro_rubricas_access on public.cadastro_rubricas;
create policy cadastro_rubricas_access on public.cadastro_rubricas
  for all to authenticated
  using (public.can_access_owner(owner_uid))
  with check (public.can_access_owner(owner_uid));

drop policy if exists sessoes_access on public.sessoes;
create policy sessoes_access on public.sessoes
  for all to authenticated
  using (public.can_access_owner(owner_uid))
  with check (public.can_access_owner(owner_uid));

drop policy if exists sessao_rubricas_access on public.sessao_rubricas;
create policy sessao_rubricas_access on public.sessao_rubricas
  for all to authenticated
  using (public.can_access_owner(owner_uid))
  with check (public.can_access_owner(owner_uid));

drop policy if exists aplicadores_access on public.aplicadores;
create policy aplicadores_access on public.aplicadores
  for all to authenticated
  using (public.can_access_owner(owner_uid))
  with check (public.can_access_owner(owner_uid));

-- Senhas: chefe lê/escreve; membro só escreve
drop policy if exists aplicador_senhas_select on public.aplicador_senhas;
create policy aplicador_senhas_select on public.aplicador_senhas
  for select to authenticated
  using (public.is_boss(owner_uid));

drop policy if exists aplicador_senhas_write on public.aplicador_senhas;
create policy aplicador_senhas_write on public.aplicador_senhas
  for insert to authenticated
  with check (public.can_access_owner(owner_uid));

drop policy if exists aplicador_senhas_update on public.aplicador_senhas;
create policy aplicador_senhas_update on public.aplicador_senhas
  for update to authenticated
  using (public.can_access_owner(owner_uid))
  with check (public.can_access_owner(owner_uid));

drop policy if exists aplicador_senhas_delete on public.aplicador_senhas;
create policy aplicador_senhas_delete on public.aplicador_senhas
  for delete to authenticated
  using (public.is_boss(owner_uid));

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

-- team_e2e_meta: chefe grava; chefe e membros leem metadados para desbloquear chave
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
