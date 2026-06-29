export type CadastroItemPersist = {
  id: string;
  nip: string;
  nome: string;
  dataNascimento: string;
  categoria: 'Oficiais' | 'Praças';
  /** Sexo biológico para tabelas da norma (M/F). Padrão M se omitido. */
  sexo?: 'M' | 'F';
  oficial?: string;
  praca?: string;
  /** Tempos TAF (Registrador de TAF), preenchidos quando houver registro */
  tempoCorrida?: string;
  tempoNatacao?: string;
  tempoCaminhada?: string;
  /** Nota da corrida (ex.: 50–100 ou REPROVADO) */
  notaCorrida?: string;
  /** Nota da caminhada 4.800 m (ex.: 50–100 ou REPROVADO) */
  notaCaminhada?: string;
  /** Nota da natação (feminino: 50–100 ou REPROVADO) */
  notaNatacao?: string;
  /** Resultado da prova de natação (Registrador de TAF) */
  resultadoNatacao?: 'aprovado' | 'reprovado';
  /** Resultado da prova de permanência (Aplicar TAF) */
  resultadoPermanencia?: 'aprovado' | 'reprovado';
  /** Tempo registrado na permanência (MM:SS, ex.: 10:00) */
  tempoPermanencia?: string;
  /** Data do registro TAF (DD/MM/AAAA) por modalidade */
  dataTafCorrida?: string;
  dataTafNatacao?: string;
  dataTafCaminhada?: string;
  dataTafPermanencia?: string;
  /** Rúbrica do candidato (SVG data URL) por modalidade */
  rubricaCorridaSvg?: string;
  rubricaNatacaoSvg?: string;
  rubricaCaminhadaSvg?: string;
  rubricaPermanenciaSvg?: string;
  /** Fuzileiros Navais — flexões e abdominais */
  repsFlexaoBarra?: number;
  notaFlexaoBarra?: string;
  dataTafFlexaoBarra?: string;
  repsFlexaoSolo?: number;
  notaFlexaoSolo?: string;
  dataTafFlexaoSolo?: string;
  repsAbdominalRemador?: number;
  notaAbdominalRemador?: string;
  dataTafAbdominalRemador?: string;
  tempoAbdominalPrancha?: string;
  notaAbdominalPrancha?: string;
  dataTafAbdominalPrancha?: string;
  /** Unix ms — usado na sincronização offline (mais recente prevalece). */
  updatedAt?: number;
};

import { toCadastroLight } from '../utils/cadastroLight';
import { waitForAuthenticatedUid, resolveStorageOwnerUid } from './firebase/authUid';
import { getTafDatabase } from '../offline-first/db/tafDatabase';
import { dataStore } from '../offline-first/store/DataStore';
import {
  readOfflineCloudEntry,
  upsertCadastroOffline,
  upsertCadastrosLoteOffline,
  deleteCadastroOffline,
} from './offline/offlineCloudEngine';

function useOfflineFirstDb(): boolean {
  return getTafDatabase() != null;
}

const DB_NAME = 'taf_cadastros_db';
const DB_VERSION = 1;
const STORE_NAME = 'cadastros';

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

export async function getAllCadastrosLocal(): Promise<CadastroItemPersist[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => resolve((req.result as CadastroItemPersist[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function clearLocalCadastros(): Promise<void> {
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

async function resolveCloudCadastros(uid: string): Promise<CadastroItemPersist[]> {
  if (useOfflineFirstDb()) return dataStore.getCadastros(uid);
  const entry = await readOfflineCloudEntry(uid, { autoSync: false });
  return entry.cadastros;
}

export async function getAllCadastros(): Promise<CadastroItemPersist[]> {
  if (useOfflineFirstDb()) {
    const uid = await resolveStorageOwnerUid();
    return dataStore.getCadastros(uid);
  }
  const uid = await waitForAuthenticatedUid();
  if (uid) {
    const entry = await readOfflineCloudEntry(uid, { autoSync: false });
    return entry.cadastros;
  }
  return getAllCadastrosLocal();
}

export async function addCadastro(item: CadastroItemPersist): Promise<void> {
  if (useOfflineFirstDb()) {
    const uid = await resolveStorageOwnerUid();
    await dataStore.upsertCadastro(item, uid);
    return;
  }
  const uid = await waitForAuthenticatedUid();
  if (uid) {
    await upsertCadastroOffline(uid, item);
    return;
  }
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(item.id);
      getReq.onsuccess = () => {
        const existing = getReq.result as CadastroItemPersist | undefined;
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

export async function addCadastrosEmLote(items: CadastroItemPersist[]): Promise<void> {
  if (items.length === 0) return;
  if (useOfflineFirstDb()) {
    const uid = await resolveStorageOwnerUid();
    await dataStore.upsertCadastrosBatch(items, uid);
    return;
  }
  const uid = await waitForAuthenticatedUid();
  if (uid) {
    await upsertCadastrosLoteOffline(uid, items);
    return;
  }
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Sem impedir a funcionalidade da UI.
  }
}

export async function deleteCadastro(id: string): Promise<void> {
  if (useOfflineFirstDb()) {
    const uid = await resolveStorageOwnerUid();
    await dataStore.deleteCadastro(id, uid);
    return;
  }
  const uid = await waitForAuthenticatedUid();
  if (uid) {
    await deleteCadastroOffline(uid, id);
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
