import { Platform } from 'react-native';
import { readAppMeta, writeAppMeta } from '../offline-first/db/appMeta';
import { nipDigitos } from '../utils/nipFormat';

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

/** Chave única (não depende de ownerUid) — evita gravar/ler em buckets diferentes. */
const STORAGE_KEY = 'fatoresRisco:registros';
const LEGACY_LS_PREFIX = 'fatoresRisco:';
const WEB_LS_KEY = '@taf-fatores-risco-v1';

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
      const prev = out[nip];
      if (!prev || (reg.updatedAt ?? 0) >= (prev.updatedAt ?? 0)) {
        out[nip] = reg;
      }
    }
  }
  return out;
}

function readWebLocalBackup(): Record<string, FatoresRiscoRegistro> {
  if (Platform.OS !== 'web') return {};
  try {
    if (typeof localStorage === 'undefined') return {};
    return parseMap(localStorage.getItem(WEB_LS_KEY));
  } catch {
    return {};
  }
}

function writeWebLocalBackup(map: Record<string, FatoresRiscoRegistro>): void {
  if (Platform.OS !== 'web') return;
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(WEB_LS_KEY, JSON.stringify(map));
  } catch {
    // silencioso
  }
}

async function readMap(): Promise<Record<string, FatoresRiscoRegistro>> {
  const primary = parseMap(await readAppMeta(STORAGE_KEY));
  const webBackup = readWebLocalBackup();

  // Migra chaves antigas por owner (fatoresRisco:<uid>) se ainda existirem no cache/meta.
  let legacy: Record<string, FatoresRiscoRegistro> = {};
  try {
    const { getCachedDataOwnerUid } = await import('./firebase/authUid');
    const owner = getCachedDataOwnerUid() ?? '__local__';
    const legacyRaw = await readAppMeta(`${LEGACY_LS_PREFIX}${owner}`);
    legacy = parseMap(legacyRaw);
  } catch {
    legacy = {};
  }

  return mergeMaps(legacy, webBackup, primary);
}

async function writeMap(map: Record<string, FatoresRiscoRegistro>): Promise<void> {
  const payload = JSON.stringify(map);
  writeWebLocalBackup(map);
  await writeAppMeta(STORAGE_KEY, payload);
}

export async function getAllFatoresRisco(): Promise<Record<string, FatoresRiscoRegistro>> {
  return readMap();
}

export async function getFatoresRiscoByNip(nip: string): Promise<FatoresRiscoRegistro | null> {
  const key = nipDigitos(nip);
  if (key.length !== 8) return null;
  const map = await readMap();
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

  const map = await readMap();
  const registro: FatoresRiscoRegistro = {
    nip: key,
    nome: input.nome.trim(),
    respostas: { ...input.respostas },
    usoRemedios: input.usoRemedios?.trim() || undefined,
    altura: input.altura?.trim() || undefined,
    peso: input.peso?.trim() || undefined,
    imc: input.imc,
    updatedAt: Date.now(),
  };

  map[key] = registro;
  await writeMap(map);

  // Confirma leitura imediata (falha cedo se a persistência não refletiu).
  const confirmado = (await readMap())[key];
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
  if (!map[key]) return false;

  delete map[key];
  await writeMap(map);

  const aindaExiste = (await readMap())[key];
  if (aindaExiste) {
    throw new Error('Falha ao confirmar exclusão dos fatores de risco.');
  }
  return true;
}

/** Remove todos os fatores de risco (cadastros e demais dados permanecem). */
export async function clearAllFatoresRisco(): Promise<number> {
  const map = await readMap();
  const count = Object.keys(map).length;
  if (count === 0) return 0;

  await writeMap({});

  // Limpa bucket legado por owner, se existir.
  try {
    const { getCachedDataOwnerUid } = await import('./firebase/authUid');
    const { removeAppMeta } = await import('../offline-first/db/appMeta');
    const owner = getCachedDataOwnerUid() ?? '__local__';
    await removeAppMeta(`${LEGACY_LS_PREFIX}${owner}`);
  } catch {
    // silencioso
  }

  const restante = Object.keys(await readMap()).length;
  if (restante > 0) {
    throw new Error('Falha ao confirmar exclusão de todos os fatores de risco.');
  }
  return count;
}
