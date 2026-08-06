import { Platform } from 'react-native';

export const TAF_PROVA_ATIVA_CAPTURE_ATTR = 'data-taf-prova-ativa-root';

function nomeArquivoPrint(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `prova-ativa-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`;
}

function resolverAlvoCaptura(): HTMLElement {
  const marcado = document.querySelector(
    `[${TAF_PROVA_ATIVA_CAPTURE_ATTR}="1"]`,
  ) as HTMLElement | null;
  return marcado ?? document.body;
}

/**
 * Captura a prova ativa (ou a página) e salva a imagem no dispositivo.
 * Preferência: compartilhar (tablet pode “Salvar imagem”); senão, download PNG.
 */
export async function capturarESalvarPrintPagina(): Promise<'shared' | 'downloaded'> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    throw new Error('Print da tela disponível no navegador / PWA.');
  }

  const { default: html2canvas } = await import('html2canvas');
  const target = resolverAlvoCaptura();

  const canvas = await html2canvas(target, {
    useCORS: true,
    allowTaint: true,
    scale: Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1),
    logging: false,
    backgroundColor: '#0f172a',
    ignoreElements: (el) =>
      el instanceof HTMLElement && el.getAttribute('data-taf-skip-capture') === '1',
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Não foi possível gerar a imagem.'))),
      'image/png',
    );
  });

  const fileName = nomeArquivoPrint();
  const file = new File([blob], fileName, { type: 'image/png' });

  const nav = typeof navigator !== 'undefined' ? navigator : null;
  if (nav && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
    await nav.share({
      files: [file],
      title: 'Print da prova ativa',
      text: 'Captura da prova ativa — AppTAF',
    });
    return 'shared';
  }

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
  return 'downloaded';
}
