import type { CadastroRubricas } from '../../utils/cadastroLight';
import { fetchCadastroRubricasForIds } from '../../services/firebase/cadastroRubricasFirestore';
import {
  fetchSessaoRubricasForIds,
  type SessaoRubricasDoc,
} from '../../services/firebase/sessaoRubricasFirestore';
import type { CollectionName } from '../types';
import type { SyncRecord } from './lastWriteWins';

export type DownloadRubricCaches = {
  cadastros: Map<string, CadastroRubricas>;
  sessoes: Map<string, SessaoRubricasDoc>;
};

type DownloadLikeItem = {
  collection: CollectionName;
  action: string;
  remote?: SyncRecord;
};

/** Agrupa rubricas em 1–2 consultas em vez de getDoc por registro baixado. */
export async function buildDownloadRubricCaches(
  ownerUid: string,
  downloadItems: DownloadLikeItem[],
): Promise<DownloadRubricCaches> {
  const cadastroIds = new Set<string>();
  const sessaoIds = new Set<string>();

  for (const item of downloadItems) {
    if (item.action !== 'download' || !item.remote || item.remote.deleted === true) continue;
    if (item.collection === 'cadastros') cadastroIds.add(item.remote.id);
    if (item.collection === 'sessoes') sessaoIds.add(item.remote.id);
  }

  const [cadastros, sessoes] = await Promise.all([
    fetchCadastroRubricasForIds(ownerUid, [...cadastroIds]),
    fetchSessaoRubricasForIds(ownerUid, [...sessaoIds]),
  ]);

  return { cadastros, sessoes };
}
