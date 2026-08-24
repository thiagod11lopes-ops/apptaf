-- Corrige a busca pública por NIP: devolve TODOS os campos da lookup.
-- IMPORTANTE: CREATE OR REPLACE NÃO altera o tipo de retorno — é obrigatório DROP.
-- Cole no SQL Editor do Supabase e clique em Run.

alter table public.agendamento_militar_lookup add column if not exists data_nascimento text not null default '';
alter table public.agendamento_militar_lookup add column if not exists sexo text not null default '';
alter table public.agendamento_militar_lookup add column if not exists categoria text not null default '';
alter table public.agendamento_militar_lookup add column if not exists posto text not null default '';
alter table public.agendamento_militar_lookup add column if not exists vinculo text not null default '';

-- Remove qualquer overload antiga (ex.: só nome / sem data_nascimento / lendo cadastros E2E)
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

-- Upsert público (página de agendamento) — também com DROP para evitar overload
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
    data_nascimento = case
      when nullif(trim(excluded.data_nascimento), '') is not null then excluded.data_nascimento
      else t.data_nascimento
    end,
    sexo = case
      when nullif(trim(excluded.sexo), '') is not null then excluded.sexo
      else t.sexo
    end,
    categoria = case
      when nullif(trim(excluded.categoria), '') is not null then excluded.categoria
      else t.categoria
    end,
    posto = case
      when nullif(trim(excluded.posto), '') is not null then excluded.posto
      else t.posto
    end,
    vinculo = case
      when nullif(trim(excluded.vinculo), '') is not null then excluded.vinculo
      else t.vinculo
    end,
    updated_at = excluded.updated_at,
    deleted = false;
end;
$$;

revoke all on function public.salvar_militar_agendamento(text, text, text, text, text, text, text) from public;
grant execute on function public.salvar_militar_agendamento(text, text, text, text, text, text, text) to anon, authenticated;
