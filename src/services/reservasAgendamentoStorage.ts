/**
 * Storage de reservas feitas pelos militares na página de agendamento.
 * Cada ReservaAgendamento associa um militar (NIP) a um SlotAgendamento.
 */
import { Platform } from 'react-native';
import { readAppMeta, writeAppMeta } from '../offline-first/db/appMeta';
import { getCachedDataOwnerUid } from './firebase/authUid';
import type { ModalidadeAgendamento } from './agendamentoStorage';
import { getSupabase } from '../config/supabase';

export type ReservaAgendamento = {
  id: string;
  slotId: string;
  /** Data do slot (DD/MM/AAAA) — denormalizada para consultas rápidas. */
  data: string;
  modalidade: ModalidadeAgendamento;
  nip: string;
  nome: string;
  categoria?: string;
  oficial?: string;
  praca?: string;
  vinculo?: 'carreira' | 'rm2';
  updatedAt: number;
  deleted?: boolean;
};

const STORAGE_KEY_LEGACY = 'reservas-agendamento:registros';
const WEB_LS_KEY_LEGACY = '@taf-reservas-agendamento-v1';

function resolveOwnerUid(ownerUid?: string | null): string {
  return (ownerUid ?? getCachedDataOwnerUid() ?? '').trim();
}

function storageKey(ownerUid?: string | null): string {
  const o = resolveOwnerUid(ownerUid);
  return o ? `reservas-agendamento:registros:${o}` : STORAGE_KEY_LEGACY;
}

function webLsKey(ownerUid?: string | null): string {
  const o = resolveOwnerUid(ownerUid);
  return o ? `@taf-reservas-agendamento-v1:${o}` : WEB_LS_KEY_LEGACY;
}

function parseMap(raw: string | null | undefined): Record<string, ReservaAgendamento> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, ReservaAgendamento>;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readWebKey(key: string): Record<string, ReservaAgendamento> {
  if (Platform.OS !== 'web') return {};
  try {
    if (typeof localStorage === 'undefined') return {};
    return parseMap(localStorage.getItem(key));
  } catch {
    return {};
  }
}

function writeWebKey(key: string, map: Record<string, ReservaAgendamento>): void {
  if (Platform.OS !== 'web') return;
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // silencioso
  }
}

function mergeMaps(
  ...maps: Array<Record<string, ReservaAgendamento>>
): Record<string, ReservaAgendamento> {
  const out: Record<string, ReservaAgendamento> = {};
  for (const map of maps) {
    for (const [id, r] of Object.entries(map)) {
      const prev = out[id];
      if (!prev || (r.updatedAt ?? 0) >= (prev.updatedAt ?? 0)) {
        out[id] = r;
      }
    }
  }
  return out;
}

async function readMap(
  ownerUid?: string | null,
): Promise<Record<string, ReservaAgendamento>> {
  const owner = resolveOwnerUid(ownerUid);
  const scoped = owner ? parseMap(await readAppMeta(storageKey(owner))) : {};
  const legacy = parseMap(await readAppMeta(STORAGE_KEY_LEGACY));
  const webScoped = owner ? readWebKey(webLsKey(owner)) : {};
  const webLegacy = readWebKey(WEB_LS_KEY_LEGACY);
  return mergeMaps(legacy, webLegacy, scoped, webScoped);
}

async function writeMap(
  map: Record<string, ReservaAgendamento>,
  ownerUid?: string | null,
): Promise<void> {
  const owner = resolveOwnerUid(ownerUid);
  const payload = JSON.stringify(map);
  await writeAppMeta(STORAGE_KEY_LEGACY, payload);
  writeWebKey(WEB_LS_KEY_LEGACY, map);
  if (owner) {
    await writeAppMeta(storageKey(owner), payload);
    writeWebKey(webLsKey(owner), map);
  }
}

function onlyActive(
  map: Record<string, ReservaAgendamento>,
): Record<string, ReservaAgendamento> {
  const out: Record<string, ReservaAgendamento> = {};
  for (const [id, r] of Object.entries(map)) {
    if (r.deleted === true) continue;
    out[id] = r;
  }
  return out;
}

