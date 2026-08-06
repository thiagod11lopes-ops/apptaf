import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import { getTafDatabase } from '../offline-first/db/tafDatabase';
import {
  listCadastrosForDisplay,
  listSessoesForDisplay,
  listDeletedSessoesForDisplay,
} from '../offline-first/db/localDb';
import {
  subscribeDataChanged,
  type DataChangeScope,
} from '../offline-first/sync/SyncEngine';
import {
  calcularResumoInicioTafFromHistorico,
  type ResumoInicioTafHistorico,
} from './resultadoGeralHistorico';
import { isDemoCadastroId, isDemoSessaoId } from './gatherSystemBackupData';
import { getNipsRestritosAtivos } from '../services/restritosStorage';
import { getNipsComFatoresRiscoPreenchidos } from '../services/fatoresRiscoStorage';
import { getCachedDataOwnerUid } from '../services/firebase/authUid';

const RESUMO_VAZIO: ResumoInicioTafHistorico = {
  totalCadastrados: 0,
  completos: 0,
  parcial: 0,
  semTeste: 0,
  restritos: 0,
  fatoresRisco: 0,
  cadastroIncompleto: 0,
  reprovados: 0,
};

/** Escopos que alteram os cards da Home. */
const HOME_RESUMO_SCOPES: readonly DataChangeScope[] = [
  'cadastros',
  'sessoes',
  'fatores',
  'restritos',
];

type HomeResumoCacheEntry = {
  ownerUid: string | null;
  resumo: ResumoInicioTafHistorico;
  /** true = há mudança; UI pode mostrar stale enquanto recalcula. */
  dirty: boolean;
};

let cache: HomeResumoCacheEntry | null = null;
/** Sobe a cada invalidação — descarta resultados in-flight obsoletos. */
let cacheGeneration = 0;
let inFlight: {
  ownerUid: string | null;
  generation: number;
  promise: Promise<ResumoInicioTafHistorico>;
} | null = null;
let invalidationSubscribed = false;

function ensureHomeResumoInvalidation(): void {
  if (invalidationSubscribed) return;
  invalidationSubscribed = true;
  subscribeDataChanged(() => {
    invalidateHomeResumoCache();
  }, { scopes: HOME_RESUMO_SCOPES });
}

/**
 * Soft-invalidate: marca sujo, mas mantém o último resumo (stale-while-revalidate).
 * Evita flash de zeros ao trocar de aba.
 */
export function invalidateHomeResumoCache(): void {
  cacheGeneration += 1;
  inFlight = null;
  if (cache) {
    cache = { ...cache, dirty: true };
  }
}

/** Limpa tudo (troca de conta / logout). */
export function clearHomeResumoCache(): void {
  cache = null;
  cacheGeneration += 1;
  inFlight = null;
}

/** Leitura síncrona do cache atual (mesmo owner), mesmo se dirty. */
export function peekHomeResumoCache(): ResumoInicioTafHistorico | null {
  const ownerUid = getCachedDataOwnerUid();
  if (!cache || cache.ownerUid !== ownerUid) return null;
  return cache.resumo;
}

/** Cache do owner atual precisa recalcular. */
export function isHomeResumoCacheDirty(): boolean {
  const ownerUid = getCachedDataOwnerUid();
  if (!cache || cache.ownerUid !== ownerUid) return true;
  return cache.dirty;
}

/** Cache fresco — foco na Home pode pular o scan Dexie. */
export function isHomeResumoCacheWarm(): boolean {
  return peekHomeResumoCache() != null && !isHomeResumoCacheDirty();
}

function stripCadastro(row: Record<string, unknown>): CadastroItemPersist {
  const copy = { ...row };
  for (const key of [
    'ownerUid',
    'createdAt',
    'version',
    'deviceId',
    'userId',
    'syncStatus',
    'deleted',
    'deletedAt',
    'deletedBy',
    'lastModifiedBy',
    'syncVersion',
  ]) {
    delete copy[key];
  }
  return copy as unknown as CadastroItemPersist;
}

function stripSessao(row: Record<string, unknown>): SessaoAplicacaoTaf {
  const copy = { ...row };
  for (const key of [
    'ownerUid',
    'createdAt',
    'version',
    'deviceId',
    'userId',
    'syncStatus',
    'deleted',
    'deletedAt',
    'deletedBy',
    'lastModifiedBy',
    'syncVersion',
  ]) {
    delete copy[key];
  }
  return copy as unknown as SessaoAplicacaoTaf;
}

async function computeResumoInicioFromIndexedDb(): Promise<ResumoInicioTafHistorico> {
  const db = getTafDatabase();
  if (!db) return RESUMO_VAZIO;

  const ownerUid = getCachedDataOwnerUid();
  const [cadRows, sessRows, deletedRows, nipsRestritos, nipsFatoresPreenchidos] =
    await Promise.all([
      listCadastrosForDisplay(null),
      listSessoesForDisplay(null),
      listDeletedSessoesForDisplay(null),
      getNipsRestritosAtivos(),
      getNipsComFatoresRiscoPreenchidos(ownerUid),
    ]);

  const cadastros = cadRows
    .filter((row) => row.deleted !== true && !isDemoCadastroId(row.id))
    .map((row) => stripCadastro(row as unknown as Record<string, unknown>));

  const sessoes = sessRows
    .filter((row) => row.deleted !== true && !isDemoSessaoId(row.id))
    .map((row) => stripSessao(row as unknown as Record<string, unknown>));

  const sessoesExcluidas = deletedRows
    .filter((row) => !isDemoSessaoId(row.id))
    .map((row) => stripSessao(row as unknown as Record<string, unknown>));

  return calcularResumoInicioTafFromHistorico(
    sessoes,
    cadastros,
    sessoesExcluidas,
    nipsRestritos,
    new Set(),
    nipsFatoresPreenchidos,
  );
}

/**
 * Resumo dos cards da Home **somente a partir do IndexedDB (Dexie)**.
 * Stale-while-revalidate: invalidação marca dirty sem apagar o valor.
 * Não consulta a nuvem.
 */
export async function loadResumoInicioFromIndexedDb(options?: {
  force?: boolean;
}): Promise<ResumoInicioTafHistorico> {
  ensureHomeResumoInvalidation();

  const ownerUid = getCachedDataOwnerUid();
  const stale = peekHomeResumoCache();

  if (!options?.force && stale && cache && !cache.dirty && cache.ownerUid === ownerUid) {
    return stale;
  }

  if (
    inFlight &&
    inFlight.ownerUid === ownerUid &&
    inFlight.generation === cacheGeneration
  ) {
    return inFlight.promise;
  }

  const generation = cacheGeneration;
  const promise = computeResumoInicioFromIndexedDb()
    .then((resumo) => {
      if (generation !== cacheGeneration) {
        return loadResumoInicioFromIndexedDb({ force: true });
      }
      cache = { ownerUid, resumo, dirty: false };
      if (inFlight?.promise === promise) inFlight = null;
      return resumo;
    })
    .catch((error) => {
      console.warn('[home-resumo] leitura IndexedDB falhou:', error);
      if (inFlight?.promise === promise) inFlight = null;
      // Mantém último valor — não zera cards por falha transitória.
      if (stale) return stale;
      return RESUMO_VAZIO;
    });

  inFlight = { ownerUid, generation, promise };
  return promise;
}
