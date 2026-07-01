import { describe, expect, it } from 'vitest';
import {
  parseSyncError,
  formatSyncUploadError,
  shouldTreatAsUpdateBlocked,
} from '../../src/offline-first/sync/syncErrorInfo';
import {
  SYNC_AUTH_REQUIRED,
  SYNC_AUTH_REQUIRED_MESSAGE,
  SYNC_UPDATE_BLOCKED,
  SYNC_UPDATE_BLOCKED_MESSAGE,
} from '../../src/offline-first/sync/syncAuthMessages';

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

  it('classifica atualização bloqueada pela rede', () => {
    expect(parseSyncError(SYNC_UPDATE_BLOCKED).code).toBe('update_blocked');
    expect(parseSyncError(SYNC_UPDATE_BLOCKED).typeLabel).toBe('Atualização bloqueada');
    expect(parseSyncError(SYNC_UPDATE_BLOCKED_MESSAGE).hint).toMatch(/dados móveis|Firebase/i);

    const d = parseSyncError('Failed to fetch');
    expect(d.code).toBe('update_blocked');
    expect(d.message).toBe(SYNC_UPDATE_BLOCKED_MESSAGE);
  });

  it('shouldTreatAsUpdateBlocked ignora permissão e auth', () => {
    expect(shouldTreatAsUpdateBlocked('permission-denied: Missing or insufficient permissions.')).toBe(
      false,
    );
    expect(shouldTreatAsUpdateBlocked(SYNC_AUTH_REQUIRED)).toBe(false);
    expect(shouldTreatAsUpdateBlocked('Failed to fetch')).toBe(true);
    expect(shouldTreatAsUpdateBlocked(SYNC_UPDATE_BLOCKED)).toBe(true);
  });

  it('formatSyncUploadError retorna mensagem legível', () => {
    expect(formatSyncUploadError('offline')).toBe('Sem conexão com a internet.');
    expect(formatSyncUploadError(null)).toMatch(/Falha ao sincronizar/);
  });
});
