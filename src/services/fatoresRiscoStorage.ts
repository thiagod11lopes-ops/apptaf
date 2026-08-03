import { Platform } from 'react-native';
import { readAppMeta, writeAppMeta, removeAppMeta } from '../offline-first/db/appMeta';
import { getCachedDataOwnerUid } from './firebase/authUid';
import { nipChaveCadastro, nipDigitos } from '../utils/nipFormat';
import { labelObesidadeFromImcDados } from '../utils/imcFatoresRisco';
import { notifyDataChanged } from '../offline-first/sync/SyncEngine';

export type FatorRiscoId =
  | 'hipertensao'
  | 'diabetes'
  | 'dislipidemia'
  | 'tabagismo'
  | 'sedentarismo'
  | 'apneiaSono'
  | 'morteSubitaFamilia';

export type RespostaFatorRisco = 'sim' | 'nao' | null;

export type RespostasFatoresRisco = Record<FatorRiscoId, RespostaFatorRisco>;

export type FatoresRiscoRegistro = {
  nip: string;
  nome: string;
  respostas: RespostasFatoresRisco;
  /** Medicamentos em uso (texto livre). */
  usoRemedios?: string;
  /** Altura informada (m ou cm, texto original). */
  altura?: string;
  /** Peso em kg (texto original). */
  peso?: string;
  /** IMC calculado no momento do salvamento. */
  imc?: number;
  updatedAt: number;
  /** Tombstone local para sync LWW com a nuvem. */
  deleted?: boolean;
  /** ID opaco da linha no Supabase (não é o NIP). */
  cloudId?: string;
};

export const FATORES_RISCO_ITENS: ReadonlyArray<{ id: FatorRiscoId; label: string }> = [
  { id: 'hipertensao', label: 'Hipertensão' },
  { id: 'diabetes', label: 'Diabetes' },
  { id: 'dislipidemia', label: 'Dislipidemia' },
  { id: 'tabagismo', label: 'Tabagismo' },
  { id: 'sedentarismo', label: 'Sedentarismo' },
  { id: 'apneiaSono', label: 'Apnéia do sono' },
  { id: 'morteSubitaFamilia', label: 'Casos de morte súbita na família' },
];

const STORAGE_KEY_LEGACY = 'fatoresRisco:registros';
const LEGACY_OWNER_PREFIX = 'fatoresRisco:';
const WEB_LS_KEY_LEGACY = '@taf-fatores-risco-v1';

function resolveOwnerUid(ownerUid?: string | null): string {
  return (ownerUid ?? getCachedDataOwnerUid() ?? '').trim();
}

function storageKey(ownerUid?: string | null): string {
  const o = resolveOwnerUid(ownerUid);
  return o ? `fatoresRisco:registros:${o}` : STORAGE_KEY_LEGACY;
}

function webLsKey(ownerUid?: string | null): string {
  const o = resolveOwnerUid(ownerUid);
  return o ? `@taf-fatores-risco-v1:${o}` : WEB_LS_KEY_LEGACY;
}

export function respostasFatoresVazias(): RespostasFatoresRisco {
  return {
    hipertensao: null,
    diabetes: null,
    dislipidemia: null,
    tabagismo: null,
    sedentarismo: null,
    apneiaSono: null,
    morteSubitaFamilia: null,
  };
}

export function temFatorRiscoSim(respostas: RespostasFatoresRisco | null | undefined): boolean {
  if (!respostas) return false;
  return FATORES_RISCO_ITENS.some((item) => respostas[item.id] === 'sim');
}

export function listarFatoresRiscoSim(
  respostas: RespostasFatoresRisco | null | undefined,
): string[] {
  if (!respostas) return [];
  return FATORES_RISCO_ITENS.filter((item) => respostas[item.id] === 'sim').map((item) => item.label);
}

/** Fatores “Sim” + Obesidade Grau I/II/III (quando houver IMC). */
export function listarAlertasFatoresRisco(
  reg: FatoresRiscoRegistro | null | undefined,
): string[] {
  if (!reg) return [];
  const itens = listarFatoresRiscoSim(reg.respostas);
  const obesidade = labelObesidadeFromImcDados({
    imc: reg.imc,
    altura: reg.altura,
    peso: reg.peso,
  });
  if (obesidade) itens.push(obesidade);
  return itens;
}

/** Alerta visual (nome laranja): algum fator Sim ou obesidade grau 1+. */
export function temAlertaFatorRisco(reg: FatoresRiscoRegistro | null | undefined): boolean {
  if (!reg) return false;
  if (temFatorRiscoSim(reg.respostas)) return true;
  return (
    labelObesidadeFromImcDados({
      imc: reg.imc,
      altura: reg.altura,
      peso: reg.peso,
    }) != null
  );
}

