import type { FatoresRiscoRegistro, RespostasFatoresRisco } from '../fatoresRiscoStorage';
import { respostasFatoresVazias } from '../fatoresRiscoStorage';
import { nipDigitos } from '../../utils/nipFormat';
import {
  isLegacyNipCloudDocId,
  resolveOpaqueCloudDocId,
} from '../../utils/opaqueCloudDocId';
import { deleteOwnerDoc, listOwnerDocs, rowToDoc, upsertOwnerDoc } from './ownerDocs';

const TABLE = 'fatores_risco';

export type FatoresRiscoCloudDoc = FatoresRiscoRegistro & {
  id: string;
  deleted?: boolean;
};

function toCloudPayload(
  reg: FatoresRiscoRegistro,
  cloudId: string,
  deleted = false,
): Record<string, unknown> {
  const nip = nipDigitos(reg.nip);
  return {
    id: cloudId,
    cloudId,
    nip,
    nome: (reg.nome ?? '').trim(),
    respostas: reg.respostas ?? respostasFatoresVazias(),
    usoRemedios: reg.usoRemedios,
    altura: reg.altura,
    peso: reg.peso,
    imc: reg.imc,
    updatedAt: reg.updatedAt ?? Date.now(),
    deleted,
  };
}

function normalizeRespostas(raw: unknown): RespostasFatoresRisco {
  const base = respostasFatoresVazias();
  if (!raw || typeof raw !== 'object') return base;
  const src = raw as Record<string, unknown>;
  for (const key of Object.keys(base) as Array<keyof RespostasFatoresRisco>) {
    const v = src[key];
    if (v === 'sim' || v === 'nao' || v === null) base[key] = v;
  }
  return base;
}

export async function getAllFatoresRiscoCloud(ownerUid: string): Promise<FatoresRiscoCloudDoc[]> {
  const rows = await listOwnerDocs(TABLE, ownerUid);
  return rows.map((row) => {
    const raw = rowToDoc<FatoresRiscoCloudDoc & { cloudId?: string }>(row);
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
      id: row.id,
      cloudId: preferredCloudId,
      nip,
      nome: (raw.nome ?? '').trim(),
      respostas: normalizeRespostas(raw.respostas),
      usoRemedios: raw.usoRemedios,
      altura: raw.altura,
      peso: raw.peso,
      imc: raw.imc,
      updatedAt: raw.updatedAt ?? row.updated_at ?? 0,
      deleted: row.deleted === true || raw.deleted === true,
    };
  });
}

export async function upsertFatoresRiscoCloud(
  ownerUid: string,
  reg: FatoresRiscoRegistro,
  deleted = false,
): Promise<string> {
  const nip = nipDigitos(reg.nip);
  if (nip.length !== 8) throw new Error('NIP inválido para sync de fatores de risco');
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

export async function hardDeleteFatoresRiscoCloud(ownerUid: string, cloudId: string): Promise<void> {
  const id = (cloudId ?? '').trim();
  if (!id) return;
  await deleteOwnerDoc(TABLE, ownerUid, id);
}
