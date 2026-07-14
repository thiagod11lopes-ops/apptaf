import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
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
};

/** Gera o PDF do resumo no cache do dispositivo (nativo). */
export async function prepararPdfResumoAplicacao(
  resultados: ResultadoCorridaItem[],
  textoColunaCadastro: string,
  aplicadorAssinatura?: AplicadorAssinaturaResumo,
): Promise<PdfResumoPronto> {
  if (resultados.length === 0) {
    throw new Error('Não há resultados para enviar.');
  }
  if (Platform.OS === 'web') {
    throw new Error(
      'No navegador, use “Gerar PDF” e anexe o arquivo manualmente no e-mail. Em celular/tablet o PDF já vai anexado.',
    );
  }

  const html = buildResumoAplicacaoHtml(resultados, textoColunaCadastro, undefined, aplicadorAssinatura);
  const { uri } = await Print.printToFileAsync({
    html,
    width: PDF_A4_LANDSCAPE_WIDTH,
    height: PDF_A4_LANDSCAPE_HEIGHT,
  });

  return {
    uri,
    filename: nomeArquivoPdf(resultados),
    subject: montarAssuntoEmailResumo(resultados),
    body: montarCorpoEmailResumo(resultados),
  };
}

function clienteCorresponde(
  label: string,
  packageName: string | undefined,
  id: ProvedorEmailResultado,
): boolean {
  const text = `${label} ${packageName ?? ''}`.toLowerCase();
  if (id === 'gmail') return text.includes('gmail') || text.includes('google.android.gm');
  if (id === 'zimbra') return text.includes('zimbra');
  return false;
}

export async function listarOpcoesEmailResultado(): Promise<OpcaoEmailResultado[]> {
  let clients: ReturnType<typeof MailComposer.getClients> = [];
  try {
    clients = MailComposer.getClients();
  } catch {
    clients = [];
  }

  const temZimbra = clients.some((c) => clienteCorresponde(c.label, c.packageName, 'zimbra'));

  return [
    {
      id: 'gmail',
      titulo: 'Gmail',
      subtitulo:
        Platform.OS === 'android'
          ? 'Abrir Gmail com o PDF anexado'
          : 'Abrir e-mail com o PDF anexado',
      disponivel: true,
    },
    {
      id: 'zimbra',
      titulo: 'Zimbra',
      subtitulo: temZimbra
        ? 'Abrir Zimbra com o PDF anexado'
        : Platform.OS === 'android'
          ? 'Tenta Zimbra; se ausente, abre seletor'
          : 'Se Zimbra não abrir, use Outros',
      disponivel: true,
    },
    {
      id: 'outros',
      titulo: 'Outros',
      subtitulo: 'Escolher outro app de e-mail',
      disponivel: true,
    },
  ];
}

async function enviarViaIntentAndroid(
  pdf: PdfResumoPronto,
  packageNames: readonly string[],
): Promise<boolean> {
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
      // tenta próximo pacote
    }
  }
  return false;
}

async function enviarViaMailComposer(pdf: PdfResumoPronto): Promise<void> {
  const available = await MailComposer.isAvailableAsync();
  if (!available) {
    throw new Error('Nenhum app de e-mail disponível neste dispositivo.');
  }
  await MailComposer.composeAsync({
    subject: pdf.subject,
    body: pdf.body,
    attachments: [pdf.uri],
  });
}

async function enviarViaShare(pdf: PdfResumoPronto): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Compartilhamento indisponível neste dispositivo.');
  }
  await Sharing.shareAsync(pdf.uri, {
    mimeType: 'application/pdf',
    dialogTitle: pdf.subject,
    UTI: 'com.adobe.pdf',
  });
}

/**
 * Abre o provedor de e-mail escolhido com o PDF do resumo anexado.
 */
export async function enviarPdfResumoPorEmail(
  provedor: ProvedorEmailResultado,
  pdf: PdfResumoPronto,
): Promise<void> {
  if (Platform.OS === 'android') {
    if (provedor === 'gmail') {
      const ok = await enviarViaIntentAndroid(pdf, GMAIL_PACKAGES);
      if (ok) return;
    }
    if (provedor === 'zimbra') {
      const ok = await enviarViaIntentAndroid(pdf, ZIMBRA_PACKAGES);
      if (ok) return;
    }
  }

  if (provedor === 'gmail' || provedor === 'zimbra') {
    // iOS / fallback: composer nativo com anexo (usuário escolhe conta/app se necessário)
    try {
      await enviarViaMailComposer(pdf);
      return;
    } catch {
      await enviarViaShare(pdf);
      return;
    }
  }

  // Outros
  try {
    await enviarViaMailComposer(pdf);
  } catch {
    await enviarViaShare(pdf);
  }
}
