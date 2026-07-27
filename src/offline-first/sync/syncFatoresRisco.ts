import { getActiveTeamKey } from '../../services/supabase/e2eCrypto';
import {
  getAllFatoresRiscoCloud,
  hardDeleteFatoresRiscoCloud,
  upsertFatoresRiscoCloud,
  type FatoresRiscoCloudDoc,
} from '../../services/supabase/fatoresRiscoCloud';
import {
  getAllFatoresRiscoIncludingDeleted,
  replaceAllFatoresRiscoMap,
  respostasFatoresVazias,
  type FatoresRiscoRegistro,
} from '../../services/fatoresRiscoStorage';
import { nipDigitos } from '../../utils/nipFormat';
import {
  isLegacyNipCloudDocId,
  resolveOpaqueCloudDocId,
} from '../../utils/opaqueCloudDocId';
import { syncLogger } from './SyncLogger';

function asActive(reg: FatoresRiscoRegistro | FatoresRiscoCloudDoc): boolean {
  return (reg as { deleted?: boolean }).deleted !== true;
}

/** LWW por NIP; id na nuvem opaco (NIP só no data cifrado). Migra id=NIP legado. */
export async function syncFatoresRiscoWithCloud(ownerUid: string): Promise<string[]> {
  const errors: string[] = [];
  if (!ownerUid.trim()) return errors;
  if (!getActiveTeamKey()) return errors;

  try {
    const [localMap, remoteList] = await Promise.all([
      getAllFatoresRiscoIncludingDeleted(ownerUid),
      getAllFatoresRiscoCloud(ownerUid),
    ]);

    const remoteByNip = new Map<string, FatoresRiscoCloudDoc & { legacyRowId?: string }>();
    for (const r of remoteList) {
      const nip = nipDigitos(r.nip);
      if (nip.length !== 8) continue;
      const prev = remoteByNip.get(nip);
      const row: FatoresRiscoCloudDoc & { legacyRowId?: string } = {
        ...r,
        nip,
        id: r.id,
        cloudId: r.cloudId,
        legacyRowId: isLegacyNipCloudDocId(r.id) ? r.id : undefined,
      };
      if (!prev || (r.updatedAt ?? 0) >= (prev.updatedAt ?? 0)) {
        remoteByNip.set(nip, row);
      }
    }

    const merged: Record<string, FatoresRiscoRegistro> = {};
    const allNips = new Set([...Object.keys(localMap), ...remoteByNip.keys()]);

    for (const nip of allNips) {
      const local = localMap[nip];
      const remote = remoteByNip.get(nip);
      const localAt = local?.updatedAt ?? 0;
      const remoteAt = remote?.updatedAt ?? 0;

      if (!local && remote) {
        merged[nip] = {
          nip,
          nome: remote.nome ?? '',
          respostas: remote.respostas ?? respostasFatoresVazias(),
          usoRemedios: remote.usoRemedios,
          altura: remote.altura,
          peso: remote.peso,
          imc: remote.imc,
          updatedAt: remoteAt,
          deleted: remote.deleted === true,
          cloudId: resolveOpaqueCloudDocId({
            localCloudId: remote.cloudId,
            remoteRowId: remote.id,
          }),
        };
        continue;
      }
      if (local && !remote) {
        merged[nip] = {
          ...local,
          nip,
          cloudId: resolveOpaqueCloudDocId({ localCloudId: local.cloudId }),
        };
        continue;
      }
      if (!local || !remote) continue;

      if (remoteAt > localAt) {
        merged[nip] = {
          nip,
          nome: remote.nome ?? '',
          respostas: remote.respostas ?? respostasFatoresVazias(),
          usoRemedios: remote.usoRemedios,
          altura: remote.altura,
          peso: remote.peso,
          imc: remote.imc,
          updatedAt: remoteAt,
          deleted: remote.deleted === true,
          cloudId: resolveOpaqueCloudDocId({
            localCloudId: local.cloudId,
            remoteRowId: remote.id,
          }),
        };
      } else {
        merged[nip] = {
          ...local,
          nip,
          cloudId: resolveOpaqueCloudDocId({
            localCloudId: local.cloudId,
            remoteRowId: remote.id,
          }),
        };
      }
    }

    await replaceAllFatoresRiscoMap(merged, ownerUid);

    for (const [nip, reg] of Object.entries(merged)) {
      const remote = remoteByNip.get(nip);
      const localAt = reg.updatedAt ?? 0;
      const remoteAt = remote?.updatedAt ?? 0;
      const localDeleted = !asActive(reg);
      const remoteDeleted = remote ? !asActive(remote) : undefined;
      const legacyRemote = Boolean(remote?.legacyRowId);

      const needsUpload =
        !remote ||
        legacyRemote ||
        localAt > remoteAt ||
        (localAt === remoteAt && localDeleted !== remoteDeleted) ||
        (remote &&
          !isLegacyNipCloudDocId(remote.id) &&
          reg.cloudId &&
          remote.id !== reg.cloudId);

      if (!needsUpload) continue;

      try {
        const cloudId = await upsertFatoresRiscoCloud(ownerUid, reg, localDeleted);
        if (reg.cloudId !== cloudId) {
          merged[nip] = { ...reg, cloudId };
        }
        if (remote?.legacyRowId && remote.legacyRowId !== cloudId) {
          await hardDeleteFatoresRiscoCloud(ownerUid, remote.legacyRowId);
        }
      } catch (e) {
        errors.push(
          `fatores_risco/${nip}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    await replaceAllFatoresRiscoMap(merged, ownerUid);

    if (errors.length === 0) {
      await syncLogger.info('sync', 'Fatores de risco sincronizados com a nuvem (E2E)', {
        ownerUid,
        count: Object.keys(merged).filter((n) => asActive(merged[n]!)).length,
      });
    }
  } catch (e) {
    errors.push(`fatores_risco: ${e instanceof Error ? e.message : String(e)}`);
  }

  return errors;
}
