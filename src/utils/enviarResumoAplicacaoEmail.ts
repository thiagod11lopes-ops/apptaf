import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { ResultadoCorridaItem } from '../navigation/AppNavigator';
import type { AplicadorAssinaturaResumo } from '../types/aplicadorAssinatura';
import { buildBackupCsvContent } from './backupTafCsv';
import { buildBackupApptafFilename } from './backupNaming';
import { gatherSystemBackupData } from './gatherSystemBackupData';
import {
  buildResumoAplicacaoHtml,
  tituloProvaResumoPdf,
} from './exportResumoAplicacaoPdf';
import { PDF_A4_LANDSCAPE_HEIGHT, PDF_A4_LANDSCAPE_WIDTH } from './pdfLayout';
import { sanitizarNomeArquivo } from './salvarArquivoNaPasta';

/** @deprecated Mantido só por compatibilidade — o envio agora é um único compartilhar. */
export type ProvedorEmailResultado = 'gmail' | 'zimbra' | 'outros';

export type ResultadoEnvioEmail = {
  mensagem: string;
};

export function montarAssuntoEmailResumo(resultados: ResultadoCorridaItem[]): string {
  const prova = tituloProvaResumoPdf(resultados);
  const data = new Date().toLocaleDateString('pt-BR');
  return `Resultados TAF — ${prova} — ${data}`;
}

export function montarCorpoEmailResumo(resultados: ResultadoCorridaItem[]): string {
  const prova = tituloProvaResumoPdf(resultados);
  const qtd = resultados.length;
  return [
    'Seguem em anexo:',
    '1) PDF com o resumo da aplicação do TAF',
    '2) CSV de backup (Cadastros/Sessões) para importar em outro dispositivo',
    '',
    `Prova: ${prova}`,
    `Participantes: ${qtd}`,
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    '',
    'No outro aparelho: Configurações → Backup em CSV → Importar.',
    '',
    '— App TAF',
  ].join('\n');
}

function nomeArquivoPdf(resultados: ResultadoCorridaItem[]): string {
  const prova = sanitizarNomeArquivo(tituloProvaResumoPdf(resultados)).replace(/\s+/g, '_');
  const data = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  return sanitizarNomeArquivo(`Resultado_TAF_${prova}_${data}`, '.pdf');
}

export type PdfResumoPronto = {
  uri: string;
  filename: string;
  subject: string;
  body: string;
  html: string;
  csvContent: string;
  csvFilename: string;
  csvUri: string;
  /** @deprecated Prefira webFiles — relatório web. */
  webFile?: File;
  /** Anexos web (relatório + CSV) para Web Share. */
  webFiles?: File[];
};

