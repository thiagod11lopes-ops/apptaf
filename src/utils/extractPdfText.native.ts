import {
  normalizarItensPdf,
  reconstruirTextoDeItensPdf,
  type PdfTextItem,
} from './pdfTextLayout';

export type { PdfTextItem };

export async function extrairItensDePdf(arrayBuffer: ArrayBuffer): Promise<PdfTextItem[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/build/pdf.worker.min.mjs';

  const data = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);

  const pdf = await pdfjs.getDocument({
    data,
    useSystemFonts: true,
  }).promise;

  const itens: PdfTextItem[] = [];

  for (let pagina = 1; pagina <= pdf.numPages; pagina += 1) {
    const page = await pdf.getPage(pagina);
    const content = await page.getTextContent();
    itens.push(
      ...normalizarItensPdf(
        content.items as Array<{ str?: string; transform?: number[] }>,
        pagina,
      ),
    );
  }

  return itens;
}

export async function extrairTextoDePdf(arrayBuffer: ArrayBuffer): Promise<string> {
  const itens = await extrairItensDePdf(arrayBuffer);
  return reconstruirTextoDeItensPdf(itens);
}
