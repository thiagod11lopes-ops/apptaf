/**
 * ÚNICO ponto de acesso ao Firestore para o Sync Engine.
 * Demais camadas (React, Repository, Utils) NÃO devem importar firebase/firestore.
 */
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFirestoreDb, getFirebaseAuth } from '../../../config/firebase';

export {
  getAllCadastrosFirestoreLight,
  addCadastroFirestore,
  addCadastrosEmLoteFirestore,
  deleteCadastroFirestore,
  purgeCadastroFirestore,
} from '../../../services/firebase/cadastrosFirestore';

export {
  getAllSessoesFirestoreLight,
  addSessaoFirestore,
  updateSessaoFirestore,
  deleteSessaoFirestore,
  purgeSessaoFirestore,
} from '../../../services/firebase/sessoesFirestore';

export {
  getAllAplicadoresFirestore,
  addAplicadorFirestore,
  deleteAplicadorFirestore,
  purgeAplicadorFirestore,
} from '../../../services/firebase/aplicadoresFirestore';

export {
  getAllPreCadastrosFirestore,
  addPreCadastroFirestore,
  deletePreCadastroFirestore,
} from '../../../services/firebase/preCadastrosFirestore';

export {
  resolveMemberAccess,
  registerAuthorizedMemberLogin,
  listAuthorizedEmails,
  addAuthorizedEmail,
  removeAuthorizedEmail,
  type AuthorizedEmailEntry,
  type MemberAccess,
} from '../../../services/firebase/authorizedEmailsFirestore';

export { getTeamWipeMarker } from '../../../services/firebase/teamWipeFirestore';

export { wipeCloudTeamDataFirestore as wipeAllCloudDataForOwner } from '../../../services/firebase/wipeCloudDataFirestore';

/** Doc de probe — ID sem `__` (reservado pelo Firestore). */
const CONNECTIVITY_PROBE_DOC_ID = 'connectivity_probe';

/** Coleções lidas na sincronização — todas devem passar no probe antes do LWW. */
const SYNC_PROBE_COLLECTIONS = [
  'cadastros',
  'sessoes',
  'cadastro_rubricas',
  'sessao_rubricas',
  'aplicadores',
  'pre_cadastros',
] as const;

function permissionDeniedReason(
  collection: (typeof SYNC_PROBE_COLLECTIONS)[number],
  targetUid: string,
  authUid: string,
): string {
  if (collection === 'pre_cadastros') {
    return 'Permissão negada na coleção pre_cadastros. Publique as regras completas do Firestore no Console Firebase (incluindo pre_cadastros).';
  }
  if (targetUid !== authUid) {
    return 'Permissão negada na nuvem. Confirme que entrou com o e-mail autorizado pelo chefe.';
  }
  return 'Permissão negada na nuvem. Verifique se sua conta está autorizada e se as regras do Firestore foram publicadas.';
}

/** Verifica conectividade lendo um doc sob users/{uid} (permitido pelas rules mesmo inexistente). */
export type FirestoreProbeResult = {
  ok: boolean;
  reason?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function probeFirestoreConnectivityDetailed(
  ownerUid?: string,
): Promise<FirestoreProbeResult> {
  const db = getFirestoreDb();
  const authUser = getFirebaseAuth()?.currentUser;
  if (!db) return { ok: false, reason: 'Firestore indisponível.' };
  if (!authUser) return { ok: false, reason: 'Sessão Google não encontrada.' };

  try {
    await authUser.getIdToken(true);
    if (!authUser.email?.trim()) {
      await authUser.reload();
      await authUser.getIdToken(true);
    }
  } catch {
    return { ok: false, reason: 'Token de autenticação expirado. Entre novamente com Google.' };
  }

  const targetUid = ownerUid?.trim() || authUser.uid;
  let lastReason = 'Não foi possível conectar ao Firebase.';

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await Promise.all(
        SYNC_PROBE_COLLECTIONS.map(async (collection) => {
          const ref = doc(db, 'users', targetUid, collection, CONNECTIVITY_PROBE_DOC_ID);
          await getDoc(ref);
        }),
      );
      return { ok: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (/permission|permiss[aã]o|denied|insufficient/i.test(msg)) {
        for (const collection of SYNC_PROBE_COLLECTIONS) {
          try {
            const ref = doc(db, 'users', targetUid, collection, CONNECTIVITY_PROBE_DOC_ID);
            await getDoc(ref);
          } catch (inner) {
            const innerMsg = inner instanceof Error ? inner.message : String(inner);
            if (/permission|permiss[aã]o|denied|insufficient/i.test(innerMsg)) {
              lastReason = permissionDeniedReason(collection, targetUid, authUser.uid);
              break;
            }
          }
        }
      } else if (/offline|unavailable|network|failed/i.test(msg)) {
        lastReason = 'Sem conexão com o Firebase. Verifique a internet e tente novamente.';
      } else if (msg.trim()) {
        lastReason = msg;
      }
      if (attempt < 2) await sleep(400 * (attempt + 1));
    }
  }

  return { ok: false, reason: lastReason };
}

export async function probeFirestoreConnectivity(ownerUid?: string): Promise<boolean> {
  const result = await probeFirestoreConnectivityDetailed(ownerUid);
  return result.ok;
}

/** Estima horário do servidor Firebase (ms UTC) para detecção de drift. */
export async function estimateServerTimeMs(): Promise<number | null> {
  const db = getFirestoreDb();
  if (!db) return null;
  try {
    const ref = doc(db, '_sync_probe', 'clock');
    await setDoc(ref, { probe: serverTimestamp() }, { merge: true });
    const snap = await getDoc(ref);
    const probe = snap.data()?.probe as { toMillis?: () => number } | undefined;
    if (probe && typeof probe.toMillis === 'function') return probe.toMillis();
    return null;
  } catch {
    return null;
  }
}
