import type { EChartsCoreOption } from 'echarts/core';
import type { EstatisticasTafCompletas } from '../utils/estatisticasTaf';

export type ChartThemeColors = {
  isDark: boolean;
  text: string;
  textMuted: string;
  primary: string;
  gain: string;
  loss: string;
  chart: string[];
  bg: string;
  border: string;
};

const GRADIENT = (colors: string[]) => ({
  type: 'linear' as const,
  x: 0,
  y: 0,
  x2: 0,
  y2: 1,
  colorStops: [
    { offset: 0, color: colors[0] },
    { offset: 1, color: colors[1] ?? colors[0] },
  ],
});

function baseGrid(isDark: boolean) {
  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: 'Inter, system-ui, sans-serif' },
    animationDuration: 800,
    animationEasing: 'cubicOut' as const,
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.96)',
      borderColor: isDark ? 'rgba(51,65,85,0.8)' : 'rgba(226,232,240,0.9)',
      textStyle: { color: isDark ? '#e2e8f0' : '#0f172a' },
    },
  };
}

export function buildEstatisticasChartOptions(
  s: EstatisticasTafCompletas,
  c: ChartThemeColors,
): { id: string; title: string; subtitle?: string; option: EChartsCoreOption; height: number }[] {
  const charts: { id: string; title: string; subtitle?: string; option: EChartsCoreOption; height: number }[] = [];

  const pie = (title: string, items: { name: string; value: number }[], height = 300) => ({
    id: title,
    title,
    option: {
      ...baseGrid(c.isDark),
      color: c.chart,
      legend: { bottom: 0, textStyle: { color: c.textMuted } },
      series: [
        {
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['50%', '46%'],
          itemStyle: { borderRadius: 8, borderColor: c.bg, borderWidth: 2 },
          label: { color: c.text, fontWeight: 600 },
          data: items.filter((i) => i.value > 0),
          emphasis: {
            scale: true,
            itemStyle: { shadowBlur: 18, shadowColor: 'rgba(99,102,241,0.35)' },
          },
        },
      ],
    } satisfies EChartsCoreOption,
    height,
  });

  charts.push(
    pie(
      'Status do TAF',
      [
        { name: 'Completo', value: s.resumo.tafCompleto },
        { name: 'Parcial', value: s.resumo.tafParcial },
        { name: 'Sem teste', value: s.resumo.semNenhumTeste },
      ],
    ),
  );

  charts.push(
    pie(
      'Registros por modalidade',
      s.registrosModalidade.map((i) => ({ name: i.label, value: i.valor })),
    ),
  );

  charts.push(
    pie(
      'Corrida vs Caminhada',
      s.corridaVsCaminhada.map((i) => ({ name: i.label, value: i.valor })),
    ),
  );

  charts.push({
    id: 'conclusao-meta',
    title: 'Meta de conclusão TAF',
    subtitle: `Meta ${s.metaConclusao.metaPct}% · faltam ${s.metaConclusao.faltam} militares`,
    height: 280,
    option: {
      ...baseGrid(c.isDark),
      series: [
        {
          type: 'gauge',
          startAngle: 200,
          endAngle: -20,
          min: 0,
          max: 100,
          progress: { show: true, width: 14, itemStyle: { color: GRADIENT([c.primary, '#6366f1']) } },
          axisLine: { lineStyle: { width: 14, color: [[1, c.isDark ? '#334155' : '#e2e8f0']] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { color: c.textMuted, distance: 20 },
          pointer: { show: false },
          detail: {
            valueAnimation: true,
            fontSize: 28,
            fontWeight: 800,
            color: c.text,
            offsetCenter: [0, '10%'],
            formatter: '{value}%',
          },
          data: [{ value: s.metaConclusao.atualPct }],
        },
      ],
    },
  });

  const barH = (title: string, labels: string[], values: number[], colorIdx = 0, height = 320) => ({
    id: title,
    title,
    height,
    option: {
      ...baseGrid(c.isDark),
      grid: { left: 12, right: 16, top: 24, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: { color: c.textMuted },
        splitLine: { lineStyle: { color: c.isDark ? '#1e293b' : '#f1f5f9' } },
      },
      yAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: c.text, fontWeight: 600 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: {
              color: GRADIENT([c.chart[colorIdx % c.chart.length], c.chart[(colorIdx + 1) % c.chart.length]]),
              borderRadius: [0, 8, 8, 0],
            },
          })),
          barWidth: 16,
          label: { show: true, position: 'right', color: c.textMuted, fontWeight: 700 },
        },
      ],
    } satisfies EChartsCoreOption,
  });

  charts.push(
    barH(
      'Pendências por modalidade',
      s.pendenciasModalidade.map((i) => i.label),
      s.pendenciasModalidade.map((i) => i.valor),
      2,
    ),
  );

  charts.push(
    barH(
      'Distribuição de notas — Corrida',
      s.notasCorrida.filter((i) => i.valor > 0).map((i) => i.label),
      s.notasCorrida.filter((i) => i.valor > 0).map((i) => i.valor),
      0,
    ),
  );

  charts.push(
    barH(
      'Distribuição de notas — Caminhada',
      s.notasCaminhada.filter((i) => i.valor > 0).map((i) => i.label),
      s.notasCaminhada.filter((i) => i.valor > 0).map((i) => i.valor),
      1,
    ),
  );

  charts.push(
    barH(
      'Distribuição de notas — Natação',
      s.notasNatacao.filter((i) => i.valor > 0).map((i) => i.label),
      s.notasNatacao.filter((i) => i.valor > 0).map((i) => i.valor),
      3,
    ),
  );

  const datas = s.registrosPorData.slice(-14);
  charts.push({
    id: 'militares-por-dia',
    title: 'Militares únicos por dia de aplicação',
    subtitle: `Média ${s.resumo.mediaMilitaresPorDia} · ${s.resumo.diasComAplicacao} dias`,
    height: 320,
    option: {
      ...baseGrid(c.isDark),
      legend: { top: 0, textStyle: { color: c.textMuted } },
      grid: { left: 12, right: 12, top: 36, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: datas.map((d) => d.data),
        axisLabel: { color: c.textMuted, rotate: 35, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: c.textMuted },
        splitLine: { lineStyle: { color: c.isDark ? '#1e293b' : '#f1f5f9' } },
      },
      series: [
        {
          name: 'Militares',
          type: 'bar',
          data: datas.map((d) => d.militaresUnicos),
          itemStyle: { color: GRADIENT([c.primary, '#38bdf8']), borderRadius: [6, 6, 0, 0] },
        },
        {
          name: 'Média',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          data: datas.map(() => s.resumo.mediaMilitaresPorDia),
          lineStyle: { color: c.gain, width: 2, type: 'dashed' },
          itemStyle: { color: c.gain },
        },
      ],
    },
  });

  const meses = s.registrosPorMes.slice(-12);
  charts.push({
    id: 'registros-mes',
    title: 'Registros por mês',
    height: 340,
    option: {
      ...baseGrid(c.isDark),
      legend: { top: 0, textStyle: { color: c.textMuted } },
      grid: { left: 12, right: 12, top: 40, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: meses.map((m) => m.mes), axisLabel: { color: c.textMuted } },
      yAxis: {
        type: 'value',
        axisLabel: { color: c.textMuted },
        splitLine: { lineStyle: { color: c.isDark ? '#1e293b' : '#f1f5f9' } },
      },
      series: [
        { name: 'Corrida', type: 'bar', stack: 't', data: meses.map((m) => m.corrida), itemStyle: { color: c.chart[0] } },
        { name: 'Caminhada', type: 'bar', stack: 't', data: meses.map((m) => m.caminhada), itemStyle: { color: c.chart[1] } },
        { name: 'Natação', type: 'bar', stack: 't', data: meses.map((m) => m.natacao), itemStyle: { color: c.chart[2] } },
        { name: 'Permanência', type: 'bar', stack: 't', data: meses.map((m) => m.permanencia), itemStyle: { color: c.chart[3] } },
      ],
    },
  });

  charts.push({
    id: 'taxas-aprovacao',
    title: 'Taxas de aprovação e desempenho',
    height: 320,
    option: {
      ...baseGrid(c.isDark),
      grid: { left: 12, right: 12, top: 16, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: [
          'Corrida OK',
          'Caminhada OK',
          'Natação OK',
          'Permanência',
          'Nota ≥50 C',
          'Nota ≥50 Cam',
          'Nota ≥50 N',
          'Global 3 provas',
        ],
        axisLabel: { color: c.textMuted, rotate: 28, fontSize: 10 },
      },
      yAxis: { type: 'value', max: 100, axisLabel: { color: c.textMuted, formatter: '{value}%' } },
      series: [
        {
          type: 'bar',
          data: [
            s.taxas.corridaSemReprovacaoPct ?? 0,
            s.taxas.caminhadaSemReprovacaoPct ?? 0,
            s.taxas.natacaoSemReprovacaoPct ?? 0,
            s.taxas.permanenciaAprovadosPct ?? 0,
            s.taxas.corridaNota50PlusPct ?? 0,
            s.taxas.caminhadaNota50PlusPct ?? 0,
            s.taxas.natacaoNota50PlusPct ?? 0,
            s.taxas.taxaGlobalAprovacaoPct ?? 0,
          ].map((v, i) => ({
            value: v,
            itemStyle: {
              color: GRADIENT([c.chart[i % c.chart.length], c.chart[(i + 2) % c.chart.length]]),
              borderRadius: [6, 6, 0, 0],
            },
          })),
          barWidth: 22,
          label: { show: true, position: 'top', formatter: '{c}%', color: c.textMuted, fontWeight: 700 },
        },
      ],
    },
  });

  if (s.heatmapReprovacao.length > 0) {
    const faixas = s.heatmapReprovacao.map((h) => h.faixa);
    const mods = ['Corrida', 'Caminhada', 'Natação'];
    const heatData: [number, number, number][] = [];
    s.heatmapReprovacao.forEach((h, yi) => {
      heatData.push([0, yi, h.corridaPct]);
      heatData.push([1, yi, h.caminhadaPct]);
      heatData.push([2, yi, h.natacaoPct]);
    });
    charts.push({
      id: 'heatmap-reprovacao',
      title: 'Heatmap — reprovação por faixa etária (%)',
      height: 300,
      option: {
        ...baseGrid(c.isDark),
        grid: { left: 80, right: 24, top: 16, bottom: 40 },
        xAxis: { type: 'category', data: mods, axisLabel: { color: c.textMuted } },
        yAxis: { type: 'category', data: faixas, axisLabel: { color: c.textMuted } },
        visualMap: {
          min: 0,
          max: 100,
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          bottom: 0,
          inRange: { color: ['#ecfdf5', '#fde68a', '#fca5a5', '#dc2626'] },
          textStyle: { color: c.textMuted },
        },
        series: [
          {
            type: 'heatmap',
            data: heatData,
            label: { show: true, formatter: '{c}%', color: c.text, fontSize: 10 },
            emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.25)' } },
          },
        ],
      },
    });
  }

  charts.push({
    id: 'radar-perfil',
    title: 'Radar — taxas por eixo',
    height: 340,
    option: {
      ...baseGrid(c.isDark),
      radar: {
        indicator: [
          { name: 'Conclusão TAF', max: 100 },
          { name: 'Corrida OK', max: 100 },
          { name: 'Natação OK', max: 100 },
          { name: 'Permanência', max: 100 },
          { name: 'Global 3 provas', max: 100 },
          { name: 'Nota média', max: 100 },
        ],
        axisName: { color: c.textMuted, fontWeight: 600 },
        splitLine: { lineStyle: { color: c.isDark ? '#334155' : '#e2e8f0' } },
        splitArea: { areaStyle: { color: c.isDark ? ['#0f172a', '#1e293b'] : ['#f8fafc', '#fff'] } },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: [
                s.resumo.taxaConclusaoTafPct ?? 0,
                s.taxas.corridaSemReprovacaoPct ?? 0,
                s.taxas.natacaoSemReprovacaoPct ?? 0,
                s.taxas.permanenciaAprovadosPct ?? 0,
                s.taxas.taxaGlobalAprovacaoPct ?? 0,
                s.notaMediaGeral ?? 0,
              ],
              areaStyle: { color: 'rgba(99,102,241,0.25)' },
              lineStyle: { color: c.primary, width: 2 },
              itemStyle: { color: c.primary },
            },
          ],
        },
      ],
    },
  });

  charts.push(
    pie(
      'Perfil — categoria',
      s.porCategoria.map((i) => ({ name: i.label, value: i.valor })),
      280,
    ),
  );

  charts.push(
    pie('Perfil — sexo', s.porSexo.map((i) => ({ name: i.label, value: i.valor })), 280),
  );

  charts.push(
    barH(
      'Top postos (efetivo)',
      s.topPostosGrad.map((i) => i.label),
      s.topPostosGrad.map((i) => i.valor),
      4,
      360,
    ),
  );

  charts.push(
    barH(
      'Nota média por posto (top 12)',
      s.desempenhoPorPosto.map((i) => i.label),
      s.desempenhoPorPosto.map((i) => i.valor),
      0,
      380,
    ),
  );

  charts.push({
    id: 'sessoes-prova',
    title: 'Sessões no histórico por prova',
    subtitle: `Total ${s.operacional.totalSessoes} sessões · média ${s.operacional.mediaParticipantesPorSessao} participantes`,
    height: 300,
    option: {
      ...baseGrid(c.isDark),
      series: [
        {
          type: 'pie',
          roseType: 'area',
          radius: [20, 90],
          center: ['50%', '52%'],
          itemStyle: { borderRadius: 6 },
          label: { color: c.text },
          data: (
            [
              ['Corrida', s.operacional.contagemPorProva.corrida],
              ['Caminhada', s.operacional.contagemPorProva.caminhada],
              ['Natação', s.operacional.contagemPorProva.natacao],
              ['Permanência', s.operacional.contagemPorProva.permanencia],
            ] as const
          )
            .filter(([, v]) => v > 0)
            .map(([name, value]) => ({ name, value })),
          color: c.chart,
        },
      ],
    },
  });

  return charts;
}
