import { describe, expect, it } from 'vitest';
import { buildRealConflictAuditEntry } from '../../src/offline-first/sync/auditRealConflicts';
import { detectRealConflict } from '../../src/offline-first/sync/detectRealConflict';
import { decideLastWriteWins } from '../../src/offline-first/sync/lastWriteWins';
import type { CadastroRecord } from '../../src/offline-first/types';

function cad(partial: Partial<CadastroRecord>): CadastroRecord {
  return {
    id: 'cad-1',
    nip: '00.0000.00',
    nome: 'Militar',
    dataNascimento: '01/01/1990',
    categoria: 'Praças',
    ownerUid: 'boss',
    createdAt: 1000,
    updatedAt: 5000,
    syncVersion: 3,
    version: 3,
    deviceId: 'device-local',
    userId: 'user-local',
    updatedBy: 'user-local',
    syncStatus: 'updated',
    deleted: false,
    lastModifiedBy: 'device-local',
    lastSync: 4000,
    ...partial,
  };
}

async function audit(local: CadastroRecord, remote: CadastroRecord) {
  const detected = detectRealConflict({
    collection: 'cadastros',
    local,
    remote,
    localOperationId: 'operation-local',
    remoteOperationId: 'operation-remote',
  });
  expect(detected.hasConflict).toBe(true);
  return buildRealConflictAuditEntry({
    collection: 'cadastros',
    recordId: local.id,
    detected,
    local,
    remote,
    detectedAt: 10_000,
  });
}

describe('auditoria de conflitos reais', () => {
  it('registra local como vencedor e remoto como descartado', async () => {
    const local = cad({
      nome: 'VERSAO_LOCAL_SECRETA',
      tempoCorrida: '12:00',
      updatedAt: 9000,
      syncVersion: 5,
    });
    const remote = cad({
      nome: 'VERSAO_REMOTA_SECRETA',
      tempoCorrida: '13:00',
      updatedAt: 8000,
      syncVersion: 4,
      deviceId: 'device-remote',
      userId: 'user-remote',
      updatedBy: 'user-remote',
      syncStatus: 'synced',
    });

    const entry = await audit(local, remote);

    expect(entry.conflictId).toBeTruthy();
    expect(entry.conflictKey).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(entry.result).toEqual({
      winner: 'local',
      loser: 'remote',
      action: 'upload',
      reason: 'local_updatedAt_mais_recente',
    });
    expect(entry.local.operationId).toBe('operation-local');
    expect(entry.local.userId).toBe('user-local');
    expect(entry.remote.operationId).toBe('operation-remote');
    expect(entry.remote.userId).toBe('user-remote');
    expect(entry.local.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(entry.remote.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);

    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain('VERSAO_LOCAL_SECRETA');
    expect(serialized).not.toContain('VERSAO_REMOTA_SECRETA');
    expect(serialized).not.toContain('00.0000.00');
  });

  it('registra remoto como vencedor e local como descartado', async () => {
    const local = cad({
      tempoCorrida: '12:00',
      updatedAt: 8000,
      syncVersion: 4,
    });
    const remote = cad({
      tempoCorrida: '11:00',
      updatedAt: 9000,
      syncVersion: 5,
      deviceId: 'device-remote',
      syncStatus: 'synced',
    });

    const entry = await audit(local, remote);

    expect(entry.result).toEqual({
      winner: 'remote',
      loser: 'local',
      action: 'download',
      reason: 'remoto_updatedAt_mais_recente',
    });
  });

  it('audita conflito envolvendo exclusão', async () => {
    const local = cad({
      tempoCorrida: '12:00',
      updatedAt: 8000,
      syncVersion: 4,
    });
    const remote = cad({
      updatedAt: 9000,
      syncVersion: 5,
      deleted: true,
      deletedAt: 9000,
      deviceId: 'device-remote',
      syncStatus: 'synced',
    });

    const entry = await audit(local, remote);

    expect(entry.conflictType).toBe('concurrent_edit_with_delete');
    expect(entry.result.winner).toBe('remote');
    expect(entry.result.loser).toBe('local');
  });

  it('mantém o LWW como decisão final', async () => {
    const local = cad({
      tempoCorrida: '12:00',
      updatedAt: 9000,
      syncVersion: 5,
    });
    const remote = cad({
      tempoCorrida: '11:00',
      updatedAt: 8000,
      syncVersion: 4,
      syncStatus: 'synced',
    });

    const before = decideLastWriteWins(local, remote);
    const entry = await audit(local, remote);
    const after = decideLastWriteWins(local, remote);

    expect(before).toEqual(after);
    expect(entry.result.action).toBe(before.action);
    expect(entry.result.reason).toBe(before.reason);
  });

  it('gera chave estável para deduplicar o mesmo conflito', async () => {
    const local = cad({
      tempoCorrida: '12:00',
      updatedAt: 9000,
      syncVersion: 5,
    });
    const remote = cad({
      tempoCorrida: '11:00',
      updatedAt: 8000,
      syncVersion: 4,
      syncStatus: 'synced',
    });

    const first = await audit(local, remote);
    const second = await audit(local, remote);

    expect(first.conflictKey).toBe(second.conflictKey);
    expect(first.conflictId).not.toBe(second.conflictId);
  });
});
