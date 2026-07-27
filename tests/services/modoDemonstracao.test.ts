import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeTafDatabaseForTests } from '../../src/offline-first/db/tafDatabase';
import { importCadastroRecord, listCadastros } from '../../src/offline-first/db/localDb';
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
import {
  isSessaoModoTeste,
  mesclarSessoesHistoricoComModoTeste,
} from '../../src/utils/historicoSessoesModoTeste';

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

describe('modoDemonstracao (overlay Histórico)', () => {
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

  it('toggle só altera o flag — não troca cadastros do IndexedDB', async () => {
    const before = await listCadastros(OWNER_UID);
    expect(before).toHaveLength(1);

    const on = await toggleModoDemonstracaoSistema();
    expect(on.ativo).toBe(true);
    expect(isModoDemonstracaoAtivo()).toBe(true);
    expect(await listCadastros(OWNER_UID)).toHaveLength(1);

    const off = await toggleModoDemonstracaoSistema();
    expect(off.ativo).toBe(false);
    expect(isModoDemonstracaoAtivo()).toBe(false);
    expect(await listCadastros(OWNER_UID)).toHaveLength(1);
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
});

describe('historicoSessoesModoTeste', () => {
  it('mescla cards de exemplo só quando o modo teste está ligado', () => {
    const reais = [
      {
        id: 'sess-real',
        criadoEm: '2026-01-01T00:00:00.000Z',
        dataAplicacao: '01/01/2026',
        tipoProva: 'corrida' as const,
        resultados: [],
        normaTaf: 'armada' as const,
      },
    ];
    const off = mesclarSessoesHistoricoComModoTeste(reais, false, 'armada');
    expect(off).toHaveLength(1);
    expect(off.every((s) => !isSessaoModoTeste(s))).toBe(true);

    const on = mesclarSessoesHistoricoComModoTeste(reais, true, 'armada');
    expect(on.length).toBeGreaterThan(1);
    expect(on[0]?.id).toBe('sess-real');
    expect(on.slice(1).every((s) => isSessaoModoTeste(s))).toBe(true);
  });
});
