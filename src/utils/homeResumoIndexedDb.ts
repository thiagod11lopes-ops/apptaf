import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import {
  subscribeDataChanged,
  type DataChangeScope,
} from '../offline-first/sync/SyncEngine';
import {
  calcularResumoInicioTafFromHistorico,
  type ResumoInicioTafHistorico,
} from './resultadoGeralHistorico';
import { getNipsRestritosAtivos } from '../services/restritosStorage';
import { getNipsComFatoresRiscoPreenchidos } from '../services/fatoresRiscoStorage';
import { getCachedDataOwnerUid } from '../services/firebase/authUid';
import { peekCadastrosListCache } from '../services/cadastrosListCache';
import { peekSessoesListCache } from '../services/sessoesListCache';
import { yieldToUi } from './yieldToUi';

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

/** Escopos que alteram cadastros/sessões — exigem rescan das listas. */
const HOME_RESUMO_FULL_SCOPES: readonly DataChangeScope[] = ['cadastros', 'sessoes'];
/** Só NIPs de fatores/restritos — reutiliza listas já carregadas. */
const HOME_RESUMO_META_SCOPES: readonly DataChangeScope[] = ['fatores', 'restritos'];

type HomeResumoCacheEntry = {
  ownerUid: string | null;
  resumo: ResumoInicioTafHistorico;
  /** true = há mudança; UI pode mostrar stale enquanto recalcula. */
  dirty: boolean;
};

type ResumoInputs = {
  cadastros: CadastroItemPersist[];
  sessoes: SessaoAplicacaoTaf[];
  sessoesExcluidas: SessaoAplicacaoTaf[];
};

type DirtyKind = 'none' | 'meta' | 'full';

let cache: HomeResumoCacheEntry | null = null;
/** Snapshot das listas do último cálculo completo — refresh parcial de meta. */
let lastInputs: ResumoInputs | null = null;
let dirtyKind: DirtyKind = 'none';
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
    invalidateHomeResumoCache('full');
  }, { scopes: HOME_RESUMO_FULL_SCOPES });
  subscribeDataChanged(() => {
    invalidateHomeResumoCache('meta');
  }, { scopes: HOME_RESUMO_META_SCOPES });
}

/**
 * Soft-invalidate: marca sujo, mas mantém o último resumo (stale-while-revalidate).
 * `meta` = só fatores/restritos; `full` = cadastros/sessões (ou inválida ampla).
 */
export function invalidateHomeResumoCache(kind: 'meta' | 'full' = 'full'): void {
  cacheGeneration += 1;
  inFlight = null;
  if (kind === 'full' || dirtyKind === 'full') {
    dirtyKind = 'full';
  } else if (dirtyKind !== 'full') {
    dirtyKind = 'meta';
  }
  if (cache) {
    cache = { ...cache, dirty: true };
  }
}

/** Limpa tudo (troca de conta / logout). */
export function clearHomeResumoCache(): void {
  cache = null;
  lastInputs = null;
  dirtyKind = 'none';
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

function resolveInputsForMeta(): ResumoInputs | null {
  const peekedCad = peekCadastrosListCache({ includeDemo: false });
  const peekedSess = peekSessoesListCache({ includeDemo: false });
  const cadastros = peekedCad ?? lastInputs?.cadastros ?? null;
  const sessoes = peekedSess ?? lastInputs?.sessoes ?? null;
  const sessoesExcluidas = lastInputs?.sessoesExcluidas ?? null;
  if (!cadastros || !sessoes || !sessoesExcluidas) return null;
  return { cadastros, sessoes, sessoesExcluidas };
}

async function computeFromInputs(inputs: ResumoInputs): Promise<ResumoInicioTafHistorico> {
  const ownerUid = getCachedDataOwnerUid();
  const [nipsRestritos, nipsFatoresPreenchidos] = await Promise.all([
    getNipsRestritosAtivos(),
    getNipsComFatoresRiscoPreenchidos(ownerUid),
  ]);
  // Cede a UI antes do agregador (CPU pesada em bases grandes).
  if (inputs.cadastros.length + inputs.sessoes.length > 80) {
    await yieldToUi();
  }
  return calcularResumoInicioTafFromHistorico(
    inputs.sessoes,
    inputs.cadastros,
    inputs.sessoesExcluidas,
    nipsRestritos,
    new Set(),
    nipsFatoresPreenchidos,
  );
}

/** Full path: reutiliza caches quentes de lista (Cadastro/Resultados). */
async function computeResumoInicioFromIndexedDb(): Promise<ResumoInicioTafHistorico> {
  const { getAllCadastros } = await import('../services/cadastrosIndexedDb');
  const { getAllSessoesAplicacao, getDeletedSessoesAplicacao } = await import(
    '../services/resultadosAplicadosIndexedDb'
  );

  const [cadastros, sessoes, sessoesExcluidas] = await Promise.all([
    getAllCadastros({ includeDemo: false }),
    getAllSessoesAplicacao({ includeDemo: false }),
    getDeletedSessoesAplicacao(),
  ]);

  const inputs: ResumoInputs = { cadastros, sessoes, sessoesExcluidas };
  lastInputs = inputs;
  return computeFromInputs(inputs);
}

async function computeResumoCheap(): Promise<ResumoInicioTafHistorico> {
  if (dirtyKind === 'meta') {
    const inputs = resolveInputsForMeta();
    if (inputs) {
      return computeFromInputs(inputs);
    }
  }
  return computeResumoInicioFromIndexedDb();
}

/**
 * Resumo dos cards da Home **somente a partir do IndexedDB (Dexie)**.
 * Stale-while-revalidate: invalidação marca dirty sem apagar o valor.
 * Dirty `meta` evita relistar cadastros/sessões; full reutiliza list caches.
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
  const promise = computeResumoCheap()
    .then((resumo) => {
      if (generation !== cacheGeneration) {
        return loadResumoInicioFromIndexedDb({ force: true });
      }
      cache = { ownerUid, resumo, dirty: false };
      dirtyKind = 'none';
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