export async function getAllReservas(
  ownerUid?: string | null,
): Promise<ReservaAgendamento[]> {
  return Object.values(onlyActive(await readMap(ownerUid)));
}

/** Reservas ativas para um slot específico. */
export async function getReservasBySlot(slotId: string): Promise<ReservaAgendamento[]> {
  const all = await getAllReservas();
  return all.filter((r) => r.slotId === slotId);
}

/** Reserva ativa do militar em um slot (para evitar duplicata). */
export async function getReservaMilitarNoSlot(
  nip: string,
  slotId: string,
): Promise<ReservaAgendamento | null> {
  const all = await getAllReservas();
  return all.find((r) => r.nip === nip && r.slotId === slotId) ?? null;
}

/** Cria ou substitui a reserva do militar (evita duplicata por NIP+slot). */
export async function saveReserva(input: {
  slotId: string;
  data: string;
  modalidade: ModalidadeAgendamento;
  nip: string;
  nome: string;
  categoria?: string;
  oficial?: string;
  praca?: string;
  vinculo?: 'carreira' | 'rm2';
}): Promise<ReservaAgendamento> {
  const map = await readMap();
  // Remove reserva anterior do mesmo militar no mesmo slot
  for (const [id, r] of Object.entries(map)) {
    if (r.nip === input.nip && r.slotId === input.slotId && !r.deleted) {
      map[id] = { ...r, deleted: true, updatedAt: Date.now() };
    }
  }

  const id = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const reserva: ReservaAgendamento = {
    id,
    slotId: input.slotId,
    data: input.data,
    modalidade: input.modalidade,
    nip: input.nip,
    nome: input.nome,
    categoria: input.categoria,
    oficial: input.oficial,
    praca: input.praca,
    vinculo: input.vinculo,
    updatedAt: Date.now(),
    deleted: false,
  };
  map[id] = reserva;
  await writeMap(map);
  void syncReservaSupabase(reserva);
  return reserva;
}

export async function deleteReserva(id: string): Promise<boolean> {
  const map = await readMap();
  const prev = map[id];
  if (!prev || prev.deleted === true) return false;
  const updated = { ...prev, deleted: true, updatedAt: Date.now() };
  map[id] = updated;
  await writeMap(map);
  void syncReservaSupabase(updated);
  return true;
}

// ── Sincronização com Supabase ────────────────────────────────────────────────

async function syncReservaSupabase(reserva: ReservaAgendamento): Promise<void> {
  try {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from('agendamento_reservas').upsert({
      id:         reserva.id,
      slot_id:    reserva.slotId,
      data_taf:   reserva.data,
      modalidade: reserva.modalidade,
      nip:        reserva.nip,
      nome:       reserva.nome,
      updated_at: reserva.updatedAt,
      deleted:    reserva.deleted ?? false,
    });
  } catch {
    // silencioso — dado já persistido localmente
  }
}

/**
 * Busca reservas do Supabase para um slot e faz merge com os dados locais.
 * Útil para o admin ver inscrições feitas pela página pública.
 */
export async function syncReservasFromSupabase(slotId?: string): Promise<void> {
  try {
    const sb = getSupabase();
    if (!sb) return;
    let query = sb.from('agendamento_reservas').select('*');
    if (slotId) query = query.eq('slot_id', slotId);

    const { data, error } = await query;
    if (error || !data?.length) return;

    const map = await readMap();
    for (const row of data) {
      const remote: ReservaAgendamento = {
        id:         row.id as string,
        slotId:     row.slot_id as string,
        data:       row.data_taf as string,
        modalidade: row.modalidade as ModalidadeAgendamento,
        nip:        row.nip as string,
        nome:       row.nome as string,
        categoria:  row.categoria as string | undefined,
        oficial:    row.oficial as string | undefined,
        praca:      row.praca as string | undefined,
        vinculo:    row.vinculo as 'carreira' | 'rm2' | undefined,
        updatedAt:  row.updated_at as number,
        deleted:    row.deleted as boolean,
      };
      const local = map[remote.id];
      if (!local || (remote.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
        map[remote.id] = remote;
      }
    }
    await writeMap(map);
  } catch {
    // silencioso
  }
}
