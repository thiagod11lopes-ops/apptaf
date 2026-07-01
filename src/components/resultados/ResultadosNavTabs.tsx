import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { PREMIUM } from '../../theme/premium';
import { getAplicarTafGlass } from '../taf/aplicar/aplicarTafTheme';
import { TafGlassPanel } from '../mobile/TafTabChrome';

export type AbaResultadosNav = 'historico' | 'consulta' | 'pendencia' | 'geral' | 'concluido';

type Props = {
  value: AbaResultadosNav;
  onChange: (id: AbaResultadosNav) => void;
};

type TabDef = { id: AbaResultadosNav; label: string };

const ROWS: (TabDef | { type: 'split'; tabs: TabDef[] })[][] = [
  [
    { id: 'historico', label: 'Histórico' },
    { id: 'consulta', label: 'Gerenciar Resultados' },
  ],
  [
    { id: 'geral', label: 'Resultado Geral' },
    {
      type: 'split',
      tabs: [
        { id: 'pendencia', label: 'Pendência' },
        { id: 'concluido', label: 'Concluído' },
      ],
    },
  ],
];

function TabBtn({
  label,
  active,
  onPress,
  variant = 'primary',
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  variant?: 'primary' | 'success';
}) {
  const { theme } = useTheme();
  const glass = getAplicarTafGlass(theme);

  if (active) {
    const colors =
      variant === 'success'
        ? (['#059669', '#14b8a6'] as const)
        : ([theme.primary, '#6366f1'] as const);
    return (
      <TouchableOpacity
        accessibilityRole="tab"
        accessibilityState={{ selected: true }}
        activeOpacity={0.9}
        onPress={onPress}
        style={styles.btnWrap}
      >
        <LinearGradient
          colors={[...colors]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btnActive}
        >
          <Text style={styles.btnTextActive} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>
            {label}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      accessibilityRole="tab"
      accessibilityState={{ selected: false }}
      activeOpacity={0.88}
      onPress={onPress}
      style={[styles.btn, { backgroundColor: glass.highlight }]}
    >
      <Text
        style={[styles.btnText, { color: theme.textSecondary }]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SplitTabGroup({
  tabs,
  value,
  onChange,
}: {
  tabs: TabDef[];
  value: AbaResultadosNav;
  onChange: (id: AbaResultadosNav) => void;
}) {
  const { theme } = useTheme();
  const glass = getAplicarTafGlass(theme);

  return (
    <View style={[styles.splitWrap, { borderColor: glass.border, backgroundColor: glass.highlight }]}>
      {tabs.map((tab, index) => (
        <React.Fragment key={tab.id}>
          {index > 0 ? <View style={[styles.splitDivider, { backgroundColor: glass.border }]} /> : null}
          <TabBtn
            label={tab.label}
            active={value === tab.id}
            onPress={() => onChange(tab.id)}
            variant={tab.id === 'concluido' ? 'success' : 'primary'}
          />
        </React.Fragment>
      ))}
    </View>
  );
}

export function ResultadosNavTabs({ value, onChange }: Props) {
  const glass = getAplicarTafGlass(useTheme().theme);

  return (
    <TafGlassPanel accent="cyan" style={styles.wrap}>
      {ROWS.map((row, rowIndex) => (
        <React.Fragment key={rowIndex}>
          {rowIndex > 0 ? <View style={[styles.divider, { backgroundColor: glass.border }]} /> : null}
          <View style={[styles.row, { borderColor: glass.border }]}>
            {row.map((opt) => {
              if ('type' in opt && opt.type === 'split') {
                return (
                  <View key="split-pendencia-concluido" style={styles.splitCell}>
                    <SplitTabGroup tabs={opt.tabs} value={value} onChange={onChange} />
                  </View>
                );
              }
              const tab = opt as TabDef;
              return (
                <TabBtn
                  key={tab.id}
                  label={tab.label}
                  active={value === tab.id}
                  onPress={() => onChange(tab.id)}
                />
              );
            })}
          </View>
        </React.Fragment>
      ))}
    </TafGlassPanel>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd + 4,
    padding: 4,
    gap: 4,
  },
  btnWrap: {
    flex: 1,
    borderRadius: PREMIUM.radiusMd,
    overflow: 'hidden',
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  btnActive: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  btnTextActive: {
    fontSize: 13,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  divider: {
    height: 1,
    width: '100%',
    opacity: 0.7,
  },
  splitCell: {
    flex: 1,
  },
  splitWrap: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: PREMIUM.radiusMd,
    overflow: 'hidden',
    minHeight: 44,
  },
  splitDivider: {
    width: 1,
    alignSelf: 'stretch',
    opacity: 0.85,
  },
});
