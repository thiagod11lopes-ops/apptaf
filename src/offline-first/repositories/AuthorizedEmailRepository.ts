import { getTafDatabase } from '../db/tafDatabase';
import type { AuthorizedEmailEntry } from '../sync/firebase/FirebaseGateway';

export type LocalAuthorizedEmail = AuthorizedEmailEntry & {
  id: string;
  ownerUid: string;
  updatedAt: number;
  syncStatus: 'local' | 'synced' | 'deleted';
};

function rowId(ownerUid: string, email: string): string {
  return `${ownerUid}:${email.toLowerCase()}`;
}

/** Repository local — e-mails autorizados (sync via Sync Engine). */
export const authorizedEmailRepository = {
  async listLocal(ownerUid: string): Promise<AuthorizedEmailEntry[]> {
    const db = getTafDatabase();
    if (!db) return [];
    const rows = await db.authorizedEmails.where('ownerUid').equals(ownerUid).toArray();
    return rows.filter((r) => r.syncStatus !== 'deleted' && r.ativo !== false).map(({ email, ativo, criadoEm }) => ({
      email,
      ativo,
      criadoEm,
    }));
  },

  async replaceFromRemote(ownerUid: string, remote: AuthorizedEmailEntry[]): Promise<void> {
    const db = getTafDatabase();
    if (!db) return;
    await db.authorizedEmails.where('ownerUid').equals(ownerUid).delete();
    const now = Date.now();
    await db.authorizedEmails.bulkAdd(
      remote.map((entry) => ({
        id: rowId(ownerUid, entry.email),
        ownerUid,
        email: entry.email,
        ativo: entry.ativo,
        criadoEm: entry.criadoEm,
        updatedAt: now,
        syncStatus: 'synced' as const,
      })),
    );
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
