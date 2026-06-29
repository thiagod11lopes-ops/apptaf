import { describe, expect, it } from 'vitest';
import {
  formatSenhaAplicadorInput,
  isSenhaAplicadorValid,
} from '../../src/utils/aplicadorSenhaFormat';

describe('aplicadorSenha', () => {
  it('formatSenhaAplicadorInput aceita só dígitos com máximo 4', () => {
    expect(formatSenhaAplicadorInput('12ab!@34xy')).toBe('1234');
    expect(formatSenhaAplicadorInput('12345')).toBe('1234');
  });

  it('isSenhaAplicadorValid exige exatamente 4 números', () => {
    expect(isSenhaAplicadorValid('1234')).toBe(true);
    expect(isSenhaAplicadorValid('123')).toBe(false);
    expect(isSenhaAplicadorValid('12345')).toBe(false);
    expect(isSenhaAplicadorValid('12a4')).toBe(false);
  });
});
