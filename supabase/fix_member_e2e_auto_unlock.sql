-- =============================================================================
-- TAF — Desbloqueio automático E2E para membro autorizado (idempotente)
-- Cole no SQL Editor do Supabase e clique em Run.
-- O chefe (com escudo verde) grava um segredo de acesso; o membro desbloqueia
-- só com login Auth, sem senha de criptografia do chefe.
-- =============================================================================

create table if not exists public.team_e2e_member_wraps (
  owner_uid uuid not null,
  email_key text not null,
  salt_b64 text not null,
  wrapped_key_b64 text not null,
  key_version int not null default 1,
  updated_at timestamptz not null default now(),
  primary key (owner_uid, email_key)
);

alter table public.team_e2e_member_wraps
  add column if not exists access_secret_b64 text;

create index if not exists idx_team_e2e_member_wraps_email
  on public.team_e2e_member_wraps (email_key);

alter table public.team_e2e_member_wraps enable row level security;

grant select, insert, update, delete on public.team_e2e_member_wraps to authenticated;

drop policy if exists team_e2e_member_wraps_select on public.team_e2e_member_wraps;
create policy team_e2e_member_wraps_select on public.team_e2e_member_wraps
  for select to authenticated
  using (
    public.is_boss(owner_uid)
    or (
      email_key = lower(coalesce(auth.jwt() ->> 'email', ''))
      and public.is_active_member_of(owner_uid)
    )
  );

drop policy if exists team_e2e_member_wraps_insert on public.team_e2e_member_wraps;
create policy team_e2e_member_wraps_insert on public.team_e2e_member_wraps
  for insert to authenticated
  with check (
    public.is_boss(owner_uid)
    or (
      email_key = lower(coalesce(auth.jwt() ->> 'email', ''))
      and public.is_active_member_of(owner_uid)
    )
  );

drop policy if exists team_e2e_member_wraps_update on public.team_e2e_member_wraps;
create policy team_e2e_member_wraps_update on public.team_e2e_member_wraps
  for update to authenticated
  using (
    public.is_boss(owner_uid)
    or (
      email_key = lower(coalesce(auth.jwt() ->> 'email', ''))
      and public.is_active_member_of(owner_uid)
    )
  )
  with check (
    public.is_boss(owner_uid)
    or (
      email_key = lower(coalesce(auth.jwt() ->> 'email', ''))
      and public.is_active_member_of(owner_uid)
    )
  );

drop policy if exists team_e2e_member_wraps_delete on public.team_e2e_member_wraps;
create policy team_e2e_member_wraps_delete on public.team_e2e_member_wraps
  for delete to authenticated
  using (
    public.is_boss(owner_uid)
    or email_key = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
