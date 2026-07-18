import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildFirestoreTombstone,
  tombstoneToCloudDoc,
  type TombstonePayload,
} from '../../src/offline-first/sync/tombstone';

const upsertOwnerDoc = vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined);

vi.mock('../../src/services/supabase/ownerDocs', () => ({
  upsertOwnerDoc: (...args: unknown[]) => upsertOwnerDoc(...args),
  deleteOwnerDoc: vi.fn(async () => undefined),
  listOwnerDocs: vi.fn(async () => []),
  listOwnerDocsSince: vi.fn(async () => []),
  rowToDoc: vi.fn((row: { id: string }) => row),
}));

vi.mock('../../src/services/supabase/cadastroRubricasCloud', () => ({
  deleteCadastroRubricasCloud: vi.fn(async () => undefined),
  setCadastroRubricasCloud: vi.fn(async () => undefined),
}));

vi.mock('../../src/services/supabase/sessaoRubricasCloud', () => ({
  deleteSessaoRubricasCloud: vi.fn(async () => undefined),
  setSessaoRubricasCloud: vi.fn(async () => undefined),
}));

import { deleteCadastroFirestore } from '../../src/services/supabase/cadastrosCloud';
import { deleteSessaoFirestore } from '../../src/services/supabase/sessoesCloud';
import { deleteAplicadorFirestore } from '../../src/services/supabase/aplicadoresCloud';

const CONTRACT_KEYS = [
  'id',
  'updatedAt',
  'deleted',
  'deletedAt',
  'deletedBy',
  'syncVersion',
  'updatedBy',
  'deviceId',
].sort();

function sampleTombstone(id: string): TombstonePayload {
  return {
    id,
    updatedAt: 9000,
    deleted: true,
    deletedAt: 8900,
    deletedBy: 'user-a',
    syncVersion: 4,
    updatedBy: 'user-a',
    deviceId: 'dev-1',
  };
}

async function capturedCloudDoc(): Promise<Record<string, unknown>> {
  expect(upsertOwnerDoc).toHaveBeenCalledTimes(1);
  return upsertOwnerDoc.mock.calls[0][3] as Record<string, unknown>;
}

beforeEach(() => {
  upsertOwnerDoc.mockClear();
});

describe('contrato único de tombstone entre coleções', () => {
  it('tombstoneToCloudDoc contém exatamente os campos do contrato', () => {
    const doc = tombstoneToCloudDoc(sampleTombstone('x-1'));
    expect(Object.keys(doc).sort()).toEqual(CONTRACT_KEYS);
    expect(doc.deleted).toBe(true);
  });

  it('cadastro gera tombstone no novo formato', async () => {
    await deleteCadastroFirestore('uid-1', 'cad-1', sampleTombstone('cad-1'));
    const doc = await capturedCloudDoc();
    expect(Object.keys(doc).sort()).toEqual(CONTRACT_KEYS);
    expect(doc).toEqual(tombstoneToCloudDoc(sampleTombstone('cad-1')));
  });

  it('sessão gera tombstone no novo formato', async () => {
    await deleteSessaoFirestore('uid-1', 'sess-1', sampleTombstone('sess-1'));
    const doc = await capturedCloudDoc();
    expect(Object.keys(doc).sort()).toEqual(CONTRACT_KEYS);
    expect(doc).toEqual(tombstoneToCloudDoc(sampleTombstone('sess-1')));
  });

  it('aplicador continua funcionando com o mesmo contrato', async () => {
    await deleteAplicadorFirestore('uid-1', 'app-1', sampleTombstone('app-1'));
    const doc = await capturedCloudDoc();
    expect(Object.keys(doc).sort()).toEqual(CONTRACT_KEYS);
    expect(doc).toEqual(tombstoneToCloudDoc(sampleTombstone('app-1')));
  });

  it('as três coleções enviam exatamente o mesmo objeto para o mesmo tombstone', async () => {
    const tombstone = sampleTombstone('same-id');

    await deleteCadastroFirestore('uid-1', 'same-id', tombstone);
    const cadDoc = upsertOwnerDoc.mock.calls[0][3];
    upsertOwnerDoc.mockClear();

    await deleteSessaoFirestore('uid-1', 'same-id', tombstone);
    const sessDoc = upsertOwnerDoc.mock.calls[0][3];
    upsertOwnerDoc.mockClear();

    await deleteAplicadorFirestore('uid-1', 'same-id', tombstone);
    const appDoc = upsertOwnerDoc.mock.calls[0][3];

    expect(cadDoc).toEqual(sessDoc);
    expect(sessDoc).toEqual(appDoc);
  });

  it('nenhum campo obrigatório foi removido (buildFirestoreTombstone preserva o contrato)', () => {
    const record = {
      id: 'cad-1',
      updatedAt: 9000,
      deletedAt: 8900,
      deletedBy: 'user-a',
      syncVersion: 4,
      updatedBy: 'user-a',
      userId: 'user-a',
      deviceId: 'dev-1',
      deleted: true,
    } as Parameters<typeof buildFirestoreTombstone>[0];

    const tombstone = buildFirestoreTombstone(record);
    const doc = tombstoneToCloudDoc(tombstone);

    expect(doc.id).toBe('cad-1');
    expect(doc.updatedAt).toBe(9000);
    expect(doc.deleted).toBe(true);
    expect(doc.deletedAt).toBe(8900);
    expect(doc.deletedBy).toBe('user-a');
    expect(doc.syncVersion).toBe(4);
    expect(doc.updatedBy).toBe('user-a');
    expect(doc.deviceId).toBe('dev-1');
  });

  it('tombstone antigo sem campos novos continua aceito (campos opcionais)', () => {
    const legacy: TombstonePayload = {
      id: 'old-1',
      updatedAt: 5000,
      deleted: true,
      deletedAt: 4900,
      deletedBy: 'user-b',
    };
    const doc = tombstoneToCloudDoc(legacy);
    expect(Object.keys(doc).sort()).toEqual(CONTRACT_KEYS);
    expect(doc.syncVersion).toBeUndefined();
    expect(doc.updatedBy).toBeUndefined();
    expect(doc.deviceId).toBeUndefined();
    expect(doc.deletedAt).toBe(4900);
  });
});
