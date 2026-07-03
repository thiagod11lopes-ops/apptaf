import { getAllCadastros } from './cadastrosIndexedDb';
import { getAllSessoesAplicacao } from './resultadosAplicadosIndexedDb';
import { buildBackupCsvContent, downloadBackupCsvFile } from '../utils/backupTafCsv';
import { buildBackupApptafFilename, formatBrDateKey } from '../utils/backupNaming';
import { readAppMeta, writeAppMeta } from '../offline-first/db/appMeta';
import { getCachedDataOwnerUid } from './firebase/authUid';
import { createLocalBackup } from '../offline-first/sync/localBackup';

export const DAILY_BACKUP_META_KEY = 'backup:lastDailyDateBr';

export type DailyBackupProgress = {
  percent: number;
  label: string;
};

export type DailyBackupPrepared = {
  content: string;
  filename: string;
  cadastros: number;
  sessoes: number;
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

export async function markDailyBackupComplete(): Promise<void> {
  await writeAppMeta(DAILY_BACKUP_META_KEY, formatBrDateKey());
}

export async function prepareDailySystemBackup(
  onProgress?: (update: DailyBackupProgress) => void,
): Promise<DailyBackupPrepared> {
  const report = (percent: number, label: string) => onProgress?.({ percent, label });

  report(8, 'Preparando backup diário…');
  await yieldToUi();

  report(22, 'Coletando cadastros…');
  const cadastros = await getAllCadastros();
  await yieldToUi();

  report(48, 'Coletando sessões e resultados…');
  const sessoes = await getAllSessoesAplicacao();
  await yieldToUi();

  report(68, 'Gerando arquivo de backup…');
  const content = buildBackupCsvContent(cadastros, sessoes);
  const filename = buildBackupApptafFilename();
  await yieldToUi();

  report(84, 'Salvando snapshot local…');
  try {
    const uid = getCachedDataOwnerUid();
    if (uid) {
      await createLocalBackup(uid);
    }
  } catch {
    // Backup CSV principal continua mesmo se o snapshot local falhar.
  }

  report(95, 'Backup pronto para download');
  return {
    content,
    filename,
    cadastros: cadastros.length,
    sessoes: sessoes.length,
  };
}

export async function downloadPreparedDailyBackup(prepared: DailyBackupPrepared): Promise<void> {
  await downloadBackupCsvFile(prepared.content, prepared.filename);
}

export async function runDailySystemBackup(
  onProgress?: (update: DailyBackupProgress) => void,
): Promise<DailyBackupPrepared> {
  const prepared = await prepareDailySystemBackup(onProgress);
  await downloadPreparedDailyBackup(prepared);
  onProgress?.({ percent: 100, label: 'Backup concluído' });
  return prepared;
}
