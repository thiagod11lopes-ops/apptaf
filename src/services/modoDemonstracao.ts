import { getTafDatabase } from '../offline-first/db/tafDatabase';
import {
  DEMO_BACKUP_ID_KEY,
  DEMO_MODO_ATIVO_KEY,
  isModoDemonstracaoAtivo,
  readAppMeta,
  removeAppMeta,
  writeAppMeta,
} from '../offline-first/db/appMeta';
import { importDemonstracaoDataset, resolveOwnerUid, wipeOwnerData } from '../offline-first/db/localDb';
import { createLocalBackup, restoreLocalBackup } from '../offline-first/sync/localBackup';
import { notifyDataChanged } from '../offline-first/sync/SyncEngine';
import { resolveStorageOwnerUid } from './firebase/authUid';
import { gerarDadosDemonstracaoTaf } from '../utils/gerarDadosDemonstracaoTaf';

export { DEMO_SYNC_BLOCKED_MESSAGE } from '../offline-first/sync/syncAuthMessages';

const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeModoDemonstracao(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export { isModoDemonstracaoAtivo };

async function deleteDemoBackup(backupId: number | null): Promise<void> {
  const db = getTafDatabase();
  if (db && backupId != null && Number.isFinite(backupId)) {
    await db.localBackups.delete(backupId);
  }
}

async function ativarModoDemonstracao(ownerUid: string): Promise<void> {
  const db = getTafDatabase();
  if (!db) {
    throw new Error('Modo demonstração requer armazenamento local (IndexedDB).');
  }

  const backupId = await createLocalBackup(ownerUid);
  if (backupId == null) {
    throw new Error('Não foi possível guardar seus dados reais antes da demonstração.');
  }

  await wipeOwnerData(ownerUid);
  const { cadastros, sessoes } = gerarDadosDemonstracaoTaf();
  await importDemonstracaoDataset(ownerUid, cadastros, sessoes);

  await writeAppMeta(DEMO_BACKUP_ID_KEY, String(backupId));
  await writeAppMeta(DEMO_MODO_ATIVO_KEY, '1');
}

async function desativarModoDemonstracao(ownerUid: string): Promise<void> {
  const backupRaw = await readAppMeta(DEMO_BACKUP_ID_KEY);
  const backupId = backupRaw ? Number(backupRaw) : NaN;

  if (!Number.isFinite(backupId)) {
    await wipeOwnerData(ownerUid);
  } else {
    const ok = await restoreLocalBackup(backupId);
    if (!ok) {
      throw new Error('Não foi possível restaurar seus dados reais.');
    }
    await deleteDemoBackup(backupId);
  }

  await removeAppMeta(DEMO_MODO_ATIVO_KEY);
  await removeAppMeta(DEMO_BACKUP_ID_KEY);
}

export async function toggleModoDemonstracaoSistema(): Promise<{ ativo: boolean }> {
  const ownerUid = resolveOwnerUid(await resolveStorageOwnerUid());
  const estavaAtivo = isModoDemonstracaoAtivo();

  if (estavaAtivo) {
    await desativarModoDemonstracao(ownerUid);
  } else {
    await ativarModoDemonstracao(ownerUid);
  }

  notifyDataChanged();
  notifyListeners();
  return { ativo: !estavaAtivo };
}

let garantiaModoNormalPromise: Promise<void> | null = null;

/** Restaura dados reais na abertura/atualização do app (modo demo não persiste entre sessões). */
export async function garantirModoNormalNaAbertura(): Promise<void> {
  if (!garantiaModoNormalPromise) {
    garantiaModoNormalPromise = (async () => {
      const backupRaw = await readAppMeta(DEMO_BACKUP_ID_KEY);
      const demoAtivo = isModoDemonstracaoAtivo();
      if (!demoAtivo && !backupRaw?.trim()) return;

      const ownerUid = resolveOwnerUid(await resolveStorageOwnerUid());
      await desativarModoDemonstracao(ownerUid);
      notifyDataChanged();
      notifyListeners();
    })().catch((error) => {
      garantiaModoNormalPromise = null;
      throw error;
    });
  }
  await garantiaModoNormalPromise;
}

/** Apenas testes — permite simular nova abertura do app. */
export function resetGarantiaModoNormalForTests(): void {
  garantiaModoNormalPromise = null;
}
