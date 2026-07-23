import type { CadastroItemPersist } from '../cadastrosIndexedDb';
import type { AplicadorItemPersist } from '../aplicadoresIndexedDb';
import type { SessaoAplicacaoTaf } from '../resultadosAplicadosIndexedDb';
import type { ResultadoCorridaItem } from '../../navigation/types';
import { nipChaveCadastro, nipDigitos } from '../../utils/nipFormat';
import { getRecordUpdatedAt, getSessaoSortTime } from './recordTimestamps';

function resultadoKey(r: ResultadoCorridaItem): string {
  const nip = nipDigitos(r.nip);
  if (nip) return `nip:${nip}`;
  return `nome:${String(r.nome || '').trim().toLowerCase()}`;
}

function mergeResultados(
  a: ResultadoCorridaItem[],
  b: ResultadoCorridaItem[],
  tsA: number,
  tsB: number,
): ResultadoCorridaItem[] {
  const map = new Map<string, { r: ResultadoCorridaItem; ts: number }>();

  for (const r of b) {
    map.set(resultadoKey(r), { r, ts: tsB });
  }
  for (const r of a) {
    const key = resultadoKey(r);
    const prev = map.get(key);
    if (!prev || tsA >= prev.ts) {
      map.set(key, { r, ts: Math.max(tsA, prev?.ts ?? 0) });
    }
  }

  return [...map.values()].map((v) => v.r);
}

export function mergeCadastroPair(
  local: CadastroItemPersist,
  remote: CadastroItemPersist,
): CadastroItemPersist {
  const localTs = getRecordUpdatedAt(local);
  const remoteTs = getRecordUpdatedAt(remote);
  return localTs >= remoteTs ? local : remote;
}

export function mergeCadastros(
  local: CadastroItemPersist[],
  remote: CadastroItemPersist[],
  tombstones: Record<string, number> = {},
): CadastroItemPersist[] {
  const byId = new Map<string, CadastroItemPersist>();

  for (const item of remote) {
    const deletedAt = tombstones[item.id];
    if (deletedAt && deletedAt >= getRecordUpdatedAt(item)) continue;
    byId.set(item.id, item);
  }

  for (const item of local) {
    const deletedAt = tombstones[item.id];
    const localTs = getRecordUpdatedAt(item);
    if (deletedAt && deletedAt >= localTs) {
      byId.delete(item.id);
      continue;
    }
    const remoteItem = byId.get(item.id);
    if (!remoteItem) {
      byId.set(item.id, item);
      continue;
    }
    byId.set(item.id, mergeCadastroPair(item, remoteItem));
  }

  return [...byId.values()];
}

export function mergeSessaoPair(
  local: SessaoAplicacaoTaf,
  remote: SessaoAplicacaoTaf,
): SessaoAplicacaoTaf {
  const localTs = getRecordUpdatedAt(local);
  const remoteTs = getRecordUpdatedAt(remote);
  const winnerTs = Math.max(localTs, remoteTs);

  return {
    ...(localTs >= remoteTs ? local : remote),
    resultados: mergeResultados(local.resultados, remote.resultados, localTs, remoteTs),
    updatedAt: winnerTs,
  };
}

export function mergeSessoes(
  local: SessaoAplicacaoTaf[],
  remote: SessaoAplicacaoTaf[],
  tombstones: Record<string, number> = {},
): SessaoAplicacaoTaf[] {
  const byId = new Map<string, SessaoAplicacaoTaf>();

  for (const item of remote) {
    const deletedAt = tombstones[item.id];
    if (deletedAt && deletedAt >= getRecordUpdatedAt(item)) continue;
    byId.set(item.id, item);
  }

  for (const item of local) {
    const deletedAt = tombstones[item.id];
    const localTs = getRecordUpdatedAt(item);
    if (deletedAt && deletedAt >= localTs) {
      byId.delete(item.id);
      continue;
    }
    const remoteItem = byId.get(item.id);
    if (!remoteItem) {
      byId.set(item.id, item);
      continue;
    }
    byId.set(item.id, mergeSessaoPair(item, remoteItem));
  }

  const list = [...byId.values()];
  list.sort((a, b) => getSessaoSortTime(b) - getSessaoSortTime(a));
  return list;
}

export function dedupeCadastrosByNipNewest(items: CadastroItemPersist[]): CadastroItemPersist[] {
  const porNip = new Map<string, CadastroItemPersist>();
  const semNip: CadastroItemPersist[] = [];

  for (const item of items) {
    const key = nipChaveCadastro(item.nip);
    if (!key) {
      semNip.push(item);
      continue;
    }
    const atual = porNip.get(key);
    if (!atual || getRecordUpdatedAt(item) >= getRecordUpdatedAt(atual)) {
      porNip.set(key, item);
    }
  }

  return [...porNip.values(), ...semNip];
}

export function dedupeAplicadoresByNipNewest(
  items: AplicadorItemPersist[],
): AplicadorItemPersist[] {
  const porNip = new Map<string, AplicadorItemPersist>();
  const semNip: AplicadorItemPersist[] = [];

  for (const item of items) {
    const key = nipChaveCadastro(item.nip);
    if (!key) {
      semNip.push(item);
      continue;
    }
    const atual = porNip.get(key);
    if (!atual || getRecordUpdatedAt(item) >= getRecordUpdatedAt(atual)) {
      porNip.set(key, item);
    }
  }

  return [...porNip.values(), ...semNip];
}
