-- =============================================================================
-- TAF — Verifica e-mail permitido ANTES do login (anon + authenticated)
-- Cole no SQL Editor do Supabase → Run (após o schema com chefe canônico).
--
-- Inclui: chefe canônico, e-mails autorizados, member_lookup ativo
-- e contas que JÁ possuem banco na nuvem (não bloqueia o chefe existente
-- se canonical_boss_email estiver desatualizado).
-- =============================================================================

create or replace function public.is_system_access_email(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_email = '' or position('@' in v_email) = 0 then
    return false;
  end if;

  -- Chefe canônico
  if v_email = public.canonical_boss_email() then
    return true;
  end if;

  -- Autorizado pelo chefe
  if exists (
    select 1
    from public.authorized_emails ae
    where lower(trim(ae.email)) = v_email
      and ae.ativo is distinct from false
  ) then
    return true;
  end if;

  -- Lookup ativo (mesmo fluxo do app)
  if exists (
    select 1
    from public.member_lookup m
    where m.email_key = v_email
      and m.ativo = true
  ) then
    return true;
  end if;

  -- Já possui banco na nuvem (chefe existente / recovery de config)
  if exists (
    select 1
    from auth.users u
    where lower(trim(coalesce(u.email, ''))) = v_email
      and (
        exists (
          select 1 from public.database_registry d where d.owner_uid = u.id
        )
        or exists (
          select 1 from public.team_e2e_meta t where t.owner_uid = u.id
        )
        or exists (
          select 1 from public.cadastros c where c.owner_uid = u.id
        )
        or exists (
          select 1 from public.sessoes s where s.owner_uid = u.id
        )
        or exists (
          select 1 from public.aplicadores a where a.owner_uid = u.id
        )
      )
  ) then
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.is_system_access_email(text) from public;
grant execute on function public.is_system_access_email(text) to anon, authenticated;

-- Conferência (troque o e-mail de teste)
-- select public.is_system_access_email('seu.email@marinha.mil.br');
