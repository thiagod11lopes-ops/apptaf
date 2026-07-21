/**
 * Contagem local × nuvem (dose 5) — detecta drift sem abrir o relatório completo.
 */
import { listCadastros, listSessoes, listAplicadores } from '../offline-first/db/localDb';
import { listOwnerDocMetadata } from './supabase/ownerDocs';
import { peekRemoteSnapshotCache } from '../offline-first/sync/remoteSnapshotCache';
import { getConnectivityState } from '../offline-first/sync/ConnectivityMonitor';

export type LocalCloudCountPair = {
  local: number;
  /** null = offline / ainda não consultou a nuvem. */
  remote: number | null;
};

export type LocalCloudCountsSnapshot = {
  cadastros: LocalCloudCountPair;
  sessoes: LocalCloudCountPair;
  aplicadores: LocalCloudCountPair;
  fetchedAt: number;
};

export type LocalCloudAlignment = 'aligned' | 'ahead' | 'behind' | 'unknown';

export function formatLocalCloudRatio(local: number, remote: number | null): string {
  const l = local.toLocaleString('pt-BR');
  if (remote == null) return `${l} / —`;
  return `${l} / ${remote.toLocaleString('pt-BR')}`;
}

export function localCloudAlignment(
  local: number,
  remote: number | null,
): LocalCloudAlignment {
  if (remote == null) return 'unknown';
  if (local === remote) return 'aligned';
  if (local > remote) return 'ahead';
  return 'behind';
}

export function localCloudAlignmentLabel(alignment: LocalCloudAlignment): string {
  switch (alignment) {
    case 'aligned':
      return 'igual à nuvem';
    case 'ahead':
      return 'aparelho à frente';
    case 'behind':
      return 'aparelho atrás';
    default:
      return 'nuvem não consultada';
  }
}

async function countActiveRemote(table: string, ownerUid: string): Promise<number> {
  const rows = await listOwnerDocMetadata(table, ownerUid);
  return rows.filter((r) => r.deleted !== true).length;
}

/**
 * Conta ativos locais e, se online, ativos na nuvem (metadados sem decrypt).
 * Usa snapshot em cache quando disponível para cadastros/sessões/aplicadores.
 */
export async function fetchLocalCloudCounts(ownerUid: string): Promise<LocalCloudCountsSnapshot> {
  const uid = ownerUid.trim();
  const [localCad, localSess, localApp] = await Promise.all([
    listCadastros(uid, false),
    listSessoes(uid, false),
    listAplicadores(uid, false),
  ]);

  const snapshot: LocalCloudCountsSnapshot = {
    cadastros: { local: localCad.length, remote: null },
    sessoes: { local: localSess.length, remote: null },
    aplicadores: { local: localApp.length, remote: null },
    fetchedAt: Date.now(),
  };

  if (!uid || getConnectivityState() !== 'ONLINE') {
    return snapshot;
  }

  const cached = peekRemoteSnapshotCache(uid);
  if (cached) {
    snapshot.cadastros.remote = cached.remoteCad.length;
    snapshot.sessoes.remote = cached.remoteSess.length;
    snapshot.aplicadores.remote = cached.remoteApp.length;
    return snapshot;
  }

  try {
    const [remoteCad, remoteSess, remoteApp] = await Promise.all([
      countActiveRemote('cadastros', uid),
      countActiveRemote('sessoes', uid),
      countActiveRemote('aplicadores', uid),
    ]);
    snapshot.cadastros.remote = remoteCad;
    snapshot.sessoes.remote = remoteSess;
    snapshot.aplicadores.remote = remoteApp;
  } catch {
    // Mantém remote null — UI mostra "—".
  }

  return snapshot;
}
