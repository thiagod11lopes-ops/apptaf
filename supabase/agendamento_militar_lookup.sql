-- Lookup de militar para agendamento (campos necessários ao cadastro público).
-- Execute no SQL Editor do Supabase (pode rodar de novo com segurança).

create table if not exists public.agendamento_militar_lookup (
  nip              text    primary key,  -- 8 dígitos
  nome             text    not null default '',
  data_nascimento  text    not null default '',
  sexo             text    not null default '',  -- M | F
  categoria        text    not null default '',  -- Oficiais | Praças
  posto            text    not null default '',
  vinculo          text    not null default '',  -- carreira | rm2
  updated_at       bigint  not null default 0,
  deleted          boolean not null default false
);

-- Colunas extras se a tabela já existia (versão só com nip/nome)
alter table public.agendamento_militar_lookup add column if not exists data_nascimento text not null default '';
alter table public.agendamento_militar_lookup add column if not exists sexo text not null default '';
alter table public.agendamento_militar_lookup add column if not exists categoria text not null default '';
alter table public.agendamento_militar_lookup add column if not exists posto text not null default '';
alter table public.agendamento_militar_lookup add column if not exists vinculo text not null default '';

alter table public.agendamento_militar_lookup enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.agendamento_militar_lookup to authenticated;

drop policy if exists "agendamento_militar_lookup_auth_all" on public.agendamento_militar_lookup;
create policy "agendamento_militar_lookup_auth_all"
  on public.agendamento_militar_lookup
  for all to authenticated
  using (true)
  with check (true);

-- Busca por NIP (página pública)
create or replace function public.buscar_militar_agendamento(p_nip text)
returns table (
  nome text,
  data_nascimento text,
  sexo text,
  categoria text,
  posto text,
  vinculo text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  digits text := regexp_replace(coalesce(p_nip, ''), '\D', '', 'g');
begin
  if length(digits) < 8 then
    return;
  end if;

  return query
  select
    coalesce(l.nome, '')::text,
    coalesce(l.data_nascimento, '')::text,
    coalesce(l.sexo, '')::text,
    coalesce(l.categoria, '')::text,
    coalesce(l.posto, '')::text,
    coalesce(l.vinculo, '')::text
  from public.agendamento_militar_lookup l
  where l.deleted = false
    and l.nip = digits
  order by l.updated_at desc nulls last
  limit 1;
end;
$$;

revoke all on function public.buscar_militar_agendamento(text) from public;
grant execute on function public.buscar_militar_agendamento(text) to anon, authenticated;

-- Upsert público ao completar cadastro na página de agendamento
create or replace function public.salvar_militar_agendamento(
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
  digits text := regexp_replace(coalesce(p_nip, ''), '\D', '', 'g');
begin
  if length(digits) < 8 then
    raise exception 'NIP inválido';
  end if;
  if length(trim(coalesce(p_nome, ''))) < 3 then
    raise exception 'Nome inválido';
  end if;

  insert into public.agendamento_militar_lookup as t (
    nip, nome, data_nascimento, sexo, categoria, posto, vinculo, updated_at, deleted
  ) values (
    digits,
    upper(trim(p_nome)),
    trim(coalesce(p_data_nascimento, '')),
    upper(trim(coalesce(p_sexo, ''))),
    trim(coalesce(p_categoria, '')),
    upper(trim(coalesce(p_posto, ''))),
    lower(trim(coalesce(p_vinculo, ''))),
    (extract(epoch from now()) * 1000)::bigint,
    false
  )
  on conflict (nip) do update set
    nome = excluded.nome,
    data_nascimento = excluded.data_nascimento,
    sexo = excluded.sexo,
    categoria = excluded.categoria,
    posto = excluded.posto,
    vinculo = excluded.vinculo,
    updated_at = excluded.updated_at,
    deleted = false;
end;
$$;

revoke all on function public.salvar_militar_agendamento(text, text, text, text, text, text, text) from public;
grant execute on function public.salvar_militar_agendamento(text, text, text, text, text, text, text) to anon, authenticated;

-- Colunas extras nas reservas (opcional, para o admin ver os dados)
alter table public.agendamento_reservas add column if not exists data_nascimento text;
alter table public.agendamento_reservas add column if not exists sexo text;
alter table public.agendamento_reservas add column if not exists categoria text;
alter table public.agendamento_reservas add column if not exists posto text;
alter table public.agendamento_reservas add column if not exists vinculo text;
