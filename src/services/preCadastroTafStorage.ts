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

export const MAX_PRE_CADASTRO_PARTICIPANTES = 20;

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
  /**
   * Nome de código OTAN (Alfa…Zulu). Obrigatório em novos; único entre pré-cadastros ativos.
   */
  nomeCodigo?: string;
  tipoProva: TipoProvaTAF;
  /** Padrão armada quando omitido (registros antigos). */
  normaTaf?: NormaTafPreCadastro;
  participantes: PreCadastroParticipante[];
};

/** Alfabeto fonético (Alfa → Zulu) para nomear pré-cadastros. */
export const NOMES_CODIGO_PRE_CADASTRO = [
  'Alfa',
  'Bravo',
  'Charlie',
  'Delta',
  'Echo',
  'Foxtrot',
  'Golf',
  'Hotel',
  'India',
  'Juliet',
  'Kilo',
  'Lima',
  'Mike',
  'November',
  'Oscar',
  'Papa',
  'Quebec',
  'Romeo',
  'Sierra',
  'Tango',
  'Uniform',
  'Victor',
  'Whiskey',
  'Xray',
  'Yankee',
  'Zulu',
] as const;

export type NomeCodigoPreCadastro = (typeof NOMES_CODIGO_PRE_CADASTRO)[number];

export function isNomeCodigoPreCadastro(value: string): value is NomeCodigoPreCadastro {
  return (NOMES_CODIGO_PRE_CADASTRO as readonly string[]).includes(value);
}

export function nomesCodigoEmUso(
  existentes: ReadonlyArray<{ nomeCodigo?: string }>,
): Set<string> {
  const used = new Set<string>();
  for (const item of existentes) {
    const n = (item.nomeCodigo || '').trim();
    if (n) used.add(n);
  }
  return used;
}

export function nomesCodigoDisponiveis(
  existentes: ReadonlyArray<{ nomeCodigo?: string }>,
): NomeCodigoPreCadastro[] {
  const used = nomesCodigoEmUso(existentes);
  return NOMES_CODIGO_PRE_CADASTRO.filter((n) => !used.has(n));
}

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

/** Sufixo do pré-cadastro de permanência espelhado a partir da natação. */
export const PRE_CADASTRO_PERMANENCIA_PAIR_SUFFIX = '__permanencia';

export function idPreCadastroPermanenciaPareada(natacaoId: string): string {
  return `${natacaoId}${PRE_CADASTRO_PERMANENCIA_PAIR_SUFFIX}`;
}

export function idPreCadastroNatacaoDePermanenciaPareada(
  permanenciaId: string,
): string | null {
  if (!permanenciaId.endsWith(PRE_CADASTRO_PERMANENCIA_PAIR_SUFFIX)) return null;
  return permanenciaId.slice(0, -PRE_CADASTRO_PERMANENCIA_PAIR_SUFFIX.length);
}

/** IDs do próprio item e do par natação↔permanência (se houver). */
export function idsPreCadastroPareados(pre: {
  id: string;
  tipoProva?: TipoProvaTAF | null;
}): string[] {
  const ids = [pre.id];
  if (pre.tipoProva === 'natacao') {
    ids.push(idPreCadastroPermanenciaPareada(pre.id));
  } else {
    const natacaoId = idPreCadastroNatacaoDePermanenciaPareada(pre.id);
    if (natacaoId) ids.push(natacaoId);
  }
  return ids;
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
  const salvo: PreCadastroTaf = { ...item, numero };
  await savePreCadastroRecord(salvo, ownerUid, userId);

  // Natação e permanência usam o mesmo grupo: espelha participantes na permanência.
  if (salvo.tipoProva === 'natacao') {
    const pairId = idPreCadastroPermanenciaPareada(salvo.id);
    const pairExistente = existentes.find((p) => p.id === pairId);
    const existentesAposNatacao = [
      ...comNumeros.filter((p) => p.id !== salvo.id),
      salvo,
    ];
    const numeroPar =
      pairExistente && typeof pairExistente.numero === 'number' && pairExistente.numero > 0
        ? pairExistente.numero
        : proximoNumeroPreCadastro(existentesAposNatacao);
    await savePreCadastroRecord(
      {
        ...salvo,
        id: pairId,
        tipoProva: 'permanencia',
        numero: numeroPar,
        criadoEm: pairExistente?.criadoEm ?? salvo.criadoEm,
      },
      ownerUid,
      userId,
    );
  }

  notifyDataChanged('preCadastros');
}

export async function removePreCadastroTaf(id: string): Promise<boolean> {
  const ownerUid = await resolveOwnerUid();
  const userId = getCachedLoginUid();
  const rows = await listPreCadastros(ownerUid, true);
  const alvo = rows.find((r) => r.id === id);
  if (!alvo) return false;
  await softDeletePreCadastroRecord(id, ownerUid, userId);

  const taf = preCadastroRecordToTaf(alvo);
  if (taf.tipoProva === 'natacao') {
    const pairId = idPreCadastroPermanenciaPareada(id);
    if (rows.some((r) => r.id === pairId)) {
      await softDeletePreCadastroRecord(pairId, ownerUid, userId);
    }
  }

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
