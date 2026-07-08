export type AplicadorItemPersist = {
  id: string;
  nip: string;
  nome: string;
  categoria: 'Oficiais' | 'Praças';
  sexo?: 'M' | 'F';
  oficial?: string;
  praca?: string;
  /** Senha em texto — visível na planilha apenas para o e-mail chefe. */
  senha?: string;
  /** SHA-256 da senha de assinatura do aplicador. */
  senhaHash?: string;
  updatedAt?: number;
};

import { waitForAuthenticatedUid, resolveStorageOwnerUid } from './firebase/authUid';
import { getTafDatabase } from '../offline-first/db/tafDatabase';
import { dataStore } from '../offline-first/store/DataStore';
import { isBossDataSession } from '../utils/aplicadorSyncPolicy';

function useOfflineFirstDb(): boolean {
  return getTafDatabase() != null;
}

const DB_NAME = 'taf_aplicadores_db';
const DB_VERSION = 1;
const STORE_NAME = 'aplicadores';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB não está disponível neste ambiente.'));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllAplicadoresLocal(): Promise<AplicadorItemPersist[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => resolve((req.result as AplicadorItemPersist[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function clearLocalAplicadores(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Sem IndexedDB.
  }
}

export async function getAllAplicadores(): Promise<AplicadorItemPersist[]> {
  if (useOfflineFirstDb()) {
    const uid = await resolveStorageOwnerUid();
    return dataStore.getAplicadores(uid);
  }
  const uid = await waitForAuthenticatedUid();
  if (uid) {
    return dataStore.getAplicadores(uid);
  }
  return getAllAplicadoresLocal();
}

export async function addAplicador(item: AplicadorItemPersist): Promise<void> {
  if (useOfflineFirstDb()) {
    const uid = await resolveStorageOwnerUid();
    await dataStore.upsertAplicador(item, uid);
    return;
  }
  const uid = await waitForAuthenticatedUid();
  if (uid) {
    await dataStore.upsertAplicador(item, uid);
    return;
  }
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(item.id);
      getReq.onsuccess = () => {
        const existing = getReq.result as AplicadorItemPersist | undefined;
        const merged = existing ? { ...existing, ...item } : item;
        const putReq = store.put(merged);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch {
    // Sem impedir a funcionalidade da UI.
  }
}

/** Envia a senha em texto para a nuvem (coleção só-leitura do chefe). Best-effort. */
async function pushAplicadorSenhaCloud(
  ownerUid: string | null,
  id: string,
  senha: string,
  senhaHash: string,
): Promise<void> {
  if (!ownerUid) return;
  try {
    const { setAplicadorSenhaFirestore } = await import('./firebase/aplicadorSenhasFirestore');
    await setAplicadorSenhaFirestore(ownerUid, id, senha, senhaHash);
  } catch {
    // A senha funcional (hash) já sincroniza pela fila; o texto é complementar.
  }
}

/**
 * Altera apenas a senha de um aplicador já cadastrado.
 * Disponível para o chefe e para e-mails autorizados (membros).
 * A senha em texto é enviada à nuvem em coleção que apenas o chefe pode ler.
 */
export async function alterarSenhaAplicador(id: string, novaSenha: string): Promise<boolean> {
  const { hashAplicadorSenha, formatSenhaAplicadorInput } = await import('../utils/aplicadorSenha');
  const senhaFmt = formatSenhaAplicadorInput(novaSenha);
  const senhaHash = await hashAplicadorSenha(senhaFmt);
  const senhaPlano = isBossDataSession() ? senhaFmt : undefined;

  if (useOfflineFirstDb()) {
    const uid = await resolveStorageOwnerUid();
    const ok = await dataStore.updateAplicadorSenha(id, senhaHash, uid, senhaPlano);
    if (ok) await pushAplicadorSenhaCloud(uid, id, senhaFmt, senhaHash);
    return ok;
  }
  const uid = await waitForAuthenticatedUid();
  if (uid) {
    const ok = await dataStore.updateAplicadorSenha(id, senhaHash, uid, senhaPlano);
    if (ok) await pushAplicadorSenhaCloud(uid, id, senhaFmt, senhaHash);
    return ok;
  }

  try {
    const db = await openDb();
    return await new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result as AplicadorItemPersist | undefined;
        if (!existing) {
          resolve(false);
          return;
        }
        const merged: AplicadorItemPersist = {
          ...existing,
          senhaHash,
          ...(senhaPlano !== undefined ? { senha: senhaPlano } : {}),
          updatedAt: Date.now(),
        };
        const putReq = store.put(merged);
        putReq.onsuccess = () => resolve(true);
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch {
    return false;
  }
}

export async function deleteAplicador(id: string): Promise<void> {
  if (useOfflineFirstDb()) {
    const uid = await resolveStorageOwnerUid();
    await dataStore.deleteAplicador(id, uid);
    return;
  }
  const uid = await waitForAuthenticatedUid();
  if (uid) {
    await dataStore.deleteAplicador(id, uid);
    return;
  }
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Sem impedir a UX.
  }
}
