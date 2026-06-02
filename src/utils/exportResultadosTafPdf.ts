import { Platform, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { ResultadoTafLinha } from './resultadoTafCadastro';
import { celulaRubricaHtml, PDF_TABELA_COMPACTA_STYLES, RUBRICA_PDF_STYLES } from './rubricaHtml';

const PDF_A4_LANDSCAPE_WIDTH = 842;
const PDF_A4_LANDSCAPE_HEIGHT = 595;

/** Altura útil estimada por linha (rúbricas) em pontos — A4 paisagem. */
const PDF_RESULTADOS_ROW_HEIGHT_PT = 85;
const PDF_RESULTADOS_FIRST_PAGE_OVERHEAD_PT = 130;
const PDF_RESULTADOS_PAGE_USABLE_PT = 514;
const PDF_RESULTADOS_ROWS_FIRST_PAGE = Math.floor(
  (PDF_A4_LANDSCAPE_HEIGHT - PDF_RESULTADOS_FIRST_PAGE_OVERHEAD_PT) / PDF_RESULTADOS_ROW_HEIGHT_PT,
);
const PDF_RESULTADOS_ROWS_OTHER_PAGE = Math.floor(
  PDF_RESULTADOS_PAGE_USABLE_PT / PDF_RESULTADOS_ROW_HEIGHT_PT,
);

/** Estima quantas folhas A4 paisagem serão necessárias para imprimir a tabela de resultados. */
export function estimarFolhasA4PdfResultadosTaf(quantidadeLinhas: number): number {
  if (quantidadeLinhas <= 0) return 0;
  if (quantidadeLinhas <= PDF_RESULTADOS_ROWS_FIRST_PAGE) return 1;
  const restantes = quantidadeLinhas - PDF_RESULTADOS_ROWS_FIRST_PAGE;
  return 1 + Math.ceil(restantes / PDF_RESULTADOS_ROWS_OTHER_PAGE);
}

/** Tempo padrão da prova de permanência em relatórios PDF. */
export const PERMANENCIA_TEMPO_PDF_PADRAO = '10 minutos';

function permanenciaTempoParaPdf(linha: ResultadoTafLinha): string {
  const temPermanencia =
    linha.situacaoPermanencia !== '—' || linha.permanenciaTempo !== '—';
  return temPermanencia ? PERMANENCIA_TEMPO_PDF_PADRAO : '—';
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildResultadosTafHtml(
  linhas: ResultadoTafLinha[],
  subtitulo: string,
): string {
  const dataStr = new Date().toLocaleString('pt-BR');
  const rows = linhas
    .map(
      (r) => `<tr>
        <td>${escapeHtml(r.nip)}</td>
        <td>${escapeHtml(r.nome)}</td>
        <td class="nota">${escapeHtml(r.notaCorrida)}</td>
        <td>${escapeHtml(r.situacaoCorrida)}</td>
        <td class="col-rubrica">${celulaRubricaHtml(r.rubricaCorridaSvg)}</td>
        <td class="nota">${escapeHtml(r.notaNatacao)}</td>
        <td>${escapeHtml(r.situacaoNatacao)}</td>
        <td class="col-rubrica">${celulaRubricaHtml(r.rubricaNatacaoSvg)}</td>
        <td>${escapeHtml(permanenciaTempoParaPdf(r))}</td>
        <td>${escapeHtml(r.situacaoPermanencia)}</td>
        <td class="col-rubrica">${celulaRubricaHtml(r.rubricaPermanenciaSvg)}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>Resultados TAF</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    body { font-family: Arial, sans-serif; font-size: 17px; color: #111; padding: 12px; line-height: 1.15; }
    h1 { font-size: 24px; margin: 0 0 4px; line-height: 1.15; }
    .sub { color: #444; margin-bottom: 12px; font-size: 17px; line-height: 1.15; }
    ${PDF_TABELA_COMPACTA_STYLES}
    ${RUBRICA_PDF_STYLES}
  </style>
</head>
<body>
  <h1>Resultados TAF — Corrida, Natação e Permanência</h1>
  <p class="sub">${escapeHtml(subtitulo)} · Gerado em ${escapeHtml(dataStr)} · ${linhas.length} registro(s)</p>
  <table class="resultados-taf">
    <thead>
      <tr>
        <th>NIP</th>
        <th>Nome</th>
        <th>Nota corrida</th>
        <th>Situação corrida</th>
        <th class="col-rubrica">Rúbrica</th>
        <th>Nota natação</th>
        <th>Situação natação</th>
        <th class="col-rubrica">Rúbrica</th>
        <th>Permanência (tempo)</th>
        <th>Situação permanência</th>
        <th class="col-rubrica">Rúbrica</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="11">Nenhum registro</td></tr>'}</tbody>
  </table>
</body>
</html>`;
}

export async function exportResultadosTafPdf(
  linhas: ResultadoTafLinha[],
  subtitulo: string,
): Promise<void> {
  if (linhas.length === 0) {
    throw new Error('Não há resultados para exportar.');
  }

  const html = buildResultadosTafHtml(linhas, subtitulo);

  if (Platform.OS === 'web') {
    const win = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    if (!win) {
      throw new Error(
        'Não foi possível abrir a janela de impressão. Permita pop-ups neste site e tente novamente.',
      );
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
    return;
  }

  const { uri } = await Print.printToFileAsync({
    html,
    width: PDF_A4_LANDSCAPE_WIDTH,
    height: PDF_A4_LANDSCAPE_HEIGHT,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Salvar PDF — Resultados TAF',
      UTI: 'com.adobe.pdf',
    });
  } else {
    Alert.alert('PDF gerado', 'Arquivo salvo na área de cache do app.');
  }
}
