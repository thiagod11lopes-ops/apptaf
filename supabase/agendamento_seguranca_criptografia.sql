-- =============================================================================
-- Segurança máxima do agendamento: NIP/nome criptografados + acesso só via RPC.
--
-- OBRIGATÓRIO: execute no SQL Editor do Supabase (Run).
-- Antes de produção, altere o segredo em agendamento_crypto_pepper() abaixo.
-- =============================================================================

create extension if not exists pgcrypto;

-- ─── Segredo interno (ALTERE antes de produção) ───────────────────────────────
create or replace function public.agendamento_crypto_pepper()
returns text
language sql
immutable
security definer
set search_path = public
as $$
  select 'TAF-AGENDAMENTO-PEPPER-v1-ALTERE-ESTE-SEGREDO-ANTES-DE-PRODUCAO';
$$;

revoke all on function public.agendamento_crypto_pepper() from public;

create or replace function public.agendamento_crypto_key()
returns bytea
language sql
immutable
security definer
set search_path = public
as $$
  select digest(public.agendamento_crypto_pepper() || ':aes-key-v1', 'sha256');
$$;

revoke all on function public.agendamento_crypto_key() from public;

create or replace function public.agendamento_nip_digits(p_nip text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(p_nip, ''), '\D', '', 'g');
$$;

create or replace function public.agendamento_nip_hash(p_nip text)
returns text
language sql
immutable
security definer
set search_path = public
as $$
  select encode(
    digest(public.agendamento_nip_digits(p_nip) || ':' || public.agendamento_crypto_pepper(), 'sha256'),
    'hex'
  )
  where length(public.agendamento_nip_digits(p_nip)) >= 8;
$$;

revoke all on function public.agendamento_nip_hash(text) from public;
grant execute on function public.agendamento_nip_hash(text) to anon, authenticated;

