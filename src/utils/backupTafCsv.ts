import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { addCadastrosEmLote, getAllCadastros } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import {
  getAllSessoesAplicacao,
  updateSessaoAplicacao,
} from '../services/resultadosAplicadosIndexedDb';
import type { ResultadoCorridaItem } from '../navigation/types';
import { csvRow, parseCsvRecords, recordsToObjects } from './csvText';
import { buildBackupApptafFilename } from './backupNaming';

const BACKUP_VERSION = '1';

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
  'notaCorrida',
  'notaNatacao',
  'resultadoNatacao',
  'resultadoPermanencia',
  'tempoPermanencia',
  'dataTafCorrida',
  'dataTafNatacao',
  'dataTafPermanencia',
  'rubricaCorridaSvg',
  'rubricaNatacaoSvg',
  'rubricaPermanenciaSvg',
] as const;

const SESSAO_COLUMNS = [
  'sessao_id',
  'sessao_criadoEm',
  'sessao_dataAplicacao',
  'sessao_tipoProva',
  'corredor',
  'nome',
  'tempoMs',
  'nip',
  'prova',
  'notaTexto',
  'noraTexto',
  'reprovacaoTexto',
  'rubricaCandidato',
  'rubricaCandidatoSvg',
] as const;

export type ResultadoImportacaoBackupCsv = {
  cadastrosImportados: number;
  sessoesImportadas: number;
  erros: string[];
};

function optionalField(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
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
    'notaCorrida',
    'notaNatacao',
    'tempoPermanencia',
    'dataTafCorrida',
    'dataTafNatacao',
    'dataTafPermanencia',
    'rubricaCorridaSvg',
    'rubricaNatacaoSvg',
    'rubricaPermanenciaSvg',
  ] as const) {
    const value = optionalField(row[key] ?? '');
    if (value) item[key] = value;
  }

  const resultadoNatacao = row.resultadoNatacao?.trim();
  if (resultadoNatacao === 'aprovado' || resultadoNatacao === 'reprovado') {
    item.resultadoNatacao = resultadoNatacao;
  }

  const resultadoPermanencia = row.resultadoPermanencia?.trim();
  if (resultadoPermanencia === 'aprovado' || resultadoPermanencia === 'reprovado') {
    item.resultadoPermanencia = resultadoPermanencia;
  }

  return item;
}

