import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../../services/resultadosAplicadosIndexedDb';
import { calcularResumoInicioTafFromHistorico } from '../../utils/resultadoGeralHistorico';
import type { ResumoInicioTafHistorico } from '../../utils/resultadoGeralHistorico';
import {
  listCadastros,
  listSessoes,
  resolveOwnerUid,
  saveCadastro,
  saveCadastrosBatch,
  saveSessao,
  softDeleteCadastro,
  softDeleteSessao,
  getCadastroById,
  getSessaoById,
} from '../db/localDb';
import { getCachedLoginUid } from '../../services/firebase/authUid';
import { syncEngine, subscribeDataChanged, notifyDataChanged } from '../sync/SyncEngine';
import { syncQueue } from '../sync/SyncQueue';

export class DataStore {
  async getCadastros(ownerUid: string | null): Promise<CadastroItemPersist[]> {
    const rows = await listCadastros(resolveOwnerUid(ownerUid));
    return rows.map(stripMeta);
  }

  async getSessoes(ownerUid: string | null): Promise<SessaoAplicacaoTaf[]> {
    const rows = await listSessoes(resolveOwnerUid(ownerUid));
    return rows.map(stripMeta);
  }

  async getResumo(ownerUid: string | null): Promise<ResumoInicioTafHistorico> {
    const [cadastros, sessoes] = await Promise.all([
      this.getCadastros(ownerUid),
      this.getSessoes(ownerUid),
    ]);
    return calcularResumoInicioTafFromHistorico(sessoes, cadastros);
  }

  async upsertCadastro(item: CadastroItemPersist, ownerUid: string): Promise<void> {
    await saveCadastro(item, resolveOwnerUid(ownerUid), getCachedLoginUid());
    notifyDataChanged();
    void syncEngine.scheduleProcess(true);
  }

  async upsertCadastrosBatch(items: CadastroItemPersist[], ownerUid: string): Promise<void> {
    await saveCadastrosBatch(items, resolveOwnerUid(ownerUid), getCachedLoginUid());
    notifyDataChanged();
    void syncEngine.scheduleProcess(true);
  }

  async deleteCadastro(id: string, ownerUid: string): Promise<void> {
    await softDeleteCadastro(id, resolveOwnerUid(ownerUid), getCachedLoginUid());
    notifyDataChanged();
    void syncEngine.scheduleProcess(true);
  }

  async upsertSessao(sessao: SessaoAplicacaoTaf, ownerUid: string): Promise<void> {
    await saveSessao(sessao, resolveOwnerUid(ownerUid), getCachedLoginUid());
    notifyDataChanged();
    void syncEngine.scheduleProcess(true);
  }

  async deleteSessao(id: string, ownerUid: string): Promise<void> {
    await softDeleteSessao(id, resolveOwnerUid(ownerUid), getCachedLoginUid());
    notifyDataChanged();
    void syncEngine.scheduleProcess(true);
  }

  async getSessaoById(id: string, ownerUid: string): Promise<SessaoAplicacaoTaf | null> {
    const row = await getSessaoById(resolveOwnerUid(ownerUid), id);
    return row ? stripMeta(row) : null;
  }

  async getCadastroById(id: string, ownerUid: string): Promise<CadastroItemPersist | null> {
    const row = await getCadastroById(resolveOwnerUid(ownerUid), id);
    return row ? stripMeta(row) : null;
  }

  async pendingCount(ownerUid: string): Promise<number> {
    return syncQueue.countPending(resolveOwnerUid(ownerUid));
  }

  subscribe(listener: () => void): () => void {
    return subscribeDataChanged(listener);
  }
}

function stripMeta<T extends CadastroItemPersist | SessaoAplicacaoTaf>(row: T & Record<string, unknown>): T {
  const copy = { ...row } as Record<string, unknown>;
  for (const key of [
    'ownerUid',
    'createdAt',
    'version',
    'deviceId',
    'userId',
    'syncStatus',
    'deleted',
    'deletedAt',
    'deletedBy',
    'lastModifiedBy',
  ]) {
    delete copy[key];
  }
  return copy as T;
}

export const dataStore = new DataStore();
