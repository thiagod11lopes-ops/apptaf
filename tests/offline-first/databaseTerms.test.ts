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

  it('aceite prévio por e-mail é consumido no UID após cadastro', async () => {
    const { setDatabaseTermsPreAcceptedForEmail, consumeDatabaseTermsPreAccepted, hasAcceptedNewDatabaseTerms, clearDatabaseTermsPreAccepted } =
      await import('../../src/offline-first/auth/databaseTerms');
    clearDatabaseTermsPreAccepted();
    setDatabaseTermsPreAcceptedForEmail('novo.chefe@marinha.mil.br');
    expect(
      await consumeDatabaseTermsPreAccepted('uid-new', 'novo.chefe@marinha.mil.br'),
    ).toBe(true);
    expect(await hasAcceptedNewDatabaseTerms('uid-new')).toBe(true);
    // Já consumido — não reaproveita
    setDatabaseTermsPreAcceptedForEmail('outro@marinha.mil.br');
    expect(await consumeDatabaseTermsPreAccepted('uid-new', 'novo.chefe@marinha.mil.br')).toBe(false);
  });

  it('e-mails conhecidos no dispositivo persistem e são normalizados', async () => {
    const { isKnownAuthEmailOnDevice, rememberKnownAuthEmailOnDevice } = await import(
      '../../src/offline-first/auth/knownAuthEmails'
    );
    expect(await isKnownAuthEmailOnDevice('chefe.existente@marinha.mil.br')).toBe(false);
    await rememberKnownAuthEmailOnDevice('  Chefe.Existente@MARINHA.MIL.BR ');
    expect(await isKnownAuthEmailOnDevice('chefe.existente@marinha.mil.br')).toBe(true);
    expect(await isKnownAuthEmailOnDevice('desconhecido@marinha.mil.br')).toBe(false);
    // inválido nunca é registrado
    await rememberKnownAuthEmailOnDevice('nao-e-email');
    expect(await isKnownAuthEmailOnDevice('nao-e-email')).toBe(false);
  });
});
