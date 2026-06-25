import { readCloudDataCache } from '../../services/cloudDataCache';
import { getMeta, setMeta } from './tafDatabase';
import { importCadastroRecord, importSessaoRecord, resolveOwnerUid, toCadastroRecord, toSessaoRecord } from './localDb';
import { syncLogger } from '../sync/SyncLogger';
import { getCachedLoginUid } from '../../services/firebase/authUid';
import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../../services/resultadosAplicadosIndexedDb';

const DB_CAD = 'taf_cadastros_db';
const DB_SESS = 'taf_aplicacoes_db';

async function readLegacyCadastros(): Promise<CadastroItemPersist[]> {
  if (typeof indexedDB === 'undefined') return [];
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_CAD, 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('cadastros', 'readonly');
      const req = tx.objectStore('cadastros').getAll();
      req.onsuccess = () => resolve((req.result as CadastroItemPersist[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function readLegacySessoes(): Promise<SessaoAplicacaoTaf[]> {
  if (typeof indexedDB === 'undefined') return [];
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_SESS, 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('sessoes', 'readonly');
      const req = tx.objectStore('sessoes').getAll();
      req.onsuccess = () => resolve((req.result as SessaoAplicacaoTaf[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function migrateLegacyToDexie(ownerUid: string): Promise<void> {
  const key = `migrated:${ownerUid}`;
  if ((await getMeta(key)) === '1') return;

  const userId = getCachedLoginUid();
  const resolved = resolveOwnerUid(ownerUid);

  const cloudCache = await readCloudDataCache(ownerUid);
  const cadastros = cloudCache?.cadastros?.length
    ? cloudCache.cadastros
    : await readLegacyCadastros();
  const sessoes = cloudCache?.sessoes?.length
    ? cloudCache.sessoes
    : await readLegacySessoes();

  for (const cad of cadastros) {
    const record = await toCadastroRecord(cad, resolved, userId, 'CREATE');
    await importCadastroRecord(record);
  }
  for (const sess of sessoes) {
    const record = await toSessaoRecord(sess, resolved, userId, 'CREATE');
    await importSessaoRecord(record);
  }

  if (cadastros.length > 0 || sessoes.length > 0) {
    await syncLogger.info('sync', `Migração → Dexie: ${cadastros.length} cad, ${sessoes.length} sess`);
  }

  await setMeta(key, '1');
}
