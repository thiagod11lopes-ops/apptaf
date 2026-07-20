import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { AppModal } from '../premium/AppModal';
import { X, CircleHelp } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import { PREMIUM } from '../../theme/premium';
import { buildEstatisticasChartDemoOptions } from '../../utils/estatisticasChartOptions';
import { EChartsView } from './EChartsView';
import { StatSection } from './StatSection';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function GraficosExemploModal({ visible, onClose }: Props) {
  const { theme, isDark } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);

  const demoCharts = useMemo(
    () =>
      buildEstatisticasChartDemoOptions({
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
    [isDark, ui.text, theme],
  );

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={[theme.textStyles.h2, { color: ui.text }]}>Exemplos de gráficos</Text>
              <Text style={[theme.textStyles.caption, { color: theme.textSecondary, marginTop: 4 }]}>
                Prévia com dados fictícios — assim ficam os gráficos quando houver registros TAF.
              </Text>
            </View>
            <TouchableOpacity
              accessibilityLabel="Fechar exemplos"
              onPress={onClose}
              style={[styles.closeBtn, { borderColor: theme.border }]}
            >
              <X size={18} color={ui.text} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {demoCharts.map((chart) => (
              <StatSection
                key={chart.id}
                title={chart.title}
                subtitle={chart.subtitle}
                accent="violet"
              >
                <View
                  style={[styles.chartShell, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
                >
                  <EChartsView option={chart.option} height={chart.height} isDark={isDark} />
                </View>
              </StatSection>
            ))}
          </ScrollView>
        </View>
      </View>
    </AppModal>
  );
}

type IconProps = {
  onPress: () => void;
};

export function GraficosExemploIconButton({ onPress }: IconProps) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      accessibilityLabel="Ver exemplos de gráficos com dados"
      accessibilityHint="Abre uma prévia de como os gráficos ficam quando houver registros TAF"
      onPress={onPress}
      style={[styles.iconBtn, { borderColor: theme.border, backgroundColor: theme.accentMuted }]}
    >
      <CircleHelp size={16} color={theme.primary} strokeWidth={2.4} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    maxHeight: '92%',
    alignSelf: 'center',
    borderRadius: PREMIUM.radiusLg + 4,
    borderWidth: 1,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 24px 64px rgba(15,23,42,0.22)' } as object)
      : { elevation: 12 }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.35)',
  },
  headerText: { flex: 1, minWidth: 0 },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flexGrow: 0 },
  scrollContent: { padding: 16, gap: 4, paddingBottom: 24 },
  chartShell: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    padding: 8,
  },
});
