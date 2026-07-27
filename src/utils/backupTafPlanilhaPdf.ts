import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import {
  calcularBalancoPlanilhaTaf,
  enriquecerCadastrosComRubricasDasSessoes,
  montarLinhasArmada,
  montarLinhasFn,
  type BalancoPlanilhaTaf,
  type LinhaPlanilhaArmada,
  type LinhaPlanilhaFn,
} from './backupTafOds';
import { formatBrDateKey } from './backupNaming';
import { pdfTextoParaJsPdf } from './pdfLayout';

const pdfTexto = pdfTextoParaJsPdf;

type ColDef = { label: string; width: number; get: (row: Record<string, string>) => string };

const COLS_ARMADA: ColDef[] = [
  { label: 'P/G', width: 36, get: (r) => r.pg ?? '' },
  { label: 'NIP', width: 52, get: (r) => r.nip ?? '' },
  { label: 'Nome', width: 110, get: (r) => r.nome ?? '' },
  { label: 'Idade', width: 28, get: (r) => r.idade ?? '' },
  { label: 'Corr. tempo', width: 48, get: (r) => r.corridaTempo ?? '' },
  { label: 'Corr. pts', width: 40, get: (r) => r.corridaPontos ?? '' },
  { label: 'Nat. tempo', width: 48, get: (r) => r.natacaoTempo ?? '' },
  { label: 'Nat. pts', width: 40, get: (r) => r.natacaoPontos ?? '' },
  { label: 'Permanencia', width: 52, get: (r) => r.permanencia ?? '' },
  { label: 'Geral', width: 58, get: (r) => r.geral ?? '' },
];

const COLS_FN: ColDef[] = [
  { label: 'P/G', width: 30, get: (r) => r.pg ?? '' },
  { label: 'NIP', width: 46, get: (r) => r.nip ?? '' },
  { label: 'Nome', width: 88, get: (r) => r.nome ?? '' },
  { label: 'Idade', width: 24, get: (r) => r.idade ?? '' },
  { label: 'Perm.', width: 40, get: (r) => r.permanencia ?? '' },
  { label: 'Nat. t', width: 36, get: (r) => r.natacaoTempo ?? '' },
  { label: 'Nat. p', width: 32, get: (r) => r.natacaoPontos ?? '' },
  { label: 'Barra', width: 28, get: (r) => r.flexaoBarra ?? '' },
  { label: 'Solo', width: 28, get: (r) => r.flexaoSolo ?? '' },
  { label: 'Flex p', width: 32, get: (r) => r.flexaoPontos ?? '' },
  { label: 'Abd.', width: 32, get: (r) => r.abdominal ?? '' },
  { label: 'Abd p', width: 32, get: (r) => r.abdominalPontos ?? '' },
  { label: 'Corr.', width: 36, get: (r) => r.corrida ?? '' },
  { label: 'Corr p', width: 32, get: (r) => r.corridaPontos ?? '' },
  { label: 'Geral', width: 48, get: (r) => r.geral ?? '' },
];

function armadaToRecord(row: LinhaPlanilhaArmada): Record<string, string> {
  return {
    pg: row.pg,
    nip: row.nip,
    nome: row.nome,
    idade: row.idade,
    corridaTempo: row.corridaTempo,
    corridaPontos: row.corridaPontos,
    natacaoTempo: row.natacaoTempo,
    natacaoPontos: row.natacaoPontos,
    permanencia: row.permanencia,
    geral: row.geral,
  };
}

function fnToRecord(row: LinhaPlanilhaFn): Record<string, string> {
  return {
    pg: row.pg,
    nip: row.nip,
    nome: row.nome,
    idade: row.idade,
    permanencia: row.permanencia,
    natacaoTempo: row.natacaoTempo,
    natacaoPontos: row.natacaoPontos,
    flexaoBarra: row.flexaoBarra,
    flexaoSolo: row.flexaoSolo,
    flexaoPontos: row.flexaoPontos,
    abdominal: row.abdominal,
    abdominalPontos: row.abdominalPontos,
    corrida: row.corrida,
    corridaPontos: row.corridaPontos,
    geral: row.geral,
  };
}

function corGeral(valor: string): [number, number, number] {
  const v = valor.trim().toUpperCase();
  if (v === 'APROVADO') return [21, 128, 61];
  if (v === 'REPROVADO') return [220, 38, 38];
  if (v === 'TESTE PENDENTE') return [234, 88, 12];
  return [30, 41, 59];
}

