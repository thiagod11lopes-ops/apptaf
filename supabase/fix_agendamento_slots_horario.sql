-- Colunas de configuração de horário / fechamento da agenda pública.
-- Cole no SQL Editor do Supabase e clique em Run.

alter table public.agendamento_slots
  add column if not exists hora_inicio integer not null default 8;

alter table public.agendamento_slots
  add column if not exists fechamento_antecedencia_horas integer;

comment on column public.agendamento_slots.hora_inicio is
  'Hora local do início dos testes (0-23).';
comment on column public.agendamento_slots.fechamento_antecedencia_horas is
  'Fecha a agenda N horas antes do início (12|24|48). NULL = fecha na hora da prova.';
