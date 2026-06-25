/**
 * PDF.js legacy (UMD) via CDN — evita import.meta do pdfjs-dist v6 no bundle Expo Web.
 */
import {
  normalizarItensPdf,
  reconstruirTextoDeItensPdf,
  type PdfTextItem,
} from './pdfTextLayout';

export type { PdfTextItem };

const PDFJS_LEGACY = '3.11.174';

type PdfJsLib = {
  getDocument: (params: { data: Uint8Array; useSystemFonts?: boolean }) => {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getTextContent: () => Promise<{ items: Array<{ str?: string; transform?: number[] }> }>;
      }>;
    }>;
  };
  GlobalWorkerOptions: { workerSrc: string };
};

declare global {
  interface Window {
    pdfjsLib?: PdfJsLib;
  }
}

let pdfJsWebPromise: Promise<PdfJsLib> | null = null;

function workerSrcLegacy(): string {
  return `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_LEGACY}/legacy/build/pdf.worker.min.js`;
}

function scriptSrcLegacy(): string {
  return `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_LEGACY}/legacy/build/pdf.min.js`;
}

function carregarPdfJsLegacy(): Promise<PdfJsLib> {
  if (pdfJsWebPromise) return pdfJsWebPromise;

  pdfJsWebPromise = new Promise((resolve, reject) => {
    const existente = window.pdfjsLib;
    if (existente) {
      existente.GlobalWorkerOptions.workerSrc = workerSrcLegacy();
      resolve(existente);
      return;
    }

    const jaCarregando = document.querySelector('script[data-pdfjs-legacy]');
    if (jaCarregando) {
      const onOk = () => {
        const lib = window.pdfjsLib;
        if (lib) {
          lib.GlobalWorkerOptions.workerSrc = workerSrcLegacy();
          resolve(lib);
        } else {
          pdfJsWebPromise = null;
          reject(new Error('PDF.js não disponível após carregar.'));
        }
      };
      const onErr = () => {
        pdfJsWebPromise = null;
        reject(new Error('Falha ao carregar PDF.js. Verifique sua conexão.'));
      };
      jaCarregando.addEventListener('load', onOk, { once: true });
      jaCarregando.addEventListener('error', onErr, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = scriptSrcLegacy();
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.pdfjsLegacy = '1';
    script.onload = () => {
      const lib = window.pdfjsLib;
      if (!lib) {
        pdfJsWebPromise = null;
        reject(new Error('PDF.js não disponível após carregar.'));
        return;
      }
      lib.GlobalWorkerOptions.workerSrc = workerSrcLegacy();
      resolve(lib);
    };
    script.onerror = () => {
      pdfJsWebPromise = null;
      reject(new Error('Falha ao carregar PDF.js. Verifique sua conexão.'));
    };
    document.head.appendChild(script);
  });

  return pdfJsWebPromise;
}

export async function extrairItensDePdf(arrayBuffer: ArrayBuffer): Promise<PdfTextItem[]> {
  const { getDocument } = await carregarPdfJsLegacy();
  const data = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);

  const pdf = await getDocument({
    data,
    useSystemFonts: true,
  }).promise;

  const itens: PdfTextItem[] = [];

  for (let pagina = 1; pagina <= pdf.numPages; pagina += 1) {
    const page = await pdf.getPage(pagina);
    const content = await page.getTextContent();
    itens.push(...normalizarItensPdf(content.items, pagina));
  }

  return itens;
}

export async function extrairTextoDePdf(arrayBuffer: ArrayBuffer): Promise<string> {
  const itens = await extrairItensDePdf(arrayBuffer);
  return reconstruirTextoDeItensPdf(itens);
}
