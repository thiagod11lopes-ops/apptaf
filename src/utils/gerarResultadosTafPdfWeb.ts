import type { AplicadorAssinaturaResumo } from '../types/aplicadorAssinatura';
import { postoGradExibicaoAssinatura } from '../types/aplicadorAssinatura';
import type { ResultadoTafLinha } from './resultadoTafCadastro';
import type { ResultadosTafPdfBloco } from './resultadosTafPdfPorAplicador';
import {
  colunasDistanciaPdfVisiveis,
  valoresCorridaCaminhadaParaPdf,
} from './corridaCaminhadaExcludente';
import { RUBRICA_PDF_ALTURA, RUBRICA_PDF_LARGURA } from './rubricaConstants';
import {
  desenharRubricaJsPdf,
  renderRubricaSvgToPngDataUrl,
} from './gerarResumoAplicacaoPdfWeb';
import { pdfTextoParaJsPdf } from './pdfLayout';

const pdfTexto = pdfTextoParaJsPdf;

type Coluna = {
  key: string;
  label: string;
  width: number;
  get: (r: ResultadoTafLinha) => string;
  rubrica?: (r: ResultadoTafLinha) => string | undefined;
};

function tituloResultadosTafPdf(mostrarCorrida: boolean, mostrarCaminhada: boolean): string {
  const distancias: string[] = [];
  if (mostrarCorrida) distancias.push('Corrida');
  if (mostrarCaminhada) distancias.push('Caminhada');
  const prefixo = distancias.length > 0 ? distancias.join(', ') : 'Distância';
  return `Resultados TAF — ${prefixo}, Natacao e Permanencia`;
}

