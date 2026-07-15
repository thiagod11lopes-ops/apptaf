import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import { PDF_A4_LANDSCAPE_WIDTH } from './pdfLayout';

export type SalvarArquivoNaPastaResultado =
  | { ok: true; modo: 'pasta' | 'compartilhar' | 'download' }
  | { ok: false; cancelado: true };

export class SalvamentoCanceladoError extends Error {
  constructor(message = 'Seleção de pasta cancelada.') {
    super(message);
    this.name = 'SalvamentoCanceladoError';
  }
}

const SAF_DOWNLOADS_URI_KEY = 'taf:safDownloadsDirectoryUri';

/** Nome de arquivo seguro para Android SAF / Downloads. */
export function sanitizarNomeArquivo(nome: string, extensaoPadrao?: string): string {
  const trimmed = String(nome || 'arquivo').trim() || 'arquivo';
  const semPath = trimmed.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, ' ');
  if (!extensaoPadrao) return semPath;
  const ext = extensaoPadrao.startsWith('.') ? extensaoPadrao : `.${extensaoPadrao}`;
  if (semPath.toLowerCase().endsWith(ext.toLowerCase())) return semPath;
  return `${semPath}${ext}`;
}

async function downloadWebBlob(
  content: string | Blob,
  filename: string,
  mimeType: string,
): Promise<SalvarArquivoNaPastaResultado> {
  if (typeof document === 'undefined') {
    throw new Error('Download indisponível neste ambiente.');
  }
  const blob =
    typeof content === 'string' ? new Blob([content], { type: `${mimeType};charset=utf-8` }) : content;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return { ok: true, modo: 'download' };
}

/**
 * Converte HTML do relatório em Blob PDF (só web) e dispara download para Downloads —
 * sem abrir visualização na tela.
 */
export async function baixarHtmlComoPdfWeb(html: string, filename: string): Promise<SalvarArquivoNaPastaResultado> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error('Download PDF indisponível neste ambiente.');
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  // Precisa estar no viewport com opacidade mínima — opacity:0 / offscreen gera PDF em branco.
  iframe.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    `width:${PDF_A4_LANDSCAPE_WIDTH}px`,
    'height:1200px',
    'opacity:0.01',
    'pointer-events:none',
    'border:0',
    'z-index:-1',
    'background:#ffffff',
  ].join(';');
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) {
      throw new Error('Não foi possível preparar o PDF para download.');
    }

    doc.open();
    doc.write(html);
    doc.close();

    await new Promise<void>((resolve) => {
      const finish = () => resolve();
      const win = iframe.contentWindow;
      if (win?.document.readyState === 'complete') {
        window.setTimeout(finish, 350);
        return;
      }
      iframe.onload = () => window.setTimeout(finish, 350);
      window.setTimeout(finish, 1600);
    });

    const target = doc.body;
    if (!target) {
      throw new Error('Conteúdo do PDF vazio.');
    }

    // Aguarda layout/paint do conteúdo no iframe
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: Math.max(target.scrollWidth, PDF_A4_LANDSCAPE_WIDTH),
      windowWidth: Math.max(target.scrollWidth, PDF_A4_LANDSCAPE_WIDTH),
      scrollX: 0,
      scrollY: 0,
      foreignObjectRendering: false,
    });

    if (canvas.width < 8 || canvas.height < 8 || canvasPareceEmBranco(canvas)) {
      throw new Error('O PDF gerado ficou em branco. Tente novamente.');
    }

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4',
    });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const imgW = canvas.width;
    const imgH = canvas.height;
    const sliceHeightPx = Math.max(1, Math.floor((pageH / pageW) * imgW));

    let renderedY = 0;
    let pageIndex = 0;
    while (renderedY < imgH) {
      const sliceH = Math.min(sliceHeightPx, imgH - renderedY);
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = imgW;
      pageCanvas.height = sliceH;
      const ctx = pageCanvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível gerar o PDF.');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, imgW, sliceH);
      ctx.drawImage(canvas, 0, renderedY, imgW, sliceH, 0, 0, imgW, sliceH);

      const imgData = pageCanvas.toDataURL('image/jpeg', 0.92);
      if (pageIndex > 0) pdf.addPage();
      const drawH = (sliceH / imgW) * pageW;
      pdf.addImage(imgData, 'JPEG', 0, 0, pageW, Math.min(drawH, pageH));

      renderedY += sliceH;
      pageIndex += 1;
      if (pageIndex > 40) break;
    }

    const blob = pdf.output('blob');
    return downloadWebBlob(blob, sanitizarNomeArquivo(filename, '.pdf'), 'application/pdf');
  } finally {
    iframe.remove();
  }
}

function canvasPareceEmBranco(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return true;
  const w = Math.min(48, canvas.width);
  const h = Math.min(48, canvas.height);
  const sample = ctx.getImageData(0, 0, w, h).data;
  let naoBranco = 0;
  for (let i = 0; i < sample.length; i += 4) {
    if (sample[i] < 248 || sample[i + 1] < 248 || sample[i + 2] < 248) {
      naoBranco += 1;
      if (naoBranco > 8) return false;
    }
  }
  return true;
}

async function obterUriPastaAndroidPersistida(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SAF_DOWNLOADS_URI_KEY);
  } catch {
    return null;
  }
}

async function gravarUriPastaAndroid(uri: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SAF_DOWNLOADS_URI_KEY, uri);
  } catch {
    // ignore
  }
}

