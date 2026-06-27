import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  formatDurationSeconds,
  formatLastSyncLabel,
  formatRecordsPerSecond,
  formatRemainingSeconds,
} from '../../src/offline-first/sync/syncFormatters';

describe('syncFormatters', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formatLastSyncLabel retorna Nunca sincronizado sem timestamp', () => {
    expect(formatLastSyncLabel(null)).toBe('Nunca sincronizado');
    expect(formatLastSyncLabel(0)).toBe('Nunca sincronizado');
  });

  it('formatLastSyncLabel — Hoje / Ontem / Há N dias', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-25T15:00:00'));

    const today = new Date('2026-06-25T14:32:00').getTime();
    expect(formatLastSyncLabel(today)).toMatch(/^Hoje às 14:32$/);

    const yesterday = new Date('2026-06-24T18:05:00').getTime();
    expect(formatLastSyncLabel(yesterday)).toMatch(/^Ontem às 18:05$/);

    const threeDays = new Date('2026-06-22T10:00:00').getTime();
    expect(formatLastSyncLabel(threeDays)).toBe('Há 3 dias');
  });

  it('formatDurationSeconds e formatRemainingSeconds', () => {
    expect(formatDurationSeconds(1200)).toBe('1 segundo');
    expect(formatDurationSeconds(5500)).toBe('6 segundos');
    expect(formatRemainingSeconds(18)).toBe('18 segundos');
    expect(formatRemainingSeconds(0)).toBe('Calculando…');
  });

  it('formatRecordsPerSecond', () => {
    expect(formatRecordsPerSecond(45.2)).toBe('45 registros/segundo');
    expect(formatRecordsPerSecond(0)).toBe('—');
  });
});
