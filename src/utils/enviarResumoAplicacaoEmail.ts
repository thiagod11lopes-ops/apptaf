import { Linking, Platform } from 'react-native';
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
};

export async function listarOpcoesEmailResultado(): Promise<OpcaoEmailResultado[]> {
  return [
    {
      id: 'gmail',
      titulo: 'Gmail',
      subtitulo:
        Platform.OS === 'web'
          ? 'Abrir Gmail na web (anexe o PDF baixado)'
          : 'Abrir Gmail com o PDF anexado',
      disponivel: true,
    },
    {
      id: 'zimbra',
      titulo: 'Zimbra',
      subtitulo:
        Platform.OS === 'web'
          ? 'Abrir app de e-mail (anexe o PDF baixado)'
          : 'Abrir Zimbra com o PDF anexado',
      disponivel: true,
    },
    {
      id: 'outros',
      titulo: 'Outros',
      subtitulo:
        Platform.OS === 'web'
          ? 'Abrir cliente de e-mail padrão'
          : 'Escolher outro app de e-mail',
      disponivel: true,
    },
  ];
}

function urlGmailCompose(subject: string, body: string): string {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    tf: '1',
    su: subject,
    body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

function urlMailto(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function abrirHtmlPreview(html: string): boolean {
  if (typeof window === 'undefined') return false;
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  return true;
}

function baixarHtmlComoArquivo(html: string, filename: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/\.pdf$/i, '.html');
  a.click();
  URL.revokeObjectURL(url);
}

async function enviarViaWeb(
  provedor: ProvedorEmailResultado,
  pdf: PdfResumoPronto,
): Promise<ResultadoEnvioEmail> {
  const previewOk = abrirHtmlPreview(pdf.html);
  baixarHtmlComoArquivo(pdf.html, pdf.filename);

  if (provedor === 'gmail') {
    const url = urlGmailCompose(pdf.subject, pdf.body);
    const opened = typeof window !== 'undefined' ? window.open(url, '_blank') : null;
    if (!opened && typeof window !== 'undefined') {
      window.location.href = url;
    }
    return {
      mensagem: previewOk
        ? 'Gmail aberto. Anexe o arquivo HTML/PDF baixado (ou use Imprimir → Salvar como PDF na aba do relatório).'
        : 'Gmail aberto. Permita pop-ups e use Gerar PDF para obter o arquivo a anexar.',
    };
  }

  const mailto = urlMailto(pdf.subject, pdf.body);
  if (typeof window !== 'undefined') {
    window.location.href = mailto;
  } else {
    await Linking.openURL(mailto);
  }

  return {
    mensagem:
      provedor === 'zimbra'
        ? 'Cliente de e-mail aberto. Anexe o arquivo baixado na mensagem (Zimbra web).'
        : 'Cliente de e-mail aberto. Anexe o arquivo baixado na mensagem.',
  };
}

/** Gera o PDF/HTML do resumo para envio. */
export async function prepararPdfResumoAplicacao(
  resultados: ResultadoCorridaItem[],
  textoColunaCadastro: string,
  aplicadorAssinatura?: AplicadorAssinaturaResumo,
): Promise<PdfResumoPronto> {
  if (resultados.length === 0) {
    throw new Error('Não há resultados para enviar.');
  }

  const html = buildResumoAplicacaoHtml(resultados, textoColunaCadastro, undefined, aplicadorAssinatura);
  const subject = montarAssuntoEmailResumo(resultados);
  const body = montarCorpoEmailResumo(resultados);
  const filename = nomeArquivoPdf(resultados);

  if (Platform.OS === 'web') {
    return { uri: '', filename, subject, body, html };
  }

  const { uri } = await Print.printToFileAsync({
    html,
    width: PDF_A4_LANDSCAPE_WIDTH,
    height: PDF_A4_LANDSCAPE_HEIGHT,
  });

  return { uri, filename, subject, body, html };
}

async function enviarViaIntentAndroid(
  pdf: PdfResumoPronto,
  packageNames: readonly string[],
): Promise<boolean> {
  try {
    const FileSystem = await import('expo-file-system/legacy');
    const IntentLauncher = await import('expo-intent-launcher');
    if (!pdf.uri) return false;
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
        // tenta próximo pacote
      }
    }
  } catch {
    return false;
  }
  return false;
}

async function enviarViaMailComposer(pdf: PdfResumoPronto): Promise<boolean> {
  try {
    const MailComposer = await import('expo-mail-composer');
    const available = await MailComposer.isAvailableAsync();
    if (!available || !pdf.uri) return false;
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
      dialogTitle: pdf.subject,
      UTI: 'com.adobe.pdf',
    });
    return true;
  } catch {
    return false;
  }
}

async function enviarViaMailtoNativo(
  provedor: ProvedorEmailResultado,
  pdf: PdfResumoPronto,
): Promise<boolean> {
  try {
    if (provedor === 'gmail' && Platform.OS === 'android') {
      const gmailUrl = `googlegmail://co?subject=${encodeURIComponent(pdf.subject)}&body=${encodeURIComponent(pdf.body)}`;
      const can = await Linking.canOpenURL(gmailUrl);
      if (can) {
        await Linking.openURL(gmailUrl);
        return true;
      }
    }
    await Linking.openURL(urlMailto(pdf.subject, pdf.body));
    return true;
  } catch {
    return false;
  }
}

/**
 * Abre o provedor de e-mail escolhido com o PDF do resumo (anexado no nativo; na web com preview + compose).
 */
export async function enviarPdfResumoPorEmail(
  provedor: ProvedorEmailResultado,
  pdf: PdfResumoPronto,
): Promise<ResultadoEnvioEmail> {
  if (Platform.OS === 'web') {
    return enviarViaWeb(provedor, pdf);
  }

  if (Platform.OS === 'android') {
    if (provedor === 'gmail') {
      if (await enviarViaIntentAndroid(pdf, GMAIL_PACKAGES)) {
        return { mensagem: 'Gmail aberto com o PDF anexado.' };
      }
    }
    if (provedor === 'zimbra') {
      if (await enviarViaIntentAndroid(pdf, ZIMBRA_PACKAGES)) {
        return { mensagem: 'Zimbra aberto com o PDF anexado.' };
      }
    }
  }

  if (await enviarViaMailComposer(pdf)) {
    return { mensagem: 'App de e-mail aberto com o PDF anexado.' };
  }

  if (await enviarViaShare(pdf)) {
    return {
      mensagem: 'Escolha o app de e-mail no menu de compartilhamento — o PDF já está pronto para anexar.',
    };
  }

  if (await enviarViaMailtoNativo(provedor, pdf)) {
    return {
      mensagem:
        'E-mail aberto. Se o PDF não veio anexado, use “Salvar PDF na pasta…” e anexe manualmente.',
    };
  }

  throw new Error(
    'Não foi possível abrir o e-mail. Verifique se há um app de e-mail instalado ou use “Salvar PDF na pasta…”.',
  );
}
