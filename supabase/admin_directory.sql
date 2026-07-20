-- =============================================================================
-- TAF — Painel Admin de e-mails (/admin/historico)
-- Cole TODO este arquivo no SQL Editor do Supabase e clique em Run.
-- Pode executar mais de uma vez sem erro (idempotente).
-- NÃO substitui o schema.sql completo — só cria/atualiza as funções do admin.
-- =============================================================================

-- Remove versões anteriores (evita conflito de assinatura)
drop function if exists public.admin_list_boss_emails();
drop function if exists public.admin_list_authorized_emails(uuid);

-- Lista e-mails chefe + quantidade de autorizados ativos
create or replace function public.admin_list_boss_emails()
returns table (
  owner_uid uuid,
  email text,
  authorized_count bigint,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with bosses as (
    select owner_uid as uid from public.team_e2e_meta
    union
    select owner_uid from public.authorized_emails
    union
    select distinct boss_uid from public.member_lookup
  )
  select
    b.uid as owner_uid,
    coalesce(nullif(lower(trim(u.email::text)), ''), b.uid::text) as email,
    (
      select count(*)::bigint
      from public.authorized_emails ae
      where ae.owner_uid = b.uid
        and ae.ativo is distinct from false
    ) as authorized_count,
    coalesce(
      u.created_at,
      (select t.updated_at from public.team_e2e_meta t where t.owner_uid = b.uid),
      now()
    ) as created_at
  from bosses b
  left join auth.users u on u.id = b.uid
  order by 4 nulls last, 2;
$$;

-- Lista e-mails autorizados de um chefe (p_boss = owner_uid do chefe)
create or replace function public.admin_list_authorized_emails(p_boss uuid)
returns table (
  email text,
  ativo boolean,
  criado_em timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    lower(trim(ae.email)) as email,
    coalesce(ae.ativo, true) as ativo,
    ae.criado_em
  from public.authorized_emails ae
  where ae.owner_uid = p_boss
  order by 1;
$$;

-- Permissões para o app (chave anon / authenticated) chamar as funções
revoke all on function public.admin_list_boss_emails() from public;
revoke all on function public.admin_list_authorized_emails(uuid) from public;

grant execute on function public.admin_list_boss_emails() to anon, authenticated;
grant execute on function public.admin_list_authorized_emails(uuid) to anon, authenticated;
