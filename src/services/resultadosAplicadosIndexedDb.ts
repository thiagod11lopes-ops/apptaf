import type { ResultadoCorridaItem } from '../navigation/types';

export type TipoProvaAplicada = 'corrida' | 'natacao' | 'permanencia';

export type SessaoAplicacaoTaf = {
  id: string;
  criadoEm: string;
  dataAplicacao: string;
  tipoProva: TipoProvaAplicada;
  resultados: ResultadoCorridaItem[];
  /** Unix ms — usado na sincronização offline (mais recente prevalece). */
  updatedAt?: number;
};

import { waitForAuthenticatedUid } from './firebase/authUid';
import {
  readOfflineCloudEntry,
  upsertSessaoOffline,
  deleteSessaoOffline,
} from './offline/offlineCloudEngine';
import { getSessaoByIdFirestore } from './firebase/sessoesFirestore';
import { isOnline } from './offline/networkStatus';

const DB_NAME = 'taf_aplicacoes_db';
const DB_VERSION = 1;
const STORE_NAME = 'sessoes';

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

export async function getAllSessoesAplicacaoLocal(): Promise<SessaoAplicacaoTaf[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const list = (req.result as SessaoAplicacaoTaf[]) || [];
        list.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function clearLocalSessoesAplicacao(): Promise<void> {
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

async function resolveCloudSessoes(uid: string): Promise<SessaoAplicacaoTaf[]> {
  const entry = await readOfflineCloudEntry(uid, { autoSync: false });
  return entry.sessoes;
}

export async function getAllSessoesAplicacao(): Promise<SessaoAplicacaoTaf[]> {
  const uid = await waitForAuthenticatedUid();
  if (uid) {
    return resolveCloudSessoes(uid);
  }
  return getAllSessoesAplicacaoLocal();
}

export async function addSessaoAplicacao(
  input: Omit<SessaoAplicacaoTaf, 'id' | 'criadoEm'> & { id?: string },
): Promise<string> {
  const id = input.id ?? `sessao-${Date.now()}`;
  const sessao: SessaoAplicacaoTaf = {
    id,
    criadoEm: new Date().toISOString(),
    dataAplicacao: input.dataAplicacao,
    tipoProva: input.tipoProva,
    resultados: input.resultados,
  };

  const uid = await waitForAuthenticatedUid();
  if (uid) {
    await upsertSessaoOffline(uid, sessao);
    return id;
  }

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(sessao);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Mantém fluxo da aplicação mesmo sem persistência.
  }

  return id;
}

export async function getSessaoAplicacaoById(id: string): Promise<SessaoAplicacaoTaf | null> {
  const uid = await waitForAuthenticatedUid();
  if (uid) {
    const entry = await readOfflineCloudEntry(uid, { autoSync: false });
    const local = entry.sessoes.find((s) => s.id === id);
    if (local) return local;
    if (isOnline()) {
      try {
        return await getSessaoByIdFirestore(uid, id);
      } catch {
        return null;
      }
    }
    return null;
  }
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => resolve((req.result as SessaoAplicacaoTaf) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function updateSessaoAplicacao(sessao: SessaoAplicacaoTaf): Promise<void> {
  const uid = await waitForAuthenticatedUid();
  if (uid) {
    await upsertSessaoOffline(uid, sessao);
    return;
  }
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(sessao);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // silencioso
  }
}

export async function deleteSessaoAplicacao(id: string): Promise<void> {
  if (!id.trim()) {
    throw new Error('ID da sessão inválido.');
  }
  const uid = await waitForAuthenticatedUid();
  if (uid) {
    await deleteSessaoOffline(uid, id);
    return;
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onerror = () => reject(req.error ?? new Error('Falha ao excluir sessão.'));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Falha na transação de exclusão.'));
  });
}

export function tituloTipoProva(tipo: TipoProvaAplicada): string {
  switch (tipo) {
    case 'natacao':
      return 'Natação';
    case 'permanencia':
      return 'Permanência';
    default:
      return 'Corrida';
  }
}
