import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeTafDatabaseForTests } from '../../src/offline-first/db/tafDatabase';
import { importCadastroRecord, listCadastros } from '../../src/offline-first/db/localDb';
import type { CadastroRecord } from '../../src/offline-first/types';
import {
  DEMO_BACKUP_ID_KEY,
  DEMO_MODO_ATIVO_KEY,
  resetAppMetaCacheForTests,
  writeAppMetaSync,
} from '../../src/offline-first/db/appMeta';
import {
  getCachedDataOwnerUid,
  hydrateAuthUidFromIndexedDb,
  resetAuthUidStateForTests,
  setAuthUidState,
} from '../../src/services/firebase/authUid';
import { createLocalBackup } from '../../src/offline-first/sync/localBackup';
import {
  garantirModoNormalNaAbertura,
  isModoDemonstracaoAtivo,
  resetGarantiaModoNormalForTests,
} from '../../src/services/modoDemonstracao';
import { gerarDadosDemonstracaoTaf } from '../../src/utils/gerarDadosDemonstracaoTaf';
import { importDemonstracaoDataset } from '../../src/offline-first/db/localDb';

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

describe('garantirModoNormalNaAbertura', () => {
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

  it('restaura dados reais quando o modo demonstração ficou persistido', async () => {
    const backupId = await createLocalBackup(OWNER_UID);
    expect(backupId).not.toBeNull();

    const { cadastros, sessoes } = gerarDadosDemonstracaoTaf();
    await importDemonstracaoDataset(OWNER_UID, cadastros, sessoes);
    writeAppMetaSync(DEMO_BACKUP_ID_KEY, String(backupId));
    writeAppMetaSync(DEMO_MODO_ATIVO_KEY, '1');

    expect(isModoDemonstracaoAtivo()).toBe(true);
    expect((await listCadastros(OWNER_UID)).length).toBeGreaterThan(1);

    await hydrateAuthUidFromIndexedDb();
    await garantirModoNormalNaAbertura();

    expect(isModoDemonstracaoAtivo()).toBe(false);
    const restaurados = await listCadastros(OWNER_UID);
    expect(restaurados).toHaveLength(1);
    expect(restaurados[0]?.nome).toBe('Militar Real');
    expect(getCachedDataOwnerUid()).toBe(OWNER_UID);
  });

  it('não executa restauração novamente na mesma sessão do app', async () => {
    await hydrateAuthUidFromIndexedDb();
    await garantirModoNormalNaAbertura();

    writeAppMetaSync(DEMO_MODO_ATIVO_KEY, '1');
    expect(isModoDemonstracaoAtivo()).toBe(true);

    await garantirModoNormalNaAbertura();
    expect(isModoDemonstracaoAtivo()).toBe(true);
  });
});