create or replace function public.agendamento_encrypt_json(p_payload jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  iv bytea := gen_random_bytes(16);
  ct bytea;
begin
  ct := encrypt_iv(
    convert_to(coalesce(p_payload, '{}'::jsonb)::text, 'UTF8'),
    public.agendamento_crypto_key(),
    iv,
    'aes'
  );
  return encode(iv || ct, 'base64');
end;
$$;

revoke all on function public.agendamento_encrypt_json(jsonb) from public;

create or replace function public.agendamento_decrypt_json(p_enc text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  raw bytea;
  iv bytea;
  ct bytea;
  plain text;
begin
  if coalesce(trim(p_enc), '') = '' then
    return '{}'::jsonb;
  end if;
  raw := decode(p_enc, 'base64');
  if length(raw) < 17 then
    return '{}'::jsonb;
  end if;
  iv := substring(raw from 1 for 16);
  ct := substring(raw from 17);
  plain := convert_from(
    decrypt_iv(ct, public.agendamento_crypto_key(), iv, 'aes'),
    'UTF8'
  );
  return plain::jsonb;
exception
  when others then
    return '{}'::jsonb;
end;
$$;

revoke all on function public.agendamento_decrypt_json(text) from public;

-- ─── Colunas criptografadas ───────────────────────────────────────────────────

alter table public.agendamento_reservas
  add column if not exists nip_hash text,
  add column if not exists payload_enc text,
  add column if not exists data_nascimento text,
  add column if not exists sexo text,
  add column if not exists categoria text,
  add column if not exists posto text,
  add column if not exists vinculo text;

alter table public.agendamento_militar_lookup
  add column if not exists nip_hash text,
  add column if not exists payload_enc text;

-- Migra reservas legadas (texto plano → cifrado)
update public.agendamento_reservas r
set
  nip_hash = coalesce(r.nip_hash, public.agendamento_nip_hash(r.nip)),
  payload_enc = coalesce(
    r.payload_enc,
    public.agendamento_encrypt_json(
      jsonb_strip_nulls(
        jsonb_build_object(
          'nip', r.nip,
          'nome', r.nome,
          'data_nascimento', coalesce(r.data_nascimento, ''),
          'sexo', coalesce(r.sexo, ''),
          'categoria', coalesce(r.categoria, ''),
          'posto', coalesce(r.posto, ''),
          'vinculo', coalesce(r.vinculo, '')
        )
      )
    )
  )
where coalesce(r.payload_enc, '') = ''
  and coalesce(r.nip, '') <> '';

-- Migra lookup legado
update public.agendamento_militar_lookup l
set
  nip_hash = coalesce(l.nip_hash, public.agendamento_nip_hash(l.nip)),
  payload_enc = coalesce(
    l.payload_enc,
    public.agendamento_encrypt_json(
      jsonb_strip_nulls(
        jsonb_build_object(
          'nip', l.nip,
          'nome', l.nome,
          'data_nascimento', coalesce(l.data_nascimento, ''),
          'sexo', coalesce(l.sexo, ''),
          'categoria', coalesce(l.categoria, ''),
          'posto', coalesce(l.posto, ''),
          'vinculo', coalesce(l.vinculo, '')
        )
      )
    )
  )
where coalesce(l.payload_enc, '') = ''
  and coalesce(l.nip, '') <> '';

-- Remove texto plano (PII)
update public.agendamento_reservas
set nip = null, nome = null, data_nascimento = null, sexo = null,
    categoria = null, posto = null, vinculo = null
where payload_enc is not null and payload_enc <> '';

update public.agendamento_militar_lookup
set nip = null, nome = null, data_nascimento = null, sexo = null,
    categoria = null, posto = null, vinculo = null
where payload_enc is not null and payload_enc <> '';

-- Lookup: PK por hash (sem NIP legível na chave)
alter table public.agendamento_militar_lookup drop constraint if exists agendamento_militar_lookup_pkey;
delete from public.agendamento_militar_lookup where nip_hash is null;
alter table public.agendamento_militar_lookup alter column nip_hash set not null;
alter table public.agendamento_militar_lookup
  add constraint agendamento_militar_lookup_pkey primary key (nip_hash);

-- ─── RLS: anon não lê/grava PII diretamente ───────────────────────────────────

drop policy if exists "agendamento_reservas_select" on public.agendamento_reservas;
drop policy if exists "agendamento_reservas_insert" on public.agendamento_reservas;
drop policy if exists "agendamento_reservas_update" on public.agendamento_reservas;
drop policy if exists "agendamento_reservas_delete" on public.agendamento_reservas;

create policy "agendamento_reservas_select"
  on public.agendamento_reservas for select
  to authenticated
  using (auth.uid() is not null);

create policy "agendamento_reservas_insert"
  on public.agendamento_reservas for insert
  to authenticated
  with check (auth.uid() is not null);

create policy "agendamento_reservas_update"
  on public.agendamento_reservas for update
  to authenticated
  using (auth.uid() is not null);

create policy "agendamento_reservas_delete"
  on public.agendamento_reservas for delete
  to authenticated
  using (auth.uid() is not null);

revoke select, insert, update, delete on public.agendamento_reservas from anon;

-- Lookup: somente autenticados na tabela; anon usa RPC
revoke select, insert, update, delete on public.agendamento_militar_lookup from anon;

-- Slots permanecem legíveis (sem PII — só data/modalidade/vagas)
-- agendamento_slots_select continua using (true)

-- ─── RPC: contagem de vagas (sem PII) ───────────────────────────────────────

drop function if exists public.contar_reservas_por_slot();

create function public.contar_reservas_por_slot()
returns table (slot_id text, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select r.slot_id, count(*)::bigint
  from public.agendamento_reservas r
  where coalesce(r.deleted, false) = false
  group by r.slot_id;
$$;

revoke all on function public.contar_reservas_por_slot() from public;
grant execute on function public.contar_reservas_por_slot() to anon, authenticated;

-- ─── RPC: buscar reserva do próprio NIP ───────────────────────────────────────

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
  updated_at bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  nh text := public.agendamento_nip_hash(p_nip);
  pl jsonb;
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

-- ─── RPC: inscrever (página pública) ─────────────────────────────────────────

drop function if exists public.inscrever_agendamento_reserva(text, text, text, text, text, text, text, text, text, text, text);

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
  p_vinculo text default ''
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  nh text := public.agendamento_nip_hash(p_nip);
  rid text := trim(coalesce(p_id, ''));
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

  pl := jsonb_strip_nulls(jsonb_build_object(
    'nip', public.agendamento_nip_digits(p_nip),
    'nome', upper(trim(p_nome)),
    'data_nascimento', trim(coalesce(p_data_nascimento, '')),
    'sexo', upper(trim(coalesce(p_sexo, ''))),
    'categoria', trim(coalesce(p_categoria, '')),
    'posto', upper(trim(coalesce(p_posto, ''))),
    'vinculo', lower(trim(coalesce(p_vinculo, '')))
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

revoke all on function public.inscrever_agendamento_reserva(text, text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.inscrever_agendamento_reserva(text, text, text, text, text, text, text, text, text, text, text) to anon, authenticated;

-- ─── RPC: cancelar (valida hash do NIP) ───────────────────────────────────────

drop function if exists public.cancelar_agendamento_reserva(text, text);

create or replace function public.cancelar_agendamento_reserva(
  p_nip text,
  p_reserva_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  nh text := public.agendamento_nip_hash(p_nip);
  rid text := trim(coalesce(p_reserva_id, ''));
  n integer := 0;
begin
  if nh is null then
    raise exception 'NIP inválido';
  end if;
  if rid = '' then
    raise exception 'Reserva inválida';
  end if;

  update public.agendamento_reservas
  set
    deleted = true,
    updated_at = (extract(epoch from now()) * 1000)::bigint
  where id = rid
    and nip_hash = nh
    and coalesce(deleted, false) = false;

  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.cancelar_agendamento_reserva(text, text) from public;
grant execute on function public.cancelar_agendamento_reserva(text, text) to anon, authenticated;

-- ─── RPC: lookup militar (somente NIP informado) ──────────────────────────────

drop function if exists public.buscar_militar_agendamento(text);

create function public.buscar_militar_agendamento(p_nip text)
returns table (
  nome text,
  data_nascimento text,
  sexo text,
  categoria text,
  posto text,
  vinculo text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  nh text := public.agendamento_nip_hash(p_nip);
  pl jsonb;
begin
  if nh is null then
    return;
  end if;

  select public.agendamento_decrypt_json(l.payload_enc)
  into pl
  from public.agendamento_militar_lookup l
  where l.nip_hash = nh
    and coalesce(l.deleted, false) = false
  order by l.updated_at desc nulls last
  limit 1;

  if pl is null or pl = '{}'::jsonb then
    return;
  end if;

  return query
  select
    coalesce(pl->>'nome', '')::text,
    coalesce(pl->>'data_nascimento', '')::text,
    coalesce(pl->>'sexo', '')::text,
    coalesce(pl->>'categoria', '')::text,
    coalesce(pl->>'posto', '')::text,
    coalesce(pl->>'vinculo', '')::text;
end;
$$;

revoke all on function public.buscar_militar_agendamento(text) from public;
grant execute on function public.buscar_militar_agendamento(text) to anon, authenticated;

drop function if exists public.salvar_militar_agendamento(text, text, text, text, text, text, text);

create function public.salvar_militar_agendamento(
  p_nip text,
  p_nome text,
  p_data_nascimento text,
  p_sexo text,
  p_categoria text,
  p_posto text,
  p_vinculo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  nh text := public.agendamento_nip_hash(p_nip);
  pl jsonb;
  nip_key text;
begin
  if nh is null then
    raise exception 'NIP inválido';
  end if;
  if length(trim(coalesce(p_nome, ''))) < 3 then
    raise exception 'Nome inválido';
  end if;

  nip_key := public.agendamento_nip_digits(p_nip);
  pl := jsonb_strip_nulls(jsonb_build_object(
    'nip', nip_key,
    'nome', upper(trim(p_nome)),
    'data_nascimento', trim(coalesce(p_data_nascimento, '')),
    'sexo', upper(trim(coalesce(p_sexo, ''))),
    'categoria', trim(coalesce(p_categoria, '')),
    'posto', upper(trim(coalesce(p_posto, ''))),
    'vinculo', lower(trim(coalesce(p_vinculo, '')))
  ));

  insert into public.agendamento_militar_lookup as t (
    nip_hash, payload_enc, updated_at, deleted,
    nip, nome, data_nascimento, sexo, categoria, posto, vinculo
  ) values (
    nh,
    public.agendamento_encrypt_json(pl),
    (extract(epoch from now()) * 1000)::bigint,
    false,
    null, null, null, null, null, null, null
  )
  on conflict (nip_hash) do update set
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
end;
$$;

revoke all on function public.salvar_militar_agendamento(text, text, text, text, text, text, text) from public;
grant execute on function public.salvar_militar_agendamento(text, text, text, text, text, text, text) to anon, authenticated;

-- ─── RPC: admin — listar reservas descriptografadas (exige login) ─────────────

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

-- ─── RPC: admin — upsert reserva criptografada ────────────────────────────────

drop function if exists public.upsert_reserva_agendamento_admin(text, text, text, text, text, text, text, text, text, text, text, boolean, bigint);

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
  pl jsonb;
  ts bigint := coalesce(p_updated_at, (extract(epoch from now()) * 1000)::bigint);
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária';
  end if;
  if nh is null then
    raise exception 'NIP inválido';
  end if;

  pl := jsonb_strip_nulls(jsonb_build_object(
    'nip', public.agendamento_nip_digits(p_nip),
    'nome', upper(trim(coalesce(p_nome, ''))),
    'data_nascimento', trim(coalesce(p_data_nascimento, '')),
    'sexo', upper(trim(coalesce(p_sexo, ''))),
    'categoria', trim(coalesce(p_categoria, '')),
    'posto', upper(trim(coalesce(p_posto, ''))),
    'vinculo', lower(trim(coalesce(p_vinculo, '')))
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

revoke all on function public.upsert_reserva_agendamento_admin(text, text, text, text, text, text, text, text, text, text, text, boolean, bigint) from public;
grant execute on function public.upsert_reserva_agendamento_admin(text, text, text, text, text, text, text, text, text, text, text, boolean, bigint) to authenticated;

-- ─── RPC: admin — lookup ──────────────────────────────────────────────────────

drop function if exists public.listar_militar_lookup_admin();

create function public.listar_militar_lookup_admin()
returns table (
  nip text,
  nome text,
  data_nascimento text,
  sexo text,
  categoria text,
  posto text,
  vinculo text,
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
    coalesce(dec.pl->>'nip', coalesce(l.nip, ''))::text,
    coalesce(dec.pl->>'nome', coalesce(l.nome, ''))::text,
    coalesce(dec.pl->>'data_nascimento', coalesce(l.data_nascimento, ''))::text,
    coalesce(dec.pl->>'sexo', coalesce(l.sexo, ''))::text,
    coalesce(dec.pl->>'categoria', coalesce(l.categoria, ''))::text,
    coalesce(dec.pl->>'posto', coalesce(l.posto, ''))::text,
    coalesce(dec.pl->>'vinculo', coalesce(l.vinculo, ''))::text,
    l.updated_at,
    coalesce(l.deleted, false)
  from public.agendamento_militar_lookup l
  cross join lateral (
    select public.agendamento_decrypt_json(l.payload_enc) as pl
  ) dec;
end;
$$;

revoke all on function public.listar_militar_lookup_admin() from public;
grant execute on function public.listar_militar_lookup_admin() to authenticated;

drop function if exists public.upsert_militar_lookup_admin(text, text, text, text, text, text, text, boolean, bigint);

create function public.upsert_militar_lookup_admin(
  p_nip text,
  p_nome text,
  p_data_nascimento text default '',
  p_sexo text default '',
  p_categoria text default '',
  p_posto text default '',
  p_vinculo text default '',
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
  pl jsonb;
  ts bigint := coalesce(p_updated_at, (extract(epoch from now()) * 1000)::bigint);
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária';
  end if;
  if nh is null then
    raise exception 'NIP inválido';
  end if;

  pl := jsonb_strip_nulls(jsonb_build_object(
    'nip', public.agendamento_nip_digits(p_nip),
    'nome', upper(trim(coalesce(p_nome, ''))),
    'data_nascimento', trim(coalesce(p_data_nascimento, '')),
    'sexo', upper(trim(coalesce(p_sexo, ''))),
    'categoria', trim(coalesce(p_categoria, '')),
    'posto', upper(trim(coalesce(p_posto, ''))),
    'vinculo', lower(trim(coalesce(p_vinculo, '')))
  ));

  insert into public.agendamento_militar_lookup as t (
    nip_hash, payload_enc, updated_at, deleted,
    nip, nome, data_nascimento, sexo, categoria, posto, vinculo
  ) values (
    nh,
    public.agendamento_encrypt_json(pl),
    ts,
    coalesce(p_deleted, false),
    null, null, null, null, null, null, null
  )
  on conflict (nip_hash) do update set
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

revoke all on function public.upsert_militar_lookup_admin(text, text, text, text, text, text, text, boolean, bigint) from public;
grant execute on function public.upsert_militar_lookup_admin(text, text, text, text, text, text, text, boolean, bigint) to authenticated;

notify pgrst, 'reload schema';
