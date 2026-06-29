import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LayoutGrid, AlertCircle } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import { PREMIUM } from '../../theme/premium';
import { getAplicarTafGlass } from '../taf/aplicar/aplicarTafTheme';
import { TafGlassPanel } from '../mobile/TafTabChrome';

export type AbaResultadosNav = 'historico' | 'consulta' | 'pendencia' | 'geral';

type Props = {
  value: AbaResultadosNav;
  onChange: (id: AbaResultadosNav) => void;
};

const PRIMARY: { id: Extract<AbaResultadosNav, 'historico' | 'consulta'>; label: string }[] = [
  { id: 'historico', label: 'Histórico' },
  { id: 'consulta', label: 'Gerenciar Resultados' },
];

const SECONDARY: {
  id: Extract<AbaResultadosNav, 'geral' | 'pendencia'>;
  label: string;
  subtitle: string;
  Icon: typeof LayoutGrid;
  accent: 'cyan' | 'violet';
}[] = [
  {
    id: 'geral',
    label: 'Resultado Geral',
    subtitle: 'Visão consolidada',
    Icon: LayoutGrid,
    accent: 'cyan',
  },
  {
    id: 'pendencia',
    label: 'Pendência',
    subtitle: 'TAF incompleto',
    Icon: AlertCircle,
    accent: 'violet',
  },
];

function PrimaryTab({
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
        style={styles.primaryBtnWrap}
      >
        <LinearGradient
          colors={[theme.primary, '#6366f1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.primaryBtnActive}
        >
          <Text style={styles.primaryBtnTextActive} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
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
      style={[styles.primaryBtn, { backgroundColor: glass.highlight }]}
    >
      <Text
        style={[styles.primaryBtnText, { color: theme.textSecondary }]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SecondaryTile({
  label,
  subtitle,
  Icon,
  accent,
  active,
  onPress,
}: {
  label: string;
  subtitle: string;
  Icon: typeof LayoutGrid;
  accent: 'cyan' | 'violet';
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const ui = getUiColors(theme);
  const glass = getAplicarTafGlass(theme);
  const accentColor = accent === 'violet' ? '#6366f1' : theme.primary;

  return (
    <TouchableOpacity
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      activeOpacity={0.9}
      onPress={onPress}
      style={styles.secondaryTileWrap}
    >
      {active ? (
        <LinearGradient
          colors={
            accent === 'violet'
              ? ['#6366f1', '#4f46e5']
              : [theme.primary, '#6366f1']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.secondaryTile,
            Platform.OS === 'web'
              ? ({ boxShadow: '0 10px 28px rgba(99,102,241,0.22)' } as object)
              : null,
          ]}
        >
          <View style={styles.secondaryIconRingActive}>
            <Icon size={20} color="#fff" strokeWidth={2.4} />
          </View>
          <View style={styles.secondaryTextCol}>
            <Text style={styles.secondaryLabelActive}>{label}</Text>
            <Text style={styles.secondarySubActive}>{subtitle}</Text>
          </View>
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.secondaryTile,
            {
              borderColor: glass.border,
              backgroundColor: theme.isDark ? 'rgba(2,6,23,0.38)' : 'rgba(255,255,255,0.55)',
            },
            Platform.OS === 'web'
              ? ({ boxShadow: '0 6px 20px rgba(15,23,42,0.06)' } as object)
              : null,
          ]}
        >
          <View
            style={[
              styles.secondaryIconRing,
              {
                backgroundColor: theme.isDark ? 'rgba(56,189,248,0.12)' : PREMIUM.accentMuted,
                borderColor: accent === 'violet' ? 'rgba(99,102,241,0.25)' : 'rgba(37,99,235,0.2)',
              },
            ]}
          >
            <Icon size={20} color={accentColor} strokeWidth={2.3} />
          </View>
          <View style={styles.secondaryTextCol}>
            <Text style={[styles.secondaryLabel, { color: ui.text }]}>{label}</Text>
            <Text style={[styles.secondarySub, { color: theme.textMuted }]}>{subtitle}</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function ResultadosNavTabs({ value, onChange }: Props) {
  const glass = getAplicarTafGlass(useTheme().theme);

  return (
    <TafGlassPanel accent="cyan" style={styles.wrap}>
      <View style={styles.primaryRow}>
        <View style={[styles.primarySegmented, { borderColor: glass.border }]}>
          {PRIMARY.map((opt) => (
            <PrimaryTab
              key={opt.id}
              label={opt.id === 'historico' ? opt.label : opt.label}
              active={value === opt.id}
              onPress={() => onChange(opt.id)}
            />
          ))}
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: glass.border }]} />

      <View style={styles.secondaryRow}>
        {SECONDARY.map((opt) => (
          <SecondaryTile
            key={opt.id}
            label={opt.label}
            subtitle={opt.subtitle}
            Icon={opt.Icon}
            accent={opt.accent}
            active={value === opt.id}
            onPress={() => onChange(opt.id)}
          />
        ))}
      </View>
    </TafGlassPanel>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
    gap: 12,
  },
  primaryRow: {
    width: '100%',
  },
  primarySegmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd + 4,
    padding: 4,
    gap: 4,
  },
  primaryBtnWrap: {
    flex: 1,
    borderRadius: PREMIUM.radiusMd,
    overflow: 'hidden',
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  primaryBtnActive: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  primaryBtnTextActive: {
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
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryTileWrap: {
    flex: 1,
    minWidth: 0,
    borderRadius: PREMIUM.radiusLg,
    overflow: 'hidden',
  },
  secondaryTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: PREMIUM.radiusLg,
    borderWidth: 1,
    minHeight: 68,
  },
  secondaryIconRing: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  secondaryIconRingActive: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  secondaryTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  secondaryLabel: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  secondaryLabelActive: {
    fontSize: 13,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.2,
  },
  secondarySub: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  secondarySubActive: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 14,
  },
});
