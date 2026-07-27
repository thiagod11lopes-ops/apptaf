import { getAllCadastros } from '../services/cadastrosIndexedDb';
import { getAllSessoesAplicacao } from '../services/resultadosAplicadosIndexedDb';
import { getAllAplicadores } from '../services/aplicadoresIndexedDb';
import { getAllPreCadastrosTaf, type PreCadastroTaf } from '../services/preCadastroTafStorage';
import { getCachedDataOwnerUid } from '../services/firebase/authUid';
import { getTafDatabase } from '../offline-first/db/tafDatabase';
import { DEMO_BACKUP_ID_KEY, DEMO_MODO_ATIVO_KEY } from '../offline-first/db/appMeta';
import type { LocalAuthorizedEmail } from '../offline-first/repositories/AuthorizedEmailRepository';
import type { SyncQueueEntry } from '../offline-first/types';
import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import type { AplicadorItemPersist } from '../services/aplicadoresIndexedDb';
import { DEMO_APLICADOR_ID } from './gerarDadosDemonstracaoTaf';

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

const DEMO_APP_META_KEYS = new Set([DEMO_MODO_ATIVO_KEY, DEMO_BACKUP_ID_KEY]);

export function isDemoCadastroId(id: string | undefined): boolean {
  return Boolean(id?.startsWith('demo-cad-'));
}

export function isDemoSessaoId(id: string | undefined): boolean {
  return Boolean(id?.startsWith('demo-sess-'));
}

export function isDemoAplicadorId(id: string | undefined): boolean {
  if (!id) return false;
  return id === DEMO_APLICADOR_ID || id.startsWith('demo-aplicador');
}

/** Remove resíduos do modo exemplo (nunca devem ir a CSV/ODS/PDF). */
export function stripDemoDataFromBackupPayload(payload: SystemBackupPayload): SystemBackupPayload {
  return {
    ...payload,
    cadastros: payload.cadastros.filter((c) => !isDemoCadastroId(c.id)),
    sessoes: payload.sessoes.filter((s) => !isDemoSessaoId(s.id)),
    aplicadores: payload.aplicadores.filter((a) => !isDemoAplicadorId(a.id)),
    appMeta: payload.appMeta.filter((row) => !DEMO_APP_META_KEYS.has(row.key)),
  };
}

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

  return stripDemoDataFromBackupPayload({
    cadastros,
    sessoes,
    aplicadores,
    preCadastros,
    authorizedEmails,
    syncQueue,
    appMeta,
  });
}
