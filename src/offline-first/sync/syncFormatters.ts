/** Formatação de datas e métricas de sync — sem I/O. */

export function formatLastSyncLabel(finishedAt: number | null | undefined): string {
  if (!finishedAt || finishedAt <= 0) return 'Nunca sincronizado';

  const now = new Date();
  const then = new Date(finishedAt);
  const timeStr = then.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime();
  const dayDiff = Math.floor((startOfToday - startOfThen) / 86_400_000);

  if (dayDiff === 0) return `Hoje às ${timeStr}`;
  if (dayDiff === 1) return `Ontem às ${timeStr}`;
  if (dayDiff >= 2 && dayDiff <= 6) return `Há ${dayDiff} dias`;
  return then.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDurationSeconds(ms: number): string {
  const sec = Math.max(1, Math.round(ms / 1000));
  return `${sec} ${sec === 1 ? 'segundo' : 'segundos'}`;
}

export function formatElapsedClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function formatRemainingSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'Calculando…';
  const sec = Math.max(1, Math.round(seconds));
  return `${sec} ${sec === 1 ? 'segundo' : 'segundos'}`;
}

export function formatRecordsPerSecond(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return '—';
  const rounded = rate >= 10 ? Math.round(rate) : Math.round(rate * 10) / 10;
  return `${rounded} registros/segundo`;
}

export function formatAuditDate(ts: number): string {
  return new Date(ts).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatAuditTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
