import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeTafDatabaseForTests } from '../../src/offline-first/db/tafDatabase';
import {
  importCadastroRecord,
  listCadastros,
  listSessoes,
  ensureDemoCadastrosForAplicar,
  removeDemoCadastrosAndAplicador,
} from '../../src/offline-first/db/localDb';
import type { CadastroRecord } from '../../src/offline-first/types';
import {
  DEMO_BACKUP_ID_KEY,
  DEMO_MODO_ATIVO_KEY,
  isModoDemonstracaoAtivo,
  resetAppMetaCacheForTests,
  writeAppMetaSync,
} from '../../src/offline-first/db/appMeta';
import {
  resetAuthUidStateForTests,
  setAuthUidState,
} from '../../src/services/firebase/authUid';
import { createLocalBackup } from '../../src/offline-first/sync/localBackup';
import {
  garantirModoNormalNaAbertura,
  resetGarantiaModoNormalForTests,
  toggleModoDemonstracaoSistema,
} from '../../src/services/modoDemonstracao';
import { gerarDadosDemonstracaoTaf } from '../../src/utils/gerarDadosDemonstracaoTaf';
import { importDemonstracaoDataset } from '../../src/offline-first/db/localDb';
import { isSessaoModoTeste } from '../../src/utils/historicoSessoesModoTeste';
import { dataStore } from '../../src/offline-first/store/DataStore';

const OWNER_UID = 'demo-restore-owner';

function cadastroRecord(id: string): CadastroRecord {
  return {
    id,
    nip: '12345678',
    nome: 'Militar Real',
    dataNascimento: '01/01/1995',
    categoria: 'Praças',
    ownerUid: OWNER_UID,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    syncVersion: 1,
    version: 1,
    deviceId: 'test',
    userId: null,
    updatedBy: 'test',
    lastModifiedBy: 'test',
    syncStatus: 'synced',
    deleted: false,
  };
}

describe('modoDemonstracao (Aplicar → Histórico)', () => {
  beforeEach(async () => {
    resetAppMetaCacheForTests();
    resetAuthUidStateForTests();
    resetGarantiaModoNormalForTests();
    setAuthUidState(null, OWNER_UID, true);
    await importCadastroRecord(cadastroRecord('real-1'));
  });

  afterEach(async () => {
    await closeTafDatabaseForTests();
    resetAppMetaCacheForTests();
    resetAuthUidStateForTests();
    resetGarantiaModoNormalForTests();
  });

  it('ativar disponibiliza cadastros demo sem apagar dados reais nem criar sessões', async () => {
    const on = await toggleModoDemonstracaoSistema();
    expect(on.ativo).toBe(true);
    expect(isModoDemonstracaoAtivo()).toBe(true);

    const cadastros = await listCadastros(OWNER_UID);
    expect(cadastros.some((c) => c.id === 'real-1')).toBe(true);
    expect(cadastros.some((c) => c.id.startsWith('demo-cad-'))).toBe(true);

    const sessoes = await listSessoes(OWNER_UID);
    expect(sessoes.every((s) => !s.id.startsWith('demo-sess-'))).toBe(true);

    const display = await dataStore.getCadastros(OWNER_UID);
    expect(display.every((c) => !c.id.startsWith('demo-cad-'))).toBe(true);
    const comDemo = await dataStore.getCadastros(OWNER_UID, { includeDemo: true });
    expect(comDemo.some((c) => c.id.startsWith('demo-cad-'))).toBe(true);
  });

  it('desativar remove cadastros demo e mantém sessões demo-sess-*', async () => {
    await toggleModoDemonstracaoSistema();
    await dataStore.upsertSessao(
      {
        id: 'demo-sess-applied-1',
        criadoEm: new Date().toISOString(),
        dataAplicacao: '20/07/2026',
        tipoProva: 'corrida',
        resultados: [],
        normaTaf: 'armada',
      },
      OWNER_UID,
    );

    const off = await toggleModoDemonstracaoSistema();
    expect(off.ativo).toBe(false);

    const cadastros = await listCadastros(OWNER_UID);
    expect(cadastros.every((c) => !c.id.startsWith('demo-cad-'))).toBe(true);
    expect(cadastros.some((c) => c.id === 'real-1')).toBe(true);

    const historico = await dataStore.getSessoes(OWNER_UID, { includeDemo: true });
    expect(historico.some((s) => s.id === 'demo-sess-applied-1')).toBe(true);
    expect(isSessaoModoTeste({ id: 'demo-sess-applied-1' })).toBe(true);

    const foraHistorico = await dataStore.getSessoes(OWNER_UID);
    expect(foraHistorico.every((s) => !s.id.startsWith('demo-sess-'))).toBe(true);
  });

  it('restaura dados reais se ainda houver snapshot do antigo swap', async () => {
    const backupId = await createLocalBackup(OWNER_UID);
    expect(backupId).not.toBeNull();

    const { cadastros, sessoes } = gerarDadosDemonstracaoTaf();
    await importDemonstracaoDataset(OWNER_UID, cadastros, sessoes);
    writeAppMetaSync(DEMO_BACKUP_ID_KEY, String(backupId));
    writeAppMetaSync(DEMO_MODO_ATIVO_KEY, '1');

    expect((await listCadastros(OWNER_UID)).length).toBeGreaterThan(1);

    await garantirModoNormalNaAbertura();

    expect(isModoDemonstracaoAtivo()).toBe(false);
    const after = await listCadastros(OWNER_UID);
    expect(after.some((c) => c.id === 'real-1')).toBe(true);
    expect(after.every((c) => !c.id.startsWith('demo-cad-'))).toBe(true);
  });

  it('ensure/remove helpers não tocam sessões demo', async () => {
    await ensureDemoCadastrosForAplicar(OWNER_UID);
    await dataStore.upsertSessao(
      {
        id: 'demo-sess-keep',
        criadoEm: new Date().toISOString(),
        dataAplicacao: '20/07/2026',
        tipoProva: 'natacao',
        resultados: [],
        normaTaf: 'armada',
      },
      OWNER_UID,
    );
    await removeDemoCadastrosAndAplicador(OWNER_UID);
    const sessoes = await listSessoes(OWNER_UID);
    expect(sessoes.some((s) => s.id === 'demo-sess-keep')).toBe(true);
    expect((await listCadastros(OWNER_UID)).every((c) => !c.id.startsWith('demo-cad-'))).toBe(
      true,
    );
  });
});
