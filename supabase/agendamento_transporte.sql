-- =============================================================================
-- Transporte no agendamento: Meios próprios | Transporte Institucional
--
-- Execute no SQL Editor do Supabase (conteúdo completo, não o caminho do arquivo).
-- Idempotente: pode rodar de novo com segurança.
--
-- Registros antigos (sem campo transporte no payload) NÃO entram na contagem
-- de transporte institucional — só quem escolher após esta atualização.
-- =============================================================================

-- ─── Inscrição pública ────────────────────────────────────────────────────────

drop function if exists public.inscrever_agendamento_reserva(text, text, text, text, text, text, text, text, text, text, text);
drop function if exists public.inscrever_agendamento_reserva(text, text, text, text, text, text, text, text, text, text, text, text);

create function public.inscrever_agendamento_reserva(
  p_id text,
  p_slot_id text,
  p_data_taf text,
  p_modalidade text,
  p_nip text,
  p_nome text,
  p_data_nascimento text default '',
  p_sexo text default '',
  p_categoria text default '',
  p_posto text default '',
  p_vinculo text default '',
  p_transporte text default ''
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  nh text := public.agendamento_nip_hash(p_nip);
  rid text := trim(coalesce(p_id, ''));
  tr text := lower(trim(coalesce(p_transporte, '')));
  pl jsonb;
begin
  if nh is null then
    raise exception 'NIP inválido';
  end if;
  if rid = '' then
    raise exception 'ID inválido';
  end if;
  if trim(coalesce(p_slot_id, '')) = '' then
    raise exception 'Slot inválido';
  end if;
  if length(trim(coalesce(p_nome, ''))) < 3 then
    raise exception 'Nome inválido';
  end if;
  if tr <> 'proprios' and tr <> 'institucional' then
    raise exception 'Informe o transporte (Meios próprios ou Transporte Institucional)';
  end if;

  pl := jsonb_strip_nulls(jsonb_build_object(
    'nip', public.agendamento_nip_digits(p_nip),
    'nome', upper(trim(p_nome)),
    'data_nascimento', trim(coalesce(p_data_nascimento, '')),
    'sexo', upper(trim(coalesce(p_sexo, ''))),
    'categoria', trim(coalesce(p_categoria, '')),
    'posto', upper(trim(coalesce(p_posto, ''))),
    'vinculo', lower(trim(coalesce(p_vinculo, ''))),
    'transporte', tr
  ));

  insert into public.agendamento_reservas as t (
    id, slot_id, data_taf, modalidade, nip_hash, payload_enc, updated_at, deleted,
    nip, nome, data_nascimento, sexo, categoria, posto, vinculo
  ) values (
    rid,
    trim(p_slot_id),
    trim(p_data_taf),
    trim(p_modalidade),
    nh,
    public.agendamento_encrypt_json(pl),
    (extract(epoch from now()) * 1000)::bigint,
    false,
    null, null, null, null, null, null, null
  )
  on conflict (id) do update set
    slot_id = excluded.slot_id,
    data_taf = excluded.data_taf,
    modalidade = excluded.modalidade,
    nip_hash = excluded.nip_hash,
    payload_enc = excluded.payload_enc,
    updated_at = excluded.updated_at,
    deleted = false,
    nip = null,
    nome = null,
    data_nascimento = null,
    sexo = null,
    categoria = null,
    posto = null,
    vinculo = null;

  return rid;
end;
$$;

revoke all on function public.inscrever_agendamento_reserva(text, text, text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.inscrever_agendamento_reserva(text, text, text, text, text, text, text, text, text, text, text, text) to anon, authenticated;

-- ─── Buscar reserva (página pública) ──────────────────────────────────────────

drop function if exists public.buscar_reserva_agendamento(text, text, text, text);

create function public.buscar_reserva_agendamento(
  p_nip text,
  p_slot_id text default null,
  p_data_taf text default null,
  p_modalidade text default null
)
returns table (
  id text,
  slot_id text,
  data_taf text,
  modalidade text,
  nip text,
  nome text,
  data_nascimento text,
  sexo text,
  categoria text,
  posto text,
  vinculo text,
  transporte text,
  updated_at bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  nh text := public.agendamento_nip_hash(p_nip);
begin
  if nh is null then
    return;
  end if;

  return query
  select
    r.id,
    r.slot_id,
    r.data_taf,
    r.modalidade,
    coalesce(dec.pl->>'nip', '')::text,
    coalesce(dec.pl->>'nome', '')::text,
    coalesce(dec.pl->>'data_nascimento', '')::text,
    coalesce(dec.pl->>'sexo', '')::text,
    coalesce(dec.pl->>'categoria', '')::text,
    coalesce(dec.pl->>'posto', '')::text,
    coalesce(dec.pl->>'vinculo', '')::text,
    coalesce(dec.pl->>'transporte', '')::text,
    r.updated_at
  from public.agendamento_reservas r
  cross join lateral (
    select public.agendamento_decrypt_json(r.payload_enc) as pl
  ) dec
  where coalesce(r.deleted, false) = false
    and r.nip_hash = nh
    and (
      (p_slot_id is not null and trim(p_slot_id) <> '' and r.slot_id = trim(p_slot_id))
      or (
        coalesce(trim(p_data_taf), '') <> ''
        and coalesce(trim(p_modalidade), '') <> ''
        and r.data_taf = trim(p_data_taf)
        and r.modalidade = trim(p_modalidade)
      )
    )
  order by r.updated_at desc nulls last
  limit 1;
end;
$$;

revoke all on function public.buscar_reserva_agendamento(text, text, text, text) from public;
grant execute on function public.buscar_reserva_agendamento(text, text, text, text) to anon, authenticated;

-- ─── Admin: listar reservas ───────────────────────────────────────────────────

drop function if exists public.listar_reservas_agendamento_admin();

create function public.listar_reservas_agendamento_admin()
returns table (
  id text,
  slot_id text,
  data_taf text,
  modalidade text,
  nip text,
  nome text,
  data_nascimento text,
  sexo text,
  categoria text,
  posto text,
  vinculo text,
  transporte text,
  updated_at bigint,
  deleted boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária';
  end if;

  return query
  select
    r.id,
    r.slot_id,
    r.data_taf,
    r.modalidade,
    coalesce(dec.pl->>'nip', coalesce(r.nip, ''))::text,
    coalesce(dec.pl->>'nome', coalesce(r.nome, ''))::text,
    coalesce(dec.pl->>'data_nascimento', coalesce(r.data_nascimento, ''))::text,
    coalesce(dec.pl->>'sexo', coalesce(r.sexo, ''))::text,
    coalesce(dec.pl->>'categoria', coalesce(r.categoria, ''))::text,
    coalesce(dec.pl->>'posto', coalesce(r.posto, ''))::text,
    coalesce(dec.pl->>'vinculo', coalesce(r.vinculo, ''))::text,
    coalesce(dec.pl->>'transporte', '')::text,
    r.updated_at,
    coalesce(r.deleted, false)
  from public.agendamento_reservas r
  cross join lateral (
    select public.agendamento_decrypt_json(r.payload_enc) as pl
  ) dec;
end;
$$;

revoke all on function public.listar_reservas_agendamento_admin() from public;
grant execute on function public.listar_reservas_agendamento_admin() to authenticated;

-- ─── Admin: upsert reserva ────────────────────────────────────────────────────

drop function if exists public.upsert_reserva_agendamento_admin(text, text, text, text, text, text, text, text, text, text, text, boolean, bigint);
drop function if exists public.upsert_reserva_agendamento_admin(text, text, text, text, text, text, text, text, text, text, text, text, boolean, bigint);

create function public.upsert_reserva_agendamento_admin(
  p_id text,
  p_slot_id text,
  p_data_taf text,
  p_modalidade text,
  p_nip text,
  p_nome text,
  p_data_nascimento text default '',
  p_sexo text default '',
  p_categoria text default '',
  p_posto text default '',
  p_vinculo text default '',
  p_transporte text default '',
  p_deleted boolean default false,
  p_updated_at bigint default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  nh text := public.agendamento_nip_hash(p_nip);
  tr text := lower(trim(coalesce(p_transporte, '')));
  pl jsonb;
  ts bigint := coalesce(p_updated_at, (extract(epoch from now()) * 1000)::bigint);
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária';
  end if;
  if nh is null then
    raise exception 'NIP inválido';
  end if;

  if tr <> '' and tr <> 'proprios' and tr <> 'institucional' then
    tr := '';
  end if;

  pl := jsonb_strip_nulls(jsonb_build_object(
    'nip', public.agendamento_nip_digits(p_nip),
    'nome', upper(trim(coalesce(p_nome, ''))),
    'data_nascimento', trim(coalesce(p_data_nascimento, '')),
    'sexo', upper(trim(coalesce(p_sexo, ''))),
    'categoria', trim(coalesce(p_categoria, '')),
    'posto', upper(trim(coalesce(p_posto, ''))),
    'vinculo', lower(trim(coalesce(p_vinculo, ''))),
    'transporte', nullif(tr, '')
  ));

  insert into public.agendamento_reservas as t (
    id, slot_id, data_taf, modalidade, nip_hash, payload_enc, updated_at, deleted,
    nip, nome, data_nascimento, sexo, categoria, posto, vinculo
  ) values (
    trim(p_id),
    trim(p_slot_id),
    trim(p_data_taf),
    trim(p_modalidade),
    nh,
    public.agendamento_encrypt_json(pl),
    ts,
    coalesce(p_deleted, false),
    null, null, null, null, null, null, null
  )
  on conflict (id) do update set
    slot_id = excluded.slot_id,
    data_taf = excluded.data_taf,
    modalidade = excluded.modalidade,
    nip_hash = excluded.nip_hash,
    payload_enc = excluded.payload_enc,
    updated_at = excluded.updated_at,
    deleted = excluded.deleted,
    nip = null,
    nome = null,
    data_nascimento = null,
    sexo = null,
    categoria = null,
    posto = null,
    vinculo = null;
end;
$$;

revoke all on function public.upsert_reserva_agendamento_admin(text, text, text, text, text, text, text, text, text, text, text, text, boolean, bigint) from public;
grant execute on function public.upsert_reserva_agendamento_admin(text, text, text, text, text, text, text, text, text, text, text, text, boolean, bigint) to authenticated;

notify pgrst, 'reload schema';
