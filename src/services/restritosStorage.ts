import { Platform } from 'react-native';
import { readAppMeta, writeAppMeta } from '../offline-first/db/appMeta';
import { nipDigitos } from '../utils/nipFormat';
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
};

const STORAGE_KEY = 'restritos:registros';
const WEB_LS_KEY = '@taf-restritos-v1';

function parseMap(raw: string | null | undefined): Record<string, RestritoRegistro> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, RestritoRegistro>;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readWebLocalBackup(): Record<string, RestritoRegistro> {
  if (Platform.OS !== 'web') return {};
  try {
    if (typeof localStorage === 'undefined') return {};
    return parseMap(localStorage.getItem(WEB_LS_KEY));
  } catch {
    return {};
  }
}

function writeWebLocalBackup(map: Record<string, RestritoRegistro>): void {
  if (Platform.OS !== 'web') return;
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(WEB_LS_KEY, JSON.stringify(map));
  } catch {
    // silencioso
  }
}

async function readMap(): Promise<Record<string, RestritoRegistro>> {
  const primary = parseMap(await readAppMeta(STORAGE_KEY));
  const webBackup = readWebLocalBackup();
  const out: Record<string, RestritoRegistro> = { ...webBackup };
  for (const [nip, reg] of Object.entries(primary)) {
    const prev = out[nip];
    if (!prev || (reg.updatedAt ?? 0) >= (prev.updatedAt ?? 0)) {
      out[nip] = reg;
    }
  }
  return out;
}

async function writeMap(map: Record<string, RestritoRegistro>): Promise<void> {
  const payload = JSON.stringify(map);
  writeWebLocalBackup(map);
  await writeAppMeta(STORAGE_KEY, payload);
  notifyDataChanged();
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

export async function getAllRestritos(): Promise<Record<string, RestritoRegistro>> {
  return readMap();
}

/** NIPs (8 dígitos) com dispensa ativa na data de referência. */
export async function getNipsRestritosAtivos(refBr: string = dataHojeBr()): Promise<Set<string>> {
  const map = await readMap();
  const ativos = new Set<string>();
  for (const [nip, reg] of Object.entries(map)) {
    if (isDispensaAtiva(reg, refBr)) ativos.add(nipDigitos(nip) || nip);
  }
  return ativos;
}

export async function getRestritoByNip(nip: string): Promise<RestritoRegistro | null> {
  const key = nipDigitos(nip);
  if (key.length !== 8) return null;
  const map = await readMap();
  return map[key] ?? null;
}

export async function saveRestrito(input: {
  nip: string;
  nome: string;
  dataInicio: string;
  dataFim: string;
}): Promise<RestritoRegistro> {
  const key = nipDigitos(input.nip);
  if (key.length !== 8) {
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
  const registro: RestritoRegistro = {
    nip: key,
    nome: input.nome.trim(),
    dataInicio: input.dataInicio.trim(),
    dataFim: input.dataFim.trim(),
    updatedAt: Date.now(),
  };
  map[key] = registro;
  await writeMap(map);

  const confirmado = (await readMap())[key];
  if (!confirmado) {
    throw new Error('Falha ao confirmar gravação do restrito.');
  }
  return confirmado;
}

export async function deleteRestritoByNip(nip: string): Promise<boolean> {
  const key = nipDigitos(nip);
  if (key.length !== 8) {
    throw new Error('NIP inválido');
  }
  const map = await readMap();
  if (!map[key]) return false;
  delete map[key];
  await writeMap(map);
  return true;
}

export async function clearAllRestritos(): Promise<number> {
  const map = await readMap();
  const n = Object.keys(map).length;
  await writeMap({});
  return n;
}
