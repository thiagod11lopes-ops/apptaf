import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { getFirestoreDb } from '../../config/firebase';
import { listMemberLoginUidsForBoss } from './authorizedEmailsFirestore';
import {
  userAplicadoresPath,
  userCadastroRubricasPath,
  userCadastrosPath,
  userPreCadastrosPath,
  userSessaoRubricasPath,
  userSessoesPath,
} from './firestorePaths';
import { setTeamWipeMarker } from './teamWipeFirestore';

const FIRESTORE_BATCH_LIMIT = 500;

export type WipeCloudCounts = {
  cadastros: number;
  sessoes: number;
  aplicadores: number;
  cadastroRubricas: number;
  sessaoRubricas: number;
  preCadastros: number;
};

export type WipeCloudTeamResult = WipeCloudCounts & {
  memberAccountsWiped: number;
  teamWipeAt: number;
};

export type WipeCloudCollectionProgress = {
  collection: string;
  collectionLabel: string;
  deletedInCollection: number;
  totalInCollection: number;
  step: number;
  totalSteps: number;
};

export type WipeCloudProgressCallback = (update: WipeCloudCollectionProgress) => void;

async function deleteAllInCollection(
  collectionPath: string,
  onBatch?: (deleted: number, total: number) => void,
): Promise<number> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');

  const snap = await getDocs(collection(db, collectionPath));
  if (snap.empty) {
    onBatch?.(0, 0);
    return 0;
  }

  let deleted = 0;
  const docs = snap.docs;
  const total = docs.length;

  for (let i = 0; i < docs.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = docs.slice(i, i + FIRESTORE_BATCH_LIMIT);
    for (const docSnap of chunk) {
      batch.delete(docSnap.ref);
      deleted += 1;
    }
    await batch.commit();
    onBatch?.(deleted, total);
  }

  return deleted;
}

const CLOUD_WIPE_COLLECTIONS: Array<{
  key: keyof WipeCloudCounts;
  label: string;
  path: (uid: string) => string;
}> = [
  { key: 'cadastros', label: 'Cadastros na nuvem', path: userCadastrosPath },
  { key: 'sessoes', label: 'Sessões de TAF na nuvem', path: userSessoesPath },
  { key: 'aplicadores', label: 'Aplicadores na nuvem', path: userAplicadoresPath },
  { key: 'cadastroRubricas', label: 'Rubricas de cadastros', path: userCadastroRubricasPath },
  { key: 'sessaoRubricas', label: 'Rubricas de sessões', path: userSessaoRubricasPath },
  { key: 'preCadastros', label: 'Pré-cadastros na nuvem', path: userPreCadastrosPath },
];

/** Remove todos os cadastros, sessões, aplicadores e rubricas do usuário na nuvem. */
export async function wipeCloudUserDataFirestore(
  uid: string,
  onProgress?: WipeCloudProgressCallback,
): Promise<WipeCloudCounts> {
  const totalSteps = CLOUD_WIPE_COLLECTIONS.length;
  const counts = {} as WipeCloudCounts;

  for (let i = 0; i < CLOUD_WIPE_COLLECTIONS.length; i += 1) {
    const col = CLOUD_WIPE_COLLECTIONS[i];
    const step = i + 1;
    counts[col.key] = await deleteAllInCollection(col.path(uid), (deletedInCollection, totalInCollection) => {
      onProgress?.({
        collection: col.key,
        collectionLabel: col.label,
        deletedInCollection,
        totalInCollection,
        step,
        totalSteps,
      });
    });
  }

  return counts;
}

/**
 * Zera dados do chefe na nuvem e marca a equipe para limpar cache local
 * nos aparelhos autorizados (member_lookup continua para re-login).
 */
export async function wipeCloudTeamDataFirestore(
  bossUid: string,
  onProgress?: WipeCloudProgressCallback,
): Promise<WipeCloudTeamResult> {
  const totals = await wipeCloudUserDataFirestore(bossUid, onProgress);

  let memberAccountsWiped = 0;
  try {
    const memberUids = await listMemberLoginUidsForBoss(bossUid);
    memberAccountsWiped = memberUids.length;
  } catch {
    memberAccountsWiped = 0;
  }

  const teamWipeAt = await setTeamWipeMarker(bossUid);
  return {
    ...totals,
    memberAccountsWiped,
    teamWipeAt,
  };
}
