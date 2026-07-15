import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { addCadastrosEmLote } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf, TipoProvaAplicada } from '../services/resultadosAplicadosIndexedDb';
import { updateSessaoAplicacao } from '../services/resultadosAplicadosIndexedDb';
import type { AplicadorItemPersist } from '../services/aplicadoresIndexedDb';
import { addAplicador } from '../services/aplicadoresIndexedDb';
import type { PreCadastroTaf } from '../services/preCadastroTafStorage';
import { addPreCadastroTaf } from '../services/preCadastroTafStorage';
import type { ResultadoCorridaItem } from '../navigation/types';
import type { LocalAuthorizedEmail } from '../offline-first/repositories/AuthorizedEmailRepository';
import type { SyncQueueEntry } from '../offline-first/types';
import { getTafDatabase } from '../offline-first/db/tafDatabase';
import { writeAppMeta } from '../offline-first/db/appMeta';
import {
  gatherSystemBackupData,
  type AppMetaBackupEntry,
  type SystemBackupPayload,
} from './gatherSystemBackupData';
import { csvRow, parseCsvRecords, recordsToObjects } from './csvText';
import { buildBackupApptafFilename } from './backupNaming';

const BACKUP_VERSION = '2';

/** Não restaurar — evita pular o backup diário após importação. */
const DAILY_BACKUP_META_KEY = 'backup:lastDailyDateBr';

type BackupSection =
  | 'CADASTROS'
  | 'SESSOES'
  | 'APLICADORES'
  | 'PRE_CADASTROS'
  | 'EMAILS_AUTORIZADOS'
  | 'SYNC_QUEUE'
  | 'APP_META';

const TIPOS_PROVA_APLICADA = new Set<TipoProvaAplicada>([
  'corrida',
  'natacao',
  'permanencia',
  'caminhada',
  'flexao_barra',
  'flexao_solo',
  'abdominal_remador',
  'abdominal_prancha',
]);

const CADASTRO_COLUMNS = [
  'id',
  'nip',
  'nome',
  'dataNascimento',
  'categoria',
  'sexo',
  'oficial',
  'praca',
  'tempoCorrida',
  'tempoNatacao',
  'tempoCaminhada',
  'notaCorrida',
  'notaCaminhada',
  'notaNatacao',
  'resultadoNatacao',
  'resultadoPermanencia',
  'tempoPermanencia',
  'dataTafCorrida',
  'dataTafNatacao',
  'dataTafCaminhada',
  'dataTafPermanencia',
  'modalidadeDistanciaAtiva',
  'rubricaCorridaSvg',
  'rubricaNatacaoSvg',
  'rubricaCaminhadaSvg',
  'rubricaPermanenciaSvg',
  'repsFlexaoBarra',
  'notaFlexaoBarra',
  'dataTafFlexaoBarra',
  'repsFlexaoSolo',
  'notaFlexaoSolo',
  'dataTafFlexaoSolo',
  'repsAbdominalRemador',
  'notaAbdominalRemador',
  'dataTafAbdominalRemador',
  'tempoAbdominalPrancha',
  'notaAbdominalPrancha',
  'dataTafAbdominalPrancha',
  'updatedAt',
] as const;

const SESSAO_COLUMNS = [
  'sessao_id',
  'sessao_criadoEm',
  'sessao_dataAplicacao',
  'sessao_tipoProva',
  'sessao_normaTaf',
  'sessao_updatedAt',
  'sessao_aplicadorId',
  'sessao_aplicadorNome',
  'sessao_aplicadorNip',
  'sessao_aplicadorCategoria',
  'sessao_aplicadorPostoGrad',
  'sessao_aplicadorRubricaSvg',
  'corredor',
  'nome',
  'tempoMs',
  'nip',
  'prova',
  'desempenhoTexto',
  'notaTexto',
  'noraTexto',
  'reprovacaoTexto',
  'rubricaCandidato',
  'rubricaCandidatoSvg',
] as const;

const APLICADOR_COLUMNS = [
  'id',
  'nip',
  'nome',
  'categoria',
  'sexo',
  'oficial',
  'praca',
  'senha',
  'senhaHash',
  'updatedAt',
] as const;

const PRE_CADASTRO_COLUMNS = ['id', 'criadoEm', 'tipoProva', 'normaTaf', 'participantesJson'] as const;

