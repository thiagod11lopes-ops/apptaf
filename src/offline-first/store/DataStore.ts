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
  listSessoesForSync,
  resolveOwnerUid,
  saveCadastro,
  saveAplicador,
  updateAplicadorSenhaHash,
  updateAplicadorRubricaSvgIfEmpty,
  replaceAplicadorRubricaSvg,
  clearAplicadorRubricaSvg,
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
import { getTafDatabase } from '../db/tafDatabase';
import {
  isDemoAplicadorId,
  isDemoCadastroId,
  isDemoSessaoId,
} from '../../utils/gatherSystemBackupData';

export class DataStore {
  async getCadastros(
    ownerUid: string | null,
    opts?: { includeDemo?: boolean },
  ): Promise<CadastroItemPersist[]> {
    const rows = await listCadastrosForDisplay(ownerUid);
    const list = filterRowsForDisplay(rows).map(stripMeta);
    if (opts?.includeDemo) return list;
    return list.filter((c) => !isDemoCadastroId(c.id));
  }

  async getAplicadores(
    ownerUid: string | null,
    opts?: { includeDemo?: boolean },
  ): Promise<AplicadorItemPersist[]> {
    const rows = await listAplicadoresForDisplay(ownerUid);
    const list = filterRowsForDisplay(rows)
      .map(stripMeta)
      .map((item) => sanitizeAplicadorForDisplay(item));
    if (opts?.includeDemo) return list;
    return list.filter((a) => !isDemoAplicadorId(a.id));
  }

  async getSessoes(
    ownerUid: string | null,
    opts?: { includeDemo?: boolean },
  ): Promise<SessaoAplicacaoTaf[]> {
    const rows = await listSessoesForDisplay(ownerUid);
    const list = filterRowsForDisplay(rows).map(stripMeta);
    if (opts?.includeDemo) return list;
    return list.filter((s) => !isDemoSessaoId(s.id));
  }

  /** Soft-deletes locais (ainda no Dexie) — bloqueiam recriação de sessões virtuais. */
  async getDeletedSessoes(ownerUid: string | null): Promise<SessaoAplicacaoTaf[]> {
    const db = getTafDatabase();
    if (db) {
      // Todos os owners do aparelho — evita falhar o Histórico se a sessão mudou de UID.
      const rows = await db.sessoes.filter((r) => r.deleted === true).toArray();
      return rows.map(stripMeta);
    }
    const rows = await listSessoesForSync(resolveOwnerUid(ownerUid), true);
    return rows.filter((r) => r.deleted === true).map(stripMeta);
  }

  async getResumo(ownerUid: string | null): Promise<ResumoInicioTafHistorico> {
    const { getNipsRestritosAtivos } = await import('../../services/restritosStorage');
    const [cadastros, sessoes, nipsRestritos] = await Promise.all([
      this.getCadastros(ownerUid),
      this.getSessoes(ownerUid),
      getNipsRestritosAtivos(),
    ]);
    return calcularResumoInicioTafFromHistorico(sessoes, cadastros, [], nipsRestritos);
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

  async updateAplicadorSenha(
    id: string,
    senhaHash: string,
    ownerUid: string | null,
    senhaPlano?: string,
  ): Promise<boolean> {
    const record = await updateAplicadorSenhaHash(
      id,
      senhaHash,
      resolveOwnerUid(ownerUid),
      getCachedLoginUid(),
      senhaPlano,
    );
    notifyDataChanged();
    return record != null;
  }

  async saveAplicadorRubricaIfEmpty(
    id: string,
    rubricaSvg: string,
    ownerUid: string | null,
  ): Promise<boolean> {
    const record = await updateAplicadorRubricaSvgIfEmpty(
      id,
      rubricaSvg,
      resolveOwnerUid(ownerUid),
      getCachedLoginUid(),
    );
    if (record) notifyDataChanged();
    return record != null;
  }

  async replaceAplicadorRubrica(
    id: string,
    rubricaSvg: string,
    ownerUid: string | null,
  ): Promise<boolean> {
    const record = await replaceAplicadorRubricaSvg(
      id,
      rubricaSvg,
      resolveOwnerUid(ownerUid),
      getCachedLoginUid(),
    );
    if (record) notifyDataChanged();
    return record != null;
  }

  async clearAplicadorRubrica(id: string, ownerUid: string | null): Promise<boolean> {
    const record = await clearAplicadorRubricaSvg(
      id,
      resolveOwnerUid(ownerUid),
      getCachedLoginUid(),
    );
    if (record) notifyDataChanged();
    return record != null;
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
