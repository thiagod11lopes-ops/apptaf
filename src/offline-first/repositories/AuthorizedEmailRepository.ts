import { getTafDatabase } from '../db/tafDatabase';
import type { AuthorizedEmailEntry } from '../sync/firebase/FirebaseGateway';

export type LocalAuthorizedEmail = AuthorizedEmailEntry & {
  id: string;
  ownerUid: string;
  updatedAt: number;
  syncStatus: 'local' | 'synced' | 'deleted';
};

/** Item da lista do chefe com status de nuvem (banco do chefe). */
export type AuthorizedEmailListItem = AuthorizedEmailEntry & {
  /** true = registro já está na nuvem do banco do chefe. */
  cloudSynced: boolean;
};

function rowId(ownerUid: string, email: string): string {
  return `${ownerUid}:${email.toLowerCase()}`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Repository local — e-mails autorizados (sync via Sync Engine). */
export const authorizedEmailRepository = {
  async listLocal(ownerUid: string): Promise<AuthorizedEmailEntry[]> {
    const items = await this.listLocalWithCloudStatus(ownerUid);
    return items.map(({ email, ativo, criadoEm }) => ({ email, ativo, criadoEm }));
  },

  /** Lista ativa com flag de sincronização na nuvem do chefe. */
  async listLocalWithCloudStatus(ownerUid: string): Promise<AuthorizedEmailListItem[]> {
    const db = getTafDatabase();
    if (!db) return [];
    const rows = await db.authorizedEmails.where('ownerUid').equals(ownerUid).toArray();
    return rows
      .filter((r) => r.syncStatus !== 'deleted' && r.ativo !== false)
      .map(({ email, ativo, criadoEm, syncStatus }) => ({
        email,
        ativo,
        criadoEm,
        cloudSynced: syncStatus === 'synced',
      }));
  },

  /**
   * Alinha Dexie com a nuvem sem apagar pendências locais.
   * - `local` / `deleted` são preservados (ainda não enviados).
   * - linhas synced ausentes no remoto são removidas.
   * - remoto novo/atualizado vira synced (exceto se houver pendência local no mesmo e-mail).
   */
  async replaceFromRemote(ownerUid: string, remote: AuthorizedEmailEntry[]): Promise<void> {
    const db = getTafDatabase();
    if (!db) return;

    const existing = await db.authorizedEmails.where('ownerUid').equals(ownerUid).toArray();
    const pendingByEmail = new Map<string, LocalAuthorizedEmail>();
    for (const row of existing) {
      if (row.syncStatus === 'local' || row.syncStatus === 'deleted') {
        pendingByEmail.set(normalizeEmail(row.email), row);
      }
    }

    const now = Date.now();
    const nextRows: LocalAuthorizedEmail[] = [];

    for (const entry of remote) {
      const key = normalizeEmail(entry.email);
      const pending = pendingByEmail.get(key);
      if (pending?.syncStatus === 'deleted') {
        // Remoção local ainda não enviada — não ressuscitar pelo remoto.
        nextRows.push(pending);
        pendingByEmail.delete(key);
        continue;
      }
      if (pending?.syncStatus === 'local') {
        // Já existe na nuvem (push feito ou espelho) — alinha como synced.
        pendingByEmail.delete(key);
      }
      nextRows.push({
        id: rowId(ownerUid, entry.email),
        ownerUid,
        email: entry.email,
        ativo: entry.ativo,
        criadoEm: entry.criadoEm,
        updatedAt: now,
        syncStatus: 'synced',
      });
    }

    // Pendências locais que ainda não existem na nuvem (add/delete).
    for (const pending of pendingByEmail.values()) {
      nextRows.push(pending);
    }

    await db.transaction('rw', db.authorizedEmails, async () => {
      await db.authorizedEmails.where('ownerUid').equals(ownerUid).delete();
      if (nextRows.length > 0) {
        await db.authorizedEmails.bulkAdd(nextRows);
      }
    });
  },

  async addLocal(ownerUid: string, email: string): Promise<void> {
    const db = getTafDatabase();
    if (!db) return;
    const now = Date.now();
    await db.authorizedEmails.put({
      id: rowId(ownerUid, email),
      ownerUid,
      email,
      ativo: true,
      updatedAt: now,
      syncStatus: 'local',
    });
  },

  async removeLocal(ownerUid: string, email: string): Promise<void> {
    const db = getTafDatabase();
    if (!db) return;
    const existing = await db.authorizedEmails.get(rowId(ownerUid, email));
    if (!existing) return;
    await db.authorizedEmails.put({
      ...existing,
      ativo: false,
      syncStatus: 'deleted',
      updatedAt: Date.now(),
    });
  },

  async listPendingSync(ownerUid: string): Promise<LocalAuthorizedEmail[]> {
    const db = getTafDatabase();
    if (!db) return [];
    const rows = await db.authorizedEmails.where('ownerUid').equals(ownerUid).toArray();
    return rows.filter((r) => r.syncStatus === 'local' || r.syncStatus === 'deleted');
  },
};
