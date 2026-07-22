import { describe, expect, it } from 'vitest';
import {
  buildBackupApptafFilename,
  buildBackupPlanilhaOdsFilename,
  formatBrDateKey,
} from '../../src/utils/backupNaming';

describe('backupNaming', () => {
  it('formata chave do dia em dd-mm-aaaa no fuso de Brasília', () => {
    const key = formatBrDateKey(new Date('2026-07-03T15:00:00.000Z'));
    expect(key).toMatch(/^\d{2}-\d{2}-\d{4}$/);
  });

  it('gera nome Backup apptaf dd-mm-aaaa.csv', () => {
    const filename = buildBackupApptafFilename(new Date('2026-07-03T12:00:00.000Z'));
    expect(filename.startsWith('Backup apptaf ')).toBe(true);
    expect(filename.endsWith('.csv')).toBe(true);
  });

  it('gera nome Planilha TAF apptaf dd-mm-aaaa.ods', () => {
    const filename = buildBackupPlanilhaOdsFilename(new Date('2026-07-03T12:00:00.000Z'));
    expect(filename.startsWith('Planilha TAF apptaf ')).toBe(true);
    expect(filename.endsWith('.ods')).toBe(true);
  });
});
