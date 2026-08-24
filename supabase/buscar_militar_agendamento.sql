-- Busca pública por NIP para a página de agendamento.
-- Fonte: agendamento_militar_lookup (cadastros.data é E2E — não usar).
-- Preferir rodar: fix_buscar_militar_agendamento_completo.sql

alter table public.agendamento_militar_lookup add column if not exists data_nascimento text not null default '';
alter table public.agendamento_militar_lookup add column if not exists sexo text not null default '';
alter table public.agendamento_militar_lookup add column if not exists categoria text not null default '';
alter table public.agendamento_militar_lookup add column if not exists posto text not null default '';
alter table public.agendamento_militar_lookup add column if not exists vinculo text not null default '';

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
