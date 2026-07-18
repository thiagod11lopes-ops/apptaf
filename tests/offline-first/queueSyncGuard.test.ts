import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeTafDatabaseForTests } from '../../src/offline-first/db/tafDatabase';
import {
  ANONYMOUS_OWNER,
  getCadastroRaw,
  putCadastroRecord,
  saveCadastro,
} from '../../src/offline-first/db/localDb';
import { syncQueue } from '../../src/offline-first/sync/SyncQueue';
import { markRecordSynced, readSyncVersion } from '../../src/offline-first/sync/recordMeta';
import {
  canConfirmSyncedVersion,
  isQueuePayloadStillCurrent,
} from '../../src/offline-first/sync/queueSyncGuard';
import { setAuthUidState } from '../../src/services/firebase/authUid';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';
import type { CadastroRecord } from '../../src/offline-first/types';

let nipSeq = 10;

function sampleCadastro(id = 'cad-guard-1', nip?: string): CadastroItemPersist {
  return {
    id,
    // NIP único por registro — saveCadastro deduplica por NIP no mesmo banco.
    nip: nip ?? `123456${(nipSeq++).toString().padStart(2, '0')}`,
    nome: 'Soldado Guarda',
    dataNascimento: '01/01/1995',
    categoria: 'Praças',
  };
}

