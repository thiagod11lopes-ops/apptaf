-- =============================================================================
-- Cancelar inscrição pública (soft-delete) validando NIP + id da reserva.
--
-- OBRIGATÓRIO: cole este script no SQL Editor do Supabase e clique em Run.
-- Sem isso, a página pública mostra:
--   "Could not find the function public.cancelar_agendamento_reserva..."
-- =============================================================================

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
  digits text := regexp_replace(coalesce(p_nip, ''), '\D', '', 'g');
  rid text := trim(coalesce(p_reserva_id, ''));
  n integer := 0;
begin
  if length(digits) < 8 then
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
    and nip = digits
    and coalesce(deleted, false) = false;

  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.cancelar_agendamento_reserva(text, text) from public;
grant execute on function public.cancelar_agendamento_reserva(text, text) to anon, authenticated;

-- Atualiza o cache do PostgREST (API) para enxergar a função imediatamente.
notify pgrst, 'reload schema';
