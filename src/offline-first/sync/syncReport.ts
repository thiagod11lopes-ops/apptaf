import {
  getAllCadastrosFirestoreLight,
} from './firebase/FirebaseGateway';
import {
  getAllAplicadoresFirestore,
} from './firebase/FirebaseGateway';
import {
  getAllSessoesFirestoreLight,
} from './firebase/FirebaseGateway';
import {
  listAplicadores,
  listCadastros,
  listSessoes,
} from '../db/localDb';
import type { CollectionName } from '../types';
import { getPendingSyncItems, type PendingSyncItem } from './pendingSyncItems';
import { getCachedLoginUid } from '../../services/firebase/authUid';
import { getDeviceId } from '../deviceId';
import { getLastSyncAudit } from './syncAudit';
import { getFirebaseAuth } from '../../config/firebase';
import { decideLastWriteWins } from './lastWriteWins';
import { ensureRecordMeta, readUpdatedAt } from './recordMeta';
import { remoteDocToSyncRecord, readRemoteDeleted } from './tombstone';

export type SyncReportItem = {
  collection: CollectionName;
  id: string;
  label: string;
};

export type SyncReport = {
  novos: SyncReportItem[];
  alterados: SyncReportItem[];
  excluidos: SyncReportItem[];
  baixarNovos: SyncReportItem[];
  baixarAlterados: SyncReportItem[];
  ignorados: SyncReportItem[];
  totalLocal: number;
  totalRemoto: number;
  totalPendentes: number;
  pendingSummary: Awaited<ReturnType<typeof getPendingSyncItems>>;
  meta: {
    deviceId: string;
    userEmail: string | null;
    userId: string | null;
    lastSyncAt: number | null;
    generatedAt: number;
    collectionCounts: {
      cadastros: { local: number; remote: number };
      sessoes: { local: number; remote: number };
      aplicadores: { local: number; remote: number };
    };
    clockDriftWarning: string | null;
  };
};

function labelFor(collection: CollectionName, record: Record<string, unknown>): string {
  if (collection === 'cadastros') {
    const nome = String(record.nome ?? '').trim();
    const nip = String(record.nip ?? '').trim();
    return nome || nip || String(record.id ?? '');
  }
  if (collection === 'aplicadores') {
    return String(record.nome ?? record.id ?? '');
  }
  return String(record.dataAplicacao ?? record.id ?? '');
}

function mapById<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

export async function buildSyncReport(
  ownerUid: string,
  clockDriftWarning: string | null = null,
): Promise<SyncReport> {
  const pendingSummary = await getPendingSyncItems(ownerUid);

  const [localCad, localSess, localApp, remoteCad, remoteSess, remoteApp] = await Promise.all([
    listCadastros(ownerUid, true),
    listSessoes(ownerUid, true),
    listAplicadores(ownerUid, true),
    getAllCadastrosFirestoreLight(ownerUid),
    getAllSessoesFirestoreLight(ownerUid),
    getAllAplicadoresFirestore(ownerUid),
  ]);

  const novos: SyncReportItem[] = [];
  const alterados: SyncReportItem[] = [];
  const excluidos: SyncReportItem[] = [];
  const baixarNovos: SyncReportItem[] = [];
  const baixarAlterados: SyncReportItem[] = [];
  const ignorados: SyncReportItem[] = [];

  const collections: Array<
    [CollectionName, typeof localCad, ReturnType<typeof mapById<(typeof remoteCad)[0]>>]
  > = [
    ['cadastros', localCad, mapById(remoteCad)],
    ['sessoes', localSess, mapById(remoteSess)],
    ['aplicadores', localApp, mapById(remoteApp)],
  ];

  for (const [collection, localRows, remoteMap] of collections) {
    const localMap = mapById(localRows);
    const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

    for (const id of allIds) {
      const local = localMap.get(id);
      const remoteRaw = remoteMap.get(id);
      const remote = remoteRaw
        ? remoteDocToSyncRecord(
            { ...remoteRaw, id } as Record<string, unknown> & { id: string },
            ownerUid,
          )
        : undefined;

      const item: SyncReportItem = {
        collection,
        id,
        label: labelFor(
          collection,
          (local ?? remoteRaw ?? { id }) as unknown as Record<string, unknown>,
        ),
      };

      const decision = decideLastWriteWins(local, remote);

      if (decision.action === 'skip') {
        ignorados.push(item);
        continue;
      }

      if (decision.action === 'upload') {
        if (local?.deleted) {
          excluidos.push(item);
        } else if (remoteRaw && readRemoteDeleted(remoteRaw)) {
          alterados.push(item);
        } else if (!remoteRaw) {
          novos.push(item);
        } else {
          alterados.push(item);
        }
        continue;
      }

      if (decision.action === 'download') {
        if (remoteRaw && readRemoteDeleted(remoteRaw)) {
          baixarAlterados.push(item);
        } else if (!local) {
          baixarNovos.push(item);
        } else {
          baixarAlterados.push(item);
        }
      }
    }
  }

  const totalRemoto =
    remoteCad.filter((r) => !readRemoteDeleted(r)).length +
    remoteSess.filter((r) => !readRemoteDeleted(r)).length +
    remoteApp.filter((r) => !readRemoteDeleted(r)).length;
  const totalLocal =
    localCad.filter((r) => !r.deleted).length +
    localSess.filter((r) => !r.deleted).length +
    localApp.filter((r) => !r.deleted).length;

  const [deviceId, lastAudit] = await Promise.all([getDeviceId(), getLastSyncAudit(ownerUid)]);
  const authUser = getFirebaseAuth()?.currentUser;

  return {
    novos,
    alterados,
    excluidos,
    baixarNovos,
    baixarAlterados,
    ignorados,
    totalLocal,
    totalRemoto,
    totalPendentes: pendingSummary.total,
    pendingSummary,
    meta: {
      deviceId,
      userEmail: authUser?.email ?? null,
      userId: getCachedLoginUid(),
      lastSyncAt: lastAudit?.finishedAt ?? null,
      generatedAt: Date.now(),
      collectionCounts: {
        cadastros: {
          local: localCad.filter((r) => !r.deleted).length,
          remote: remoteCad.filter((r) => !readRemoteDeleted(r)).length,
        },
        sessoes: {
          local: localSess.filter((r) => !r.deleted).length,
          remote: remoteSess.filter((r) => !readRemoteDeleted(r)).length,
        },
        aplicadores: {
          local: localApp.filter((r) => !r.deleted).length,
          remote: remoteApp.filter((r) => !readRemoteDeleted(r)).length,
        },
      },
      clockDriftWarning,
    },
  };
}

export function summarizeSyncReport(report: SyncReport): {
  uploadCount: number;
  downloadCount: number;
  ignoredCount: number;
  totalChanges: number;
} {
  const uploadCount = report.novos.length + report.alterados.length + report.excluidos.length;
  const downloadCount = report.baixarNovos.length + report.baixarAlterados.length;
  const ignoredCount = report.ignorados.length;
  return {
    uploadCount,
    downloadCount,
    ignoredCount,
    totalChanges: uploadCount + downloadCount,
  };
}

export type { PendingSyncItem };
