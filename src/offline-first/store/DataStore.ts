import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { AplicadorItemPersist } from '../../services/aplicadoresIndexedDb';
import type { SessaoAplicacaoTaf } from '../../services/resultadosAplicadosIndexedDb';
import { calcularResumoInicioTafFromHistorico } from '../../utils/resultadoGeralHistorico';
import type { ResumoInicioTafHistorico } from '../../utils/resultadoGeralHistorico';
import {
  listCadastros,
  listCadastrosForDisplay,
  listAplicadores,
  listAplicadoresForDisplay,
  listSessoes,
  listSessoesForDisplay,
  resolveOwnerUid,
  saveCadastro,
  saveAplicador,
  saveCadastrosBatch,
  saveSessao,
  softDeleteCadastro,
  softDeleteAplicador,
  softDeleteSessao,
  getCadastroById,
  getSessaoById,
} from '../db/localDb';
import { getCachedLoginUid } from '../../services/firebase/authUid';
import { notifyDataChanged, subscribeDataChanged } from '../sync/SyncEngine';
import { syncQueue } from '../sync/SyncQueue';
import { sanitizeAplicadorForDisplay } from '../../utils/aplicadorSyncPolicy';

export class DataStore {
  async getCadastros(ownerUid: string | null): Promise<CadastroItemPersist[]> {
    const rows = await listCadastrosForDisplay(ownerUid);
    return filterRowsForDisplay(rows).map(stripMeta);
  }

  async getAplicadores(ownerUid: string | null): Promise<AplicadorItemPersist[]> {
    const rows = await listAplicadoresForDisplay(ownerUid);
    return filterRowsForDisplay(rows)
      .map(stripMeta)
      .map((item) => sanitizeAplicadorForDisplay(item));
  }

  async getSessoes(ownerUid: string | null): Promise<SessaoAplicacaoTaf[]> {
    const rows = await listSessoesForDisplay(ownerUid);
    return filterRowsForDisplay(rows).map(stripMeta);
  }

  async getResumo(ownerUid: string | null): Promise<ResumoInicioTafHistorico> {
    const [cadastros, sessoes] = await Promise.all([
      this.getCadastros(ownerUid),
      this.getSessoes(ownerUid),
    ]);
    return calcularResumoInicioTafFromHistorico(sessoes, cadastros);
  }

  async upsertCadastro(item: CadastroItemPersist, ownerUid: string | null): Promise<void> {
    await saveCadastro(item, resolveOwnerUid(ownerUid), getCachedLoginUid());
    notifyDataChanged();
  }

  async upsertAplicador(item: AplicadorItemPersist, ownerUid: string | null): Promise<void> {
    await saveAplicador(item, resolveOwnerUid(ownerUid), getCachedLoginUid());
    notifyDataChanged();
  }

  async upsertCadastrosBatch(items: CadastroItemPersist[], ownerUid: string | null): Promise<void> {
    await saveCadastrosBatch(items, resolveOwnerUid(ownerUid), getCachedLoginUid());
    notifyDataChanged();
  }

  async deleteCadastro(id: string, ownerUid: string | null): Promise<void> {
    await softDeleteCadastro(id, resolveOwnerUid(ownerUid), getCachedLoginUid());
    notifyDataChanged();
  }

  async deleteAplicador(id: string, ownerUid: string | null): Promise<void> {
    await softDeleteAplicador(id, resolveOwnerUid(ownerUid), getCachedLoginUid());
    notifyDataChanged();
  }

  async upsertSessao(sessao: SessaoAplicacaoTaf, ownerUid: string | null): Promise<void> {
    await saveSessao(sessao, resolveOwnerUid(ownerUid), getCachedLoginUid());
    notifyDataChanged();
  }

  async deleteSessao(id: string, ownerUid: string | null): Promise<void> {
    await softDeleteSessao(id, resolveOwnerUid(ownerUid), getCachedLoginUid());
    notifyDataChanged();
  }

  async getSessaoById(id: string, ownerUid: string | null): Promise<SessaoAplicacaoTaf | null> {
    const row = await getSessaoById(resolveOwnerUid(ownerUid), id);
    if (!row || row.deleted) return null;
    return stripMeta(row);
  }

  async getCadastroById(id: string, ownerUid: string | null): Promise<CadastroItemPersist | null> {
    const row = await getCadastroById(resolveOwnerUid(ownerUid), id);
    if (!row || row.deleted) return null;
    return stripMeta(row);
  }

  async pendingCount(ownerUid: string | null): Promise<number> {
    return syncQueue.countPending(resolveOwnerUid(ownerUid));
  }

  subscribe(listener: () => void): () => void {
    return subscribeDataChanged(listener);
  }
}

function filterRowsForDisplay<T extends { syncStatus?: string; deleted?: boolean }>(rows: T[]): T[] {
  return rows.filter((row) => row.deleted !== true);
}

function stripMeta<T extends CadastroItemPersist | AplicadorItemPersist | SessaoAplicacaoTaf>(
  row: T & Record<string, unknown>,
): T {
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
