import {
  DEMO_BACKUP_ID_KEY,
  DEMO_MODO_ATIVO_KEY,
  isModoDemonstracaoAtivo,
  readAppMeta,
  removeAppMeta,
  writeAppMeta,
} from '../offline-first/db/appMeta';
import { resolveOwnerUid } from '../offline-first/db/localDb';
import { restoreLocalBackup } from '../offline-first/sync/localBackup';
import { getTafDatabase } from '../offline-first/db/tafDatabase';
import { resolveStorageOwnerUid } from './firebase/authUid';

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
 * Liga/desliga apenas a exibição de cards de exemplo no Histórico.
 * Não altera IndexedDB, planilhas, backup nem sincronização.
 */
export async function toggleModoDemonstracaoSistema(): Promise<{ ativo: boolean }> {
  // Limpa resíduo do antigo modo que trocava o banco inteiro.
  await limparResiduoModoDemoAntigo();

  const estavaAtivo = isModoDemonstracaoAtivo();
  if (estavaAtivo) {
    await removeAppMeta(DEMO_MODO_ATIVO_KEY);
  } else {
    await writeAppMeta(DEMO_MODO_ATIVO_KEY, '1');
  }

  notifyListeners();
  return { ativo: !estavaAtivo };
}

async function limparResiduoModoDemoAntigo(): Promise<void> {
  const backupRaw = await readAppMeta(DEMO_BACKUP_ID_KEY);
  if (!backupRaw?.trim()) return;

  const backupId = Number(backupRaw);
  const ownerUid = resolveOwnerUid(await resolveStorageOwnerUid());
  if (Number.isFinite(backupId)) {
    try {
      await restoreLocalBackup(backupId);
    } catch {
      /* segue limpeza das chaves */
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

/**
 * Na abertura: se ainda existir snapshot do antigo swap IndexedDB, restaura dados reais
 * e mantém o flag só como overlay de cards (desligado por padrão após limpeza).
 */
export async function garantirModoNormalNaAbertura(): Promise<void> {
  if (!garantiaModoNormalPromise) {
    garantiaModoNormalPromise = (async () => {
      const backupRaw = await readAppMeta(DEMO_BACKUP_ID_KEY);
      if (!backupRaw?.trim()) return;
      await limparResiduoModoDemoAntigo();
      // Após restaurar o banco real, desliga o overlay até o usuário pedir de novo.
      await removeAppMeta(DEMO_MODO_ATIVO_KEY);
      notifyListeners();
    })().catch((error) => {
      garantiaModoNormalPromise = null;
      throw error;
    });
  }
  await garantiaModoNormalPromise;
}

let garantiaModoNormalPromise: Promise<void> | null = null;

/** Apenas testes — permite simular nova abertura do app. */
export function resetGarantiaModoNormalForTests(): void {
  garantiaModoNormalPromise = null;
}
