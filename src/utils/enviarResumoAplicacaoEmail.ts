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
      subtitulo: 'Abrir Gmail para enviar o resultado',
      disponivel: true,
    },
    {
      id: 'zimbra',
      titulo: 'Zimbra',
      subtitulo: 'Abrir Zimbra / e-mail para enviar',
      disponivel: true,
    },
    {
      id: 'outros',
      titulo: 'Outros',
      subtitulo: 'Abrir app de e-mail ou compartilhar',
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

/** URL do composer — usada no clique (antes de qualquer await). */
export function urlComposerParaProvedor(
  provedor: ProvedorEmailResultado,
  subject: string,
  body: string,
): string {
  if (provedor === 'gmail') {
    if (Platform.OS === 'web') return urlGmailCompose(subject, body);
    // Scheme do app Gmail (Android/iOS); se falhar, o fluxo nativo usa Intent/Share.
    return `googlegmail://co?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
  return urlMailto(subject, body);
}

/**
 * Abre o cliente de e-mail no mesmo gesto do toque (obrigatório na web —
 * depois de await o navegador bloqueia pop-ups / redirects).
 */
export function abrirClienteEmailNoGestoDoClique(
  provedor: ProvedorEmailResultado,
  subject: string,
  body: string,
): { abriu: boolean; url: string } {
  const url = urlComposerParaProvedor(provedor, subject, body);

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (provedor === 'gmail') {
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (win) return { abriu: true, url };
      // Fallback síncrono: navega a aba atual para o Gmail
      window.location.assign(url);
      return { abriu: true, url };
    }
    // mailto: abre o app de e-mail do sistema / cliente padrão
    window.location.href = url;
    return { abriu: true, url };
  }

  // Nativo: dispara openURL sem await (gesto preservado o máximo possível)
  void Linking.openURL(url).catch(() => undefined);
  return { abriu: true, url };
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

/** Gera o arquivo PDF no cache (nativo). */
export async function gerarPdfArquivoNativo(conteudo: PdfResumoPronto): Promise<PdfResumoPronto> {
  if (Platform.OS === 'web') return conteudo;
  const { uri } = await Print.printToFileAsync({
    html: conteudo.html,
    width: PDF_A4_LANDSCAPE_WIDTH,
    height: PDF_A4_LANDSCAPE_HEIGHT,
  });
  return { ...conteudo, uri };
}

/** @deprecated Use montarConteudoEmailResumoSync + gerarPdfArquivoNativo */
export async function prepararPdfResumoAplicacao(
  resultados: ResultadoCorridaItem[],
  textoColunaCadastro: string,
  aplicadorAssinatura?: AplicadorAssinaturaResumo,
): Promise<PdfResumoPronto> {
  const base = montarConteudoEmailResumoSync(resultados, textoColunaCadastro, aplicadorAssinatura);
  return gerarPdfArquivoNativo(base);
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

/**
 * Fluxo completo:
 * 1) Abre o e-mail no gesto do clique (web/nativo)
 * 2) Depois gera/anexa o PDF quando possível
 */
export async function executarEnvioResultadoPorEmail(options: {
  provedor: ProvedorEmailResultado;
  resultados: ResultadoCorridaItem[];
  textoColunaCadastro: string;
  aplicadorAssinatura?: AplicadorAssinaturaResumo;
  /** Deve ser chamado sincronamente no onPress — abre o e-mail antes de qualquer await. */
  abrirEmailNoGesto: boolean;
}): Promise<ResultadoEnvioEmail> {
  const { provedor, resultados, textoColunaCadastro, aplicadorAssinatura, abrirEmailNoGesto } =
    options;

  const base = montarConteudoEmailResumoSync(resultados, textoColunaCadastro, aplicadorAssinatura);

  let emailAbertoNoGesto = false;
  if (abrirEmailNoGesto) {
    const aberto = abrirClienteEmailNoGestoDoClique(provedor, base.subject, base.body);
    emailAbertoNoGesto = aberto.abriu;
  }

  if (Platform.OS === 'web') {
    baixarHtmlComoArquivo(base.html, base.filename);
    return {
      mensagem: emailAbertoNoGesto
        ? provedor === 'gmail'
          ? 'Gmail aberto. Anexe o arquivo baixado (ou Imprimir → Salvar como PDF na aba do relatório, se abrir).'
          : 'App de e-mail aberto. Anexe o arquivo do relatório que foi baixado.'
        : 'Não foi possível abrir o e-mail automaticamente. Permita pop-ups e tente de novo.',
    };
  }

  // Nativo: gera PDF e tenta anexo real no app escolhido / share sheet
  const pdf = await gerarPdfArquivoNativo(base);

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

  // Share sheet: usuário escolhe Gmail/Zimbra — anexo incluso
  if (await enviarViaShare(pdf)) {
    return {
      mensagem: 'Escolha Gmail, Zimbra ou outro e-mail no menu — o PDF já vai anexado.',
    };
  }

  if (emailAbertoNoGesto) {
    return {
      mensagem:
        'E-mail aberto. Se o PDF não veio anexado, use “Salvar PDF na pasta…” e anexe na mensagem.',
    };
  }

  throw new Error(
    'Não foi possível abrir o app de e-mail. Verifique se há um cliente instalado ou use “Salvar PDF na pasta…”.',
  );
}

/** Compatibilidade com chamadas antigas. */
export async function enviarPdfResumoPorEmail(
  provedor: ProvedorEmailResultado,
  pdf: PdfResumoPronto,
): Promise<ResultadoEnvioEmail> {
  if (Platform.OS === 'web') {
    abrirClienteEmailNoGestoDoClique(provedor, pdf.subject, pdf.body);
    baixarHtmlComoArquivo(pdf.html, pdf.filename);
    return {
      mensagem: 'Cliente de e-mail aberto. Anexe o arquivo baixado na mensagem.',
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
    return { mensagem: 'Escolha o app de e-mail — o PDF já vai anexado.' };
  }
  await Linking.openURL(urlMailto(pdf.subject, pdf.body));
  return { mensagem: 'E-mail aberto. Anexe o PDF se necessário.' };
}
