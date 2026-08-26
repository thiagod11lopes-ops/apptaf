-- =============================================================================
-- Corrige: "null value in column nip violates not-null constraint"
--
-- Rode ESTE arquivo primeiro se o script principal falhou nessa etapa.
-- Depois rode de novo agendamento_seguranca_criptografia.sql (ou fix_agendamento_seguranca_reexec.sql).
-- =============================================================================

alter table public.agendamento_reservas alter column nip drop not null;
alter table public.agendamento_reservas alter column nome drop not null;
alter table public.agendamento_militar_lookup alter column nip drop not null;
alter table public.agendamento_militar_lookup alter column nome drop not null;

update public.agendamento_reservas
set nip = null, nome = null, data_nascimento = null, sexo = null,
    categoria = null, posto = null, vinculo = null
where payload_enc is not null and payload_enc <> '';

update public.agendamento_militar_lookup
set nip = null, nome = null, data_nascimento = null, sexo = null,
    categoria = null, posto = null, vinculo = null
where payload_enc is not null and payload_enc <> '';

notify pgrst, 'reload schema';
