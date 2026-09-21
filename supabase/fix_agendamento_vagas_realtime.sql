-- =============================================================================
-- Realtime para disponibilidade de vagas (agendamento).
-- Execute no SQL Editor do Supabase para a contagem atualizar no app sem a
-- chave BNC e sem reabrir o modal.
-- Idempotente.
-- =============================================================================

alter table public.agendamento_reservas replica identity full;
alter table public.agendamento_slots replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'agendamento_reservas'
    ) then
      execute 'alter publication supabase_realtime add table public.agendamento_reservas';
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'agendamento_slots'
    ) then
      execute 'alter publication supabase_realtime add table public.agendamento_slots';
    end if;
  end if;
end $$;
