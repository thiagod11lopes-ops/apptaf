import { reconstruirTextoDeItensPdf } from './pdfTextLayout';

export async function extrairTextoDePdf(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/build/pdf.worker.min.mjs';

  const data = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);

  const pdf = await pdfjs.getDocument({
    data,
    useSystemFonts: true,
  }).promise;

  const partes: string[] = [];

  for (let pagina = 1; pagina <= pdf.numPages; pagina += 1) {
    const page = await pdf.getPage(pagina);
    const content = await page.getTextContent();
    const textoPagina = reconstruirTextoDeItensPdf(
      content.items as Array<{ str?: string; transform?: number[] }>,
    );
    if (textoPagina.trim()) partes.push(textoPagina);
  }

  return partes.join('\n');
}
