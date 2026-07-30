import {
  buildBackupCsvContent,
  downloadBackupCsvEOds,
} from '../utils/backupTafCsv';
import { gatherSystemBackupData } from '../utils/gatherSystemBackupData';
import {
  buildBackupApptafFilename,
  buildBackupPlanilhaOdsFilename,
  buildBackupPlanilhaPdfFilename,
  formatBrDateKey,
} from '../utils/backupNaming';
import { readAppMeta, writeAppMeta } from '../offline-first/db/appMeta';
import { getCachedDataOwnerUid } from './firebase/authUid';
import { createLocalBackup } from '../offline-first/sync/localBackup';
import type { CadastroItemPersist } from './cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from './resultadosAplicadosIndexedDb';

export const DAILY_BACKUP_META_KEY = 'backup:lastDailyDateBr';
/** '1' = backup do dia foi liberado sem sync na nuvem; reabrir modal após a 1ª sync. */
export const DAILY_BACKUP_PENDING_AFTER_SYNC_KEY = 'backup:pendingAfterCloudSync';

export type DailyBackupProgress = {
  percent: number;
  label: string;
};

export type DailyBackupPrepared = {
  content: string;
  filename: string;
  filenameOds: string;
  filenamePdf: string;
  /** Cadastros usados na planilha ODS/PDF. */
  cadastrosData: CadastroItemPersist[];
  /** Sessões para rúbricas do Histórico na planilha ODS/PDF. */
  sessoesData: SessaoAplicacaoTaf[];
  cadastros: number;
  sessoes: number;
  aplicadores: number;
  preCadastros: number;
};

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export async function isDailyBackupRequired(): Promise<boolean> {
  const last = await readAppMeta(DAILY_BACKUP_META_KEY);
  return last !== formatBrDateKey();
}

export async function isDailyBackupPendingAfterCloudSync(): Promise<boolean> {
  return (await readAppMeta(DAILY_BACKUP_PENDING_AFTER_SYNC_KEY)) === '1';
}

/** Marca que o backup do dia ainda precisa ser refeito após sincronizar com a nuvem. */
export async function markDailyBackupPendingAfterCloudSync(): Promise<void> {
  await writeAppMeta(DAILY_BACKUP_PENDING_AFTER_SYNC_KEY, '1');
}

export async function clearDailyBackupPendingAfterCloudSync(): Promise<void> {
  await writeAppMeta(DAILY_BACKUP_PENDING_AFTER_SYNC_KEY, '');
}

/**
 * Conclui o backup do dia.
 * `cloudSynced`: se false, mantém pendência para reabrir o modal na 1ª sync com a nuvem.
 */
export async function markDailyBackupComplete(options?: {
  cloudSynced?: boolean;
}): Promise<void> {
  await writeAppMeta(DAILY_BACKUP_META_KEY, formatBrDateKey());
  if (options?.cloudSynced) {
    await clearDailyBackupPendingAfterCloudSync();
  } else {
    await markDailyBackupPendingAfterCloudSync();
  }
}

/** Invalida o “já feito hoje” para forçar o modal após sync (mantém a pendência). */
export async function reopenDailyBackupAfterCloudSync(): Promise<void> {
  await writeAppMeta(DAILY_BACKUP_META_KEY, '');
  await markDailyBackupPendingAfterCloudSync();
}

export async function prepareDailySystemBackup(
  onProgress?: (update: DailyBackupProgress) => void,
): Promise<DailyBackupPrepared> {
  const report = (percent: number, label: string) => onProgress?.({ percent, label });

  report(8, 'Preparando backup diário…');
  await yieldToUi();

  report(22, 'Coletando todos os dados do sistema…');
  const payload = await gatherSystemBackupData();
  await yieldToUi();

  report(55, 'Gerando arquivo CSV…');
  const content = buildBackupCsvContent(payload);
  const filename = buildBackupApptafFilename();
  const filenameOds = buildBackupPlanilhaOdsFilename();
  const filenamePdf = buildBackupPlanilhaPdfFilename();
  await yieldToUi();

  report(72, 'Gerando planilha ODS e PDF…');
  await yieldToUi();

  report(84, 'Salvando snapshot local…');
  try {
    const uid = getCachedDataOwnerUid();
    if (uid) {
      await createLocalBackup(uid);
    }
  } catch {
    // Backup CSV/ODS/PDF principal continua mesmo se o snapshot local falhar.
  }

  report(95, 'Backup pronto para download');
  return {
    content,
    filename,
    filenameOds,
    filenamePdf,
    cadastrosData: payload.cadastros,
    sessoesData: payload.sessoes,
    cadastros: payload.cadastros.length,
    sessoes: payload.sessoes.length,
    aplicadores: payload.aplicadores.length,
    preCadastros: payload.preCadastros.length,
  };
}

export async function downloadPreparedDailyBackup(prepared: DailyBackupPrepared): Promise<void> {
  await downloadBackupCsvEOds(
    prepared.content,
    prepared.filename,
    prepared.cadastrosData,
    prepared.filenameOds,
    prepared.sessoesData,
    prepared.filenamePdf,
  );
}

export async function runDailySystemBackup(
  onProgress?: (update: DailyBackupProgress) => void,
): Promise<DailyBackupPrepared> {
  const prepared = await prepareDailySystemBackup(onProgress);
  await downloadPreparedDailyBackup(prepared);
  onProgress?.({ percent: 100, label: 'Backup concluído (CSV + ODS + PDF)' });
  return prepared;
}
