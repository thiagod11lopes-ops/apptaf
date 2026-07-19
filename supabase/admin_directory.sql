-- Painel admin (/admin/historico): lista e-mails chefe e autorizados.
-- Execute no SQL Editor do Supabase (uma vez).

create or replace function public.admin_list_boss_emails()
returns table (
  owner_uid uuid,
  email text,
  authorized_count bigint
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
    coalesce(nullif(trim(u.email), ''), b.uid::text) as email,
    (
      select count(*)::bigint
      from public.authorized_emails ae
      where ae.owner_uid = b.uid
        and ae.ativo is distinct from false
    ) as authorized_count
  from bosses b
  left join auth.users u on u.id = b.uid
  order by 2;
$$;

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
    ae.email,
    ae.ativo,
    ae.criado_em
  from public.authorized_emails ae
  where ae.owner_uid = p_boss
  order by ae.email;
$$;

grant execute on function public.admin_list_boss_emails() to anon, authenticated;
grant execute on function public.admin_list_authorized_emails(uuid) to anon, authenticated;
