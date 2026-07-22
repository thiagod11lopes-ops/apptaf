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

/** Hora no fuso de Brasília — formato 21h05m32. */
export function formatBrTimeKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: BR_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const second = parts.find((p) => p.type === 'second')?.value ?? '00';
  return `${hour}h${minute}m${second}`;
}

/** Nome do arquivo de backup — ex.: Backup apptaf 03-07-2026.csv */
export function buildBackupApptafFilename(date = new Date()): string {
  return `Backup apptaf ${formatBrDateKey(date)}.csv`;
}

/** Nome da planilha ODS — ex.: Planilha TAF apptaf 03-07-2026.ods */
export function buildBackupPlanilhaOdsFilename(date = new Date()): string {
  return `Planilha TAF apptaf ${formatBrDateKey(date)}.ods`;
}
