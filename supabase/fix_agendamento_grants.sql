-- Correção rápida: liberar acesso às tabelas de agendamento
-- Cole no SQL Editor do Supabase e clique em Run

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.agendamento_slots to anon, authenticated;
grant select, insert, update, delete on public.agendamento_reservas to anon, authenticated;
