import { afterAll, describe, expect, it } from 'vitest';
import { closeTafDatabaseForTests } from '../../src/offline-first/db/tafDatabase';
import { ANONYMOUS_OWNER, getCadastroRaw, putCadastroRecord } from '../../src/offline-first/db/localDb';
import { decideLastWriteWins } from '../../src/offline-first/sync/lastWriteWins';
import { readSyncVersion, readUpdatedAt } from '../../src/offline-first/sync/recordMeta';
import {
  alignRedundantDownloads,
  cadastroRubricasMatchLocal,
  fullBusinessContentEqualForDownload,
  sessaoRubricasMatchLocal,
} from '../../src/offline-first/sync/redundantDownloadGuard';
import type { CadastroRecord } from '../../src/offline-first/types';
import type { SyncRecord } from '../../src/offline-first/sync/lastWriteWins';

const OWNER = ANONYMOUS_OWNER;

function cadastroLocal(id: string, overrides: Partial<CadastroRecord> = {}): CadastroRecord {
  return {
    id,
    nip: `99${id.replace(/\D/g, '').padStart(6, '0')}`,
    nome: 'Marinheiro Teste',
    dataNascimento: '10/10/1990',
    categoria: 'Praças',
    tempoCorrida: '12:00',
    notaCorrida: '80',
    ownerUid: OWNER,
    createdAt: 1_000,
    updatedAt: 1_000,
    version: 3,
    syncVersion: 3,
    deviceId: 'device-local',
    userId: null,
    syncStatus: 'synced',
    deleted: false,
    lastModifiedBy: 'device-local',
    ...overrides,
  } as CadastroRecord;
}

/** Remoto com o mesmo conteúdo de negócio, mas metadados de sync mais novos. */
function remoteComMetadadosNovos(local: CadastroRecord): SyncRecord {
  const {
    rubricaCorridaSvg: _1,
    rubricaNatacaoSvg: _2,
    rubricaCaminhadaSvg: _3,
    rubricaPermanenciaSvg: _4,
    ...semRubricas
  } = local as CadastroRecord & Record<string, unknown>;
  return {
    ...semRubricas,
    updatedAt: 5_000,
    syncVersion: 7,
    version: 7,
    deviceId: 'remote',
    lastModifiedBy: 'remote',
  } as SyncRecord;
}

const noRubrics = {
  fetchCadastroRubricas: async () => new Map(),
  fetchSessaoRubricas: async () => new Map(),
};

