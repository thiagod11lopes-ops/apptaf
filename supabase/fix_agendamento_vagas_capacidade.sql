-- =============================================================================
-- Limite de vagas na inscrição pública + dedupe NIP/slot.
-- Execute no SQL Editor do Supabase se a página permitir ultrapassar o máximo
-- configurado em "Disponibilidade de vagas".
-- Idempotente.
-- =============================================================================

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
  max_p integer;
  atuais bigint;
  sid text := trim(coalesce(p_slot_id, ''));
begin
  if nh is null then
    raise exception 'NIP inválido';
  end if;
  if rid = '' then
    raise exception 'ID inválido';
  end if;
  if sid = '' then
    raise exception 'Slot inválido';
  end if;
  if length(trim(coalesce(p_nome, ''))) < 3 then
    raise exception 'Nome inválido';
  end if;
  if tr <> 'proprios' and tr <> 'institucional' then
    raise exception 'Informe o transporte (Meios próprios ou Transporte Institucional)';
  end if;

  select s.max_participantes into max_p
  from public.agendamento_slots s
  where s.id = sid
    and coalesce(s.deleted, false) = false;
  if max_p is null then
    raise exception 'Disponibilidade não encontrada';
  end if;

  update public.agendamento_reservas
  set
    deleted = true,
    updated_at = (extract(epoch from now()) * 1000)::bigint
  where slot_id = sid
    and nip_hash = nh
    and coalesce(deleted, false) = false
    and id <> rid;

  select count(*)::bigint into atuais
  from public.agendamento_reservas r
  where r.slot_id = sid
    and coalesce(r.deleted, false) = false
    and r.id <> rid;
  if atuais >= max_p then
    raise exception 'Vagas esgotadas para esta prova';
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
    sid,
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

notify pgrst, 'reload schema';
