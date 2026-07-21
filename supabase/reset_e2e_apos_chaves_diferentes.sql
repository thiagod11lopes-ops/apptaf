-- =============================================================================
-- TAF — Reset E2E após wipe / chaves diferentes entre aparelhos
-- Cole no SQL Editor → Run. NÃO apaga auth.users.
-- Depois: em CADA aparelho feche abas → Conta → Sair → limpe dados do site
-- → só o CHEFE entra primeiro → escudo verde → sync → depois os autorizados.
-- =============================================================================

begin;

truncate table public.cadastro_rubricas restart identity cascade;
truncate table public.sessao_rubricas restart identity cascade;
truncate table public.aplicador_senhas restart identity cascade;
truncate table public.cadastros restart identity cascade;
truncate table public.sessoes restart identity cascade;
truncate table public.aplicadores restart identity cascade;
truncate table public.pre_cadastros restart identity cascade;
truncate table public.team_wipe restart identity cascade;
truncate table public.team_e2e_meta restart identity cascade;
truncate table public.team_e2e_member_wraps restart identity cascade;

-- Mantém authorized_emails / member_lookup / app_config (chefe canônico).

commit;

select
  (select count(*) from public.team_e2e_meta) as e2e_meta,
  (select count(*) from public.team_e2e_member_wraps) as wraps,
  (select count(*) from public.cadastros) as cadastros,
  public.canonical_boss_email() as email_chefe;
