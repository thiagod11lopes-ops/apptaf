import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';

export type SalvarArquivoNaPastaResultado =
  | { ok: true; modo: 'pasta' | 'compartilhar' | 'download' }
  | { ok: false; cancelado: true };

export class SalvamentoCanceladoError extends Error {
  constructor(message = 'Seleção de pasta cancelada.') {
    super(message);
    this.name = 'SalvamentoCanceladoError';
  }
}

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
  anchor.click();
  URL.revokeObjectURL(url);
  return { ok: true, modo: 'download' };
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

export function mensagemSucessoSalvarNaPasta(resultado: Extract<SalvarArquivoNaPastaResultado, { ok: true }>): string {
  if (resultado.modo === 'pasta') {
    return 'Arquivo salvo na pasta escolhida.';
  }
  if (resultado.modo === 'download') {
    return 'Download iniciado. Escolha a pasta no navegador, se solicitado.';
  }
  return 'Use “Salvar em Arquivos” (iOS) ou o app de pastas no menu de compartilhamento.';
}
