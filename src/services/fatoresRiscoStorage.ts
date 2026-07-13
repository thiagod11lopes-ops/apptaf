import { getCachedDataOwnerUid, waitForAuthenticatedUid } from './firebase/authUid';
import { readAppMeta, writeAppMeta } from '../offline-first/db/appMeta';
import { nipDigitos } from '../utils/nipFormat';

export type FatorRiscoId =
  | 'hipertensao'
  | 'diabetes'
  | 'dislipidemia'
  | 'tabagismo'
  | 'sedentarismo'
  | 'apneiaSono'
  | 'morteSubitaFamilia';

export type RespostaFatorRisco = 'sim' | 'nao' | null;

export type RespostasFatoresRisco = Record<FatorRiscoId, RespostaFatorRisco>;

export type FatoresRiscoRegistro = {
  nip: string;
  nome: string;
  respostas: RespostasFatoresRisco;
  /** Altura informada (m ou cm, texto original). */
  altura?: string;
  /** Peso em kg (texto original). */
  peso?: string;
  /** IMC calculado no momento do salvamento. */
  imc?: number;
  updatedAt: number;
};

export const FATORES_RISCO_ITENS: ReadonlyArray<{ id: FatorRiscoId; label: string }> = [
  { id: 'hipertensao', label: 'Hipertensão' },
  { id: 'diabetes', label: 'Diabetes' },
  { id: 'dislipidemia', label: 'Dislipidemia' },
  { id: 'tabagismo', label: 'Tabagismo' },
  { id: 'sedentarismo', label: 'Sedentarismo' },
  { id: 'apneiaSono', label: 'Apnéia do sono' },
  { id: 'morteSubitaFamilia', label: 'Casos de morte súbita na família' },
];

export function respostasFatoresVazias(): RespostasFatoresRisco {
  return {
    hipertensao: null,
    diabetes: null,
    dislipidemia: null,
    tabagismo: null,
    sedentarismo: null,
    apneiaSono: null,
    morteSubitaFamilia: null,
  };
}

export function temFatorRiscoSim(respostas: RespostasFatoresRisco | null | undefined): boolean {
  if (!respostas) return false;
  return FATORES_RISCO_ITENS.some((item) => respostas[item.id] === 'sim');
}

export function listarFatoresRiscoSim(
  respostas: RespostasFatoresRisco | null | undefined,
): string[] {
  if (!respostas) return [];
  return FATORES_RISCO_ITENS.filter((item) => respostas[item.id] === 'sim').map((item) => item.label);
}

function metaKey(ownerUid: string): string {
  return `fatoresRisco:${ownerUid}`;
}

async function resolveOwnerUid(): Promise<string> {
  const uid = getCachedDataOwnerUid() ?? (await waitForAuthenticatedUid());
  return uid ?? '__local__';
}

async function readMap(ownerUid: string): Promise<Record<string, FatoresRiscoRegistro>> {
  const raw = await readAppMeta(metaKey(ownerUid));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, FatoresRiscoRegistro>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function getAllFatoresRisco(): Promise<Record<string, FatoresRiscoRegistro>> {
  const ownerUid = await resolveOwnerUid();
  return readMap(ownerUid);
}

export async function getFatoresRiscoByNip(nip: string): Promise<FatoresRiscoRegistro | null> {
  const key = nipDigitos(nip);
  if (key.length !== 8) return null;
  const map = await getAllFatoresRisco();
  return map[key] ?? null;
}

export async function saveFatoresRisco(input: {
  nip: string;
  nome: string;
  respostas: RespostasFatoresRisco;
  altura?: string;
  peso?: string;
  imc?: number;
}): Promise<FatoresRiscoRegistro> {
  const key = nipDigitos(input.nip);
  if (key.length !== 8) {
    throw new Error('NIP inválido');
  }

  const ownerUid = await resolveOwnerUid();
  const map = await readMap(ownerUid);
  const registro: FatoresRiscoRegistro = {
    nip: key,
    nome: input.nome.trim(),
    respostas: { ...input.respostas },
    altura: input.altura?.trim() || undefined,
    peso: input.peso?.trim() || undefined,
    imc: input.imc,
    updatedAt: Date.now(),
  };

  map[key] = registro;
  await writeAppMeta(metaKey(ownerUid), JSON.stringify(map));
  return registro;
}
