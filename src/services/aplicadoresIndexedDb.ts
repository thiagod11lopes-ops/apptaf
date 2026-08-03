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
  /** Rúbrica salva na 1ª assinatura — reutilizada automaticamente após a senha. */
  rubricaSvg?: string;
  updatedAt?: number;
};

import { waitForAuthenticatedUid, resolveStorageOwnerUid } from './firebase/authUid';
import { getTafDatabase } from '../offline-first/db/tafDatabase';
import { dataStore } from '../offline-first/store/DataStore';
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

export async function getAllAplicadores(opts?: {
  includeDemo?: boolean;
}): Promise<AplicadorItemPersist[]> {
  if (useOfflineFirstDb()) {
    const uid = await resolveStorageOwnerUid();
    return dataStore.getAplicadores(uid, opts);
  }
  const uid = await waitForAuthenticatedUid();
  if (uid) {
    return dataStore.getAplicadores(uid, opts);
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

/**
 * Envia a senha em texto para `aplicador_senhas` (planilha do chefe).
 * Retorna false se offline/sem E2E/falha — o texto fica no Dexie e a sync reenvia.
 */
async function pushAplicadorSenhaCloud(
  ownerUid: string | null,
  id: string,
  senha: string,
  senhaHash: string,
): Promise<boolean> {
  if (!ownerUid?.trim() || !id.trim() || !senha.trim() || !senhaHash.trim()) return false;
  try {
    const { getActiveTeamKey } = await import('./supabase/e2eCrypto');
    if (!getActiveTeamKey()) {
      const { getFirebaseAuth } = await import('../config/firebase');
      const { ensureE2eUnlockedForSession } = await import('./supabase/teamE2eSession');
      await ensureE2eUnlockedForSession(ownerUid, getFirebaseAuth()?.currentUser?.email ?? null);
    }
    if (!getActiveTeamKey()) return false;
    const { setAplicadorSenhaFirestore } = await import('./firebase/aplicadorSenhasFirestore');
    await setAplicadorSenhaFirestore(ownerUid, id, senha, senhaHash);
    return true;
  } catch {
    return false;
  }
}

/**
 * Grava a rúbrica do aplicador na primeira assinatura (first-write-wins).
 * Disponível para o chefe e para e-mails autorizados.
 * Retorna true se gravou; false se já existia rúbrica ou o aplicador não foi encontrado.
 */
export async function salvarRubricaAplicadorSeVazia(
  id: string,
  rubricaSvg: string,
): Promise<boolean> {
  const svg = rubricaSvg.trim();
  if (!id.trim() || !svg) return false;

  if (useOfflineFirstDb()) {
    const uid = await resolveStorageOwnerUid();
    return dataStore.saveAplicadorRubricaIfEmpty(id, svg, uid);
  }
  const uid = await waitForAuthenticatedUid();
  if (uid) {
    return dataStore.saveAplicadorRubricaIfEmpty(id, svg, uid);
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
        if (existing.rubricaSvg?.trim()) {
          resolve(false);
          return;
        }
        const merged: AplicadorItemPersist = {
          ...existing,
          rubricaSvg: svg,
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

/** Substitui a rúbrica salva do aplicador (sempre sobrescreve). */
export async function substituirRubricaAplicador(
  id: string,
  rubricaSvg: string,
): Promise<boolean> {
  const svg = rubricaSvg.trim();
  if (!id.trim() || !svg) return false;

  if (useOfflineFirstDb()) {
    const uid = await resolveStorageOwnerUid();
    return dataStore.replaceAplicadorRubrica(id, svg, uid);
  }
  const uid = await waitForAuthenticatedUid();
  if (uid) {
    return dataStore.replaceAplicadorRubrica(id, svg, uid);
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
          rubricaSvg: svg,
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

/** Remove a rúbrica salva do aplicador (planilha — e-mail chefe). */
export async function excluirRubricaAplicador(id: string): Promise<boolean> {
  if (!id.trim()) return false;

  if (useOfflineFirstDb()) {
    const uid = await resolveStorageOwnerUid();
    return dataStore.clearAplicadorRubrica(id, uid);
  }
  const uid = await waitForAuthenticatedUid();
  if (uid) {
    return dataStore.clearAplicadorRubrica(id, uid);
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
        if (!existing.rubricaSvg?.trim()) {
          resolve(true);
          return;
        }
        const merged: AplicadorItemPersist = { ...existing, updatedAt: Date.now() };
        delete merged.rubricaSvg;
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

/**
 * Altera apenas a senha de um aplicador já cadastrado.
 * Disponível para o chefe e para e-mails autorizados (membros).
 */
export async function alterarSenhaAplicador(id: string, novaSenha: string): Promise<boolean> {
  const { hashAplicadorSenha, formatSenhaAplicadorInput } = await import('../utils/aplicadorSenha');
  const senhaFmt = formatSenhaAplicadorInput(novaSenha);
  const senhaHash = await hashAplicadorSenha(senhaFmt);
  // Chefe e autorizado: texto fica no Dexie até ir para aplicador_senhas (planilha do chefe).
  // Não sobe na coleção aplicadores (stripSenha); só na tabela auxiliar.
  const senhaPlano = senhaFmt;

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
          senha: senhaPlano,
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
