import { readCloudDataCache } from '../../services/cloudDataCache';
import { getMeta, setMeta, getTafDatabase } from './tafDatabase';
import {
  ANONYMOUS_OWNER,
  importCadastroRecord,
  importSessaoRecord,
  listAplicadores,
  listCadastros,
  listSessoes,
  resolveOwnerUid,
  saveAplicador,
  saveCadastro,
  saveSessao,
  toCadastroRecord,
  toSessaoRecord,
  wipeOwnerData,
} from './localDb';
import { syncLogger } from '../sync/SyncLogger';
import { getCachedLoginUid } from '../../services/firebase/authUid';
import { isCloudOwnerUid } from '../../utils/cloudOwnerUid';
import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { AplicadorItemPersist } from '../../services/aplicadoresIndexedDb';
import type { SessaoAplicacaoTaf } from '../../services/resultadosAplicadosIndexedDb';
import type { AplicadorRecord, CadastroRecord, SessaoRecord } from '../types';

const DB_CAD = 'taf_cadastros_db';
const DB_SESS = 'taf_aplicacoes_db';
const DB_APP = 'taf_aplicadores_db';

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

async function readLegacyAplicadores(): Promise<AplicadorItemPersist[]> {
  if (typeof indexedDB === 'undefined') return [];
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_APP, 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('aplicadores', 'readonly');
      const req = tx.objectStore('aplicadores').getAll();
      req.onsuccess = () => resolve((req.result as AplicadorItemPersist[]) || []);
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

function stripAplicadorRecord(row: AplicadorRecord): AplicadorItemPersist {
  const {
    ownerUid: _o,
    createdAt: _c,
    version: _v,
    deviceId: _d,
    userId: _u,
    syncStatus: _s,
    deleted: _del,
    deletedAt: _da,
    deletedBy: _db,
    lastModifiedBy: _l,
    ...item
  } = row;
  return item;
}

/** Move registros Dexie de um ownerUid para a conta do chefe (ex.: membro com dados no UID próprio). */
export async function migrateDexieOwnerToOwner(
  fromOwnerUid: string,
  targetOwnerUid: string,
): Promise<{ cadastros: number; sessoes: number; aplicadores: number }> {
  if (!fromOwnerUid.trim() || fromOwnerUid === targetOwnerUid) {
    return { cadastros: 0, sessoes: 0, aplicadores: 0 };
  }
  if (!getTafDatabase()) return { cadastros: 0, sessoes: 0, aplicadores: 0 };

  const userId = getCachedLoginUid();
  const cadRows = (await listCadastros(fromOwnerUid)).filter((r) => !r.deleted);
  const sessRows = (await listSessoes(fromOwnerUid)).filter((r) => !r.deleted);
  const appRows = (await listAplicadores(fromOwnerUid)).filter((r) => !r.deleted);

  for (const row of cadRows) {
    await saveCadastro(stripCadastroRecord(row), targetOwnerUid, userId);
  }
  for (const row of sessRows) {
    await saveSessao(stripSessaoRecord(row), targetOwnerUid, userId);
  }
  for (const row of appRows) {
    await saveAplicador(stripAplicadorRecord(row), targetOwnerUid, userId);
  }

  if (cadRows.length > 0 || sessRows.length > 0 || appRows.length > 0) {
    await syncLogger.info(
      'sync',
      `Owner ${fromOwnerUid} → ${targetOwnerUid}: ${cadRows.length} cad, ${sessRows.length} sess, ${appRows.length} app`,
    );
    await wipeOwnerData(fromOwnerUid);
  }

  return { cadastros: cadRows.length, sessoes: sessRows.length, aplicadores: appRows.length };
}

/** Move cadastros/sessões/aplicadores criados sem login (Dexie `__local__`) para a conta logada. */
export async function migrateAnonymousDexieToOwner(
  targetOwnerUid: string,
): Promise<{ cadastros: number; sessoes: number; aplicadores: number }> {
  return migrateDexieOwnerToOwner(ANONYMOUS_OWNER, targetOwnerUid);
}

/** Envia dados do IndexedDB legado (pré-Dexie) para a conta logada. */
export async function migrateLegacyLocalToOwner(
  targetOwnerUid: string,
): Promise<{ cadastros: number; sessoes: number; aplicadores: number }> {
  const cadastros = await readLegacyCadastros();
  const sessoes = await readLegacySessoes();
  const aplicadores = await readLegacyAplicadores();
  if (cadastros.length === 0 && sessoes.length === 0 && aplicadores.length === 0) {
    return { cadastros: 0, sessoes: 0, aplicadores: 0 };
  }

  const userId = getCachedLoginUid();
  if (getTafDatabase()) {
    for (const cad of cadastros) {
      await saveCadastro(cad, targetOwnerUid, userId);
    }
    for (const sess of sessoes) {
      await saveSessao(sess, targetOwnerUid, userId);
    }
    for (const app of aplicadores) {
      await saveAplicador(app, targetOwnerUid, userId);
    }
    await Promise.all([
      import('../../services/cadastrosIndexedDb').then((m) => m.clearLocalCadastros()),
      import('../../services/resultadosAplicadosIndexedDb').then((m) => m.clearLocalSessoesAplicacao()),
      import('../../services/aplicadoresIndexedDb').then((m) => m.clearLocalAplicadores()),
    ]);
  } else {
    const { migrateLocalDeviceDataOnLogin } = await import('../../services/migrateLocalOnLogin');
    await migrateLocalDeviceDataOnLogin(targetOwnerUid);
  }

  if (cadastros.length > 0 || sessoes.length > 0 || aplicadores.length > 0) {
    await syncLogger.info(
      'sync',
      `Local legado → nuvem: ${cadastros.length} cad, ${sessoes.length} sess, ${aplicadores.length} app`,
    );
  }

  return { cadastros: cadastros.length, sessoes: sessoes.length, aplicadores: aplicadores.length };
}

/** Após login: unifica dados locais (anônimo + legado + UID do membro) na conta do chefe/autorizado. */
export async function migrateDeviceDataOnLogin(targetOwnerUid: string): Promise<void> {
  await migrateAnonymousDexieToOwner(targetOwnerUid);
  await migrateLegacyLocalToOwner(targetOwnerUid);
  const loginUid = getCachedLoginUid();
  if (loginUid && loginUid !== targetOwnerUid) {
    await migrateDexieOwnerToOwner(loginUid, targetOwnerUid);
  }
  // UIDs do Firebase antigo (não-UUID) ainda no IndexedDB → conta Supabase atual.
  await migrateLegacyFirebaseOwnersToCloudUid(targetOwnerUid);
}

/** Move owners locais que não são UUID (ex.: Auth Firebase) para o UID Supabase. */
export async function migrateLegacyFirebaseOwnersToCloudUid(
  targetOwnerUid: string,
): Promise<void> {
  if (!isCloudOwnerUid(targetOwnerUid)) return;
  const db = getTafDatabase();
  if (!db) return;

  const owners = new Set<string>();
  try {
    const [cadastros, sessoes, aplicadores] = await Promise.all([
      db.cadastros.toArray(),
      db.sessoes.toArray(),
      db.aplicadores.toArray(),
    ]);
    for (const row of cadastros) if (row.ownerUid) owners.add(row.ownerUid);
    for (const row of sessoes) if (row.ownerUid) owners.add(row.ownerUid);
    for (const row of aplicadores) if (row.ownerUid) owners.add(row.ownerUid);
  } catch {
    return;
  }

  for (const owner of owners) {
    if (owner === targetOwnerUid || owner === ANONYMOUS_OWNER) continue;
    if (isCloudOwnerUid(owner)) continue;
    await migrateDexieOwnerToOwner(owner, targetOwnerUid);
  }
}

/**
 * Se a sessão atual tem poucos/nenhum cadastro mas o aparelho tem dados sob outros owners
 * (CSV legado, Firebase, outro UUID), migra tudo para o owner da sessão.
 */
export async function reconcileOrphanOwnersToSession(targetOwnerUid: string): Promise<number> {
  if (!isCloudOwnerUid(targetOwnerUid)) return 0;
  const db = getTafDatabase();
  if (!db) return 0;

  let active: Array<{ ownerUid?: string; deleted?: boolean }> = [];
  try {
    active = (await db.cadastros.toArray()).filter((r) => r.deleted !== true);
  } catch {
    return 0;
  }
  if (active.length === 0) {
    await migrateAnonymousDexieToOwner(targetOwnerUid);
    await migrateLegacyFirebaseOwnersToCloudUid(targetOwnerUid);
    return 0;
  }

  const underTarget = active.filter((r) => r.ownerUid === targetOwnerUid).length;
  // Já tem a maior parte dos dados no owner certo — só limpa Firebase/anônimo.
  if (underTarget > 0 && underTarget >= Math.ceil(active.length * 0.5)) {
    await migrateAnonymousDexieToOwner(targetOwnerUid);
    await migrateLegacyFirebaseOwnersToCloudUid(targetOwnerUid);
    return 0;
  }

  const owners = new Set<string>();
  for (const row of active) {
    if (row.ownerUid?.trim()) owners.add(row.ownerUid.trim());
  }

  let moved = 0;
  for (const owner of owners) {
    if (owner === targetOwnerUid) continue;
    const result = await migrateDexieOwnerToOwner(owner, targetOwnerUid);
    moved += result.cadastros + result.sessoes + result.aplicadores;
  }
  await migrateAnonymousDexieToOwner(targetOwnerUid);
  return moved;
}
