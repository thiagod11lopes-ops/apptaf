import { describe, expect, it } from 'vitest';
import { ANONYMOUS_OWNER } from '../../src/offline-first/db/localDb';
import { ownersParaLeituraRubricasLocal } from '../../src/utils/rubricasDasSessoes';

describe('ownersParaLeituraRubricasLocal', () => {
  it('sem login lê só o dono anônimo do IndexedDB', () => {
    expect(ownersParaLeituraRubricasLocal(null)).toEqual([ANONYMOUS_OWNER]);
    expect(ownersParaLeituraRubricasLocal(undefined)).toEqual([ANONYMOUS_OWNER]);
    expect(ownersParaLeituraRubricasLocal('')).toEqual([ANONYMOUS_OWNER]);
  });

  it('com login lê a conta e também dados criados offline sem login', () => {
    expect(ownersParaLeituraRubricasLocal('user-uuid')).toEqual(['user-uuid', ANONYMOUS_OWNER]);
  });
});