describe('redundantDownloadGuard — não baixar o que já existe localmente', () => {
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await closeTafDatabaseForTests();
  });

  it('conteúdo idêntico com metadados diferentes é considerado igual', () => {
    const local = cadastroLocal('rdg-eq');
    const remote = remoteComMetadadosNovos(local);
    expect(fullBusinessContentEqualForDownload('cadastros', local, remote)).toBe(true);
  });

  it('diferença em campo fora do snapshot leve (dataNascimento) mantém o download', () => {
    const local = cadastroLocal('rdg-dn');
    const remote = { ...remoteComMetadadosNovos(local), dataNascimento: '11/11/1991' } as SyncRecord;
    expect(fullBusinessContentEqualForDownload('cadastros', local, remote)).toBe(false);
  });

  it('presença divergente (ativo × excluído) nunca é redundante', () => {
    const local = cadastroLocal('rdg-del');
    const remote = { ...remoteComMetadadosNovos(local), deleted: true } as SyncRecord;
    expect(fullBusinessContentEqualForDownload('cadastros', local, remote)).toBe(false);
  });

  it('rubricas remotas iguais ou ausentes casam com o local; diferentes não', () => {
    const local = cadastroLocal('rdg-rub', { rubricaCorridaSvg: 'svg-A' });
    expect(cadastroRubricasMatchLocal(local, undefined)).toBe(true);
    expect(cadastroRubricasMatchLocal(local, { rubricaCorridaSvg: 'svg-A' })).toBe(true);
    expect(cadastroRubricasMatchLocal(local, { rubricaCorridaSvg: 'svg-B' })).toBe(false);
  });

  it('rubricas de sessão: remota divergente para o mesmo nip:prova mantém o download', () => {
    const sessao = {
      id: 's1',
      criadoEm: '',
      dataAplicacao: '01/01/2026',
      tipoProva: 'corrida' as const,
      resultados: [
        { corredor: 1, nip: '111', nome: 'A', tempoMs: 1, prova: 'corrida' as const, rubricaCandidatoSvg: 'svg-A' },
      ],
    };
    expect(sessaoRubricasMatchLocal(sessao, undefined)).toBe(true);
    expect(
      sessaoRubricasMatchLocal(sessao, {
        resultados: [{ nip: '111', prova: 'corrida', rubricaCandidatoSvg: 'svg-A' }],
      }),
    ).toBe(true);
    expect(
      sessaoRubricasMatchLocal(sessao, {
        resultados: [{ nip: '111', prova: 'corrida', rubricaCandidatoSvg: 'svg-B' }],
      }),
    ).toBe(false);
  });

  it('download redundante é removido do plano e os metadados locais são alinhados', async () => {
    const local = cadastroLocal('rdg-align');
    await putCadastroRecord(local);
    const remote = remoteComMetadadosNovos(local);

    const { remaining, aligned } = await alignRedundantDownloads(
      OWNER,
      [{ collection: 'cadastros' as const, id: local.id, action: 'download', local, remote }],
      noRubrics,
    );

    expect(aligned).toBe(1);
    expect(remaining).toHaveLength(0);

    const after = (await getCadastroRaw(local.id)) as CadastroRecord;
    expect(after.nome).toBe(local.nome);
    expect(readUpdatedAt(after)).toBe(readUpdatedAt(remote));
    expect(readSyncVersion(after)).toBe(readSyncVersion(remote));
    expect(after.syncStatus).toBe('synced');
    // Próxima comparação LWW resulta em skip — não baixa de novo.
    expect(decideLastWriteWins(after, remote).action).toBe('skip');
  });

  it('conteúdo diferente permanece no plano de download', async () => {
    const local = cadastroLocal('rdg-keep');
    await putCadastroRecord(local);
    const remote = { ...remoteComMetadadosNovos(local), nome: 'Nome Novo Remoto' } as SyncRecord;

    const { remaining, aligned } = await alignRedundantDownloads(
      OWNER,
      [{ collection: 'cadastros' as const, id: local.id, action: 'download', local, remote }],
      noRubrics,
    );

    expect(aligned).toBe(0);
    expect(remaining).toHaveLength(1);
    const after = (await getCadastroRaw(local.id)) as CadastroRecord;
    expect(readUpdatedAt(after)).toBe(1_000);
  });

  it('rubrica remota diferente mantém o download mesmo com conteúdo leve igual', async () => {
    const local = cadastroLocal('rdg-rubdl', { rubricaCorridaSvg: 'svg-local' });
    await putCadastroRecord(local);
    const remote = remoteComMetadadosNovos(local);

    const { remaining, aligned } = await alignRedundantDownloads(
      OWNER,
      [{ collection: 'cadastros' as const, id: local.id, action: 'download', local, remote }],
      {
        fetchCadastroRubricas: async () => new Map([[local.id, { rubricaCorridaSvg: 'svg-remoto' }]]),
        fetchSessaoRubricas: async () => new Map(),
      },
    );

    expect(aligned).toBe(0);
    expect(remaining).toHaveLength(1);
  });

  it('falha ao buscar rubricas mantém todos os downloads (conservador)', async () => {
    const local = cadastroLocal('rdg-fail');
    await putCadastroRecord(local);
    const remote = remoteComMetadadosNovos(local);

    const { remaining, aligned } = await alignRedundantDownloads(
      OWNER,
      [{ collection: 'cadastros' as const, id: local.id, action: 'download', local, remote }],
      {
        fetchCadastroRubricas: async () => {
          throw new Error('offline');
        },
        fetchSessaoRubricas: async () => new Map(),
      },
    );

    expect(aligned).toBe(0);
    expect(remaining).toHaveLength(1);
  });

  it('registro somente remoto (sem local) continua sendo download legítimo', async () => {
    const remote = remoteComMetadadosNovos(cadastroLocal('rdg-new'));
    const { remaining, aligned } = await alignRedundantDownloads(
      OWNER,
      [{ collection: 'cadastros' as const, id: 'rdg-new', action: 'download', remote }],
      noRubrics,
    );
    expect(aligned).toBe(0);
    expect(remaining).toHaveLength(1);
  });
});
