import type { ResultadoCorridaItem } from '../navigation/types';

export type TipoProvaAplicada = 'corrida' | 'natacao' | 'permanencia';

export type SessaoAplicacaoTaf = {
  id: string;
  criadoEm: string;
  dataAplicacao: string;
  tipoProva: TipoProvaAplicada;
  resultados: ResultadoCorridaItem[];
};

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

export async function getAllSessoesAplicacao(): Promise<SessaoAplicacaoTaf[]> {
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
