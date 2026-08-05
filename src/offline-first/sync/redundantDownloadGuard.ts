import type { SessaoAplicacaoTaf } from '../../services/resultadosAplicadosIndexedDb';
import type { AplicadorItemPersist } from '../../services/aplicadoresIndexedDb';
import { fetchCadastroRubricasForIds } from '../../services/firebase/cadastroRubricasFirestore';
import {
  fetchSessaoRubricasForIds,
  type SessaoRubricasDoc,
} from '../../services/firebase/sessaoRubricasFirestore';
import type { CadastroRubricas } from '../../utils/cadastroLight';
import { toSessaoLight } from '../../utils/sessaoLight';
import { getCachedLoginUid } from '../../services/firebase/authUid';
import type { AplicadorRecord, CadastroRecord, CollectionName, SessaoRecord } from '../types';
import type { SyncRecord } from './lastWriteWins';
import { markRecordSynced, readSyncVersion, readUpdatedAt } from './recordMeta';
import { putAplicadorRecord, putCadastroRecord, putSessaoRecord } from '../db/localDb';

/**
 * Guarda contra downloads redundantes: quando a nuvem só tem metadados de sync
 * mais novos (updatedAt/syncVersion) mas o conteúdo de negócio é idêntico ao
 * local, não há nada a baixar — basta alinhar os metadados locais para que as
 * próximas comparações LWW resultem em skip.
 */

const SYNC_META_KEYS = [
  'ownerUid',
  'syncStatus',
  'syncVersion',
  'version',
  'baseVersion',
  'updatedAt',
  'createdAt',
  'lastSync',
  'updatedBy',
  'deviceId',
  'userId',
  'lastModifiedBy',
  'deleted',
  'deletedAt',
  'deletedBy',
] as const;

const CADASTRO_RUBRICA_KEYS = [
  'rubricaCorridaSvg',
  'rubricaNatacaoSvg',
  'rubricaCaminhadaSvg',
  'rubricaPermanenciaSvg',
] as const;

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function stripSyncMeta(record: SyncRecord, extraKeys: readonly string[] = []): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...(record as unknown as Record<string, unknown>) };
  for (const key of [...SYNC_META_KEYS, ...extraKeys]) delete copy[key];
  for (const key of Object.keys(copy)) {
    if (copy[key] === undefined) delete copy[key];
  }
  return copy;
}

function sessaoCompareSnapshot(record: SyncRecord): string {
  const light = toSessaoLight(record as SessaoAplicacaoTaf);
  const resultados = [...light.resultados]
    .map((r) => stripSyncMeta(r as unknown as SyncRecord))
    .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
  return stableStringify({
    ...stripSyncMeta(light as unknown as SyncRecord),
    resultados,
  });
}

/**
 * Comparação COMPLETA de conteúdo (todos os campos de negócio, exceto rubricas,
 * que ficam em subtabela e são verificadas à parte). Mais estrita que
 * syncBusinessContentEqual — qualquer diferença mantém o download.
 */
export function fullBusinessContentEqualForDownload(
  collection: CollectionName,
  local: SyncRecord,
  remote: SyncRecord,
): boolean {
  // Presença divergente (ativo × excluído) nunca é redundante.
  if ((local.deleted === true) !== (remote.deleted === true)) return false;

  if (collection === 'cadastros') {
    return (
      stableStringify(stripSyncMeta(local, CADASTRO_RUBRICA_KEYS)) ===
      stableStringify(stripSyncMeta(remote, CADASTRO_RUBRICA_KEYS))
    );
  }
  if (collection === 'sessoes') {
    return sessaoCompareSnapshot(local) === sessaoCompareSnapshot(remote);
  }
  if (collection === 'aplicadores') {
    // senha nunca vai à nuvem; senhaHash é comparado normalmente.
    return (
      stableStringify(stripSyncMeta(local, ['senha'])) ===
      stableStringify(stripSyncMeta(remote, ['senha']))
    );
  }
  return stableStringify(stripSyncMeta(local)) === stableStringify(stripSyncMeta(remote));
}

/**
 * O download de cadastro mescla rubricas remotas com fallback no local
 * (remoto ?? local). O resultado só é idêntico ao local se cada rubrica remota
 * presente for igual à local.
 */
/** Compara imagens remotas com a side table local (não com o doc principal). */
export function cadastroRubricasMatchLocal(
  localRubricas: CadastroRubricas | null | undefined,
  remoteRubricas: CadastroRubricas | undefined,
): boolean {
  if (!remoteRubricas) return true;
  const local = localRubricas ?? {};
  for (const key of CADASTRO_RUBRICA_KEYS) {
    const remoteSvg = remoteRubricas[key];
    if (remoteSvg != null && remoteSvg !== local[key]) return false;
  }
  return true;
}

/**
 * Compara rúbricas remotas com a side table local (resultados + aplicador).
 */
export function sessaoRubricasMatchLocal(
  localDoc:
    | {
        resultados?: Array<{ nip: string; prova?: string; rubricaCandidatoSvg?: string }>;
        aplicadorRubricaSvg?: string;
      }
    | null
    | undefined,
  remoteDoc: SessaoRubricasDoc | undefined,
  tipoProvaFallback?: string,
): boolean {
  if (!remoteDoc) return true;
  if (!remoteDoc.resultados?.length && !remoteDoc.aplicadorRubricaSvg) return true;
  const localByKey = new Map(
    (localDoc?.resultados ?? []).map((r) => [
      `${r.nip}:${r.prova ?? tipoProvaFallback ?? ''}`,
      r.rubricaCandidatoSvg,
    ]),
  );
  for (const r of remoteDoc.resultados ?? []) {
    const localSvg = localByKey.get(`${r.nip}:${r.prova}`);
    if (r.rubricaCandidatoSvg && r.rubricaCandidatoSvg !== localSvg) return false;
  }
  if (
    remoteDoc.aplicadorRubricaSvg &&
    remoteDoc.aplicadorRubricaSvg !== localDoc?.aplicadorRubricaSvg
  ) {
    return false;
  }
  return true;
}

