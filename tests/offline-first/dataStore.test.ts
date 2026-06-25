import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeTafDatabaseForTests } from '../../src/offline-first/db/tafDatabase';
import { setAuthUidState } from '../../src/services/firebase/authUid';

const scheduleProcessMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/offline-first/sync/SyncEngine', () => ({
  syncEngine: {
    scheduleProcess: scheduleProcessMock,
  },
  notifyDataChanged: vi.fn(),
  subscribeDataChanged: vi.fn(() => () => {}),
}));

describe('DataStore — sync imediato após escrita', () => {
  beforeEach(async () => {
    scheduleProcessMock.mockClear();
    setAuthUidState('user-1', 'owner-1', true);
    const { dataStore } = await import('../../src/offline-first/store/DataStore');
    await dataStore.upsertCadastro(
      {
        id: 'cad-ds',
        nip: '999',
        nome: 'Via DataStore',
        dataNascimento: '01/01/1990',
        categoria: 'Oficiais',
      },
      'owner-1',
    );
  });

  afterEach(async () => {
    await closeTafDatabaseForTests();
  });

  it('dispara scheduleProcess(true) após upsertCadastro', () => {
    expect(scheduleProcessMock).toHaveBeenCalledWith(true);
  });
});
