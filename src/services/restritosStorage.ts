import { Platform } from 'react-native';
import { readAppMeta, writeAppMeta } from '../offline-first/db/appMeta';
import { getCachedDataOwnerUid } from './firebase/authUid';
import { nipChaveCadastro, nipDigitos } from '../utils/nipFormat';
import { dataBrParaIso, dataHojeBr } from '../utils/tafRegistro';
import { notifyDataChanged } from '../offline-first/sync/SyncEngine';

export type RestritoRegistro = {
  nip: string;
  nome: string;
  /** Início da dispensa (DD/MM/AAAA). */
  dataInicio: string;
  /** Fim da dispensa (DD/MM/AAAA). */
  dataFim: string;
  updatedAt: number;
  /** Tombstone local para sync LWW com a nuvem. */
  deleted?: boolean;
  /** ID opaco da linha no Supabase (não é o NIP). */
  cloudId?: string;
};

const STORAGE_KEY_LEGACY = 'restritos:registros';
const WEB_LS_KEY_LEGACY = '@taf-restritos-v1';

function resolveOwnerUid(ownerUid?: string | null): string {
  return (ownerUid ?? getCachedDataOwnerUid() ?? '').trim();
}

function storageKey(ownerUid?: string | null): string {
  const o = resolveOwnerUid(ownerUid);
  return o ? `restritos:registros:${o}` : STORAGE_KEY_LEGACY;
}

function webLsKey(ownerUid?: string | null): string {
  const o = resolveOwnerUid(ownerUid);
  return o ? `@taf-restritos-v1:${o}` : WEB_LS_KEY_LEGACY;
}

function parseMap(raw: string | null | undefined): Record<string, RestritoRegistro> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, RestritoRegistro>;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readWebKey(key: string): Record<string, RestritoRegistro> {
  if (Platform.OS !== 'web') return {};
  try {
    if (typeof localStorage === 'undefined') return {};
    return parseMap(localStorage.getItem(key));
  } catch {
    return {};
  }
}

function writeWebKey(key: string, map: Record<string, RestritoRegistro>): void {
  if (Platform.OS !== 'web') return;
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // silencioso
  }
}

function mergeMaps(
  ...maps: Array<Record<string, RestritoRegistro>>
): Record<string, RestritoRegistro> {
  const out: Record<string, RestritoRegistro> = {};
  for (const map of maps) {
    for (const [nip, reg] of Object.entries(map)) {
      const key = nipChaveCadastro(nip) || nipDigitos(nip) || nip;
      if (!key) continue;
      const prev = out[key];
      if (!prev || (reg.updatedAt ?? 0) >= (prev.updatedAt ?? 0)) {
        out[key] = { ...reg, nip: key };
      }
    }
  }
  return out;
}

/**
 * Sempre une legado + bucket do owner + backups web.
 * Evita Home=0 quando o registro ficou em outra chave de meta.
 */
async function readMap(
  ownerUid?: string | null,
): Promise<Record<string, RestritoRegistro>> {
  const owner = resolveOwnerUid(ownerUid);
  const scoped = owner ? parseMap(await readAppMeta(storageKey(owner))) : {};
  const legacy = parseMap(await readAppMeta(STORAGE_KEY_LEGACY));
  const webScoped = owner ? readWebKey(webLsKey(owner)) : {};
  const webLegacy = readWebKey(WEB_LS_KEY_LEGACY);
  return mergeMaps(legacy, webLegacy, scoped, webScoped);
}

async function writeMap(
  map: Record<string, RestritoRegistro>,
  ownerUid?: string | null,
): Promise<void> {
  const owner = resolveOwnerUid(ownerUid);
  const payload = JSON.stringify(map);
  // Espelha no legado e no bucket do owner para qualquer caminho de leitura.
  await writeAppMeta(STORAGE_KEY_LEGACY, payload);
  writeWebKey(WEB_LS_KEY_LEGACY, map);
  if (owner) {
    await writeAppMeta(storageKey(owner), payload);
    writeWebKey(webLsKey(owner), map);
  }
  notifyDataChanged();
}

function onlyActive(
  map: Record<string, RestritoRegistro>,
): Record<string, RestritoRegistro> {
  const out: Record<string, RestritoRegistro> = {};
  for (const [nip, reg] of Object.entries(map)) {
    if (reg.deleted === true) continue;
    out[nip] = reg;
  }
  return out;
}

