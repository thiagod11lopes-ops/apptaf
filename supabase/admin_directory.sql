-- =============================================================================
-- TAF — Painel Admin de e-mails (/admin/historico)
-- Cole TODO este arquivo no SQL Editor do Supabase e clique em Run.
-- Pode executar mais de uma vez sem erro (idempotente).
-- NÃO substitui o schema.sql completo — só cria/atualiza as funções do admin.
--
-- Acesso: apenas o chefe canônico autenticado (não anon).
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
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_canonical_boss() then
    raise exception 'Apenas o chefe canonico autenticado pode acessar o painel admin';
  end if;

  return query
  with bosses as (
    select t.owner_uid as uid from public.team_e2e_meta t
    union
    select ae.owner_uid from public.authorized_emails ae
    union
    select distinct m.boss_uid from public.member_lookup m
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
end;
$$;

-- Lista e-mails autorizados de um chefe (p_boss = owner_uid do chefe)
create or replace function public.admin_list_authorized_emails(p_boss uuid)
returns table (
  email text,
  ativo boolean,
  criado_em timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_canonical_boss() then
    raise exception 'Apenas o chefe canonico autenticado pode acessar o painel admin';
  end if;

  return query
  select
    lower(trim(ae.email)) as email,
    coalesce(ae.ativo, true) as ativo,
    ae.criado_em
  from public.authorized_emails ae
  where ae.owner_uid = p_boss
  order by 1;
end;
$$;

revoke all on function public.admin_list_boss_emails() from public;
revoke all on function public.admin_list_authorized_emails(uuid) from public;
revoke all on function public.admin_list_boss_emails() from anon;
revoke all on function public.admin_list_authorized_emails(uuid) from anon;

-- Sem anon: o painel exige login do chefe
grant execute on function public.admin_list_boss_emails() to authenticated;
grant execute on function public.admin_list_authorized_emails(uuid) to authenticated;
