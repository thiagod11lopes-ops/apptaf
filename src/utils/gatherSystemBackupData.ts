import { getAllCadastros } from '../services/cadastrosIndexedDb';
import { getAllSessoesAplicacao } from '../services/resultadosAplicadosIndexedDb';
import { getAllAplicadores } from '../services/aplicadoresIndexedDb';
import { getAllPreCadastrosTaf, type PreCadastroTaf } from '../services/preCadastroTafStorage';
import { getCachedDataOwnerUid } from '../services/firebase/authUid';
import { getTafDatabase } from '../offline-first/db/tafDatabase';
import type { LocalAuthorizedEmail } from '../offline-first/repositories/AuthorizedEmailRepository';
import type { SyncQueueEntry } from '../offline-first/types';
import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import type { AplicadorItemPersist } from '../services/aplicadoresIndexedDb';

export type AppMetaBackupEntry = {
  key: string;
  value: string;
};

export type SystemBackupPayload = {
  cadastros: CadastroItemPersist[];
  sessoes: SessaoAplicacaoTaf[];
  aplicadores: AplicadorItemPersist[];
  preCadastros: PreCadastroTaf[];
  authorizedEmails: LocalAuthorizedEmail[];
  syncQueue: SyncQueueEntry[];
  appMeta: AppMetaBackupEntry[];
};

export async function gatherSystemBackupData(): Promise<SystemBackupPayload> {
  const [cadastros, sessoes, aplicadores, preCadastros] = await Promise.all([
    getAllCadastros(),
    getAllSessoesAplicacao(),
    getAllAplicadores(),
    getAllPreCadastrosTaf(),
  ]);

  const db = getTafDatabase();
  const ownerUid = getCachedDataOwnerUid();

  let authorizedEmails: LocalAuthorizedEmail[] = [];
  let syncQueue: SyncQueueEntry[] = [];
  let appMeta: AppMetaBackupEntry[] = [];

  if (db) {
    if (ownerUid) {
      authorizedEmails = await db.authorizedEmails.where('ownerUid').equals(ownerUid).toArray();
      syncQueue = await db.syncQueue.where('ownerUid').equals(ownerUid).toArray();
    } else {
      authorizedEmails = await db.authorizedEmails.toArray();
      syncQueue = await db.syncQueue.toArray();
    }
    const metaRows = await db.meta.toArray();
    appMeta = metaRows
      .filter((row) => row.value?.trim())
      .map((row) => ({ key: row.key, value: row.value }));
  }

  return {
    cadastros,
    sessoes,
    aplicadores,
    preCadastros,
    authorizedEmails,
    syncQueue,
    appMeta,
  };
}