const EMAIL_AUTORIZADO_COLUMNS = [
  'id',
  'ownerUid',
  'email',
  'ativo',
  'criadoEm',
  'updatedAt',
  'syncStatus',
] as const;

const SYNC_QUEUE_COLUMNS = [
  'operationId',
  'operationType',
  'collection',
  'documentId',
  'payload',
  'timestamp',
  'retries',
  'status',
  'ownerUid',
  'error',
] as const;

const APP_META_COLUMNS = ['key', 'value'] as const;

export type ResultadoImportacaoBackupCsv = {
  cadastrosImportados: number;
  sessoesImportadas: number;
  aplicadoresImportados: number;
  preCadastrosImportados: number;
  emailsAutorizadosImportados: number;
  syncQueueImportados: number;
  appMetaImportados: number;
  erros: string[];
};

function optionalField(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}

function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : undefined;
}

function isTipoProvaAplicada(value: string): value is TipoProvaAplicada {
  return TIPOS_PROVA_APLICADA.has(value as TipoProvaAplicada);
}

function cadastroToRow(item: CadastroItemPersist): string {
  return csvRow(
    CADASTRO_COLUMNS.map((key) => {
      const value = item[key as keyof CadastroItemPersist];
      return value == null ? '' : String(value);
    }),
  );
}

function rowToCadastro(row: Record<string, string>): CadastroItemPersist | null {
  const id = row.id?.trim();
  const nip = row.nip?.trim();
  const nome = row.nome?.trim();
  const dataNascimento = row.dataNascimento?.trim() ?? '';
  const categoria = row.categoria?.trim() as CadastroItemPersist['categoria'];

  if (!id || !nip || !nome) return null;
  if (categoria !== 'Oficiais' && categoria !== 'Praças') return null;

  const item: CadastroItemPersist = {
    id,
    nip,
    nome,
    dataNascimento,
    categoria,
  };

  const sexo = row.sexo?.trim();
  if (sexo === 'M' || sexo === 'F') item.sexo = sexo;

  const oficial = optionalField(row.oficial ?? '');
  const praca = optionalField(row.praca ?? '');
  if (oficial) item.oficial = oficial;
  if (praca) item.praca = praca;

  for (const key of [
    'tempoCorrida',
    'tempoNatacao',
    'tempoCaminhada',
    'notaCorrida',
    'notaCaminhada',
    'notaNatacao',
    'tempoPermanencia',
    'dataTafCorrida',
    'dataTafNatacao',
    'dataTafCaminhada',
    'dataTafPermanencia',
    'rubricaCorridaSvg',
    'rubricaNatacaoSvg',
    'rubricaCaminhadaSvg',
    'rubricaPermanenciaSvg',
    'notaFlexaoBarra',
    'dataTafFlexaoBarra',
    'notaFlexaoSolo',
    'dataTafFlexaoSolo',
    'notaAbdominalRemador',
    'dataTafAbdominalRemador',
    'tempoAbdominalPrancha',
    'notaAbdominalPrancha',
    'dataTafAbdominalPrancha',
  ] as const) {
    const value = optionalField(row[key] ?? '');
    if (value) item[key] = value;
  }

  const modalidade = row.modalidadeDistanciaAtiva?.trim();
  if (modalidade === 'corrida' || modalidade === 'caminhada') {
    item.modalidadeDistanciaAtiva = modalidade;
  }

  const resultadoNatacao = row.resultadoNatacao?.trim();
  if (resultadoNatacao === 'aprovado' || resultadoNatacao === 'reprovado') {
    item.resultadoNatacao = resultadoNatacao;
  }

  const resultadoPermanencia = row.resultadoPermanencia?.trim();
  if (resultadoPermanencia === 'aprovado' || resultadoPermanencia === 'reprovado') {
    item.resultadoPermanencia = resultadoPermanencia;
  }

  const repsFlexaoBarra = optionalNumber(row.repsFlexaoBarra ?? '');
  const repsFlexaoSolo = optionalNumber(row.repsFlexaoSolo ?? '');
  const repsAbdominalRemador = optionalNumber(row.repsAbdominalRemador ?? '');
  const updatedAt = optionalNumber(row.updatedAt ?? '');
  if (repsFlexaoBarra != null) item.repsFlexaoBarra = repsFlexaoBarra;
  if (repsFlexaoSolo != null) item.repsFlexaoSolo = repsFlexaoSolo;
  if (repsAbdominalRemador != null) item.repsAbdominalRemador = repsAbdominalRemador;
  if (updatedAt != null) item.updatedAt = updatedAt;

  return item;
}

