import type { EstatisticasTafCompletas, EstatisticasTemposResumo } from './estatisticasTaf';
import { META_CONCLUSAO_TAF_PCT } from './estatisticasTaf';

const temposVazio: EstatisticasTemposResumo = {
  mediaSeg: 720,
  mediaFmt: '12:00',
  melhorFmt: '10:45',
  piorFmt: '14:20',
  amostra: 48,
};

/** Dados fictícios para pré-visualizar os gráficos da aba Estatísticas. */
export function criarEstatisticasTafDemonstracao(): EstatisticasTafCompletas {
  return {
    resumo: {
      totalCadastros: 120,
      comCorrida: 72,
      comCaminhada: 18,
      comNatacao: 65,
      comPermanencia: 58,
      comQualquerRegistroTaf: 85,
      idadeMedia: 32,
      tafCompleto: 52,
      tafParcial: 33,
      semNenhumTeste: 35,
      taxaConclusaoTafPct: 43,
      mediaMilitaresPorDia: 14,
      diasComAplicacao: 9,
    },
    porCategoria: [
      { label: 'Oficiais', valor: 42 },
      { label: 'Praças', valor: 78 },
    ],
    porSexo: [
      { label: 'Masculino', valor: 95 },
      { label: 'Feminino', valor: 25 },
    ],
    porFaixaEtaria: [
      { label: '18–25', valor: 22 },
      { label: '26–33', valor: 38 },
      { label: '34–39', valor: 31 },
      { label: '40–45', valor: 19 },
      { label: '46–49', valor: 7 },
      { label: '50+', valor: 3 },
    ],
    registrosModalidade: [
      { label: 'Corrida', valor: 72 },
      { label: 'Caminhada', valor: 18 },
      { label: 'Natação', valor: 65 },
      { label: 'Permanência', valor: 58 },
    ],
    corridaVsCaminhada: [
      { label: 'Corrida 2400 m', valor: 72 },
      { label: 'Caminhada 4800 m', valor: 18 },
    ],
    pendenciasModalidade: [
      { label: 'Corrida', valor: 28 },
      { label: 'Natação', valor: 35 },
      { label: 'Permanência', valor: 42 },
    ],
    notasCorrida: [
      { label: '100', valor: 8 },
      { label: '90', valor: 14 },
      { label: '80', valor: 18 },
      { label: '70', valor: 12 },
      { label: '60', valor: 9 },
      { label: '50', valor: 6 },
      { label: 'REPROVADO', valor: 5 },
    ],
    notasCaminhada: [
      { label: '100', valor: 2 },
      { label: '90', valor: 4 },
      { label: '80', valor: 5 },
      { label: '70', valor: 3 },
      { label: 'REPROVADO', valor: 4 },
    ],
    notasNatacao: [
      { label: '100', valor: 6 },
      { label: '90', valor: 11 },
      { label: '80', valor: 15 },
      { label: '70', valor: 10 },
      { label: '60', valor: 8 },
      { label: 'REPROVADO', valor: 7 },
    ],
    permanencia: [
      { label: 'Aprovado', valor: 48 },
      { label: 'Reprovado', valor: 10 },
    ],
    registrosPorData: [
      { data: '01/03', corrida: 8, caminhada: 2, natacao: 6, permanencia: 5, total: 21, militaresUnicos: 12 },
      { data: '03/03', corrida: 10, caminhada: 1, natacao: 7, permanencia: 6, total: 24, militaresUnicos: 15 },
      { data: '05/03', corrida: 6, caminhada: 3, natacao: 5, permanencia: 4, total: 18, militaresUnicos: 11 },
      { data: '08/03', corrida: 12, caminhada: 2, natacao: 9, permanencia: 8, total: 31, militaresUnicos: 18 },
      { data: '10/03', corrida: 9, caminhada: 1, natacao: 8, permanencia: 7, total: 25, militaresUnicos: 14 },
      { data: '12/03', corrida: 11, caminhada: 2, natacao: 10, permanencia: 9, total: 32, militaresUnicos: 16 },
      { data: '15/03', corrida: 7, caminhada: 4, natacao: 6, permanencia: 5, total: 22, militaresUnicos: 13 },
    ],
    registrosPorMes: [
      { mes: 'Out/25', corrida: 18, caminhada: 4, natacao: 15, permanencia: 12, total: 49 },
      { mes: 'Nov/25', corrida: 22, caminhada: 5, natacao: 19, permanencia: 16, total: 62 },
      { mes: 'Dez/25', corrida: 20, caminhada: 3, natacao: 17, permanencia: 14, total: 54 },
      { mes: 'Jan/26', corrida: 25, caminhada: 6, natacao: 21, permanencia: 18, total: 70 },
      { mes: 'Fev/26', corrida: 28, caminhada: 4, natacao: 24, permanencia: 20, total: 76 },
      { mes: 'Mar/26', corrida: 32, caminhada: 8, natacao: 27, permanencia: 22, total: 89 },
    ],
    temposCorrida: temposVazio,
    temposCaminhada: { ...temposVazio, mediaFmt: '28:30', melhorFmt: '25:10', piorFmt: '32:00' },
    temposNatacao: { ...temposVazio, mediaFmt: '1:05', melhorFmt: '0:52', piorFmt: '1:18' },
    temposPermanencia: { ...temposVazio, mediaFmt: '10:00', melhorFmt: '10:00', piorFmt: '10:00' },
    taxas: {
      permanenciaAprovadosPct: 83,
      corridaSemReprovacaoPct: 78,
      natacaoSemReprovacaoPct: 74,
      caminhadaSemReprovacaoPct: 72,
      corridaNota50PlusPct: 81,
      natacaoNota50PlusPct: 76,
      caminhadaNota50PlusPct: 70,
      taxaGlobalAprovacaoPct: 68,
      reprovados2PlusModalidadesPct: 12,
    },
    topPostosGrad: [
      { label: 'CB', valor: 28 },
      { label: '3°SG', valor: 18 },
      { label: '2°TEN', valor: 12 },
      { label: '1°SG', valor: 11 },
      { label: 'MN', valor: 10 },
    ],
    desempenhoPorPosto: [
      { label: 'CB', valor: 78, hint: 'n=28' },
      { label: '3°SG', valor: 82, hint: 'n=18' },
      { label: '2°TEN', valor: 85, hint: 'n=12' },
      { label: '1°SG', valor: 74, hint: 'n=11' },
    ],
    notaMediaCorrida: 76,
    notaMediaNatacao: 72,
    notaMediaCaminhada: 71,
    notaMediaGeral: 75,
    medianaNotas: 78,
    notaMediaPorFaixaEtaria: {},
    notaMediaPorSexo: {},
    notaMediaPorCategoria: {},
    aprovacaoPorCategoria: [
      { label: 'Oficiais', valor: 72 },
      { label: 'Praças', valor: 65 },
    ],
    heatmapReprovacao: [
      { faixa: '18–25', corridaPct: 8, caminhadaPct: 12, natacaoPct: 15, amostra: 22 },
      { faixa: '26–33', corridaPct: 14, caminhadaPct: 10, natacaoPct: 18, amostra: 38 },
      { faixa: '34–39', corridaPct: 18, caminhadaPct: 16, natacaoPct: 12, amostra: 31 },
      { faixa: '40–45', corridaPct: 22, caminhadaPct: 20, natacaoPct: 19, amostra: 19 },
    ],
    rankingTempos: { corrida: [], caminhada: [], natacao: [] },
    operacional: {
      totalSessoes: 34,
      mediaParticipantesPorSessao: 12,
      provaMaisAplicada: 'Corrida',
      contagemPorProva: { corrida: 14, caminhada: 5, natacao: 9, permanencia: 6 },
    },
    qualidade: { cadastrosIncompletos: 4, notasInconsistentes: 2, idadeInvalida: 1 },
    metaConclusao: { metaPct: META_CONCLUSAO_TAF_PCT, atualPct: 43, faltam: 44 },
    cadastrosNovos: { ultimos30: 8, ultimos90: 22, disponivel: true },
  };
}

/** IDs representativos exibidos no modal de exemplos. */
export const GRAFICOS_DEMO_IDS = new Set([
  'Status do TAF',
  'conclusao-meta',
  'militares-por-dia',
  'taxas-aprovacao',
  'heatmap-reprovacao',
  'radar-perfil',
  'registros-mes',
]);
