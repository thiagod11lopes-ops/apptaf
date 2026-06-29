import type { CollectionName } from '../types';

/**
 * Pré-cadastro organiza aplicações do teste apenas neste aparelho —
 * não entra na fila de sincronização com a nuvem.
 */
export function isCloudSyncCollection(collection: CollectionName): boolean {
  return collection !== 'pre_cadastros';
}
