import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { AplicadorItemPersist } from '../../services/aplicadoresIndexedDb';
import type { SessaoAplicacaoTaf } from '../../services/resultadosAplicadosIndexedDb';
import type { CollectionName, PreCadastroRecord } from '../types';
import { getCachedLoginUid } from '../../services/firebase/authUid';
import {
  getAllAplicadoresFirestore,
  getAllCadastrosFirestoreLight,
  getAllSessoesFirestoreLight,
} from './firebase/FirebaseGateway';

export type RemoteCollectionsSnapshot = {
  ownerUid: string;
  fetchedAt: number;
  remoteCad: CadastroItemPersist[];
  remoteSess: SessaoAplicacaoTaf[];
  remoteApp: AplicadorItemPersist[];
  remotePre: PreCadastroRecord[];
};

/** TTL curto — cronômetro 45s e GC reutilizam leitura sem repetir getDocs completo. */
export const REMOTE_SNAPSHOT_TTL_MS = 25_000;

let cached: RemoteCollectionsSnapshot | null = null;

export function invalidateRemoteSnapshotCache(): void {
  cached = null;
}

export function peekRemoteSnapshotCache(ownerUid: string): RemoteCollectionsSnapshot | null {
  if (!cached || cached.ownerUid !== ownerUid) return null;
  if (Date.now() - cached.fetchedAt >= REMOTE_SNAPSHOT_TTL_MS) return null;
  return cached;
}

function remotePermissionMessage(collection: CollectionName, ownerUid: string): string {
  if (collection === 'pre_cadastros') {
    return 'Permissão negada na coleção pre_cadastros. Publique as regras completas do Firestore no Console Firebase (incluindo pre_cadastros).';
  }
  const loginUid = getCachedLoginUid();
  if (loginUid && loginUid !== ownerUid) {
    return `Permissão negada ao ler ${collection} do chefe. Confirme que seu e-mail está autorizado.`;
  }
  return `Permissão negada ao ler ${collection} na nuvem. Verifique as regras do Firestore.`;
}

async function fetchRemoteCollection<T>(
  collection: CollectionName,
  ownerUid: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  try {
    return await fetcher();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/permission|permiss[aã]o|denied|insufficient/i.test(msg)) {
      throw new Error(remotePermissionMessage(collection, ownerUid));
    }
    throw error;
  }
}

export async function fetchRemoteCollectionsSnapshot(
  ownerUid: string,
  force = false,
): Promise<RemoteCollectionsSnapshot> {
  const fresh = peekRemoteSnapshotCache(ownerUid);
  if (!force && fresh) return fresh;

  const [remoteCad, remoteSess, remoteApp] = await Promise.all([
    fetchRemoteCollection('cadastros', ownerUid, () => getAllCadastrosFirestoreLight(ownerUid)),
    fetchRemoteCollection('sessoes', ownerUid, () => getAllSessoesFirestoreLight(ownerUid)),
    fetchRemoteCollection('aplicadores', ownerUid, () => getAllAplicadoresFirestore(ownerUid)),
  ]);

  cached = {
    ownerUid,
    fetchedAt: Date.now(),
    remoteCad,
    remoteSess,
    remoteApp,
    remotePre: [],
  };
  return cached;
}
