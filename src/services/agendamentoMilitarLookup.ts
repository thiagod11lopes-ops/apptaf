/**
 * Publica NIP + dados de cadastro no Supabase para a página de agendamento
 * e importa de volta para o cadastro principal do AppTAF.
 * Necessário porque `cadastros.data` na nuvem é criptografado (E2E).
 */
import { getSupabase } from '../config/supabase';
import {
  addCadastrosEmLote,
  getAllCadastros,
  type CadastroItemPersist,
} from './cadastrosIndexedDb';
import { nomeBareSemPosto } from '../utils/formatNomeComPosto';
import { formatNipInput, nipChaveCadastro, nipDigitos } from '../utils/nipFormat';
import {
  dataNascimentoCadastroValida,
  sexoCadastroValido,
  vinculoCadastroValido,
} from '../utils/cadastroDadosTaf';

export type MilitarLookupRow = {
  nip: string;
  nome: string;
  data_nascimento: string;
  sexo: string;
  categoria: string;
  posto: string;
  vinculo: string;
  updated_at: number;
  deleted: boolean;
};

async function requireAuthSupabase() {
  const sb = getSupabase();
  if (!sb) {
    throw new Error('Supabase não configurado neste dispositivo.');
  }
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    throw new Error('Faça login no app para publicar o cadastro na página pública.');
  }
  return sb;
}

function postoDoCadastro(c: CadastroItemPersist): string {
  return ((c.categoria === 'Oficiais' ? c.oficial : c.praca) || '').trim();
}

function cadastroToLookupRow(c: CadastroItemPersist, agora = Date.now()): MilitarLookupRow | null {
  const nip = nipChaveCadastro(c.nip);
  if (!nip) return null;
  const nome =
    nomeBareSemPosto(c.nome || '').trim().toUpperCase() || (c.nome || '').trim().toUpperCase();
  if (!nome) return null;
  return {
    nip,
    nome,
    data_nascimento: (c.dataNascimento || '').trim(),
    sexo: c.sexo === 'M' || c.sexo === 'F' ? c.sexo : '',
    categoria: c.categoria === 'Oficiais' || c.categoria === 'Praças' ? c.categoria : '',
    posto: postoDoCadastro(c).toUpperCase(),
    vinculo: c.vinculo === 'carreira' || c.vinculo === 'rm2' ? c.vinculo : '',
    updated_at: c.updatedAt ?? agora,
    deleted: false,
  };
}

function preferirTexto(novo: string | null | undefined, antigo: string | null | undefined): string {
  const n = String(novo ?? '').trim();
  if (n) return n;
  return String(antigo ?? '').trim();
}

function mesclarLookupRow(
  incoming: MilitarLookupRow,
  existing: Partial<MilitarLookupRow> | null | undefined,
): MilitarLookupRow {
  if (!existing) return incoming;
  return {
    nip: incoming.nip,
    nome: preferirTexto(incoming.nome, existing.nome),
    data_nascimento: preferirTexto(incoming.data_nascimento, existing.data_nascimento),
    sexo: preferirTexto(incoming.sexo, existing.sexo),
    categoria: preferirTexto(incoming.categoria, existing.categoria),
    posto: preferirTexto(incoming.posto, existing.posto),
    vinculo: preferirTexto(incoming.vinculo, existing.vinculo),
    updated_at: Math.max(incoming.updated_at ?? 0, existing.updated_at ?? 0) || Date.now(),
    deleted: false,
  };
}

/**
 * Publica um único cadastro na lookup da página de agendamento.
 * Silencioso se offline / sem sessão — não bloqueia o fluxo de cadastro.
 */
export async function upsertMilitarLookupFromCadastro(
  item: CadastroItemPersist,
): Promise<boolean> {
  try {
    const row = cadastroToLookupRow(item);
    if (!row) return false;
    const sb = getSupabase();
    if (!sb) return false;
    const { data: sessionData } = await sb.auth.getSession();
    if (!sessionData.session) return false;

    const { error } = await sb.rpc('upsert_militar_lookup_admin', {
      p_nip: row.nip,
      p_nome: row.nome,
      p_data_nascimento: row.data_nascimento,
      p_sexo: row.sexo,
      p_categoria: row.categoria,
      p_posto: row.posto,
      p_vinculo: row.vinculo,
      p_deleted: row.deleted,
      p_updated_at: row.updated_at,
    });
    return !error;
  } catch {
    return false;
  }
}

