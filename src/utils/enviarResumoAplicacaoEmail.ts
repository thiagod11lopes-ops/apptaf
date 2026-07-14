import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { ResultadoCorridaItem } from '../navigation/AppNavigator';
import type { AplicadorAssinaturaResumo } from '../types/aplicadorAssinatura';
import {
  buildResumoAplicacaoHtml,
  tituloProvaResumoPdf,
} from './exportResumoAplicacaoPdf';
import { PDF_A4_LANDSCAPE_HEIGHT, PDF_A4_LANDSCAPE_WIDTH } from './pdfLayout';
import { sanitizarNomeArquivo } from './salvarArquivoNaPasta';

export type ProvedorEmailResultado = 'gmail' | 'zimbra' | 'outros';

export type OpcaoEmailResultado = {
  id: ProvedorEmailResultado;
  titulo: string;
  subtitulo: string;
  disponivel: boolean;
};

export type ResultadoEnvioEmail = {
  mensagem: string;
};

const GMAIL_PACKAGES = ['com.google.android.gm'] as const;
const ZIMBRA_PACKAGES = [
  'com.zimbra.client',
  'com.zimbra.android',
  'com.zimbra.zmclient',
  'com.synacor.zimbra',
] as const;

const FLAG_GRANT_READ_URI_PERMISSION = 1;

export function montarAssuntoEmailResumo(resultados: ResultadoCorridaItem[]): string {
  const prova = tituloProvaResumoPdf(resultados);
  const data = new Date().toLocaleDateString('pt-BR');
  return `Resultados TAF — ${prova} — ${data}`;
}

export function montarCorpoEmailResumo(resultados: ResultadoCorridaItem[]): string {
  const prova = tituloProvaResumoPdf(resultados);
  const qtd = resultados.length;
  return [
    'Segue em anexo o PDF com o resumo da aplicação do TAF.',
    '',
    `Prova: ${prova}`,
    `Participantes: ${qtd}`,
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
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
  /** Anexo web (File) — nunca aberto em aba; só share/anexo. */
  webFile?: File;
};

export async function listarOpcoesEmailResultado(): Promise<OpcaoEmailResultado[]> {
  return [
    {
      id: 'gmail',
      titulo: 'Gmail',
      subtitulo: 'Abrir Gmail com o PDF anexado',
      disponivel: true,
    },
    {
      id: 'zimbra',
      titulo: 'Zimbra',
      subtitulo: 'Abrir Zimbra com o PDF anexado',
      disponivel: true,
    },
    {
      id: 'outros',
      titulo: 'Outros',
      subtitulo: 'Escolher app de e-mail com o PDF anexado',
      disponivel: true,
    },
  ];
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

export function urlMailto(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function urlComposerParaProvedor(
  provedor: ProvedorEmailResultado,
  subject: string,
  body: string,
): string {
  if (provedor === 'gmail' && Platform.OS === 'web') {
    return urlGmailCompose(subject, body);
  }
  return urlMailto(subject, body);
}

/** Monta HTML/assunto de forma síncrona (sem await). */
export function montarConteudoEmailResumoSync(
  resultados: ResultadoCorridaItem[],
  textoColunaCadastro: string,
  aplicadorAssinatura?: AplicadorAssinaturaResumo,
): PdfResumoPronto {
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
  };
}

/**
 * Prepara o anexo em cache / memória — sem abrir PDF, sem download, sem janela.
 * Chamar ao abrir o modal para o clique só abrir o e-mail com anexo.
 */
export async function prepararAnexoEmailResumo(
  resultados: ResultadoCorridaItem[],
  textoColunaCadastro: string,
  aplicadorAssinatura?: AplicadorAssinaturaResumo,
): Promise<PdfResumoPronto> {
  const base = montarConteudoEmailResumoSync(resultados, textoColunaCadastro, aplicadorAssinatura);

  if (Platform.OS === 'web') {
    // Na web o navegador não gera PDF silencioso; usamos o HTML do relatório
    // como File só para o Web Share (anexo), sem abrir aba nem forçar download.
    if (typeof File !== 'undefined') {
      const blob = new Blob([base.html], { type: 'text/html;charset=utf-8' });
      const webName = base.filename.replace(/\.pdf$/i, '.html');
      const webFile = new File([blob], webName, { type: 'text/html;charset=utf-8' });
      return { ...base, webFile };
    }
    return base;
  }

  const { uri } = await Print.printToFileAsync({
    html: base.html,
    width: PDF_A4_LANDSCAPE_WIDTH,
    height: PDF_A4_LANDSCAPE_HEIGHT,
  });
  return { ...base, uri };
}

/** @deprecated Use prepararAnexoEmailResumo */
export async function prepararPdfResumoAplicacao(
  resultados: ResultadoCorridaItem[],
  textoColunaCadastro: string,
  aplicadorAssinatura?: AplicadorAssinaturaResumo,
): Promise<PdfResumoPronto> {
  return prepararAnexoEmailResumo(resultados, textoColunaCadastro, aplicadorAssinatura);
}

/** @deprecated */
export async function gerarPdfArquivoNativo(conteudo: PdfResumoPronto): Promise<PdfResumoPronto> {
  if (Platform.OS === 'web' || conteudo.uri) return conteudo;
  const { uri } = await Print.printToFileAsync({
    html: conteudo.html,
    width: PDF_A4_LANDSCAPE_WIDTH,
    height: PDF_A4_LANDSCAPE_HEIGHT,
  });
  return { ...conteudo, uri };
}

async function enviarViaIntentAndroid(
  pdf: PdfResumoPronto,
  packageNames: readonly string[],
): Promise<boolean> {
  try {
    if (!pdf.uri) return false;
    const FileSystem = await import('expo-file-system/legacy');
    const IntentLauncher = await import('expo-intent-launcher');
    const contentUri = await FileSystem.getContentUriAsync(pdf.uri);

    for (const packageName of packageNames) {
      try {
        await IntentLauncher.startActivityAsync('android.intent.action.SEND', {
          type: 'application/pdf',
          packageName,
          flags: FLAG_GRANT_READ_URI_PERMISSION,
          extra: {
            'android.intent.extra.STREAM': contentUri,
            'android.intent.extra.SUBJECT': pdf.subject,
            'android.intent.extra.TEXT': pdf.body,
            'android.intent.extra.TITLE': pdf.filename,
          },
        });
        return true;
      } catch {
        // próximo
      }
    }
  } catch {
    return false;
  }
  return false;
}

async function enviarViaMailComposer(pdf: PdfResumoPronto): Promise<boolean> {
  try {
    if (!pdf.uri) return false;
    const MailComposer = await import('expo-mail-composer');
    const available = await MailComposer.isAvailableAsync();
    if (!available) return false;
    await MailComposer.composeAsync({
      subject: pdf.subject,
      body: pdf.body,
      attachments: [pdf.uri],
    });
    return true;
  } catch {
    return false;
  }
}

async function enviarViaShare(pdf: PdfResumoPronto): Promise<boolean> {
  try {
    if (!pdf.uri) return false;
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) return false;
    await Sharing.shareAsync(pdf.uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Enviar resultado por e-mail',
      UTI: 'com.adobe.pdf',
    });
    return true;
  } catch {
    return false;
  }
}