/**
 * PDF A4 paisagem com os mesmos dados da planilha TAF apptaf (abas Armada e FN).
 */
export async function buildBackupPlanilhaPdfBytes(
  cadastros: CadastroItemPersist[],
  sessoes: SessaoAplicacaoTaf[] = [],
): Promise<Uint8Array> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const comRubricas = enriquecerCadastrosComRubricasDasSessoes(cadastros, sessoes);
  const balanco = calcularBalancoPlanilhaTaf(cadastros);
  const armada = montarLinhasArmada(comRubricas, [], 'rubrica_a', sessoes).map(armadaToRecord);
  const fn = montarLinhasFn(comRubricas, [], 'rubrica_fn', sessoes).map(fnToRecord);
  const geradoEm = formatBrDateKey();
  const ano = String(new Date().getFullYear());

  drawSheet(doc, {
    titulo: `TESTE DE APTIDAO FISICA (TAF) ${ano} Armada`,
    balanco,
    colunas: COLS_ARMADA,
    linhas: armada,
    geradoEm,
    firstPage: true,
  });

  drawSheet(doc, {
    titulo: `TESTE DE APTIDAO FISICA (TAF) ${ano} FN`,
    balanco,
    colunas: COLS_FN,
    linhas: fn,
    geradoEm,
    firstPage: false,
  });

  const ab = doc.output('arraybuffer');
  return new Uint8Array(ab);
}

function drawSheet(
  doc: import('jspdf').jsPDF,
  opts: {
    titulo: string;
    balanco: BalancoPlanilhaTaf;
    colunas: ColDef[];
    linhas: Record<string, string>[];
    geradoEm: string;
    firstPage: boolean;
  },
): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 16;
  const marginTop = 22;
  const marginBottom = 24;
  const usableW = pageW - marginX * 2;
  const totalW = opts.colunas.reduce((acc, c) => acc + c.width, 0);
  const scale = usableW / totalW;
  const colWs = opts.colunas.map((c) => c.width * scale);
  const rowH = 13;
  const headerH = 15;

  let y = marginTop;
  let pageInSheet = 0;

  const startPage = () => {
    if (!opts.firstPage || pageInSheet > 0) {
      doc.addPage();
    }
    pageInSheet += 1;
    y = marginTop;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text(pdfTexto(opts.titulo), marginX, y);
    y += 13;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);
    doc.text(
      pdfTexto(
        `Balanço: cadastrados ${opts.balanco.cadastrados} | parcial ${opts.balanco.parcial} | completo ${opts.balanco.completo} - Gerado em ${opts.geradoEm} - ${opts.linhas.length} militar(es).`,
      ),
      marginX,
      y,
    );
    y += 12;
    drawHeader();
  };

  const drawHeader = () => {
    doc.setFillColor(30, 58, 95);
    doc.rect(marginX, y, usableW, headerH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(255, 255, 255);
    let x = marginX;
    for (let i = 0; i < opts.colunas.length; i += 1) {
      const col = opts.colunas[i]!;
      const w = colWs[i]!;
      doc.text(pdfTexto(col.label), x + w / 2, y + 10, {
        align: 'center',
        maxWidth: w - 3,
      });
      x += w;
    }
    y += headerH;
  };

  const ensureSpace = () => {
    if (y + rowH > pageH - marginBottom) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(pdfTexto(`Planilha PDF (${opts.geradoEm})`), marginX, pageH - 10);
      startPage();
    }
  };

  startPage();

  if (opts.linhas.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(pdfTexto('Nenhum militar com teste nesta aba.'), marginX, y + 14);
    return;
  }

  for (let li = 0; li < opts.linhas.length; li += 1) {
    ensureSpace();
    const row = opts.linhas[li]!;
    if (li % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, y, usableW, rowH, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    let x = marginX;
    for (let i = 0; i < opts.colunas.length; i += 1) {
      const col = opts.colunas[i]!;
      const w = colWs[i]!;
      const raw = col.get(row);
      if (col.label === 'Geral') {
        const [r, g, b] = corGeral(raw);
        doc.setTextColor(r, g, b);
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'normal');
      }
      doc.text(pdfTexto(raw || '—'), x + w / 2, y + 9, {
        align: 'center',
        maxWidth: w - 3,
      });
      x += w;
    }
    y += rowH;
  }
}

export const PLANILHA_PDF_MIME_TYPE = 'application/pdf';
