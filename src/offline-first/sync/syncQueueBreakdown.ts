import type { CollectionName } from '../types';
import type { PendingSyncSummary } from './pendingSyncItems';
import { isCloudSyncCollection } from './preCadastroLocalOnly';

export type SyncQueueCategory = {
  key: string;
  label: string;
  count: number;
};

export type SyncQueueBreakdown = {
  total: number;
  categories: SyncQueueCategory[];
};

const COLLECTION_LABELS: Partial<Record<CollectionName, string>> = {
  cadastros: 'Cadastros',
  sessoes: 'Testes físicos',
  aplicadores: 'Aplicadores',
};

const CATEGORY_ORDER = ['sessoes', 'cadastros', 'aplicadores', 'authorizedEmails', 'other'];

type BreakdownRecord = {
  tipoProva?: string;
  deleted?: boolean;
};

export type DownloadPlanItem = {
  collection: CollectionName;
  local?: BreakdownRecord;
  remote?: BreakdownRecord;
};

function bumpCategory(map: Map<string, SyncQueueCategory>, key: string, label: string): void {
  const existing = map.get(key);
  if (existing) {
    existing.count += 1;
    return;
  }
  map.set(key, { key, label, count: 1 });
}

function sortCategories(categories: SyncQueueCategory[]): SyncQueueCategory[] {
  return [...categories].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.key);
    const bi = CATEGORY_ORDER.indexOf(b.key);
    const ar = ai === -1 ? CATEGORY_ORDER.length : ai;
    const br = bi === -1 ? CATEGORY_ORDER.length : bi;
    return ar - br || b.count - a.count || a.label.localeCompare(b.label, 'pt-BR');
  });
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

function addItemToMap(map: Map<string, SyncQueueCategory>, collection: CollectionName): void {
  if (!isCloudSyncCollection(collection)) return;
  if (collection === 'sessoes') {
    bumpCategory(map, 'sessoes', COLLECTION_LABELS.sessoes ?? 'Testes físicos');
    return;
  }
  const label = COLLECTION_LABELS[collection];
  if (!label) return;
  bumpCategory(map, collection, label);
}

/** Detalha o que será enviado para a nuvem (dados locais pendentes). */
export function buildUploadBreakdown(summary: PendingSyncSummary): SyncQueueBreakdown {
  // Contagens leves (badge) não materializam items — breakdown grosso por coleção.
  if (summary.items.length === 0 && summary.total > 0) {
    const categories: SyncQueueCategory[] = [];
    if (summary.cadastros > 0) {
      categories.push({ key: 'cadastros', label: 'Cadastros', count: summary.cadastros });
    }
    if (summary.sessoes > 0) {
      categories.push({ key: 'sessoes', label: 'Testes físicos', count: summary.sessoes });
    }
    if (summary.aplicadores > 0) {
      categories.push({
        key: 'aplicadores',
        label: 'Aplicadores',
        count: summary.aplicadores,
      });
    }
    if (summary.pre_cadastros > 0) {
      categories.push({
        key: 'pre_cadastros',
        label: 'Pré-cadastros',
        count: summary.pre_cadastros,
      });
    }
    if (summary.authorizedEmails > 0) {
      categories.push({
        key: 'authorizedEmails',
        label: 'E-mail autorizado',
        count: summary.authorizedEmails,
      });
    }
    return finalizeBreakdown(categories, summary.total);
  }

  const map = new Map<string, SyncQueueCategory>();
  for (const item of summary.items) {
    addItemToMap(map, item.collection);
  }
  const categories = Array.from(map.values());
  if (summary.authorizedEmails > 0) {
    categories.push({
      key: 'authorizedEmails',
      label: 'E-mail autorizado',
      count: summary.authorizedEmails,
    });
  }
  return finalizeBreakdown(categories, summary.total);
}

/** Detalha o que será baixado da nuvem (plano LWW). */
export function buildDownloadBreakdown(
  items: DownloadPlanItem[],
  totalOverride?: number | null,
): SyncQueueBreakdown {
  const map = new Map<string, SyncQueueCategory>();
  for (const item of items) {
    addItemToMap(map, item.collection);
  }
  const total = totalOverride ?? items.length;
  return finalizeBreakdown(Array.from(map.values()), total);
}

export const EMPTY_SYNC_QUEUE_BREAKDOWN: SyncQueueBreakdown = {
  total: 0,
  categories: [],
};
