-- Autorizado pode GRAVAR senha em texto (planilha do chefe), mas o SELECT
-- de aplicador_senhas é só do chefe. O upsert direto do PostgREST falha nesse
-- caso (precisa ler a linha no ON CONFLICT). Esta RPC (security definer)
-- grava sem exigir SELECT.

create or replace function public.upsert_aplicador_senha(
  p_owner_uid uuid,
  p_id text,
  p_data jsonb,
  p_updated_at bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_owner_uid is null or coalesce(trim(p_id), '') = '' then
    raise exception 'invalid arguments';
  end if;
  if not public.can_access_owner(p_owner_uid) then
    raise exception 'permission denied';
  end if;

  insert into public.aplicador_senhas as a (id, owner_uid, data, updated_at)
  values (
    trim(p_id),
    p_owner_uid,
    coalesce(p_data, '{}'::jsonb),
    coalesce(p_updated_at, (extract(epoch from now()) * 1000)::bigint)
  )
  on conflict (owner_uid, id) do update
  set
    data = excluded.data,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.upsert_aplicador_senha(uuid, text, jsonb, bigint) from public;
grant execute on function public.upsert_aplicador_senha(uuid, text, jsonb, bigint) to authenticated;
