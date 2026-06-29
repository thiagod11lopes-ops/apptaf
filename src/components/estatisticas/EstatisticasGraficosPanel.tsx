import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import type { EstatisticasTafCompletas } from '../../utils/estatisticasTaf';
import { buildEstatisticasChartOptions } from '../../utils/estatisticasChartOptions';
import { EChartsView } from './EChartsView';
import { StatSection } from './StatSection';
import { GraficosExemploIconButton, GraficosExemploModal } from './GraficosExemploModal';

type Props = {
  stats: EstatisticasTafCompletas;
};

export function EstatisticasGraficosPanel({ stats }: Props) {
  const { theme, isDark } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const [exemplosAbertos, setExemplosAbertos] = useState(false);

  const charts = useMemo(
    () =>
      buildEstatisticasChartOptions(stats, {
        isDark,
        text: ui.text,
        textMuted: theme.textMuted,
        primary: theme.primary,
        gain: theme.gain,
        loss: theme.loss,
        chart: theme.chartColors,
        bg: theme.background,
        border: theme.border,
      }),
    [stats, isDark, ui.text, theme],
  );

  return (
    <>
      <View style={styles.leadRow}>
        <Text style={[theme.textStyles.bodySecondary, styles.lead, { color: theme.textSecondary, flex: 1 }]}>
          Visualização interativa · Apache ECharts · animações e tooltips em todos os indicadores.
        </Text>
        <GraficosExemploIconButton onPress={() => setExemplosAbertos(true)} />
      </View>
      <View style={styles.wrap}>
        {charts.map((chart) => (
          <StatSection
            key={chart.id}
            title={chart.title}
            subtitle={chart.subtitle}
            accent="cyan"
          >
            <View style={[styles.chartShell, { borderColor: theme.border, backgroundColor: theme.cardBg }]}>
              <EChartsView option={chart.option} height={chart.height} isDark={isDark} />
            </View>
          </StatSection>
        ))}
      </View>
      <GraficosExemploModal visible={exemplosAbertos} onClose={() => setExemplosAbertos(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  leadRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  lead: { fontSize: 12, lineHeight: 18 },
  chartShell: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    padding: 8,
  },
});
