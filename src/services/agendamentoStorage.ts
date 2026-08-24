/**
 * Storage de disponibilidade de vagas para agendamento do TAF.
 * Cada SlotAgendamento representa uma modalidade disponível em uma data
 * com um limite de participantes.
 * Natação e Permanência são agrupadas em 'natacao_permanencia'.
 */
import { Platform } from 'react-native';
import { readAppMeta, writeAppMeta } from '../offline-first/db/appMeta';
import { getCachedDataOwnerUid } from './firebase/authUid';
import { dataBrParaIso } from '../utils/tafRegistro';
import { getSupabase } from '../config/supabase';

export type ModalidadeAgendamento =
  | 'corrida'
  | 'natacao_permanencia'
  | 'caminhada'
  | 'flexao_barra'
  | 'flexao_solo'
  | 'abdominal_remador'
  | 'abdominal_prancha';

export const MODALIDADE_AGENDAMENTO_LABELS: Record<ModalidadeAgendamento, string> = {
  corrida: 'Corrida',
  natacao_permanencia: 'Natação + Permanência',
  caminhada: 'Caminhada',
  flexao_barra: 'Flexão de Barra (CFN)',
  flexao_solo: 'Flexão de Solo (CFN)',
  abdominal_remador: 'Abdominal Remador (CFN)',
  abdominal_prancha: 'Abdominal Prancha (CFN)',
};

export const MODALIDADES_AGENDAMENTO: ModalidadeAgendamento[] = [
  'corrida',
  'natacao_permanencia',
  'caminhada',
  'flexao_barra',
  'flexao_solo',
  'abdominal_remador',
  'abdominal_prancha',
];

export type SlotAgendamento = {
  /** ID único do slot (timestamp_random). */
  id: string;
  /** Data da disponibilidade (DD/MM/AAAA). */
  data: string;
  modalidade: ModalidadeAgendamento;
  /** Número máximo de participantes para este slot. */
  maxParticipantes: number;
  updatedAt: number;
  deleted?: boolean;
};

const STORAGE_KEY_LEGACY = 'agendamento:slots';
const WEB_LS_KEY_LEGACY = '@taf-agendamento-v1';

function resolveOwnerUid(ownerUid?: string | null): string {
  return (ownerUid ?? getCachedDataOwnerUid() ?? '').trim();
}

function storageKey(ownerUid?: string | null): string {
  const o = resolveOwnerUid(ownerUid);
  return o ? `agendamento:slots:${o}` : STORAGE_KEY_LEGACY;
}

function webLsKey(ownerUid?: string | null): string {
  const o = resolveOwnerUid(ownerUid);
  return o ? `@taf-agendamento-v1:${o}` : WEB_LS_KEY_LEGACY;
}

function parseMap(raw: string | null | undefined): Record<string, SlotAgendamento> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, SlotAgendamento>;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readWebKey(key: string): Record<string, SlotAgendamento> {
  if (Platform.OS !== 'web') return {};
  try {
    if (typeof localStorage === 'undefined') return {};
    return parseMap(localStorage.getItem(key));
  } catch {
    return {};
  }
}

function writeWebKey(key: string, map: Record<string, SlotAgendamento>): void {
  if (Platform.OS !== 'web') return;
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // silencioso
  }
}

function mergeMaps(
  ...maps: Array<Record<string, SlotAgendamento>>
): Record<string, SlotAgendamento> {
  const out: Record<string, SlotAgendamento> = {};
  for (const map of maps) {
    for (const [id, slot] of Object.entries(map)) {
      const prev = out[id];
      if (!prev || (slot.updatedAt ?? 0) >= (prev.updatedAt ?? 0)) {
        out[id] = slot;
      }
    }
  }
  return out;
}

async function readMap(
  ownerUid?: string | null,
): Promise<Record<string, SlotAgendamento>> {
  const owner = resolveOwnerUid(ownerUid);
  const scoped = owner ? parseMap(await readAppMeta(storageKey(owner))) : {};
  const legacy = parseMap(await readAppMeta(STORAGE_KEY_LEGACY));
  const webScoped = owner ? readWebKey(webLsKey(owner)) : {};
  const webLegacy = readWebKey(WEB_LS_KEY_LEGACY);
  return mergeMaps(legacy, webLegacy, scoped, webScoped);
}

