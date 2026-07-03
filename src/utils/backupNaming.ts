const BR_TIMEZONE = 'America/Sao_Paulo';

/** Chave do dia no fuso de Brasília — formato dd-mm-aaaa. */
export function formatBrDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: BR_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);

  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  return `${day}-${month}-${year}`;
}

/** Nome do arquivo de backup — ex.: Backup apptaf 03-07-2026.csv */
export function buildBackupApptafFilename(date = new Date()): string {
  return `Backup apptaf ${formatBrDateKey(date)}.csv`;
}
