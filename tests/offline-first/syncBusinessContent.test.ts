import { describe, expect, it } from 'vitest';
import {
  cadastroBusinessContentEqual,
  resolveContentDriftAction,
} from '../../src/offline-first/sync/syncBusinessContent';
import type { CadastroRecord } from '../../src/offline-first/types';

function cad(partial: Partial<CadastroRecord>): CadastroRecord {
  return {
    id: 'c1',
    nip: '12345678',
    nome: 'Silva',
    dataNascimento: '01/01/1990',
    categoria: 'Praças',
    ownerUid: 'boss',
    createdAt: 1000,
    updatedAt: 5000,
    syncVersion: 3,
    version: 3,
    deviceId: 'd1',
    userId: 'u1',
    updatedBy: 'u1',
    syncStatus: 'synced',
    deleted: false,
    lastModifiedBy: 'd1',
    ...partial,
  };
}

describe('syncBusinessContent', () => {
  it('detecta exclusão de corrida no cadastro com mesmo updatedAt', () => {
    const local = cad({ tempoCorrida: '12:00', notaCorrida: '80', updatedAt: 9000, syncVersion: 5 });
    const remote = cad({ updatedAt: 9000, syncVersion: 5, syncStatus: 'synced' });
    expect(cadastroBusinessContentEqual(local, remote)).toBe(false);
    expect(resolveContentDriftAction(local, remote)).toBe('download');
  });

  it('cadastros idênticos em resultados TAF', () => {
    const a = cad({ tempoCorrida: '12:00', notaCorrida: '80' });
    const b = cad({ tempoCorrida: '12:00', notaCorrida: '80' });
    expect(cadastroBusinessContentEqual(a, b)).toBe(true);
  });
});
