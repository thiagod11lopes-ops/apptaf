-- =============================================================================
-- Correção rápida: RPC pública para contagem de vagas (página de agendamento).
-- Execute no SQL Editor do Supabase se a página mostrar erro ao carregar vagas.
-- Para segurança completa, use também: agendamento_seguranca_criptografia.sql
-- =============================================================================

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

notify pgrst, 'reload schema';
