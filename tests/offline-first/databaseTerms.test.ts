import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeTafDatabaseForTests } from '../../src/offline-first/db/tafDatabase';
import {
  databaseTermsMetaKey,
  hasAcceptedNewDatabaseTerms,
  markAcceptedNewDatabaseTerms,
} from '../../src/offline-first/auth/databaseTerms';

describe('databaseTerms — aceite de criação de banco', () => {
  beforeEach(async () => {
    // limpa chave entre testes via remarcação
  });

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await closeTafDatabaseForTests();
  });

  it('retorna false antes do aceite', async () => {
    expect(await hasAcceptedNewDatabaseTerms('uid-terms-1')).toBe(false);
  });

  it('persiste aceite por UID', async () => {
    await markAcceptedNewDatabaseTerms('uid-terms-2');
    expect(await hasAcceptedNewDatabaseTerms('uid-terms-2')).toBe(true);
    expect(await hasAcceptedNewDatabaseTerms('uid-terms-other')).toBe(false);
  });

  it('chave de meta é estável por UID', () => {
    expect(databaseTermsMetaKey('abc')).toBe('terms:newDatabaseAccepted:abc');
    expect(databaseTermsMetaKey('  abc  ')).toBe('terms:newDatabaseAccepted:abc');
  });
});
