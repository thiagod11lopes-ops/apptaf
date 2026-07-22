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
  const ext =
    mimeType.includes('pdf')
      ? '.pdf'
      : mimeType.includes('csv')
        ? '.csv'
        : mimeType.includes('opendocument.spreadsheet') || mimeType.includes('ods')
          ? '.ods'
          : undefined;
  const safeName = sanitizarNomeArquivo(filename, ext);
  const blob =
    typeof content === 'string'
      ? new Blob([content], { type: `${mimeType};charset=utf-8` })
      : content.type
        ? content
        : new Blob([await content.arrayBuffer()], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.setAttribute('download', safeName);
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  return { ok: true, modo: 'download' };
}

function isIosWeb(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  return navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1;
}

/**
 * Entrega PDF no navegador. No iPhone usa Compartilhar → Salvar em Arquivos/Downloads.
 */
export async function entregarPdfBlobWeb(
  blob: Blob,
  filename: string,
): Promise<SalvarArquivoNaPastaResultado> {
  const safeName = sanitizarNomeArquivo(filename, '.pdf');
  const pdfBlob =
    blob.type === 'application/pdf'
      ? blob
      : new Blob([await blob.arrayBuffer()], { type: 'application/pdf' });
  const file =
    typeof File !== 'undefined'
      ? new File([pdfBlob], safeName, { type: 'application/pdf' })
      : null;

  const tryShareFilesOnly = async (): Promise<boolean> => {
    if (!file || typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      return false;
    }
    // Só `files` — incluir title/text faz o SO gerar um 2º arquivo chamado "texto".
    const payload: ShareData = { files: [file] };
    if (typeof navigator.canShare === 'function' && !navigator.canShare(payload)) {
      return false;
    }
    try {
      await navigator.share(payload);
      return true;
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return true;
      return false;
    }
  };

  // iPhone: share sheet (somente o PDF). Desktop/Android web: download direto.
  if (isIosWeb()) {
    if (await tryShareFilesOnly()) {
      return { ok: true, modo: 'compartilhar' };
    }
    // Fallback: abre o PDF para Salvar em Arquivos (sem download paralelo).
    if (typeof window !== 'undefined') {
      const url = URL.createObjectURL(pdfBlob);
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) {
        window.location.assign(url);
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return { ok: true, modo: 'compartilhar' };
    }
  }

  return downloadWebBlob(pdfBlob, safeName, 'application/pdf');
}

/**
 * @deprecated Preferir gerarResumoAplicacaoPdfBlobWeb + entregarPdfBlobWeb.
 * html2canvas falha em iPhone (PDF em branco).
 */
export async function baixarHtmlComoPdfWeb(html: string, filename: string): Promise<SalvarArquivoNaPastaResultado> {
  // Evita o caminho quebrado no iPhone.
  if (isIosWeb()) {
    throw new Error('Atualize a página e use Salvar novamente (versão com suporte ao iPhone).');
  }
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error('Download PDF indisponível neste ambiente.');
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  // Overlay cobre o iframe (opacidade 1) para o usuário não ver o flash do relatório.
  const overlay = document.createElement('div');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:2147483646',
    'background:rgba(2,6,23,0.35)',
    'pointer-events:none',
  ].join(';');

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.title = 'Gerando PDF';
  iframe.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    `width:${PDF_A4_LANDSCAPE_WIDTH}px`,
    'height:1600px',
    'opacity:1',
    'pointer-events:none',
    'border:0',
    'z-index:2147483645',
    'background:#ffffff',
  ].join(';');

  document.body.appendChild(iframe);
  document.body.appendChild(overlay);

  try {
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) {
      throw new Error('Não foi possível preparar o PDF para download.');
    }

    // Estilos extras: tira position:fixed (html2canvas falha com header/footer fixos).
    const htmlParaCaptura = html.replace(
      '</head>',
      `<style id="taf-pdf-capture">
        .pdf-print-header,
        .pdf-print-footer {
          position: static !important;
          left: auto !important;
          right: auto !important;
          top: auto !important;
          bottom: auto !important;
          width: 100% !important;
        }
        .pdf-print-body {
          padding-top: 8px !important;
        }
        html, body {
          background: #ffffff !important;
          color: #111827 !important;
        }
      </style></head>`,
    );

    doc.open();
    doc.write(htmlParaCaptura);
    doc.close();

    await esperarDocumentoPronto(iframe);

    const target = doc.body;
    if (!target || !target.innerText?.trim()) {
      throw new Error('Conteúdo do PDF vazio.');
    }

    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    // Tempo extra para fontes/SVG (rúbricas)
    await new Promise<void>((r) => window.setTimeout(r, 450));

    const captureW = Math.max(target.scrollWidth, target.offsetWidth, PDF_A4_LANDSCAPE_WIDTH);
    const captureH = Math.max(target.scrollHeight, target.offsetHeight, 400);

    const capturar = async (el: HTMLElement) =>
      html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: Math.max(el.scrollWidth, el.offsetWidth, PDF_A4_LANDSCAPE_WIDTH),
        height: Math.max(el.scrollHeight, el.offsetHeight, 200),
        windowWidth: Math.max(el.scrollWidth, el.offsetWidth, PDF_A4_LANDSCAPE_WIDTH),
        windowHeight: Math.max(el.scrollHeight, el.offsetHeight, 200),
        scrollX: 0,
        scrollY: 0,
        foreignObjectRendering: false,
        onclone: (clonedDoc) => {
          const style = clonedDoc.createElement('style');
          style.textContent = `
            .pdf-print-header, .pdf-print-footer { position: static !important; }
            html, body { background:#fff !important; color:#111827 !important; }
          `;
          clonedDoc.head.appendChild(style);
        },
      });

    let canvas = await capturar(target);

    // Fallback: captura só o corpo da tabela se a página inteira vier “vazia”.
    if (canvas.width < 8 || canvas.height < 8 || canvasPareceEmBranco(canvas)) {
      const bodyOnly = doc.querySelector('.pdf-print-body') as HTMLElement | null;
      if (bodyOnly) {
        canvas = await capturar(bodyOnly);
      }
    }

    if (canvas.width < 8 || canvas.height < 8) {
      throw new Error('Não foi possível gerar o PDF. Tente novamente.');
    }

    if (canvasPareceEmBranco(canvas)) {
      throw new Error(
        'Não foi possível capturar o conteúdo do PDF. Atualize a página e tente novamente.',
      );
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
    overlay.remove();
    iframe.remove();
  }
}