/** Normaliza digitação parcial para DD/MM/AAAA. */
export function formatDataDispensaInput(raw: string): string {
  const digitos = raw.replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

export function dataDispensaValida(dataBr: string): boolean {
  return dataBrParaIso(dataBr) != null;
}

/**
 * Dispensa ativa se a data de referência (padrão: hoje) estiver entre início e fim (inclusive).
 */
export function isDispensaAtiva(
  reg: Pick<RestritoRegistro, 'dataInicio' | 'dataFim'>,
  refBr: string = dataHojeBr(),
): boolean {
  const inicioIso = dataBrParaIso(reg.dataInicio);
  const fimIso = dataBrParaIso(reg.dataFim);
  const refIso = dataBrParaIso(refBr);
  if (!inicioIso || !fimIso || !refIso) return false;
  return inicioIso <= refIso && refIso <= fimIso;
}

/**
 * Vencida a partir do dia seguinte ao fim da dispensa (hoje > dataFim).
 */
export function isDispensaVencida(
  reg: Pick<RestritoRegistro, 'dataFim'>,
  refBr: string = dataHojeBr(),
): boolean {
  const fimIso = dataBrParaIso(reg.dataFim);
  const refIso = dataBrParaIso(refBr);
  if (!fimIso || !refIso) return false;
  return refIso > fimIso;
}

/**
 * Remove automaticamente da lista (soft-delete) as dispensas cujo fim já passou.
 * Retorna quantos registros foram expirados nesta passagem.
 */
export async function purgeRestritosVencidos(
  ownerUid?: string | null,
  refBr: string = dataHojeBr(),
): Promise<number> {
  const map = await readMap(ownerUid);
  let n = 0;
  const now = Date.now();
  const next: Record<string, RestritoRegistro> = { ...map };
  for (const [nip, reg] of Object.entries(map)) {
    if (reg.deleted === true) continue;
    if (!isDispensaVencida(reg, refBr)) continue;
    next[nip] = { ...reg, deleted: true, updatedAt: now };
    n += 1;
  }
  if (n > 0) {
    await writeMap(next, ownerUid);
  }
  return n;
}

/** Ativos (sem tombstones e sem vencidos) — uso na UI e no balanço Home. */
export async function getAllRestritos(
  ownerUid?: string | null,
): Promise<Record<string, RestritoRegistro>> {
  await purgeRestritosVencidos(ownerUid);
  return onlyActive(await readMap(ownerUid));
}

/** Inclui tombstones — uso no sync LWW. */
export async function getAllRestritosIncludingDeleted(
  ownerUid?: string | null,
): Promise<Record<string, RestritoRegistro>> {
  return readMap(ownerUid);
}

/** Substitui o mapa completo (sync). */
export async function replaceAllRestritosMap(
  map: Record<string, RestritoRegistro>,
  ownerUid?: string | null,
): Promise<void> {
  await writeMap(map, ownerUid);
}

/** NIPs (8 dígitos) com dispensa ativa na data de referência. */
export async function getNipsRestritosAtivos(refBr: string = dataHojeBr()): Promise<Set<string>> {
  const map = await getAllRestritos();
  const ativos = new Set<string>();
  for (const [nip, reg] of Object.entries(map)) {
    if (!isDispensaAtiva(reg, refBr)) continue;
    const key = nipChaveCadastro(nip) || nipChaveCadastro(reg.nip);
    if (key) ativos.add(key);
  }
  return ativos;
}

export async function getRestritoByNip(nip: string): Promise<RestritoRegistro | null> {
  const key = nipChaveCadastro(nip);
  if (!key) return null;
  const map = await getAllRestritos();
  return map[key] ?? null;
}

export async function saveRestrito(input: {
  nip: string;
  nome: string;
  dataInicio: string;
  dataFim: string;
}): Promise<RestritoRegistro> {
  const key = nipChaveCadastro(input.nip);
  if (!key) {
    throw new Error('NIP inválido');
  }
  if (!dataDispensaValida(input.dataInicio)) {
    throw new Error('Informe a data de início no formato DD/MM/AAAA.');
  }
  if (!dataDispensaValida(input.dataFim)) {
    throw new Error('Informe a data de fim no formato DD/MM/AAAA.');
  }
  const inicioIso = dataBrParaIso(input.dataInicio)!;
  const fimIso = dataBrParaIso(input.dataFim)!;
  if (fimIso < inicioIso) {
    throw new Error('A data de fim deve ser igual ou posterior à data de início.');
  }

  const map = await readMap();
  const prev = map[key];
  const registro: RestritoRegistro = {
    nip: key,
    nome: input.nome.trim(),
    dataInicio: input.dataInicio.trim(),
    dataFim: input.dataFim.trim(),
    updatedAt: Date.now(),
    deleted: false,
    cloudId: prev?.cloudId,
  };
  map[key] = registro;
  await writeMap(map);

  const confirmado = onlyActive(await readMap())[key];
  if (!confirmado) {
    throw new Error('Falha ao confirmar gravação do restrito.');
  }
  return confirmado;
}

export async function deleteRestritoByNip(nip: string): Promise<boolean> {
  const key = nipChaveCadastro(nip);
  if (!key) {
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

export async function clearAllRestritos(ownerUid?: string | null): Promise<number> {
  const map = await readMap(ownerUid);
  const ativos = Object.values(map).filter((r) => r.deleted !== true);
  if (ativos.length === 0) {
    await writeMap({}, ownerUid);
    return 0;
  }
  const now = Date.now();
  const next: Record<string, RestritoRegistro> = { ...map };
  for (const reg of ativos) {
    const nip = nipChaveCadastro(reg.nip) || nipDigitos(reg.nip);
    next[nip] = { ...reg, nip, deleted: true, updatedAt: now };
  }
  await writeMap(next, ownerUid);
  return ativos.length;
}

/** Apaga local sem tombstones (wipe de equipe / sistema). */
export async function wipeLocalRestritos(ownerUid?: string | null): Promise<void> {
  await writeMap({}, ownerUid);
}
