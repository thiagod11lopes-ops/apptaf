import type { CollectionName } from '../types';
import type { PendingSyncSummary } from './pendingSyncItems';
import {
  tituloTipoProva,
  type TipoProvaAplicada,
} from '../../services/resultadosAplicadosIndexedDb';

export type SyncQueueCategory = {
  key: string;
  label: string;
  count: number;
};

export type SyncQueueBreakdown = {
  total: number;
  categories: SyncQueueCategory[];
};

const COLLECTION_LABELS: Record<CollectionName, string> = {
  cadastros: 'Cadastro',
  sessoes: 'Resultado',
  aplicadores: 'Aplicador',
  pre_cadastros: 'Pré-cadastro',
};

type TipoProvaLike = TipoProvaAplicada | string | undefined;

type BreakdownRecord = {
  tipoProva?: string;
  deleted?: boolean;
};

export type DownloadPlanItem = {
  collection: CollectionName;
  local?: BreakdownRecord;
  remote?: BreakdownRecord;
};

function resultadoLabel(tipoProva: TipoProvaLike): string {
  if (!tipoProva) return 'Resultado';
  return tituloTipoProva(tipoProva as TipoProvaAplicada);
}

function preCadastroLabel(tipoProva: TipoProvaLike): string {
  if (!tipoProva) return 'Pré-cadastro';
  return `Pré-cadastro · ${tituloTipoProva(tipoProva as TipoProvaAplicada)}`;
}

function bumpCategory(map: Map<string, SyncQueueCategory>, key: string, label: string): void {
  const existing = map.get(key);
  if (existing) {
    existing.count += 1;
    return;
  }
  map.set(key, { key, label, count: 1 });
}

function sortCategories(categories: SyncQueueCategory[]): SyncQueueCategory[] {
  return [...categories].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'),
  );
}

function finalizeBreakdown(categories: SyncQueueCategory[], total: number): SyncQueueBreakdown {
  const sorted = sortCategories(categories);
  const sum = sorted.reduce((acc, item) => acc + item.count, 0);
  if (total > sum) {
    sorted.push({
      key: 'other',
      label: 'Outras alterações',
      count: total - sum,
    });
  }
  return { total, categories: sorted };
}

function addItemToMap(map: Map<string, SyncQueueCategory>, collection: CollectionName, record?: BreakdownRecord): void {
  if (collection === 'sessoes') {
    const tipo = record?.tipoProva;
    bumpCategory(map, `sessoes:${tipo ?? 'unknown'}`, resultadoLabel(tipo));
    return;
  }
  if (collection === 'pre_cadastros') {
    const tipo = record?.tipoProva;
    bumpCategory(map, `pre:${tipo ?? 'unknown'}`, preCadastroLabel(tipo));
    return;
  }
  bumpCategory(map, collection, COLLECTION_LABELS[collection]);
}

/** Detalha o que será enviado para a nuvem (dados locais pendentes). */
export function buildUploadBreakdown(summary: PendingSyncSummary): SyncQueueBreakdown {
  const map = new Map<string, SyncQueueCategory>();
  for (const item of summary.items) {
    addItemToMap(map, item.collection, item.record as BreakdownRecord);
  }
  return finalizeBreakdown(Array.from(map.values()), summary.total);
}

/** Detalha o que será baixado da nuvem (plano LWW). */
export function buildDownloadBreakdown(
  items: DownloadPlanItem[],
  totalOverride?: number | null,
): SyncQueueBreakdown {
  const map = new Map<string, SyncQueueCategory>();
  for (const item of items) {
    const record = item.remote ?? item.local;
    addItemToMap(map, item.collection, record);
  }
  const total = totalOverride ?? items.length;
  return finalizeBreakdown(Array.from(map.values()), total);
}

export const EMPTY_SYNC_QUEUE_BREAKDOWN: SyncQueueBreakdown = {
  total: 0,
  categories: [],
};