function parseMap(raw: string | null | undefined): Record<string, FatoresRiscoRegistro> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, FatoresRiscoRegistro>;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function mergeMaps(
  ...maps: Array<Record<string, FatoresRiscoRegistro>>
): Record<string, FatoresRiscoRegistro> {
  const out: Record<string, FatoresRiscoRegistro> = {};
  for (const map of maps) {
    for (const [nip, reg] of Object.entries(map)) {
      const key = nipDigitos(nip) || nip;
      const prev = out[key];
      if (!prev || (reg.updatedAt ?? 0) >= (prev.updatedAt ?? 0)) {
        out[key] = { ...reg, nip: key };
      }
    }
  }
  return out;
}

function readWebLocalBackup(ownerUid?: string | null): Record<string, FatoresRiscoRegistro> {
  if (Platform.OS !== 'web') return {};
  try {
    if (typeof localStorage === 'undefined') return {};
    return parseMap(localStorage.getItem(webLsKey(ownerUid)));
  } catch {
    return {};
  }
}

function writeWebLocalBackup(
  map: Record<string, FatoresRiscoRegistro>,
  ownerUid?: string | null,
): void {
  if (Platform.OS !== 'web') return;
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(webLsKey(ownerUid), JSON.stringify(map));
  } catch {
    // silencioso
  }
}

function readLegacyWebGlobal(): Record<string, FatoresRiscoRegistro> {
  if (Platform.OS !== 'web') return {};
  try {
    if (typeof localStorage === 'undefined') return {};
    return parseMap(localStorage.getItem(WEB_LS_KEY_LEGACY));
  } catch {
    return {};
  }
}

/**
 * Une chaves legadas (sem owner / owner antigo) no mapa do chefe.
 * Antes: se o scoped já tinha 1 NIP, a migração abortava e o 2º salvo em
 * `fatoresRisco:registros` (sem UID) nunca entrava na contagem da Home.
 */
async function migrateLegacyIfNeeded(ownerUid: string): Promise<void> {
  if (!ownerUid) return;
  const scopedKey = storageKey(ownerUid);
  const existing = parseMap(await readAppMeta(scopedKey));
  const legacyGlobal = parseMap(await readAppMeta(STORAGE_KEY_LEGACY));
  const legacyOwner = parseMap(await readAppMeta(`${LEGACY_OWNER_PREFIX}${ownerUid}`));
  const legacyWeb = readLegacyWebGlobal();
  const merged = mergeMaps(legacyOwner, legacyWeb, legacyGlobal, existing);
  if (Object.keys(merged).length === 0) return;
  if (JSON.stringify(merged) === JSON.stringify(existing)) return;
  await writeAppMeta(scopedKey, JSON.stringify(merged));
  writeWebLocalBackup(merged, ownerUid);
}

async function readMap(
  ownerUid?: string | null,
): Promise<Record<string, FatoresRiscoRegistro>> {
  const owner = resolveOwnerUid(ownerUid);
  if (owner) {
    await migrateLegacyIfNeeded(owner);
  }
  const primary = parseMap(await readAppMeta(storageKey(owner)));
  const webBackup = readWebLocalBackup(owner);
  // Sempre mescla legado global — cobre gravação sem ownerUid entre cadastros.
  const legacyGlobal = owner ? parseMap(await readAppMeta(STORAGE_KEY_LEGACY)) : {};
  const legacyWeb = owner ? readLegacyWebGlobal() : {};
  return mergeMaps(legacyWeb, legacyGlobal, webBackup, primary);
}

async function writeMap(
  map: Record<string, FatoresRiscoRegistro>,
  ownerUid?: string | null,
): Promise<void> {
  const owner = resolveOwnerUid(ownerUid);
  const payload = JSON.stringify(map);
  writeWebLocalBackup(map, owner);
  await writeAppMeta(storageKey(owner), payload);
  // Evita cópia órfã na chave legada competir com o mapa do chefe.
  if (owner) {
    try {
      await removeAppMeta(STORAGE_KEY_LEGACY);
    } catch {
      // ignore
    }
  }
  notifyDataChanged();
}

function onlyActive(
  map: Record<string, FatoresRiscoRegistro>,
): Record<string, FatoresRiscoRegistro> {
  const out: Record<string, FatoresRiscoRegistro> = {};
  for (const [nip, reg] of Object.entries(map)) {
    if (reg.deleted === true) continue;
    out[nip] = reg;
  }
  return out;
}

/** Ativos (sem tombstones) — UI. */
export async function getAllFatoresRisco(
  ownerUid?: string | null,
): Promise<Record<string, FatoresRiscoRegistro>> {
  return onlyActive(await readMap(ownerUid));
}

/**
 * NIPs com alerta de fator de risco (algum “Sim” ou obesidade por IMC).
 * Alinhado a `temAlertaFatorRisco` (listagens/alertas). O card da Home usa
 * `getNipsComFatoresRiscoPreenchidos`.
 */
export async function getNipsComFatorRiscoSim(
  ownerUid?: string | null,
): Promise<Set<string>> {
  const map = await getAllFatoresRisco(ownerUid);
  const out = new Set<string>();
  for (const [nip, reg] of Object.entries(map)) {
    if (!temAlertaFatorRisco(reg)) continue;
    const key =
      nipChaveCadastro(nip) ||
      nipChaveCadastro(reg.nip) ||
      (nipDigitos(nip).length === 8 ? nipDigitos(nip) : '');
    if (key) out.add(key);
  }
  return out;
}

