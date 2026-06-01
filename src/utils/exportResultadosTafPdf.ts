import { Platform, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { ResultadoTafLinha } from './resultadoTafCadastro';
import { celulaRubricaHtml, RUBRICA_PDF_STYLES } from './rubricaHtml';

const PDF_A4_LANDSCAPE_WIDTH = 842;
const PDF_A4_LANDSCAPE_HEIGHT = 595;

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
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 12px; }
    h1 { font-size: 16px; margin: 0 0 4px; }
    .sub { color: #444; margin-bottom: 12px; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: middle; }
    th { background: #e8eef5; font-weight: 700; }
    th.col-rubrica, td.col-rubrica { text-align: center; }
    .nota { font-weight: 700; text-align: center; }
    ${RUBRICA_PDF_STYLES}
  </style>
</head>
<body>
  <h1>Resultados TAF — Corrida, Natação e Permanência</h1>
  <p class="sub">${escapeHtml(subtitulo)} · Gerado em ${escapeHtml(dataStr)} · ${linhas.length} registro(s)</p>
  <table>
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