function aplicadorAssinaturaFromRow(row: Record<string, string>): SessaoAplicacaoTaf['aplicadorAssinatura'] {
  const aplicadorId = row.sessao_aplicadorId?.trim();
  const nome = row.sessao_aplicadorNome?.trim();
  const nip = row.sessao_aplicadorNip?.trim();
  const categoria = row.sessao_aplicadorCategoria?.trim() as 'Oficiais' | 'Praças' | '';
  const postoGrad = row.sessao_aplicadorPostoGrad?.trim();
  const rubricaSvg = optionalField(row.sessao_aplicadorRubricaSvg ?? '');

  if (!aplicadorId || !nome || !nip) return undefined;
  if (categoria !== 'Oficiais' && categoria !== 'Praças') return undefined;

  return {
    aplicadorId,
    nome,
    nip,
    categoria,
    postoGrad: postoGrad || '—',
    rubricaSvg,
  };
}

function sessaoRowsToSessoes(rows: Record<string, string>[]): SessaoAplicacaoTaf[] {
  const map = new Map<string, SessaoAplicacaoTaf>();

  for (const row of rows) {
    const id = row.sessao_id?.trim();
    if (!id) continue;

    let sessao = map.get(id);
    if (!sessao) {
      const tipo = row.sessao_tipoProva?.trim();
      if (!isTipoProvaAplicada(tipo)) continue;

      const normaRaw = row.sessao_normaTaf?.trim();
      const normaTaf =
        normaRaw === 'armada' || normaRaw === 'cfn' ? normaRaw : undefined;

      sessao = {
        id,
        criadoEm: row.sessao_criadoEm?.trim() || new Date().toISOString(),
        dataAplicacao: row.sessao_dataAplicacao?.trim() || '',
        tipoProva: tipo,
        resultados: [],
        normaTaf,
        aplicadorAssinatura: aplicadorAssinaturaFromRow(row),
      };

      const updatedAt = optionalNumber(row.sessao_updatedAt ?? '');
      if (updatedAt != null) sessao.updatedAt = updatedAt;

      map.set(id, sessao);
    }

    const nome = row.nome?.trim();
    const nip = row.nip?.trim();
    const corredorRaw = row.corredor?.trim();
    if (!nome && !nip && !corredorRaw) continue;

    const resultado: ResultadoCorridaItem = {
      corredor: Number(corredorRaw) || 0,
      nome: nome || '—',
      tempoMs: Number(row.tempoMs?.trim()) || 0,
      nip: nip || '',
    };

    const prova = row.prova?.trim();
    if (isTipoProvaAplicada(prova)) {
      resultado.prova = prova;
    }

    const desempenhoTexto = optionalField(row.desempenhoTexto ?? '');
    const notaTexto = optionalField(row.notaTexto ?? '');
    const noraTexto = optionalField(row.noraTexto ?? '');
    const reprovacaoTexto = optionalField(row.reprovacaoTexto ?? '');
    const rubricaCandidato = optionalField(row.rubricaCandidato ?? '');
    const rubricaCandidatoSvg = optionalField(row.rubricaCandidatoSvg ?? '');
    if (desempenhoTexto) resultado.desempenhoTexto = desempenhoTexto;
    if (notaTexto) resultado.notaTexto = notaTexto;
    if (noraTexto) resultado.noraTexto = noraTexto;
    if (reprovacaoTexto) resultado.reprovacaoTexto = reprovacaoTexto;
    if (rubricaCandidato) resultado.rubricaCandidato = rubricaCandidato;
    if (rubricaCandidatoSvg) resultado.rubricaCandidatoSvg = rubricaCandidatoSvg;

    sessao.resultados.push(resultado);
  }

  return [...map.values()];
}

