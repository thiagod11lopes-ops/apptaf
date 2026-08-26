-- =============================================================================
-- COMO EXECUTAR NO SUPABASE (leia antes de rodar)
--
-- 1. Abra: Supabase → SQL Editor → New query
-- 2. Copie TODO o conteúdo de agendamento_seguranca_criptografia.sql
--    (não cole o caminho "supabase/..." — isso NÃO é SQL)
-- 3. Database → Extensions → ative "pgcrypto" se estiver off
-- 4. Clique Run
-- 5. Sucesso = mensagem verde "Success. No rows returned"
--
-- Se falhar na 2ª tentativa, rode este arquivo (continuação idempotente).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Garante colunas
alter table public.agendamento_reservas
  add column if not exists nip_hash text,
  add column if not exists payload_enc text;

alter table public.agendamento_militar_lookup
  add column if not exists nip_hash text,
  add column if not exists payload_enc text;

alter table public.agendamento_reservas alter column nip drop not null;
alter table public.agendamento_militar_lookup alter column nip drop not null;

-- Rehash se ainda faltar
update public.agendamento_reservas r
set nip_hash = public.agendamento_nip_hash(r.nip)
where r.nip_hash is null and coalesce(r.nip, '') <> '';

update public.agendamento_militar_lookup l
set nip_hash = public.agendamento_nip_hash(l.nip)
where l.nip_hash is null and coalesce(l.nip, '') <> '';

-- PK lookup (idempotente)
alter table public.agendamento_militar_lookup drop constraint if exists agendamento_militar_lookup_pkey;
delete from public.agendamento_militar_lookup where nip_hash is null;

do $$
begin
  alter table public.agendamento_militar_lookup alter column nip_hash set not null;
exception when others then
  raise notice 'nip_hash not null: %', sqlerrm;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.agendamento_militar_lookup'::regclass and contype = 'p'
  ) then
    alter table public.agendamento_militar_lookup
      add constraint agendamento_militar_lookup_pkey primary key (nip_hash);
  end if;
end $$;

-- RPC mínima para a página pública carregar vagas
drop function if exists public.contar_reservas_por_slot();
create function public.contar_reservas_por_slot()
returns table (slot_id text, total bigint)
language sql stable security definer set search_path = public
as $$
  select r.slot_id, count(*)::bigint
  from public.agendamento_reservas r
  where coalesce(r.deleted, false) = false
  group by r.slot_id;
$$;
revoke all on function public.contar_reservas_por_slot() from public;
grant execute on function public.contar_reservas_por_slot() to anon, authenticated;

notify pgrst, 'reload schema';
