import { beforeEach, describe, expect, it, vi } from 'vitest';

const ownerRef = { current: 'owner-a' as string | null };

vi.mock('../../src/services/firebase/authUid', () => ({
  getCachedDataOwnerUid: () => ownerRef.current,
}));

vi.mock('../../src/offline-first/sync/SyncEngine', () => ({
  subscribeDataChanged: () => () => {},
}));

vi.mock('../../src/offline-first/db/tafDatabase', () => ({
  getTafDatabase: () => ({}),
}));

vi.mock('../../src/offline-first/db/localDb', () => ({
  listCadastrosForDisplay: vi.fn(async () => []),
  listSessoesForDisplay: vi.fn(async () => []),
  listDeletedSessoesForDisplay: vi.fn(async () => []),
}));

vi.mock('../../src/services/restritosStorage', () => ({
  getNipsRestritosAtivos: vi.fn(async () => new Set()),
}));

vi.mock('../../src/services/fatoresRiscoStorage', () => ({
  getNipsComFatoresRiscoPreenchidos: vi.fn(async () => new Set()),
}));

vi.mock('../../src/utils/resultadoGeralHistorico', () => ({
  calcularResumoInicioTafFromHistorico: vi.fn(() => ({
    totalCadastrados: 10,
    completos: 4,
    parcial: 3,
    semTeste: 3,
    restritos: 1,
    fatoresRisco: 2,
    cadastroIncompleto: 0,
    reprovados: 0,
  })),
}));

import {
  clearHomeResumoCache,
  invalidateHomeResumoCache,
  isHomeResumoCacheDirty,
  isHomeResumoCacheWarm,
  loadResumoInicioFromIndexedDb,
  peekHomeResumoCache,
} from '../../src/utils/homeResumoIndexedDb';

describe('homeResumo cache SWR', () => {
  beforeEach(() => {
    ownerRef.current = 'owner-a';
    clearHomeResumoCache();
  });

  it('mantém valor após soft-invalidate e marca dirty', async () => {
    const first = await loadResumoInicioFromIndexedDb({ force: true });
    expect(first.totalCadastrados).toBe(10);
    expect(isHomeResumoCacheWarm()).toBe(true);

    invalidateHomeResumoCache();
    expect(isHomeResumoCacheDirty()).toBe(true);
    expect(isHomeResumoCacheWarm()).toBe(false);
    expect(peekHomeResumoCache()?.totalCadastrados).toBe(10);
  });

  it('cache warm resolve sem forçar novo scan (mesmo objeto lógico)', async () => {
    await loadResumoInicioFromIndexedDb({ force: true });
    const a = await loadResumoInicioFromIndexedDb();
    const b = await loadResumoInicioFromIndexedDb();
    expect(a).toBe(b);
    expect(isHomeResumoCacheWarm()).toBe(true);
  });

  it('troca de owner invalida peek', async () => {
    await loadResumoInicioFromIndexedDb({ force: true });
    ownerRef.current = 'owner-b';
    expect(peekHomeResumoCache()).toBeNull();
    expect(isHomeResumoCacheDirty()).toBe(true);
  });
});