async function writeMap(
  map: Record<string, SlotAgendamento>,
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
  map: Record<string, SlotAgendamento>,
): Record<string, SlotAgendamento> {
  const out: Record<string, SlotAgendamento> = {};
  for (const [id, slot] of Object.entries(map)) {
    if (slot.deleted === true) continue;
    out[id] = slot;
  }
  return out;
}

export async function getAllSlots(
  ownerUid?: string | null,
): Promise<SlotAgendamento[]> {
  const map = onlyActive(await readMap(ownerUid));
  return Object.values(map).sort((a, b) => {
    const ia = dataBrParaIso(a.data) ?? '';
    const ib = dataBrParaIso(b.data) ?? '';
    if (ia !== ib) return ia.localeCompare(ib);
    return a.modalidade.localeCompare(b.modalidade);
  });
}

/** Cria ou atualiza um slot. Passa `id` para atualizar, omite para criar. */
export async function saveSlot(input: {
  id?: string;
  data: string;
  modalidade: ModalidadeAgendamento;
  maxParticipantes: number;
}): Promise<SlotAgendamento> {
  if (!dataBrParaIso(input.data)) {
    throw new Error('Informe a data no formato DD/MM/AAAA.');
  }
  if (!Number.isFinite(input.maxParticipantes) || input.maxParticipantes < 1) {
    throw new Error('Informe um número máximo de participantes válido (mínimo 1).');
  }

  const map = await readMap();
  const id =
    input.id && map[input.id]
      ? input.id
      : `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

  const slot: SlotAgendamento = {
    id,
    data: input.data.trim(),
    modalidade: input.modalidade,
    maxParticipantes: Math.floor(input.maxParticipantes),
    updatedAt: Date.now(),
    deleted: false,
  };
  map[id] = slot;
  await writeMap(map);
  void syncSlotSupabase(slot);
  return slot;
}

export async function deleteSlot(id: string): Promise<boolean> {
  const map = await readMap();
  const prev = map[id];
  if (!prev || prev.deleted === true) return false;
  const updated = { ...prev, deleted: true, updatedAt: Date.now() };
  map[id] = updated;
  await writeMap(map);
  void syncSlotSupabase(updated);
  return true;
}

export async function wipeLocalSlots(ownerUid?: string | null): Promise<void> {
  await writeMap({}, ownerUid);
}

// ── Sincronização com Supabase ────────────────────────────────────────────────
// Chamada após cada escrita local. Falha silenciosa: o dado já foi salvo localmente.

async function syncSlotSupabase(slot: SlotAgendamento): Promise<void> {
  try {
    const sb = getSupabase();
    if (!sb) return;
    const ownerUid = resolveOwnerUid() || null;
    await sb.from('agendamento_slots').upsert({
      id:               slot.id,
      data_taf:         slot.data,
      modalidade:       slot.modalidade,
      max_participantes: slot.maxParticipantes,
      updated_at:       slot.updatedAt,
      deleted:          slot.deleted ?? false,
      owner_uid:        ownerUid || undefined,
    });
  } catch {
    // silencioso — dado já persistido localmente
  }
}

/** Envia todos os slots locais ativos para o Supabase (publicação na página pública). */
export async function pushAllSlotsToSupabase(ownerUid?: string | null): Promise<void> {
  try {
    const sb = getSupabase();
    if (!sb) return;
    const slots = await getAllSlots(ownerUid);
    await Promise.all(slots.map((slot) => syncSlotSupabase(slot)));
  } catch {
    // silencioso
  }
}

/** Puxa os slots do Supabase e faz merge com os dados locais (para sincronizar entre dispositivos). */
export async function syncSlotsFromSupabase(ownerUid?: string | null): Promise<void> {
  try {
    const sb = getSupabase();
    if (!sb) return;
    const owner = resolveOwnerUid(ownerUid);
    let query = sb.from('agendamento_slots').select('*');
    if (owner) query = query.eq('owner_uid', owner);

    const { data, error } = await query;
    if (error || !data?.length) return;

    const map = await readMap(ownerUid);
    for (const row of data) {
      const remote: SlotAgendamento = {
        id:              row.id as string,
        data:            row.data_taf as string,
        modalidade:      row.modalidade as ModalidadeAgendamento,
        maxParticipantes: row.max_participantes as number,
        updatedAt:       row.updated_at as number,
        deleted:         row.deleted as boolean,
      };
      const local = map[remote.id];
      if (!local || (remote.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
        map[remote.id] = remote;
      }
    }
    await writeMap(map, ownerUid);
  } catch {
    // silencioso
  }
}