export function urlMailto(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function urlGmailCompose(subject: string, body: string): string {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    tf: '1',
    su: subject,
    body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export function urlComposerParaProvedor(
  _provedor: ProvedorEmailResultado,
  subject: string,
  body: string,
): string {
  return urlMailto(subject, body);
}

function anexosUris(pdf: PdfResumoPronto): string[] {
  return [pdf.uri, pdf.csvUri].filter(Boolean);
}

async function escreverTextoNoCache(content: string, filename: string): Promise<string> {
  const FileSystem = await import('expo-file-system/legacy');
  const safe = sanitizarNomeArquivo(filename);
  const uri = `${FileSystem.cacheDirectory ?? ''}${safe}`;
  await FileSystem.writeAsStringAsync(uri, content);
  return uri;
}

/** Monta HTML/assunto de forma síncrona (sem await). CSV vem depois. */
export function montarConteudoEmailResumoSync(
  resultados: ResultadoCorridaItem[],
  textoColunaCadastro: string,
  aplicadorAssinatura?: AplicadorAssinaturaResumo,
): Omit<PdfResumoPronto, 'csvContent' | 'csvFilename' | 'csvUri'> & {
  csvContent: string;
  csvFilename: string;
  csvUri: string;
} {
  if (resultados.length === 0) {
    throw new Error('Não há resultados para enviar.');
  }
  const html = buildResumoAplicacaoHtml(resultados, textoColunaCadastro, undefined, aplicadorAssinatura);
  return {
    uri: '',
    filename: nomeArquivoPdf(resultados),
    subject: montarAssuntoEmailResumo(resultados),
    body: montarCorpoEmailResumo(resultados),
    html,
    csvContent: '',
    csvFilename: buildBackupApptafFilename(),
    csvUri: '',
  };
}

/**
 * Prepara PDF + CSV de backup (importável) — sem abrir na tela.
 */
export async function prepararAnexoEmailResumo(
  resultados: ResultadoCorridaItem[],
  textoColunaCadastro: string,
  aplicadorAssinatura?: AplicadorAssinaturaResumo,
): Promise<PdfResumoPronto> {
  const base = montarConteudoEmailResumoSync(resultados, textoColunaCadastro, aplicadorAssinatura);
  const payload = await gatherSystemBackupData();
  const csvContent = buildBackupCsvContent(payload);
  const csvFilename = buildBackupApptafFilename();

  if (Platform.OS === 'web' && typeof File !== 'undefined' && typeof window !== 'undefined') {
    const reportBlob = new Blob([base.html], { type: 'text/html;charset=utf-8' });
    const reportName = base.filename.replace(/\.pdf$/i, '.html');
    const reportFile = new File([reportBlob], reportName, { type: 'text/html;charset=utf-8' });
    const csvFile = new File([csvContent], csvFilename, { type: 'text/csv;charset=utf-8' });
    return {
      ...base,
      csvContent,
      csvFilename,
      webFile: reportFile,
      webFiles: [reportFile, csvFile],
    };
  }

  const [{ uri }, csvUri] = await Promise.all([
    Print.printToFileAsync({
      html: base.html,
      width: PDF_A4_LANDSCAPE_WIDTH,
      height: PDF_A4_LANDSCAPE_HEIGHT,
    }),
    escreverTextoNoCache(csvContent, csvFilename),
  ]);

  return {
    ...base,
    uri,
    csvContent,
    csvFilename,
    csvUri,
  };
}

/** @deprecated Use prepararAnexoEmailResumo */
export async function prepararPdfResumoAplicacao(
  resultados: ResultadoCorridaItem[],
  textoColunaCadastro: string,
  aplicadorAssinatura?: AplicadorAssinaturaResumo,
): Promise<PdfResumoPronto> {
  return prepararAnexoEmailResumo(resultados, textoColunaCadastro, aplicadorAssinatura);
}

async function enviarViaMailComposer(pdf: PdfResumoPronto): Promise<boolean> {
  try {
    const attachments = anexosUris(pdf);
    if (attachments.length === 0) return false;
    const MailComposer = await import('expo-mail-composer');
    const available = await MailComposer.isAvailableAsync();
    if (!available) return false;
    await MailComposer.composeAsync({
      subject: pdf.subject,
      body: pdf.body,
      attachments,
    });
    return true;
  } catch {
    return false;
  }
}

async function enviarViaShareMultiploAndroid(pdf: PdfResumoPronto): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const uris = anexosUris(pdf);
  if (uris.length < 2) return false;
  try {
    const FileSystem = await import('expo-file-system/legacy');
    const IntentLauncher = await import('expo-intent-launcher');
    const contentUris: string[] = [];
    for (const uri of uris) {
      contentUris.push(await FileSystem.getContentUriAsync(uri));
    }
    await IntentLauncher.startActivityAsync('android.intent.action.SEND_MULTIPLE', {
      type: '*/*',
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      extra: {
        'android.intent.extra.STREAM': contentUris,
        'android.intent.extra.SUBJECT': pdf.subject,
        'android.intent.extra.TEXT': pdf.body,
        'android.intent.extra.TITLE': 'Enviar Resultados',
      },
    });
    return true;
  } catch {
    return false;
  }
}

async function enviarViaShareUmArquivo(uri: string, mimeType: string, dialogTitle: string): Promise<boolean> {
  try {
    if (!uri) return false;
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) return false;
    await Sharing.shareAsync(uri, {
      mimeType,
      dialogTitle,
      UTI: mimeType === 'text/csv' ? 'public.comma-separated-values-text' : 'com.adobe.pdf',
    });
    return true;
  } catch {
    return false;
  }
}