function sessaoToRows(sessao: SessaoAplicacaoTaf): string[] {
  const assinatura = sessao.aplicadorAssinatura;
  const base = [
    sessao.id,
    sessao.criadoEm,
    sessao.dataAplicacao,
    sessao.tipoProva,
    sessao.normaTaf ?? '',
    sessao.updatedAt ?? '',
    assinatura?.aplicadorId ?? '',
    assinatura?.nome ?? '',
    assinatura?.nip ?? '',
    assinatura?.categoria ?? '',
    assinatura?.postoGrad ?? '',
    assinatura?.rubricaSvg ?? '',
  ];

  if (sessao.resultados.length === 0) {
    return [
      csvRow([
        ...base,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ]),
    ];
  }

  return sessao.resultados.map((resultado) =>
    csvRow([
      ...base,
      resultado.corredor,
      resultado.nome,
      resultado.tempoMs,
      resultado.nip,
      resultado.prova ?? '',
      resultado.desempenhoTexto ?? '',
      resultado.notaTexto ?? '',
      resultado.noraTexto ?? '',
      resultado.reprovacaoTexto ?? '',
      resultado.rubricaCandidato ?? '',
      resultado.rubricaCandidatoSvg ?? '',
    ]),
  );
}

function aplicadorToRow(item: AplicadorItemPersist): string {
  return csvRow(
    APLICADOR_COLUMNS.map((key) => {
      const value = item[key as keyof AplicadorItemPersist];
      return value == null ? '' : String(value);
    }),
  );
}

function rowToAplicador(row: Record<string, string>): AplicadorItemPersist | null {
  const id = row.id?.trim();
  const nip = row.nip?.trim();
  const nome = row.nome?.trim();
  const categoria = row.categoria?.trim() as AplicadorItemPersist['categoria'];
  if (!id || !nip || !nome) return null;
  if (categoria !== 'Oficiais' && categoria !== 'Praças') return null;

  const item: AplicadorItemPersist = { id, nip, nome, categoria };

  const sexo = row.sexo?.trim();
  if (sexo === 'M' || sexo === 'F') item.sexo = sexo;

  const oficial = optionalField(row.oficial ?? '');
  const praca = optionalField(row.praca ?? '');
  const senha = optionalField(row.senha ?? '');
  const senhaHash = optionalField(row.senhaHash ?? '');
  if (oficial) item.oficial = oficial;
  if (praca) item.praca = praca;
  if (senha) item.senha = senha;
  if (senhaHash) item.senhaHash = senhaHash;

  const updatedAt = optionalNumber(row.updatedAt ?? '');
  if (updatedAt != null) item.updatedAt = updatedAt;

  return item;
}

function preCadastroToRow(item: PreCadastroTaf): string {
  return csvRow([
    item.id,
    item.criadoEm,
    item.tipoProva,
    item.normaTaf ?? '',
    JSON.stringify(item.participantes),
  ]);
}

function rowToPreCadastro(row: Record<string, string>): PreCadastroTaf | null {
  const id = row.id?.trim();
  const criadoEm = optionalNumber(row.criadoEm ?? '');
  const tipoProva = row.tipoProva?.trim();
  if (!id || criadoEm == null || !isTipoProvaAplicada(tipoProva)) return null;

  let participantes: PreCadastroTaf['participantes'] = [];
  const json = row.participantesJson?.trim();
  if (json) {
    try {
      const parsed = JSON.parse(json) as PreCadastroTaf['participantes'];
      if (Array.isArray(parsed)) participantes = parsed;
    } catch {
      return null;
    }
  }

  const normaRaw = row.normaTaf?.trim();
  const normaTaf = normaRaw === 'armada' || normaRaw === 'cfn' ? normaRaw : undefined;

  return {
    id,
    criadoEm,
    tipoProva,
    normaTaf,
    participantes,
  };
}

function authorizedEmailToRow(item: LocalAuthorizedEmail): string {
  return csvRow([
    item.id,
    item.ownerUid,
    item.email,
    item.ativo === false ? 'false' : 'true',
    item.criadoEm == null ? '' : String(item.criadoEm),
    item.updatedAt,
    item.syncStatus,
  ]);
}

function rowToAuthorizedEmail(row: Record<string, string>): LocalAuthorizedEmail | null {
  const id = row.id?.trim();
  const ownerUid = row.ownerUid?.trim();
  const email = row.email?.trim();
  if (!id || !ownerUid || !email) return null;

  const ativoRaw = row.ativo?.trim().toLowerCase();
  const ativo = ativoRaw !== 'false' && ativoRaw !== '0';

  const syncStatus = row.syncStatus?.trim() as LocalAuthorizedEmail['syncStatus'];
  const validSyncStatus =
    syncStatus === 'local' || syncStatus === 'synced' || syncStatus === 'deleted'
      ? syncStatus
      : 'local';

  const updatedAt = optionalNumber(row.updatedAt ?? '') ?? Date.now();
  const criadoEmRaw = row.criadoEm?.trim();
  const criadoEm = criadoEmRaw ? criadoEmRaw : undefined;

  return {
    id,
    ownerUid,
    email,
    ativo,
    criadoEm,
    updatedAt,
    syncStatus: validSyncStatus,
  };
}

