-- Lookup público de militar para agendamento (NIP + nome de exibição).
-- Os cadastros na tabela `cadastros` ficam criptografados (E2E); esta tabela
-- guarda só o mínimo necessário para a página pública preencher o nome.
--
-- Execute no SQL Editor do Supabase.

create table if not exists public.agendamento_militar_lookup (
  nip        text    primary key,  -- 8 dígitos
  nome       text    not null,
  updated_at bigint  not null default 0,
  deleted    boolean not null default false
);

alter table public.agendamento_militar_lookup enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.agendamento_militar_lookup to authenticated;
-- anon NÃO lê a tabela direto — só via RPC abaixo

drop policy if exists "agendamento_militar_lookup_auth_all" on public.agendamento_militar_lookup;
create policy "agendamento_militar_lookup_auth_all"
  on public.agendamento_militar_lookup
  for all to authenticated
  using (true)
  with check (true);

-- Substitui a função anterior (que lia cadastros criptografados e nunca encontrava NIP)
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
    l.nome::text,
    null::text as categoria,
    null::text as posto,
    null::text as vinculo
  from public.agendamento_militar_lookup l
  where l.deleted = false
    and l.nip = digits
  order by l.updated_at desc nulls last
  limit 1;
end;
$$;

revoke all on function public.buscar_militar_agendamento(text) from public;
grant execute on function public.buscar_militar_agendamento(text) to anon, authenticated;
