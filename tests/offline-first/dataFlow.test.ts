import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeTafDatabaseForTests, resetTafDatabaseConnectionForTests } from '../../src/offline-first/db/tafDatabase';
import {
  ANONYMOUS_OWNER,
  listCadastros,
  listSessoes,
  listAplicadores,
  saveAplicador,
  saveCadastro,
  saveSessao,
} from '../../src/offline-first/db/localDb';
import {
  migrateAnonymousDexieToOwner,
  migrateDeviceDataOnLogin,
} from '../../src/offline-first/db/migration';
import { syncQueue } from '../../src/offline-first/sync/SyncQueue';
import { setAuthUidState } from '../../src/services/firebase/authUid';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';
import type { AplicadorItemPersist } from '../../src/services/aplicadoresIndexedDb';
import type { SessaoAplicacaoTaf } from '../../src/services/resultadosAplicadosIndexedDb';

const BOSS_UID = 'boss-test-uid';

function sampleCadastro(id = 'cad-1'): CadastroItemPersist {
  return {
    id,
    nip: '12345678',
    nome: 'Soldado Teste',
    dataNascimento: '01/01/1995',
    categoria: 'Praças',
  };
}

function sampleSessao(id = 'sess-1'): SessaoAplicacaoTaf {
  return {
    id,
    criadoEm: new Date().toISOString(),
    dataAplicacao: '01/01/2026',
    tipoProva: 'corrida',
    resultados: [],
  };
}

function sampleAplicador(id = 'app-1'): AplicadorItemPersist {
  return {
    id,
    nip: '12.3456.78',
    nome: 'Aplicador Teste',
    categoria: 'Praças',
    praca: 'Sgt',
  };
}

describe('fluxo offline — dados locais', () => {
  beforeEach(() => {
    setAuthUidState(null, null, true);
  });

  afterEach(async () => {
    await closeTafDatabaseForTests();
  });

  it('salva cadastro sem login em __local__', async () => {
    await saveCadastro(sampleCadastro(), ANONYMOUS_OWNER, null);

    const rows = await listCadastros(ANONYMOUS_OWNER);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.nome).toBe('Soldado Teste');
    expect(rows[0]?.syncStatus).toBe('local');
  });

  it('salva sessão sem login e enfileira sync', async () => {
    await saveSessao(sampleSessao(), ANONYMOUS_OWNER, null);

    const rows = await listSessoes(ANONYMOUS_OWNER);
    expect(rows).toHaveLength(1);
    expect(await syncQueue.countPending(ANONYMOUS_OWNER)).toBe(1);
  });

  it('persiste cadastro offline após simular reload (Dexie)', async () => {
    await saveCadastro(sampleCadastro('cad-reload'), ANONYMOUS_OWNER, null);
    resetTafDatabaseConnectionForTests();

    const rows = await listCadastros(ANONYMOUS_OWNER);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe('cad-reload');
  });
});

describe('login — migração anônimo → chefe', () => {
  beforeEach(() => {
    setAuthUidState('login-uid', BOSS_UID, true);
  });

  afterEach(async () => {
    await closeTafDatabaseForTests();
  });

  it('move dados __local__ para o chefe com fila pendente', async () => {
    await saveCadastro(sampleCadastro(), ANONYMOUS_OWNER, null);
    await saveSessao(sampleSessao(), ANONYMOUS_OWNER, null);

    const result = await migrateAnonymousDexieToOwner(BOSS_UID);

    expect(result).toEqual({ cadastros: 1, sessoes: 1, aplicadores: 0 });
    expect(await listCadastros(ANONYMOUS_OWNER)).toHaveLength(0);
    expect(await listSessoes(ANONYMOUS_OWNER)).toHaveLength(0);

    const bossCad = await listCadastros(BOSS_UID);
    expect(bossCad).toHaveLength(1);
    expect(bossCad[0]?.ownerUid).toBe(BOSS_UID);

    expect(await syncQueue.countPending(BOSS_UID)).toBeGreaterThanOrEqual(2);
  });

  it('move aplicadores __local__ para o chefe com fila pendente', async () => {
    await saveAplicador(sampleAplicador(), ANONYMOUS_OWNER, null);

    const result = await migrateAnonymousDexieToOwner(BOSS_UID);

    expect(result.aplicadores).toBe(1);
    expect(await listAplicadores(ANONYMOUS_OWNER)).toHaveLength(0);
    expect(await listAplicadores(BOSS_UID)).toHaveLength(1);
    expect(await syncQueue.countPending(BOSS_UID)).toBeGreaterThanOrEqual(1);
  });

  it('migrateDeviceDataOnLogin ignora quando não há dados locais', async () => {
    await migrateDeviceDataOnLogin(BOSS_UID);
    expect(await listCadastros(BOSS_UID)).toHaveLength(0);
  });
});

describe('fluxo online — fila de sync do chefe', () => {
  beforeEach(() => {
    setAuthUidState('login-uid', BOSS_UID, true);
  });

  afterEach(async () => {
    await closeTafDatabaseForTests();
  });

  it('cadastro logado enfileira upload para ownerUid', async () => {
    await saveCadastro(sampleCadastro(), BOSS_UID, 'login-uid');

    const pending = await syncQueue.listPending(BOSS_UID);
    expect(pending.some((p) => p.collection === 'cadastros' && p.documentId === 'cad-1')).toBe(true);
  });

  it('múltiplas edições compactam fila do mesmo documento', async () => {
    await saveCadastro(sampleCadastro(), BOSS_UID, 'login-uid');
    await saveCadastro({ ...sampleCadastro(), nome: 'Nome Atualizado' }, BOSS_UID, 'login-uid');

    const pending = await syncQueue.listPending(BOSS_UID);
    const cadOps = pending.filter((p) => p.collection === 'cadastros' && p.documentId === 'cad-1');
    expect(cadOps).toHaveLength(1);
    expect(JSON.parse(cadOps[0]!.payload).nome).toBe('Nome Atualizado');
  });
});
