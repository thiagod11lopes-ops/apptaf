import { describe, expect, it } from 'vitest';
import {
  isUnsyncedLocalStatus,
  normalizeSyncStatus,
  syncStatusForOperation,
} from '../../src/offline-first/sync/syncStatus';

describe('syncStatus', () => {
  it('marca CREATE como local e UPDATE como updated', () => {
    expect(syncStatusForOperation('CREATE')).toBe('local');
    expect(syncStatusForOperation('UPDATE')).toBe('updated');
    expect(syncStatusForOperation('DELETE')).toBe('deleted');
  });

  it('detecta status não sincronizados incluindo legado pending', () => {
    expect(isUnsyncedLocalStatus('local')).toBe(true);
    expect(isUnsyncedLocalStatus('updated')).toBe(true);
    expect(isUnsyncedLocalStatus('pending')).toBe(true);
    expect(isUnsyncedLocalStatus('synced')).toBe(false);
  });

  it('normaliza pending legado para updated', () => {
    expect(normalizeSyncStatus('pending')).toBe('updated');
  });

  it('normaliza conflict legado para updated (LWW)', () => {
    expect(normalizeSyncStatus('conflict')).toBe('updated');
  });
});
