import type { FatoresRiscoRegistro, RespostasFatoresRisco } from '../fatoresRiscoStorage';
import { respostasFatoresVazias } from '../fatoresRiscoStorage';
import { nipDigitos } from '../../utils/nipFormat';
import { deleteOwnerDoc, listOwnerDocs, rowToDoc, upsertOwnerDoc } from './ownerDocs';

const TABLE = 'fatores_risco';

export type FatoresRiscoCloudDoc = FatoresRiscoRegistro & {
  id: string;
  deleted?: boolean;
};

function toCloudPayload(reg: FatoresRiscoRegistro, deleted = false): Record<string, unknown> {
  const nip = nipDigitos(reg.nip);
  return {
    id: nip,
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
    const raw = rowToDoc<FatoresRiscoCloudDoc>(row);
    const nip = nipDigitos(raw.nip || row.id);
    return {
      id: nip || row.id,
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
): Promise<void> {
  const nip = nipDigitos(reg.nip);
  if (nip.length !== 8) throw new Error('NIP inválido para sync de fatores de risco');
  const updatedAt = reg.updatedAt ?? Date.now();
  await upsertOwnerDoc(
    TABLE,
    ownerUid,
    nip,
    toCloudPayload({ ...reg, nip, updatedAt }, deleted),
    updatedAt,
    deleted,
  );
}

export async function hardDeleteFatoresRiscoCloud(ownerUid: string, nip: string): Promise<void> {
  await deleteOwnerDoc(TABLE, ownerUid, nipDigitos(nip));
}