async function esperarDocumentoPronto(iframe: HTMLIFrameElement): Promise<void> {
  await new Promise<void>((resolve) => {
    const finish = () => resolve();
    const win = iframe.contentWindow;
    if (win?.document.readyState === 'complete') {
      window.setTimeout(finish, 200);
      return;
    }
    iframe.onload = () => window.setTimeout(finish, 200);
    window.setTimeout(finish, 2000);
  });
}

/** Amostra centro e várias regiões — o canto superior do relatório é quase branco. */
function canvasPareceEmBranco(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return true;

  const pontos: Array<[number, number]> = [
    [0.5, 0.5],
    [0.25, 0.35],
    [0.75, 0.35],
    [0.5, 0.25],
    [0.5, 0.7],
    [0.15, 0.55],
    [0.85, 0.55],
  ];

  let pixelsComConteudo = 0;
  for (const [px, py] of pontos) {
    const x = Math.max(0, Math.min(canvas.width - 8, Math.floor(canvas.width * px) - 4));
    const y = Math.max(0, Math.min(canvas.height - 8, Math.floor(canvas.height * py) - 4));
    const sample = ctx.getImageData(x, y, 8, 8).data;
    for (let i = 0; i < sample.length; i += 4) {
      // Texto/tabela/borda (não branco puro)
      if (sample[i] < 245 || sample[i + 1] < 245 || sample[i + 2] < 245) {
        pixelsComConteudo += 1;
      }
    }
    if (pixelsComConteudo > 30) return false;
  }
  return pixelsComConteudo < 12;
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

async function escreverTextoNoDiretorioSaf(
  directoryUri: string,
  content: string,
  filename: string,
  mimeType: string,
): Promise<void> {
  const FileSystem = await import('expo-file-system/legacy');
  const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
    directoryUri,
    filename,
    mimeType,
  );
  await FileSystem.writeAsStringAsync(destUri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

/**
 * Salva texto (CSV etc.) em Downloads — mesmo fluxo do PDF.
 * Web: download (iPhone: Compartilhar → Arquivos).
 * Android: SAF Downloads (1ª vez escolhe a pasta).
 * iOS nativo: Compartilhar → Salvar em Arquivos.
 */
export async function baixarTextoParaDownloads(options: {
  content: string;
  filename: string;
  mimeType?: string;
  uti?: string;
  dialogTitle?: string;
}): Promise<SalvarArquivoNaPastaResultado> {
  const filename = sanitizarNomeArquivo(options.filename);
  const mimeType = options.mimeType || 'text/csv';

  if (Platform.OS === 'web') {
    const blob = new Blob([options.content], { type: `${mimeType};charset=utf-8` });
    const file =
      typeof File !== 'undefined'
        ? new File([blob], filename, { type: mimeType })
        : null;

    // iPhone: só o arquivo — title/text gerava um 2º download chamado "texto".
    if (file && isIosWeb() && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        const payload: ShareData = { files: [file] };
        if (typeof navigator.canShare !== 'function' || navigator.canShare(payload)) {
          await navigator.share(payload);
          return { ok: true, modo: 'compartilhar' };
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.name === 'AbortError') {
          return { ok: true, modo: 'compartilhar' };
        }
      }
    }

    return downloadWebBlob(blob, filename, mimeType);
  }

  const FileSystem = await import('expo-file-system/legacy');
  const cacheUri = `${FileSystem.cacheDirectory ?? ''}${filename}`;
  await FileSystem.writeAsStringAsync(cacheUri, options.content, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
    const cached = await obterUriPastaAndroidPersistida();
    if (cached) {
      try {
        await escreverTextoNoDiretorioSaf(cached, options.content, filename, mimeType);
        return { ok: true, modo: 'download' };
      } catch {
        // URI inválida — pede de novo
      }
    }

    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) {
      return { ok: false, cancelado: true };
    }
    await gravarUriPastaAndroid(permissions.directoryUri);
    await escreverTextoNoDiretorioSaf(
      permissions.directoryUri,
      options.content,
      filename,
      mimeType,
    );
    return { ok: true, modo: 'download' };
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Não foi possível salvar o CSV neste dispositivo.');
  }
  await Sharing.shareAsync(cacheUri, {
    mimeType,
    dialogTitle: options.dialogTitle ?? 'Salvar CSV em Downloads',
    UTI: options.uti ?? 'public.comma-separated-values-text',
  });
  return { ok: true, modo: 'compartilhar' };
}