function syncQueueToRow(item: SyncQueueEntry): string {
  return csvRow(
    SYNC_QUEUE_COLUMNS.map((key) => {
      const value = item[key as keyof SyncQueueEntry];
      return value == null ? '' : String(value);
    }),
  );
}

function rowToSyncQueueEntry(row: Record<string, string>): SyncQueueEntry | null {
  const operationId = row.operationId?.trim();
  const operationType = row.operationType?.trim() as SyncQueueEntry['operationType'];
  const collection = row.collection?.trim() as SyncQueueEntry['collection'];
  const documentId = row.documentId?.trim();
  const payload = row.payload?.trim() ?? '';
  const timestamp = optionalNumber(row.timestamp ?? '');
  const retries = optionalNumber(row.retries ?? '') ?? 0;
  const status = row.status?.trim() as SyncQueueEntry['status'];
  const ownerUid = row.ownerUid?.trim();

  if (!operationId || !documentId || !ownerUid || timestamp == null) return null;
  if (operationType !== 'CREATE' && operationType !== 'UPDATE' && operationType !== 'DELETE') {
    return null;
  }
  if (
    collection !== 'cadastros' &&
    collection !== 'sessoes' &&
    collection !== 'aplicadores' &&
    collection !== 'pre_cadastros'
  ) {
    return null;
  }
  if (status !== 'pending' && status !== 'processing' && status !== 'done' && status !== 'failed') {
    return null;
  }

  const error = optionalField(row.error ?? '');

  return {
    operationId,
    operationType,
    collection,
    documentId,
    payload,
    timestamp,
    retries,
    status,
    ownerUid,
    error,
  };
}

function appMetaToRow(item: AppMetaBackupEntry): string {
  return csvRow([item.key, item.value]);
}

function rowToAppMeta(row: Record<string, string>): AppMetaBackupEntry | null {
  const key = row.key?.trim();
  const value = row.value ?? '';
  if (!key || !value.trim()) return null;
  return { key, value };
}

