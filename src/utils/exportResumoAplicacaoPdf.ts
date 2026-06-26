import { Platform, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { ResultadoCorridaItem } from '../navigation/AppNavigator';
import { postoGradExibicaoAssinatura, type AplicadorAssinaturaResumo } from '../types/aplicadorAssinatura';
import { formatMsByModality } from '../taf/tafTimeFormat';
import { celulaRubricaHtml, PDF_TABELA_COMPACTA_STYLES, RUBRICA_PDF_STYLES } from './rubricaHtml';

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** A4 paisagem em pontos (72 PPI) — usado no PDF nativo e como referência de layout. */
const PDF_A4_LANDSCAPE_WIDTH = 842;
const PDF_A4_LANDSCAPE_HEIGHT = 595;

const PRINT_LANDSCAPE_CSS = `
    @page {
      size: A4 landscape;
      margin: 10mm;
    }
    @media print {
      html, body { width: 100%; margin: 0; }
      body { padding: 12px; }
    }
`;

/** Cabeçalho da 1ª coluna: Nadador (só natação), Corredor (só corrida), ou ambos se misto. */
export function cabecalhoColunaProvaResultados(resultados: ResultadoCorridaItem[]): string {
  const temNatacao = resultados.some((r) => r.prova === 'natacao');
  const temCorrida = resultados.some((r) => r.prova !== 'natacao');
  if (temNatacao && !temCorrida) return 'Nadador';
  if (temCorrida && !temNatacao) return 'Corredor';
  return 'Corredor / Nadador';
}

function blocoAplicadorAssinaturaHtml(assinatura?: AplicadorAssinaturaResumo): string {
  if (!assinatura?.nome?.trim()) return '';
  const postoGrad = escapeHtml(postoGradExibicaoAssinatura(assinatura));
  return `<div class="aplicador-assinatura">
    <hr class="aplicador-linha"/>
    <p class="aplicador-identificacao">
      <span class="aplicador-posto-grad">${postoGrad}</span>
      <span class="aplicador-nome">${escapeHtml(assinatura.nome)}</span>
    </p>
    <p class="aplicador-nip">NIP ${escapeHtml(assinatura.nip || '—')}</p>
  </div>`;
}

/**
 * HTML completo do resumo (impressão / PDF nativo).
 */
export function buildResumoAplicacaoHtml(
  resultados: ResultadoCorridaItem[],
  textoColunaCadastro: string,
  titulo = 'Resumo da aplicação — TAF',
  aplicadorAssinatura?: AplicadorAssinaturaResumo,
): string {
  const dataStr = new Date().toLocaleString('pt-BR');
  const colProva = escapeHtml(cabecalhoColunaProvaResultados(resultados));
  const temNotas = resultados.some((r) => r.notaTexto != null && r.notaTexto !== '');

  /** Colunas fixas do PDF: Nadador/Corredor, Nome, NIP, Tempo, Nota, Situação, Rúbrica do candidato */
  const theadPdf = `<th>${colProva}</th><th>Nome</th><th>NIP</th><th>Tempo</th><th>Nota</th><th>Situação</th><th class="col-rubrica">Rúbrica</th>`;

  const rows = resultados
    .map((r) => {
      const papel = r.prova === 'natacao' ? 'Nadador' : 'Corredor';
      const nip = r.nip ? escapeHtml(r.nip) : '—';
      const nota = escapeHtml(r.notaTexto ?? '—');
      const situacao = escapeHtml(
        r.reprovacaoTexto ?? (r.notaTexto === 'REPROVADO' ? 'Reprovado' : 'Aprovado'),
      );
      const rubrica = celulaRubricaHtml(r.rubricaCandidatoSvg);
      return `<tr>
        <td>${papel} ${r.corredor}</td>
        <td>${escapeHtml(r.nome)}</td>
        <td>${nip}</td>
        <td class="tempo">${escapeHtml(formatMsByModality(r.prova ?? 'corrida', r.tempoMs))}</td>
        <td class="nota">${nota}</td>
        <td class="repro">${situacao}</td>
        <td class="col-rubrica">${rubrica}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(titulo)}</title>
  <style>
    body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #111827; line-height: 1.15; }
    h1 { font-size: 27px; margin: 0 0 8px; line-height: 1.15; }
    .meta { font-size: 18px; color: #6B7280; margin-bottom: 16px; line-height: 1.15; }
    .intro { font-size: 20px; margin-bottom: 20px; line-height: 1.28; color: #374151; }
    .tempo { font-weight: 800; color: #15803D; font-family: ui-monospace, monospace; }
    ${PDF_TABELA_COMPACTA_STYLES}
    ${RUBRICA_PDF_STYLES}
    .aplicador-assinatura {
      margin-top: 28px;
      text-align: center;
      page-break-inside: avoid;
    }
    .aplicador-linha {
      width: 72%;
      max-width: 420px;
      margin: 0 auto 12px;
      border: none;
      border-top: 1px solid #374151;
    }
    .aplicador-identificacao {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: center;
      gap: 8px;
      margin: 0 0 4px;
    }
    .aplicador-posto-grad {
      font-size: 14px;
      font-weight: 700;
      color: #6B7280;
    }
    .aplicador-nome {
      font-size: 16px;
      font-weight: 800;
      color: #111827;
    }
    .aplicador-nip {
      font-size: 13px;
      font-weight: 600;
      color: #6B7280;
      margin: 0;
    }
    ${PRINT_LANDSCAPE_CSS}
  </style>
</head>
<body>
  <h1>${escapeHtml(titulo)}</h1>
  <p class="meta">Gerado em ${escapeHtml(dataStr)}</p>
  <p class="intro">Os tempos compatíveis com o cadastro foram gravados na coluna <strong>${escapeHtml(
    textoColunaCadastro,
  )}</strong> da planilha de Cadastro.${
    temNotas
      ? ' Notas conforme faixa etária e tempos limite (50 a 100 pontos). Corrida e natação: tabelas F e M.'
      : ''
  } Abaixo, o resumo desta aplicação.</p>
  ${
    resultados.length === 0
      ? '<p style="color:#9CA3AF;font-weight:700;">Nenhum resultado nesta sessão.</p>'
      : `<table class="resultados-taf">
    <thead><tr>${theadPdf}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`
  }
  ${blocoAplicadorAssinaturaHtml(aplicadorAssinatura)}
</body>
</html>`;
}

/**
 * Gera PDF no dispositivo (nativo) ou abre janela de impressão (web — escolha “Salvar como PDF”).
 */
export async function exportResumoAplicacaoPdf(
  resultados: ResultadoCorridaItem[],
  textoColunaCadastro: string,
  aplicadorAssinatura?: AplicadorAssinaturaResumo,
): Promise<void> {
  const html = buildResumoAplicacaoHtml(resultados, textoColunaCadastro, undefined, aplicadorAssinatura);

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
    setTimeout(() => {
      win.print();
    }, 300);
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
      dialogTitle: 'Salvar PDF — Resumo TAF',
      UTI: 'com.adobe.pdf',
    });
  } else {
    Alert.alert(
      'PDF gerado',
      'Não foi possível abrir o compartilhamento neste dispositivo. O arquivo foi salvo na área de cache do app.',
    );
  }
}
