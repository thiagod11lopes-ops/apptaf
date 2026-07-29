import {
  DEMO_BACKUP_ID_KEY,
  DEMO_MODO_ATIVO_KEY,
  isModoDemonstracaoAtivo,
  readAppMeta,
  removeAppMeta,
  writeAppMeta,
} from '../offline-first/db/appMeta';
import {
  ensureDemoCadastrosForAplicar,
  removeDemoCadastrosAndAplicador,
  resolveOwnerUid,
} from '../offline-first/db/localDb';
import { restoreLocalBackup } from '../offline-first/sync/localBackup';
import { getTafDatabase } from '../offline-first/db/tafDatabase';
import { resolveStorageOwnerUid } from './firebase/authUid';
import { notifyDataChanged } from '../offline-first/sync/SyncEngine';

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

/**
 * Liga/desliga Modo Teste na aba Aplicar TAF.
 * Disponibiliza militares fictícios para aplicar provas; as sessões aplicadas
 * (demo-sess-*) permanecem no Histórico com tarja “Modo Teste”.
 * Não troca o banco real nem entra em planilha/backup/sync.
 */
export async function toggleModoDemonstracaoSistema(): Promise<{ ativo: boolean }> {
  await limparResiduoModoDemoAntigo();

  const ownerUid = resolveOwnerUid(await resolveStorageOwnerUid());
  const estavaAtivo = isModoDemonstracaoAtivo();

  if (estavaAtivo) {
    await removeDemoCadastrosAndAplicador(ownerUid);
    await removeAppMeta(DEMO_MODO_ATIVO_KEY);
  } else {
    await ensureDemoCadastrosForAplicar(ownerUid);
    await writeAppMeta(DEMO_MODO_ATIVO_KEY, '1');
  }

  notifyDataChanged();
  notifyListeners();
  return { ativo: !estavaAtivo };
}

/** Garante Modo Teste desligado (ex.: ao abrir a identificação). Retorna se estava ativo. */
export async function desativarModoDemonstracaoSeAtivo(): Promise<boolean> {
  await limparResiduoModoDemoAntigo();
  if (!isModoDemonstracaoAtivo()) return false;

  const ownerUid = resolveOwnerUid(await resolveStorageOwnerUid());
  await removeDemoCadastrosAndAplicador(ownerUid);
  await removeAppMeta(DEMO_MODO_ATIVO_KEY);
  notifyDataChanged();
  notifyListeners();
  return true;
}

async function limparResiduoModoDemoAntigo(): Promise<void> {
  const backupRaw = await readAppMeta(DEMO_BACKUP_ID_KEY);
  if (!backupRaw?.trim()) return;

  const backupId = Number(backupRaw);
  if (Number.isFinite(backupId)) {
    try {
      await restoreLocalBackup(backupId);
    } catch {
      /* segue limpeza */
    }
    const db = getTafDatabase();
    if (db) {
      try {
        await db.localBackups.delete(backupId);
      } catch {
        /* ignore */
      }
    }
  }
  await removeAppMeta(DEMO_BACKUP_ID_KEY);
}

/** Na abertura: restaura banco se ainda houver snapshot do antigo swap IndexedDB. */
export async function garantirModoNormalNaAbertura(): Promise<void> {
  if (!garantiaModoNormalPromise) {
    garantiaModoNormalPromise = (async () => {
      const backupRaw = await readAppMeta(DEMO_BACKUP_ID_KEY);
      if (!backupRaw?.trim()) return;
      await limparResiduoModoDemoAntigo();
      await removeAppMeta(DEMO_MODO_ATIVO_KEY);
      notifyDataChanged();
      notifyListeners();
    })().catch((error) => {
      garantiaModoNormalPromise = null;
      throw error;
    });
  }
  await garantiaModoNormalPromise;
}

let garantiaModoNormalPromise: Promise<void> | null = null;

/** Apenas testes. */
export function resetGarantiaModoNormalForTests(): void {
  garantiaModoNormalPromise = null;
}
