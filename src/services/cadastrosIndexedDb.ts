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
  /** Nota da corrida (ex.: 50–100 ou REPROVADO) */
  notaCorrida?: string;
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
  dataTafPermanencia?: string;
  /** Rúbrica do candidato (SVG data URL) por modalidade */
  rubricaCorridaSvg?: string;
  rubricaNatacaoSvg?: string;
  rubricaPermanenciaSvg?: string;
};

import { getCurrentFirebaseUid } from './firebase/googleAuth';
import {
  addCadastroFirestore,
  addCadastrosEmLoteFirestore,
  deleteCadastroFirestore,
  getAllCadastrosFirestore,
} from './firebase/cadastrosFirestore';

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

async function getAllCadastrosLocal(): Promise<CadastroItemPersist[]> {
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
    // Sem IndexedDB (ex.: alguns ambientes nativos).
  }
}

export async function getAllCadastros(): Promise<CadastroItemPersist[]> {
  const uid = getCurrentFirebaseUid();
  if (uid) {
    try {
      return await getAllCadastrosFirestore(uid);
    } catch {
      return [];
    }
  }
  return getAllCadastrosLocal();
}

export async function addCadastro(item: CadastroItemPersist): Promise<void> {
  const uid = getCurrentFirebaseUid();
  if (uid) {
    try {
      await addCadastroFirestore(uid, item);
    } catch {
      // Mantém fluxo da UI.
    }
    return;
  }
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Sem impedir a funcionalidade da UI.
  }
}

export async function addCadastrosEmLote(items: CadastroItemPersist[]): Promise<void> {
  if (items.length === 0) return;
  const uid = getCurrentFirebaseUid();
  if (uid) {
    try {
      await addCadastrosEmLoteFirestore(uid, items);
    } catch {
      // Mantém fluxo da UI.
    }
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
  } catch (err) {
    // Sem impedir a funcionalidade da UI.
  }
}

export async function deleteCadastro(id: string): Promise<void> {
  const uid = getCurrentFirebaseUid();
  if (uid) {
    try {
      await deleteCadastroFirestore(uid, id);
    } catch {
      // Mantém UX.
    }
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
  } catch (err) {
    // Sem impedir a UX.
  }
}

