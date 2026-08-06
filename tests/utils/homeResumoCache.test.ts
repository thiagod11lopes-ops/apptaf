import { beforeEach, describe, expect, it, vi } from 'vitest';

const ownerRef = { current: 'owner-a' as string | null };

vi.mock('../../src/services/firebase/authUid', () => ({
  getCachedDataOwnerUid: () => ownerRef.current,
}));

vi.mock('../../src/offline-first/sync/SyncEngine', () => ({
  subscribeDataChanged: () => () => {},
}));

vi.mock('../../src/services/cadastrosIndexedDb', () => ({
  getAllCadastros: vi.fn(async () => []),
}));

vi.mock('../../src/services/resultadosAplicadosIndexedDb', () => ({
  getAllSessoesAplicacao: vi.fn(async () => []),
  getDeletedSessoesAplicacao: vi.fn(async () => []),
}));

vi.mock('../../src/services/cadastrosListCache', () => ({
  peekCadastrosListCache: () => null,
}));

vi.mock('../../src/services/sessoesListCache', () => ({
  peekSessoesListCache: () => null,
}));

vi.mock('../../src/services/restritosStorage', () => ({
  getNipsRestritosAtivos: vi.fn(async () => new Set()),
}));

vi.mock('../../src/services/fatoresRiscoStorage', () => ({
  getNipsComFatoresRiscoPreenchidos: vi.fn(async () => new Set()),
}));

vi.mock('../../src/utils/yieldToUi', () => ({
  yieldToUi: vi.fn(async () => {}),
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

  it('invalidate meta não exige full quando há lastInputs', async () => {
    const { getAllCadastros } = await import('../../src/services/cadastrosIndexedDb');
    const getAll = vi.mocked(getAllCadastros);

    await loadResumoInicioFromIndexedDb({ force: true });
    const callsAfterWarm = getAll.mock.calls.length;

    invalidateHomeResumoCache('meta');
    await loadResumoInicioFromIndexedDb({ force: true });

    // Refresh meta reutiliza lastInputs — não chama getAllCadastros de novo.
    expect(getAll.mock.calls.length).toBe(callsAfterWarm);
    expect(isHomeResumoCacheWarm()).toBe(true);
  });
});
