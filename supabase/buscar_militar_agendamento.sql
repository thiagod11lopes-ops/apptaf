-- Busca pública (somente leitura mínima) de militar por NIP para a página de agendamento.
-- Não expõe a tabela cadastros; retorna só nome/posto/categoria/vinculo.
-- Execute no SQL Editor do Supabase.

create or replace function public.buscar_militar_agendamento(p_nip text)
returns table (
  nome text,
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
    nullif(trim(c.data->>'nome'), '')::text as nome,
    nullif(trim(c.data->>'categoria'), '')::text as categoria,
    coalesce(
      nullif(trim(c.data->>'oficial'), ''),
      nullif(trim(c.data->>'praca'), '')
    )::text as posto,
    nullif(trim(c.data->>'vinculo'), '')::text as vinculo
  from public.cadastros c
  where coalesce(c.deleted, false) = false
    and regexp_replace(coalesce(c.data->>'nip', ''), '\D', '', 'g') = digits
  order by c.updated_at desc nulls last
  limit 1;
end;
$$;

revoke all on function public.buscar_militar_agendamento(text) from public;
grant execute on function public.buscar_militar_agendamento(text) to anon, authenticated;
