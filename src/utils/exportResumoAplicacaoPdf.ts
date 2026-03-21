import { Platform, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { ResultadoCorridaItem } from '../navigation/AppNavigator';
import { formatElapsedMs } from './formatRaceTime';

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * HTML completo do resumo (impressão / PDF nativo).
 */
export function buildResumoAplicacaoHtml(
  resultados: ResultadoCorridaItem[],
  textoColunaCadastro: string,
  titulo = 'Resumo da aplicação — TAF',
): string {
  const dataStr = new Date().toLocaleString('pt-BR');
  const rows = resultados
    .map((r) => {
      const atleta = r.prova === 'natacao' ? 'Nadador' : 'Corredor';
      const nip = r.nip ? escapeHtml(r.nip) : '—';
      return `<tr>
        <td>${atleta} ${r.corredor}</td>
        <td>${escapeHtml(r.nome)}</td>
        <td>${nip}</td>
        <td class="tempo">${escapeHtml(formatElapsedMs(r.tempoMs))}</td>
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
    body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #111827; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    .meta { font-size: 12px; color: #6B7280; margin-bottom: 16px; }
    .intro { font-size: 13px; margin-bottom: 20px; line-height: 1.5; color: #374151; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; font-weight: 800; color: #374151; }
    .tempo { font-weight: 800; color: #15803D; font-family: ui-monospace, monospace; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(titulo)}</h1>
  <p class="meta">Gerado em ${escapeHtml(dataStr)}</p>
  <p class="intro">Os tempos compatíveis com o cadastro foram gravados na coluna <strong>${escapeHtml(
    textoColunaCadastro,
  )}</strong> da planilha de Cadastro. Abaixo, o resumo desta aplicação.</p>
  ${
    resultados.length === 0
      ? '<p style="color:#9CA3AF;font-weight:700;">Nenhum resultado nesta sessão.</p>'
      : `<table>
    <thead><tr><th>Atleta</th><th>Nome</th><th>NIP</th><th>Tempo</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
  }
</body>
</html>`;
}

/**
 * Gera PDF no dispositivo (nativo) ou abre janela de impressão (web — escolha “Salvar como PDF”).
 */
export async function exportResumoAplicacaoPdf(
  resultados: ResultadoCorridaItem[],
  textoColunaCadastro: string,
): Promise<void> {
  const html = buildResumoAplicacaoHtml(resultados, textoColunaCadastro);

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

  const { uri } = await Print.printToFileAsync({ html });

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