function desenharAssinaturaAplicador(
  doc: import('jspdf').jsPDF,
  assinatura: AplicadorAssinaturaResumo | undefined,
  pageW: number,
  pageH: number,
  marginX: number,
  usableW: number,
  marginBottom: number,
  pngOf: (svg?: string) => string | null,
): void {
  if (!assinatura?.nome?.trim()) {
    // Sem aplicador / sem rúbrica: deixa área em branco (só linha guia).
    const baseY = pageH - marginBottom + 12;
    const cx = marginX + usableW / 2;
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.6);
    doc.line(cx - 50, baseY + 22, cx + 50, baseY + 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(pdfTexto('Aplicador'), cx, baseY + 34, { align: 'center' });
    return;
  }

  const baseY = pageH - marginBottom + 8;
  const cx = marginX + usableW / 2;
  const svg = assinatura.rubricaSvg?.trim();
  if (svg) {
    const png = pngOf(svg);
    const iw = 56;
    const ih = 22;
    if (png) {
      try {
        doc.addImage(png, 'PNG', cx - iw / 2, baseY - 4, iw, ih);
      } catch {
        desenharRubricaJsPdf(doc, svg, cx - iw / 2, baseY - 4, iw, ih);
      }
    } else {
      desenharRubricaJsPdf(doc, svg, cx - iw / 2, baseY - 4, iw, ih);
    }
  }
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.6);
  doc.line(cx - 50, baseY + 22, cx + 50, baseY + 22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(30, 41, 59);
  doc.text(pdfTexto(postoGradExibicaoAssinatura(assinatura)), cx, baseY + 32, {
    align: 'center',
  });
  doc.setFont('helvetica', 'normal');
  doc.text(pdfTexto(assinatura.nome), cx, baseY + 42, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(pdfTexto(`NIP ${assinatura.nip || '—'}`), cx, baseY + 51, { align: 'center' });
  void pageW;
}

/**
 * PDF A4 paisagem: uma tabela (ou conjunto de folhas) por aplicador,
 * cada uma com a rúbrica própria daquele aplicador.
 */
export async function gerarResultadosTafPdfBlobWeb(
  blocos: ResultadosTafPdfBloco[],
  subtitulo: string,
): Promise<Blob> {
  if (blocos.length === 0) {
    throw new Error('Não há resultados para exportar.');
  }

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 18;
  const marginTop = 24;
  const marginBottom = 70;
  const usableW = pageW - marginX * 2;

  const todasLinhas = blocos.flatMap((b) => b.linhas);
  const { mostrarCorrida, mostrarCaminhada } = colunasDistanciaPdfVisiveis(todasLinhas);

  const rubW = 28;
  const rubH = 16;
  const colunas: Coluna[] = [
    { key: 'pg', label: 'P/G', width: 36, get: (r) => r.postoGrad },
    { key: 'nip', label: 'NIP', width: 52, get: (r) => r.nip },
    { key: 'nome', label: 'Nome', width: 90, get: (r) => r.nome },
  ];
  if (mostrarCorrida) {
    colunas.push(
      { key: 'nc', label: 'Nota corr.', width: 38, get: (r) => r.notaCorrida },
      { key: 'sc', label: 'Sit.', width: 42, get: (r) => r.situacaoCorrida },
      {
        key: 'rc',
        label: 'Rub.',
        width: rubW + 4,
        get: () => '',
        rubrica: (r) => r.rubricaCorridaSvg,
      },
    );
  }
  if (mostrarCaminhada) {
    colunas.push(
      { key: 'ncam', label: 'Nota cam.', width: 38, get: (r) => r.notaCaminhada },
      { key: 'scam', label: 'Sit.', width: 42, get: (r) => r.situacaoCaminhada },
      {
        key: 'rcam',
        label: 'Rub.',
        width: rubW + 4,
        get: () => '',
        rubrica: (r) => r.rubricaCaminhadaSvg,
      },
    );
  }
  colunas.push(
    { key: 'nn', label: 'Nota nat.', width: 38, get: (r) => r.notaNatacao },
    { key: 'sn', label: 'Sit.', width: 42, get: (r) => r.situacaoNatacao },
    {
      key: 'rn',
      label: 'Rub.',
      width: rubW + 4,
      get: () => '',
      rubrica: (r) => r.rubricaNatacaoSvg,
    },
    { key: 'sp', label: 'Sit. perm.', width: 48, get: (r) => r.situacaoPermanencia },
    {
      key: 'rp',
      label: 'Rub.',
      width: rubW + 4,
      get: () => '',
      rubrica: (r) => r.rubricaPermanenciaSvg,
    },
  );

  const totalW = colunas.reduce((acc, c) => acc + c.width, 0);
  const scale = usableW / totalW;
  const colWs = colunas.map((c) => c.width * scale);

  const temRubrica = todasLinhas.some(
    (r) =>
      (mostrarCorrida && r.rubricaCorridaSvg) ||
      (mostrarCaminhada && r.rubricaCaminhadaSvg) ||
      r.rubricaNatacaoSvg ||
      r.rubricaPermanenciaSvg,
  );
  const rowH = temRubrica ? Math.max(22, rubH + 8) : 14;
  const headerH = 16;
  const geradoEm = new Date().toLocaleString('pt-BR');
  const tituloDoc = tituloResultadosTafPdf(mostrarCorrida, mostrarCaminhada);
  const totalRegistros = todasLinhas.length;

  const pngCache = new Map<string, string | null>();
  const pngOf = (svg?: string) => {
    const key = svg?.trim() || '';
    if (!key) return null;
    if (!pngCache.has(key)) {
      pngCache.set(key, renderRubricaSvgToPngDataUrl(key, RUBRICA_PDF_LARGURA, RUBRICA_PDF_ALTURA));
    }
    return pngCache.get(key) ?? null;
  };

  let y = marginTop;
  let primeiraPagina = true;

  const desenharCabecalhoPagina = (rotuloAplicador: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text(pdfTexto(tituloDoc), marginX, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    doc.text(
      pdfTexto(`${subtitulo} · Gerado em ${geradoEm} · ${totalRegistros} registro(s)`),
      marginX,
      y,
    );
    y += 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(pdfTexto(rotuloAplicador), marginX, y);
    y += 12;
  };

  const desenharHeaderTabela = () => {
    doc.setFillColor(241, 245, 249);
    doc.rect(marginX, y, usableW, headerH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(30, 41, 59);
    let x = marginX;
    for (let i = 0; i < colunas.length; i += 1) {
      const col = colunas[i]!;
      const w = colWs[i]!;
      doc.text(pdfTexto(col.label), x + w / 2, y + 11, {
        align: 'center',
        maxWidth: w - 4,
      });
      x += w;
    }
    y += headerH;
  };

  const desenharLinha = (linhaRaw: ResultadoTafLinha) => {
    const linha = { ...linhaRaw, ...valoresCorridaCaminhadaParaPdf(linhaRaw) };
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(marginX, y + rowH, marginX + usableW, y + rowH);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(17, 24, 39);

    let x = marginX;
    for (let i = 0; i < colunas.length; i += 1) {
      const col = colunas[i]!;
      const w = colWs[i]!;
      const svg = col.rubrica?.(linha)?.trim();
      if (svg) {
        const png = pngOf(svg);
        const bx = x + (w - rubW) / 2;
        const by = y + (rowH - rubH) / 2;
        if (png) {
          try {
            doc.addImage(png, 'PNG', bx, by, rubW, rubH);
          } catch {
            desenharRubricaJsPdf(doc, svg, bx, by, rubW, rubH);
          }
        } else {
          desenharRubricaJsPdf(doc, svg, bx, by, rubW, rubH);
        }
      } else {
        const text = pdfTexto(col.get(linha) || '—');
        doc.text(text, x + w / 2, y + rowH / 2 + 2, {
          align: 'center',
          maxWidth: w - 4,
        });
      }
      x += w;
    }
    y += rowH;
  };

  for (let bi = 0; bi < blocos.length; bi += 1) {
    const bloco = blocos[bi]!;
    if (!primeiraPagina) {
      doc.addPage();
      y = marginTop;
    }
    primeiraPagina = false;

    desenharCabecalhoPagina(bloco.rotuloAplicador);
    desenharHeaderTabela();

    for (const linha of bloco.linhas) {
      if (y + rowH > pageH - marginBottom) {
        desenharAssinaturaAplicador(
          doc,
          bloco.aplicadorAssinatura,
          pageW,
          pageH,
          marginX,
          usableW,
          marginBottom,
          pngOf,
        );
        doc.addPage();
        y = marginTop;
        desenharCabecalhoPagina(bloco.rotuloAplicador);
        desenharHeaderTabela();
      }
      desenharLinha(linha);
    }

    desenharAssinaturaAplicador(
      doc,
      bloco.aplicadorAssinatura,
      pageW,
      pageH,
      marginX,
      usableW,
      marginBottom,
      pngOf,
    );
  }

  return doc.output('blob');
}
