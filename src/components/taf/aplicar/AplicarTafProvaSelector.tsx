import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Activity, Waves, Timer, Footprints } from 'lucide-react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { getUiColors } from '../../../theme/uiColors';
import { PREMIUM } from '../../../theme/premium';
import { getAplicarTafGlass } from './aplicarTafTheme';
import { useAplicarTafLayout } from './useAplicarTafLayout';

type ProvaId = 'corrida' | 'natacao' | 'permanencia' | 'caminhada';

const PROVAS: {
  id: ProvaId;
  label: string;
  icon: typeof Activity;
  colors: [string, string];
}[] = [
  { id: 'corrida', label: 'Corrida', icon: Activity, colors: ['#2563eb', '#38bdf8'] },
  { id: 'natacao', label: 'Natação', icon: Waves, colors: ['#0891b2', '#6366f1'] },
  { id: 'permanencia', label: 'Permanência', icon: Timer, colors: ['#7c3aed', '#4f46e5'] },
  { id: 'caminhada', label: 'Caminhada', icon: Footprints, colors: ['#059669', '#14b8a6'] },
];

type Props = {
  onSelect: (id: ProvaId) => void;
};

export function AplicarTafProvaSelector({ onSelect }: Props) {
  const { theme } = useTheme();
  const ui = getUiColors(theme);
  const glass = getAplicarTafGlass(theme);
  const { provaTileWidth, isNativeMobile } = useAplicarTafLayout();

  return (
    <View style={styles.grid}>
      {PROVAS.map((prova) => {
        const Icon = prova.icon;
        return (
          <TouchableOpacity
            key={prova.id}
            accessibilityLabel={prova.label}
            activeOpacity={0.9}
            onPress={() => onSelect(prova.id)}
            style={[styles.tileWrap, { width: provaTileWidth, maxWidth: provaTileWidth }]}
          >
            <View
              style={[
                styles.tile,
                {
                  backgroundColor: glass.bg,
                  borderColor: glass.border,
                  minHeight: isNativeMobile ? 100 : 108,
                },
                Platform.OS === 'web'
                  ? ({ boxShadow: '0 8px 24px rgba(15,23,42,0.08)' } as object)
                  : null,
              ]}
            >
              <LinearGradient
                colors={prova.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconBadge}
              >
                <Icon size={22} color="#fff" strokeWidth={2.3} />
              </LinearGradient>
              <Text style={[styles.label, { color: ui.text }]}>{prova.label}</Text>
              <View style={[styles.arrow, { backgroundColor: theme.isDark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.16)' }]}>
                <Text style={[styles.arrowText, { color: theme.primary }]}>→</Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  tileWrap: {
    flexGrow: 0,
    flexShrink: 0,
  },
  tile: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusLg,
    padding: 14,
    minHeight: 108,
    gap: 10,
    position: 'relative',
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  arrow: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 14,
    fontWeight: '900',
  },
});
