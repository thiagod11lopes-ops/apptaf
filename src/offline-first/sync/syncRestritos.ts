import { getActiveTeamKey } from '../../services/supabase/e2eCrypto';
import {
  getAllRestritosCloud,
  hardDeleteRestritoCloud,
  upsertRestritoCloud,
  type RestritoCloudDoc,
} from '../../services/supabase/restritosCloud';
import {
  getAllRestritosIncludingDeleted,
  replaceAllRestritosMap,
  type RestritoRegistro,
} from '../../services/restritosStorage';
import { nipDigitos } from '../../utils/nipFormat';
import {
  isLegacyNipCloudDocId,
  resolveOpaqueCloudDocId,
} from '../../utils/opaqueCloudDocId';
import { syncLogger } from './SyncLogger';

function asActive(reg: RestritoRegistro | RestritoCloudDoc): boolean {
  return (reg as { deleted?: boolean }).deleted !== true;
}

/**
 * LWW por NIP: merge local ↔ nuvem.
 * Coluna `id` na nuvem é UUID opaco; NIP só no `data` cifrado.
 * Migra linhas legadas (id = NIP) para id opaco e apaga o legado.
 */
export async function syncRestritosWithCloud(ownerUid: string): Promise<string[]> {
  const errors: string[] = [];
  if (!ownerUid.trim()) return errors;
  if (!getActiveTeamKey()) return errors;

  try {
    const [localMap, remoteList] = await Promise.all([
      getAllRestritosIncludingDeleted(ownerUid),
      getAllRestritosCloud(ownerUid),
    ]);

    const remoteByNip = new Map<string, RestritoCloudDoc & { legacyRowId?: string }>();
    for (const r of remoteList) {
      const nip = nipDigitos(r.nip);
      if (nip.length !== 8) continue;
      const prev = remoteByNip.get(nip);
      const row: RestritoCloudDoc & { legacyRowId?: string } = {
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

    const merged: Record<string, RestritoRegistro> = {};
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
          dataInicio: remote.dataInicio ?? '',
          dataFim: remote.dataFim ?? '',
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
          dataInicio: remote.dataInicio ?? '',
          dataFim: remote.dataFim ?? '',
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

    await replaceAllRestritosMap(merged, ownerUid);

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
        const cloudId = await upsertRestritoCloud(ownerUid, reg, localDeleted);
        if (reg.cloudId !== cloudId) {
          merged[nip] = { ...reg, cloudId };
        }
        if (remote?.legacyRowId && remote.legacyRowId !== cloudId) {
          await hardDeleteRestritoCloud(ownerUid, remote.legacyRowId);
        }
      } catch (e) {
        errors.push(
          `restritos/${nip}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    await replaceAllRestritosMap(merged, ownerUid);

    if (errors.length === 0) {
      await syncLogger.info('sync', 'Restritos sincronizados com a nuvem (E2E)', {
        ownerUid,
        count: Object.keys(merged).filter((n) => asActive(merged[n]!)).length,
      });
    }
  } catch (e) {
    errors.push(`restritos: ${e instanceof Error ? e.message : String(e)}`);
  }

  return errors;
}
