import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeTafDatabaseForTests } from '../../src/offline-first/db/tafDatabase';
import { setAuthUidState } from '../../src/services/firebase/authUid';

const scheduleProcessMock = vi.fn().mockResolvedValue(undefined);
const notifyDataChangedMock = vi.fn();

vi.mock('../../src/offline-first/sync/SyncEngine', () => ({
  syncEngine: {
    scheduleProcess: scheduleProcessMock,
  },
  notifyDataChanged: notifyDataChangedMock,
  subscribeDataChanged: vi.fn(() => () => {}),
}));

describe('DataStore — escrita local', () => {
  beforeEach(async () => {
    scheduleProcessMock.mockClear();
    notifyDataChangedMock.mockClear();
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

  it('notifica UI sem disparar sync automático', () => {
    expect(notifyDataChangedMock).toHaveBeenCalled();
    expect(scheduleProcessMock).not.toHaveBeenCalled();
  });
});
