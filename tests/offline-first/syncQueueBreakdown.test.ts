import { describe, expect, it } from 'vitest';
import { buildDownloadBreakdown, buildUploadBreakdown } from '../../src/offline-first/sync/syncQueueBreakdown';
import type { PendingSyncSummary } from '../../src/offline-first/sync/pendingSyncItems';

describe('syncQueueBreakdown', () => {
  it('agrupa envios por tipo de dado', () => {
    const summary: PendingSyncSummary = {
      total: 4,
      cadastros: 1,
      sessoes: 2,
      aplicadores: 0,
      pre_cadastros: 1,
      items: [
        {
          collection: 'cadastros',
          id: 'c1',
          createdAt: 1,
          updatedAt: 1,
          version: 1,
          deviceId: 'd',
          syncStatus: 'local',
          record: { id: 'c1', nip: '1', nome: 'A' } as never,
        },
        {
          collection: 'sessoes',
          id: 's1',
          createdAt: 1,
          updatedAt: 1,
          version: 1,
          deviceId: 'd',
          syncStatus: 'local',
          record: { id: 's1', tipoProva: 'natacao' } as never,
        },
        {
          collection: 'sessoes',
          id: 's2',
          createdAt: 1,
          updatedAt: 1,
          version: 1,
          deviceId: 'd',
          syncStatus: 'local',
          record: { id: 's2', tipoProva: 'corrida' } as never,
        },
        {
          collection: 'pre_cadastros',
          id: 'p1',
          createdAt: 1,
          updatedAt: 1,
          version: 1,
          deviceId: 'd',
          syncStatus: 'local',
          record: { id: 'p1', tipoProva: 'permanencia' } as never,
        },
      ],
    };

    const breakdown = buildUploadBreakdown(summary);
    expect(breakdown.total).toBe(4);
    expect(breakdown.categories.map((c) => c.label)).toEqual(
      expect.arrayContaining(['Cadastro', 'Natação', 'Corrida', 'Pré-cadastro · Permanência']),
    );
  });

  it('detalha downloads por modalidade de resultado', () => {
    const breakdown = buildDownloadBreakdown(
      [
        { collection: 'sessoes', remote: { tipoProva: 'natacao' } },
        { collection: 'sessoes', remote: { tipoProva: 'natacao' } },
        { collection: 'cadastros', remote: {} },
      ],
      3,
    );

    expect(breakdown.categories.find((c) => c.label === 'Natação')?.count).toBe(2);
    expect(breakdown.categories.find((c) => c.label === 'Cadastro')?.count).toBe(1);
  });
});
