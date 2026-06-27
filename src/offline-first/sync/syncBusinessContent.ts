import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../../services/resultadosAplicadosIndexedDb';
import type { CollectionName } from '../types';
import type { SyncRecord } from './lastWriteWins';
import { toCadastroLight } from '../../utils/cadastroLight';
import { toSessaoLight } from '../../utils/sessaoLight';

function normalizeOptional(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

/** Campos de resultado TAF no cadastro (sem rubricas SVG — vêm de subcoleção). */
export function cadastroBusinessSnapshot(item: CadastroItemPersist): Record<string, string | undefined> {
  const legado = item as CadastroItemPersist & { tempo?: string };
  return {
    nip: normalizeOptional(item.nip),
    nome: normalizeOptional(item.nome),
    tempoCorrida: normalizeOptional(item.tempoCorrida ?? legado.tempo),
    notaCorrida: normalizeOptional(item.notaCorrida),
    dataTafCorrida: normalizeOptional(item.dataTafCorrida),
    tempoNatacao: normalizeOptional(item.tempoNatacao),
    notaNatacao: normalizeOptional(item.notaNatacao),
    resultadoNatacao: item.resultadoNatacao,
    dataTafNatacao: normalizeOptional(item.dataTafNatacao),
    tempoPermanencia: normalizeOptional(item.tempoPermanencia),
    resultadoPermanencia: item.resultadoPermanencia,
    dataTafPermanencia: normalizeOptional(item.dataTafPermanencia),
  };
}

export function cadastroBusinessContentEqual(a: CadastroItemPersist, b: CadastroItemPersist): boolean {
  return (
    JSON.stringify(cadastroBusinessSnapshot(a)) === JSON.stringify(cadastroBusinessSnapshot(b))
  );
}

function sessaoResultadosSnapshot(sessao: SessaoAplicacaoTaf): string {
  const normalized = toSessaoLight(sessao);
  const rows = [...normalized.resultados]
    .map((r) => ({
      nip: normalizeOptional(r.nip),
      nome: normalizeOptional(r.nome),
      tempoMs: r.tempoMs ?? 0,
      notaTexto: normalizeOptional(r.notaTexto),
      prova: r.prova ?? normalized.tipoProva,
    }))
    .sort((a, b) => `${a.nip}:${a.nome}`.localeCompare(`${b.nip}:${b.nome}`));
  return JSON.stringify({
    tipoProva: normalized.tipoProva,
    dataAplicacao: normalizeOptional(normalized.dataAplicacao),
    resultados: rows,
  });
}

export function sessaoBusinessContentEqual(a: SessaoAplicacaoTaf, b: SessaoAplicacaoTaf): boolean {
  return sessaoResultadosSnapshot(a) === sessaoResultadosSnapshot(b);
}

export function syncBusinessContentEqual(
  collection: CollectionName,
  local: SyncRecord,
  remote: SyncRecord,
): boolean {
  if (local.deleted === true || remote.deleted === true) {
    return local.deleted === remote.deleted;
  }
  if (collection === 'cadastros') {
    return cadastroBusinessContentEqual(
      toCadastroLight(local as CadastroItemPersist),
      toCadastroLight(remote as CadastroItemPersist),
    );
  }
  if (collection === 'sessoes') {
    return sessaoBusinessContentEqual(
      local as SessaoAplicacaoTaf,
      remote as SessaoAplicacaoTaf,
    );
  }
  return JSON.stringify(local) === JSON.stringify(remote);
}

/** Quando metadados LWW empatam mas o conteúdo difere (ex.: merge local antigo). */
export function resolveContentDriftAction(
  local: SyncRecord,
  remote: SyncRecord,
): 'download' | 'upload' {
  const localAt = local.updatedAt ?? 0;
  const remoteAt = remote.updatedAt ?? 0;
  if (remoteAt > localAt) return 'download';
  if (localAt > remoteAt) return 'upload';
  const localSv = local.syncVersion ?? local.version ?? 0;
  const remoteSv = remote.syncVersion ?? remote.version ?? 0;
  if (remoteSv > localSv) return 'download';
  if (localSv > remoteSv) return 'upload';
  return 'download';
}

export function countBusinessContentDrift(
  collection: CollectionName,
  localRows: SyncRecord[],
  remoteRows: Array<{ id: string }>,
  toRecord: (remote: { id: string }, ownerUid: string) => SyncRecord,
  ownerUid: string,
): { extraDownloads: number; extraUploads: number } {
  let extraDownloads = 0;
  let extraUploads = 0;
  const allIds = new Set([...localRows.map((r) => r.id), ...remoteRows.map((r) => r.id)]);

  for (const id of allIds) {
    const local = localRows.find((r) => r.id === id);
    const remoteRaw = remoteRows.find((r) => r.id === id);
    if (!local || !remoteRaw) continue;
    const remote = toRecord(remoteRaw, ownerUid);
    if (local.deleted === true || remote.deleted === true) continue;
    if (syncBusinessContentEqual(collection, local, remote)) continue;
    if (resolveContentDriftAction(local, remote) === 'download') {
      extraDownloads += 1;
    } else {
      extraUploads += 1;
    }
  }

  return { extraDownloads, extraUploads };
}
