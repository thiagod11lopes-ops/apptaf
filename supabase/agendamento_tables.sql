-- Tabelas de agendamento público do TAF
-- Execute no SQL Editor do Supabase (painel > SQL Editor > New Query)
--
-- agendamento_slots  → slots configurados pelo admin no aplicativo
-- agendamento_reservas → inscrições feitas pelos militares na página pública

-- ─── Slots ───────────────────────────────────────────────────────────────────
create table if not exists public.agendamento_slots (
  id                text        primary key,
  data_taf          text        not null,          -- formato DD/MM/AAAA
  modalidade        text        not null,
  max_participantes integer     not null default 10,
  updated_at        bigint      not null default 0,
  deleted           boolean     not null default false,
  owner_uid         uuid        references auth.users(id) on delete set null
);

-- ─── Reservas ─────────────────────────────────────────────────────────────────
create table if not exists public.agendamento_reservas (
  id         text    primary key,
  slot_id    text    not null,
  data_taf   text    not null,    -- denormalizado DD/MM/AAAA
  modalidade text    not null,
  nip        text    not null,
  nome       text    not null,
  updated_at bigint  not null default 0,
  deleted    boolean not null default false
);

-- ─── Row Level Security ────────────────────────────────────────────────────────
alter table public.agendamento_slots    enable row level security;
alter table public.agendamento_reservas enable row level security;

-- Slots: leitura pública (página dos militares), escrita apenas para autenticados
create policy "agendamento_slots_select"
  on public.agendamento_slots for select
  using (true);

create policy "agendamento_slots_insert"
  on public.agendamento_slots for insert
  with check (auth.uid() is not null);

create policy "agendamento_slots_update"
  on public.agendamento_slots for update
  using (auth.uid() is not null);

create policy "agendamento_slots_delete"
  on public.agendamento_slots for delete
  using (auth.uid() is not null);

-- Reservas: leitura e inserção pública (militares sem login), gestão pelos autenticados
create policy "agendamento_reservas_select"
  on public.agendamento_reservas for select
  using (true);

create policy "agendamento_reservas_insert"
  on public.agendamento_reservas for insert
  with check (true);

create policy "agendamento_reservas_update"
  on public.agendamento_reservas for update
  using (auth.uid() is not null);

create policy "agendamento_reservas_delete"
  on public.agendamento_reservas for delete
  using (auth.uid() is not null);