/** NIPs com questionário de fatores de risco totalmente preenchido (Sim/Não em todos). */
export async function getNipsComFatoresRiscoPreenchidos(
  ownerUid?: string | null,
): Promise<Set<string>> {
  const map = await getAllFatoresRisco(ownerUid);
  const out = new Set<string>();
  for (const [nip, reg] of Object.entries(map)) {
    if (!FATORES_RISCO_ITENS.every((item) => {
      const v = reg.respostas?.[item.id];
      return v === 'sim' || v === 'nao';
    })) {
      continue;
    }
    const key = nipChaveCadastro(nip) || nipChaveCadastro(reg.nip);
    if (key) out.add(key);
  }
  return out;
}

/** Inclui tombstones — sync LWW. */
export async function getAllFatoresRiscoIncludingDeleted(
  ownerUid?: string | null,
): Promise<Record<string, FatoresRiscoRegistro>> {
  return readMap(ownerUid);
}

export async function replaceAllFatoresRiscoMap(
  map: Record<string, FatoresRiscoRegistro>,
  ownerUid?: string | null,
): Promise<void> {
  await writeMap(map, ownerUid);
}

export async function getFatoresRiscoByNip(nip: string): Promise<FatoresRiscoRegistro | null> {
  const key = nipDigitos(nip);
  if (key.length !== 8) return null;
  const map = await getAllFatoresRisco();
  return map[key] ?? null;
}

export async function saveFatoresRisco(input: {
  nip: string;
  nome: string;
  respostas: RespostasFatoresRisco;
  usoRemedios?: string;
  altura?: string;
  peso?: string;
  imc?: number;
}): Promise<FatoresRiscoRegistro> {
  const key = nipDigitos(input.nip);
  if (key.length !== 8) {
    throw new Error('NIP inválido');
  }

  // Garante ownerUid do chefe antes de gravar (evita chave legada sem UID).
  let ownerUid = getCachedDataOwnerUid();
  if (!ownerUid) {
    try {
      const { resolveStorageOwnerUid } = await import('./firebase/authUid');
      ownerUid = await resolveStorageOwnerUid();
    } catch {
      ownerUid = null;
    }
  }

  const map = await readMap(ownerUid);
  const prev = map[key];
  const registro: FatoresRiscoRegistro = {
    nip: key,
    nome: input.nome.trim(),
    respostas: { ...input.respostas },
    usoRemedios: input.usoRemedios?.trim() || undefined,
    altura: input.altura?.trim() || undefined,
    peso: input.peso?.trim() || undefined,
    imc: input.imc,
    updatedAt: Date.now(),
    deleted: false,
    cloudId: prev?.cloudId,
  };

  map[key] = registro;
  await writeMap(map, ownerUid);

  const confirmado = onlyActive(await readMap(ownerUid))[key];
  if (!confirmado) {
    throw new Error('Falha ao confirmar gravação dos fatores de risco.');
  }
  return confirmado;
}

export async function deleteFatoresRiscoByNip(nip: string): Promise<boolean> {
  const key = nipDigitos(nip);
  if (key.length !== 8) {
    throw new Error('NIP inválido');
  }

  const map = await readMap();
  const prev = map[key];
  if (!prev || prev.deleted === true) return false;

  map[key] = {
    ...prev,
    deleted: true,
    updatedAt: Date.now(),
  };
  await writeMap(map);
  return true;
}

/** Soft-delete de todos (próxima sync envia tombstones). */
export async function clearAllFatoresRisco(ownerUid?: string | null): Promise<number> {
  const map = await readMap(ownerUid);
  const ativos = Object.values(map).filter((r) => r.deleted !== true);
  if (ativos.length === 0) {
    await writeMap({}, ownerUid);
    return 0;
  }
  const now = Date.now();
  const next: Record<string, FatoresRiscoRegistro> = { ...map };
  for (const reg of ativos) {
    const nip = nipDigitos(reg.nip);
    next[nip] = { ...reg, nip, deleted: true, updatedAt: now };
  }
  await writeMap(next, ownerUid);

  try {
    const owner = resolveOwnerUid(ownerUid);
    if (owner) await removeAppMeta(`${LEGACY_OWNER_PREFIX}${owner}`);
  } catch {
    // silencioso
  }

  return ativos.length;
}

/** Apaga local sem tombstones (wipe de equipe / sistema). */
export async function wipeLocalFatoresRisco(ownerUid?: string | null): Promise<void> {
  await writeMap({}, ownerUid);
  try {
    const owner = resolveOwnerUid(ownerUid);
    if (owner) await removeAppMeta(`${LEGACY_OWNER_PREFIX}${owner}`);
    await removeAppMeta(STORAGE_KEY_LEGACY);
  } catch {
    // silencioso
  }
}
