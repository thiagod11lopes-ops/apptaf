import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { PREMIUM } from '../../theme/premium';
import { getAplicarTafGlass } from '../taf/aplicar/aplicarTafTheme';
import { TafGlassPanel } from '../mobile/TafTabChrome';

export type AbaResultadosNav = 'historico' | 'consulta' | 'pendencia' | 'geral';

type Props = {
  value: AbaResultadosNav;
  onChange: (id: AbaResultadosNav) => void;
};

const ROWS: { id: AbaResultadosNav; label: string }[][] = [
  [
    { id: 'historico', label: 'Histórico' },
    { id: 'consulta', label: 'Gerenciar Resultados' },
  ],
  [
    { id: 'geral', label: 'Resultado Geral' },
    { id: 'pendencia', label: 'Pendência' },
  ],
];

function TabBtn({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const glass = getAplicarTafGlass(theme);

  if (active) {
    return (
      <TouchableOpacity
        accessibilityRole="tab"
        accessibilityState={{ selected: true }}
        activeOpacity={0.9}
        onPress={onPress}
        style={styles.btnWrap}
      >
        <LinearGradient
          colors={[theme.primary, '#6366f1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.btnActive}
        >
          <Text style={styles.btnTextActive} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
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
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function ResultadosNavTabs({ value, onChange }: Props) {
  const glass = getAplicarTafGlass(useTheme().theme);

  return (
    <TafGlassPanel accent="cyan" style={styles.wrap}>
      {ROWS.map((row, rowIndex) => (
        <React.Fragment key={row.map((t) => t.id).join('-')}>
          {rowIndex > 0 ? <View style={[styles.divider, { backgroundColor: glass.border }]} /> : null}
          <View style={[styles.row, { borderColor: glass.border }]}>
            {row.map((opt) => (
              <TabBtn
                key={opt.id}
                label={opt.label}
                active={value === opt.id}
                onPress={() => onChange(opt.id)}
              />
            ))}
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
    paddingHorizontal: 10,
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
});