/** Envia cadastros locais (dados mínimos) para a lookup pública. */
export async function pushMilitarLookupToSupabase(): Promise<number> {
  const sb = await requireAuthSupabase();
  const cadastros = await getAllCadastros();
  const agora = Date.now();
  const byNip = new Map<string, MilitarLookupRow>();

  for (const c of cadastros) {
    const row = cadastroToLookupRow(c, agora);
    if (!row) continue;
    const prev = byNip.get(row.nip);
    if (!prev || (row.updated_at ?? 0) >= (prev.updated_at ?? 0)) {
      byNip.set(row.nip, row);
    }
  }

  const existentes = new Map<string, MilitarLookupRow>();
  const { data: remoto, error: listError } = await sb.rpc('listar_militar_lookup_admin');
  if (listError) {
    throw new Error(listError.message || 'Falha ao ler lookup de agendamento.');
  }
  for (const row of remoto ?? []) {
    const nip = nipChaveCadastro(String((row as MilitarLookupRow).nip || ''));
    if (nip) existentes.set(nip, row as MilitarLookupRow);
  }

  const rows = Array.from(byNip.values()).map((row) =>
    mesclarLookupRow(row, existentes.get(row.nip)),
  );
  for (const row of rows) {
    const { error } = await sb.rpc('upsert_militar_lookup_admin', {
      p_nip: row.nip,
      p_nome: row.nome,
      p_data_nascimento: row.data_nascimento,
      p_sexo: row.sexo,
      p_categoria: row.categoria,
      p_posto: row.posto,
      p_vinculo: row.vinculo,
      p_deleted: row.deleted,
      p_updated_at: row.updated_at,
    });
    if (error) {
      throw new Error(error.message || 'Falha ao publicar cadastros para agendamento.');
    }
  }
  return rows.length;
}

/**
 * Importa militares da página pública de agendamento para o cadastro principal.
 * - NIP novo → cria cadastro definitivo (local + sync nuvem via fila offline-first)
 * - NIP existente → preenche apenas campos que ainda estão faltando
 */
export async function importMilitarLookupIntoCadastros(): Promise<number> {
  const sb = await requireAuthSupabase();
  const { data, error } = await sb.rpc('listar_militar_lookup_admin');
  if (error) {
    throw new Error(error.message || 'Falha ao buscar cadastros do agendamento.');
  }

  const rows = ((data ?? []) as MilitarLookupRow[]).filter((r) => r.deleted !== true);
  if (rows.length === 0) return 0;

  const locais = await getAllCadastros();
  const byNip = new Map<string, CadastroItemPersist>();
  for (const c of locais) {
    const k = nipChaveCadastro(c.nip);
    if (k) byNip.set(k, c);
  }

  const agora = Date.now();
  const toSave: CadastroItemPersist[] = [];

  for (const row of rows) {
    const nip = nipChaveCadastro(row.nip) || (nipDigitos(row.nip).length === 8 ? nipDigitos(row.nip) : '');
    if (!nip) continue;
    const nome = String(row.nome || '').trim().toUpperCase();
    if (!nome) continue;

    const categoria: 'Oficiais' | 'Praças' =
      row.categoria === 'Oficiais' || row.categoria === 'Praças' ? row.categoria : 'Praças';
    const posto = String(row.posto || '').trim().toUpperCase();
    const sexo = row.sexo === 'M' || row.sexo === 'F' ? row.sexo : undefined;
    const vinculo = row.vinculo === 'carreira' || row.vinculo === 'rm2' ? row.vinculo : undefined;
    const dataNascimento = String(row.data_nascimento || '').trim();

    const existing = byNip.get(nip);
    if (!existing) {
      const novo: CadastroItemPersist = {
        id: `agendamento_${nip}`,
        nip: formatNipInput(nip),
        nome,
        dataNascimento: dataNascimento || '',
        categoria,
        sexo,
        oficial: categoria === 'Oficiais' ? posto || undefined : undefined,
        praca: categoria === 'Praças' ? posto || undefined : undefined,
        vinculo,
        updatedAt: agora,
      };
      toSave.push(novo);
      byNip.set(nip, novo);
      continue;
    }

    const merged: CadastroItemPersist = { ...existing };
    let changed = false;

    const nomeLocal = nomeBareSemPosto(merged.nome || '').trim();
    if (!nomeLocal && nome) {
      merged.nome = nome;
      changed = true;
    }
    if (!dataNascimentoCadastroValida(merged.dataNascimento || '') && dataNascimentoCadastroValida(dataNascimento)) {
      merged.dataNascimento = dataNascimento;
      changed = true;
    }
    if (!sexoCadastroValido(merged.sexo) && sexo) {
      merged.sexo = sexo;
      changed = true;
    }
    if (merged.categoria !== 'Oficiais' && merged.categoria !== 'Praças') {
      merged.categoria = categoria;
      changed = true;
    }
    const postoLocal = postoDoCadastro(merged);
    if (!postoLocal && posto) {
      if (merged.categoria === 'Oficiais') merged.oficial = posto;
      else merged.praca = posto;
      changed = true;
    }
    if (!vinculoCadastroValido(merged.vinculo) && vinculo) {
      merged.vinculo = vinculo;
      changed = true;
    }

    if (changed) {
      merged.updatedAt = agora;
      toSave.push(merged);
      byNip.set(nip, merged);
    }
  }

  if (toSave.length > 0) {
    await addCadastrosEmLote(toSave);
  }
  return toSave.length;
}

/** Importa da página pública e em seguida republica o lookup (ida e volta). */
export async function syncMilitarLookupComCadastros(): Promise<{
  importados: number;
  publicados: number;
}> {
  const importados = await importMilitarLookupIntoCadastros();
  const publicados = await pushMilitarLookupToSupabase();
  return { importados, publicados };
}
