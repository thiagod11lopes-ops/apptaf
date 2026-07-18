import { afterAll, describe, expect, it } from 'vitest';
import { closeTafDatabaseForTests } from '../../src/offline-first/db/tafDatabase';
import { authorizedEmailRepository } from '../../src/offline-first/repositories/AuthorizedEmailRepository';
import { getPendingSyncItems } from '../../src/offline-first/sync/pendingSyncItems';
import { buildUploadBreakdown } from '../../src/offline-first/sync/syncQueueBreakdown';

const OWNER = 'owner-emails-1';

describe('pendências de e-mails autorizados — badge do botão de sincronização', () => {
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await closeTafDatabaseForTests();
  });

  it('adicionar e-mail cria pendência de envio contada no total', async () => {
    const before = await getPendingSyncItems(OWNER);
    expect(before.authorizedEmails).toBe(0);

    await authorizedEmailRepository.addLocal(OWNER, 'colega@marinha.mil.br');

    const after = await getPendingSyncItems(OWNER);
    expect(after.authorizedEmails).toBe(1);
    expect(after.total).toBe(before.total + 1);
    // Não entra em items — envio é feito por pushPendingAuthorizedEmails.
    expect(after.items.some((i) => i.id.includes('colega'))).toBe(false);

    const breakdown = buildUploadBreakdown(after);
    expect(breakdown.categories.find((c) => c.key === 'authorizedEmails')?.count).toBe(1);
  });

  it('após sincronizado, a pendência some; remoção volta a contar', async () => {
    await authorizedEmailRepository.replaceFromRemote(OWNER, [
      { email: 'colega@marinha.mil.br', ativo: true },
    ]);

    const synced = await getPendingSyncItems(OWNER);
    expect(synced.authorizedEmails).toBe(0);

    await authorizedEmailRepository.removeLocal(OWNER, 'colega@marinha.mil.br');
    const afterRemove = await getPendingSyncItems(OWNER);
    expect(afterRemove.authorizedEmails).toBe(1);
  });
});
