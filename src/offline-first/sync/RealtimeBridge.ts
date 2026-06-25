import { collection, onSnapshot, type QuerySnapshot } from 'firebase/firestore';
import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../../services/resultadosAplicadosIndexedDb';
import { getFirestoreDb } from '../../config/firebase';
import { userCadastrosPath, userSessoesPath } from '../../services/firebase/firestorePaths';
import { toCadastroLight } from '../../utils/cadastroLight';
import { toSessaoLight } from '../../utils/sessaoLight';
import { dedupeCadastrosPorNip } from '../../utils/dedupeCadastrosPorNip';
import { getRecordUpdatedAt } from '../../services/offline/recordTimestamps';
import { applyRemoteCadastro, applyRemoteSessao } from '../db/localDb';
import { getCachedLoginUid } from '../../services/firebase/authUid';
import { syncLogger } from './SyncLogger';
import {
  beginRealtimeApply,
  endRealtimeApply,
  setCloudSyncResult,
  setRealtimeListening,
} from '../../services/offline/cloudSyncActivity';
import { systemState } from './SystemState';

let activeUid: string | null = null;
let unsubCadastros: (() => void) | null = null;
let unsubSessoes: (() => void) | null = null;
let debounceCadTimer: ReturnType<typeof setTimeout> | null = null;
let debounceSessTimer: ReturnType<typeof setTimeout> | null = null;
let onApplied: (() => void) | null = null;

let applyingCadastros = false;
let applyingSessoes = false;
let pendingCadastros: CadastroItemPersist[] | null = null;
let pendingSessoes: SessaoAplicacaoTaf[] | null = null;
let applyDepth = 0;

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

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function beginApplyScope(): void {
  if (applyDepth === 0) beginRealtimeApply();
  applyDepth += 1;
}

function endApplyScope(): void {
  applyDepth = Math.max(0, applyDepth - 1);
  if (applyDepth === 0) endRealtimeApply();
}

function buildRemoteCadastro(cad: CadastroItemPersist, uid: string) {
  const updatedAt = getRecordUpdatedAt(cad);
  return {
    ...cad,
    ownerUid: uid,
    version: Math.max(1, Math.floor(updatedAt / 1000)),
    syncStatus: 'synced' as const,
    deleted: false,
    deviceId: 'remote',
    userId: getCachedLoginUid(),
    createdAt: updatedAt || Date.now(),
    updatedAt: updatedAt || Date.now(),
    lastModifiedBy: 'remote',
  };
}

function buildRemoteSessao(sess: SessaoAplicacaoTaf, uid: string) {
  const updatedAt = getRecordUpdatedAt(sess);
  return {
    ...sess,
    ownerUid: uid,
    version: Math.max(1, Math.floor(updatedAt / 1000)),
    syncStatus: 'synced' as const,
    deleted: false,
    deviceId: 'remote',
    userId: getCachedLoginUid(),
    createdAt: Date.parse(sess.criadoEm) || updatedAt || Date.now(),
    updatedAt: updatedAt || Date.parse(sess.criadoEm) || Date.now(),
    lastModifiedBy: 'remote',
  };
}

async function applyCadastrosSnapshot(uid: string, cadastros: CadastroItemPersist[]): Promise<void> {
  if (activeUid !== uid || !isOnline()) return;
  if (applyingCadastros) {
    pendingCadastros = cadastros;
    return;
  }

  applyingCadastros = true;
  beginApplyScope();
  try {
    for (const cad of cadastros) {
      await applyRemoteCadastro(buildRemoteCadastro(cad, uid), uid);
    }
    setCloudSyncResult(true);
    onApplied?.();
    await syncLogger.info('realtime', `Cadastros aplicados (${cadastros.length})`);
  } finally {
    applyingCadastros = false;
    endApplyScope();
    if (pendingCadastros) {
      const next = pendingCadastros;
      pendingCadastros = null;
      void applyCadastrosSnapshot(uid, next);
    }
  }
}

async function applySessoesSnapshot(uid: string, sessoes: SessaoAplicacaoTaf[]): Promise<void> {
  if (activeUid !== uid || !isOnline()) return;
  if (applyingSessoes) {
    pendingSessoes = sessoes;
    return;
  }

  applyingSessoes = true;
  beginApplyScope();
  try {
    for (const sess of sessoes) {
      await applyRemoteSessao(buildRemoteSessao(sess, uid), uid);
    }
    setCloudSyncResult(true);
    onApplied?.();
    await syncLogger.info('realtime', `Sessões aplicadas (${sessoes.length})`);
  } finally {
    applyingSessoes = false;
    endApplyScope();
    if (pendingSessoes) {
      const next = pendingSessoes;
      pendingSessoes = null;
      void applySessoesSnapshot(uid, next);
    }
  }
}

function scheduleCadastrosApply(uid: string, cadastros: CadastroItemPersist[]): void {
  if (debounceCadTimer) clearTimeout(debounceCadTimer);
  debounceCadTimer = setTimeout(() => {
    void applyCadastrosSnapshot(uid, cadastros);
  }, 200);
}

function scheduleSessoesApply(uid: string, sessoes: SessaoAplicacaoTaf[]): void {
  if (debounceSessTimer) clearTimeout(debounceSessTimer);
  debounceSessTimer = setTimeout(() => {
    void applySessoesSnapshot(uid, sessoes);
  }, 200);
}

export function startRealtimeSync(uid: string, onUpdate: () => void): void {
  if (systemState.isForcedOffline()) return;
  stopRealtimeSync();
  const db = getFirestoreDb();
  if (!db || !uid) return;

  activeUid = uid;
  onApplied = onUpdate;
  setRealtimeListening(true);

  unsubCadastros = onSnapshot(
    collection(db, userCadastrosPath(uid)),
    (snap) => {
      if (activeUid !== uid) return;
      scheduleCadastrosApply(uid, parseCadastros(snap));
    },
    () => setRealtimeListening(false),
  );

  unsubSessoes = onSnapshot(
    collection(db, userSessoesPath(uid)),
    (snap) => {
      if (activeUid !== uid) return;
      scheduleSessoesApply(uid, parseSessoes(snap));
    },
    () => setRealtimeListening(false),
  );
}

export function stopRealtimeSync(): void {
  activeUid = null;
  onApplied = null;
  pendingCadastros = null;
  pendingSessoes = null;
  applyingCadastros = false;
  applyingSessoes = false;
  applyDepth = 0;
  if (debounceCadTimer) clearTimeout(debounceCadTimer);
  if (debounceSessTimer) clearTimeout(debounceSessTimer);
  debounceCadTimer = null;
  debounceSessTimer = null;
  unsubCadastros?.();
  unsubSessoes?.();
  unsubCadastros = null;
  unsubSessoes = null;
  setRealtimeListening(false);
}
