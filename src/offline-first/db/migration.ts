import { readCloudDataCache } from '../../services/cloudDataCache';
import { clearLocalCadastros } from '../../services/cadastrosIndexedDb';
import { clearLocalSessoesAplicacao } from '../../services/resultadosAplicadosIndexedDb';
import { getMeta, setMeta, getTafDatabase } from './tafDatabase';
import {
  ANONYMOUS_OWNER,
  importCadastroRecord,
  importSessaoRecord,
  listCadastros,
  listSessoes,
  resolveOwnerUid,
  saveCadastro,
  saveSessao,
  toCadastroRecord,
  toSessaoRecord,
  wipeOwnerData,
} from './localDb';
import { syncLogger } from '../sync/SyncLogger';
import { getCachedLoginUid } from '../../services/firebase/authUid';
import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../../services/resultadosAplicadosIndexedDb';
import type { CadastroRecord, SessaoRecord } from '../types';

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

function stripCadastroRecord(row: CadastroRecord): CadastroItemPersist {
  const {
    ownerUid: _o,
    createdAt: _c,
    version: _v,
    deviceId: _d,
    userId: _u,
    syncStatus: _s,
    deleted: _del,
    lastModifiedBy: _l,
    ...item
  } = row;
  return item;
}

function stripSessaoRecord(row: SessaoRecord): SessaoAplicacaoTaf {
  const {
    ownerUid: _o,
    createdAt: _c,
    version: _v,
    deviceId: _d,
    userId: _u,
    syncStatus: _s,
    deleted: _del,
    lastModifiedBy: _l,
    ...item
  } = row;
  return item;
}

/** Move cadastros/sessões criados sem login (Dexie `__local__`) para a conta logada. */
export async function migrateAnonymousDexieToOwner(
  targetOwnerUid: string,
): Promise<{ cadastros: number; sessoes: number }> {
  if (!getTafDatabase()) return { cadastros: 0, sessoes: 0 };

  const userId = getCachedLoginUid();
  const cadRows = (await listCadastros(ANONYMOUS_OWNER)).filter((r) => !r.deleted);
  const sessRows = (await listSessoes(ANONYMOUS_OWNER)).filter((r) => !r.deleted);

  for (const row of cadRows) {
    await saveCadastro(stripCadastroRecord(row), targetOwnerUid, userId);
  }
  for (const row of sessRows) {
    await saveSessao(stripSessaoRecord(row), targetOwnerUid, userId);
  }

  if (cadRows.length > 0 || sessRows.length > 0) {
    await syncLogger.info(
      'sync',
      `Anônimo → nuvem: ${cadRows.length} cad, ${sessRows.length} sess`,
    );
    await wipeOwnerData(ANONYMOUS_OWNER);
  }

  return { cadastros: cadRows.length, sessoes: sessRows.length };
}

/** Envia dados do IndexedDB legado (pré-Dexie) para a conta logada. */
export async function migrateLegacyLocalToOwner(
  targetOwnerUid: string,
): Promise<{ cadastros: number; sessoes: number }> {
  const cadastros = await readLegacyCadastros();
  const sessoes = await readLegacySessoes();
  if (cadastros.length === 0 && sessoes.length === 0) {
    return { cadastros: 0, sessoes: 0 };
  }

  const userId = getCachedLoginUid();
  if (getTafDatabase()) {
    for (const cad of cadastros) {
      await saveCadastro(cad, targetOwnerUid, userId);
    }
    for (const sess of sessoes) {
      await saveSessao(sess, targetOwnerUid, userId);
    }
    await Promise.all([clearLocalCadastros(), clearLocalSessoesAplicacao()]);
  } else {
    const { migrateLocalDeviceDataOnLogin } = await import('../../services/migrateLocalOnLogin');
    await migrateLocalDeviceDataOnLogin(targetOwnerUid);
  }

  if (cadastros.length > 0 || sessoes.length > 0) {
    await syncLogger.info(
      'sync',
      `Local legado → nuvem: ${cadastros.length} cad, ${sessoes.length} sess`,
    );
  }

  return { cadastros: cadastros.length, sessoes: sessoes.length };
}

/** Após login: unifica dados locais (anônimo + legado) na conta do chefe/autorizado. */
export async function migrateDeviceDataOnLogin(targetOwnerUid: string): Promise<void> {
  await migrateAnonymousDexieToOwner(targetOwnerUid);
  await migrateLegacyLocalToOwner(targetOwnerUid);
}
