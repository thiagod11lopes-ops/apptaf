import { getActiveTeamKey } from '../../services/supabase/e2eCrypto';
import {
  getAllFatoresRiscoCloud,
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
import { syncLogger } from './SyncLogger';

function asActive(reg: FatoresRiscoRegistro | FatoresRiscoCloudDoc): boolean {
  return (reg as { deleted?: boolean }).deleted !== true;
}

/** LWW por NIP: merge local ↔ nuvem e envia o que local venceu (E2E via upsertOwnerDoc). */
export async function syncFatoresRiscoWithCloud(ownerUid: string): Promise<string[]> {
  const errors: string[] = [];
  if (!ownerUid.trim()) return errors;
  if (!getActiveTeamKey()) return errors;

  try {
    const [localMap, remoteList] = await Promise.all([
      getAllFatoresRiscoIncludingDeleted(ownerUid),
      getAllFatoresRiscoCloud(ownerUid),
    ]);

    const remoteByNip = new Map<string, FatoresRiscoCloudDoc>();
    for (const r of remoteList) {
      const nip = nipDigitos(r.nip || r.id);
      if (nip.length === 8) remoteByNip.set(nip, { ...r, nip, id: nip });
    }

    const merged: Record<string, FatoresRiscoRegistro & { deleted?: boolean }> = {};
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
        };
        continue;
      }
      if (local && !remote) {
        merged[nip] = { ...local, nip };
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
        };
      } else {
        merged[nip] = { ...local, nip };
      }
    }

    await replaceAllFatoresRiscoMap(merged, ownerUid);

    for (const [nip, reg] of Object.entries(merged)) {
      const remote = remoteByNip.get(nip);
      const localAt = reg.updatedAt ?? 0;
      const remoteAt = remote?.updatedAt ?? 0;
      const localDeleted = !asActive(reg);
      const remoteDeleted = remote ? !asActive(remote) : undefined;

      const needsUpload =
        !remote ||
        localAt > remoteAt ||
        (localAt === remoteAt && localDeleted !== remoteDeleted);

      if (!needsUpload) continue;

      try {
        await upsertFatoresRiscoCloud(ownerUid, reg, localDeleted);
      } catch (e) {
        errors.push(
          `fatores_risco/${nip}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

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
