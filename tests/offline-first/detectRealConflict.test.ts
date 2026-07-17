import { describe, expect, it } from 'vitest';
import {
  detectRealConflict,
  remoteAdvancedSinceLastKnownSync,
} from '../../src/offline-first/sync/detectRealConflict';
import type { CadastroRecord } from '../../src/offline-first/types';

function cad(partial: Partial<CadastroRecord>): CadastroRecord {
  return {
    id: '1',
    nip: '12345678',
    nome: 'Local',
    dataNascimento: '01/01/1990',
    categoria: 'Praças',
    ownerUid: 'boss',
    createdAt: 1000,
    updatedAt: 5000,
    syncVersion: 3,
    version: 3,
    deviceId: 'device-local',
    userId: 'u1',
    updatedBy: 'u1',
    syncStatus: 'updated',
    deleted: false,
    lastModifiedBy: 'device-local',
    lastSync: 4000,
    ...partial,
  };
}

describe('detectRealConflict', () => {
  it('detecta edição concorrente quando local pendente, remoto avançou e conteúdo difere', () => {
    const local = cad({
      nome: 'Editado Local',
      updatedAt: 8000,
      syncVersion: 4,
      syncStatus: 'updated',
      lastSync: 4000,
      tempoCorrida: '12:00',
    });
    const remote = cad({
      nome: 'Editado Remoto',
      updatedAt: 9000,
      syncVersion: 5,
      syncStatus: 'synced',
      deviceId: 'device-remote',
      tempoCorrida: '11:30',
    });

    const result = detectRealConflict({
      collection: 'cadastros',
      local,
      remote,
      localOperationId: 'op-local-1',
    });

    expect(result.hasConflict).toBe(true);
    expect(result.conflictType).toBe('concurrent_edit');
    expect(result.localVersion).toBe(4);
    expect(result.remoteVersion).toBe(5);
    expect(result.localUpdatedAt).toBe(8000);
    expect(result.remoteUpdatedAt).toBe(9000);
    expect(result.localDeviceId).toBe('device-local');
    expect(result.remoteDeviceId).toBe('device-remote');
    expect(result.localOperationId).toBe('op-local-1');
    expect(result.remoteOperationId).toBeNull();
  });

  it('não marca conflito quando local já está synced', () => {
    const local = cad({ syncStatus: 'synced', nome: 'A' });
    const remote = cad({
      syncStatus: 'synced',
      nome: 'B',
      updatedAt: 9000,
      syncVersion: 9,
    });
    expect(
      detectRealConflict({ collection: 'cadastros', local, remote }).hasConflict,
    ).toBe(false);
  });

  it('não marca conflito quando remoto não avançou após lastSync (só upload pendente)', () => {
    const local = cad({
      syncStatus: 'updated',
      lastSync: 7000,
      updatedAt: 8000,
      syncVersion: 4,
      nome: 'Local Novo',
      tempoCorrida: '12:00',
    });
    const remote = cad({
      syncStatus: 'synced',
      updatedAt: 7000,
      syncVersion: 3,
      nome: 'Base',
      tempoCorrida: '11:00',
    });
    const result = detectRealConflict({ collection: 'cadastros', local, remote });
    expect(result.hasConflict).toBe(false);
    expect(result.conflictType).toBe('remote_not_advanced');
    expect(remoteAdvancedSinceLastKnownSync(local, remote)).toBe(false);
  });

  it('não marca conflito quando conteúdo de negócio é igual', () => {
    const local = cad({
      syncStatus: 'updated',
      lastSync: 4000,
      updatedAt: 8000,
      syncVersion: 4,
      nome: 'Mesmo',
      tempoCorrida: '12:00',
      notaCorrida: '80',
    });
    const remote = cad({
      syncStatus: 'synced',
      updatedAt: 9000,
      syncVersion: 5,
      deviceId: 'other',
      nome: 'Mesmo',
      tempoCorrida: '12:00',
      notaCorrida: '80',
    });
    const result = detectRealConflict({ collection: 'cadastros', local, remote });
    expect(result.hasConflict).toBe(false);
    expect(result.conflictType).toBe('same_business_content');
  });

  it('marca concurrent_edit_with_delete quando um lado excluiu', () => {
    const local = cad({
      syncStatus: 'updated',
      lastSync: 4000,
      updatedAt: 8000,
      syncVersion: 4,
      nome: 'Ativo',
    });
    const remote = cad({
      syncStatus: 'synced',
      updatedAt: 9000,
      syncVersion: 5,
      deleted: true,
      deletedAt: 9000,
      nome: 'Ativo',
    });
    const result = detectRealConflict({ collection: 'cadastros', local, remote });
    expect(result.hasConflict).toBe(true);
    expect(result.conflictType).toBe('concurrent_edit_with_delete');
  });
});
