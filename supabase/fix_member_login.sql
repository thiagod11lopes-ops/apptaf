-- =============================================================================
-- TAF — Login de membro autorizado (idempotente)
-- Cole no SQL Editor do Supabase e clique em Run.
-- Corrige: membro autorizado entra no banco errado / erro ao sincronizar.
-- =============================================================================

-- Resolve o chefe do e-mail autenticado (SECURITY DEFINER: leitura confiável do lookup).
create or replace function public.resolve_member_boss(p_email text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_jwt text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_boss uuid;
begin
  if auth.uid() is null then
    return null;
  end if;
  if v_email = '' then
    return null;
  end if;
  -- Só o próprio e-mail da sessão pode consultar o vínculo.
  if v_email <> v_jwt then
    return null;
  end if;

  select m.boss_uid into v_boss
  from public.member_lookup m
  where m.email_key = v_email
    and m.ativo = true
  limit 1;

  if v_boss is not null and v_boss is distinct from auth.uid() then
    return v_boss;
  end if;
  return null;
end;
$$;

-- Registra login do membro (atualiza member_lookup + member_uid_lookup sem exigir INSERT de chefe).
create or replace function public.register_authorized_member_login(
  p_boss_uid uuid,
  p_email text,
  p_member_uid uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_jwt text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_ok boolean := false;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_boss_uid is null or p_member_uid is null or v_email = '' then
    return false;
  end if;
  if p_member_uid = p_boss_uid then
    return true;
  end if;
  -- Membro registra a si; chefe também pode registrar.
  if auth.uid() is distinct from p_member_uid and auth.uid() is distinct from p_boss_uid then
    raise exception 'forbidden';
  end if;
  if auth.uid() = p_member_uid and v_email <> v_jwt then
    raise exception 'email mismatch';
  end if;

  -- Precisa existir autorização ativa (ou o chamador é o chefe).
  select exists (
    select 1
    from public.member_lookup m
    where m.email_key = v_email
      and m.boss_uid = p_boss_uid
      and m.ativo = true
  ) into v_ok;

  if not v_ok and auth.uid() <> p_boss_uid then
    return false;
  end if;

  if auth.uid() = p_boss_uid and not v_ok then
    insert into public.member_lookup (email_key, email, boss_uid, ativo, member_uid, last_login_at)
    values (v_email, v_email, p_boss_uid, true, p_member_uid, now())
    on conflict (email_key) do update
      set email = excluded.email,
          boss_uid = excluded.boss_uid,
          ativo = true,
          member_uid = excluded.member_uid,
          last_login_at = excluded.last_login_at;
  else
    update public.member_lookup
    set member_uid = p_member_uid,
        last_login_at = now(),
        ativo = true,
        email = v_email
    where email_key = v_email
      and boss_uid = p_boss_uid;
  end if;

  insert into public.member_uid_lookup (member_uid, boss_uid, ativo, email, last_login_at)
  values (p_member_uid, p_boss_uid, true, v_email, now())
  on conflict (member_uid) do update
    set boss_uid = excluded.boss_uid,
        ativo = true,
        email = excluded.email,
        last_login_at = excluded.last_login_at;

  return true;
end;
$$;

grant execute on function public.resolve_member_boss(text) to authenticated;
grant execute on function public.register_authorized_member_login(uuid, text, uuid) to authenticated;