async function escreverPdfNoDiretorioSaf(
  directoryUri: string,
  sourceUri: string,
  filename: string,
  mimeType: string,
): Promise<void> {
  const FileSystem = await import('expo-file-system/legacy');
  const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
    directoryUri,
    filename,
    mimeType,
  );
  const base64 = await FileSystem.readAsStringAsync(sourceUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await FileSystem.writeAsStringAsync(destUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

/**
 * Salva um PDF já gerado no cache diretamente em Downloads (ou equivalente),
 * sem abrir o arquivo na tela.
 * - Web: download do navegador
 * - Android: pasta SAF (Downloads na 1ª vez; depois reutiliza)
 * - iOS: compartilhar → Salvar em Arquivos / Downloads
 */
export async function baixarArquivoParaDownloads(options: {
  sourceUri: string;
  filename: string;
  mimeType?: string;
  uti?: string;
  dialogTitle?: string;
}): Promise<SalvarArquivoNaPastaResultado> {
  const filename = sanitizarNomeArquivo(options.filename, '.pdf');
  const mimeType = options.mimeType || 'application/pdf';

  if (Platform.OS === 'web') {
    throw new Error('Use baixarHtmlComoPdfWeb na plataforma web.');
  }

  const FileSystem = await import('expo-file-system/legacy');

  if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
    const cached = await obterUriPastaAndroidPersistida();
    if (cached) {
      try {
        await escreverPdfNoDiretorioSaf(cached, options.sourceUri, filename, mimeType);
        return { ok: true, modo: 'download' };
      } catch {
        // URI inválida / permissão perdida — pede de novo
      }
    }

    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) {
      return { ok: false, cancelado: true };
    }
    await gravarUriPastaAndroid(permissions.directoryUri);
    await escreverPdfNoDiretorioSaf(permissions.directoryUri, options.sourceUri, filename, mimeType);
    return { ok: true, modo: 'download' };
  }

  // iOS: salva via share sheet (Salvar em Arquivos / Downloads)
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Não foi possível salvar o PDF neste dispositivo.');
  }
  await Sharing.shareAsync(options.sourceUri, {
    mimeType,
    dialogTitle: options.dialogTitle ?? 'Salvar PDF em Downloads',
    UTI: options.uti ?? 'com.adobe.pdf',
  });
  return { ok: true, modo: 'compartilhar' };
}

/**
 * Salva texto (CSV etc.) em pasta escolhida no Android (SAF).
 * No iOS usa o compartilhamento nativo (Salvar em Arquivos…).
 * Na web faz download do arquivo.
 */
export async function salvarConteudoTextoNaPastaEscolhida(options: {
  content: string;
  filename: string;
  mimeType: string;
  uti?: string;
  dialogTitle?: string;
}): Promise<SalvarArquivoNaPastaResultado> {
  const filename = sanitizarNomeArquivo(options.filename);
  const mimeType = options.mimeType || 'text/plain';

  if (Platform.OS === 'web') {
    return downloadWebBlob(options.content, filename, mimeType);
  }

  const FileSystem = await import('expo-file-system/legacy');

  if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) {
      return { ok: false, cancelado: true };
    }
    const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
      permissions.directoryUri,
      filename,
      mimeType,
    );
    await FileSystem.writeAsStringAsync(destUri, options.content, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return { ok: true, modo: 'pasta' };
  }

  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, options.content, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Não foi possível abrir o seletor para salvar o arquivo neste dispositivo.');
  }

  await Sharing.shareAsync(uri, {
    mimeType,
    dialogTitle: options.dialogTitle ?? 'Salvar arquivo na pasta',
    UTI: options.uti,
  });
  return { ok: true, modo: 'compartilhar' };
}

/**
 * Salva um arquivo já gerado no cache (ex.: PDF do expo-print) na pasta escolhida.
 * Android: Storage Access Framework. iOS: compartilhar → Salvar em Arquivos.
 */
export async function salvarArquivoCacheNaPastaEscolhida(options: {
  sourceUri: string;
  filename: string;
  mimeType: string;
  uti?: string;
  dialogTitle?: string;
  /** Conteúdo web (Blob/HTML) quando Platform.OS === 'web'. */
  webBlob?: Blob;
}): Promise<SalvarArquivoNaPastaResultado> {
  const filename = sanitizarNomeArquivo(options.filename);
  const mimeType = options.mimeType || 'application/octet-stream';

  if (Platform.OS === 'web') {
    if (!options.webBlob) {
      throw new Error('Conteúdo para download web não informado.');
    }
    return downloadWebBlob(options.webBlob, filename, mimeType);
  }

  const FileSystem = await import('expo-file-system/legacy');

  if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) {
      return { ok: false, cancelado: true };
    }
    const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
      permissions.directoryUri,
      filename,
      mimeType,
    );
    const base64 = await FileSystem.readAsStringAsync(options.sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await FileSystem.writeAsStringAsync(destUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { ok: true, modo: 'pasta' };
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Não foi possível abrir o seletor para salvar o arquivo neste dispositivo.');
  }

  await Sharing.shareAsync(options.sourceUri, {
    mimeType,
    dialogTitle: options.dialogTitle ?? 'Salvar arquivo na pasta',
    UTI: options.uti,
  });
  return { ok: true, modo: 'compartilhar' };
}

export function mensagemSucessoSalvarNaPasta(
  resultado: Extract<SalvarArquivoNaPastaResultado, { ok: true }>,
): string {
  if (resultado.modo === 'pasta') {
    return 'Arquivo salvo na pasta escolhida.';
  }
  if (resultado.modo === 'download') {
    return 'PDF baixado para a pasta Downloads.';
  }
  return 'Use “Salvar em Arquivos” / Downloads no menu do sistema.';
}