function uint8ToBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += alphabet[(triple >> 18) & 63];
    out += alphabet[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? alphabet[(triple >> 6) & 63]! : '=';
    out += i + 2 < bytes.length ? alphabet[triple & 63]! : '=';
  }
  return out;
}

async function escreverBinarioNoDiretorioSaf(
  directoryUri: string,
  bytes: Uint8Array,
  filename: string,
  mimeType: string,
): Promise<void> {
  const FileSystem = await import('expo-file-system/legacy');
  const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
    directoryUri,
    filename,
    mimeType,
  );
  await FileSystem.writeAsStringAsync(destUri, uint8ToBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
}

/**
 * Salva bytes binários (ex.: ODS) em Downloads — mesmo fluxo do CSV/PDF.
 */
export async function baixarBinarioParaDownloads(options: {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
  uti?: string;
  dialogTitle?: string;
  extensaoPadrao?: string;
}): Promise<SalvarArquivoNaPastaResultado> {
  const filename = sanitizarNomeArquivo(options.filename, options.extensaoPadrao);
  const mimeType = options.mimeType;

  if (Platform.OS === 'web') {
    const blob = new Blob([options.bytes], { type: mimeType });
    const file =
      typeof File !== 'undefined' ? new File([blob], filename, { type: mimeType }) : null;

    if (file && isIosWeb() && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        const payload: ShareData = { files: [file] };
        if (typeof navigator.canShare !== 'function' || navigator.canShare(payload)) {
          await navigator.share(payload);
          return { ok: true, modo: 'compartilhar' };
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.name === 'AbortError') {
          return { ok: true, modo: 'compartilhar' };
        }
      }
    }

    return downloadWebBlob(blob, filename, mimeType);
  }

  const FileSystem = await import('expo-file-system/legacy');
  const cacheUri = `${FileSystem.cacheDirectory ?? ''}${filename}`;
  await FileSystem.writeAsStringAsync(cacheUri, uint8ToBase64(options.bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
    const cached = await obterUriPastaAndroidPersistida();
    if (cached) {
      try {
        await escreverBinarioNoDiretorioSaf(cached, options.bytes, filename, mimeType);
        return { ok: true, modo: 'download' };
      } catch {
        // URI inválida — pede de novo
      }
    }

    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) {
      return { ok: false, cancelado: true };
    }
    await gravarUriPastaAndroid(permissions.directoryUri);
    await escreverBinarioNoDiretorioSaf(permissions.directoryUri, options.bytes, filename, mimeType);
    return { ok: true, modo: 'download' };
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Não foi possível salvar o arquivo neste dispositivo.');
  }
  await Sharing.shareAsync(cacheUri, {
    mimeType,
    dialogTitle: options.dialogTitle ?? 'Salvar arquivo em Downloads',
    UTI: options.uti,
  });
  return { ok: true, modo: 'compartilhar' };
}

/**
 * Salva bytes binários na pasta escolhida (Android SAF / iOS share / web download).
 */
export async function salvarBinarioNaPastaEscolhida(options: {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
  uti?: string;
  dialogTitle?: string;
  extensaoPadrao?: string;
}): Promise<SalvarArquivoNaPastaResultado> {
  const filename = sanitizarNomeArquivo(options.filename, options.extensaoPadrao);
  const mimeType = options.mimeType;

  if (Platform.OS === 'web') {
    return downloadWebBlob(new Blob([options.bytes], { type: mimeType }), filename, mimeType);
  }

  const FileSystem = await import('expo-file-system/legacy');

  if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) {
      return { ok: false, cancelado: true };
    }
    await escreverBinarioNoDiretorioSaf(permissions.directoryUri, options.bytes, filename, mimeType);
    return { ok: true, modo: 'pasta' };
  }

  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, uint8ToBase64(options.bytes), {
    encoding: FileSystem.EncodingType.Base64,
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
    return 'Arquivo baixado para a pasta Downloads.';
  }
  return 'Escolha “Salvar em Arquivos” / Downloads no menu do sistema para guardar o arquivo.';
}
