import type { ResultadoCorridaItem } from '../navigation/types';
import type { AplicadorAssinaturaResumo } from '../types/aplicadorAssinatura';
import type { NormaTafPreCadastro } from './preCadastroTafStorage';

export type TipoProvaAplicada =
  | 'corrida'
  | 'natacao'
  | 'permanencia'
  | 'caminhada'
  | 'flexao_barra'
  | 'flexao_solo'
  | 'abdominal_remador'
  | 'abdominal_prancha';

export type SessaoAplicacaoTaf = {
  id: string;
  criadoEm: string;
  dataAplicacao: string;
  tipoProva: TipoProvaAplicada;
  resultados: ResultadoCorridaItem[];
  aplicadorAssinatura?: AplicadorAssinaturaResumo;
  /** armada (padrão) ou cfn — distingue histórico quando a prova é compartilhada (corrida, natação…). */
  normaTaf?: NormaTafPreCadastro;
  /** Unix ms — usado na sincronização offline (mais recente prevalece). */
  updatedAt?: number;
};

import { resolveStorageOwnerUid } from './firebase/authUid';
import { getTafDatabase } from '../offline-first/db/tafDatabase';
import { dataStore } from '../offline-first/store/DataStore';
import {
  readOfflineCloudEntry,
  upsertSessaoOffline,
  deleteSessaoOffline,
} from './offline/offlineCloudEngine';

function useOfflineFirstDb(): boolean {
  return getTafDatabase() != null;
}

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
  if (useOfflineFirstDb()) {
    const uid = await resolveStorageOwnerUid();
    return dataStore.getSessoes(uid);
  }
  const uid = await waitForAuthenticatedUid();
  if (uid) {
    const entry = await readOfflineCloudEntry(uid, { autoSync: false });
    return entry.sessoes;
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
    aplicadorAssinatura: input.aplicadorAssinatura,
    normaTaf: input.normaTaf,
  };

  const uid = await resolveStorageOwnerUid();
  if (useOfflineFirstDb()) {
    await dataStore.upsertSessao(sessao, uid);
    return id;
  }

  const authUid = await waitForAuthenticatedUid();
  if (authUid) {
    await upsertSessaoOffline(authUid, sessao);
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
  if (useOfflineFirstDb()) {
    const uid = await resolveStorageOwnerUid();
    return dataStore.getSessaoById(id, uid);
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
  if (useOfflineFirstDb()) {
    const uid = await resolveStorageOwnerUid();
    await dataStore.upsertSessao(sessao, uid);
    return;
  }
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
  if (useOfflineFirstDb()) {
    const uid = await resolveStorageOwnerUid();
    await dataStore.deleteSessao(id, uid);
    return;
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
    case 'caminhada':
      return 'Caminhada';
    case 'flexao_barra':
      return 'Flexão na barra';
    case 'flexao_solo':
      return 'Flexão no solo';
    case 'abdominal_remador':
      return 'Abdominal remador';
    case 'abdominal_prancha':
      return 'Abdominal prancha';
    default:
      return 'Corrida';
  }
}
