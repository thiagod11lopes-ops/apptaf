import { Platform } from 'react-native';
import { readAppMeta, writeAppMeta } from '../offline-first/db/appMeta';
import { getCachedDataOwnerUid } from './firebase/authUid';
import { nipChaveCadastro, nipDigitos } from '../utils/nipFormat';
import { dataBrParaIso } from '../utils/tafRegistro';

export type PresencaTfmRegistro = {
  /** NIP 8 dígitos. */
  nip: string;
  nome: string;
  /** Datas de presença registradas (DD/MM/AAAA), ordenadas desc. */
  datas: string[];
  updatedAt: number;
  deleted?: boolean;
};

const STORAGE_KEY_LEGACY = 'presenca-tfm:registros';
const WEB_LS_KEY_LEGACY = '@taf-presenca-tfm-v1';

function resolveOwnerUid(ownerUid?: string | null): string {
  return (ownerUid ?? getCachedDataOwnerUid() ?? '').trim();
}

function storageKey(ownerUid?: string | null): string {
  const o = resolveOwnerUid(ownerUid);
  return o ? `presenca-tfm:registros:${o}` : STORAGE_KEY_LEGACY;
}

function webLsKey(ownerUid?: string | null): string {
  const o = resolveOwnerUid(ownerUid);
  return o ? `@taf-presenca-tfm-v1:${o}` : WEB_LS_KEY_LEGACY;
}

function parseMap(raw: string | null | undefined): Record<string, PresencaTfmRegistro> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, PresencaTfmRegistro>;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readWebKey(key: string): Record<string, PresencaTfmRegistro> {
  if (Platform.OS !== 'web') return {};
  try {
    if (typeof localStorage === 'undefined') return {};
    return parseMap(localStorage.getItem(key));
  } catch {
    return {};
  }
}

function writeWebKey(key: string, map: Record<string, PresencaTfmRegistro>): void {
  if (Platform.OS !== 'web') return;
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // silencioso
  }
}

function mergeMaps(
  ...maps: Array<Record<string, PresencaTfmRegistro>>
): Record<string, PresencaTfmRegistro> {
  const out: Record<string, PresencaTfmRegistro> = {};
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

async function readMap(
  ownerUid?: string | null,
): Promise<Record<string, PresencaTfmRegistro>> {
  const owner = resolveOwnerUid(ownerUid);
  const scoped = owner ? parseMap(await readAppMeta(storageKey(owner))) : {};
  const legacy = parseMap(await readAppMeta(STORAGE_KEY_LEGACY));
  const webScoped = owner ? readWebKey(webLsKey(owner)) : {};
  const webLegacy = readWebKey(WEB_LS_KEY_LEGACY);
  return mergeMaps(legacy, webLegacy, scoped, webScoped);
}

async function writeMap(
  map: Record<string, PresencaTfmRegistro>,
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
  map: Record<string, PresencaTfmRegistro>,
): Record<string, PresencaTfmRegistro> {
  const out: Record<string, PresencaTfmRegistro> = {};
  for (const [nip, reg] of Object.entries(map)) {
    if (reg.deleted === true) continue;
    out[nip] = reg;
  }
  return out;
}

/** Normaliza digitação parcial para DD/MM/AAAA. */
export function formatDataPresencaInput(raw: string): string {
  const digitos = raw.replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

export function dataPresencaValida(dataBr: string): boolean {
  return dataBrParaIso(dataBr) != null;
}

export async function getAllPresencas(
  ownerUid?: string | null,
): Promise<Record<string, PresencaTfmRegistro>> {
  return onlyActive(await readMap(ownerUid));
}

export async function getPresencaByNip(
  nip: string,
): Promise<PresencaTfmRegistro | null> {
  const key = nipChaveCadastro(nip);
  if (!key) return null;
  const map = await getAllPresencas();
  return map[key] ?? null;
}

/** Adiciona uma data de presença ao registro do militar (sem duplicar). */
export async function registrarPresenca(input: {
  nip: string;
  nome: string;
  data: string;
}): Promise<PresencaTfmRegistro> {
  const key = nipChaveCadastro(input.nip);
  if (!key) throw new Error('NIP inválido');
  if (!dataPresencaValida(input.data)) {
    throw new Error('Informe a data no formato DD/MM/AAAA.');
  }

  const map = await readMap();
  const prev = map[key];
  const datasAtuais = (prev?.datas ?? []).filter((d) => d !== input.data);
  // Insere a nova data e ordena descendente por ISO
  const datasOrdenadas = [input.data, ...datasAtuais].sort((a, b) => {
    const ia = dataBrParaIso(a) ?? '';
    const ib = dataBrParaIso(b) ?? '';
    return ib.localeCompare(ia);
  });

  const registro: PresencaTfmRegistro = {
    nip: key,
    nome: input.nome.trim(),
    datas: datasOrdenadas,
    updatedAt: Date.now(),
    deleted: false,
  };
  map[key] = registro;
  await writeMap(map);
  return registro;
}

/** Remove uma data específica do registro do militar. */
export async function removerDataPresenca(
  nip: string,
  data: string,
): Promise<void> {
  const key = nipChaveCadastro(nip);
  if (!key) return;
  const map = await readMap();
  const prev = map[key];
  if (!prev || prev.deleted) return;
  const datasRestantes = (prev.datas ?? []).filter((d) => d !== data);
  if (datasRestantes.length === 0) {
    map[key] = { ...prev, deleted: true, updatedAt: Date.now() };
  } else {
    map[key] = { ...prev, datas: datasRestantes, updatedAt: Date.now() };
  }
  await writeMap(map);
}

/** Remove todos os registros de presença de um militar. */
export async function deletePresencaByNip(nip: string): Promise<boolean> {
  const key = nipChaveCadastro(nip);
  if (!key) return false;
  const map = await readMap();
  const prev = map[key];
  if (!prev || prev.deleted === true) return false;
  map[key] = { ...prev, deleted: true, updatedAt: Date.now() };
  await writeMap(map);
  return true;
}

export async function wipeLocalPresencas(ownerUid?: string | null): Promise<void> {
  await writeMap({}, ownerUid);
}