/** Web Share com arquivo (anexo) — não abre o relatório na tela. */
async function compartilharAnexoWeb(pdf: PdfResumoPronto): Promise<boolean> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  const file = pdf.webFile;
  if (!file) return false;

  try {
    const payload: ShareData = {
      files: [file],
      title: pdf.subject,
      text: pdf.body,
    };
    if (typeof navigator.canShare === 'function' && !navigator.canShare(payload)) {
      return false;
    }
    await navigator.share(payload);
    return true;
  } catch (e: unknown) {
    // Usuário cancelou o sheet — não tratar como falha grave
    if (e instanceof Error && e.name === 'AbortError') return true;
    return false;
  }
}

function abrirComposerWebSemAnexo(provedor: ProvedorEmailResultado, pdf: PdfResumoPronto): boolean {
  if (typeof window === 'undefined') return false;
  const url = urlComposerParaProvedor(provedor, pdf.subject, pdf.body);
  if (provedor === 'gmail') {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (win) return true;
    window.location.assign(url);
    return true;
  }
  window.location.href = url;
  return true;
}

/**
 * Envia o anexo já preparado para o provedor escolhido.
 * Não abre o PDF/relatório na tela — só o app de e-mail / compartilhar com anexo.
 */
export async function enviarAnexoResultadoPorEmail(
  provedor: ProvedorEmailResultado,
  pdf: PdfResumoPronto,
): Promise<ResultadoEnvioEmail> {
  if (Platform.OS === 'web') {
    if (await compartilharAnexoWeb(pdf)) {
      return {
        mensagem:
          'Escolha Gmail, Zimbra ou outro e-mail no menu — o relatório vai anexado (sem abrir na tela).',
      };
    }
    // Desktop / navegador sem Web Share de arquivos: abre o composer (sem baixar/abrir o PDF).
    const abriu = abrirComposerWebSemAnexo(provedor, pdf);
    if (!abriu) {
      throw new Error('Não foi possível abrir o e-mail. Permita pop-ups e tente de novo.');
    }
    return {
      mensagem:
        'E-mail aberto. Neste navegador o anexo automático não está disponível — use “Salvar PDF na pasta…” e anexe o arquivo na mensagem.',
    };
  }

  if (Platform.OS === 'android') {
    if (provedor === 'gmail' && (await enviarViaIntentAndroid(pdf, GMAIL_PACKAGES))) {
      return { mensagem: 'Gmail aberto com o PDF anexado.' };
    }
    if (provedor === 'zimbra' && (await enviarViaIntentAndroid(pdf, ZIMBRA_PACKAGES))) {
      return { mensagem: 'Zimbra aberto com o PDF anexado.' };
    }
  }

  if (await enviarViaMailComposer(pdf)) {
    return { mensagem: 'App de e-mail aberto com o PDF anexado.' };
  }

  if (await enviarViaShare(pdf)) {
    return {
      mensagem: 'Escolha Gmail, Zimbra ou outro e-mail — o PDF já vai anexado.',
    };
  }

  throw new Error(
    'Não foi possível abrir o app de e-mail com o PDF. Verifique se há um cliente instalado.',
  );
}

/**
 * Fluxo completo: prepara anexo (silencioso) e envia.
 * Preferir prepararAnexoEmailResumo no modal + enviarAnexoResultadoPorEmail no clique.
 */
export async function executarEnvioResultadoPorEmail(options: {
  provedor: ProvedorEmailResultado;
  resultados: ResultadoCorridaItem[];
  textoColunaCadastro: string;
  aplicadorAssinatura?: AplicadorAssinaturaResumo;
  /** Mantido por compatibilidade; ignorado — o anexo não abre na tela. */
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
  return enviarAnexoResultadoPorEmail(options.provedor, pdf);
}

/** Compatibilidade com chamadas antigas. */
export async function enviarPdfResumoPorEmail(
  provedor: ProvedorEmailResultado,
  pdf: PdfResumoPronto,
): Promise<ResultadoEnvioEmail> {
  return enviarAnexoResultadoPorEmail(provedor, pdf);
}
