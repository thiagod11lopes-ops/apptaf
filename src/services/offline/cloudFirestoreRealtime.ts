import { collection, onSnapshot, type QuerySnapshot } from 'firebase/firestore';
import type { CadastroItemPersist } from '../cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../resultadosAplicadosIndexedDb';
import { getFirestoreDb } from '../../config/firebase';
import { userCadastrosPath, userSessoesPath } from '../firebase/firestorePaths';
import { toCadastroLight } from '../../utils/cadastroLight';
import { toSessaoLight } from '../../utils/sessaoLight';
import { dedupeCadastrosPorNip } from '../../utils/dedupeCadastrosPorNip';
import { mergeRemoteCloudData } from './offlineCloudEngine';
import { isOnline } from './networkStatus';
import { setRealtimeListening } from './cloudSyncActivity';

let activeUid: string | null = null;
let unsubCadastros: (() => void) | null = null;
let unsubSessoes: (() => void) | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let latestCadastros: CadastroItemPersist[] = [];
let latestSessoes: SessaoAplicacaoTaf[] = [];
let cadastrosReady = false;
let sessoesReady = false;
let applyInFlight = false;

function parseCadastros(snap: QuerySnapshot): CadastroItemPersist[] {
  const items: CadastroItemPersist[] = [];
  for (const docSnap of snap.docs) {
    const raw = docSnap.data() as CadastroItemPersist;
    items.push(toCadastroLight({ ...raw, id: docSnap.id }));
  }
  return dedupeCadastrosPorNip(items);
}

function parseSessoes(snap: QuerySnapshot): SessaoAplicacaoTaf[] {
  const list: SessaoAplicacaoTaf[] = [];
  for (const docSnap of snap.docs) {
    const raw = docSnap.data() as SessaoAplicacaoTaf;
    list.push(toSessaoLight({ ...raw, id: docSnap.id }));
  }
  list.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  return list;
}

function scheduleMerge(uid: string): void {
  if (!cadastrosReady || !sessoesReady || applyInFlight) return;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (!activeUid || activeUid !== uid) return;

    applyInFlight = true;
    void mergeRemoteCloudData(uid, latestCadastros, latestSessoes)
      .catch(() => undefined)
      .finally(() => {
        applyInFlight = false;
        if (activeUid === uid) scheduleMerge(uid);
      });
  }, 200);
}

export function stopCloudFirestoreRealtime(): void {
  activeUid = null;
  cadastrosReady = false;
  sessoesReady = false;
  latestCadastros = [];
  latestSessoes = [];
  applyInFlight = false;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  unsubCadastros?.();
  unsubSessoes?.();
  unsubCadastros = null;
  unsubSessoes = null;

  setRealtimeListening(false);
}

/** Escuta cadastros e sessões no Firestore e atualiza todos os aparelhos em tempo real. */
export function startCloudFirestoreRealtime(uid: string): () => void {
  stopCloudFirestoreRealtime();

  if (!uid || !isOnline()) {
    return stopCloudFirestoreRealtime;
  }

  const db = getFirestoreDb();
  if (!db) {
    return stopCloudFirestoreRealtime;
  }

  activeUid = uid;
  setRealtimeListening(true);

  unsubCadastros = onSnapshot(
    collection(db, userCadastrosPath(uid)),
    (snap) => {
      if (activeUid !== uid) return;
      latestCadastros = parseCadastros(snap);
      cadastrosReady = true;
      scheduleMerge(uid);
    },
    () => {
      if (activeUid === uid) setRealtimeListening(false);
    },
  );

  unsubSessoes = onSnapshot(
    collection(db, userSessoesPath(uid)),
    (snap) => {
      if (activeUid !== uid) return;
      latestSessoes = parseSessoes(snap);
      sessoesReady = true;
      scheduleMerge(uid);
    },
    () => {
      if (activeUid === uid) setRealtimeListening(false);
    },
  );

  return stopCloudFirestoreRealtime;
}
