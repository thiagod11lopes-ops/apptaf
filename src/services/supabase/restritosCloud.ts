import type { RestritoRegistro } from '../restritosStorage';
import { nipDigitos } from '../../utils/nipFormat';
import { deleteOwnerDoc, listOwnerDocs, rowToDoc, upsertOwnerDoc } from './ownerDocs';

const TABLE = 'restritos';

export type RestritoCloudDoc = RestritoRegistro & {
  id: string;
  deleted?: boolean;
};

function toCloudPayload(reg: RestritoRegistro, deleted = false): Record<string, unknown> {
  const nip = nipDigitos(reg.nip);
  return {
    id: nip,
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
    const raw = rowToDoc<RestritoCloudDoc>(row);
    const nip = nipDigitos(raw.nip || row.id);
    return {
      id: nip || row.id,
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
): Promise<void> {
  const nip = nipDigitos(reg.nip);
  if (nip.length !== 8) throw new Error('NIP inválido para sync de restrito');
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

export async function deleteRestritoCloud(
  ownerUid: string,
  nip: string,
  updatedAt = Date.now(),
): Promise<void> {
  const key = nipDigitos(nip);
  if (key.length !== 8) throw new Error('NIP inválido');
  await upsertOwnerDoc(
    TABLE,
    ownerUid,
    key,
    toCloudPayload(
      { nip: key, nome: '', dataInicio: '', dataFim: '', updatedAt },
      true,
    ),
    updatedAt,
    true,
  );
}

/** Remoção física (wipe / heal). Preferir tombstone via deleteRestritoCloud no sync. */
export async function hardDeleteRestritoCloud(ownerUid: string, nip: string): Promise<void> {
  await deleteOwnerDoc(TABLE, ownerUid, nipDigitos(nip));
}
