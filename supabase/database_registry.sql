-- Numeração sequencial de bancos TAF (BNC001, BNC002, …)
-- Execute no SQL Editor do Supabase (projetos novos: já incluso em schema.sql).

create sequence if not exists public.database_bank_number_seq;

create table if not exists public.database_registry (
  owner_uid uuid primary key,
  bank_number int not null unique,
  bank_code text not null unique,
  boss_email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_database_registry_number on public.database_registry (bank_number);

alter table public.database_registry enable row level security;

grant select, insert on public.database_registry to authenticated;
grant usage, select on sequence public.database_bank_number_seq to authenticated;

drop policy if exists database_registry_select on public.database_registry;
create policy database_registry_select on public.database_registry
  for select to authenticated
  using (public.can_access_owner(owner_uid));

drop policy if exists database_registry_insert on public.database_registry;
create policy database_registry_insert on public.database_registry
  for insert to authenticated
  with check (public.is_boss(owner_uid));

/**
 * Garante código do banco para o owner (chefe cria; chefe/membro leem).
 * Retorna ex.: BNC001
 */
create or replace function public.ensure_database_bank_code(p_owner uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing text;
  n int;
  code text;
  email text;
begin
  if p_owner is null then
    raise exception 'owner obrigatório';
  end if;
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  if not public.can_access_owner(p_owner) then
    raise exception 'sem permissão para este banco';
  end if;

  select r.bank_code into existing
  from public.database_registry r
  where r.owner_uid = p_owner;

  if existing is not null then
    return existing;
  end if;

  -- Só o chefe aloca número novo; membro aguarda o chefe.
  if not public.is_boss(p_owner) then
    return null;
  end if;

  email := lower(coalesce(auth.jwt() ->> 'email', ''));
  n := nextval('public.database_bank_number_seq')::int;
  code := 'BNC' || lpad(n::text, 3, '0');

  begin
    insert into public.database_registry (owner_uid, bank_number, bank_code, boss_email)
    values (p_owner, n, code, nullif(email, ''));
    return code;
  exception
    when unique_violation then
      select r.bank_code into existing
      from public.database_registry r
      where r.owner_uid = p_owner;
      return existing;
  end;
end;
$$;

grant execute on function public.ensure_database_bank_code(uuid) to authenticated;

-- Backfill: bancos que já têm chave E2E recebem número pela ordem de criação.
do $$
declare
  max_n int;
begin
  insert into public.database_registry (owner_uid, bank_number, bank_code, created_at)
  select
    t.owner_uid,
    row_number() over (order by t.updated_at nulls last, t.owner_uid)::int,
    'BNC' || lpad(row_number() over (order by t.updated_at nulls last, t.owner_uid)::text, 3, '0'),
    coalesce(t.updated_at, now())
  from public.team_e2e_meta t
  where not exists (
    select 1 from public.database_registry r where r.owner_uid = t.owner_uid
  )
  on conflict (owner_uid) do nothing;

  select coalesce(max(bank_number), 0) into max_n from public.database_registry;
  perform setval('public.database_bank_number_seq', greatest(max_n, 1), max_n > 0);
end $$;
