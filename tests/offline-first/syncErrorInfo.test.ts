import { describe, expect, it } from 'vitest';
import { parseSyncError, formatSyncUploadError } from '../../src/offline-first/sync/syncErrorInfo';
import { SYNC_AUTH_REQUIRED, SYNC_AUTH_REQUIRED_MESSAGE } from '../../src/offline-first/sync/syncAuthMessages';

describe('parseSyncError', () => {
  it('classifica offline', () => {
    const d = parseSyncError('offline');
    expect(d.code).toBe('network_offline');
    expect(d.typeLabel).toBe('Sem conexão');
    expect(d.hint).toMatch(/Wi‑Fi|dados móveis/i);
  });

  it('classifica login necessário', () => {
    expect(parseSyncError(SYNC_AUTH_REQUIRED).code).toBe('auth_required');
    expect(parseSyncError(SYNC_AUTH_REQUIRED_MESSAGE).typeLabel).toBe('Login necessário');
  });

  it('classifica permissão negada', () => {
    const d = parseSyncError('permission-denied: Missing or insufficient permissions.');
    expect(d.code).toBe('permission_denied');
    expect(d.typeLabel).toBe('Permissão na nuvem');
  });

  it('classifica envio incompleto', () => {
    const d = parseSyncError('pending_remain:3');
    expect(d.code).toBe('upload_incomplete');
    expect(d.message).toMatch(/3 alteração/);
  });

  it('formatSyncUploadError retorna mensagem legível', () => {
    expect(formatSyncUploadError('offline')).toBe('Sem conexão com a internet.');
    expect(formatSyncUploadError(null)).toMatch(/Falha ao sincronizar/);
  });
});
