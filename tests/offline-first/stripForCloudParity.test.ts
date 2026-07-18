import { describe, expect, it } from 'vitest';
import { stripForCloud } from '../../src/offline-first/sync/lastWriteWinsSync';
import type { CadastroRecord } from '../../src/offline-first/types';

function cadRecord(): CadastroRecord {
  return {
    id: 'cad-1',
    nip: '12.3456.78',
    nome: 'Militar Teste',
    dataNascimento: '01/01/1990',
    categoria: 'Praças',
    ownerUid: 'owner-1',
    createdAt: 1000,
    updatedAt: 5000,
    version: 3,
    syncVersion: 3,
    baseVersion: 2,
    deviceId: 'device-abc',
    userId: 'user-1',
    updatedBy: 'user-1',
    syncStatus: 'updated',
    deleted: false,
    lastModifiedBy: 'device-abc',
    lastSync: 4000,
  } as CadastroRecord;
}

describe('stripForCloud — payload único para todas as rotas de upload', () => {
  it('remove deviceId e metadados locais do payload ativo', () => {
    const cloud = stripForCloud({ ...cadRecord() } as unknown as Record<string, unknown>);

    expect(cloud.deviceId).toBeUndefined();
    expect(cloud.lastModifiedBy).toBeUndefined();
    expect(cloud.updatedBy).toBeUndefined();
    expect(cloud.userId).toBeUndefined();
    expect(cloud.ownerUid).toBeUndefined();
    expect(cloud.syncStatus).toBeUndefined();
    expect(cloud.lastSync).toBeUndefined();
    expect(cloud.deleted).toBeUndefined();
    expect(cloud.deletedAt).toBeUndefined();
    expect(cloud.deletedBy).toBeUndefined();
    expect(cloud.createdAt).toBeUndefined();
  });

  it('preserva os campos usados pelo LWW e o conteúdo de negócio', () => {
    const cloud = stripForCloud({ ...cadRecord() } as unknown as Record<string, unknown>);

    expect(cloud.id).toBe('cad-1');
    expect(cloud.updatedAt).toBe(5000);
    expect(cloud.version).toBe(3);
    expect(cloud.syncVersion).toBe(3);
    expect(cloud.nome).toBe('Militar Teste');
    expect(cloud.nip).toBe('12.3456.78');
    expect(cloud.categoria).toBe('Praças');
  });

  it('mesmo registro gera exatamente o mesmo payload em qualquer rota (LWW × fila)', () => {
    const record = cadRecord();

    // Rota LWW: stripForCloud({ ...local, ownerUid })
    const viaLww = stripForCloud({ ...record, ownerUid: 'owner-1' } as unknown as Record<string, unknown>);
    // Rota SyncQueue: stripForCloud(payload desserializado da fila)
    const viaQueue = stripForCloud(
      JSON.parse(JSON.stringify(record)) as Record<string, unknown>,
    );

    expect(viaQueue).toEqual(viaLww);
  });

  it('não altera nenhum outro campo além dos removidos', () => {
    const record = cadRecord() as unknown as Record<string, unknown>;
    const removed = new Set([
      'ownerUid',
      'syncStatus',
      'lastSync',
      'updatedBy',
      'deviceId',
      'userId',
      'deleted',
      'deletedAt',
      'deletedBy',
      'lastModifiedBy',
      'createdAt',
    ]);
    const cloud = stripForCloud({ ...record });

    for (const key of Object.keys(record)) {
      if (removed.has(key)) {
        expect(cloud[key]).toBeUndefined();
      } else {
        expect(cloud[key]).toEqual(record[key]);
      }
    }
  });
});