function sessaoRowsToSessoes(rows: Record<string, string>[]): SessaoAplicacaoTaf[] {
  const map = new Map<string, SessaoAplicacaoTaf>();

  for (const row of rows) {
    const id = row.sessao_id?.trim();
    if (!id) continue;

    let sessao = map.get(id);
    if (!sessao) {
      const tipo = row.sessao_tipoProva?.trim() as SessaoAplicacaoTaf['tipoProva'];
      if (tipo !== 'corrida' && tipo !== 'natacao' && tipo !== 'permanencia') continue;
      sessao = {
        id,
        criadoEm: row.sessao_criadoEm?.trim() || new Date().toISOString(),
        dataAplicacao: row.sessao_dataAplicacao?.trim() || '',
        tipoProva: tipo,
        resultados: [],
      };
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
    if (prova === 'corrida' || prova === 'natacao' || prova === 'permanencia') {
      resultado.prova = prova;
    }

    const notaTexto = optionalField(row.notaTexto ?? '');
    const noraTexto = optionalField(row.noraTexto ?? '');
    const reprovacaoTexto = optionalField(row.reprovacaoTexto ?? '');
    const rubricaCandidato = optionalField(row.rubricaCandidato ?? '');
    const rubricaCandidatoSvg = optionalField(row.rubricaCandidatoSvg ?? '');
    if (notaTexto) resultado.notaTexto = notaTexto;
    if (noraTexto) resultado.noraTexto = noraTexto;
    if (reprovacaoTexto) resultado.reprovacaoTexto = reprovacaoTexto;
    if (rubricaCandidato) resultado.rubricaCandidato = rubricaCandidato;
    if (rubricaCandidatoSvg) resultado.rubricaCandidatoSvg = rubricaCandidatoSvg;

    sessao.resultados.push(resultado);
  }

  return [...map.values()];
}

function extractSection(content: string, section: 'CADASTROS' | 'SESSOES'): string {
  const marker = `# SECTION_${section}`;
  const start = content.indexOf(marker);
  if (start < 0) return '';
  const from = content.indexOf('\n', start);
  if (from < 0) return '';
  const rest = content.slice(from + 1);
  const next = rest.search(/\n# SECTION_/);
  return next < 0 ? rest.trim() : rest.slice(0, next).trim();
}

export function buildBackupCsvContent(
  cadastros: CadastroItemPersist[],
  sessoes: SessaoAplicacaoTaf[],
): string {
  const lines: string[] = [
    `# TAF_BACKUP_VERSION=${BACKUP_VERSION}`,
    `# EXPORTED_AT=${new Date().toISOString()}`,
    `# SECTION_CADASTROS`,
    csvRow([...CADASTRO_COLUMNS]),
    ...cadastros.map(cadastroToRow),
    `# SECTION_SESSOES`,
    csvRow([...SESSAO_COLUMNS]),
  ];

  for (const sessao of sessoes) {
    if (sessao.resultados.length === 0) {
      lines.push(
        csvRow([
          sessao.id,
          sessao.criadoEm,
          sessao.dataAplicacao,
          sessao.tipoProva,
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
      );
      continue;
    }

    for (const resultado of sessao.resultados) {
      lines.push(
        csvRow([
          sessao.id,
          sessao.criadoEm,
          sessao.dataAplicacao,
          sessao.tipoProva,
          resultado.corredor,
          resultado.nome,
          resultado.tempoMs,
          resultado.nip,
          resultado.prova ?? '',
          resultado.notaTexto ?? '',
          resultado.noraTexto ?? '',
          resultado.reprovacaoTexto ?? '',
          resultado.rubricaCandidato ?? '',
          resultado.rubricaCandidatoSvg ?? '',
        ]),
      );
    }
  }

  return `${lines.join('\n')}\n`;
}

function backupFilename(): string {
  return buildBackupApptafFilename();
}

export async function downloadBackupCsvFile(content: string, filename: string): Promise<void> {
  await shareOrDownloadCsv(content, filename);
}

async function shareOrDownloadCsv(content: string, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') {
      throw new Error('Download indisponível neste ambiente.');
    }
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  const FileSystem = await import('expo-file-system/legacy');
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, content);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Compartilhamento indisponível neste dispositivo.');
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Backup TAF — CSV',
    UTI: 'public.comma-separated-values-text',
  });
}

export async function exportarBackupTafCsv(): Promise<{
  cadastros: number;
  sessoes: number;
  filename: string;
}> {
  const [cadastros, sessoes] = await Promise.all([getAllCadastros(), getAllSessoesAplicacao()]);
  const content = buildBackupCsvContent(cadastros, sessoes);
  const filename = backupFilename();
  await shareOrDownloadCsv(content, filename);
  return { cadastros: cadastros.length, sessoes: sessoes.length, filename };
}

export async function importarBackupTafCsv(text: string): Promise<ResultadoImportacaoBackupCsv> {
  const erros: string[] = [];
  const cadastrosSection = extractSection(text, 'CADASTROS');
  const sessoesSection = extractSection(text, 'SESSOES');

  if (!cadastrosSection && !sessoesSection) {
    throw new Error(
      'Arquivo inválido. Use um backup gerado em Configurações → Backup em CSV.',
    );
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
    ? sessaoRowsToSessoes(recordsToObjects<Record<string, string>>(parseCsvRecords(sessoesSection)).rows)
    : [];

  if (cadastros.length > 0) {
    await addCadastrosEmLote(cadastros);
  }

  for (const sessao of sessoes) {
    await updateSessaoAplicacao(sessao);
  }

  return {
    cadastrosImportados: cadastros.length,
    sessoesImportadas: sessoes.length,
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
