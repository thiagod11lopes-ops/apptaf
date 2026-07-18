import { describe, expect, it } from 'vitest';
import { buildDownloadBreakdown, buildUploadBreakdown } from '../../src/offline-first/sync/syncQueueBreakdown';
import { isCloudSyncCollection } from '../../src/offline-first/sync/preCadastroLocalOnly';
import type { PendingSyncSummary } from '../../src/offline-first/sync/pendingSyncItems';

describe('preCadastroLocalOnly', () => {
  it('exclui pre_cadastros da sincronização com nuvem', () => {
    expect(isCloudSyncCollection('cadastros')).toBe(true);
    expect(isCloudSyncCollection('sessoes')).toBe(true);
    expect(isCloudSyncCollection('pre_cadastros')).toBe(false);
  });
});

describe('syncQueueBreakdown', () => {
  it('agrupa envios por tipo de dado', () => {
    const summary: PendingSyncSummary = {
      total: 3,
      cadastros: 1,
      sessoes: 2,
      aplicadores: 0,
      pre_cadastros: 0,
      authorizedEmails: 0,
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
      ],
    };

    const breakdown = buildUploadBreakdown(summary);
    expect(breakdown.total).toBe(3);
    expect(breakdown.categories.map((c) => c.label)).toEqual(
      expect.arrayContaining(['Cadastro', 'Natação', 'Corrida']),
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

  it('ignora pre_cadastros no breakdown de envio', () => {
    const summary: PendingSyncSummary = {
      total: 0,
      cadastros: 0,
      sessoes: 0,
      aplicadores: 0,
      pre_cadastros: 0,
      authorizedEmails: 0,
      items: [],
    };
    const breakdown = buildUploadBreakdown(summary);
    expect(breakdown.categories.some((c) => c.label.includes('Pré-cadastro'))).toBe(false);
  });

  it('inclui e-mails autorizados pendentes no breakdown de envio', () => {
    const summary: PendingSyncSummary = {
      total: 2,
      cadastros: 0,
      sessoes: 0,
      aplicadores: 0,
      pre_cadastros: 0,
      authorizedEmails: 2,
      items: [],
    };
    const breakdown = buildUploadBreakdown(summary);
    expect(breakdown.total).toBe(2);
    expect(breakdown.categories.find((c) => c.key === 'authorizedEmails')?.count).toBe(2);
    expect(breakdown.categories.some((c) => c.label === 'Outras alterações')).toBe(false);
  });
});
