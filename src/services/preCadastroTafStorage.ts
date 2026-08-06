import { getCachedDataOwnerUid, getCachedLoginUid, waitForAuthenticatedUid } from './firebase/authUid';
import {
  listPreCadastros,
  migratePreCadastrosFromAppMeta,
  ensurePreCadastrosLocalOnly,
  preCadastroRecordToTaf,
  savePreCadastroRecord,
  softDeletePreCadastroRecord,
  wipePreCadastrosForOwner,
} from '../offline-first/db/preCadastroLocalDb';
import { notifyDataChanged } from '../offline-first/sync/SyncEngine';

import type { TipoProvaTAF } from '../taf/tafProvaTypes';

export const MAX_PRE_CADASTRO_PARTICIPANTES = 15;

export type NormaTafPreCadastro = 'armada' | 'cfn';

export type PreCadastroParticipante = {
  nip: string;
  nomeMilitar: string;
  dataNascimento: string;
  sexo?: 'M' | 'F';
};

export type PreCadastroTaf = {
  id: string;
  criadoEm: number;
  /**
   * Número fixo na criação (1, 2, 3…). Não renumerar ao remover outros.
   * Só recomeça do 1 quando a lista estiver vazia.
   */
  numero: number;
  tipoProva: TipoProvaTAF;
  /** Padrão armada quando omitido (registros antigos). */
  normaTaf?: NormaTafPreCadastro;
  participantes: PreCadastroParticipante[];
};

/** Ordena pelo número persistente (menor em cima); desempate por criação. */
export function sortPreCadastrosPorNumero<T extends { numero?: number; criadoEm: number }>(
  lista: T[],
): T[] {
  return [...lista].sort((a, b) => {
    const na = typeof a.numero === 'number' && a.numero > 0 ? a.numero : Number.POSITIVE_INFINITY;
    const nb = typeof b.numero === 'number' && b.numero > 0 ? b.numero : Number.POSITIVE_INFINITY;
    if (na !== nb) return na - nb;
    return a.criadoEm - b.criadoEm;
  });
}

/** Próximo número: max dos existentes + 1, ou 1 se a lista estiver vazia. */
export function proximoNumeroPreCadastro(
  existentes: ReadonlyArray<{ numero?: number }>,
): number {
  if (existentes.length === 0) return 1;
  let max = 0;
  for (const item of existentes) {
    if (typeof item.numero === 'number' && item.numero > max) max = item.numero;
  }
  return max > 0 ? max + 1 : existentes.length + 1;
}

/**
 * Atribui números 1..N por ordem de criação aos que ainda não têm número válido.
 * Não altera itens que já possuem `numero` > 0.
 */
export function atribuirNumerosLegadoPorCriacao<T extends { numero?: number; criadoEm: number }>(
  lista: T[],
): T[] {
  const comNumero = lista.filter((i) => typeof i.numero === 'number' && i.numero > 0);
  const semNumero = lista
    .filter((i) => !(typeof i.numero === 'number' && i.numero > 0))
    .sort((a, b) => a.criadoEm - b.criadoEm);

  let next = 1;
  for (const item of comNumero) {
    if ((item.numero as number) >= next) next = (item.numero as number) + 1;
  }

  const atribuídos = new Map<T, number>();
  for (const item of semNumero) {
    atribuídos.set(item, next);
    next += 1;
  }

  return lista.map((item) => {
    const n = atribuídos.get(item);
    if (n == null) return item;
    return { ...item, numero: n };
  });
}

async function resolveOwnerUid(): Promise<string> {
  const uid = getCachedDataOwnerUid() ?? (await waitForAuthenticatedUid());
  return uid ?? '__local__';
}

export async function getAllPreCadastrosTaf(): Promise<PreCadastroTaf[]> {
  const ownerUid = await resolveOwnerUid();
  await migratePreCadastrosFromAppMeta(ownerUid);
  await ensurePreCadastrosLocalOnly(ownerUid);
  const rows = await listPreCadastros(ownerUid);
  const asTaf = rows.map(preCadastroRecordToTaf);
  const precisaMigrar = asTaf.some((p) => !(typeof p.numero === 'number' && p.numero > 0));
  if (!precisaMigrar) {
    return sortPreCadastrosPorNumero(asTaf);
  }

  const migrados = atribuirNumerosLegadoPorCriacao(asTaf);
  const userId = getCachedLoginUid();
  const beforeById = new Map(asTaf.map((p) => [p.id, p]));
  for (const item of migrados) {
    const original = beforeById.get(item.id);
    if (original && original.numero !== item.numero) {
      await savePreCadastroRecord(item, ownerUid, userId);
    }
  }
  return sortPreCadastrosPorNumero(migrados);
}

export async function addPreCadastroTaf(item: PreCadastroTaf): Promise<void> {
  const ownerUid = await resolveOwnerUid();
  const userId = getCachedLoginUid();
  const existentes = (await listPreCadastros(ownerUid)).map(preCadastroRecordToTaf);
  const comNumeros = atribuirNumerosLegadoPorCriacao(existentes);
  const beforeById = new Map(existentes.map((p) => [p.id, p]));
  for (const atual of comNumeros) {
    const antes = beforeById.get(atual.id);
    if (antes && antes.numero !== atual.numero) {
      await savePreCadastroRecord(atual, ownerUid, userId);
    }
  }
  const numero =
    typeof item.numero === 'number' && item.numero > 0
      ? item.numero
      : proximoNumeroPreCadastro(comNumeros);
  await savePreCadastroRecord({ ...item, numero }, ownerUid, userId);
  notifyDataChanged('preCadastros');
}

export async function removePreCadastroTaf(id: string): Promise<boolean> {
  const ownerUid = await resolveOwnerUid();
  const userId = getCachedLoginUid();
  const rows = await listPreCadastros(ownerUid, true);
  if (!rows.some((r) => r.id === id)) return false;
  await softDeletePreCadastroRecord(id, ownerUid, userId);
  notifyDataChanged('preCadastros');
  return true;
}

export async function clearAllPreCadastrosTaf(): Promise<void> {
  try {
    const uid = getCachedDataOwnerUid();
    const keys = new Set(['__local__']);
    if (uid) keys.add(uid);
    await Promise.all([...keys].map((ownerKey) => wipePreCadastrosForOwner(ownerKey)));
  } catch {
    // silencioso
  }
}
