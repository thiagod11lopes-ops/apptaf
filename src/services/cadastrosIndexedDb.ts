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
  /** Nota da corrida (ex.: 50–100 ou REPROVADO), conforme tabela masculina */
  notaCorrida?: string;
  /** Resultado da prova de natação (Registrador de TAF) */
  resultadoNatacao?: 'aprovado' | 'reprovado';
};

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

export async function getAllCadastros(): Promise<CadastroItemPersist[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => resolve((req.result as CadastroItemPersist[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Falha silenciosa: mantém UX sem travar o cadastro.
    return [];
  }
}

export async function addCadastro(item: CadastroItemPersist): Promise<void> {
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

export async function deleteCadastro(id: string): Promise<void> {
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

