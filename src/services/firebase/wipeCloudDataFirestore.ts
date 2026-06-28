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

async function deleteAllInCollection(collectionPath: string): Promise<number> {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firestore indisponível.');

  const snap = await getDocs(collection(db, collectionPath));
  if (snap.empty) return 0;

  let deleted = 0;
  const docs = snap.docs;

  for (let i = 0; i < docs.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = docs.slice(i, i + FIRESTORE_BATCH_LIMIT);
    for (const docSnap of chunk) {
      batch.delete(docSnap.ref);
      deleted += 1;
    }
    await batch.commit();
  }

  return deleted;
}

/** Remove todos os cadastros, sessões, aplicadores e rubricas do usuário na nuvem. */
export async function wipeCloudUserDataFirestore(uid: string): Promise<WipeCloudCounts> {
  const [cadastros, sessoes, aplicadores, cadastroRubricas, sessaoRubricas, preCadastros] =
    await Promise.all([
    deleteAllInCollection(userCadastrosPath(uid)),
    deleteAllInCollection(userSessoesPath(uid)),
    deleteAllInCollection(userAplicadoresPath(uid)),
    deleteAllInCollection(userCadastroRubricasPath(uid)),
    deleteAllInCollection(userSessaoRubricasPath(uid)),
    deleteAllInCollection(userPreCadastrosPath(uid)),
  ]);

  return { cadastros, sessoes, aplicadores, cadastroRubricas, sessaoRubricas, preCadastros };
}

/**
 * Zera dados do chefe na nuvem e marca a equipe para limpar cache local
 * nos aparelhos autorizados (member_lookup continua para re-login).
 */
export async function wipeCloudTeamDataFirestore(bossUid: string): Promise<WipeCloudTeamResult> {
  const totals = await wipeCloudUserDataFirestore(bossUid);

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
