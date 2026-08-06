import { Platform } from 'react-native';
import { yieldToUi } from './yieldToUi';

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

/** Cede frames para a UI pintar o spinner antes do html2canvas. */
function waitTwoAnimationFrames(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function') {
      resolve();
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/**
 * Captura a prova ativa (ou a página) e salva a imagem no dispositivo.
 * Preferência: compartilhar (tablet pode “Salvar imagem”); senão, download PNG.
 * Cede a UI antes do trabalho pesado (html2canvas não roda em Worker — precisa do DOM).
 */
export async function capturarESalvarPrintPagina(): Promise<'shared' | 'downloaded'> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    throw new Error('Print da tela disponível no navegador / PWA.');
  }

  // Deixa o spinner do botão pintar antes de travar com html2canvas.
  await waitTwoAnimationFrames();
  await yieldToUi();

  const { default: html2canvas } = await import('html2canvas');
  await yieldToUi();

  const target = resolverAlvoCaptura();
  const dpr =
    typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
      ? window.devicePixelRatio
      : 1;
  // Escala moderada: 2× em tablets grandes trava a UI por vários segundos.
  const scale = Math.min(1.5, Math.max(1, dpr));

  const canvas = await html2canvas(target, {
    useCORS: true,
    allowTaint: true,
    scale,
    logging: false,
    backgroundColor: '#0f172a',
    foreignObjectRendering: false,
    ignoreElements: (el) =>
      el instanceof HTMLElement && el.getAttribute('data-taf-skip-capture') === '1',
  });

  await yieldToUi();

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
