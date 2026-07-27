import { describe, expect, it } from 'vitest';
import {
  formatDataDispensaInput,
  isDispensaAtiva,
} from '../../src/services/restritosStorage';

describe('restritosStorage helpers', () => {
  it('formata data parcial para DD/MM/AAAA', () => {
    expect(formatDataDispensaInput('01022026')).toBe('01/02/2026');
    expect(formatDataDispensaInput('01')).toBe('01');
    expect(formatDataDispensaInput('0102')).toBe('01/02');
  });

  it('considera dispensa ativa no intervalo inclusive', () => {
    const reg = { dataInicio: '01/07/2026', dataFim: '31/07/2026' };
    expect(isDispensaAtiva(reg, '01/07/2026')).toBe(true);
    expect(isDispensaAtiva(reg, '15/07/2026')).toBe(true);
    expect(isDispensaAtiva(reg, '31/07/2026')).toBe(true);
    expect(isDispensaAtiva(reg, '30/06/2026')).toBe(false);
    expect(isDispensaAtiva(reg, '01/08/2026')).toBe(false);
  });
});