function extractSection(content: string, section: BackupSection): string {
  const marker = `# SECTION_${section}`;
  const start = content.indexOf(marker);
  if (start < 0) return '';
  const from = content.indexOf('\n', start);
  if (from < 0) return '';
  const rest = content.slice(from + 1);
  const next = rest.search(/\n# SECTION_/);
  return next < 0 ? rest.trim() : rest.slice(0, next).trim();
}

function emptyPayload(cadastros: CadastroItemPersist[], sessoes: SessaoAplicacaoTaf[]): SystemBackupPayload {
  return {
    cadastros,
    sessoes,
    aplicadores: [],
    preCadastros: [],
    authorizedEmails: [],
    syncQueue: [],
    appMeta: [],
  };
}

export function buildBackupCsvContent(payload: SystemBackupPayload): string;
export function buildBackupCsvContent(
  cadastros: CadastroItemPersist[],
  sessoes: SessaoAplicacaoTaf[],
): string;
export function buildBackupCsvContent(
  arg1: SystemBackupPayload | CadastroItemPersist[],
  arg2?: SessaoAplicacaoTaf[],
): string {
  const payload: SystemBackupPayload = Array.isArray(arg1)
    ? emptyPayload(arg1, arg2 ?? [])
    : arg1;

  const lines: string[] = [
    `# TAF_BACKUP_VERSION=${BACKUP_VERSION}`,
    `# EXPORTED_AT=${new Date().toISOString()}`,
    `# SECTION_CADASTROS`,
    csvRow([...CADASTRO_COLUMNS]),
    ...payload.cadastros.map(cadastroToRow),
    `# SECTION_SESSOES`,
    csvRow([...SESSAO_COLUMNS]),
    ...payload.sessoes.flatMap(sessaoToRows),
    `# SECTION_APLICADORES`,
    csvRow([...APLICADOR_COLUMNS]),
    ...payload.aplicadores.map(aplicadorToRow),
    `# SECTION_PRE_CADASTROS`,
    csvRow([...PRE_CADASTRO_COLUMNS]),
    ...payload.preCadastros.map(preCadastroToRow),
    `# SECTION_EMAILS_AUTORIZADOS`,
    csvRow([...EMAIL_AUTORIZADO_COLUMNS]),
    ...payload.authorizedEmails.map(authorizedEmailToRow),
    `# SECTION_SYNC_QUEUE`,
    csvRow([...SYNC_QUEUE_COLUMNS]),
    ...payload.syncQueue.map(syncQueueToRow),
    `# SECTION_APP_META`,
    csvRow([...APP_META_COLUMNS]),
    ...payload.appMeta.map(appMetaToRow),
  ];

  return `${lines.join('\n')}\n`;
}

function backupFilename(): string {
  return buildBackupApptafFilename();
}

export async function downloadBackupCsvFile(content: string, filename: string): Promise<void> {
  const { baixarTextoParaDownloads } = await import('./salvarArquivoNaPasta');
  const resultado = await baixarTextoParaDownloads({
    content,
    filename,
    mimeType: 'text/csv',
    uti: 'public.comma-separated-values-text',
    dialogTitle: 'Salvar backup CSV em Downloads',
  });
  if (!resultado.ok) {
    throw new Error('Seleção de pasta cancelada.');
  }
}

export async function exportarBackupTafCsvNaPasta(): Promise<{
  cadastros: number;
  sessoes: number;
  filename: string;
  mensagem: string;
}> {
  const { salvarConteudoTextoNaPastaEscolhida, mensagemSucessoSalvarNaPasta } = await import(
    './salvarArquivoNaPasta'
  );
  const payload = await gatherSystemBackupData();
  const content = buildBackupCsvContent(payload);
  const filename = backupFilename();
  const resultado = await salvarConteudoTextoNaPastaEscolhida({
    content,
    filename,
    mimeType: 'text/csv',
    uti: 'public.comma-separated-values-text',
    dialogTitle: 'Salvar backup CSV na pasta',
  });
  if (!resultado.ok) {
    throw new Error('Seleção de pasta cancelada.');
  }
  return {
    cadastros: payload.cadastros.length,
    sessoes: payload.sessoes.length,
    filename,
    mensagem: mensagemSucessoSalvarNaPasta(resultado),
  };
}

export async function exportarBackupTafCsv(): Promise<{
  cadastros: number;
  sessoes: number;
  filename: string;
  mensagem: string;
}> {
  const { baixarTextoParaDownloads, mensagemSucessoSalvarNaPasta } = await import(
    './salvarArquivoNaPasta'
  );
  const payload = await gatherSystemBackupData();
  const content = buildBackupCsvContent(payload);
  const filename = backupFilename();
  const resultado = await baixarTextoParaDownloads({
    content,
    filename,
    mimeType: 'text/csv',
    uti: 'public.comma-separated-values-text',
    dialogTitle: 'Salvar backup CSV em Downloads',
  });
  if (!resultado.ok) {
    throw new Error('Seleção de pasta cancelada.');
  }
  return {
    cadastros: payload.cadastros.length,
    sessoes: payload.sessoes.length,
    filename,
    mensagem: mensagemSucessoSalvarNaPasta(resultado),
  };
}

export async function importarBackupTafCsv(text: string): Promise<ResultadoImportacaoBackupCsv> {
  const erros: string[] = [];

  const cadastrosSection = extractSection(text, 'CADASTROS');
  const sessoesSection = extractSection(text, 'SESSOES');
  const aplicadoresSection = extractSection(text, 'APLICADORES');
  const preCadastrosSection = extractSection(text, 'PRE_CADASTROS');
  const emailsSection = extractSection(text, 'EMAILS_AUTORIZADOS');
  const syncQueueSection = extractSection(text, 'SYNC_QUEUE');
  const appMetaSection = extractSection(text, 'APP_META');

  if (
    !cadastrosSection &&
    !sessoesSection &&
    !aplicadoresSection &&
    !preCadastrosSection &&
    !emailsSection &&
    !syncQueueSection &&
    !appMetaSection
  ) {
    throw new Error('Arquivo inválido. Use um backup gerado em Configurações → Backup em CSV.');
  }

  const cadastros: CadastroItemPersist[] = [];
  if (cadastrosSection) {
    const { rows } = recordsToObjects<Record<string, string>>(parseCsvRecords(cadastrosSection));
    for (const row of rows) {
      const item = rowToCadastro(row);
      if (!item) {
        if (row.nip || row.nome) {
          erros.push(`Cadastro ignorado (dados incompletos): NIP ${row.nip || '—'}`);
        }
        continue;
      }
      cadastros.push(item);
    }
  }

  const sessoes = sessoesSection
    ? sessaoRowsToSessoes(
        recordsToObjects<Record<string, string>>(parseCsvRecords(sessoesSection)).rows,
      )
    : [];

  const aplicadores: AplicadorItemPersist[] = [];
  if (aplicadoresSection) {
    const { rows } = recordsToObjects<Record<string, string>>(parseCsvRecords(aplicadoresSection));
    for (const row of rows) {
      const item = rowToAplicador(row);
      if (!item) {
        if (row.nip || row.nome) {
          erros.push(`Aplicador ignorado (dados incompletos): NIP ${row.nip || '—'}`);
        }
        continue;
      }
      aplicadores.push(item);
    }
  }

  const preCadastros: PreCadastroTaf[] = [];
  if (preCadastrosSection) {
    const { rows } = recordsToObjects<Record<string, string>>(parseCsvRecords(preCadastrosSection));
    for (const row of rows) {
      const item = rowToPreCadastro(row);
      if (!item) {
        if (row.id) {
          erros.push(`Pré-cadastro ignorado (dados inválidos): ${row.id}`);
        }
        continue;
      }
      preCadastros.push(item);
    }
  }

  const authorizedEmails: LocalAuthorizedEmail[] = [];
  if (emailsSection) {
    const { rows } = recordsToObjects<Record<string, string>>(parseCsvRecords(emailsSection));
    for (const row of rows) {
      const item = rowToAuthorizedEmail(row);
      if (!item) {
        if (row.email) {
          erros.push(`E-mail autorizado ignorado: ${row.email}`);
        }
        continue;
      }
      authorizedEmails.push(item);
    }
  }

  const syncQueueEntries: SyncQueueEntry[] = [];
  if (syncQueueSection) {
    const { rows } = recordsToObjects<Record<string, string>>(parseCsvRecords(syncQueueSection));
    for (const row of rows) {
      const item = rowToSyncQueueEntry(row);
      if (!item) {
        if (row.operationId) {
          erros.push(`Item da fila de sync ignorado: ${row.operationId}`);
        }
        continue;
      }
      syncQueueEntries.push(item);
    }
  }

  const appMetaEntries: AppMetaBackupEntry[] = [];
  if (appMetaSection) {
    const { rows } = recordsToObjects<Record<string, string>>(parseCsvRecords(appMetaSection));
    for (const row of rows) {
      const item = rowToAppMeta(row);
      if (!item) continue;
      if (item.key === DAILY_BACKUP_META_KEY) continue;
      appMetaEntries.push(item);
    }
  }

  if (cadastros.length > 0) {
    await addCadastrosEmLote(cadastros);
  }

  for (const sessao of sessoes) {
    await updateSessaoAplicacao(sessao);
  }

  for (const aplicador of aplicadores) {
    await addAplicador(aplicador);
  }

  for (const preCadastro of preCadastros) {
    await addPreCadastroTaf(preCadastro);
  }

  const db = getTafDatabase();
  if (db) {
    if (authorizedEmails.length > 0) {
      await db.authorizedEmails.bulkPut(authorizedEmails);
    }
    if (syncQueueEntries.length > 0) {
      await db.syncQueue.bulkPut(syncQueueEntries);
    }
  }

  for (const meta of appMetaEntries) {
    await writeAppMeta(meta.key, meta.value);
  }

  return {
    cadastrosImportados: cadastros.length,
    sessoesImportadas: sessoes.length,
    aplicadoresImportados: aplicadores.length,
    preCadastrosImportados: preCadastros.length,
    emailsAutorizadosImportados: authorizedEmails.length,
    syncQueueImportados: syncQueueEntries.length,
    appMetaImportados: appMetaEntries.length,
    erros,
  };
}

export async function readBackupCsvFile(file: File | { uri: string }): Promise<string> {
  if (file instanceof File) {
    return file.text();
  }
  const response = await fetch(file.uri);
  return response.text();
}