async function compartilharAnexoWeb(pdf: PdfResumoPronto): Promise<boolean> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  const files = pdf.webFiles?.length ? pdf.webFiles : pdf.webFile ? [pdf.webFile] : [];
  if (files.length === 0) return false;

  try {
    const payload: ShareData = {
      files,
      title: pdf.subject,
      text: pdf.body,
    };
    if (typeof navigator.canShare === 'function' && !navigator.canShare(payload)) {
      // Tenta só o CSV (essencial para atualizar outros dispositivos)
      const csvOnly = files.filter((f) => f.name.toLowerCase().endsWith('.csv'));
      if (csvOnly.length === 0) return false;
      const csvPayload: ShareData = { files: csvOnly, title: pdf.subject, text: pdf.body };
      if (!navigator.canShare(csvPayload)) return false;
      await navigator.share(csvPayload);
      return true;
    }
    await navigator.share(payload);
    return true;
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') return true;
    return false;
  }
}

function abrirMailtoWeb(pdf: PdfResumoPronto): boolean {
  if (typeof window === 'undefined') return false;
  window.location.href = urlMailto(pdf.subject, pdf.body);
  return true;
}

/**
 * Compartilha PDF + CSV de backup — abre o seletor de apps.
 * O CSV pode ser importado em outro dispositivo (Configurações → Backup em CSV).
 */
export async function compartilharResultadosAnexo(
  pdf: PdfResumoPronto,
): Promise<ResultadoEnvioEmail> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (await compartilharAnexoWeb(pdf)) {
      return {
        mensagem:
          'Escolha o aplicativo — PDF/relatório e CSV de backup vão anexados. No outro aparelho: Configurações → Importar CSV.',
      };
    }
    if (abrirMailtoWeb(pdf)) {
      return {
        mensagem:
          'E-mail aberto. Neste navegador o anexo automático pode falhar — use “Salvar PDF na pasta…” e o Backup CSV em Configurações.',
      };
    }
  }

  if (await enviarViaShareMultiploAndroid(pdf)) {
    return {
      mensagem:
        'Escolha o aplicativo — PDF e CSV anexados. No outro aparelho: Configurações → Backup em CSV → Importar.',
    };
  }

  if (await enviarViaMailComposer(pdf)) {
    return {
      mensagem:
        'App de e-mail aberto com PDF e CSV anexados. No outro aparelho: Configurações → Backup em CSV → Importar.',
    };
  }

  // Fallback: compartilha CSV (prioritário para sync) e depois o PDF
  const compartilhouCsv = await enviarViaShareUmArquivo(
    pdf.csvUri,
    'text/csv',
    'Enviar CSV de backup',
  );
  const compartilhouPdf = await enviarViaShareUmArquivo(
    pdf.uri,
    'application/pdf',
    'Enviar PDF do resultado',
  );

  if (compartilhouCsv || compartilhouPdf) {
    return {
      mensagem: compartilhouCsv && compartilhouPdf
        ? 'Arquivos compartilhados (CSV + PDF). No outro aparelho: Configurações → Backup em CSV → Importar.'
        : compartilhouCsv
          ? 'CSV de backup compartilhado. No outro aparelho: Configurações → Backup em CSV → Importar.'
          : 'PDF compartilhado. Para sincronizar dados, exporte também o Backup CSV em Configurações.',
    };
  }

  throw new Error(
    'Não foi possível compartilhar os arquivos. Verifique se há um app de e-mail instalado.',
  );
}

/** @deprecated Use compartilharResultadosAnexo */
export async function enviarAnexoResultadoPorEmail(
  _provedor: ProvedorEmailResultado,
  pdf: PdfResumoPronto,
): Promise<ResultadoEnvioEmail> {
  return compartilharResultadosAnexo(pdf);
}

export async function executarEnvioResultadoPorEmail(options: {
  provedor?: ProvedorEmailResultado;
  resultados: ResultadoCorridaItem[];
  textoColunaCadastro: string;
  aplicadorAssinatura?: AplicadorAssinaturaResumo;
  abrirEmailNoGesto?: boolean;
  anexoPronto?: PdfResumoPronto;
}): Promise<ResultadoEnvioEmail> {
  const pdf =
    options.anexoPronto ??
    (await prepararAnexoEmailResumo(
      options.resultados,
      options.textoColunaCadastro,
      options.aplicadorAssinatura,
    ));
  return compartilharResultadosAnexo(pdf);
}

/** @deprecated Use compartilharResultadosAnexo */
export async function enviarPdfResumoPorEmail(
  _provedor: ProvedorEmailResultado,
  pdf: PdfResumoPronto,
): Promise<ResultadoEnvioEmail> {
  return compartilharResultadosAnexo(pdf);
}
