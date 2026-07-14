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
 */
export async function prepararAnexoEmailResumo(
  resultados: ResultadoCorridaItem[],
  textoColunaCadastro: string,
  aplicadorAssinatura?: AplicadorAssinaturaResumo,
): Promise<PdfResumoPronto> {
  const base = montarConteudoEmailResumoSync(resultados, textoColunaCadastro, aplicadorAssinatura);

  if (Platform.OS === 'web') {
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
      dialogTitle: 'Enviar Resultados',
      UTI: 'com.adobe.pdf',
    });
    return true;
  } catch {
    return false;
  }
}

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
 * Compartilha o anexo já preparado — abre o seletor de apps (Gmail, Zimbra, etc.).
 * Não abre o PDF/relatório na tela.
 */
export async function compartilharResultadosAnexo(
  pdf: PdfResumoPronto,
): Promise<ResultadoEnvioEmail> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (await compartilharAnexoWeb(pdf)) {
      return {
        mensagem: 'Escolha o aplicativo no menu — o relatório vai anexado.',
      };
    }
    if (abrirMailtoWeb(pdf)) {
      return {
        mensagem:
          'E-mail aberto. Neste navegador o anexo automático não está disponível — use “Salvar PDF na pasta…” e anexe o arquivo na mensagem.',
      };
    }
  }

  // Preferir o sheet de compartilhar: o usuário escolhe Gmail, Zimbra ou outro app.
  if (await enviarViaShare(pdf)) {
    return {
      mensagem: 'Escolha o aplicativo — o PDF já vai anexado.',
    };
  }

  if (await enviarViaMailComposer(pdf)) {
    return { mensagem: 'App de e-mail aberto com o PDF anexado.' };
  }

  throw new Error(
    'Não foi possível compartilhar o PDF. Verifique se há um app de e-mail instalado.',
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
