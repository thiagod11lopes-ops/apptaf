import { afterAll, describe, expect, it } from 'vitest';
import { closeTafDatabaseForTests } from '../../src/offline-first/db/tafDatabase';
import { authorizedEmailRepository } from '../../src/offline-first/repositories/AuthorizedEmailRepository';
import { getPendingSyncItems } from '../../src/offline-first/sync/pendingSyncItems';

const OWNER = 'owner-email-merge-1';

describe('authorizedEmails — merge preserva pendências locais', () => {
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await closeTafDatabaseForTests();
  });

  it('replaceFromRemote não apaga e-mail local pendente', async () => {
    await authorizedEmailRepository.addLocal(OWNER, 'novo@marinha.mil.br');
    expect((await getPendingSyncItems(OWNER)).authorizedEmails).toBe(1);

    await authorizedEmailRepository.replaceFromRemote(OWNER, [
      { email: 'ja-na-nuvem@marinha.mil.br', ativo: true },
    ]);

    const local = await authorizedEmailRepository.listLocal(OWNER);
    expect(local.map((e) => e.email).sort()).toEqual([
      'ja-na-nuvem@marinha.mil.br',
      'novo@marinha.mil.br',
    ]);
    expect((await getPendingSyncItems(OWNER)).authorizedEmails).toBe(1);

    const pending = await authorizedEmailRepository.listPendingSync(OWNER);
    expect(pending.some((p) => p.email === 'novo@marinha.mil.br' && p.syncStatus === 'local')).toBe(
      true,
    );
  });

  it('replaceFromRemote preserva remoção local pendente', async () => {
    await authorizedEmailRepository.replaceFromRemote(OWNER, [
      { email: 'remover@marinha.mil.br', ativo: true },
    ]);
    await authorizedEmailRepository.removeLocal(OWNER, 'remover@marinha.mil.br');

    await authorizedEmailRepository.replaceFromRemote(OWNER, [
      { email: 'remover@marinha.mil.br', ativo: true },
    ]);

    const pending = await authorizedEmailRepository.listPendingSync(OWNER);
    expect(pending.some((p) => p.email === 'remover@marinha.mil.br' && p.syncStatus === 'deleted')).toBe(
      true,
    );
    const active = await authorizedEmailRepository.listLocal(OWNER);
    expect(active.some((e) => e.email === 'remover@marinha.mil.br')).toBe(false);
  });
});
