-- =============================================================================
-- TAF App — ZERAR TODOS OS DADOS (mantém schema e contas Auth)
-- Cole no SQL Editor do Supabase → Run.
--
-- APAGA: cadastros, sessões, aplicadores, e-mails autorizados, E2E, BNC, etc.
-- NÃO APAGA: auth.users (e-mails/senhas de login no Supabase Auth).
--
-- Depois: em CADA aparelho → Conta → Sair → entrar de novo (ou limpar dados do site).
-- =============================================================================

begin;

truncate table public.cadastro_rubricas restart identity cascade;
truncate table public.sessao_rubricas restart identity cascade;
truncate table public.aplicador_senhas restart identity cascade;
truncate table public.cadastros restart identity cascade;
truncate table public.sessoes restart identity cascade;
truncate table public.aplicadores restart identity cascade;
truncate table public.pre_cadastros restart identity cascade;
truncate table public.authorized_emails restart identity cascade;
truncate table public.member_lookup restart identity cascade;
truncate table public.member_uid_lookup restart identity cascade;
truncate table public.team_wipe restart identity cascade;
truncate table public.team_e2e_meta restart identity cascade;
truncate table public.team_e2e_member_wraps restart identity cascade;
truncate table public.database_registry restart identity cascade;

-- Reinicia numeração BNC001, BNC002, ...
alter sequence if exists public.database_bank_number_seq restart with 1;

commit;

-- Conferência rápida (tudo deve ser 0)
select 'cadastros' as tabela, count(*)::bigint as n from public.cadastros
union all select 'sessoes', count(*) from public.sessoes
union all select 'aplicadores', count(*) from public.aplicadores
union all select 'authorized_emails', count(*) from public.authorized_emails
union all select 'team_e2e_meta', count(*) from public.team_e2e_meta
union all select 'database_registry', count(*) from public.database_registry;
