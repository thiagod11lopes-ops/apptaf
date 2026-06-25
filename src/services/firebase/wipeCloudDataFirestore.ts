import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { getFirestoreDb } from '../../config/firebase';
import { listMemberLoginUidsForBoss } from './authorizedEmailsFirestore';
import {
  userCadastroRubricasPath,
  userCadastrosPath,
  userSessaoRubricasPath,
  userSessoesPath,
} from './firestorePaths';
import { setTeamWipeMarker } from './teamWipeFirestore';

const FIRESTORE_BATCH_LIMIT = 500;

export type WipeCloudCounts = {
  cadastros: number;
  sessoes: number;
  cadastroRubricas: number;
  sessaoRubricas: number;
};

export type WipeCloudTeamResult = WipeCloudCounts & {
  memberAccountsWiped: number;
  teamWipeAt: number;
};

function sumCounts(a: WipeCloudCounts, b: WipeCloudCounts): WipeCloudCounts {
  return {
    cadastros: a.cadastros + b.cadastros,
    sessoes: a.sessoes + b.sessoes,
    cadastroRubricas: a.cadastroRubricas + b.cadastroRubricas,
    sessaoRubricas: a.sessaoRubricas + b.sessaoRubricas,
  };
}

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

/** Remove todos os cadastros, sessões e rubricas do usuário na nuvem. */
export async function wipeCloudUserDataFirestore(uid: string): Promise<WipeCloudCounts> {
  const [cadastros, sessoes, cadastroRubricas, sessaoRubricas] = await Promise.all([
    deleteAllInCollection(userCadastrosPath(uid)),
    deleteAllInCollection(userSessoesPath(uid)),
    deleteAllInCollection(userCadastroRubricasPath(uid)),
    deleteAllInCollection(userSessaoRubricasPath(uid)),
  ]);

  return { cadastros, sessoes, cadastroRubricas, sessaoRubricas };
}

/**
 * Zera dados do chefe, de contas autorizadas com dados próprios na nuvem
 * e marca a equipe para limpar cache local nos aparelhos autorizados.
 */
export async function wipeCloudTeamDataFirestore(bossUid: string): Promise<WipeCloudTeamResult> {
  let totals = await wipeCloudUserDataFirestore(bossUid);

  const memberUids = await listMemberLoginUidsForBoss(bossUid);
  for (const memberUid of memberUids) {
    totals = sumCounts(totals, await wipeCloudUserDataFirestore(memberUid));
  }

  const teamWipeAt = await setTeamWipeMarker(bossUid);
  return {
    ...totals,
    memberAccountsWiped: memberUids.length,
    teamWipeAt,
  };
}
