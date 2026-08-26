-- =============================================================================
-- Corrige erros de migração do agendamento:
--   • "null value in column nip violates not-null constraint"
--   • "column nip is in a primary key" (tabela agendamento_militar_lookup)
--
-- Pré-requisito: funções de crypto já criadas (início de
-- agendamento_seguranca_criptografia.sql — até agendamento_nip_hash).
-- Depois rode de novo o script principal ou fix_agendamento_seguranca_reexec.sql.
-- =============================================================================

-- ─── Reservas (PK = id; nip não é chave) ─────────────────────────────────────
alter table public.agendamento_reservas alter column nip drop not null;
alter table public.agendamento_reservas alter column nome drop not null;

update public.agendamento_reservas
set nip = null, nome = null, data_nascimento = null, sexo = null,
    categoria = null, posto = null, vinculo = null
where payload_enc is not null and payload_enc <> '';

-- ─── Lookup: PK legada em nip → migrar para nip_hash primeiro ────────────────
alter table public.agendamento_militar_lookup
  add column if not exists nip_hash text,
  add column if not exists payload_enc text;

do $$
begin
  if to_regprocedure('public.agendamento_nip_hash(text)') is null then
    raise exception 'Função agendamento_nip_hash ausente. Rode o início de agendamento_seguranca_criptografia.sql (até agendamento_nip_hash) e tente de novo.';
  end if;

  update public.agendamento_militar_lookup l
  set nip_hash = public.agendamento_nip_hash(l.nip)
  where l.nip_hash is null
    and coalesce(l.nip, '') <> '';
end $$;

alter table public.agendamento_militar_lookup drop constraint if exists agendamento_militar_lookup_pkey;

delete from public.agendamento_militar_lookup where nip_hash is null;

do $$
begin
  alter table public.agendamento_militar_lookup alter column nip_hash set not null;
exception
  when others then
    raise notice 'nip_hash set not null: %', sqlerrm;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.agendamento_militar_lookup'::regclass
      and contype = 'p'
  ) then
    alter table public.agendamento_militar_lookup
      add constraint agendamento_militar_lookup_pkey primary key (nip_hash);
  end if;
end $$;

alter table public.agendamento_militar_lookup alter column nip drop not null;
alter table public.agendamento_militar_lookup alter column nome drop not null;

update public.agendamento_militar_lookup
set nip = null, nome = null, data_nascimento = null, sexo = null,
    categoria = null, posto = null, vinculo = null
where payload_enc is not null and payload_enc <> '';

notify pgrst, 'reload schema';
