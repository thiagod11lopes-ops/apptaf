import { collection, onSnapshot, type QuerySnapshot } from 'firebase/firestore';
import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../../services/resultadosAplicadosIndexedDb';
import { getFirestoreDb } from '../../config/firebase';
import { userCadastrosPath, userSessoesPath } from '../../services/firebase/firestorePaths';
import { toCadastroLight } from '../../utils/cadastroLight';
import { toSessaoLight } from '../../utils/sessaoLight';
import { dedupeCadastrosPorNip } from '../../utils/dedupeCadastrosPorNip';
import { applyRemoteCadastro, applyRemoteSessao } from '../db/localDb';
import { getCachedLoginUid } from '../../services/firebase/authUid';
import { syncLogger } from './SyncLogger';
import {
  beginRealtimeApply,
  endRealtimeApply,
  setCloudSyncResult,
  setRealtimeListening,
} from '../../services/offline/cloudSyncActivity';

let activeUid: string | null = null;
let unsubCadastros: (() => void) | null = null;
let unsubSessoes: (() => void) | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let onApplied: (() => void) | null = null;
let applying = false;
let pendingApply = false;

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

async function applySnapshot(
  uid: string,
  cadastros: CadastroItemPersist[],
  sessoes: SessaoAplicacaoTaf[],
): Promise<void> {
  if (activeUid !== uid) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  applying = true;
  beginRealtimeApply();
  try {
    for (const cad of cadastros) {
      await applyRemoteCadastro(
        {
          ...cad,
          ownerUid: uid,
          version: cad.updatedAt ? 1 : 1,
          syncStatus: 'synced',
          deleted: false,
          deviceId: 'remote',
          userId: getCachedLoginUid(),
          createdAt: cad.updatedAt ?? Date.now(),
          lastModifiedBy: 'remote',
        },
        uid,
      );
    }
    for (const sess of sessoes) {
      await applyRemoteSessao(
        {
          ...sess,
          ownerUid: uid,
          version: 1,
          syncStatus: 'synced',
          deleted: false,
          deviceId: 'remote',
          userId: getCachedLoginUid(),
          createdAt: Date.parse(sess.criadoEm) || Date.now(),
          lastModifiedBy: 'remote',
        },
        uid,
      );
    }
    setCloudSyncResult(true);
    onApplied?.();
    await syncLogger.info('realtime', `Snapshot aplicado (${cadastros.length} cad, ${sessoes.length} sess)`);
  } finally {
    applying = false;
    endRealtimeApply();
    if (pendingApply) {
      pendingApply = false;
      scheduleApply(uid);
    }
  }
}

let latestCadastros: CadastroItemPersist[] = [];
let latestSessoes: SessaoAplicacaoTaf[] = [];
let cadReady = false;
let sessReady = false;

function scheduleApply(uid: string): void {
  if (!cadReady || !sessReady || applying) {
    pendingApply = true;
    return;
  }
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void applySnapshot(uid, latestCadastros, latestSessoes);
  }, 250);
}

export function startRealtimeSync(uid: string, onUpdate: () => void): void {
  stopRealtimeSync();
  const db = getFirestoreDb();
  if (!db || !uid) return;

  activeUid = uid;
  onApplied = onUpdate;
  cadReady = false;
  sessReady = false;
  setRealtimeListening(true);

  unsubCadastros = onSnapshot(
    collection(db, userCadastrosPath(uid)),
    (snap) => {
      if (activeUid !== uid) return;
      latestCadastros = parseCadastros(snap);
      cadReady = true;
      scheduleApply(uid);
    },
    () => setRealtimeListening(false),
  );

  unsubSessoes = onSnapshot(
    collection(db, userSessoesPath(uid)),
    (snap) => {
      if (activeUid !== uid) return;
      latestSessoes = parseSessoes(snap);
      sessReady = true;
      scheduleApply(uid);
    },
    () => setRealtimeListening(false),
  );
}

export function stopRealtimeSync(): void {
  activeUid = null;
  cadReady = false;
  sessReady = false;
  onApplied = null;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = null;
  unsubCadastros?.();
  unsubSessoes?.();
  unsubCadastros = null;
  unsubSessoes = null;
  setRealtimeListening(false);
}