export type RedundantDownloadItem = {
  collection: CollectionName;
  id: string;
  action: string;
  local?: SyncRecord;
  remote?: SyncRecord;
};

type RubricFetchers = {
  fetchCadastroRubricas: (uid: string, ids: string[]) => Promise<Map<string, CadastroRubricas>>;
  fetchSessaoRubricas: (uid: string, ids: string[]) => Promise<Map<string, SessaoRubricasDoc>>;
};

const defaultFetchers: RubricFetchers = {
  fetchCadastroRubricas: fetchCadastroRubricasForIds,
  fetchSessaoRubricas: fetchSessaoRubricasForIds,
};

const ALIGNABLE_COLLECTIONS: ReadonlySet<CollectionName> = new Set([
  'cadastros',
  'sessoes',
  'aplicadores',
]);

function isRedundantCandidate(item: RedundantDownloadItem): boolean {
  return (
    ALIGNABLE_COLLECTIONS.has(item.collection) &&
    item.action === 'download' &&
    item.local != null &&
    item.remote != null &&
    fullBusinessContentEqualForDownload(item.collection, item.local, item.remote)
  );
}

/** Grava localmente os metadados remotos, mantendo o conteúdo local (idêntico). */
async function alignLocalMetadata(
  ownerUid: string,
  item: RedundantDownloadItem,
): Promise<void> {
  const local = item.local as SyncRecord;
  const remote = item.remote as SyncRecord;
  const remoteSv = readSyncVersion(remote);
  const aligned = markRecordSynced(
    {
      ...local,
      ownerUid,
      updatedAt: readUpdatedAt(remote),
      syncVersion: remoteSv,
      version: remoteSv,
    } as CadastroRecord | SessaoRecord | AplicadorRecord,
    getCachedLoginUid(),
  );
  if (item.collection === 'cadastros') {
    await putCadastroRecord(aligned as CadastroRecord);
  } else if (item.collection === 'sessoes') {
    await putSessaoRecord(aligned as SessaoRecord);
  } else if (item.collection === 'aplicadores') {
    await putAplicadorRecord(aligned as AplicadorRecord);
  }
}

/**
 * Remove do plano os downloads redundantes (conteúdo e rubricas idênticos),
 * alinhando os metadados locais aos remotos. Em caso de falha ao verificar
 * rubricas, mantém o download (comportamento conservador).
 */
export async function alignRedundantDownloads<T extends RedundantDownloadItem>(
  ownerUid: string,
  downloadItems: T[],
  fetchers: RubricFetchers = defaultFetchers,
): Promise<{ remaining: T[]; aligned: number }> {
  const candidates = downloadItems.filter(isRedundantCandidate);
  if (candidates.length === 0) return { remaining: downloadItems, aligned: 0 };

  const cadastroIds = candidates
    .filter((c) => c.collection === 'cadastros' && c.remote?.deleted !== true)
    .map((c) => c.id);
  const sessaoIds = candidates
    .filter((c) => c.collection === 'sessoes' && c.remote?.deleted !== true)
    .map((c) => c.id);

  let cadastroRubricas = new Map<string, CadastroRubricas>();
  let sessaoRubricas = new Map<string, SessaoRubricasDoc>();
  let rubricsAvailable = true;
  try {
    [cadastroRubricas, sessaoRubricas] = await Promise.all([
      fetchers.fetchCadastroRubricas(ownerUid, cadastroIds),
      fetchers.fetchSessaoRubricas(ownerUid, sessaoIds),
    ]);
  } catch {
    rubricsAvailable = false;
  }

  const { getCadastroRubricasLocalByIds, getSessaoRubricasLocal } = await import(
    '../db/localDbRubricas'
  );
  const localCadastroRubricas = await getCadastroRubricasLocalByIds(cadastroIds);

  const alignedIds = new Set<string>();
  for (const item of candidates) {
    const local = item.local as SyncRecord;
    const isActive = item.remote?.deleted !== true;

    if (item.collection === 'cadastros' && isActive) {
      if (!rubricsAvailable) continue;
      if (
        !cadastroRubricasMatchLocal(
          localCadastroRubricas.get(item.id),
          cadastroRubricas.get(item.id),
        )
      ) {
        continue;
      }
    } else if (item.collection === 'sessoes' && isActive) {
      if (!rubricsAvailable) continue;
      const localSide = await getSessaoRubricasLocal(item.id);
      if (
        !sessaoRubricasMatchLocal(
          localSide,
          sessaoRubricas.get(item.id),
          (local as SessaoAplicacaoTaf).tipoProva,
        )
      ) {
        continue;
      }
    }

    try {
      await alignLocalMetadata(ownerUid, item);
      alignedIds.add(`${item.collection}:${item.id}`);
    } catch {
      // Falha ao alinhar → mantém o download normal.
    }
  }

  if (alignedIds.size === 0) return { remaining: downloadItems, aligned: 0 };
  return {
    remaining: downloadItems.filter((i) => !alignedIds.has(`${i.collection}:${i.id}`)),
    aligned: alignedIds.size,
  };
}