describe('queueSyncGuard — confirmação de sync só com a mesma versão enviada', () => {
  beforeEach(() => {
    setAuthUidState(null, null, true);
  });

  afterAll(async () => {
    // Aguarda promises internas do Dexie antes de fechar (evita DatabaseClosedError).
    await new Promise((resolve) => setTimeout(resolve, 0));
    await closeTafDatabaseForTests();
  });

  it('TESTE 1 — edição durante upload: versão antiga não é confirmada e a nova permanece pendente', async () => {
    const base = sampleCadastro('cad-guard-1');
    await saveCadastro(base, ANONYMOUS_OWNER, null);
    const sentPayload = (await getCadastroRaw('cad-guard-1')) as CadastroRecord;
    const sentVersion = readSyncVersion(sentPayload);

    // Usuário edita enquanto o upload da versão antiga está em andamento
    await saveCadastro({ ...base, nome: 'Nome Editado Durante Upload' }, ANONYMOUS_OWNER, null);
    const current = (await getCadastroRaw('cad-guard-1')) as CadastroRecord;
    expect(readSyncVersion(current)).toBe(sentVersion + 1);

    // Guarda bloqueia a confirmação com o payload antigo
    expect(await isQueuePayloadStillCurrent('cadastros', 'cad-guard-1', sentPayload)).toBe(false);

    // Registro continua pendente e a nova edição continua na fila
    const after = (await getCadastroRaw('cad-guard-1')) as CadastroRecord;
    expect(after.syncStatus).not.toBe('synced');
    expect(after.nome).toBe('Nome Editado Durante Upload');
    expect(await syncQueue.countPending(ANONYMOUS_OWNER)).toBeGreaterThan(0);
  });

  it('TESTE 2 — upload normal sem edição concorrente: confirmação permitida e registro fica synced', async () => {
    await saveCadastro(sampleCadastro('cad-guard-2'), ANONYMOUS_OWNER, null);
    const sentPayload = (await getCadastroRaw('cad-guard-2')) as CadastroRecord;

    expect(await isQueuePayloadStillCurrent('cadastros', 'cad-guard-2', sentPayload)).toBe(true);

    await putCadastroRecord(markRecordSynced({ ...sentPayload }, null));
    const after = (await getCadastroRaw('cad-guard-2')) as CadastroRecord;
    expect(after.syncStatus).toBe('synced');
    expect(readSyncVersion(after)).toBe(readSyncVersion(sentPayload));
  });

  it('TESTE 3 — retry após falha: registro íntegro e confirmação continua válida', async () => {
    await saveCadastro(sampleCadastro('cad-guard-3'), ANONYMOUS_OWNER, null);
    const sentPayload = (await getCadastroRaw('cad-guard-3')) as CadastroRecord;

    // 1ª tentativa falhou (nada foi confirmado); registro local permanece intacto
    const afterFailure = (await getCadastroRaw('cad-guard-3')) as CadastroRecord;
    expect(afterFailure.nome).toBe('Soldado Guarda');
    expect(afterFailure.syncStatus).not.toBe('synced');

    // Retry com o mesmo payload: guarda continua permitindo
    expect(await isQueuePayloadStillCurrent('cadastros', 'cad-guard-3', sentPayload)).toBe(true);
    await putCadastroRecord(markRecordSynced({ ...sentPayload }, null));
    const after = (await getCadastroRaw('cad-guard-3')) as CadastroRecord;
    expect(after.syncStatus).toBe('synced');
  });

  it('TESTE 4 — duplo processamento do mesmo item: idempotente, sem perda de dados', async () => {
    await saveCadastro(sampleCadastro('cad-guard-4'), ANONYMOUS_OWNER, null);
    const sentPayload = (await getCadastroRaw('cad-guard-4')) as CadastroRecord;

    // Processamento 1
    expect(await isQueuePayloadStillCurrent('cadastros', 'cad-guard-4', sentPayload)).toBe(true);
    await putCadastroRecord(markRecordSynced({ ...sentPayload }, null));

    // Processamento 2 (resposta duplicada / upload repetido)
    expect(await isQueuePayloadStillCurrent('cadastros', 'cad-guard-4', sentPayload)).toBe(true);
    await putCadastroRecord(markRecordSynced({ ...sentPayload }, null));

    const after = (await getCadastroRaw('cad-guard-4')) as CadastroRecord;
    expect(after.syncStatus).toBe('synced');
    expect(after.nome).toBe('Soldado Guarda');
    expect(readSyncVersion(after)).toBe(readSyncVersion(sentPayload));
  });

  it('registro inexistente localmente não é confirmado (evita ressurreição)', async () => {
    const fantasma = { id: 'cad-nao-existe', syncVersion: 3 } as unknown as CadastroRecord;
    expect(await isQueuePayloadStillCurrent('cadastros', 'cad-nao-existe', fantasma)).toBe(false);
  });

  it('canConfirmSyncedVersion — decisão pura por versão', () => {
    expect(canConfirmSyncedVersion({ syncVersion: 10 }, { syncVersion: 10 })).toBe(true);
    expect(canConfirmSyncedVersion({ syncVersion: 11 }, { syncVersion: 10 })).toBe(false);
    expect(canConfirmSyncedVersion({ syncVersion: 10 }, { syncVersion: 11 })).toBe(false);
    expect(canConfirmSyncedVersion(null, { syncVersion: 10 })).toBe(false);
    expect(canConfirmSyncedVersion({ syncVersion: 10 }, null)).toBe(false);
    // fallback para `version` quando syncVersion ausente
    expect(canConfirmSyncedVersion({ version: 5 }, { version: 5 })).toBe(true);
    expect(canConfirmSyncedVersion({ version: 6 }, { version: 5 })).toBe(false);
  });

  it('nova edição enfileirada durante processamento não é apagada pela compactação', async () => {
    const base = sampleCadastro('cad-guard-5');
    await saveCadastro(base, ANONYMOUS_OWNER, null);
    const pendingBefore = await syncQueue.listPending(ANONYMOUS_OWNER);
    const oldEntry = pendingBefore.find((p) => p.documentId === 'cad-guard-5');
    expect(oldEntry).toBeDefined();

    // Operação antiga entra em processamento (sai de "pending")
    await syncQueue.markProcessing(oldEntry!.operationId);

    // Edição concorrente enfileira nova operação; compactação só remove "pending"
    await saveCadastro({ ...base, nome: 'Editado' }, ANONYMOUS_OWNER, null);

    const pendingAfter = await syncQueue.listPending(ANONYMOUS_OWNER);
    const newEntry = pendingAfter.find((p) => p.documentId === 'cad-guard-5');
    expect(newEntry).toBeDefined();
    expect(newEntry!.operationId).not.toBe(oldEntry!.operationId);
    expect((JSON.parse(newEntry!.payload) as { nome?: string }).nome).toBe('Editado');
  });
});
