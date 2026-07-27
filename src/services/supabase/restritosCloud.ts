import type { RestritoRegistro } from '../restritosStorage';
import { nipDigitos } from '../../utils/nipFormat';
import {
  isLegacyNipCloudDocId,
  resolveOpaqueCloudDocId,
} from '../../utils/opaqueCloudDocId';
import { deleteOwnerDoc, listOwnerDocs, rowToDoc, upsertOwnerDoc } from './ownerDocs';

const TABLE = 'restritos';

export type RestritoCloudDoc = RestritoRegistro & {
  id: string;
  deleted?: boolean;
};

function toCloudPayload(
  reg: RestritoRegistro,
  cloudId: string,
  deleted = false,
): Record<string, unknown> {
  const nip = nipDigitos(reg.nip);
  return {
    id: cloudId,
    cloudId,
    nip,
    nome: (reg.nome ?? '').trim(),
    dataInicio: reg.dataInicio,
    dataFim: reg.dataFim,
    updatedAt: reg.updatedAt ?? Date.now(),
    deleted,
  };
}

export async function getAllRestritosCloud(ownerUid: string): Promise<RestritoCloudDoc[]> {
  const rows = await listOwnerDocs(TABLE, ownerUid);
  return rows.map((row) => {
    const raw = rowToDoc<RestritoCloudDoc & { cloudId?: string }>(row);
    const nipFromData = nipDigitos(raw.nip ?? '');
    const nip =
      nipFromData.length === 8
        ? nipFromData
        : isLegacyNipCloudDocId(row.id)
          ? row.id
          : '';
    const preferredCloudId =
      typeof raw.cloudId === 'string' && !isLegacyNipCloudDocId(raw.cloudId)
        ? raw.cloudId
        : !isLegacyNipCloudDocId(row.id)
          ? row.id
          : undefined;
    return {
      /** Sempre o `id` real da linha no Postgres (pode ser NIP legado). */
      id: row.id,
      cloudId: preferredCloudId,
      nip,
      nome: (raw.nome ?? '').trim(),
      dataInicio: raw.dataInicio ?? '',
      dataFim: raw.dataFim ?? '',
      updatedAt: raw.updatedAt ?? row.updated_at ?? 0,
      deleted: row.deleted === true || raw.deleted === true,
    };
  });
}

export async function upsertRestritoCloud(
  ownerUid: string,
  reg: RestritoRegistro,
  deleted = false,
): Promise<string> {
  const nip = nipDigitos(reg.nip);
  if (nip.length !== 8) throw new Error('NIP inválido para sync de restrito');
  const cloudId = resolveOpaqueCloudDocId({ localCloudId: reg.cloudId });
  const updatedAt = reg.updatedAt ?? Date.now();
  await upsertOwnerDoc(
    TABLE,
    ownerUid,
    cloudId,
    toCloudPayload({ ...reg, nip, cloudId, updatedAt }, cloudId, deleted),
    updatedAt,
    deleted,
  );
  return cloudId;
}

/** Remove linha legada cujo id era o NIP em texto claro. */
export async function hardDeleteRestritoCloud(ownerUid: string, cloudId: string): Promise<void> {
  const id = (cloudId ?? '').trim();
  if (!id) return;
  await deleteOwnerDoc(TABLE, ownerUid, id);
}
